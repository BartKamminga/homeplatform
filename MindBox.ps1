# MindBox.ps1 — HomePlatform Mindbox CLI (API-gebaseerd)
#
# GEBRUIK:
#   .\MindBox.ps1 -Setup [-Env prod|acc|local]                        # eenmalig per omgeving: config aanmaken
#   .\MindBox.ps1 -List [-Env acc]                                    # toon eigen items (default env: prod)
#   .\MindBox.ps1 -List -CaseId <id>                                  # items binnen 1 case
#   .\MindBox.ps1 -ListCases                                          # toon cases
#   .\MindBox.ps1 -ListContexts                                       # toon contexts
#   .\MindBox.ps1 -ListKnowledge                                      # toon kennis-items
#   .\MindBox.ps1 -UpdateKnowledge -Name "<naam>" -Text "..."          # kennis-item bijwerken (find-or-create op naam)
#   .\MindBox.ps1 -Get -Id <item_id>                                  # 1 item in detail
#   .\MindBox.ps1 -Run -Id <item_id>                                  # download bestand + briefing-.md in mindbox_work/
#   .\MindBox.ps1 -Run -All                                           # hetzelfde voor alle nog niet-afgeronde items
#   .\MindBox.ps1 -Run -All -CaseId <id>                              # hetzelfde, beperkt tot 1 case
#   .\MindBox.ps1 -Status -Id <item_id> -Value done                   # status bijwerken
#   .\MindBox.ps1 -Note -Id <item_id> -Text "..."                     # notities bijwerken (Bart's EIGEN aantekening)
#   .\MindBox.ps1 -ParsedText -Id <item_id> -Text "..."               # geextraheerde platte tekst van het bestand opslaan
#   .\MindBox.ps1 -UploadAttachment -ParentId <mail_item_id> -FilePath <lokaal_pad> [-Force]
#   .\MindBox.ps1 -Upload -CaseId <case_id> -FilePath <lokaal_pad> [-TargetId <item_id> -LinkType <type>] [-Force]
#                                                                       # bestand rechtstreeks in een case (geen bijlage),
#                                                                       # optioneel meteen een relatie leggen naar een ander bestand
#   .\MindBox.ps1 -ListContacts [-Email <email>]                       # toon contacten (optioneel filteren op e-mail)
#   .\MindBox.ps1 -Contact -Id <item_id> -Email <email> [-Name "..."]  # contact TOEVOEGEN aan item (many-to-many, find-or-create op e-mail)
#   .\MindBox.ps1 -UnlinkContact -Id <item_id> -ContactId <contact_id> # contact loskoppelen van item
#   .\MindBox.ps1 -ContactNote -Email <email> -Text "..."              # profiel-notitie op een contact bijwerken (find-or-create)
#   .\MindBox.ps1 -CreateCase -Name "<naam>" [-ContextId <id>]         # nieuwe case aanmaken
#   .\MindBox.ps1 -LinkCase -Id <item_id> -CaseId <case_id>            # bestand aan een case koppelen (many-to-many)
#   .\MindBox.ps1 -UnlinkCase -Id <item_id> -CaseId <case_id>          # bestand loskoppelen van een case
#   .\MindBox.ps1 -LinkItem -Id <item_id> -TargetId <id> -LinkType <type>   # relatie leggen tussen 2 bestanden (vrij link-type)
#   .\MindBox.ps1 -UnlinkItem -LinkId <link_id>                        # relatie tussen 2 bestanden verwijderen
#   .\MindBox.ps1 -AddEvent -CaseId <id> -Text "..." [-EventType session_note]
#   .\MindBox.ps1 -SaveSession -Name "<case naam>" -Text "..."         # sessie-samenvatting opslaan (maakt case aan indien nodig)
#   .\MindBox.ps1 -LoadSession -Name "<case naam>"                     # case + bestanden/responses/sessie-notities/case-export terugzien
#   .\MindBox.ps1 -Explain -Command "<notatie>" [-Env prod|acc|local]  # toon de recipe voor een commando uit de catalogus
#   .\MindBox.ps1 -DefineCommand -FilePath <commando.json>             # nieuw commando aan de catalogus toevoegen
#
# -Env kiest de omgeving (prod/acc/local) - elke omgeving heeft een EIGEN
# database, dus item/case-ID's van acc bestaan niet op prod en andersom.
#
# Item 1053 (Bart): "MindBox.ps1 moet dun blijven, commando's horen in de
# backend" - de VASTE notatie env.MindBox.Entity.Cmd(#id, params) (Object.
# Actie-volgorde, bv. Case.Run/File.Enhance, geen Entity-segment voor
# globale commando's zoals Run(all)) wordt NIET meer hier gedocumenteerd -
# de commando-catalogus leeft in de database, beheerd via de website (tab
# "Commando's") of rechtstreeks via /api/mindbox/commands. Gebruik
# `.\MindBox.ps1 -Explain -Command "<notatie>" -Env <env>` om de recipe
# (welke elementaire aanroepen hieronder, in welke volgorde, en welke
# stappen handmatig/LLM-oordeel vereisen) op te vragen. Dit bestand
# beschrijft alleen de ELEMENTAIRE acties (-List, -Run, -Status, -Note,
# ...) - die groeien niet meer mee met elk nieuw commando.

param(
    [switch]$Setup,
    [switch]$List,
    [switch]$ListCases,
    [switch]$ListContexts,
    [switch]$ListKnowledge,
    [switch]$UpdateKnowledge,
    [switch]$Get,
    [switch]$Run,
    [switch]$Status,
    [switch]$Note,
    [switch]$ParsedText,
    [switch]$AddEvent,
    [switch]$SaveSession,
    [switch]$LoadSession,
    [switch]$UploadAttachment,
    [switch]$Upload,
    [switch]$ListContacts,
    [switch]$Contact,
    [switch]$UnlinkContact,
    [switch]$ContactNote,
    [switch]$CreateCase,
    [switch]$LinkCase,
    [switch]$UnlinkCase,
    [switch]$LinkItem,
    [switch]$UnlinkItem,
    [switch]$Explain,
    [switch]$DefineCommand,

    [switch]$All,
    [switch]$Force,
    [ValidateSet("prod", "acc", "local")]
    [string]$Env        = "prod",
    [string]$Id         = "",
    [string]$Ids        = "",
    [string]$CaseId     = "",
    [string]$ParentId   = "",
    [string]$ContactId  = "",
    [string]$ContextId  = "",
    [string]$TargetId   = "",
    [string]$LinkType   = "",
    [string]$LinkId     = "",
    [string]$Value      = "",
    [string]$Text       = "",
    [string]$Content    = "",
    [string]$Command    = "",
    [string]$Name       = "",
    [string]$Email      = "",
    [string]$FilePath   = "",
    [string]$EventType  = "session_note"
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

# Item 1063 (Bart): "case dirname een naam geven die meer op de naam van de
# case lijkt" - zelfde conventie als backend/services/mindbox.py's _slugify.
function Slugify([string]$Text) {
    $slug = ([regex]::Replace($Text.ToLower(), "[^a-z0-9]+", "-")).Trim("-")
    if ($slug) { $slug } else { "case" }
}

# PowerShell 5.1 heeft geen -Form (dat kwam pas in PS7) - multipart/form-data
# hier zelf opbouwen. De ISO-8859-1-heenenweer-truc is nodig om willekeurige
# binaire bestandsinhoud (niet alleen tekst) veilig als .NET-string te
# kunnen versturen (1-op-1 byte<->char-mapping, geen dataverlies).
function ApiUploadFile([string]$Path, [string]$FilePath, [hashtable]$QueryParams) {
    if (-not (Test-Path $FilePath)) { Write-Host "[FOUT] Bestand niet gevonden: $FilePath"; exit 1 }
    $fileName = Split-Path $FilePath -Leaf
    $fileBytes = [System.IO.File]::ReadAllBytes($FilePath)
    $latin1 = [System.Text.Encoding]::GetEncoding("ISO-8859-1")
    $fileContent = $latin1.GetString($fileBytes)

    $boundary = [System.Guid]::NewGuid().ToString()
    $body = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: application/octet-stream",
        "",
        $fileContent,
        "--$boundary--",
        ""
    ) -join "`r`n"

    $query = ""
    if ($QueryParams -and $QueryParams.Count) {
        $pairs = $QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$([Uri]::EscapeDataString($_.Value))" }
        $query = "?" + ($pairs -join "&")
    }

    try {
        return Invoke-RestMethod -Uri "$HP_API_BASE$Path$query" -Method POST `
            -Headers @{ Authorization = "Bearer $HP_API_KEY" } `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $body -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] Upload $Path - $($_.Exception.Message)"
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
        $case = if ($i.case_ids -and $i.case_ids.Count -gt 0) { ($i.case_ids | ForEach-Object { $_.Substring(0,8) }) -join "," } else { "-" }
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

# Generieke, cross-case kennis-/reference-info (bv. "NIPV-Info", "Hoe sla ik
# plaatjes op") - los van Context (persona/instructie) en Contact (persoon).
if ($ListKnowledge) {
    $knowledge = ApiGet "/mindbox/knowledge"
    Write-Host ("{0,-38} {1}" -f "ID","NAAM")
    Write-Host ("-" * 60)
    foreach ($k in $knowledge) {
        Write-Host ("{0,-38} {1}" -f $k.id, $k.name)
    }
    exit 0
}

# Item 1057 (Bart): "Knowledge items kunnen updaten" - find-or-create op naam,
# zelfde patroon als -ContactNote hierboven, zodat een recipe een kennis-item
# kan bijwerken (of aanmaken) zonder eerst de ID te hoeven opzoeken.
if ($UpdateKnowledge) {
    if (-not $Name -or -not $Text) { Write-Host "Geef -Name en -Text op"; exit 1 }
    $existing = ApiGet "/mindbox/knowledge"
    $existing = @($existing | Where-Object { $_.name -eq $Name })
    if ($existing.Count -gt 0) {
        $entry = ApiPatch "/mindbox/knowledge/$($existing[0].id)" @{ content = $Text }
    } else {
        $entry = ApiPost "/mindbox/knowledge" @{ name = $Name; content = $Text }
    }
    Write-Host "[OK] Kennis-item '$($entry.name)': bijgewerkt"
    exit 0
}

# item 1052: Contact is los van Context (dat gaat over HOE Bart antwoordt) -
# dit gaat over WIE de andere partij is, herbruikbaar over cases heen.
if ($ListContacts) {
    $qs = if ($Email) { "?email=$([uri]::EscapeDataString($Email))" } else { "" }
    $contacts = ApiGet "/mindbox/contacts$qs"
    Write-Host ("{0,-38} {1,-30} {2}" -f "ID","EMAIL","NAAM")
    Write-Host ("-" * 90)
    foreach ($c in $contacts) {
        Write-Host ("{0,-38} {1,-30} {2}" -f $c.id, $c.email, $c.display_name)
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Explain — item 1053: het ENIGE generieke mechanisme dat een commando uit de
# database-catalogus herleidt naar elementaire aanroepen. Doet zelf precies
# 1 GET-call - alle commando-specifieke kennis leeft server-side, hier wordt
# niets van de notatie-syntax geparsed.
# ---------------------------------------------------------------------------
if ($Explain) {
    if (-not $Command) { Write-Host "Geef -Command '<env>.MindBox.Entity.Cmd(...)' op"; exit 1 }
    if ($Command -notmatch "^$Env\.") {
        Write-Host "[WAARSCHUWING] -Command noemt een andere omgeving dan -Env $Env"
    }
    $recipe = ApiGet "/mindbox/commands/resolve?notation=$([uri]::EscapeDataString($Command))"
    Write-Host "=== $($recipe.notation) ==="
    if ($recipe.command.description) { Write-Host $recipe.command.description }
    Write-Host ""
    $i = 1
    foreach ($step in $recipe.steps) {
        $marker = if ($step.kind -eq "manual") { "[HANDMATIG/LLM]" } else { "[CLI]" }
        Write-Host "$i. $marker $($step.instruction)"
        if ($step.cli_hint) { Write-Host "   .\MindBox.ps1 $($step.cli_hint)" }
        $i++
    }
    exit 0
}

# ---------------------------------------------------------------------------
# DefineCommand — item 1053: nieuw commando aan de catalogus toevoegen vanaf
# de terminal, zonder de website te openen. Leest een lokaal JSON-bestand
# (bestandspad i.p.v. inline JSON - geneste quotes in PS 5.1 zijn foutgevoelig,
# zelfde reden als -UploadAttachment -FilePath) en post de RUWE tekst 1-op-1
# door - ConvertFrom-Json -AsHashtable bestaat niet in PowerShell 5.1 (dat
# kwam pas in PS7), dus geen omweg via parsen+opnieuw serialiseren nodig.
# ---------------------------------------------------------------------------
if ($DefineCommand) {
    if (-not $FilePath -or -not (Test-Path $FilePath)) { Write-Host "Geef -FilePath naar een commando-JSON op"; exit 1 }
    # -Encoding UTF8 expliciet nodig - PS 5.1's Get-Content valt zonder BOM
    # terug op de systeem-codepage, wat emoji/diakritische tekens (icon,
    # instructie-teksten) in het JSON-bestand corrumpeert.
    $json = Get-Content $FilePath -Raw -Encoding UTF8
    try {
        $created = Invoke-RestMethod -Uri "$HP_API_BASE/mindbox/commands" -Method POST `
            -Headers @{ Authorization = "Bearer $HP_API_KEY"; "Content-Type" = "application/json" } `
            -Body $json -ErrorAction Stop
    } catch {
        Write-Host "[FOUT] POST /mindbox/commands - $($_.Exception.Message)"
        exit 1
    }
    Write-Host "[OK] Commando aangemaakt: $($created.notation_key)"
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

    # Item 1058 (vervolg, Bart): "wordt nu alle relevante info klaargezet?" -
    # case_ids/contact_ids/links waren hierboven alleen kale ID's (Format-
    # List dumpt het ruwe object) - hier naar leesbare namen resolven.
    if ($item.case_ids -and $item.case_ids.Count -gt 0) {
        $cases = ApiGet "/mindbox/cases"
        Write-Host "Case(s):"
        foreach ($cid in $item.case_ids) {
            $c = $cases | Where-Object { $_.id -eq $cid }
            Write-Host " - $(if ($c) { $c.name } else { $cid })"
        }
    }
    if ($item.contact_ids -and $item.contact_ids.Count -gt 0) {
        $contacts = ApiGet "/mindbox/contacts"
        Write-Host "Contacten:"
        foreach ($cid in $item.contact_ids) {
            $ct = $contacts | Where-Object { $_.id -eq $cid }
            Write-Host " - $(if ($ct) { $ct.email } else { $cid })"
        }
    }
    if ($item.links -and $item.links.Count -gt 0) {
        Write-Host "Relaties:"
        foreach ($l in $item.links) {
            $other = $items | Where-Object { $_.id -eq $l.item_id }
            $arrow = if ($l.direction -eq "out") { "->" } else { "<-" }
            Write-Host " - $arrow $(if ($other) { $other.original_filename } else { $l.item_id }) ($($l.link_type))"
        }
    }
    exit 0
}

# ---------------------------------------------------------------------------
# Run — download bestand(en) + briefing-.md, klaar voor een Claude Code-sessie
# ---------------------------------------------------------------------------
function RunItem([object]$item) {
    # Context zit sinds item 1051 op de CASE, niet meer op het item apart
    # ("ik wil toch per case een context, niet per bestand.. dat is
    # ingewikkeld") - dus eerst de case(s) ophalen, en daaruit de context.
    # Item 1058: een item kan aan 0+ cases hangen (case_ids i.p.v. case_id) -
    # de briefing toont ze allemaal; context/mapnaam komt van de EERSTE case
    # (in de praktijk hangt een item vrijwel altijd aan 0 of 1 case).
    $firstCaseId = if ($item.case_ids -and $item.case_ids.Count -gt 0) { $item.case_ids[0] } else { $null }
    $caseNames = @()
    $contextContent = ""
    $contextName = ""
    if ($item.case_ids -and $item.case_ids.Count -gt 0) {
        try {
            $cases = ApiGet "/mindbox/cases"
            foreach ($cid in $item.case_ids) {
                $c = $cases | Where-Object { $_.id -eq $cid }
                if ($c) {
                    $caseNames += $c.name
                    if (-not $contextName -and $c.context_id) {
                        $contexts = ApiGet "/mindbox/contexts"
                        $ctx = $contexts | Where-Object { $_.id -eq $c.context_id }
                        if ($ctx) { $contextName = $ctx.name; $contextContent = $ctx.content }
                    }
                }
            }
        } catch {}
    }
    $caseName = $caseNames -join ", "

    # Item 1058 (vervolg, Bart): "wordt nu alle relevante context meegenomen
    # in de briefing? ook de relaties en metadata?" - contacten en item-item
    # relaties stonden nog niet in de briefing, alleen case/context.
    $contactNames = @()
    if ($item.contact_ids -and $item.contact_ids.Count -gt 0) {
        try {
            $contacts = ApiGet "/mindbox/contacts"
            foreach ($cid in $item.contact_ids) {
                $ct = $contacts | Where-Object { $_.id -eq $cid }
                if ($ct) { $contactNames += (if ($ct.display_name) { "$($ct.display_name) <$($ct.email)>" } else { $ct.email }) }
            }
        } catch {}
    }

    $linkLines = @()
    if ($item.links -and $item.links.Count -gt 0) {
        try {
            $allItems = ApiGet "/mindbox/items"
            foreach ($l in $item.links) {
                $other = $allItems | Where-Object { $_.id -eq $l.item_id }
                $arrow = if ($l.direction -eq "out") { "->" } else { "<-" }
                $otherName = if ($other) { $other.original_filename } else { $l.item_id }
                $linkLines += "- $arrow $otherName ($($l.link_type))"
            }
        } catch {}
    }

    # Item 1063 (Bart): "case dirname een naam geven die meer op de naam van
    # de case lijkt" - mindbox_work/<case-naam>/<item-id>/ i.p.v. plat
    # mindbox_work/<item-id>/, zodat downloads van 1 case herkenbaar bij
    # elkaar staan (case-loze items blijven plat onder mindbox_work/).
    $caseDirName = if ($caseNames.Count -gt 0) { Slugify $caseNames[0] } else { $null }
    $itemDir = if ($caseDirName) { Join-Path (Join-Path $WorkDir $caseDirName) $item.id } else { Join-Path $WorkDir $item.id }
    New-Item -ItemType Directory -Force -Path $itemDir | Out-Null

    $localFile = Join-Path $itemDir $item.original_filename
    ApiDownload "/mindbox/items/$($item.id)/download" $localFile

    $md = @"
# Mindbox item: $($item.original_filename)

- **Item ID**: $($item.id)
- **Status**: $($item.status)
- **Geupload**: $($item.created_at)
- **Case**: $(if ($caseName) { $caseName } else { "(geen)" })
- **Context/persona**: $(if ($contextName) { $contextName } else { "(geen)" })

## Contacten

$(if ($contactNames.Count -gt 0) { ($contactNames | ForEach-Object { "- $_" }) -join "`n" } else { "(geen contacten gekoppeld)" })

## Relaties met andere bestanden

$(if ($linkLines.Count -gt 0) { $linkLines -join "`n" } else { "(geen relaties)" })

## Extra info (Bart)

$(if ($item.notes) { $item.notes } else { "(geen aantekeningen)" })

## Geparste tekst van het bestand

$(if ($item.parsed_text) { $item.parsed_text } else { "(nog niet geparst - zie File.ParseToTekst)" })

## Context-instructie

$(if ($contextContent) { $contextContent } else { "(geen context gekoppeld)" })

## Bestand

Gedownload naar: ``$localFile``

## Na afloop van de sessie

- Status bijwerken: ``.\MindBox.ps1 -Status -Id $($item.id) -Value done -Env $Env``
$(if ($firstCaseId) {
"- Concept-antwoord/plan/samenvatting posten: schrijf lokaal een .txt/.eml/... weg, dan
  ``.\MindBox.ps1 -Upload -CaseId $firstCaseId -FilePath <pad> -TargetId $($item.id) -LinkType response_to -Env $Env``
- Sessie-notitie op de case: ``.\MindBox.ps1 -AddEvent -CaseId $firstCaseId -Text ""..."" -Env $Env``"
} else {
"- Gegenereerde content posten kan zonder case, of koppel dit item eerst aan een case."
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
        # LET OP: @() moet op een APARTE regel na de Invoke-RestMethod-aanroep
        # staan - @(ApiGet ...) in 1 statement laat Invoke-RestMethod een
        # array van precies 2 elementen inklappen tot Count=1 (verrassende
        # PS 5.1-eigenaardigheid, empirisch bevestigd 2026-09-02).
        $items = ApiGet $path | Where-Object { $_.status -ne "done" }
        $items = @($items)
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
# Contact — item 1052: koppelen op e-mailadres (find-or-create), en losstaand
# een profiel-notitie bijwerken. Namen uit vrije tekst worden bewust NIET
# geparst/gematcht in v1 - alleen het e-mailadres uit de bron zelf.
# ---------------------------------------------------------------------------
if ($Contact) {
    if (-not $Id -or -not $Email) { Write-Host "Geef -Id (item) en -Email op"; exit 1 }
    $body = @{ email = $Email }
    if ($Name) { $body.display_name = $Name }
    # Item 1052 (Bart): "kan ik meerdere contacten aan een bestand koppelen?"
    # - dit VOEGT TOE (many-to-many, backend is idempotent), overschrijft
    # dus niet meer een eerder gekoppeld contact. Roep -Contact meerdere
    # keren aan (1x per deelnemer) om alle sender/to/cc te koppelen.
    $item = ApiPost "/mindbox/items/$Id/contact" $body
    Write-Host "[OK] $($item.original_filename): gekoppeld aan contact $Email"
    exit 0
}

if ($UnlinkContact) {
    if (-not $Id -or -not $ContactId) { Write-Host "Geef -Id (item) en -ContactId op"; exit 1 }
    $item = Invoke-RestMethod -Uri "$HP_API_BASE/mindbox/items/$Id/contact/$ContactId" -Method DELETE -Headers @{ Authorization = "Bearer $HP_API_KEY" }
    Write-Host "[OK] $($item.original_filename): contact losgekoppeld"
    exit 0
}

if ($ContactNote) {
    if (-not $Email -or -not $Text) { Write-Host "Geef -Email en -Text op"; exit 1 }
    # LET OP: @() nodig op een APARTE regel - zie de array-collapse-valkuil
    # gedocumenteerd bij -LoadSession hierboven, geldt hier net zo goed voor
    # een resultaat van precies 1 match.
    $existing = ApiGet "/mindbox/contacts?email=$([uri]::EscapeDataString($Email))"
    $existing = @($existing)
    if ($existing.Count -gt 0) {
        $contact = ApiPatch "/mindbox/contacts/$($existing[0].id)" @{ notes = $Text }
    } else {
        $contact = ApiPost "/mindbox/contacts" @{ email = $Email }
        $contact = ApiPatch "/mindbox/contacts/$($contact.id)" @{ notes = $Text }
    }
    Write-Host "[OK] Contact $($contact.email): notitie opgeslagen"
    exit 0
}

# ---------------------------------------------------------------------------
# CreateCase / LinkCase / UnlinkCase / LinkItem / UnlinkItem - item 1058
# (vervolg, Bart): "de link is toch gewoon een MindBoxItem met een
# relatielink naar de bron" - deze generieke koppel-acties bestonden al als
# API-endpoint (many-to-many item<->case sinds increment 1, item<->item
# sinds de relaties-graph), maar hadden nog geen MindBox.ps1-tegenhanger.
# Nodig om bv. een "verplaats naar case"-recipe (UnlinkCase + LinkCase) in
# de commando-catalogus te kunnen samenstellen.
# ---------------------------------------------------------------------------
if ($CreateCase) {
    if (-not $Name) { Write-Host "Geef -Name op"; exit 1 }
    $body = @{ name = $Name }
    if ($ContextId) { $body.context_id = $ContextId }
    $case = ApiPost "/mindbox/cases" $body
    Write-Host "[OK] Case aangemaakt: $($case.name) ($($case.id))"
    exit 0
}

if ($LinkCase) {
    if (-not $Id -or -not $CaseId) { Write-Host "Geef -Id (item) en -CaseId op"; exit 1 }
    $item = Invoke-RestMethod -Uri "$HP_API_BASE/mindbox/items/$Id/cases/$CaseId" -Method POST -Headers @{ Authorization = "Bearer $HP_API_KEY" }
    Write-Host "[OK] $($item.original_filename): gekoppeld aan case $CaseId"
    exit 0
}

if ($UnlinkCase) {
    if (-not $Id -or -not $CaseId) { Write-Host "Geef -Id (item) en -CaseId op"; exit 1 }
    $item = Invoke-RestMethod -Uri "$HP_API_BASE/mindbox/items/$Id/cases/$CaseId" -Method DELETE -Headers @{ Authorization = "Bearer $HP_API_KEY" }
    Write-Host "[OK] $($item.original_filename): losgekoppeld van case $CaseId"
    exit 0
}

if ($LinkItem) {
    if (-not $Id -or -not $TargetId -or -not $LinkType) { Write-Host "Geef -Id, -TargetId en -LinkType op"; exit 1 }
    $item = ApiPost "/mindbox/items/$Id/links" @{ target_item_id = $TargetId; link_type = $LinkType }
    Write-Host "[OK] $($item.original_filename): relatie '$LinkType' gelegd naar $TargetId"
    exit 0
}

if ($UnlinkItem) {
    if (-not $LinkId) { Write-Host "Geef -LinkId op"; exit 1 }
    $item = Invoke-RestMethod -Uri "$HP_API_BASE/mindbox/links/$LinkId" -Method DELETE -Headers @{ Authorization = "Bearer $HP_API_KEY" }
    Write-Host "[OK] $($item.original_filename): relatie verwijderd"
    exit 0
}

# ---------------------------------------------------------------------------
# UploadAttachment — bijlage van een mail als eigen item opslaan (item 1051:
# "hoe gaan we om met attachments in een mail?") - erft automatisch het
# case_id van het ouder-item (-ParentId), server-side geregeld.
# ---------------------------------------------------------------------------
if ($UploadAttachment) {
    if (-not $ParentId -or -not $FilePath) { Write-Host "Geef -ParentId (het mail-item) en -FilePath op"; exit 1 }
    $params = @{ parent_item_id = $ParentId }
    if ($Force) { $params.force = "true" }
    $item = ApiUploadFile "/mindbox/items" $FilePath $params
    Write-Host "[OK] Bijlage geupload: $($item.original_filename) ($($item.id))"
    exit 0
}

# ---------------------------------------------------------------------------
# Upload — item 1053 (Bart): bestand RECHTSTREEKS in een case zetten (geen
# bijlage van een bestaand item, zoals -UploadAttachment) - bouwsteen voor
# "case vullen vanaf schijf" (zie het Case.CreateFromDisk-commando).
# ---------------------------------------------------------------------------
if ($Upload) {
    if (-not $CaseId -or -not $FilePath) { Write-Host "Geef -CaseId en -FilePath op"; exit 1 }
    $params = @{ case_id = $CaseId }
    if ($Force) { $params.force = "true" }
    # Item 1058 (vervolg, Bart): "als er in de terminal (of externe agent)
    # een response is voorbereid, moet die kunnen worden geupload met de
    # juiste parameter (link/linkid/linktype)" - geldt voor ALLE gegenereerde
    # bestanden (plannen, samenvattingen, plaatjes, ...), niet alleen
    # concept-antwoorden. Beide of geen van beide meegeven.
    if ($TargetId -and $LinkType) {
        $params.link_target_item_id = $TargetId
        $params.link_type = $LinkType
    } elseif ($TargetId -or $LinkType) {
        Write-Host "Geef zowel -TargetId als -LinkType op (of geen van beide)"; exit 1
    }
    $item = ApiUploadFile "/mindbox/items" $FilePath $params
    Write-Host "[OK] Bestand geupload: $($item.original_filename) ($($item.id))"
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

# ---------------------------------------------------------------------------
# SaveSession / LoadSession — Bart: "ik wil een claude sessie kunnen
# opslaan in de mindbox... env.MindBox.Case.Save(name)/Load(name)" - een
# case wordt hier op NAAM opgezocht (i.p.v. #id, de enige uitzondering op
# de vaste commando-notatie), en bij Save aangemaakt als 'ie nog niet
# bestaat. De sessie-inhoud zelf is een session_note case-event (bestaat
# al) - hergebruikt hier puur via naam-lookup, geen backend-wijziging nodig.
# ---------------------------------------------------------------------------
function FindCaseByName([string]$CaseName) {
    $cases = ApiGet "/mindbox/cases"
    return $cases | Where-Object { $_.name -eq $CaseName } | Select-Object -First 1
}

if ($SaveSession) {
    if (-not $Name -or -not $Text) { Write-Host "Geef -Name en -Text op"; exit 1 }
    $case = FindCaseByName $Name
    if (-not $case) {
        Write-Host "Case '$Name' bestaat nog niet - wordt aangemaakt..."
        $case = ApiPost "/mindbox/cases" @{ name = $Name }
    }
    $event = ApiPost "/mindbox/cases/$($case.id)/events" @{ event_type = "session_note"; description = $Text }
    Write-Host "[OK] Sessie opgeslagen in case '$Name' ($($case.id))"
    exit 0
}

if ($LoadSession) {
    if (-not $Name) { Write-Host "Geef -Name op"; exit 1 }
    $case = FindCaseByName $Name
    if (-not $case) { Write-Host "[FOUT] Case '$Name' niet gevonden"; exit 1 }

    Write-Host "=== Case: $($case.name) ($($case.id)) ==="

    # Volledige context-inhoud tonen (niet alleen het ID) - Bart: "worden
    # alle relevante .md files mee gestuurd en/of contexts gekoppeld met de
    # juiste .md informatie?"
    if ($case.context_id) {
        try {
            $contexts = ApiGet "/mindbox/contexts"
            $ctx = $contexts | Where-Object { $_.id -eq $case.context_id }
            if ($ctx) {
                Write-Host "`n--- Context: $($ctx.name) ---"
                Write-Host $ctx.content
            }
        } catch {}
    }

    # LET OP: @() moet op een APARTE regel staan, NA de Invoke-RestMethod-
    # aanroep (via ApiGet) - @(ApiGet ...) in 1 statement laat een array van
    # precies 2 elementen inklappen tot Count=1 (verrassende PS 5.1-
    # eigenaardigheid, empirisch bevestigd 2026-09-02).
    $items = ApiGet "/mindbox/items?case_id=$($case.id)"
    $items = @($items)
    Write-Host "`n--- Bestanden ($($items.Count)) - bezig met downloaden + briefing.md per bestand ---"
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
    foreach ($i in $items) {
        Write-Host " - $($i.original_filename) [$($i.status)]"
        RunItem $i
    }

    $responses = ApiGet "/mindbox/cases/$($case.id)/responses"
    $responses = @($responses)
    Write-Host "`n--- Responses ($($responses.Count)) ---"
    foreach ($r in $responses) {
        $preview = $r.content.Substring(0, [Math]::Min(80, $r.content.Length))
        Write-Host " - [$($r.id)] $preview..."
    }

    $events = ApiGet "/mindbox/cases/$($case.id)/events"
    $events = @($events)
    $notes = $events | Where-Object { $_.event_type -eq "session_note" } | Sort-Object created_at
    $notes = @($notes)
    Write-Host "`n--- Sessie-notities ($($notes.Count)) ---"
    foreach ($n in $notes) {
        Write-Host "[$($n.created_at)]"
        Write-Host $n.description
        Write-Host ""
    }

    # Item 1058 (vervolg, Bart): "wordt nu alle relevante info klaargezet?" -
    # -LoadSession downloadde tot nu toe alleen de items (via RunItem) - het
    # case-brede export-bestand (contacten/relaties/tijdlijn samengevat, tot
    # nu toe alleen via de website-knop "Exporteren" te krijgen) hoort er ook
    # automatisch bij als je een sessie klaarzet.
    try {
        $exported = ApiPost "/mindbox/cases/$($case.id)/export" @{}
        $caseDir = Join-Path $WorkDir (Slugify $case.name)
        New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
        $exportFile = Join-Path $caseDir $exported.original_filename
        ApiDownload "/mindbox/items/$($exported.id)/download" $exportFile
        Write-Host "`n--- Case-export (context/contacten/tijdlijn/relaties) ---"
        Write-Host "Gedownload naar: $exportFile"
    } catch {}

    if ($items.Count) { Write-Host "`nBriefing.md per bestand staat in $WorkDir\$(Slugify $case.name)\<item_id>\" }
    exit 0
}

Write-Host "Gebruik: .\MindBox.ps1 -Setup | -List | -ListCases | -ListContexts | -ListKnowledge | -UpdateKnowledge | -Get | -Run | -Status | -Note | -ParsedText | -UploadAttachment | -Upload | -ListContacts | -Contact | -UnlinkContact | -ContactNote | -CreateCase | -LinkCase | -UnlinkCase | -LinkItem | -UnlinkItem | -AddEvent | -SaveSession | -LoadSession | -Explain | -DefineCommand"
