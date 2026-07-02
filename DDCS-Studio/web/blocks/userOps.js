/**
 * blocks/userOps.js — runtime registry for USER-DEFINED ops (the wizard-maker, "fork-the-5%-delta").
 *
 * A user op = a saved block-stack TEMPLATE + numeric param BINDINGS. `registerUserOp(def)` installs it live into
 * the FEDERATED user layer (MID #6) — the built-in BUILDERS/SCHEMA stay pristine/forkable:
 *   - registerUserBuilder(opType, params => instantiate(template, …)) — the user builder layer (builderOf resolves it),
 *   - registerUserSpec(opType, { param → { type, field } }) — the user spec layer (specOf resolves it) so the form,
 *     validator + marker codec recognise it,
 *   - a friendly label (via opBuilders.registerOpLabel; deleteUserOp clears it via removeOpLabel).
 * The op is then a first-class COMPLIANT op everywhere — build / commit / replace / marker round-trip / glow /
 * merge all gate on builderOf(opType) / specOf(opType) and Just Work.
 *
 * "Valid by construction": the template IS `BUILDERS(defaults)`, so `BUILDERS(op.params) == op.children` holds —
 * a fresh user op never false-glows and satisfies the params-completeness guard automatically.
 *
 * Persisted in localStorage (`ddcs_user_ops`); `loadUserOps()` re-registers all at app start. v1 = number params.
 */
import { registerUserBuilder, unregisterUserBuilder, registerOpLabel, removeOpLabel } from './opBuilders.js';
import { registerUserSpec, unregisterUserSpec } from './opSchema.js';
import { setUserSimIntent } from '../viz/opSimContext.js';
import { setUserSimStarts, makeProvider } from '../viz/opSimStarts.js';
import { pruneGuards } from './whenGuard.js';   // ② B4 M2: collapse guarded structural forks at build (the template carries every arm)
import { deriveBindings } from './dataOps/deriveBindings.js';   // re-derive binding indices BY IDENTITY after prune (guarded templates shift per state)

const STORE_KEY = 'ddcs_user_ops';
export const USER_OP_PREFIX = 'user_';

// Param value-types a binding may carry. `type` is the VALUE kind (drives marker codec + defaults); the form
// `widget` (separate, ui/formWidgets.js) is just how it's rendered. number stays the easy default.
export const BINDING_TYPES = new Set(['number', 'int', 'enum', 'bool', 'string', 'list']);   // 'list' = a structured/array value (e.g. a coordinate-list positioner) — not a scalar socket

// Deterministic pre-order walk of a block stack (block, then its children) → a flat array of block REFS.
// Exported so devMode shares ONE definition (binding.blockIndex must mean the same block in both modules).
export function flattenBlocks(blocks, out = [], currentGroup = null) {
    for (const b of (blocks || [])) { 
        if (!b) continue; 
        let g = currentGroup;
        if (b.type === 'param_group' && b.params && b.params.group) g = String(b.params.group).trim();
        b._group = g;
        out.push(b); 
        if (b.uiChildren) flattenBlocks(b.uiChildren, out, g);
        if (b.children) flattenBlocks(b.children, out, g); 
    }
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

// Role-encoded widget values fold a spatial ROLE into the widget so it's DECLARED, never inferred from pool
// position — reordering / deleting+re-adding a knob can't silently remap x↔y (audit #6-B). Two families share the
// encoding: CANVAS widgets (xy-pad / rect) render as a form mini-canvas that owns its value; NUMBER-ROLE widgets
// (point / nrect / ncircle) render as PLAIN number fields but still carry the role, so the Form+2D preview derives a
// drag handle over them (the spatial-GUI decision: continuous positions = drag the preview, plain numbers on the block).
// decodeCanvasWidget → { widget, role } (role null = a plain, role-less widget).
const CANVAS_DECODE = { 'xy-x': ['xy-pad', 'x'], 'xy-y': ['xy-pad', 'y'], 'rect-x': ['rect', 'x'], 'rect-y': ['rect', 'y'], 'rect-w': ['rect', 'w'], 'rect-h': ['rect', 'h'], 'point-x': ['point', 'x'], 'point-y': ['point', 'y'], 'nrect-x': ['nrect', 'x'], 'nrect-y': ['nrect', 'y'], 'nrect-w': ['nrect', 'w'], 'nrect-h': ['nrect', 'h'], 'ncirc-x': ['ncircle', 'x'], 'ncirc-y': ['ncircle', 'y'], 'ncirc-d': ['ncircle', 'dia'], 'nlen-x': ['nlength', 'x'], 'nlen-y': ['nlength', 'y'], 'nlen-l': ['nlength', 'len'], 'nscale-x': ['nscaleX', 'x'], 'nscale-y': ['nscaleX', 'y'], 'nscale-w': ['nscaleX', 'w'], 'nscale-s': ['nscaleX', 'scale'], 'nshear-x': ['nshear', 'x'], 'nshear-y': ['nshear', 'y'], 'nshear-w': ['nshear', 'w'], 'nshear-h': ['nshear', 'h'], 'nshear-s': ['nshear', 'slant'], 'nproj-ax': ['nprojLength', 'ax'], 'nproj-ay': ['nprojLength', 'ay'], 'nproj-bx': ['nprojLength', 'bx'], 'nproj-by': ['nprojLength', 'by'], 'nproj-w': ['nprojLength', 'width'] };
/** The role-encoded widget choices ([label, value]) — shared by the param-block dropdown (bridge) and the dev-mode
 *  inline-expose dropdown so all three (author / decode / form) agree on the encoding. "XY pad / Rect" = a form
 *  mini-canvas; "2D point / 2D rect / 2D circle" = plain number fields that the Form+2D preview makes drag-to-edit. */
export const CANVAS_ROLE_WIDGETS = [['XY pad · X', 'xy-x'], ['XY pad · Y', 'xy-y'], ['Rect · X', 'rect-x'], ['Rect · Y', 'rect-y'], ['Rect · W', 'rect-w'], ['Rect · H', 'rect-h'], ['2D point · X', 'point-x'], ['2D point · Y', 'point-y'], ['2D rect · X', 'nrect-x'], ['2D rect · Y', 'nrect-y'], ['2D rect · W', 'nrect-w'], ['2D rect · H', 'nrect-h'], ['2D circle · X', 'ncirc-x'], ['2D circle · Y', 'ncirc-y'], ['2D circle · Ø', 'ncirc-d'], ['2D length · X', 'nlen-x'], ['2D length · Y', 'nlen-y'], ['2D length · L', 'nlen-l'], ['2D scale · X', 'nscale-x'], ['2D scale · Y', 'nscale-y'], ['2D scale · W', 'nscale-w'], ['2D scale · S', 'nscale-s'], ['2D shear · X', 'nshear-x'], ['2D shear · Y', 'nshear-y'], ['2D shear · W', 'nshear-w'], ['2D shear · H', 'nshear-h'], ['2D shear · S', 'nshear-s'], ['2D projLen · Ax', 'nproj-ax'], ['2D projLen · Ay', 'nproj-ay'], ['2D projLen · Bx', 'nproj-bx'], ['2D projLen · By', 'nproj-by'], ['2D projLen · W', 'nproj-w']];
/** Decode a (possibly role-encoded) widget value → { widget, role }. role is null for plain widgets. */
export function decodeCanvasWidget(w) { const d = CANVAS_DECODE[w]; return d ? { widget: d[0], role: d[1] } : { widget: w, role: null }; }

// The roles a complete group needs (an incomplete one degrades to plain number knobs). A number-role point/nrect/ncircle
// shares its canvas twin's shape (a point = an xy-pad's x/y; an nrect = a rect's x/y/w/h; an ncircle = a centre + Ø).
// nlength = an anchor (x,y) + a 1D extent (len); the length handle drags `len` along a FIXED axis (Y, like text
// height) — the rule-of-three 4th shape after point/nrect/ncircle. X/Y-selectable axis is a future gesture variant.
const CANVAS_ROLES = { 'xy-pad': ['x', 'y'], rect: ['x', 'y', 'w', 'h'], point: ['x', 'y'], nrect: ['x', 'y', 'w', 'h'], ncircle: ['x', 'y', 'dia'], nlength: ['x', 'y', 'len'], nscaleX: ['x', 'y', 'w', 'scale'], nshear: ['x', 'y', 'w', 'h', 'slant'], nprojLength: ['ax', 'ay', 'bx', 'by', 'width'] };
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
            if (blk._group) base.group = blk._group;
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

// ── def.sim.starts ⇄ `simstart` blocks (B3) — the DECLARATION round-trip (NOT the macro: a sim-start emits no line) ──
const ANCHORS = ['centre', 'edge', 'frac', 'radial'];
const numOrTok = (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) ? Number(v) : v;   // "15"→15, "@outset"→"@outset"

/** The `simstart` blocks in a stack → def.sim.starts ROWS (B1's makeProvider vocabulary). Each block declares one
 *  pass; only the chosen anchor's fields are kept, so the rows stay tidy (and match a hand-written def.sim.starts). */
export function simStartsFromStack(children) {
    return flattenBlocks(children).filter((b) => b && b.type === 'simstart').map((b) => {
        const p = b.params || {};
        const a = ANCHORS.includes(p.anchor) ? p.anchor : 'centre';
        const row = { anchor: a, plane: p.zplane || 'probe' };
        if (a === 'edge') { row.axis = p.axis || 'X'; row.side = p.wall || '@dir1'; row.out = numOrTok(p.out); }
        else if (a === 'frac') { row.fx = Number(p.fx) || 0; row.fy = Number(p.fy) || 0; }
        else if (a === 'radial') { row.axis = p.axis || 'Y'; row.sign = p.sign === '-' ? '-' : '+'; row.r = numOrTok(p.rad); }
        if (p.whenparam) row.when = { param: p.whenparam, is: p.whenis === 'true' ? true : p.whenis === 'false' ? false : p.whenis };
        if (p.id) row.id = p.id;   // stable pass id (② B4 step 4a) — the anchor a semantic relTo names; only present when declared
        if (p.emits === 'true' || p.emits === true) row.emits = true;   // sim-marker-distinguish (t69): a reposition-destination pass → SOLID marker (a drag edits the program)
        return row;
    });
}

/** def.sim.starts ROWS → `simstart` block records (every field set, so recToJson's dropdowns stay valid). The reverse
 *  of simStartsFromStack — renders a declared (incl. B1-programmatic) op's starts AS BLOCKS in the Blockly view. */
export function simStartsToBlocks(rows) {
    return (rows || []).map((row) => {
        const a = ANCHORS.includes(row.anchor) ? row.anchor : 'centre';
        return { type: 'simstart', params: {
            anchor: a,
            axis: row.axis || 'X',
            wall: row.side || '@dir1',
            out: String(row.out ?? '@outset'),
            fx: Number.isFinite(+row.fx) ? +row.fx : 0.5,
            fy: Number.isFinite(+row.fy) ? +row.fy : 0.5,
            sign: row.sign === '-' ? '-' : '+',
            rad: String(row.r ?? '@R'),
            zplane: row.plane || 'probe',
            whenparam: row.when ? row.when.param : '',
            whenis: row.when ? String(row.when.is) : '',
            ...(row.id ? { id: row.id } : {}),   // carry a declared pass id ONLY when set → id-less rows round-trip byte-identical
            ...(row.emits ? { emits: 'true' } : {}),   // sim-marker-distinguish (t69): carry the emitting flag ONLY when set → sim-only rows round-trip byte-identical
        } };
    });
}

// Template-declared sim metadata is the canonical source for custom ops.
// Compatibility fallback: if a legacy template has no sim/simstart blocks, use def.sim.
function resolveSimMeta(def) {
    const template = def && Array.isArray(def.template) ? def.template : [];

    // sim intent: undefined = no sim block in template (fallback allowed), null = explicit "none" declaration.
    const stackIntent = simIntentFromStack(template);
    const intent = (stackIntent !== undefined) ? stackIntent : ((def && def.sim) || null);

    // sim starts: only fall back when there are NO simstart blocks in template.
    const hasStartBlocks = flattenBlocks(template).some((b) => b && b.type === 'simstart');
    const stackStarts = hasStartBlocks ? simStartsFromStack(template) : null;
    const legacyStarts = def && def.sim && Array.isArray(def.sim.starts) ? def.sim.starts : null;
    const starts = hasStartBlocks ? stackStarts : legacyStarts;

    return { intent, starts };
}

/** The `panel` block in a stack → its panel layout parameter. */
export function panelFromStack(children) {
    const blk = flattenBlocks(children).find((b) => b && b.type === 'panel');
    if (!blk || !blk.params) return undefined;
    return typeof blk.params.panel === 'string' ? blk.params.panel : null;
}

function resolvePanelMeta(def) {
    const template = def && Array.isArray(def.template) ? def.template : [];
    const stackPanel = panelFromStack(template);
    return stackPanel !== undefined ? stackPanel : ((def && def.panel) || 'form3d');
}

/** The `layout` block in a stack → its layout kind parameter. */
export function layoutFromStack(children) {
    const blk = flattenBlocks(children).find((b) => b && b.type === 'layout');
    if (!blk || !blk.params) return undefined;
    return typeof blk.params.kind === 'string' ? { kind: blk.params.kind } : null;
}

function resolveLayoutMeta(def) {
    const template = def && Array.isArray(def.template) ? def.template : [];
    const stackLayout = layoutFromStack(template);
    return stackLayout !== undefined ? stackLayout : ((def && def.layout) || null);
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

// The builder: clone the template, COLLAPSE guarded structural forks for this param state (pruneGuards), then substitute
// each binding's value at its (blockIndex, key); unbound values stay baked.
//
// ② B4 M2: a def may carry `bindingSpecs` (identity matchers) INSTEAD of frozen `bindings` — because a guarded template
// (the all-forks-present superset) shifts flat indices per prune state, so the indices MUST be RE-DERIVED BY IDENTITY over
// the PRUNED stack every build. A legacy def (no guards, frozen `bindings`) is UNCHANGED: pruneGuards is a no-op with no
// guard blocks, and without bindingSpecs the frozen `bindings` are used exactly as before → byte-identical for every
// existing user op (drill/slot/text/…), verified by their emit specs + the guard-prune regression.
function instantiate(def, params) {
    // ② B4 step 4b — fill STRUCTURAL binding defaults (guard-driving params with no block socket: bool probeZFirst, enum
    // travelApproach) for any absent param BEFORE prune. A bool guard tolerates undefined (whenOk coerces !!undefined=false),
    // but an ENUM guard needs the value (undefined === 'auto' is false → the arm would drop). Value bindings are untouched
    // (their absence is handled per-binding below). A legacy def (no structural bindings) → this is a no-op → byte-identical.
    const p = withGuardDefaults(def, params);
    const clone = JSON.parse(JSON.stringify(def.template || []));
    pruneGuards(clone, p);
    const flat = flattenBlocks(clone);
    const bindings = def.bindingSpecs ? deriveBindings(flat, def.bindingSpecs) : (def.bindings || []);
    for (const b of bindings) {
        const blk = flat[b.blockIndex];
        if (blk && blk.params && (b.key in blk.params)) {
            blk.params[b.key] = (p && b.param in p) ? p[b.param] : b.default;
        }
    }
    return clone;
}

// A STRUCTURAL binding (no blockIndex — drives guards via the prune params, not a value socket) supplies its default when
// its param is absent, so an enum/bool guard prunes to the seeded shape even from a partial/empty params object (build({})).
function withGuardDefaults(def, params) {
    const p = { ...(params || {}) };
    for (const b of (def.bindings || [])) {
        if (b && b.param != null && b.blockIndex == null && !(b.param in p)) p[b.param] = b.default;
    }
    return p;
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
    // ③b-harden — a def that sets BOTH `bindingSpecs` AND a function `build` is a FOOTGUN: bindingSpecs re-derives + VALIDATES
    // the value bindings inside instantiate(), but def.build BYPASSES instantiate → both the socket re-derivation AND the
    // bindingSpecs-scoped block-check skip (below) would be silently skipped. Forbid the combination (no def does this today;
    // corner reverted exactly this def.build attempt one commit before the M2 rewrite). Cheap to guard while it's fresh.
    if (def && def.bindingSpecs && typeof def.build === 'function') errs.push('a def cannot set BOTH `bindingSpecs` and a function `build` — def.build bypasses the bindingSpecs re-derivation + validation (both would be silently skipped)');
    const flat = flattenBlocks(def.template || []), seen = new Set();
    for (const b of (def.bindings || [])) {
        if (!b || !b.param) { errs.push('a binding has no param name'); continue; }
        if (seen.has(b.param)) errs.push(`duplicate param "${b.param}"`);
        seen.add(b.param);
        if (!b.type) errs.push(`param "${b.param}": missing type — declare one of ${[...BINDING_TYPES].join(' / ')} (type is declared, never assumed — audit #6)`);
        else if (!BINDING_TYPES.has(b.type)) errs.push(`param "${b.param}": unsupported type "${b.type}" (use ${[...BINDING_TYPES].join(' / ')})`);
        // ② B4 step 4a — a STRUCTURAL binding (no blockIndex) drives GUARDS via the prune params (e.g. corner's probeZFirst),
        // not a value SOCKET, so there is no template block to resolve. It's substituted by pruneGuards, never by instantiate's
        // socket loop (which the bindingSpecs path skips anyway). Only value-socket bindings get the block-resolution check.
        if (b.blockIndex == null) continue;
        // ③b — a `bindingSpecs` def re-derives + VALIDATES its value bindings AT BUILD (deriveBindings over the PRUNED stack
        // throws there on a bad spec). Its frozen def.bindings blockIndex is computed over a CANONICAL-pruned stack (not
        // def.template, the guarded superset — where a corner×probeSeq-guarded socket appears 8×), so the superset-flatten
        // check below would spuriously fail. SCOPED STRICTLY to bindingSpecs defs → the 5 legacy siblings (no bindingSpecs) are
        // UNCHANGED (they keep the full block-resolution check). See corner-data-cornerseq-live.spec + the sibling regression.
        if (def.bindingSpecs) continue;
        const blk = flat[b.blockIndex];
        if (!blk || !blk.params || !(b.key in blk.params)) errs.push(`param "${b.param}": binding (block ${b.blockIndex}.${b.key}) does not resolve in the template`);
    }
    return errs;
}

/** Install a user-op def into the LIVE user-layer builder + spec + label registries (runtime only — no persistence). */
export function registerUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const builder = (params) => {
        const resolved = params || defaultParams(def);
        if (typeof def.build === 'function') return def.build(resolved);
        const stack = instantiate(def, resolved);
        // t87 — an optional LIVE post-emit hook (e.g. corner source-chips: rewrite probe-config values to controller registers
        // when the user opts 'ctrl'). A fn on the code def (dropped on persistence, re-attached from the seed, like simStartsProvider).
        return (typeof def.postInstantiate === 'function') ? def.postInstantiate(stack, resolved) : stack;
    };
    registerUserBuilder(def.opType, builder);
    const schema = {};
    // canon omitted: the param name is already a clean marker key (canonOf falls back to the key). field drives the form.
    for (const b of def.bindings) schema[b.param] = { type: b.type, addr: null, field: `uop_${def.opType}_${b.param}` };
    registerUserSpec(def.opType, schema);
    registerOpLabel(def.opType, def.label || def.opType);
    def.panel = resolvePanelMeta(def);
    def.layout = resolveLayoutMeta(def);
    const sim = resolveSimMeta(def);
    setUserSimIntent(def.opType, sim.intent);   // DECLARED preview intent only (never inferred from motion)
    // DECLARED per-pass sim-starts (template `simstart` rows first, legacy def.sim.starts fallback). The rows travel
    // ALONGSIDE the provider so resolveRelToIndex can map a binding's semantic relTo ({row:'wall1'}) → the surviving pass.
    const starts = sim.starts;
    // A def may supply its OWN sim-start provider (t73 — corner CHAINS reposition-destination markers off their anchor via
    // the emit's reposition geometry, which can't be generic-declarative rows). It's a LIVE fn (never persisted; re-attached
    // from code each boot by the seed). Else the generic makeProvider(rows). The rows still travel alongside (resolveRelToIndex).
    const provider = (typeof def.simStartsProvider === 'function') ? def.simStartsProvider
        : ((Array.isArray(starts) && starts.length) ? makeProvider(starts) : null);
    setUserSimStarts(def.opType, provider, starts);
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
export function listUserOps() {
    return readStore();
}

/** Validate → register → persist a new user op. Throws if invalid or the opType already exists. */
export function createUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const defs = readStore();
    if (defs.some((d) => d.opType === def.opType)) throw new Error(`user op "${def.opType}" already exists`);
    registerUserOp(def);                                         // only now install into the live user-layer builder/spec/label
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
    registerUserOp(def);            // overwrite the live user-layer builder/spec/label
    defs[i] = def;
    writeStore(defs);
    return def;
}

/** Remove a user op from the registry + persistence (and the live user-layer builder/spec/label entries). */
export function deleteUserOp(opType) {
    writeStore(readStore().filter((d) => d.opType !== opType));
    unregisterUserBuilder(opType);
    unregisterUserSpec(opType);
    removeOpLabel(opType);            // register touches 4 tables — delete must clear all 4 (was leaking OP_LABELS)
    setUserSimIntent(opType, null);   // clear the declared preview intent
    setUserSimStarts(opType, null);   // clear the declared per-pass sim-starts provider
}

/** Re-register every persisted user op — call ONCE at app start. Returns the count registered. */
export function loadUserOps() {
    let n = 0;
    for (const def of listUserOps()) { try { registerUserOp(def); n++; } catch (_) { /* skip a corrupt def */ } }
    return n;
}

/** Author a def FROM a forked block stack + binding specs (the dev-panel output). Strips ids → a stable template.
 *  `panel` is the wizard's panel-layout id (form / form3d / form2d) — view-only metadata, persisted with the def.
 *  `sim` is the DECLARED preview intent ({ showRotaryRig?, forceMachine?, showMagazine? }) — never inferred from
 *  the stack's motion; omitted = the default local-frame preview. Both are view-only metadata. */
export function userOpFromStack(opType, label, stack, bindings, panel, sim, group) {
    const t = opType.startsWith(USER_OP_PREFIX) ? opType : USER_OP_PREFIX + opType;
    const def = { opType: t, label: label || t, template: stripIds(stack), bindings: bindings || [], panel: panel || 'form3d' };
    if (sim && typeof sim === 'object') def.sim = sim;   // declared preview intent (rotary rig / machine / magazine)
    if (typeof group === 'string' && group.trim()) def.group = group.trim();
    return def;
}
