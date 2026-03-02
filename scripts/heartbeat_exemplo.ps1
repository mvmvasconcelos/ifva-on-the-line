# Configuração
$REPO_OWNER = "mvmvasconcelos"
$REPO_NAME = "ifva-on-the-line"
$PAT_TOKEN = "YOUR_PAT_TOKEN" # Isso idealmente deve ser uma variável de ambiente ou segredo

$Headers = @{
    "Accept"        = "application/vnd.github.v3+json"
    "Authorization" = "token $PAT_TOKEN"
}

$Body = @{
    "event_type" = "heartbeat"
} | ConvertTo-Json

$Uri = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches"

Write-Host "Iniciando o envio de heartbeats a cada 5 minutos. Pressione Ctrl+C para cancelar." -ForegroundColor Cyan

while ($true) {
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers -Body $Body
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Heartbeat enviado com sucesso! 💓" -ForegroundColor Green
    }
    catch {
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Falha ao enviar heartbeat. Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Aguarda 5 minutos (300 segundos) antes de enviar o próximo
    Start-Sleep -Seconds 300
}
