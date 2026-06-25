/**
 * views/userOpView.js — ONE generic wizard view that serves EVERY user-authored (custom) op.
 *
 * Custom ops have no hand-written view, so this one reuses the built-in wizard PANEL (#wiz_user, two-pane) and
 * builds its form dynamically from the op's BINDINGS (ui/formWidgets — the same widgets the modal uses), generates
 * the code/preview from the op's builder, and records the op so the manager's shared insert() commits or replaces
 * it like any wizard. The Studio hover-code → Edit chip and the bar's Custom dropdown both route here.
 *
 * The manager routes any `user_*` type to this single view + panel (see wizardManager._userView / open()).
 */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { renderOpForm } from '../../ui/formWidgets.js';
import { recordOp } from '../../blocks/opRecord.js';
import { BUILDERS } from '../../blocks/opBuilders.js';
import { emitMapped } from '../../blocks/blockEmitter.js';
import { panelType, renderLayout2D } from '../ops/panelTypes.js';

let _def = null;          // the active custom-op def (template + bindings + panel)
let _seed = null;         // params to seed the widgets with (edit), or null (defaults)
let _readers = [];        // [() → { param: value }] one per rendered widget unit
let _mgr = null;

/** The manager sets the def before opening (resolved from the type). Also picks the panel layout. */
export function setUserOpDef(def) {
    _def = def || null; _seed = null;
    userOpView.twoPane = panelType(_def && _def.panel).viz;   // form-only → single pane (open() reads view.twoPane)
}

// Show/hide the preview pane for the op's panel type (called when the panel is shown).
function applyPanel() {
    const vis = document.querySelector('#wiz_user .wiz-visual');
    if (vis) vis.style.display = panelType(_def && _def.panel).viz ? '' : 'none';
}

function render() {
    const host = el('wiz_user_form');
    if (!host || !_def) return;
    host.innerHTML = '';
    // seed: override each binding's default with the op's param when editing (so the widgets show its values)
    const binds = (_def.bindings || []).map((b) => (_seed && (b.param in _seed)) ? { ...b, default: _seed[b.param] } : b);
    _readers = _def.bindings && _def.bindings.length
        ? renderOpForm(host, binds)
        : (host.appendChild(Object.assign(document.createElement('div'), { textContent: 'No parameters — inserts as-is.', style: 'opacity:.6;margin:8px 0;' })), []);
    // one delegated listener: any widget input/change (incl. canvas pickers, which dispatch a bubbling input) re-runs update()
    if (_mgr && !host.dataset.wired) {
        host.dataset.wired = '1';
        const u = () => _mgr && _mgr.update();
        host.addEventListener('input', u);
        host.addEventListener('change', u);
    }
    const usage = el('wiz_user_usage');
    if (usage) usage.textContent = (_def.label || 'Custom op') + ' — your custom wizard.';
}

export const userOpView = {
    type: '__user__',           // sentinel; the manager maps every user_* type to THIS view
    panelId: 'wiz_user',
    codeElId: 'wiz_user_code',
    large: true,
    twoPane: true,
    inputIds: [],               // dynamic — the form wires its own delegated listener in render()
    probeSrcFields: {},         // keep the shared probe-source decorator a no-op

    onShow(mgr) { _mgr = mgr; applyPanel(); render(); },

    update(mgr) {
        _mgr = mgr;
        if (!_def || !BUILDERS[_def.opType]) return;
        const params = {};
        for (const read of _readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
        recordOp(_def.opType, params);                       // make it the active op → shared insert() commits/replaces it
        let gcode = '';
        try { gcode = emitMapped(BUILDERS[_def.opType](params)).text; }
        catch (e) { gcode = '( error generating: ' + ((e && e.message) || e) + ' )'; }
        const codeEl = el('wiz_user_code');
        if (codeEl) codeEl.innerHTML = UIUtils.formatGCode(gcode);
        // preview per panel type: 3D toolpath, a 2D stock layout, or nothing (form-only)
        const pt = panelType(_def.panel), viz3d = document.querySelector('#wiz_user .wiz-viz3d');
        if (pt.mode === '3d') { if (viz3d) viz3d.style.display = ''; mgr.preview3D(gcode, 'userVizContainer'); }
        else if (pt.mode === '2d') { if (viz3d) viz3d.style.display = 'none'; const c = el('userVizContainer'); if (c) c.style.display = ''; renderLayout2D(c, _def, params); }
        const status = el('userVizStatus');
        if (status) status.textContent = (_def.label || 'custom') + ' · ' + (gcode.split('\n').length) + ' lines';
    },

    // EDIT seeding (manager._seedForm): show the op's params in the widgets, then update() re-reads them.
    setForm(params) { _seed = params || {}; render(); },
};
