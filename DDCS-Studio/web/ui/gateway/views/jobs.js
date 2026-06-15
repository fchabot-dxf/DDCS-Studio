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
      el('th', {}, 'job'), el('th', {}, 'result'), el('th', {}, 'duration'), el('th', {}, 'finished')));
    for (const r of rows) {
      tbl.append(el('tr', {},
        el('td', { class: 'mono' }, r.name || r.jobId),
        el('td', {}, el('span', { class: 'pill ' + (r.final_state || '') }, r.final_state || '—')),
        el('td', { class: 'mono' }, r.duration_s == null ? '—' : fmtEta(r.duration_s)),
        el('td', { class: 'mono' }, fmtWhen(r.ended_at))));
    }
    c.append(tbl);
  },
};
