# IFVA On The Line?

[![Status](https://img.shields.io/badge/Status-Concluído-1dfd5c)](https://github.com/mvmvasconcelos/ifva-on-the-line) [![Versão](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/mvmvasconcelos/ifva-on-the-line) [![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/) [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/) [![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions) [![Licença](https://img.shields.io/badge/licença-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0) [![IFSul](https://img.shields.io/badge/IFSul-Venâncio%20Aires-195128)](https://vairao.ifsul.edu.br/)


## Sobre o Projeto

O **IFVA On The Line?** é um sistema de monitoramento minimalista projetado para verificar a conectividade e disponibilidade de serviços do IFSul Câmpus Venâncio Aires.

O objetivo principal é detectar interrupções de conectividade ou energia no campus remotamente. O sistema funciona recebendo "batimentos cardíacos" (heartbeats) regulares de um servidor situado dentro da rede do campus. Se o sistema parar de receber esses sinais por um período determinado, ele assume que houve uma falha e dispara automaticamente alertas via **e-mail e Telegram** para os administradores.

O sistema está acessível em https://mvmvasconcelos.github.io/ifva-on-the-line/

## Como Funciona

A arquitetura é baseada numa abordagem *serverless* usando recursos gratuitos do GitHub (v2):

1.  **Origem (No Campus):** O script `heartbeat_v2.sh`, gerenciado por um **systemd timer** (a cada 5 minutos), coleta sondas de rede locais (gateway, internet, DNS), acumula eventos em fila (`/var/lib/ifva-monitor/queue.jsonl`) e envia o lote completo via `repository_dispatch` para o GitHub.
2.  **Backend (GitHub Actions):**
    *   O workflow `Receive Heartbeat` recebe o lote, atualiza `data/status.json` e `data/incidents.json`:
        *   Confirma `status: online`, atualiza `last_seen` e armazena os dados de sonda.
        *   Ao detectar recuperação, fecha o incidente aberto, calcula a duração exata e **classifica a causa** final (`interno_servidor`, `interno_firewall`, `externo`, `interno_misto`) com base nos eventos da fila.
    *   O workflow `Watchdog Monitor` roda a cada 5 minutos como fallback: detecta ausência de heartbeat, abre um incidente com **causa provisional** (`interno` ou `externo`) baseada na última sonda disponível, e dispara alertas via e-mail e Telegram.
3.  **Frontend (Dashboard):** Interface React hospedada no GitHub Pages. Consome `status.json` e `incidents.json` em paralelo a cada 30 segundos, exibindo status atual, causa da queda (quando offline), histórico de incidentes com duração e classificação. Suporta exportação CSV.

> **Resiliência de rede no servidor:** o host do campus agora tem uma segunda interface de rede (WiFi) configurada como fallback automático caso a LAN/firewall da escola fique indisponível. Isso muda o comportamento das sondas do heartbeat durante uma queda de LAN — detalhes e adaptações sugeridas em [`scripts/lan-failover.md`](./scripts/lan-failover.md).

## Tecnologias Utilizadas

*   **Backend:** GitHub Actions (Automação e Agendamento)
*   **Banco de Dados:** Arquivo JSON (armazenado no repositório git)
*   **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons
*   **Notificações:** SMTP (Gmail) + Telegram Bot API
*   **Scripting no Servidor:** Bash / PowerShell / Curl

## Estrutura do Projeto

*   `.github/workflows/`: Workflows do GitHub Actions (`receive-heartbeat.yml`, `watchdog.yml`, `deploy-web.yml`).
*   `data/status.json`: Estado atual do sistema (status, last_seen, sondas, histórico resumido).
*   `data/incidents.json`: Registro persistente de incidentes com causa, duração e timestamps.
*   `web/src/`: Código fonte do dashboard React.
*   `scripts/heartbeat_v2.sh`: Script de heartbeat v2 para instalação no servidor do campus.
*   `scripts/ifva-heartbeat.service` / `.timer`: Unidades systemd para agendamento automático (a cada 5 minutos) no servidor.
*   `scripts/process_heartbeat.py`: Lógica de processamento do heartbeat (classificação de causa, gestão de incidentes).
*   `scripts/watchdog.py`: Lógica do watchdog (detecção de timeout, alertas, reabertura de incidentes).
*   `scripts/notifier.py`: Envio de alertas via e-mail (SMTP) e Telegram.

## Configuração

Para replicar este projeto, consulte o `ROADMAP.md` para o guia completo de implementação e o `scripts/README.md` para instruções de instalação do heartbeat no servidor.

### Segredos necessários no GitHub

Configure em *Settings → Secrets and variables → Actions*:

| Segredo | Descrição |
|---|---|
| `PAT_TOKEN` | Personal Access Token com permissão `repo` |
| `GMAIL_USER` | Endereço Gmail para envio de alertas |
| `GMAIL_APP_PASSWORD` | Senha de aplicativo do Gmail |
| `TELEGRAM_BOT_TOKEN` | Token do bot criado via @BotFather |

### Configurando alertas

Os destinatários de e-mail e Telegram são definidos no `data/status.json`, campo `config`. Edite diretamente no GitHub — as mudanças entram em vigor no próximo evento.

**Para obter seu Chat ID do Telegram:**
1. Crie um bot via [@BotFather](https://t.me/botfather)
2. Acesse: `https://api.telegram.org/bot<TOKEN>/getUpdates` após enviar `/start` para o bot
3. Copie o valor de `"chat":{"id": ...}`

## Licença

Este projeto está sob a licença Apache 2.0.
