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

### Instalação com systemd (Ubuntu)

```bash
# 1. Copiar o script para o caminho esperado pelo service
sudo cp scripts/heartbeat_v2.sh /usr/local/bin/ifva-heartbeat.sh
sudo chmod +x /usr/local/bin/ifva-heartbeat.sh

# 2. Criar o arquivo de variáveis secretas (apenas root lê)
sudo mkdir -p /etc/ifva-monitor
sudo tee /etc/ifva-monitor/env > /dev/null <<EOF
GITHUB_TOKEN=ghp_SeuTokenAqui
GITHUB_OWNER=mvmvasconcelos
GITHUB_REPO=ifva-on-the-line
EOF
sudo chmod 600 /etc/ifva-monitor/env
sudo chown root:root /etc/ifva-monitor/env

# 3. Instalar as unidades systemd
sudo cp scripts/ifva-heartbeat.service /etc/systemd/system/
sudo cp scripts/ifva-heartbeat.timer   /etc/systemd/system/
sudo systemctl daemon-reload

# 4. Ativar e iniciar o timer
sudo systemctl enable --now ifva-heartbeat.timer

# 5. Verificar status
sudo systemctl status ifva-heartbeat.timer
sudo systemctl list-timers ifva-heartbeat.timer

# 6. Ver logs em tempo real
sudo journalctl -fu ifva-heartbeat.service
```

> **Nota:** se já existia um cron job para `heartbeat_v2.sh`, remova-o após confirmar que o timer está disparando corretamente.

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

### lan-failover.md
Documentação da camada de failover LAN → WiFi configurada no servidor do campus (fora deste repositório), incluindo por que ela afeta a classificação de causa do heartbeat e as adaptações sugeridas para o `heartbeat_v2.sh`/`process_heartbeat.py`. Ver [`lan-failover.md`](./lan-failover.md).
