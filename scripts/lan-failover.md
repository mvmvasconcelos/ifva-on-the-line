# Failover de Rede LAN → WiFi (nível de sistema operacional)

Este documento descreve uma camada de resiliência de rede configurada **no servidor do campus** (128.1.1.49), fora do repositório deste projeto, mas que afeta diretamente o comportamento do heartbeat e merece ser levada em conta na próxima evolução do IFVA On The Line.

## O que é

O servidor ganhou uma segunda placa de rede (Wi-Fi, Qualcomm Atheros AR9227, interface `wlp1s2`) e agora tem acesso a uma rede alternativa (`MCV-016`, roteador comum, sem firewall) além da LAN que passa pelo firewall da escola (`eno1`).

Um serviço systemd (`lan-failover.timer`, a cada 30s) monitora a conectividade real da LAN e, se ela ficar indisponível por tempo sustentado, alterna a rota padrão de saída para o WiFi automaticamente — sem intervenção manual — revertendo sozinho quando a LAN volta a ficar estável.

**Isso não faz parte do repositório `ifva-on-the-line`** — é infraestrutura do host. Mas como o heartbeat roda nesse mesmo servidor, o comportamento dele muda de forma relevante durante uma queda.

## Configuração atual no servidor

| Item | Valor |
|---|---|
| Interface LAN | `eno1` (gateway `128.1.0.200`) |
| Interface WiFi | `wlp1s2` (perfil NetworkManager `MCV-016`) |
| Script | `/usr/local/sbin/lan-failover.sh` |
| Unidades | `/etc/systemd/system/lan-failover.service` + `.timer` |
| Estado | `/run/lan-failover.state` (`modo fail_count success_count`) |
| Logs | `journalctl -t lan-failover` |
| Checagem | a cada 30s, `ping -I eno1` contra `1.1.1.1` e `8.8.8.8` |
| Gatilho do fallback | **10 minutos** de falha sustentada na LAN (20 checks) |
| Retorno à LAN | **2 minutos** de estabilidade (4 checks) |
| Métricas de rota | LAN normal = 100, WiFi = 600, LAN degradada (durante fallback) = 900 |

Enquanto em modo WiFi, o acesso local via IP da LAN continua funcionando normalmente (só a rota padrão/internet muda). O WiFi só fica conectado durante o período de fallback — desconecta ao reverter, minimizando o tempo exposto numa rede sem firewall.

## Por que isso importa para o IFVA On The Line

O `heartbeat_v2.sh` usa `FIREWALL_IP=128.1.0.200` como sonda de gateway (`gateway_ok`) — **é o mesmo IP** usado como `LAN_GW` no script de failover. E `INTERNET_TARGET`/`INTERNET_TARGET2` (`1.1.1.1` / `8.8.8.8`) são os mesmos hosts usados na checagem do failover. Ou seja, os dois sistemas estão sondando exatamente os mesmos alvos, mas com objetivos diferentes.

Isso cria uma situação nova que a lógica de classificação atual (`process_heartbeat.py` / `watchdog.py`) não conhece:

- **Antes:** se o firewall da escola caísse, `gateway_ok=false` e `internet_ok=false` — o heartbeat parava de ser enviado, e o watchdog classificava a causa como `interno` de forma provisional.
- **Agora:** depois de ~10 minutos de firewall caído, o servidor passa a sair pela MCV-016. Isso significa que o **heartbeat pode voltar a ser entregue ao GitHub mesmo com o firewall da escola fora do ar** — porque só a rota mudou, o script continua rodando normalmente. Só que a sonda `gateway_ok` (que pinga `128.1.0.200` via `eno1` especificamente, não pela rota padrão) provavelmente continuará `false`, enquanto `internet_ok` (que hoje testa pela rota padrão, ou seja, passaria a ir pelo WiFi) passaria a `true` de novo.

Esse padrão (`gateway_ok=false` + `internet_ok=true`) já existe na classificação atual: como `not gateway_ok` é checado primeiro em `infer_provisional_cause`/`infer_final_cause` (`process_heartbeat.py`), ele hoje cai em causa `interno`/`interno_firewall` (ex.: firewall/LAN da escola caiu) — nunca na categoria reservada para queda de internet do provedor, que só é atribuída quando `gateway_ok=true`. Isso já está correto para o caso "a LAN caiu de verdade, mas o fallback WiFi está segurando a conexão" — mas a classificação não tem como saber que o fallback está ativo, o que é um dado operacional útil por si só (permite diferenciar, na prática, "firewall caiu e ninguém percebeu" de "firewall caiu, mas o fallback segurou o heartbeat").

## Adaptações (implementadas via wish `wifi-failover-awareness`)

- [x] Campo `active_uplink` (`"lan"`/`"wifi"`/`"unknown"`) na sonda do `heartbeat_v2.sh`, via `ip route get 1.1.1.1` (interfaces configuráveis por `LAN_IFACE`/`WIFI_IFACE`, defaults `eno1`/`wlp1s2`).
- [x] `active_uplink`/`github_api_ok` expostos como metadados de confiança em `status.json` (`v2.last_probe`), sem criar nova categoria de `cause_final` — a taxonomia atual (`interno_firewall`/`interno_servidor`/`interno_misto`/queda de internet do provedor) já está correta.
- [x] Indicador no dashboard (`StatusHeader.jsx`) para o uplink ativo, com selo "confirmado vivo via WiFi" quando `causeProvisional == interno_firewall` e `active_uplink == wifi`.
- [ ] Avaliar um alerta informativo separado (não o de "offline") para quando o failover entra/sai de modo WiFi — sinaliza problema real na LAN mesmo sem interrupção do heartbeat.
- [ ] Conferir na prática o alinhamento de tempos: heartbeat a cada 5 min, watchdog agora exige falha em dois ciclos consecutivos com `TIMEOUT_MINUTES=30` (~30-35 min até declarar offline), e o failover troca para WiFi em ~10 min de LAN fora do ar. Ou seja, é plausível que o fallback já esteja ativo bem antes do watchdog declarar `offline` — o que é bom (heartbeat não seria interrompido numa queda só de firewall), mas vale validar num teste real controlado no servidor.
- [ ] Lembrar que a rede MCV-016 não tem firewall próprio (só NAT de roteador comum) — relevante caso o projeto algum dia dependa de portas expostas nesse caminho.

## Comandos úteis para depuração

```bash
# estado atual do failover
cat /run/lan-failover.state

# logs do failover
journalctl -t lan-failover -f

# ver rota padrão ativa agora (LAN ou WiFi)
ip route show default

# ver se o perfil WiFi está conectado
nmcli device status
```
