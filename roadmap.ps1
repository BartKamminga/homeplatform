# roadmap.ps1 — HomePlatform Roadmap CLI (API-gebaseerd)
#
# GEBRUIK:
#   .\roadmap.ps1 -Setup                                             # eenmalig: config aanmaken
#   .\roadmap.ps1 -List                                              # toon alle items
#   .\roadmap.ps1 -List -Status idea -Priority high                  # filter
#   .\roadmap.ps1 -List -Site tournix                                # filter op site
#   .\roadmap.ps1 -Add -Site tournix -Title "..." -Priority high     # nieuw item
#   .\roadmap.ps1 -Close -Id 8 -Version v3.40                        # afsluiten + changelog
#   .\roadmap.ps1 -Close -Ids "8,11,12" -Version v3.40              # batch sluiten
#   .\roadmap.ps1 -Update -Id 8 -Status in_progress                  # veld bijwerken
#   .\roadmap.ps1 -Get -Id 8                                         # volledig item tonen
#   .\roadmap.ps1 -History -Id 8                                     # wijzigingshistorie
#   .\roadmap.ps1 -Changelog                                         # recente changelog

param(
    [switch]$Setup,
    [switch]$List,
    [switch]$Add,
    [switch]$Close,
    [switch]$CloseMany,
    [switch]$Update,
    [switch]$Get,
    [switch]$History,
    [switch]$Changelog,

    [string]$Status      = "",
    [string]$Site        = "",
    [string]$Priority    = "",
    [string]$Title       = "",
    [string]$Notes       = "",
    [string]$Version     = "",
    [string]$Description = "",
    [string]$Impact      = "",
    [string]$Risk        = "",
    [string]$Scope       = "",
    [string]$Owner       = "",
    [int]   $Id          = 0,
    [string]$Ids         = ""
)

# ---------------------------------------------------------------------------
# Config laden
# ---------------------------------------------------------------------------
$ConfigFile = Join-Path $PSScriptRoot ".roadmap.config.ps1"

if (-not $Setup) {
    if (-not (Test-Path $ConfigFile)) {
        Write-Host "[FOUT] Geen config gevonden. Voer eerst: .\roadmap.ps1 -Setup"
        exit 1
    }
    . $ConfigFile
    if (-not $HP_API_BASE -or -not $HP_API_KEY) {
        Write-Host "[FOUT] Config onvolledig. Voer .\roadmap.ps1 -Setup opnieuw uit."
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function ApiGet([string]$Path) {
    try {
        return Invoke-RestMethod -Uri "$HP_API_BASE$Path" `
            -Headers @{ Authorization = "Bearer $HP_API_KEY" } `
            -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] GET $Path - $($_.Exception.Message)"
        exit 1
    }
}

function ApiPost([string]$Path, [hashtable]$Body) {
    try {
        return Invoke-RestMethod -Uri "$HP_API_BASE$Path" -Method POST `
            -Headers @{ Authorization = "Bearer $HP_API_KEY"; "Content-Type" = "application/json" } `
            -Body ($Body | ConvertTo-Json -Depth 5) `
            -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] POST $Path - $($_.Exception.Message)"
        exit 1
    }
}

function ApiPatch([string]$Path, [hashtable]$Body) {
    try {
        return Invoke-RestMethod -Uri "$HP_API_BASE$Path" -Method PATCH `
            -Headers @{ Authorization = "Bearer $HP_API_KEY"; "Content-Type" = "application/json" } `
            -Body ($Body | ConvertTo-Json -Depth 5) `
            -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] PATCH $Path - $($_.Exception.Message)"
        exit 1
    }
}

$STATUS_ORDER = @("in_progress","pick_up","analyzed","idea","ready","deploying","done","cancelled")
$PRIORITY_ORDER = @("high","medium","low")

function FormatList([object[]]$Items) {
    $sorted = $Items | Sort-Object {
        $si = $STATUS_ORDER.IndexOf($_.status); if ($si -lt 0) { 99 } else { $si }
    }, {
        $pi = $PRIORITY_ORDER.IndexOf($_.priority); if ($pi -lt 0) { 99 } else { $pi }
    }, { $_.id }

    Write-Host ("{0,-6} {1,-14} {2,-12} {3,-7} {4}" -f "ID","STATUS","SITE","PRIOR","TITEL")
    Write-Host ("-" * 72)
    foreach ($item in $sorted) {
        $ver  = if ($item.version) { " [$($item.version)]" } else { "" }
        $line = "{0,-6} {1,-14} {2,-12} {3,-7} {4}" -f $item.id, $item.status, $item.site, $item.priority, ($item.title + $ver)
        Write-Host $line
    }
}

function FormatItem([object]$item) {
    $pairs = [ordered]@{
        ID          = $item.id
        STATUS      = $item.status
        SITE        = $item.site
        PRIORITY    = $item.priority
        TITLE       = $item.title
        OWNER       = if ($item.owner) { $item.owner } else { "-" }
        DESCRIPTION = if ($item.description) { $item.description } else { "-" }
        NOTES       = if ($item.notes) { $item.notes } else { "-" }
        VERSION     = if ($item.version) { $item.version } else { "-" }
        IMPACT      = if ($item.impact) { $item.impact } else { "-" }
        RISK        = if ($item.risk) { $item.risk } else { "-" }
        SCOPE       = if ($item.scope) { $item.scope } else { "-" }
        CREATED_AT  = $item.created_at
        UPDATED_AT  = $item.updated_at
    }
    foreach ($k in $pairs.Keys) {
        Write-Host ("{0,-15}{1}" -f $k, $pairs[$k])
    }
}

# ---------------------------------------------------------------------------
# Setup — eenmalig API key aanmaken en opslaan
# ---------------------------------------------------------------------------
if ($Setup) {
    $apiBase = Read-Host "API base URL [http://192.168.30.232:8080/api]"
    if (-not $apiBase) { $apiBase = "http://192.168.30.232:8080/api" }

    $user = Read-Host "Gebruikersnaam"
    $pass = Read-Host "Wachtwoord" -AsSecureString
    $plainPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))

    Write-Host "Inloggen..."
    try {
        $form = "username=$([Uri]::EscapeDataString($user))&password=$([Uri]::EscapeDataString($plainPass))"
        $login = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST `
            -ContentType "application/x-www-form-urlencoded" -Body $form -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] Login mislukt: $($_.Exception.Message)"; exit 1
    }

    Write-Host "API key aanmaken..."
    try {
        $key = Invoke-RestMethod -Uri "$apiBase/auth/api-keys" -Method POST `
            -Headers @{ Authorization = "Bearer $($login.access_token)"; "Content-Type" = "application/json" } `
            -Body '{"name":"roadmap-cli"}' -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] API key aanmaken mislukt: $($_.Exception.Message)"; exit 1
    }

    $config = @"
# HomePlatform Roadmap CLI config — gegenereerd door .\roadmap.ps1 -Setup
`$HP_API_BASE = "$apiBase"
`$HP_API_KEY  = "$($key.key)"
"@
    Set-Content -Path $ConfigFile -Value $config -Encoding utf8
    Write-Host "[OK] Config opgeslagen in .roadmap.config.ps1"
    Write-Host "     API key: $($key.key.Substring(0, [Math]::Min(16, $key.key.Length)))..."
    exit 0
}

# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------
if ($List) {
    $qs = @()
    if ($Status)   { $qs += "status=$Status" }
    if ($Site)     { $qs += "site=$Site" }
    if ($Priority) { $qs += "priority=$Priority" }
    $qstr = if ($qs) { "?" + ($qs -join "&") } else { "" }
    $path = "/roadmap" + $qstr
    $items = ApiGet $path
    FormatList $items
    exit 0
}

# ---------------------------------------------------------------------------
# Changelog
# ---------------------------------------------------------------------------
if ($Changelog) {
    $entries = Invoke-RestMethod -Uri "$HP_API_BASE/changelog" -ErrorAction Stop
    Write-Host ("{0,-10} {1,-12} {2,-14} {3}" -f "VERSIE","DATUM","SITE","TITEL")
    Write-Host ("-" * 72)
    foreach ($e in ($entries | Select-Object -First 25)) {
        $datum = if ($e.released_at) { $e.released_at.ToString().Substring(0,10) } else { "-" }
        Write-Host ("{0,-10} {1,-12} {2,-14} {3}" -f $e.version, $datum, $e.site, $e.title)
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------
if ($Add) {
    if (-not $Title) { Write-Host "Geef -Title op"; exit 1 }
    if (-not $Site)  { Write-Host "Geef -Site op";  exit 1 }
    $body = @{ title = $Title; site = $Site }
    if ($Priority)    { $body.priority    = $Priority }
    if ($Description) { $body.description = $Description }
    if ($Notes)       { $body.notes       = $Notes }
    if ($Impact)      { $body.impact      = $Impact }
    if ($Risk)        { $body.risk        = $Risk }
    if ($Scope)       { $body.scope       = $Scope }
    if ($Owner)       { $body.owner       = $Owner }
    $item = ApiPost "/roadmap" $body
    Write-Host "[OK] Toegevoegd: $($item.title)"
    exit 0
}

# ---------------------------------------------------------------------------
# Close (enkel of batch via -Ids)
# ---------------------------------------------------------------------------
if ($Close -or $CloseMany) {
    if (-not $Version) { Write-Host "Geef -Version op"; exit 1 }
    $idList = @()
    if ($Ids) { $idList = $Ids -split "," | ForEach-Object { [int]$_.Trim() } }
    elseif ($Id -ne 0) { $idList = @($Id) }
    else { Write-Host "Geef -Id of -Ids op"; exit 1 }

    foreach ($closeId in $idList) {
        $item = ApiPatch "/roadmap/$closeId" @{ status = "done"; version = $Version }
        Write-Host "[OK] $($item.site) $($item.version) - $($item.title)"
    }

    # Versie + commit registreren voor deploy-status
    try {
        $commit = & git rev-parse HEAD 2>$null
        $short  = & git rev-parse --short HEAD 2>$null
        if ($commit) {
            $vbody = [PSCustomObject]@{ version = $Version; commit = $commit.Trim(); short = $short.Trim() } | ConvertTo-Json -Compress
            Invoke-RestMethod -Uri "$HP_API_BASE/admin/deploy-versions" -Method POST `
                -Headers @{ Authorization = "Bearer $HP_API_KEY"; "Content-Type" = "application/json" } `
                -Body $vbody -ErrorAction SilentlyContinue | Out-Null
            Write-Host "[OK] Versie $Version geregistreerd (commit $($short.Trim()))"
        }
    } catch {}
    exit 0
}

# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------
if ($Get) {
    if ($Id -eq 0) { Write-Host "Geef -Id op"; exit 1 }
    $item = ApiGet "/roadmap/$Id"
    FormatItem $item
    exit 0
}

# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------
if ($History) {
    if ($Id -eq 0) { Write-Host "Geef -Id op"; exit 1 }
    $records = ApiGet "/roadmap/$Id/history"
    if (-not $records -or $records.Count -eq 0) {
        Write-Host "(geen history)"
        exit 0
    }
    $hdr = "TIJDSTIP            USER         ACTIE      WIJZIGINGEN"
    Write-Host $hdr
    Write-Host ("-" * 72)
    foreach ($r in $records) {
        $ts = "-"
        if ($r.created_at) { $ts = $r.created_at.ToString().Substring(0,19) }
        $ch = ""
        if ($r.changes) {
            $parsed = $r.changes | ConvertFrom-Json
            $parts = @()
            foreach ($prop in $parsed.PSObject.Properties) {
                $parts += "$($prop.Name): $($prop.Value.from) -> $($prop.Value.to)"
            }
            $ch = $parts -join "; "
        }
        $line = ($ts.PadRight(20)) + ($r.username.PadRight(12)) + ($r.action.PadRight(10)) + $ch
        Write-Host $line
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
if ($Update) {
    if ($Id -eq 0) { Write-Host "Geef -Id op"; exit 1 }
    $body = @{}
    if ($Status)      { $body.status      = $Status }
    if ($Priority)    { $body.priority    = $Priority }
    if ($Title)       { $body.title       = $Title }
    if ($Notes)       { $body.notes       = $Notes }
    if ($Version)     { $body.version     = $Version }
    if ($Impact)      { $body.impact      = $Impact }
    if ($Risk)        { $body.risk        = $Risk }
    if ($Scope)       { $body.scope       = $Scope }
    if ($Owner)       { $body.owner       = $Owner }
    if ($Description) { $body.description = $Description }
    if ($body.Count -eq 0) { Write-Host "Geef minimaal een veld op om bij te werken"; exit 1 }
    $item = ApiPatch "/roadmap/$Id" $body
    Write-Host "[OK] Item $($item.id) bijgewerkt"
    exit 0
}

Write-Host "Gebruik: .\roadmap.ps1 -Setup | -List | -Add | -Close | -Update | -Get | -History | -Changelog"
