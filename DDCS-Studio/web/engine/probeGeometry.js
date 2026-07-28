/**
 * engine/probeGeometry.js — shared probe-vs-stock collision, used by BOTH the execution engine
 * (GcodeExecutionEngine) and the 3D sim (gcodeViz3d._rebuild) so a probe stops at the SAME surface in
 * the simulated run and the drawn preview. One source of truth → the two can't drift.
 *
 * Pure geometry: no settings / DOM / THREE deps. Frame = STOCK-LOCAL — the box is x∈[0,X] y∈[0,Y]
 * z∈[-Z,0] (top face at z=0), and the caller passes the probe segment A→B in that same frame.
 */
import { projectWorkpiece } from './workpiece.js';   // t385 — the pocket cavity reads the DECLARED workpiece feature (stock-modal size), not a hardcoded 25% inset

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
    // t1301 — THE STOCK'S OWN DECLARED AXIS WINS. t1281 gave a cylinder `stock.axis` because guessing from the rotary
    // MOTOR is wrong for a lathe bar (a lathe declares no rotary motor, so the guess fell back to X and laid the bar
    // across the machine). The mesh was fixed then; this — the collision the probe stop uses — still guessed, so a
    // lathe probe hit nothing and drew its full seek straight through the bar and out the other side of the centreline.
    const declared = stock && (stock.axis === 'x' || stock.axis === 'y' || stock.axis === 'z') ? stock.axis : null;
    const axis = declared || ((rotaryAxis === 'y' || rotaryAxis === 'z') ? rotaryAxis : 'x');
    const dims = { x: stock.x, y: stock.y, z: stock.z };
    const ctr = { x: dims.x / 2, y: dims.y / 2, z: -dims.z / 2 };
    const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
    const r = barRadius(stock, dims[cross[0]], dims[cross[1]]);
    const lo = axis === 'z' ? -dims.z : 0, hi = axis === 'z' ? 0 : dims[axis];   // axial extent in stock-local
    return { axis, u: cross[0], v: cross[1], cu: ctr[cross[0]], cv: ctr[cross[1]], r, lo, hi };
}

/**
 * Ray vs finite cylinder — INCLUDING ITS END FACES. Returns { hit, tEnter, tExit }.
 *
 * t1301 — THE CAPS WERE MISSING, and on a lathe the caps are the point. This modelled an infinite tube clipped to an
 * axial span: a ray running ALONG the axis was declared a miss outright, because the only case that had ever mattered
 * was a mill probing a rotary bar on its round. A lathe FACE probe travels exactly along the axis into the end of the
 * bar — so it hit nothing and drew itself straight through sixty millimetres of steel.
 *
 * Solved as two intervals intersected (the slab method, one radial pair and one axial pair), which gives the caps for
 * free and leaves a radial touch answering exactly as before.
 */
export function rayCylinder(A, B, cyl) {
    const { axis, u, v, cu, cv, r, lo, hi } = cyl;
    const Au = A[u] - cu, Av = A[v] - cv, du = B[u] - A[u], dv = B[v] - A[v];
    // …the interval of t over which the ray is INSIDE the radius
    const a = du * du + dv * dv;
    let rEnter = -Infinity, rExit = Infinity;
    if (a < 1e-12) {
        if (Au * Au + Av * Av > r * r + 1e-6) return { hit: false };   // parallel to the axis and outside it — never enters
    } else {
        const b = 2 * (Au * du + Av * dv);
        const c = Au * Au + Av * Av - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return { hit: false };
        const sq = Math.sqrt(disc);
        rEnter = (-b - sq) / (2 * a); rExit = (-b + sq) / (2 * a);
        if (rEnter > rExit) { const tmp = rEnter; rEnter = rExit; rExit = tmp; }
    }
    // …and the interval over which it is inside the axial EXTENT — the two end faces
    const dAx = B[axis] - A[axis];
    let aEnter = -Infinity, aExit = Infinity;
    if (Math.abs(dAx) < 1e-9) {
        if (A[axis] < lo - 1e-6 || A[axis] > hi + 1e-6) return { hit: false };
    } else {
        aEnter = (lo - A[axis]) / dAx; aExit = (hi - A[axis]) / dAx;
        if (aEnter > aExit) { const tmp = aEnter; aEnter = aExit; aExit = tmp; }
    }
    const tEnter = Math.max(rEnter, aEnter), tExit = Math.min(rExit, aExit);
    if (tEnter > tExit) return { hit: false };
    return { hit: true, tEnter, tExit };
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
        cyl.r += r;                       // the ball touches the OD a radius out…
        cyl.lo -= r; cyl.hi += r;         // …and the END FACES the same way (t1301) — a face touch stops the CENTRE a radius short
        const rc = rayCylinder(A, B, cyl);
        if (rc.hit) { if (rc.tEnter > 1e-6) take(rc.tEnter); else if (rc.tExit > 1e-6) take(rc.tExit); }
        return tt;
    }

    const box = { min: { x: -r, y: -r, z: -stock.z - r }, max: { x: stock.x + r, y: stock.y + r, z: r } };
    const ro = rayBox(A, B, box.min, box.max);
    // t385 (human) — READ the workpiece FEATURES (getWorkpiece/projectWorkpiece — the stock-modal size + the DECLARED DEPTH),
    // NOT a hardcoded inset. A DECLARED-DEPTH pocket is a REAL RECESS (a Fusion cut): the top is OPEN over its footprint down to
    // −depth and the FLOOR is at −depth. So a Z-first probe INSIDE the pocket stops at the FLOOR, not the stock top. A LEGACY /
    // through pocket (depth ≥ Z) has no floor → the through-hole is UNCHANGED (byte-identical). The tool CENTRE stops a tip-r short.
    const recesses = (stock.shape === 'pocket')
        ? projectWorkpiece(stock).features.filter((f) => f.side === 'inside' && f.size).map((f) => {
            const d0 = Number(f.depth);
            return { cx: (f.pos && +f.pos.x) || stock.x / 2, cy: (f.pos && +f.pos.y) || stock.y / 2, hx: (+f.size.x || 0) / 2, hy: (+f.size.y || 0) / 2, depth: Number.isFinite(d0) ? Math.max(0, Math.min(d0, stock.z)) : stock.z };
        }) : [];
    const inFoot = (x, y, rc) => x > rc.cx - rc.hx + 1e-6 && x < rc.cx + rc.hx - 1e-6 && y > rc.cy - rc.hy + 1e-6 && y < rc.cy + rc.hy - 1e-6;
    // OUTER box — but its TOP is REMOVED over a declared recess footprint (the pocket opening), so don't stop the probe there.
    if (ro.hit && ro.tEnter > 1e-6) {
        const px = A.x + (B.x - A.x) * ro.tEnter, py = A.y + (B.y - A.y) * ro.tEnter, pz = A.z + (B.z - A.z) * ro.tEnter;
        const openTop = Math.abs(pz - r) < 1e-4 && recesses.some((rc) => rc.depth > 0 && rc.depth < stock.z && inFoot(px, py, rc));
        if (!openTop) take(ro.tEnter); else if (ro.tExit > 1e-6) take(ro.tExit);
    } else if (ro.hit && ro.tExit > 1e-6) take(ro.tExit);
    for (const rc of recesses) {
        // RECESS FLOOR (declared depth) — the material BELOW the recess; a Z-first probe over the footprint stops at its TOP (−depth).
        if (rc.depth > 0 && rc.depth < stock.z) {
            const fb = { min: { x: rc.cx - rc.hx + r, y: rc.cy - rc.hy + r, z: -stock.z - r }, max: { x: rc.cx + rc.hx - r, y: rc.cy + rc.hy - r, z: -rc.depth + r } };
            const rf = rayBox(A, B, fb.min, fb.max);
            if (rf.hit) { if (rf.tEnter > 1e-6) take(rf.tEnter); else if (rf.tExit > 1e-6) take(rf.tExit); }
        }
        // the pocket WALL (bore probe from INSIDE the hole) — the cavity void; stops a sideways probe at the rendered wall.
        const cav = { min: { x: rc.cx - rc.hx + r, y: rc.cy - rc.hy + r, z: -stock.z }, max: { x: rc.cx + rc.hx - r, y: rc.cy + rc.hy - r, z: 0 } };
        const rc2 = rayBox(A, B, cav.min, cav.max);
        if (rc2.hit && rc2.tEnter <= 1e-6 && rc2.tExit > 1e-6) take(rc2.tExit);
    }
    return tt;
}
