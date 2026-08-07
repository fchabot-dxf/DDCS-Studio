#!/usr/bin/env node
// scripts/test-all.cjs — t1587: run BOTH test tiers UNCONDITIONALLY and fail the gate if either did.
// A plain `&&` chain (test:node && test:e2e) would stop at the first tier's failure and never even start the
// second — so a single pre-existing Node-tier failure would permanently blind the gate to the whole browser
// tier. This runs both regardless of the first's outcome, then fails only if either one did.
const { spawnSync } = require('child_process');

function run(label, script) {
    console.log(`\n=== ${label} (npm run ${script}) ===`);
    const r = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: true });
    return r.status == null ? 1 : r.status;
}

const nodeCode = run('test:node', 'test:node');
const e2eCode = run('test:e2e', 'test:e2e');

console.log(`\n=== SUMMARY: test:node exit ${nodeCode}, test:e2e exit ${e2eCode} ===`);
process.exit(nodeCode === 0 && e2eCode === 0 ? 0 : 1);
