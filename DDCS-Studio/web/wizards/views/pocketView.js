/** views/pocketView.js — Pocket clearing wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { PocketWizard, pocketBBox } from '../pocketWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams } from '../ops/placement.js';
import { regionDesc } from '../ops/region.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';

const wizard = new PocketWizard();
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
    const sel = el('p_tool');
    if (!sel || !sel.value) return;
    const m = toolFieldMap(getTool(sel.value), { dia: 'p_toolDia', feed: 'p_feed', plunge: 'p_plunge', rpm: 'p_rpm' });
    if (Object.keys(m).length) setFields(m);
}

/** 2D layout: the pocket outline (what the finished walls will be) + a place handle + a size handle. */
function buildPocketSpec(params, stock) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const items = [], paths = [], handles = [{ id: 'origin', x: ox, y: oy, kind: 'move', label: 'pos' }];

    if (params.shape === 'circle') {
        const R = num(params.dia, 50) / 2;
        items.push({ kind: 'circle', cx: ox, cy: oy, r: R });
        handles.push({ id: 'size', x: ox + R, y: oy, kind: 'size', label: 'Ø' });
    } else if (params.shape === 'polygon' || params.shape === 'ellipse') {
        // No SVG primitive for polygon/ellipse — draw the boundary ring from the region kernel's contour.
        const rg = regionDesc(params.shape === 'polygon'
            ? { shape: 'polygon', x: ox, y: oy, w: num(params.dia, 50), sides: num(params.sides, 6) }
            : { shape: 'ellipse', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) });
        const ring = (rg.contour && rg.contour[0]) || [];
        if (ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((p) => ({ x: p.x, y: p.y })), cls: 'fc-guide' });
        if (params.shape === 'polygon') { const R = num(params.dia, 50) / 2; handles.push({ id: 'size', x: ox + R, y: oy, kind: 'size', label: 'Ø' }); }
        else { const rx = num(params.w, 80) / 2, ry = num(params.h, 60) / 2; handles.push({ id: 'size', x: ox + rx, y: oy + ry, kind: 'size', label: 'W × H' }); }
    } else {
        const w = num(params.w, 80), h = num(params.h, 60);
        items.push({ kind: 'rect', x: ox, y: oy, w, h });
        handles.push({ id: 'size', x: ox + w, y: oy + h, kind: 'size', label: 'W × H' });
    }

    const pl = placementSpec(params, pocketBBox(params), 'p_');
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement, items, paths, handles,
        pathDatum: pl.pathDatum, stockDatum: pl.stockDatum, stockAttach: pl.stockAttach,
        onPathDatum: pl.onPathDatum, onStockAttach: pl.onStockAttach,
        onDrag(id, w) {
            if (id === 'origin') { setFields({ p_originX: w.x, p_originY: w.y }); return; }
            if (params.shape === 'circle') setFields({ p_dia: Math.max(1, 2 * Math.hypot(w.x - ox, w.y - oy)) });
            else if (params.shape === 'polygon') setFields({ p_dia: Math.max(1, 2 * Math.hypot(w.x - ox, w.y - oy)) });
            else if (params.shape === 'ellipse') setFields({ p_w: Math.max(1, 2 * (w.x - ox)), p_h: Math.max(1, 2 * (w.y - oy)) });
            else setFields({ p_w: Math.max(1, w.x - ox), p_h: Math.max(1, w.y - oy) });
        },
    };
}

export const pocketView = {
    type: 'pocket',
    panelId: 'wiz_pocket',
    codeElId: 'wiz_pocket_code',
    large: true,
    twoPane: true,
    inputIds: [
        'p_shape', 'p_originX', 'p_originY', 'p_offZ', 'p_pathDatum', 'p_stockAttach', 'p_w', 'p_h', 'p_dia', 'p_sides', 'p_wcs',
        'p_strategy', 'p_toolDia', 'p_stepoverPct', 'p_wallOffset', 'p_depth', 'p_stepdown', 'p_clearance', 'p_feed', 'p_plunge', 'p_rpm',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('p_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        mountPathAnchor('p_');
        ctx.update();
    },

    update(ctx) {
        const shape = v('p_shape') || 'rect';
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const originX = num(v('p_originX'), 0), originY = num(v('p_originY'), 0);
        const params = {
            shape, strategy: v('p_strategy') || 'spiral',
            originX, originY,
            w: v('p_w'), h: v('p_h'), dia: v('p_dia'), sides: v('p_sides'), wcs: v('p_wcs') || 'active',
            toolDia: v('p_toolDia'), stepoverPct: v('p_stepoverPct'), wallOffset: num(v('p_wallOffset'), 0),
            depth: v('p_depth'), stepdown: v('p_stepdown'), clearance: v('p_clearance'),
            feed: v('p_feed'), plunge: v('p_plunge'), rpm: v('p_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            ...placementParams('p_', s.stock),   // placement (footprint attaches to a stock corner + offset)
        };

        // Show only the active shape's dimension fields. rect/ellipse → W×H; circle/polygon → Ø (polygon adds SIDES).
        if (el('p_dim_rect')) el('p_dim_rect').style.display = (shape === 'rect' || shape === 'ellipse') ? '' : 'none';
        if (el('p_dim_circle')) el('p_dim_circle').style.display = (shape === 'circle' || shape === 'polygon') ? '' : 'none';
        if (el('p_dim_sides')) el('p_dim_sides').style.display = (shape === 'polygon') ? '' : 'none';

        const gcode = wizard.generate(params);
        el('wiz_pocket_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'pocketVizContainer');
        layout.render(el('pocketLayoutCanvas'), buildPocketSpec(params, s.stock));

        const status = el('pocketVizStatus');
        if (status) {
            const passes = (gcode.match(/\( Step Down z=/g) || []).length;
            status.textContent = `${shape} · ${params.strategy} · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('pocketLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag handles · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
