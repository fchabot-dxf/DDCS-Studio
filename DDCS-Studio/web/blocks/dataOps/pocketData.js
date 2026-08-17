/**
 * blocks/dataOps/pocketData.js — the POCKET clearing built-in as a pure DATA definition (E1 EMIT).
 *
 * Pocket is the FIRST COARSE-atom SUPERSET twin. Unlike drill/slot/surfacing/contour (no structural fork → frozen
 * positional bindings), pocket has TWO structural forks — `strategy` (raster → a parallel clearing + a wall finish /
 * spiral → concentric) + `tooSmall` (a pocket smaller than the tool → a single drill-plunge instead of a stepover). So
 * the template is pocketStack(DEFAULTS, {superset:true}) with GUARD blocks, and the value sockets bind BY IDENTITY
 * (bindingSpecs, re-derived over the PRUNED stack every build — like corner/middle), NOT by frozen (blockIndex,key). The
 * FLAT pocketfill/pocketwall leaves (E0 region-pill→flat reframe) carry every geometry dim as a clean socket.
 *
 * TWO E1 mechanisms this port introduces (approved t468):
 *  · setUserDeriveGuards — `tooSmall` is GEOMETRY-DERIVED (not any single user param), so def.deriveGuards computes
 *    `_tooSmall` from the resolved params + instantiate injects it BEFORE prune, so the tooSmall guard keys on it.
 *  · postInstantiate — the drill arm's x/y are the DERIVED pocket centre; the frozen superset bakes them at the DEFAULT
 *    geometry, so postInstantiate rewrites them from the resolved params (pocketDrillCentre) after prune (corner pattern).
 *
 * FAN-OUT: clearance/feed/plunge/originX/originY drive MULTIPLE sockets (across progstart/placeonstock/stepdown/pocketfill/
 * pocketwall/drill) — a param → N specs, each `optional` (present only in its arm). Every {type} match is UNIQUE per pruned
 * state (each block type appears at most once). Proven byte-identical to pocketStack across strategy × tooSmall (BOTH states)
 * × the 4 shapes × a scalar sweep + cross-dialect (tests/pocket-data-emit.spec.js).
 */
import { pocketStack, pocketTooSmall, pocketDrillCentre, pocketBBox, pocketRidesRaster, pocketRasterGap, pocketToolRefuses, pocketToolRefusal } from '../../wizards/stacks/pocketWizard.js';   // t1444 — the strictly-smaller refusal: its guard + its operator sentence
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { deriveBindingsFor, mergeBindingsByParam, TOOL_BINDING_SPECS } from './deriveBindings.js';
import { withPassesField } from './passesField.js';   // t1613 — the derived `passes` field (declared once, every depth+stepdown twin)
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b — the declared mill entry point (entryX/entryY bind via POCKET_BINDING_SPECS)
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a — the declared tool-selection marker (toolNum binds via POCKET_BINDING_SPECS)
import { pruneGuards } from '../whenGuard.js';
import { pocketInsetRegion, stepoverMm, pocketInsetMm, trueRegionFromFlat } from '../../wizards/ops/pocketfill.js';   // t802 — the tool-inset boundary + ring spacing (one source with the emit); t1406 — the inset NUMBER for the re-pointed arm's derived socket; t2016 — trueRegionFromFlat, the SAME boundary function the real emit calls
import { concentricRings } from '../../wizards/ops/contour.js';   // t802 — the inward offset rings the concentric emit cuts (draw them in the 2D preview)
import { restValid, restRegion, restGreyReason } from '../../wizards/ops/restmachining.js';   // t871 — REST MACHINING: the _rest guard + the corner-sliver preview + the grey-out reason
import { handleScale } from '../../wizards/ops/placement.js';   // t1567 — e6e681e8 wired this into pocketPreviewGeometry's handle placement but never added the import

/** Author defaults — match pocketStack's num() fallbacks AND the built-in Pocket form defaults (index.html p_*). */
export const POCKET_DEFAULTS = {
    shape: 'rect', w: 80, h: 60, dia: 50, sides: 6, toolDia: 6, wallOffset: 0, stepoverPct: 40,
    strategy: 'spiral', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, wcs: 'active',
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
    restTool: 0, restDia: 0, restStepover: 40,   // t871 — REST MACHINING: 0 = no rest pass (byte-identical); a smaller tool clears the corners
};

const WCS_OPTIONS = [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']];
const SHAPE_OPTIONS = [['Rectangle', 'rect'], ['Circle', 'circle'], ['Polygon', 'polygon'], ['Ellipse', 'ellipse']];
const STRATEGY_OPTIONS = [['Spiral (concentric)', 'spiral'], ['Raster (parallel + wall)', 'raster']];
// t800 P6 — DIRECTION: the RASTER scan pattern, labelled per what the kernel (stepover.js fillStrategy) ACTUALLY does.
// bothways = boustrophedon zig-zag (links passes); oneway = climb (lift + rapid back each pass); otherway = conventional
// (same, reversed). Only the raster/scanline path reads it — concentric rings on a circle/rect ignore it (fixed dir), so
// the binding is gated `when strategy is raster` (no whenAny/OR to also catch spiral+polygon/ellipse; bothways is the safe default there).
const DIRECTION_OPTIONS = [['Zig-zag (both ways)', 'bothways'], ['One-way climb', 'oneway'], ['One-way conventional', 'otherway']];
// t804 — DEPTH ENTRY: the per-level descent. Plunge = straight down (default); Ramp = a linear descent at ≤ the angle
// (greys → plunge when the pocket is too small); Helix = a descending helix (the existing helix atom), pitch = mm/rev.
const ENTRY_OPTIONS = [['Plunge (straight)', 'plunge'], ['Ramp', 'ramp'], ['Helix', 'helix']];
const XY_DATUM_OPTIONS = [
    ['Follow stock datum', ''], ['Front Left', 'nn'], ['Front Center', 'cn'], ['Front Right', 'pn'],
    ['Center Left', 'nc'], ['Center', 'cc'], ['Center Right', 'pc'], ['Back Left', 'np'], ['Back Center', 'cp'], ['Back Right', 'pp'],
];
const STOCK_DATUM_OPTIONS = [
    ['Front Left / Top', 'nnp'], ['Front Center / Top', 'cnp'], ['Front Right / Top', 'pnp'],
    ['Center Left / Top', 'ncp'], ['Center / Top', 'ccp'], ['Center Right / Top', 'pcp'],
    ['Back Left / Top', 'npp'], ['Back Center / Top', 'cpp'], ['Back Right / Top', 'ppp'],
];

const G = 'GEOMETRY', T = 'TOOL & CUT';
/** A dim BOTH flat leaves carry → 2 specs: pocketfill (primary — form label/default) + pocketwall (secondary). Both optional
 *  (absent in the drill arm). {type} match is unique per pruned state, so it lands on the sole block of that type. */
const leafPair = (param, key, type, extra) => [
    { param, type, key, match: { type: 'pocketfill' }, optional: true, ...extra },
    { param, type, key, match: { type: 'pocketwall' }, optional: true },
];

/**
 * t1406 — THE TWO PLACES, DISCRIMINATED. A pocket on the re-pointed arm is placed TWICE: the clearing place must hold
 * the `surfaceraster` atom ALONE (absorbingChild is strict, and a mixed body paints the shift onto macro text — the
 * t1349 shear), so the wall finish moved into a place of its own. `deriveBindings` refuses a spec that matches two
 * blocks, and that refusal is the safety feature t871 respected by keeping the rest section inside the single place.
 * The answer is a DECLARED discriminator, not a relaxed matcher: every pocket place carries a `role`, and each spec
 * names the one it drives. The wall's nine are OPTIONAL — that place exists only on the re-pointed raster arm.
 */
const placePair = (param, key, extra) => [
    { param, type: 'number', key, match: { type: 'placeonstock', params: { role: 'clear' } }, ...extra },
    { param, type: 'number', key, match: { type: 'placeonstock', params: { role: 'wall' } }, optional: true },
];
const placeEnumPair = (param, key, extra) => [
    { param, type: 'enum', key, match: { type: 'placeonstock', params: { role: 'clear' } }, ...extra },
    { param, type: 'enum', key, match: { type: 'placeonstock', params: { role: 'wall' } }, optional: true },
];

// ── VALUE bindingSpecs (identity-by-type over the pruned superset) ──────────────────────────────────────────────
// t1758 — MACHINE VARIABLES ROLL OUT, mill family. Pocket is the census's own "shape/dia/sides/w/h pick between
// FOUR structurally different stacks via pocketToolRefuses/pocketRasterGap" worked example (t1704) — traced FRESH
// against the current pocketWizard.js, not copied from that summary, since several params (toolDia/entry/direction)
// turn out to have a STRONGER structural role here than the SAME param name carries on surfacing (see per-param
// notes below — "same name, different wiring", t1704's own warning). wcs binds the SAME `wcs` atom surfacing does
// → eligible, matching surfacing's own wcs classification exactly.
const POCKET_BINDING_SPECS = [
    { param: 'wcs', tokenEligible: true, type: 'enum', key: 'wcs', match: { type: 'wcs' }, default: POCKET_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, label: 'WCS', section: G },
    // placement (placeonstock, always present) — origin ALSO rides the leaves (pocket geometry carries its origin)
    // t1758 — NOT eligible: placeonstock/makePlace bakes originX/Y/offZ into a TEXT-LEVEL coordinate shift computed
    // before the program exists (the exact surfacing originX/offZ shape, t1704) — deferrable, since it's a plain
    // magnitude re-resolved downstream, not a categorical branch.
    ...placePair('originX', 'offX', { tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, default: POCKET_DEFAULTS.originX, label: 'Origin X', section: G }),
    ...placePair('originY', 'offY', { tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, default: POCKET_DEFAULTS.originY, label: 'Origin Y', section: G }),
    { param: 'originX', type: 'number', key: 'originX', match: { type: 'pocketfill' }, optional: true },
    { param: 'originX', type: 'number', key: 'originX', match: { type: 'pocketwall' }, optional: true },
    { param: 'originY', type: 'number', key: 'originY', match: { type: 'pocketfill' }, optional: true },
    { param: 'originY', type: 'number', key: 'originY', match: { type: 'pocketwall' }, optional: true },
    // t1406 — the re-pointed arm's atom carries the pocket's own outline as its frame (x/y/w/h) + a separate `inset`.
    { param: 'originX', type: 'number', key: 'x', match: { type: 'surfaceraster' }, optional: true },
    { param: 'originY', type: 'number', key: 'y', match: { type: 'surfaceraster' }, optional: true },
    // t1758 — placeonstock-bound datum enums, SAME atom + shape as surfacing's own stockAttach/pathDatum/stockDatum
    // (t1704: eligible — the datum CODE string reaches the atom directly, no text-shift math on the code itself).
    ...placeEnumPair('stockAttach', 'stockAttach', { tokenEligible: true, default: POCKET_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Attach to Stock', section: G }),
    ...placeEnumPair('pathDatum', 'pathDatum', { tokenEligible: true, default: POCKET_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS }, label: 'Path Datum', section: G }),
    ...placeEnumPair('stockDatum', 'stockDatum', { tokenEligible: true, formHidden: true, default: POCKET_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS }, label: 'Stock Datum', section: G }),
    // t1758 — the stock SIZE feeds the same baked text-shift as position (surfacing's own stockW/H/Z shape, t1704).
    ...placePair('stockW', 'stockW', { tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, default: POCKET_DEFAULTS.stockW, label: 'Stock W', section: G }),
    ...placePair('stockH', 'stockH', { tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, default: POCKET_DEFAULTS.stockH, label: 'Stock H', section: G }),
    ...placePair('stockZ', 'stockZ', { tokenRefusal: 'The stock size feeds the same baked coordinate shift as position — it can\'t be read from the controller before the program is built.', tokenDeferrable: true, formHidden: true, default: POCKET_DEFAULTS.stockZ, label: 'Stock Z', section: G }),
    ...placePair('offZ', 'offZ', { tokenRefusal: 'This position is baked into every coordinate in the program by a text-level shift, computed before the program exists — it can\'t be read from the controller at that point.', tokenDeferrable: true, default: POCKET_DEFAULTS.offZ, label: 'Z Offset', section: G }),
    // geometry (fan-out to both leaves)
    // t1758 — shape/dia/sides/w/h: t1704's own worked example — these pick between structurally different region
    // walks (rect analytic / circle-polygon-ellipse JS contour) AND feed pocketTooSmall/pocketMaxToolDia, deciding
    // whether the pocket refuses everywhere or degenerates to a single plunge. Never deferrable — a categorical
    // shape/count decision, not a magnitude a downstream atom merely re-resolves.
    { param: 'shape', tokenRefusal: 'Picks the region-walk shape (an analytic rectangle vs a JS contour walk for circle/polygon/ellipse) and feeds the too-small/refusal check — a categorical decision about which program gets built, not a value inside one.', type: 'enum', key: 'shape', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.shape, widget: 'dropdown', widgetConfig: { options: SHAPE_OPTIONS }, label: 'Shape', section: G },
    { param: 'shape', type: 'enum', key: 'shape', match: { type: 'pocketwall' }, optional: true },
    ...leafPair('w', 'w', 'number', { tokenRefusal: 'Sets the pocket size, which decides whether the tool fits at all (too-small refuses everywhere) and the placed footprint\'s bounding box — the program\'s shape depends on this number before it can be built.', default: POCKET_DEFAULTS.w, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Width', section: G }),   // t722 P2a — per-shape visibility
    ...leafPair('h', 'h', 'number', { tokenRefusal: 'Sets the pocket size, which decides whether the tool fits at all (too-small refuses everywhere) and the placed footprint\'s bounding box — the program\'s shape depends on this number before it can be built.', default: POCKET_DEFAULTS.h, when: { param: 'shape', in: ['rect', 'ellipse'] }, label: 'Height', section: G }),
    ...leafPair('dia', 'dia', 'number', { tokenRefusal: 'Sets the pocket size, which decides whether the tool fits at all (too-small refuses everywhere) and the placed footprint\'s bounding box — the program\'s shape depends on this number before it can be built.', default: POCKET_DEFAULTS.dia, when: { param: 'shape', in: ['circle', 'polygon'] }, label: 'Diameter', section: G }),
    ...leafPair('sides', 'sides', 'number', { tokenRefusal: 'Picks the polygon\'s vertex count — a different JS contour walk, not a value inside one.', default: POCKET_DEFAULTS.sides, when: { param: 'shape', is: 'polygon' }, label: 'Sides', section: G }),
    // t800 P6 — the CLEARING cluster (strategy → direction → stepover) lands together right after shape/size (strategy, the
    // structural driver, is spliced in ahead of these in pocketDataDef). direction gates to raster — the only path the kernel scans.
    // t1758 — direction picks which WALK PATTERN gets written (zig-zag / one-way climb / one-way conventional) — a
    // different text sequence, the same "content-shape" class as corner's travelShape (Dogleg vs Diagonal).
    { param: 'direction', tokenRefusal: 'Picks the raster walk pattern (zig-zag, one-way climb, one-way conventional) — a different sequence of moves gets written, not a value inside one.', type: 'enum', key: 'direction', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.direction, widget: 'dropdown', widgetConfig: { options: DIRECTION_OPTIONS }, label: 'Direction', section: T, group: 'clearing', when: { param: 'strategy', is: 'raster' }, help: 'Raster scan pattern: Zig-zag links passes back-and-forth (fastest); One-way lifts and rapids back before each pass for a consistent climb (or conventional) cut. Applies to the raster passes — concentric rings keep their fixed direction.' },
    // t1758 — stepoverPct: a clamp-and-derive magnitude (feeds the ring spacing, mirrors surfacing's own stepoverPct
    // exactly) — it does NOT feed pocketTooSmall/pocketRasterGap, so it's deferrable, not categorical.
    { param: 'stepoverPct', tokenRefusal: 'Combined with the tool diameter to resolve the ring spacing before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, type: 'number', key: 'stepoverPct', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.stepoverPct, section: T, group: 'clearing' },   // t1662 — label from SHARED_LABELS
    // t804 — DEPTH ENTRY (in the clearing cluster): the per-level descent + its per-mode fields (when-gated).
    // t1758 — entry is STRUCTURAL here (unlike surfacing's own entry, which is eligible): pocketRasterGap's own
    // envelope check reads it to decide whether the pocket rides the parametric `surfaceraster` atom at all or
    // falls back to the literal arm — a stronger, arm-selecting role surfacing's entry does not have. Same param
    // name, different wiring (t1704's own warning) — traced from pocketWizard.js:145-159, not assumed from surfacing.
    { param: 'entry', tokenRefusal: 'Decides which of the two program arms gets built (the parametric raster atom or the literal fallback) — a categorical choice, not a value inside one.', type: 'enum', key: 'entry', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', section: T, group: 'clearing', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle (degrades to plunge, with the reason, on a pocket too small for it). Helix = a descending helix at the helix Ø, pitch mm per rev.' },
    // t1758 — rampAngle/helixDia: clamp-and-derive magnitudes (surfaceraster.js:1420 `Math.min(45, Math.max(0.5,
    // rampAngle))`, :1528 `helixDia > 0 ? helixDia/2 : ...` — a fallback pick, not an arm/count decision) — matches
    // surfacing's own rampAngle/helixDia exactly, deferrable. helixPitch is DIFFERENT: it directly sets the winding
    // COUNT (surfaceraster.js:1530 `Math.max(0.1, helixPitch)` feeds how many turns the helix makes) — matches
    // surfacing's own helixPitch, which t1704 marked refused-NOT-deferrable for the identical reason.
    { param: 'rampAngle', tokenRefusal: 'The descent angle is used to compute the ramp\'s run (a trig calculation baked into the move) before the program is built.', tokenDeferrable: true, type: 'number', key: 'rampAngle', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.rampAngle, label: 'Ramp Angle', section: T, group: 'clearing', when: { param: 'entry', is: 'ramp' }, units: '°', help: 'Max descent angle of the ramp (degrees from horizontal). Shallower = gentler on the tool; too shallow needs a longer run than a small pocket has (then it degrades to a straight plunge).' },
    { param: 'helixDia', tokenRefusal: 'The helix diameter is baked into the radius of every winding move — computed before the program is built.', tokenDeferrable: true, type: 'number', key: 'helixDia', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.helixDia, label: 'Helix Ø', section: T, group: 'clearing', when: { param: 'entry', is: 'helix' }, units: 'mm', help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped so the helix + tool stays inside the pocket.' },
    { param: 'helixPitch', tokenRefusal: 'Directly decides how many windings the descending helix contains — the program\'s SHAPE depends on this number before it can be built.', type: 'number', key: 'helixPitch', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.helixPitch, label: 'Helix Pitch', section: T, group: 'clearing', when: { param: 'entry', is: 'helix' }, units: 'mm/rev', help: 'How far the helix descends per full revolution (mm/rev). Smaller = gentler entry, more revolutions.' },
    // t1758 — toolDia: a STRONGER role than surfacing's own toolDia (clamp-and-derive-stepover only) — pocket's
    // toolDia ALSO feeds pocketMaxToolDia -> pocketToolRefuses (whether the pocket cuts ANYTHING at all) and
    // pocketTooSmall (plunge-fallback vs stepover). A categorical arm/refusal decision, not a coercion casualty —
    // same param name as surfacing's, different wiring (pocketWizard.js:65-99), so NOT deferrable here.
    ...leafPair('toolDia', 'toolDia', 'number', { tokenRefusal: 'The tool diameter decides whether this pocket can be cut at all (too large refuses everywhere) and whether it degenerates to a single plunge — a categorical decision, not a value inside one.', default: POCKET_DEFAULTS.toolDia, section: T }),   // t1662 — label from SHARED_LABELS
    // t1758 — wallOffset: the SAME pocketTooSmall/pocketMaxToolDia math toolDia feeds (pocketWizard.js:66-67,83-90)
    // — a categorical too-small/refusal input, not a coercion casualty.
    ...leafPair('wallOffset', 'wallOffset', 'number', { tokenRefusal: 'Combines with the tool diameter to decide whether this pocket can be cut at all, or degenerates to a single plunge — a categorical decision, not a value inside one.', default: POCKET_DEFAULTS.wallOffset, label: 'Wall Offset ±', section: T, help: 'Signed wall offset (mm): + cuts OVERSIZE (walls out), − cuts UNDERSIZE / leaves stock. 0 = the exact typed size.' }),
    // t1758 CORRECTION — like plunge/clearance above, pocketfill.js's own kernel reads feed via hard `num()`, not
    // surfaceraster.js's val() pass-through — a magnitude re-resolved downstream, deferrable not eligible.
    ...leafPair('feed', 'feed', 'number', { tokenRefusal: 'This value is re-resolved by the pocket-fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, default: POCKET_DEFAULTS.feed, label: 'Feed', section: T }),
    // depth pass (stepdown, clearing arm) + the TOO-SMALL arm carry the SAME params at different keys.
    // t1391 — the too-small arm's leaf is `holecycle` now, not the literal `drill`: pocket's fallback re-points through the
    // parametric family so that atom can retire. Every key carries straight over (depth/peck/feed/clearance all exist on
    // holecycle), which is why this is a target change and not a re-spec.
    // t1758 CORRECTION — depth/stepdown bind to the `stepdown` atom (kind:'depth'), NOT `surfaceraster`: I first
    // wrote these eligible by wrongly borrowing surfacing's verdict, which applies ONLY to surfacing's OWN
    // surfaceraster-bound depth/stepdown (that atom runs its Z-loop as a controller-side runtime IF/GOTO). Pocket's
    // literal `stepdown` block is different: blockEmitter.js:305-318 (`kind==='depth'`) computes `depthLevels(to,
    // by)` in JS and JS-UNROLLS one body copy per array element (`levels.forEach`) — the emitted line COUNT depends
    // on the resolved value. It also runs `unresolvableBounds` first and REFUSES LOUDLY in the G-code comment if to
    // /by don't resolve — the exact "decide program shape" class, not a coercion casualty. NOT deferrable.
    { param: 'depth', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', type: 'number', units: 'mm', key: 'to', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.depth, label: 'Depth', section: T },
    { param: 'depth', type: 'number', units: 'mm', key: 'depth', match: { type: 'holecycle' }, optional: true },
    { param: 'stepdown', tokenRefusal: 'Sets how many Z-descent levels get built into the program (JS-unrolled at build time) — the program\'s SHAPE depends on this number, not a value inside one.', type: 'number', units: 'mm', key: 'by', match: { type: 'stepdown' }, optional: true, default: POCKET_DEFAULTS.stepdown, label: 'Step Down', section: T },
    { param: 'stepdown', type: 'number', units: 'mm', key: 'peck', match: { type: 'holecycle' }, optional: true },
    // t1758 — confirmEvery decides whether the confirm-and-pause step EXISTS at all (0 = off) — matches surfacing's
    // own confirmEvery exactly (t1704: "decides whether the confirm-and-pause step exists at all"); ALSO caught by
    // the SAME unresolvableBounds refuse-loudly check as depth/stepdown above (blockEmitter.js:308).
    { param: 'confirmEvery', tokenRefusal: 'Decides whether the confirm-and-pause step exists at all — a threshold check made before the program is built, not a value read from one field.', type: 'number', key: 'confirmEvery', match: { type: 'stepdown' }, optional: true, default: 0, label: 'Confirm every N passes', section: T, help: 'Pause + show a message + halt (M0) after every N depth passes (not the last) so you can clear chips / check the part, then press Cycle Start. 0 = off. A MACHINE pause — not visible in the sim.' },   // t1031
    // t1758 CORRECTION — plunge/feed/clearance bind to `pocketfill`/`pocketwall`/`progstart`/`holecycle`, whose OWN
    // kernels (pocketfill.js:134, programFraming.js's makeStart) read them via a hard `num(p.x, default)` with NO
    // val()-pass-through the way surfaceraster.js's identical fields do — a magnitude embedded straight into a move
    // line, no branch on the value. Deferrable (a coercion casualty, not a shape decision), like corner's hopDist.
    // plunge → both leaves + the HOLE's feed (the fallback plunges at the plunge feed); clearance → progstart + both leaves + the hole
    { param: 'plunge', tokenRefusal: 'This value is re-resolved by the pocket-fill atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, type: 'number', units: 'mm/min', key: 'plunge', match: { type: 'pocketfill' }, optional: true, default: POCKET_DEFAULTS.plunge, label: 'Plunge', section: T },
    { param: 'plunge', type: 'number', units: 'mm/min', key: 'plunge', match: { type: 'pocketwall' }, optional: true },
    { param: 'plunge', type: 'number', units: 'mm/min', key: 'feed', match: { type: 'holecycle' }, optional: true },
    { param: 'clearance', tokenRefusal: 'This value is re-resolved by the framing atom itself before the program is built — it can\'t carry a live value yet.', tokenDeferrable: true, type: 'number', units: 'mm', key: 'clearance', match: { type: 'progstart' }, default: POCKET_DEFAULTS.clearance, label: 'Clearance', section: T },
    // t1758 — rpm: socket-held (no default → the blank keeps the machine Head), matching surfacing's own rpm
    // exactly ("falls back to the tool library's RPM when left blank — that fallback decision runs before the
    // program is built").
    { param: 'rpm', tokenRefusal: 'Falls back to the tool library\'s RPM when left blank — that fallback decision runs before the program is built.', tokenDeferrable: true, type: 'number', key: 'rpm', match: { type: 'progstart' }, label: 'Spindle RPM', section: T, help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },   // t996 — rpm → progstart (no default → socket-held: blank keeps the Head)
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'pocketfill' }, optional: true },
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'pocketwall' }, optional: true },
    { param: 'clearance', type: 'number', units: 'mm', key: 'clearance', match: { type: 'holecycle' }, optional: true },
    // t726 P2b — the entry-point declaration. IN the bindingSpecs (not entryBindingsFor) so it RE-DERIVES over the PRUNED
    // stack each instantiate (pocket's entry index shifts with strategy/tooSmall — a static superset index would miss).
    /**
     * ── t1406 — THE RE-POINTED ARM'S SOCKETS, all OPTIONAL because the arm is one pruned state among several ───────
     *
     * On the parametric arm there is no `pocketfill` leaf and (on spiral) no `stepdown` either — one `surfaceraster`
     * carries the geometry, the depth walk and the descent. These rows are the same params landing on that block
     * instead, so a form edit reaches the emit in EITHER state without the form knowing which one it is in.
     *
     * TWO PARAMS DELIBERATELY HAVE NO ROW HERE, and each absence is a decision rather than an omission:
     *   shape / dia / sides   the arm is rect-only by predicate — a non-rect pocket prunes to the literal arm, where
     *                         those sockets exist. A row here would bind a socket that cannot exist.
     *   wallOffset            it has no socket on the atom AT ALL: it is folded with toolDia into ONE number, `inset`.
     *                         A derived socket that no single param drives is exactly what `postInstantiate` is for
     *                         (the drill centre and the place bbox are already there) — so `inset` is written from the
     *                         resolved params through `pocketInsetMm`, the same one source the literal arm reads.
     *
     * t1418 — `direction` MOVED OUT OF THAT LIST AND INTO THE ROWS BELOW. It was excluded because the atom ignored the
     * word: binding it would have written a value nothing read and made a one-way request LOOK honoured. The atom now
     * walks all three directions, so the exclusion would have the opposite effect — a form edit that reached the
     * literal arm and silently died on the parametric one. The row is bare (no widget/label/help) for the same reason
     * `entry`'s is: the UI metadata lives on the literal-arm row above, which is the CANONICAL binding stack the form
     * is derived over, and duplicating it would create a second source for one control's words.
     */
    { param: 'w', type: 'number', key: 'w', match: { type: 'surfaceraster' }, optional: true },
    { param: 'h', type: 'number', key: 'h', match: { type: 'surfaceraster' }, optional: true },
    { param: 'toolDia', type: 'number', key: 'toolDia', match: { type: 'surfaceraster' }, optional: true },
    { param: 'stepoverPct', type: 'number', key: 'stepoverPct', match: { type: 'surfaceraster' }, optional: true },
    { param: 'direction', type: 'enum', key: 'direction', match: { type: 'surfaceraster' }, optional: true },   // t1418 — the atom walks it now
    { param: 'entry', type: 'enum', key: 'entry', match: { type: 'surfaceraster' }, optional: true },
    { param: 'rampAngle', type: 'number', key: 'rampAngle', match: { type: 'surfaceraster' }, optional: true },
    { param: 'helixDia', type: 'number', key: 'helixDia', match: { type: 'surfaceraster' }, optional: true },
    { param: 'helixPitch', type: 'number', key: 'helixPitch', match: { type: 'surfaceraster' }, optional: true },
    { param: 'feed', type: 'number', key: 'feed', match: { type: 'surfaceraster' }, optional: true },
    { param: 'plunge', type: 'number', key: 'plunge', match: { type: 'surfaceraster' }, optional: true },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'surfaceraster' }, optional: true },
    { param: 'depth', type: 'number', key: 'depth', match: { type: 'surfaceraster' }, optional: true },
    { param: 'stepdown', type: 'number', key: 'stepdown', match: { type: 'surfaceraster' }, optional: true },
    { param: 'confirmEvery', type: 'number', key: 'confirmEvery', match: { type: 'surfaceraster' }, optional: true },
    /**
     * ── t1433 — THE WALL'S OWN SOCKETS, on the re-pointed arm ─────────────────────────────────────────────────────
     *
     * `wallfinish` appears in exactly ONE pruned state (`_para: true` × `strategy: raster`), so every row is OPTIONAL
     * and the `{type}` match is unique wherever it lands — the same contract the `surfaceraster` rows above sit under.
     *
     * THE ROWS THE WALL DOES NOT GET, each an absence with a reason rather than an omission:
     *   shape / dia / sides   the arm is rect-only by predicate; the literal arm carries those sockets.
     *   wallOffset            no socket on the atom at all — it is folded with `toolDia` into ONE number, `inset`,
     *                         which `postInstantiate` writes from `pocketInsetMm`. The SAME derived-socket route the
     *                         `surfaceraster` inset takes, from the SAME one source, which is what keeps the fill and
     *                         the wall insetting by the same number rather than by two agreeing computations.
     *   toolDia / stepoverPct the wall has no stepover and reads no tool: its ring is `inset` and nothing else.
     *   direction / entry     the wall has one walk and one descent (see wallfinish.js) — there is nothing to select.
     *
     * `confirmEvery` LANDS HERE NOW as well as on the `stepdown`. Before the re-point the raster arm's cadence lived
     * on the wall's StepDown; that block is gone from this arm, so a form edit would have reached nothing.
     */
    { param: 'originX', type: 'number', key: 'x', match: { type: 'wallfinish' }, optional: true },
    { param: 'originY', type: 'number', key: 'y', match: { type: 'wallfinish' }, optional: true },
    { param: 'w', type: 'number', key: 'w', match: { type: 'wallfinish' }, optional: true },
    { param: 'h', type: 'number', key: 'h', match: { type: 'wallfinish' }, optional: true },
    { param: 'depth', type: 'number', key: 'depth', match: { type: 'wallfinish' }, optional: true },
    { param: 'stepdown', type: 'number', key: 'stepdown', match: { type: 'wallfinish' }, optional: true },
    { param: 'feed', type: 'number', key: 'feed', match: { type: 'wallfinish' }, optional: true },
    { param: 'plunge', type: 'number', key: 'plunge', match: { type: 'wallfinish' }, optional: true },
    { param: 'clearance', type: 'number', key: 'clearance', match: { type: 'wallfinish' }, optional: true },
    { param: 'confirmEvery', type: 'number', key: 'confirmEvery', match: { type: 'wallfinish' }, optional: true },
    // t1758 CORRECTION — the entry-waypoint's own emit (blockEmitter.js:555, applyEntryWaypoint) reads it via
    // `num(e.params.entryX, NaN)`, then ε-compares against the program's own derived cut entry (firstRapidXY) to
    // decide whether to SPLICE AN EXTRA G0 LINE into the emitted text (blockEmitter.js:567-570) — presence/absence
    // of an entire line, the same class as confirmEvery ("decides whether the step exists at all"), not a magnitude
    // merely re-resolved downstream. NOT deferrable (corrected from my own first pass, which under-weighted this).
    { param: 'entryX', tokenRefusal: 'Decides whether an extra lead-in rapid gets inserted before the cut (an ε-comparison against the program\'s own derived entry point) — not a value inside an existing move.', type: 'number', key: 'entryX', match: { type: 'entry' }, default: '' },
    { param: 'entryY', tokenRefusal: 'Decides whether an extra lead-in rapid gets inserted before the cut (an ε-comparison against the program\'s own derived entry point) — not a value inside an existing move.', type: 'number', key: 'entryY', match: { type: 'entry' }, default: '' },
    // t768 P1a — the tool-selection declaration. IN the bindingSpecs (re-derived over the pruned stack each instantiate).
    ...TOOL_BINDING_SPECS,
];

/** The strategy fork is a STRUCTURAL driver (guard key), no block socket — declared as a bindingless (blockIndex-free)
 *  binding so withGuardDefaults fills it before prune + the form renders it. tooSmall is NOT here (it's the derive-hook). */
// t871 — the rest fields GREY (with the why) on a smooth shape: circle/ellipse have no corners → no rest to clear. The
// r2 ≥ r1 case is caught at emit (restValid false → byte-identical) + the restGreyReason (declared why); the shape gate is
// what whenOk can express declaratively (no param-to-param compare / OR).
const SMOOTH_GATE = { param: 'shape', in: ['circle', 'ellipse'], tip: 'Smooth walls (circle / ellipse) leave no corner material — there is no rest to clear.' };
// t1758 — strategy: the guard-fork driver itself (raster adds the wallfinish pass + a different clearing atom
// shape; spiral does not) — categorical, not deferrable, the same class as corner's own structural toggles.
// restDia: gates the ENTIRE rest pass's existence via restValid -> the geometry-derived `_rest` guard — categorical,
// not deferrable (deciding whether an atom exists, not re-resolving a magnitude). restStepover: only clamps the
// rest ring spacing (restmachining.js's restStepMm, `Math.max(0.15, ...)`) — a coercion casualty, deferrable, the
// same shape as the main stepoverPct. restTool: has NO socket of its own (bindingless, per the comment below) — it
// only auto-fills restDia's UI field; a token here would never reach the emit at all.
const POCKET_STRUCT_BINDINGS = [
    { param: 'strategy', tokenRefusal: 'Raster adds a wall-finish pass and a different clearing atom shape than Spiral — a categorical choice of which program gets built, not a value inside one.', help: "Clearing pattern: Spiral = concentric offset rings inward (no wall pass); Raster = parallel zig-zag passes then a wall-finish pass.", type: 'enum', default: POCKET_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: STRATEGY_OPTIONS }, label: 'Strategy', section: T, group: 'clearing' },   // t800 P6 — group:'clearing' + spliced ahead of direction/stepover so it LEADS the cluster
    // t871 — REST MACHINING: a smaller 2nd tool clears the corner material this tool leaves. restTool picks the tool (fills
    // restDia); restDia > 0 on a cornered shape (rect/polygon) appends the rest pass. Bindingless (structural drivers of the
    // geometry-derived _rest guard) so they always render + drive prune; the value sockets bind on the pocketrest leaf.
    { param: 'restTool', tokenRefusal: 'This field only auto-fills Rest tool Ø below (its own picker fills restDia) — it has no socket of its own and never reaches the emit.', type: 'number', default: POCKET_DEFAULTS.restTool, widget: 'toolpick', widgetConfig: { fill: { dia: 'restDia' } }, label: 'Rest tool', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'REST MACHINING: pick a SMALLER second tool to clear the corner material this tool leaves (rect + polygon only — smooth walls have no corners). Its Ø fills Rest tool Ø below.' },
    { param: 'restDia', tokenRefusal: 'Turns the whole rest pass on or off (zero = none) — changes how many atoms the program contains, not a value inside one.', type: 'number', default: POCKET_DEFAULTS.restDia, label: 'Rest tool Ø', units: 'mm', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'Diameter of the rest tool (mm) — must be SMALLER than the main tool Ø. 0 = no rest pass (byte-identical). Filled by the Rest tool picker, or type it.' },
    { param: 'restStepover', tokenRefusal: 'Combined with the rest tool diameter to resolve the rest ring spacing before the program is built — it can\'t be read from the controller at that point.', tokenDeferrable: true, type: 'number', default: POCKET_DEFAULTS.restStepover, label: 'Rest stepover %', section: T, group: 'rest', gate: SMOOTH_GATE, help: 'Stepover of the rest tool as a % of its Ø (like the main stepover). Only used when a rest tool is set.' },
];

// t867 — FEEDS & SPEEDS: the material picker + the advisory "Suggest feed" button (the feedsuggest composite widget).
// A bindingless binding (no socket) in TOOL & CUT next to Feed — it drives NO G-code, so an unset/empty material is
// byte-identical; a picked material round-trips like a dropdown (the widget's read omits it when empty).
const MATERIAL_BINDING = { param: 'material', type: 'enum', default: '', widget: 'feedsuggest', label: 'Material', section: T, help: 'Feeds & speeds helper: pick the stock material, then ✨ Suggest fills Feed from the tool Ø / flutes and the declared spindle (RPM = surface speed ÷ circumference, clamped to the spindle range; feed = RPM × flutes × chip load). Advisory — it never overwrites until you click, and you own the final numbers.' };

export const POCKET_DATA_OPTYPE = 'user_pocket_data';

const _pn = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
// t718 — bbox over a set of {pts} paths (the origin-inclusive boundary extent, for the layout placement-parity shift).
const _pbb = (ps) => { let b = null; for (const p of (ps || [])) for (const q of (p.pts || [])) { if (!b) b = { minX: q.x, maxX: q.x, minY: q.y, maxY: q.y }; else { if (q.x < b.minX) b.minX = q.x; if (q.x > b.maxX) b.maxX = q.x; if (q.y < b.minY) b.minY = q.y; if (q.y > b.maxY) b.maxY = q.y; } } return b; };
/** t716 — DECLARED preview geometry (twin-level): the pocket boundary (the finished-wall outline) PER SHAPE KIND — the
 *  multishape solved by declaration (the twin knows p.shape) — + a pos handle (originX/originY) + a size handle per kind
 *  (circle/polygon → radial Ø; rect/ellipse → rect W×H). Mirrors the built-in pocketView.buildPocketSpec. Preview-side → emit unaffected. */
// t2016 — the boundary RING now comes from `trueRegionFromFlat`, the SAME function pocketfill.js's real emit
// calls to get the tool-centre boundary (this WAS the strongest triplication PREVIEW-AS-DATA.md found: this
// dispatch, pocketfill.js's own copy, and pocketWizard.js's structural-guard copy each hand-typed the same
// shape→region mapping independently). Collapses to ONE call, not a new declaration — pocketWizard.js's own
// copy feeds a genuinely different consumer (derive-guards) and is left untouched, out of scope for a preview fix.
// Byte-identical for rect/polygon/ellipse (same field names, same regionDesc() call underneath); circle's drawn
// ring gets MORE segments (96 vs the old hand-rolled 48) since it now reads the same higher-fidelity contour the
// real clearing math already uses — a deliberate fidelity change, not a silent one, named here.
function _boundaryRing(p) {
    const ring = (trueRegionFromFlat(p).contour || [])[0] || [];
    return ring.length > 1 ? [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })) : [];
}
export function pocketPreviewGeometry(p) {
    const ox = _pn(p.originX, 0), oy = _pn(p.originY, 0), shape = p.shape || 'rect';
    const hs = handleScale(p, '', ox, oy, _pn(p.w, 80), _pn(p.h, 60));
    const paths = [], handles = [{ type: 'point', id: 'pk_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos', ...hs.pos }];
    const boundary = _boundaryRing(p);
    if (shape === 'circle') {
        const R = _pn(p.dia, 50) / 2;
        if (boundary.length) paths.push({ pts: boundary, cls: 'fc-guide' });
        handles.push({ type: 'radial', id: 'pk_size', field: 'dia', cx: ox, cy: oy, r: R, a: hs.size.a, rScale: 2, minR: 1, label: 'Ø' });
    } else if (shape === 'polygon') {
        if (boundary.length) paths.push({ pts: boundary, cls: 'fc-guide' });
        handles.push({ type: 'radial', id: 'pk_size', field: 'dia', cx: ox, cy: oy, r: _pn(p.dia, 50) / 2, a: hs.size.a, rScale: 2, minR: 1, label: 'Ø' });
    } else if (shape === 'ellipse') {
        if (boundary.length) paths.push({ pts: boundary, cls: 'fc-guide' });
        handles.push({ type: 'rect', id: 'pk_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size, ax: ox + hs.pos.ax, ay: oy + hs.pos.ay, ex: hs.size.ex / 2, ey: hs.size.ey / 2 });
    } else {
        if (boundary.length) paths.push({ pts: boundary, cls: 'fc-path' });
        handles.push({ type: 'rect', id: 'pk_size', field: 'w', fieldH: 'h', minw: 1, minh: 1, label: 'W×H', ...hs.size });
    }
    // t718 — the origin-inclusive boundary bbox: the twin's pocket geometry emits 0-relative (origin rides the placement
    // offX), so the layout consumer places against THIS drawn-frame bbox → the pocket frames the traced clearing passes.
    const bbox = _pbb(paths);   // the boundary bbox — computed BEFORE the inner rings (which are ⊂ the boundary anyway)
    // t802 — CONCENTRIC strategy: draw the actual inward offset RINGS the emit cuts, from the SAME concentricRings source
    // (over the tool-inset region) — so the 2D layout shows the octagon/ellipse clearing pattern, not just the boundary,
    // and the drawn rings equal the cut rings by construction. (Raster keeps the boundary-only preview.)
    if ((p.strategy || 'spiral') === 'spiral') {
        try {
            for (const ring of concentricRings(pocketInsetRegion(p), stepoverMm(p))) {
                if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-guide' });
            }
        } catch (_) { /* degenerate pocket (smaller than the tool) — no rings to draw */ }
    }
    // t871 — REST regions: the corner slivers a smaller 2nd tool clears, drawn in a DISTINCT colour (fc-rest) between the
    // r1- and r2-cleared boundaries. Only when a valid rest tool is declared on a cornered shape (rect/polygon).
    try {
        const rest = restRegion(p);
        if (rest) for (const ring of [rest.ring1, rest.ring2]) {
            if (ring && ring.length > 1) paths.push({ pts: [...ring, ring[0]].map((q) => ({ x: q.x, y: q.y })), cls: 'fc-rest' });
        }
    } catch (_) { /* no rest to draw */ }
    return { paths, handles, bbox };
}

/** The wrapped superset template: pocketStack(DEFAULTS, {superset:true}) under the user_root/panel/sim/param_group prefix. */
function pocketDataStack(defaults) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'Pocket' }, children: [] },
        ],
        children: appendToolSel(appendEntry(pocketStack(defaults, { superset: true }))),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing)
    }];
}

// The FORM bindings are DERIVED over a CANONICAL-pruned stack (raster + big pocket → every clearing socket present once)
// then DEDUPED by param (fan-out yields N specs per param; the form wants ONE — keep the first, which carries the label).
// t1406 — `_para: false` PINS THE CANONICAL STACK TO THE LITERAL ARM, and that is the deliberate call. The canonical
// stack is what the FORM's labels/defaults derive from, and only the literal arm carries a socket for every param:
// shape, Ø, sides and Wall Offset have none on the re-pointed arm (see the spec block above). Deriving the form over the
// parametric arm would silently DROP four fields from the wizard — a feature loss dressed as a binding detail. The
// parametric sockets are reached at instantiate instead, where bindingSpecs re-derive over the PRUNED stack per state.
// (`_rest: true` already forces `_para` false via pocketRasterGap; it is written out so the canonical state is stated
// rather than implied by another flag's side effect.)
// t1444 — `_refuse: false` IS WRITTEN OUT, and the omission is what caught it: `pruneGuards` matches on a strict ===,
// so a guard key this bag does not name drops BOTH of its arms — the canonical stack lost its whole body and every
// binding spec then "matched 0 blocks". A new derived fork has to be stated here in the same act that adds it, which
// is exactly why this state is spelled out rather than implied by another flag's side effect (see the note above).
const CANONICAL_BIND = { ...POCKET_DEFAULTS, strategy: 'raster', _refuse: false, _tooSmall: false, _rest: true, _para: false, restDia: 3 };   // t871 — _rest+a real restDia so the pocketrest leaf is present → restDia/restStepover derive their bindings
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(pocketDataStack(POCKET_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const POCKET_BINDINGS = mergeBindingsByParam(deriveBindingsFor(canonicalPrunedStack(), POCKET_BINDING_SPECS));

/** Build the pocket-as-data def — the superset-twin pattern (corner/middle): bindingSpecs (emit re-derivation) + a
 *  structural strategy toggle + the derive-guards hook (_tooSmall) + postInstantiate (the derived drill centre). */
export function pocketDataDef() {
    // t800 P6 — the CLEARING cluster reads strategy → direction → stepover. strategy is the structural driver (appended
    // separately, so it would otherwise trail at the form's end); splice it in just before the first derived clearing
    // binding (direction) so the toggle LEADS its gated dependents, right after shape/size.
    const clAt = POCKET_BINDINGS.findIndex((b) => b.group === 'clearing');
    const withStrategy = clAt < 0
        ? [...POCKET_BINDINGS, ...POCKET_STRUCT_BINDINGS]
        : [...POCKET_BINDINGS.slice(0, clAt), ...POCKET_STRUCT_BINDINGS, ...POCKET_BINDINGS.slice(clAt)];
    // t867 — the feeds-helper sits right after Feed in the TOOL & CUT cluster (it fills that field).
    const fdAt = withStrategy.findIndex((b) => b.param === 'feed');
    const orderedBindings = fdAt < 0
        ? [...withStrategy, MATERIAL_BINDING]
        : [...withStrategy.slice(0, fdAt + 1), MATERIAL_BINDING, ...withStrategy.slice(fdAt + 1)];
    const def = userOpFromStack('pocket_data', 'Pocket (data)', pocketDataStack(POCKET_DEFAULTS),
        withPassesField(orderedBindings), 'form3d+2d');   // t726 P2b — entryX/entryY are in POCKET_BINDINGS (via the specs, re-derived by bindingSpecs); t1613 — the derived `passes` field, spliced after stepdown
    def.bindingSpecs = POCKET_BINDING_SPECS;                       // re-derive value sockets BY IDENTITY over the PRUNED stack each build
    // t1406 — `_para`: does this pocket's rect clearing ride `surfaceraster`? GEOMETRY- AND ENVELOPE-derived (shape,
    // tool vs size, a rest tool, direction, and the atom's own PROVEN table), so it cannot be a plain param guard. The
    // predicate is `pocketRasterGap`'s — ONE source shared with the concrete build, so the twin and the wizard can
    // never disagree about which arm a given pocket is on. That agreement IS the byte-identity claim.
    // t1444 — `_refuse`: strictly smaller than its tool → no motion at all. Geometry-derived like its two neighbours,
    // and read from the SAME one source the concrete build uses (`pocketToolRefuses`), so the twin and the wizard
    // cannot disagree about which side of the user's equal-is-fine line a given pocket falls on.
    def.deriveGuards = (p) => ({ _refuse: pocketToolRefuses(p || {}), _tooSmall: pocketTooSmall(p || {}), _rest: restValid(p || {}) && !pocketTooSmall(p || {}), _para: pocketRidesRaster(p || {}) });   // t871 — _rest: a valid smaller rest tool on a cornered pocket (GEOMETRY-DERIVED, injected before prune)
    def.postInstantiate = (stack, resolved) => {                  // rewrite the DERIVED sockets the frozen superset baked at DEFAULT geometry
        const { cx, cy } = pocketDrillCentre(resolved || {});     // the too-small arm's plunge point (geometry-derived)
        const bb = pocketBBox(resolved || {});                    // the PlaceOnStock footprint bbox (drives placementShift's corner; baked-stale otherwise → a phantom shift)
        const r = resolved || {};
        for (const b of flattenBlocks(stack)) {
            if (!b || !b.params) continue;
            // t1391 — x0/y0, NOT x/y: holecycle ABSORBS the placement, so the place fold hands it the shift through x/y.
            // Writing the centre there would collide with the placement; x0/y0 is the pattern's own origin (see pocketWizard).
            if (b.type === 'holecycle') { b.params.x0 = cx; b.params.y0 = cy; }
            // t1444 — THE REFUSAL SENTENCE IS A DERIVED SOCKET TOO, and forgetting it would have been the worst kind of
            // wrong: the frozen superset bakes the note at DEFAULT geometry, so a twin refusing a 6.35mm pocket would
            // have told the operator about an 80mm one. Same failure `pocketDrillCentre` is here for, one arm along.
            else if (b.type === 'assign' && b.params.var === '#1505') { b.params.note = `ERROR: ${pocketToolRefusal(r)}`; }
            else if (b.type === 'placeonstock') { b.params.bminX = bb.minX; b.params.bmaxX = bb.maxX; b.params.bminY = bb.minY; b.params.bmaxY = bb.maxY; }
            // t1406 — `inset` is DERIVED from toolDia AND wallOffset together, so no single binding can drive it; it
            // belongs here with the other derived sockets rather than being re-derived at emit. `pocketInsetMm` is the
            // same one source the literal arm's `pocketInsetRegion` reads, so the two arms inset by the same number.
            // t1433 — the WALL's inset is the SAME derived socket, from the SAME one source. Written here beside the
            // fill's rather than in a second place: two computations of "how far in" that merely agree today is
            // exactly the split `pocketInsetMm` was declared to close (t1402 measured them disagreeing in SIGN).
            else if (b.type === 'surfaceraster' || b.type === 'wallfinish') { b.params.inset = pocketInsetMm(r); }
            else if (b.type === 'pocketrest') {   // t871 — the rest leaf is frozen at DEFAULT geometry in the superset; rewrite ALL its params from the resolved op (one source, no fan-out bindings)
                for (const k of ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'restDia', 'restStepover', 'depth', 'feed', 'plunge', 'clearance']) if (r[k] !== undefined) b.params[k] = r[k];
                if (r.stepdown !== undefined) b.params.by = r.stepdown;
            }
        }
        return spindleHeadPatch(stack);   // t945 — after the derived-socket rewrite, fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    };
    /**
     * t1410 — THE BOUNDARY'S OWN WORDS, for the CAM table's why-column. `classifyExposable` reads this when it has
     * resolved the arm: '' when the op rides the parametric atom, else the reason it does not — `pocketRasterGap`,
     * the SAME one-source predicate the concrete build and the `_para` guard read. So a one-way raster pocket's greyed
     * Expose control says "a one-way raster keeps its literal fill — the walk is always both-ways…" instead of a
     * generic "geometry / fold-driven", and the operator learns which knob to change to get the knob back.
     */
    def.armGap = (p) => pocketRasterGap(p || {});
    def.previewGeometry = pocketPreviewGeometry;   // t716 — per-feature 2D handles (shape boundary + pos/size per kind) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b — the emitting-square entry marker (replaces the sim-only ○)
    def.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // t1021 — DECLARE the depth ruler (a vertical strip down the LEFT of the 2D plan): depth/stepdown drive the floor + the depthLevels ticks. Display/input only.
    return def;
}
