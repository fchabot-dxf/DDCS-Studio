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
import { builderOf } from '../../blocks/opBuilders.js';
import { emitMapped } from '../../blocks/blockEmitter.js';
import { flattenBlocks } from '../../blocks/userOps.js';   // group: index the stored children for the live preview
import { panelType, renderLayout2D } from '../ops/panelTypes.js';
import { opSimStarts } from '../../viz/opSimStarts.js';   // form3d+2d: the DECLARED per-pass sim-start markers feed the 3D preview
import { whenOk } from '../../blocks/whenGuard.js';   // ③ — gate `when`-conditioned form rows (e.g. corner's start #21/#22) from the live params

// Apply the form values to a COPY of a group's stored children (via the bindings' blockIndex/key) → the records emit
// walks for the live code preview. A group has no builder; its children ARE the program. The real writeback to the
// program happens on insert (applyGroupEdits → opSession.setGroupChildParams) — this copy is preview-only.
function applyGroupParams(def, params) {
    const copy = JSON.parse(JSON.stringify((def && def.children) || []));
    const flat = flattenBlocks(copy);
    for (const b of ((def && def.bindings) || [])) {
        if (b.blockIndex == null || b.key == null || !(b.param in params)) continue;
        const rec = flat[b.blockIndex];
        if (rec && rec.params) rec.params[b.key] = params[b.param];
    }
    return copy;
}

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
        if (!_def) return;
        const isGroup = _def.opType === 'group';
        if (!isGroup && !builderOf(_def.opType)) return;
        const params = {};
        for (const read of _readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
        // ③ — gate `when`-conditioned form rows from the LIVE params (corner's start #21/#22 → visible only under probeZFirst),
        // so the fields follow the toggle dynamically (the row still reads; it's hidden when off, and its canvas handle absents).
        const fhost = el('wiz_user_form');
        if (fhost) fhost.querySelectorAll('[data-when-param]').forEach((row) => {
            const is = row.dataset.whenIs === 'true' ? true : row.dataset.whenIs === 'false' ? false : row.dataset.whenIs;
            row.style.display = whenOk({ param: row.dataset.whenParam, is }, params) ? '' : 'none';
        });
        let gcode = '';
        if (isGroup) {
            // group: no builder — emit the stored children with the form values applied (a pure view, no recordOp).
            try { gcode = emitMapped(applyGroupParams(_def, params)).text; }
            catch (e) { gcode = '( error generating: ' + ((e && e.message) || e) + ' )'; }
        } else {
            recordOp(_def.opType, params);                   // make it the active op → shared insert() commits/replaces it
            try { gcode = emitMapped(builderOf(_def.opType)(params)).text; }
            catch (e) { gcode = '( error generating: ' + ((e && e.message) || e) + ' )'; }
        }
        const codeEl = el('wiz_user_code');
        if (codeEl) codeEl.innerHTML = UIUtils.formatGCode(gcode);
        // preview per panel type: 3D toolpath, a 2D stock layout, BOTH (form3d+2d), or nothing (form-only).
        // The .wiz-viz3d pane is created by preview3D as a sibling INSIDE the target container's .viz-container, so
        // toggle it box-scoped (not a bare `#wiz_user .wiz-viz3d` first-match — two boxes exist for form3d+2d, and
        // #wiz_user is shared across ops so a stale pane can linger from a prior op's panel).
        const pt = panelType(_def.panel);
        const viz3dBox = el('userViz3dBox');
        const viz3dIn = (id) => { const c = el(id); return (c && c.parentElement) ? c.parentElement.querySelector('.wiz-viz3d') : null; };
        if (pt.mode === '3d2d') {
            // form3d+2d — the built-in probe pattern generalized (edge/middle: 3D base + 2D overlay, never either/or):
            // the 3D sim + the DECLARED per-pass markers in the dedicated 3D box, AND the 2D drag canvas in #userVizContainer.
            if (viz3dBox) viz3dBox.style.display = '';
            let starts = null;
            try { const stk = window.ddcsGetSettings && window.ddcsGetSettings().stock; starts = opSimStarts(_def.opType, params, stk); } catch (_) { /* op declares no sim-starts */ }
            mgr.preview3D(gcode, 'userViz3dContainer', (starts && starts[0]) || null, (Array.isArray(starts) && starts.length) ? starts : null);
            const c = el('userVizContainer');
            if (c) {
                c.style.display = ''; const v = viz3dIn('userVizContainer'); if (v) v.style.display = 'none';
                // t73/t87 — the SIM-ONLY first-start marker ALSO shows on the Layout canvas (a 2nd renderer of the panel's
                // userStarts pass-0) AND is DRAGGABLE there: reach the panel (host.__panel), read its pass-0 start, render a
                // hollow ○, and route a drag to the SAME onStartDrag(pos,0) → both surfaces edit one userStarts (never emitted).
                // Re-render on drag so the marker tracks. (t87: draggable — the human confirmed the sim start should be movable.)
                const renderLayoutWithSim = () => {
                    const box = el('userViz3dContainer');
                    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
                    const panel = host && host.__panel;
                    const ps = (panel && typeof panel.getPassStarts === 'function') ? (panel.getPassStarts() || []) : [];
                    const pos0 = ps[0] || (Array.isArray(starts) && starts[0]) || null;   // dragged start, else the declared pass-0 hint
                    const sources = (panel && typeof panel.getPassSources === 'function') ? panel.getPassSources() : null;   // t81 — per-pass auto/manual, so the Layout matches the top panel
                    const simStart = (panel && pos0 && typeof panel.onStartDrag === 'function')
                        ? { pos: pos0, onDrag: (dp) => { panel.onStartDrag(dp, 0); renderLayoutWithSim(); } }
                        : (pos0 ? { pos: pos0 } : null);
                    renderLayout2D(c, _def, params, simStart, sources);
                };
                renderLayoutWithSim();
            }
        } else if (pt.mode === '3d') {
            if (viz3dBox) viz3dBox.style.display = 'none';
            const v = viz3dIn('userVizContainer'); if (v) v.style.display = ''; mgr.preview3D(gcode, 'userVizContainer');
        } else if (pt.mode === '2d') {
            if (viz3dBox) viz3dBox.style.display = 'none';
            const v = viz3dIn('userVizContainer'); if (v) v.style.display = 'none'; const c = el('userVizContainer'); if (c) c.style.display = ''; renderLayout2D(c, _def, params);
        }
        const status = el('userVizStatus');
        if (status) status.textContent = (_def.label || 'custom') + ' · ' + (gcode.split('\n').length) + ' lines';
    },

    // EDIT seeding (manager._seedForm): show the op's params in the widgets, then update() re-reads them.
    setForm(params) { _seed = params || {}; render(); },

    // Increment 2 — INSERT for a group: read the form values and write them surgically back into the group op's
    // STORED children (opSession.setGroupChildParams), keyed by the bindings' (blockIndex, key). The form is a pure
    // view; only the bound child params change. Returns true if the group was found + reloaded.
    async applyGroupEdits(groupId) {
        if (!_def || _def.opType !== 'group') return false;
        const params = {};
        for (const read of _readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
        const edits = (_def.bindings || [])
            .filter((b) => b.blockIndex != null && b.key != null && (b.param in params))
            .map((b) => ({ blockIndex: b.blockIndex, key: b.key, value: params[b.param] }));
        const { setGroupChildParams } = await import('../../blocks/opSession.js');
        return setGroupChildParams(groupId, edits);
    },
};
