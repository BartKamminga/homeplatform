# deploy-local.ps1
# Bouwt alle frontend sites en pusht naar GitHub
# Gebruik: powershell -ExecutionPolicy Bypass -File .\deploy-local.ps1 "fix: mixmusic player verbeterd"
# Of met commit message: .\deploy-local.ps1 "mijn commit message"

param(
    [string]$Message = "deploy: frontend builds bijgewerkt"
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ErrorActionPreference = "Stop"

Write-Host "→ Homeplatform lokale deploy" -ForegroundColor Cyan
Write-Host "  Root: $Root"

# Admin bouwen
Write-Host "`n→ Admin bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\admin"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Admin build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "✓ Admin gebouwd" -ForegroundColor Green

# Nkhockey bouwen
Write-Host "`n→ NK Hockey bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\nkhockey"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "NK Hockey build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "✓ NK Hockey gebouwd" -ForegroundColor Green

# Mixmusic bouwen
Write-Host "`n→ Mix Music bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\mixmusic"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Mix Music build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "✓ Mix Music gebouwd" -ForegroundColor Green

# Git commit en push
Write-Host "`n→ Git commit en push..." -ForegroundColor Yellow
Set-Location $Root
git add .
git commit -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host "Niets te committen" -ForegroundColor Yellow }
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Git push mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "✓ Gepusht naar GitHub" -ForegroundColor Green

Write-Host "`n✓ Klaar! Nu op de NAS uitvoeren:" -ForegroundColor Cyan
Write-Host "  ssh admin@192.168.30.193" -ForegroundColor White
Write-Host "  cd /volume1/homeplatform && git pull && docker compose up --build -d" -ForegroundColor White
