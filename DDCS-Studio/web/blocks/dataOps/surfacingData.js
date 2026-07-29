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
import { surfacingStack } from '../../wizards/surfacingWizard.js';
import { stepoverPctOf } from '../../wizards/ops/surfaceraster.js';   // t1363 — the ONE reading of a stored stepover
import { num } from '../../wizards/ops/util.js';
import { userOpFromStack } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { applySkimStructure } from './skimStructure.js';   // t986 — the Skim Z-mode structural fork (whole-op G91 relative to the jog); Normal = byte-identical
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor, deriveBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings); t1349 — the BODY bindings are by identity too
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
 */
const SURFACING_BINDING_SPECS = [
    { param: 'wcs', match: { type: 'wcs' }, key: 'wcs', type: 'enum', default: SURFACING_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS }, section: 'COORDINATES',
        gate: { param: 'zMode', is: 'skim', tip: 'Skim faces RELATIVE to the jog start — there is no WCS frame to select.' } },   // t986 — grey (data-op-gated) in Skim
    // placement scalars (placeonstock) — origin owned by the placement now (region is local-0-based)
    { param: 'originX', match: { type: 'placeonstock' }, key: 'offX', type: 'number', default: SURFACING_DEFAULTS.originX },
    { param: 'originY', match: { type: 'placeonstock' }, key: 'offY', type: 'number', default: SURFACING_DEFAULTS.originY },
    { param: 'stockAttach', match: { type: 'placeonstock' }, key: 'stockAttach', type: 'enum', default: SURFACING_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', match: { type: 'placeonstock' }, key: 'pathDatum', type: 'enum', default: SURFACING_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'stockDatum', formHidden: true, match: { type: 'placeonstock' }, key: 'stockDatum', type: 'enum', default: SURFACING_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', formHidden: true, match: { type: 'placeonstock' }, key: 'stockW', type: 'number', default: SURFACING_DEFAULTS.stockW },
    { param: 'stockH', formHidden: true, match: { type: 'placeonstock' }, key: 'stockH', type: 'number', default: SURFACING_DEFAULTS.stockH },
    { param: 'stockZ', formHidden: true, match: { type: 'placeonstock' }, key: 'stockZ', type: 'number', default: SURFACING_DEFAULTS.stockZ },
    { param: 'offZ', match: { type: 'placeonstock' }, key: 'offZ', type: 'number', default: SURFACING_DEFAULTS.offZ },
    // depth pass (stepdown)
    { param: 'depth', match: { type: 'surfaceraster' }, key: 'depth', type: 'number', default: SURFACING_DEFAULTS.depth, units: 'mm' },
    { param: 'stepdown', match: { type: 'surfaceraster' }, key: 'stepdown', type: 'number', default: SURFACING_DEFAULTS.stepdown, units: 'mm' },
    { param: 'confirmEvery', match: { type: 'surfaceraster' }, key: 'confirmEvery', type: 'number', default: 0, label: 'Confirm every N passes', help: 'Pause + show a message + halt (M0) after every N depth passes (not the last) so you can clear chips / check the part, then press Cycle Start. 0 = off. A MACHINE pause — not visible in the sim.' },   // t1031
    // geometry + cut (the surfacefill leaf)
    { param: 'w', help: "Width of the faced area (X). The tool overhangs the edge by its radius.", match: { type: 'surfaceraster' }, key: 'w', type: 'number', default: SURFACING_DEFAULTS.w, units: 'mm' },
    { param: 'h', help: "Height of the faced area (Y).", match: { type: 'surfaceraster' }, key: 'h', type: 'number', default: SURFACING_DEFAULTS.h, units: 'mm' },
    { param: 'toolDia', help: "Cutter diameter (mm). The stepover is derived from it at the machine, so changing the tool on the pendant re-derives the raster.", match: { type: 'surfaceraster' }, key: 'toolDia', type: 'number', default: SURFACING_DEFAULTS.toolDia, units: 'mm' },
    { param: 'stepoverPct', help: "Stepover as a PERCENTAGE of the cutter. The intent is the percentage; the millimetre is only its consequence, and the macro header re-derives it — which is why a stored mm is not bound here.", match: { type: 'surfaceraster' }, key: 'stepoverPct', type: 'number', default: SURFACING_DEFAULTS.stepoverPct, units: '%' },
    { param: 'strategy', help: "Facing pattern: Raster = parallel zig-zag; Concentric = spiral.", match: { type: 'surfaceraster' }, key: 'strategy', type: 'enum', default: SURFACING_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: SURFACING_STRATEGY_OPTIONS } },
    { param: 'feed', match: { type: 'surfaceraster' }, key: 'feed', type: 'number', default: SURFACING_DEFAULTS.feed, units: 'mm/min' },
    { param: 'plunge', match: { type: 'surfaceraster' }, key: 'plunge', type: 'number', default: SURFACING_DEFAULTS.plunge, units: 'mm/min' },
    // t996 — RPM binding → the framing progstart. SOCKET-HELD: blank → the socket keeps the spindleHeadPatch Head
    // default (byte-identical); a typed value / a picked tool's library rpm OVERRIDES it (rpm>0 → M3 S<rpm> + spindleHeadPatch yields).
    { param: 'rpm', match: { type: 'progstart' }, key: 'rpm', type: 'number', socketHeld: true, label: 'Spindle RPM', help: "Spindle speed (RPM). Blank = the machine Head default; picking a tool fills this from the library." },
    // t842 — DEPTH ENTRY cluster (per-level descent + its per-mode when-gated fields; toward-centre ramp like pocket — an area fill)
    { param: 'entry', match: { type: 'surfaceraster' }, key: 'entry', type: 'enum', default: SURFACING_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle. Helix = a descending helix at the helix Ø, pitch mm/rev (clamped to fit).' },
    { param: 'rampAngle', match: { type: 'surfaceraster' }, key: 'rampAngle', type: 'number', default: SURFACING_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, help: 'Max descent angle of the ramp (degrees from horizontal). Too shallow for the area degrades to a plunge, with the reason.' },
    { param: 'helixDia', match: { type: 'surfaceraster' }, key: 'helixDia', type: 'number', default: SURFACING_DEFAULTS.helixDia, label: 'Helix Ø', units: 'mm', when: { param: 'entry', is: 'helix' }, help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped so the helix + tool stays inside the area.' },
    { param: 'helixPitch', match: { type: 'surfaceraster' }, key: 'helixPitch', type: 'number', default: SURFACING_DEFAULTS.helixPitch, label: 'Helix Pitch', units: 'mm/rev', when: { param: 'entry', is: 'helix' }, help: 'How far the helix descends per full revolution (mm/rev). Smaller = gentler.' },
];

/** The body bindings for a surfacing twin, derived BY IDENTITY over the ALREADY-WRAPPED stack — so the
 *  user_root/panel/sim/param_group prefix falls out for free (the old hand-kept WRAP_PREFIX_COUNT = 4). */
export function surfacingBindingsFor(stack) { return deriveBindingsFor(stack, SURFACING_BINDING_SPECS); }

/** Derived over the CANONICAL stack — the same one surfacingDataDef builds, so this export is the def's own binding
 *  set (the as-data spec iterates it to prove each param reaches the socket surfacingStack routes it to). */
export const SURFACING_BINDINGS = surfacingBindingsFor(buildSurfacingTwinStack());

// t986 — the STRUCTURAL Z-mode toggle (NO value socket): it drives the applySkimStructure postInstantiate fork, not a
// block param. Grouped in a COORDINATES section with the WCS dropdown; Skim greys the WCS (structGate below → data-op-gated).
const SURFACING_STRUCT = [
    { param: 'zMode', type: 'enum', default: SURFACING_DEFAULTS.zMode, label: 'Z-mode', section: 'COORDINATES', widget: 'dropdown',
        widgetConfig: { options: [['Normal — WCS Z0', 'normal'], ['Skim — relative', 'skim']] },
        help: 'Normal: cut at absolute Z, referencing the WCS Z0 (set your datum first). Skim: whole-op RELATIVE — jog to a corner, touch the surface, face from there (no WCS datum). Skim ignores the WCS.' },
];

export const SURFACING_DATA_OPTYPE = 'user_surfacing_data';

const _n = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
/** t716 — DECLARED preview geometry (twin-level): the face-area rectangle (the region extent, at the placement origin) as
 *  a path + a pos handle (originX/originY) + a size handle (w/h). Mirrors the built-in surfacingView.buildSurfacingSpec;
 *  handles write the TWIN params directly (preview-side → emit unaffected). */
export function surfacingPreviewGeometry(p) {
    const ox = _n(p.originX, 0), oy = _n(p.originY, 0), w = _n(p.w, 100), h = _n(p.h, 80);
    const paths = [{ pts: [{ x: ox, y: oy }, { x: ox + w, y: oy }, { x: ox + w, y: oy + h }, { x: ox, y: oy + h }, { x: ox, y: oy }], cls: 'fc-path' }];
    const handles = [
        { type: 'point', id: 'sf_pos', fx: 'originX', fy: 'originY', x: ox, y: oy, label: 'pos' },
        { type: 'rect', id: 'sf_size', field: 'w', fieldH: 'h', ax: ox, ay: oy, ex: w, ey: h, sx: 1, sy: 1, minw: 1, minh: 1, label: 'W×H' },
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
    const exec = surfacingStack(SURFACING_DEFAULTS);
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },   // t716 — the FeatureCanvas 2D with the face-area rect + pos/size handles (previewGeometry)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            {
                type: 'param_group',
                params: { group: 'Surfacing' },
                children: [],
            },
        ],
        children: appendToolSel(appendEntry(exec)),   // t726 P2b entry + t768 P1a tool marker appended (both emit nothing; no body-index shift)
    }];
}

/** Build the surfacing-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is surfacingStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function surfacingDataDef() {
    const stack = buildSurfacingTwinStack();
    const def = userOpFromStack('surfacing_data', 'Surfacing (data)', stack, [...toolBindingsFor(stack), ...SURFACING_STRUCT, ...surfacingBindingsFor(stack), ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = surfacingPreviewGeometry;   // t716 — per-feature 2D handles (region extent) via the declared hook
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
