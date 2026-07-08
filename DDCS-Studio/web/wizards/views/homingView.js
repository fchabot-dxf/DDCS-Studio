/** views/homingView.js — Homing wizard view. A lean run-form: pick which axes to home this run; order +
 *  per-axis method come from the saved Homing Setup config (settings.homing). Opens the setup modal too. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { HomingWizard } from '../homingWizard.js';
import { openHomingSetup } from '../../ui/settingsPanel.js';
import { axisSpan } from '../../engine/limitSwitches.js';
import { switchStandoff } from '../../engine/switchTypes.js';

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

// Resolve the home ORDER for this run. The per-axis `order` field is the first-class, user-set sequence
// (rearranged in Homing Setup; default Z=1 X=2 Y=3 = the safe fndzero.nc order). generate() emits the M98
// calls in exactly this order. (A slave that follows its master is emitted right after the master by the
// builder's syncSlave(), so it doesn't need its own slot.) 'simultaneous' is just a flag — a macro still
// emits the calls sequentially in this order (the controller can't truly home in parallel from a macro).
function orderAxes(selected, homing) {
    const cfg = homing.axes || {};
    return [...selected].sort((p, q) => ((cfg[p] || {}).order || 9) - ((cfg[q] || {}).order || 9));
}

// The FITTED home-end switch devices for the 3D preview (Homing H4). One per linear axis whose HOME-end limit pin is
// configured; positioned at the home edge (machine-0 end, from axisSpan) on that axis + the span mid on the other two,
// styled per its switchType (mechanical/proximity + the H2 standoff). ONE-SOURCE: axisSpan + settings.limits — the same
// the H3 trip model reads, so the device sits exactly where its switch trips.
function homingEdges(settings) {
    const m = settings.machine || {}, limits = settings.limits || {};
    const midOf = (ax) => { const s = axisSpan(Number(m[ax]) || 0); return (s.lo + s.hi) / 2; };
    const out = [];
    for (const axis of ['x', 'y', 'z']) {
        const travel = Number(m[axis]) || 0;
        if (!travel) continue;
        const { lo, hi, homeSide } = axisSpan(travel);
        const key = axis + (homeSide === 'min' ? 'Min' : 'Max');   // the HOME end's flat-config key (xMin / zMax …)
        const pin = limits[key + 'Pin'];
        if (pin === '' || pin == null) continue;                   // no home-end switch fitted → no device
        const homeCoord = homeSide === 'min' ? lo : hi;            // machine-0 (the home edge)
        const dir = homeSide === 'min' ? 1 : -1;                   // inward = toward the envelope interior
        const st = limits[key + 'SwitchType'] || 'mechanical';
        out.push({
            edge: `${axis}_${homeSide}`, axis, side: homeSide, dir, switchType: st, standoff: switchStandoff(st),
            x: axis === 'x' ? homeCoord : midOf('x'),
            y: axis === 'y' ? homeCoord : midOf('y'),
            z: axis === 'z' ? homeCoord : midOf('z'),
        });
    }
    return out;
}

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
                <b>${AX_LABEL[ax]}</b> <span style="opacity:.65; font-size:11px;">${METHOD_LABEL[c.method || 'seek'] || c.method}</span>
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
        const homing = settings.homing || { axes: {} };
        // Build the axis rows every update (buildAxes preserves current ticks) so the list always reflects the
        // configured axes/methods and timing can't leave it empty.
        this.buildAxes();
        const host = el('homing_axes');
        const selected = host ? [...host.querySelectorAll('.homing-run-ax')].filter((c) => c.checked).map((c) => c.getAttribute('data-axis')) : [];
        const axes = orderAxes(selected, homing);

        const params = { axes, config: homing.axes || {}, softLimits: (settings.machine || {}).softLimits !== false, machine: settings.machine || {} };   // re-enable #655 iff the machine uses soft limits
        const gcode = wizard.generate(params);
        el('wiz_homing_code').innerHTML = UIUtils.formatGCode(gcode);

        // 3D preview runs the SIM PROXY (engine-runnable homing-motion model), NOT the real M98 macro the
        // controller executes — so the order + final homed state are visualizable. preview pinned to the
        // machine frame (homing is inherently G53 / machine-coordinate).
        if (ctx && ctx.preview3D) {
            ctx.preview3D(wizard.simProxy(params), 'homingVizContainer', null, null);
            if (ctx.previewMachine) ctx.previewMachine('homingVizContainer', true);
            // t497 — the homing tool homes in MACHINE coords (no workpiece), so render it in the machine frame: it must
            // draw at the envelope TOP even with a stock shown, not stock-floor-shifted to the bottom (the watched plunge).
            if (ctx.previewToolMachineFrame) ctx.previewToolMachineFrame('homingVizContainer', true);
            // H4 — the home/limit switch DEVICES at each fitted home edge; they light/plunge live as the sim homes each axis.
            if (ctx.previewLimitSwitches) ctx.previewLimitSwitches('homingVizContainer', homingEdges(settings));
        }

        const status = el('homing_status');
        if (status) {
            status.textContent = axes.length
                ? `Home ${axes.map((a) => AX_LABEL[a]).join(' → ')}${homing.philosophy === 'simultaneous' ? ' (simultaneous)' : ''}`
                : 'No axes selected — tick an axis to home.';
        }
        const vizStatus = el('homingVizStatus');
        if (vizStatus) vizStatus.textContent = axes.length ? `Homing sim: ${axes.map((a) => AX_LABEL[a]).join(' → ')}` : 'Homing — no axes selected';
    },
};
