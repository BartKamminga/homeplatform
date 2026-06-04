# hpem.ps1
# HomePlatformEnvironmentManager
#
# GEBRUIK:
#   .\hpem.ps1                                     # interactief
#   .\hpem.ps1 "commit message"                    # alles deployen (all/yes/nas)
#   .\hpem.ps1 "message" -Build fe                 # alleen frontend
#   .\hpem.ps1 "message" -Build be                 # alleen backend
#   .\hpem.ps1 "message" -Build be_db              # backend + migraties
#   .\hpem.ps1 "message" -Deploy local             # niet naar NAS
#   .\hpem.ps1 "message" -Push no                  # niet pushen
#   .\hpem.ps1 -Status                             # sync check lokaal vs NAS
#   .\hpem.ps1 -DbUpgrade                          # alembic upgrade head (lokaal)
#   .\hpem.ps1 -DbDowngrade 262247a3a1b0           # alembic downgrade naar revisie
#   .\hpem.ps1 -DbHistory                          # toon migratie geschiedenis
#   .\hpem.ps1 -Help                               # deze help tonen
#
# BUILD OPTIES:
#   all    Frontend bouwen (landing/admin/nkhockey/mixmusic) + backend [standaard]
#   fe     Alleen frontend bouwen
#   be     Alleen backend (geen build, wel docker rebuild op NAS)
#   be_db  Backend + database migraties uitvoeren
#
# DEPLOY OPTIES:
#   nas    Deployen naar NAS via SSH [standaard]
#   local  Alleen lokaal, geen SSH naar NAS
#
# PUSH OPTIES:
#   yes    Pushen naar GitHub [standaard]
#   no     Niet pushen (alleen lokaal testen)
#
# COMBINATIES:
#   Build  Push  Deploy  Wat gebeurt er
#   all    yes   nas     Frontend bouwen + push + NAS: git pull + caddy + docker build + alembic
#   all    yes   local   Frontend bouwen + push
#   all    no    local   Frontend bouwen, niet pushen
#   fe     yes   nas     Frontend bouwen + push + NAS: git pull + caddy reload
#   fe     yes   local   Frontend bouwen + push
#   fe     no    local   Frontend bouwen, niet pushen
#   be     yes   nas     Push + NAS: git pull + docker build backend + restart
#   be     yes   local   Push, NAS niets
#   be     no    local   Alleen lokaal testen
#   be_db  yes   nas     Push + NAS: git pull + docker build + alembic + restart
#   be_db  yes   local   Push, NAS niets
#   be_db  no    local   Alleen lokaal testen
#
# NB: Push=no + Deploy=nas is niet toegestaan

param(
    [string]$Message     = "",
    [ValidateSet("all", "fe", "be", "be_db")]
    [string]$Build       = "",
    [ValidateSet("nas", "local")]
    [string]$Deploy      = "",
    [ValidateSet("yes", "no")]
    [string]$Push        = "",
    [switch]$Status      = $false,
    [switch]$DbUpgrade   = $false,
    [string]$DbDowngrade = "",
    [switch]$DbHistory   = $false,
    [switch]$Help        = $false
)

$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$NasHost = "admin@192.168.30.193"
$NasKey  = "$env:USERPROFILE\.ssh\homeplatform"
$NasPath = "/volume1/homeplatform"
$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "   [!!] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "`n   [FOUT] $msg" -ForegroundColor Red; exit 1 }
function Info($msg) { Write-Host "   $msg" -ForegroundColor Gray }
function Label($key, $val) { Write-Host ("   {0,-16} {1}" -f $key, $val) }

function NasRun($cmd, $desc = "") {
    if ($desc) { Info $desc }
    $result = ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost $cmd
    if ($LASTEXITCODE -ne 0) { Fail "NAS commando mislukt: $cmd" }
    return $result
}

function NasRunOutput($cmd) {
    return ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost $cmd 2>$null
}

function LocalAlembic($args) {
    Set-Location "$Root\backend"
    $venvPython = "$Root\.venv\Scripts\python.exe"
    & $venvPython -m alembic $args.Split(" ")
    if ($LASTEXITCODE -ne 0) { Fail "Alembic commando mislukt" }
    Set-Location $Root
}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
if ($Help) {
    Get-Content $MyInvocation.MyCommand.Path | Where-Object { $_ -match "^#" } | ForEach-Object { $_ -replace "^# ?", "" }
    exit 0
}

# ---------------------------------------------------------------------------
# DB History
# ---------------------------------------------------------------------------
if ($DbHistory) {
    Step "Migratie geschiedenis"
    Info "Lokaal:"
    LocalAlembic "history"
    Write-Host ""
    Info "NAS:"
    NasRun "docker exec homeplatform_backend python -m alembic history" | ForEach-Object { Info "  $_" }
    exit 0
}

# ---------------------------------------------------------------------------
# DB Upgrade (lokaal)
# ---------------------------------------------------------------------------
if ($DbUpgrade) {
    Step "Database upgrade (lokaal)"
    LocalAlembic "upgrade head"
    Ok "Lokale database up to date"
    exit 0
}

# ---------------------------------------------------------------------------
# DB Downgrade (lokaal)
# ---------------------------------------------------------------------------
if ($DbDowngrade -ne "") {
    Step "Database downgrade naar: $DbDowngrade"
    Write-Host ""
    Warn "Dit verwijdert data! Weet je het zeker?"
    $confirm = Read-Host "   Doorgaan? (j/N)"
    if ($confirm -ne "j" -and $confirm -ne "J") { Write-Host "Geannuleerd."; exit 0 }
    LocalAlembic "downgrade $DbDowngrade"
    Ok "Downgrade naar $DbDowngrade voltooid"
    exit 0
}

# ---------------------------------------------------------------------------
# Status check
# ---------------------------------------------------------------------------
if ($Status) {
    Step "HomePlatform Status Check"
    Write-Host ""

    # Lokaal
    Write-Host "  LOKAAL" -ForegroundColor Cyan
    Set-Location $Root
    $localBranch  = git branch --show-current
    $localCommit  = git log -1 --format="%h - %s"
    $localRevision = & "$Root\.venv\Scripts\python.exe" -c "
import sys; sys.path.insert(0, 'backend')
from alembic.runtime.migration import MigrationContext
from core.database import engine
with engine.connect() as conn:
    ctx = MigrationContext.configure(conn)
    print(ctx.get_current_revision() or 'geen')
" 2>$null

    Label "Branch"      $localBranch
    Label "Last commit"  $localCommit
    Label "DB revisie"   $localRevision
    Write-Host ""

    # NAS
    Write-Host "  NAS" -ForegroundColor Cyan
    $nasCommit    = NasRunOutput "cd $NasPath && git log -1 --format='%h - %s'"
    $nasRevision  = NasRunOutput "docker exec homeplatform_backend python -c `"
import sys; sys.path.insert(0, '/app')
from alembic.runtime.migration import MigrationContext
from core.database import engine
with engine.connect() as conn:
    ctx = MigrationContext.configure(conn)
    print(ctx.get_current_revision() or 'geen')
`""
    $nasContainers = NasRunOutput "docker ps --format '{{.Names}} | {{.Status}}'"

    Label "Last commit"  $nasCommit
    Label "DB revisie"   $nasRevision
    Write-Host ""
    Write-Host "  Containers:" -ForegroundColor Gray
    $nasContainers | ForEach-Object { Info "  $_" }
    Write-Host ""

    # Sync check
    Write-Host "  SYNC CHECK" -ForegroundColor Cyan
    $gitSync = ($localCommit -eq $nasCommit)
    $dbSync  = ($localRevision -eq $nasRevision)

    if ($gitSync) { Ok "Git: in sync" } else { Warn "Git: NIET in sync (lokaal: $localCommit | NAS: $nasCommit)" }
    if ($dbSync)  { Ok "DB:  in sync" } else { Warn "DB:  NIET in sync (lokaal: $localRevision | NAS: $nasRevision)" }

    if (-not $gitSync) { Info "Run: .\hpem.ps1 'message' om te pushen en NAS bij te werken" }
    if (-not $dbSync)  { Info "Run: .\hpem.ps1 'message' -Build be_db om migraties uit te voeren" }

    exit 0
}

# ---------------------------------------------------------------------------
# Interactieve modus
# ---------------------------------------------------------------------------
$interactive = ($Message -eq "" -and $Build -eq "" -and $Deploy -eq "" -and $Push -eq "")

if ($interactive) {
    Write-Host ""
    Write-Host "  HomePlatformEnvironmentManager" -ForegroundColor Cyan
    Write-Host "  ==============================" -ForegroundColor Cyan
    Write-Host ""

    $Message = Read-Host "  Commit message"
    if ($Message -eq "") { $Message = "deploy: update" }

    Write-Host ""
    Write-Host "  Wat wil je bouwen?" -ForegroundColor Yellow
    Write-Host "  [1] all    - Frontend + backend (standaard)"
    Write-Host "  [2] fe     - Alleen frontend"
    Write-Host "  [3] be     - Alleen backend"
    Write-Host "  [4] be_db  - Backend + database migraties"
    $buildChoice = Read-Host "  Keuze (1)"
    switch ($buildChoice) {
        "2" { $Build = "fe" }
        "3" { $Build = "be" }
        "4" { $Build = "be_db" }
        default { $Build = "all" }
    }

    Write-Host ""
    Write-Host "  Pushen naar GitHub?" -ForegroundColor Yellow
    Write-Host "  [1] yes - Ja pushen (standaard)"
    Write-Host "  [2] no  - Niet pushen"
    $pushChoice = Read-Host "  Keuze (1)"
    $Push = if ($pushChoice -eq "2") { "no" } else { "yes" }

    if ($Push -eq "yes") {
        Write-Host ""
        Write-Host "  Deployen naar NAS?" -ForegroundColor Yellow
        Write-Host "  [1] nas   - Ja naar NAS deployen (standaard)"
        Write-Host "  [2] local - Alleen lokaal"
        $deployChoice = Read-Host "  Keuze (1)"
        $Deploy = if ($deployChoice -eq "2") { "local" } else { "nas" }
    } else {
        $Deploy = "local"
    }

    Write-Host ""
    Write-Host "  Samenvatting:" -ForegroundColor Cyan
    Label "Message" $Message
    Label "Build"   $Build
    Label "Push"    $Push
    Label "Deploy"  $Deploy
    Write-Host ""
    $confirm = Read-Host "  Doorgaan? (J/n)"
    if ($confirm -eq "n" -or $confirm -eq "N") { Write-Host "Geannuleerd." -ForegroundColor Yellow; exit 0 }

} else {
    if ($Build  -eq "") { $Build  = "all" }
    if ($Push   -eq "") { $Push   = "yes" }
    if ($Deploy -eq "") { $Deploy = "nas" }
    if ($Message -eq "") { $Message = "deploy: update" }
}

# Validatie
if ($Push -eq "no" -and $Deploy -eq "nas") {
    Fail "Push=no + Deploy=nas is niet toegestaan. NAS heeft niets te pullen zonder push."
}

Write-Host ""
Write-Host "  HomePlatformEnvironmentManager" -ForegroundColor Cyan
Info "Build=$Build | Push=$Push | Deploy=$Deploy"

# ---------------------------------------------------------------------------
# Frontend bouwen
# ---------------------------------------------------------------------------
function BuildSite($name, $path) {
    Step "Bouwen: $name"
    Set-Location "$Root\$path"
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "$name build mislukt!" }
    Ok "$name gebouwd"
}

if ($Build -eq "all" -or $Build -eq "fe") {
    BuildSite "Landing"   "frontend\sites\landing"
    BuildSite "Admin"     "frontend\sites\admin"
    BuildSite "NK Hockey" "frontend\sites\nkhockey"
    BuildSite "Mix Music" "frontend\sites\mixmusic"
}

# ---------------------------------------------------------------------------
# Git push
# ---------------------------------------------------------------------------
if ($Push -eq "yes") {
    Step "Git commit en push"
    Set-Location $Root
    git add .
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { Fail "Git commit mislukt!" }
        Ok "Gecommit: $Message"
    } else {
        Warn "Niets te committen"
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) { Fail "Git push mislukt!" }
    Ok "Gepusht naar GitHub"
}

# ---------------------------------------------------------------------------
# NAS deploy
# ---------------------------------------------------------------------------
if ($Deploy -eq "nas") {
    Step "NAS deploy"

    NasRun "cd $NasPath && git pull origin main" "Git pull..."

    switch ($Build) {
        "fe" {
            NasRun "docker exec homeplatform_caddy caddy reload --config /etc/caddy/Caddyfile" "Caddy herladen..."
            Ok "Frontend live"
        }
        "be" {
            NasRun "cd $NasPath && sudo docker-compose up --build -d backend" "Backend rebuilden..."
            Ok "Backend herstart"
        }
        "be_db" {
            NasRun "cd $NasPath && sudo docker-compose up --build -d backend" "Backend rebuilden..."
            NasRun "docker exec homeplatform_backend alembic upgrade head" "Migraties uitvoeren..."
            NasRun "docker exec homeplatform_backend python seed.py" "Seed uitvoeren..."
            NasRun "docker restart homeplatform_backend" "Backend herstarten..."
            Ok "Backend + migraties + seed klaar"
        }
        "all" {
            NasRun "cd $NasPath && sudo docker-compose up --build -d backend" "Backend rebuilden..."
            NasRun "docker exec homeplatform_backend alembic upgrade head" "Migraties uitvoeren..."
            NasRun "docker exec homeplatform_backend python seed.py" "Seed uitvoeren..."
            NasRun "docker exec homeplatform_caddy caddy reload --config /etc/caddy/Caddyfile" "Caddy herladen..."
            Ok "Alles live"
        }
    }

    Step "NAS status"
    NasRun "docker ps --format 'table {{.Names}}\t{{.Status}}'"
}

# ---------------------------------------------------------------------------
Write-Host ""
Ok "Deploy klaar!"
if ($Deploy -eq "nas") {
    Write-Host "  http://192.168.30.193:8080/" -ForegroundColor White
}
