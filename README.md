# IFVA On The Line?

## Sobre o Projeto

O **IFVA On The Line?** é um sistema de monitoramento minimalista projetado para verificar a conectividade e disponibilidade de serviços do IFSul Câmpus Venâncio Aires.

O objetivo principal é detectar interrupções de conectividade ou energia no campus remotamente. O sistema funciona recebendo "batimentos cardíacos" (heartbeats) regulares de um servidor situado dentro da rede do campus. Se o sistema parar de receber esses sinais por um período determinado, ele assume que houve uma falha e dispara automaticamente um alerta por e-mail para os administradores.

## Como Funciona

A arquitetura do projeto é baseada em uma abordagem "serverless" utilizando recursos gratuitos do GitHub:

1.  **Origem (No Campus):** Um script simples (`heartbeat.sh`) rodando em um servidor Linux dentro do campus envia uma requisição HTTP (POST) a cada 5 minutos para a API do GitHub.
2.  **Backend (GitHub Actions):**
    *   Um workflow recebe esse sinal e atualiza um arquivo JSON (`status.json`) com o carimbo de tempo da última conexão.
    *   Um segundo workflow "cão de guarda" (watchdog) roda a cada 10 minutos. Ele verifica se o último sinal foi recebido recentemente. Se o atraso for superior a 7 minutos, ele marca o status como "offline" e envia um e-mail de alerta.
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

Este projeto está sob a licença MIT.
