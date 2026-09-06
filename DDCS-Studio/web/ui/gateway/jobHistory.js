// ui/gateway/jobHistory.js — pure job-history helpers (t2024/t2073), extracted from jobs.js when Jobs
// folded into Send (t2241). Kept in their OWN module, separate from send.js: send.js pulls in heavy
// browser-only dependencies (createPreviewPanel, dialog.js, GcodeExecutionEngine, …), and these functions are
// deliberately pure — no DOM, no client, no bridge — so the node-tier test (job-history-csv-export-2024)
// can import them directly without a browser. Importing them FROM send.js broke that tier outright
// (`window is not defined`, dragged in through send.js's own import chain) — caught by actually running the
// test after moving the import, not assumed to still work.
//
// t2649 (BACKLOG #78) — was ALSO `lastTimeDuration`/a `resultLabel` "stalled — signal lost at N/total" branch
// AND a Duration/Last-time pair of columns, all derived from the beacon mechanism's own per-job progress
// signal (`last_beacon`/`total_beacons`, and a `duration_s` measured from the FIRST beacon to completion).
// The beacon mechanism is REMOVED (owner-directed 2026-09-04, never demonstrably ran end-to-end) — delivery
// is now synchronous, so there is no separate "the cut finished" moment this process can observe for any
// job, and a Duration/Last-time column would always read "—" forever. Removed rather than left as dead
// furniture; `resultLabel`/`historyToCSV` now carry only what a delivery-only pipeline can honestly know.
const fmtWhen = (iso) => (iso ? iso.replace('T', ' ').replace('Z', '') : '—');

export function resultLabel(r) {
  return r.final_state || '—';
}

// t2024 — one row per finished job, the SAME columns and formatting the on-screen table already shows, so
// what a machinist sees on screen is exactly what they get in the file. CSV, not JSON.
const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;
export function historyToCSV(rows) {
  const header = ['Job', 'Result', 'Finished'].map(csvField).join(',');
  const lines = rows.map((r) => [
    r.name || r.jobId,
    resultLabel(r),
    fmtWhen(r.delivered_at || r.recorded_at),
  ].map(csvField).join(','));
  return [header, ...lines].join('\r\n');   // CRLF — the convention spreadsheet apps expect from a CSV
}

export { fmtWhen };
