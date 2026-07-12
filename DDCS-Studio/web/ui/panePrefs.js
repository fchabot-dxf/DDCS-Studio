/**
 * ui/panePrefs.js — THE declared COLLAPSIBLE-PANE registry (t752 · split per-pane t784). A small {id,label} list of
 * wizard pane KINDS (the 2D layout · the 3D verify · the code preview — the 2D and 3D fold INDEPENDENTLY). Whether a
 * kind is collapsed is remembered APP-WIDE per kind — collapse the 3D in ONE wizard and every wizard opens with the 3D
 * collapsed — exactly like the theme / display prefs: a DISPLAY
 * preference persisted in localStorage, NEVER the machine profile (a stored program / pulled config must not carry
 * which panes you like folded). The accordion engine (paneAccordion.js) owns the MOTION (per-theme tokens); this owns
 * only the collapsed STATE. Default for every kind = expanded.
 */

/** The declared pane kinds — id · human label. A wizard pane tags itself with one of these ids; the collapsed state
 *  is keyed by the id, so it is shared across every wizard that has that kind of pane. */
export const PANE_KINDS = [
    { id: 'preview3d', label: '3D' },      // the 3D verify pane — folds INDEPENDENTLY of the 2D (t784)
    { id: 'layout2d',  label: '2D' },      // the 2D layout pane — folds independently of the 3D
    { id: 'code',      label: 'G-code' },  // the .preview-block G-code preview
];

const KEY = 'ddcs_panes';
const IDS = new Set(PANE_KINDS.map((k) => k.id));
const DEFAULTS = () => { const o = {}; for (const k of PANE_KINDS) o[k.id] = false; return o; };   // false = expanded

let _state = null;
const _subs = new Set();

function _load() {
    const d = DEFAULTS();
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const p = JSON.parse(raw) || {};
            for (const id of Object.keys(d)) if (typeof p[id] === 'boolean') d[id] = p[id];
        }
    } catch (_) { /* private mode / file:// — defaults */ }
    return d;
}

/** True if the pane kind is currently collapsed (unknown id → false = expanded). */
export function isPaneCollapsed(id) {
    if (!_state) _state = _load();
    return !!_state[id];
}

/** Set a pane kind collapsed/expanded; persists + notifies subscribers (every open wizard re-applies). */
export function setPaneCollapsed(id, collapsed) {
    if (!_state) _state = _load();
    if (!IDS.has(id)) return;
    _state[id] = !!collapsed;
    try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch (_) { /* private mode */ }
    for (const cb of _subs) { try { cb(id); } catch (_) { /* isolate */ } }
}

/** Restore every pane kind to expanded (the declared default). */
export function resetPanes() {
    _state = DEFAULTS();
    try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch (_) { /* private mode */ }
    for (const cb of _subs) { try { cb(null); } catch (_) { /* isolate */ } }
}

// ── The pane RATIO (t790) — how the 3D and 2D panes SHARE the visual space when both are open. A drag-splitter between
// them rebalances it continuously (the collapse chevrons are all-or-nothing; the ratio is the in-between). Like the
// collapse state it is an app-wide DISPLAY pref (localStorage, NOT the machine profile). Value = the 3D pane's FRACTION
// (so it means the same thing on every wizard regardless of DOM order); clamped so neither pane can vanish. ──
const RATIO_KEY = 'ddcs_pane_ratio';
export const RATIO_MIN = 0.15, RATIO_MAX = 0.85, RATIO_DEFAULT = 0.5;
let _ratio = null;
const _ratioSubs = new Set();
const clampRatio = (r) => Math.max(RATIO_MIN, Math.min(RATIO_MAX, Number(r)));

/** The 3D pane's share of the visual [RATIO_MIN..RATIO_MAX] (default 0.5 = an even split). */
export function getPaneRatio() {
    if (_ratio == null) {
        _ratio = RATIO_DEFAULT;
        try { const raw = localStorage.getItem(RATIO_KEY); if (raw != null && Number.isFinite(Number(raw))) _ratio = clampRatio(raw); } catch (_) { /* defaults */ }
    }
    return _ratio;
}

/** Set the 3D pane's share; clamps, persists, notifies (every open wizard rebalances live). */
export function setPaneRatio(r) {
    const next = clampRatio(r);
    if (next === _ratio) return;
    _ratio = next;
    try { localStorage.setItem(RATIO_KEY, String(next)); } catch (_) { /* private mode */ }
    for (const cb of _ratioSubs) { try { cb(next); } catch (_) { /* isolate */ } }
}

/** Subscribe to ratio changes (a drag in one wizard rebalances every mounted pane). Returns an unsubscribe fn. */
export function onRatioChange(cb) { _ratioSubs.add(cb); return () => _ratioSubs.delete(cb); }

/** Subscribe to collapse changes (one wizard folds a kind → others re-apply live). Returns an unsubscribe fn. */
export function onPaneChange(cb) { _subs.add(cb); return () => _subs.delete(cb); }
