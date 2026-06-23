/** views/slotView.js — Slot milling wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { SlotWizard, slotArrayBBox, slotPatterned, slotPatternPoints } from '../slotWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams } from '../ops/placement.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';

const wizard = new SlotWizard();
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
    const sel = el('sl_tool');
    if (!sel || !sel.value) return;
    const m = toolFieldMap(getTool(sel.value), { dia: 'sl_toolDia', feed: 'sl_feed', plunge: 'sl_plunge', rpm: 'sl_rpm' });
    if (Object.keys(m).length) setFields(m);
}

/** 2D layout: the slot centreline + its two edges, with draggable A, B and a width handle. */
function buildSlotSpec(params, stock) {
    const ax = num(params.ax, 0), ay = num(params.ay, 0), bx = num(params.bx, 60), by = num(params.by, 0);
    const W = Math.max(num(params.toolDia, 6), num(params.width, num(params.toolDia, 6)));
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;          // perpendicular unit
    const mx = (ax + bx) / 2, my = (ay + by) / 2;  // midpoint
    const hw = W / 2;

    // Draw the slot (centreline + both edges) at each pattern offset; a single slot is just the [0,0] offset.
    const offsets = slotPatterned(params) ? slotPatternPoints(params) : [{ x: 0, y: 0 }];
    const items = [];
    offsets.forEach((o) => {
        items.push({ kind: 'line', x1: ax + o.x, y1: ay + o.y, x2: bx + o.x, y2: by + o.y });                                  // centreline
        items.push({ kind: 'line', x1: ax + nx * hw + o.x, y1: ay + ny * hw + o.y, x2: bx + nx * hw + o.x, y2: by + ny * hw + o.y }); // +edge
        items.push({ kind: 'line', x1: ax - nx * hw + o.x, y1: ay - ny * hw + o.y, x2: bx - nx * hw + o.x, y2: by - ny * hw + o.y }); // -edge
    });
    const handles = [   // handles sit on the base slot (the [0,0] copy); editing it repeats across the pattern
        { id: 'a', x: ax, y: ay, kind: 'move', label: 'A' },
        { id: 'b', x: bx, y: by, kind: 'move', label: 'B' },
        { id: 'width', x: mx + nx * hw, y: my + ny * hw, kind: 'size', label: 'width' },
    ];

    const pl = placementSpec(params, slotArrayBBox(params), 'sl_');   // opt-in: stays at A↔B unless you pick a stock corner
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement, items, handles,
        pathDatum: pl.pathDatum, stockDatum: pl.stockDatum, stockAttach: pl.stockAttach,
        onPathDatum: pl.onPathDatum, onStockAttach: pl.onStockAttach,
        onDrag(id, w) {
            if (id === 'a') { setFields({ sl_ax: w.x, sl_ay: w.y }); return; }
            if (id === 'b') { setFields({ sl_bx: w.x, sl_by: w.y }); return; }
            if (id === 'width') {                // perpendicular distance from the centreline → full width
                const proj = (w.x - mx) * nx + (w.y - my) * ny;
                setFields({ sl_width: Math.max(num(params.toolDia, 6), 2 * Math.abs(proj)) });
            }
        },
    };
}

export const slotView = {
    type: 'slot',
    panelId: 'wiz_slot',
    codeElId: 'wiz_slot_code',
    large: true,
    twoPane: true,
    inputIds: [
        'sl_ax', 'sl_ay', 'sl_bx', 'sl_by', 'sl_width', 'sl_offX', 'sl_offY', 'sl_offZ', 'sl_pathDatum', 'sl_stockAttach', 'sl_wcs',
        'sl_toolDia', 'sl_stepoverPct', 'sl_depth', 'sl_stepdown', 'sl_clearance', 'sl_feed', 'sl_plunge', 'sl_rpm',
        'sl_pattern', 'sl_skip', 'sl_cols', 'sl_rows', 'sl_dx', 'sl_dy', 'sl_lcount', 'sl_spacing', 'sl_angle', 'sl_dia', 'sl_count', 'sl_startAngle', 'sl_w', 'sl_h', 'sl_nx', 'sl_ny',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('sl_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        mountPathAnchor('sl_');
        ctx.update();
    },

    update(ctx) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const pattern = v('sl_pattern') || 'single';
        const params = {
            ax: v('sl_ax'), ay: v('sl_ay'), bx: v('sl_bx'), by: v('sl_by'), width: v('sl_width'), wcs: v('sl_wcs') || 'active',
            toolDia: v('sl_toolDia'), stepoverPct: v('sl_stepoverPct'),
            depth: v('sl_depth'), stepdown: v('sl_stepdown'), clearance: v('sl_clearance'),
            feed: v('sl_feed'), plunge: v('sl_plunge'), rpm: v('sl_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            pattern, skip: v('sl_skip') || '',   // REPEAT (array): single, or a pattern offsetting copies of the slot
            // Opt-in placement: A↔B positions the slot; offset (sl_offX/Y/Z) nudges it; pick a stock corner to attach.
            originX: num(v('sl_offX'), 0), originY: num(v('sl_offY'), 0),
            ...placementParams('sl_', s.stock, true),
        };
        if (pattern === 'grid') Object.assign(params, { cols: v('sl_cols'), rows: v('sl_rows'), dx: v('sl_dx'), dy: v('sl_dy') });
        else if (pattern === 'line') Object.assign(params, { count: v('sl_lcount'), spacing: v('sl_spacing'), angle: v('sl_angle') });
        else if (pattern === 'circle') Object.assign(params, { dia: v('sl_dia'), count: v('sl_count'), startAngle: v('sl_startAngle') });
        else if (pattern === 'rect') Object.assign(params, { w: v('sl_w'), h: v('sl_h'), nx: v('sl_nx'), ny: v('sl_ny') });
        ['grid', 'line', 'circle', 'rect'].forEach((pp) => { const e = el('sl_pat_' + pp); if (e) e.style.display = (pp === pattern) ? '' : 'none'; });

        const gcode = wizard.generate(params);
        el('wiz_slot_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'slotVizContainer');
        layout.render(el('slotLayoutCanvas'), buildSlotSpec(params, s.stock));

        const status = el('slotVizStatus');
        if (status) {
            const len = Math.hypot(num(v('sl_bx'), 60) - num(v('sl_ax'), 0), num(v('sl_by'), 0) - num(v('sl_ay'), 0));
            const passes = (gcode.match(/\( level Z/g) || []).length;
            const nSlots = slotPatterned(params) ? slotPatternPoints(params).length : 1;   // copies in the pattern
            const arr = nSlots > 1 ? `${nSlots} slots · ` : '';
            status.textContent = `${arr}${r3(len)} mm · ${num(v('sl_width'), 6)} wide · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('slotLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag A / B / width · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
