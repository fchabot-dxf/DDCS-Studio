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

const STORE_KEY = 'ddcs_user_ops';
export const USER_OP_PREFIX = 'user_';

// Param value-types a binding may carry. `type` is the VALUE kind (drives marker codec + defaults); the form
// `widget` (separate, ui/formWidgets.js) is just how it's rendered. number stays the easy default.
export const BINDING_TYPES = new Set(['number', 'int', 'enum', 'bool', 'string']);

// Deterministic pre-order walk of a block stack (block, then its children) → a flat array of block REFS.
// Exported so devMode shares ONE definition (binding.blockIndex must mean the same block in both modules).
export function flattenBlocks(blocks, out = []) {
    for (const b of (blocks || [])) { if (!b) continue; out.push(b); if (b.children) flattenBlocks(b.children, out); }
    return out;
}

// Walk a template; for each `param` reporter record plugged into a value socket, produce a form binding.
// v(B) (keepPills=true, the default for save): KEEP the pill in the template so it ROUND-TRIPS — re-opening the
// wizard shows the param blocks. instantiate still resolves the pill to a number (it overwrites the socket by
// blockIndex/key), so the committed op + valid-by-construction are untouched (pills never reach a committed op).
// v(A) (keepPills=false): replace the pill with its number (a clean number-only template). Names deduped vs `seen`.
export function extractParamBlocks(template, seen = new Set(), keepPills = true) {
    const flat = flattenBlocks(template), bindings = [], STANDALONE = new Set(['slider']);
    flat.forEach((blk, i) => {
        if (!blk || !blk.params) return;
        for (const key in blk.params) {
            const v = blk.params[key];
            if (!v || typeof v !== 'object' || v.type !== 'param') continue;
            const pp = v.params || {};
            let name = String(pp.name || key).trim().replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || key;
            if (seen.has(name)) { let k = 2; while (seen.has(name + '_' + k)) k++; name += '_' + k; }
            seen.add(name);
            const dn = Number(pp.value), dflt = Number.isFinite(dn) ? dn : 0;
            const widget = STANDALONE.has(pp.widget) ? { widget: pp.widget } : {};
            bindings.push({ param: name, blockIndex: i, key, type: 'number', default: dflt, label: pp.name || name, ...widget });
            if (!keepPills) blk.params[key] = dflt;   // (A) replace; (B/default) leave the pill in the template
        }
    });
    return bindings;
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
        if (b.type && !BINDING_TYPES.has(b.type)) errs.push(`param "${b.param}": unsupported type "${b.type}" (use ${[...BINDING_TYPES].join(' / ')})`);
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
}

/** Re-register every persisted user op — call ONCE at app start. Returns the count registered. */
export function loadUserOps() {
    let n = 0;
    for (const def of readStore()) { try { registerUserOp(def); n++; } catch (_) { /* skip a corrupt def */ } }
    return n;
}

/** Author a def FROM a forked block stack + binding specs (the dev-panel output). Strips ids → a stable template.
 *  `panel` is the wizard's panel-layout id (form / form3d / form2d) — view-only metadata, persisted with the def. */
export function userOpFromStack(opType, label, stack, bindings, panel) {
    const t = opType.startsWith(USER_OP_PREFIX) ? opType : USER_OP_PREFIX + opType;
    return { opType: t, label: label || t, template: stripIds(stack), bindings: bindings || [], panel: panel || 'form3d' };
}
