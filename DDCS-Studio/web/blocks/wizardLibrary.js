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
import { listUserOps, createUserOp, deleteUserOp, OP_CODE_HOOKS, localHooksFor } from './userOps.js';   // t1275 — the hook manifest: a wizard file names the code it cannot carry
import { isLathe } from '../data/workspaceMachine.js';   // t1271 — the machine kind decides which group leads

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
    // t1271 — THE LATHE GROUP. Declared for every workspace (the ops exist either way); WHERE it sits is decided by
    // the machine kind at render time, not by hiding it: a lathe workspace leads with it, a mill shows it after the
    // mill groups. Same catalogue, different emphasis — which is the whole difference between the two machines.
    { id: 'lathe', label: 'Lathe', section: 'center' },
    { id: 'probe_datawiz', label: 'Probe Data Wiz', section: 'right' },
    { id: 'atc_datawiz', label: 'ATC Data Wiz', section: 'right' },
    { id: 'mill_datawiz', label: 'Mill Data Wiz', section: 'right' },
    { id: 'custom', label: 'Custom', section: 'center' },   // user ops land here by default (re-groupable)
];
const BUILTINS = [
    { id: 'comm', type: 'comm', label: 'Comm / MDI', icon: '💬', group: 'setup', opensAs: 'user_comm_data' },   // t518 1b-ii — IN-PLACE: the Comm slot opens the data-op twin (superset: type × hmi × mode × conditional forks, deriveGuards + value-bearing recompose); built-in communicationWizard stays the legacy shim
    { id: 'io_step', type: 'io_step', label: 'I/O Step', icon: '⚡', group: 'setup', opensAs: 'user_io_step' },   // t522 E2 — the grouped I/O-step wizard (output/input/dwell), IN-PLACE: opens the data-op twin (declared-I/O by name + raw-pin fallback); the raw atoms stay in the Blocks palette
    { id: 'pause_confirm', type: 'pause_confirm', label: 'Pause / Confirm', icon: '⏸', group: 'setup', opensAs: 'user_pause_confirm' },   // t1031 — a standalone Pause/Confirm op: operator message (Expert #1505) + M0; opens the data-op twin in-place

    { id: 'atc_warmup', type: 'atc_warmup', label: 'Warm-up', icon: '🔥', group: 'setup', opensAs: 'user_atc_warmup_data' },
    { id: 'wcs', type: 'wcs', label: 'WCS / work offsets', icon: '⊕', group: 'probe', opensAs: 'user_wcs_data' },   // t477 E1 — IN-PLACE: the WCS slot opens the twin (dialect-aware wcszero atom); built-in wcsView stays the legacy shim
    { id: 'homing', type: 'homing', label: 'Homing', icon: '⌖', group: 'probe', opensAs: 'user_homing_data' },   // t552 — IN-PLACE: the Homing slot opens the twin (machine-frame preview: forced envelope + draggable Start + plays the real emit); the built-in homingWizard stays the legacy shim
    // t339 E4 — IN-PLACE SWAP: the built-in Corner/Edge/Middle KEEP their Probe slot (label/icon/group), but `opensAs` re-points
    // the click to the data-op TWIN (userOpView) — the user sees "Corner"/"Edge"/"Middle" WHERE IT ALWAYS WAS, now data-op-backed
    // (human t332). The built-in stack (cornerStack/edgeStack/middleStack + BUILDERS/SCHEMA) stays as the LEGACY SHIM (legacy saved
    // ops render). The twin's OWN menu entry is HIDDEN (userEntries drops opensAs targets) → no duplicate. ONE-SOURCE: every future
    // port just declares `opensAs` on its built-in entry (Corner was previously retired-and-RELOCATED to a data-wiz folder — the
    // gap; this makes it truly in-place, and every later probe port inherits the same mechanism).
    { id: 'corner', type: 'corner', label: 'Corner', icon: '📐', group: 'probe', opensAs: 'user_corner_data' },
    { id: 'middle', type: 'middle', label: 'Middle / Bore / Boss', icon: '🎯', group: 'probe', opensAs: 'user_middle_data' },
    { id: 'edge', type: 'edge', label: 'Edge', icon: '📏', group: 'probe', opensAs: 'user_edge_data' },
    { id: 'alignment', type: 'alignment', label: 'Align', icon: '🧭', group: 'probe', opensAs: 'user_alignment_data' },   // t437 E3 — IN-PLACE: the Align slot opens the twin (box + 2 fence starts); completes the probe fan-out; built-in alignmentWizard stays the legacy shim
    { id: 'rotary_center', type: 'rotary_center', label: 'Centreline', icon: '', group: 'probe', opensAs: 'user_rotary_center_data' },   // t421 E5 — IN-PLACE: the Centreline slot opens the twin (round-bar sim + rig + multi-pass starts from E2/E3/E4); built-in rotaryCenterWizard stays the legacy shim
    { id: 'rotary_clock', type: 'rotary_clock', label: 'Clock A0', icon: '🕒', group: 'probe', opensAs: 'user_rotary_clock_data' },   // t429 E3 — IN-PLACE: the Clock A0 slot opens the twin (box + 4-jaw rig + single start from E2); built-in rotaryClockWizard stays the legacy shim
    { id: 'atc_length', type: 'atc_length', label: 'Tool Length', icon: '📏', group: 'atc', opensAs: 'user_atc_length_data' },   // t409 — light NEW port, in-place
    { id: 'atc_check', type: 'atc_check', label: 'Tool Check', icon: '🛡', group: 'atc', opensAs: 'user_atc_check_data' },   // t411 — inherits the Tool Length light-ATC recipe, in-place
    { id: 'atc_change', type: 'atc_change', label: 'Tool Change', icon: '🔧', group: 'atc', opensAs: 'user_atc_change_data' },   // t566 E2 — IN-PLACE: the Tool Change slot opens the twin (5-method _arm superset + M2 static-arm graft + inlineTnc live-view + per-method gating; FORCE_MACHINE + WITH_MAGAZINE + choreography sim); built-in atcChangeWizard stays the legacy shim
    { id: 'atc_table', type: 'atc_table', label: 'Tool Table', icon: '📋', group: 'atc', opensAs: 'user_atc_table_data' },   // t568 E2 (THE LAST WIZARD) — IN-PLACE: the Tool Table slot opens the twin (include-toggle superset + live-view rows from Settings → Tool table); built-in atcTableWizard stays the legacy shim
    { id: 'atc_test', type: 'atc_test', label: 'ATC Test', icon: '🧪', group: 'atc', opensAs: 'user_atc_test_data' },   // t560 E2 — IN-PLACE: the ATC Test slot opens the twin (mode superset + pockets unroll + declared-I/O one-source; FORCE_MACHINE + WITH_MAGAZINE sim); built-in atcTestWizard stays the legacy shim
    // QUICK-WINS PILOT (t405) — the DRILL peck twin goes IN-PLACE via opensAs (mirror corner/edge/middle E4/E5): the built-in
    // keeps its Mill slot, the click re-points to user_drill_data, the twin's own Mill-Data-Wiz entry auto-hides (OPENS_AS_TARGETS),
    // the title reads plain "Drill" (builtinLabelForTwin). BORE stays built-in: user_drill_data is PECK-only (method=helical swaps
    // the block TYPE drill→bore, frontier #1), so Bore needs its OWN helical twin (user_bore_data) — a small follow-on, NOT this wire-up.
    { id: 'drill', type: 'drill', variant: 'drill', label: 'Drill', icon: '', group: 'mill', opensAs: 'user_drill_data' },
    { id: 'bore', type: 'drill', variant: 'bore', label: 'Bore', icon: '', group: 'mill', opensAs: 'user_bore_data' },   // fan-out — IN-PLACE: the Bore slot opens its OWN helical twin (drillStack method='helical' → the bore leaf; byte-identical); the built-in drill/bore stays the legacy shim
    { id: 'pocket', type: 'pocket', label: 'Pocket', icon: '', group: 'mill', opensAs: 'user_pocket_data' },   // t469 E1 — IN-PLACE: the Pocket slot opens the twin (superset: strategy + tooSmall guards + derive-guards); built-in pocketWizard stays the legacy shim
    { id: 'contour', type: 'contour', label: 'Contour', icon: '', group: 'mill', opensAs: 'user_contour_data' },   // E1 — IN-PLACE: the Contour slot opens the flat twin (region-pill→flat reframe, byte-identical); built-in contourStack stays the legacy shim
    // MILL/ATC IN-PLACE BATCH (t407) — the drill one-liner applied ×4: each single-shape twin goes IN-PLACE via opensAs (the
    // click re-points to the twin, its own Data-Wiz entry auto-hides, the seamless plain title). All single-shape → no Bore-style gap.
    { id: 'slot', type: 'slot', label: 'Slot', icon: '', group: 'mill', opensAs: 'user_slot_data' },
    { id: 'surfacing', type: 'surfacing', label: 'Surfacing', icon: '', group: 'mill', opensAs: 'user_surfacing_data' },
    { id: 'text', type: 'text', label: 'Text / engrave', icon: '✎', group: 'mill', opensAs: 'user_text_data' },
    { id: 'tap', type: 'tap', label: 'Tap', icon: '🔩', group: 'mill', opensAs: 'user_tap_data' },   // t778 — a NEW wizard (no built-in): the entry opens the data-twin directly via opensAs (floating-holder + gated rigid)
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
/** Whether an entry carries ANY layout override (label/group/order/icon/visible) — used to show a per-wizard Restore action. */
export function entryHasOverride(id) { const e = (readLayout().entries || {})[id]; return !!(e && Object.keys(e).length); }
/** t1107 — clear ONE entry's layout override (label/group/order/icon/visible) back to the shipped catalog. Per-wizard, unlike
 *  the blanket resetLayout. Leaves every other entry + group untouched. */
export function clearEntryOverride(id) { const l = readLayout(); if (l.entries && l.entries[id]) { delete l.entries[id]; writeLayout(l); } }
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
/** t1049 — the DECLARED twin→built-in bridge: a data-op twin's opType (opensAs target) resolved back to its built-in op
 *  `type` (+ `variant`, e.g. drill/bore). ONE source: the same `opensAs` declaration that drives the slot re-point, so it
 *  can't drift (no `user_`/`_data` string-munging). Returns null for a non-twin opType. Used by the CAM bridge. */
export function builtinTypeForTwin(opType) {
    const b = BUILTINS.find((x) => x.opensAs === opType);
    return b ? { type: b.type, variant: b.variant } : null;
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
    // t1271 — A LATHE WORKSPACE LEADS WITH ITS OWN GROUP. The catalogue is identical either way; what changes is the
    // order, because the first dropdown is where a person looks first and on a lathe that should not be "Probe". A
    // MILL workspace keeps Lathe where it was declared, behind the mill groups — present, just not first.
    const kindFirst = (ids) => {
        try {
            if (!isLathe()) return ids;
            return ['lathe', ...ids.filter((x) => x !== 'lathe')];
        } catch (_) { return ids; }
    };
    const knownIds = kindFirst(GROUPS.map((g) => g.id)), customIds = custom.map((c) => c.id);
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

/** Serialize a user-op def → `.wizard` / `.wiz` file text (portable, shareable). Carries the view-only metadata
 *  `panel` (layout) + `sim` (DECLARED preview intent: rotary rig / machine / magazine) so a shared wizard keeps its
 *  panel and rig on import — otherwise the recipient loses them. Every field is optional (omitted when absent →
 *  clean files, backward-compatible with v1 files that predate them).
 *
 *  t1247 — `group` and `defV` ride too, and the reason is worth stating because it is the whole point of a SOURCE
 *  share. `group` is the bar dropdown the op belongs in: it is authored, not derived, so dropping it landed every
 *  shared wizard in the wrong place. `defV` is the author's version stamp, which the staleness rule (defVStale) and
 *  the CAM sub-stack boundary both read — a share that reset it to 1 would tell the recipient's placed instances they
 *  are current when they are not. What is NOT written is what registerUserOp RE-DERIVES on import — `layout` (from
 *  the template's layout rows) and `bindingSpecs` (from its formfield blocks). Storing a derived value would be a
 *  second copy that can disagree with the template it came from; the file carries the SOURCE and the import re-derives. */
export function wizardToFile(def) {
    const op = { opType: def.opType, label: def.label, template: def.template, bindings: def.bindings };
    if (def.panel) op.panel = def.panel;
    if (def.sim) op.sim = def.sim;
    if (def.group) op.group = def.group;
    if (def.defV != null) op.defV = def.defV;
    // t1285 — the op's DECLARED TOOL rides too. It is authored DATA (what this op puts against the work: an insert
    // on a holder, or a bit on centre), not something derivable from the template — so dropping it would land a
    // shared lathe wizard showing the wrong cutter, exactly the way dropping `group` once landed one in the wrong
    // dropdown. Caught by the round-trip specs the moment it was added, which is what they are for.
    if (def.latheTool) op.latheTool = def.latheTool;
    // t1275 — A MANIFEST OF WHAT THE FILE CANNOT CARRY. The hooks are functions; only their NAMES travel. That is
    // enough for the recipient's import to say exactly what it could not restore, instead of losing it in silence.
    // …read from what the APP knows for this opType, not off the def object: the listed def is the PERSISTED one and
    // never carries functions (they live in the side registries) — reading it produced an empty manifest every time.
    const hooks = localHooksFor(def.opType).filter((k) => OP_CODE_HOOKS.includes(k));
    if (hooks.length) op.hooks = hooks;
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
    const file = wizardFromFile(text);
    if (!file) return null;
    const wanted = Array.isArray(file.hooks) ? file.hooks.slice() : [];
    delete file.hooks;                       // a manifest, not a def field
    const def = createWizard(file);
    if (!def) return null;
    // NAME THE OUTCOME. Re-attached = this app knows the op and supplied its own behaviour. Missing = the author's
    // app had code this one does not, and the wizard runs on its data alone.
    const got = def.hooksReattached || [];
    const missing = wanted.filter((k) => !got.includes(k));
    def.importNote = missing.length
        ? `Its data came across in full. ${missing.length === 1 ? 'One behaviour' : missing.length + ' behaviours'} the author's app adds in code (${missing.join(', ')}) is not part of a wizard file — this build has no ${def.opType} of its own to take it from, so the op runs on its data alone.`
        : (got.length ? `Rebuilt from the file, with this app's own ${def.opType} behaviour (${got.join(', ')}) — a wizard file carries data, not code.` : '');
    return def;
}
