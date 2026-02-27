# IFVA On The Line?

## Sobre o Projeto

O **IFVA On The Line?** é um sistema de monitoramento minimalista projetado para verificar a conectividade e disponibilidade de serviços do IFSul Câmpus Venâncio Aires.

O objetivo principal é detectar interrupções de conectividade ou energia no campus remotamente. O sistema funciona recebendo "batimentos cardíacos" (heartbeats) regulares de um servidor situado dentro da rede do campus. Se o sistema parar de receber esses sinais por um período determinado, ele assume que houve uma falha e dispara automaticamente um alerta por e-mail para os administradores.

## Como Funciona

A arquitetura do projeto é baseada em uma abordagem "serverless" utilizando recursos gratuitos do GitHub:

1.  **Origem (No Campus):** Um script simples (`heartbeat.sh`) rodando em um servidor Linux dentro do campus envia uma requisição HTTP (POST) a cada 5 minutos para a API do GitHub.
2.  **Backend (GitHub Actions):**
    *   O workflow `Receive Heartbeat` recebe cada sinal e executa a lógica principal de detecção:
        *   Atualiza o `last_seen` e confirma `status: online`.
        *   Calcula o intervalo desde o sinal anterior. Se o gap for superior a 7 minutos, registra automaticamente um incidente no histórico com a duração calculada.
        *   Quando o sistema se recupera de um estado offline, registra o fim do incidente com a duração exata da queda.
    *   O workflow `Watchdog Monitor` roda periodicamente como **fallback**: se nenhum heartbeat chegar por um tempo prolongado, ele detecta a queda em andamento e dispara um alerta por e-mail.
3.  **Frontend (Dashboard):** Uma interface web desenvolvida em React, hospedada no GitHub Pages, consome o arquivo JSON bruto para exibir o status atual (Online/Offline) e o histórico de incidentes em tempo real.

## Tecnologias Utilizadas

*   **Backend:** GitHub Actions (Automação e Agendamento)
*   **Banco de Dados:** Arquivo JSON (armazenado no repositório git)
*   **Frontend:** React (Vite) + Tailwind CSS
*   **Notificações:** SMTP (Gmail)
*   **Scripting no Servidor:** Bash / Curl

## Estrutura do Projeto

*   `.github/workflows`: Contém os arquivos YAML para os workflows do GitHub Actions.
*   `data/`: Armazena o arquivo `status.json` que atua como banco de dados.
*   `src/`: Código fonte da aplicação React (Dashboard).
*   `scripts/`: Scripts auxiliares para configuração no servidor do campus.

## Configuração

Para replicar este projeto, consulte o arquivo `ROADMAP.md` para um guia passo a passo da implementação, incluindo a configuração de segredos e tokens necessários.

## Licença

Este projeto está sob a licença Apache 2.0.
