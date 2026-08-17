// ui/gateway/views/jobs.js — the job list: the live queue (with the active job's events) and the finished
// history, in one tab. Merges the fairy queue + history views. Read-only; polls. The big live tracker is its
// own "Tracking" tab (tracker.js).
import { el, fmtEta } from '../util.js';

const fmtWhen = (iso) => (iso ? iso.replace('T', ' ').replace('Z', '') : '—');

export default {
  id: 'jobs',
  label: 'Jobs',

  mount(ctx) {
    this.queue = el('section', { class: 'block' });
    this.events = el('section', { class: 'block' });
    this.history = el('section', { class: 'block' });
    ctx.root.append(this.queue, this.events, this.history);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let items = [];
    try { items = await ctx.client.listQueue(); } catch { /* keep last render */ }
    this.renderQueue(items);
    const active = items
      .filter((i) => ['running', 'delivered', 'stalled'].includes(i.state))
      .sort((a, b) => (a.jobId < b.jobId ? 1 : -1))[0];
    this.renderEvents(active);

    let rows = [];
    try { rows = await ctx.client.listHistory(); } catch { /* keep last render */ }
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
    c.replaceChildren(el('div', { class: 'section-label' }, 'History'));
    if (!rows || !rows.length) { c.append(el('div', { class: 'muted' }, 'no finished jobs yet')); return; }
    const tbl = el('table', {}, el('tr', {},
      el('th', {}, 'job'), el('th', {}, 'result'), el('th', {}, 'duration'), el('th', {}, 'last time'), el('th', {}, 'finished')));
    // t2020 — "last time": rows arrive newest-first (list_history sorts recorded_at DESC), so the most recent
    // EARLIER run of the SAME program (matched by content_hash — a re-export links, a different feed does not,
    // per send.js's own contentHashOf) is the next match LATER in this array, with a real recorded duration.
    rows.forEach((r, i) => {
      let lastTime = '—';
      if (r.content_hash) {
        const prior = rows.slice(i + 1).find((p) => p.content_hash === r.content_hash && p.duration_s != null);
        if (prior) lastTime = fmtEta(prior.duration_s);
      }
      tbl.append(el('tr', {},
        el('td', { class: 'mono' }, r.name || r.jobId),
        el('td', {}, el('span', { class: 'pill ' + (r.final_state || '') }, r.final_state || '—')),
        el('td', { class: 'mono' }, r.duration_s == null ? '—' : fmtEta(r.duration_s)),
        el('td', { class: 'mono' }, lastTime),
        el('td', { class: 'mono' }, fmtWhen(r.ended_at))));
    });
    c.append(tbl);
  },
};
