# Dossier.ps1 - HomePlatform Dossiers CLI (item 1355), voor Claude-sessies en snelle invoer
#
# GEBRUIK:
#   .\Dossier.ps1 -Setup [-Env prod|acc|local]                     # eenmalig: config (API key) aanmaken
#   .\Dossier.ps1 -List                                            # alle dossiers
#   .\Dossier.ps1 -Create -Name "LCMS toekomst"                    # nieuw dossier
#   .\Dossier.ps1 -Create -Name "Inhuur hosting" -Proposed -Criteria "..."   # voorgesteld dossier (mailronde), Bart accepteert in de Inbox
#   .\Dossier.ps1 -Inbox                                           # wat wacht op Bart: voorgestelde dossiers + mailvoorstellen
#   .\Dossier.ps1 -Get -Name lcms-toekomst                         # export -> dossier_work\<slug>.md (start van een sessie)
#   .\Dossier.ps1 -AddNote -Name <dossier> -Title "..." -Text "..." [-Kind note|session|link] [-Url <url>]
#   .\Dossier.ps1 -AddNote -Name <dossier> -Title "..." -FilePath notitie.md -Kind session   # sessienotitie uit bestand
#   .\Dossier.ps1 -Upload -Name <dossier> -FilePath <pad>         # bestand (mail/pdf/...) met automatische tekstextractie
#   .\Dossier.ps1 -AddPage -Name <dossier> -FilePath koers.html    # HTML-uitwerking; bestaande pagina met dezelfde <title> wordt vervangen
#   .\Dossier.ps1 -AddNote -Name <dossier> -Kind idea -Title "..." -Text "..."   # idee
#   .\Dossier.ps1 -AddOutbox -Title <onderwerp> -Date <iso> -Ref <ref> -FilePath samenvatting.md -Value high|medium|low `
#                 -Urgency today|week|later|none -Action reply|read|forward|none [-DraftFile concept.md] [-Sender "rol"] [-Reason "..."] [-Url ...]
#   .\Dossier.ps1 -Outbox                                          # open outbox-items (urgentie, waarde, titel)
#   .\Dossier.ps1 -SetSummary -Name <dossier> -FilePath stand.md   # "stand van zaken" vervangen
#   .\Dossier.ps1 -SetCriteria -Name <dossier> -Text "..."         # zoekcriteria voor de mailronde
#   .\Dossier.ps1 -MailRef -Subject "..." -Date "2026-10-15T09:12" -From "afdeling@org.nl"   # stabiele sleutel per mail
#   .\Dossier.ps1 -CheckRefs -Name <dossier> -Refs "ref1,ref2"     # welke mails zitten er al in (added/proposed/rejected)
#   .\Dossier.ps1 -CheckRefs -Refs "ref1,ref2"                     # zonder -Name: over ALLE dossiers (mailronde voor alles)
#   .\Dossier.ps1 -AddMail -Name <dossier> -Title <onderwerp> -Date <iso> -Ref <ref> -FilePath samenvatting.md `
#                 [-Url <outlook-link>] [-Reason "waarom relevant"] [-Direct]
#                 # standaard een VOORSTEL dat Bart op de dossierpagina accepteert/afwijst; -Direct voegt meteen toe
#
# -Name mag de slug (lcms-toekomst) of de naam zijn. -Env kiest de omgeving (default prod);
# elke omgeving heeft een eigen database. Zonder eigen config wordt .mindbox.config.<env>.ps1 hergebruikt
# (dezelfde soort API key werkt op alle eigen-gebruiker-endpoints).

param(
    [switch]$Setup, [switch]$List, [switch]$Create, [switch]$Get, [switch]$AddNote, [switch]$Upload,
    [switch]$SetSummary, [switch]$SetCriteria, [switch]$MailRef, [switch]$CheckRefs, [switch]$AddMail,
    [switch]$Direct, [switch]$Proposed, [switch]$Inbox, [switch]$AddPage, [switch]$AddOutbox, [switch]$Outbox,
    [ValidateSet("prod", "acc", "local")]
    [string]$Env      = "prod",
    [string]$Name     = "",
    [string]$Title    = "",
    [string]$Text     = "",
    [string]$FilePath = "",
    [ValidateSet("note", "session", "link", "mail", "document", "idea")]
    [string]$Kind     = "note",
    [string]$Url      = "",
    [string]$Date     = "",
    [string]$Ref      = "",
    [string]$Refs     = "",
    [string]$Reason   = "",
    [string]$Subject  = "",
    [string]$From     = "",
    [string]$Criteria = "",
    [ValidateSet("high", "medium", "low")]
    [string]$Value    = "medium",
    [ValidateSet("today", "week", "later", "none")]
    [string]$Urgency  = "week",
    [ValidateSet("reply", "read", "forward", "none")]
    [string]$Action   = "reply",
    [string]$DraftFile = "",
    [string]$Sender   = ""
)

$DefaultApiBase = @{
    prod  = "http://192.168.30.49:8080/api"
    acc   = "http://192.168.30.232:8081/api"
    local = "http://localhost:8000/api"
}[$Env]
$ConfigFile = Join-Path $PSScriptRoot ".dossier.config.$Env.ps1"
$WorkDir    = Join-Path $PSScriptRoot "dossier_work"

# ---------------------------------------------------------------------------
# MailRef - puur lokaal, geen API nodig
# ---------------------------------------------------------------------------
if ($MailRef) {
    if (-not $Subject -or -not $Date) { Write-Host "Geef -Subject en -Date op (en bij voorkeur -From)"; exit 1 }
    $normSubject = ($Subject -replace '^\s*((re|fw|fwd|aw|antw)\s*[:_]\s*)+', '').Trim().ToLower()
    $key = "$normSubject|$($Date.Trim())|$($From.Trim().ToLower())"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($key))
    Write-Output ("mail-" + (($hash | ForEach-Object { $_.ToString("x2") }) -join "").Substring(0, 24))
    exit 0
}

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
if ($Setup) {
    $apiBase = Read-Host "API base URL [$DefaultApiBase]"
    if (-not $apiBase) { $apiBase = $DefaultApiBase }
    $user = Read-Host "Gebruikersnaam"
    $pass = Read-Host "Wachtwoord" -AsSecureString
    $plainPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
    try {
        $form = "username=$([Uri]::EscapeDataString($user))&password=$([Uri]::EscapeDataString($plainPass))"
        $login = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -ContentType "application/x-www-form-urlencoded" -Body $form -ErrorAction Stop
        $key = Invoke-RestMethod -Uri "$apiBase/auth/api-keys" -Method POST `
            -Headers @{ Authorization = "Bearer $($login.access_token)"; "Content-Type" = "application/json" } `
            -Body '{"name":"dossier-cli"}' -ErrorAction Stop
    } catch { Write-Host "[FOUT] Setup mislukt: $($_.Exception.Message)"; exit 1 }
    $config = "# HomePlatform Dossier CLI config ($Env) - gegenereerd door .\Dossier.ps1 -Setup`n" +
        "`$HP_API_BASE = `"$apiBase`"`n`$HP_API_KEY  = `"$($key.key)`"`n"
    Set-Content -Path $ConfigFile -Value $config -Encoding utf8
    Write-Host "[OK] Config opgeslagen in .dossier.config.$Env.ps1"
    exit 0
}

# ---------------------------------------------------------------------------
# Config laden (eigen config, anders die van MindBox voor dezelfde omgeving)
# ---------------------------------------------------------------------------
$fallback = Join-Path $PSScriptRoot ".mindbox.config.$Env.ps1"
if (Test-Path $ConfigFile) { . $ConfigFile }
elseif (Test-Path $fallback) { . $fallback }
else { Write-Host "[FOUT] Geen config voor '$Env'. Voer eerst: .\Dossier.ps1 -Setup -Env $Env"; exit 1 }
if (-not $HP_API_BASE -or -not $HP_API_KEY) { Write-Host "[FOUT] Config onvolledig. Voer .\Dossier.ps1 -Setup -Env $Env uit."; exit 1 }

function Invoke-Api([string]$Method, [string]$Path, $Body = $null) {
    $params = @{ Uri = "$HP_API_BASE$Path"; Method = $Method; Headers = @{ Authorization = "Bearer $HP_API_KEY" }; ErrorAction = "Stop" }
    if ($null -ne $Body) {
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 6))
    }
    try { return Invoke-RestMethod @params }
    catch { Write-Host "[FOUT] $Method $Path - $($_.Exception.Message)"; exit 1 }
}

function Read-TextArg {
    if ($FilePath) { return [System.IO.File]::ReadAllText((Resolve-Path $FilePath), [System.Text.Encoding]::UTF8) }
    return $Text
}

function Resolve-Dossier {
    if (-not $Name) { Write-Host "Geef -Name op (slug of naam)"; exit 1 }
    $all = @(Invoke-Api GET "/dossiers" | ForEach-Object { $_ })  # PS 5.1 levert een JSON-lijst als 1 object
    $match = $all | Where-Object { $_.slug -eq $Name -or $_.id -eq $Name -or $_.name -eq $Name } | Select-Object -First 1
    if (-not $match) { Write-Host "[FOUT] Geen dossier '$Name'. Zie .\Dossier.ps1 -List"; exit 1 }
    return $match
}

if ($List) {
    $all = @(Invoke-Api GET "/dossiers" | ForEach-Object { $_ })  # PS 5.1 levert een JSON-lijst als 1 object
    if (-not $all.Count) { Write-Host "Nog geen dossiers."; exit 0 }
    Write-Host ("{0,-28} {1,-30} {2,7} {3,9}  {4}" -f "SLUG", "NAAM", "STUKKEN", "VOORSTEL", "BIJGEWERKT")
    foreach ($d in $all) { Write-Host ("{0,-28} {1,-30} {2,7} {3,9}  {4}" -f $d.slug, $d.name, $d.entry_count, $d.proposed_count, $d.updated_at) }
    exit 0
}

if ($Create) {
    if (-not $Name) { Write-Host "Geef -Name op"; exit 1 }
    $body = @{ name = $Name; status = $(if ($Proposed) { "proposed" } else { "active" }) }
    if ($Criteria) { $body.mail_criteria = $Criteria }
    $d = Invoke-Api POST "/dossiers" $body
    Write-Host "[OK] Dossier '$($d.name)' aangemaakt (slug: $($d.slug), status: $($d.status))"; exit 0
}

if ($Inbox) {
    $box = Invoke-Api GET "/dossiers/inbox"
    $ds = @($box.dossiers | ForEach-Object { $_ }); $es = @($box.entries | ForEach-Object { $_ })
    Write-Host "Voorgestelde dossiers: $($ds.Count)"
    foreach ($d in $ds) { Write-Host ("  {0,-28} {1} ({2} mails)" -f $d.slug, $d.name, $d.proposed_count) }
    Write-Host "Mailvoorstellen: $($es.Count)"
    foreach ($e in $es) { Write-Host ("  {0,-28} {1}" -f $e.dossier_slug, $e.title) }
    exit 0
}

if ($Outbox) {
    $items = @(Invoke-Api GET "/dossier-outbox" | ForEach-Object { $_ })
    if (-not $items.Count) { Write-Host "Outbox is leeg."; exit 0 }
    foreach ($i in $items) { Write-Host ("{0,-6} {1,-7} {2,-8} {3}" -f $i.urgency, $i.value, $i.action, $i.title) }
    exit 0
}

if ($AddOutbox) {
    if (-not $Title -or -not $Ref) { Write-Host "Geef -Title en -Ref op (maak -Ref met -MailRef)"; exit 1 }
    $body = @{ title = $Title; summary = (Read-TextArg); external_ref = $Ref; value = $Value; urgency = $Urgency; action = $Action }
    if ($Date) { $body.received_at = $Date }
    if ($Sender) { $body.sender_role = $Sender }
    if ($Reason) { $body.reason = $Reason }
    if ($Url) { $body.source_url = $Url }
    if ($DraftFile) { $body.draft_reply = [System.IO.File]::ReadAllText((Resolve-Path $DraftFile), [System.Text.Encoding]::UTF8) }
    $o = Invoke-Api POST "/dossier-outbox" $body
    if ($o.created -eq $false) { Write-Host "[--] '$($o.title)' stond al in de outbox ($($o.status))" }
    else { Write-Host "[OK] Outbox: '$($o.title)' ($($o.urgency), $($o.value))" }
    exit 0
}

if ($CheckRefs -and -not $Name) {
    $refList = @($Refs -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if (-not $refList.Count) { Write-Host "Geef -Refs op (komma-gescheiden)"; exit 1 }
    $res = Invoke-Api POST "/dossiers/refs/check" @{ refs = $refList }
    foreach ($p in $res.PSObject.Properties) {
        $v = $p.Value
        Write-Host ("{0}  {1}" -f $p.Name, $(if ($v) { "$($v.state) in $($v.slug)" } else { "nieuw" }))
    }
    exit 0
}

$dossier = Resolve-Dossier

if ($Get) {
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
    $out = Join-Path $WorkDir "$($dossier.slug).md"
    $res = Invoke-WebRequest -Uri "$HP_API_BASE/dossiers/$($dossier.id)/export" -Headers @{ Authorization = "Bearer $HP_API_KEY" } -UseBasicParsing -ErrorAction Stop
    $md = [System.Text.Encoding]::UTF8.GetString($res.RawContentStream.ToArray())
    [System.IO.File]::WriteAllText($out, $md, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "[OK] $($dossier.name): $($dossier.entry_count) stukken, $($dossier.proposed_count) voorstellen -> $out"
    exit 0
}

if ($AddNote) {
    if (-not $Title) { Write-Host "Geef -Title op"; exit 1 }
    $body = @{ kind = $Kind; title = $Title; body = (Read-TextArg) }
    if ($Url) { $body.source_url = $Url }
    $e = Invoke-Api POST "/dossiers/$($dossier.id)/entries" $body
    Write-Host "[OK] $($e.kind) '$($e.title)' toegevoegd"; exit 0
}

if ($Upload) {
    if (-not $FilePath -or -not (Test-Path $FilePath)) { Write-Host "Geef een bestaand -FilePath op"; exit 1 }
    $form = @{ uploads = Get-Item (Resolve-Path $FilePath) }
    try {
        $res = Invoke-RestMethod -Uri "$HP_API_BASE/dossiers/$($dossier.id)/upload" -Method POST -Headers @{ Authorization = "Bearer $HP_API_KEY" } -Form $form -ErrorAction Stop
    } catch {
        # PowerShell 5.1 kent -Form niet: val terug op curl.exe
        $raw = & curl.exe -s -H "Authorization: Bearer $HP_API_KEY" -F "uploads=@$((Resolve-Path $FilePath).Path)" "$HP_API_BASE/dossiers/$($dossier.id)/upload"
        $res = $raw | ConvertFrom-Json
    }
    if ($null -eq $res) { Write-Host "[FOUT] Upload mislukt (geen antwoord van de server)"; exit 1 }
    foreach ($r in @($res | ForEach-Object { $_ })) {
        if ($r.error) { Write-Host "[FOUT] $($r.original_filename): $($r.error)" }
        elseif ($r.created -eq $false) { Write-Host "[--] $($r.original_filename) zat al in het dossier" }
        else { Write-Host "[OK] $($r.kind) '$($r.title)' toegevoegd" }
    }
    exit 0
}

if ($AddPage) {
    if (-not $FilePath -or -not (Test-Path $FilePath) -or [IO.Path]::GetExtension($FilePath) -ne ".html") { Write-Host "Geef een bestaand .html -FilePath op"; exit 1 }
    $full = (Resolve-Path $FilePath).Path
    $html = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
    $m = [regex]::Match($html, '<title[^>]*>(.*?)</title>', 'IgnoreCase,Singleline')
    $pageTitle = if ($m.Success) { $m.Groups[1].Value.Trim() } else { [IO.Path]::GetFileNameWithoutExtension($full) }
    $pages = @(Invoke-Api GET "/dossiers/$($dossier.id)/entries?kind=page" | ForEach-Object { $_ })
    $existing = $pages | Where-Object { $_.title -eq $pageTitle } | Select-Object -First 1
    if ($existing) {
        $raw = & curl.exe -s -X PUT -H "Authorization: Bearer $HP_API_KEY" -F "upload=@$full;type=text/html" "$HP_API_BASE/dossiers/entries/$($existing.id)/file"
        $r = $raw | ConvertFrom-Json
        if ($r.id) { Write-Host "[OK] Pagina '$pageTitle' vervangen (nieuwe versie)" } else { Write-Host "[FOUT] Vervangen mislukt: $raw"; exit 1 }
    } else {
        $raw = & curl.exe -s -H "Authorization: Bearer $HP_API_KEY" -F "uploads=@$full;type=text/html" "$HP_API_BASE/dossiers/$($dossier.id)/upload?kind=page"
        $r = @($raw | ConvertFrom-Json | ForEach-Object { $_ })[0]
        if ($r.error) { Write-Host "[FOUT] $($r.error)"; exit 1 }
        elseif ($r.created -eq $false) { Write-Host "[--] Deze pagina stond er al (zelfde inhoud)" }
        else { Write-Host "[OK] Pagina '$($r.title)' toegevoegd" }
    }
    exit 0
}

if ($SetSummary) {
    $d = Invoke-Api PATCH "/dossiers/$($dossier.id)" @{ summary = (Read-TextArg) }
    Write-Host "[OK] Stand van zaken bijgewerkt voor '$($d.name)'"; exit 0
}

if ($SetCriteria) {
    $d = Invoke-Api PATCH "/dossiers/$($dossier.id)" @{ mail_criteria = (Read-TextArg) }
    Write-Host "[OK] Mailcriteria bijgewerkt voor '$($d.name)'"; exit 0
}

if ($CheckRefs) {
    $refList = @($Refs -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if (-not $refList.Count) { Write-Host "Geef -Refs op (komma-gescheiden)"; exit 1 }
    $res = Invoke-Api POST "/dossiers/$($dossier.id)/refs/check" @{ refs = $refList }
    foreach ($p in $res.PSObject.Properties) { Write-Host ("{0}  {1}" -f $p.Name, $(if ($p.Value) { $p.Value } else { "nieuw" })) }
    exit 0
}

if ($AddMail) {
    if (-not $Title -or -not $Ref) { Write-Host "Geef -Title en -Ref op (maak -Ref met -MailRef)"; exit 1 }
    $body = @{ kind = "mail"; title = $Title; body = (Read-TextArg); external_ref = $Ref }
    if ($Date) { $body.occurred_at = $Date }
    if ($Url) { $body.source_url = $Url }
    if ($Reason) { $body.reason = $Reason }
    if (-not $Direct) { $body.review = "proposed" }
    $e = Invoke-Api POST "/dossiers/$($dossier.id)/entries" $body
    if ($e.created -eq $false) { Write-Host "[--] '$($e.title)' zat al in het dossier ($(if ($e.review) { $e.review } else { 'added' }))" }
    elseif ($Direct) { Write-Host "[OK] Mail '$($e.title)' toegevoegd" }
    else { Write-Host "[OK] Mail '$($e.title)' voorgesteld; Bart beoordeelt hem op de dossierpagina" }
    exit 0
}

Write-Host "Gebruik: .\Dossier.ps1 -Setup | -List | -Inbox | -Outbox | -AddOutbox | -AddPage | -Create | -Get | -AddNote | -Upload | -SetSummary | -SetCriteria | -MailRef | -CheckRefs | -AddMail  (zie kop van dit bestand)"
