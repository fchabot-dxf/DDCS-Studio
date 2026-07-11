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
import { activeDialectOpts } from '../previewEmit.js';   // t634 — the data-op preview folds per the ACTIVE post (== insert), not Expert-default
import { flattenBlocks, getUserStatusHint, getUserSimGcode } from '../../blocks/userOps.js';   // group: index the stored children for the live preview; t554: the declared in-place status hint (homing unset-travel); t566: the declared sim-gcode override (ATC change choreography)
import { panelType, renderLayout2D, pinnedStartsFor } from '../ops/panelTypes.js';
import { resolvePlacementStock } from '../ops/placement.js';   // t720 P1 (d) — fill a twin's UNSET stockW/H from the settings stock so cc-attach places on the real stock
import { firstRapidXY } from '../ops/entry.js';   // t726 P2b — the ONE cut-entry source (the entry marker sits here when unset, shared with the emit)
import { opSimStarts, getUserSimStock } from '../../viz/opSimStarts.js';   // form3d+2d: the DECLARED per-pass sim-start markers + the per-op sim-stock (rotary round bar) feed the 3D preview
import { CommunicationWizard } from '../communicationWizard.js';   // t518 — the Comm twin's 'commscreen' panel renders this wizard's DDCS-screen mock (pure fn of params)
import { applyPreviewIntent } from './atcViews.js';   // t714 — the ONE declared-intent apply (opSimContext → preview*), shared with the built-in views so twin + built-in agree by construction
const _commWizard = new CommunicationWizard();
import { createToolpath2d } from '../../viz/toolpath2d.js';   // t309 — the 2D-animation overlay under the Layout SVG (path + red head, driven by the shared engine)
import { whenOk } from '../../blocks/whenGuard.js';   // ③ — gate `when`-conditioned form rows (e.g. corner's start #21/#22) from the live params
import { resolveActivePost, getCaps } from '../dialects/index.js';   // t538 — dialect-aware row gate (`_oword`): hide M66-only fields on a non-oword post
import { getActiveProfile } from '../../shared/js/profiles/controllerProfiles.js';
// t538 — the active post is RS274/grblHAL (o-word / M66)? Injected as the `_oword` gate param so a binding can hide a
// dialect-specific field (e.g. the I/O-step Result-var/Timeout, which are M66-only and dead on a DDCS WHILE-poll).
const activePostOword = () => { try { return getCaps(resolveActivePost(getActiveProfile().id).id).flow === 'oword'; } catch (_) { return false; } };
import { builtinLabelForTwin } from '../../blocks/wizardLibrary.js';   // t343 E5 — an IN-PLACE port (opensAs) shows the built-in's PLAIN title (seamless)

// t309 — THE 2D-ANIMATION OVERLAY: a path-only toolpath2d <canvas> UNDER the Layout SVG (behind, pointer-events:none via
// CSS) so the animated toolpath + red probe head show under the interactive handles. Created ONCE per container (memoised
// on container.__animOverlay — renderLayoutWithSim re-runs on every field/drag and self-recurses, so a fresh instance/raf
// each call would leak). The overlay reads the SAME shared trace + starts/passEnds/anchor the top 2D panel uses, so its
// path connects the SVG handles by construction, and pins its view from featureCanvas._tf so it registers pixel-exact.
function _pinFromTf(tf) { return tf ? { scale: tf.scale, ox: tf.cx - tf.cxw * tf.scale, oy: tf.cy + tf.cyw * tf.scale } : null; }
function wireAnimOverlay(container, fc, panel, starts, passEnds, sources) {
    if (!container || !fc || !panel || typeof panel.getSegments !== 'function' || typeof fc.getTransform !== 'function') return;
    let ov = container.__animOverlay;
    if (!ov) {
        const canvas = document.createElement('canvas');
        canvas.className = 'fc-anim-overlay';                 // CSS: position:absolute; inset:0; z-index:-1; pointer-events:none
        container.insertBefore(canvas, container.firstChild); // BEHIND the SVG (first child; z-index:-1 keeps it below the transparent SVG, above the container's #000)
        const tp = createToolpath2d(canvas, { overlay: true });
        ov = { canvas, tp };
        container.__animOverlay = ov;
        fc.onTransform((tf) => tp.setViewTransform(_pinFromTf(tf)));   // re-pin on every pan / zoom / fit / resize / render
        panel.onToolPos((pos, k) => { if (pos) { tp.seek(k); tp.setToolPosition(pos); } else tp.stop(); });   // live head from the ONE engine (fires in any mode); stop → clear the head + static path
        if (panel.onProbeTouch) panel.onProbeTouch((ev) => tp.pulse(ev));   // t319 — the on-touch pulse (Z circle / wall line) in lockstep with the 3D disc + the red head
        tp.setViewTransform(_pinFromTf(fc.getTransform()));           // initial pin (the FeatureCanvas already drew before the overlay existed)
    }
    // Feed the SAME trace + frame the top 2D panel uses → the path emanates from / arrives at the same worlds the SVG handles do.
    ov.tp.setAnchor(typeof panel.getAnchor === 'function' ? panel.getAnchor() : true);
    ov.tp.setStarts(Array.isArray(starts) ? starts : []);
    ov.tp.setPassEnds(Array.isArray(passEnds) ? passEnds : null);
    ov.tp.setStartSources(Array.isArray(sources) ? sources : []);
    ov.tp.setSegments((panel.getSegments() || []));
    ov.tp.setViewTransform(_pinFromTf(fc.getTransform()));           // re-pin AFTER the feed (paints the fresh path in the current frame)
}

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
// t120 — CORNER-MARKER INDEPENDENCE (Option A): each corner-datum canvas handle stores a DATUM-RELATIVE spot ({dx,dy} off
// the corner) here, keyed by its binding GROUP (e.g. 'reposition' #23/#24, 'start' #21/#22). A drag sets the dragged
// group's spot + CAPTURES the others (freeze) → after any drag all handles are independent (dragging one leaves the rest
// put, its emitted G91 increment re-derived off the moved planned anchor). UNSET → the socket expression holds (byte-
// identical default). Datum-relative → re-anchors on a corner change. Persists across a render pass within ONE editing
// session; t122 — CLEARED per wizard OPEN (onShow), NOT per opType (every corner instance shares the opType, so a per-type
// reset leaked one instance's drags into the next → a baked, NON-byte-identical emit for a freshly-opened corner).
let _layoutSpots = {};    // { [groupId]: { dx, dy } } datum-relative; cleared per wizard OPEN (onShow)
// t508 Fork 1 — the dragged sim-start FRACTIONS for an op that DECLARES a marker→param binding (def.simStartParams, e.g.
// alignment: marker 0 → ax/ay, marker 1 → bx/by). A drag writes the fraction (world / stock) here; update() merges it into
// the op params → recorded (persist + round-trip) + re-read by opSimStarts (the marker moves) + the emit. ONE source, ALL
// surfaces. Seeded from the op's params on EDIT (setForm); cleared per fresh OPEN (onShow).
let _simStartFracs = {};

/** The machine ENVELOPE reach in the WCS/stock frame (the stock corner sits at the WCS origin): a WCS coord `w` maps to
 *  machine `workOrigin + w`, reachable while `0 ≤ workOrigin + w ≤ span` → `w ∈ [-workOrigin, span - workOrigin]`. Null if
 *  the stock's PLACEMENT in the machine is not DECLARED (then the drag is unbounded — the stock is never the bound).
 *  t730 — the reach is meaningful ONLY when a real WCS table row backs `workOrigin` (that row IS where the stock's part-zero
 *  sits in the machine). The SHIPPED default (`wcs.table === null` → `workOrigin {0,0,0}`) is a PLACEHOLDER, not a
 *  declaration: reading it as "the stock's datum corner is jammed at the travel minimum" wrongly pins any marker that
 *  legitimately sits in front of / left of the stock (an alignment fence at −Y seats A at y<0 by design). Undeclared
 *  placement → null → markers position ANYWHERE; envelope bounds at most, and only once a placement is declared. */
function machineReachXY() {
    try {
        const m = (window.ddcsGetSettings && window.ddcsGetSettings().machine) || null;
        if (!m) return null;
        const spanX = Math.abs(Number(m.x) || 0), spanY = Math.abs(Number(m.y) || 0);
        if (!(spanX > 0) || !(spanY > 0)) return null;
        const declared = m.wcs && Array.isArray(m.wcs.table) && m.wcs.table.length > 0;   // a real WCS row backs workOrigin
        if (!declared) return null;   // placement unknown → don't clamp (the default workOrigin 0 is a placeholder, not "at travel-0")
        const wo = m.workOrigin || {}, woX = Number(wo.x) || 0, woY = Number(wo.y) || 0;
        return { xMin: -woX, xMax: spanX - woX, yMin: -woY, yMax: spanY - woY };
    } catch (_) { return null; }
}

/** Write a dragged sim-start marker's WORLD point into _simStartFracs, per the op's declared marker→param binding
 *  (def.simStartParams[i]). Default: {x:paramX, y:paramY} → the FRACTION (world/stock). t530 — a `relSpanFrom` marker
 *  (rotary clock's B) instead writes a MM SPAN = (this.worldY − starts[relSpanFrom].worldY) to its `y` param, so B's drag
 *  sets #6 ADDITIVELY (the span field stays the ONE source — field + drag both edit it). `starts` = the resolved marker
 *  worlds (for the relative reference). No binding / no stock → no-op. */
/** The span axis for a relSpanFrom marker: a declared literal (spb.spanAxis) OR read LIVE from a form param (spb.spanAxisFrom,
 *  e.g. alignment's checkAxis); default Y (rotary clock). */
function spanAxisOf(spb) {
    let axis = spb.spanAxis === 'X' ? 'X' : 'Y';
    if (spb.spanAxisFrom) {
        const host = el('wiz_user_form') && el('wiz_user_form').querySelector(`[data-param="${spb.spanAxisFrom}"]`);
        let v = host && host.value;                                                  // select / input
        if ((v == null || v === '') && host) { const on = host.querySelector('.seg-on'); v = on && on.dataset.value; }   // segmented widget → the selected button
        if (v === 'X' || v === 'Y') axis = v;
    }
    return axis;
}
function writeSimStartFrac(def, i, world, stock, starts) {
    const spb = def && def.simStartParams && def.simStartParams[i];
    const sx = stock && Number(stock.x), sy = stock && Number(stock.y);
    if (!spb || !(sx > 0) || !(sy > 0) || !world) return false;
    // t528 — UNCLAMP from the stock: the stock is a REFERENCE, never a hard bound. The only real limit is REACHABILITY =
    // the machine ENVELOPE. Clamp the WORLD to the envelope reach; the FRACTION (world/stock) then resolves BEYOND [0,1]
    // freely (a probe point past the stock edge, still within reach). No envelope → unbounded (still never the stock).
    const R = machineReachXY();
    const wx = R ? Math.max(R.xMin, Math.min(R.xMax, (+world.x || 0))) : (+world.x || 0);
    const wy = R ? Math.max(R.yMin, Math.min(R.yMax, (+world.y || 0))) : (+world.y || 0);
    // Write a mm SPAN (relSpanFrom marker) from `worldPos` along `axis`, relative to the anchor `aM`, into the span field.
    const writeSpan = (spb2, aM, worldPos) => {
        const axis = spanAxisOf(spb2);
        const aPos = axis === 'X' ? (Number(aM.x) || 0) : (Number(aM.y) || 0);
        const raw = (axis === 'X' ? worldPos.x : worldPos.y) - aPos;
        const span = spb2.signed ? raw : Math.max(1, raw);   // t544 — signed (alignment: B either side of A); default floored ≥1mm (rotary clock B is +Y)
        // `span` is a FORM field (the ONE source) — write the FIELD, not a parallel _simStartFracs (which would OVERRIDE a
        // later typed value). So the drag AND the numeric field are two editors of the one span; update() re-reads the field.
        const fld = spb2.y && el('wiz_user_form') && el('wiz_user_form').querySelector(`[data-param="${spb2.y}"]`);
        if (fld) fld.value = String(Math.round(span * 1000) / 1000);
        else if (spb2.y) _simStartFracs[spb2.y] = span;
    };
    if (spb.relSpanFrom != null) {   // t530/t544 — RELATIVE-SPAN marker (B): drag along an axis → a mm span from the anchor (A). A stays.
        writeSpan(spb, (Array.isArray(starts) && starts[spb.relSpanFrom]) || {}, { x: wx, y: wy });
        return true;
    }
    // The ANCHOR marker (A): write its fraction.
    if (spb.x) _simStartFracs[spb.x] = wx / sx;
    if (spb.y) _simStartFracs[spb.y] = wy / sy;
    // t570 — HANDLES ARE INDEPENDENT: if a DEPENDENT `relSpanFrom` marker (B = A + span) anchors on THIS marker, dragging THIS
    // one (A) must NOT carry the dependent (B). Recompute the dependent's SPAN so B's ABSOLUTE position stays PUT
    // (span = B_abs − A_new). B's world before this drag is `starts[dj]`. (Typing the span field is the ONE deliberate
    // B-moves-relative-to-A direction — unchanged; dragging B moves only B — unchanged.)
    const dj = (def.simStartParams || []).findIndex((m) => m && m.relSpanFrom === i);
    if (dj >= 0 && Array.isArray(starts) && starts[dj]) writeSpan(def.simStartParams[dj], { x: wx, y: wy }, starts[dj]);
    return true;
}

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
    // t343 E5 — SEAMLESS TITLE: an IN-PLACE port (opensAs) reads the built-in's PLAIN label ('Edge'/'Corner', no '(data)', no
    // "custom wizard" suffix) so the user sees the wizard exactly where it always was. A normal user op keeps its custom heading.
    if (usage) { const seamless = builtinLabelForTwin(_def.opType); usage.textContent = seamless || ((_def.label || 'Custom op') + ' — your custom wizard.'); }
}

export const userOpView = {
    type: '__user__',           // sentinel; the manager maps every user_* type to THIS view
    panelId: 'wiz_user',
    codeElId: 'wiz_user_code',
    large: true,
    twoPane: true,
    inputIds: [],               // dynamic — the form wires its own delegated listener in render()
    probeSrcFields: {},         // keep the shared probe-source decorator a no-op

    // t524 — a data-op opened with a VARIANT pre-selects its `mode` param: the grouped I/O-step wizard's SETUP-menu buttons
    // (Set Output / Wait Input / Dwell) open user_io_step with the matching mode. Only ops that HAVE a `mode` binding; runs
    // before onShow→render so the seeded default shows. A fresh open (no variant) is unaffected; opensAs entries pass none.
    applyVariant(variant) { if (variant != null && variant !== '' && _def && (_def.bindings || []).some((b) => b.param === 'mode')) _seed = { ...(_seed || {}), mode: variant }; },

    onShow(mgr) { _mgr = mgr; _layoutSpots = {}; _simStartFracs = {}; applyPanel(); render(); },   // t122 — clear marker spots per OPEN (fresh session = undragged = byte-identical); t508 clear the sim-start fractions too

    update(mgr) {
        _mgr = mgr;
        if (!_def) return;
        const isGroup = _def.opType === 'group';
        if (!isGroup && !builderOf(_def.opType)) return;
        const params = {};
        for (const read of _readers) { try { Object.assign(params, read()); } catch (_) { /* skip a broken widget */ } }
        Object.assign(params, _simStartFracs);   // t508 — the dragged sim-start FRACTIONS (the declared marker→param source) → recorded + read by opSimStarts + the emit
        // t720 P1 (d) — a twin's stock fields default 0; fill them from the SETTINGS stock (like the built-in views inject via
        // placementParams) so a stock-attaching op places on the REAL stock, not the origin. Only UNSET fields; recorded +
        // emitted with the resolved stock (matches the built-in's placeOnStock snapshot). No-attach ops are byte-identical.
        try { Object.assign(params, resolvePlacementStock(params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null)); } catch (_) { /* no settings stock */ }
        // t722 P2a (4) — the op's DECLARED tool for the sim body + carve radius + the honest note: the TYPED toolDia (present
        // on every mill twin). `_opValue` flags it as the op's value (no tool-table tool picked) so the note owns up to only the
        // tip-shape unknown, not the diameter. null when the op has no toolDia (probe/text) → simTool's T#/honest-6 fallback.
        const _opToolDia = Number(params.toolDia);
        const _opTool = (_opToolDia > 0) ? { type: 'endmill', dia: _opToolDia, _opValue: true } : null;
        // ③ — gate `when`-conditioned form rows from the LIVE params (corner's start #21/#22 → visible only under probeZFirst),
        // so the fields follow the toggle dynamically (the row still reads; it's hidden when off, and its canvas handle absents).
        const fhost = el('wiz_user_form');
        const gp = { ...params, _oword: activePostOword() };   // t538 — the live params + a dialect gate flag (`_oword`)
        if (fhost) fhost.querySelectorAll('[data-when], [data-when-all]').forEach((row) => {
            let ok;
            if (row.dataset.whenAll) {   // t522 — COMPOUND gate: AND of all conditions
                try { ok = JSON.parse(row.dataset.whenAll).every((c) => whenOk(c, gp)); } catch (_) { ok = true; }
            } else {   // t566 — the full condition as JSON (param/is/in/not) → whenOk
                try { ok = whenOk(JSON.parse(row.dataset.when), gp); } catch (_) { ok = true; }
            }
            row.style.display = ok ? '' : 'none';
        });
        // t566 — GREY-gate: a `gate`-conditioned field greys (not hides) when the condition holds, with a `tip` (the ATC
        // change gating — zClear for auto, fixedT for auto+inline). `data-op-gated` survives postGating's cap-ON re-enable.
        if (fhost) fhost.querySelectorAll('[data-gate]').forEach((row) => {
            let spec; try { spec = JSON.parse(row.dataset.gate); } catch (_) { return; }
            const off = Array.isArray(spec.all) ? spec.all.every((c) => whenOk(c, gp)) : whenOk(spec, gp);
            const inp = row.querySelector('[data-param]');
            if (!inp) return;
            inp.disabled = off;
            inp.setAttribute('data-op-gated', off ? 'on' : 'off');
            inp.title = off && spec.tip ? spec.tip : '';
            row.style.opacity = off ? '0.5' : '';
        });
        // t417 E3 — a per-op SIM-STOCK override (the rotary twin projects a round bar from #57; sim-only, no global mutation).
        // Feeds BOTH the sim-starts (opSimStarts) AND the preview render (preview3D) so the bar + the flank starts agree.
        let _simStock = null;
        try { const _fn = getUserSimStock(_def.opType); const _gs = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null; _simStock = _fn ? _fn(params, _gs) : null; } catch (_) { /* op declares no sim-stock */ }
        let gcode = '';
        if (isGroup) {
            // group: no builder — emit the stored children with the form values applied (a pure view, no recordOp).
            try { gcode = emitMapped(applyGroupParams(_def, params), activeDialectOpts()).text; }
            catch (e) { gcode = '( error generating: ' + ((e && e.message) || e) + ' )'; }
        } else {
            recordOp(_def.opType, params);                   // make it the active op → shared insert() commits/replaces it
            try { gcode = emitMapped(builderOf(_def.opType)(params), activeDialectOpts()).text; }
            catch (e) { gcode = '( error generating: ' + ((e && e.message) || e) + ' )'; }
        }
        const codeEl = el('wiz_user_code');
        if (codeEl) codeEl.innerHTML = UIUtils.formatGCode(gcode);
        // t566 — a DECLARED sim-gcode OVERRIDE: an op whose PREVIEW motion differs from its EMIT (the ATC change's automatic
        // methods emit a bare `T# M6` but the sim animates the choreography INTERPRETER's assumed path) previews that instead.
        // The CODE preview above stays the real emit; only the 3D animation swaps. null / no hook → preview the emit (unchanged).
        let previewGcode = gcode;
        try { const _sg = getUserSimGcode(_def.opType); if (_sg) { const _o = _sg(params); if (_o) previewGcode = _o; } } catch (_) { /* op declares no sim-gcode override */ }
        // preview per panel type: 3D toolpath, a 2D stock layout, BOTH (form3d+2d), or nothing (form-only).
        // The .wiz-viz3d pane is created by preview3D as a sibling INSIDE the target container's .viz-container, so
        // toggle it box-scoped (not a bare `#wiz_user .wiz-viz3d` first-match — two boxes exist for form3d+2d, and
        // #wiz_user is shared across ops so a stale pane can linger from a prior op's panel).
        const pt = panelType(_def.panel);
        const viz3dBox = el('userViz3dBox');
        const viz3dIn = (id) => { const c = el(id); return (c && c.parentElement) ? c.parentElement.querySelector('.wiz-viz3d') : null; };
        // t421/t552/t560/t570 — apply the DECLARED sim intent (opSimContext) to the op's preview panel:
        //  · rotary rig (showRotaryRig, sim{rotary}) — the 4th-axis chuck+tailstock (generic mirror of rotaryCenterView).
        //  · machine-frame + tool-machine-frame (toolMachineFrame, sim{toolMachine}, HOMING) — FORCE the envelope + render the
        //    tool in raw machine coords; a probe op's forceMachine stays LOCAL (gated on toolMachineFrame, not plain forceMachine).
        //  · seat-at-start (seatAtStart, sim{seatStart}, ALIGNMENT) — seat the trace/engine initial pos at the draggable Start.
        //  · magazine (showMagazine, sim{magazine}, ATC) — the pocket tiles on the envelope.
        // t578 — the TRACE-affecting bits (machine frame, seat) MUST land BEFORE the 2D layout overlay reads panel.getSegments(),
        // so a FRESH open feeds the overlay the SAME seated machine-frame route a drag does (the reported 'on open it's not
        // connecting the start and probe, only after first drag' = the intent used to land AFTER renderLayoutWithSim). Idempotent
        // (the panel setters early-return when unchanged), so the plain-3D tail call below is a harmless no-op for 3d2d.
        // t714 — the twin path now uses the SAME applyPreviewIntent the built-in views call → one apply, one declaration
        // (opSimContext(_def.opType)). This also lands R-B #7 (it honors plain forceMachine, not only toolMachineFrame — so a
        // forceMachine-only twin, e.g. atc_length/check/warmup, forces the envelope in-place too). Idempotent.
        const applySimIntent = (rigCont) => applyPreviewIntent(mgr, rigCont, _def.opType);
        // t518 — the Comm 'commscreen' preview host is a sibling in #userVizContainer; drop any stale one at the top of EVERY
        // render so it never leaks into another op's 3D/2D pane (self-cleaning; the commscreen branch re-creates it fresh).
        { const c0 = el('userVizContainer'); const h0 = c0 && c0.querySelector('.comm-screen-host'); if (h0 && pt.mode !== 'commscreen') h0.remove(); }
        if (pt.mode === '3d2d') {
            // form3d+2d — the built-in probe pattern generalized (edge/middle: 3D base + 2D overlay, never either/or):
            // the 3D sim + the DECLARED per-pass markers in the dedicated 3D box, AND the 2D drag canvas in #userVizContainer.
            if (viz3dBox) viz3dBox.style.display = '';
            let starts = null;
            try { const stk = _simStock || (window.ddcsGetSettings && window.ddcsGetSettings().stock); starts = opSimStarts(_def.opType, params, stk); } catch (_) { /* op declares no sim-starts */ }
            // t728 r1 — a mill twin with a declared entry point feeds the 3D an EMITTING start at the entry (cut entry when
            // unset, else entryX/entryY — the SAME position + the ONE firstRapidXY source as the 2D square), so the 3D glyph
            // is the emitting SQUARE too (setStartEmits reads emits:true), unifying the 2D/3D marker language.
            if (!starts && _def && _def.entryPoint) {
                const epb = _def.entryPoint;
                const exEl = fhost && fhost.querySelector(`[data-param="${epb.x}"]`), eyEl = fhost && fhost.querySelector(`[data-param="${epb.y}"]`);
                const exV = (exEl && exEl.value !== '') ? Number(exEl.value) : NaN, eyV = (eyEl && eyEl.value !== '') ? Number(eyEl.value) : NaN;
                const _cut = firstRapidXY(previewGcode);
                const ep = (Number.isFinite(exV) && Number.isFinite(eyV)) ? { x: exV, y: eyV } : (_cut ? { x: _cut.x, y: _cut.y } : null);
                if (ep) starts = [{ x: ep.x, y: ep.y, z: 0, emits: true }];   // emits:true → the 3D emitting SQUARE (not the sim-only ○)
            }
            // t301 MARKER PARITY (Seam A feed) — refresh the datum-PINNED wall worlds from the live spot store BEFORE the panel
            // re-renders, so a spotted wall HOLDS in the 3D marker (computePassStarts reads host.__pinnedStarts). Empty spots → null → the pure-auto chain, byte-identical.
            const _phost = viz3dIn('userViz3dContainer');   // the SAME one-level-up derivation the panel + the drag path use (a two-level querySelector can match the OTHER pane's .wiz-viz3d in form3d+2d)
            if (_phost) _phost.__pinnedStarts = pinnedStartsFor(_def, params, _layoutSpots);
            mgr.preview3D(previewGcode, 'userViz3dContainer', (starts && starts[0]) || null, (Array.isArray(starts) && starts.length) ? starts : null, _simStock, _opTool);
            applySimIntent('userViz3dContainer');   // t578 — seat the machine-frame/seat intent BEFORE the layout overlay reads the trace, so the fresh-open route connects Start→seeks→HOME (the drag's own re-feed already had the intent set)
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
                    const passEnds = (panel && typeof panel.getPassEnds === 'function') ? panel.getPassEnds() : null;   // t107 — per-pass runtime ENDs, so the Layout ② relocates to the machine-faithful spot + the drag writes END-relative #23/#24
                    // t120/t122 — the datum-relative marker-spot store (Option A independence). CLEARED per wizard OPEN (onShow),
                    // NOT here per opType (every corner instance shares the opType → a per-type reset leaked drags across instances).
                    // setSpots re-renders so a drag's capture/derive shows.
                    // t301 — a drag's spot capture: update the store AND re-feed the panel's pinned worlds SYNCHRONOUSLY, so the
                    // immediately-following simStart.onDrag → panel.onStartDrag → setGcode → computePassStarts reads the fresh pins
                    // (the 3D wall holds this same frame, coincident with the Layout).
                    const setSpots = (next) => { _layoutSpots = next || {}; if (host) host.__pinnedStarts = pinnedStartsFor(_def, params, _layoutSpots); };
                    // t508 Fork 1 — an op that DECLARES a marker→param binding (def.simStartParams) renders EACH sim-start marker
                    // as a DRAGGABLE handle whose drag writes the FRACTION param (world / stock) → merged into params → recorded +
                    // re-read by opSimStarts (the marker moves) + the emit. ONE source, ALL surfaces (replaces the sim-only pass-0
                    // ○ for these ops). Absent (corner/edge) → the existing single sim-only Start marker (unchanged).
                    const spb = _def && _def.simStartParams;
                    const stkNow = _simStock || (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
                    // t592 PREVIEW DRAGS WRITE THE PROGRAM — route a PREVIEW-PANEL marker drag (the 3D gizmo / the 2D top handle,
                    // per pass) through THE SAME declared writer the Layout marker uses (writeSimStartFrac): a declared op's preview
                    // drag writes the BOUND params (fraction / relSpanFrom span, envelope-clamped, handles independent) → recorded +
                    // re-emitted → every surface (form field, Layout handle, sim marker, emit) follows. Non-declared op / an unbound
                    // pass → false → the panel keeps its sim-only userStarts behavior (a manual-jog start is legitimately sim-only).
                    if (panel && typeof panel.setMarkerDragWriter === 'function') {
                        panel.setMarkerDragWriter((pass, world) => {
                            const spbNow = _def && _def.simStartParams;   // read the CURRENT def live — a later non-declared op short-circuits (no stale write)
                            if (!spbNow || !spbNow[pass]) return false;
                            if (writeSimStartFrac(_def, pass, world, stkNow, starts)) { mgr.update(); return true; }
                            return false;
                        });
                    }
                    // t726 P2b — THE MILL ENTRY POINT: a twin that declares def.entryPoint drops the sim-only jog ○ and gets an
                    // emitting-square marker instead. It sits at the DECLARED (entryX,entryY) when set, else at the cut's OWN entry
                    // (firstRapidXY of THIS emit — the ONE shared source), and a drag WRITES entryX/entryY (the placement-absolute
                    // coords the emit routes the opening rapid through). Rendered via the simMarkers path (a square, not the ○).
                    const epb = _def && _def.entryPoint;
                    let entryMarkers = null;
                    if (epb) {
                        const exEl = fhost && fhost.querySelector(`[data-param="${epb.x}"]`);
                        const eyEl = fhost && fhost.querySelector(`[data-param="${epb.y}"]`);
                        const exV = (exEl && exEl.value !== '') ? Number(exEl.value) : NaN;
                        const eyV = (eyEl && eyEl.value !== '') ? Number(eyEl.value) : NaN;
                        const cut = firstRapidXY(previewGcode);
                        const pos = (Number.isFinite(exV) && Number.isFinite(eyV)) ? { x: exV, y: eyV } : (cut ? { x: cut.x, y: cut.y } : null);
                        if (pos) entryMarkers = [{ pos, label: 'entry', yieldCoincident: true, onDrag: (world) => {
                            const w3 = (n) => String(Math.round(n * 1000) / 1000);
                            if (exEl) { exEl.value = w3(world.x); exEl.dispatchEvent(new Event('input', { bubbles: true })); }
                            if (eyEl) { eyEl.value = w3(world.y); eyEl.dispatchEvent(new Event('input', { bubbles: true })); }
                            mgr.update();
                        } }];
                    }
                    const simMarkers = (spb && Array.isArray(starts))
                        ? spb.map((_m, i) => (starts[i] && Number.isFinite(+starts[i].x)) ? {
                            pos: starts[i], label: String.fromCharCode(65 + i),   // A, B, …
                            onDrag: (world) => { if (writeSimStartFrac(_def, i, world, stkNow, starts)) mgr.update(); },
                        } : null).filter(Boolean)
                        : entryMarkers;
                    const simStart = (spb || epb || !(panel && pos0 && typeof panel.onStartDrag === 'function'))
                        ? ((pos0 && !spb && !epb) ? { pos: pos0 } : null)
                        : { pos: pos0, onDrag: (dp) => { panel.onStartDrag(dp, 0); renderLayoutWithSim(); } };
                    const fc = renderLayout2D(c, _def, params, simStart, sources, passEnds, _layoutSpots, setSpots, ps, simMarkers);   // t301 Seam C + t508 simMarkers (declared marker→param handles)
                    wireAnimOverlay(c, fc, panel, ps, passEnds, sources);   // t309 — the 2D-animation overlay under the SVG (created once, fed the shared trace each render; driven by the panel's engine via onToolPos)
                };
                renderLayoutWithSim();
            }
        } else if (pt.mode === '3d') {
            if (viz3dBox) viz3dBox.style.display = 'none';
            // t714 (R-B #8) — feed the DECLARED per-pass sim-starts (opSimStarts) in the default form3d panel too, not null,null,
            // so a multi-pass op shows its ①②③④ markers here as well as in form3d+2d (they were only wired in the 3d2d branch).
            let starts3d = null;
            try { const stk = _simStock || (window.ddcsGetSettings && window.ddcsGetSettings().stock); starts3d = opSimStarts(_def.opType, params, stk); } catch (_) { /* op declares no sim-starts */ }
            const v = viz3dIn('userVizContainer'); if (v) v.style.display = ''; mgr.preview3D(previewGcode, 'userVizContainer', (starts3d && starts3d[0]) || null, (Array.isArray(starts3d) && starts3d.length) ? starts3d : null, _simStock, _opTool);
        } else if (pt.mode === '2d') {
            if (viz3dBox) viz3dBox.style.display = 'none';
            const v = viz3dIn('userVizContainer'); if (v) v.style.display = 'none'; const c = el('userVizContainer'); if (c) c.style.display = ''; renderLayout2D(c, _def, params);
        } else if (pt.mode === 'commscreen') {
            // t518 — Comm/MDI: a live mock of the DDCS controller screen (popup / status / input / beep) instead of a toolpath.
            if (viz3dBox) viz3dBox.style.display = 'none';
            const c = el('userVizContainer');
            if (c) {
                c.style.display = ''; const v = viz3dIn('userVizContainer'); if (v) v.style.display = 'none';   // hide the shared 3D pane
                let host = c.querySelector('.comm-screen-host');
                if (!host) { host = document.createElement('div'); host.className = 'comm-screen-host'; c.appendChild(host); }
                host.style.display = '';
                try { host.innerHTML = _commWizard.generateScreenPreview(params); } catch (_) { host.innerHTML = ''; }
            }
        }
        // Apply the DECLARED rig/machine/seat/magazine intent (see applySimIntent above) for the plain-3D mode — the 3d2d mode
        // already applied it right after preview3D, BEFORE its layout overlay read the trace (t578 fresh-open connectivity).
        if (pt.mode === '3d') applySimIntent('userVizContainer');
        const status = el('userVizStatus');
        // t554 — an optional DECLARED status hint (def.statusHint(params) → a string): homing surfaces the unset-travel warning
        // ("⚠ Set Z travel …", the t540 behaviour) in-place. Generic seam; a def without one → no hint (unchanged).
        let _hint = ''; try { const hf = getUserStatusHint(_def.opType); if (hf) _hint = hf(params) || ''; } catch (_) { /* hint is optional */ }
        if (status) status.textContent = (_def.label || 'custom') + ' · ' + (gcode.split('\n').length) + ' lines' + _hint;
    },

    // EDIT seeding (manager._seedForm): show the op's params in the widgets, then update() re-reads them.
    setForm(params) {
        _seed = params || {};
        // t508 — seed the dragged sim-start fractions from the op's params so re-opening shows the handles where they were.
        _simStartFracs = {};
        const spb = (_def && _def.simStartParams) || [];
        // a relSpanFrom marker's `y` param is a FORM field (the #6 one source) — seeded via the form, NOT _simStartFracs (which
        // would override the field). Seed only the true drag-only fraction params (x/y of a normal marker; x of a span marker).
        for (const m of spb) for (const k of (m.relSpanFrom != null ? [m.x] : [m.x, m.y])) if (k && _seed[k] != null && _seed[k] !== '') _simStartFracs[k] = Number(_seed[k]);
        render();
    },

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
