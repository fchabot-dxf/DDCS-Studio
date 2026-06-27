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

/** Author defaults — match surfacingStack's own num() fallbacks (+ flat stepover/strategy) so the seeded template == the
 *  true default stack. stepover 7.2 == the default tool·% (Ø12 · 60%); strategy 'parallel' == the form's default 'raster'. */
export const SURFACING_DEFAULTS = {
    w: 100, h: 80, stepover: 7.2, strategy: 'parallel', depth: 0.5, stepdown: 0.5,
    clearance: 5, feed: 800, plunge: 200, wcs: 'active',
    // placement (makePlace) — region is local-0-based, so originX/originY are the placement offset (offX/offY) like drill.
    originX: 0, originY: 0, stockAttach: '', pathDatum: '', stockDatum: 'nnp', stockW: 0, stockH: 0, stockZ: 0, offZ: 0,
};

// Flatten (pre-order) of surfacingStack's [progstart, wcs, placeonstock{ stepdown{ surfacefill } }, progend]:
//   0 progstart · 1 wcs · 2 placeonstock · 3 stepdown · 4 surfacefill · 5 progend
// (clearance is deliberately NOT bound — frontier #3 fan-out to progstart + the surfacefill leaf. surfacefill's
//  shape/x/y/z/direction stay at their constants: shape='rect', x=y=0 [local], z='z', direction='bothways'.)
export const SURFACING_BINDINGS = [
    { param: 'wcs', blockIndex: 1, key: 'wcs', type: 'enum', default: SURFACING_DEFAULTS.wcs },
    // placement scalars (block 2, placeonstock) — origin owned by the placement now (region is local-0-based)
    { param: 'originX', blockIndex: 2, key: 'offX', type: 'number', default: SURFACING_DEFAULTS.originX },
    { param: 'originY', blockIndex: 2, key: 'offY', type: 'number', default: SURFACING_DEFAULTS.originY },
    { param: 'stockAttach', blockIndex: 2, key: 'stockAttach', type: 'enum', default: SURFACING_DEFAULTS.stockAttach },
    { param: 'pathDatum', blockIndex: 2, key: 'pathDatum', type: 'enum', default: SURFACING_DEFAULTS.pathDatum },
    { param: 'stockDatum', blockIndex: 2, key: 'stockDatum', type: 'enum', default: SURFACING_DEFAULTS.stockDatum },
    { param: 'stockW', blockIndex: 2, key: 'stockW', type: 'number', default: SURFACING_DEFAULTS.stockW },
    { param: 'stockH', blockIndex: 2, key: 'stockH', type: 'number', default: SURFACING_DEFAULTS.stockH },
    { param: 'stockZ', blockIndex: 2, key: 'stockZ', type: 'number', default: SURFACING_DEFAULTS.stockZ },
    { param: 'offZ', blockIndex: 2, key: 'offZ', type: 'number', default: SURFACING_DEFAULTS.offZ },
    // depth pass (block 3, stepdown)
    { param: 'depth', blockIndex: 3, key: 'to', type: 'number', default: SURFACING_DEFAULTS.depth },
    { param: 'stepdown', blockIndex: 3, key: 'by', type: 'number', default: SURFACING_DEFAULTS.stepdown },
    // geometry + cut (block 4, the surfacefill leaf)
    { param: 'w', blockIndex: 4, key: 'w', type: 'number', default: SURFACING_DEFAULTS.w },
    { param: 'h', blockIndex: 4, key: 'h', type: 'number', default: SURFACING_DEFAULTS.h },
    { param: 'stepover', blockIndex: 4, key: 'stepover', type: 'number', default: SURFACING_DEFAULTS.stepover },
    { param: 'strategy', blockIndex: 4, key: 'strategy', type: 'enum', default: SURFACING_DEFAULTS.strategy },
    { param: 'feed', blockIndex: 4, key: 'feed', type: 'number', default: SURFACING_DEFAULTS.feed },
    { param: 'plunge', blockIndex: 4, key: 'plunge', type: 'number', default: SURFACING_DEFAULTS.plunge },
];

export const SURFACING_DATA_OPTYPE = 'user_surfacing_data';

/** Build the surfacing-as-data def: a fresh { opType, label, template, bindings } ready for registerUserOp. The template
 *  is surfacingStack(defaults) with ids stripped (userOpFromStack does both) — the canonical valid-by-construction stack. */
export function surfacingDataDef() {
    return userOpFromStack('surfacing_data', 'Surfacing (data)', surfacingStack(SURFACING_DEFAULTS), SURFACING_BINDINGS, 'form3d');
}
