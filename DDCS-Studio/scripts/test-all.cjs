#!/usr/bin/env node
// scripts/test-all.cjs — t1587: run BOTH test tiers UNCONDITIONALLY and fail the gate if either did.
// A plain `&&` chain (test:node && test:e2e) would stop at the first tier's failure and never even start the
// second — so a single pre-existing Node-tier failure would permanently blind the gate to the whole browser
// tier. This runs both regardless of the first's outcome, then fails only if either one did.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(label, script, extraEnv) {
    console.log(`\n=== ${label} (npm run ${script}) ===`);
    const r = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true, env: extraEnv ? { ...process.env, ...extraEnv } : process.env });
    return r.status == null ? 1 : r.status;
}

// t2407 (BACKLOG #54) — a MINIMAL phase marker for the node tier, written independently of progressReporter.mjs
// (that class only exists inside the Playwright process — test:e2e's own onBegin overwrites this the instant it
// starts). The node tier is seconds long, so it does not need the full bar/ETA machinery, only enough that a
// viewer watching progress.md during those seconds sees "node tier running" instead of a stale file from a
// PRIOR run's 100% (which would misread as a hung run at the wrong percentage) or a missing file.
// t2679 — the SECOND boundary this same mechanism now covers: Playwright's own COLLECTION of ~2900 test files
// (module-loading every spec) takes several seconds AFTER the e2e child spawns but BEFORE progressReporter.mjs's
// own onBegin() fires and starts writing real percentages — a gap where, without a marker written HERE first,
// the page could still be showing a PRIOR completed run's own final "passed/failed" state (indistinguishable
// from "done" at a glance) while a brand new run is already several seconds in. `phase` is now a real parameter
// (was hardcoded 'node' for both calls, wrongly labeling the e2e-collecting marker too) so a reader polling
// progress.json mid-gap sees which boundary it actually is.
function writePhaseMarker(phase, text) {
    const outDir = path.join(__dirname, '..', 'test-results');
    try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) { /* already exists */ }
    const now = new Date().toISOString();
    try { fs.writeFileSync(path.join(outDir, 'progress.json'), JSON.stringify({ phase, status: 'running', note: text, heartbeatAt: now }, null, 2)); } catch (_) {}
    try { fs.writeFileSync(path.join(outDir, 'progress.md'), `# Suite progress\n\n**${text}**\n\nHeartbeat: ${now}\n`); } catch (_) {}
    try { fs.writeFileSync(path.join(outDir, 'progress.html'), `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Suite progress</title><style>body{font:16px monospace;background:#0b0f14;color:#e6edf3;padding:16px;}</style></head><body><h2>${text}</h2><p>Heartbeat: ${now}</p></body></html>`); } catch (_) {}
}

writePhaseMarker('node', 'node tier running…');
const nodeCode = run('test:node', 'test:node');
writePhaseMarker('e2e-collecting', `node ✓ (exit ${nodeCode}) · e2e tier collecting tests…`);
// t2679 — DDCS_TIER declares "this e2e run is the e2e PORTION OF A FULL SUITE" to the child process, closing
// the ambiguity progressReporter.mjs's own `tier` field otherwise carries: `npm_lifecycle_event` reads
// 'test:e2e' identically whether a person ran `npm run test:e2e` standalone or test-all.cjs spawned it as half
// of `npm test` — the two are different facts a viewer needs to tell apart (a standalone e2e run's 100% means
// the WHOLE thing is done; the full-suite's e2e portion finishing does not, the flaky-count summary below still
// has to run). progressReporter.mjs prefers this env var when present, falling back to npm_lifecycle_event
// unchanged for a standalone run (which never sets it).
const e2eCode = run('test:e2e', 'test:e2e', { DDCS_TIER: 'full suite' });

// t1724 — THE FLAKY COUNT IS THE HEALTH METRIC, read here rather than left in scrollback. A per-spec retries
// list goes stale every run as the contention-starved population shifts (measured at t1719: the next run's
// survivors weren't the previous run's) — retries now live in playwright.config.js's `retries`, and its JSON
// reporter (`test-results/summary.json`) is what makes "how many flaked" a number this gate STATES, not a line
// a human has to notice among ~2500 test results.
let flakySummary = 'flaky count unavailable (no test-results/summary.json — did test:e2e run at all?)';
try {
    const summaryPath = path.join(__dirname, '..', 'test-results', 'summary.json');
    const stats = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).stats;
    flakySummary = `expected ${stats.expected}, flaky ${stats.flaky}, unexpected ${stats.unexpected}, skipped ${stats.skipped}`;
} catch (e) { flakySummary += ` (${e.message})`; }

console.log(`\n=== SUMMARY: test:node exit ${nodeCode}, test:e2e exit ${e2eCode} ===`);
console.log(`=== FLAKY COUNT (the health metric): ${flakySummary} ===`);
process.exit(nodeCode === 0 && e2eCode === 0 ? 0 : 1);
