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
import { registerUserBuilder, unregisterUserBuilder, registerOpLabel, removeOpLabel, builderOf, BUILDERS } from './opBuilders.js';   // t1972 — builderOf/BUILDERS back validateUserOp's nested-op check
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

// t2385 (BACKLOG #42 piece 1) — EXTRACTED from ui/formWidgets.js's own `DEFAULT_BY_TYPE` (its `resolveFormWidget`
// still owns the actual widget LOOKUP — `FORM_WIDGETS[...]` — this only supplies the type->widget-KEY mapping),
// so `wizards/ops/paramField.js`'s own block-face `fieldsFor` can resolve param_field's own `widget: ''` (t1562,
// "inherit, derive from type") the SAME way the form renderer will, without a second hand-copied map that could
// drift — ONE source, read from both the authoring surface (blocks) and the render surface (ui).
export const WIDGET_BY_TYPE = { number: 'number', int: 'number', enum: 'dropdown', bool: 'toggle', string: 'text' };

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

// t2315 — a node's `children`/`uiChildren` value takes TWO shapes depending on provenance: hand-authored
// (a plain array, every one of the 32 shipped data-op twins today) or Blockly-round-tripped from a MULTI-
// MOUTH block (an object keyed by mouth name — `DO` for a single-mouth container, `LEFT`/`RIGHT` or
// `TOP`/`BOTTOM` for split_horizontal/split_vertical, `TABS` for tab_group). formWidgets.js's own `traverse`
// already normalized this per node-type (five near-identical `Array.isArray(x)?x:(x.DO||[])` copies, plus a
// LEFT/RIGHT-specific one, plus its own generic `allMouthChildren` fallback) and userOpView.js's
// `hasTreeLayout` had a THIRD, independent variant — `flattenBlocks` here had NONE, and crashed
// (`TypeError: (blocks||[]) is not iterable`) the first time a real op ever placed a `split_horizontal` node
// in a live `uiChildren` tree (t2313). Declared ONCE here (the lower layer both `userOps.js` and
// `formWidgets.js` already share — `formWidgets.js` already imports `paramFieldsFromStack` from this same
// module) so a fourth consumer can't re-derive its own copy, or miss the normalization entirely the way this
// one did. IDENTITY for array input (returns the same reference, same order, zero transformation) — every
// existing array-shaped child stays byte-identical; proven across all 32 twins' own `flattenBlocks` output
// before/after (scratchpad/t2315-flatten-snapshot.mjs, not kept — 0 diffs).
export function childrenOf(nodeChildren) {
    if (!nodeChildren) return [];
    if (Array.isArray(nodeChildren)) return nodeChildren;
    return Object.values(nodeChildren).flatMap((v) => (Array.isArray(v) ? v : []));
}

// t2641 (BACKLOG #71/#72) — THE RENDER-PATH QUESTION: does this op's uiChildren need formWidgets.js's tree
// renderer (renderUiTree) to draw correctly, or can the classic flat renderer (renderOpForm, driven purely by
// formBindings()) handle it? Was userOpView.js's own hasTreeLayout, a private 2-type hand-list; now the ONE
// declared source it AND blocksApp.js's checkLayoutNodes (below) both read.
// ⚠ MEASURED THE HARD WAY, not assumed (t2641): the first version of this predicate also added preview3d / sim /
// feature_canvas / code_preview / usage_text / grid_container / tab_group / layout / simstart / param_table,
// reasoning "renderOpForm can't draw a visualization pane, so route it to tree." That reasoning was WRONG for
// preview3d/sim/feature_canvas specifically: userOpView.js's own update() (not renderOpForm) draws those
// through an entirely SEPARATE, already-working pipeline — panelType(_def.panel) + renderLayout2D/mgr.preview3D
// — driven by the op's own top-level `panel` string ('form2d'/'form3d+2d'/…), independent of uiChildren node
// types or hasTreeLayout. Forcing tree mode for these ops flipped their DOM container ids from the bare scheme
// (userVizContainer) to the _tree-suffixed one (userOpView.js's own vizBase) that only the tree path's
// renderUiTree branches populate — breaking every existing feature_canvas/handle op: 25 failed specs in the
// REQUIRED full suite this same turn (length-handle-block, point-handle-block + 7 sibling handle-block specs,
// pointpick-block, pane-sizer-1353/mobile-1468, pane-visual-host-1760/programmatic-1762, open-as-modal-1625,
// wizard-shapes-1627, handle-target-fails-visibly-2525). Caught by the gate, reverted before landing — not
// shipped. split_horizontal/split_vertical are the only types with NO flat-mode equivalent anywhere (nothing
// else ever draws a two-pane split), so they stay the sole trigger — restoring the original, tested behavior
// byte-for-byte. The other 7 candidate types (code_preview/usage_text/grid_container/tab_group/layout/
// simstart/param_table) were NEVER independently verified after the feature_canvas/sim/preview3d theory broke
// down, so they are NOT added here either — an unverified guess is not a fix. t2639's own drag-handle dead end
// (a hand-built feature_canvas+point_handle wizard rendering a fully empty pane) is very likely NOT a
// hasTreeLayout defect at all — panelType('').viz is false when an op's top-level `panel` field is unset, which
// would hide the whole .wiz-visual pane regardless of tree/flat, and the SAME turn separately found the real
// UI's own panel-type dropdown (`.selectOption({label:'Form + 3D + 2D'})`) silently failing to commit. That is
// the more likely true root cause, and it needs its own separate investigation — flagged, not fixed here.
const TREE_ONLY_TYPES = new Set(['split_horizontal', 'split_vertical']);

export function usesTreeOnlyLayout(nodes) {
    for (const n of childrenOf(nodes)) {
        if (!n) continue;
        if (TREE_ONLY_TYPES.has(n.type)) return true;
        if (n.children && usesTreeOnlyLayout(n.children)) return true;
        if (n.uiChildren && usesTreeOnlyLayout(n.uiChildren)) return true;
    }
    return false;
}

// Deterministic pre-order walk of a block stack (block, then its children) → a flat array of block REFS.
// Exported so devMode shares ONE definition (binding.blockIndex must mean the same block in both modules).
export function flattenBlocks(blocks, out = [], currentGroup = null) {
    for (const b of childrenOf(blocks)) {
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

// t1593 — COUNT THE ARMS, NOT THE GUARDS: a guard survived the old canvas as a CHILDLESS block, so counting
// guards missed exactly the twins whose forks came back with every guard present and every arm inside them gone
// (measured: atc test/change/table, rotary clock, homing). What the arms ARE is the blocks a guard contains.
// Extracted (t2369) so `validateUserOp`'s own refusal check and `devMode.js`'s own fork-body-sourcing decision
// (guarded → source the def's own template; unguarded → the placed instance, byte-identical to before) share
// ONE declared arm-count rather than two independent re-derivations of the same concept.
export function armBlocks(t) {
    return flattenBlocks(t || []).reduce((n, b) => n + ((b && b.type === 'guard' && b.children) ? flattenBlocks(b.children).length : 0), 0);
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

/** Read a DECLARED preview intent from a `sim` (or, t2511, its split-out 3D-only half `preview3d`) block in a
 *  stack (the blocks-native twin of the dev-panel "Preview rig" checkboxes). A migrated op declares ONE of the
 *  two, never both — this reads whichever is present, same fields either way (see preview3d.js's own header).
 *  The block WINS over the dev-panel when present (same precedence as the panel block). Returns: the intent
 *  object, `null` (a sim/preview3d block declaring nothing), or `undefined` (neither present → use the checkboxes). */
export function simIntentFromStack(children) {
    const blk = flattenBlocks(children).find((b) => b && (b.type === 'sim' || b.type === 'preview3d'));
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

/** The `feature_canvas` block (t2515 — renamed from `panel`, field name unchanged) in a stack → its panel layout parameter. */
export function panelFromStack(children) {
    const blk = flattenBlocks(children).find((b) => b && b.type === 'feature_canvas');
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
        // t2133 — "not a form field" + the canvas-drag triple + the per-option grey-gate: REUSE, no new mechanism (see
        // formField.js's own t2133 note). formHidden/group/role mirror deriveBindings.js's existing allow-list
        // (b.formHidden/b.group/b.role); relToRow serializes the ONE shape deriveBindings' `relTo` ever takes
        // ({row}) as a single text field, matching guard.js's whentype precedent (declare the candidate shape, not
        // a generic object). optionGate mirrors gate's own JSON-blob round-trip immediately above.
        if (p.formHidden === true || p.formHidden === 'true' || p.formHidden === 'TRUE') spec.formHidden = true;
        if (p.group) spec.group = String(p.group);
        if (p.role) spec.role = String(p.role);
        if (p.relToRow) spec.relTo = { row: String(p.relToRow) };
        if (p.optionGate) { try { spec.optionGate = JSON.parse(p.optionGate); } catch (_) { /* malformed — drop rather than throw */ } }
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
 * bindings → a param_table block (t2543 — separate from param_group, see paramTable.js's own header), one param_field per
 * binding in binding PRE-ORDER, label/default/widget/type from the binding (NO classifier — the form shows every param;
 * expose/bake is the pendant's concern, not the form's). PURE + INERT (nothing consumes it yet). Returns null when the def has
 * no value bindings.
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
    return { type: 'param_table', params: { group }, children };
}

/**
 * block-native-params S5.3 — materialize a param_table INTO a def (the FORM analog of materializeCamTable). Injects
 * paramGroupFromBindings into the user_root PRESENTATION mouth and re-derives EVERY binding blockIndex BY IDENTITY over the
 * post-injection flatten (the wrapForkAtSave pattern; a blanket shift would corrupt a uiChildren binding). Mutates `def` in
 * place; idempotent (no-op if the def has no value bindings or already carries a param_table). COMPOSES with materializeCamTable:
 * each runs its own identity re-derive over the CURRENT flatten, so running both sequentially re-indexes correctly across the
 * combined injection. BYTE-NEUTRAL by construction: param_field emits [] + param_table emits [] directly (not transparent,
 * matching cam_table — its children are declarations, not atoms), and formBindings consuming it reproduces today's form
 * (order/label/widget/default, and canvas group/role which it re-derives from the binding). PURE — the caller (the S5.3 hook)
 * decides when. Returns def.
 *
 * t2543 (BACKLOG #71 owner ruling) — SEPARATE SLOT: this used to find-or-create a `param_group` node and overwrite ITS
 * children, sharing the exact array `renderUiTree`'s own transparent form-layout branch reads (t1605) — two incompatible
 * owners of one array. Now targets `param_table` exclusively, found by TYPE alone (`flattenBlocks(...).find(b => b.type ===
 * 'param_table')`), the SAME idempotency shape `materializeCamTable` already uses for `cam_table` — never inspects, never
 * mutates, a twin's own `param_group` node (whatever its own `children` may declare — empty, or group_box/field_ref rows).
 * `param_table` never pre-exists in a hand-authored twin (nothing but this function ever creates one), so there is no
 * "update in place" case left to handle — every non-idempotent call is a fresh injection.
 *
 * t2543 — a SECOND, EXPLICIT skip named directly rather than inherited by accident: a twin whose OWN template already
 * declares `field_ref` nodes (drill, t2299 — the only twin with this shape today, and the precedent BACKLOG #72's own
 * group_box migration follows) places its rows by reading `def.bindings` directly through `renderUiTree`'s
 * `field_ref`/`param_group` branches — it needs NO param_field block to find or describe a row, so canvas materialization
 * would add 30+ blocks with zero form-rendering effect either way. `cam-block-native-params-s52.spec.js`'s own
 * `drillSame` test already PINS this — drill's `formBindings` must return `def.bindings` BY REFERENCE, unchanged — a real,
 * reasoned product expectation from t2299, not an accident of the old ambiguous guard this turn retires elsewhere. The OLD
 * guard achieved this by COINCIDENCE (drill's own non-empty `param_group.children` happened to also mean "don't
 * materialize"); this check achieves the SAME outcome for the SAME reason, named plainly, decoupled from param_group
 * entirely — a future group_box-migrated twin (BACKLOG #72) will hit this same skip once it ALSO declares field_ref rows,
 * which is the correct outcome for the identical reason, not a special case for drill alone.
 */
export function materializeParamGroup(def) {
    if (!def || !Array.isArray(def.template)) return def;
    const root = def.template.find((b) => b && b.type === 'user_root');
    if (!root) return def;
    const flat0 = flattenBlocks(def.template);
    if (flat0.some((b) => b && b.type === 'param_table')) return def;   // already materialized — idempotent, exactly like materializeCamTable's own check
    if (flat0.some((b) => b && b.type === 'field_ref')) return def;   // already row-placed by declaration — materializing would be redundant, see header

    const pg = paramGroupFromBindings(def);
    if (!pg) return def;   // no value bindings — nothing to declare

    const flatBefore = flattenBlocks(def.template);
    // t2543 — APPEND, not prepend (unlike materializeCamTable's own cam_table, which has no pre-existing sibling
    // to disturb). param_table replaces what used to be an IN-PLACE FILL of a twin's own (often empty) param_group
    // node — a twin's hand-authored uiChildren order (e.g. surfacing's sim/path_anchor/param_group, t2271/t2301)
    // is real, declared structure that must survive materialize untouched, same as param_group's own children now
    // do. Prepending here reordered it and broke cam-substack-save-fork.spec.js's own pinned order — caught live,
    // not assumed.
    root.uiChildren = [...(root.uiChildren || []), pg];
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
            // t2133 — the reverse half of formHidden/group/role/relToRow/optionGate (see bindingsFromStack's own
            // t2133 note + formField.js's header). relToRow un-nests deriveBindings' `relTo:{row}` back to text.
            formHidden: !!s.formHidden, group: s.group || '', role: s.role || '',
            relToRow: (s.relTo && s.relTo.row != null) ? String(s.relTo.row) : '',
            optionGate: s.optionGate ? JSON.stringify(s.optionGate) : '',
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

// ── def.bindings (group/role/anchor) ⇄ handle blocks nested in `feature_canvas` (BACKLOG #71, t2517/t2521/t2525) ──
// A handle block, nested inside a `feature_canvas` block's own mouth, DECLARES a draggable canvas gesture that
// drives an EXISTING, already emit-real param — one an ordinary `formfield` block already binds via bindMode/
// atomType/key (t2525: the handle's own field/fx/fy NAME that param, must-match-picker authored, bridge.js's
// HANDLE_ANCHOR_FIELDS — same discipline atomType already used). `attach()` below LOOKS UP that param among
// the stack's own REAL (match/key-carrying) bindings and MERGES the anchor onto it — `deriveBindings.js` line
// 98 already carries `.anchor` through untouched, so `layoutSpecFromOp` needs no change for the resolved case:
// it already builds `groups` from `def.bindings` generically, whatever produced them. A target that resolves
// to NOTHING (the formfield was deleted/renamed after the handle was authored, or a hand-authored/legacy stack
// bypassed the picker) must FAIL VISIBLY, not silently vanish or render a dead handle that looks live — it
// comes back `anchorUnresolved: true` instead, which panelTypes.js renders as an obviously-broken red marker
// (never a normal handle) and `handleTargetReport` (below) surfaces at save time, mirroring
// `formfieldMatchReport`'s own established backstop for the identical class of problem (a picker prevents a
// TYPO, not a target later deleted elsewhere in the stack).
//
// Before t2525 this list was itself socket-less (no match/blockIndex → never reached emit, by construction) —
// BACKLOG #71's own central finding: two real, draggable handles that changed nothing on drag. SCOPED TO
// feature_canvas'S OWN CHILDREN, never a bare stack-wide scan — a handle belongs to a SPECIFIC canvas (owner
// ruling), so containment (not a flat type-filter) says which one owns it.

/** The handle blocks (`length_handle`, `point_handle`, …) nested inside `feature_canvas` nodes in a stack →
 *  bindings carrying the group/role/anchor a handle needs, MERGED onto whichever REAL (match/key-carrying)
 *  binding in `realBindings` the handle's own field names — or `{anchorUnresolved:true}` if none does. */
export function handleBindingsFromStack(children, realBindings) {
    const byParam = new Map((realBindings || []).filter((b) => b && b.param).map((b) => [b.param, b]));
    const attach = (targetParam, group, role, anchor) => {
        const real = byParam.get(targetParam);
        // an unresolved stub still needs `type` -- registerUserOp (a pre-existing, unrelated guard, audit #6)
        // refuses ANY binding lacking one, which would make a wizard with a broken handle target fail to even
        // REGISTER/reopen at all, hiding the broken-marker render behind a hard crash instead of showing it.
        return real ? { ...real, group, role, anchor } : { param: targetParam, type: 'number', group, role, anchor, anchorUnresolved: true };
    };
    const out = []; let n = 0;
    for (const fc of flattenBlocks(children)) {
        if (!fc || fc.type !== 'feature_canvas') continue;
        for (const b of [...flattenBlocks(fc.uiChildren || []), ...flattenBlocks(fc.children || [])]) {
            if (!b) continue;
            const p = b.params || {};
            if (b.type === 'length_handle') {
                const gid = 'lh' + (++n);
                const ax = Number(p.ax) || 0, ay = Number(p.ay) || 0;
                const min = (p.min === '' || p.min == null) ? null : Number(p.min);
                const max = (p.max === '' || p.max == null) ? null : Number(p.max);
                const anchor = { kind: 'length', axis: String(p.axis || 'Y').toUpperCase() === 'X' ? 'x' : 'y', ax, ay, min, max, label: p.label || 'length' };
                out.push(attach(String(p.field || 'len'), gid, 'len', anchor));
            } else if (b.type === 'point_handle') {
                const gid = 'ph' + (++n);
                // t2573 — ax/ay kept as the RAW authored string (not eagerly Number()'d): panelTypes.js's own
                // `anchor.kind==='point'` branch now resolves each through `resolveAnchorCoord` (anchorSources.js,
                // t2571's stock-anchor primitive), which needs live `stock` — unavailable at this static-binding-
                // build layer. A plain numeric string ('0', '40', …) still resolves byte-identical; only a NEW
                // stock-token string ('stockHalfW', …) activates the lookup, proving the primitive general beyond
                // diag_aim_handle, its first consumer.
                const ax = (p.ax === '' || p.ax == null) ? '0' : String(p.ax);
                const ay = (p.ay === '' || p.ay == null) ? '0' : String(p.ay);
                const anchor = { kind: 'point', ax, ay, label: p.label || 'pos' };
                out.push(attach(String(p.fx || 'x'), gid, 'x', anchor));
                out.push(attach(String(p.fy || 'y'), gid, 'y', anchor));
            } else if (b.type === 'rect_handle') {
                const gid = 'rh' + (++n);
                const ax = Number(p.ax) || 0, ay = Number(p.ay) || 0;
                const sx = p.sx === '' || p.sx == null ? 1 : Number(p.sx);
                const sy = p.sy === '' || p.sy == null ? 1 : Number(p.sy);
                const numOrNull = (v) => (v === '' || v == null) ? null : Number(v);
                const anchor = {
                    kind: 'rect', ax, ay, sx, sy,
                    minw: numOrNull(p.minw), maxw: numOrNull(p.maxw), minh: numOrNull(p.minh), maxh: numOrNull(p.maxh),
                    valueField: p.valueField === 'fieldH' ? 'fieldH' : 'field', label: p.label || 'W×H',
                };
                out.push(attach(String(p.field || 'w'), gid, 'w', anchor));
                out.push(attach(String(p.fieldH || 'h'), gid, 'h', anchor));
            } else if (b.type === 'radial_handle') {
                const gid = 'rdh' + (++n);
                const cx = Number(p.cx) || 0, cy = Number(p.cy) || 0;
                const a = Number(p.a) || 0;
                const rScale = p.rScale === '' || p.rScale == null ? 2 : Number(p.rScale);
                const numOrNull = (v) => (v === '' || v == null) ? null : Number(v);
                const anchor = { kind: 'radial', cx, cy, a, rScale, minR: numOrNull(p.minR), maxR: numOrNull(p.maxR), label: p.label || 'Ø' };
                out.push(attach(String(p.field || 'dia'), gid, 'r', anchor));
            } else if (b.type === 'scale_handle') {
                const gid = 'sh' + (++n);
                const ax = Number(p.ax) || 0, ay = Number(p.ay) || 0;
                const numOrNull = (v) => (v === '' || v == null) ? null : Number(v);
                const baseField = String(p.baseField || 'w');
                const anchor = { kind: 'scale', ax, ay, baseField, min: numOrNull(p.min), max: numOrNull(p.max), label: p.label || 'scale' };
                const entry = attach(String(p.field || 'scale'), gid, 'scale', anchor);
                // baseField is READ-ONLY context (never merged onto — it may already carry its own, unrelated
                // handle) but must still resolve, same fail-visibly doctrine as `field` itself.
                if (!byParam.has(baseField)) entry.anchorUnresolved = true;
                out.push(entry);
            } else if (b.type === 'shear_handle') {
                const gid = 'sr' + (++n);
                const ax = Number(p.ax) || 0, ay = Number(p.ay) || 0;
                const hField = String(p.hField || 'height');
                const anchor = { kind: 'shear', ax, ay, hField, label: p.label || 'slant°' };
                const entry = attach(String(p.field || 'slant'), gid, 'slant', anchor);
                // hField is READ-ONLY context (never merged onto — it may already carry its own, unrelated
                // handle) but must still resolve, same fail-visibly doctrine as scale_handle's baseField.
                if (!byParam.has(hField)) entry.anchorUnresolved = true;
                out.push(entry);
            } else if (b.type === 'proj_length_handle') {
                const gid = 'pl' + (++n);
                const cx = Number(p.cx) || 0, cy = Number(p.cy) || 0;
                const axisX = String(p.axis || 'X').toUpperCase() === 'X';
                const scale = p.scale === '' || p.scale == null ? 2 : Number(p.scale);
                const min = (p.min === '' || p.min == null) ? null : Number(p.min);
                const max = (p.max === '' || p.max == null) ? null : Number(p.max);
                const anchor = { kind: 'projLength', cx, cy, nx: axisX ? 1 : 0, ny: axisX ? 0 : 1, scale, min, max, label: p.label || 'width' };
                out.push(attach(String(p.field || 'width'), gid, 'plen', anchor));
            } else if (b.type === 'probe_vector_handle') {
                const gid = 'pv' + (++n);
                const cx = Number(p.cx) || 0, cy = Number(p.cy) || 0;
                const numOrNull = (v) => (v === '' || v == null) ? null : Number(v);
                const anchor = { kind: 'probeVector', cx, cy, minR: numOrNull(p.minR), maxR: numOrNull(p.maxR), label: p.label || 'probe' };
                out.push(attach(String(p.field || 'dist'), gid, 'dist', anchor));
                out.push(attach(String(p.fieldAxis || 'axis'), gid, 'axis', anchor));
                out.push(attach(String(p.fieldDir || 'dir'), gid, 'dir', anchor));
            } else if (b.type === 'diag_aim_handle') {
                const gid = 'da' + (++n);
                const axisField = p.axisField ? String(p.axisField) : null;
                const signField = p.signField ? String(p.signField) : null;
                const signWhenPos = (p.signWhenPos === '' || p.signWhenPos == null) ? -1 : Number(p.signWhenPos);
                const anchor = { kind: 'diagAim', axisField, signField, signPosValue: p.signPosValue || 'pos', signWhenPos, label: p.label || '②' };
                const eTravel = attach(String(p.fieldTravel || 'diagTravel'), gid, 'travel', anchor);
                const ePrimary = attach(String(p.fieldPrimary || 'diagPrimary'), gid, 'prim', anchor);
                // axisField/signField are READ-ONLY context (never merged onto — each may already carry its own,
                // unrelated handle) but must still resolve, same fail-visibly doctrine as scale_handle's baseField.
                if ((axisField && !byParam.has(axisField)) || (signField && !byParam.has(signField))) {
                    eTravel.anchorUnresolved = true; ePrimary.anchorUnresolved = true;
                }
                out.push(eTravel, ePrimary);
            } else if (b.type === 'cross_aim_handle') {
                const gid = 'ca' + (++n);
                const axisField = p.axisField ? String(p.axisField) : null;
                const signField = p.signField ? String(p.signField) : null;
                const signWhenPos = (p.signWhenPos === '' || p.signWhenPos == null) ? 1 : Number(p.signWhenPos);
                const anchor = {
                    kind: 'crossAim', axisField, signField, signPosValue: p.signPosValue || 'pos', signWhenPos,
                    relToRow: p.relToRow ? String(p.relToRow) : '', label: p.label || '↔',
                };
                const entry = attach(String(p.field || 'cross'), gid, 'cross', anchor);
                // axisField/signField are READ-ONLY context (never merged onto — each may already carry its own,
                // unrelated handle) but must still resolve, same fail-visibly doctrine as diag_aim_handle's own.
                if ((axisField && !byParam.has(axisField)) || (signField && !byParam.has(signField))) {
                    entry.anchorUnresolved = true;
                }
                out.push(entry);
            }
        }
    }
    return out;
}

/** Merge `handleAnchors` (handleBindingsFromStack's own output) onto `valueBindings`: a RESOLVED anchor
 *  (carries match/key, having found its target) REPLACES the plain copy of that same param — one entry per
 *  param, never two — while an UNRESOLVED one (anchorUnresolved:true) is kept standalone so it still reaches
 *  `def.bindings` and can render as an obviously-broken handle, not silently vanish. */
export function mergeHandleAnchors(valueBindings, handleAnchors) {
    const resolvedParams = new Set((handleAnchors || []).filter((h) => h && !h.anchorUnresolved).map((h) => h.param));
    const kept = (valueBindings || []).filter((b) => !resolvedParams.has(b && b.param));
    return [...kept, ...(handleAnchors || [])];
}

/** t2525 (BACKLOG #71) — WHICH handle blocks' own declared target param actually resolves to a real (match/
 *  key-carrying) binding in this stack, and which don't. Mirrors `formfieldMatchReport`'s own shape/role: the
 *  MUST-MATCH picker (bridge.js HANDLE_ANCHOR_FIELDS) prevents a TYPO at author time, not a target formfield
 *  later renamed/deleted elsewhere in the stack — this is that backstop, consumed by the save-time guard the
 *  same way formfieldMatchReport already is, so a handle silently pointing at nothing is reported, not shipped. */
export function handleTargetReport(children) {
    const valueBindings = formfieldBindings(children);
    const handleAnchors = handleBindingsFromStack(children, valueBindings);
    const unresolved = handleAnchors.filter((h) => h && h.anchorUnresolved).map((h) => ({ param: h.param, kind: h.anchor && h.anchor.kind }));
    return { total: handleAnchors.length, matched: handleAnchors.length - unresolved.length, unresolved };
}

/** SOCKET-LESS handle bindings → handle block records, nested back inside a `feature_canvas` block (the
 *  reverse — re-authorable). `length_handle` is one binding per handle; `point_handle` pairs a group's x/y. */
export function handleBindingsToBlocks(bindings) {
    const list = bindings || [];
    const lengths = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'length' && b.role === 'len');
    const lenKids = lengths.map((b) => ({ type: 'length_handle', params: {
        field: b.param, value: b.default != null ? String(b.default) : '',
        axis: b.anchor.axis === 'x' ? 'X' : 'Y', ax: String(b.anchor.ax || 0), ay: String(b.anchor.ay || 0),
        min: b.anchor.min != null ? String(b.anchor.min) : '', max: b.anchor.max != null ? String(b.anchor.max) : '',
        label: b.anchor.label || 'length',
    } }));
    // point_handle: pair each group's own x/y bindings that carry a FIXED-ax/ay point anchor (as opposed to
    // layoutwidget's own {kind:'point', frame} shape, which layoutBindingsToBlocks already reverses separately).
    const byGroup = {};
    for (const b of list) if (b && b.group && b.anchor && b.anchor.kind === 'point' && b.anchor.frame === undefined && (b.role === 'x' || b.role === 'y')) (byGroup[b.group] = byGroup[b.group] || {})[b.role] = b;
    const ptKids = [];
    for (const g in byGroup) {
        const x = byGroup[g].x, y = byGroup[g].y;
        if (!x || !y) continue;
        ptKids.push({ type: 'point_handle', params: {
            fx: x.param, fy: y.param, x: x.default != null ? String(x.default) : '', y: y.default != null ? String(y.default) : '',
            ax: String(x.anchor.ax || 0), ay: String(x.anchor.ay || 0), label: x.anchor.label || 'pos',
        } });
    }
    // rect_handle: pair each group's own w/h bindings that carry a {kind:'rect'} anchor.
    const byGroupR = {};
    for (const b of list) if (b && b.group && b.anchor && b.anchor.kind === 'rect' && (b.role === 'w' || b.role === 'h')) (byGroupR[b.group] = byGroupR[b.group] || {})[b.role] = b;
    const rectKids = [];
    for (const g in byGroupR) {
        const w = byGroupR[g].w, h = byGroupR[g].h;
        if (!w || !h) continue;
        const a = w.anchor;
        rectKids.push({ type: 'rect_handle', params: {
            field: w.param, fieldH: h.param, value: w.default != null ? String(w.default) : '', valueH: h.default != null ? String(h.default) : '',
            ax: String(a.ax || 0), ay: String(a.ay || 0), sx: String(a.sx != null ? a.sx : 1), sy: String(a.sy != null ? a.sy : 1),
            minw: a.minw != null ? String(a.minw) : '', maxw: a.maxw != null ? String(a.maxw) : '',
            minh: a.minh != null ? String(a.minh) : '', maxh: a.maxh != null ? String(a.maxh) : '',
            valueField: a.valueField === 'fieldH' ? 'fieldH' : 'field', label: a.label || 'W×H',
        } });
    }
    // radial_handle: one binding per handle (role 'r'), like length_handle.
    const radials = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'radial' && b.role === 'r');
    const radKids = radials.map((b) => ({ type: 'radial_handle', params: {
        field: b.param, value: b.default != null ? String(b.default) : '',
        cx: String(b.anchor.cx || 0), cy: String(b.anchor.cy || 0), a: String(b.anchor.a || 0),
        rScale: String(b.anchor.rScale != null ? b.anchor.rScale : 2),
        minR: b.anchor.minR != null ? String(b.anchor.minR) : '', maxR: b.anchor.maxR != null ? String(b.anchor.maxR) : '',
        label: b.anchor.label || 'Ø',
    } }));
    // scale_handle: one binding per handle (role 'scale'), like length_handle/radial_handle. baseField is read
    // back off the anchor's own literal string — it is not itself a binding role here (it's read, not merged).
    const scales = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'scale' && b.role === 'scale');
    const scaleKids = scales.map((b) => ({ type: 'scale_handle', params: {
        field: b.param, baseField: b.anchor.baseField || 'w', value: b.default != null ? String(b.default) : '',
        ax: String(b.anchor.ax || 0), ay: String(b.anchor.ay || 0),
        min: b.anchor.min != null ? String(b.anchor.min) : '', max: b.anchor.max != null ? String(b.anchor.max) : '',
        label: b.anchor.label || 'scale',
    } }));
    // shear_handle: one binding per handle (role 'slant'), like scale_handle. hField is read back off the
    // anchor's own literal string — it is not itself a binding role here (it's read, not merged).
    const shears = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'shear' && b.role === 'slant');
    const shearKids = shears.map((b) => ({ type: 'shear_handle', params: {
        field: b.param, hField: b.anchor.hField || 'height', value: b.default != null ? String(b.default) : '',
        ax: String(b.anchor.ax || 0), ay: String(b.anchor.ay || 0), label: b.anchor.label || 'slant°',
    } }));
    // proj_length_handle: one binding per handle (role 'plen'), like length_handle/radial_handle.
    const projs = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'projLength' && b.role === 'plen');
    const projKids = projs.map((b) => ({ type: 'proj_length_handle', params: {
        field: b.param, value: b.default != null ? String(b.default) : '',
        axis: b.anchor.nx ? 'X' : 'Y', cx: String(b.anchor.cx || 0), cy: String(b.anchor.cy || 0),
        scale: String(b.anchor.scale != null ? b.anchor.scale : 2),
        min: b.anchor.min != null ? String(b.anchor.min) : '', max: b.anchor.max != null ? String(b.anchor.max) : '',
        label: b.anchor.label || 'width',
    } }));
    // probe_vector_handle: triple each group's own dist/axis/dir bindings that carry a {kind:'probeVector'} anchor.
    const byGroupPV = {};
    for (const b of list) if (b && b.group && b.anchor && b.anchor.kind === 'probeVector' && (b.role === 'dist' || b.role === 'axis' || b.role === 'dir')) (byGroupPV[b.group] = byGroupPV[b.group] || {})[b.role] = b;
    const pvKids = [];
    for (const g in byGroupPV) {
        const dist = byGroupPV[g].dist, axis = byGroupPV[g].axis, dir = byGroupPV[g].dir;
        if (!dist || !axis || !dir) continue;
        const a = dist.anchor;
        pvKids.push({ type: 'probe_vector_handle', params: {
            field: dist.param, fieldAxis: axis.param, fieldDir: dir.param, value: dist.default != null ? String(dist.default) : '',
            cx: String(a.cx || 0), cy: String(a.cy || 0),
            minR: a.minR != null ? String(a.minR) : '', maxR: a.maxR != null ? String(a.maxR) : '',
            label: a.label || 'probe',
        } });
    }
    // diag_aim_handle: pair each group's own travel/prim bindings that carry a {kind:'diagAim'} anchor.
    // axisField/signField/signPosValue/signWhenPos are read back off the anchor's own literal string/number —
    // not themselves binding roles here (read, not merged), same convention as scale_handle's own baseField.
    const byGroupDA = {};
    for (const b of list) if (b && b.group && b.anchor && b.anchor.kind === 'diagAim' && (b.role === 'travel' || b.role === 'prim')) (byGroupDA[b.group] = byGroupDA[b.group] || {})[b.role] = b;
    const daKids = [];
    for (const g in byGroupDA) {
        const travel = byGroupDA[g].travel, prim = byGroupDA[g].prim;
        if (!travel || !prim) continue;
        const a = travel.anchor;
        daKids.push({ type: 'diag_aim_handle', params: {
            fieldTravel: travel.param, fieldPrimary: prim.param,
            axisField: a.axisField || 'axis', signField: a.signField || 'dir2',
            signPosValue: a.signPosValue || 'pos', signWhenPos: a.signWhenPos != null ? String(a.signWhenPos) : '-1',
            label: a.label || '②',
        } });
    }
    // cross_aim_handle: one binding per handle (role 'cross'), like length_handle/radial_handle. axisField/
    // signField/signPosValue/signWhenPos/relToRow are read back off the anchor's own literal string/number — not
    // themselves binding roles here (read, not merged), same convention as diag_aim_handle's own axisField/signField.
    const crossAims = list.filter((b) => b && b.group && b.anchor && b.anchor.kind === 'crossAim' && b.role === 'cross');
    const caKids = crossAims.map((b) => ({ type: 'cross_aim_handle', params: {
        field: b.param,
        axisField: b.anchor.axisField || 'axis', signField: b.anchor.signField || 'dir',
        signPosValue: b.anchor.signPosValue || 'pos', signWhenPos: b.anchor.signWhenPos != null ? String(b.anchor.signWhenPos) : '1',
        relToRow: b.anchor.relToRow || '', label: b.anchor.label || '↔',
    } }));
    const kids = [...lenKids, ...ptKids, ...rectKids, ...radKids, ...scaleKids, ...shearKids, ...projKids, ...pvKids, ...daKids, ...caKids];
    if (!kids.length) return [];
    return [{ type: 'feature_canvas', params: { panel: 'form2d' }, children: kids }];
}

/** The LIVE-form extra bindings a stack's authoring blocks declare — formfield VALUE fields + layoutwidget/
 *  length_handle/point_handle GUI handles. For devMode.deriveAuthoredDef so a field/handle shows in the form
 *  AS YOU AUTHOR IT. Safe (skips on a bad match). t2525: a handle's own anchor is MERGED onto the real
 *  (formfield-declared) binding it names, same as resolveBindingsMeta below — so the live authoring canvas
 *  shows the same resolved/broken state a save would. */
export function authoredExtraBindings(children) {
    const valueBindings = formfieldBindings(children);
    const handleAnchors = handleBindingsFromStack(children, valueBindings);
    return [...mergeHandleAnchors(valueBindings, handleAnchors), ...layoutBindingsFromStack(children)];
}

/** If the template AUTHORS its bindings as `formfield` (value) / `layoutwidget` (point) / `length_handle`
 *  (length) / `point_handle` (point, nested-in-canvas form) blocks, derive them. Mirrors resolvePanelMeta/
 *  resolveSimMeta: ADDITIVE — returns null when there
 *  are NONE, so a hand-written-spec def (today's corner/edge/middle) is UNTOUCHED / byte-identical. Returns
 *  { specs, bindings } — specs drive the emit re-derivation (def.bindingSpecs), bindings drive the form +
 *  schema (deriveBindings over the template) + the GUI (group/role/anchor). t2525: a handle's own anchor is
 *  MERGED onto the real binding it names (mergeHandleAnchors) rather than added as a second, socket-less
 *  entry — the handle then reaches emit through the SAME match/key the merged binding already carried. */
function resolveBindingsMeta(def) {
    const template = def && Array.isArray(def.template) ? def.template : [];
    const specs = bindingsFromStack(template);
    const layoutwidget = layoutBindingsFromStack(template);
    // v1: derive over the UNPRUNED template (an authored op carries no guards yet — a guarded authored op is a later slice).
    const valueBindings = specs.length ? deriveBindings(flattenBlocks(template), specs) : [];
    const handleAnchors = handleBindingsFromStack(template, valueBindings);
    if (!specs.length && !layoutwidget.length && !handleAnchors.length) return null;   // no authoring blocks → keep hand-written def.bindings/bindingSpecs (byte-identical)
    return { specs, bindings: [...mergeHandleAnchors(valueBindings, handleAnchors), ...layoutwidget] };
}

/** The FORM bindings a stack's `formfield` blocks declare (specs → deriveBindings over the stack). For the LIVE Blocks
 *  form (devMode.deriveAuthoredDef) AND handleTargetReport below: a formfield-authored field shows in the form AS YOU
 *  AUTHOR IT. Safe PER SPEC — an unmatched/in-progress-edit spec is skipped, not thrown. t2665 (gap 9) — deriveBindings
 *  throws on the FIRST bad spec it hits in a batch, which used to abort the WHOLE array (one dangling formfield blanked
 *  every OTHER formfield's binding too, and by extension every handle target's match — the exact "0 matched" refusal
 *  the live authoring session hit with a mistyped Assign-Var matchvar on one sibling field, while the OTHER field's
 *  binding was perfectly fine). Deriving one spec at a time isolates the failure to the spec that actually owns it,
 *  the same one-bad-spec-doesn't-hide-the-rest principle formfieldMatchReport already established for its own report.*/
export function formfieldBindings(children) {
    const specs = bindingsFromStack(children);
    if (!specs.length) return [];
    const flat = flattenBlocks(children);
    const out = [];
    for (const s of specs) { try { out.push(...deriveBindings(flat, [s])); } catch (_) { /* this spec's own dangling/in-progress match -- skip it alone */ } }
    return out;
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

// t2395 (BACKLOG #47 item 1) — the goto family's own field name per block type (mirrors bridge.js's
// `LABEL_TARGET_FIELDS`, declared independently here rather than imported: this file is the MODEL side, reads
// the plain `{type,params}` shape and must stay import-clean of the Blockly-facing bridge.js — the same
// direction every other model/bridge boundary in this codebase already keeps).
const GOTO_TARGET_FIELDS = { goto: 'n', ifgoto: 'goto', probecheck: 'goto', confirm: 'cancel', hmiconfirm: 'cancel' };

/** t2395 — WHICH goto-family targets name a `label` block's `n` actually declared in this stack, and which
 *  don't. The picker (pickerField.js, `allowNew`) is FORWARD-AUTHORABLE by design — "people place the jump
 *  before the label" — so a target with no match YET is not necessarily wrong; this is the backstop that nets
 *  the ones still unmatched once the whole stack is built. ⛔ INFORMATIONAL ONLY (BACKLOG #47's own ruling:
 *  "verification INFORMS, it never gates") — unlike `formfieldMatchReport` just above, the caller must NEVER
 *  turn this into a blocking `ok:false`; it exists to be surfaced (a toast), never to refuse a save. A
 *  non-numeric target (`ifgoto.goto`'s own documented symbolic-string override, t1581) is out of scope here —
 *  only a target that LOOKS like a plain label number and doesn't match one is a genuine candidate defect. */
export function gotoTargetReport(children) {
    const flat = flattenBlocks(children);
    const labels = new Set();
    for (const b of flat) {
        if (!b || b.type !== 'label') continue;
        const n = Number(b.params && b.params.n);
        if (Number.isFinite(n)) labels.add(n);
    }
    const unmatched = [];
    let total = 0;
    for (const b of flat) {
        if (!b) continue;
        const key = GOTO_TARGET_FIELDS[b.type];
        if (!key) continue;
        const raw = b.params && b.params[key];
        if (raw == null || raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;   // a symbolic override (ifgoto's own documented case) — not this check's concern
        total++;
        if (!labels.has(n)) unmatched.push({ type: b.type, field: key, target: n });
    }
    return { total, matched: total - unmatched.length, unmatched };
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
// t2425 (BACKLOG #41) — the metadata-leaf types whose OWN `params.param` names the bound param a "Freeze value"
// gesture can target. `collapsed` is a native Blockly block property (see stackBridge.js's own KNOWN_LEAF_RECORD_
// FIELDS) — purely a DERIVED visual this file applies from the declared source of truth (`params.frozenParams`,
// below), never the other way around: a human collapsing some UNRELATED block via Blockly's own native "Collapse
// Block" stays exactly that, an ordinary canvas tidy, not a frozen param.
const FROZEN_MARKER_TYPES = new Set(['formfield', 'param_field', 'field_ref']);

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
    // t2425 (BACKLOG #41) — FREEZE: mark whichever metadata leaf PLACES a frozen param's row `collapsed`, so a
    // reload (opFromMarker → this same function) reconstructs the SAME visual a live "Freeze value" gesture set
    // directly on the canvas, rather than reverting to expanded the moment the page refreshes. `frozenParams` is
    // read from `p` (the guard-defaulted params), never re-declared per def — this applies uniformly to any
    // user_* op, no per-twin wiring required, matching the dispatch's own "smaller than it looks" scope.
    const frozen = (p && Array.isArray(p.frozenParams)) ? new Set(p.frozenParams) : null;
    if (frozen && frozen.size) {
        for (const blk of flat) {
            if (blk && FROZEN_MARKER_TYPES.has(blk.type) && blk.params && frozen.has(blk.params.param)) blk.collapsed = true;
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
    // t1972 — a NESTED `type:'op'` block whose `opType` is neither a registered `user_`-prefixed op NOR a
    // BUILT-IN legacy builder key is t1966's own proven hazard, made real: `findOpInStack` (programModel.js)
    // treats a `user_root` as opaque to anything that isn't `USER_OP_PREFIX`-prefixed, so such a block gets no
    // Edit chip and its export marker is silently dropped on a round-trip through the Blocks tab. Catch it AT
    // SAVE TIME, where the author can still act on it.
    // The BUILT-IN-key exception (not just a `user_`-prefix check) is what lets this run against every ALREADY-
    // SHIPPED def without breaking homing's own registration: homing's own legacy `homingDataStack` self-wraps
    // with an internal `{type:'op', opType:'homing'}` fragment (t1842/t1838's own finding, "LOAD-BEARING and
    // left alone") — `'homing'` is a `BUILDERS` key (opBuilders.js), not a `user_`-prefixed one, so a plain
    // prefix check would flag SHIPPED, working code as an error on every boot. The exception is sound, not
    // lenient: `opToolbox.js`'s own palette only ever offers `listUserOps()` — the `user_`-prefixed USER_DEFS
    // registry — never a bare `BUILDERS` key, so a legacy builder opType can ONLY reach a template as a twin's
    // OWN internal self-wrap (exactly homing's shape), never as something a user composed by hand. A genuinely
    // nested `user_`-prefixed op (t1966's own proven case — an author drags an already-placed twin into
    // another's authoring body) still gets flagged unless it is ALSO a real, registered op.
    for (const b of flat) {
        if (!b || b.type !== 'op') continue;
        const opType = b.opType;
        const isRegisteredUserOp = typeof opType === 'string' && opType.startsWith(USER_OP_PREFIX) && !!builderOf(opType);
        const isLegacyInternalSelfWrap = typeof opType === 'string' && opType in BUILDERS;
        if (!isRegisteredUserOp && !isLegacyInternalSelfWrap) {
            errs.push(`a nested op block (opType "${opType}") is not a registered "${USER_OP_PREFIX}"-prefixed op — it will get no Edit chip and its export marker will be silently dropped on a Blocks-tab round-trip (t1966/t1972)`);
        }
    }
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
    // t2028 — SELF-HEAL, mirroring def.panel above: userOpFromStack sets def.sim from the raw POSITIONAL arg (its
    // own vocabulary — forceMachine/showMagazine/toolMachineFrame), but the stack's OWN embedded `sim` block (a
    // DIFFERENT key vocabulary — machine/magazine/toolMachine) always wins via resolveSimMeta/simIntentFromStack.
    // Before this line def.sim stayed permanently stale at whatever was passed positionally — never reconciled,
    // unlike panel, which self-corrects here already. simIntentFromStack already normalises BOTH vocabularies into
    // the SAME shape def.sim's positional callers use, so this is a straight write-back, not a new shape.
    def.sim = sim.intent;
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
 *
 * t2365 (OPTION C, fork-to-custom) — `forkChildren` must carry the SAME program-level progstart/progend the
 * source's own `def.template` still has literally inside it (a def is a standalone builder, not part of any
 * program) — a LIVE PLACED op's `.children` never does (opBuilders.js's `_framed` lifts them to top-level
 * PROGRAM siblings). A spindle/retract binding legitimately targets progstart/progend (drill's own `rpm` does),
 * so the caller (devMode.js's `prepareCandidate`) re-attaches the candidate's CURRENT program framing before
 * calling this — omitting it does not crash, it just fails EVERY blockIndex binding closed, silently.
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
