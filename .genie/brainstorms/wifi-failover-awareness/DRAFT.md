# Draft: WiFi Failover Awareness (Fase 10)

WRS: ████░░░░░░ 20/100
Problem ✅ | Scope ░ | Decisions ░ | Risks ░ (parcial) | Criteria ░

## Contexto (já levantado)

- Servidor do campus (128.1.1.49) ganhou 2ª interface (`wlp1s2`, WiFi `MCV-016`) além da LAN (`eno1`).
- `lan-failover.timer` (fora do repo, infra do host) troca a rota padrão para WiFi após ~10min de LAN fora do ar; reverte após ~2min estável.
- `heartbeat_v2.sh` sonda `gateway_ok` (ping `FIREWALL_IP=128.1.0.200`, sem `-I`, segue a rota padrão do SO) e `internet_ok` (ping `1.1.1.1`/`8.8.8.8`, idem).
- Documentado em `scripts/lan-failover.md` (não commitado ainda) + referências em `README.md`/`ROADMAP.md` Fase 10.

## Achado importante (correção ao doc atual)

`scripts/lan-failover.md` afirma que o padrão `gateway_ok=false + internet_ok=true` **hoje** é classificado como causa `externo`. Verificado em `process_heartbeat.py`:

```python
def infer_provisional_cause(...):
    if not gateway_ok:
        return 'interno', 'high'   # <- gateway_ok=false cai aqui primeiro
    if gateway_ok and not internet_ok:
        return 'externo', 'high'
```

`gateway_ok=false` sempre cai em `interno` (provisório) / `interno_firewall` (final) — nunca em `externo`. A afirmação do doc está incorreta; o comportamento real é que **hoje o sistema já classifica esse padrão como `interno_firewall`**, mas sem distinguir "firewall caiu e o heartbeat parou de ser entregue" de "firewall caiu mas o WiFi segurou a entrega do heartbeat" — ambos caem no mesmo bucket `interno_firewall`. O problema de fundo (falta de distinção) continua válido; só a descrição do "antes" no doc precisa ser corrigida.

## Problem (rascunho)

Quando a LAN/firewall do campus cai e o fallback WiFi assume a rota de saída, o heartbeat continua sendo entregue normalmente (via WiFi), mas a classificação de causa atual não tem como saber disso — hoje esse cenário é indistinguível de "firewall caiu e o heartbeat parou" (ambos batem em `gateway_ok=false` → `interno_firewall`), quando na prática são operacionalmente muito diferentes (uma é uma queda real vista pelo watchdog; a outra é uma queda de LAN mascarada, sem interrupção visível no dashboard).

## Aberto / a decidir
- Escopo desta brainstorm: só backend (probe + classificação) ou já incluir dashboard + alerta informativo?
- Nome da nova causa / valor de `active_uplink`.
- Método de detecção do uplink ativo no `heartbeat_v2.sh` (ler `/run/lan-failover.state` vs `ip route get`).
- Como testar em produção sem gerar alertas falsos para os destinatários reais.
- Corrigir a afirmação incorreta no `scripts/lan-failover.md`?
