# Script para gerar hash SHA-256 de uma senha
# Uso: .\generate-password-hash.ps1

Write-Host "=== Gerador de Hash de Senha (SHA-256) ===" -ForegroundColor Cyan
Write-Host ""

$password = Read-Host "Digite a senha para o painel de administração" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

$sha256 = New-Object System.Security.Cryptography.SHA256Managed
$hashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($plainPassword))
$hash = [System.BitConverter]::ToString($hashBytes).Replace("-","").ToLower()

Write-Host ""
Write-Host "Hash SHA-256 gerado:" -ForegroundColor Green
Write-Host $hash -ForegroundColor Yellow
Write-Host ""
Write-Host "Copie este hash e cole no arquivo web/.env na variável:" -ForegroundColor Cyan
Write-Host "VITE_ADMIN_PASSWORD_HASH=$hash" -ForegroundColor White
Write-Host ""

# Limpa a senha da memória
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$plainPassword = $null

Read-Host "Pressione Enter para sair"
