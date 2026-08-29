/**
 * wizards/ops/pocketfill.js — POCKET FILL + POCKET WALL: the FLAT, data-portable pocket-clearing primitives.
 *
 * Pocket's region-pill → flat REFRAME (mirroring contourfill): the pocket geometry rides FLAT on the block
 * (shape/originX/originY/w/h/dia/sides + wallOffset/toolDia), NO Region SOCKET, so every dim is a clean
 * (blockIndex,key) binding for the user_pocket_data twin. TWO atoms, because the enclosing StepDown emits a
 * `fill` block (leading `( <strategy> fill z= )` tag + trailing retract) DIFFERENTLY from a `leaf`:
 *   · pocketFillBlock (kind:'fill') = the stepover clearing  → byte-identical to stepover{region-socket}.
 *   · pocketWallBlock (kind:'leaf') = the raster wall finish → byte-identical to contour{region, side:'on'}.
 * Both compute the SAME inset region internally (pocketInsetRegion) and reuse the SAME kernels (fillStrategy /
 * fillSegments from stepover; circleTrace / contourLevel from contour). The shared stepover/contour/region atoms
 * are UNTOUCHED — pocket's own region-socket path retires only in the twin's flat template (do NOT mutate a shared atom).
 *
 * ── t1464 — THIS ATOM'S DOMAIN IS PERMANENT. IT IS NOT AWAITING RETIREMENT ────────────────────────────────────────
 *
 * For a long stretch of the parametric arc this file was described as a thing to be retired once the pocket
 * converted. **That is settled and it is wrong now**: the rect pocket converted (t1406 → `surfaceraster`, t1433 →
 * `wallfinish`) and everything that did NOT convert lives here, by ruling, for good:
 *
 *     NON-RECT SHAPES (circle · polygon · ellipse)   see POCKET_SHAPE_GAP below — a JS-walked offset polyline,
 *                                                    hundreds to thousands of trig calls per level, and a POINT
 *                                                    LIST rather than a formula a macro can count into.
 *     REST MACHINING (the corner-clear pass)         see restmachining's REST_PARAMETRIC_GAP — SQRT per row per
 *                                                    corner, on a controller where SQRT is unverified.
 *
 * So the retirement item is CLOSED AS SCOPED, not deleted: the atom shrank to its permanent domain instead of
 * disappearing. Anything still calling this file "to be retired" is stale — correct it and cite t1463/t1464. The
 * two gap declarations are the domain, and each is instrumented by a spec that goes RED if its obstruction lifts.
 */
import { num } from './util.js';
import { regionDesc } from './region.js';
import { offsetRegion, circleTrace } from './contour.js';
import { contourLevel } from '../clearing.js';
import { fillStrategy, fillSegments } from './stepover.js';

/** Flat typed geometry → the TRUE region descriptor (before insetting). Mirrors pocketWizard.trueRegionParams, reading
 *  the flat block fields (originX/originY = the shape origin): rect = corner+w×h; circle/polygon = centre+Ø; ellipse = centre+w×h. */
export function trueRegionFromFlat(p) {
    const x = num(p.originX, 0), y = num(p.originY, 0), shape = p.shape || 'rect';
    if (shape === 'circle') return regionDesc({ shape: 'circle', x, y, w: num(p.dia, 50) });
    if (shape === 'polygon') return regionDesc({ shape: 'polygon', x, y, w: num(p.dia, 50), sides: num(p.sides, 6) });
    if (shape === 'ellipse') return regionDesc({ shape: 'ellipse', x, y, w: num(p.w, 80), h: num(p.h, 60) });
    return regionDesc({ shape: 'rect', x, y, w: num(p.w, 80), h: num(p.h, 60) });
}

/**
 * HOW FAR IN A POCKET'S TOOL CENTRE MUST SIT — the NUMBER, declared on its own (t1406).
 *
 * It was always here, inline inside `pocketInsetRegion`. The re-point needs the same quantity as a scalar, because
 * `surfaceraster` takes an `inset` PARAM (t1404) rather than a pre-inset rectangle — the atom keeps declaring the GIVEN
 * rect as its footprint and offsets only the WALK. Two readings of "how far in" would be exactly the split t1402
 * measured in the opposite direction (the dispatch's `r + wallOffset` against the shipped `r − wallOffset`; the shipped
 * sign is the one that has always run), so there is ONE function and both callers ask it.
 */
export function pocketInsetMm(p) { return Math.max(0.1, num(p.toolDia, 6)) / 2 - num(p.wallOffset, 0); }

/**
 * The same relation READ BACKWARDS: the wall offset a given (toolDia, inset) pair came from. Not an inference from
 * emitted output — it is the algebraic inverse of the one declaration above, so the two cannot drift. The reverse-sync
 * needs it: on the re-pointed arm the block stack carries `inset` and `toolDia` and no `wallOffset` (the atom has no
 * such concept), so reading an edited stack back into the form has to invert exactly this, and nothing else.
 */
export function pocketWallOffsetFromInset(toolDia, inset) { return Math.max(0.1, num(toolDia, 6)) / 2 - num(inset, 0); }

/** The tool-CENTRE inset region a pocket clears: the true region inset by (toolRadius − wallOffset) — matching
 *  pocketWizard exactly (r = max(0.1,toolDia)/2, inset = r − wallOffset). ONE source for BOTH the clearing (pocketFill)
 *  and the wall (pocketWall) so they trace the identical boundary. Returns a descriptor (with .contour). */
export function pocketInsetRegion(p) {
    return offsetRegion(trueRegionFromFlat(p), -pocketInsetMm(p));
}

/** The absolute stepover (mm) from the % + tool — matching pocketWizard's `so` (max(0.2, tool·%/100)). Exported (t802) so
 *  the 2D preview draws its concentric rings at the SAME spacing the emit cuts. */
export function stepoverMm(p) { return Math.max(0.2, Math.max(0.1, num(p.toolDia, 6)) * num(p.stepoverPct, 40) / 100); }

/**
 * ── t1464 — WHY A NON-RECT POCKET STAYS LITERAL, DECLARED AS DATA (the rest-machining precedent) ──────────────────
 *
 * The parametric arc converted the RECT pocket at t1406 and stops here. That is now a settled, permanent fact rather
 * than a queue item, and it is written down beside the walk it describes — the same reason `REST_PARAMETRIC_GAP` is
 * a declaration: the next reader must learn which walks can become runtime macro loops from a DECLARATION, not by
 * reading three kernels and guessing.
 *
 * ── THE OBSTRUCTION IS TRIG, AND IT IS MEASURED RATHER THAN ASSERTED ─────────────────────────────────────────────
 * A rect's clearing is analytic: rows at `step/2 + i·step`, rings inset by `i·step` — arithmetic a macro can count
 * itself into, which is exactly what `surfaceraster` does. Every other shape is walked as a TESSELLATED POLYLINE
 * computed in JavaScript: `offsetRegion` builds the inset boundary point by point, and the fill scans or rings it.
 * Instrumenting `Math.sin/cos/atan2` on the REAL walk, one depth level, Ø6 tool at 40%:
 *
 *     rect 80x60        0 trig calls        ← the analytic shape; this is the one that converted
 *     polygon Ø50 x6  124 trig calls
 *     circle Ø50      384 trig calls
 *     ellipse 80x60  2496 trig calls  ·  1167 emitted lines at ONE level
 *
 * TRIG IS UNVERIFIED ON THIS CONTROLLER — t1339's standing finding, unchanged, and the SAME evidence that keeps the
 * raster's ramp baking its distance-to-centre and the rest walk literal. So this is not a third limit: it is the one
 * limit reaching a third walk, and `V13_trig.nc` lifts all three or none.
 *
 * ⚠ AND TRIG IS ONLY HALF OF IT, which is why this boundary is stated as permanent rather than pending. Even with
 * SIN/COS proven, the ellipse's 1167 lines at one level are a JS-computed point list — a macro cannot COUNT itself
 * into a tessellated offset polyline the way it counts rows into a rectangle. Converting it would mean emitting the
 * points as literals, which is the transcript it already emits. The rect converted because its walk is a FORMULA;
 * these stay because theirs is a LIST.
 */
export const POCKET_SHAPE_GAP = 'a circle / polygon / ellipse pocket is cleared by walking a TESSELLATED offset '
    + 'polyline computed in JavaScript, not the analytic rectangle a macro can count itself into: the same walk needs '
    + 'hundreds to thousands of SIN/COS/ATAN calls per depth level (measured: 124 polygon, 384 circle, 2496 ellipse, '
    + 'against ZERO for a rect), and trig is unverified on this controller (t1339; V13_trig.nc is the decider — the '
    + 'same one the raster ramp and the rest walk wait on). And proving trig would not be enough: the walk is a POINT '
    + 'LIST, not a formula, so a macro loop has nothing to count. Non-rect pockets stay literal, permanently';

/** Why THIS pocket's shape cannot be a runtime macro loop — or '' for the RECT, which converted at t1406. */
export function pocketShapeGap(p = {}) { return (p && (p.shape || 'rect') === 'rect') ? '' : POCKET_SHAPE_GAP; }

// t2403 (BACKLOG #48 item 5) — the shape gate SHARED by pocketFillBlock/pocketWallBlock: `dia`+`sides` only
// mean anything for circle/polygon, `w`+`h` only for rect/ellipse (`trueRegionFromFlat`, above, is the exact
// per-shape read this mirrors) — every OTHER shape showed all 4 regardless.
const POCKET_SHAPE_DIMS = (shape) => (shape === 'circle' || shape === 'polygon') ? ['dia', 'sides'] : ['w', 'h'];

export const pocketFillBlock = {
    type: 'pocketfill', label: 'Pocket Fill', kind: 'fill', mouth: 'DO', category: 'Toolpaths',
    // t804 — DEPTH ENTRY: `entry` (plunge|ramp|helix) is the per-level descent to the cut Z. plunge = straight (default,
    // byte-identical); ramp = a linear descent at ≤ rampAngle°; helix = a descending helix at helixDia (pitch = mm/rev).
    // `by` reads the enclosing StepDown's step (exposed in scope) so the entry descends exactly one level.
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, stepoverPct: 40, strategy: 'concentric', direction: 'bothways', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, by: 'by', z: 'z', feed: 2000, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'stepoverPct', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'by', 'z', 'feed', 'plunge', 'clearance'],
    allFields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'stepoverPct', 'strategy', 'direction', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'by', 'z', 'feed', 'plunge', 'clearance'],
    // t2403 — BOTH gates on this block: shape (dia+sides vs w+h) and entry (rampAngle vs helixDia/helixPitch).
    dynamic: ['shape', 'entry'],
    fieldsFor(p) {
        const shape = (p && p.shape) || 'rect';
        const entry = (p && p.entry) || 'plunge';
        const f = ['shape', 'originX', 'originY', ...POCKET_SHAPE_DIMS(shape), 'wallOffset', 'toolDia', 'stepoverPct', 'strategy', 'direction', 'entry'];
        if (entry === 'ramp') f.push('rampAngle');
        else if (entry === 'helix') f.push('helixDia', 'helixPitch');
        f.push('by', 'z', 'feed', 'plunge', 'clearance');
        return f;
    },
    // the enclosing StepDown fills scope `z`; fillStrategy reads the inset region + the flat cut params → the stepover passes.
    lines: (p, z) => fillStrategy({ ...p, region: pocketInsetRegion(p), stepover: stepoverMm(p) }, z),
    segments: (p) => fillSegments({ ...p, region: pocketInsetRegion(p), stepover: stepoverMm(p) }),
};

export const pocketWallBlock = {
    type: 'pocketwall', label: 'Pocket Wall', kind: 'leaf', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, z: 'z', feed: 600, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'z', 'feed', 'plunge', 'clearance'],
    allFields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'z', 'feed', 'plunge', 'clearance'],
    dynamic: 'shape',
    fieldsFor(p) {
        const shape = (p && p.shape) || 'rect';
        return ['shape', 'originX', 'originY', ...POCKET_SHAPE_DIMS(shape), 'wallOffset', 'toolDia', 'z', 'feed', 'plunge', 'clearance'];
    },
    // the raster wall finish = Contour(on) on the inset region: trace it at the scope Z (circle → true G3 arc).
    emit: (p) => {
        const rg = pocketInsetRegion(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
        return rg.kind === 'circle' ? circleTrace(rg, z, clr, feed, plunge) : contourLevel(rg.contour, { z, clr, feed, plunge });
    },
};
