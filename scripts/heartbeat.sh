#!/bin/bash

# Configuration
REPO_OWNER="mvmvasconcelos"
REPO_NAME="ifva-on-the-line"
PAT_TOKEN="YOUR_PAT_TOKEN" # This should ideally be an environment variable or secret

# Send the heartbeat event to GitHub Actions
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $PAT_TOKEN" \
  https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches \
  -d '{"event_type": "heartbeat"}'

# Check if the request was successful
if [ $? -eq 0 ]; then
  echo "Heartbeat enviado com sucesso! 💓"
else
  echo "Falha ao enviar heartbeat."
fi
