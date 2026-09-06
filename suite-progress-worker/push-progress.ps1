# Push the suite's live progress.md to the ddcs-suite-progress Worker every 30s.
# Zero model involvement — pure HTTP. Run it in the background on the dev machine;
# it is harmless while no suite runs (keeps pushing the last known state).
#
#   powershell -File push-progress.ps1
#
# The push key lives OUTSIDE the repo: ~/.ddcs-bridge/progress-push-key.txt
# (set once via `npx wrangler secret put PUSH_KEY` with the same value).

$pf  = "C:\Users\danse\APPS\ddcs-studio-project\DDCS-Studio\test-results\progress.md"
$key = (Get-Content "$env:USERPROFILE\.ddcs-bridge\progress-push-key.txt" -Raw).Trim()
$url = "https://ddcs-suite-progress.dansemur.workers.dev/u?k=$key"
$lastHash = ""

while ($true) {
    try {
        if (Test-Path $pf) {
            $t = [System.IO.File]::ReadAllText($pf, [System.Text.UTF8Encoding]::new($false))
            $h = [BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($t)))
            if ($h -ne $lastHash) {   # only push when the file actually changed
                Invoke-RestMethod -Uri $url -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($t)) -ContentType "text/plain; charset=utf-8" -TimeoutSec 15 | Out-Null
                $lastHash = $h
            }
        }
    } catch { }   # a failed push just retries next tick; the page shows honest staleness
    Start-Sleep -Seconds 30
}
