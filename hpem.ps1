# hpem.ps1
# HomePlatformEnvironmentManager
#
# GEBRUIK:
#   .\hpem.ps1                                       # interactief
#   .\hpem.ps1 "commit message"                      # alles deployen
#   .\hpem.ps1 "message" -Build fe                   # alleen frontend
#   .\hpem.ps1 "message" -Build be                   # alleen backend
#   .\hpem.ps1 "message" -Build be_db                # backend + migraties
#   .\hpem.ps1 "message" -Deploy local               # niet naar NAS
#   .\hpem.ps1 "message" -Push no -Deploy nas        # NAS deployen zonder push
#   .\hpem.ps1 "message" -Build fe -CaddyRestart     # frontend + caddy restart
#   .\hpem.ps1 -Status                               # sync check lokaal vs NAS
#   .\hpem.ps1 -NasSetup                             # eenmalige NAS toegang instellen
#   .\hpem.ps1 -DbUpgrade                            # alembic upgrade head lokaal
#   .\hpem.ps1 -DbDowngrade <revisie>                # alembic downgrade naar revisie
#   .\hpem.ps1 -DbHistory                            # toon migratie geschiedenis
#   .\hpem.ps1 -Help                                 # deze help tonen
#   .\hpem.ps1 -CaddyReset                          # caddy cache wissen en herstarten
#
# BUILD OPTIES:
#   all    Frontend bouwen + backend [standaard]
#   fe     Alleen frontend bouwen
#   be     Alleen backend
#   be_db  Backend + database migraties
#
# DEPLOY OPTIES:
#   nas    Naar NAS via SSH [standaard]
#   local  Alleen lokaal
#
# PUSH OPTIES:
#   yes    Pushen naar GitHub [standaard]
#   no     Niet pushen
#
# CADDY OPTIES:
#   -CaddyRestart   Herstart Caddy container (nodig bij nieuwe routes)
#                   Zonder deze flag wordt caddy reload gebruikt (sneller)
#   -CaddyReset     Stop alles, wis Caddy config cache, start alles opnieuw
#                   Gebruik bij Caddy crashes of config problemen



param(
    [string]$Message     = "",
    [ValidateSet("all", "fe", "be", "be_db")]
    [string]$Build       = "",
    [ValidateSet("nas", "local")]
    [string]$Deploy      = "",
    [ValidateSet("yes", "no")]
    [string]$Push        = "",
    [switch]$Status      = $false,
    [switch]$NasSetup    = $false,
    [switch]$DbUpgrade   = $false,
    [string]$DbDowngrade = "",
    [switch]$DbHistory   = $false,
    [switch]$Help        = $false,
    [switch]$CaddyRestart = $false,
    [switch]$CaddyReset   = $false
)

# Zichzelf unblocking zodat updates direct werken
Unblock-File $MyInvocation.MyCommand.Path 2>$null


# ---------------------------------------------------------------------------
# Configuratie
# ---------------------------------------------------------------------------
$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path

# NAS IP: lees uit .env als NAS_IP= aanwezig is, anders fallback
$NasIp   = "192.168.30.193"
$EnvFile = "$Root\.env"
if (Test-Path $EnvFile) {
    $envLine = Get-Content $EnvFile | Where-Object { $_ -match "^NAS_IP\s*=" } | Select-Object -First 1
    if ($envLine) { $NasIp = ($envLine -split "=", 2)[1].Trim() }
}

$NasUser = "admin"
$NasHost = "${NasUser}@${NasIp}"
$NasKey  = "$env:USERPROFILE\.ssh\homeplatform"
$NasPath = "/volume1/homeplatform"
$NasPort = "8080"
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Hulpfuncties
# ---------------------------------------------------------------------------
function Step($msg)        { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Ok($msg)          { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Warn($msg)        { Write-Host "   [!!] $msg" -ForegroundColor Yellow }
function Fail($msg)        { Write-Host "`n   [FOUT] $msg" -ForegroundColor Red; exit 1 }
function Info($msg)        { Write-Host "   $msg" -ForegroundColor Gray }
function Label($key, $val) { Write-Host ("   {0,-18} {1}" -f $key, $val) }

function NasSsh($cmd) {
    ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost $cmd
}

function NasRun($cmd, $desc = "") {
    if ($desc) { Info $desc }
    NasSsh $cmd
    if ($LASTEXITCODE -ne 0) { Fail "NAS commando mislukt" }
}

function NasOut($cmd) {
    NasSsh $cmd 2>$null
}

function DistUpload {
    Info "Frontend dist uploaden naar NAS..."
    $distPath = "$Root\frontend\dist"
    if (-not (Test-Path $distPath)) { Fail "frontend\dist niet gevonden - run eerst de build stap" }
    NasSsh "sudo mkdir -p $NasPath/frontend/dist; sudo chmod 777 $NasPath/frontend/dist"
    $cmdStr = 'tar -czf - -C "' + $distPath + '" . | ssh -i "' + $NasKey + '" -o StrictHostKeyChecking=no ' + $NasHost + ' "sudo tar -xzf - -C ' + $NasPath + '/frontend/dist"'
    cmd /c $cmdStr
    if ($LASTEXITCODE -ne 0) { Fail "Upload van dist mislukt" }
    Ok "Dist geüpload naar NAS"
}

function LocalAlembic($alembicArgs) {
    $prev = Get-Location
    Set-Location "$Root\backend"
    $env:DATABASE_URL = "sqlite:///" + ($Root -replace '\\', '/') + "/db/homeplatform.sqlite"
    & "$Root\.venv\Scripts\python.exe" -m alembic ($alembicArgs -split " ")
    if ($LASTEXITCODE -ne 0) { Fail "Alembic commando mislukt" }
    Set-Location $prev
}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
if ($Help) {
    Get-Content $MyInvocation.MyCommand.Path |
        Where-Object { $_ -match "^# " -or $_ -eq "#" } |
        ForEach-Object { $_ -replace "^# ?", "" }
    exit 0
}

# ---------------------------------------------------------------------------
# NAS Setup
# ---------------------------------------------------------------------------
if ($NasSetup) {
    Step "NAS Setup"

    # SSH key aanmaken
    if (-not (Test-Path $NasKey)) {
        Info "SSH key aanmaken..."
        ssh-keygen -t ed25519 -C "homeplatform-deploy" -f $NasKey -N '""'
        Ok "SSH key aangemaakt"
    } else {
        Ok "SSH key bestaat al"
    }

    # SSH key naar NAS kopiëren
    Write-Host ""
    Write-Host "   Voer NAS wachtwoord in als gevraagd:" -ForegroundColor Yellow
    $pubKey = (Get-Content "$NasKey.pub").Trim()
    $copyCmd = "mkdir -p ~/.ssh; grep -qF '$pubKey' ~/.ssh/authorized_keys 2>/dev/null || echo '$pubKey' >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; chmod 700 ~/.ssh"
    ssh $NasHost $copyCmd
    Ok "SSH key gekopieerd"

    # Sudo configureren
    Write-Host ""
    Write-Host "   Voer NAS wachtwoord in als gevraagd:" -ForegroundColor Yellow
    $sudoFile = "/etc/sudoers.d/homeplatform"
    ssh $NasHost "sudo sh -c `"echo 'Defaults secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' > $sudoFile`""
    ssh $NasHost "sudo sh -c `"echo '$NasUser ALL=(ALL) NOPASSWD: ALL' >> $sudoFile`""
    ssh $NasHost "sudo chmod 440 $sudoFile"
    Ok "Sudo geconfigureerd"

    # Test
    Write-Host ""
    Step "Verbinding testen"
    $test = NasOut "echo OK"
    if ($test -eq "OK") { Ok "SSH zonder wachtwoord werkt" } else { Warn "SSH werkt nog niet zonder wachtwoord" }
    $dc = NasOut "sudo docker-compose --version"
    if ($dc) { Ok "docker-compose werkt" } else { Warn "docker-compose werkt nog niet" }

    Write-Host ""
    Ok "NAS Setup klaar!"
    exit 0
}

# ---------------------------------------------------------------------------
# Caddy Reset
# ---------------------------------------------------------------------------
if ($CaddyReset) {
    Step "Caddy reset"
    NasRun "sudo /usr/local/bin/docker-compose -f $NasPath/docker-compose.nas.yml down" "Containers stoppen..."
    NasRun "sudo /usr/local/bin/docker volume rm homeplatform_caddy_config" "Caddy config cache verwijderen..."
    NasRun "sudo /usr/local/bin/docker-compose -f $NasPath/docker-compose.nas.yml up -d" "Alles opstarten..."
    Ok "Caddy reset klaar"
    exit 0
}

# ---------------------------------------------------------------------------
# DB History
# ---------------------------------------------------------------------------
if ($DbHistory) {
    Step "Migratie geschiedenis"
    Write-Host ""
    Write-Host "  LOKAAL" -ForegroundColor Cyan
    LocalAlembic "history"
    Write-Host ""
    Write-Host "  NAS" -ForegroundColor Cyan
    NasOut "sudo /usr/local/bin/docker exec homeplatform_backend python -m alembic history" |
        ForEach-Object { Info "  $_" }
    exit 0
}

# ---------------------------------------------------------------------------
# DB Upgrade lokaal
# ---------------------------------------------------------------------------
if ($DbUpgrade) {
    Step "Database upgrade lokaal"
    LocalAlembic "upgrade head"
    Ok "Lokale database up to date"
    exit 0
}

# ---------------------------------------------------------------------------
# DB Downgrade lokaal
# ---------------------------------------------------------------------------
if ($DbDowngrade -ne "") {
    Step "Database downgrade naar: $DbDowngrade"
    Warn "Dit verwijdert data! Weet je het zeker?"
    $confirm = Read-Host "   Doorgaan? (j/N)"
    if ($confirm -notin @("j","J")) { Write-Host "Geannuleerd."; exit 0 }
    LocalAlembic "downgrade $DbDowngrade"
    Ok "Downgrade voltooid"
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
    $prev = Get-Location
    Set-Location "$Root\backend"
    $localBranch   = git branch --show-current
    $localCommit   = git log -1 --format="%h - %s"
    $localRevision = (& "$Root\.venv\Scripts\python.exe" -m alembic current 2>$null) | Select-Object -Last 1
    Set-Location $prev

    Label "Branch"      $localBranch
    Label "Last commit" $localCommit
    Label "DB revisie"  $localRevision
    Write-Host ""

    # NAS
    Write-Host "  NAS" -ForegroundColor Cyan
    $nasCommit   = NasOut "cd $NasPath && git log -1 --format='%h - %s'"
    $nasRevision = NasOut "sudo /usr/local/bin/docker exec homeplatform_backend alembic current 2>/dev/null | tail -1"
    $nasPs       = NasOut "sudo /usr/local/bin/docker ps"

    Label "Last commit" $nasCommit
    Label "DB revisie"  $nasRevision
    Write-Host ""
    Write-Host "  Containers:" -ForegroundColor Gray
    $nasPs | ForEach-Object { Info "  $_" }
    Write-Host ""

    # Sync
    Write-Host "  SYNC CHECK" -ForegroundColor Cyan
    $gitSync = ($localCommit -eq $nasCommit)
    $dbSync  = ($localRevision.Trim() -eq $nasRevision.Trim())

    if ($gitSync) { Ok "Git: in sync" } else { Warn "Git: NIET in sync" }
    if ($dbSync)  { Ok "DB:  in sync" } else { Warn "DB:  NIET in sync (lokaal: $localRevision | NAS: $nasRevision)" }
    if (-not $gitSync) { Info "Tip: .\hpem.ps1 om te pushen en NAS bij te werken" }
    if (-not $dbSync)  { Info "Tip: .\hpem.ps1 -Build be_db om migraties uit te voeren" }

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
    $bc = Read-Host "  Keuze (1)"
    $Build = switch ($bc) { "2" {"fe"} "3" {"be"} "4" {"be_db"} default {"all"} }

    Write-Host ""
    Write-Host "  Pushen naar GitHub?" -ForegroundColor Yellow
    Write-Host "  [1] yes - Ja (standaard)  [2] no - Nee"
    $pc = Read-Host "  Keuze (1)"
    $Push = if ($pc -eq "2") { "no" } else { "yes" }

    Write-Host ""
    Write-Host "  Deployen naar NAS?" -ForegroundColor Yellow
    Write-Host "  [1] nas - Ja (standaard)  [2] local - Nee"
    $dc = Read-Host "  Keuze (1)"
    $Deploy = if ($dc -eq "2") { "local" } else { "nas" }

    Write-Host ""
    Write-Host "  Samenvatting:" -ForegroundColor Cyan
    Label "Message" $Message
    Label "Build"   $Build
    Label "Push"    $Push
    Label "Deploy"  $Deploy
    Write-Host ""
    $ok = Read-Host "  Doorgaan? (J/n)"
    if ($ok -in @("n","N")) { Write-Host "Geannuleerd." -ForegroundColor Yellow; exit 0 }

} else {
    if ($Build   -eq "") { $Build   = "all" }
    if ($Push    -eq "") { $Push    = "yes" }
    if ($Deploy  -eq "") { $Deploy  = "nas" }
    if ($Message -eq "") { $Message = "deploy: update" }
}

Write-Host ""
Write-Host "  HomePlatformEnvironmentManager" -ForegroundColor Cyan
Info "Build=$Build | Push=$Push | Deploy=$Deploy"

# ---------------------------------------------------------------------------
# Frontend bouwen
# ---------------------------------------------------------------------------
if ($Build -in @("all","fe")) {
    Step "Bouwen: Frontend (alle sites)"
    Set-Location "$Root\frontend\sites"
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "Frontend build mislukt" }
    Set-Location $Root
    Ok "Frontend gebouwd"
}

# ---------------------------------------------------------------------------
# Git push
# ---------------------------------------------------------------------------
if ($Push -eq "yes") {
    Step "Git commit en push"
    Set-Location $Root
    # git add schrijft CRLF-warnings naar stderr; tijdelijk niet stoppen op native-command output
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    git add .
    $ErrorActionPreference = $prevEAP
    if ($LASTEXITCODE -ne 0) { Fail "Git add mislukt" }
    $st = git status --porcelain
    if ($st) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { Fail "Git commit mislukt" }
        Ok "Gecommit: $Message"
    } else {
        Warn "Niets te committen"
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) { Fail "Git push mislukt" }
    Ok "Gepusht naar GitHub"
}

# ---------------------------------------------------------------------------
# NAS deploy
# ---------------------------------------------------------------------------
if ($Deploy -eq "nas") {
    Step "NAS deploy"

    if ($Push -eq "yes") {
        NasRun "cd $NasPath && git pull origin main" "Git pull..."
    } else {
        Warn "Geen git pull (Push=no)"
    }

    $dcCmd       = "sudo docker-compose -f $NasPath/docker-compose.nas.yml up --build -d backend"
    $dcCaddy     = "sudo /usr/local/bin/docker-compose -f $NasPath/docker-compose.nas.yml restart caddy"
    $dcGlitchtip = "sudo /usr/local/bin/docker-compose -f $NasPath/docker-compose.nas.yml up -d glitchtip-db glitchtip-redis glitchtip glitchtip-worker"
    $docker      = "sudo /usr/local/bin/docker"

    switch ($Build) {
        "fe" {
            DistUpload
            if ($CaddyRestart) {
                NasRun $dcCaddy "Caddy herstarten..."
            } else {
                NasRun "$docker exec homeplatform_caddy caddy reload --config /etc/caddy/Caddyfile" "Caddy herladen..."
            }
            Ok "Frontend live"
        }
        "be" {
            NasRun $dcCmd "Backend rebuilden..."
            Ok "Backend herstart"
        }
        "be_db" {
            NasRun $dcCmd "Backend rebuilden..."
            NasRun "$docker exec homeplatform_backend alembic upgrade head" "Migraties uitvoeren..."
            NasRun "$docker exec homeplatform_backend python seed.py" "Seed uitvoeren..."
            NasRun $dcGlitchtip "GlitchTip starten..."
            Start-Sleep -Seconds 8
            NasRun "$docker exec homeplatform_glitchtip python manage.py migrate --no-input" "GlitchTip migraties..."
            NasRun "$docker restart homeplatform_backend" "Backend herstarten..."
            Step "Lokale database upgraden"
            LocalAlembic "upgrade head"
            Ok "Backend + migraties + seed klaar"
        }
        "all" {
            NasRun $dcCmd "Backend rebuilden..."
            NasRun "$docker exec homeplatform_backend alembic upgrade head" "Migraties uitvoeren..."
            NasRun "$docker exec homeplatform_backend python seed.py" "Seed uitvoeren..."
            NasRun $dcGlitchtip "GlitchTip starten..."
            Start-Sleep -Seconds 8
            NasRun "$docker exec homeplatform_glitchtip python manage.py migrate --no-input" "GlitchTip migraties..."
            Step "Lokale database upgraden"
            LocalAlembic "upgrade head"
            DistUpload
            NasRun $dcCaddy "Caddy herstarten..."
            Ok "Alles live"
        }
    }

    Step "NAS status"
    NasSsh "sudo /usr/local/bin/docker ps"
}

# ---------------------------------------------------------------------------
Write-Host ""
Ok "Deploy klaar!"
if ($Deploy -eq "nas") {
    Write-Host "  http://${NasIp}:${NasPort}/" -ForegroundColor White
}
