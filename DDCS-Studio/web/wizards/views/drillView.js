/** views/drillView.js — Drill / hole-pattern wizard view (Mill group). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { DrillWizard, patternPoints } from '../drillWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { toolOptionsHTML, getTool } from '../toolPicker.js';

const wizard = new DrillWizard();
const layout = new FeatureCanvas();
const v = (id) => { const e = el(id); return e ? e.value : undefined; };
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);
const r3 = (n) => Math.round(n * 1000) / 1000;
const parseSkip = (s) => new Set(String(s || '').split(/[ ,]+/).map((t) => parseInt(t, 10)).filter((n) => n > 0));

/** Write one or more wizard fields, then fire a single 'input' so the normal update() loop redraws. */
function setFields(map) {
    let first = null;
    for (const id in map) {
        const e = el(id);
        if (!e) continue;
        e.value = String(r3(map[id]));
        first = first || e;
    }
    if (first) first.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Load the picked library tool's Ø + feed into the wizard. Peck → hole Ø = drill;
 *  Bore → tool Ø (the end mill). Works the same for ATC or manual machines. */
function applyTool() {
    const sel = el('d_tool');
    if (!sel || !sel.value) return;
    const t = getTool(sel.value);
    if (!t) return;
    const map = {};
    if (t.dia !== '' && t.dia != null) map[(v('d_method') === 'helical') ? 'd_toolDia' : 'd_holeDia'] = t.dia;
    if (t.feed !== '' && t.feed != null) map.d_feed = t.feed;
    if (t.rpm !== '' && t.rpm != null) map.d_rpm = t.rpm;   // overrides the Head default RPM
    if (Object.keys(map).length) setFields(map);   // setFields fires 'input' → update() redraws
}

/**
 * Build the 2D layout spec for the current params: stock, guides, holes, and the draggable handles.
 * Every handle drives a wizard PARAMETER via setFields() — never freeform geometry.
 */
function buildDrillSpec(params, stock) {
    const pat = params.pattern || 'grid';
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const holeR = Math.max(0.5, num(params.holeDia, 6) / 2);

    const handles = [{ id: 'origin', x: ox, y: oy, kind: 'move', label: 'pos' }];
    const items = [];

    if (pat === 'circle') {
        const R = num(params.dia, 50) / 2, a0 = num(params.startAngle, 0) * Math.PI / 180;
        items.push({ kind: 'circle', cx: ox, cy: oy, r: R });
        handles.push({ id: 'ring', x: ox + R * Math.cos(a0), y: oy + R * Math.sin(a0), kind: 'size', label: 'Ø', value: num(params.dia, 50) });
    } else if (pat === 'grid') {
        const cols = Math.max(1, Math.round(num(params.cols, 3))), rows = Math.max(1, Math.round(num(params.rows, 3)));
        const dx = num(params.dx, 20), dy = num(params.dy, 20);
        items.push({ kind: 'rect', x: ox, y: oy, w: (cols - 1) * dx, h: (rows - 1) * dy });
        handles.push({ id: 'size', x: ox + (cols - 1) * dx, y: oy + (rows - 1) * dy, kind: 'size', label: 'dx', value: dx });
    } else if (pat === 'rect') {
        const w = num(params.w, 100), h = num(params.h, 80);
        items.push({ kind: 'rect', x: ox, y: oy, w, h });
        handles.push({ id: 'size', x: ox + w, y: oy + h, kind: 'size', label: 'W', value: w });
    } else if (pat === 'line') {
        const n = Math.max(1, Math.round(num(params.count, 3))), s = num(params.spacing, 20), a = num(params.angle, 0) * Math.PI / 180;
        const ex = ox + (n - 1) * s * Math.cos(a), ey = oy + (n - 1) * s * Math.sin(a);
        items.push({ kind: 'line', x1: ox, y1: oy, x2: ex, y2: ey });
        handles.push({ id: 'end', x: ex, y: ey, kind: 'size', label: 'pitch', value: num(params.spacing, 20) });
    }

    const skip = parseSkip(params.skip);
    patternPoints(params).forEach((p, i) => items.push({ kind: 'hole', x: p.x, y: p.y, n: i + 1, r: holeR, skipped: skip.has(i + 1) }));

    const datXY = (c) => String(c || '').replace(/[^ncp]/g, '').slice(0, 2);
    const stockDat = datXY(stock && stock.datum) || 'nn';
    return {
        stock: (stock && stock.x > 0 && stock.y > 0) ? { w: stock.x, h: stock.y } : null,
        items, handles,
        // Path-datum picker (3×3 on the canvas): which pattern corner anchors on the stock. Highlighted = current
        // (falls back to the stock datum); ringed = the stock's own datum, so you can see the default.
        pathDatum: datXY(params.pathDatum) || stockDat, stockDatum: stockDat,
        onPathDatum(code) { const e = el('d_pathDatum'); if (!e) return; e.value = code; e.dispatchEvent(new Event('input', { bubbles: true })); },
        onDrag(id, w) {
            if (id === 'origin') { setFields({ d_originX: w.x, d_originY: w.y }); return; }
            if (pat === 'circle') {
                const dx = w.x - ox, dy = w.y - oy;
                setFields({ d_dia: 2 * Math.hypot(dx, dy), d_startAngle: Math.atan2(dy, dx) * 180 / Math.PI });
            } else if (pat === 'grid') {
                const cols = Math.max(1, Math.round(num(params.cols, 3))), rows = Math.max(1, Math.round(num(params.rows, 3)));
                const m = {};
                if (cols > 1) m.d_dx = Math.max(0, (w.x - ox) / (cols - 1));
                if (rows > 1) m.d_dy = Math.max(0, (w.y - oy) / (rows - 1));
                setFields(m);
            } else if (pat === 'rect') {
                setFields({ d_w: Math.max(1, w.x - ox), d_h: Math.max(1, w.y - oy) });
            } else if (pat === 'line') {
                const n = Math.max(1, Math.round(num(params.count, 3)));
                const dx = w.x - ox, dy = w.y - oy, m = { d_angle: Math.atan2(dy, dx) * 180 / Math.PI };
                if (n > 1) m.d_spacing = Math.max(0, Math.hypot(dx, dy) / (n - 1));
                setFields(m);
            }
        },
        // Type a dimension on its on-canvas label (the Centroid touch) → the matching wizard field. The handle still
        // drags for the 2-DOF tweak; this sets the primary value precisely.
        onEdit(id, val) {
            if (pat === 'circle' && id === 'ring') setFields({ d_dia: Math.max(0, val) });
            else if (pat === 'grid' && id === 'size') setFields({ d_dx: Math.max(0, val) });
            else if (pat === 'rect' && id === 'size') setFields({ d_w: Math.max(1, val) });
            else if (pat === 'line' && id === 'end') setFields({ d_spacing: Math.max(0, val) });
        },
    };
}

export const drillView = {
    type: 'drill',
    panelId: 'wiz_drill',
    codeElId: 'wiz_drill_code',
    large: true,
    twoPane: true,
    inputIds: [
        'd_pattern', 'd_skip', 'd_originX', 'd_originY', 'd_pathDatum', 'd_wcs', 'd_cols', 'd_rows', 'd_dx', 'd_dy', 'd_dia', 'd_count', 'd_startAngle',
        'd_w', 'd_h', 'd_nx', 'd_ny', 'd_lcount', 'd_spacing', 'd_angle',
        'd_method', 'd_holeDia', 'd_peck', 'd_toolDia', 'd_pitch', 'd_ramp', 'd_depth', 'd_clearance', 'd_feed', 'd_rpm',
    ],
    probeSrcFields: {},   // not a probe wizard — keep the shared controller-source decorator a no-op

    // Variant entries (Drill vs Bore): one form, two menu entries. Lock the method + hide its selector so the
    // op's identity is fixed by which entry opened it — no toggle to silently turn a drill into a bore.
    variants: [{ id: 'drill', label: 'Drill' }, { id: 'bore', label: 'Bore' }],
    applyVariant(variant) {
        const m = el('d_method');
        if (m && variant === 'bore') m.value = 'helical';
        else if (m && variant === 'drill') m.value = 'peck';   // (no variant = edit: keep the seeded method)
        ['d_method_cell', 'd_method_label'].forEach((id) => { const e = el(id); if (e) e.style.display = 'none'; });
    },

    // Custom params → form (pattern variants: `count` lives in d_count for circle but d_lcount for line, so a
    // flat map can't express it). The inverse of update()'s reads; used by wizardManager._seedForm on edit.
    setForm(p = {}) {
        const set = (id, val) => { const e = el(id); if (e && val != null) e.value = val; };
        set('d_pattern', p.pattern); set('d_method', p.method); set('d_skip', p.skip);
        set('d_originX', p.originX); set('d_originY', p.originY); set('d_pathDatum', p.pathDatum); set('d_wcs', p.wcs);
        set('d_depth', p.depth); set('d_clearance', p.clearance); set('d_feed', p.feed); set('d_rpm', p.rpm);
        set('d_holeDia', p.holeDia); set('d_peck', p.peck); set('d_toolDia', p.toolDia); set('d_pitch', p.pitch); set('d_ramp', p.ramp);
        if (p.pattern === 'grid') { set('d_cols', p.cols); set('d_rows', p.rows); set('d_dx', p.dx); set('d_dy', p.dy); }
        else if (p.pattern === 'circle') { set('d_dia', p.dia); set('d_count', p.count); set('d_startAngle', p.startAngle); }
        else if (p.pattern === 'rect') { set('d_w', p.w); set('d_h', p.h); set('d_nx', p.nx); set('d_ny', p.ny); }
        else if (p.pattern === 'line') { set('d_lcount', p.count); set('d_spacing', p.spacing); set('d_angle', p.angle); }
    },

    onOpen(ctx) {
        // Populate the Tool ▾ picker from the library each open (it may have changed in Settings).
        const sel = el('d_tool');
        if (sel) {
            const keep = sel.value;
            sel.innerHTML = toolOptionsHTML();
            sel.value = keep;   // preserve selection if the tool still exists
            if (!sel.dataset.wired) {
                sel.dataset.wired = '1';
                sel.addEventListener('change', () => applyTool());
            }
        }
        ctx.update();
    },

    update(ctx) {
        const pattern = v('d_pattern') || 'grid';
        const method = v('d_method') || 'peck';
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        // One shared position drives whichever anchor the active pattern uses (centre for circle,
        // first hole / min-XY corner for the rest); patternPoints reads cx/cy or x0/y0 per pattern.
        const originX = num(v('d_originX'), 0), originY = num(v('d_originY'), 0);
        const params = {
            pattern, method, skip: v('d_skip') || '', wcs: v('d_wcs') || 'active',
            originX, originY, cx: originX, cy: originY, x0: originX, y0: originY,
            depth: v('d_depth'), clearance: v('d_clearance'), feed: v('d_feed'), rpm: v('d_rpm'),
            holeDia: v('d_holeDia'), peck: v('d_peck'), toolDia: v('d_toolDia'), pitch: v('d_pitch'), ramp: v('d_ramp'),
            spindle: s.spindle, head: s.head, endProgram: s.endProgram,
            // Path datum: which corner of the pattern anchors on the stock. Default = the stock's datum, so the path
            // follows the stock onto it (see placeOnStock). The picker on the 2D canvas sets d_pathDatum.
            stockDatum: (s.stock && s.stock.datum) || 'nnp', pathDatum: v('d_pathDatum') || '',
        };
        if (pattern === 'grid') Object.assign(params, { cols: v('d_cols'), rows: v('d_rows'), dx: v('d_dx'), dy: v('d_dy') });
        else if (pattern === 'circle') Object.assign(params, { dia: v('d_dia'), count: v('d_count'), startAngle: v('d_startAngle') });
        else if (pattern === 'rect') Object.assign(params, { w: v('d_w'), h: v('d_h'), nx: v('d_nx'), ny: v('d_ny') });
        else if (pattern === 'line') Object.assign(params, { count: v('d_lcount'), spacing: v('d_spacing'), angle: v('d_angle') });

        // Show only the selected pattern's / method's fields.
        ['grid', 'circle', 'rect', 'line'].forEach((p) => { const e = el('d_pat_' + p); if (e) e.style.display = (p === pattern) ? '' : 'none'; });
        if (el('d_method_peck')) el('d_method_peck').style.display = (method === 'peck') ? '' : 'none';
        if (el('d_method_bore')) el('d_method_bore').style.display = (method === 'helical') ? '' : 'none';

        const gcode = wizard.generate(params);
        el('wiz_drill_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'drillVizContainer');

        // 2D editable layout (left of the 3D verify view).
        layout.render(el('drillLayoutCanvas'), buildDrillSpec(params, s.stock));

        const status = el('drillVizStatus');
        if (status) {
            const holes = (gcode.match(/\( hole \d+\/\d+ \)/g) || []).length;
            status.textContent = `${pattern} · ${method === 'helical' ? 'bore' : 'peck'} · ${holes} holes`;
        }
        const lstatus = el('drillLayoutStatus');
        if (lstatus) lstatus.textContent = 'LAYOUT · drag handles · scroll = zoom · drag bg = pan · dbl-click = fit';
    },
};
