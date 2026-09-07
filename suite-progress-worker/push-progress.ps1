# Push the suite's progress.md to the ddcs-suite-progress Worker THE MOMENT IT CHANGES.
# Event-driven: a FileSystemWatcher fires on write, a short debounce coalesces bursts, and a
# 45s keepalive tick covers anything the watcher misses. Zero model involvement — pure HTTP.
#
#   powershell -File push-progress.ps1
#
# The push key lives OUTSIDE the repo: ~/.ddcs-bridge/progress-push-key.txt
# (the same value as `npx wrangler secret put PUSH_KEY`).

# $dir derives from THIS script's own location so it works on any box/clone path — a hardcoded absolute
# path silently broke every non-matching node (the catch{} swallows it; ASUS-flagged). Env override wins.
$dir  = if ($env:DDCS_PROGRESS_DIR) { $env:DDCS_PROGRESS_DIR }
        else { [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\DDCS-Studio\test-results')) }
$name = "progress.md"
$pf   = Join-Path $dir $name
$key  = (Get-Content "$env:USERPROFILE\.ddcs-bridge\progress-push-key.txt" -Raw).Trim()
# t2715 (sharding support batch 2) — MULTI-ROOM: each machine reports under its own room so two shard
# nodes posting at once don't clobber one shared stream. $env:SHARD_ROOM lets a run declare its own room
# explicitly (e.g. a CI job naming itself by shard index); absent that, the machine's own hostname is a
# stable, zero-config default — no two real machines share one, and it never needs setting by hand.
$room = if ($env:SHARD_ROOM) { $env:SHARD_ROOM } else { $env:COMPUTERNAME }
$url  = "https://ddcs-suite-progress.dansemur.workers.dev/u?k=$key&room=$room"
$lastHash = ""

$fsw = [System.IO.FileSystemWatcher]::new($dir, $name)
$fsw.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName
$fsw.EnableRaisingEvents = $true
Register-ObjectEvent -InputObject $fsw -EventName Changed -SourceIdentifier PMChanged | Out-Null
Register-ObjectEvent -InputObject $fsw -EventName Created -SourceIdentifier PMCreated | Out-Null

function Push-IfChanged {
    if (-not (Test-Path $pf)) { return }
    try {
        $t = [System.IO.File]::ReadAllText($pf, [System.Text.UTF8Encoding]::new($false))
        if (-not $t) { return }
        $h = [BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($t)))
        if ($h -ne $script:lastHash) {
            Invoke-RestMethod -Uri $url -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($t)) -ContentType "text/plain; charset=utf-8" -TimeoutSec 15 | Out-Null
            $script:lastHash = $h
        }
    } catch { }   # a failed push retries on the next event/tick; the page shows honest staleness
}

Push-IfChanged   # current state immediately at start

while ($true) {
    $e = Wait-Event -Timeout 45
    if ($e) {
        Remove-Event -EventIdentifier $e.EventIdentifier -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 600   # debounce a burst of writes
        Get-Event -ErrorAction SilentlyContinue | Remove-Event -ErrorAction SilentlyContinue
    }
    Push-IfChanged                       # on event OR on the 45s keepalive tick
}
