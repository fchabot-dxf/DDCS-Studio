/** views/slotView.js — Slot milling wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { SlotWizard } from '../slotWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';

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

    const items = [
        { kind: 'line', x1: ax, y1: ay, x2: bx, y2: by },                                  // centreline
        { kind: 'line', x1: ax + nx * hw, y1: ay + ny * hw, x2: bx + nx * hw, y2: by + ny * hw }, // +edge
        { kind: 'line', x1: ax - nx * hw, y1: ay - ny * hw, x2: bx - nx * hw, y2: by - ny * hw }, // -edge
    ];
    const handles = [
        { id: 'a', x: ax, y: ay, kind: 'move', label: 'A' },
        { id: 'b', x: bx, y: by, kind: 'move', label: 'B' },
        { id: 'width', x: mx + nx * hw, y: my + ny * hw, kind: 'size', label: 'width' },
    ];

    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y } : null,
        items, handles,
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
        'sl_ax', 'sl_ay', 'sl_bx', 'sl_by', 'sl_width', 'sl_wcs',
        'sl_toolDia', 'sl_stepoverPct', 'sl_depth', 'sl_stepdown', 'sl_clearance', 'sl_feed', 'sl_plunge', 'sl_rpm',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('sl_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        ctx.update();
    },

    update(ctx) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const params = {
            ax: v('sl_ax'), ay: v('sl_ay'), bx: v('sl_bx'), by: v('sl_by'), width: v('sl_width'), wcs: v('sl_wcs') || 'active',
            toolDia: v('sl_toolDia'), stepoverPct: v('sl_stepoverPct'),
            depth: v('sl_depth'), stepdown: v('sl_stepdown'), clearance: v('sl_clearance'),
            feed: v('sl_feed'), plunge: v('sl_plunge'), rpm: v('sl_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
        };

        const gcode = wizard.generate(params);
        el('wiz_slot_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'slotVizContainer');
        layout.render(el('slotLayoutCanvas'), buildSlotSpec(params, s.stock));

        const status = el('slotVizStatus');
        if (status) {
            const len = Math.hypot(num(v('sl_bx'), 60) - num(v('sl_ax'), 0), num(v('sl_by'), 0) - num(v('sl_ay'), 0));
            const passes = (gcode.match(/\( level Z/g) || []).length;
            status.textContent = `${r3(len)} mm · ${num(v('sl_width'), 6)} wide · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('slotLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag A / B / width · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
