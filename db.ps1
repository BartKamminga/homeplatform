# db.ps1 — HomePlatform Database Query Helper
#
# GEBRUIK:
#   .\db.ps1 -Sql "SELECT id, name FROM hockey_clubs LIMIT 5"    # NAS DB (default)
#   .\db.ps1 -Sql "SELECT id, name FROM hockey_clubs" -Local      # lokale DB
#   .\db.ps1 -Table hockey_clubs                                   # eerste 20 rijen NAS
#   .\db.ps1 -Table hockey_clubs -Limit 5                          # eerste 5 rijen
#   .\db.ps1 -Tables                                               # alle tabellen NAS
#   .\db.ps1 -Tables -Local                                        # alle tabellen lokaal

param(
    [string]$Sql    = "",
    [string]$Table  = "",
    [switch]$Tables,
    [switch]$Local,
    [int]   $Limit  = 20
)

$NasKey  = "$env:USERPROFILE\.ssh\homeplatform"
$NasHost = "admin@192.168.30.193"
$NasDb   = "/volume1/homeplatform/db/homeplatform.sqlite"
$LocalDb = "$PSScriptRoot\db\homeplatform.sqlite"
$Python  = "$PSScriptRoot\.venv\Scripts\python.exe"

if ($Tables) { $Sql = "SELECT name, type FROM sqlite_master WHERE type='table' ORDER BY name" }
if ($Table)  { $Sql = "SELECT * FROM `"$Table`" LIMIT $Limit" }
if (-not $Sql) {
    Write-Host "Gebruik:"
    Write-Host "  .\db.ps1 -Sql ""SELECT id, name FROM hockey_clubs LIMIT 5"""
    Write-Host "  .\db.ps1 -Table hockey_clubs [-Limit 20] [-Local]"
    Write-Host "  .\db.ps1 -Tables [-Local]"
    exit 1
}

$pyCode = @'
import sqlite3, sys, base64
db  = sys.argv[1]
sql = base64.b64decode(sys.argv[2]).decode("utf-8")
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()
try:
    cur.execute(sql)
except Exception as e:
    print(f"[FOUT] {e}")
    sys.exit(1)
rows = cur.fetchall()
con.close()
if not rows:
    print("(geen resultaten)")
    sys.exit(0)
cols = list(rows[0].keys())
widths = [max(len(c), max((len(str(r[c])) if r[c] is not None else 0) for r in rows)) for c in cols]
header = "  ".join(str(c).ljust(w) for c, w in zip(cols, widths))
sep    = "-" * len(header)
print(header)
print(sep)
for row in rows:
    print("  ".join((str(row[c]) if row[c] is not None else "").ljust(w) for c, w in zip(cols, widths)))
print(f"({len(rows)} rijen)")
'@

$b64Sql = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Sql))

if ($Local) {
    if (-not (Test-Path $LocalDb)) { Write-Host "[FOUT] Lokale DB niet gevonden: $LocalDb"; exit 1 }
    $tmp = Join-Path $env:TEMP ("hp_db_" + [guid]::NewGuid().ToString("N") + ".py")
    [System.IO.File]::WriteAllText($tmp, $pyCode, [System.Text.Encoding]::UTF8)
    try { & $Python $tmp $LocalDb $b64Sql }
    finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
} else {
    $b64Py = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($pyCode))
    ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost "echo '$b64Py' | base64 -d | python3 - '$NasDb' '$b64Sql'"
}
