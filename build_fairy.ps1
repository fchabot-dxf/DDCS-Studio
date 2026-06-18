# build_fairy.ps1 - package the CNC gateway into ./<name>.exe (PyInstaller, onefile).
#
# Produces a single self-contained exe that runs the gateway HTTP server + poll loop and opens
# the console in a native pywebview window. Local backend only (R2/boto3 excluded to slim it).
#
#   pwsh ./build_fairy.ps1                      # -> ./DDCS-Studio.exe   (the public desktop app: Studio + gateway)
#   pwsh ./build_fairy.ps1 -Name benchgateway   # -> ./benchgateway.exe (dev box -> bench V4.1 @ 10.0.0.50)
#
# Same code either way - only the exe name differs; choose which controller at runtime. The exe is the FULL
# DDCS Studio (UI + embedded gateway); "fairy" is just the internal gateway daemon. Builds are gitignored.
# Deps (one-time):  python -m pip install pyinstaller pywebview
param([string]$Name = "DDCS-Studio")
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
    # A running exe can't be overwritten OR deleted on Windows - but it CAN be renamed. So if an instance
    # is open, move the old exe aside (it keeps running the renamed image) and drop the new build in place;
    # the build no longer fails just because a copy is running. Relaunch to pick up the new exe.
    $dest = "$root/$Name.exe"
    Remove-Item "$dest.old" -Force -ErrorAction SilentlyContinue   # clear a prior aside-copy (works once its process has exited)
    if (Test-Path $dest) {
        try { Remove-Item $dest -Force -ErrorAction Stop }          # not running -> clean replace
        catch { Rename-Item $dest "$dest.old" -Force; Write-Host "[build] $Name.exe is in use - moved the old one to $Name.exe.old; relaunch to use the new build." -ForegroundColor Yellow }
    }
    Copy-Item "dist/$Name.exe" $dest -Force
    $mb = [math]::Round((Get-Item "$root/$Name.exe").Length / 1MB, 1)
    Write-Host "`n[build] OK -> ./$Name.exe  ($mb MB)" -ForegroundColor Green
}
finally {
    # PyInstaller writes a generated <name>.spec from our CLI args; we never build from it
    # (this script IS the source of truth), so drop it - and any stale ones - to keep root clean.
    Remove-Item "$root/*.spec" -Force -ErrorAction SilentlyContinue
    Pop-Location
}
