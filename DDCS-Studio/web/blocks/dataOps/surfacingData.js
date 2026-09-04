/**
 * blocks/dataOps/surfacingData.js — the SURFACING (facing) built-in expressed as a pure DATA definition (Stage 5, the
 * 3rd port — the first FILL-family op, and the first to validate the restructure-to-flat reframe end-to-end).
 *
 * WHY surfacing is now a clean port: the wizard was RESTRUCTURED (not the format extended — north-star directive 1).
 *   • FLAT geometry — the old StepOver(Region) hid w/h in an object PILL the value-glow skipped (and the glow-overflow
 *     that masqueraded as a "Blockly bridge recursion" lived there). Lifted to a dedicated `surfacefill` atom with flat
 *     shape/x/y/w/h sockets (web/wizards/ops/surfaceFill.js). [[glow-safety-childless-multiplier]]
 *   • COMPUTED stepover — surfacingStack now accepts a FLAT `stepover` (the FORM precomputes tool·%); the data-def binds
 *     that one socket. No tool·% math in the stack → a clean 1-param→1-socket binding.
 *   • MAPPED strategy — surfacingStack takes the socket value directly ('parallel'/'concentric'); the form's 'raster'
 *     still maps to 'parallel' (byte-identical), so the data-def binds the real socket value.
 *   • FAN-OUT originX — the fill region is defined LOCALLY at (0,0) and PlaceOnStock owns the part position (offX =
 *     originX), so originX/originY are a SINGLE placement socket (bound to block 2), bindable exactly like drill —
 *     instead of being woven through surfacefill.x + the bbox. Byte-identical: placementShift anchors the bbox min-corner
 *     (x = originX − bbox.minX), so region-at-0 + shift originX == the old region-at-originX + shift 0.
 *
 * Proven BYTE-IDENTICAL (no stripAnnotations — surfacing's comments are static) to surfacingStack across a sweep spanning
 * placement offsets, size, stepover, parallel/concentric, depth, feeds, WCS and stock-attach (tests/surfacing-as-data.spec.js).
 *
 * REMAINING FRONTIER (intentionally unbound, like drill): `clearance` FANS OUT to progstart (block 0) + the surfacefill
 * leaf (block 4) — a binding is 1 param → 1 socket, so it is held at its default (frontier #3). Everything else binds.
 *
 * Scope note: the template is SEEDED from surfacingStack(SURFACING_DEFAULTS) (== BUILDERS(defaults), the canonical
 * valid-by-construction stack); the hand-authored BINDINGS map is the INDEPENDENT artifact, proven two ways by the spec
 * (emit-equivalence sweep + structural binding-wiring). Stage 6 authors the template independently (self-host); not this one.
 */
import { surfacingStack } from '../../wizards/stacks/surfacingWizard.js';
import { stepoverPctOf } from '../../wizards/ops/surfaceraster.js';   // t1363 — the ONE reading of a stored stepover
import { num } from '../../wizards/ops/util.js';
import { userOpFromStack } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { applySkimStructure } from './skimStructure.js';   // t986 — the Skim Z-mode structural fork (whole-op G91 relative to the jog); Normal = byte-identical
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor, deriveBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings); t1349 — the BODY bindings are by identity too
import { withPassesField } from './passesField.js';   // t1613 — the derived `passes` field (declared once, every depth+stepdown twin)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, SURFACING_STRATEGY_OPTIONS, ENTRY_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options (were undeclared → empty dropdowns); t842 ENTRY_OPTIONS

/** Author defaults — match surfacingStack's own num() fallbacks (+ flat stepover/strategy) so the seeded template == the
 *  true default stack. stepover 7.2 == the default tool·% (Ø12 · 60%); strategy 'parallel' == the form's default 'raster'. */
export const SURFACING_DEFAULTS = {
    w: 100, h: 80, toolDia: 12, stepoverPct: 60, strategy: 'parallel', depth: 0.5, stepdown: 0.5,
    entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1,   // t842 — depth entry (plunge default = byte-identical)
    clearance: 5, feed: 2000, plunge: 200, wcs: 'active', zMode: 'normal',   // t986 — zMode: Normal (absolute WCS) | Skim (whole-op G91 relative to the jog)
    // placement (makePlace) — region is local-0-based, so originX/originY are the placement offset (offX/offY) like drill.
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

/**
 * t1349 — THE BINDINGS NAME THEIR BLOCK BY IDENTITY, NOT BY POSITION.
 *
 * They used to be a hand-counted flat index into surfacingStack's pre-order — `0 progstart · 1 wcs · 2 placeonstock ·
 * 3 stepdown · 4 surfacefill · 5 progend` — plus a `WRAP_PREFIX_COUNT = 4` for the user_root/panel/sim/param_group
 * prefix. Two hand-counts, both silent when wrong: the shipped corner break (deriveBindings' own header) was exactly
 * that, an off-by-one that mis-bound every socket after it.
 *
 * WHY NOW, specifically: the parametric switch COLLAPSES `stepdown{ surfacefill }` into one block, so every index from
 * 3 down moves and `progend` goes 5→4. Under hand-counted indices that is a silent re-aim of ten bindings onto the
 * wrong sockets; under identity it is nothing at all — the scan re-finds each block by what it IS. This is the change
 * landing FIRST for that reason, and it is deliberately EMIT-NEUTRAL: the same params reach the same sockets, proven
 * byte-identical by the as-data equivalence sweep. It is a prerequisite of the switch, not a piece of it.
 *
 * Each spec below matches the SOLE block of its type in the surfacing template — asserted by deriveBindings itself,
 * which throws at build time on a zero or ambiguous match rather than binding to whatever landed at that index.
 *
 * (clearance is still deliberately NOT bound — frontier #3 fan-out to progstart + the fill leaf. surfacefill's
 *  shape/x/y/z/direction stay at their constants: shape='rect', x=y=0 [local], z='z', direction='bothways'.)
 *
 * t2377 — SECTION ABSENCE, fixed: only `wcs` and `zMode` (SURFACING_STRUCT, below) carried `section:` at all
 * before this turn, and both the WRONG name (`'COORDINATES'`, a section the shell does not have). Same
 * mechanism as t2375's contour/slot fix (see contourData.js's own header comment above CONTOUR_EXEC_BINDINGS
 * for the full account of why array order, not just the `section:` string, drives formWidgets.js's own
 * rendered grouping) — reordered into four contiguous groups matching the shell (index.html:745-791) exactly:
 * AREA (originX/originY/offZ/[hidden stock+jog fields]/w/h) -> TOOL (toolNum/rpm) -> TOOL & STEPOVER
 * (strategy/toolDia/stepoverPct) -> DEPTH & FEED (depth/stepdown/zMode/wcs/feed/plunge). confirmEvery and the
 * entry/rampAngle/helixDia/helixPitch cluster have no shell field at all (grepped index.html's own
 * wiz_surfacing block, zero hits) — twin-only, the same orphan class contour/drill/pocket already carry;
 * placed in DEPTH & FEED, the closest conceptual fit. entryX/entryY (also no shell field) sit in AREA, next
 * to the other geometry fields — the same placement contour gave its own entryX/entryY.
 */
const SURFACING_BINDING_SPECS = [
    // AREA
    // placement scalars (placeonstock) — origin owned by the placement now (region is local-0-based).
    // t1706 CORRECTION (was wrongly `tokenEligible` under Act 2 — found live, driving the real app, Act 3):
    // surfacingStack's OWN JS never touches these, but the placeonstock ATOM's fold does — placeShiftFromParams
    // (wizards/ops/placement.js) feeds them into placementShift, which computes a shift and BAKES it into every
    // coordinate in the emitted text via translateProgram (a text-level number rewrite, not a `#var` reference).
    // That fold needs a REAL NUMBER to compute the shift and rewrite literal coordinates — a token can't survive
    // it. Act 2's survey checked the WIZARD layer (correctly, nothing there touches these) but not this ATOM-FOLD
    // layer one step further downstream — the gap this correction closes. Deferrable: the arithmetic itself is
    // simple (a corner-anchor offset), so a future redesign emitting SYMBOLIC offsets instead of baked literals
    // could make these eligible — not something the current text-shift mechanism does.
    { param: 'originX', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offX', type: 'number', default: SURFACING_DEFAULTS.originX, section: 'AREA' },
    { param: 'originY', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offY', type: 'number', default: SURFACING_DEFAULTS.originY, section: 'AREA' },
    { param: 'offZ', tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, match: { type: 'placeonstock' }, key: 'offZ', type: 'number', default: SURFACING_DEFAULTS.offZ, section: 'AREA' },
    { param: 'stockAttach', tokenEligible: true, match: { type: 'placeonstock' }, key: 'stockAttach', type: 'enum', default: SURFACING_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'AREA' },
    { param: 'pathDatum', tokenEligible: true, match: { type: 'placeonstock' }, key: 'pathDatum', type: 'enum', default: SURFACING_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, section: 'AREA' },
    { param: 'stockDatum', tokenEligible: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockDatum', type: 'enum', default: SURFACING_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, section: 'AREA' },
    { param: 'stockW', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockW', type: 'number', default: SURFACING_DEFAULTS.stockW, section: 'AREA' },
    { param: 'stockH', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockH', type: 'number', default: SURFACING_DEFAULTS.stockH, section: 'AREA' },
    { param: 'stockZ', tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, match: { type: 'placeonstock' }, key: 'stockZ', type: 'number', default: SURFACING_DEFAULTS.stockZ, section: 'AREA' },
    // t1704 — w/h are NOT eligible: surfacingWizard.js's generate() compares `w<=0||h<=0` to decide whether ANY
    // cutting atom exists at all (an empty program vs the real stack), in ADDITION to feeding the placement bbox —
    // a live token can't tell JS whether the faced area is degenerate before the program is built.
    { param: 'w', tokenRefusal: 'Width and height decide whether the program has any cutting moves at all (zero degrades to an empty program) and set the placed area\'s bounding box — the program\'s SHAPE depends on this number before it can be built.', help: "Width of the faced area (X). The tool overhangs the edge by its radius.", match: { type: 'surfaceraster' }, key: 'w', type: 'number', default: SURFACING_DEFAULTS.w, units: 'mm', section: 'AREA' },
    { param: 'h', tokenRefusal: 'Width and height decide whether the program has any cutting moves at all (zero degrades to an empty program) and set the placed area\'s bounding box — the program\'s SHAPE depends on this number before it can be built.', help: "Height of the faced area (Y).", match: { type: 'surfaceraster' }, key: 'h', type: 'number', default: SURFACING_DEFAULTS.h, units: 'mm', section: 'AREA' },
    // TOOL & STEPOVER
    // t1704 — strategy is a value-select (parallel/concentric) written straight into the raster atom's OWN field;
    // unlike pocket's `strategy` (which also gates whether an extra wall-finish block is appended), surfacing's
    // never branches which atoms get built — the row-vs-ring choice is the atom-kernel's own internal logic.
    { param: 'strategy', tokenEligible: true, help: "Facing pattern: Raster = parallel zig-zag; Concentric = spiral.", match: { type: 'surfaceraster' }, key: 'strategy', type: 'enum', default: SURFACING_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: SURFACING_STRATEGY_OPTIONS }, section: 'TOOL & STEPOVER' },
    // t1704 — toolDia/stepoverPct are DEFERRABLE-CANDIDATES: the JS here is a clamp (Math.max) then a single value
    // into one atom param (surfacingWizard.js:99, surfaceraster.js's stepoverPctOf) — no atom-count effect, no
    // branch. A controller-side MAX()-equivalent expression could compute the same clamp; that's an act-3 design
    // option, not something this wizard does today (num()/Math.max still discard a token before either runs).
    { param: 'toolDia', tokenRefusal: 'The cutter diameter is clamped and used to derive the stepover before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, help: "Cutter diameter (mm). The stepover is derived from it at the machine, so changing the tool on the pendant re-derives the raster.", match: { type: 'surfaceraster' }, key: 'toolDia', type: 'number', default: SURFACING_DEFAULTS.toolDia, units: 'mm', section: 'TOOL & STEPOVER' },
    { param: 'stepoverPct', tokenRefusal: 'Combined with the tool diameter to resolve the stepover before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, help: "Stepover as a PERCENTAGE of the cutter. The intent is the percentage; the millimetre is only its consequence, and the macro header re-derives it — which is why a stored mm is not bound here.", match: { type: 'surfaceraster' }, key: 'stepoverPct', type: 'number', default: SURFACING_DEFAULTS.stepoverPct, units: '%', section: 'TOOL & STEPOVER' },
    // DEPTH & FEED — depth pass (stepdown)
    { param: 'depth', tokenEligible: true, match: { type: 'surfaceraster' }, key: 'depth', type: 'number', default: SURFACING_DEFAULTS.depth, units: 'mm', section: 'DEPTH & FEED' },
    { param: 'stepdown', tokenEligible: true, match: { type: 'surfaceraster' }, key: 'stepdown', type: 'number', default: SURFACING_DEFAULTS.stepdown, units: 'mm', section: 'DEPTH & FEED' },
    // t2377 — confirmEvery has NO shell field at all — twin-only, same orphan class contour/drill/pocket carry.
    // t1706 CORRECTION (found live, driving the real app — Act 2's survey checked only the wizard layer, not
    // this atom's own emit): surfaceraster.js's confirmEvery = Math.max(0, Math.round(num(...))) — a threshold
    // decision (whether the confirm-pause mechanism exists at all), not a value carried through untouched.
    { param: 'confirmEvery', tokenRefusal: 'Decides whether the confirm-and-pause step exists at all — a threshold check made before the program is built, not a value read from one field.', match: { type: 'surfaceraster' }, key: 'confirmEvery', type: 'number', default: 0, label: 'Confirm every N passes', section: 'DEPTH & FEED', help: 'Pause + show a message + halt (M0) after every N depth passes (not the last) so you can clear chips / check the part, then press Cycle Start. 0 = off. A MACHINE pause — not visible in the sim.' },   // t1031
    // t1704 — wcs is a plain value default (`wcs.params = { wcs: params.wcs || 'active' }`, no comparison anywhere
    // else in surfacingStack) — unlike corner/middle's wcs, which forks WHICH content lands in several atoms.
    { param: 'wcs', tokenEligible: true, match: { type: 'wcs' }, key: 'wcs', type: 'enum', default: SURFACING_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, section: 'DEPTH & FEED',
        gate: { param: 'zMode', is: 'skim', tip: 'Skim faces RELATIVE to the jog start — there is no WCS frame to select.' } },   // t986 — grey (data-op-gated) in Skim
    { param: 'feed', tokenEligible: true, match: { type: 'surfaceraster' }, key: 'feed', type: 'number', default: SURFACING_DEFAULTS.feed, units: 'mm/min', section: 'DEPTH & FEED' },
    { param: 'plunge', tokenEligible: true, match: { type: 'surfaceraster' }, key: 'plunge', type: 'number', default: SURFACING_DEFAULTS.plunge, units: 'mm/min', section: 'DEPTH & FEED' },
    // t842 — DEPTH ENTRY cluster (per-level descent + its per-mode when-gated fields; toward-centre ramp like pocket — an area fill)
    // t1704 — entry is a value-select written straight into the raster atom's own field; unlike slot's `entry`
    // (which forces the literal, non-raster arm when ==='helix'), surfacing's never branches which atoms get
    // built — ramp/helix descent is the atom-kernel's own internal logic, same shape as `strategy` above.
    { param: 'entry', tokenEligible: true, match: { type: 'surfaceraster' }, key: 'entry', type: 'enum', default: SURFACING_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', section: 'DEPTH & FEED', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle. Helix = a descending helix at the helix Ø, pitch mm/rev (clamped to fit).' },
    // t1706 CORRECTION (found live — Act 2's survey checked only the wizard layer, not the atom's own emit):
    // rampAngle is baked into a tan()-derived literal inside the ramp move's macro expression (surfaceraster.js
    // ~1045: "the tangent is baked; the angle is a form field, not a knob") — trig computed at generate time, no
    // live-word support. helixPitch DIRECTLY drives the helix's move COUNT (surfaceraster.js:673, Math.ceil(...)
    // *24 — a real loop count, non-deferrable). helixDia feeds the same helix's computed RADIUS baked into every
    // winding's coordinates (surfaceraster.js:1528). None carry a live word today.
    { param: 'rampAngle', tokenRefusal: 'The descent angle is used to compute the ramp\'s run (a trig calculation baked into the move) before the program is built.', tokenDeferrable: true, match: { type: 'surfaceraster' }, key: 'rampAngle', type: 'number', default: SURFACING_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, section: 'DEPTH & FEED', help: 'Max descent angle of the ramp (degrees from horizontal). Too shallow for the area degrades to a plunge, with the reason.' },
    { param: 'helixDia', tokenRefusal: 'The helix diameter is baked into the radius of every winding move — computed before the program is built.', tokenDeferrable: true, match: { type: 'surfaceraster' }, key: 'helixDia', type: 'number', default: SURFACING_DEFAULTS.helixDia, label: 'Helix Ø', units: 'mm', when: { param: 'entry', is: 'helix' }, section: 'DEPTH & FEED', help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped so the helix + tool stays inside the area.' },
    { param: 'helixPitch', tokenRefusal: 'Directly decides how many windings the descending helix contains — the program\'s SHAPE depends on this number before it can be built.', match: { type: 'surfaceraster' }, key: 'helixPitch', type: 'number', default: SURFACING_DEFAULTS.helixPitch, label: 'Helix Pitch', units: 'mm/rev', when: { param: 'entry', is: 'helix' }, section: 'DEPTH & FEED', help: 'How far the helix descends per full revolution (mm/rev). Smaller = gentler.' },
    // TOOL — t996 — RPM binding → the framing progstart. SOCKET-HELD: blank → the socket keeps the
    // spindleHeadPatch Head default (byte-identical); a typed value / a picked tool's library rpm OVERRIDES it
    // (rpm>0 → M3 S<rpm> + spindleHeadPatch yields).
    // t1704 — DEFERRABLE-CANDIDATE: programFraming.js's rpm-fallback is a single comparison picking ONE number for
    // ONE atom field, not an atom-count decision.
    { param: 'rpm', tokenRefusal: 'Falls back to the tool library\'s RPM when left blank — that fallback decision runs before the program is built.', tokenDeferrable: true, match: { type: 'progstart' }, key: 'rpm', type: 'number', socketHeld: true, label: 'Spindle RPM', section: 'TOOL', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },
];

/** The body bindings for a surfacing twin, derived BY IDENTITY over the ALREADY-WRAPPED stack — so the
 *  user_root/panel/sim/param_group prefix falls out for free (the old hand-kept WRAP_PREFIX_COUNT = 4). */
export function surfacingBindingsFor(stack) { return deriveBindingsFor(stack, SURFACING_BINDING_SPECS); }

// t986 — the STRUCTURAL Z-mode toggle (NO value socket): it drives the applySkimStructure postInstantiate fork, not a
// block param. Grouped with the WCS dropdown in the shell's own DEPTH & FEED section (t2377 — was the WRONG,
// non-existent 'COORDINATES' name; see the fix note above SURFACING_BINDING_SPECS). Skim greys the WCS
// (structGate below → data-op-gated).
// t1609 — EXPORTED: the hand-coded surfacing modal consumes THIS declaration for its Z-mode field (options, label,
// help, default) — one source, no copied list in the view. The paired WCS gate rides SURFACING_BINDINGS (the wcs
// binding's `gate`), exported below.
// t2545 — moved ABOVE `surfacingFieldGroups`/`SURFACING_BINDINGS` (was below, when nothing at module-init time
// depended on it yet): `surfacingFieldGroups` now reads this at `buildSurfacingTwinStack()` time, itself called
// by `SURFACING_BINDINGS`'s own module-init line below — referencing a later `const` before its own
// initializer runs is a TDZ ReferenceError, not a stale-value bug, so it fails LOUD (caught live: the whole
// app failed to boot, breaking even unrelated tests like corner's own, until this reorder).
export const SURFACING_STRUCT = [
    // t1704 — not deferrable: Normal (absolute, WCS-referenced) and Skim (whole-op relative, jog-anchored) are
    // different program FRAMINGS (makePlace vs makeSkim, different wrapper atoms) — not two values of one move.
    { param: 'zMode', type: 'enum', tokenRefusal: 'Normal and Skim are two different program framings (absolute vs. whole-operation relative) — picking one decides which framing atoms get built, not a value inside one.', default: SURFACING_DEFAULTS.zMode, label: 'Z-mode', section: 'DEPTH & FEED', widget: 'dropdown',
        widgetConfig: { options: [['Normal — WCS Z0', 'normal'], ['Skim — relative', 'skim']] },
        help: 'Normal: cut at absolute Z, referencing the WCS Z0 (set your datum first). Skim: whole-operation RELATIVE — jog to a corner, touch the surface, face from there (no WCS datum). Skim ignores the WCS.' },
];

/**
 * t2545 (BACKLOG #71/#72, the section migration) — the four ordered/grouped field lists, computed ONCE and
 * shared by both consumers that need this EXACT order: `buildSurfacingTwinStack()` (to build the declared
 * `group_box`/`field_ref` tree) and `surfacingDataDef()` (the flat binding array `userOpFromStack` receives,
 * unchanged in content/order from before this turn). Same pure derivation, called on the SAME stack shape
 * from both places, rather than two hand-kept copies of "what's in AREA, in what order" that could silently
 * drift apart — exactly the hazard t2375/t2377's own header comments both name (array order, not just the
 * `section:` string, drives grouping). A single source makes that drift structurally impossible rather than
 * merely avoided by care. Depends only on `stack`'s `children` (the exec atom body) — `match:{type:...}`
 * predicates target exec-atom types (placeonstock/surfaceraster/wcs/progstart/entry/toolsel), none of which
 * collide with the tree-only node types (`group_box`/`field_ref`/`param_group`/`split_horizontal`) — so
 * calling this BEFORE the final uiChildren tree exists (a bootstrap stack with the same `children` but no
 * tree yet) returns the identical param list/order as calling it AFTER, which is what makes building the
 * field_ref tree from its own output, then re-deriving the real bindings from the FINISHED stack, safe.
 */
function surfacingFieldGroups(stack) {
    const derived = surfacingBindingsFor(stack);
    const areaFields = derived.filter((b) => b.section === 'AREA');
    const toolStepoverFields = derived.filter((b) => b.section === 'TOOL & STEPOVER');
    const depthFeed = derived.filter((b) => b.section === 'DEPTH & FEED');
    const wcsIdx = depthFeed.findIndex((b) => b.param === 'wcs');
    // t2377 — zMode (SURFACING_STRUCT — a separate array; the structural Z-mode toggle has no value socket)
    // spliced into DEPTH & FEED between confirmEvery and wcs, matching the shell's own field order there.
    const depthFeedFields = [...depthFeed.slice(0, wcsIdx), ...SURFACING_STRUCT, ...depthFeed.slice(wcsIdx)];
    const rpmField = derived.filter((b) => b.section === 'TOOL');
    const entryXY = entryBindingsFor(stack).map((b) => ({ ...b, section: 'AREA' }));
    const toolNum = toolBindingsFor(stack).map((b) => ({ ...b, section: 'TOOL' }));
    return {
        AREA: [...areaFields, ...entryXY],
        TOOL: [...toolNum, ...rpmField],
        TOOL_STEPOVER: toolStepoverFields,
        DEPTH_FEED: withPassesField(depthFeedFields),   // t1613 — the derived `passes` field, spliced after stepdown
    };
}

/** Derived over the CANONICAL stack — the same one surfacingDataDef builds, so this export is the def's own binding
 *  set (the as-data spec iterates it to prove each param reaches the socket surfacingStack routes it to). */
export const SURFACING_BINDINGS = surfacingBindingsFor(buildSurfacingTwinStack());

// t1648 — THE START-POSITION MARKER: ONE declared target, mode-dependent (user-ruled: "the gui serve differently
// in skim or wcs but it should look the same" — one widget, the MODE picks what it writes to, never a second
// widget). Normal/WCS: the marker IS the existing pos handle — it writes the REAL origin offset (originX/originY,
// already bound to placeonstock.offX/offY — the emit MOVES). Skim: the program is RELATIVE to wherever the
// operator jogs, so origin has no meaning there — the marker instead writes PREVIEW-ONLY jog coords (jogX/jogY,
// never bound to any socket — merged into params like every other declared param, but nothing downstream reads
// them for emit) that seed the live-frame registers (#790/#791/#792) for the TRACE preview only; the emitted
// program is untouched (it already reads the live frame at the machine).
//
// DECLARED ONCE, HERE, IN THE DATA LAYER (user-ruled: "is it better to make the wizard as data now" — yes) — BOTH
// faces read this same mapping: `surfacingPreviewGeometry` below (the twin's canvas) and `buildSurfacingSpec` in
// `wizards/views/surfacingView.js` (the built-in's canvas) each resolve the marker's target through
// `startMarkerTarget(zMode)`, so there is exactly one place that ever states "skim writes jogX/jogY, normal writes
// originX/originY" — a second wizard with a relative-vs-WCS mode would export + reuse the SAME shape (see
// WORK-LOG for the rollout survey), not restate it.
export const START_MARKER_TARGET = {
    normal: { x: 'originX', y: 'originY' },
    skim: { x: 'jogX', y: 'jogY' },
};
export function startMarkerTarget(zMode) { return START_MARKER_TARGET[zMode] || START_MARKER_TARGET.normal; }

// t1650 review finding — this expression was hand-copied verbatim into BOTH faces (the exact "fifth instance" shape
// t1638 collapsed for block mouths). ONE declaration: Skim seeds the live-frame registers (#790/#791/#792) from the
// marker's jogX/jogY so the PREVIEW traces where the operator will jog; Normal/WCS seeds nothing (null clears any
// stale seed from a mode flip — the marker there drives originX/originY, a REAL param, so the emit already moves).
export function startMarkerVarSeed(params) {
    return params.zMode === 'skim' ? [[790, num(params.jogX, 0)], [791, num(params.jogY, 0)], [792, 0]] : null;
}

export const SURFACING_DATA_OPTYPE = 'user_surfacing_data';

const _n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
import { handleScale } from '../../wizards/ops/placement.js';

/** t716/t1648 — DECLARED preview geometry (twin-level): the face-area rectangle (the region extent, at the placement
 *  origin) as a path + a size handle (w/h) + the START-POSITION marker (the same `sf_pos`/'pos' handle t716 always
 *  had — ONE widget, not a second one). Mirrors the built-in surfacingView.buildSurfacingSpec; handles write the
 *  TWIN params directly (preview-side → emit unaffected by the drag ITSELF; whether the WRITTEN param reaches the
 *  emit depends entirely on which param `startMarkerTarget` names, per the declared mode-target mapping above). */
export function surfacingPreviewGeometry(p) {
    const ox = _n(p.originX, 0), oy = _n(p.originY, 0), w = _n(p.w, 100), h = _n(p.h, 80);
    const hs = handleScale(p, '', ox, oy, w, h);
    const tgt = startMarkerTarget(p.zMode);
    // t1648 — SKIM: the marker is a FREE jog point (jogX/jogY), not a corner of the faced-area rect, so it carries NO
    // datum-corner anchor (ax/ay stay 0 — an absolute point). Normal/WCS: byte-identical to the original pos handle
    // (the exact same `x:ox,y:oy,...hs.pos` spread t716 always used).
    const posGeom = p.zMode === 'skim' ? { x: _n(p.jogX, 0), y: _n(p.jogY, 0), labelDir: hs.pos.labelDir } : { x: ox, y: oy, ...hs.pos };
    // t1674 — the DRAWN path follows posGeom (mirrors surfacingView.buildSurfacingSpec, both faces): Skim's program
    // is relative to wherever the operator jogs, so the faced area IS at the jog point — the ONE declared marker
    // target, not a second origin-vs-jog source. handleScale's ox/oy argument (hs.size, the resize-handle anchor)
    // and `bbox` below (the PLACEMENT-frame extent — a separate, real-emit-affecting concern, untouched by the
    // preview-only jog) both stay on originX/originY exactly as before.
    const px = posGeom.x, py = posGeom.y;
    const paths = [{ pts: [{ x: px, y: py }, { x: px + w, y: py }, { x: px + w, y: py + h }, { x: px, y: py + h }, { x: px, y: py }], cls: 'fc-path' }];
    // t1674 — noSnap for Skim (mirrors surfacingView.js, both faces): once the drawn path also tracks the jog marker,
    // the generic itemsBBox-derived snap offsets (_snapOffsets) become self-referential to the dragged handle,
    // widening the normal small-tolerance snap into a virtual net spanning the whole w×h rect — never intended for a
    // marker explicitly documented as having no corner semantics.
    const handles = [
        { type: 'point', id: 'sf_pos', fx: tgt.x, fy: tgt.y, label: 'pos', noSnap: p.zMode === 'skim', ...posGeom },
        { type: 'rect', id: 'sf_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size },
    ];
    // t718 — the origin-inclusive region bbox: the twin's surfacing geometry emits 0-relative (origin rides the placement
    // offX), so the layout consumer places against THIS drawn-frame bbox → the region coincides with the raster trace.
    return { paths, handles, bbox: { minX: ox, maxX: ox + w, minY: oy, maxY: oy + h } };
}

/** The CANONICAL wrapped twin stack — surfacingStack(defaults) inside the user_root/panel/sim/param_group wrapper.
 *  ONE builder, so the stack the bindings are DERIVED over is literally the stack the def is BUILT from: an identity
 *  binding is only as good as the agreement between those two, and a second hand-copy here would reintroduce by the
 *  back door exactly the drift the identity match removes. (A function declaration — it is called at module init.) */
export function buildSurfacingTwinStack() {
    const body = appendToolSel(appendEntry(surfacingStack(SURFACING_DEFAULTS)));   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    // t2545 — a bootstrap stack (same `children`, no tree yet) just to read the ordered/grouped param names
    // surfacingFieldGroups derives — see that function's own header for why this is safe (identity matching
    // depends only on `children`, never on uiChildren's shape).
    const g = surfacingFieldGroups([{ type: 'user_root', params: {}, uiChildren: [], children: body }]);
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2545 (BACKLOG #71/#72, the section migration) — wrapped in split_horizontal so hasTreeLayout()
            // (userOpView.js) routes this twin onto renderUiTree, same mechanism drill already uses (t2299/
            // t2341) — the ONLY existing trigger, unchanged (see that function's own header; NOT widened here).
            // Ratio '360px:*' mirrors the shell's own CSS shorthand exactly, same as drill's own comment states.
            // t2371's own header (userOpView.js) documents that forcing tree mode on surfacing WITHOUT this —
            // no split, no compensating RIGHT-pane visualization, no group_box structure — was tried once and
            // reverted (it blanked the outer .wiz-visual pane and dropped the flat auto-sectioning, 21 failures
            // on the full suite). This is the FULL migration that comment named as the eventual, deliberate
            // fix: the RIGHT pane below supplies the SAME sim visualization the outer pane used to show, and
            // the four `group_box` nodes below supply the SAME section grouping the flat auto-sectioning used
            // to produce — nothing is left blanked or dropped this time, both compensating structures are here.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Surfacing' },
                    children: [
                        // t2545 — usage_text/code_preview, REPRODUCED verbatim from the live shell (index.html:767,
                        // 817-818), not restated from memory: `.wiz-usage`'s own text and the preview block's own
                        // "CODE PREVIEW (DDCS M350 COMPLIANT)" label, mirroring drill's own usage_text-first/
                        // code_preview-last ordering (drillData.js) — both are now asserted by the SAME shared
                        // form-reproduction gate (tests/support/formReproduction.js) drill/pocket already pass,
                        // since switching this def's own reproduction spec to `mode:'tree'` (the shared default)
                        // reaches this comparison for the first time.
                        { type: 'usage_text', params: { text: 'Skims the top of the stock flat over a rectangular area. Opens sized to the whole stock top; drag the handles to face a sub-area. The tool overhangs the area edge by its radius so the whole top is faced — keep the area within fixture clearance. Spindle start + end-of-program come from Settings.' } },
                        // t2271 (wizards-as-data E2 measurement, PILOT) — the dual stock-attach/path-datum corner
                        // picker, FINALLY reachable: t2371's own WORK-LOG entry found this exact declaration had
                        // been dead code since it was written (surfacing was never tree-rendered, and
                        // `renderUiTree`'s own path_anchor branch is the only place it's ever read) — this
                        // migration activates it as a side effect, not a separate fix. Placed first in AREA's own
                        // group (mirrors mountFlatPathAnchor's own "before the stockAttach row" positioning) —
                        // hides the stockAttach/pathDatum rows wherever their own field_ref nodes land below and
                        // mounts the real picker in their place, byParam-driven (position-independent either way).
                        { type: 'path_anchor', params: { prefix: 'sf_' } },
                        { type: 'group_box', params: { title: 'AREA' }, children: fieldRefsOf(g.AREA) },
                        { type: 'group_box', params: { title: 'TOOL' }, children: fieldRefsOf(g.TOOL) },
                        { type: 'group_box', params: { title: 'TOOL & STEPOVER' }, children: fieldRefsOf(g.TOOL_STEPOVER) },
                        { type: 'group_box', params: { title: 'DEPTH & FEED' }, children: fieldRefsOf(g.DEPTH_FEED) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2595 (BACKLOG #71/#72, Phase 1 step 2) — surfacing is now tree-rendered (t2545), so the
                // combined `sim` node this comment used to defer is no longer inert here: split into the same
                // adjacency-merge shape drill already ships (t2511), `preview3d` + `feature_canvas` as ADJACENT
                // RIGHT-pane siblings — byte-identical DOM to the combined shape per t2511's own proof (same
                // ids, same VISUALIZATION label, same pane order, same starting display:none on 3D). `panel:
                // 'form3d+2d'` matches drill's own value (PANEL_TYPES, panelTypes.js) — BOTH panes, matching
                // surfacing's own pre-existing `want2d:true` (the sim node's own default, unchanged behavior).
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: false, magazine: false } },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                ],
            },
        }],
        children: body,
    }];
}

/** Build the surfacing-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is surfacingStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function surfacingDataDef() {
    const stack = buildSurfacingTwinStack();
    // t2377 — order comes out AREA -> TOOL -> TOOL & STEPOVER -> DEPTH & FEED, matching the shell exactly.
    // t2545 — re-derived over the FINAL, real stack (safe — see surfacingFieldGroups' own header on why
    // uiChildren's shape doesn't affect this), the SAME computation buildSurfacingTwinStack already used to
    // build the group_box/field_ref tree above, so the flat binding array below and the declared tree can
    // never disagree about what's in each group or in what order — one source, not two hand-kept copies.
    const g = surfacingFieldGroups(stack);
    const def = userOpFromStack('surfacing_data', 'Surfacing (data)', stack, [...g.AREA, ...g.TOOL, ...g.TOOL_STEPOVER, ...g.DEPTH_FEED], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = surfacingPreviewGeometry;   // t716 — per-feature 2D handles (region extent) via the declared hook
    def.previewVarSeed = startMarkerVarSeed;   // t1648/t1650 — the ONE declared seed shape (see startMarkerVarSeed above)
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // t1025 — the depth ruler strip down the LEFT of the 2D plan (reuses zRulerStrip, like pocket)
    // t945 spindleHeadPatch (blank progstart → live Head) THEN t986 applySkimStructure (Skim: progstart drops the absolute
    // clearance + placeonstock→skim). Normal/absent zMode → both are no-ops → BYTE-IDENTICAL to the frozen template.
    def.postInstantiate = (stack, resolved) => applySkimStructure(spindleHeadPatch(stack), resolved);
    // t1363 — ONE SOURCE for a stored stepover. An op saved before the split carries a flat `stepover` millimetre and
    // no percentage; the twin binds `stepoverPct`, so without this the millimetre reached NO socket and the binding
    // default cut 7.2mm where the saved op cut 9.6. The recovery is not restated here — it is the atom's own declared
    // `stepoverPctOf`, the same one surfacingStack and opCamMap call, so the twin cannot read a stored value
    // differently from the path it is proven byte-identical against.
    def.normalizeParams = (params) => {
        if (!params || params.stepoverPct != null && params.stepoverPct !== '') return params;
        if (!(num(params.stepover, 0) > 0)) return params;   // nothing stored to recover → untouched
        return { ...params, stepoverPct: stepoverPctOf(params) };
    };
    return def;
}
