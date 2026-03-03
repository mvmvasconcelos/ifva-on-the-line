#!/bin/bash

# Configuração
REPO_OWNER="mvmvasconcelos"
REPO_NAME="ifva-on-the-line"
PAT_TOKEN="YOUR_PAT_TOKEN" # Isso idealmente deve ser uma variável de ambiente ou segredo

# Envia o evento de heartbeat para o GitHub Actions
curl --tlsv1.2 -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $PAT_TOKEN" \
  https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches \
  -d '{"event_type": "heartbeat"}'

# Verifica se a requisição foi bem-sucedida
if [ $? -eq 0 ]; then
  echo "Heartbeat enviado com sucesso! 💓"
else
  echo "Falha ao enviar heartbeat."
fi
```
