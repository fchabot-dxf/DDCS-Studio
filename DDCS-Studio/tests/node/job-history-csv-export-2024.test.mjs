import { test, expect } from './support/harness.mjs';
import { historyToCSV, resultLabel } from '../../web/ui/gateway/jobHistory.js';   // t2241 — moved here (a separate, browser-free module) when Jobs folded into Send

/**
 * job-history-csv-export-2024 — EXPORT JOB HISTORY (t2024): a plain "Export CSV" button on the Jobs view's
 * History table, standing alone — no restore, no clear(), no coupling to the workspace open/save flow (that
 * coupling is exactly why a backup.js row was refused for this data, WORK-LOG t2022).
 *
 * `historyToCSV`/`resultLabel` are pure — no DOM, no client, no bridge — so they are testable directly here
 * without Playwright. `exportHistoryCSV`'s own DOM wiring (the click → UIUtils.downloadFile → Blob/anchor
 * flow) is NOT covered in this tier. `UIUtils.downloadFile` itself is exercised elsewhere (backup.js,
 * varListPanel.js callers); the new surface here is only the CSV content, which is what these tests prove.
 *
 * t2649 (BACKLOG #78) — was ALSO `lastTimeDuration` and a `resultLabel` "stalled — signal lost at N/total"
 * branch, plus Duration/Last-time columns, all derived from the removed beacon mechanism's own per-job
 * progress signal (`last_beacon`/`total_beacons`/`duration_s`). Delivery is now synchronous — there is no
 * "how long did the cut take" signal this process can observe — so the CSV shrinks to Job/Result/Finished,
 * and `resultLabel` is a bare pass-through of `final_state`. Rewritten rather than left asserting on removed
 * behaviour.
 */

// Newest-first, matching what backend.list_history() actually returns (poller.py sorts recorded_at DESC).
const TWO_RUNS_SAME_PROGRAM = [
    { jobId: 'J2', name: 'bracket.nc', final_state: 'delivered', delivered_at: '2026-08-16T10:00:00Z', content_hash: 'HASH-A' },
    { jobId: 'J1', name: 'bracket.nc', final_state: 'delivered', delivered_at: '2026-08-15T10:00:00Z', content_hash: 'HASH-A' },
];

test('a real history with 2 runs of the same program exports rows carrying the program and outcome', async () => {
    const csv = historyToCSV(TWO_RUNS_SAME_PROGRAM);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"Job","Result","Finished"');
    expect(lines).toHaveLength(3);   // header + 2 job rows
    expect(lines[1]).toBe('"bracket.nc","delivered","2026-08-16 10:00:00"');
    expect(lines[2]).toBe('"bracket.nc","delivered","2026-08-15 10:00:00"');
});

test('a failed job reports its final_state honestly', () => {
    const rows = [{ jobId: 'J1', name: 'bracket.nc', final_state: 'failed', delivered_at: '2026-08-16T10:00:00Z' }];
    const csv = historyToCSV(rows);
    expect(csv.split('\r\n')[1]).toContain('"failed"');
});

test('a job name containing a quote and a comma is escaped correctly for a spreadsheet to parse', async () => {
    const rows = [{ jobId: 'J1', name: 'weird, "name".nc', final_state: 'delivered', delivered_at: '2026-08-16T00:00:00Z' }];
    const csv = historyToCSV(rows);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine.startsWith('"weird, ""name"".nc"')).toBe(true);
});

test('an empty history exports just the header — openable, not an error', async () => {
    const csv = historyToCSV([]);
    expect(csv).toBe('"Job","Result","Finished"');
});

test('finished falls back to recorded_at when delivered_at is absent', () => {
    const rows = [{ jobId: 'J1', name: 'x.nc', final_state: 'delivered', recorded_at: '2026-08-16T00:00:00Z' }];
    const csv = historyToCSV(rows);
    expect(csv.split('\r\n')[1]).toBe('"x.nc","delivered","2026-08-16 00:00:00"');
});

test('resultLabel passes final_state through unchanged, or reports unknown honestly', () => {
    expect(resultLabel({ final_state: 'delivered' })).toBe('delivered');
    expect(resultLabel({ final_state: 'failed' })).toBe('failed');
    expect(resultLabel({})).toBe('—');
});
