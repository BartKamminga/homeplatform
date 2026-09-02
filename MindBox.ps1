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
#   .\MindBox.ps1 -UploadAttachment -ParentId <mail_item_id> -FilePath <lokaal_pad> [-Force]
#   .\MindBox.ps1 -ListContacts [-Email <email>]                       # toon contacten (optioneel filteren op e-mail)
#   .\MindBox.ps1 -Contact -Id <item_id> -Email <email> [-Name "..."]  # item koppelen aan contact (find-or-create op e-mail)
#   .\MindBox.ps1 -ContactNote -Email <email> -Text "..."              # profiel-notitie op een contact bijwerken (find-or-create)
#   .\MindBox.ps1 -Respond -CaseId <id> -Ids "<item_id>,<item_id2>" -Content "..." [-ParentId <response_id>]
#   .\MindBox.ps1 -AddEvent -CaseId <id> -Text "..." [-EventType session_note]
#   .\MindBox.ps1 -SaveSession -Name "<case naam>" -Text "..."         # sessie-samenvatting opslaan (maakt case aan indien nodig)
#   .\MindBox.ps1 -LoadSession -Name "<case naam>"                     # case + bestanden/responses/sessie-notities terugzien
#
# -Env kiest de omgeving (prod/acc/local) - elke omgeving heeft een EIGEN
# database, dus item/case-ID's van acc bestaan niet op prod en andersom. De
# website plakt de omgeving daarom mee in de kopieerbare commando's, volgens
# de VASTE notatie (Bart, item 1051): env.MindBox.Entity.Cmd(#id, params) -
# Object.Actie-volgorde (Case.Run, File.Enhance - niet andersom), en zonder
# Entity-segment voor commando's die globaal werken (Run(all)). Case.Save/
# Case.Load zijn de UITZONDERING op "#id" - die nemen een NAAM (de case
# wordt bij Save aangemaakt als 'ie nog niet bestaat, bij Load opgezocht).
# Vertaling naar een aanroep hier:
#   {Env}.MindBox.Run(all)                    ->  -Run -All -Env {env}
#   {Env}.MindBox.Case.Run(#case_id)          ->  -Run -All -CaseId <case_id> -Env {env}
#   {Env}.MindBox.File.Enhance(#item_id)      ->  bestand+briefing bekijken (-Run -Id <item_id> -Env {env}),
#                                                  dan notities aanvullen (-Note -Id <item_id> -Text "..." -Env {env})
#   {Env}.MindBox.File.ParseToTekst(#item_id) ->  bestand bekijken (-Run -Id <item_id> -Env {env}), inhoud
#                                                  extraheren, dan opslaan (-ParsedText -Id <item_id> -Text "..." -Env {env})
#   {Env}.MindBox.File.ExtractAttachments(#item_id) -> bestand downloaden (-Run -Id <item_id> -Env {env}), bijlagen
#                                                  extraheren (bv. Python extract-msg voor .msg), dan elke bijlage
#                                                  uploaden (-UploadAttachment -ParentId <item_id> -FilePath <pad> -Env {env})
#   {Env}.MindBox.Case.Save(naam)             ->  huidige sessie samenvatten, dan -SaveSession -Name "naam" -Text "<samenvatting>" -Env {env}
#   {Env}.MindBox.Case.Load(naam)             ->  -LoadSession -Name "naam" -Env {env}, output lezen en daarmee verdergaan
#   {Env}.MindBox.Case.ScanContacts(#case_id) ->  alle bestanden in de case downloaden (-Run -All -CaseId <case_id> -Env {env}),
#                                                  sender/to/cc extraheren (bv. Python extract-msg), gevonden e-mailadressen
#                                                  BINNEN DE SESSIE matchen/bevestigen (niet blind koppelen), dan per bestand
#                                                  koppelen (-Contact -Id <item_id> -Email <email> -Name "..." -Env {env})

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
    [switch]$SaveSession,
    [switch]$LoadSession,
    [switch]$UploadAttachment,
    [switch]$ListContacts,
    [switch]$Contact,
    [switch]$ContactNote,

    [switch]$All,
    [switch]$Force,
    [ValidateSet("prod", "acc", "local")]
    [string]$Env       = "prod",
    [string]$Id        = "",
    [string]$Ids       = "",
    [string]$CaseId    = "",
    [string]$ParentId  = "",
    [string]$Value     = "",
    [string]$Text      = "",
    [string]$Content   = "",
    [string]$Name      = "",
    [string]$Email     = "",
    [string]$FilePath  = "",
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
- **Geupload**: $($item.created_at)
- **Case**: $(if ($caseName) { $caseName } else { "(geen)" })
- **Context/persona**: $(if ($contextName) { $contextName } else { "(geen)" })

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
    $item = ApiPost "/mindbox/items/$Id/contact" $body
    Write-Host "[OK] $($item.original_filename): gekoppeld aan contact $Email"
    exit 0
}

if ($ContactNote) {
    if (-not $Email -or -not $Text) { Write-Host "Geef -Email en -Text op"; exit 1 }
    $existing = ApiGet "/mindbox/contacts?email=$([uri]::EscapeDataString($Email))"
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
    # eigenaardigheid, empirisch bevestigd 2026-09-02 - zie ook de
    # [string[]]-castfix bij -Respond, een vergelijkbare array-valkuil).
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
    if ($items.Count) { Write-Host "`nBriefing.md per bestand staat in $WorkDir\<item_id>\" }
    exit 0
}

Write-Host "Gebruik: .\MindBox.ps1 -Setup | -List | -ListCases | -ListContexts | -Get | -Run | -Status | -Note | -ParsedText | -UploadAttachment | -Respond | -AddEvent | -SaveSession | -LoadSession"
