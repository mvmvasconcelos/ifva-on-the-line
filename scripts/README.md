# Scripts do Projeto

Este diretório contém utilitários do monitoramento.

## Scripts disponíveis

### heartbeat_v2.sh
Heartbeat v2 com sondas locais de gateway/internet/dns, fila persistente em JSONL e envio em lote via `repository_dispatch`.

Uso:
```bash
export GITHUB_TOKEN="..."
export GITHUB_OWNER="mvmvasconcelos"
export GITHUB_REPO="ifva-on-the-line"
./scripts/heartbeat_v2.sh
```

Arquivos locais usados:
- `SEQ_FILE` para sequência monotônica
- `QUEUE_FILE` para backlog persistente
- `data/incidents.json` para incidentes consolidados

### generate-password-hash.ps1
Gera hash SHA-256 de uma senha para uso no painel do dashboard.

Uso:
```powershell
.\scripts\generate-password-hash.ps1
```

### heartbeat_exemplo.sh
Exemplo Bash para enviar heartbeat ao GitHub.

### heartbeat_exemplo.ps1
Exemplo PowerShell para testes locais no Windows.

### heartbeat.sh / heartbeat.ps1
Nomes legados citados na documentação antiga. Use os exemplos acima ou o `heartbeat_v2.sh`.
