/**
 * data/latheProfile.js — MATERIAL REMOVAL FOR TURNED WORK, as a PROFILE (t1283).
 *
 * ── WHY NOT THE MILL'S CARVE ────────────────────────────────────────────────────────────────────────────────────
 * The mill carves a heightmap: a grid of z-heights the cutter pushes down. That is the right model for a fixed part
 * under a spinning tool, and the wrong one for a spinning part under a fixed tool — a turned surface is not a height
 * over XY, it is a RADIUS ALONG Z, revolved. Modelled that way the carve is not an approximation at all: for turning
 * it is EXACT, and it is cheap (one number per Z sample instead of a grid), which is why this is a declared seam
 * BESIDE the voxel carve rather than a setting on it.
 *
 * ── THE MODEL ───────────────────────────────────────────────────────────────────────────────────────────────────
 * Two radii per sample: rOut (the outside of the bar) and rIn (the hole up the middle, 0 until something drills it).
 * Material exists where rIn < r < rOut. Every cutting move removes what the tool passed through:
 *   · a move at radius x removes everything OUTSIDE x, over the Z it covers  → rOut = min(rOut, x)
 *   · a move ON CENTRE (a drill) removes everything INSIDE the drill radius   → rIn  = max(rIn, rTool)
 * Facing falls out for free: passes step down in Z and each sets rOut to 0 at its own Z, so the bar SHORTENS. OD
 * turning steps it down. Parting opens a slot at one Z. Nothing here special-cases an op; the ops just move.
 *
 * ── WHAT THIS CANNOT DO, said plainly ───────────────────────────────────────────────────────────────────────────
 * A revolved profile cannot express FLATS. Polygon turning's hexagon is not a radius-along-Z, so it is not carved
 * here — its section is rendered as its finished shape once the sweeps are done (see viz/latheCarve.js). Modelling
 * flats progressively needs an angular dimension, which is a different structure and a later turn if it is wanted.
 */

/** How finely Z is sampled. 0.25mm holds a parting groove (a 3mm blade is 12 samples) without a big array. */
export const PROFILE_STEP = 0.25;

/**
 * A fresh profile for a bar: solid, full diameter, from the chuck end to the raw face.
 * @param {{diameter:number, stickOut:number, allowance:number}} bar
 */
export function profileFromBar(bar) {
    const dia = Math.max(0.001, Number(bar && bar.diameter) || 20);
    const stickOut = Math.max(0.001, Number(bar && bar.stickOut) || 60);
    const allowance = Math.max(0, Number(bar && bar.allowance) || 0);
    const z0 = -stickOut, z1 = allowance;
    const n = Math.max(2, Math.ceil((z1 - z0) / PROFILE_STEP) + 1);
    const r = dia / 2;
    return {
        z0, z1, n, step: (z1 - z0) / (n - 1),
        rOut: new Float32Array(n).fill(r),
        rIn: new Float32Array(n).fill(0),
        barR: r,
    };
}

/** The sample index a Z lands in (clamped — a move beyond the bar removes nothing off the end of the array). */
const idxOf = (p, z) => Math.max(0, Math.min(p.n - 1, Math.round((z - p.z0) / p.step)));

/** The Z a sample sits at. */
export const zAt = (p, i) => p.z0 + i * p.step;

/**
 * REMOVE what one cutting move passed through.
 *
 * @param {object} p     the profile (mutated — this is the carve)
 * @param {{x1:number,z1:number,x2:number,z2:number}} seg  a cutting move in the lathe frame (x = RADIUS)
 * @param {number} width the tool's width along Z (a parting blade's kerf; 0 = a point)
 * @returns {number} how many samples changed — 0 means the move cut air, which is worth knowing
 */
export function carveSegment(p, seg, width = 0) {
    if (!p || !seg) return 0;
    const x1 = Math.abs(Number(seg.x1) || 0), x2 = Math.abs(Number(seg.x2) || 0);
    const z1 = Number(seg.z1) || 0, z2 = Number(seg.z2) || 0;
    const half = Math.max(0, Number(width) || 0) / 2;
    const zLo = Math.min(z1, z2) - half, zHi = Math.max(z1, z2) + half;
    const iLo = idxOf(p, zLo), iHi = idxOf(p, zHi);
    let hit = 0;
    for (let i = iLo; i <= iHi; i++) {
        const z = zAt(p, i);
        // the tool's radius at THIS Z: linear along the move, so a taper or a diagonal removes the right amount
        // A PLUNGE (no Z extent) removes everything from where it started to where it ENDED — the tool passed through
        // all of it. Interpolating on a zero-length Z gave t=0, i.e. the radius it started at, so a parting plunge
        // removed nothing at all. Along a real move the radius interpolates, so a taper takes the right amount at
        // each Z instead of a step.
        const flat = Math.abs(z2 - z1) < 1e-9;
        const t = flat ? 0 : Math.max(0, Math.min(1, (z - z1) / (z2 - z1)));
        const x = flat ? Math.min(x1, x2) : x1 + (x2 - x1) * t;
        if (x < p.rOut[i] - 1e-9) { p.rOut[i] = x; hit++; }
    }
    return hit;
}

/**
 * REMOVE a hole up the middle — a drill on centre. Distinct from carveSegment because it eats from the INSIDE:
 * a drill at the centreline does not reduce the outside diameter, it opens a bore.
 * @param {number} rTool  the drill's radius
 * @param {number} zTo    how deep it reached (negative, into the part)
 */
export function carveBore(p, rTool, zTo) {
    if (!p) return 0;
    const r = Math.max(0, Number(rTool) || 0);
    const iLo = idxOf(p, Math.min(0, zTo)), iHi = idxOf(p, Math.max(0, zTo));
    let hit = 0;
    for (let i = iLo; i <= iHi; i++) if (r > p.rIn[i] + 1e-9) { p.rIn[i] = r; hit++; }
    return hit;
}

/**
 * THE PROFILE AS A DRAWABLE OUTLINE: the points a renderer revolves. Walks the outside from the chuck end to wherever
 * material still stands, then back along the bore. Samples where nothing is left (rOut ≤ rIn) are dropped — that is
 * how a faced bar ends up shorter and a parted one ends up in two pieces.
 * @returns {{outline:Array<{z:number,r:number}>, bore:Array<{z:number,r:number}>, zEnd:number}}
 */
export function profileOutline(p) {
    const outline = [], bore = [];
    let zEnd = p.z0;
    for (let i = 0; i < p.n; i++) {
        const z = zAt(p, i), ro = p.rOut[i], ri = p.rIn[i];
        // MATERIAL EXISTS ONLY WHILE IT IS STILL ATTACHED TO THE CHUCK. Walking out from the grip end, the first
        // sample cut clean through is where the workpiece ENDS — everything past it has fallen off. That one rule is
        // what makes facing SHORTEN the bar (each pass cuts through at its own Z, and the stub beyond drops away)
        // and what makes parting actually part. Without it a facing pass left three thin grooves in a full-length
        // bar, which is not what anyone watching the machine would see.
        // …and the plane the tool cut THROUGH is where the new face is — not the last sample that survived it. A
        // faced bar ends exactly on the Z the final pass reached, which is the number the operator measures.
        if (ro <= ri + 1e-6) { zEnd = z; break; }
        outline.push({ z, r: ro }); zEnd = z;
        if (ri > 1e-6) bore.push({ z, r: ri });
    }
    return { outline, bore, zEnd };
}

/** What is LEFT, as a person would measure it: the finished length and the smallest diameter still standing. */
export function profileStats(p) {
    const { outline, zEnd } = profileOutline(p);
    if (!outline.length) return { length: 0, zEnd: p.z0, minDia: 0, maxDia: 0 };
    let lo = Infinity, hi = 0;
    for (const o of outline) { if (o.r < lo) lo = o.r; if (o.r > hi) hi = o.r; }
    return { length: zEnd - p.z0, zEnd, minDia: lo * 2, maxDia: hi * 2 };
}
