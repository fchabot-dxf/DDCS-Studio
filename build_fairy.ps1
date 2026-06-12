# build_fairy.ps1 — package the CNC gateway into ./<name>.exe (PyInstaller, onefile).
#
# Produces a single self-contained exe that runs the gateway HTTP server + poll loop and opens
# the console in a native pywebview window. Local backend only (R2/boto3 excluded to slim it).
#
#   pwsh ./build_fairy.ps1                      # -> ./fairy.exe        (studio / CNC-FAIRY -> Expert M350)
#   pwsh ./build_fairy.ps1 -Name benchgateway   # -> ./benchgateway.exe (this box -> bench V4.1 @ 10.0.0.50)
#
# Same gateway code either way — only the exe name differs; choose which controller at runtime. Both
# exes are gitignored. Deps (one-time):  python -m pip install pyinstaller pywebview
param([string]$Name = "fairy")
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Push-Location $root
try {
    $sep = ";"   # Windows PyInstaller --add-data "SRC;DEST" separator
    python -m PyInstaller --noconfirm --clean --onefile --name $Name `
        --paths "bridge/bridge-app" `
        --add-data "bridge/bridge-app/web/ui${sep}console" `
        --add-data "DDCS-Studio/web${sep}studio" `
        --add-data "DDCS-Studio/web/shared${sep}shared" `
        --collect-submodules fairy `
        --collect-submodules pymodbus `
        --collect-all webview `
        --hidden-import serial `
        --exclude-module boto3 `
        --exclude-module botocore `
        fairy_gateway.py
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed ($LASTEXITCODE)" }
    Copy-Item "dist/$Name.exe" "$root/$Name.exe" -Force
    $mb = [math]::Round((Get-Item "$root/$Name.exe").Length / 1MB, 1)
    Write-Host "`n[build] OK -> ./$Name.exe  ($mb MB)" -ForegroundColor Green
}
finally { Pop-Location }
