/**
 * ui/formWidgets.js — the FORM-side widget registry for custom-op forms (P1 of the widget library).
 *
 * A custom op's UI is composed from WIDGETS. Each widget renders an input into a form row and exposes
 * read() → { param: value }; multi-param widgets (P2 canvas pickers) return several params. A binding declares
 * `widget` (a registry key) + `widgetConfig`; the form picks that widget, or a sensible default per binding.type.
 * This is the FORM half of a widget; the BLOCK half (a Blockly field, e.g. field_cornergrid) is a separate adapter
 * that wraps the same core — see vendor/blockly + cornerGridSvg.js for the proven dual-render pattern.
 *
 * The registry is EXTENSIBLE (like the ops/BUILDERS registry): add a widget = add one entry here (+ its block
 * adapter when it needs one). Number params stay the easy default; richer widgets are opt-in.
 */
import { CG, buildCornerCells, paintCornerGrid } from './cornerGridSvg.js';
import { buildRegions, paintRegions, regionValueFromEvent, regionLabel } from './regionPickSvg.js';
import { FeatureCanvas } from '../viz/featureCanvas.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const ROW_CSS = 'display:flex; align-items:center; justify-content:space-between; gap:14px; margin:9px 0;';
const CTRL_CSS = 'padding:5px 8px; background:var(--bg,#0b0f14); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px;';
const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, a, z) => Math.max(a, Math.min(z, v));

function labelSpan(b) {
    const span = document.createElement('span');
    span.textContent = b.label || b.param;
    if (b.units || (b.widgetConfig && b.widgetConfig.units)) {
        const u = document.createElement('span');
        u.style.opacity = '.6';
        u.textContent = ` (${b.units || b.widgetConfig.units})`;
        span.appendChild(u);
    }
    return span;
}

// ── widgets: render(host, binding) → { read() } ───────────────────────────────────────────────────────────────
function numberWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = ROW_CSS;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = cfg.step || 'any';
    const min = cfg.min ?? b.min, max = cfg.max ?? b.max;
    if (min != null) inp.min = min;
    if (max != null) inp.max = max;
    inp.value = b.default ?? 0;
    inp.style.cssText = CTRL_CSS + ' width:120px;';
    inp.dataset.param = b.param;   // so a 2D-preview handle can write this field back (drag-to-edit derives from roles)
    // t87 — source-chips: a probe field the user opted 'ctrl' (on a profile with a native register) is provided by the
    // CONTROLLER — GREY the input + tooltip the Pr (the emit uses the register, not this literal). post-field-gating pattern.
    const src = (b.sourceField && typeof window !== 'undefined' && window.ddcsProbeSrc) ? window.ddcsProbeSrc(b.sourceField) : null;
    if (src) { inp.disabled = true; inp.style.opacity = '.5'; inp.title = `From the controller (${src.pr || src.label || 'register'}) — change in Settings ▸ Probes`; }
    host.append(labelSpan(b), inp);
    return { read: () => ({ [b.param]: numOr(inp.value, b.default ?? 0) }) };
}

function sliderWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = ROW_CSS;
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
    const rng = document.createElement('input');
    rng.type = 'range';
    rng.min = cfg.min ?? b.min ?? 0; rng.max = cfg.max ?? b.max ?? 100; rng.step = cfg.step || 1;
    rng.value = b.default ?? rng.min;
    rng.dataset.param = b.param;   // 2D-preview handle can write this field back (drag-to-edit derives from roles)
    const out = document.createElement('span');
    out.style.cssText = 'min-width:42px; text-align:right; opacity:.85;';
    out.textContent = rng.value;
    rng.addEventListener('input', () => { out.textContent = rng.value; });
    wrap.append(rng, out);
    host.append(labelSpan(b), wrap);
    return { read: () => ({ [b.param]: numOr(rng.value, b.default ?? 0) }) };
}

function dropdownWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const sel = document.createElement('select');
    sel.style.cssText = CTRL_CSS + ' min-width:120px;';
    for (const o of ((b.widgetConfig && b.widgetConfig.options) || [])) {
        const val = Array.isArray(o) ? o[1] : o, lab = Array.isArray(o) ? o[0] : o;
        const op = document.createElement('option');
        op.value = String(val); op.textContent = String(lab);
        if (String(val) === String(b.default)) op.selected = true;
        sel.appendChild(op);
    }
    host.append(labelSpan(b), sel);
    // numeric bindings (a param-block dropdown of presets) commit a number; enum/string keep the raw option value.
    const numeric = b.type === 'number' || b.type === 'int';
    return { read: () => ({ [b.param]: numeric ? numOr(sel.value, b.default ?? 0) : sel.value }) };
}

function toggleWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const lab = document.createElement('label');
    lab.className = 'ddcs-switch';
    lab.innerHTML = '<input type="checkbox"><span class="ddcs-slider"></span>';
    const cb = lab.querySelector('input');
    cb.checked = !!b.default;
    host.append(labelSpan(b), lab);
    // a bool binding commits true/false; a numeric param-block toggle commits 1/0 (it lands in a numeric socket).
    const numeric = b.type === 'number' || b.type === 'int';
    return { read: () => ({ [b.param]: numeric ? (cb.checked ? 1 : 0) : cb.checked }) };
}

function textWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = b.default ?? '';
    inp.style.cssText = CTRL_CSS + ' width:150px;';
    host.append(labelSpan(b), inp);
    return { read: () => ({ [b.param]: inp.value }) };
}

// the 3×3 datum picker — the SAME core (cornerGridSvg.js) the Blockly field_cornergrid + wizard pathAnchorField use.
// Value is a 2-char [X][Y] code (n/c/p = min/centre/max); '' = follow (only reachable when widgetConfig.allowFollow).
const CORNER_NAMES = { nn: 'front-left', cn: 'front', pn: 'front-right', nc: 'left', cc: 'centre', pc: 'right', np: 'back-left', cp: 'back', pp: 'back-right' };
function cornerGridWidget(host, b) {
    const cfg = b.widgetConfig || {};
    const colour = cfg.colour || '#4ab3ff';
    host.style.cssText = ROW_CSS;
    let cur = (b.default != null) ? String(b.default) : '';
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', CG.SPAN); svg.setAttribute('height', CG.SPAN); svg.setAttribute('viewBox', `0 0 ${CG.SPAN} ${CG.SPAN}`);
    svg.style.cursor = 'pointer';
    const { cells, cross } = buildCornerCells(svg);
    for (const code in cells) { const t = document.createElementNS(SVGNS, 'title'); t.textContent = CORNER_NAMES[code]; cells[code].appendChild(t); }
    const repaint = () => paintCornerGrid(cells, cross, colour, cur);
    svg.addEventListener('click', (e) => {                          // crosshair lines are pointer-transparent → e.target is the cell rect
        const code = e.target && e.target.getAttribute && e.target.getAttribute('data-code');
        if (!code) return;
        cur = (cur === code && cfg.allowFollow) ? '' : code;        // re-click → follow, only if the binding allows it
        repaint();
    });
    repaint();
    host.append(labelSpan(b), svg);
    return { read: () => ({ [b.param]: cur }) };
}

// the REGION-PICK control — a "make your own datum": click a region (rect/poly/freeform) on an optional backdrop;
// the picked region's NUMBER is committed (binds to a numeric socket → valid by construction). Shares its core
// (regionPickSvg.js) with the Blockly field, exactly like the datum. spec lives in widgetConfig {viewBox, backdrop,
// regions:[{shape,…,value,label}]}.
function regionPickWidget(host, b) {
    const cfg = b.widgetConfig || {};
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const first = (cfg.regions && cfg.regions[0] && cfg.regions[0].value);
    let cur = (b.default != null) ? b.default : (first != null ? first : 0);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.style.cssText = 'width:100%; max-width:320px; border:1px solid var(--border,#2a3340); border-radius:8px; background:var(--bg,#0b0f14);';
    const regions = buildRegions(svg, cfg);
    const echo = document.createElement('div');   // echo the picked region's LABEL — what was committed, not just the lit shape
    echo.style.cssText = 'font-size:11px; opacity:.8; min-height:14px;';
    const updateEcho = () => { const l = regionLabel(cfg, cur); echo.textContent = l ? `▸ ${l}` : ''; };
    const repaint = () => { paintRegions(regions, cur); updateEcho(); };
    svg.addEventListener('click', (e) => {
        const v = regionValueFromEvent(regions, e);   // topmost-wins (SVG paint order); single-select → one `cur`
        if (v == null) return;
        cur = v; repaint(); host.dispatchEvent(new Event('input', { bubbles: true }));
    });
    repaint();
    host.append(svg, echo);
    return { read: () => ({ [b.param]: numOr(cur, b.default ?? 0) }) };
}

// ── canvas pickers (multi-param) ─────────────────────────────────────────────────────────────────────────────
// FORM-ONLY widgets built on FeatureCanvas (the same engine the built-in wizards' 2D layout uses): a draggable
// handle drives several params at once. A canvas inside a Blockly block is deliberately NOT attempted — the block
// renders those params as plain fields (the seam for a future mini-canvas block field stays open, unused). Each
// takes the binding GROUP (bindings sharing `group`, each tagged with a `role`: x/y/w/h) and reads every param.
function resolveBounds(cfg) {
    if (cfg.bounds && cfg.bounds.w > 0 && cfg.bounds.h > 0) return cfg.bounds;          // explicit {w,h,ox,oy}
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings && (window.ddcsGetSettings().stock)) || null;
    if (s && s.x > 0 && s.y > 0) return { w: s.x, h: s.y, ox: 0, oy: 0 };               // the real stock, when there is one
    return { w: cfg.w || 200, h: cfg.h || 150, ox: 0, oy: 0 };                          // a neutral default canvas
}
function canvasHost(host, b) {
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const c = document.createElement('div');
    c.style.cssText = `width:100%; height:${(b.widgetConfig && b.widgetConfig.height) || 175}px; border:1px solid var(--border,#2a3340); border-radius:8px; overflow:hidden;`;
    host.appendChild(c);
    return c;
}
const rolesOf = (group, primary) => { const m = {}; for (const g of (group && group.length ? group : [primary])) m[g.role || 'x'] = g; return m; };

function xyPadWidget(host, primary, group) {
    const role = rolesOf(group, primary), bx = role.x, by = role.y;
    const bd = resolveBounds(primary.widgetConfig || {});
    let x = numOr(bx && bx.default, bd.ox + bd.w / 2), y = numOr(by && by.default, bd.oy + bd.h / 2);
    const c = canvasHost(host, primary), layout = new FeatureCanvas();
    const draw = () => layout.render(c, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: [{ kind: 'hole', x, y, n: 1, r: Math.max(1, bd.w * 0.012) }],
        handles: [{ id: 'pt', x, y, kind: 'move', label: 'pos' }],
        onDrag: (id, w) => { x = clamp(w.x, bd.ox, bd.ox + bd.w); y = clamp(w.y, bd.oy, bd.oy + bd.h); draw(); host.dispatchEvent(new Event('input', { bubbles: true })); },
    });
    requestAnimationFrame(draw);                                                        // wait for the host to have a size
    return { read: () => ({ [bx.param]: r3(x), [by.param]: r3(y) }) };
}

// COORDINATE-LIST positioner — a GROUP of XY points (each a draggable marker on the shared FeatureCanvas) + a
// shared Z, with add/delete. The first LIST-valued instance of the parametric-canvas atom ("(state → picture) +
// (interaction → Δstate)"), state = { points:[{x,y}], z }. The editing CORE is buildCoordEditor — shared by the
// FORM widget (coordListWidget, live, embedded in the row) AND the in-block ✎ editor (openCoordEditor, a modal,
// opened from blocks/devMode). One editing core, no divergence. (Per-point Z is a later option.)

/** Build the coordinate-list editor (FeatureCanvas points + ＋Point/✕ + shared Z) into `host`. Calls onChange()
 *  after every edit. initial = { points:[{x,y}], z }; cfg = widgetConfig (height/bounds). Returns { read }. */
export function buildCoordEditor(host, initial, onChange, cfg = {}) {
    const bd = resolveBounds(cfg);
    const d = (initial && typeof initial === 'object') ? initial : {};
    let points = Array.isArray(d.points) ? d.points.map((p) => ({ x: numOr(p.x, 0), y: numOr(p.y, 0) })) : [];
    let z = numOr(d.z, 0);
    const fire = () => { if (onChange) onChange(); };

    const cv = document.createElement('div'); cv.className = 'cl-canvas';
    cv.style.cssText = `width:100%; height:${cfg.height || 175}px; border:1px solid var(--border,#2a3340); border-radius:8px; overflow:hidden;`;
    host.appendChild(cv);
    const layout = new FeatureCanvas();
    const draw = () => layout.render(cv, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: points.map((p, i) => ({ kind: 'hole', x: p.x, y: p.y, n: i + 1, r: Math.max(1.5, bd.w * 0.012) })),
        handles: points.map((p, i) => ({ id: 'p' + i, x: p.x, y: p.y, kind: 'move' })),
        onDrag: (id, w) => { const i = +id.slice(1); if (points[i]) { points[i] = { x: clamp(w.x, bd.ox, bd.ox + bd.w), y: clamp(w.y, bd.oy, bd.oy + bd.h) }; renderList(); draw(); fire(); } },
    });
    requestAnimationFrame(draw);

    const row = document.createElement('div'); row.style.cssText = 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;';
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'cl-add'; addBtn.textContent = '＋ Point';
    addBtn.style.cssText = CTRL_CSS + ' cursor:pointer;';
    addBtn.addEventListener('click', () => { points.push({ x: r3(bd.ox + bd.w / 2), y: r3(bd.oy + bd.h / 2) }); renderList(); draw(); fire(); });
    const zWrap = document.createElement('label'); zWrap.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11px;';
    const zInp = document.createElement('input'); zInp.type = 'number'; zInp.step = 'any'; zInp.className = 'cl-z'; zInp.value = z; zInp.style.cssText = CTRL_CSS + ' width:80px;';
    zInp.addEventListener('input', () => { z = numOr(zInp.value, 0); fire(); });
    zWrap.append(document.createTextNode('Z (shared)'), zInp);
    row.append(addBtn, zWrap);
    host.appendChild(row);

    const list = document.createElement('div'); list.className = 'cl-list'; list.style.cssText = 'font-size:11px; max-height:90px; overflow:auto;';
    function renderList() {
        list.innerHTML = '';
        points.forEach((p, i) => {
            const r = document.createElement('div'); r.style.cssText = 'display:flex; gap:6px; align-items:center; padding:2px 0;';
            r.append(document.createTextNode(`${i + 1}: ${r3(p.x)}, ${r3(p.y)}`));
            const del = document.createElement('button'); del.type = 'button'; del.className = 'cl-del'; del.textContent = '✕';
            del.style.cssText = 'cursor:pointer; background:transparent; border:none; color:inherit; opacity:.6;';
            del.addEventListener('click', () => { points.splice(i, 1); renderList(); draw(); fire(); });
            r.appendChild(del); list.appendChild(r);
        });
    }
    renderList();
    host.appendChild(list);

    return { read: () => ({ points: points.map((p) => ({ x: r3(p.x), y: r3(p.y) })), z: r3(z) }) };
}

function coordListWidget(host, b) {
    host.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin:10px 0;';
    host.appendChild(labelSpan(b));
    const core = buildCoordEditor(host, b.default, () => host.dispatchEvent(new Event('input', { bubbles: true })), b.widgetConfig || {});
    return { read: () => ({ [b.param]: core.read() }) };
}

/** The in-block ✎ editor: the coordinate-list editor in a modal. initial = { points, z }; onSave(next) on Done.
 *  Shares buildCoordEditor with the form widget — one editing core, no divergence (blocks/devMode opens this). */
export function openCoordEditor(initial, onSave) {
    document.getElementById('cl-modal')?.remove();
    const m = document.createElement('div'); m.id = 'cl-modal';
    m.innerHTML = `<style>
        #cl-modal{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
        #cl-modal .cl-panel{background:var(--panel);color:var(--text-main);border:1px solid var(--border);border-radius:8px;width:min(560px,96vw);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 14px 48px rgba(0,0,0,.5);}
        #cl-modal .cl-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:700;}
        #cl-modal .cl-head button{background:transparent;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;}
        #cl-modal .cl-mbody{display:flex;flex-direction:column;gap:8px;padding:12px 14px;overflow:auto;}
        #cl-modal .cl-foot{padding:10px 14px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;}
        #cl-modal .cl-foot button{padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:var(--accent,#0ea5e9);color:#fff;cursor:pointer;}
    </style>`;
    const panel = document.createElement('div'); panel.className = 'cl-panel';
    const head = document.createElement('div'); head.className = 'cl-head';
    const title = document.createElement('span'); title.textContent = 'Edit positions';
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕';
    head.append(title, x);
    const body = document.createElement('div'); body.className = 'cl-mbody';
    const foot = document.createElement('div'); foot.className = 'cl-foot';
    const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; done.setAttribute('data-cl', 'done');
    foot.appendChild(done);
    panel.append(head, body, foot); m.appendChild(panel); document.body.appendChild(m);

    const core = buildCoordEditor(body, initial, null, {});
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey, true); };
    document.addEventListener('keydown', onKey, true);
    x.addEventListener('click', close);
    m.addEventListener('mousedown', (e) => { if (e.target === m) close(); });   // scrim-close
    done.addEventListener('click', () => { try { if (onSave) onSave(core.read()); } finally { close(); } });
}

function rectPadWidget(host, primary, group) {
    const role = rolesOf(group, primary), bx = role.x, by = role.y, bw = role.w, bh = role.h;
    const bd = resolveBounds(primary.widgetConfig || {});
    let x = numOr(bx && bx.default, bd.ox + bd.w * 0.25), y = numOr(by && by.default, bd.oy + bd.h * 0.25);
    let w = numOr(bw && bw.default, bd.w * 0.5), h = numOr(bh && bh.default, bd.h * 0.5);
    const c = canvasHost(host, primary), layout = new FeatureCanvas();
    const draw = () => layout.render(c, {
        stock: { w: bd.w, h: bd.h, ox: bd.ox, oy: bd.oy },
        items: [{ kind: 'rect', x, y, w, h }],
        handles: [
            { id: 'origin', x, y, kind: 'move', label: 'xy' },
            { id: 'size', x: x + w, y: y + h, kind: 'size', label: 'W', value: w },
        ],
        onDrag: (id, p) => {
            if (id === 'origin') { x = clamp(p.x, bd.ox, bd.ox + bd.w); y = clamp(p.y, bd.oy, bd.oy + bd.h); }
            else { w = Math.max(1, p.x - x); h = Math.max(1, p.y - y); }
            draw();
            host.dispatchEvent(new Event('input', { bubbles: true }));
        },
    });
    requestAnimationFrame(draw);
    return { read: () => ({ [bx.param]: r3(x), [by.param]: r3(y), [bw.param]: r3(w), [bh.param]: r3(h) }) };
}

export const FORM_WIDGETS = {
    number: numberWidget,
    slider: sliderWidget,
    dropdown: dropdownWidget,
    toggle: toggleWidget,
    text: textWidget,
    'corner-grid': cornerGridWidget,
    'region-pick': regionPickWidget,
    'coord-list': coordListWidget,
    'xy-pad': xyPadWidget,
    rect: rectPadWidget,
};

// widgets that bind a GROUP of params (the form renders ONE widget for the whole group, not one per binding).
export const MULTI_WIDGETS = new Set(['xy-pad', 'rect']);

const DEFAULT_BY_TYPE = { number: 'number', int: 'number', enum: 'dropdown', bool: 'toggle', string: 'text' };

/** Pick the form widget for a binding: its declared `widget`, else a sensible default for its `type`. */
export function resolveFormWidget(b) {
    if (b && b.widget && FORM_WIDGETS[b.widget]) return FORM_WIDGETS[b.widget];
    return FORM_WIDGETS[DEFAULT_BY_TYPE[(b && b.type) || 'number'] || 'number'];
}

/** Render a UNIT (a single binding, or a group of bindings sharing a multi-param widget) into host.
 *  Returns { read() → { param: value, … } }. The widget gets (host, primaryBinding, group). */
export function renderFormWidget(host, unit) {
    const group = Array.isArray(unit) ? unit : [unit];
    return resolveFormWidget(group[0])(host, group[0], group);
}

/** Render a whole op's BINDINGS into host as one row per unit (single binding, or a group sharing a multi-param
 *  widget). Returns the readers [() → {param: value}]. Shared by the modal (userOpForm) and the panel view. */
export function renderOpForm(host, bindings) {
    const readers = [], units = [], byGroup = {};
    for (const b of (bindings || [])) {
        if (b.group) { if (!byGroup[b.group]) { byGroup[b.group] = []; units.push(byGroup[b.group]); } byGroup[b.group].push(b); }
        else units.push([b]);
    }
    const addRow = (spec, label) => {
        const row = document.createElement('div');
        // ③ — a `when`-gated binding tags its row so the view can show/hide it from the live params (e.g. corner's start
        // #21/#22, visible only under probeZFirst). Purely a marker; the widget still renders + reads (dead when hidden).
        const w = Array.isArray(spec) ? spec[0] : spec;
        if (w && w.when && w.when.param) { row.dataset.whenParam = w.when.param; row.dataset.whenIs = String(w.when.is); }
        try { readers.push(renderFormWidget(row, spec).read); }
        catch (e) { console.warn('widget render failed for', label, e); }
        host.appendChild(row);
    };
    for (const unit of units) {
        // A canvas multi-widget (xy-pad / rect) renders the whole group as ONE widget that owns its value. A
        // number-role group (2D point / rect declared as plain numbers) instead renders each member as its OWN
        // number field — each carries data-param so the Form+2D preview's role-derived handle can drag-write it,
        // while the value stays a plain number on the form. The shared group/role still drives the preview handle
        // (layoutSpecFromOp); only the FORM rendering differs.
        if (unit.length > 1 && !MULTI_WIDGETS.has(unit[0] && unit[0].widget)) {
            for (const b of unit) addRow(b, b && b.param);
        } else addRow(unit, unit[0] && unit[0].param);
    }
    return readers;
}
