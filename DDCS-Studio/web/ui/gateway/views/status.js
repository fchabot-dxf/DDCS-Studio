// ui/gateway/views/status.js — Gateway landing tab: connection state, which controller answers, and a live
// read-only values snapshot (readVars). All reads, never writes — safe even when away from the machine
// (see [[live-cnc-readonly-when-away]]). Polled while visible.
import { el } from '../util.js';
import { deriveStatus, deviceName } from '../../../shared/js/client.js';
import { EXE_DOWNLOAD_URL } from '../../gatewayStatus.js';

export default {
  id: 'status',
  label: 'Status',

  mount(ctx) {
    this.conn = el('section', { class: 'block' });
    this.desc = el('section', { class: 'block' });
    this.vars = el('section', { class: 'block' });
    ctx.root.append(this.conn, this.desc, this.vars);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let d = null;
    try { d = await ctx.client.descriptor(); } catch { d = null; }
    const s = deriveStatus(ctx.client, d);

    this.conn.replaceChildren(
      el('div', { class: 'section-label' }, 'Connection'),
      el('div', { class: 'row' },
        el('span', { class: 'dot ' + (s.dot || 'bad') }),
        el('span', { class: 'job' }, s.label || 'unreachable'),
        s.device ? el('span', { class: 'muted' }, '· ' + s.device) : null));

    this.desc.replaceChildren(el('div', { class: 'section-label' }, 'Controller'));
    if (!d) {
      this.desc.append(
        el('div', { class: 'muted' }, 'No gateway answering. Connect one in the Console tab (a local daemon or a service URL), or:'),
        el('a', { class: 'op-btn', href: EXE_DOWNLOAD_URL, target: '_blank', rel: 'noopener',
                  style: 'margin-top:10px;display:inline-block;text-decoration:none' }, '⬇ Get DDCS Studio for desktop'));
    } else {
      const rows = [
        ['machine', d.machine_name || deviceName(d) || '—'],
        ['controller disk', d.dest || '—'],
        ['connected', d.controller_connected ? 'yes' : ('online' in d ? (d.online ? 'cloud' : 'offline') : 'no')],
        ['backend', d.backend || '—'],
        ['gateway version', d.version || '—'],
      ];
      const tbl = el('table');
      for (const [k, v] of rows) tbl.append(el('tr', {}, el('td', {}, k), el('td', { class: 'mono' }, String(v))));
      this.desc.append(tbl);
    }

    // Live values — read-only watch list (gateway-defined shape; render defensively).
    this.vars.replaceChildren(el('div', { class: 'section-label' }, 'Live values  (read-only)'));
    let v = null;
    try { v = await ctx.client.readVars([]); } catch { v = null; }
    const entries = v && typeof v === 'object' ? Object.entries(v.values || v) : [];
    if (!entries.length) { this.vars.append(el('div', { class: 'muted' }, 'no watch list (set one on the gateway)')); return; }
    const grid = el('div', { class: 'grid-3' });
    for (const [k, val] of entries.slice(0, 12))
      grid.append(el('div', { class: 'stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, String(val))));
    this.vars.append(grid);
  },
};
