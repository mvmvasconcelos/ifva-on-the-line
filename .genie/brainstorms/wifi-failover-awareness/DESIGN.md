# Design: WiFi Uplink Awareness + Confiabilidade da Classificação de Causa

| Field | Value |
|-------|-------|
| **Slug** | `wifi-failover-awareness` |
| **Date** | 2026-07-15 |
| **WRS** | 100/100 |

## Problem

O sistema de causa de quedas do IFVA On The Line precisa aproveitar a nova interface WiFi de fallback do servidor (rede `MCV-016`, independente do provedor da escola, ativada por `lan-failover.timer` fora deste repo) para ganhar confiança na classificação, e precisa parar de gerar tantos incidentes "Não determinada".

Suporte para o segundo ponto: a distinção `interno_firewall` vs `externo` já está correta no código atual (`gateway_ok`/`internet_ok`); o volume alto de incidentes curtos (19-36 min) como "Não determinada" não bate com esse caminho de código e, pela análise dos logs, aponta para falhas silenciosas de entrega do heartbeat à API do GitHub (sem sonda dedicada, sem registro do motivo) combinadas com a janela de confirmação dupla do watchdog (~22-30+ min por natureza).

## Scope

### IN
- Novo campo `active_uplink` (`lan`/`wifi`) no probe do `heartbeat_v2.sh`, detectado via `ip route get 1.1.1.1`, comparando o `dev <iface>` retornado contra novas variáveis de ambiente `LAN_IFACE`/`WIFI_IFACE` (defaults `eno1`/`wlp1s2`, seguindo o mesmo padrão de configuração já usado por `FIREWALL_IP`/`INTERNET_TARGET`); qualquer outra interface ou falha de parse → `"unknown"`.
- Nova sonda `github_api_ok` no `heartbeat_v2.sh` (checagem de alcance a `api.github.com` antes do envio), para diferenciar "GitHub inalcançável momentaneamente" de "problema de rede real do campus". Justificativa por não ser redundante com o item de log de falha de entrega abaixo: o preflight isola falha de DNS/conectividade a `api.github.com` (rede) de uma falha na chamada real de dispatch (ex.: auth/rate-limit/payload), que são causas raiz diferentes.
- Registro do motivo de falha de entrega: quando o `curl` do dispatch não retornar HTTP 204, adicionar um campo `delivery_error` (código HTTP ou motivo de erro do curl) na linha já escrita em `queue.jsonl` para aquele ciclo, antes de sair com erro — assim o próximo lote enviado com sucesso carrega esse diagnóstico. Isso resolve o hoje: falha silenciosa, sem nenhum dado retido.
- `process_heartbeat.py` / `watchdog.py`: expor `active_uplink` e `github_api_ok` em `status.json`/`incidents.json` como metadados de confiança (sem criar nova categoria na taxonomia de causa existente — `interno_firewall`/`externo`/`interno_servidor`/`interno_misto` permanecem como estão, já validados pelo usuário).
- Ajuste de tempo: `TIMEOUT_MINUTES` de 17 → 30 em **todos** os pontos onde esse número está hoje hardcoded, mantidos em sincronia:
  - `watchdog.yml` (env var `TIMEOUT_MINUTES: "17"`)
  - `process_heartbeat.py` (constante `TIMEOUT_MINUTES = 17`)
  - `web/src/components/StatusHeader.jsx:21` (`minutesSinceLastSeen < 17`)
  - `web/src/components/HeartbeatMonitor.jsx:47,155` (`diffMinutes >= 17` e o texto literal "Alerta após 17 minutos sem sinal")
- Dashboard (`StatusHeader.jsx` ou novo stat tile): indicador de uplink ativo (LAN/WiFi) e, quando aplicável, selo "confirmado vivo via WiFi" durante uma queda `interno_firewall`.
- Polimento de documentação:
  - Corrigir a afirmação incorreta em `scripts/lan-failover.md` (hoje diz que `gateway_ok=false+internet_ok=true` vira `externo` — na verdade vira `interno_firewall`).
  - Remover/reescrever a proposta de nova categoria de causa em `ROADMAP.md` (Fase 10) e em "Adaptações sugeridas" de `scripts/lan-failover.md` (que hoje sugerem algo como `interno_firewall_com_fallback`) para alinhar com a Decisão #2 deste design (metadado de confiança, não nova taxonomia).
  - Atualizar `README.md` e `scripts/README.md` refletindo o desenho final.
  - Revisar essas docs em busca de qualquer outro trecho defasado (v2.1 vs mudanças recentes).

### OUT
- Não criar novas categorias na taxonomia de `cause_final` (mantém as 4 atuais + `unknown`).
- Não migrar `data/*.json` para outro formato de armazenamento.
- Não implementar retry-with-backoff dentro da mesma execução do `heartbeat_v2.sh` (o registro do motivo de falha já resolve o diagnóstico; retry fica como possível trabalho futuro se o problema persistir).
- Não mexer em `notifier.py` além de textos afetados pelos novos campos/tempo, se necessário.
- Não alterar o mecanismo `lan-failover.timer`/`.service` em si (é infraestrutura do host, fora deste repositório).

## Approach

Duas frentes executadas juntas por serem parte da mesma limpeza de confiabilidade, mas com interfaces bem separadas:

1. **Uplink awareness** (bash → python → dashboard): um campo simples e factual (`active_uplink`) flui pelo payload sem alterar a lógica de classificação existente — só adiciona confiança/visibilidade a uma causa já corretamente inferida.
2. **Diagnóstico de entrega** (bash → fila local → dashboard/logs): uma sonda nova (`github_api_ok`) e registro do motivo de falha eliminam a "caixa-preta" que hoje produz "Não determinada" sem dado nenhum.

Alternativa descartada: criar uma nova categoria de causa tipo `interno_firewall_com_bypass`. Rejeitada porque a taxonomia atual já está correta segundo o usuário; a informação nova é sobre *confiança/evidência*, não sobre uma causa diferente — manter simples evita convolução, que foi uma preocupação explícita.

Alternativa descartada para detecção de uplink: ler `/run/lan-failover.state`. Rejeitada por criar acoplamento implícito com o formato interno de outro serviço (fora do repo); `ip route get` é auto-contido e reflete a realidade no momento exato do probe.

### Ordem de execução (para /wish organizar em execution groups)

Duas trilhas sem dependência mútua, que podem ser grupos de execução separados dentro da mesma wish:

- **Trilha A — Timeout + limpeza de documentação** (baixo risco, sem dependências, shippable isoladamente): ajuste dos 4 pontos de `TIMEOUT_MINUTES`/`17` (backend + frontend) e o polimento de `README.md`/`ROADMAP.md`/`scripts/README.md`/`scripts/lan-failover.md`.
- **Trilha B — Uplink awareness + diagnóstico de entrega** (feature maior, com dependência interna sequencial): `heartbeat_v2.sh` (`active_uplink`, `github_api_ok`, `delivery_error`) → depends-on → `process_heartbeat.py`/`watchdog.py` (consumir e expor os novos campos) → depends-on → `StatusHeader.jsx` (exibir o indicador).

Validação sugerida por grupo:
- Trilha A: `grep -rn "17" watchdog.yml scripts/process_heartbeat.py web/src/components/StatusHeader.jsx web/src/components/HeartbeatMonitor.jsx` não deve mais retornar ocorrências do timeout antigo; revisão manual de diff nos 4 arquivos de doc.
- Trilha B (bash): `STATE_DIR=/tmp/ifva-test GITHUB_TOKEN=... GITHUB_OWNER=... GITHUB_REPO=... bash scripts/heartbeat_v2.sh` rodado com `LAN_IFACE`/`WIFI_IFACE` simulados, inspecionando o payload gerado antes do envio.
- Trilha B (python): teste unitário/manual de `process_heartbeat.py` com um payload de exemplo contendo `active_uplink`/`github_api_ok`/`delivery_error`, verificando que `cause_final` não muda de valor possível.
- Trilha B (dashboard): `npm run dev` em `web/`, inspecionar `StatusHeader.jsx` com um `status.json` de teste simulando `active_uplink: "wifi"`.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `active_uplink` detectado via `ip route get 1.1.1.1` (parse da interface), não via state file do failover | Evita depender do formato interno de outro serviço; reflete a rota real usada no probe |
| 2 | Nenhuma nova categoria de `cause_final`; `active_uplink`/`github_api_ok` são metadados de confiança | Taxonomia atual já validada como correta; evita convolução pedida explicitamente pelo usuário |
| 3 | Nova sonda `github_api_ok` + registro do motivo de falha de entrega na fila local | Hipótese principal para os "Não determinada" de 19-36min: falha de entrega específica ao GitHub, não à LAN |
| 4 | `TIMEOUT_MINUTES` 17 → 30 em `watchdog.yml` e `process_heartbeat.py` (mantidos em sincronia) | Reduz ruído de blips curtos; trade-off aceito de alertar quedas reais ~13min mais tarde |
| 5 | Indicador de uplink no dashboard + documentação totalmente revisada/corrigida nesta mesma wish | Pedido explícito do usuário ("polimento completo"); baixo risco por serem mudanças de exibição/texto |

## Risks & Assumptions

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | É servidor de produção real do campus — testes de failover podem gerar incidentes/alertas reais para destinatários | High | Validar primeiro em simulação local (`STATE_DIR`/env apontando para diretório de teste, sem tocar rede real); só then agendar um teste controlado de failover real, avisando os destinatários com antecedência |
| 2 | Aumentar `TIMEOUT_MINUTES` para 30 atrasa a detecção de quedas reais em ~13 min a mais | Medium | Trade-off consciente e solicitado pelo usuário; documentar claramente no ROADMAP/README o novo tempo de detecção |
| 3 | Hipótese do `github_api_ok` como causa dos "Não determinada" ainda não está 100% confirmada — pode haver outras causas (systemd timer falhando, relógio do servidor, etc.) | Medium | Sonda nova + log do motivo de falha servem também para *confirmar ou refutar* a hipótese com dados reais nas próximas ocorrências, não dependem de estar certa de antemão |
| 4 | `ip route get 1.1.1.1` pode ter formato de saída ligeiramente diferente entre versões do `iproute2` | Low | Parse defensivo (regex simples por `dev <iface>`), fallback para `unknown` se não conseguir parsear |
| 5 | Polimento de documentação pode tocar muitos arquivos de uma vez | Low | Revisar diffs por arquivo antes de commitar; manter links relativos intactos |
| 6 | Teste de failover real em produção depende de agendamento manual fora do ciclo de código/CI | Low | Ver gate de sign-off manual separado, fora das Success Criteria binárias (não bloqueia o merge do código) |

## Success Criteria

- [ ] `heartbeat_v2.sh` envia `active_uplink` (`lan`/`wifi`, via `LAN_IFACE`/`WIFI_IFACE`) e `github_api_ok` no payload, testado localmente com simulação (sem mexer na rede real).
- [ ] Falha de entrega registra `delivery_error` (HTTP code/erro de curl) na linha da fila local antes de sair com erro.
- [ ] `status.json`/`incidents.json` carregam esses campos como metadados, sem alterar os valores possíveis de `cause_final`.
- [ ] `grep -rn "17" watchdog.yml scripts/process_heartbeat.py web/src/components/StatusHeader.jsx web/src/components/HeartbeatMonitor.jsx` não retorna mais o timeout antigo — todos os 4 pontos usam 30.
- [ ] Dashboard (`StatusHeader.jsx`) exibe o uplink ativo e, quando aplicável, confirmação de servidor vivo via WiFi durante queda `interno_firewall`.
- [ ] `README.md`, `ROADMAP.md`, `scripts/README.md` e `scripts/lan-failover.md` atualizados e consistentes entre si, com a afirmação incorreta sobre `externo` corrigida e a proposta de nova categoria de causa removida/realinhada com a Decisão #2.

**Gate manual (fora do critério binário de código):** teste de failover real agendado e executado no servidor do campus, com resultado documentado — ver Risco #1/#6.

## Next Step

Run `/wish` to convert this design into an executable plan.
