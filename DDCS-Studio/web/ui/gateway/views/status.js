// ui/gateway/views/status.js — Gateway landing tab: connection state, which controller answers, and a live
// read-only values snapshot (readVars). All reads, never writes — safe even when away from the machine
// (see [[live-cnc-readonly-when-away]]). Polled while visible.
import { el } from '../util.js';
import { deriveStatus, deviceName } from '../../../shared/js/client.js';
import { EXE_DOWNLOAD_URL } from '../../gatewayStatus.js';
import { readGatewayHeartbeat, canSendViaDrive } from '../../cloud/driveJobs.js';   // t2112 - the machine's OWN report, when this device has no gateway
import { getMachine } from '../../../data/workspaceMachine.js';

export default {
  id: 'status',
  label: 'Status',

  mount(ctx) {
    this.conn = el('section', { class: 'block' });
    this.desc = el('section', { class: 'block' });
    this.vars = el('section', { class: 'block' });
    // t2093 — the desktop-download offer, UNCONDITIONAL (human ruling): not gated on whether a gateway is
    // reachable, not hidden when the exe is already running — "its not because i have the app open that i
    // dont want to download it again." Static content, built once here rather than on every onPoll() like
    // the sections above (nothing in it depends on connection state). Reuses .gateway-dl-pop/.dl-btn/.dl-note
    // (styles.css, t2073) — the same markup + copy the old click-toggled popover used (removed in 9256574f
    // when the tab stopped gating on a gateway answering); .gateway-dl-pop's own position:fixed is dropped
    // (styles.css) since this is now a permanent in-flow card, not a floating overlay anchored to a click.
    this.download = el('section', { class: 'block gateway-dl-pop' },
      el('p', {}, 'The Gateway talks to your controller, so it runs on your own PC — not in the cloud.'),
      el('a', { class: 'dl-btn', href: EXE_DOWNLOAD_URL, target: '_blank', rel: 'noopener' },
         '⬇ Download DDCS Studio for desktop'),
      el('p', { class: 'dl-note' }, 'Full app — Studio + Gateway in one exe.'));
    // t2112 - THIS TAB ASKED THE WRONG QUESTION ON A PHONE. It reports whether THIS DEVICE can reach a
    // gateway, which on a phone is always 'no' and always will be - there is no daemon on a phone and
    // never will be. So it rendered 'unreachable - still looking on this PC' plus a desktop download
    // link, on a device that cannot run an exe, describing a failure when nothing had failed.
    // ⭐ THE USEFUL QUESTION FROM A PHONE IS A DIFFERENT ONE: is my MACHINE'S gateway alive, and is the
    //    mill on? The gateway already answers both every 20s in gateway/heartbeat.json - the same source
    //    the Send tab gates on. Asking it here stops two adjacent tabs telling different stories about
    //    one fact (Send greyed 'no gateway running' beside Status saying 'install the desktop app').
    // ⛔ REFRAME, NEVER HIDE (ROLES-PLAN section 1): checking on the machine from somewhere else is most
    //    of why you would open Studio on a phone at all.
    // ⚠ THROTTLED: unlike the descriptor (a localhost call) this is a Google request and onPoll runs
    //    whenever the tab is visible. Only asked with NO local daemon and signed in, and no faster than
    //    the 20s heartbeat it reads.
    this._hb = null; this._hbAt = 0;
    this._refreshHeartbeat = async () => {
      if (!canSendViaDrive()) { this._hb = null; return; }
      if (Date.now() - this._hbAt < 30000) return;
      this._hbAt = Date.now();
      try { this._hb = await readGatewayHeartbeat((getMachine() || {}).name); }
      catch (_) { this._hb = { state: 'unreadable' }; }   // ignorance, not absence
    };
    ctx.root.append(this.conn, this.desc, this.vars, this.download);
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
        el('span', { class: 'job' },
           // ⚠ 'unreachable' is a verdict about THIS device. When the MACHINE has reported in, say that
           //    instead - this tab is about the machine, not about the phone looking at it.
           (!d && this._hb && this._hb.state === 'fresh') ? 'no gateway on this device' : (s.label || 'unreachable')),
        s.device ? el('span', { class: 'muted' }, '· ' + s.device) : null));

    if (!d) await this._refreshHeartbeat();
    const hb = (!d && this._hb) || null;
    const live = (hb && hb.state === 'fresh' && hb.hb) || null;
    this.desc.replaceChildren(el('div', { class: 'section-label' }, 'Controller'));
    if (live) {
      // ⭐ THREE STATES, NOT TWO - the mill is observable ONLY through its gateway, so with none running
      //    its state is UNKNOWN and must never be drawn as 'off'. Same rule and same dots as Send.
      const on = live.controller_connected === true;
      const host = live.hostname ? ' (' + live.hostname + ')' : '';
      this.desc.append(
        el('div', { class: 'row hb-row' }, el('span', { class: 'hb-dot ok' }),
           el('span', {}, 'Gateway' + host + ' is running')),
        el('div', { class: 'row hb-row' }, el('span', { class: 'hb-dot ' + (on ? 'ok' : 'bad') }),
           el('span', {}, on ? 'Machine is powered on' : 'Machine is switched off')),
        el('div', { class: 'muted', style: 'margin-top:6px' },
           String(live.controller_name || live.controller_family || 'controller unknown')
           + (hb.ageS != null ? '  ·  last seen ' + Math.round(hb.ageS) + 's ago' : '')));
    } else if (hb && (hb.state === 'stale' || hb.state === 'unseen' || hb.state === 'unreadable')) {
      // t2113 - THE NEGATIVE ANSWER IS STILL AN ANSWER, and leaving it out was my own gap. t2112 taught this
      // tab to report the machine, but only accepted 'fresh' - so a gateway that STOPPED, or a Drive that
      // would not answer, fell straight back to 'still looking on this PC', the phone-hostile copy t2112
      // existed to remove. Send already words all three states correctly off the SAME heartbeat, so the two
      // tabs disagreed about one fact again - the exact failure t2112 was fixing, one state to the left.
      // ⚠ 'unreadable' is IGNORANCE, NOT ABSENCE, and must not be phrased as 'no gateway': the browser
      //    reading a DESKTOP-written Drive file is the one visibility direction never measured, so a failed
      //    lookup may mean we cannot see rather than that nothing is there. Amber, and it says so.
      const stale = hb.state === 'stale';
      const unreadable = hb.state === 'unreadable';
      this.desc.append(
        el('div', { class: 'row hb-row' }, el('span', { class: 'hb-dot ' + (unreadable ? 'unknown' : 'bad') }),
           el('span', {}, unreadable
             ? 'Studio could not check whether a gateway is running (your Drive did not answer)'
             : stale
               ? ('The gateway for this machine last checked in '
                  + (hb.ageS != null ? Math.round(hb.ageS / 60) + ' min ago' : 'a while ago'))
               : 'Studio cannot see a gateway for this machine on your Drive')),
        el('div', { class: 'row hb-row' }, el('span', { class: 'hb-dot unknown' }),
           el('span', {}, 'Machine state unknown — no gateway to ask')));
    } else if (!d) {
      this.desc.append(
        // t1325 — THE MESSAGE IS NOW A PATH, not a description of one. It named the Console tab while the Console had
        // no daemon field to name; the field exists now, so the sentence CARRIES you there and focuses it. A message
        // that tells you where to go should be the thing that takes you.
        el('div', { class: 'muted' },
          'No gateway answering — still looking on this PC. ',
          el('a', { href: '#', class: 'gw-link', id: 'gw-goto-console',
                    onclick: (e) => { e.preventDefault(); if (window.ddcsGatewayGoConsole) window.ddcsGatewayGoConsole(); } },
             'Enter a daemon URL in the Console tab'),
          ' if it is somewhere else.'));
      // t2093 — the inline "⬇ Get DDCS Studio for desktop" link that used to sit here is gone: the download
      // offer below (this.download, mount()) is now unconditional and covers this case too, so this branch
      // only needs to state ITS OWN specific guidance (finding an already-running gateway).
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
