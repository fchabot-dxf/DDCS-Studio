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
#
# CODE SIGNING (optional but recommended): an UNSIGNED, low-prevalence PyInstaller --onefile build is the classic
# Defender machine-learning false positive (Trojan:Win32/Sabsik.*!ml). Signing + earned reputation is the real fix.
# Pass a cert to sign; without one the build still succeeds UNSIGNED and prints how to fix it.
#   pwsh ./build_fairy.ps1 -CertThumbprint <cert-sha1>        # sign with a cert in the Windows cert store
#   pwsh ./build_fairy.ps1 -PfxPath cert.pfx -PfxPassword pw  # or sign with a .pfx file
# Also report the false positive once at https://www.microsoft.com/wdsi/filesubmission ("I believe this is clean")
# so Microsoft clears it cloud-wide (~1-3 days) for everyone who downloads the release.
param(
    [string]$Name = "DDCS-Studio",
    [string]$CertThumbprint,                              # code-signing cert SHA1 thumbprint in CurrentUser\My or LocalMachine\My
    [string]$PfxPath,                                     # OR a path to a .pfx code-signing certificate
    [string]$PfxPassword,                                 # password for the .pfx (if any)
    [string]$TimestampUrl = "http://timestamp.digicert.com"   # RFC3161 timestamp server (keeps the signature valid past cert expiry)
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent   # repo root (script lives in desktop/)

# Locate signtool.exe (Windows SDK) - it is usually NOT on PATH.
function Find-SignTool {
    $c = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $found = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

# Authenticode-sign $Path when a cert was provided; otherwise leave it unsigned + explain the false-positive fix.
function Invoke-ExeSign([string]$Path) {
    if (-not $CertThumbprint -and -not $PfxPath) {
        Write-Host "[build] NOT SIGNED (no -CertThumbprint / -PfxPath)." -ForegroundColor Yellow
        Write-Host "        Unsigned onefile builds get Defender ML false positives (Sabsik.*!ml). To fix:" -ForegroundColor Yellow
        Write-Host "         - re-run with  -CertThumbprint <sha1>  or  -PfxPath <cert.pfx> -PfxPassword <pw>" -ForegroundColor Yellow
        Write-Host "         - report the FP: https://www.microsoft.com/wdsi/filesubmission  (choose 'clean')" -ForegroundColor Yellow
        return
    }
    $st = Find-SignTool
    if (-not $st) { Write-Host "[build] signtool.exe not found - install the Windows 10/11 SDK. Left UNSIGNED." -ForegroundColor Yellow; return }
    $stArgs = @("sign", "/fd", "sha256", "/tr", $TimestampUrl, "/td", "sha256")
    if ($PfxPath) { $stArgs += @("/f", $PfxPath); if ($PfxPassword) { $stArgs += @("/p", $PfxPassword) } }
    else          { $stArgs += @("/sha1", $CertThumbprint) }
    $stArgs += $Path
    & $st @stArgs
    if ($LASTEXITCODE -ne 0) { throw "signtool sign failed ($LASTEXITCODE)" }
    & $st verify /pa $Path | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "signtool verify failed ($LASTEXITCODE)" }
    Write-Host "[build] signed + verified -> $Path" -ForegroundColor Green
}
Push-Location $root
try {
    $sep = ";"   # Windows PyInstaller --add-data "SRC;DEST" separator

    # VERSION RESOURCE (t2069) — an UNSIGNED exe with NO metadata (no CompanyName/ProductName/version) reads as
    # generic malware to Defender's ML and earns SmartScreen reputation slowly. Stamp full version info from the
    # app's .ver chip so the build looks like the real software it is. Cheap, no cert, reduces the false-positive rate.
    $verHtml = Get-Content "DDCS-Studio/web/index.html" -Raw
    $ver = if ($verHtml -match 'class="ver">V([0-9][0-9.]*)<') { $Matches[1] } else { "0.0.0.0" }
    $parts = @(@($ver -split '\.') | ForEach-Object { [int]$_ })
    while ($parts.Count -lt 4) { $parts += 0 }
    $filevers = ($parts[0..3] -join ', ')
    $verFile = Join-Path $root "version-info.txt"
    @"
VSVersionInfo(
  ffi=FixedFileInfo(filevers=($filevers), prodvers=($filevers), mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', 'DDCS Studio'),
      StringStruct('FileDescription', 'DDCS Studio - CNC control and gateway for DDCS controllers'),
      StringStruct('FileVersion', '$ver'),
      StringStruct('InternalName', '$Name'),
      StringStruct('OriginalFilename', '$Name.exe'),
      StringStruct('ProductName', 'DDCS Studio'),
      StringStruct('ProductVersion', '$ver'),
      StringStruct('LegalCopyright', 'DDCS Studio')
    ])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
"@ | Out-File -Encoding ascii $verFile
    Write-Host "[build] version resource -> $ver (filevers $filevers)" -ForegroundColor Cyan
    $pyArgs = @(
        # t2113 (BACKLOG #3) — --windowed (PyInstaller's --noconsole) hides the black console window that
        # used to sit beside the app all session. Safe ONLY because fairy_gateway.py's _setup_logging now
        # tees every print() to a ROTATED ~/.ddcs-bridge/gateway.log first (Ops.open_log/Setup can open it) —
        # a frozen --windowed build has no console at all, so an un-tee'd print() can raise (sys.stdout is
        # None); see _Tee's per-stream isolation. Verified: the log file receives the startup line, a real
        # [poller] delivery line, and a real [poller] DELIVERY FAILED line (test_gateway_log_2113.py) BEFORE
        # this flag was added.
        "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--noupx", "--windowed", "--name", $Name,
        "--icon", "desktop/ddcs.ico",
        "--version-file", $verFile,
        # BACKLOG #84 — the real silent gap between double-click and the window appearing (unpack + gateway start
        # + webview init) gets a static splash: the SAME logo/name image the app icon already uses, no new asset,
        # no fake progress bar (the unpack gives no real progress signal to draw). Closed from fairy_gateway.py's
        # own main() via pyi_splash.close() once the webview is actually up. Windows-only in PyInstaller (fine —
        # this build script is Windows-only already; see BACKLOG #74 for the macOS CI story).
        # ⚠ BUILD-MACHINE REQUIREMENT: --splash needs tkinter importable in the Python building this exe (it
        # bundles a small Tk runtime for the splash window itself) — most standard Windows Python installs have
        # it; a stripped-down one may need `pip install tk` or the "tcl/tk" optional component reinstalled.
        "--splash", "desktop/ddcs.png",

        "--paths", "bridge/bridge-app",
        "--add-data", "bridge/bridge-app/web/ui${sep}console",
        "--add-data", "DDCS-Studio/web${sep}studio",
        "--add-data", "DDCS-Studio/web/shared${sep}shared"
    )
    if (Test-Path "bridge/bridge-app/fairy/google_oauth.json") {
        $pyArgs += "--add-data"
        $pyArgs += "bridge/bridge-app/fairy/google_oauth.json${sep}fairy"
    }
    $pyArgs += @(
        "--collect-submodules", "fairy",
        "--collect-submodules", "pymodbus",
        "--collect-all", "webview",
        "--hidden-import", "serial",
        "--exclude-module", "boto3",
        "--exclude-module", "botocore",
        "desktop/fairy_gateway.py"
    )
    & python $pyArgs
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
    Invoke-ExeSign $dest   # sign when a cert was provided; else leaves it unsigned + explains the FP fix
    $mb = [math]::Round((Get-Item "$root/$Name.exe").Length / 1MB, 1)
    Write-Host "`n[build] OK -> ./$Name.exe  ($mb MB)" -ForegroundColor Green
}
finally {
    # PyInstaller writes a generated <name>.spec from our CLI args; we never build from it
    # (this script IS the source of truth), so drop it - and any stale ones - to keep root clean.
    Remove-Item "$root/*.spec" -Force -ErrorAction SilentlyContinue
    Remove-Item "$root/version-info.txt" -Force -ErrorAction SilentlyContinue   # the generated version resource
    Pop-Location
}
