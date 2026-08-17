// ui/gateway/views/jobs.js — the job list: the live queue (with the active job's events) and the finished
// history, in one tab. Merges the fairy queue + history views. Read-only; polls. The big live tracker is its
// own "Tracking" tab (tracker.js).
import { el, fmtEta } from '../util.js';
import { UIUtils } from '../../uiUtils.js';   // t2024 — CSV export reuses the SAME download primitive backup.js/varListPanel.js already use, not a new one

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
      r.final_state || '',
      r.duration_s == null ? '' : fmtEta(r.duration_s),
      last == null ? '' : fmtEta(last),
      fmtWhen(r.ended_at),
    ].map(csvField).join(',');
  });
  return [header, ...lines].join('\r\n');   // CRLF — the convention spreadsheet apps expect from a CSV
}

export default {
  id: 'jobs',
  label: 'Jobs',

  mount(ctx) {
    this.queue = el('section', { class: 'block' });
    this.events = el('section', { class: 'block' });
    this.history = el('section', { class: 'block' });
    this._historyRows = [];   // t2024 — the last polled rows, so Export CSV has data to work with without a re-fetch
    ctx.root.append(this.queue, this.events, this.history);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    try { items = await ctx.client.listQueue(); } catch { /* keep last render */ }
    this.renderQueue(items);
    const active = items
      .filter((i) => ['delivering', 'running', 'delivered', 'stalled'].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.renderEvents(active);

    let rows = [];
    try { rows = await ctx.client.listHistory(); } catch { /* keep last render */ }
    this._historyRows = rows;
    this.renderHistory(rows);
  },

  renderQueue(items) {
    const c = this.queue;
    c.replaceChildren(el('div', { class: 'section-label' }, 'Queue'));
    if (!items || !items.length) { c.append(el('div', { class: 'muted' }, 'empty')); return; }
    for (const j of items)
      c.append(el('div', { class: 'q' },
        el('span', { class: 'pill ' + (j.state || 'queued') }, j.state || 'queued'),
        el('span', { class: 'mono' }, j.name || j.jobId)));
  },

  renderEvents(j) {
    const c = this.events;
    c.replaceChildren(el('div', { class: 'section-label' }, 'Events'));
    const ev = (j && j.events) || [];
    if (!ev.length) { c.append(el('div', { class: 'muted' }, '—')); return; }
    const ul = el('ul', { class: 'log' });
    [...ev].reverse().forEach((e) => ul.append(el('li', {}, e)));
    c.append(ul);
  },

  renderHistory(rows) {
    const c = this.history;
    const label = el('div', { class: 'section-label' }, 'History');
    if (!rows || !rows.length) { c.replaceChildren(label, el('div', { class: 'muted' }, 'no finished jobs yet')); return; }
    // t2024 — export the user's OWN data, in a file THEY choose, on a deliberate click: no restore, no
    // clear(), no coupling to the workspace open/save flow. That coupling is exactly why a backup.js row
    // was refused for this data (WORK-LOG t2022) — a plain export stands alone instead.
    const exportBtn = el('button', { class: 'op-btn', onclick: () => this.exportHistoryCSV() }, 'Export CSV');
    const tbl = el('table', {}, el('tr', {},
      el('th', {}, 'job'), el('th', {}, 'result'), el('th', {}, 'duration'), el('th', {}, 'last time'), el('th', {}, 'finished')));
    rows.forEach((r, i) => {
      const last = lastTimeDuration(rows, i);
      tbl.append(el('tr', {},
        el('td', { class: 'mono' }, r.name || r.jobId),
        el('td', {}, el('span', { class: 'pill ' + (r.final_state || '') }, r.final_state || '—')),
        el('td', { class: 'mono' }, r.duration_s == null ? '—' : fmtEta(r.duration_s)),
        el('td', { class: 'mono' }, last == null ? '—' : fmtEta(last)),
        el('td', { class: 'mono' }, fmtWhen(r.ended_at))));
    });
    c.replaceChildren(el('div', { class: 'row' }, label, exportBtn), tbl);
  },

  exportHistoryCSV() {
    const rows = this._historyRows || [];
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    UIUtils.downloadFile(`ddcs-job-history-${stamp}.csv`, historyToCSV(rows));
  },
};
