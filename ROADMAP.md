# Roadmap: IFVA On The Line? (Monitoring System)

Este documento serve como guia para a construção de um sistema de monitoramento de energia e conectividade utilizando GitHub Actions como backend, JSON como banco de dados e React como interface.

## 🟢 Fase 1: Setup Inicial e Segurança

- [x] Criar repositório público no GitHub: `ifva-on-the-line`.
- [x] Gerar um **Personal Access Token (PAT)** com permissão de `repo` e `workflow`.
    -> Settings > Developer settings > Personal access tokens > Tokens (classic) > Generate new token
- [x] Configurar **GitHub Secrets** 
    -> Settings > Secrets and variables > Actions > New repository secret
    - `PAT_TOKEN`: O token gerado acima.
    - `GMAIL_USER`: Seu e-mail do Gmail.
    - `GMAIL_APP_PASSWORD`: Senha de app gerada na conta Google.
    - `TELEGRAM_BOT_TOKEN`: Token do bot criado via @BotFather.

## 🟡 Fase 2: O "Banco de Dados" (JSON)

- [x] Criar arquivo `data/status.json` com a estrutura inicial:

```json
{
  "status": "online",
  "last_seen": "2026-02-27T10:00:00Z",
  "history": [],
  "config": {
    "alert_emails": ["admin@example.com"],
    "telegram": {
      "enabled": true,
      "chat_ids": ["123456789"]
    },
    "email_template": {
      "subject": "🔴 ALERTA: IFSul Offline",
      "body": "O sistema está offline desde {last_seen}..."
    }
  }
}
```

**Observação:** Para modificar os destinatários de e-mail/Telegram ou personalizar templates, edite diretamente o arquivo `data/status.json` no GitHub.

## 🔵 Fase 3: Script do Firewall (Lado do Campus)

- [x] Criar script Bash `heartbeat.sh` para o Linux do campus:
    - Deve enviar um POST para a API do GitHub (`repository_dispatch`).
    - Payload: `{"event_type": "heartbeat"}`.
- [x] Criar script PowerShell `heartbeat.ps1` para uso local/Windows.
- [x] Configurar no `crontab -e` ou Task Scheduler:
    - Periodicidade: `*/5 * * * *` (a cada 5 minutos).

## 🟣 Fase 4: Automação com GitHub Actions

- [x] **Workflow A (receive-heartbeat.yml):**
    - Gatilho: `repository_dispatch` (heartbeat do campus).
    - Lógica principal de detecção:
        - Atualiza `last_seen` e define `status: "online"`.
        - Calcula o gap desde o sinal anterior. Se `gap > 7 minutos`, registra incidente no histórico com duração calculada.
        - Se estava `offline` (detectado pelo watchdog), calcula a duração exata e encerra o incidente.
    - Commit e Push automático das alterações no JSON.
- [x] **Workflow B (watchdog.yml):**
    - Gatilho: `schedule` (cron: `*/5 * * * *`) — atua como fallback.
    - Lógica: Se `now - last_seen > 10 minutos` e nenhum heartbeat chegou:
        - Atualizar `status: "offline"`.
        - Adicionar evento ao array `history`.
        - Disparar alertas via Email (SMTP Gmail) e Telegram simultaneamente.
        - Commit e Push automático.

## 🟠 Fase 5: Frontend React (Dashboard)

- [x] Inicializar projeto React (Vite) com Tailwind CSS.
- [x] **Componentes Principais:**
    - `StatusHeader`: Mostra se está **ONLINE** (verde) ou **OFFLINE** (vermelho) baseado no tempo real.
    - `HeartbeatMonitor`: Monitor em tempo real com previsão do próximo heartbeat e indicador de saúde.
    - `UptimeStats`: Estatísticas mensais de uptime com percentual e métricas de incidentes.
    - `StatsGrid`: Cards com "Último Check-in", "Tempo desde a última queda", "Total de falhas no mês".
    - `IncidentsChart`: Gráfico de incidentes usando Recharts baseado no histórico do JSON.
- [x] **Data Fetching:**
    - Criar hook `useStatus` para consumir o `status.json` via GitHub API (evita cache).
    - Auto-refresh a cada 30 segundos.
    - Implementar funcionalidade de Exportação CSV e Download dos dados de histórico para análise offline.
- [x] **Animações e UX:**
    - Animações customizadas (pulse-slow/medium/fast, spin-slow).
    - Gradientes e indicadores visuais baseados em status.
    - Design responsivo com Tailwind CSS.

## 🚀 Fase 6: Deployment e Testes

- [x] Configurar GitHub Pages via workflow `deploy-web.yml`.
- [x] **Teste de Estresse:** Desligar o script no firewall e validar:
    - [x] Sistema detecta offline após 10 minutos.
    - [x] E-mail de alerta enviado automaticamente pelo watchdog.
    - [x] Dashboard atualiza status para refletir offline.
- [x] Validar responsividade do dashboard no mobile.
- [x] Criar workflow `test-email.yml` para envio de e-mails de teste manual.

## 📱 Fase 7: Notificações via Telegram

- [x] Criar bot no Telegram via [@BotFather](https://t.me/botfather).
- [x] Obter Chat ID via API: `https://api.telegram.org/bot<TOKEN>/getUpdates`
- [x] Adicionar `TELEGRAM_BOT_TOKEN` aos GitHub Secrets.
- [x] Implementar função `send_telegram()` no `watchdog.py`:
    - Usa `urllib.request` para enviar mensagens via Bot API.
    - Suporte a múltiplos chat IDs.
    - Formatação Markdown com emojis.
- [x] Atualizar `watchdog.yml` para passar `TELEGRAM_BOT_TOKEN`.
- [x] Criar workflow `test-telegram.yml` para testes manuais.
- [x] Configurar `data/status.json` com:
    ```json
    "telegram": {
      "enabled": true,
      "chat_ids": ["343595545"]
    }
    ```
- [x] Validar sistema dual (Email + Telegram) em produção.

## ✅ Sistema Completo e Operacional

O sistema está 100% funcional com:
- ✅ Detecção automática de quedas
- ✅ Alertas via e-mail (horário de Brasília)
- ✅ Alertas via Telegram (instantâneos com formatação Markdown)
- ✅ Dashboard em tempo real com estatísticas avançadas e exportação para CSV
- ✅ Monitoramento de heartbeat com previsões
- ✅ Histórico completo de incidentes com fallback do watchdog e recuperação robusta de pushes (retry no Actions)
- ✅ Sistema dual de notificações (Email + Telegram)
