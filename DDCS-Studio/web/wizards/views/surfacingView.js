/** views/surfacingView.js — Surfacing / face-mill wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { SurfacingWizard, surfacingBBox } from '../surfacingWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams, handleScale } from '../ops/placement.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';
import { workpieceFeatureItems } from '../../engine/workpiece.js';
// t1609 — the Z-mode field CONSUMES the twin's declaration (options/label/help/default) + the declared skim-greys-WCS
// gate. One source: a hand-copied options list here is the drift this arc treats (the emit has handled zMode since
// 8ce70873; only the visible knob was missing).
import { SURFACING_STRUCT, SURFACING_BINDINGS, startMarkerTarget, startMarkerVarSeed } from '../../blocks/dataOps/surfacingData.js';
import { wireTokenGuard } from '../../ui/formWidgets.js';   // t1706 (cycle ACT 3) — the SAME accept/refuse mechanism the twin form uses, driven by the SAME declared bindings

const ZMODE_SPEC = SURFACING_STRUCT.find((b) => b.param === 'zMode');
const WCS_GATE = (SURFACING_BINDINGS.find((b) => b.param === 'wcs') || {}).gate || null;   // { param:'zMode', is:'skim', tip }

/** t1706 — wire the declared token guard onto every field this legacy view owns, once. The DOM id convention
 *  here is uniformly `sf_<param>` (see `inputIds` below), so no second name-mapping list is needed — the SAME
 *  SURFACING_BINDINGS/SURFACING_STRUCT the twin form itself reads. A param with no token declaration (or no
 *  matching `sf_` field, e.g. a structural id this view doesn't render) is silently skipped — wireTokenGuard
 *  itself no-ops on an undeclared binding, fail-closed. */
function mountTokenGuards() {
    const host = el('sf_w');   // any real field in this form; used only as a dataset home for the once-guard
    if (!host || host.dataset.tokenGuardsWired) return;
    host.dataset.tokenGuardsWired = '1';
    for (const b of [...SURFACING_BINDINGS, ...SURFACING_STRUCT]) {
        const inp = b && b.param && el('sf_' + b.param);
        if (inp) wireTokenGuard(inp, b);
    }
}

/** Populate the empty sf_zMode skeleton from the DECLARED spec (once). The HTML carries no option/label/help text. */
function mountZMode() {
    const sel = el('sf_zMode'), lbl = el('sf_zModeLabel');
    if (!sel || sel.dataset.wired) return;
    sel.dataset.wired = '1';
    for (const [label, value] of (ZMODE_SPEC.widgetConfig && ZMODE_SPEC.widgetConfig.options) || []) {
        const op = document.createElement('option');
        op.value = String(value); op.textContent = String(label);
        sel.appendChild(op);
    }
    sel.value = String(ZMODE_SPEC.default);
    sel.title = ZMODE_SPEC.help || '';
    if (lbl) lbl.textContent = String(ZMODE_SPEC.label || 'Z-mode').toUpperCase();   // presentation case only; the text is the declaration's
}

const wizard = new SurfacingWizard();
const layout = new FeatureCanvas();
const v = (id) => { const e = el(id); return e ? e.value : undefined; };
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);
const r3 = (n) => Math.round(n * 1000) / 1000;

function setFields(map) {
    let first = null;
    for (const id in map) { const e = el(id); if (!e) continue; e.value = String(r3(map[id])); first = first || e; }
    if (first) first.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Load the picked library tool's Ø / feed / plunge / RPM as this op's defaults. */
function applyTool() {
    const sel = el('sf_tool');
    if (!sel || !sel.value) return;
    const m = toolFieldMap(getTool(sel.value), { dia: 'sf_toolDia', feed: 'sf_feed', plunge: 'sf_plunge', rpm: 'sf_rpm' });
    if (Object.keys(m).length) setFields(m);
}

/** 2D layout: the face area rectangle with a START-POSITION handle + a size handle. */
function buildSurfacingSpec(params, stock) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const w = num(params.w, 100), h = num(params.h, 80);
    const hs = handleScale(params, 'sf_', ox, oy, w, h);
    // t1648 — the pos handle IS the start-position marker: ONE widget, the Z-mode declares its target (the SAME
    // mapping surfacingData.js's twin reads — `startMarkerTarget`, the wizards-as-data seam). Normal/WCS: byte-
    // identical to before (originX/originY, the same `...hs.pos` corner-anchor spread). Skim: a free jog point
    // (jogX/jogY, no corner-anchor semantics — it isn't a corner of the faced-area rect).
    const tgt = startMarkerTarget(params.zMode);
    const isSkim = params.zMode === 'skim';
    const posGeom = isSkim ? { x: num(params.jogX, 0), y: num(params.jogY, 0), labelDir: hs.pos.labelDir } : { x: ox, y: oy, ...hs.pos };
    // DECLARE the handles via reusable gestures (not hand-rolled): pos = `point`, the face area = a `rect` corner.
    // t1674 — Skim's marker is a FREE jog point, explicitly no corner semantics (see the comment above posGeom); once
    // the drawn rect also tracks it (below), the GENERIC itemsBBox-derived snap offsets (_snapOffsets, meant to let
    // ANY corner of a fixed-size feature align to a stock anchor) become self-referential — the rect's bbox now
    // chases the very handle being dragged, turning the normal 7px snap tolerance into a virtual net spanning the
    // whole w×h rect (caught live: a 30,-15px drag snapped to (20,15) instead of the raw ~25,~12.5 — a stock-centre
    // coincidence neither user nor emit ever asked for). noSnap:true for Skim opts out cleanly, matching the SAME
    // free-jog treatment already used for the alignment/rotary probe start markers.
    const { handles, onDrag, onEdit } = buildCanvasWidgets([
        { type: 'point', id: 'origin', fx: 'sf_' + tgt.x, fy: 'sf_' + tgt.y, label: 'pos', noSnap: isSkim, ...posGeom },
        { type: 'rect', id: 'size', field: 'sf_w', fieldH: 'sf_h', minw: 1, minh: 1, label: 'W × H', ...hs.size },
    ], setFields);
    const pl = placementSpec(params, surfacingBBox(params), 'sf_');
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement,
        // t1674 — the DRAWN rect follows posGeom (the ONE declared marker target: jogX/jogY in Skim, originX/originY
        // else — the same value the 'pos' handle above is built from), not the raw originX/originY: Skim's program is
        // relative to wherever the operator jogs, so the faced area IS physically at the jog point, and a preview
        // anchored at a meaningless "origin" would lie about where the cut lands. handleScale's OWN ox/oy argument
        // (feeding hs.size, the resize-handle anchor) stays untouched — that anchor is about the faced area's declared
        // extent, not about where you happen to jog; conflating the two broke surfacing-start-position-1648 test 7 in
        // an earlier trial (drag sensitivity/seed diverged between the wizard and twin faces).
        items: [...workpieceFeatureItems(pl.stockOx, pl.stockOy), { kind: 'rect', x: posGeom.x, y: posGeom.y, w, h }],
        handles,
        pathDatum: pl.pathDatum, stockDatum: pl.stockDatum, stockAttach: pl.stockAttach,
        onPathDatum: pl.onPathDatum, onStockAttach: pl.onStockAttach,
        onDrag, onEdit,
    };
}

export const surfacingView = {
    type: 'surfacing',
    panelId: 'wiz_surfacing',
    codeElId: 'wiz_surfacing_code',
    large: true,
    twoPane: true,
    inputIds: [
        'sf_originX', 'sf_originY', 'sf_offZ', 'sf_pathDatum', 'sf_stockAttach', 'sf_jogX', 'sf_jogY', 'sf_w', 'sf_h', 'sf_wcs', 'sf_zMode',
        'sf_strategy', 'sf_toolDia', 'sf_stepoverPct', 'sf_depth', 'sf_stepdown', 'sf_clearance', 'sf_feed', 'sf_plunge', 'sf_rpm',
    ],
    probeSrcFields: {},

    // Default the area to the whole current stock top whenever the wizard is opened.
    onOpen(ctx) {
        const sel = el('sf_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        mountZMode();   // t1609 — build the Z-mode dropdown from the twin's declaration (no-op after the first open)
        mountTokenGuards();   // t1706 — no-op after the first open
        const st = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
        mountPathAnchor('sf_');
        if (st && st.x > 0 && st.y > 0) setFields({ sf_originX: 0, sf_originY: 0, sf_w: st.x, sf_h: st.y });
        else ctx.update();
    },

    update(ctx) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const params = {
            originX: v('sf_originX'), originY: v('sf_originY'), w: v('sf_w'), h: v('sf_h'), wcs: v('sf_wcs') || 'active',
            zMode: v('sf_zMode') || ZMODE_SPEC.default,   // t1609 — the declared default ('normal') = byte-identical to the pre-field emit
            jogX: v('sf_jogX'), jogY: v('sf_jogY'),   // t1648 — the Skim-mode start marker's PREVIEW-ONLY target (never emitted; see startMarkerTarget)
            strategy: v('sf_strategy') || 'raster',
            toolDia: v('sf_toolDia'), stepoverPct: v('sf_stepoverPct'),
            depth: v('sf_depth'), stepdown: v('sf_stepdown'), clearance: v('sf_clearance'),
            feed: v('sf_feed'), plunge: v('sf_plunge'), rpm: v('sf_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            ...placementParams('sf_', s.stock),   // placement (faced area attaches to a stock corner + offset)
        };

        // t1609 — the DECLARED skim-greys-WCS gate (the same `gate` the twin's form applies): Skim faces relative to
        // the jog start, so there is no WCS frame to pick. Grey, don't hide; data-op-gated survives postGating's
        // cap-ON re-enable (the middleView clearance-plane precedent). The declared tip is the whole why.
        const wcsSel = el('sf_wcs');
        if (wcsSel && WCS_GATE) {
            const gated = params[WCS_GATE.param] === WCS_GATE.is;
            if (!wcsSel.dataset.origTitle) wcsSel.dataset.origTitle = wcsSel.title || '';
            wcsSel.disabled = gated;
            wcsSel.setAttribute('data-op-gated', gated ? 'true' : 'off');
            wcsSel.title = gated ? WCS_GATE.tip : wcsSel.dataset.origTitle;
        }

        const gcode = wizard.generate(params);
        el('wiz_surfacing_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'surfacingVizContainer', undefined, undefined, undefined, undefined, { opType: 'surfacing', params });   // t2176 — BACKLOG 10: whole-program context when editing an existing op
        // t1648/t1650 — the ONE declared seed shape (startMarkerVarSeed, surfacingData.js) — the twin calls the same
        // function for the same params; a future edit to the seed shape can no longer diverge between faces.
        if (ctx.previewVarSeed) ctx.previewVarSeed('surfacingVizContainer', startMarkerVarSeed(params));
        layout.render(el('surfacingLayoutCanvas'), buildSurfacingSpec(params, s.stock));

        const status = el('surfacingVizStatus');
        if (status) {
            const passes = (gcode.match(/\( Step Down z=/g) || []).length;
            status.textContent = `${num(v('sf_w'), 100)} × ${num(v('sf_h'), 80)} · ${params.strategy} · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('surfacingLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag handles · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
