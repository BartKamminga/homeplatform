# MindBox.ps1 — HomePlatform Mindbox CLI (API-gebaseerd)
#
# GEBRUIK:
#   .\MindBox.ps1 -Setup [-Env prod|acc|local]                        # eenmalig per omgeving: config aanmaken
#   .\MindBox.ps1 -List [-Env acc]                                    # toon eigen items (default env: prod)
#   .\MindBox.ps1 -List -CaseId <id>                                  # items binnen 1 case
#   .\MindBox.ps1 -ListCases                                          # toon cases
#   .\MindBox.ps1 -ListContexts                                       # toon contexts
#   .\MindBox.ps1 -Get -Id <item_id>                                  # 1 item in detail
#   .\MindBox.ps1 -Run -Id <item_id>                                  # download bestand + briefing-.md in mindbox_work/
#   .\MindBox.ps1 -Run -All                                           # hetzelfde voor alle nog niet-afgeronde items
#   .\MindBox.ps1 -Run -All -CaseId <id>                              # hetzelfde, beperkt tot 1 case
#   .\MindBox.ps1 -Status -Id <item_id> -Value done                   # status bijwerken
#   .\MindBox.ps1 -Note -Id <item_id> -Text "..."                     # notities bijwerken (Bart's EIGEN aantekening)
#   .\MindBox.ps1 -ParsedText -Id <item_id> -Text "..."               # geextraheerde platte tekst van het bestand opslaan
#   .\MindBox.ps1 -Respond -CaseId <id> -Ids "<item_id>,<item_id2>" -Content "..." [-ParentId <response_id>]
#   .\MindBox.ps1 -AddEvent -CaseId <id> -Text "..." [-EventType session_note]
#
# -Env kiest de omgeving (prod/acc/local) - elke omgeving heeft een EIGEN
# database, dus item/case-ID's van acc bestaan niet op prod en andersom. De
# website plakt de omgeving daarom mee in de kopieerbare commando's, volgens
# de VASTE notatie (Bart, item 1051): env.MindBox.Entity.Cmd(#id, params) -
# Object.Actie-volgorde (Case.Run, File.Enhance - niet andersom), en zonder
# Entity-segment voor commando's die globaal werken (Run(all)). Vertaling
# naar een aanroep hier:
#   {Env}.MindBox.Run(all)                    ->  -Run -All -Env {env}
#   {Env}.MindBox.Case.Run(#case_id)          ->  -Run -All -CaseId <case_id> -Env {env}
#   {Env}.MindBox.File.Enhance(#item_id)      ->  bestand+briefing bekijken (-Run -Id <item_id> -Env {env}),
#                                                  dan notities aanvullen (-Note -Id <item_id> -Text "..." -Env {env})
#   {Env}.MindBox.File.ParseToTekst(#item_id) ->  bestand bekijken (-Run -Id <item_id> -Env {env}), inhoud
#                                                  extraheren, dan opslaan (-ParsedText -Id <item_id> -Text "..." -Env {env})

param(
    [switch]$Setup,
    [switch]$List,
    [switch]$ListCases,
    [switch]$ListContexts,
    [switch]$Get,
    [switch]$Run,
    [switch]$Status,
    [switch]$Note,
    [switch]$ParsedText,
    [switch]$Respond,
    [switch]$AddEvent,

    [switch]$All,
    [ValidateSet("prod", "acc", "local")]
    [string]$Env       = "prod",
    [string]$Id        = "",
    [string]$Ids       = "",
    [string]$CaseId    = "",
    [string]$ParentId  = "",
    [string]$Value     = "",
    [string]$Text      = "",
    [string]$Content   = "",
    [string]$EventType = "session_note"
)

# ---------------------------------------------------------------------------
# Config laden - PER OMGEVING een eigen configbestand (prod/acc/local hebben
# elk hun eigen database, dus ook hun eigen API-key en base-URL), zelfde
# API-key-achtige auth als roadmap.ps1 (elk "hp_"-token werkt op ELK
# get_current_user-endpoint).
# ---------------------------------------------------------------------------
$ConfigFile = Join-Path $PSScriptRoot ".mindbox.config.$Env.ps1"
$WorkDir    = Join-Path $PSScriptRoot "mindbox_work"

$DefaultApiBase = @{
    prod  = "http://192.168.30.232:8080/api"
    acc   = "http://192.168.30.232:8081/api"
    local = "http://localhost:8000/api"
}[$Env]

if (-not $Setup) {
    if (-not (Test-Path $ConfigFile)) {
        Write-Host "[FOUT] Geen config voor omgeving '$Env'. Voer eerst: .\MindBox.ps1 -Setup -Env $Env"
        exit 1
    }
    . $ConfigFile
    if (-not $HP_API_BASE -or -not $HP_API_KEY) {
        Write-Host "[FOUT] Config onvolledig. Voer .\MindBox.ps1 -Setup -Env $Env opnieuw uit."
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

function ApiDownload([string]$Path, [string]$OutFile) {
    try {
        Invoke-WebRequest -Uri "$HP_API_BASE$Path" `
            -Headers @{ Authorization = "Bearer $HP_API_KEY" } `
            -OutFile $OutFile -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] Download $Path - $($_.Exception.Message)"
        exit 1
    }
}

# ---------------------------------------------------------------------------
# Setup — eenmalig API key aanmaken en opslaan (identiek aan roadmap.ps1)
# ---------------------------------------------------------------------------
if ($Setup) {
    Write-Host "Omgeving: $Env"
    $apiBase = Read-Host "API base URL [$DefaultApiBase]"
    if (-not $apiBase) { $apiBase = $DefaultApiBase }

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
            -Body '{"name":"mindbox-cli"}' -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] API key aanmaken mislukt: $($_.Exception.Message)"; exit 1
    }

    $config = @"
# HomePlatform Mindbox CLI config ($Env) — gegenereerd door .\MindBox.ps1 -Setup -Env $Env
`$HP_API_BASE = "$apiBase"
`$HP_API_KEY  = "$($key.key)"
"@
    Set-Content -Path $ConfigFile -Value $config -Encoding utf8
    Write-Host "[OK] Config opgeslagen in .mindbox.config.$Env.ps1"
    Write-Host "     API key: $($key.key.Substring(0, [Math]::Min(16, $key.key.Length)))..."
    exit 0
}

# ---------------------------------------------------------------------------
# List / ListCases / ListContexts
# ---------------------------------------------------------------------------
if ($List) {
    $path = "/mindbox/items"
    if ($CaseId) { $path += "?case_id=$CaseId" }
    $items = ApiGet $path
    Write-Host ("{0,-38} {1,-30} {2,-12} {3}" -f "ID","BESTAND","STATUS","CASE")
    Write-Host ("-" * 100)
    foreach ($i in $items) {
        $case = if ($i.case_id) { $i.case_id.Substring(0,8) } else { "-" }
        Write-Host ("{0,-38} {1,-30} {2,-12} {3}" -f $i.id, $i.original_filename, $i.status, $case)
    }
    exit 0
}

if ($ListCases) {
    # Context zit op de case (item 1051) - meteen tonen welke case welke
    # context gebruikt.
    $cases = ApiGet "/mindbox/cases"
    Write-Host ("{0,-38} {1,-30} {2,-10} {3}" -f "ID","NAAM","CONTEXT","BIJGEWERKT")
    Write-Host ("-" * 100)
    foreach ($c in $cases) {
        $ctx = if ($c.context_id) { $c.context_id.Substring(0,8) } else { "-" }
        Write-Host ("{0,-38} {1,-30} {2,-10} {3}" -f $c.id, $c.name, $ctx, $c.updated_at)
    }
    exit 0
}

if ($ListContexts) {
    $contexts = ApiGet "/mindbox/contexts"
    Write-Host ("{0,-38} {1}" -f "ID","NAAM")
    Write-Host ("-" * 60)
    foreach ($c in $contexts) {
        Write-Host ("{0,-38} {1}" -f $c.id, $c.name)
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Get — 1 item in detail
# ---------------------------------------------------------------------------
if ($Get) {
    if (-not $Id) { Write-Host "Geef -Id op"; exit 1 }
    $items = ApiGet "/mindbox/items"
    $item = $items | Where-Object { $_.id -eq $Id }
    if (-not $item) { Write-Host "[FOUT] Item $Id niet gevonden"; exit 1 }
    $item | Format-List
    exit 0
}

# ---------------------------------------------------------------------------
# Run — download bestand(en) + briefing-.md, klaar voor een Claude Code-sessie
# ---------------------------------------------------------------------------
function RunItem([object]$item) {
    $itemDir = Join-Path $WorkDir $item.id
    New-Item -ItemType Directory -Force -Path $itemDir | Out-Null

    $localFile = Join-Path $itemDir $item.original_filename
    ApiDownload "/mindbox/items/$($item.id)/download" $localFile

    # Context zit sinds item 1051 op de CASE, niet meer op het item apart
    # ("ik wil toch per case een context, niet per bestand.. dat is
    # ingewikkeld") - dus eerst de case ophalen, en daaruit de context.
    $caseName = ""
    $contextContent = ""
    $contextName = ""
    if ($item.case_id) {
        try {
            $cases = ApiGet "/mindbox/cases"
            $c = $cases | Where-Object { $_.id -eq $item.case_id }
            if ($c) {
                $caseName = $c.name
                if ($c.context_id) {
                    $contexts = ApiGet "/mindbox/contexts"
                    $ctx = $contexts | Where-Object { $_.id -eq $c.context_id }
                    if ($ctx) { $contextName = $ctx.name; $contextContent = $ctx.content }
                }
            }
        } catch {}
    }

    $md = @"
# Mindbox item: $($item.original_filename)

- **Item ID**: $($item.id)
- **Status**: $($item.status)
- **Geüpload**: $($item.created_at)
- **Case**: $(if ($caseName) { $caseName } else { "(geen)" })
- **Context/persona**: $(if ($contextName) { $contextName } else { "(geen)" })

## Extra info (Bart)

$(if ($item.notes) { $item.notes } else { "(geen aantekeningen)" })

## Context-instructie

$(if ($contextContent) { $contextContent } else { "(geen context gekoppeld)" })

## Bestand

Gedownload naar: ``$localFile``

## Na afloop van de sessie

- Status bijwerken: ``.\MindBox.ps1 -Status -Id $($item.id) -Value done -Env $Env``
$(if ($item.case_id) {
"- Concept-antwoord posten: ``.\MindBox.ps1 -Respond -CaseId $($item.case_id) -Ids ""$($item.id)"" -Content ""..."" -Env $Env``
- Sessie-notitie op de case: ``.\MindBox.ps1 -AddEvent -CaseId $($item.case_id) -Text ""..."" -Env $Env``"
} else {
"- Responses horen altijd bij een case - koppel dit item eerst aan een case om een response te kunnen posten."
})
"@
    $mdPath = Join-Path $itemDir "briefing.md"
    Set-Content -Path $mdPath -Value $md -Encoding utf8
    Write-Host "[OK] Klaargezet: $mdPath"
}

if ($Run) {
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
    if ($All) {
        $path = "/mindbox/items"
        if ($CaseId) { $path += "?case_id=$CaseId" }
        $items = ApiGet $path | Where-Object { $_.status -ne "done" }
        if (-not $items) { Write-Host "Niets te doen - geen openstaande items."; exit 0 }
        foreach ($i in $items) { RunItem $i }
        Write-Host "[OK] $($items.Count) item(s) klaargezet in $WorkDir"
    } elseif ($Id) {
        $items = ApiGet "/mindbox/items"
        $item = $items | Where-Object { $_.id -eq $Id }
        if (-not $item) { Write-Host "[FOUT] Item $Id niet gevonden"; exit 1 }
        RunItem $item
    } else {
        Write-Host "Geef -Id <item_id> of -All [-CaseId <id>] op"; exit 1
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Status / Note
# ---------------------------------------------------------------------------
if ($Status) {
    if (-not $Id -or -not $Value) { Write-Host "Geef -Id en -Value op (new|in_progress|done)"; exit 1 }
    $item = ApiPatch "/mindbox/items/$Id" @{ status = $Value }
    Write-Host "[OK] $($item.original_filename): status -> $($item.status)"
    exit 0
}

if ($Note) {
    if (-not $Id -or -not $Text) { Write-Host "Geef -Id en -Text op"; exit 1 }
    $item = ApiPatch "/mindbox/items/$Id" @{ notes = $Text }
    Write-Host "[OK] $($item.original_filename): notities bijgewerkt"
    exit 0
}

# item 1051 (Bart): "als de parsing van een .msg is gedaan, dan wil ik dat
# kunnen inzien 'onder' het bestand" - geextraheerde platte tekst van het
# bestand zelf, apart van -Note (dat is Barts EIGEN aantekening).
if ($ParsedText) {
    if (-not $Id -or -not $Text) { Write-Host "Geef -Id en -Text op"; exit 1 }
    $item = ApiPatch "/mindbox/items/$Id" @{ parsed_text = $Text }
    Write-Host "[OK] $($item.original_filename): geparste tekst opgeslagen"
    exit 0
}

# ---------------------------------------------------------------------------
# Respond — concept-antwoord/rapport posten, met bronvermelding
# ---------------------------------------------------------------------------
if ($Respond) {
    if (-not $CaseId -or -not $Content) { Write-Host "Geef -CaseId en -Content op (responses horen altijd bij een case)"; exit 1 }
    $sourceIds = @()
    if ($Ids) { $sourceIds = $Ids -split "," | ForEach-Object { $_.Trim() } }
    # [string[]]-cast is nodig: ConvertTo-Json zet een array met precies 1
    # element anders om naar een kale JSON-string i.p.v. een array, wat de
    # backend afwijst (422, list[str] verwacht een array).
    $body = @{ content = $Content; source_item_ids = [string[]]$sourceIds }
    if ($ParentId) { $body.parent_response_id = $ParentId }
    $response = ApiPost "/mindbox/cases/$CaseId/responses" $body
    Write-Host "[OK] Response aangemaakt: $($response.id)"
    exit 0
}

# ---------------------------------------------------------------------------
# AddEvent — vrije aantekening op een case-tijdlijn (bv. sessie-samenvatting)
# ---------------------------------------------------------------------------
if ($AddEvent) {
    if (-not $CaseId -or -not $Text) { Write-Host "Geef -CaseId en -Text op"; exit 1 }
    $event = ApiPost "/mindbox/cases/$CaseId/events" @{ event_type = $EventType; description = $Text }
    Write-Host "[OK] Case-event toegevoegd: $($event.event_type)"
    exit 0
}

Write-Host "Gebruik: .\MindBox.ps1 -Setup | -List | -ListCases | -ListContexts | -Get | -Run | -Status | -Note | -Respond | -AddEvent"
