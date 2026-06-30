/**
 * engine/probeGeometry.js — shared probe-vs-stock collision, used by BOTH the execution engine
 * (GcodeExecutionEngine) and the 3D sim (gcodeViz3d._rebuild) so a probe stops at the SAME surface in
 * the simulated run and the drawn preview. One source of truth → the two can't drift.
 *
 * Pure geometry: no settings / DOM / THREE deps. Frame = STOCK-LOCAL — the box is x∈[0,X] y∈[0,Y]
 * z∈[-Z,0] (top face at z=0), and the caller passes the probe segment A→B in that same frame.
 */

/** Ray vs axis-aligned box (slab method). Returns { hit, tEnter, tExit } parametric along A→B. */
export function rayBox(A, B, min, max) {
    const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    let tEnter = -Infinity, tExit = Infinity;
    for (const ax of ['x', 'y', 'z']) {
        if (Math.abs(d[ax]) < 1e-9) {
            if (A[ax] < min[ax] - 1e-6 || A[ax] > max[ax] + 1e-6) return { hit: false };
        } else {
            let t1 = (min[ax] - A[ax]) / d[ax], t2 = (max[ax] - A[ax]) / d[ax];
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            if (t1 > tEnter) tEnter = t1;
            if (t2 < tExit) tExit = t2;
            if (tEnter > tExit) return { hit: false };
        }
    }
    return { hit: true, tEnter, tExit };
}

/** Which Cartesian axis a rotary stock lies along (matches setStock / getRotaryAxes: the first rotary
 *  motor's `around`, default x). `motors` = settings.motors. */
export function rotaryAxisOf(motors) {
    const m = motors || {};
    for (const a of ['a', 'b']) if (m[a] && m[a].role === 'rotary') return m[a].around || 'x';
    return 'x';
}

/** The DECLARED bar radius (SPATIAL-MODEL inc2): the stock's declared cylinder OD wins (`stock.diameter`), else the radius is
 *  INFERRED from the bounding box (min of the two cross dims). Declared-first, box-fallback → an unset diameter is the status
 *  quo (bar = box), a set one renders a true bar ≠ box. ONE source read by the collision, the 3D mesh, AND opSimStarts. */
export function barRadius(stock, crossA, crossB) {
    const d = stock && stock.diameter;
    return (Number.isFinite(d) && d > 0) ? d / 2 : Math.min(crossA, crossB) / 2;
}

/** A finite cylinder for `stock.shape==='cylinder'`, in stock-local space — identical to the mesh setStock
 *  draws: centred at (X/2, Y/2, −Z/2), radius = the DECLARED bar radius (stock.diameter, else min(cross)/2), along the rotary axis. */
export function cylinderOf(stock, rotaryAxis) {
    const axis = (rotaryAxis === 'y' || rotaryAxis === 'z') ? rotaryAxis : 'x';
    const dims = { x: stock.x, y: stock.y, z: stock.z };
    const ctr = { x: dims.x / 2, y: dims.y / 2, z: -dims.z / 2 };
    const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
    const r = barRadius(stock, dims[cross[0]], dims[cross[1]]);
    const lo = axis === 'z' ? -dims.z : 0, hi = axis === 'z' ? 0 : dims[axis];   // axial extent in stock-local
    return { axis, u: cross[0], v: cross[1], cu: ctr[cross[0]], cv: ctr[cross[1]], r, lo, hi };
}

/** Ray vs finite cylinder — the two radial-wall crossings, clamped to the axial extent (probing the round
 *  OD). Returns { hit, tEnter, tExit }. A ray parallel to the axis (no radial component) does not hit. */
export function rayCylinder(A, B, cyl) {
    const { axis, u, v, cu, cv, r, lo, hi } = cyl;
    const Au = A[u] - cu, Av = A[v] - cv, du = B[u] - A[u], dv = B[v] - A[v];
    const a = du * du + dv * dv;
    if (a < 1e-12) return { hit: false };
    const b = 2 * (Au * du + Av * dv);
    const c = Au * Au + Av * Av - r * r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return { hit: false };
    const sq = Math.sqrt(disc);
    let t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a);
    if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
    const axialOk = (t) => { const p = A[axis] + (B[axis] - A[axis]) * t; return p >= lo - 1e-6 && p <= hi + 1e-6; };
    const e = axialOk(t0) ? t0 : null, x = axialOk(t1) ? t1 : null;
    if (e == null && x == null) return { hit: false };
    return { hit: true, tEnter: e != null ? e : x, tExit: x != null ? x : e };
}

/**
 * First contact t along A→B with the stock (or null = no contact). Encapsulates the policy so the engine
 * and the sim agree exactly:
 *   • boss / solid block → the OUTER box: enter from outside, or (started inside a solid) the far face.
 *   • pocket → outer box + an inset CAVITY whose wall stops a bore probe coming from inside the hole.
 *   • cylinder → the round OD (rotary stock), at the rotary axis.
 */
export function stockProbeStop(A, B, stock, rotaryAxis, tipR = 0) {
    if (!stock || !(stock.x > 0 && stock.y > 0 && stock.z > 0)) return null;
    const r = Number.isFinite(tipR) && tipR > 0 ? tipR : 0;   // probe TIP radius: collide the SURFACE, so the tool CENTRE
    // stops a radius SHORT of the wall (the tip touches it, no penetration). The recorded contact is then the centre — a
    // radius from the wall, like a real machine — which is exactly what the wizards' radius-comp expects (corner/edge
    // #1925±#6, diameter ∓2r, Z-surface −r). A bisect (centre) is radius-independent → unchanged. Outer surfaces grow by r
    // (centre stops outside); a pocket cavity shrinks by r (probing from inside, the centre stops before the inner wall).
    let tt = null;
    const take = (t) => { if (t != null && t > 1e-6 && t <= 1 && (tt == null || t < tt)) tt = t; };

    if (stock.shape === 'cylinder') {
        const cyl = cylinderOf(stock, rotaryAxis);
        cyl.r += r;   // the ball touches the OD a radius out
        const rc = rayCylinder(A, B, cyl);
        if (rc.hit) { if (rc.tEnter > 1e-6) take(rc.tEnter); else if (rc.tExit > 1e-6) take(rc.tExit); }
        return tt;
    }

    const box = { min: { x: -r, y: -r, z: -stock.z - r }, max: { x: stock.x + r, y: stock.y + r, z: r } };
    const ro = rayBox(A, B, box.min, box.max);
    if (ro.hit) { if (ro.tEnter > 1e-6) take(ro.tEnter); else if (ro.tExit > 1e-6) take(ro.tExit); }
    if (stock.shape === 'pocket') {                       // a hole in the block — same inset the 3D view renders
        const w = Math.max(8, Math.min(stock.x, stock.y) * 0.25);
        const cav = { min: { x: w + r, y: w + r, z: -stock.z }, max: { x: stock.x - w - r, y: stock.y - w - r, z: 0 } };
        const rc = rayBox(A, B, cav.min, cav.max);
        if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6) take(rc.tExit);   // probing from inside the hole → its wall
    }
    return tt;
}
