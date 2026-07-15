# Wish: WiFi Uplink Awareness + Confiabilidade da Classificação de Causa

| Field | Value |
|-------|-------|
| **Status** | SHIPPED |
| **Slug** | `wifi-failover-awareness` |
| **Date** | 2026-07-15 |
| **Author** | Vinicius Vasconcelos |
| **Appetite** | Pequeno lote — Grupos 1-2 são mudanças rápidas e de baixo risco (shippable em horas); Grupos 3-5 (bash→python→dashboard) são o grosso do esforço, sequenciais, mais o teste real em produção como gate manual fora do código |
| **Branch** | `wish/wifi-failover-awareness` |
| **Design** | [DESIGN.md](../../brainstorms/wifi-failover-awareness/DESIGN.md) |

## Summary

O servidor do campus ganhou uma segunda interface WiFi (`MCV-016`, independente do provedor da escola) como fallback automático de rede, via `lan-failover.timer` (infra do host, fora deste repo). Esta wish aproveita isso para dar ao heartbeat evidência real de qual uplink está ativo e diagnóstico de falhas de entrega ao GitHub, sem alterar a taxonomia de causa já validada — e corrige o timeout de detecção (17→30min) e a documentação, que hoje contém uma afirmação incorreta e uma proposta de nova categoria de causa que não deve avançar.

## Scope

### IN

- `active_uplink` (`lan`/`wifi`) no probe do `heartbeat_v2.sh`, via `ip route get 1.1.1.1` comparado contra `LAN_IFACE`/`WIFI_IFACE` (defaults `eno1`/`wlp1s2`).
- Sonda `github_api_ok` (preflight a `api.github.com`) no `heartbeat_v2.sh`.
- Campo `delivery_error` (HTTP code / erro de curl) gravado na linha da fila (`queue.jsonl`) quando o dispatch falhar.
- `process_heartbeat.py`/`watchdog.py` expondo `active_uplink`/`github_api_ok` em `status.json`/`incidents.json` como metadados de confiança, sem criar nova categoria de `cause_final`.
- `TIMEOUT_MINUTES` 17→30 em `watchdog.yml`, `process_heartbeat.py`, `StatusHeader.jsx` e `HeartbeatMonitor.jsx` (os 4 pontos hoje hardcoded).
- Indicador de uplink ativo no dashboard (`StatusHeader.jsx`), com selo "confirmado vivo via WiFi" quando aplicável durante `interno_firewall`.
- Correção de `scripts/lan-failover.md` (afirmação incorreta sobre `externo`) e remoção/realinhamento da proposta de nova categoria de causa em `ROADMAP.md` (Fase 10) e `scripts/lan-failover.md`.
- Atualização de `README.md`/`scripts/README.md` refletindo o desenho final; revisão geral de trechos defasados nesses 4 arquivos de doc.

### OUT

- Novas categorias em `cause_final` (mantém as 4 atuais + `unknown`).
- Migração de `data/*.json` para outro formato de armazenamento.
- Retry-with-backoff dentro da mesma execução do `heartbeat_v2.sh`.
- Mudanças em `notifier.py` além de textos afetados pelos novos campos/tempo.
- Alterações no `lan-failover.timer`/`.service` em si (infraestrutura do host, fora deste repositório).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | `active_uplink` via `ip route get 1.1.1.1` + `LAN_IFACE`/`WIFI_IFACE` env vars (não via `/run/lan-failover.state`) | Evita acoplamento com o formato interno de outro serviço fora do repo; segue o padrão de configuração já usado por `FIREWALL_IP`/`INTERNET_TARGET` |
| 2 | Nenhuma nova categoria de `cause_final`; `active_uplink`/`github_api_ok` são metadados de confiança | Taxonomia atual já validada como correta pelo usuário; evita convolução |
| 3 | Nova sonda `github_api_ok` (preflight) + `delivery_error` (falha real do dispatch) — as duas, não uma só | Preflight isola falha de DNS/conectividade a `api.github.com`; `delivery_error` captura falha na chamada real (auth/rate-limit/payload) — causas raiz diferentes |
| 4 | `TIMEOUT_MINUTES` 17→30 em backend E frontend (4 arquivos), mantidos em sincronia | Reduz ruído de "Não determinada" em blips curtos; trade-off aceito de alertar quedas reais ~13min mais tarde |
| 5 | Duas trilhas (timeout+docs vs. uplink+diagnóstico) na mesma wish, como grupos de execução separados | Nenhuma depende da outra; permite shippar a trilha rápida sem esperar a maior |

## Success Criteria

- [x] `heartbeat_v2.sh` envia `active_uplink` (`lan`/`wifi`) e `github_api_ok` no payload, testado localmente com simulação (sem mexer na rede real do servidor).
- [x] Falha de entrega registra `delivery_error` na linha da fila local antes de sair com erro.
- [x] `status.json`/`incidents.json` carregam os novos campos como metadados, sem alterar os valores possíveis de `cause_final`.
- [x] `grep -rn "17" watchdog.yml scripts/process_heartbeat.py web/src/components/StatusHeader.jsx web/src/components/HeartbeatMonitor.jsx` não retorna mais o timeout antigo — todos os 4 pontos usam 30.
- [x] Dashboard exibe o uplink ativo e, quando aplicável, confirmação de servidor vivo via WiFi durante queda `interno_firewall`.
- [x] `README.md`, `ROADMAP.md`, `scripts/README.md` e `scripts/lan-failover.md` atualizados, consistentes entre si, com a afirmação incorreta sobre `externo` corrigida e a proposta de nova categoria removida/realinhada.

**Gate manual (fora do critério binário de código):** teste de failover real agendado e executado no servidor do campus, com resultado documentado.

## Execution Strategy

| Group | Agent | Description |
|-------|-------|-------------|
| 1 | engineer | Ajustar `TIMEOUT_MINUTES` 17→30 nos 4 pontos (backend + frontend) |
| 2 | engineer | Polimento de documentação (README, ROADMAP, scripts/README, lan-failover.md) |
| 3 | engineer | `heartbeat_v2.sh`: `active_uplink`, `github_api_ok`, `delivery_error` |
| 4 | engineer | `process_heartbeat.py`/`watchdog.py`: consumir e expor os novos campos |
| 5 | engineer | Dashboard: indicador de uplink ativo em `StatusHeader.jsx` |

Grupos 1 e 2 não têm dependência entre si nem com a trilha 3→4→5, e podem ser feitos e mergeados primeiro. Grupos 3→4→5 são sequenciais (cada um consome o que o anterior produz).

---

## Execution Groups

### Group 1: Ajuste de timeout (17 → 30 min)
**Goal:** Eliminar incidentes "Não determinada" de blips curtos, alinhando todos os pontos que hoje hardcodeiam 17 minutos.

**Deliverables:**
1. `watchdog.yml`: env `TIMEOUT_MINUTES: "17"` → `"30"`.
2. `scripts/process_heartbeat.py`: constante `TIMEOUT_MINUTES = 17` → `30`.
3. `web/src/components/StatusHeader.jsx:21`: `minutesSinceLastSeen < 17` → `< 30`.
4. `web/src/components/HeartbeatMonitor.jsx:47,155`: `diffMinutes >= 17` → `>= 30`, e o texto "Alerta após 17 minutos sem sinal" → "30 minutos".

**Acceptance Criteria:**
- [x] `grep -rn "17" watchdog.yml scripts/process_heartbeat.py web/src/components/StatusHeader.jsx web/src/components/HeartbeatMonitor.jsx` não retorna nenhuma ocorrência do timeout antigo.
- [x] `npm run dev` em `web/` renderiza o dashboard sem erro e o texto exibido diz "30 minutos".

**Validation:**
```bash
# grep sem match = exit 1 = PASS (timeout antigo foi removido); exit 0 = FAIL (ainda existe)
grep -rqn "17" watchdog.yml scripts/process_heartbeat.py web/src/components/StatusHeader.jsx web/src/components/HeartbeatMonitor.jsx \
  && echo "FAIL: timeout antigo (17) ainda presente" || echo "PASS: nenhum timeout antigo encontrado"
cd web && npm run build
```

**depends-on:** none

---

### Group 2: Polimento de documentação
**Goal:** Corrigir imprecisões e alinhar os documentos com a decisão de não criar nova categoria de causa.

**Deliverables:**
1. `scripts/lan-failover.md`: corrigir a afirmação de que `gateway_ok=false+internet_ok=true` vira `externo` (na verdade vira `interno_firewall`); reescrever "Adaptações sugeridas" removendo a proposta de `interno_firewall_com_fallback` e substituindo por "expor `active_uplink`/`github_api_ok` como metadado de confiança".
2. `ROADMAP.md` (Fase 10): remover o item de "nova causa de classificação" e atualizar a lista de tarefas conforme o escopo desta wish.
3. `ROADMAP.md` (Fase 3): renomear "Script do Firewall (Lado do Campus)" — nome legado de v1 que hoje confunde, já que nada roda no firewall; o script (`heartbeat_v2.sh`) roda no servidor do campus, o firewall é só alvo de ping (`gateway_ok`). Renomear para algo como "Script do Servidor (Lado do Campus)".
4. `README.md` e `scripts/README.md`: revisar a referência à Fase 10/WiFi e demais trechos defasados de v2.1.

**Acceptance Criteria:**
- [x] `scripts/lan-failover.md` não contém mais a palavra `externo` associada a `gateway_ok=false`.
- [x] `ROADMAP.md` Fase 10 não menciona mais nova categoria de causa.
- [x] `ROADMAP.md` Fase 3 não usa mais "Script do Firewall" como título.
- [x] Links relativos entre os 4 arquivos continuam válidos.

**Validation:**
```bash
grep -n "externo" scripts/lan-failover.md
grep -n "nova causa\|interno_firewall_com_fallback" ROADMAP.md
grep -n "Script do Firewall" ROADMAP.md
```

**depends-on:** none

---

### Group 3: `heartbeat_v2.sh` — active_uplink, github_api_ok, delivery_error
**Goal:** O script de heartbeat passa a coletar e reportar evidência real do uplink ativo e diagnóstico de falha de entrega.

**Deliverables:**
1. Novas env vars `LAN_IFACE` (default `eno1`) e `WIFI_IFACE` (default `wlp1s2`).
2. Detecção de `active_uplink` via `ip route get 1.1.1.1`, parseando `dev <iface>`; `"lan"`/`"wifi"`/`"unknown"`.
3. Sonda `github_api_ok` (ex.: `curl -s -o /dev/null -w '%{http_code}' https://api.github.com` ou equivalente) antes do dispatch.
4. No payload (`client_payload.probe`), incluir `active_uplink` e `github_api_ok`.
5. Em caso de dispatch não-204, gravar `delivery_error` (HTTP code ou motivo do curl) na linha já escrita em `queue.jsonl` para aquele ciclo, antes de sair com erro.

**Acceptance Criteria:**
- [x] Rodando localmente com `STATE_DIR` de teste e interfaces simuladas/inexistentes, o script não quebra e reporta `active_uplink: "unknown"` quando não reconhece a interface.
- [x] Payload gerado (inspecionado antes do envio, ex. via `echo`/log) contém `active_uplink`, `github_api_ok`.
- [x] Uma falha simulada de dispatch (ex. `GITHUB_TOKEN` inválido) resulta em `delivery_error` presente na próxima linha de `queue.jsonl`.

**Validation:**
```bash
STATE_DIR=/tmp/ifva-test GITHUB_TOKEN=invalid GITHUB_OWNER=test GITHUB_REPO=test bash scripts/heartbeat_v2.sh; echo "exit=$?"
cat /tmp/ifva-test/queue.jsonl
grep -o '"active_uplink":"[^"]*"\|"github_api_ok":[a-z]*\|"delivery_error":"[^"]*"' /tmp/ifva-test/queue.jsonl
```

**depends-on:** none

---

### Group 4: `process_heartbeat.py` / `watchdog.py` — consumir os novos campos
**Goal:** Backend expõe `active_uplink`/`github_api_ok` em `status.json`/`incidents.json` sem alterar a taxonomia de `cause_final`.

**Deliverables:**
1. `update_v2_fields` (process_heartbeat.py) grava `active_uplink`/`github_api_ok` em `data['v2']['last_probe']`.
2. `infer_provisional_cause`/`infer_final_cause` permanecem inalterados na lista de valores possíveis (`interno`, `externo`, `interno_firewall`, `interno_servidor`, `interno_misto`, `unknown`).
3. `watchdog.py`: `latest_probe(data)` (que já lê `data['v2']['last_probe']`) passa a incluir `active_uplink`/`github_api_ok` no dict retornado — sem exigir mudança em `infer_provisional_cause_from_probe`, que já ignora chaves extras; alteração é só garantir que o campo sobrevive ao round-trip por `status.json`.

**Acceptance Criteria:**
- [x] Um payload de teste com `active_uplink: "wifi"` passado para `update_v2_fields(data, payload, [])` (chamada direta, sem I/O de arquivo) produz `data['v2']['last_probe']['active_uplink'] == "wifi"`.
- [x] O conjunto de valores possíveis de `cause_final`/`cause_provisional` gerados pelos testes continua sendo o mesmo de antes (nenhum valor novo).

**Validation:**
```bash
# Chamada direta e pura, sem tocar em data/status.json real (JSON_PATH nao tem override por env var)
python3 -c "
import sys
sys.path.insert(0, 'scripts')
from process_heartbeat import update_v2_fields

data = {}
payload = {'ts': '2026-07-15T00:00:00Z', 'seq': 1, 'probe': {'gateway_ok': True, 'internet_ok': True, 'dns_ok': True, 'active_uplink': 'wifi', 'github_api_ok': True}}
update_v2_fields(data, payload, [])
assert data['v2']['last_probe']['active_uplink'] == 'wifi', data
assert data['v2']['last_probe']['github_api_ok'] == True, data
print('PASS')
"
```

**depends-on:** group-3

---

### Group 5: Dashboard — indicador de uplink ativo
**Goal:** O dashboard exibe visualmente qual uplink está ativo e confirma "vivo via WiFi" durante queda `interno_firewall`.

**Deliverables:**
1. `App.jsx` (único call site de `StatusHeader`, hoje só passa `status/lastSeen/statusDetail/causeProvisional`): adicionar prop `activeUplink={data?.v2?.last_probe?.active_uplink}`.
2. `StatusHeader.jsx`: exibir `activeUplink` (`LAN`/`WiFi`) quando presente.
3. Quando `causeProvisional == 'interno_firewall'` e `activeUplink == 'wifi'`, exibir selo "confirmado vivo via WiFi" (usa `causeProvisional`, já disponível no componente hoje — `cause_final` vive nos registros de incidente, não em `status.json`'s `v2`, e fica fora de escopo trazê-lo aqui).

**Acceptance Criteria:**
- [x] `npm run dev` com um `status.json` de teste (`active_uplink: "wifi"`) mostra o indicador no dashboard.
- [x] Com `active_uplink` ausente (dados antigos), o dashboard renderiza normalmente sem o indicador (sem quebrar).

**Validation:**
```bash
cd web && npm run build
```

**depends-on:** group-4

---

## Dependencies

- Nenhuma dependência cross-wish conhecida.
- Dependência interna: group-4 depends-on group-3; group-5 depends-on group-4. Grupos 1 e 2 são independentes de tudo.

## Assumptions / Risks

- É servidor de produção real do campus — testar o failover de verdade pode gerar incidentes/alertas reais; validar em simulação local antes (ver Grupo 3) e só depois agendar um teste controlado avisando os destinatários.
- Aumentar `TIMEOUT_MINUTES` para 30 atrasa a detecção de quedas reais em ~13min a mais — trade-off aceito e solicitado pelo usuário.
- A hipótese de que `github_api_ok`/`delivery_error` explicam os "Não determinada" ainda não está 100% confirmada — os novos campos servem também para confirmar ou refutar isso com dados reais nas próximas ocorrências.
- `ip route get 1.1.1.1` pode variar de formato entre versões do `iproute2` — parse defensivo com fallback para `"unknown"`.
