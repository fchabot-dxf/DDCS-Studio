/** views/homingView.js — Homing wizard view. A lean run-form: pick which axes to home this run; order +
 *  per-axis method come from the saved Homing Setup config (settings.homing). Opens the setup modal too. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { HomingWizard, homingUnsetAxes, homingRunParams } from '../homingWizard.js';
import { openHomingSetup } from '../../ui/settingsPanel.js';

const wizard = new HomingWizard();

const AX_LIST = ['x', 'y', 'z', 'a', 'b'];
const AX_LABEL = { x: 'X', y: 'Y', z: 'Z', a: 'A', b: 'B' };
const METHOD_LABEL = { native: 'native', seek: 'switch-seek', setzero: 'set-zero' };

const getHoming = () => { const s = window.ddcsGetSettings ? window.ddcsGetSettings() : {}; return s.homing || { axes: {} }; };

// Configured axes: X/Y/Z always (so the list renders even before settings are ready); A/B only when their
// motor role isn't 'unused'.
function configuredAxes() {
    const m = (window.ddcsGetSettings ? window.ddcsGetSettings() : {}).motors || {};
    const out = ['x', 'y', 'z'];
    if (m.a && m.a.role && m.a.role !== 'unused') out.push('a');
    if (m.b && m.b.role && m.b.role !== 'unused') out.push('b');
    return out;
}

// The home ORDER + the enabled/configured selection now live in homingRunParams (homingWizard.js) — the ONE contract
// shape shared with the Macros sysstart Generate so the two paths can't drift (the .order field is the user-set sequence).

// t538 — the H4 home-end switch-DEVICE placement (homingEdges) is REMOVED with the device meshes (the human doesn't want the
// switch boxes drawn). Homing direction still reads the DECLARED Home rows (settings.limits.<edge>Home) via axisHomeMotion in
// the emit/sim; the trip model + the I/O-panel lights are separate and untouched.

export const homingView = {
    type: 'homing',
    panelId: 'wiz_homing',
    codeElId: 'wiz_homing_code',
    large: true,
    twoPane: true,
    inputIds: [],   // the per-axis run checkboxes are built dynamically in onShow → listeners wired there

    // Build the per-run axis checkboxes from the configured axes + saved methods. Re-rendered on every open
    // and whenever the config changes (the row count/labels track Homing Setup). Idempotent: preserves the
    // user's tick state across re-renders within a session by reading the current checkbox values first.
    buildAxes() {
        const host = el('homing_axes');
        if (!host) return;
        const homing = getHoming(), cfg = homing.axes || {};
        const list = configuredAxes();
        const prevState = {};
        host.querySelectorAll('.homing-run-ax').forEach((cb) => { prevState[cb.getAttribute('data-axis')] = cb.checked; });
        host.innerHTML = list.map((ax) => {
            const c = cfg[ax] || {};
            const on = (ax in prevState) ? prevState[ax] : (c.enable !== false);
            return `<label style="display:flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--border,#3a4150); border-radius:6px;">
                <input type="checkbox" class="homing-run-ax" data-axis="${ax}" ${on ? 'checked' : ''}/>
                <b>${AX_LABEL[ax]}</b> <span style="opacity:.65; font-size:11px;">${METHOD_LABEL[(ax === 'a' || ax === 'b') ? 'setzero' : 'seek']}</span>
            </label>`;
        }).join('');
        host.querySelectorAll('.homing-run-ax').forEach((cb) => {
            cb.addEventListener('change', () => { if (window.updateWiz) window.updateWiz(); });
        });
        const btn = el('homing_open_setup');
        if (btn && !btn._homingBound) { btn._homingBound = true; btn.addEventListener('click', (e) => { e.preventDefault(); openHomingSetup(); }); }
    },

    onShow() { this.buildAxes(); },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
        // Build the axis rows every update (buildAxes preserves current ticks) so the list always reflects the
        // configured axes/methods and timing can't leave it empty.
        this.buildAxes();
        const host = el('homing_axes');
        const selected = host ? [...host.querySelectorAll('.homing-run-ax')].filter((c) => c.checked).map((c) => c.getAttribute('data-axis')) : [];
        // the ONE contract shape (shared with the Macros sysstart Generate) — pass the per-run TICKS as the selection.
        const params = homingRunParams(settings, { selected });
        const gcode = wizard.generate(params);
        el('wiz_homing_code').innerHTML = UIUtils.formatGCode(gcode);

        // t542 — the 3D preview plays the REAL EMITTED G-code (the SAME `gcode` shown in the code panel above + inserted into
        // the editor), through the SAME engine the editor uses — NOT a hand-made proxy. The old homingSimProxy existed only
        // because the pre-b0a9791 M98 emit wasn't engine-runnable; the wizard is G31-only now and t540 proved the emit plays
        // to M30 with the port-gated seek stop. One simulator, one truth → a preview-vs-editor divergence (the line-8 class)
        // is impossible. The machine-frame pin + the Start seeding (initialPos) + tool-machine-frame stay (below).
        if (ctx && ctx.preview3D) {
            // t540 — a sim-only draggable START marker (machine frame): default MID-ENVELOPE, the homing sim runs FROM it
            // (the tool travels Start → switch). Never emitted. The panel's own curStart persists a drag across updates; we
            // pass a STABLE mid-envelope default (derived from the machine envelope) so an un-dragged marker doesn't jitter.
            const mch = settings.machine || {};
            const mid = { x: (Number(mch.x) || 0) / 2, y: (Number(mch.y) || 0) / 2, z: (Number(mch.z) || 0) / 2 };
            ctx.preview3D(gcode, 'homingVizContainer', mid, null);
            if (ctx.previewMachine) ctx.previewMachine('homingVizContainer', true);
            // t497 — the homing tool homes in MACHINE coords (no workpiece), so render it in the machine frame: it must
            // draw at the envelope TOP even with a stock shown, not stock-floor-shifted to the bottom (the watched plunge).
            if (ctx.previewToolMachineFrame) ctx.previewToolMachineFrame('homingVizContainer', true);
            // t538 — the 3D home/limit switch DEVICE MESHES are REMOVED (the human doesn't want the floating switch box in
            // the preview). Homing direction still reads the DECLARED Home rows (layer 1) + the trip model/I/O lights stay
            // (layer 2) — those are separate from these meshes. (Previously: ctx.previewLimitSwitches(…, homingEdges(settings)).)
        }

        // t540 — a VISIBLE hint for run-axes whose machine ENVELOPE travel is unset (the sim skips them, no fictional span).
        const unset = homingUnsetAxes(params);
        const unsetHint = unset.length ? `  ⚠ Set ${unset.join(' / ')} travel in Machine settings — ${unset.length > 1 ? 'those axes are' : 'that axis is'} skipped (no envelope).` : '';
        // t628 — the status labels read the ORDERED home set + philosophy from the contract helper / saved config. (The t626
        // refactor removed the old `axes`/`homing` locals but left these three references → a hard ReferenceError when the
        // wizard opens with a #homing_status present; the t626 suite mislabelled it "flaky". Restored, one-source with params.)
        const axes = params.axes || [];
        const homing = getHoming();
        const status = el('homing_status');
        if (status) {
            status.textContent = (axes.length
                ? `Home ${axes.map((a) => AX_LABEL[a]).join(' → ')}${homing.philosophy === 'simultaneous' ? ' (simultaneous)' : ''}`
                : 'No axes selected — tick an axis to home.') + unsetHint;
        }
        const vizStatus = el('homingVizStatus');
        if (vizStatus) vizStatus.textContent = (axes.length ? `Homing sim: ${axes.map((a) => AX_LABEL[a]).join(' → ')}` : 'Homing — no axes selected') + unsetHint;
    },
};
