# Implementacao v2 - Classificacao de Causa (Interno vs Externo)

## 1) Contexto de infraestrutura

Topologia atual:
- Dev server (Ubuntu): 128.1.1.49
- Gateway/Firewall escola: 128.1.0.200
- IP publico: 200.132.86.251
- Fluxo: servidor local -> firewall -> internet -> GitHub

Objetivo principal de monitoramento:
- Prioridade: disponibilidade da internet do campus
- Diferenciar indisponibilidade por causa:
  - Externa: internet indisponivel com servidor ativo
  - Interna: firewall/rede local/servidor indisponivel

## 2) Decisoes alinhadas

- Solucao escolhida: manter GitHub Actions (v2 incremental)
- Classificacao: provisoria durante queda e final apos normalizacao
- Janela de consolidacao de intermitencia: unica janela (merge)
- Alerta: disparar em suspeita
- Compatibilidade retroativa: nao obrigatoria
- NTP do servidor: confiavel
- Persistencia local de heartbeat: fila JSONL em /var/lib/ifva-monitor/queue.jsonl

## 3) Resultado esperado da v2

1. Estado em tempo real:
- online
- offline_suspeito (causa_provisoria: unknown|externo|interno)

2. Reclassificacao apos retorno:
- causa_final = externo|interno_firewall|interno_servidor|interno_misto

3. Frontend:
- Exibir status atual + causa provisoria/final
- Incidentes consolidados em janela unica

## 4) Modelo de dados v2

Arquivos:
- data/status.json (estado atual e resumo curto)
- data/incidents.json (historico de incidentes)

### 4.1 status.json (v2)
Campos minimos:
- status: online|offline
- status_detail: online|offline_suspeito
- last_seen: ISO UTC
- v2:
  - last_probe:
    - timestamp
    - gateway_ok
    - internet_ok
    - dns_ok
    - pending_count
    - seq
  - cause_provisional: unknown|externo|interno
  - cause_confidence: low|medium|high

### 4.2 incidents.json (v2)
Cada incidente:
- id
- started_at
- ended_at (null enquanto aberto)
- duration_minutes
- state: open|closed
- cause_provisional
- cause_final
- sample_count
- notes (opcional)

## 5) Contrato do heartbeat v2 (repository_dispatch.client_payload)

Payload minimo por envio:
- ts (ISO UTC)
- seq (inteiro monotonicamente crescente no servidor)
- pending_count (quantos eventos locais ainda nao enviados)
- probe:
  - gateway_ok (bool)
  - internet_ok (bool)
  - dns_ok (bool)

Exemplo:
```json
{
  "event_type": "heartbeat",
  "client_payload": {
    "ts": "2026-05-11T12:00:00Z",
    "seq": 1532,
    "pending_count": 17,
    "probe": {
      "gateway_ok": true,
      "internet_ok": false,
      "dns_ok": false
    }
  }
}
```

## 6) Regras de classificacao

Durante queda (provisoria):
1. Sem heartbeat por timeout -> offline_suspeito, cause_provisional=unknown
2. Se ultimo probe recebido indicar:
- gateway_ok=true e internet_ok=false -> cause_provisional=externo
- gateway_ok=false -> cause_provisional=interno
- demais casos -> unknown

Apos retorno (final):
1. Se houver amostras locais na janela com gateway_ok=true e internet_ok=false -> externo
2. Se houver amostras com gateway_ok=false -> interno_firewall
3. Se nao houver amostras locais na janela -> interno_servidor
4. Se misto -> interno_misto

## 7) Plano de execucao (fases)

Fase 1 (CONCLUIDA - commit 29a6887):
- [x] Aceitar payload v2 no process_heartbeat.py (le GITHUB_EVENT_PATH)
- [x] Gravar v2.last_probe e cause_provisional em status.json
- [x] Criar script heartbeat_v2.sh com sonda de gateway/internet/dns
- [x] Fila local JSONL com envio em lote (batch) e pending_count
- [x] Manter comportamento online/offline para nao quebrar frontend

Fase 2 (CONCLUIDA - commit b86526f):
- [x] Criar data/incidents.json como fonte de verdade dos incidentes
- [x] Migrar abertura/fechamento de incidente para estrutura v2 (state open/closed)
- [x] Reclassificacao de causa_final no fechamento usando batch de sondas
- [x] Seed automatico de incidentes legados a partir do history existente
- [x] project_history_from_incidents: history em status.json espelha incidents.json
- [x] Alertas de suspeita ja embutidos no watchdog

Fase 3 (EM ANDAMENTO):
- [x] Frontend: StatusHeader mostra badge de causa provisional quando offline
- [x] Frontend: tabela de historico com colunas Causa e Estado
- [x] Frontend: useStatus busca incidents.json em paralelo
- [ ] Configurar systemd timer no Ubuntu para heartbeat_v2.sh
- [ ] Merge de incidentes por janela de 20 min (consolidacao de intermitencias)
- [ ] Alerta de reclassificacao (quando causa_final difere da provisional)
- [ ] Rotacao de historico no incidents.json (limite de registros antigos)

## 8) Riscos e mitigacoes

1. ICMP bloqueado pode causar falso diagnostico:
- Mitigacao: combinar ping + teste TCP/HTTP opcional

2. Corrida entre workflows:
- Mitigacao: idempotencia por seq e timestamp

3. Burst de eventos na reconexao:
- Mitigacao: processar somente evento mais recente por lote e manter contadores

4. Falha no GitHub/API:
- Mitigacao: fila local persistente + retentativas com backoff

## 9) Critrios de aceite

1. Queda externa simulada: status muda para offline_suspeito e depois confirma externo
2. Queda interna (gateway indisponivel) simulada: confirma interno_firewall
3. Sem eventos na janela de queda: confirma interno_servidor
4. Sem regressao no dashboard atual (online/offline continua funcional)

## 10) Operacao no servidor Ubuntu

Servicos sugeridos:
- monitor-probe.timer (1 min): coleta sonda e escreve fila local
- monitor-send.timer (1 min): envia lote ao GitHub

Persistencia local recomendada:
- SQLite (preferencial) ou JSONL append-only

Seguranca:
- Token em arquivo root-only ou variavel protegida
- Rotacao periodica de token
