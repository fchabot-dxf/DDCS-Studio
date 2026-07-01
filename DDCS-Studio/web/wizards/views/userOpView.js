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
import { panelType, renderLayout2D, renderDeclaredLayout } from '../ops/panelTypes.js';
import { opSimContext } from '../../viz/opSimContext.js';    // DECLARED preview intent (registerUserOp → setUserSimIntent)

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

const isDataPortOp = (def) => {
    if (!def || typeof def !== 'object') return false;
    if (typeof def.opType === 'string' && def.opType.endsWith('_data')) return true;
    return typeof def.group === 'string' && def.group.endsWith('_datawiz');
};

function withBuiltInLikeSections(def, bindings) {
    if (!isDataPortOp(def)) return bindings;
    const hasAnySection = (bindings || []).some((b) => b && typeof b.section === 'string' && b.section.trim());
    if (hasAnySection) return bindings;
    const sectionFor = (param) => {
        const p = String(param || '').toLowerCase();
        if (/^(wcs)$/.test(p)) return 'SETUP';
        if (/^(stockattach|pathdatum|stockdatum|stockw|stockh|stockz|originx|originy|offz|offx|offy)$/.test(p)) return 'PLACEMENT';
        if (/^(tool|tooldia|rpm|feed|plunge|stepover|stepoverpct|stepdown|depth|peck|clearance|strategy|method|side)$/.test(p)) return 'TOOL & CUT';
        if (/^(shape|x0|y0|w|h|dia|sides|pattern|cols|rows|dx|dy|count|spacing|angle|startangle|nx|ny|skip|text|font|align|slant|size)$/.test(p)) return 'GEOMETRY';
        return 'PARAMETERS';
    };
    return (bindings || []).map((b) => ({ ...b, section: sectionFor(b && b.param) }));
}

/** The manager sets the def before opening (resolved from the type). */
// registerUserOp already resolves panel/layout/sim from the template blocks at
// save/register time (userOps.resolvePanelMeta / resolveLayoutMeta / resolveSimMeta),
// writing def.panel and def.layout, and calling setUserSimIntent/setUserSimStarts.
// setUserOpDef just reads the pre-resolved values — no template-scanning needed.
export function setUserOpDef(def) {
    _def = def && typeof def === 'object' ? def : null;
    _seed = null;
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
    const binds = withBuiltInLikeSections(_def, (_def.bindings || []).map((b) => (_seed && (b.param in _seed)) ? { ...b, default: _seed[b.param] } : b));
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
    if (usage) usage.textContent = (_def.label || 'Wizard') + ' wizard.';
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

    // Render the 3D preview and apply any DECLARED sim context (rotary rig,
    // machine frame, ATC magazine). Mirrors what built-in views do manually
    // (previewMachine / previewRotaryFixture / previewMagazine), but driven
    // by the declared `sim` block from the op's template — no per-view code.
    _show3dPreview(mgr, gcode) {
        mgr.preview3D(gcode, 'userVizContainer');

        const ctx = opSimContext(_def.opType);          // from registerUserOp → setUserSimIntent
        const sim = _def.sim || ctx;                    // legacy def.sim fallback (pre-save)

        if (sim) {
            // forceMachine: pin to the machine envelope (ATC, homing — G53 frame).
            if (sim.forceMachine && mgr.previewMachine) {
                mgr.previewMachine('userVizContainer', true);
            }
            // showRotaryRig: show the 4th-axis chuck + tailstock.
            if (sim.showRotaryRig && mgr.previewRotaryFixture) {
                mgr.previewRotaryFixture('userVizContainer', true);
            }
            // showMagazine: read magazine config from settings, render pockets.
            if (sim.showMagazine && mgr.previewMagazine) {
                const s = (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings()) || {};
                mgr.previewMagazine('userVizContainer', s.atc ? (s.atc.pockets || []) : []);
            }
        }
    },

    update(mgr) {
        _mgr = mgr;
        if (!_def) return;
        const isGroup = _def.opType === 'group';
        if (!isGroup && !builderOf(_def.opType)) return;
        const params = {};
        for (const read of _readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
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

        // ── Unified preview dispatch ──────────────────────────────────────
        // renderDeclaredLayout reads both _def.panel AND _def.layout (both
        // pre-resolved by registerUserOp) and returns true when it renders a
        // declared layout (corner, drill-pattern, etc.). When it renders, the
        // layout owns the preview space exclusively — no 3D/2D-generic overlap.
        // When it returns false, the panel mode (form3d/form2d/form) drives the
        // generic 3D preview or 2D binding-layout or nothing.
        const viz3d = document.querySelector('#wiz_user .wiz-viz3d-host');
        const c2d = el('userVizContainer');
        const layout = el('userVizContainer2D');
        const pt = panelType(_def.panel);

        const hasLayout = renderDeclaredLayout(layout, _def, params);

        if (hasLayout) {
            // Declared layout owns the preview space — hides 3D + generic 2D.
            if (viz3d) viz3d.style.display = 'none';
            if (c2d) c2d.style.display = 'none';
            if (layout) layout.style.display = '';
        } else if (pt.mode === '3d' && mgr) {
            // 3D preview: apply any declared sim context automatically
            // (rotary rig, machine frame, ATC magazine — as declared by `sim` block).
            if (viz3d) viz3d.style.display = '';
            if (c2d) c2d.style.display = 'none';
            if (layout) layout.style.display = 'none';
            userOpView._show3dPreview(mgr, gcode);
        } else if (pt.mode === '2d') {
            // Generic 2D binding layout (form2d): inferred from param roles.
            if (viz3d) viz3d.style.display = 'none';
            if (c2d) c2d.style.display = '';
            if (layout) layout.style.display = 'none';
            renderLayout2D(c2d, _def, params);
        } else {
            // form-only: hide all previews.
            if (viz3d) viz3d.style.display = 'none';
            if (c2d) c2d.style.display = 'none';
            if (layout) layout.style.display = 'none';
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
