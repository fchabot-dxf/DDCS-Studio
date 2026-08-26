/** views/textView.js — Text / label engraving wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { TextWizard, layoutText, textBBox } from '../textWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';
import { populateToolSelect, toolFieldMap, getTool } from '../toolPicker.js';
import { placementSpec, placementParams } from '../ops/placement.js';
import { mountPathAnchor } from '../../ui/pathAnchorField.js';
import { workpieceFeatureItems } from '../../engine/workpiece.js';

const wizard = new TextWizard();
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
    const sel = el('tx_tool');
    if (!sel || !sel.value) return;
    const m = toolFieldMap(getTool(sel.value), { dia: 'tx_toolDia', feed: 'tx_feed', plunge: 'tx_plunge', rpm: 'tx_rpm' });
    if (Object.keys(m).length) setFields(m);
}

/** 2D layout: the glyph centrelines (preview of the letters) + a place handle and a height handle. */
function buildTextSpec(params, stock) {
    const ox = num(params.x, 0), oy = num(params.y, 0), H = num(params.height, 12);
    const width = num(params.width, 1), slant = num(params.slant, 0);
    const lay = layoutText(params);
    const items = [];
    for (const poly of lay.strokes) {
        for (let i = 0; i + 1 < poly.length; i++) {
            items.push({ kind: 'line', x1: poly[i][0], y1: poly[i][1], x2: poly[i + 1][0], y2: poly[i + 1][1] });
        }
    }
    const lineW = lay.lineW || 1;   // baseline advance (width-scaled, no slant) — anchors the width/slant handles
    // DECLARE the handles via reusable gestures (not hand-rolled): the four corners of the text box —
    // pos=point (bottom-left), height=length (top-left), width=scaleX (baseline right), slant=shear (slanted top-right).
    const { handles, onDrag, onEdit } = buildCanvasWidgets([
        { type: 'point', fx: 'tx_x', fy: 'tx_y', x: ox, y: oy, label: 'pos' },
        { type: 'length', field: 'tx_height', ax: ox, ay: oy, axis: 'y', value: H, min: 2, label: 'height' },
        { type: 'scaleX', field: 'tx_width', ax: ox, edgeX: ox + lineW, ay: oy, value: width, min: 0.2, label: 'width' },
        { type: 'shear', field: 'tx_slant', ax: ox + lineW, ay: oy, h: H, value: slant, label: 'slant°' },
    ], setFields);
    const pl = placementSpec(params, textBBox(params), 'tx_');   // opt-in: stays at x/y unless you pick a stock corner
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y, ox: pl.stockOx, oy: pl.stockOy } : null,
        placement: pl.placement, items: [...workpieceFeatureItems(pl.stockOx, pl.stockOy), ...items], handles,
        pathDatum: pl.pathDatum, stockDatum: pl.stockDatum, stockAttach: pl.stockAttach,
        onPathDatum: pl.onPathDatum, onStockAttach: pl.onStockAttach,
        onDrag, onEdit,
    };
}

export const textView = {
    type: 'text',
    panelId: 'wiz_text',
    codeElId: 'wiz_text_code',
    large: true,
    twoPane: true,
    inputIds: [
        'tx_text', 'tx_x', 'tx_y', 'tx_offX', 'tx_offY', 'tx_offZ', 'tx_pathDatum', 'tx_stockAttach', 'tx_height', 'tx_width', 'tx_slant', 'tx_spacing', 'tx_align', 'tx_strokeWidth',
        'tx_toolDia', 'tx_stepoverPct', 'tx_depth', 'tx_stepdown', 'tx_clearance', 'tx_feed', 'tx_plunge', 'tx_rpm',
    ],
    probeSrcFields: {},

    onOpen(ctx) {
        const sel = el('tx_tool');
        if (sel) { populateToolSelect(sel); if (!sel.dataset.wired) { sel.dataset.wired = '1'; sel.addEventListener('change', applyTool); } }
        mountPathAnchor('tx_');
        ctx.update();
    },

    update(ctx) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const params = {
            text: v('tx_text'), x: v('tx_x'), y: v('tx_y'), height: v('tx_height'),
            width: v('tx_width'), slant: v('tx_slant'),
            spacing: v('tx_spacing'), align: v('tx_align') || 'left', strokeWidth: v('tx_strokeWidth'),
            toolDia: v('tx_toolDia'), stepoverPct: v('tx_stepoverPct'),
            depth: v('tx_depth'), stepdown: v('tx_stepdown'), clearance: v('tx_clearance'),
            feed: v('tx_feed'), plunge: v('tx_plunge'), rpm: v('tx_rpm'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            // Opt-in placement: x/y positions the label; offset nudges it; pick a stock corner to drop it in a corner.
            originX: num(v('tx_offX'), 0), originY: num(v('tx_offY'), 0),
            ...placementParams('tx_', s.stock, true),
        };

        const gcode = wizard.generate(params);
        el('wiz_text_code').innerHTML = UIUtils.formatGCode(gcode);
        // t875 — route the PICKED tool's type + vee ANGLE to the preview so an engraving program shows the V cross-section
        // (varying stroke width with depth). The text stack has no T#/host tool otherwise → the sim falls to a flat endmill.
        const _pick = el('tx_tool'), _pt = (_pick && _pick.value) ? getTool(_pick.value) : null;
        const _opTool = _pt ? { type: _pt.type || 'endmill', dia: Number(_pt.dia) || num(params.toolDia, 6), angle: Number(_pt.angle) || undefined } : null;
        ctx.preview3D(gcode, 'textVizContainer', null, null, null, _opTool, { opType: 'text', params });   // t2176 — BACKLOG 10: whole-program context (editing splices in place; a new op previews appended at the end)
        layout.render(el('textLayoutCanvas'), buildTextSpec(params, s.stock));

        const status = el('textVizStatus');
        if (status) {
            const passes = (gcode.match(/\( level Z/g) || []).length;
            status.textContent = `"${String(params.text || '').slice(0, 18)}" · h${num(params.height, 12)} · ${passes} Z pass${passes === 1 ? '' : 'es'}`;
        }
        const lstatus = el('textLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag pos / height · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
