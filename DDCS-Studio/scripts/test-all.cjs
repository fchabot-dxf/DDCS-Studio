#!/usr/bin/env node
// scripts/test-all.cjs — t1587: run BOTH test tiers UNCONDITIONALLY and fail the gate if either did.
// A plain `&&` chain (test:node && test:e2e) would stop at the first tier's failure and never even start the
// second — so a single pre-existing Node-tier failure would permanently blind the gate to the whole browser
// tier. This runs both regardless of the first's outcome, then fails only if either one did.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(label, script) {
    console.log(`\n=== ${label} (npm run ${script}) ===`);
    const r = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
    return r.status == null ? 1 : r.status;
}

const nodeCode = run('test:node', 'test:node');
const e2eCode = run('test:e2e', 'test:e2e');

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
