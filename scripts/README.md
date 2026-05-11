# Scripts do Projeto

Este diretório contém scripts utilitários para o sistema de monitoramento.

## Scripts Disponíveis

### � heartbeat_v2.sh
Script de heartbeat v2 com sondas de causa (gateway/internet/dns) via `client_payload` no `repository_dispatch`.

**Uso básico:**
```bash
export GITHUB_TOKEN="..."
export GITHUB_OWNER="mvmvasconcelos"
export GITHUB_REPO="ifva-on-the-line"
./scripts/heartbeat_v2.sh
```

**Observações:**
- Mantém contador local de sequência para idempotência (`SEQ_FILE`, padrão: `/var/lib/ifva-monitor/seq`)
- Usa fila local persistente em JSONL (`QUEUE_FILE`, padrão: `/var/lib/ifva-monitor/queue.jsonl`)
- `pending_count` reflete o backlog local quando o envio ao GitHub falha

---

### �🔐 generate-password-hash.ps1
Gera hash SHA-256 de uma senha para uso no painel de configurações do dashboard.

**Uso:**
```powershell
.\scripts\generate-password-hash.ps1
```

O script solicitará que você digite uma senha e retornará o hash SHA-256 que deve ser colocado no arquivo `web/.env`.

---

### 💓 heartbeat.sh
Script Bash para enviar heartbeat do servidor Linux no campus.

**Configuração:**
1. Edite o arquivo e insira seu token do GitHub
2. Configure no crontab: `*/5 * * * * /caminho/para/heartbeat.sh`

---

### 💓 heartbeat.ps1
Script PowerShell para enviar heartbeat (útil para testes locais no Windows).

**Uso:**
```powershell
.\scripts\heartbeat.ps1
```

**Nota:** Configure as variáveis de ambiente `GITHUB_TOKEN` e `GITHUB_REPO` antes de executar.
