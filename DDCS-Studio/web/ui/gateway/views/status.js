// ui/gateway/views/status.js — Gateway landing tab: connection state, which controller answers, and a live
// read-only values snapshot (readVars). All reads, never writes — safe even when away from the machine
// (see [[live-cnc-readonly-when-away]]). Polled while visible.
import { el } from '../util.js';
import { deriveStatus, deviceName } from '../../../shared/js/client.js';
import { EXE_DOWNLOAD_URL, roleInfoFromDescriptor, roleIdentity } from '../../gatewayStatus.js';   // t2151 — the workspace-relative role, applied to THIS view's own freshly-fetched `d` below (not gatewayStatus.js's separately-polled cache — see that function's own comment). t2173 — roleIdentity() is the declared headline/detail wording, this view's own STATED-identity line below
import { readGatewayHeartbeat, canSendViaDrive } from '../../cloud/driveJobs.js';   // t2112 - the machine's OWN report, when this device has no gateway
import { fileSavedStem } from '../../../data/backup.js';   // t2101/t2145 - the Drive folder the gateway publishes under is keyed by the workspace's name — now the last-saved .ddcs file's name

export default {
  id: 'status',
  label: 'Status',

  mount(ctx) {
    // t2173 (ROLES S3) — THE STATED IDENTITY. Above Connection/Controller (unchanged below), a loud line that
    // answers "is this PC the gateway, or a client?" without making the reader infer it from which rows show up
    // further down. Reuses the pre-flight badge's PILL language (styles.css `.role-identity`) — bold, coloured,
    // never `.muted` — because that is this app's established way of stating a state a screenshot must still
    // carry with no surrounding context (see this view's onPoll() for the three renderings).
    this.identity = el('section', { class: 'block' });
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
    // t2113 - the desktop-download offer MOVED TO THE QUICK MENU (human: "maybe the exe download can go
    // back in the quick menu"). Still UNCONDITIONAL - that ruling is unchanged, it just lives in
    // headerPost.js's downloadRow now. It stopped being a bordered card with a filled primary button under
    // a gateway reading `live`, which read as an action to take while already running the app offered.
    // Do not re-add it here without removing it there: two doors to one download is the shape t2077 spent
    // a turn deleting for the account.
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
      try { this._hb = await readGatewayHeartbeat(fileSavedStem()); }
      catch (_) { this._hb = { state: 'unreadable' }; }   // ignorance, not absence
    };
    ctx.root.append(this.identity, this.conn, this.desc, this.vars);
    this.onPoll(ctx);
  },

  async onPoll(ctx) {
    let d = null;
    try { d = await ctx.client.descriptor(); } catch { d = null; }
    const s = deriveStatus(ctx.client, d);
    // t2151 (BACKLOG #9's dispatch, human: "the status tab should look different in client vs gateway") — THE
    // QUESTION THIS TAB ASKS DEPENDS ON ROLE, not merely on whether THIS PC happens to run a daemon. A client
    // with its OWN local daemon (an exe installed, but wired to a different controller than this workspace, or
    // to none) still cannot answer "is my machine's gateway alive" from its own descriptor — that descriptor
    // describes THIS PC's non-matching hardware, not the workspace's actual gateway. Role, from the same
    // workspace-relative seam the identity line and admin.js's gating now both read.
    const { role, reason: roleReason } = roleInfoFromDescriptor(d);
    const askMachine = role === 'client';   // t2151 — was `!d`; a client with a local daemon still asks this

    // t2173 — THE IDENTITY LINE. roleInfoFromDescriptor's own role/reason (just derived above) map 1:1 onto
    // roleIdentity's three kinds (gateway / plain client / mismatch) — no new data, this is presentation only.
    const id = roleIdentity(d);
    this.identity.replaceChildren(
      el('div', { class: 'role-identity role-' + id.kind },
        el('div', { class: 'role-headline' }, id.headline),
        id.detail ? el('div', { class: 'role-detail' }, id.detail) : null));

    this.conn.replaceChildren(
      el('div', { class: 'section-label' }, 'Connection'),
      el('div', { class: 'row' },
        el('span', { class: 'dot ' + (s.dot || 'bad') }),
        el('span', { class: 'job' },
           // ⚠ 'unreachable' is a verdict about THIS device. When the MACHINE has reported in, say that
           //    instead - this tab is about the machine, not about the phone looking at it.
           (!d && this._hb && this._hb.state === 'fresh') ? 'no gateway on this device' : (s.label || 'unreachable')),
        s.device ? el('span', { class: 'muted' }, '· ' + s.device) : null));

    if (askMachine) await this._refreshHeartbeat();
    const hb = (askMachine && this._hb) || null;
    const live = (hb && hb.state === 'fresh' && hb.hb) || null;
    this.desc.replaceChildren(el('div', { class: 'section-label' }, 'Controller'));
    // t2151 (BACKLOG #11 care #3) — a workspace-mismatch demotion states WHY, right where the reframed
    // question appears — never just a bare role flip.
    if (roleReason) this.desc.append(el('div', { class: 'muted', style: 'margin-bottom:6px' }, roleReason));
    if (live) {
      // ⭐ THREE STATES, NOT TWO - the mill is observable ONLY through its gateway, so with none running
      //    its state is UNKNOWN and must never be drawn as 'off'. Same rule and same dots as Send.
      const on = live.controller_connected === true;
      const host = live.hostname ? ' (' + live.hostname + ')' : '';
      // t2173 (ROLES S3, human: "should be clear its a remote gateway") — "Gateway (SHOP-PC) is running" only
      // reads as remote to someone who already knows SHOP-PC isn't their own machine. This branch is reached
      // ONLY when role === 'client' (askMachine, above) — true by construction that the gateway for THIS
      // workspace is not this PC — so saying "remote" here needs no second check, it is a fact of the branch.
      this.desc.append(
        el('div', { class: 'row hb-row' }, el('span', { class: 'hb-dot ok' }),
           el('span', {}, 'Remote gateway' + host + ' is running')),
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
    } else if (askMachine && !d) {
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
    } else if (askMachine) {
      // t2151 — a CLIENT with its OWN local daemon (this PC runs the exe, but is not this workspace's
      // gateway) reaches here instead of the `!d` branch above: a daemon already answers on this PC, so
      // "enter a daemon URL" would be actively wrong advice. The real blocker is Drive not being checkable
      // (not signed in, or a fresh sign-in that has not published a heartbeat yet) — say that instead.
      this.desc.append(el('div', { class: 'muted' },
        'Studio could not check the workspace\'s gateway status — sign in to Drive (workspace manager → Cloud) to read its heartbeat.'));
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
