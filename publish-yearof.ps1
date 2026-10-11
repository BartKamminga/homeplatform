# publish-yearof.ps1 - zet de YearOf-presentatie- en roadmappagina (static/yearof) live, zonder build of deploy.
#
# Caddy serveert /yearof/ uit een map op de server (read-only bind-mount op /srv/static/yearof),
# dus kopieren is genoeg - wijzigingen staan direct online. Eerst acc, kijken, dan prod.
#
# GEBRUIK:
#   .\publish-yearof.ps1 -Env acc     # http://192.168.30.232:8081/yearof/
#   .\publish-yearof.ps1 -Env prod    # https://webheaven.nl/yearof/
#
# Daarna de wijziging gewoon committen op develop (de repo is de bron).

param(
    [Parameter(Mandatory = $true)][ValidateSet("acc", "prod")][string]$Env
)

$targets = @{
    acc  = @{ Host = "bart@192.168.30.232"; Dir = "/home/bart/homeplatform-acc/static/yearof"; Url = "http://192.168.30.232:8081/yearof/" }
    prod = @{ Host = "bart@192.168.30.49";  Dir = "/home/bart/homeplatform/static/yearof";     Url = "https://webheaven.nl/yearof/" }
}
$t = $targets[$Env]
$key = Join-Path $env:USERPROFILE ".ssh\homeplatform"
$source = Join-Path $PSScriptRoot "static\yearof"
$tmp = "/tmp/yearof-publish-" + (Get-Date -Format "yyyyMMddHHmmss")

if (-not (Test-Path (Join-Path $source "index.html"))) {
    Write-Host "[FOUT] static\yearof\index.html niet gevonden"
    exit 1
}

# Via een tijdelijke map: eerst alles overzetten, dan in 1 keer de inhoud vervangen.
# De map zelf blijft bestaan (niet verplaatsen) - anders ziet de bind-mount van Caddy de nieuwe inhoud niet.
scp -q -r -i $key $source ($t.Host + ":" + $tmp)
if ($LASTEXITCODE -ne 0) { Write-Host "[FOUT] kopieren naar $Env mislukt"; exit 1 }

$remote = "mkdir -p " + $t.Dir + " && find " + $t.Dir + " -mindepth 1 -delete && cp -r " + $tmp + "/. " + $t.Dir + "/ && rm -rf " + $tmp
ssh -i $key $t.Host $remote
if ($LASTEXITCODE -ne 0) { Write-Host "[FOUT] plaatsen op $Env mislukt"; exit 1 }

$status = curl.exe -s -o NUL -w "%{http_code}" $t.Url
Write-Host "[OK] yearof gepubliceerd op $Env - $($t.Url) geeft $status"
