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
// The bar has three SECTIONS; each dropdown (group) lives in one. Default placement mirrors the shipped bar
// (Setup→left, the rest→center); the user can move any dropdown to any section in the manager.
export const SECTIONS = ['left', 'center', 'right'];
const GROUPS = [
    { id: 'setup', label: 'Setup', section: 'left' },
    { id: 'probe', label: 'Probe', section: 'center' },
    { id: 'atc', label: 'ATC', section: 'center' },
    { id: 'mill', label: 'Mill', section: 'center' },
    { id: 'probe_datawiz', label: 'Probe Data Wiz', section: 'right' },
    { id: 'atc_datawiz', label: 'ATC Data Wiz', section: 'right' },
    { id: 'mill_datawiz', label: 'Mill Data Wiz', section: 'right' },
    { id: 'custom', label: 'Custom', section: 'center' },   // user ops land here by default (re-groupable)
];
const BUILTINS = [
    { id: 'comm', type: 'comm', label: 'Comm / MDI', icon: '💬', group: 'setup' },
    { id: 'atc_warmup', type: 'atc_warmup', label: 'Warm-up', icon: '🔥', group: 'setup', opensAs: 'user_atc_warmup_data' },
    { id: 'wcs', type: 'wcs', label: 'WCS / work offsets', icon: '⊕', group: 'probe' },
    { id: 'homing', type: 'homing', label: 'Homing', icon: '⌖', group: 'probe' },
    // t339 E4 — IN-PLACE SWAP: the built-in Corner/Edge/Middle KEEP their Probe slot (label/icon/group), but `opensAs` re-points
    // the click to the data-op TWIN (userOpView) — the user sees "Corner"/"Edge"/"Middle" WHERE IT ALWAYS WAS, now data-op-backed
    // (human t332). The built-in stack (cornerStack/edgeStack/middleStack + BUILDERS/SCHEMA) stays as the LEGACY SHIM (legacy saved
    // ops render). The twin's OWN menu entry is HIDDEN (userEntries drops opensAs targets) → no duplicate. ONE-SOURCE: every future
    // port just declares `opensAs` on its built-in entry (Corner was previously retired-and-RELOCATED to a data-wiz folder — the
    // gap; this makes it truly in-place, and every later probe port inherits the same mechanism).
    { id: 'corner', type: 'corner', label: 'Corner', icon: '📐', group: 'probe', opensAs: 'user_corner_data' },
    { id: 'middle', type: 'middle', label: 'Middle / Bore / Boss', icon: '🎯', group: 'probe', opensAs: 'user_middle_data' },
    { id: 'edge', type: 'edge', label: 'Edge', icon: '📏', group: 'probe', opensAs: 'user_edge_data' },
    { id: 'alignment', type: 'alignment', label: 'Align', icon: '🧭', group: 'probe' },
    { id: 'rotary_center', type: 'rotary_center', label: 'Centreline', icon: '', group: 'probe' },
    { id: 'rotary_clock', type: 'rotary_clock', label: 'Clock A0', icon: '🕒', group: 'probe' },
    { id: 'atc_length', type: 'atc_length', label: 'Tool Length', icon: '📏', group: 'atc' },
    { id: 'atc_check', type: 'atc_check', label: 'Tool Check', icon: '🛡', group: 'atc' },
    { id: 'atc_change', type: 'atc_change', label: 'Tool Change', icon: '🔧', group: 'atc' },
    { id: 'atc_table', type: 'atc_table', label: 'Tool Table', icon: '📋', group: 'atc' },
    { id: 'atc_test', type: 'atc_test', label: 'ATC Test', icon: '🧪', group: 'atc' },
    // QUICK-WINS PILOT (t405) — the DRILL peck twin goes IN-PLACE via opensAs (mirror corner/edge/middle E4/E5): the built-in
    // keeps its Mill slot, the click re-points to user_drill_data, the twin's own Mill-Data-Wiz entry auto-hides (OPENS_AS_TARGETS),
    // the title reads plain "Drill" (builtinLabelForTwin). BORE stays built-in: user_drill_data is PECK-only (method=helical swaps
    // the block TYPE drill→bore, frontier #1), so Bore needs its OWN helical twin (user_bore_data) — a small follow-on, NOT this wire-up.
    { id: 'drill', type: 'drill', variant: 'drill', label: 'Drill', icon: '', group: 'mill', opensAs: 'user_drill_data' },
    { id: 'bore', type: 'drill', variant: 'bore', label: 'Bore', icon: '', group: 'mill' },
    { id: 'pocket', type: 'pocket', label: 'Pocket', icon: '', group: 'mill' },
    { id: 'contour', type: 'contour', label: 'Contour', icon: '', group: 'mill' },
    // MILL/ATC IN-PLACE BATCH (t407) — the drill one-liner applied ×4: each single-shape twin goes IN-PLACE via opensAs (the
    // click re-points to the twin, its own Data-Wiz entry auto-hides, the seamless plain title). All single-shape → no Bore-style gap.
    { id: 'slot', type: 'slot', label: 'Slot', icon: '', group: 'mill', opensAs: 'user_slot_data' },
    { id: 'surfacing', type: 'surfacing', label: 'Surfacing', icon: '', group: 'mill', opensAs: 'user_surfacing_data' },
    { id: 'text', type: 'text', label: 'Text / engrave', icon: '✎', group: 'mill', opensAs: 'user_text_data' },
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

// ── user-created dropdowns (groups) ──────────────────────────────────────────────────────────────────────────
/** Create a new (empty) dropdown in a section → returns its id. It appears in the bar once a wizard is moved in. */
export function createGroup(label, section = 'center') {
    const l = readLayout();
    l.customGroups = l.customGroups || [];
    const base = String(label || 'group').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'group';
    const taken = new Set([...GROUPS.map((g) => g.id), ...l.customGroups.map((c) => c.id)]);
    let id = base, n = 2; while (taken.has(id)) id = `${base}_${n++}`;
    l.customGroups.push({ id, label: label || id, section: SECTIONS.includes(section) ? section : 'center' });
    writeLayout(l);
    return id;
}
/** Delete a user-created dropdown (shipped ones can't be deleted). Its wizards revert to their default dropdown. */
export function deleteGroup(id) {
    if (GROUPS.some((g) => g.id === id)) return;
    const l = readLayout();
    if (l.entries) for (const eid in l.entries) { if (l.entries[eid] && l.entries[eid].group === id) delete l.entries[eid].group; }
    l.customGroups = (l.customGroups || []).filter((c) => c.id !== id);
    if (l.groups) delete l.groups[id];
    writeLayout(l);
}

// ── the merged library (what the bar + Settings render from) ─────────────────────────────────────────────────
// t339 E4 — an IN-PLACE port's twin (user_corner_data / user_edge_data) is opened via its BUILTINS entry's `opensAs`, so it must
// NOT also surface its OWN menu entry (that would duplicate the slot). Drop any user-op a built-in entry adopts via opensAs.
// ONE declaration (opensAs on the built-in) drives BOTH the slot re-point AND this hide → they can't drift.
const OPENS_AS_TARGETS = new Set(BUILTINS.filter((b) => b.opensAs).map((b) => b.opensAs));
/** t343 E5 — SEAMLESS TITLE: an IN-PLACE port's twin (an opensAs target) shows the BUILT-IN entry's PLAIN label as its opened
 *  wizard title (e.g. 'Edge' / 'Corner', not the def.label 'Edge (data)') — ONE source: the built-in entry's label drives BOTH
 *  the menu slot AND the opened title, so they can't drift. The def.label keeps '(data)' as the BLOCKS-TAB identity. Returns
 *  null for a normal user op (which keeps its "<label> — your custom wizard" heading). */
export function builtinLabelForTwin(opType) {
    const b = BUILTINS.find((x) => x.opensAs === opType);
    return b ? b.label : null;
}
function userEntries() {
    return listUserOps().filter((d) => !OPENS_AS_TARGETS.has(d.opType)).map((d) => ({
        id: d.opType,
        type: d.opType,
        label: d.label || d.opType,
        icon: '✦',
        group: d.group || 'custom',
        kind: 'user',
        def: d,
    }));
}

/** Every entry (built-in + user), overrides applied, in a flat order-resolved list. */
export function listEntries() {
    const l = readLayout(), eov = l.entries || {};
    const base = [...BUILTINS.map((b) => ({ ...b, kind: 'builtin' })), ...userEntries()];
    return base.map((e, i) => {
        const o = eov[e.id] || {};
        return {
            ...e, label: o.label ?? e.label, group: o.group ?? e.group, visible: o.visible !== false,
            order: (o.order != null) ? o.order : i, icon: o.icon ?? e.icon, iconOverride: (o.icon != null) ? o.icon : null,
        };
    });
}

/** The library AS the bar + manager render from: groups (each with its section + ordered items), order-resolved.
 *  includeHidden → keep hidden entries (manager). includeEmpty → keep user-created dropdowns that have no items yet. */
export function getLibrary({ includeHidden = false, includeEmpty = false } = {}) {
    const l = readLayout(), gov = l.groups || {}, custom = l.customGroups || [];
    const customById = new Map(custom.map((c) => [c.id, c]));
    const entries = listEntries().filter((e) => includeHidden || e.visible);
    const byGroup = new Map();
    for (const e of entries) { if (!byGroup.has(e.group)) byGroup.set(e.group, []); byGroup.get(e.group).push(e); }
    // dropdown order: the shipped GROUPS first, then user-created dropdowns, then any legacy entry-introduced group.
    const knownIds = GROUPS.map((g) => g.id), customIds = custom.map((c) => c.id);
    const orderedIds = [...new Set([...knownIds, ...customIds, ...[...byGroup.keys()].filter((g) => !knownIds.includes(g) && !customIds.includes(g))])];
    const groups = orderedIds
        .filter((id) => byGroup.has(id) || (includeEmpty && customById.has(id)))           // populated, or empty user dropdowns when asked
        .map((id, i) => {
            const def = GROUPS.find((g) => g.id === id) || customById.get(id), o = gov[id] || {};
            const items = (byGroup.get(id) || []).slice().sort((a, b) => a.order - b.order);
            return {
                id, label: o.label ?? (def ? def.label : id), section: o.section ?? (def && def.section) ?? 'center',
                order: (o.order != null) ? o.order : i, items, custom: customById.has(id),
                icon: o.icon ?? null,
            };
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

/** Serialize a user-op def → `.wizard` file text (portable, shareable). Carries the view-only metadata `panel`
 *  (layout) + `sim` (DECLARED preview intent: rotary rig / machine / magazine) so a shared wizard keeps its panel
 *  and rig on import — otherwise the recipient loses them. Both are optional (omitted when absent → clean files,
 *  backward-compatible with v1 files that predate them). */
export function wizardToFile(def) {
    const op = { opType: def.opType, label: def.label, template: def.template, bindings: def.bindings };
    if (def.panel) op.panel = def.panel;
    if (def.sim) op.sim = def.sim;
    return JSON.stringify({ kind: WIZARD_FILE_KIND, v: WIZARD_FILE_VERSION, op }, null, 2);
}
/** Parse `.wizard` file text → a user-op def (or null if it isn't a valid wizard file). Returns o.op verbatim, so
 *  any panel/sim the file carries rides through to createWizard (registerUserOp re-declares the preview intent). */
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
