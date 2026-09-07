#!/usr/bin/env node
// scripts/merge-shards.cjs — t2713 (SHARDING PLUMBING batch 1). Merges the blob reports every
// `test-all.cjs --shard=X/Y` invocation writes into ONE html report, across as many machines/shards as were
// actually run. Reads from `blob-report-collected/` by DEFAULT, not `blob-report/` — Playwright's own blob
// reporter WIPES `blob-report/` at the start of every run (confirmed empirically: shard 1 then shard 2 back to
// back left only shard 2's zip), so `test-all.cjs` copies each shard's freshly-written blob OUT into
// `blob-report-collected/` (a sibling directory Playwright never touches) the instant that shard's run ends —
// see test-all.cjs's own comment on that copy step. The blobs from a second MACHINE (e.g. the ASUS) are NOT
// collected here — that transfer (shared folder / scp / a CI artifact) is the runner's own concern; this
// script only merges whatever is ALREADY sitting in the given directory, and fails loudly if that directory
// has no blobs at all rather than letting Playwright's own error speak for a mistake as common as "forgot to
// copy the other machine's shard zips in first".
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || path.join(__dirname, '..', 'blob-report-collected');
const reporter = process.argv[3] || 'html';

if (!fs.existsSync(dir)) {
    console.error(`merge-shards: no such directory "${dir}" — nothing to merge.`);
    console.error('Run each shard first (node scripts/test-all.cjs --shard=X/Y), and if merging across two');
    console.error('machines, copy the OTHER machine\'s blob-report-collected/*.zip into this directory before merging.');
    process.exit(1);
}
const blobs = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
if (blobs.length === 0) {
    console.error(`merge-shards: "${dir}" has no *.zip blob reports — nothing to merge.`);
    console.error('Run each shard first (node scripts/test-all.cjs --shard=X/Y), and if merging across two');
    console.error('machines, copy the OTHER machine\'s blob-report-collected/*.zip into this directory before merging.');
    process.exit(1);
}
console.log(`merge-shards: merging ${blobs.length} blob report(s) from "${dir}" (${blobs.join(', ')}) → ${reporter}`);
const r = spawnSync('npx', ['playwright', 'merge-reports', dir, '--reporter=' + reporter], { stdio: 'inherit', shell: true });
process.exit(r.status == null ? 1 : r.status);
