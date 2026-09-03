# MindBoxCompletion.ps1 — helpers voor de ArgumentCompleters in MindBox.ps1
# (autocomplete in VS Code/terminal, Bart: "een scan van case id/names").
#
# BEWUST een los bestand, dot-source vanuit elke completer-scriptblock: een
# [ArgumentCompleter]-attribute in MindBox.ps1's eigen param()-blok draait
# VOORDAT het script zelf uitvoert (PowerShell leest alleen het param()-blok
# om de completer op te halen), dus functies die verderop in MindBox.ps1
# zelf staan bestaan op dat moment nog niet - empirisch geverifieerd met
# TabExpansion2 tegen een losse testscript. Dit bestand wordt on-demand
# gedot-sourced (". $PSScriptRoot\MindBoxCompletion.ps1") vanuit elke
# completer, wat wel werkt omdat $PSScriptRoot al correct naar de map van
# MindBox.ps1 wijst zodra de completer draait.

function Get-MindboxApiData {
    param([string]$ScriptRoot, [string]$EnvName, [string]$Path)

    # 20s cache in $global: - blijft leven binnen dezelfde interactieve
    # sessie, zodat tab-completion niet bij elke toetsaanslag de API belt.
    $cacheKey = "__mindboxCache_" + ($Path -replace '[^A-Za-z]', '_') + "_$EnvName"
    $cached = Get-Variable -Name $cacheKey -Scope Global -ErrorAction SilentlyContinue
    if ($cached -and ((Get-Date) - $cached.Value.At).TotalSeconds -lt 20) {
        return $cached.Value.Data
    }

    $configFile = Join-Path $ScriptRoot ".mindbox.config.$EnvName.ps1"
    if (-not (Test-Path $configFile)) { return @() }
    . $configFile
    if (-not $HP_API_BASE -or -not $HP_API_KEY) { return @() }

    try {
        $data = Invoke-RestMethod -Uri "$HP_API_BASE$Path" -Headers @{ Authorization = "Bearer $HP_API_KEY" } -TimeoutSec 3
    } catch {
        return @()
    }
    Set-Variable -Name $cacheKey -Scope Global -Value @{ At = Get-Date; Data = $data }
    return $data
}

function Strip-CompletionQuotes {
    # $wordToComplete bevat de letterlijk getypte aanhalingstekens (ook bij
    # een nog niet afgesloten string, bv. '"Case.Rep' -> PowerShell geeft
    # '"Case.Rep"' terug) - empirisch geverifieerd met TabExpansion2. Zonder
    # dit strippen matcht geen enkele -like/-eq meer.
    param([string]$Word)
    return $Word.Trim('"').Trim("'")
}

function Complete-MindboxCase {
    param([string]$ScriptRoot, [string]$EnvName, [string]$WordToComplete)

    $WordToComplete = Strip-CompletionQuotes $WordToComplete
    $cases = Get-MindboxApiData $ScriptRoot $EnvName "/mindbox/cases"
    $cases | Where-Object { $_.id -like "$WordToComplete*" -or $_.name -like "*$WordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new(
            $_.id, "$($_.name) [$($_.status)]", 'ParameterValue', "$($_.name) [$($_.status)] - $($_.id)"
        )
    }
}

function Complete-MindboxItem {
    param([string]$ScriptRoot, [string]$EnvName, [string]$WordToComplete)

    $WordToComplete = Strip-CompletionQuotes $WordToComplete
    $items = Get-MindboxApiData $ScriptRoot $EnvName "/mindbox/items"
    $items | Where-Object { $_.id -like "$WordToComplete*" -or $_.original_filename -like "*$WordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new(
            $_.id, "$($_.original_filename) [$($_.status)]", 'ParameterValue', "$($_.original_filename) - $($_.id)"
        )
    }
}

# Autocomplete voor -Command (gebruikt door -Explain): eerst de commando-
# namen uit de catalogus (Env.MindBox.Entity.Action(), incl. haakje-open),
# en zodra er al een "(" getypt is, op basis van dat commando's entity/
# param_kind de echte case- of item-ids/namen erin voorstellen.
function Complete-MindboxCommand {
    param([string]$ScriptRoot, [string]$WordToComplete, $FakeBound)

    $WordToComplete = Strip-CompletionQuotes $WordToComplete
    $envName = "prod"
    if ($FakeBound -and $FakeBound['Env']) { $envName = $FakeBound['Env'] }

    if ($WordToComplete -notmatch '\(') {
        $commands = Get-MindboxApiData $ScriptRoot $envName "/mindbox/commands"
        $envLabel = (Get-Culture).TextInfo.ToTitleCase($envName)
        $commands | Where-Object { $_.notation_key -like "*$WordToComplete*" } | ForEach-Object {
            $notation = "$envLabel.MindBox.$($_.notation_key)("
            [System.Management.Automation.CompletionResult]::new($notation, $_.notation_key, 'ParameterValue', $_.description)
        }
        return
    }

    # Binnen de haakjes - env + entity.action uit het al getypte deel halen.
    if ($WordToComplete -notmatch '^(?<pre>(?<env>\w+)\.MindBox\.(?<key>[A-Za-z]+(?:\.[A-Za-z]+)?))\(') { return }
    $prefix = $Matches['pre']
    $notationKey = $Matches['key']
    $typedEnv = $Matches['env'].ToLower()

    $commands = Get-MindboxApiData $ScriptRoot $typedEnv "/mindbox/commands"
    $cmd = $commands | Where-Object { $_.notation_key -eq $notationKey } | Select-Object -First 1
    if (-not $cmd) { return }

    if ($cmd.entity -eq 'Case') {
        $cases = Get-MindboxApiData $ScriptRoot $typedEnv "/mindbox/cases"
        $cases | ForEach-Object {
            $param = if ($cmd.param_kind -eq 'name') { $_.name } else { "#$($_.id)" }
            [System.Management.Automation.CompletionResult]::new(
                "$prefix($param)", "$($_.name) [$($_.status)]", 'ParameterValue', "$($_.name) [$($_.status)] - $($_.id)"
            )
        }
    } elseif ($cmd.entity -eq 'File') {
        $items = Get-MindboxApiData $ScriptRoot $typedEnv "/mindbox/items"
        $items | ForEach-Object {
            $param = if ($cmd.param_kind -eq 'name') { $_.original_filename } else { "#$($_.id)" }
            [System.Management.Automation.CompletionResult]::new(
                "$prefix($param)", $_.original_filename, 'ParameterValue', "$($_.original_filename) - $($_.id)"
            )
        }
    }
}
