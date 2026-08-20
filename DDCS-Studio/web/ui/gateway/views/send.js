// ui/gateway/views/send.js — send a program to the controller. Ported from the fairy submit view, adapted to
// Studio: drop a .nc OR pull the current Studio editor program, optionally instrument it with beacons for
// progress tracking, then submitJob to the gateway queue. A WRITE op — the operator still presses Cycle Start.
import { el, toast } from '../util.js';
import { contractFor, isUnreachable } from '../state.js';   // t1327 — the declared connection-state contract
import { instrument, DEFAULTS } from '../../../shared/js/instrument/instrument.js';
import { dlgConfirm, dlgNotice } from '../../dialog.js';
import { checkEnvelope } from '../../../engine/envelopeCheck.js';   // t838 — pre-flight before the push
import { GcodeExecutionEngine } from '../../../engine/GcodeExecutionEngine.js';   // t1585 — the send gate reads the FILE, with the same parser the sim runs
import { compareController, mismatchStatement } from '../../../data/controllerMatch.js';   // t1229 A2 — the ONE comparison, shared with the pull
import { createPreviewPanel } from '../../../viz/createPreviewPanel.js';
import { normaliseGcode } from '../../../data/portingArc.js';   // t2020 — REUSED, not reimplemented: the V4.1 oracle's own strip-CRLF/drop-blank-comment/collapse-whitespace normaliser, so a job's content hash agrees on the SAME program regardless of line-ending or spacing noise

const field = (labelText, control) => el('div', {}, el('span', { class: 'label' }, labelText), control);
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const clampInt = (v, lo, hi, d) => Math.min(hi, Math.max(lo, int(v, d)));

// t2020 — JOB IDENTITY: a SHA-256 of the NORMALISED (pre-instrumentation) G-code, so History can link two
// sends of the identical program regardless of whether Beacons was ticked or how many beacon points were
// configured (both would change the WIRE bytes without changing the logical job). Deliberately hashes the
// ORIGINAL text the operator is sending, not the instrumented `nc` that later gets written to the controller.
// What this gets right: a re-export with a changed comment/header/line-ending links (the normaliser strips
// exactly that noise). What this gets wrong, on purpose: the same geometry at a different feed does NOT link
// — a real cut-time difference is a genuinely different job, and normalisation was never meant to erase that.
async function contentHashOf(text) {
  const bytes = new TextEncoder().encode(normaliseGcode(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  id: 'send',
  label: 'Send',

  mount(ctx) {
    let file = { name: '', text: '' };
    let previewPanel = null;

    ctx.root.style.display = 'flex';
    ctx.root.style.flexDirection = 'column';
    ctx.root.style.height = '100%';

    const drop = el('div', { class: 'drop' }, '⤓  Drop a .nc here, or click to choose');
    const input = el('input', { type: 'file', accept: '.nc,.tap,.txt,.gcode', style: 'display:none' });
    const useStudio = el('button', { class: 'op-btn' }, '⬆ Use current Studio program');
    const nameField = el('input', { type: 'text', placeholder: 'job name (e.g. bracket_v3.nc)', style: 'flex:1' });

    const beacons = el('input', { type: 'checkbox', checked: '' });
    const count = el('input', { type: 'number', value: String(DEFAULTS.max), min: '1', max: '255', style: 'width:90px' });
    const pacing = el('select', {},
      el('option', { value: 'time' }, 'by time (wall-clock)'),
      el('option', { value: 'line' }, 'by line count'));
    const varN = el('input', { type: 'number', value: String(DEFAULTS.varNum), style: 'width:70px' });
    const markerV = el('input', { type: 'number', value: String(DEFAULTS.markerVar), style: 'width:70px' });
    const markerN = el('input', { type: 'number', value: String(DEFAULTS.marker), style: 'width:70px' });

    const settings = el('div', { class: 'block' },
      el('div', { class: 'grid-2' }, field('Beacon count (1–255)', count), field('Pacing', pacing)),
      el('details', {},
        el('summary', { class: 'muted', style: 'cursor:pointer;margin:8px 0' }, 'advanced — var / marker (rarely changed; the frame is proven)'),
        el('div', { class: 'grid-3' }, field('counter var', varN), field('marker var', markerV), field('marker value', markerN))));

    const btn = el('button', { class: 'primary', disabled: '' }, 'Send (tracked)');
    const info = el('div', { class: 'hint' });
    const previewContainer = el('div', { style: 'flex: 1; min-height: 300px; margin-top: 15px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;' });

    const accept = (name, text) => {
      file = { name, text };
      nameField.value = name;
      drop.textContent = `✓ ${name} (${text.length} bytes)`;
      btn.disabled = !text;
      
      if (!previewPanel) {
        previewPanel = createPreviewPanel(previewContainer, {
          getGcode: () => file.text,
          getStock: () => ({ x: 0, y: 0, z: 0 })   // no stock in the send preview — this is foreign G-code, the workspace stock doesn't apply
        });
        previewPanel.setActive(true);
      } else {
        if (previewPanel.refresh) previewPanel.refresh();
      }
    };
    const sync = () => {
      settings.classList.toggle('hidden', !beacons.checked);
      btn.textContent = beacons.checked ? 'Send (tracked)' : 'Send (deliver-only)';
    };
    beacons.onchange = sync;

    const load = (f) => { const r = new FileReader(); r.onload = () => accept(f.name, String(r.result)); r.readAsText(f); };
    drop.onclick = () => input.click();
    input.onchange = (e) => e.target.files[0] && load(e.target.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && load(e.dataTransfer.files[0]); };
    useStudio.onclick = () => {
      const text = (document.getElementById('editor')?.value || '').trim();
      if (!text) { toast('Studio editor is empty', true); return; }
      accept('studio-program.nc', text);
    };

    btn.onclick = async () => {
      const name = (nameField.value || file.name || 'job.nc').trim();
      btn.disabled = true;
      try {
        // t1229 A2 — THE MISMATCH HARD BLOCK (user ruling). A push is a WRITE to a physical machine: if the controller
        // on the other end is not the one this workspace was built for, then its envelope, WCS, tool table and macros
        // were all written for a different machine — so there is no "send anyway" here, and no duplicate offer either
        // (that belongs on the read side). One statement, one way out.
        // An UNIDENTIFIED controller is not a mismatch: if the gateway cannot say what it is, we cannot claim it is
        // wrong, and the send keeps its existing guards.
        try {
          const prof = await ctx.client.profile();
          const cmp = compareController(prof && prof.id);
          if (!cmp.match) {
            await dlgNotice(
              mismatchStatement(cmp)
              + '\n\nThis program was not made for the machine on the other end, so nothing here can be sent to it — '
              + 'its travel, work offsets, tool table and macros all belong to a different controller.',
              { title: 'Wrong controller — send blocked', okLabel: 'Cancel' },
            );
            return;   // the finally block re-enables the button
          }
        } catch (_) { /* no gateway answer → nothing to compare; the other guards still apply */ }

        // t1585 THE SEND GATE — REFUSE WHAT THE CONTROLLER WOULD REFUSE, JUDGED FROM THE FILE.
        //
        // Runs BEFORE the envelope check on purpose: a file whose coordinates do not parse cannot be meaningfully
        // envelope-checked, and an unreadable line is a definite fault rather than a judgement call. Bench-confirmed
        // on the V4.1: the controller answers `Unrecognized file format: L<n>[<line>]` — and probe S6e proved it
        // executes every line BEFORE the fault first. So sending one of these does not merely fail: the operations
        // ahead of it CUT, then the machine halts with the tool still in the material.
        //
        // JUDGED FROM THE FILE, never from Studio's memory of having built it. This view pushes an ARBITRARY file —
        // imported, hand-edited, or authored elsewhere — so block-side knowledge does not apply and would be absent
        // in the case that matters most. `defaultSyntaxVerify` is the same parser the sim runs, which is what makes
        // "what the controller would refuse" a claim worth standing behind.
        //
        // ⚠ THE TOLERANCE IS ASYMMETRIC. Too STRICT is a FALSE REFUSAL that stops real work; too LENIENT waves
        // through a file the controller rejects. Every tightening here is hardware-attested, never guessed: the
        // one leniency this shipped with (an unclosed bracket parsed) was PINNED until probe S6f returned, and it
        // returned REFUSED (t1601) — the parser now rejects it like the machine, blaming the OPENING bracket's
        // line where the hardware blames EOF. The mirror case is why the comma form landed first (t1583): before
        // it, this gate would have refused `ATAN[1, 1]` — which the hardware ACCEPTS — on day one.
        //
        // A RUNTIME TOKEN IS NOT A FAULT: `#500`, `#1512`, a probe result `#5063`, `[#100 + 5]` all verified to pass.
        // Fifth act running for that carve-out.
        //
        // ASKS rather than hard-blocks, matching the envelope gate below and for the reason stated there: the machine
        // is the USER'S. This makes the consequence impossible to miss; it does not take the decision away.
        try {
          const syn = GcodeExecutionEngine.defaultSyntaxVerify(file.text);
          if (syn && syn.valid === false && syn.errors.length) {
            // ONE ROW PER LINE. The word tokeniser emits a separate error per LETTER of an unreadable word, so
            // `G0 Xwidht / 2` arrives as six errors for one line — six rows about one mistake reads as noise and
            // buries the line number, which is the one thing the operator actually needs.
            const byLine = new Map();
            for (const e of syn.errors) if (!byLine.has(e.lineIndex)) byLine.set(e.lineIndex, e);
            const shown = [...byLine.values()].slice(0, 5).map((e) => `line ${e.lineIndex + 1}: ${String(e.line || '').trim()}`);
            const more = byLine.size > 5 ? [`…and ${byLine.size - 5} more`] : [];
            const msg = [
              `This file has ${byLine.size} line${byLine.size > 1 ? 's' : ''} the controller cannot read:`,
              '',
              ...shown, ...more,
              '',
              'It will refuse the file with "Unrecognized file format", naming that line — but NOT before running',
              'every line ahead of it, so the earlier operations cut for real and the machine then halts with the',
              'tool still in the material.',
              '',
              'Send to the controller anyway?',
            ].join('\n');
            const ok = await dlgConfirm(msg,
              { title: 'The controller cannot read this file', danger: true, okLabel: 'Send anyway', cancelLabel: 'Cancel' });
            if (!ok) return;   // the finally block re-enables the button
          }
        } catch (_) { /* advisory — a checker fault must never block a send */ }

        // t838 PRE-FLIGHT ENVELOPE CHECK — warn before pushing a program that would leave the machine travel. The machine
        // is the USER's, so we ASK (an explicit confirm), never silently block. Fires only on RED (declared placement +
        // a real breach); advisory (a checker error never blocks the send).
        try {
          const pre = checkEnvelope(file.text, (window.ddcsGetSettings && window.ddcsGetSettings()) || {});
          if (pre.status === 'red') {
            const hasNoSpindle = pre.violations.some(v => v.kind === 'no-spindle');   // t947 — the DEAD-SPINDLE breach leads (most severe)
            const hasStock = pre.violations.some(v => v.kind === 'through-stock');   // t937 — a through-stock kind softens the envelope-only wording
            // t973 — soft limits OFF on the controller (softLimitsPulled===false) → a travel breach is UNGUARDED (the machine
            // will NOT stop itself; a hard-stop crash risk). ADDITIVE — the send is already gated red; this only escalates the wording.
            const unguarded = pre.softLimitsEnforced === false && pre.violations.some(v => v.kind === 'soft-limit');
            const top = pre.violations.slice(0, 4).map(v =>
              v.kind === 'no-spindle' ? `line ${v.line}: cuts with the spindle OFF (no M3)`
              : v.kind === 'through-stock' ? `line ${v.line}: crosses the stock`
              : `line ${v.line}: ${v.axis} by ${Math.round(v.overshoot * 10) / 10} mm`).join('\n');
            const more = pre.violations.length > 4 ? `\n…and ${pre.violations.length - 4} more` : '';
            const unguardedNote = unguarded ? '\n\nWARNING: soft limits are DISABLED on your controller — the machine will NOT stop itself at these limits (a hard-stop crash risk). This pre-flight is your only guard.' : '';
            const msg = hasNoSpindle
              ? `Pre-flight: this program makes a cutting move (G1/G2/G3) but never turns the spindle on (M3/M4) — it would plunge and cut with the spindle STOPPED (a broken tool / part / worse):\n\n${top}${more}${unguardedNote}\n\nSend to the controller anyway?`
              : `Pre-flight found ${pre.violations.length} move(s) that would ${hasStock ? 'leave the machine travel or cross the stock' : 'leave the machine travel'}:\n\n${top}${more}${unguardedNote}\n\nSend to the controller anyway?`;
            const ok = await dlgConfirm(msg,
              { title: hasNoSpindle ? 'Dead spindle — pre-flight' : hasStock ? 'Pre-flight violation' : 'Envelope violation', danger: true, okLabel: 'Send anyway', cancelLabel: 'Cancel' });
            if (!ok) return;   // the finally block re-enables the button
          }
        } catch (_) { /* advisory — never block the send on a checker error */ }

        let nc = file.text, map;
        if (beacons.checked) {
          const res = instrument(file.text, {
            max: clampInt(count.value, 1, 255, DEFAULTS.max),
            pacing: pacing.value,
            varNum: int(varN.value, DEFAULTS.varNum),
            markerVar: int(markerV.value, DEFAULTS.markerVar),
            marker: int(markerN.value, DEFAULTS.marker),
            source: name,
          });
          nc = res.nc; map = res.map;
        }
        // t2020 — hashed from file.text (the ORIGINAL, pre-instrumentation program), so tracked and
        // deliver-only sends of the same logical job hash the same regardless of the beacon settings above.
        const contentHash = await contentHashOf(file.text);
        // t2080 — NO GATEWAY? SEND THROUGH DRIVE. A CLIENT (a phone, or a PC not wired to the controller)
        // has no gateway of its own to POST to, so it writes the job straight into the same Drive inbox the
        // gateway already polls — the gateway then claims and delivers it exactly as if a local gateway had
        // queued it. Preferring the gateway when one IS reachable is deliberate: it is instant and offline,
        // whereas Drive costs a poll interval (~15s) and an internet round trip. Drive is the FALLBACK, not
        // the default. ⚠ A Drive send is DELIVER-ONLY by construction — beacons are a Modbus link between the
        // controller and ITS gateway, so a client has nothing to instrument for.
        let r;
        if (bridged) {
          r = await ctx.client.submitJob(name, nc, map, contentHash);
        } else {
          const { submitJobToDrive, canSendViaDrive } = await import('../../cloud/driveJobs.js');
          if (!canSendViaDrive()) throw new Error('No gateway on this PC, and no Google account connected — sign in (top right) to send through your Drive.');
          r = await submitJobToDrive(name, file.text, contentHash);   // the ORIGINAL program: no beacons on this path
        }
        toast('Queued ' + r.jobId);
        info.textContent = r.via === 'drive'
          ? `Queued ${r.jobId} via your Google Drive — the machine's gateway picks it up within ~15s (deliver-only).`
          : `Queued ${r.jobId} — ${r.tracked ? `tracked (${map.total_beacons} beacons, est ${map.total_est_time_s}s)` : 'deliver-only'}`;
        // t2057 — SAY SO AT THE MOMENT OF SENDING: the bridge can request tracking (this checkbox) while its
        // own Modbus receiver is off or dead — two independent toggles nothing else compares. The toast fades
        // in 3.2s like any other, so ALSO append to the durable `info` line the operator already reads —
        // that one survives even if they glance away right after clicking Send, rather than silently
        // un-ticking tracking for them.
        if (r.warning) {
          toast(r.warning, true);
          info.textContent += ` — ⚠ ${r.warning}`;
        }
      } catch (e) {
        toast('Send failed: ' + e.message, true);
      } finally {
        btn.disabled = false;
      }
    };

    // t1327 — THE STATE BANNER. Send stayed fully armed with no gateway, so the failure arrived as an exception
    // AFTER the click, on the one screen where the click means "push this at my machine". The contract says this tab
    // KEEPS its staged text — the operator's own program, which they can prepare and edit with the machine off — and
    // DISARMS the send, greying it with the reason on the control (postGating's rule, not a hidden button).
    const banner = el('div', { class: 'gw-state-banner', 'data-gw-state': '', style: 'display:none' });
    this.applyState = (desc) => {
      const c = contractFor('send');
      const out = isUnreachable(desc);
      banner.style.display = out ? '' : 'none';
      banner.setAttribute('data-gw-state', out ? 'unreachable' : 'connected');
      banner.textContent = out ? c.reason : '';
      btn.disabled = out || !file.text;                         // staging stays usable; SENDING is what needs a machine
      btn.title = out ? c.reason : '';
      // the offline half stays live on purpose — dropping a file, using the Studio program, naming the job
      for (const elm of [drop, useStudio, nameField, beacons, count, pacing, varN, markerV, markerN]) elm.disabled = false;
    };

    const block = el('section', { class: 'block', style: 'flex-shrink: 0' },
      el('div', { class: 'section-label' }, 'Send a program'),
      banner,
      drop, input,
      el('div', { class: 'row', style: 'margin-top:10px' }, useStudio),
      el('div', { class: 'row', style: 'margin-top:12px' },
        el('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, beacons, 'Beacons (track progress)')),
      settings,
      el('div', { class: 'row', style: 'margin-top:12px' }, nameField, btn),
      info,
      el('div', { class: 'wiz-usage' },
        'Beacons ON instruments the job for progress tracking; OFF = deliver-only (probe / util macros). '
        + 'The operator presses Cycle Start at the machine.'));
    ctx.root.append(block, previewContainer);
    sync();
    this.applyState(ctx.desc !== undefined ? ctx.desc : (ctx.status && ctx.status.descriptor));
  },

  // the poll is where the state actually changes; the banner and the button follow it rather than the mount alone
  async onPoll(ctx) {
    if (this.applyState) this.applyState(ctx.desc !== undefined ? ctx.desc : (ctx.status && ctx.status.descriptor));
  },
};
