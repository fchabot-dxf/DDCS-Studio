# build_fairy.ps1 — package the CNC-FAIRY gateway into ./fairy.exe (PyInstaller, onefile).
#
# Produces a single self-contained exe that runs the gateway HTTP server + poll loop and opens
# the fairy console in a native pywebview window. Local backend only (R2/boto3 excluded to slim it).
#
#   pwsh ./build_fairy.ps1            # build -> ./fairy.exe  (+ dist/, build/ — gitignored)
#
# Deps (one-time):  python -m pip install pyinstaller pywebview
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root
try {
    $sep = ";"   # Windows PyInstaller --add-data "SRC;DEST" separator
    python -m PyInstaller --noconfirm --clean --onefile --name fairy `
        --paths "bridge/bridge-app" `
        --add-data "bridge/bridge-app/web/ui${sep}console" `
        --add-data "DDCS-Studio/web/shared${sep}shared" `
        --collect-submodules fairy `
        --collect-submodules pymodbus `
        --collect-all webview `
        --hidden-import serial `
        --exclude-module boto3 `
        --exclude-module botocore `
        fairy_gateway.py
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed ($LASTEXITCODE)" }
    Copy-Item "dist/fairy.exe" "$root/fairy.exe" -Force
    $mb = [math]::Round((Get-Item "$root/fairy.exe").Length / 1MB, 1)
    Write-Host "`n[build] OK -> ./fairy.exe  ($mb MB)" -ForegroundColor Green
}
finally { Pop-Location }
