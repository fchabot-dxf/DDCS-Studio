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

const SVGNS = 'http://www.w3.org/2000/svg';
const ROW_CSS = 'display:flex; align-items:center; justify-content:space-between; gap:14px; margin:9px 0;';
const CTRL_CSS = 'padding:5px 8px; background:var(--bg,#0b0f14); color:inherit; border:1px solid var(--border,#2a3340); border-radius:6px;';
const numOr = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

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
    return { read: () => ({ [b.param]: sel.value }) };
}

function toggleWidget(host, b) {
    host.style.cssText = ROW_CSS;
    const lab = document.createElement('label');
    lab.className = 'ddcs-switch';
    lab.innerHTML = '<input type="checkbox"><span class="ddcs-slider"></span>';
    const cb = lab.querySelector('input');
    cb.checked = !!b.default;
    host.append(labelSpan(b), lab);
    return { read: () => ({ [b.param]: cb.checked }) };
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

export const FORM_WIDGETS = {
    number: numberWidget,
    slider: sliderWidget,
    dropdown: dropdownWidget,
    toggle: toggleWidget,
    text: textWidget,
    'corner-grid': cornerGridWidget,
};

const DEFAULT_BY_TYPE = { number: 'number', int: 'number', enum: 'dropdown', bool: 'toggle', string: 'text' };

/** Pick the form widget for a binding: its declared `widget`, else a sensible default for its `type`. */
export function resolveFormWidget(b) {
    if (b && b.widget && FORM_WIDGETS[b.widget]) return FORM_WIDGETS[b.widget];
    return FORM_WIDGETS[DEFAULT_BY_TYPE[(b && b.type) || 'number'] || 'number'];
}

/** Render a binding's widget into host; returns { read() → { param: value } }. */
export function renderFormWidget(host, b) {
    return resolveFormWidget(b)(host, b);
}
