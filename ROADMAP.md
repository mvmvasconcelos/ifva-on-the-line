# Roadmap: IFVA On The Line? (Monitoring System)

Este documento serve como guia para a construção de um sistema de monitoramento de energia e conectividade utilizando GitHub Actions como backend, JSON como banco de dados e React como interface.

## 🟢 Fase 1: Setup Inicial e Segurança

- [x] Criar repositório público no GitHub: `ifva-on-the-line`.
- [x] Gerar um **Personal Access Token (PAT)** com permissão de `repo` e `workflow`.
- [x] Configurar **GitHub Secrets** (Settings > Secrets > Actions):
    - `PAT_TOKEN`: O token gerado acima.
    - `GMAIL_USER`: Seu e-mail do Gmail.
    - `GMAIL_APP_PASSWORD`: Senha de app gerada na conta Google.
    - `ADMIN_PASSWORD_HASH`: Um hash SHA-256 da senha que você usará na área avançada.

## 🟡 Fase 2: O "Banco de Dados" (JSON)

- [x] Criar arquivo `data/status.json` com a estrutura inicial:

```json
{
  "status": "online",
  "last_seen": "2026-02-27T10:00:00Z",
  "last_failure": null,
  "history": []
}
```

## 🔵 Fase 3: Script do Firewall (Lado do Campus)

- [x] Criar script Bash `heartbeat.sh` para o Linux do campus:
    - Deve enviar um POST para a API do GitHub (`repository_dispatch`).
    - Payload: `{"event_type": "heartbeat"}`.
- [x] Criar script PowerShell `heartbeat.ps1` para uso local/Windows.
- [ ] Configurar no `crontab -e` ou Task Scheduler:
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
    - Gatilho: `schedule` (cron: `*/15 * * * *`) — atua como fallback.
    - Lógica: Se `now - last_seen > 7 minutos` e nenhum heartbeat chegou:
        - Atualizar `status: "offline"`.
        - Adicionar evento ao array `history`.
        - Disparar e-mail via SMTP (Gmail) com o alerta.
        - Commit e Push automático.

## 🟠 Fase 5: Frontend React (Dashboard)

- [x] Inicializar projeto React (Vite/CRA) com Tailwind CSS.
- [x] **Componentes Principais:**
    - `StatusHeader`: Mostra se está **ONLINE** (verde) ou **OFFLINE** (vermelho).
    - `StatsGrid`: Cards com "Último Check-in", "Tempo desde a última queda", "Total de falhas no mês".
    - `UptimeChart`: Gráfico usando Recharts ou Chart.js baseado no histórico do JSON.
- [x] **Data Fetching:**
    - Criar hook para consumir o `status.json` do GitHub Raw com cache busting (`?t=timestamp`).

## � Fase 6: Área Avançada (Configurações)

- [x] Criar modal de acesso protegido por senha (validando contra o hash).
- [x] **Funcionalidades:**
    - Input para editar lista de e-mails (salvar no JSON).
    - Input para editar o template do e-mail de alerta.
    - Botão "Testar Envio": Dispara um evento `test_email` para o GitHub Actions.
- [x] Criar workflow `test-email.yml` para envio de e-mails de teste.
- [ ] Implementar salvamento via GitHub API (atualmente manual).

## 🚀 Fase 7: Deployment e Testes

- [x] Configurar GitHub Pages para apontar para o build do React.
- [ ] **Teste de Estresse:** Desligar o script no firewall e validar se o e-mail chega em até 10-15 minutos.
- [ ] Validar responsividade do dashboard no mobile.
