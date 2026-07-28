/**
 * wizards/lathe/polygon.js — POLYGON TURNING (t1277). The axis-mode member of the family: it needs the chuck to be a
 * DRIVEN AXIS, not a spindle, because the whole op is A and X moving together.
 *
 * Turn a hex (or square, or octagon) on the bar by rotating the work slowly and pulling the tool in and out in step
 * with it: at a corner the tool stands off, at the middle of a flat it comes in to the apothem. Sweep 360° and the
 * round bar comes out with flats on it.
 *
 * ── WHY THE PASSES ARE COMPUTED HERE AND NOT ON THE CONTROLLER (the ground-truth check, t1277) ───────────────────
 * This op needs r(angle) = apothem / cos(θ), which needs COSINE. THE DDCS MACRO LANGUAGE HAS NO TRIG, on the
 * evidence available:
 *   · the 59 captured factory macros use `ABS[…]` ten times and `COS[`/`SIN[` not once;
 *   · `parse.out` (the parser dump) contains no uppercase grammar tokens at all — not even ABS, which demonstrably
 *     works — so it can neither prove nor disprove a function name;
 *   · the lowercase `asin/acos/atan/atan2/sqrt/round/fmod` a Studio tool cites as "the parser's real vocabulary"
 *     sit immediately after `libm.so.6` in the binary's ELF dynamic-symbol table. They are the C functions the
 *     firmware LINKS, not tokens the macro language exposes — and `cos`/`sin` are not even among them.
 * So the geometry is computed HERE, at post time, and the macro carries the resulting A/X pairs. That is a real
 * departure from the rest of the family (facing, OD, parting and drilling all ship a #var recipe the operator can
 * retune at the machine), and it is not a preference — it is what the controller can execute. The op stays
 * parametric in STUDIO: change the size or the sides and the whole path regenerates.
 *
 * ── THE RESOLUTION IS DECLARED, because an unrolled path has to stop somewhere ───────────────────────────────────
 * Segments per FACE, not per revolution: the flats are what matter, and declaring it per face means a hex and an
 * octagon get the same fidelity per flat instead of the octagon quietly getting less. An EVEN count puts a point
 * exactly on the corner AND exactly at the middle of each flat — the two places the shape is defined — so that is
 * what the default is and what the geometry rounds to.
 */
import { radiusOf, normalizeBar } from '../../data/lathe.js';

/** THE IDENTITY: how many flats. Presets for the ones people actually cut, and a free number for the rest. */
export const POLY_PRESETS = [
    { sides: 4, label: 'Square' },
    { sides: 6, label: 'Hex' },
    { sides: 8, label: 'Octagon' },
];

/** The declared scratch variables. Only the ones the OPERATOR can still usefully change — the path is baked. */
export const POLY_VARS = {
    feed: '#170',      // the cutting feed
    zEnd: '#171',      // derived: the Z the section runs to
    depth: '#172',     // ← how far along the bar the polygon section runs
    zSafe: '#173',     // clear Z, ahead of all material
    xClear: '#174',    // retract radius
};

export const POLY_DEFAULTS = {
    sides: 6,
    barDiameter: 25,
    barAllowance: 1,
    acrossFlats: 17,       // the wrench size — what a person measures and what the drawing says
    depth: 20,             // the Z extent of the polygon section
    segmentsPerFace: 12,   // the declared resolution
    doc: 1,                // radial step between roughing sweeps
    clearance: 2,
    feed: 90,
    rpm: 0,                // the chuck is an AXIS here — it is commanded, not spun
};

const round3 = (n) => Math.round(n * 1000) / 1000;
const DEG = Math.PI / 180;

/** Sides, normalized: a polygon needs at least three flats, and a fractional one is not a polygon. */
export const polySides = (n) => Math.max(3, Math.round(Number(n) || 0) || 3);

/** Segments per face, normalized to an EVEN number ≥ 2 — see the header: even is what lands a point on the corner
 *  AND on the middle of the flat, which are the two radii the shape is actually defined by. */
export const polySegments = (n) => Math.max(2, Math.round((Number(n) || 12) / 2) * 2);

/**
 * THE OP'S ONE PIECE OF GEOMETRY: how far the tool must be from the centre at a given angle.
 *
 * Measured from a CORNER at angle 0. Inside each face the angle from the face's centreline is θ, and the distance to
 * the flat is the apothem divided by cos θ — so it is largest at the corners (θ = half a face) and exactly the
 * apothem at the middle of a flat (θ = 0). For a hex across 17: 8.5 at the flat, 8.5/cos30° = 9.815 at the corner.
 * @param {number} angleDeg   the A position
 * @param {number} acrossFlats  the wrench size
 * @param {number} sides
 * @returns {number} the RADIUS the tool sits at
 */
export function polyRadiusAt(angleDeg, acrossFlats, sides) {
    const n = polySides(sides);
    const apothem = Math.max(0, Number(acrossFlats) || 0) / 2;   // …the ONE halving, and it is a size not a diameter
    const face = 360 / n;
    const within = ((Number(angleDeg) || 0) % face + face) % face;   // where we are inside this face, from its corner
    const theta = (within - face / 2) * DEG;                          // …re-measured from the face's centreline
    return round3(apothem / Math.cos(theta));
}

/**
 * THE SWEEP — the A/X pairs for one full turn at a given across-flats size.
 * @returns {Array<{a:number, x:number}>} one point per segment, closing the circle at 360°
 */
export function polygonPath({ acrossFlats, sides, segmentsPerFace } = {}) {
    const n = polySides(sides);
    const seg = polySegments(segmentsPerFace);
    const face = 360 / n;
    const step = face / seg;
    const out = [];
    for (let i = 0; i <= n * seg; i++) {
        const a = round3(i * step);
        out.push({ a, x: polyRadiusAt(a, acrossFlats, n) });
    }
    return out;
}

/**
 * THE ROUGHING SWEEPS, as across-flats sizes. Anchored on the FINISHED size and walked out to the bar, so the light
 * pass falls first — the family's rule, unified in t1275, and it matters more here than anywhere: the first sweep is
 * the one meeting a round bar with a shape that is not round yet.
 * @returns {number[]} the across-flats size of each sweep, largest first, ending exactly on the finished size
 */
export function polygonSweeps({ barDiameter, acrossFlats, doc, sides } = {}) {
    const barR = radiusOf(normalizeBar({ diameter: barDiameter }).diameter);
    const n = polySides(sides);
    const finalA = Math.max(0, Number(acrossFlats) || 0);
    const d = Math.max(0.001, Number(doc) || 0.001);
    const out = [];
    // in ACROSS-FLATS terms a radial step of `doc` is a step of 2·doc, because a wrench size spans both sides.
    // THE CORNERS ARE WHAT HAVE TO FIT: a sweep whose corner radius exceeds the bar cuts nothing at the corners and
    // swings through air to get there, so the walk stops at the largest size that still lies inside the stock.
    for (let a = finalA; polyRadiusAt(0, a, n) < barR - 1e-9; a = round3(a + 2 * d)) out.push(a);
    out.reverse();
    if (!out.length) out.push(round3(finalA));
    return out;
}

/**
 * The polygon-turning macro as a block stack: a short #var header for the numbers that still mean something at the
 * machine, then the computed A/X sweeps.
 * @param {object} p  POLY_DEFAULTS shape
 */
export function polygonStack(p = {}) {
    const v = { ...POLY_DEFAULTS, ...p };
    const bar = normalizeBar({ diameter: v.barDiameter, stickOut: 60, allowance: v.barAllowance });
    const V = POLY_VARS;
    const n = polySides(v.sides);
    const clearance = Math.max(0, Number(v.clearance) || 0);
    const sweeps = polygonSweeps(v);

    const s = [];
    s.push({ type: 'progstart', params: { clearance: 5, feed: v.feed } });
    s.push({ type: 'comment', params: { text: 'POLYGON TURNING — the chuck turns as an AXIS and X follows it. Sizes are the #vars below; the A/X path is computed.' } });
    s.push({ type: 'assign', params: { var: V.depth, value: String(round3(Math.max(0, Number(v.depth) || 0))), note: 'how far along the bar the polygon section runs' } });
    s.push({ type: 'assign', params: { var: V.feed, value: String(v.feed), note: 'cutting feed' } });
    s.push({ type: 'assign', params: { var: V.xClear, value: String(round3(radiusOf(bar.diameter) + clearance)), note: 'retract radius — clear of the bar' } });
    s.push({ type: 'assign', params: { var: V.zSafe, value: String(round3(bar.allowance + clearance)), note: 'clear Z — ahead of all material' } });
    s.push({ type: 'assign', params: { var: V.zEnd, value: `[0-${V.depth}]`, note: 'the Z the section runs to' } });

    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear, z: V.zSafe } });
    s.push({ type: 'comment', params: { text: `${n} flats · ${sweeps.length} sweep${sweeps.length === 1 ? '' : 's'} · ${polySegments(v.segmentsPerFace)} segments per face` } });

    sweeps.forEach((across, i) => {
        const path = polygonPath({ acrossFlats: across, sides: n, segmentsPerFace: v.segmentsPerFace });
        s.push({ type: 'comment', params: { text: i === sweeps.length - 1 ? 'finishing sweep — the size on the drawing' : `roughing sweep ${i + 1}` } });
        // …into position at the START of the sweep before any A motion, so the first move cuts rather than crashing in
        s.push({ type: 'move', params: { mode: 'rapid', a: 0 } });
        s.push({ type: 'move', params: { mode: 'rapid', x: String(path[0].x) } });
        s.push({ type: 'move', params: { mode: 'cut', z: V.zEnd, feed: V.feed } });
        // THE SWEEP: A and X in the same move, so the tool is phase-locked to the work. This is the unrolled part,
        // and the reason it is unrolled is stated at the top of this file.
        path.slice(1).forEach((pt) => s.push({ type: 'move', params: { mode: 'cut', a: String(pt.a), x: String(pt.x), feed: V.feed } }));
        s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear } });   // off the part first, always
        s.push({ type: 'move', params: { mode: 'rapid', z: V.zSafe } });
    });

    s.push({ type: 'progend', params: {} });
    return s;
}
