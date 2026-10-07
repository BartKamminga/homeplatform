# Start de bezoekers-tray zonder consolevenster.
# Autostart: snelkoppeling naar dit script in shell:startup, of:
#   powershell -WindowStyle Hidden -File C:\Projects\homeplatform\tools\visitor_tray\start.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Start-Process -FilePath (Join-Path $root ".venv\Scripts\pythonw.exe") -ArgumentList (Join-Path $PSScriptRoot "visitor_tray.py")
