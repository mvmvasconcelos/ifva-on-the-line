# Scripts do Projeto

Este diretório contém scripts utilitários para o sistema de monitoramento.

## Scripts Disponíveis

### 🔐 generate-password-hash.ps1
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
