# IFVA On The Line?

## Sobre o Projeto

O **IFVA On The Line?** é um sistema de monitoramento minimalista projetado para verificar a conectividade e disponibilidade de serviços do IFSul Câmpus Venâncio Aires.

O objetivo principal é detectar interrupções de conectividade ou energia no campus remotamente. O sistema funciona recebendo "batimentos cardíacos" (heartbeats) regulares de um servidor situado dentro da rede do campus. Se o sistema parar de receber esses sinais por um período determinado, ele assume que houve uma falha e dispara automaticamente alertas via **e-mail e Telegram** para os administradores.

## Como Funciona

A arquitetura do projeto é baseada em uma abordagem "serverless" utilizando recursos gratuitos do GitHub:

1.  **Origem (No Campus):** Um script simples (`heartbeat.sh`) rodando em um servidor Linux dentro do campus envia uma requisição HTTP (POST) a cada 5 minutos para a API do GitHub.
2.  **Backend (GitHub Actions):**
    *   O workflow `Receive Heartbeat` recebe cada sinal e executa a lógica principal de detecção:
        *   Atualiza o `last_seen` e confirma `status: online`.
        *   Calcula o intervalo desde o sinal anterior. Se o gap for superior a 7 minutos, registra automaticamente um incidente no histórico com a duração calculada.
        *   Quando o sistema se recupera de um estado offline, registra o fim do incidente com a duração exata da queda.
    *   O workflow `Watchdog Monitor` roda periodicamente como **fallback**: se nenhum heartbeat chegar por um tempo prolongado, ele detecta a queda em andamento e dispara alertas via e-mail e Telegram.
3.  **Frontend (Dashboard):** Uma interface web desenvolvida em React, hospedada no GitHub Pages, consome o arquivo JSON via GitHub API para exibir o status atual (Online/Offline) e o histórico de incidentes em tempo real.

## Tecnologias Utilizadas

*   **Backend:** GitHub Actions (Automação e Agendamento)
*   **Banco de Dados:** Arquivo JSON (armazenado no repositório git)
*   **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons
*   **Notificações:** SMTP (Gmail) + Telegram Bot API
*   **Scripting no Servidor:** Bash / PowerShell / Curl

## Estrutura do Projeto

*   `.github/workflows`: Contém os arquivos YAML para os workflows do GitHub Actions.
*   `data/`: Armazena o arquivo `status.json` que atua como banco de dados.
*   `src/`: Código fonte da aplicação React (Dashboard).
*   `scripts/`: Scripts auxiliares para configuração no servidor do campus.

## Configuração

Para replicar este projeto, consulte o arquivo `ROADMAP.md` para um guia passo a passo da implementação, incluindo a configuração de segredos e tokens necessários.

### Configurando Alertas (Email e Telegram)

As configurações de notificação são gerenciadas diretamente no arquivo `data/status.json`:

```json
{
  "status": "online",
  "last_seen": "2026-02-27T10:00:00Z",
  "history": [],
  "config": {
    "alert_emails": [
      "admin1@example.com",
      "admin2@example.com"
    ],
    "telegram": {
      "enabled": true,
      "chat_ids": [
        "123456789"
      ]
    },
    "email_template": {
      "subject": "🔴 ALERTA: IFSul Offline",
      "body": "O sistema IFSul Venâncio Aires está OFFLINE desde {last_seen}.\n\nTempo decorrido: {elapsed_time}\n\nPor favor, verifique a conectividade ou energia do campus."
    }
  }
}
```

**Para modificar:**
1. Edite o arquivo `data/status.json` diretamente no GitHub
2. **Emails:** Ajuste os destinatários em `config.alert_emails` (array de strings)
3. **Telegram:** Configure `telegram.enabled` (true/false) e adicione `chat_ids`
4. **Template:** Personalize o assunto e corpo do email em `config.email_template`
5. Os placeholders `{last_seen}` e `{elapsed_time}` são substituídos automaticamente

**Para obter seu Chat ID do Telegram:**
1. Crie um bot via [@BotFather](https://t.me/botfather)
2. Envie `/start` para seu bot
3. Acesse: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Procure pelo campo `"chat":{"id": 123456789}`

As mudanças entram em vigor imediatamente após o commit.

## Licença

Este projeto está sob a licença Apache 2.0.
