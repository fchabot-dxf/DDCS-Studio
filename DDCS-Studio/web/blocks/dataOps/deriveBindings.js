/**
 * blocks/dataOps/deriveBindings.js — derive a user-op `bindings` array from DECLARATIVE specs.
 *
 * The shipped corner break (defect #1) was a HAND-COUNTED blockIndex: the map skipped the
 * `=== CONFIGURATION ===` comment, so every binding shifted by one and `registerUserOp` threw /
 * mis-bound. The fix is valid-by-construction: a spec names its target block by IDENTITY
 * (its `type` + a stable matcher — for an `assign`, its macro `var` like `#23`), never by a
 * literal position, and this helper RE-FINDS the flat index by scanning the freshly-flattened
 * stack. Because it derives over the ALREADY-WRAPPED stack, the `user_root/panel/sim/param_group`
 * prefix (the old `WRAP_PREFIX_COUNT = 4` hand-count) falls out for free, and a conditional block
 * that shifts positions (corner's `probeZFirst` → `#21`/`#22`, which shift `#23`/`#24`) is handled —
 * the scan lands on the right block every time. A zero/ambiguous/keyless match THROWS loudly at
 * build time (a real authoring error) instead of failing silently like an off-by-one.
 *
 * Reusable across every data-op port (drill/surfacing/slot/text/atcWarmup can adopt it later); for
 * now only corner uses it (do NOT migrate the siblings here). Depends on nothing but flattenBlocks.
 *
 * A spec row: { param, type, key, match, default?, label?, section? }
 *   match — how to identify the target block among the flattened stack:
 *     { type, var: '#23' }        an `assign` block whose params.var === '#23'   (the natural corner key)
 *     { type, params: {k:v,…} }   a block of `type` whose params match every (k,v)   (general form)
 *     { type }                    the SOLE block of that type in the stack
 *   key — the socket key on that block the binding drives (assign → 'value').
 *   default — OPTIONAL. If omitted, the binding default is READ from the matched socket's baked value — so a socket that
 *     holds an EXPRESSION default (e.g. corner's reposition #23 = '#15') keeps that expression when the param is unset,
 *     instead of an instantiate() overwrite reintroducing a wrong literal. (declare-never-infer: the template IS the default.)
 */
import { flattenBlocks } from '../userOps.js';

/** Does flattened block `blk` satisfy `match`? Exported (t1636) so a caller can COUNT hits without risking the
 *  throw deriveBindings raises on a mismatch — e.g. a save-time guard that wants to REPORT every dangling spec
 *  at once, not abort on the first. */
export function matches(blk, match) {
    if (!blk || blk.type !== match.type) return false;
    if ('var' in match) return !!blk.params && String(blk.params.var) === String(match.var);
    if (match.params) {
        if (!blk.params) return false;
        for (const k in match.params) if (String(blk.params[k]) !== String(match.params[k])) return false;
    }
    return true;   // { type } alone → any block of that type (caller guarantees it's the sole one)
}

/**
 * Derive concrete bindings (with correct flat blockIndex) from declarative specs.
 * @param {Array} flatStack  the ALREADY-WRAPPED, ALREADY-FLATTENED block array (flattenBlocks(stack))
 * @param {Array} specs      the declarative binding specs (identity, not position)
 * @returns {Array}          bindings for userOpFromStack — { param, type, default, key, blockIndex, label?, section? }
 * @throws  if a spec matches != 1 block, or the matched block lacks the socket key.
 */
export function deriveBindings(flatStack, specs) {
    const out = [];
    for (const s of specs) {
        const hits = [];
        for (let i = 0; i < flatStack.length; i++) if (matches(flatStack[i], s.match)) hits.push(i);
        // ② B4 ③ — an OPTIONAL spec targets a PRUNE-GATED socket (present only in some param states, e.g. corner's #21/#22
        // which exist only under probeZFirst): 0 matches → the socket is absent in THIS state → SKIP the binding (do not
        // substitute a socket that isn't there). A non-optional spec still requires exactly 1 (a real authoring error else).
        if (hits.length === 0 && s.optional) continue;
        if (hits.length !== 1) {
            const how = ('var' in s.match) ? `${s.match.type} ${s.match.var}` : (s.match.type || '?');
            throw new Error(`deriveBindings: spec "${s.param}" matched ${hits.length} blocks (${how}); need exactly 1`);
        }
        const blockIndex = hits[0];
        if (!(s.key in (flatStack[blockIndex].params || {})))
            throw new Error(`deriveBindings: spec "${s.param}" → block ${blockIndex} has no socket key "${s.key}"`);
        const dflt = (s.default !== undefined) ? s.default : (flatStack[blockIndex].params || {})[s.key];
        const b = { param: s.param, type: s.type, default: dflt, key: s.key, blockIndex };
        // t114 — a spec with NO explicit default reads the socket's PER-STRUCTURAL-COMBO baked value (its `dflt` above is
        // the value over the CANONICAL stack — e.g. corner's #21/#22/#23/#24, which change with corner×probeSeq). That
        // canonical default must NOT be injected when the field is untouched (it would overwrite the pruned per-combo
        // socket — the t109 bug, but even for a FINITE canonical like #21='0' on YX which is WRONG for XY). Mark it so the
        // form OMITS an untouched socket-held field → the template's per-combo socket expression holds. A typed value overrides.
        if (s.default === undefined) b.socketHeld = true;
        if (s.label) b.label = s.label;
        if (s.help) b.help = s.help;      // DECLARED HELP SLOT (1a) — carry the optional field tooltip through derivation
        // t720 P1 (a) — CARRY the widget declaration through the derive: a spec's `widget`/`widgetConfig` (e.g. an enum's
        // dropdown options) was silently DROPPED here, so a derived enum rendered an option-less (empty) select. The form
        // needs them to render a populated control. (This was pocket's wcs/attach/datum/shape empty-dropdown root cause.)
        if (s.widget) b.widget = s.widget;
        if (s.widgetConfig) b.widgetConfig = s.widgetConfig;
        if (s.units) b.units = s.units;
        // t1315 — carry the LIVE-DEFAULT key. This derivation is an allow-list, so an un-carried property is silently
        // dropped: the first version of the bar field prefilled on a freshly built def and read its baked default on
        // the registered one, which is the same class of bug the widgetConfig line above was written for.
        if (s.defaultLive) b.defaultLive = s.defaultLive;
        if (s.section) b.section = s.section;
        if (s.group) b.group = s.group;   // canvas-layout grouping (layoutSpecFromOp reads b.group)
        if (s.role) b.role = s.role;      // canvas-layout role (x/y/w/h/… — the draggable handle it drives)
        if (s.relTo != null) b.relTo = s.relTo;   // incremental socket: anchor the point to the op's Nth sim-start (drag writes a delta)
        if (s.when) b.when = s.when;   // gated binding — the form field + the canvas handle show it only when whenOk(when, params)
        // t1349 — CARRY THE DATA-OP GATE. `when` HIDES a field; `gate` GREYS it with a reason (data-op-gated, so it
        // survives postGating). Un-carried it was silently dropped and surfacing's WCS stopped greying in Skim — the
        // live-form symptom, not a spec detail, and the same allow-list class as widgetConfig and defaultLive above.
        if (s.gate) b.gate = s.gate;
        if (s.derived) b.derived = s.derived;   // t1613 — CARRY the derived/writes declarations (the same allow-list drop class as widgetConfig/gate above); wireDerivedFields consumes them
        if (s.writes) b.writes = s.writes;
        if (s.optionGate) b.optionGate = s.optionGate;   // t961 — CARRY the declared per-option enable predicate through the derive (else the dropdown renders no option gate — the same class of drop the widget/widgetConfig carry fixed)
        if (s.anchor) b.anchor = s.anchor;   // composable GUI (PILOT 2) — a DECLARED layout anchor {kind, frame}; layoutSpecFromOp switches on anchor.kind
        if (s.readonly) b.readonly = true;   // t389 — a DRAG-DRIVEN socket: the form field DISPLAYS it (readonly), the canvas handle is the sole editor
        if (s.readonlyHint) b.readonlyHint = s.readonlyHint;
        if (s.formHidden) b.formHidden = true;   // t792 — declared OUT of the form (stays in stack + Blocks); the stock spill
        if (s.link) b.link = s.link;             // t792 — declared deep-link slot {kind, …} → the row-end gear (carry through derive)
        // t1704 — CARRY THE TOKEN-ELIGIBILITY DECLARATION (userOps.js, beside BINDING_TYPES) — same allow-list-drop
        // class as widgetConfig/gate/derived above: un-carried, a spec's tokenEligible/tokenRefusal silently
        // vanishes the moment an op (like corner) re-derives its bindings by identity.
        if (s.tokenEligible) b.tokenEligible = true;
        if (s.tokenRefusal) b.tokenRefusal = s.tokenRefusal;
        if (s.tokenDeferrable) b.tokenDeferrable = true;
        out.push(b);
    }
    return out;
}

/** Convenience: flatten the wrapped stack, then derive. */
export function deriveBindingsFor(stack, specs) {
    return deriveBindings(flattenBlocks(stack), specs);
}

/** t726 P2b — the entryX/entryY bindings for a mill twin, derived BY IDENTITY (match the appended `entry` marker) so its
 *  flat index is found by type — no fixed offset, works whether the twin has 5 or 6 body blocks. These go into def.bindings
 *  (NOT the exported EXEC bindings the as-data goldens iterate), so the wiring goldens stay untouched. */
export function entryBindingsFor(stack) {
    return deriveBindingsFor(stack, [
        { param: 'entryX', type: 'number', key: 'entryX', match: { type: 'entry' }, default: '', label: 'Entry point X', units: 'mm', section: 'GEOMETRY', help: 'Optional rapid-to point before the first cut (leave blank for none) — a safe lead-in position.' },
        { param: 'entryY', type: 'number', key: 'entryY', match: { type: 'entry' }, default: '', label: 'Entry point Y', units: 'mm', section: 'GEOMETRY', help: 'Optional rapid-to point before the first cut (leave blank for none) — a safe lead-in position.' },
    ]);
}

/** t768 P1a — the TOOL-SELECTION spec: bind the op's declared tool NUMBER by IDENTITY (match the appended `toolsel`
 *  marker). ONE shared spec so every mill twin (+ any composed wizard carrying the marker) inherits the same tool picker,
 *  sim cutter, and (Phase 2) change emit — the corner-pilot "prove once, inherit" rule. The tool's diameter + tip SHAPE
 *  derive from the library at sim/carve (one source, no COPY on the op); a free-typed toolDia is the no-table fallback. */
export const TOOL_BINDING_SPECS = [
    {
        param: 'toolNum', type: 'number', key: 'toolNum', match: { type: 'toolsel' }, default: '',
        widget: 'toolpick', label: 'Tool',
        help: 'Pick a tool from the library (Settings -> Tool table). Its diameter + tip shape drive the sim and carve; the typed cutter Ø is the fallback when no tool is picked.',
    },
];

/** The toolNum binding for a mill twin (goes into def.bindings, like entryBindingsFor — not the exported EXEC bindings). */
export function toolBindingsFor(stack) {
    return deriveBindingsFor(stack, TOOL_BINDING_SPECS);
}

/** t720 P1 (a) — collapse duplicate-param bindings into ONE per param, MERGING their declarations so a widget/label
 *  can never be lost to ordering. The FIRST row's identity (blockIndex/key/default/socketHeld) wins (it targets the live
 *  socket); a later duplicate only FILLS a presentational field the first row LACKS (widget/widgetConfig/label/help/
 *  section/units). Replaces the old keep-first `dedupeByParam` (which dropped a widget declared on a non-first duplicate —
 *  the "bore-wcs-populates-while-drill-doesn't" ordering luck). Insertion order is preserved (Map). */
export function mergeBindingsByParam(bindings) {
    const byParam = new Map();
    for (const b of (bindings || [])) {
        const prev = byParam.get(b.param);
        if (!prev) { byParam.set(b.param, { ...b }); continue; }
        for (const k of ['widget', 'widgetConfig', 'label', 'help', 'section', 'units', 'formHidden', 'link']) if (prev[k] === undefined && b[k] !== undefined) prev[k] = b[k];
    }
    return [...byParam.values()];
}
