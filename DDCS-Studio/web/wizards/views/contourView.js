/** views/contourView.js — Profile / contour cut wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { ContourWizard, contourBBox } from '../contourWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams } from '../ops/placement.js';
import { regionDesc } from '../ops/region.js';
import { contourRegion } from '../ops/contour.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';

const wizard = new ContourWizard();
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
    const sel = el('ct_tool');
    if (!sel || !sel.value) return;
    const m = toolFieldMap(getTool(sel.value), { dia: 'ct_toolDia', feed: 'ct_feed', plunge: 'ct_plunge', rpm: 'ct_rpm' });
    if (Object.keys(m).length) setFields(m);
}

/** The TRUE profile region params (rect = corner+size, circle = centre±R). */
function regionParams(params) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    if (params.shape === 'circle') return { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) };
    return { shape: 'rect', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
}

/** 2D layout: the profile boundary (what you type) + the OFFSET toolpath (where the tool centre runs) + a place
 *  handle + a size handle. The offset contour comes from contourRegion so it matches the emitted G-code exactly. */
function buildContourSpec(params, stock) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const items = [], paths = [], handles = [{ id: 'origin', x: ox, y: oy, kind: 'move', label: 'pos' }];

    if (params.shape === 'circle') {
        const R = num(params.dia, 50) / 2;
        items.push({ kind: 'circle', cx: ox, cy: oy, r: R });
        handles.push({ id: 'size', x: ox + R, y: oy, kind: 'size', label: 'Ø' });
    } else {
        const w = num(params.w, 80), h = num(params.h, 60);
        items.push({ kind: 'rect', x: ox, y: oy, w, h });
        handles.push({ id: 'size', x: ox + w, y: oy + h, kind: 'size', label: 'W × H' });
    }

    // The OFFSET toolpath (tool-centre contour) — drawn as a closed polyline guide so 2D matches what's cut.
    const rg = contourRegion({ region: regionDesc(regionParams(params)), side: params.side || 'outside', tool: num(params.toolDia, 6) });
    for (const ring of (rg.contour || [])) {
        if (!ring || ring.length < 2) continue;
        paths.push({ pts: [...ring, ring[0]].map((p) => ({ x: p.x, y: p.y })), cls: 'fc-path' });
    }

    const pl = placementSpec(params, contourBBox(params), 'ct_');
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement, items, paths, handles,
        pathDatum: pl.pathDatum, stockDatum: pl.stockDatum, stockAttach: pl.stockAttach,
        onPathDatum: pl.onPathDatum, onStockAttach: pl.onStockAttach,
        onDrag(id, w) {
            if (id === 'origin') { setFields({ ct_originX: w.x, ct_originY: w.y }); return; }
            if (params.shape === 'circle') setFields({ ct_dia: Math.max(1, 2 * Math.hypot(w.x - ox, w.y - oy)) });
            else setFields({ ct_w: Math.max(1, w.x - ox), ct_h: Math.max(1, w.y - oy) });
        },
    };
}

export const contourView = {
    type: 'contour',
    panelId: 'wiz_contour',
    codeElId: 'wiz_contour_code',
    large: true,
    twoPane: true,
    inputIds: [
        'ct_shape', 'ct_originX', 'ct_originY', 'ct_offZ', 'ct_pathDatum', 'ct_stockAttach', 'ct_w', 'ct_h', 'ct_dia', 'ct_wcs',
        'ct_side', 'ct_toolDia', 'ct_depth', 'ct_stepdown', 'ct_clearance', 'ct_feed', 'ct_plunge', 'ct_rpm',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('ct_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        mountPathAnchor('ct_');
        ctx.update();
    },

    update(ctx) {
        const shape = v('ct_shape') || 'rect';
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const originX = num(v('ct_originX'), 0), originY = num(v('ct_originY'), 0);
        const side = v('ct_side') || 'outside';
        const params = {
            shape, originX, originY,
            w: v('ct_w'), h: v('ct_h'), dia: v('ct_dia'), wcs: v('ct_wcs') || 'active',
            side, toolDia: v('ct_toolDia'),
            depth: v('ct_depth'), stepdown: v('ct_stepdown'), clearance: v('ct_clearance'),
            feed: v('ct_feed'), plunge: v('ct_plunge'), rpm: v('ct_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            ...placementParams('ct_', s.stock),   // placement (footprint attaches to a stock corner + offset)
        };

        // Show only the active shape's dimension fields.
        if (el('ct_dim_rect')) el('ct_dim_rect').style.display = (shape === 'rect') ? '' : 'none';
        if (el('ct_dim_circle')) el('ct_dim_circle').style.display = (shape === 'circle') ? '' : 'none';

        const gcode = wizard.generate(params);
        el('wiz_contour_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'contourVizContainer');
        layout.render(el('contourLayoutCanvas'), buildContourSpec(params, s.stock));

        const status = el('contourVizStatus');
        if (status) {
            const passes = (gcode.match(/\( Step Down z=/g) || []).length;
            status.textContent = `${shape} · ${side} · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('contourLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag handles · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
