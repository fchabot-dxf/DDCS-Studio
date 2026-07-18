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
import { userOpFromStack } from '../userOps.js';
import { spindleHeadPatch } from './spindleHead.js';   // t945 — the framing progstart inherits the live machine Head spindle at build (the form's insert-time semantics), else the data-op cuts DEAD
import { appendEntry, ENTRY_POINT } from '../../wizards/ops/entry.js';   // t726 P2b - the declared mill entry point
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // t768 P1a - the declared tool-selection marker
import { entryBindingsFor, toolBindingsFor } from './deriveBindings.js';   // t726 P2b entry / t768 P1a tool — by identity (into def.bindings, not the exported EXEC bindings)
import { WCS_OPTIONS, XY_DATUM_OPTIONS, STOCK_DATUM_OPTIONS, SURFACING_STRATEGY_OPTIONS, ENTRY_OPTIONS } from './wizardOptions.js';   // t720 P1 — SHARED enum options (were undeclared → empty dropdowns); t842 ENTRY_OPTIONS

/** Author defaults — match surfacingStack's own num() fallbacks (+ flat stepover/strategy) so the seeded template == the
 *  true default stack. stepover 7.2 == the default tool·% (Ø12 · 60%); strategy 'parallel' == the form's default 'raster'. */
export const SURFACING_DEFAULTS = {
    w: 100, h: 80, stepover: 7.2, strategy: 'parallel', depth: 0.5, stepdown: 0.5,
    entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1,   // t842 — depth entry (plunge default = byte-identical)
    clearance: 5, feed: 800, plunge: 200, wcs: 'active',
    // placement (makePlace) — region is local-0-based, so originX/originY are the placement offset (offX/offY) like drill.
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

// Flatten (pre-order) of surfacingStack's [progstart, wcs, placeonstock{ stepdown{ surfacefill } }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 stepdown · 4 surfacefill · 5 progend
// (clearance is deliberately NOT bound — frontier #3 fan-out to progstart + the surfacefill leaf. surfacefill's
//  shape/x/y/z/direction stay at their constants: shape='rect', x=y=0 [local], z='z', direction='bothways'.)
const SURFACING_EXEC_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: SURFACING_DEFAULTS.wcs, widget: 'dropdown', widgetConfig: { options: WCS_OPTIONS } },
    // placement scalars (block 2, placeonstock) — origin owned by the placement now (region is local-0-based)
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: SURFACING_DEFAULTS.originX },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: SURFACING_DEFAULTS.originY },
    { param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: SURFACING_DEFAULTS.stockAttach, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: SURFACING_DEFAULTS.pathDatum, widget: 'dropdown', widgetConfig: { options: XY_DATUM_OPTIONS } },
    { param: 'stockDatum', formHidden: true, blockIndex: 2, key: 'stockDatum', type: 'enum', default: SURFACING_DEFAULTS.stockDatum, widget: 'dropdown', widgetConfig: { options: STOCK_DATUM_OPTIONS } },
    { param: 'stockW', formHidden: true, blockIndex: 2, key: 'stockW', type: 'number', default: SURFACING_DEFAULTS.stockW },
    { param: 'stockH', formHidden: true, blockIndex: 2, key: 'stockH', type: 'number', default: SURFACING_DEFAULTS.stockH },
    { param: 'stockZ', formHidden: true, blockIndex: 2, key: 'stockZ', type: 'number', default: SURFACING_DEFAULTS.stockZ },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: SURFACING_DEFAULTS.offZ },
    // depth pass (block 3, stepdown)
    { param: 'depth', blockIndex: 3, key: 'to', type: 'number', default: SURFACING_DEFAULTS.depth },
    { param: 'stepdown', blockIndex: 3, key: 'by', type: 'number', default: SURFACING_DEFAULTS.stepdown },
    // geometry + cut (block 4, the surfacefill leaf)
    { param: 'w', help: "Width of the faced area (X). The tool overhangs the edge by its radius.", blockIndex: 4, key: 'w', type: 'number', default: SURFACING_DEFAULTS.w },
    { param: 'h', help: "Height of the faced area (Y).", blockIndex: 4, key: 'h', type: 'number', default: SURFACING_DEFAULTS.h },
    { param: 'stepover', help: "Distance between parallel passes (mm). Smaller = finer finish, slower.", blockIndex: 4, key: 'stepover', type: 'number', default: SURFACING_DEFAULTS.stepover },
    { param: 'strategy', help: "Facing pattern: Raster = parallel zig-zag; Concentric = spiral.", blockIndex: 4, key: 'strategy', type: 'enum', default: SURFACING_DEFAULTS.strategy, widget: 'dropdown', widgetConfig: { options: SURFACING_STRATEGY_OPTIONS } },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: SURFACING_DEFAULTS.feed },
    { param: 'plunge', blockIndex: 4, key: 'plunge', type: 'number', default: SURFACING_DEFAULTS.plunge },
    // t842 — DEPTH ENTRY cluster (per-level descent + its per-mode when-gated fields; toward-centre ramp like pocket — an area fill)
    { param: 'entry', blockIndex: 4, key: 'entry', type: 'enum', default: SURFACING_DEFAULTS.entry, widget: 'dropdown', widgetConfig: { options: ENTRY_OPTIONS }, label: 'Depth Entry', help: 'How the tool descends to each depth level. Plunge = straight down. Ramp = a linear descent at ≤ the ramp angle. Helix = a descending helix at the helix Ø, pitch mm/rev (clamped to fit).' },
    { param: 'rampAngle', blockIndex: 4, key: 'rampAngle', type: 'number', default: SURFACING_DEFAULTS.rampAngle, label: 'Ramp Angle', units: '°', when: { param: 'entry', is: 'ramp' }, help: 'Max descent angle of the ramp (degrees from horizontal). Too shallow for the area degrades to a plunge, with the reason.' },
    { param: 'helixDia', blockIndex: 4, key: 'helixDia', type: 'number', default: SURFACING_DEFAULTS.helixDia, label: 'Helix Ø', units: 'mm', when: { param: 'entry', is: 'helix' }, help: 'Diameter of the descending helix (mm). 0 = auto (the tool Ø). Clamped so the helix + tool stays inside the area.' },
    { param: 'helixPitch', blockIndex: 4, key: 'helixPitch', type: 'number', default: SURFACING_DEFAULTS.helixPitch, label: 'Helix Pitch', units: 'mm/rev', when: { param: 'entry', is: 'helix' }, help: 'How far the helix descends per full revolution (mm/rev). Smaller = gentler.' },
];

const WRAP_PREFIX_COUNT = 4;   // user_root + panel + sim + param_group
export const SURFACING_BINDINGS = SURFACING_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP_PREFIX_COUNT }));

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

/** Build the surfacing-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is surfacingStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function surfacingDataDef() {
    const exec = surfacingStack(SURFACING_DEFAULTS);
    const stack = [{
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
    const def = userOpFromStack('surfacing_data', 'Surfacing (data)', stack, [...toolBindingsFor(stack), ...SURFACING_BINDINGS, ...entryBindingsFor(stack)], 'form3d+2d', null, 'mill_datawiz');
    def.previewGeometry = surfacingPreviewGeometry;   // t716 — per-feature 2D handles (region extent) via the declared hook
    def.entryPoint = ENTRY_POINT;   // t726 P2b - the emitting-square entry marker (replaces the sim-only circle)
    def.postInstantiate = spindleHeadPatch;   // t945 — fill the blank framing progstart's rpm/dir/spin-up from the live Head → M3 (was a DEAD spindle)
    return def;
}
