// ui/gateway/jobHistory.js — pure job-history helpers (t2024/t2049/t2073), extracted from jobs.js when Jobs
// folded into Send (t2241). Kept in their OWN module, separate from send.js: send.js pulls in heavy
// browser-only dependencies (createPreviewPanel, dialog.js, GcodeExecutionEngine, …), and these functions are
// deliberately pure — no DOM, no client, no bridge — so the node-tier test (job-history-csv-export-2024)
// can import them directly without a browser. Importing them FROM send.js broke that tier outright
// (`window is not defined`, dragged in through send.js's own import chain) — caught by actually running the
// test after moving the import, not assumed to still work.
import { fmtEta } from './util.js';

const fmtWhen = (iso) => (iso ? iso.replace('T', ' ').replace('Z', '') : '—');

// t2024 — extracted out of renderHistory (unchanged behaviour there) so the CSV export and the on-screen
// table share ONE definition of "last time this ran", rather than a second copy that could drift. rows
// arrive newest-first (list_history sorts recorded_at DESC), so the most recent EARLIER run of the SAME
// program (content_hash — a re-export links, a different feed does not; see send.js's contentHashOf) is the
// next match LATER in this array, with a real recorded duration.
//
// t2049 — gated on final_state === 'done', not just a non-null duration_s: a `stalled` row (operator abort,
// a genuinely lost link, or a real hang — the poller can't tell these apart, see WORK-LOG) still gets a
// duration_s whenever at least one beacon arrived before the stall, but that number measures "time until the
// watchdog gave up," never a real finish — poisoning "last time" with a truncated run's duration for every
// later send of the same program. `find` walks back through any interleaved stalled/failed rows to the most
// recent GENUINE completion; none found -> null ("—" on screen), not a fabricated number.
export function lastTimeDuration(rows, i) {
  const r = rows[i];
  if (!r.content_hash) return null;
  const prior = rows.slice(i + 1).find((p) => p.content_hash === r.content_hash && p.final_state === 'done');
  return prior ? prior.duration_s : null;
}

// t2073 — the "aborted" wording tension, resolved: operator-abort / lost-link / a genuine hang are
// STRUCTURALLY INDISTINGUISHABLE to the poller (t2049/t2064) — no channel exists to tell them apart, so a
// cause-word ("aborted") would be a guess dressed as a fact. What the poller DOES know, and already records
// on every stalled row (poller.py _record_history: last_beacon/total_beacons), is HOW FAR the run got before
// signal stopped — real, measured, unused until now. That is the honest axis: not WHY it stopped, only HOW
// FAR. "after delivery, no beacon at all" is itself informative (Start was likely never pressed / the link
// never came up) without claiming which.
export function resultLabel(r) {
  const state = r.final_state || '';
  if (state !== 'stalled') return state || '—';
  const n = r.last_beacon, total = r.total_beacons;
  if (!n) return 'stalled — no signal after delivery';
  return total ? `stalled — signal lost at ${n}/${total}` : `stalled — signal lost at checkpoint ${n}`;
}

// t2024 — one row per finished job, the SAME columns and formatting the on-screen table already shows, so
// what a machinist sees on screen is exactly what they get in the file. CSV, not JSON: this data's whole
// value is "how long did this take", and that question gets answered in a spreadsheet (sorted, summed,
// compared) — a machinist opens Excel/Sheets for that, not a JSON viewer. Repeats of the same program are
// visible the same way they are on screen: by name, and by the "last time" column linking back to the prior
// run via content_hash (t2020).
const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;
export function historyToCSV(rows) {
  const header = ['Job', 'Result', 'Duration', 'Last time', 'Finished'].map(csvField).join(',');
  const lines = rows.map((r, i) => {
    const last = lastTimeDuration(rows, i);
    return [
      r.name || r.jobId,
      resultLabel(r),
      r.duration_s == null ? '' : fmtEta(r.duration_s),
      last == null ? '' : fmtEta(last),
      fmtWhen(r.ended_at),
    ].map(csvField).join(',');
  });
  return [header, ...lines].join('\r\n');   // CRLF — the convention spreadsheet apps expect from a CSV
}

export { fmtWhen };
