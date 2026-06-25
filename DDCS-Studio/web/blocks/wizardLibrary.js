/**
 * blocks/wizardLibrary.js — the WIZARD LIBRARY: the catalog of every wizard (built-in + user) that the wizard
 * bar renders from and the Settings "wizard library manager" edits. One ordered, grouped, visibility-aware list.
 *
 * Each entry carries display metadata (label, group, icon, visible, order). USER ops also carry their def
 * (template + bindings, owned by userOps.js — the runtime registry). The `.wizard` FILE is one entry's portable
 * serialization (one op, one file — shareable, not bound to a profile).
 *
 * HYBRID REALITY (state it honestly): built-in wizards are CODE — custom two-pane forms, 3D sims, pattern logic
 * (drill/bore variants), the ATC magazine, reconcilers. A *pure declarative* `.wizard` (template + numeric
 * bindings) can't capture that. So a built-in's library entry is METADATA-ONLY + references its coded view; only
 * USER ops are fully declarative. "Forking" a built-in = capture its output stack + expose params (a SIMPLIFIED
 * declarative copy via the generic form), NOT a clone of its bespoke UI/sim. The library/bar layer is uniform
 * (every entry has label/group/visible/order); the editing layer splits builtin(code) vs user(declarative).
 *
 * Persistence: user-op defs live in `ddcs_user_ops` (userOps.js); the bar CUSTOMIZATION (per-entry + per-group
 * overrides) lives in `ddcs_wizard_layout`. The default catalog (BUILTINS/GROUPS) is the shipped library.
 */
import { listUserOps, createUserOp, deleteUserOp } from './userOps.js';

// ── the shipped (default) catalog — the current wizard bar as data ───────────────────────────────────────────
// (Faithful to commandDeck.renderHeader's groups/entries. Icons: emoji where the bar used emoji; the SVG-iconed
// ones carry an empty icon for now — the bar-render stage reattaches the SVGs. I/O quick-actions stay bar-special.)
const GROUPS = [
    { id: 'setup', label: 'Setup' },
    { id: 'probe', label: 'Probe' },
    { id: 'atc', label: 'ATC' },
    { id: 'mill', label: 'Mill' },
    { id: 'custom', label: 'Custom' },   // user ops land here by default (re-groupable)
];
const BUILTINS = [
    { id: 'comm', type: 'comm', label: 'Comm / MDI', icon: '💬', group: 'setup' },
    { id: 'atc_warmup', type: 'atc_warmup', label: 'Warm-up', icon: '🔥', group: 'setup' },
    { id: 'wcs', type: 'wcs', label: 'WCS / work offsets', icon: '⊕', group: 'probe' },
    { id: 'homing', type: 'homing', label: 'Homing', icon: '⌖', group: 'probe' },
    { id: 'corner', type: 'corner', label: 'Corner', icon: '📐', group: 'probe' },
    { id: 'middle', type: 'middle', label: 'Middle / Bore / Boss', icon: '🎯', group: 'probe' },
    { id: 'edge', type: 'edge', label: 'Edge', icon: '📏', group: 'probe' },
    { id: 'alignment', type: 'alignment', label: 'Align', icon: '🧭', group: 'probe' },
    { id: 'rotary_center', type: 'rotary_center', label: 'Centreline', icon: '', group: 'probe' },
    { id: 'rotary_clock', type: 'rotary_clock', label: 'Clock A0', icon: '🕒', group: 'probe' },
    { id: 'atc_length', type: 'atc_length', label: 'Tool Length', icon: '📏', group: 'atc' },
    { id: 'atc_check', type: 'atc_check', label: 'Tool Check', icon: '🛡', group: 'atc' },
    { id: 'atc_change', type: 'atc_change', label: 'Tool Change', icon: '🔧', group: 'atc' },
    { id: 'atc_table', type: 'atc_table', label: 'Tool Table', icon: '📋', group: 'atc' },
    { id: 'atc_test', type: 'atc_test', label: 'ATC Test', icon: '🧪', group: 'atc' },
    { id: 'drill', type: 'drill', variant: 'drill', label: 'Drill', icon: '', group: 'mill' },
    { id: 'bore', type: 'drill', variant: 'bore', label: 'Bore', icon: '', group: 'mill' },
    { id: 'pocket', type: 'pocket', label: 'Pocket', icon: '', group: 'mill' },
    { id: 'contour', type: 'contour', label: 'Contour', icon: '', group: 'mill' },
    { id: 'slot', type: 'slot', label: 'Slot', icon: '', group: 'mill' },
    { id: 'surfacing', type: 'surfacing', label: 'Surfacing', icon: '', group: 'mill' },
    { id: 'text', type: 'text', label: 'Text / engrave', icon: '✎', group: 'mill' },
];

// ── customization layer (per-entry + per-group overrides) ────────────────────────────────────────────────────
const LAYOUT_KEY = 'ddcs_wizard_layout';

function readLayout() {
    try { const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; }
}
function writeLayout(l) { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch (_) { /* quota / unavailable */ } }

/** Override one entry's display (visible / label / group / order). `patch` is merged; pass {} to clear nothing. */
export function setEntryOverride(id, patch) {
    const l = readLayout();
    l.entries = l.entries || {};
    l.entries[id] = { ...(l.entries[id] || {}), ...patch };
    writeLayout(l);
}
/** Override a group's display (label / order). */
export function setGroupOverride(id, patch) {
    const l = readLayout();
    l.groups = l.groups || {};
    l.groups[id] = { ...(l.groups[id] || {}), ...patch };
    writeLayout(l);
}
/** Reset ALL bar customization back to the shipped catalog (does NOT delete user ops). */
export function resetLayout() { writeLayout({}); }

// ── the merged library (what the bar + Settings render from) ─────────────────────────────────────────────────
function userEntries() {
    return listUserOps().map((d) => ({ id: d.opType, type: d.opType, label: d.label || d.opType, icon: '✦', group: 'custom', kind: 'user', def: d }));
}

/** Every entry (built-in + user), overrides applied, in a flat order-resolved list. */
export function listEntries() {
    const l = readLayout(), eov = l.entries || {};
    const base = [...BUILTINS.map((b) => ({ ...b, kind: 'builtin' })), ...userEntries()];
    return base.map((e, i) => {
        const o = eov[e.id] || {};
        return { ...e, label: o.label ?? e.label, group: o.group ?? e.group, visible: o.visible !== false, order: (o.order != null) ? o.order : i };
    });
}

/** The library AS the bar shows it: ordered visible groups, each with its ordered visible items. */
export function getLibrary({ includeHidden = false } = {}) {
    const l = readLayout(), gov = l.groups || {};
    const entries = listEntries().filter((e) => includeHidden || e.visible);
    const byGroup = new Map();
    for (const e of entries) { if (!byGroup.has(e.group)) byGroup.set(e.group, []); byGroup.get(e.group).push(e); }
    // group order: the shipped GROUPS first (in order), then any user-introduced group, each with its override.
    const knownIds = GROUPS.map((g) => g.id);
    const groupIds = [...knownIds, ...[...byGroup.keys()].filter((g) => !knownIds.includes(g))];
    const groups = groupIds
        .filter((id) => byGroup.has(id))
        .map((id, i) => {
            const def = GROUPS.find((g) => g.id === id), o = gov[id] || {};
            const items = byGroup.get(id).sort((a, b) => a.order - b.order);
            return { id, label: o.label ?? (def ? def.label : id), order: (o.order != null) ? o.order : i, items };
        })
        .sort((a, b) => a.order - b.order);
    return { groups };
}

// ── create / delete (delegate the runtime to userOps) ────────────────────────────────────────────────────────
/** Create a user wizard from a def (template + bindings) — persists + registers it (via userOps). */
export function createWizard(def) { return createUserOp(def); }
/** Delete a USER wizard (built-ins can only be hidden via setEntryOverride visible:false). */
export function deleteWizard(opType) { deleteUserOp(opType); const l = readLayout(); if (l.entries) { delete l.entries[opType]; writeLayout(l); } }

// ── the .wizard FILE format (one op, one portable file) ──────────────────────────────────────────────────────
export const WIZARD_FILE_KIND = 'ddcs.wizard';
export const WIZARD_FILE_VERSION = 1;

/** Serialize a user-op def → `.wizard` file text (portable, shareable). */
export function wizardToFile(def) {
    return JSON.stringify({
        kind: WIZARD_FILE_KIND, v: WIZARD_FILE_VERSION,
        op: { opType: def.opType, label: def.label, template: def.template, bindings: def.bindings },
    }, null, 2);
}
/** Parse `.wizard` file text → a user-op def (or null if it isn't a valid wizard file). */
export function wizardFromFile(text) {
    let o; try { o = JSON.parse(text); } catch (_) { return null; }
    if (!o || o.kind !== WIZARD_FILE_KIND || !o.op || typeof o.op.opType !== 'string') return null;
    return o.op;
}

/** Export a user wizard to `.wizard` text by id (null if it isn't a user op). */
export function exportWizard(opType) {
    const d = listUserOps().find((x) => x.opType === opType);
    return d ? wizardToFile(d) : null;
}
/** Import a `.wizard` file → create the user wizard. Returns the def, or null if the file is invalid. */
export function importWizard(text) {
    const def = wizardFromFile(text);
    return def ? createWizard(def) : null;
}
