/** views/surfacingView.js — Surfacing / face-mill wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { SurfacingWizard, surfacingBBox } from '../surfacingWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams, handleScale } from '../ops/placement.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';
import { workpieceFeatureItems } from '../../engine/workpiece.js';

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

/** 2D layout: the face area rectangle with a place handle + a size handle. */
function buildSurfacingSpec(params, stock) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const w = num(params.w, 100), h = num(params.h, 80);
    const hs = handleScale(params, 'sf_', ox, oy, w, h);
    // DECLARE the handles via reusable gestures (not hand-rolled): pos = `point`, the face area = a `rect` corner.
    const { handles, onDrag, onEdit } = buildCanvasWidgets([
        { type: 'point', id: 'origin', fx: 'sf_originX', fy: 'sf_originY', x: ox, y: oy, label: 'pos', ...hs.pos },
        { type: 'rect', id: 'size', field: 'sf_w', fieldH: 'sf_h', minw: 1, minh: 1, label: 'W × H', ...hs.size },
    ], setFields);
    console.log('buildSurfacingSpec handles:', handles, 'hs:', hs);
    const pl = placementSpec(params, surfacingBBox(params), 'sf_');
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement,
        items: [...workpieceFeatureItems(pl.stockOx, pl.stockOy), { kind: 'rect', x: ox, y: oy, w, h }],
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
        'sf_originX', 'sf_originY', 'sf_offZ', 'sf_pathDatum', 'sf_stockAttach', 'sf_w', 'sf_h', 'sf_wcs',
        'sf_strategy', 'sf_toolDia', 'sf_stepoverPct', 'sf_depth', 'sf_stepdown', 'sf_clearance', 'sf_feed', 'sf_plunge', 'sf_rpm',
    ],
    probeSrcFields: {},

    // Default the area to the whole current stock top whenever the wizard is opened.
    onOpen(ctx) {
        const sel = el('sf_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        const st = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || null;
        mountPathAnchor('sf_');
        if (st && st.x > 0 && st.y > 0) setFields({ sf_originX: 0, sf_originY: 0, sf_w: st.x, sf_h: st.y });
        else ctx.update();
    },

    update(ctx) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const params = {
            originX: v('sf_originX'), originY: v('sf_originY'), w: v('sf_w'), h: v('sf_h'), wcs: v('sf_wcs') || 'active',
            strategy: v('sf_strategy') || 'raster',
            toolDia: v('sf_toolDia'), stepoverPct: v('sf_stepoverPct'),
            depth: v('sf_depth'), stepdown: v('sf_stepdown'), clearance: v('sf_clearance'),
            feed: v('sf_feed'), plunge: v('sf_plunge'), rpm: v('sf_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            ...placementParams('sf_', s.stock),   // placement (faced area attaches to a stock corner + offset)
        };

        const gcode = wizard.generate(params);
        el('wiz_surfacing_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'surfacingVizContainer');
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
