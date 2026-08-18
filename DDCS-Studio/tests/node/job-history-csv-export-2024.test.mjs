import { test, expect } from './support/harness.mjs';
import { historyToCSV, lastTimeDuration, resultLabel } from '../../web/ui/gateway/views/jobs.js';

/**
 * job-history-csv-export-2024 — EXPORT JOB HISTORY (t2024): a plain "Export CSV" button on the Jobs view's
 * History table, standing alone — no restore, no clear(), no coupling to the workspace open/save flow (that
 * coupling is exactly why a backup.js row was refused for this data, WORK-LOG t2022).
 *
 * `historyToCSV`/`lastTimeDuration` are pure — no DOM, no client, no bridge — so they are testable directly
 * here without Playwright. `exportHistoryCSV`'s own DOM wiring (the click → UIUtils.downloadFile → Blob/anchor
 * flow) is NOT covered in this tier — that half is PARKED per the dispatch's own instruction ("if Playwright
 * is needed for any half, say so and park that half"), since the advisor's WEB gate may still be running this
 * turn. `UIUtils.downloadFile` itself is exercised elsewhere (backup.js, varListPanel.js callers); the new
 * surface here is only the CSV content, which is what these tests prove.
 */

// Newest-first, matching what backend.list_history() actually returns (poller.py sorts recorded_at DESC).
const TWO_RUNS_SAME_PROGRAM = [
    { jobId: 'J2', name: 'bracket.nc', final_state: 'done', duration_s: 90, ended_at: '2026-08-16T10:00:00', content_hash: 'HASH-A' },
    { jobId: 'J1', name: 'bracket.nc', final_state: 'done', duration_s: 120, ended_at: '2026-08-15T10:00:00', content_hash: 'HASH-A' },
];

test('a real history with 2 runs of the same program exports rows carrying the program, duration and outcome', async () => {
    const csv = historyToCSV(TWO_RUNS_SAME_PROGRAM);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"Job","Result","Duration","Last time","Finished"');
    expect(lines).toHaveLength(3);   // header + 2 job rows
    expect(lines[1]).toContain('"bracket.nc"');
    expect(lines[1]).toContain('"done"');
    expect(lines[1]).toContain('"1m30s"');    // duration_s: 90
    expect(lines[2]).toContain('"bracket.nc"');
    expect(lines[2]).toContain('"done"');
    expect(lines[2]).toContain('"2m00s"');    // duration_s: 120
});

test('the repeat run is visible AS a repeat — the newer row\'s "Last time" links to the older run\'s duration', async () => {
    const csv = historyToCSV(TWO_RUNS_SAME_PROGRAM);
    const lines = csv.split('\r\n');
    // row 1 (newest, J2) -- last time is the OLDER run's duration (120s -> "2m00s")
    expect(lines[1]).toBe('"bracket.nc","done","1m30s","2m00s","2026-08-16 10:00:00"');
    // row 2 (the oldest run on record) -- nothing earlier to link to
    expect(lines[2]).toBe('"bracket.nc","done","2m00s","","2026-08-15 10:00:00"');
});

test('lastTimeDuration links by content_hash, not by the operator-typed name', async () => {
    const sameNameDifferentProgram = [
        { jobId: 'J2', name: 'part.nc', duration_s: 50, content_hash: 'HASH-B' },
        { jobId: 'J1', name: 'part.nc', duration_s: 999, content_hash: 'HASH-DIFFERENT' },   // same NAME, different program
    ];
    expect(lastTimeDuration(sameNameDifferentProgram, 0)).toBeNull();   // must NOT link on name alone
});

test('lastTimeDuration returns null with no content_hash at all (a pre-t2020 record, or a deliver-only job with no hash)', async () => {
    const noHash = [{ jobId: 'J1', name: 'x.nc', duration_s: 10 }];
    expect(lastTimeDuration(noHash, 0)).toBeNull();
});

test('a job name containing a quote and a comma is escaped correctly for a spreadsheet to parse', async () => {
    const rows = [{ jobId: 'J1', name: 'weird, "name".nc', final_state: 'done', duration_s: 5, ended_at: '2026-08-16T00:00:00' }];
    const csv = historyToCSV(rows);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine.startsWith('"weird, ""name"".nc"')).toBe(true);
});

test('an empty history exports just the header — openable, not an error', async () => {
    const csv = historyToCSV([]);
    expect(csv).toBe('"Job","Result","Duration","Last time","Finished"');
});

/**
 * t2049 — THE LIVE BUG: a stalled run (operator abort, lost link, or a real hang — indistinguishable to the
 * poller, see WORK-LOG) still carries a real duration_s whenever at least one beacon landed before the stall.
 * Before this fix, `lastTimeDuration` accepted ANY row with a non-null duration_s, so the most recent STALLED
 * run of a program — its duration measuring only "time until the watchdog gave up," not a real finish — fed
 * the next send's "last time" estimate as if it were a genuine completed run.
 */
test('a stalled run does NOT poison "last time" — the estimate skips it and links to the last genuine completion', async () => {
    const rows = [
        { jobId: 'J3', name: 'bracket.nc', final_state: 'delivered', duration_s: 0, content_hash: 'HASH-A' },      // the brand-new send, just landed
        { jobId: 'J2', name: 'bracket.nc', final_state: 'stalled', duration_s: 45, content_hash: 'HASH-A' },        // aborted/lost-link 45s in — NOT a real finish
        { jobId: 'J1', name: 'bracket.nc', final_state: 'done', duration_s: 600, content_hash: 'HASH-A' },          // the true last completion, 10 min
    ];
    // WITHOUT the fix this returned 45 (the stalled row's duration) — the true 600s completion never surfaces.
    expect(lastTimeDuration(rows, 0), 'skips the stalled 45s row, links to the real 600s completion').toBe(600);
    expect(lastTimeDuration(rows, 1), 'the stalled row itself also looks past itself to the real completion').toBe(600);
});

test('a program with ONLY stalled/failed runs on record has no real "last time" — reports unknown, not a guess', async () => {
    const rows = [
        { jobId: 'J2', name: 'bracket.nc', final_state: 'stalled', duration_s: 45, content_hash: 'HASH-A' },
        { jobId: 'J1', name: 'bracket.nc', final_state: 'failed', duration_s: null, content_hash: 'HASH-A' },
    ];
    expect(lastTimeDuration(rows, 0), 'no genuine completion exists yet — null, not a fabricated duration').toBeNull();
});

/**
 * t2073 — the "aborted" wording tension, resolved. Operator-abort / lost-link / a genuine hang are
 * structurally indistinguishable to the poller (t2049/t2064) — no channel exists to tell them apart, so
 * printing a cause word ("aborted") would be a guess dressed as fact. `resultLabel` stays honest (never
 * names a cause) while getting MORE PRECISE than the bare word "stalled", using data the poller already
 * records on every stalled row (last_beacon/total_beacons — poller.py _record_history) but the UI never
 * showed: exactly how far the run got before signal stopped.
 */
test('resultLabel: a non-stalled row passes through unchanged', () => {
    expect(resultLabel({ final_state: 'done' })).toBe('done');
    expect(resultLabel({ final_state: 'delivered' })).toBe('delivered');
    expect(resultLabel({})).toBe('—');
});

test('resultLabel: stalled with progress names exactly how far it got — no cause claimed', () => {
    expect(resultLabel({ final_state: 'stalled', last_beacon: 12, total_beacons: 40 }))
        .toBe('stalled — signal lost at 12/40');
    // total unknown (older record / deliver-only edge) — still precise about the checkpoint, honest about the total
    expect(resultLabel({ final_state: 'stalled', last_beacon: 7 }))
        .toBe('stalled — signal lost at checkpoint 7');
});

test('resultLabel: stalled with ZERO beacons is a genuinely different, more informative case', () => {
    // Delivered but no beacon ever arrived — likely Start was never pressed, or the link never came up at
    // all. Distinct from "died partway" without guessing WHICH of those it was.
    expect(resultLabel({ final_state: 'stalled', last_beacon: 0, total_beacons: 40 }))
        .toBe('stalled — no signal after delivery');
    expect(resultLabel({ final_state: 'stalled' }), 'last_beacon absent (older record) reads the same as 0').toBe('stalled — no signal after delivery');
});
