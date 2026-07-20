// ui/gateway/views/send.js — send a program to the controller. Ported from the fairy submit view, adapted to
// Studio: drop a .nc OR pull the current Studio editor program, optionally instrument it with beacons for
// progress tracking, then submitJob to the gateway queue. A WRITE op — the operator still presses Cycle Start.
import { el, toast } from '../util.js';
import { instrument, DEFAULTS } from '../../../shared/js/instrument/instrument.js';
import { dlgConfirm } from '../../dialog.js';
import { checkEnvelope } from '../../../engine/envelopeCheck.js';   // t838 — pre-flight before the push

const field = (labelText, control) => el('div', {}, el('span', { class: 'label' }, labelText), control);
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const clampInt = (v, lo, hi, d) => Math.min(hi, Math.max(lo, int(v, d)));

export default {
  id: 'send',
  label: 'Send',

  mount(ctx) {
    let file = { name: '', text: '' };

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

    const accept = (name, text) => {
      file = { name, text };
      nameField.value = name;
      drop.textContent = `✓ ${name} (${text.length} bytes)`;
      btn.disabled = !text;
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
        const r = await ctx.client.submitJob(name, nc, map);
        toast('Queued ' + r.jobId);
        info.textContent = `Queued ${r.jobId} — ${r.tracked ? `tracked (${map.total_beacons} beacons, est ${map.total_est_time_s}s)` : 'deliver-only'}`;
      } catch (e) {
        toast('Send failed: ' + e.message, true);
      } finally {
        btn.disabled = false;
      }
    };

    ctx.root.append(el('section', { class: 'block' },
      el('div', { class: 'section-label' }, 'Send a program'),
      drop, input,
      el('div', { class: 'row', style: 'margin-top:10px' }, useStudio),
      el('div', { class: 'row', style: 'margin-top:12px' },
        el('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, beacons, 'Beacons (track progress)')),
      settings,
      el('div', { class: 'row', style: 'margin-top:12px' }, nameField, btn),
      info,
      el('div', { class: 'wiz-usage' },
        'Beacons ON instruments the job for progress tracking; OFF = deliver-only (probe / util macros). '
        + 'The operator presses Cycle Start at the machine.')));
    sync();
  },
};
