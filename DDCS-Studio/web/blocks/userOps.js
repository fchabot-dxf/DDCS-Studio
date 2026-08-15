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
import { setUserSimStarts, makeProvider, setUserSimStock } from '../viz/opSimStarts.js';
import { pruneGuards, getUserDeriveGuards, setUserDeriveGuards } from './whenGuard.js';   // ② B4 M2: collapse guarded structural forks at build; t469: inject DERIVED guard keys (pocket _tooSmall) before prune

// t554 — the DECLARED in-place status-HINT registry (a LIVE fn per op, re-attached from the seed like deriveGuards/simStartsProvider,
// since functions drop on persistence). `(resolvedParams) => string`; the generic userOpView appends it to the panel status.
const USER_STATUS_HINT = new Map();
export function setUserStatusHint(opType, fn) { if (typeof fn === 'function') USER_STATUS_HINT.set(opType, fn); else USER_STATUS_HINT.delete(opType); }
export function getUserStatusHint(opType) { return USER_STATUS_HINT.get(opType) || null; }
// t566 — the DECLARED sim-GCODE override registry (a LIVE fn per op, re-attached from the seed like statusHint). `(resolved)
// → gcode string | null`: an op whose PREVIEW motion differs from its EMIT (the ATC change's automatic methods emit a bare
// `T# M6` but the sim animates the choreography INTERPRETER's assumed path) returns the sim gcode; null → preview the emit.
const USER_SIM_GCODE = new Map();
export function setUserSimGcode(opType, fn) { if (typeof fn === 'function') USER_SIM_GCODE.set(opType, fn); else USER_SIM_GCODE.delete(opType); }
export function getUserSimGcode(opType) { return USER_SIM_GCODE.get(opType) || null; }
// t712 — the DECLARED preview-geometry registry (a LIVE fn per op, re-attached from the seed like statusHint). `(resolved
// twin params) → { paths:[{pts,cls}], handles:[canvasWidget decls] }`: a twin declares the REAL vector geometry + drag
// handles its 2D layout should render — slot's A/B/width, contour's shape size/pos PER KIND — keyed by its OWN param names
// (so it sidesteps the atom-field↔twin-param rename + contour's cross-atom position, which the atom-level hook can't). The
// generic layoutSpecFromOp renders whatever it declares (declare-not-infer, the same seam text's atom-level hook rides).
const USER_PREVIEW_GEOMETRY = new Map();
export function setUserPreviewGeometry(opType, fn) { if (typeof fn === 'function') USER_PREVIEW_GEOMETRY.set(opType, fn); else USER_PREVIEW_GEOMETRY.delete(opType); }
export function getUserPreviewGeometry(opType) { return USER_PREVIEW_GEOMETRY.get(opType) || null; }
// t1648 — the DECLARED preview-var-seed registry (a LIVE fn per op, re-attached from the seed like previewGeometry).
// `(resolved params) => [[varNum,value],...] | null`: an op seeds live-frame/controller-read registers for the
// PREVIEW TRACE only (never emitted, never pushed to the controller — wizardManager.previewVarSeed's own contract).
// Surfacing's Skim-mode start marker is the first user (jogX/jogY → #790/#791/#792).
const USER_PREVIEW_VAR_SEED = new Map();
export function setUserPreviewVarSeed(opType, fn) { if (typeof fn === 'function') USER_PREVIEW_VAR_SEED.set(opType, fn); else USER_PREVIEW_VAR_SEED.delete(opType); }
export function getUserPreviewVarSeed(opType) { return USER_PREVIEW_VAR_SEED.get(opType) || null; }
import { deriveBindings, matches } from './dataOps/deriveBindings.js';   // re-derive binding indices BY IDENTITY after prune (guarded templates shift per state); matches (t1636) — count hits without the throw, for a save-time report

const STORE_KEY = 'ddcs_user_ops';
export const USER_OP_PREFIX = 'user_';

// The LIVE def registry: opType → the registered def object (template + bindings + the LIVE fn hooks). registerUserOp is the
// single funnel every path traverses (create/update/load forks + the code data-op-twin seed), so populating it there covers
// forks AND twins by construction. Unlike listUserOps() (a localStorage JSON snapshot — functions stripped, absent in private
// mode), this returns the live def. Universal CAM (stackToSlot) reads template+bindings from here. See getUserDef below.
const USER_DEFS = new Map();
/** The LIVE registered user-op def (template + bindings + hooks) for an opType, or null. O(1); immune to localStorage gaps. */
export function getUserDef(opType) { return USER_DEFS.get(opType) || null; }

// Param value-types a binding may carry. `type` is the VALUE kind (drives marker codec + defaults); the form
// `widget` (separate, ui/formWidgets.js) is just how it's rendered. number stays the easy default.
export const BINDING_TYPES = new Set(['number', 'int', 'enum', 'bool', 'string', 'list']);   // 'list' = a structured/array value (e.g. a coordinate-list positioner) — not a scalar socket

// t1704 (cycle ACT 2) — CAN THIS PARAM ACCEPT A LIVE CONTROLLER TOKEN (`#500`) INSTEAD OF A FIXED NUMBER? Declared
// per binding, beside its other fields, FAIL-CLOSED: absence of `tokenEligible: true` means NOT eligible — a token's
// numeric value does not exist until the machine runs the program, so a param the wizard's own JS needs a real
// number FOR at generate-time (to decide the program's SHAPE: how many atoms get built, which branch runs, a
// bounding-box/placement computation) can never safely take one. Measured empirically per op (see WORK-LOG t1704
// for the full 32-op / 393-param survey), not assumed from the param's name or type:
//   tokenEligible: true      — the param's value only ever flows into ONE atom's params (to be emitted as one
//                               G-code word); nothing in the wizard's generate()/stack-builder does JS arithmetic,
//                               a comparison, or a loop/array bound with it.
//   tokenRefusal: '<text>'   — REQUIRED whenever tokenEligible is absent/false: the user-facing reason, so every
//                               surface that ever offers token entry shows the SAME explanation for the SAME param
//                               (the declaration is the one source; no surface invents its own wording). Written in
//                               the browser's own language ("the walls to probe", not "the boolean branch"), naming
//                               WHAT the value decides, not the JS mechanism.
//   tokenDeferrable: true    — optional, only meaningful beside a false/absent tokenEligible: the param IS
//                               structural today, but the JS math it feeds is simple arithmetic (add/subtract/
//                               multiply/divide of otherwise-plain values) that a DDCS macro expression could
//                               equivalently compute AT THE CONTROLLER instead of in JS — as opposed to a param
//                               that decides how MANY atoms/passes/lines get emitted or which BRANCH of code runs,
//                               which can never be deferred (the program's line count is fixed once generated).
//                               Sizes the "defer the math" design option for a future act — not itself a promise
//                               the wizard layer does that deferral today.
// SCOPE NOTE — `tokenEligible`/`tokenRefusal` answer "does the WIZARD LAYER need a resolved number at generate
// time", independent of widget type: an `enum`/`bool` binding can be declared just as truthfully as a `number` one
// (a dropdown/checkbox is STILL a categorical branch-selector at the JS layer even though it happens to render as
// one). But no `enum`/`bool` WIDGET offers a way to TYPE a token in the first place — a future UI reading this
// declaration to decide where to SHOW a token-entry affordance should gate on `type === 'number' || type ===
// 'string'` as well, not on `tokenEligible` alone; the declaration on other types stays for completeness (which
// documents WHY, if that ever changes) but isn't expected to reach a rendered field.
// NOT yet declared on every binding in the codebase — this act proved the mechanism on a representative set
// (corner, wcs, homing, surfacing) with the full registry measured and ready for the rest to inherit the same way
// corner's other mechanisms did. `deriveBindings()` (dataOps/deriveBindings.js) carries these three fields through
// its allow-list — a NEW field on a spec silently vanishes there otherwise (the exact defect class this project
// keeps finding: a declaration written, a hand-picked spread that doesn't know to carry it).

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
// t1607 — the binding's TYPE decides the value codec. NUMERIC types (number/int — and no type at all: the GUI
// param pill lands in a numeric socket, valid by construction) keep the original contract: coerce, DROP what
// isn't a number, a bare "500" self-labels as ['500', 500]. Every OTHER type (enum/string/bool/list) keeps the
// declared STRING value verbatim — "Front Left=nn" is ['Front Left','nn'] and "Follow stock datum=" keeps its
// EMPTY value (the numeric path read that as Number('') === 0 and turned a shipped twin's placement dropdown
// into one corrupted option while dropping the nine real ones). Exported so the form widget + tests share one parser.
export function parseParamOptions(str, type) {
    const numeric = type == null || type === 'number' || type === 'int';
    const out = [];
    for (const tok of String(str || '').split(/[,\n]/)) {
        const t = tok.trim();
        if (!t) continue;
        const eq = t.indexOf('=');
        const label = (eq >= 0 ? t.slice(0, eq) : t).trim();
        const raw = (eq >= 0 ? t.slice(eq + 1) : t).trim();
        if (numeric) {
            const val = Number(raw);
            if (!Number.isFinite(val)) continue;
            out.push([label || String(val), val]);
        } else {
            out.push([label || raw, raw]);
        }
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
    const s = blk.params, sim = { showRotaryRig: !!s.rotary, forceMachine: !!s.machine, showMagazine: !!s.magazine, toolMachineFrame: !!s.toolMachine, seatAtStart: !!s.seatStart, probesForWcs: !!s.probeWcs };   // t552 — toolMachine: render the live tool in RAW machine coords (homing — no stock-floor shift, t497); t570 — seatStart: seat the trace/engine initial pos at marker A (alignment) WITHOUT the machine-frame render; t1203 — probeWcs: this op probes FOR the WCS, so never render it through the declared WCS table
    return (sim.showRotaryRig || sim.forceMachine || sim.showMagazine || sim.toolMachineFrame || sim.seatAtStart || sim.probesForWcs) ? sim : null;
}

// ── def.sim.starts ⇄ `simstart` blocks (B3) — the DECLARATION round-trip (NOT the macro: a sim-start emits no line) ──
const ANCHORS = ['centre', 'edge', 'frac', 'radial', 'lathe'];   // t1301 — 'lathe': outside the BAR radius, at a Z along it
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
        else if (a === 'lathe') { row.out = numOrTok(p.out); }   // t1301 — how far OUTSIDE the bar; the Z is the plane, as a number
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

// ── def.bindingSpecs ⇄ `formfield` blocks (composable-authoring PILOT 1) — the FORM-value-field round-trip ──
// The blocks-native twin of a deriveBindings SPEC row: a `formfield` block in the PRESENTATION mouth DECLARES one wizard
// form field bound to a macro var. Mirrors simStartsFromStack/simStartsToBlocks exactly (metadata blocks, emit nothing).
// The socket link is by macro-var IDENTITY (match:{type:'assign',var}) — the F2 ruling — NOT a param-name join, so
// deriveBindings re-finds the flat index over the pruned stack (prune-safe). v1 = assign-var sockets (the value fields).

/** The `formfield` blocks in a stack → deriveBindings SPEC rows. An EMPTY dflt = socket-held (no `default` → the
 *  template's baked expression holds, deriveBindings.js:64). Widget 'number' is omitted (the default), so a hand-written
 *  spec that omits `widget` round-trips byte-identically. */
export function bindingsFromStack(children) {
    return flattenBlocks(children).filter((b) => b && b.type === 'formfield').map((b) => {
        const p = b.params || {};
        // t1640 — the DECLARED bind mode picks the match shape: 'opparam' (default '') targets an ordinary op atom
        // by its OWN type (deriveBindings' matches() already treats `{type}` alone as "the sole block of that
        // type" — zero engine changes); anything else (including an old block with no bindMode at all) keeps
        // today's 'assign' shape byte-identical.
        const match = p.bindMode === 'opparam'
            ? { type: String(p.atomType || '') }
            : { type: 'assign', var: String(p.matchvar || '#1') };
        const spec = {
            param: String(p.param || 'value'),
            type: BINDING_TYPES.has(p.type) ? p.type : 'number',
            match,
            key: String(p.key || 'value'),
        };
        if (p.dflt !== '' && p.dflt != null && Number.isFinite(Number(p.dflt))) spec.default = Number(p.dflt);   // else socket-held (no default)
        if (p.label) spec.label = String(p.label);
        if (p.help) spec.help = String(p.help);
        if (p.section) spec.section = String(p.section);
        if (p.widget && p.widget !== 'number') spec.widget = String(p.widget);   // 'number' = the default widget → omitted
        const wc = {};
        if ((p.widget === 'dropdown' || p.widget === 'segmented') && p.options) { const o = parseParamOptions(p.options, spec.type); if (o.length) wc.options = o; }   // t1607 — the declared type picks the value codec (string enums keep string values)
        if (p.widget === 'number' || p.widget === 'slider') {
            for (const [k, fk] of [['min', 'nmin'], ['max', 'nmax'], ['step', 'nstep']]) if (p[fk] !== '' && p[fk] != null && Number.isFinite(Number(p[fk]))) wc[k] = Number(p[fk]);
            if (p.units) wc.units = String(p.units);
        }
        if (Object.keys(wc).length) spec.widgetConfig = wc;
        // t1613 — the DERIVED/WRITES sockets: `derived` rides verbatim (an expr over the form's params);
        // `writes` parses one-or-more "param = expr" lines (';' or newline separated) into the declared map —
        // the same shape the shipped passes field carries, consumed by formWidgets.wireDerivedFields.
        if (p.derived != null && String(p.derived).trim() !== '') spec.derived = String(p.derived).trim();
        if (p.writes != null && String(p.writes).trim() !== '') {
            const m = {};
            for (const seg of String(p.writes).split(/[;\n]/)) {
                const eq = seg.indexOf('=');
                if (eq <= 0) continue;
                const k = seg.slice(0, eq).trim(), ex = seg.slice(eq + 1).trim();
                if (k && ex) m[k] = ex;
            }
            if (Object.keys(m).length) spec.writes = m;
        }
        if (p.optional === true || p.optional === 'true' || p.optional === 'TRUE') spec.optional = true;
        if (p.readonly === true || p.readonly === 'true' || p.readonly === 'TRUE') { spec.readonly = true; if (p.readonlyhint) spec.readonlyHint = String(p.readonlyhint); }
        if (p.whenparam) spec.when = { param: String(p.whenparam), is: p.whenis === 'true' ? true : p.whenis === 'false' ? false : String(p.whenis) };
        // t1880 — the GREY-gate's own reverse half (see bindingsToBlocks' own t1880 note: named in this file's t1756
        // comment as an example of the allow-list-drop class, but never actually wired until now).
        if (p.gate) { try { spec.gate = JSON.parse(p.gate); } catch (_) { /* malformed — drop rather than throw */ } }
        // t1756 — CARRY THE TOKEN-POLICY DECLARATION (tokenEligible/tokenRefusal/tokenDeferrable, t1704) through the
        // round-trip — the same allow-list-drop class as widgetConfig/gate/derived above (deriveBindings.js hit this
        // exact bug for its own derivation and was fixed at t1704; this is the SAME fix for the formfield-block
        // authoring round-trip, caught by formfield-block.spec.js's own lossless-round-trip test going red the
        // moment a real fixture — MIDDLE_BINDING_SPECS — carried the new fields).
        if (p.tokenEligible === true || p.tokenEligible === 'true' || p.tokenEligible === 'TRUE') spec.tokenEligible = true;
        if (p.tokenRefusal) spec.tokenRefusal = String(p.tokenRefusal);
        if (p.tokenDeferrable === true || p.tokenDeferrable === 'true' || p.tokenDeferrable === 'TRUE') spec.tokenDeferrable = true;
        return spec;
    });
}

/**
 * camFieldsFromStack — the PENDANT-FACE reader (block-native-params S1), the mirror of bindingsFromStack. Walks a def
 * template and returns the ordered `cam_field` declarations (a `cam_table`'s rows, in mouth order — flattenBlocks pre-order
 * visits a container's children in order). NOT yet consumed by the emit path / modal (that is S2/S4); S1 proves the reader.
 * Each row: { param, mode:'expose'|'bake', label?, baked?, units?, dflt?, min?, max? } — empty strings inherit the binding.
 */
export function camFieldsFromStack(template) {
    return flattenBlocks(template).filter((b) => b && b.type === 'cam_field').map((b) => {
        const p = b.params || {};
        const row = {
            param: String(p.param || ''),
            mode: p.mode === 'bake' ? 'bake' : 'expose',   // anything but 'bake' → expose (the default)
        };
        if (p.label !== '' && p.label != null) row.label = String(p.label);
        if (row.mode === 'bake' && p.baked !== '' && p.baked != null) row.baked = String(p.baked);
        if (p.units !== '' && p.units != null) row.units = String(p.units);
        if (p.dflt !== '' && p.dflt != null && Number.isFinite(Number(p.dflt))) row.dflt = Number(p.dflt);   // else inherit binding.default
        if (p.nmin !== '' && p.nmin != null && Number.isFinite(Number(p.nmin))) row.min = Number(p.nmin);
        if (p.nmax !== '' && p.nmax != null && Number.isFinite(Number(p.nmax))) row.max = Number(p.nmax);
        return row;
    });
}

/**
 * paramFieldsFromStack — the FORM-FACE reader (block-native-params S5.1), the mirror of camFieldsFromStack / bindingsFromStack.
 * Walks a def template and returns the ordered `param_field` declarations (a param_group's rows, in mouth order). NOT yet
 * consumed (the form renderer is a later slice). Each row: { param, widget, type, label?, default?, section?, help?, widgetConfig? }
 * — a form-binding-spec shape; empty strings inherit the binding.
 */
export function paramFieldsFromStack(template) {
    return flattenBlocks(template).filter((b) => b && b.type === 'param_field').map((b) => {
        const p = b.params || {};
        // t1562 — widget '' means INHERIT (the file's own "empty strings inherit the binding" convention, which every
        // OTHER field here already honours). The renderer's contract is that `widget` is OPTIONAL: resolveFormWidget
        // returns the binding's widget when set, ELSE derives one from `type` (enum→dropdown, bool→toggle, string→text).
        // Writing a literal 'number' here would DESTROY that absence — an explicit 'number' beats the type-derived
        // default — so a row that inherits must leave `widget` UNSET, not set it to the type-agnostic fallback.
        const row = { param: String(p.param || ''), type: BINDING_TYPES.has(p.type) ? String(p.type) : 'number' };
        if (p.widget !== '' && p.widget != null) row.widget = String(p.widget);
        if (p.label !== '' && p.label != null) row.label = String(p.label);
        if (p.dflt !== '' && p.dflt != null && Number.isFinite(Number(p.dflt))) row.default = Number(p.dflt);   // else inherit binding.default
        if (p.section) row.section = String(p.section);
        if (p.help) row.help = String(p.help);
        const wc = {};
        // t1562 — carry a DECLARED options list whenever one is present, not only when the widget is spelled out as
        // dropdown/segmented. An INHERITING row (widget '') on an `enum` renders as a dropdown and needs its options;
        // gating the parse on the literal widget name dropped them for exactly that case. Options are inert for a
        // number widget, so carrying them unconditionally cannot mis-render anything.
        if (p.options) { const o = parseParamOptions(p.options, row.type); if (o.length) wc.options = o; }   // t1607 — the declared type picks the value codec (string enums keep string values)
        if (p.widget === 'number' || p.widget === 'slider') {
            for (const [k, fk] of [['min', 'nmin'], ['max', 'nmax'], ['step', 'nstep']]) if (p[fk] !== '' && p[fk] != null && Number.isFinite(Number(p[fk]))) wc[k] = Number(p[fk]);
            if (p.units) wc.units = String(p.units);
        }
        if (Object.keys(wc).length) row.widgetConfig = wc;
        return row;
    });
}

/**
 * paramGroupFromBindings — the FORM materializer (block-native-params S5.1), the mirror of camTableFromBindings. A def's value
 * bindings → a param_group block, one param_field per binding in binding PRE-ORDER, label/default/widget/type from the binding
 * (NO classifier — the form shows every param; expose/bake is the pendant's concern, not the form's). PURE + INERT (nothing
 * consumes it yet). Returns null when the def has no value bindings.
 */
export function paramGroupFromBindings(def, group = 'Settings') {
    let valueBindings = ((def && def.bindings) || []).filter((b) => b && b.blockIndex != null);
    
    // t1111 (fallback) — if a wizard has no explicit blockIndex bindings (e.g., a literal twin like Pocket that uses bindingSpecs),
    // derive the initial form group from its declarative specs, deduplicating by param (to handle fan-out like originX).
    if (!valueBindings.length && def && def.bindingSpecs) {
        const seen = new Set();
        valueBindings = def.bindingSpecs.filter((s) => {
            if (!s || !s.match || !s.param || seen.has(s.param)) return false;
            seen.add(s.param);
            return true;
        });
    }
    
    if (!valueBindings.length) return null;
    const children = valueBindings.map((b) => {
        const wc = b.widgetConfig || {};
        return { type: 'param_field', params: {
            // t1562 — a binding that declares NO widget must materialize as '' (INHERIT), never as a literal 'number'.
            // `widget` is optional by the renderer's own contract (resolveFormWidget: explicit widget wins, else derive
            // from `type`), so baking the fallback here turned "unspecified, infer from type" into "explicitly a number
            // box" — which then BEAT the type-derived control. That silently flattened 13 bindings across 7 twins:
            // corner's clearMode enum, wcs's 4 axis toggles, and every string field (text's `text`, pauseConfirm's `msg`,
            // comm's 4 slots, drill/bore `skip`) became number boxes you could not type into.
            param: b.param, label: b.label || '', widget: b.widget || '', type: BINDING_TYPES.has(b.type) ? b.type : 'number',
            dflt: (b.default != null ? String(b.default) : ''), section: b.section || '', help: b.help || '',
            options: (wc.options ? wc.options.map(([l, v]) => (String(l) === String(v) ? String(v) : `${l}=${v}`)).join(', ') : ''),
            nmin: (wc.min != null ? String(wc.min) : ''), nmax: (wc.max != null ? String(wc.max) : ''), nstep: (wc.step != null ? String(wc.step) : ''),
            units: wc.units || b.units || '',
        } };
    });
    return { type: 'param_group', params: { group }, children };
}

/**
 * block-native-params S5.3 — materialize a param_group INTO a def (the FORM analog of materializeCamTable). Injects
 * paramGroupFromBindings into the user_root PRESENTATION mouth and re-derives EVERY binding blockIndex BY IDENTITY over the
 * post-injection flatten (the wrapForkAtSave pattern; a blanket shift would corrupt a uiChildren binding). Mutates `def` in
 * place; idempotent (no-op if the def has no value bindings or already carries a param_group). COMPOSES with materializeCamTable:
 * each runs its own identity re-derive over the CURRENT flatten, so running both sequentially re-indexes correctly across the
 * combined injection. BYTE-NEUTRAL by construction: param_field emits [] + param_group is transparent, and formBindings
 * consuming it reproduces today's form (order/label/widget/default, and canvas group/role which it re-derives from the binding).
 * PURE — the caller (the S5.3 hook) decides when. Returns def.
 */
export function materializeParamGroup(def) {
    if (!def || !Array.isArray(def.template)) return def;
    const root = def.template.find((b) => b && b.type === 'user_root');
    if (!root) return def;
    const existing = flattenBlocks(def.template).find((b) => b && b.type === 'param_group');
    if (existing && existing.children && existing.children.length > 0) return def;   // already has a populated one — idempotent

    const pg = paramGroupFromBindings(def);
    if (!pg) return def;   // no value bindings — nothing to declare
    
    const flatBefore = flattenBlocks(def.template);
    
    if (existing) {
        existing.children = pg.children;
    } else {
        root.uiChildren = [pg, ...(root.uiChildren || [])];
    }
    
    const flatAfter = flattenBlocks(def.template);
    /**
     * t1632 — the remap writes COPIES, never the caller's binding OBJECTS. The old in-place `b.blockIndex = ni`
     * reached through shared references: a data-op module's exported bindings (drillData's DRILL_BINDINGS et al.)
     * are spread into each def, so the BOOT registration's remap (+the materialized row count) corrupted every
     * LATER consumer of the same objects — a fresh `drillDataDef()` instantiated with pristine-template indexes
     * against +34-shifted bindings landed its params NOWHERE and emitted defaults (the whole deterministic red
     * tail this fix retires), and a re-register/reseed would have compounded the shift onto the APP's own twin.
     * The registered def stays exactly as coherent as before (template + its OWN remapped copies).
     */
    if (Array.isArray(def.bindings)) {
        def.bindings = def.bindings.map((b) => {
            if (!b || b.blockIndex == null) return b;
            const ref = flatBefore[b.blockIndex]; const ni = ref ? flatAfter.indexOf(ref) : -1;   // BY IDENTITY
            return ni >= 0 ? { ...b, blockIndex: ni } : b;
        });
    }
    return def;
}

/** deriveBindings SPEC rows → `formfield` block records (every field set, so recToJson's fields/dropdowns stay valid).
 *  The reverse of bindingsFromStack — renders a hand-written spec set (corner/edge/middle's *_BINDING_SPECS) AS blocks in
 *  the Blockly view so a ported wizard is authorable/re-authorable. Only VALUE specs (a `match` — a value socket); a
 *  structural binding (no match) is a later slice. */
export function bindingsToBlocks(specs) {
    const wcStr = (wc) => (wc && wc.options ? wc.options.map(([l, v]) => (String(l) === String(v) ? String(v) : `${l}=${v}`)).join(', ') : '');
    return (specs || []).filter((s) => s && s.match).map((s) => {
        const wc = s.widgetConfig || {};
        const w = s.when || null;
        // t1640 — the inverse of bindingsFromStack's mode split: a spec whose match names a `var` renders as an
        // Assign Var block (today's shape, byte-identical); a spec matching by `type` alone (no `var` — the shape
        // every op-atom-bound twin spec already uses, e.g. surfacingData's `match:{type:'surfaceraster'}`) renders
        // as an Op Param block instead of the misleading `matchvar:'#1'` fallback it would otherwise get.
        const isOpParam = s.match && !('var' in s.match);
        return { type: 'formfield', params: {
            param: s.param, widget: s.widget || 'number', label: s.label || '',
            dflt: s.default === undefined ? '' : String(s.default),
            bindMode: isOpParam ? 'opparam' : 'assign',
            matchvar: isOpParam ? '#1' : String((s.match && s.match.var) || '#1'),
            atomType: isOpParam ? String((s.match && s.match.type) || '') : '',
            key: s.key || 'value', type: s.type || 'number',
            section: s.section || '', help: s.help || '',
            optional: !!s.optional, readonly: !!s.readonly, readonlyhint: s.readonlyHint || '',
            whenparam: w ? String(w.param) : '', whenis: w ? String(w.is) : '',
            options: wcStr(wc),
            nmin: wc.min != null ? String(wc.min) : '', nmax: wc.max != null ? String(wc.max) : '',
            nstep: wc.step != null ? String(wc.step) : '', units: wc.units || '',
            // t1756 — the reverse half of the token-policy carry-through (see bindingsFromStack's own t1756 note).
            tokenEligible: !!s.tokenEligible, tokenRefusal: s.tokenRefusal || '', tokenDeferrable: !!s.tokenDeferrable,
            // t1880 — the GREY-gate (`data-gate`, distinct from `when`'s hide/show), same allow-list-drop class as
            // widgetConfig/derived/writes above — named in bindingsFromStack's own t1756 comment but never actually
            // wired until formfield-block.spec.js's own lossless round-trip went red the moment a real fixture
            // (MIDDLE_BINDING_SPECS, this turn's probePort gate) carried a `gate` property. JSON round-trip, same
            // shape as `when`'s own reconstruction below, robust to the tip string's own punctuation.
            gate: s.gate ? JSON.stringify(s.gate) : '',
        } };
    });
}

// ── def.bindings (group/role/anchor) ⇄ `layoutwidget` blocks (composable-authoring PILOT 2) — the GUI point-pick ──
// A `layoutwidget` block DECLARES a canvas handle bound to params. v1 = POINT-PICK: it EXPANDS to two SOCKET-LESS
// bindings {param, group, role:'x'/'y', anchor:{kind,frame}} — form + canvas only (no match/blockIndex → no emit, so
// sim/form-only, byte-identical). layoutSpecFromOp's x+y→`point` derivation renders the draggable handle; the drag
// writes fx/fy (world coords). anchor:{kind:'point', frame:'stock-min'} = an absolute PHYSICAL point (ax=0).

/** The `layoutwidget` blocks in a stack → SOCKET-LESS layout bindings (the group/role/anchor a handle needs). */
export function layoutBindingsFromStack(children) {
    const out = []; let n = 0;
    for (const b of flattenBlocks(children)) {
        if (!b || b.type !== 'layoutwidget') continue;
        const p = b.params || {};
        const anchor = { kind: 'point', frame: p.frame === 'datum' ? 'datum' : 'stock-min' };   // v1: point only
        const gid = 'lw' + (++n);
        const xv = Number(p.xval), yv = Number(p.yval);
        out.push({ param: String(p.fx || 'x'), type: 'number', default: Number.isFinite(xv) ? xv : 0, group: gid, role: 'x', anchor });
        out.push({ param: String(p.fy || 'y'), type: 'number', default: Number.isFinite(yv) ? yv : 0, group: gid, role: 'y', anchor });
    }
    return out;
}

/** SOCKET-LESS layout bindings → `layoutwidget` block records (the reverse — re-authorable). Pairs each group's x/y. */
export function layoutBindingsToBlocks(bindings) {
    const byGroup = {};
    for (const b of (bindings || [])) if (b && b.group && b.anchor && (b.role === 'x' || b.role === 'y')) (byGroup[b.group] = byGroup[b.group] || {})[b.role] = b;
    const out = [];
    for (const g in byGroup) {
        const x = byGroup[g].x, y = byGroup[g].y;
        if (!x || !y) continue;
        out.push({ type: 'layoutwidget', params: {
            fx: x.param, fy: y.param,
            anchor: (x.anchor && x.anchor.kind) || 'point', frame: (x.anchor && x.anchor.frame) || 'stock-min',
            xval: x.default != null ? String(x.default) : '', yval: y.default != null ? String(y.default) : '', label: 'pt',
        } });
    }
    return out;
}

/** The LIVE-form extra bindings a stack's authoring blocks declare — formfield VALUE fields + layoutwidget GUI handles.
 *  For devMode.deriveAuthoredDef so a field/handle shows in the form AS YOU AUTHOR IT. Safe (skips on a bad match). */
export function authoredExtraBindings(children) {
    return [...formfieldBindings(children), ...layoutBindingsFromStack(children)];
}

/** If the template AUTHORS its bindings as `formfield` (value) / `layoutwidget` (GUI) blocks, derive them. Mirrors
 *  resolvePanelMeta/resolveSimMeta: ADDITIVE — returns null when there are NONE, so a hand-written-spec def (today's
 *  corner/edge/middle) is UNTOUCHED / byte-identical. Returns { specs, bindings } — specs drive the emit re-derivation
 *  (def.bindingSpecs), bindings drive the form + schema (deriveBindings over the template) + the GUI (group/role/anchor). */
function resolveBindingsMeta(def) {
    const template = def && Array.isArray(def.template) ? def.template : [];
    const specs = bindingsFromStack(template);
    const layout = layoutBindingsFromStack(template);
    if (!specs.length && !layout.length) return null;   // no authoring blocks → keep hand-written def.bindings/bindingSpecs (byte-identical)
    // v1: derive over the UNPRUNED template (an authored op carries no guards yet — a guarded authored op is a later slice).
    const valueBindings = specs.length ? deriveBindings(flattenBlocks(template), specs) : [];
    return { specs, bindings: [...valueBindings, ...layout] };
}

/** The FORM bindings a stack's `formfield` blocks declare (specs → deriveBindings over the stack). For the LIVE Blocks
 *  form (devMode.deriveAuthoredDef): a formfield-authored field shows in the form AS YOU AUTHOR IT. Safe — returns [] on
 *  an unmatched var (an in-progress edit) instead of throwing. */
export function formfieldBindings(children) {
    const specs = bindingsFromStack(children);
    if (!specs.length) return [];
    try { return deriveBindings(flattenBlocks(children), specs); } catch (_) { return []; }
}

/** t1636 — WHICH declared `formfield` specs a stack's blocks actually satisfy, and which do not. Never throws
 *  (uses `matches` directly, not `deriveBindings`, so ONE dangling spec doesn't hide the rest — deriveBindings
 *  aborts on the FIRST mismatch it finds). A NON-optional spec with anything but exactly 1 hit is unmatched; an
 *  optional spec with 0 hits is a legitimate prune-gated absence, not a defect. Consumed by the save-time guard
 *  (devMode.saveAsCustomOp) so "0 matched, saved silently as a parameterless wizard" — the shipped defect class,
 *  the reason formfieldBindings' own silent catch-and-[] shipped unnoticed — is reported instead of hidden. */
export function formfieldMatchReport(children) {
    const specs = bindingsFromStack(children);
    const flat = flattenBlocks(children);
    const unmatched = [];
    for (const s of specs) {
        const hits = flat.filter((b) => matches(b, s.match)).length;
        if (hits === 1) continue;
        if (hits === 0 && s.optional) continue;   // a prune-gated socket genuinely absent in this structural state
        // t1640 — a human-readable target descriptor covering BOTH bind modes (mirrors deriveBindings' own `how`
        // message): an assign match names its var, an op-param match names the atom type + the socket key. `hits`
        // itself already tells the two failure shapes apart (0 = dangling, >1 = ambiguous — an authoring error
        // either way, per deriveBindings' own "need exactly 1" rule).
        const target = ('var' in s.match) ? `Match Var ${s.match.var}` : `Op Param ${s.match.type || '—'}.${s.key}`;
        unmatched.push({ param: s.param, matchvar: (s.match && s.match.var) || '', target, hits });
    }
    return { total: specs.length, matched: specs.length - unmatched.length, unmatched };
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
/**
 * t1315 — THE LIVE-DEFAULT REGISTRY: a binding says `defaultLive: '<key>'` and this says what that key resolves to.
 * Registered at module load by whoever owns the fact (data/lathe declares the bar one), so a def stays plain JSON.
 */
const LIVE_DEFAULTS = new Map();
export function registerLiveDefault(key, fn) { if (key && typeof fn === 'function') LIVE_DEFAULTS.set(String(key), fn); }
export const liveDefaultKeys = () => [...LIVE_DEFAULTS.keys()];

export function defaultParams(def) {
    const p = {};
    for (const b of (def.bindings || [])) {
        // t1315 — A DEFAULT MAY BE LIVE, and it is DECLARED BY NAME. Most defaults are a baked number; some describe
        // something the WORKSPACE already knows — the bar in the chuck being the case that forced it, since an op's
        // own default silently outranked the stock the user had declared. `defaultLive: '<key>'` names a registered
        // resolver, asked at form-open time, so the field PREFILLS with the live fact and the operator sees the
        // number their program will carry ([[twin-default-mirrors-form-not-fallback]]).
        //
        // A NAME AND NOT A FUNCTION, because a def is PERSISTED AS JSON: a function default vanishes the moment the
        // op is stored and re-read, which is exactly what happened when this was first written that way — the fresh
        // def prefilled and the registered one did not.
        const live = b.defaultLive ? LIVE_DEFAULTS.get(b.defaultLive) : null;
        if (live) { try { const v = live(def, b); p[b.param] = (v === undefined || v === null) ? b.default : v; } catch (_) { p[b.param] = b.default; } }
        else p[b.param] = b.default;
    }
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
export function instantiate(def, params) {
    // ② B4 step 4b — fill STRUCTURAL binding defaults (guard-driving params with no block socket: bool probeZFirst, enum
    // travelApproach) for any absent param BEFORE prune. A bool guard tolerates undefined (whenOk coerces !!undefined=false),
    // but an ENUM guard needs the value (undefined === 'auto' is false → the arm would drop). Value bindings are untouched
    // (their absence is handled per-binding below). A legacy def (no structural bindings) → this is a no-op → byte-identical.
    // t1363 — THE ONE DECLARED NORMALIZATION, at the single point params enter a build. A def may declare
    // `normalizeParams(params)` to fold a stored value into the sockets it is actually bound to, BEFORE any binding
    // reads it. Surfacing is the case that forced it: an op stored before the stepover split carries a flat `stepover`
    // millimetre, and the twin binds `stepoverPct` — so the stored millimetre reached no socket at all and the binding
    // default quietly cut a different raster than the saved op did, while the wizard stack and the CAM seed both
    // recovered it correctly. Two paths reading one stored value differently is the split the parametric switch exists
    // to kill, so the recovery happens ONCE, here, for every path that builds through a def.
    // A def with no hook is untouched → byte-identical for every existing user op.
    const { clone, flat, bindings, p } = resolveArm(def, params);
    for (const b of bindings) {
        const blk = flat[b.blockIndex];
        if (blk && blk.params && (b.key in blk.params)) {
            blk.params[b.key] = (p && b.param in p) ? p[b.param] : b.default;
        }
    }
    return clone;
}

/**
 * t1410 — THE ARM A GIVEN PARAMS SET WILL BUILD: the prune + the binding re-derivation, extracted from `instantiate`
 * so a SECOND reader can ask the same question and get the same answer.
 *
 * The reader that forced it is `exposeClassifier`. It classifies a def's knobs against `def.template` — the guarded
 * SUPERSET — and its own comment records why it then refuses to classify a guarded def at all: the frozen blockIndex
 * is computed over a canonical-pruned stack, so `flat[blockIndex]` MISALIGNS against the superset and could misread
 * fold-membership in the dangerous direction. It fails closed ("expose NOTHING") and names the fix in the same breath:
 * *"until this classifier mirrors that prune"*. This is that mirror, and it is an EXTRACTION rather than a second
 * implementation on purpose — a classifier that re-derived the arm could drift from the arm actually built, which is
 * precisely the class of split this whole arc exists to remove.
 *
 * Returns the pruned clone, its flatten, the bindings resolved against it, and the guard-defaulted params.
 */
export function resolveArm(def, params) {
    // t1363 — the ONE declared normalization, at the single point params enter a build (see instantiate's note).
    const normalized = (typeof def.normalizeParams === 'function' && params) ? def.normalizeParams(params) : params;
    const p = withGuardDefaults(def, normalized);
    const clone = JSON.parse(JSON.stringify(def.template || []));
    // t469 — inject DERIVED guard keys (e.g. pocket's `_tooSmall`, computed from the geometry) so a guard can key on a value
    // that is NOT any single user param. ONE-SOURCE: the derive lives on the def (registered via setUserDeriveGuards), run
    // once here, added to the prune params only. No hook → pruneGuards(clone, p) exactly as before (byte-identical).
    // t1410 — the derive hook is read from the REGISTRY first (as it always was) and from the def as a fallback, so a
    // def that has been built but not yet registered — exactly what a classifier or a preview holds — still resolves
    // its own derived guards instead of silently pruning to the wrong arm.
    const derive = getUserDeriveGuards(def.opType) || (typeof def.deriveGuards === 'function' ? def.deriveGuards : null);
    pruneGuards(clone, derive ? { ...p, ...derive(p) } : p);
    const flat = flattenBlocks(clone);
    const bindings = def.bindingSpecs ? deriveBindings(flat, def.bindingSpecs) : (def.bindings || []);
    return { clone, flat, bindings, p };
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
    // ── t1593 — A FORK MUST NOT COME BACK WITH FEWER FORK ARMS THAN ITS SOURCE ────────────────────────────────────
    //
    // A `guard` holds ONE arm of a structural fork and is UNWRAPPED or DROPPED at build (whenGuard.pruneGuards) — it
    // is what makes a structural toggle re-authorable data instead of JS-locked structure. The Blockly bridge had no
    // mouth for it, so `recToJson` wrote a guard CHILDLESS and every arm inside it was discarded on render: Corner
    // handed the canvas 1157 blocks and got 98 back, 371 guards down to 30, and the reproject wrote that into the
    // live program. Fourteen twins could not be forked; t1595 taught the canvas to render a guard and they all can.
    //
    // ⚠ THIS CHECK STAYS, AND IS EXPECTED TO BE SILENT. It is what noticed the loss in the first place, and it is
    // data-driven — it compares arm blocks, not a list of known-bad wizards — so it is exactly what would catch the
    // canvas losing arms again for a new reason. fork-parity-1593 asserts it never fires, which is how we know the
    // silence is real rather than the check having quietly stopped working. SCOPED to forks (`forkedFrom`).
    if (def && def.forkedFrom) {
        const src = USER_DEFS.get(def.forkedFrom);
        // COUNT THE ARMS, NOT THE GUARDS. A guard survived the old canvas as a CHILDLESS block, so counting guards
        // missed exactly the twins whose forks came back with every guard present and every arm inside them gone
        // (measured: atc test/change/table, rotary clock, homing). What the arms ARE is the blocks a guard contains.
        const armBlocks = (t) => flattenBlocks(t || []).reduce((n, b) => n + ((b && b.type === 'guard' && b.children) ? flattenBlocks(b.children).length : 0), 0);
        const want = src ? armBlocks(src.template) : 0, got = armBlocks(def.template);
        if (want && got < want) {
            errs.push(`“${(src && src.label) || def.forkedFrom}” builds ${want} blocks across its structural fork arms and this copy `
                + `came back with ${got} — the copy would keep only one arm and emit a different program. `
                + 'Re-open the wizard in Blocks and save again; if it keeps happening, edit it at its source.');
        } else if (Array.isArray(def.bindingSpecs) && def.bindingSpecs.length) {
            // The general backstop: a spec resolves BY IDENTITY against the stack it is asked about, so a copy whose
            // template lacks a socket its specs name registers happily and THROWS the first time anything builds it.
            try { instantiate(def, defaultParams(def)); }
            catch (e) { errs.push(`this copy of “${def.forkedFrom}” cannot carry that wizard's parameters — ${(e && e.message) || e}`); }
        }
    }
    return errs;
}

/** Install a user-op def into the LIVE user-layer builder + spec + label registries (runtime only — no persistence). */
/**
 * THE CODE HOOKS A `.wiz` CANNOT CARRY (t1275 — the advisor's ruling on the wizard-file gate; generalized t1682).
 *
 * A wizard file is DATA: template, bindings, panel, sim, group, defV. A def's BEHAVIOUR hooks are functions, and a
 * function cannot be written to a file — so a twin exported and re-imported used to come back quietly missing them
 * (OD turning's straight-turn restore; every guarded twin's derive-guards). The ruling: the format stays data, and
 * on import an opType THIS APP ALREADY KNOWS gets its LOCAL hooks re-attached — behaviour from the app version, data
 * from the file. A foreign opType has no local behaviour to restore, and the import SAYS SO rather than losing it
 * silently (the file names which hooks its author had; see wizardToFile).
 *
 * t1682 — a HAND-MAINTAINED name list (`OP_CODE_HOOKS`) used to gate which properties counted as "a hook" here, and
 * went stale exactly the way `KNOWN_LEAF_RECORD_FIELDS` almost did (t1654): 7 real, live, generically-read hooks
 * (`zRuler`/`entryPoint`/`simStartParams`/`armGap`/`simStock`/`latheTool`/`latheProbeAxis`) were added to individual
 * `*_data.js` files over time and never added to the list, so forking any of the 11+ ops that set one silently
 * dropped it — byte-correct emit, clean console, a piece of the UI just missing.
 *
 * TRIED "any function on def is a hook" first — wrong: `zRuler`/`entryPoint`/`simStartParams`/`latheTool`/
 * `latheProbeAxis` are all plain, JSON-safe DATA (`{depthParam,stepParam}`, `{x:'entryX',y:'entryY'}`, an array of
 * plain objects) — only `armGap`/`simStock` are actually functions. A function-only filter genuinely missed 5 of 7
 * (caught live: a probe def carrying a plain-object `zRuler` came back through the fork path as `undefined`).
 *
 * The rule that actually holds: `userOpFromStack` (the ONE def constructor) owns a small, stable BASE shape —
 * `opType/label/template/bindings/panel/sim/group` — and `registerUserOp` + its callers add a small, equally stable
 * set of LIFECYCLE bookkeeping (`layout`/`bindingSpecs`/`hooksReattached`/`defV`/`savedAt`/`forkedFrom` —
 * registration/versioning/provenance, not per-feature behaviour). ANYTHING ELSE ever found on a def — function or
 * not — is a hook, because nothing else ever puts anything else there (checked: no exceptions found). So the base
 * shape is DERIVED (one real call to `userOpFromStack`, not restated as a second list that can drift from the
 * first), and only the small lifecycle set is still named — it changes when the REGISTRATION architecture changes,
 * not every time an op grows a new declared behaviour, which is the actual, much faster-moving thing that kept
 * going stale. A new hook — function or plain data — needs no list update; it is carried the moment it is declared. */
const _BASE_DEF_SHAPE = new Set(Object.keys(userOpFromStack('__probe__', 'probe', [], [], 'form3d', { probe: true }, 'probe')));
const _LIFECYCLE_KEYS = new Set(['layout', 'bindingSpecs', 'hooksReattached', 'defV', 'savedAt', 'forkedFrom']);
const isHookKey = (k) => !_BASE_DEF_SHAPE.has(k) && !_LIFECYCLE_KEYS.has(k);
/** Every hook-shaped key a LIVE def object actually carries right now (function or plain data) — the same test
 *  `reconcileCodeHooks` uses, exported so a caller (fork-parity-1593's own "the copy runs the source's hooks"
 *  claim) can compare two live defs generically instead of restating a name list of its own — the exact shape
 *  of stale list this turn exists to retire. */
export const hookKeysOf = (def) => Object.keys(def || {}).filter(isHookKey);
const LOCAL_HOOKS = new Map();   // opType → { hookName: value } — survives deleteUserOp, because the APP still knows it

/** Which code hooks this app has for `opType` (empty = it is a stranger here). */
export const localHooksFor = (opType) => Object.keys(LOCAL_HOOKS.get(opType) || {});

/** Remember a def's own hooks; give a def that arrived without them the local ones. Returns the names re-attached.
 *  t1593 — …and a FORK names its source (`forkedFrom`), so it gets the SOURCE's hooks. Same rule one step out:
 *  behaviour from the app, data from the def. Without this the copy of a hooked twin loses its emit corrections —
 *  corner's header comments freeze at the defaults, a guarded twin loses the derived guard keys its prune reads — and
 *  the fork emits a DIFFERENT program from the wizard it was forked from, which is the one thing a fork must not do.
 *  t1682 — carries EVERY hook shape uniformly now, plain data included, not just the function-valued ones: a plain-
 *  data hook (zRuler) is JSON-safe and could in principle survive a `copy()`-style clone on its own, but devMode's
 *  Blocks-tab "Customize" fork route never attempts that clone — it builds a brand-new def from `userOpFromStack`
 *  and copies only `bindingSpecs`+`forkedFrom` by hand — so plain-data hooks need the SAME LOCAL_HOOKS re-attachment
 *  the function-valued ones (`armGap`/`simStock`) already required, or they are lost on that route regardless of
 *  their own JSON-safety. One mechanism, one re-attachment path, for every hook shape.
 *  t1682 — the "has any hook → skip reattach entirely" early return (still visible in git history) held only while
 *  every hook was function-shaped: a `.wiz` FILE export/import round-trip is JSON, so an imported def could only
 *  ever arrive with ALL its function hooks (never, since JSON strips functions) or NONE — never some. Plain-data
 *  hooks broke that assumption: `latheTool` is explicitly exported as data (wizardLibrary's wizardToFile) and
 *  SURVIVES import, so an imported lathe def now arrives with latheTool present but postInstantiate genuinely
 *  missing — a MIXED case the old binary branch never anticipated, silently skipping reattachment of the missing
 *  function hook because the def "already had a hook" (caught live: lathe-odturn-1273's own .wiz-gate spec, which
 *  round-trips exactly this op through export→wipe→import and asserts postInstantiate comes back). Fixed by
 *  merging rather than branching: always remember whatever hooks a def DOES carry, then fill in only the ones it's
 *  missing from what's known — the function ones on an import, everything on a fork, nothing on a fresh register. */
function reconcileCodeHooks(def) {
    const mine = {}, reattached = [];
    for (const k in def) if (isHookKey(k)) mine[k] = def[k];
    if (Object.keys(mine).length) LOCAL_HOOKS.set(def.opType, { ...(LOCAL_HOOKS.get(def.opType) || {}), ...mine });
    const known = LOCAL_HOOKS.get(def.opType) || (def.forkedFrom ? LOCAL_HOOKS.get(def.forkedFrom) : null);
    if (known) for (const k in known) if (!(k in mine)) { def[k] = known[k]; reattached.push(k); }
    return reattached;
}

export function registerUserOp(def) {
    // composable-authoring (PILOT 1): if the template AUTHORS its value bindings as `formfield` blocks, derive
    // def.bindingSpecs (the emit re-derivation, by var-identity) + def.bindings (the form + schema) FROM them. ADDITIVE —
    // resolveBindingsMeta returns null when there are no formfield blocks, so a hand-written-spec def (today's
    // corner/edge/middle) is UNTOUCHED / byte-identical. Applied before validate so the derived bindings are validated + used.
    def.hooksReattached = reconcileCodeHooks(def);   // behaviour from the app version, data from the file
    const authored = resolveBindingsMeta(def);
    if (authored) {
        if (authored.specs.length) def.bindingSpecs = authored.specs;   // value fields → emit re-derivation (a layout-only op sets none)
        const structural = (def.bindings || []).filter((b) => b && b.param != null && b.blockIndex == null && !b.group);   // preserve hand-written STRUCTURAL toggles (NOT the layout group bindings)
        def.bindings = [...authored.bindings, ...structural];
    }
    // t1111 (S5.3) — dynamically materialize the param_group at registration so built-in wizards
    // don't present an empty form when their op block is reconstructed in the Blocks tab. MUST run
    // before validateUserOp (t1565): materialize is what adds the param_group's param_field blocks
    // into def.template and re-derives each binding's blockIndex to point at them — validating first
    // checks binding.blockIndex against a template that doesn't have those blocks yet, so every
    // materialized def failed with "binding (block N.x) does not resolve in the template".
    materializeParamGroup(def);

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
    setUserSimStock(def.opType, def.simStock);   // t417 E3 — a DECLARED per-op sim-stock (rotary round bar); a LIVE fn (re-attached from the seed, like simStartsProvider)
    setUserDeriveGuards(def.opType, def.deriveGuards);   // t469 — a DECLARED derive-guards hook (pocket _tooSmall from geometry); a LIVE fn (re-attached from the seed), injected before prune
    setUserStatusHint(def.opType, def.statusHint);   // t554 — a DECLARED in-place status HINT (homing's unset-travel warning); a LIVE fn (re-attached from the seed, like the others)
    setUserSimGcode(def.opType, def.simGcode);   // t566 — a DECLARED sim-gcode override (the ATC change choreography); a LIVE fn (re-attached from the seed, like the others)
    setUserPreviewGeometry(def.opType, def.previewGeometry);   // t712 — a DECLARED preview-geometry hook (slot/contour per-feature 2D handles); a LIVE fn (re-attached from the seed, like the others)
    setUserPreviewVarSeed(def.opType, def.previewVarSeed);   // t1648 — a DECLARED preview-only var-seed hook (Surfacing Skim's #790-792); a LIVE fn (re-attached from the seed, like the others)
    USER_DEFS.set(def.opType, def);   // the LIVE def registry (Universal CAM reads template+bindings here); overwrite on re-author/re-seed
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

/** The declared per-def version stamp (N1) for an op: a registered USER def's `defV` (author-declared for
 *  data-maintained defs, auto-incremented on updateUserOp for plain re-authors), or 0 for a non-user/built-in op
 *  (unversioned — never goes stale). Read by serializeWithMarkers (stamp) + the import staleness check (defVOf(cur)
 *  vs the marker's stamped defV). A found def with no explicit defV → 1 (a legacy stored def is treated as v1). */
export function defVOf(opType) {
    const d = readStore().find((x) => x.opType === opType);
    return d ? (Number(d.defV) || 1) : 0;
}

/** The ONE staleness rule for a stamped def-version (t1079): a stamp is STALE when the op IS versioned (`currentV > 0`)
 *  and the stamp is BEHIND it. An unversioned / built-in op (defVOf 0) never flags; a stamp of 0 is a legacy pre-stamp
 *  record and counts as behind. Read by BOTH consumers of a defV stamp — the import transparency check
 *  (programModel.staleMarkedOps, marker.defV) and the CAM sub-stack boundary (subStackToSlot, opunit.params.defV) —
 *  so "what counts as stale" can never drift between them. */
export const defVStale = (stampedV, currentV) => Number(currentV) > 0 && (Number(stampedV) || 0) < Number(currentV);

/** Validate → register → persist a new user op. Throws if invalid or the opType already exists. */
export function createUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const defs = readStore();
    if (defs.some((d) => d.opType === def.opType)) throw new Error(`user op "${def.opType}" already exists`);
    if (def.defV == null) def.defV = 1;                          // N1 — a fresh def starts at version 1 (the stamp)
    // t1617 — WHEN it was saved, declared on the def (the manager's date column reads this, never a file mtime).
    // CONDITIONAL: an imported .wizard carries its own savedAt, and re-stamping it would make the round trip lie.
    if (def.savedAt == null) def.savedAt = new Date().toISOString();
    registerUserOp(def);                                         // only now install into the live user-layer builder/spec/label
    defs.push(def);
    writeStore(defs);
    return def;
}

// S4-3 — a decoupled signal that a user-op def CHANGED (defV may have bumped). Consumers that hold placed references to
// the op — e.g. a CAM slot built from it — listen for this to rebuild themselves from the NEW def (the def is the one
// source; no reverse converter). Fired AFTER the store write so a listener re-reads the fresh def. No-op off-browser.
function notifyUserOpChanged(opType) {
    try { if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('ddcs:userops-changed', { detail: { opType } })); } catch (_) { /* non-browser */ }
}

/** Replace an existing user op's def IN PLACE (re-register + persist), keeping its opType identity. The re-author
 *  flow uses this so editing a saved wizard updates it instead of spawning a duplicate. Falls back to create. */
export function updateUserOp(def) {
    const errs = validateUserOp(def);
    if (errs.length) throw new Error('invalid user op: ' + errs.join('; '));
    const defs = readStore();
    const i = defs.findIndex((d) => d.opType === def.opType);
    if (i < 0) return createUserOp(def);
    // N1 version stamp: a def that DECLARES its defV (a code seed / author-maintained, e.g. corner — the seed loop
    // sets a floor of 1) is respected as-is; an UNDECLARED incoming def (a dev-save re-author via userOpFromStack,
    // which sets no defV) bumps PAST the stored version — its placed instances are now stale (the def-change→rebuild
    // signal). NEVER a body-hash (declare, don't infer). Seeds never hit this (they arrive declared → no boot-bump).
    if (def.defV == null) def.defV = (Number(defs[i].defV) || 1) + 1;
    // t1617→t1621 — savedAt follows defV's OWN rule: a caller that DECLARES it (the manager's rename, devMode's
    // explicit Update — acts that mean "the user saved this") is respected; an undeclared incoming def KEEPS the
    // stored stamp. It was an unconditional restamp for one turn, and that was a RELEASE-BLOCKING regression:
    // seedDefaultPortedUserOps() runs this for every twin on EVERY BOOT, so the store's bytes churned on every
    // reload and a saved workspace woke up dirty (persistence-file-indicator:116 caught it).
    if (def.savedAt == null) def.savedAt = (defs[i].savedAt != null) ? defs[i].savedAt : new Date().toISOString();
    registerUserOp(def);            // overwrite the live user-layer builder/spec/label
    defs[i] = def;
    writeStore(defs);
    notifyUserOpChanged(def.opType);   // S4-3 — a slot built from this op is now defVStale → it rebuilds from the new def
    return def;
}

/** Remove a user op from the registry + persistence (and the live user-layer builder/spec/label entries). */
export function deleteUserOp(opType) {
    writeStore(readStore().filter((d) => d.opType !== opType));
    USER_DEFS.delete(opType);         // clear the live def registry entry (register touches N tables — delete must clear them all)
    unregisterUserBuilder(opType);
    unregisterUserSpec(opType);
    removeOpLabel(opType);            // register touches 4 tables — delete must clear all 4 (was leaking OP_LABELS)
    setUserSimIntent(opType, null);   // clear the declared preview intent
    setUserStatusHint(opType, null);   // t554 — clear the declared status hint
    setUserSimStarts(opType, null);   // clear the declared per-pass sim-starts provider
    setUserSimStock(opType, null);    // t417 E3 — clear the declared per-op sim-stock
}

/** Re-register every persisted user op — call ONCE at app start. Returns the count registered. */
export function loadUserOps() {
    let n = 0;
    for (const def of listUserOps()) { try { registerUserOp(def); n++; } catch (_) { /* skip a corrupt def */ } }
    return n;
}

/**
 * ── t1593 — A FORK INHERITS ITS SOURCE'S DECLARATIONS ──────────────────────────────────────────────────────────
 *
 * Saving a built-in as custom is the ONLY path by which a shipped wizard becomes editable, and it produced an EMPTY
 * SHELL: measured across the whole registry, 32 twins, 549 declared bindings, ZERO recovered by a fork. Corner, end
 * to end: 23 declared form fields → 0 in the copy, 13 off-defaults set → 0 surviving.
 *
 * ⚠ THE CAUSE IS t1562'S ONE LAYER UP — A DERIVED VIEW READ INSTEAD OF THE DECLARED TRUTH. The save path builds the
 * copy's bindings from `extractParamBlocks`, the param-PILL extractor, and not one shipped twin has a pill in its
 * template: they declare their bindings literally or as `bindingSpecs`. So the extractor returns [] for all 32 and
 * the copy registers with nothing — no fields, no values, nothing to keep. It hid because the source scopes the
 * limit to MATERIALISATION ("PILL-derivable only", "a pre-existing no-pill save limitation"); nobody had asked what
 * it did to a FORK.
 *
 * The declarations are on the source def the whole time. Reading them takes one care — the blockIndex:
 *
 *   bindingSpecs def         bindings + specs ride VERBATIM. A spec matches its socket by macro-var IDENTITY, so
 *   (corner/edge/middle/…)   `resolveArm` re-derives every index over the fork's OWN pruned stack at each build —
 *                            the frozen blockIndex is inert for these defs (validateUserOp skips it too).
 *   structural-only          no blockIndex to map (a structural binding drives the prune, not a socket) — VERBATIM.
 *   (atc test/change/table,
 *    io_step, homing, comm)
 *   value bindings, no       the fork inserts ONE `opunit` and nothing else moves, so each index is remapped by
 *   specs (drill/bore/       ALIGNING the two flattens on their TYPE SEQUENCE — the same identity discipline
 *   surfacing/text/lathe…)   wrapForkAtSave uses, never a blanket +1 (the shift is NON-UNIFORM: exec children shift,
 *                            the uiChildren param_group/panel/sim do NOT).
 *
 * Those three cases COVER the registry with no overlap, and that is a measured fact rather than a hopeful one: every
 * twin carrying both value-socket bindings AND guards is a bindingSpecs def, and every non-spec guarded twin has
 * structural bindings only. See the parity spec, which asserts the partition so a 33rd wizard cannot land outside it.
 *
 * ⚠ IT FAILS CLOSED. Each remapped binding is CHECKED against the fork's own stack (a block at that index, of the
 * same type, carrying the key) and ONE miss abandons the whole inheritance rather than write values into wrong
 * sockets: an empty form is a visible disappointment, a form silently wired to the wrong sockets is a wrong program.
 */
export function forkInheritance(srcDef, forkChildren) {
    if (!srcDef || !Array.isArray(srcDef.bindings) || !srcDef.bindings.length) return null;
    const copy = (v) => JSON.parse(JSON.stringify(v));
    const out = { forkedFrom: srcDef.opType };
    if (Array.isArray(srcDef.bindingSpecs) && srcDef.bindingSpecs.length) out.bindingSpecs = copy(srcDef.bindingSpecs);
    // specs re-derive the indices at every build; a structural-only binding set has none to derive → both ride verbatim
    if (out.bindingSpecs || !srcDef.bindings.some((b) => b && b.blockIndex != null)) { out.bindings = copy(srcDef.bindings); return out; }
    const map = alignByType(flattenBlocks(srcDef.template || []), flattenBlocks(forkChildren || []));
    if (!map) return null;                                       // the fork was restructured — the source's indices mean nothing here
    const forkFlat = flattenBlocks(forkChildren || []);
    const bindings = [];
    for (const b of srcDef.bindings) {
        const c = copy(b);
        if (c.blockIndex != null) {
            const j = map[c.blockIndex];
            const blk = (j != null && j >= 0) ? forkFlat[j] : null;
            if (!blk || !blk.params || !(c.key in blk.params)) return null;   // FAIL CLOSED (see above)
            c.blockIndex = j;
        }
        bindings.push(c);
    }
    out.bindings = bindings;
    return out;
}

/** Align a reference flatten onto a fork's flatten by TYPE SEQUENCE, tolerating INSERTIONS (the fork's `opunit`).
 *  Returns refIndex → forkIndex, or null when the reference runs past the end — i.e. the two are not the same stack.
 *  Deliberately not a diff: any real divergence surfaces as a failed key check in forkInheritance, which fails closed. */
function alignByType(refFlat, forkFlat) {
    const map = new Array(refFlat.length).fill(-1);
    let j = 0;
    for (let i = 0; i < refFlat.length; i++) {
        while (j < forkFlat.length && forkFlat[j].type !== refFlat[i].type) j++;
        if (j >= forkFlat.length) return null;
        map[i] = j++;
    }
    return map;
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
