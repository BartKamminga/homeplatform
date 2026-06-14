# roadmap.ps1 — HomePlatform Roadmap Manager
#
# GEBRUIK:
#   .\roadmap.ps1 -List                              # toon alle items
#   .\roadmap.ps1 -List -Status idea                 # filter op status
#   .\roadmap.ps1 -List -Site tournix                # filter op site
#   .\roadmap.ps1 -Add -Site tournix -Title "..." -Priority high   # nieuw item
#   .\roadmap.ps1 -Close -Id 8 -Version 0.4          # afsluiten + changelog
#   .\roadmap.ps1 -CloseMany -Ids "8,11,12" -Version 0.4           # meerdere tegelijk
#   .\roadmap.ps1 -Update -Id 8 -Status in_progress  # status wijzigen
#   .\roadmap.ps1 -Changelog                         # toon recente changelog

param(
    [switch]$List,
    [switch]$Add,
    [switch]$Close,
    [switch]$CloseMany,
    [switch]$Update,
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
    [int]   $Id          = 0,
    [string]$Ids         = ""
)

$NasKey  = "$env:USERPROFILE\.ssh\homeplatform"
$NasHost = "admin@192.168.30.193"
$Script  = Join-Path $PSScriptRoot "roadmap_nas.py"

function NasRun([string[]]$ArgList) {
    $bytes  = [System.IO.File]::ReadAllBytes($Script)
    $b64    = [Convert]::ToBase64String($bytes)
    $quoted = $ArgList | ForEach-Object {
        if ($_ -match ' ') { "'" + $_.Replace("'", "'\\''") + "'" } else { $_ }
    }
    $args_s = $quoted -join " "
    $result = ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost "echo '$b64' | base64 -d | python3 - $args_s"
    return $result
}

# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------
if ($List) {
    $a = @("list")
    if ($Status)   { $a += "--status"; $a += $Status }
    if ($Site)     { $a += "--site";   $a += $Site }
    if ($Priority) { $a += "--priority"; $a += $Priority }
    NasRun $a
    exit 0
}

# ---------------------------------------------------------------------------
# Changelog
# ---------------------------------------------------------------------------
if ($Changelog) {
    NasRun @("changelog")
    exit 0
}

# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------
if ($Add) {
    if (-not $Title) { Write-Host "Geef -Title op"; exit 1 }
    if (-not $Site)  { Write-Host "Geef -Site op";  exit 1 }
    $a = @("add", "--title", $Title, "--site", $Site)
    if ($Priority)    { $a += "--priority";    $a += $Priority }
    if ($Description) { $a += "--description"; $a += $Description }
    NasRun $a
    exit 0
}

# ---------------------------------------------------------------------------
# Close (single)
# ---------------------------------------------------------------------------
if ($Close) {
    if ($Id -eq 0)     { Write-Host "Geef -Id op";      exit 1 }
    if (-not $Version) { Write-Host "Geef -Version op"; exit 1 }
    NasRun @("close", "--id", $Id, "--version", $Version)
    exit 0
}

# ---------------------------------------------------------------------------
# CloseMany
# ---------------------------------------------------------------------------
if ($CloseMany) {
    if (-not $Ids)     { Write-Host "Geef -Ids op (komma-gescheiden)"; exit 1 }
    if (-not $Version) { Write-Host "Geef -Version op"; exit 1 }
    $idList = ($Ids -split "," | ForEach-Object { $_.Trim() }) -join ","
    NasRun @("closemany", "--ids", $idList, "--version", $Version)
    exit 0
}

# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
if ($Update) {
    if ($Id -eq 0) { Write-Host "Geef -Id op"; exit 1 }
    $a = @("update", "--id", $Id)
    if ($Status)      { $a += "--status";      $a += $Status }
    if ($Priority)    { $a += "--priority";    $a += $Priority }
    if ($Title)       { $a += "--title";       $a += $Title }
    if ($Notes)       { $a += "--notes";       $a += $Notes }
    if ($Version)     { $a += "--version";     $a += $Version }
    if ($Impact)      { $a += "--impact";      $a += $Impact }
    if ($Risk)        { $a += "--risk";        $a += $Risk }
    if ($Scope)       { $a += "--scope";       $a += $Scope }
    if ($Description) { $a += "--description"; $a += "`"$Description`"" }
    if ($a.Count -le 2) { Write-Host "Geef minimaal een veld op om bij te werken"; exit 1 }
    NasRun $a
    exit 0
}

# Geen actie
Write-Host "Gebruik: .\roadmap.ps1 -List | -Add | -Close | -CloseMany | -Update | -Changelog"
Write-Host "Zie bovenaan het script voor voorbeelden."
