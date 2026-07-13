/**
 * ui/gcodeMinimap.js — a VS Code-style MINIMAP on the editor's right edge (t810). A canvas renders the WHOLE program in
 * miniature — each source line a thin row tinted by its TOKEN CLASS (comment / op-marker header / rapid / cut / probe /
 * M-code), so op regions read as coloured BANDS. A draggable VIEWPORT BOX shows the visible slice (drag scrolls, click
 * jumps); it is touch-draggable. During playback an EXECUTION MARKER tracks the running line — driven by the SAME
 * `editorManager.activeLineIndex` the in-text highlight consumes (ONE source, via onActiveLine — never a second tracker),
 * with a MINIMUM size + glow so it stays legible on a huge program where one line is < 1px.
 *
 * Toggle persists as a display pref (panePrefs family, `ddcs_minimap`); CSS hides the strip at phone widths.
 */
import { el } from './uiUtils.js';
import { getMinimapOn, setMinimapOn, onMinimapChange } from './panePrefs.js';

const MAX_COLS = 40;   // a line at/above this many content chars spans the full row width (the "code shape")

// The declared line classifier — ONE place that decides a row's token class from its text (the map/emit share it by
// construction: the same G-word semantics the editor tints by). Blank → null (no row drawn).
function classifyLine(line) {
    const t = (line || '').trim();
    if (!t) return null;
    if (t[0] === '(' || t[0] === ';') return /@ddcs/i.test(t) ? 'opHeader' : 'comment';
    const g = /\bG(\d+)/i.exec(t); const gn = g ? parseInt(g[1], 10) : null;
    if (gn === 31) return 'probe';
    if (gn === 0) return 'rapid';
    if (gn === 1 || gn === 2 || gn === 3) return 'cut';
    if (/\bM\d+/i.test(t)) return 'mcode';
    return 'other';
}

// Declared colour map, resolved from the active theme tokens each draw (so the minimap re-tints on a theme switch).
function palette() {
    const cs = getComputedStyle(document.body);
    const v = (name, fb) => (cs.getPropertyValue(name).trim() || fb);
    return {
        opHeader: v('--accent', '#4a90d9'),
        comment: v('--code-comment', v('--success', '#22c55e')),
        cut: v('--code-num', '#facc15'),
        rapid: v('--text-dim', '#7c8aa0'),
        probe: '#60a5fa',
        mcode: '#fca5a5',
        other: v('--text-dim', '#7c8aa0'),
    };
}

let _strip = null, _canvas = null, _ctx = null, _viewport = null, _exec = null, _toggle = null;
let _editor = null, _mgr = null, _unsub = null, _ro = null;
let _lines = [];            // classified rows: [{ cls, len }] (blank lines are null-skipped in draw)

function _container() { return document.querySelector('.editor-container'); }

function build() {
    const host = _container(); if (!host || _strip) return;
    _strip = document.createElement('div'); _strip.className = 'gcode-minimap'; _strip.setAttribute('aria-hidden', 'true');
    _canvas = document.createElement('canvas'); _canvas.className = 'gm-canvas';
    _viewport = document.createElement('div'); _viewport.className = 'gm-viewport';
    _exec = document.createElement('div'); _exec.className = 'gm-exec'; _exec.hidden = true;
    _strip.append(_canvas, _viewport, _exec);
    host.appendChild(_strip);
    _ctx = _canvas.getContext('2d');

    // the toggle — a small always-present button at the editor's top-right corner (shows/hides the strip)
    _toggle = document.createElement('button');
    _toggle.className = 'gm-toggle'; _toggle.type = 'button'; _toggle.title = 'Toggle the editor minimap'; _toggle.textContent = '▤';
    _toggle.addEventListener('click', () => setMinimapOn(!getMinimapOn()));
    host.appendChild(_toggle);

    // pointer: click jumps, drag scrolls (touch-native via pointer events) — the viewport centres on the pointer's y
    const scrollToPointer = (clientY) => {
        const r = _strip.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (clientY - r.top) / Math.max(1, r.height)));
        const max = _editor.scrollHeight - _editor.clientHeight;
        _editor.scrollTop = Math.max(0, Math.min(max, frac * _editor.scrollHeight - _editor.clientHeight / 2));
        drawViewport();
    };
    let dragging = false;
    _strip.addEventListener('pointerdown', (e) => { dragging = true; try { _strip.setPointerCapture(e.pointerId); } catch (_) { /* */ } scrollToPointer(e.clientY); e.preventDefault(); });
    _strip.addEventListener('pointermove', (e) => { if (dragging) scrollToPointer(e.clientY); });
    const end = () => { dragging = false; };
    _strip.addEventListener('pointerup', end); _strip.addEventListener('pointercancel', end);
}

// ── the STATIC silhouette (redrawn on program / theme / resize; NOT on scroll or exec) ──
function rebuildLines() {
    const text = _editor ? (_editor.value || '') : '';
    const raw = text.split('\n');
    _lines = raw.map((ln) => { const cls = classifyLine(ln); return cls ? { cls, len: ln.trim().length } : null; });
}

function drawSilhouette() {
    if (!_ctx || !_strip) return;
    const dpr = window.devicePixelRatio || 1;
    const W = _strip.clientWidth, H = _strip.clientHeight;
    if (W <= 0 || H <= 0) return;
    _canvas.width = Math.round(W * dpr); _canvas.height = Math.round(H * dpr);
    _canvas.style.width = W + 'px'; _canvas.style.height = H + 'px';
    _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _ctx.clearRect(0, 0, W, H);
    const n = _lines.length; if (!n) return;
    const rowH = Math.max(1, H / n);             // < 1px on a huge program → clamp to 1 (rows overlap into bands)
    const pal = palette();
    const padX = 3, innerW = Math.max(2, W - padX * 2);
    for (let i = 0; i < n; i++) {
        const L = _lines[i]; if (!L) continue;   // blank line → gap
        const y = (i / n) * H;
        const w = Math.max(2, Math.min(1, L.len / MAX_COLS) * innerW);   // content length → the code-shape width
        _ctx.fillStyle = pal[L.cls] || pal.other;
        _ctx.globalAlpha = (L.cls === 'opHeader') ? 0.95 : 0.8;
        _ctx.fillRect(padX, y, w, Math.max(1, rowH - (rowH > 2 ? 0.5 : 0)));
    }
    _ctx.globalAlpha = 1;
}

// ── the VIEWPORT box (cheap; on scroll) ──
function drawViewport() {
    if (!_viewport || !_editor || !_strip) return;
    const H = _strip.clientHeight;
    const sh = _editor.scrollHeight || 1;
    const top = (_editor.scrollTop / sh) * H;
    const h = Math.max(10, (_editor.clientHeight / sh) * H);
    _viewport.style.top = Math.max(0, Math.min(H - h, top)) + 'px';
    _viewport.style.height = h + 'px';
}

// ── the EXECUTION MARKER (cheap; on onActiveLine — the ONE source) ──
function drawExec(lineIndex) {
    if (!_exec || !_strip) return;
    const n = _lines.length;
    if (lineIndex == null || lineIndex < 0 || !n) { _exec.hidden = true; return; }
    const H = _strip.clientHeight;
    const y = (lineIndex / n) * H;
    _exec.style.top = y + 'px';   // CSS gives it a MIN height + glow so it reads when a row is < 1px
    _exec.hidden = false;
}

function redrawAll() { rebuildLines(); drawSilhouette(); drawViewport(); drawExec(_mgr ? _mgr.activeLineIndex : null); }

function applyVisible() {
    const host = _container(); if (!host) return;
    const on = getMinimapOn();
    host.classList.toggle('has-minimap', on);
    if (_strip) _strip.style.display = on ? '' : 'none';
    if (_toggle) _toggle.classList.toggle('on', on);
    if (on) redrawAll();
}

/** Mount the minimap and wire it to the editor (idempotent). `mgr` = the EditorManager (the one-source of activeLineIndex). */
export function initGcodeMinimap(mgr) {
    _mgr = mgr || window.editorManager;
    _editor = el('editor');
    if (!_editor || !_container()) return;   // no editor on this surface
    build();
    // program change → rebuild silhouette; scroll → viewport; theme change → re-tint; resize → re-draw
    _editor.addEventListener('input', () => { if (getMinimapOn()) redrawAll(); });
    _editor.addEventListener('scroll', () => { if (getMinimapOn()) drawViewport(); });
    // theme lives on body[data-theme] (no event) → observe it and re-tint the silhouette
    try { new MutationObserver(() => { if (getMinimapOn()) drawSilhouette(); }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] }); } catch (_) { /* */ }
    try { _ro = new ResizeObserver(() => { if (getMinimapOn()) { drawSilhouette(); drawViewport(); } }); _ro.observe(_container()); } catch (_) { window.addEventListener('resize', () => { if (getMinimapOn()) redrawAll(); }); }
    // the ONE source: the marker tracks the SAME activeLineIndex the in-text highlight uses, updated in lockstep
    if (_mgr && typeof _mgr.onActiveLine === 'function') _unsub = _mgr.onActiveLine((idx) => { if (getMinimapOn()) drawExec(idx); });
    onMinimapChange(() => applyVisible());
    applyVisible();
    return { redraw: redrawAll, applyVisible, classifyLine };
}

// test/debug hook
export { classifyLine };
