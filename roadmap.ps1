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

    [string]$Status    = "",
    [string]$Site      = "",
    [string]$Priority  = "",
    [string]$Title     = "",
    [string]$Notes     = "",
    [string]$Version   = "",
    [int]   $Id        = 0,
    [string]$Ids       = ""
)

$NasKey  = "$env:USERPROFILE\.ssh\homeplatform"
$NasHost = "admin@192.168.30.193"
$DB      = "/volume1/homeplatform/db/homeplatform.sqlite"

function NasSql($sql) {
    # Wrap in Python to avoid sqlite3 CLI locking conflicts with the running backend
    $py = @"
import sqlite3
con = sqlite3.connect('$DB', timeout=10)
con.row_factory = sqlite3.Row
cur = con.cursor()
for stmt in '''$sql'''.split(';'):
    stmt = stmt.strip()
    if not stmt or stmt.startswith('.'):
        continue
    cur.execute(stmt)
    if cur.description:
        cols = [d[0] for d in cur.description]
        widths = [len(c) for c in cols]
        rows = cur.fetchall()
        for r in rows:
            for i,v in enumerate(r):
                widths[i] = max(widths[i], len(str(v) if v is not None else ''))
        fmt = '  '.join(f'{{:<{w}}}' for w in widths)
        print(fmt.format(*cols))
        print('  '.join('-'*w for w in widths))
        for r in rows:
            print(fmt.format(*[str(v) if v is not None else '' for v in r]))
con.commit()
con.close()
"@
    NasPy $py
}

function NasPy($script) {
    $bytes  = [System.Text.Encoding]::UTF8.GetBytes($script)
    $b64    = [Convert]::ToBase64String($bytes)
    $result = ssh -i $NasKey -o StrictHostKeyChecking=no $NasHost "echo '$b64' | base64 -d | python3"
    return $result
}

# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------
if ($List) {
    # Build WHERE clause in PowerShell, pass as literal string to Python
    $where = "1=1"
    if ($Status) { $where += " AND status='$Status'" }
    if ($Site)   { $where += " AND site='$Site'" }
    $py = @"
import sqlite3
con = sqlite3.connect('$DB', timeout=10)
cur = con.cursor()
cur.execute("SELECT id, status, site, priority, title, version FROM roadmap_items WHERE $where ORDER BY CASE status WHEN 'deploying' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'ready' THEN 2 WHEN 'pick_up' THEN 3 WHEN 'analyzed' THEN 4 WHEN 'idea' THEN 5 ELSE 6 END, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, id")
rows = cur.fetchall()
print("ID    STATUS         SITE        PRIOR   TITEL")
print("-" * 72)
for rid, status, site, priority, title, version in rows:
    ver = " [v" + str(version) + "]" if version else ""
    print(str(rid).ljust(5) + status.ljust(15) + site.ljust(12) + priority.ljust(8) + str(title) + ver)
con.close()
"@
    NasPy $py
    exit 0
}

# ---------------------------------------------------------------------------
# Changelog
# ---------------------------------------------------------------------------
if ($Changelog) {
    $py = @"
import sqlite3
con = sqlite3.connect('$DB', timeout=10)
cur = con.cursor()
cur.execute("SELECT site, version, title, released_at FROM changelog ORDER BY released_at DESC LIMIT 20")
rows = cur.fetchall()
print(f"{'SITE':<12}  {'VERSIE':<8}  TITEL")
print("-"*60)
for site, ver, title, dt in rows:
    print(f"{site:<12}  {ver:<8}  {title}")
con.close()
"@
    NasPy $py
    exit 0
}

# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------
if ($Add) {
    if (-not $Title) { Write-Host "Geef -Title op"; exit 1 }
    if (-not $Site)  { Write-Host "Geef -Site op";  exit 1 }
    $py = @"
import sqlite3, uuid
from datetime import datetime
con = sqlite3.connect('$DB')
now = datetime.utcnow().isoformat()
con.execute(
    "INSERT INTO roadmap_items (title,site,priority,status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    ("$Title","$Site","$Priority" if "$Priority" else "medium","idea",None,now,now)
)
con.commit()
print("[OK] Toegevoegd:", "$Title")
con.close()
"@
    NasPy $py
    exit 0
}

# ---------------------------------------------------------------------------
# Close (single)
# ---------------------------------------------------------------------------
if ($Close) {
    if ($Id -eq 0)    { Write-Host "Geef -Id op";      exit 1 }
    if (-not $Version){ Write-Host "Geef -Version op"; exit 1 }

    $py = @"
import sqlite3, uuid
from datetime import datetime
con = sqlite3.connect('$DB')
now = datetime.utcnow().isoformat()
cur = con.cursor()
cur.execute("SELECT site, title FROM roadmap_items WHERE id=?", ($Id,))
row = cur.fetchone()
if not row:
    print("[FOUT] Item $Id niet gevonden")
else:
    site, title = row
    cur.execute("SELECT notes, description FROM roadmap_items WHERE id=?", ($Id,))
    nd = cur.fetchone()
    cl_desc = (nd[0] or nd[1]) if nd else None
    cur.execute("UPDATE roadmap_items SET status='done', version=?, updated_at=? WHERE id=?", ("$Version", now, $Id))
    cur.execute("SELECT id FROM changelog WHERE site=? AND version=? AND title=?", (site, "$Version", title))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO changelog (id,version,site,title,description,released_at,created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), "$Version", site, title, cl_desc, now, now)
        )
        print(f"[OK] Afgesloten + changelog: {site} v$Version — {title}")
    else:
        print(f"[OK] Afgesloten (changelog al aanwezig): {site} v$Version — {title}")
con.commit()
con.close()
"@
    NasPy $py
    exit 0
}

# ---------------------------------------------------------------------------
# CloseMany
# ---------------------------------------------------------------------------
if ($CloseMany) {
    if (-not $Ids)    { Write-Host "Geef -Ids op (komma-gescheiden)"; exit 1 }
    if (-not $Version){ Write-Host "Geef -Version op"; exit 1 }

    $idList = ($Ids -split "," | ForEach-Object { $_.Trim() }) -join ","
    $py = @"
import sqlite3, uuid
from datetime import datetime
con = sqlite3.connect('$DB')
now = datetime.utcnow().isoformat()
cur = con.cursor()
ids = [$idList]
for rid in ids:
    cur.execute("SELECT site, title FROM roadmap_items WHERE id=?", (rid,))
    row = cur.fetchone()
    if not row:
        print(f"[SKIP] Id {rid} niet gevonden")
        continue
    site, title = row
    cur.execute("SELECT notes, description FROM roadmap_items WHERE id=?", (rid,))
    nd = cur.fetchone()
    cl_desc = (nd[0] or nd[1]) if nd else None
    cur.execute("UPDATE roadmap_items SET status='done', version=?, updated_at=? WHERE id=?", ("$Version", now, rid))
    cur.execute("SELECT id FROM changelog WHERE site=? AND version=? AND title=?", (site, "$Version", title))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO changelog (id,version,site,title,description,released_at,created_at) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), "$Version", site, title, cl_desc, now, now)
        )
    print(f"[OK] {site} v$Version — {title}")
con.commit()
con.close()
"@
    NasPy $py
    exit 0
}

# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
if ($Update) {
    if ($Id -eq 0) { Write-Host "Geef -Id op"; exit 1 }
    $sets = @()
    if ($Status)   { $sets += "status='$Status'" }
    if ($Priority) { $sets += "priority='$Priority'" }
    if ($Title)    { $sets += "title='$Title'" }
    if ($Notes)    { $sets += "notes='$Notes'" }
    if ($Version)  { $sets += "version='$Version'" }
    if ($sets.Count -eq 0) { Write-Host "Geef minimaal een veld op om bij te werken"; exit 1 }

    $sql = "UPDATE roadmap_items SET $($sets -join ', '), updated_at=datetime('now') WHERE id=$Id;"
    NasSql $sql
    Write-Host "[OK] Item $Id bijgewerkt"
    exit 0
}

# Geen actie
Write-Host "Gebruik: .\roadmap.ps1 -List | -Add | -Close | -CloseMany | -Update | -Changelog"
Write-Host "Zie bovenaan het script voor voorbeelden."
