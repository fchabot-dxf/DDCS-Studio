/** views/pocketView.js — Pocket clearing wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { PocketWizard } from '../pocketWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';

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
    const items = [], handles = [{ id: 'origin', x: ox, y: oy, kind: 'move', label: 'pos' }];

    if (params.shape === 'circle') {
        const R = num(params.dia, 50) / 2;
        items.push({ kind: 'circle', cx: ox, cy: oy, r: R });
        handles.push({ id: 'size', x: ox + R, y: oy, kind: 'size', label: 'Ø' });
    } else {
        const w = num(params.w, 80), h = num(params.h, 60);
        items.push({ kind: 'rect', x: ox, y: oy, w, h });
        handles.push({ id: 'size', x: ox + w, y: oy + h, kind: 'size', label: 'W × H' });
    }

    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y } : null,
        items, handles,
        onDrag(id, w) {
            if (id === 'origin') { setFields({ p_originX: w.x, p_originY: w.y }); return; }
            if (params.shape === 'circle') setFields({ p_dia: Math.max(1, 2 * Math.hypot(w.x - ox, w.y - oy)) });
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
        'p_shape', 'p_originX', 'p_originY', 'p_w', 'p_h', 'p_dia',
        'p_strategy', 'p_toolDia', 'p_stepoverPct', 'p_depth', 'p_stepdown', 'p_clearance', 'p_feed', 'p_plunge', 'p_rpm',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('p_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        ctx.update();
    },

    update(ctx) {
        const shape = v('p_shape') || 'rect';
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const originX = num(v('p_originX'), 0), originY = num(v('p_originY'), 0);
        const params = {
            shape, strategy: v('p_strategy') || 'spiral',
            originX, originY,
            w: v('p_w'), h: v('p_h'), dia: v('p_dia'),
            toolDia: v('p_toolDia'), stepoverPct: v('p_stepoverPct'),
            depth: v('p_depth'), stepdown: v('p_stepdown'), clearance: v('p_clearance'),
            feed: v('p_feed'), plunge: v('p_plunge'), rpm: v('p_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
        };

        // Show only the active shape's dimension fields.
        if (el('p_dim_rect')) el('p_dim_rect').style.display = (shape === 'rect') ? '' : 'none';
        if (el('p_dim_circle')) el('p_dim_circle').style.display = (shape === 'circle') ? '' : 'none';

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
