/**
 * viz/displayPrefs.js — THE ONE declared PREVIEW-VISIBILITY registry (t738). A single {id,label,visible,alpha} element
 * list consumed by EVERY preview renderer (gcodeViz3d 3D · toolpath2d 2D · featureCanvas Layout), so the scattered
 * per-element switches collapse to one source (like pathStyle.js is the ONE palette). It is a DISPLAY preference —
 * persisted app-wide in localStorage like the THEME (themes.js), NOT in the machine profile / settings store (a stored
 * program or a pulled machine config must never carry which elements you like to see).
 *
 * TYPE/colour stays in pathStyle.js (orthogonal); this owns STATE = {visible, alpha} per element. A renderer reads
 * displayOf(id) and composes: shown = visible · opacity = alpha (× any existing per-type/state scale). Live: the modal
 * writes here, onDisplayChange re-applies across every mounted panel.
 */

/** The declared element list — id · human label · default alpha. Order = the modal's row order. `envelope` defaults
 *  visible (t729 "envelope everywhere"): the declared machine box draws as a faint backdrop in every preview. */
export const DISPLAY_ELEMENTS = [
    { id: 'stock',    label: 'Stock',            alpha: 0.72 },
    { id: 'carve',    label: 'Material removal', alpha: 0.85 },
    { id: 'cut',      label: 'Cut moves',        alpha: 1 },
    { id: 'rapid',    label: 'Rapid moves',      alpha: 0.6 },
    { id: 'probe',    label: 'Probe moves',      alpha: 1 },
    { id: 'tool',     label: 'Tool',             alpha: 0.9 },
    { id: 'head',     label: 'Spindle / head',   alpha: 0.85 },
    { id: 'envelope', label: 'Machine envelope', alpha: 0.4 },
    { id: 'grid',     label: 'Grid',             alpha: 1 },
    { id: 'axes',     label: 'Axes',             alpha: 0.7 },
    { id: 'markers',  label: 'Markers',          alpha: 1 },
    { id: 'poschip',  label: 'Position readout', alpha: 0.9 },   // t746 — the chip riding the tool head during play (live WORK coords, DRO-equal, motion-gated)
];

const KEY = 'ddcs_display';
const DEFAULTS = () => { const o = {}; for (const e of DISPLAY_ELEMENTS) o[e.id] = { visible: true, alpha: e.alpha }; return o; };

let _state = null;
const _subs = new Set();

function _load() {
    const d = DEFAULTS();
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const p = JSON.parse(raw) || {};
            for (const id of Object.keys(d)) {
                const v = p[id];
                if (v && typeof v === 'object') {
                    if (typeof v.visible === 'boolean') d[id].visible = v.visible;
                    if (Number.isFinite(v.alpha)) d[id].alpha = Math.max(0, Math.min(1, v.alpha));
                }
            }
        }
    } catch (_) { /* private mode / file:// — defaults */ }
    return d;
}

/** The whole display state {[id]: {visible, alpha}} (a fresh object each call — read-only to callers). */
export function getDisplay() {
    if (!_state) _state = _load();
    const o = {}; for (const id of Object.keys(_state)) o[id] = { ...(_state[id]) };
    return o;
}

/** One element's {visible, alpha} (defaults if the id is unknown). */
export function displayOf(id) {
    if (!_state) _state = _load();
    const s = _state[id];
    return s ? { visible: s.visible, alpha: s.alpha } : { visible: true, alpha: 1 };
}

/** Patch one element (partial {visible?, alpha?}); persists + notifies subscribers. */
export function setDisplayElement(id, patch) {
    if (!_state) _state = _load();
    if (!_state[id]) return;
    if (typeof patch.visible === 'boolean') _state[id].visible = patch.visible;
    if (Number.isFinite(patch.alpha)) _state[id].alpha = Math.max(0, Math.min(1, patch.alpha));
    try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch (_) { /* private mode */ }
    for (const cb of _subs) { try { cb(id); } catch (_) { /* isolate */ } }
}

/** Restore every element to its declared default (visible + default alpha). */
export function resetDisplay() {
    _state = DEFAULTS();
    try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch (_) { /* private mode */ }
    for (const cb of _subs) { try { cb(null); } catch (_) { /* isolate */ } }
}

/** Subscribe to display changes (the modal writes → every mounted panel re-applies). Returns an unsubscribe fn. */
export function onDisplayChange(cb) { _subs.add(cb); return () => _subs.delete(cb); }
