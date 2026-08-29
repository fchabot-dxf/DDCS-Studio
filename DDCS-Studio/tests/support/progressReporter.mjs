/**
 * tests/support/progressReporter.mjs — t2407 (BACKLOG #54): a full-suite PROGRESS SURFACE, and a quiet stdout.
 *
 * TWO PROBLEMS, ONE FIX. A full suite is 25-50 minutes with no sense of how far along it is, AND the local
 * `list` reporter prints one line per test — ~2900 lines, ~25-30k characters — straight into the tool-call
 * output that pays for it, discarded once the run ends (the useful part, failures + the final tally, is at
 * the end regardless). This reporter writes FILES (zero stdout cost by itself) and, off-CI, REPLACES `list`
 * as the only local console reporter — its own console output is a periodic heartbeat + failures + the final
 * summary, nothing per-test.
 *
 * THE THREE SURFACES ARE RULED (owner, 2026-08-29, two rounds — do not substitute):
 *   progress.md    — read in VS Code's own Markdown Preview. It re-renders on disk change with no server, so
 *                    a repeated overwrite IS the live-update mechanism; nothing else is needed.
 *   progress.html  — every number is BAKED IN as plain text (never fetched/computed client-side) with a
 *                    `<meta http-equiv="refresh">` — opens as a bare `file://` on a phone with zero server,
 *                    zero fetch, zero CORS. Re-generated whole on every write, same as the .md.
 *   progress.json  — for the ADVISOR to answer "how far along is it?" on demand, machine-readable.
 *
 * STDOUT DECISION (the dispatch's own "establish, don't guess"): fully silent-except-failures, PLUS a
 * time-based heartbeat line every ~2 minutes. Pure silence was cheaper still, but a 25-50 minute command
 * printing NOTHING looks indistinguishable from a hang to whoever is watching the tool call — a two-line-
 * per-minute heartbeat costs near nothing against the ~25-30k characters this replaces and answers "is this
 * still alive" without reaching for the file surfaces. Failures print IMMEDIATELY (not batched to the end),
 * since a red result is the one thing that must never get quieter than `list` already made it.
 *
 * CI IS UNTOUCHED FOR CONSOLE OUTPUT, files stay unconditional: CI already runs `dot`+`html` (its own,
 * already-cheap, already-decided reporters — GitHub Actions log volume was never this backlog entry's
 * complaint) — this reporter's own console.log calls are suppressed under `process.env.CI` so nothing
 * doubles up with `dot`'s own failure marking. The FILE WRITES stay unconditional either way, following the
 * JSON reporter's own established precedent (playwright.config.js's own comment: "runs UNCONDITIONALLY,
 * local + CI alike") rather than inventing a second CI-branching convention.
 *
 * STALENESS IS THE READER'S JOB, BY DESIGN: nothing runs once the process is killed, so no file can mark
 * itself dead retroactively. `heartbeatAt` is written on every update specifically so a reader (a human
 * glancing at the Markdown Preview, the advisor parsing the JSON) can compare it against the current time —
 * a `status:"running"` more than ~2 minutes stale is a dead run, not a slow 47%. Documented in both rendered
 * surfaces, not just this comment.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'test-results';
const MD_PATH = path.join(OUT_DIR, 'progress.md');
const HTML_PATH = path.join(OUT_DIR, 'progress.html');
const JSON_PATH = path.join(OUT_DIR, 'progress.json');
const HEARTBEAT_STDOUT_MS = 120_000;   // 2 minutes — cheap enough to answer "still alive?", rare enough to stay near-silent
const STALE_AFTER_SEC = 120;           // documented in the rendered surfaces — a heartbeat older than this means the run died

const barChars = (pct, width = 30) => {
    const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
    return '█'.repeat(filled) + '░'.repeat(width - filled);
};
const fmtDuration = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h${m}m${sec}s` : m > 0 ? `${m}m${sec}s` : `${sec}s`;
};
const escapeHtml = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

export default class ProgressReporter {
    constructor() {
        this.total = 0;
        this.completed = 0;
        this.passed = 0;
        this.failed = 0;
        this.flaky = 0;
        this.skipped = 0;
        this.currentSpec = '';
        this.startedAt = Date.now();
        this.lastHeartbeatStdout = 0;
        this.quiet = !!process.env.CI;   // CI already has dot+html; this reporter's own console noise would only double up
    }

    onBegin(config, suite) {
        this.total = suite.allTests().length;
        this.startedAt = Date.now();
        try { fs.mkdirSync(OUT_DIR, { recursive: true }); } catch (_) { /* already exists */ }
        this._write('running');
        if (!this.quiet) console.log(`[progress] suite starting — ${this.total} tests, ${config.workers} workers — live at test-results/progress.md`);
    }

    onTestBegin(test) {
        this.currentSpec = `${path.basename(test.location.file)} › ${test.title}`;
    }

    onTestEnd(test, result) {
        // Playwright calls onTestEnd once per ATTEMPT, not once per test — a flaky test that fails then passes
        // on retry fires this TWICE for the same logical test, and a deterministic failure fires it 1+retries
        // times. Only the FINAL attempt (a pass, a skip, or the last allowed retry) is a real completion;
        // counting every attempt let `completed` run past `total` (measured live: 10/8 = 125%) the first time
        // a retry happened. An earlier failing attempt that WILL retry is not counted at all here — it shows
        // up once, correctly, when its own final attempt lands.
        const isFinal = result.status === 'passed' || result.status === 'skipped' || result.retry >= test.retries;
        if (!isFinal) { this._write('running'); return; }
        this.completed++;
        if (result.status === 'passed') {
            if (result.retry > 0) this.flaky++; else this.passed++;
        } else if (result.status === 'skipped') {
            this.skipped++;
        } else {
            this.failed++;
            if (!this.quiet) console.log(`[FAIL] ${path.basename(test.location.file)} › ${test.title}`);
        }
        this._maybeHeartbeatStdout();
        this._write('running');
    }

    onEnd(result) {
        this._write(result.status === 'passed' ? 'passed' : 'failed');
        if (!this.quiet) {
            const elapsed = fmtDuration(Date.now() - this.startedAt);
            console.log(`\n[progress] DONE in ${elapsed} — ${this.passed} passed, ${this.failed} failed, ${this.flaky} flaky, ${this.skipped} skipped`);
        }
    }

    _maybeHeartbeatStdout() {
        if (this.quiet) return;
        const now = Date.now();
        if (now - this.lastHeartbeatStdout < HEARTBEAT_STDOUT_MS) return;
        this.lastHeartbeatStdout = now;
        const pct = this.total ? Math.round((this.completed / this.total) * 100) : 0;
        console.log(`[progress] ${pct}% (${this.completed}/${this.total}) · ${this.passed} passed · ${this.failed} failed · ${this.flaky} flaky · elapsed ${fmtDuration(now - this.startedAt)}`);
    }

    _write(status) {
        const now = Date.now();
        const elapsedMs = now - this.startedAt;
        const pct = this.total ? (this.completed / this.total) * 100 : 0;
        const rate = this.completed > 0 ? elapsedMs / this.completed : 0;
        const etaMs = status === 'running' && rate > 0 ? Math.max(0, rate * (this.total - this.completed)) : 0;

        const d = {
            phase: 'e2e', status, total: this.total, completed: this.completed,
            passed: this.passed, failed: this.failed, flaky: this.flaky, skipped: this.skipped,
            currentSpec: this.currentSpec,
            startedAt: new Date(this.startedAt).toISOString(),
            elapsedSec: Math.round(elapsedMs / 1000),
            etaSec: Math.round(etaMs / 1000),
            heartbeatAt: new Date(now).toISOString(),
            staleAfterSec: STALE_AFTER_SEC,
        };

        // Each surface writes independently — one failing (a locked file, a full disk) must never take the others down.
        try { fs.writeFileSync(JSON_PATH, JSON.stringify(d, null, 2)); } catch (_) { /* best-effort */ }
        try { fs.writeFileSync(MD_PATH, renderMd(d, pct)); } catch (_) { /* best-effort */ }
        try { fs.writeFileSync(HTML_PATH, renderHtml(d, pct)); } catch (_) { /* best-effort */ }
    }
}

function renderMd(d, pct) {
    const eta = d.status === 'running' ? fmtDuration(d.etaSec * 1000) : '—';
    return `# Suite progress

\`${barChars(pct)}\` **${pct.toFixed(1)}%**

| | |
|---|---|
| Progress | ${d.completed} / ${d.total} |
| Passed | ${d.passed} |
| Failed | ${d.failed} |
| Flaky | ${d.flaky} |
| Skipped | ${d.skipped} |
| Elapsed | ${fmtDuration(d.elapsedSec * 1000)} |
| ETA | ${eta} |
| Current | \`${d.currentSpec || '—'}\` |
| Status | **${d.status}** |
| Heartbeat | ${d.heartbeatAt} |

_If Status still reads "running" and Heartbeat is more than ${d.staleAfterSec}s old, the run has died — this
file cannot mark itself dead, only stop updating._
`;
}

function renderHtml(d, pct) {
    const eta = d.status === 'running' ? fmtDuration(d.etaSec * 1000) : '—';
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Suite progress</title>
<style>
body{font:16px/1.5 -apple-system,monospace;background:#0b0f14;color:#e6edf3;padding:16px;margin:0;}
.bar{font-size:22px;letter-spacing:-2px;color:#7fdc7f;white-space:pre;overflow-wrap:break-word;}
.pct{font-size:28px;font-weight:bold;}
table{border-collapse:collapse;margin-top:14px;width:100%;}
td{padding:6px 10px;border-bottom:1px solid #223;}
td:first-child{color:#8aa;}
.status-running{color:#4ab3ff;} .status-passed{color:#7fdc7f;} .status-failed{color:#ff6b6b;}
.note{color:#778;font-size:13px;margin-top:14px;}
</style></head><body>
<div class="pct">${pct.toFixed(1)}%</div>
<div class="bar">${barChars(pct)}</div>
<table>
<tr><td>Progress</td><td>${d.completed} / ${d.total}</td></tr>
<tr><td>Passed</td><td>${d.passed}</td></tr>
<tr><td>Failed</td><td>${d.failed}</td></tr>
<tr><td>Flaky</td><td>${d.flaky}</td></tr>
<tr><td>Skipped</td><td>${d.skipped}</td></tr>
<tr><td>Elapsed</td><td>${fmtDuration(d.elapsedSec * 1000)}</td></tr>
<tr><td>ETA</td><td>${eta}</td></tr>
<tr><td>Current</td><td>${escapeHtml(d.currentSpec || '—')}</td></tr>
<tr><td>Status</td><td class="status-${escapeHtml(d.status)}">${escapeHtml(d.status)}</td></tr>
<tr><td>Heartbeat</td><td>${d.heartbeatAt}</td></tr>
</table>
<div class="note">If Status still reads "running" and Heartbeat is more than ${d.staleAfterSec}s old, the run has died.</div>
</body></html>`;
}
