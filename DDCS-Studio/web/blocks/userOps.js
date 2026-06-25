/**
 * blocks/userOps.js — runtime registry for USER-DEFINED ops (the wizard-maker, "fork-the-5%-delta").
 *
 * A user op = a saved block-stack TEMPLATE + numeric param BINDINGS. `registerUserOp(def)` installs it live:
 *   - BUILDERS[def.opType] = (params) => instantiate the template, substituting each binding's value at its path,
 *   - SCHEMA[def.opType]   = { param → { type, field } } so the form, validator + marker codec recognise it,
 *   - a friendly label (via opBuilders.registerOpLabel).
 * The op is then a first-class COMPLIANT op everywhere — build / commit / replace / marker round-trip / glow /
 * merge all gate on BUILDERS[opType] / SCHEMA[opType] and Just Work.
 *
 * "Valid by construction": the template IS `BUILDERS(defaults)`, so `BUILDERS(op.params) == op.children` holds —
 * a fresh user op never false-glows and satisfies the params-completeness guard automatically.
 *
 * Persisted in localStorage (`ddcs_user_ops`); `loadUserOps()` re-registers all at app start. v1 = number params.
 */
import { BUILDERS, registerOpLabel } from './opBuilders.js';
import { SCHEMA } from './opSchema.js';
import { setUserSimIntent } from '../viz/opSimContext.js';

const STORE_KEY = 'ddcs_user_ops';
export const USER_OP_PREFIX = 'user_';

// Param value-types a binding may carry. `type` is the VALUE kind (drives marker codec + defaults); the form
// `widget` (separate, ui/formWidgets.js) is just how it's rendered. number stays the easy default.
export const BINDING_TYPES = new Set(['number', 'int', 'enum', 'bool', 'string', 'list']);   // 'list' = a structured/array value (e.g. a coordinate-list positioner) — not a scalar socket

// Deterministic pre-order walk of a block stack (block, then its children) → a flat array of block REFS.
// Exported so devMode shares ONE definition (binding.blockIndex must mean the same block in both modules).
export function flattenBlocks(blocks, out = []) {
    for (const b of (blocks || [])) { if (!b) continue; out.push(b); if (b.children) flattenBlocks(b.children, out); }
    return out;
}

// Parse a param block's `options` string ("Rough=500, Finish=1500", or newline-separated) → [[label, value], …].
// Values must be NUMERIC (a param knob lands in a numeric socket → valid by construction); non-numeric presets are
// dropped. A bare "500" yields ['500', 500]. Exported so the form widget + tests share one parser.
export function parseParamOptions(str) {
    const out = [];
    for (const tok of String(str || '').split(/[,\n]/)) {
        const t = tok.trim();
        if (!t) continue;
        const eq = t.indexOf('=');
        const label = (eq >= 0 ? t.slice(0, eq) : t).trim();
        const val = Number((eq >= 0 ? t.slice(eq + 1) : t).trim());
        if (!Number.isFinite(val)) continue;
        out.push([label || String(val), val]);
    }
    return out;
}

// Canvas widgets (xy-pad / rect) fold the ROLE into the widget value so the role is DECLARED, never inferred from
// pool position — reordering / deleting+re-adding a knob can't silently remap x↔y (audit #6-B). 'xy-x'/'xy-y' →
// xy-pad x/y; 'rect-x/-y/-w/-h' → rect. decodeCanvasWidget → { widget, role } (role null = not a canvas widget).
const CANVAS_DECODE = { 'xy-x': ['xy-pad', 'x'], 'xy-y': ['xy-pad', 'y'], 'rect-x': ['rect', 'x'], 'rect-y': ['rect', 'y'], 'rect-w': ['rect', 'w'], 'rect-h': ['rect', 'h'] };
/** The role-encoded canvas widget choices ([label, value]) — shared by the param-block dropdown (bridge) and the
 *  dev-mode inline-expose dropdown so all three (author / decode / form) agree on the encoding. */
export const CANVAS_ROLE_WIDGETS = [['XY pad · X', 'xy-x'], ['XY pad · Y', 'xy-y'], ['Rect · X', 'rect-x'], ['Rect · Y', 'rect-y'], ['Rect · W', 'rect-w'], ['Rect · H', 'rect-h']];
/** Decode a (possibly role-encoded) widget value → { widget, role }. role is null for plain widgets. */
export function decodeCanvasWidget(w) { const d = CANVAS_DECODE[w]; return d ? { widget: d[0], role: d[1] } : { widget: w, role: null }; }

// The roles a complete canvas needs (an incomplete one degrades to plain number knobs).
const CANVAS_ROLES = { 'xy-pad': ['x', 'y'], rect: ['x', 'y', 'w', 'h'] };
const cleanBinding = (b) => ({ param: b.param, blockIndex: b.blockIndex, key: b.key, type: b.type, default: b.default, label: b.label });

/** Assemble canvas bindings (each carrying `_widget` + a DECLARED `role`) into form groups: consecutive same-widget
 *  bindings share a group; a NEW group starts when a role would repeat (so two xy-pads → two canvases). The role is
 *  declared (folded into the widget), NEVER from pool position. The first member carries the form `widget`
 *  (resolveFormWidget reads group[0].widget); an INCOMPLETE group (e.g. an xy-pad missing Y) degrades each member to
 *  a plain number knob. Shared by both authoring paths. */
export function groupCanvasBindings(canvas, prefix = 'pg') {
    const groups = []; let cur = null, seen = null;
    for (const b of canvas) {
        if (!cur || cur.widget !== b._widget || seen.has(b.role)) { cur = { widget: b._widget, items: [] }; groups.push(cur); seen = new Set(); }
        cur.items.push(b); seen.add(b.role);
    }
    const out = []; let gi = 0;
    for (const g of groups) {
        const have = new Set(g.items.map((b) => b.role));
        const complete = (CANVAS_ROLES[g.widget] || []).every((r) => have.has(r));
        if (!complete) { g.items.forEach((b) => out.push(cleanBinding(b))); continue; }   // incomplete → plain number knobs
        const gid = prefix + (++gi);
        g.items.forEach((b, i) => out.push({ ...cleanBinding(b), group: gid, role: b.role, ...(i === 0 ? { widget: g.widget } : {}) }));
    }
    return out;
}

// Walk a template; for each `param` reporter record plugged into a value socket, produce a form binding.
// v(B) (keepPills=true, the default for save): KEEP the pill in the template so it ROUND-TRIPS — re-opening the
// wizard shows the param blocks. instantiate still resolves the pill to a number (it overwrites the socket by
// blockIndex/key), so the committed op + valid-by-construction are untouched (pills never reach a committed op).
// v(A) (keepPills=false): replace the pill with its number (a clean number-only template). Names deduped vs `seen`.
// Widget round-trip: every param widget commits a NUMBER (the socket stays numeric) — slider/toggle keep their
// widget key; dropdown also carries its parsed numeric presets as widgetConfig.options; canvas widgets carry a
// DECLARED role (folded into the widget value) and group via groupCanvasBindings.
export function extractParamBlocks(template, seen = new Set(), keepPills = true) {
    const flat = flattenBlocks(template), bindings = [], canvas = [];
    flat.forEach((blk, i) => {
        if (!blk || !blk.params) return;
        for (const key in blk.params) {
            const v = blk.params[key];
            if (!v || typeof v !== 'object' || (v.type !== 'param' && v.type !== 'regionpick')) continue;
            const pp = v.params || {};
            let name = String(pp.name || key).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || key;
            if (seen.has(name)) { let k = 2; while (seen.has(name + '_' + k)) k++; name += '_' + k; }
            seen.add(name);
            const dn = Number(pp.value), dflt = Number.isFinite(dn) ? dn : 0;
            // A region-pick pill → a 'region-pick' binding (widgetConfig = the parsed spec). Commits a NUMBER (the
            // picked region's value) into a numeric socket, like the other param widgets → valid by construction.
            if (v.type === 'regionpick') {
                let widgetConfig = null;
                try { widgetConfig = pp.spec ? (typeof pp.spec === 'string' ? JSON.parse(pp.spec) : pp.spec) : null; } catch (_) { /* malformed spec */ }
                bindings.push({ param: name, blockIndex: i, key, type: 'number', default: dflt, label: pp.name || name, widget: 'region-pick', ...(widgetConfig ? { widgetConfig } : {}) });
                if (!keepPills) blk.params[key] = dflt;
                continue;
            }
            // type stays 'number' for EVERY param widget — a param pill lives in a numeric socket, so its committed
            // value is always a number (dropdown = a numeric preset, toggle = 1/0). The WIDGET (not the type) drives
            // form rendering — resolveFormWidget prefers binding.widget — so this is NOT a downgrade. Do NOT "fix" a
            // toggle to type:'bool': a bool in a numeric socket resolves to 0, so a toggled-ON knob would emit OFF
            // (audit #6-A — a false alarm; this comment exists so it isn't re-flagged).
            const base = { param: name, blockIndex: i, key, type: 'number', default: dflt, label: pp.name || name };
            const dec = decodeCanvasWidget(pp.widget);
            if (dec.role) canvas.push({ ...base, _widget: dec.widget, role: dec.role });   // DECLARED role (folded into the widget)
            else if (pp.widget === 'slider' || pp.widget === 'toggle') bindings.push({ ...base, widget: pp.widget });
            else if (pp.widget === 'dropdown') {
                const options = parseParamOptions(pp.options);
                bindings.push({ ...base, widget: 'dropdown', ...(options.length ? { widgetConfig: { options } } : {}) });
            } else bindings.push(base);
            if (!keepPills) blk.params[key] = dflt;   // (A) replace; (B/default) leave the pill in the template
        }
    });
    bindings.push(...groupCanvasBindings(canvas, 'pg'));   // declared roles → groups (new group when a role repeats)
    return bindings;
}

/** Read a DECLARED preview intent from a `sim` block in a stack (the blocks-native twin of the dev-panel "Preview
 *  rig" checkboxes). The block WINS over the dev-panel when present (same precedence as the panel block). Returns:
 *  the intent object, `null` (a sim block declaring nothing), or `undefined` (no sim block → use the checkboxes). */
export function simIntentFromStack(children) {
    const blk = flattenBlocks(children).find((b) => b && b.type === 'sim');
    if (!blk || !blk.params) return undefined;
    const s = blk.params, sim = { showRotaryRig: !!s.rotary, forceMachine: !!s.machine, showMagazine: !!s.magazine };
    return (sim.showRotaryRig || sim.forceMachine || sim.showMagazine) ? sim : null;
}

// Drop counter-based block ids so a stored template is stable (ids are reassigned on emit). (Same rule as opGlow.)
function stripIds(v) {
    if (Array.isArray(v)) return v.map(stripIds);
    if (v && typeof v === 'object') {
        const o = {};
        for (const k in v) { if (k === 'id' && typeof v.type === 'string') continue; o[k] = stripIds(v[k]); }
        return o;
    }
    return v;
}

/** The op's default params — each binding at its declared default (the op's params on first insert). */
export function defaultParams(def) {
    const p = {};
    for (const b of (def.bindings || [])) p[b.param] = b.default;
    return p;
}

// The builder: clone the template, substitute each binding's value at its (blockIndex, key); unbound values stay baked.
function instantiate(def, params) {
    const clone = JSON.parse(JSON.stringify(def.template || []));
    const flat = flattenBlocks(clone);
    for (const b of (def.bindings || [])) {
        const blk = flat[b.blockIndex];
        if (blk && blk.params && (b.key in blk.params)) {
            blk.params[b.key] = (params && b.param in params) ? params[b.param] : b.default;
        }
    }
    return clone;
}

// NO INFERENCE for custom ops: a user_* op's preview intent (rotary rig / forceMachine / magazine) is whatever the
// def DECLARES in `def.sim` — never read from its motion. The axis letter doesn't carry intent for an open-world
// op authored by an unknown user on an unknown machine (A could be a rotary, a non-rotary attachment, anything).
// A built-in's A-move is safe to read as rotary only because WE authored it; a custom op isn't. So intent is
// declared the same way the panel block declares panel type — see [[custom-op-sim-intent-infer-vs-declare]].

/** Validate a def BEFORE registering — returns a list of problems ([] = compliant). */
export function validateUserOp(def) {
    const errs = [];
    if (!def || typeof def.opType !== 'string' || !def.opType.startsWith(USER_OP_PREFIX)) errs.push('opType must be a string starting with "user_"');
    if (!Array.isArray(def.template) || !def.template.length) errs.push('template must be a non-empty block array');
    const flat = flattenBlocks(def.template || []), seen = new Set();
    for (const b of (def.bindings || [])) {
        if (!b || !b.param) { errs.push('a binding has no param name'); continue; }
        if (seen.has(b.param)) errs.push(`duplicate param "${b.param}"`);
        seen.add(b.param);
        if (!b.type) errs.push(`param "${b.param}": missing type — declare one of ${[...BINDING_TYPES].join(' / ')} (type is declared, never assumed — audit #6)`);
        else if (!BINDING_TYPES.has(b.type)) errs.push(`param "${b.param}": unsupported type "${b.type}" (use ${[...BINDING_TYPES].join(' / ')})`);
        const blk = flat[b.blockIndex];
        if (!blk || !blk.params || !(b.key in blk.params)) errs.push(`param "${b.param}": binding (block ${b.blockIndex}.${b.key}) does not resolve in the template`);
    }
    return errs;
}

/** Install a user-op def into the LIVE BUILDERS + SCHEMA + label registries (runtime only — no persistence). */
export function registerUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    BUILDERS[def.opType] = (params) => instantiate(def, params || defaultParams(def));
    const schema = {};
    // canon omitted: the param name is already a clean marker key (canonOf falls back to the key). field drives the form.
    for (const b of def.bindings) schema[b.param] = { type: b.type, addr: null, field: `uop_${def.opType}_${b.param}` };
    SCHEMA[def.opType] = schema;
    registerOpLabel(def.opType, def.label || def.opType);
    setUserSimIntent(def.opType, def.sim || null);   // DECLARED preview intent only (never inferred from motion)
    return def;
}

// ── persistence (localStorage) ───────────────────────────────────────────────────────────────────────────
function readStore() {
    try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; }
}
function writeStore(defs) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(defs)); } catch (_) { /* quota / unavailable */ }
}

/** Every saved user-op def. */
export function listUserOps() { return readStore(); }

/** Validate → register → persist a new user op. Throws if invalid or the opType already exists. */
export function createUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const defs = readStore();
    if (defs.some((d) => d.opType === def.opType)) throw new Error(`user op "${def.opType}" already exists`);
    registerUserOp(def);                                         // only now mutate the live BUILDERS/SCHEMA/labels
    defs.push(def);
    writeStore(defs);
    return def;
}

/** Replace an existing user op's def IN PLACE (re-register + persist), keeping its opType identity. The re-author
 *  flow uses this so editing a saved wizard updates it instead of spawning a duplicate. Falls back to create. */
export function updateUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const defs = readStore();
    const i = defs.findIndex((d) => d.opType === def.opType);
    if (i < 0) return createUserOp(def);
    registerUserOp(def);            // overwrite the live BUILDERS/SCHEMA/label
    defs[i] = def;
    writeStore(defs);
    return def;
}

/** Remove a user op from the registry + persistence (and the live BUILDERS/SCHEMA entries). */
export function deleteUserOp(opType) {
    writeStore(readStore().filter((d) => d.opType !== opType));
    delete BUILDERS[opType];
    delete SCHEMA[opType];
    setUserSimIntent(opType, null);   // clear the declared preview intent
}

/** Re-register every persisted user op — call ONCE at app start. Returns the count registered. */
export function loadUserOps() {
    let n = 0;
    for (const def of readStore()) { try { registerUserOp(def); n++; } catch (_) { /* skip a corrupt def */ } }
    return n;
}

/** Author a def FROM a forked block stack + binding specs (the dev-panel output). Strips ids → a stable template.
 *  `panel` is the wizard's panel-layout id (form / form3d / form2d) — view-only metadata, persisted with the def.
 *  `sim` is the DECLARED preview intent ({ showRotaryRig?, forceMachine?, showMagazine? }) — never inferred from
 *  the stack's motion; omitted = the default local-frame preview. Both are view-only metadata. */
export function userOpFromStack(opType, label, stack, bindings, panel, sim) {
    const t = opType.startsWith(USER_OP_PREFIX) ? opType : USER_OP_PREFIX + opType;
    const def = { opType: t, label: label || t, template: stripIds(stack), bindings: bindings || [], panel: panel || 'form3d' };
    if (sim && typeof sim === 'object') def.sim = sim;   // declared preview intent (rotary rig / machine / magazine)
    return def;
}
