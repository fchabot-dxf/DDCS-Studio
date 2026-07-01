/** views/homingView.js — Homing wizard view. A lean run-form: pick which axes to home this run; order +
 *  per-axis method come from the saved Homing Setup config (settings.homing). Opens the setup modal too. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { renderFormWidget } from '../../ui/formWidgets.js';
import { HomingWizard } from '../homingWizard.js';
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

// Resolve the home ORDER for this run. The per-axis `order` field is the first-class, user-set sequence
// (rearranged in Homing Setup; default Z=1 X=2 Y=3 = the safe fndzero.nc order). generate() emits the M98
// calls in exactly this order. (A slave that follows its master is emitted right after the master by the
// builder's syncSlave(), so it doesn't need its own slot.) 'simultaneous' is just a flag — a macro still
// emits the calls sequentially in this order (the controller can't truly home in parallel from a macro).
function orderAxes(selected, homing) {
    const cfg = homing.axes || {};
    return [...selected].sort((p, q) => ((cfg[p] || {}).order || 9) - ((cfg[q] || {}).order || 9));
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
        const listStr = list.join(',');
        
        // Preserve state if the list of available axes hasn't changed
        if (this._lastListStr === listStr) return;
        this._lastListStr = listStr;

        let defaultAxes = [];
        if (this.widgetReader) {
            // Preserve the user's current sequence if we are just rebuilding
            defaultAxes = this.widgetReader().axes.filter((ax) => list.includes(ax));
        } else {
            // Initial seed from hardware settings
            defaultAxes = list.filter((ax) => (cfg[ax] || {}).enable !== false);
            defaultAxes = orderAxes(defaultAxes, homing);
        }

        host.innerHTML = '';
        const readerObj = renderFormWidget(host, { 
            param: 'axes', 
            type: 'sequence', 
            default: defaultAxes, 
            widgetConfig: { axes: list } 
        });
        this.widgetReader = readerObj.read;
        
        host.addEventListener('input', () => { if (window.updateWiz) window.updateWiz(); });

        const btn = el('homing_open_setup');
        if (btn && !btn._homingBound) { btn._homingBound = true; btn.addEventListener('click', (e) => { e.preventDefault(); openHomingSetup(); }); }
    },

    onShow() { this.buildAxes(); },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
        const homing = settings.homing || { axes: {} };
        this.buildAxes();
        const axes = this.widgetReader ? this.widgetReader().axes : [];

        const params = { axes, config: homing.axes || {}, softLimits: (settings.machine || {}).softLimits !== false, machine: settings.machine || {} };   // re-enable #655 iff the machine uses soft limits
        const gcode = wizard.generate(params);
        el('wiz_homing_code').innerHTML = UIUtils.formatGCode(gcode);

        // 3D preview runs the SIM PROXY (engine-runnable homing-motion model), NOT the real M98 macro the
        // controller executes — so the order + final homed state are visualizable. preview pinned to the
        // machine frame (homing is inherently G53 / machine-coordinate).
        if (ctx && ctx.preview3D) {
            ctx.preview3D(wizard.simProxy(params), 'homingVizContainer', null, null);
            if (ctx.previewMachine) ctx.previewMachine('homingVizContainer', true);
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
