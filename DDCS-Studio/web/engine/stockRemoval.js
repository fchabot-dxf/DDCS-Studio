/**
 * engine/stockRemoval.js — MATERIAL REMOVAL (t680, E1). A 2.5D HEIGHTMAP carve behind a CarveMap seam so a cylindrical
 * (rotary, E2) map or a voxel engine can replace it later without touching the callers.
 *
 * FRAME = STOCK-LOCAL (matches probeGeometry / gcodeViz3d setStock): XY ∈ [0,X]×[0,Y], the TOP face at z = 0, down is
 * NEGATIVE, the bottom at z = −Z. Each cell holds the REMAINING-MATERIAL top height (h ≤ 0; 0 = full stock, −Z = cut
 * through). The mesh is the displaced grid (a plane at each cell's h) + a skirt; the viz builds it, this holds the map.
 *
 * RULINGS (advisor t680): (A) cells capped at 256/axis, cell-size clamped ≥ 0.2mm (big stock degrades resolution, never
 * perf). (B) FLAT endmill only — the tool bottom is the tip Z; ball/vee are approximated as flat (honest note in the UI).
 * (E) unknown tool Ø → the caller passes the 6mm default. Only 'feed' (cut) moves carve — probe (G31) + rapid (G0) NEVER
 * (keyed off the engine's DECLARED per-segment class, never inferred). ABOVE-the-top moves no-op by construction
 * (tipZ > 0 is never < h ≤ 0). Deterministic: the same segment stream + seed → the same map (live converges to end-state).
 */

export const CARVE_MAX_CELLS = 256;   // per axis (A)
export const CARVE_MIN_CELL = 0.2;    // mm — the finest cell (A): tiny stock stays sane
export const CARVE_DEFAULT_DIA = 6;   // mm — the honest default endmill Ø (E)

export class HeightmapCarve {
    constructor(stock, features) { this.reseed(stock || {}, features || []); }

    /** (Re)initialise the grid from the stock box + the DECLARED workpiece features (the recess pre-seed). */
    reseed(stock, features) {
        const X = Math.max(0.001, Number(stock.x) || 0);
        const Y = Math.max(0.001, Number(stock.y) || 0);
        const Z = Math.max(0, Number(stock.z) || 0);
        // cells/axis: at least 2 (a quad), at most CARVE_MAX_CELLS, and never finer than CARVE_MIN_CELL.
        this.nx = Math.max(2, Math.min(CARVE_MAX_CELLS, Math.floor(X / CARVE_MIN_CELL) + 1));
        this.ny = Math.max(2, Math.min(CARVE_MAX_CELLS, Math.floor(Y / CARVE_MIN_CELL) + 1));
        this.dx = X / (this.nx - 1);
        this.dy = Y / (this.ny - 1);
        this.X = X; this.Y = Y; this.Z = Z;
        this.top = 0;          // stock-local top
        this.bottom = -Z;      // stock-local bottom (clamp floor — can't cut below the stock)
        this.h = new Float32Array(this.nx * this.ny);   // remaining top per cell; 0 = full stock
        for (const f of (features || [])) this._preCarveFeature(f);
        this.seedSnapshot = this.h.slice();   // the untouched-by-cutting baseline (probe-carves-nothing assert)
        this.dirty = true;
    }

    idx(i, j) { return j * this.nx + i; }
    /** The stock-local XY centre of cell (i,j). */
    cellXY(i, j) { return { x: i * this.dx, y: j * this.dy }; }

    /** Pre-carve a declared recess: rect (size.x/y) or round (size.d) footprint at `pos`, to −depth. */
    _preCarveFeature(f) {
        if (!f || f.side === 'outside') return;   // outside features (bosses) add nothing to the initial top
        const depth = Math.max(0, Number(f.depth) || 0);
        if (!(depth > 0)) return;
        const floorZ = Math.max(this.bottom, -depth);
        const cx = Number((f.pos || {}).x) || 0, cy = Number((f.pos || {}).y) || 0;
        const round = f.shape === 'round';
        const hx = round ? (Number((f.size || {}).d) || 0) / 2 : (Number((f.size || {}).x) || 0) / 2;
        const hy = round ? hx : (Number((f.size || {}).y) || 0) / 2;
        if (!(hx > 0) || !(hy > 0)) return;
        const i0 = Math.max(0, Math.floor((cx - hx) / this.dx)), i1 = Math.min(this.nx - 1, Math.ceil((cx + hx) / this.dx));
        const j0 = Math.max(0, Math.floor((cy - hy) / this.dy)), j1 = Math.min(this.ny - 1, Math.ceil((cy + hy) / this.dy));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const p = this.cellXY(i, j);
            const inside = round ? (((p.x - cx) * (p.x - cx)) / (hx * hx) + ((p.y - cy) * (p.y - cy)) / (hy * hy) <= 1)
                : (Math.abs(p.x - cx) <= hx && Math.abs(p.y - cy) <= hy);
            if (inside) { const k = this.idx(i, j); if (floorZ < this.h[k]) this.h[k] = floorZ; }
        }
    }

    /** Squared XY distance from a point to the segment A→B, plus the clamped projection param t (for the tip-Z interp). */
    _segDist2(px, py, ax, ay, dxv, dyv, len2) {
        if (len2 < 1e-9) { const ex = px - ax, ey = py - ay; return { d2: ex * ex + ey * ey, t: 0 }; }
        let t = ((px - ax) * dxv + (py - ay) * dyv) / len2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const qx = ax + t * dxv, qy = ay + t * dyv, ex = px - qx, ey = py - qy;
        return { d2: ex * ex + ey * ey, t };
    }

    /**
     * Carve the swept CAPSULE between two consecutive tool positions (stock-local coords). Only a 'feed' (cut) move
     * removes material; 'probe'/'rapid'/anything else is skipped (the DECLARED class). FLAT endmill: the removed height
     * is the tool-tip Z at the cell's CLOSEST approach to the segment axis — ANALYTIC (t676 amendment: exact distance-to-
     * segment, no stair accumulation → flat floors + consistent walls). The BOUNDARY is anti-aliased by a distance-ramp
     * coverage `c = clamp(0.5 + (r − d)/cell, 0, 1)` (fractional wall height over one cell → a straight edge renders
     * straight, not a wavy staircase; the tool cap / a plunge → a ROUND footprint since it uses the true radial distance).
     * Returns true if any cell changed.
     * @param {{x,y,z}} prev  @param {{x,y,z}} pos  @param {number} toolR tool radius (mm)  @param {string} cls segment class
     */
    carveSegment(prev, pos, toolR, cls) {
        if (cls !== 'feed') return false;   // probe / rapid never carve
        const r = toolR > 0 ? toolR : CARVE_DEFAULT_DIA / 2;
        const ax = Number(prev.x) || 0, ay = Number(prev.y) || 0, az = Number(prev.z) || 0;
        const bx = Number(pos.x) || 0, by = Number(pos.y) || 0, bz = Number(pos.z) || 0;
        // skip entirely-above-the-top segments (both tips above 0): nothing to remove (perf + correctness)
        if (az > 1e-6 && bz > 1e-6) return false;
        const dxv = bx - ax, dyv = by - ay, len2 = dxv * dxv + dyv * dyv;
        const cell = Math.max(this.dx, this.dy), half = cell / 2, band = r + half;   // AA ramp is one cell wide, centred on the edge
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - band) / this.dx)), i1 = Math.min(this.nx - 1, Math.ceil((Math.max(ax, bx) + band) / this.dx));
        const j0 = Math.max(0, Math.floor((Math.min(ay, by) - band) / this.dy)), j1 = Math.min(this.ny - 1, Math.ceil((Math.max(ay, by) + band) / this.dy));
        const bandR2 = band * band;
        let changed = false;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const cx = i * this.dx, cy = j * this.dy;
            const pc = this._segDist2(cx, cy, ax, ay, dxv, dyv, len2);
            if (pc.d2 > bandR2) continue;      // the whole cell is clear of the tool (past the AA band)
            // COVERAGE: a distance ramp across the tool edge — c=1 fully inside, 0.5 at the edge, 0 a half-cell past it.
            const c = pc.d2 <= 0 ? 1 : Math.min(1, Math.max(0, 0.5 + (r - Math.sqrt(pc.d2)) / cell));
            if (c <= 0) continue;
            // FLAT endmill: the floor is the tip Z at the CLOSEST approach (constant-Z pass → flat floor by construction).
            let tipZ = (len2 < 1e-9) ? Math.min(az, bz) : az + pc.t * (bz - az);
            if (tipZ < this.bottom) tipZ = this.bottom;   // can't cut below the stock
            const k = this.idx(i, j), h0 = this.h[k];
            const targetZ = h0 + c * (tipZ - h0);   // c=1 → tipZ exactly; c<1 → a partial lowering (bounded in [tipZ,h0] → never over-cuts)
            if (targetZ < h0) { this.h[k] = targetZ; changed = true; }
        }
        if (changed) this.dirty = true;
        return changed;
    }

    /** Carve a whole segment stream (the end-state fast path). segs = [{x1,y1,z1,x2,y2,z2,type}], toolR + a class map. */
    carveAll(segs, toolR) {
        for (const s of (segs || [])) {
            const cls = s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
            this.carveSegment({ x: s.x1, y: s.y1, z: s.z1 }, { x: s.x2, y: s.y2, z: s.z2 }, toolR, cls);
        }
        return this.dirty;
    }

    /** The remaining-material top height at a stock-local XY (nearest cell) — for assertions / probing the map. */
    heightAt(x, y) {
        const i = Math.max(0, Math.min(this.nx - 1, Math.round((Number(x) || 0) / this.dx)));
        const j = Math.max(0, Math.min(this.ny - 1, Math.round((Number(y) || 0) / this.dy)));
        return this.h[this.idx(i, j)];
    }

    /** True while the map differs from its seed (any cut removed material) — the probe-carves-nothing invariant reads this. */
    isPristine() { for (let k = 0; k < this.h.length; k++) if (this.h[k] !== this.seedSnapshot[k]) return false; return true; }
}
