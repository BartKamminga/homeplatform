param(
    [string]$Message = "deploy: frontend builds bijgewerkt"
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ErrorActionPreference = "Stop"

Write-Host "Homeplatform lokale deploy" -ForegroundColor Cyan
Write-Host "Root: $Root"

Write-Host "Admin bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\admin"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Admin build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "Admin gebouwd" -ForegroundColor Green

Write-Host "NK Hockey bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\nkhockey"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "NK Hockey build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "NK Hockey gebouwd" -ForegroundColor Green

Write-Host "Mix Music bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\mixmusic"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Mix Music build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "Mix Music gebouwd" -ForegroundColor Green

Write-Host "Landing bouwen..." -ForegroundColor Yellow
Set-Location "$Root\frontend\sites\landing"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Landing build mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "Landing gebouwd" -ForegroundColor Green

Write-Host "Git commit en push..." -ForegroundColor Yellow
Set-Location $Root
git add .
git commit -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host "Niets te committen" -ForegroundColor Yellow }
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "Git push mislukt!" -ForegroundColor Red; exit 1 }
Write-Host "Gepusht naar GitHub" -ForegroundColor Green

Write-Host "Klaar! Nu op de NAS uitvoeren:" -ForegroundColor Cyan
Write-Host "ssh admin@192.168.30.193"
Write-Host "cd /volume1/homeplatform && git pull && sudo docker-compose up --build -d"