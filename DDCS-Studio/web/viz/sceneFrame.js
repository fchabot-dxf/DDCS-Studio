/**
 * viz/sceneFrame.js — the machine-frame ↔ part-frame split for the 3D toolpath viz.
 *
 * Two frames share one scene (see [[machine-frame-sim-spec]]):
 *   • MACHINE frame (fixed): the envelope, machine-home, and floor grid live in machine coordinates — machine
 *     home sits at scene 0 and never moves when the WCS changes.
 *   • PART frame (moving): the op, stock, table/bed, tool, and start markers live in a group offset to +workOrigin
 *     (the active WCS). So the whole setup sits at its WCS spot INSIDE the fixed envelope; picking a different WCS
 *     moves the part, not the envelope. A labelled WCS-origin marker rides with it.
 *
 * When no machine envelope is shown, the offset is 0 — part-zero at scene 0, the simple per-op view (unchanged).
 *
 * The viz adds part things via partFrame.add() and machine things straight to the scene; on setMachine it calls
 * partFrame.update(machine) to set the offset. Pure scene-graph bookkeeping, no rendering knowledge.
 *
 * t582 PREVIEW-PARITY E2 (ONE FRAME SOURCE) — `partZeroShift()` is THE declared scene transform: the machine coords of
 * part-zero (the WCS spot the whole setup sits at INSIDE the fixed envelope). Every renderer (the 3D part group, the 2D
 * toolpath pin, the featureCanvas layout, the DRO) READS this ONE source instead of computing its own pin, so their frames
 * can never drift (the recurring few-inch-offset class). Pure data — no THREE, no rendering knowledge; settings + the
 * viz-provided stock-floor depth in, {x,y,z} machine coords out.
 */

/** THE part-frame offset — machine coords of part-zero. XY = the stock's "Sits at WCS" pin (its table row), else the active
 *  WCS row / machine.workOrigin fallback (mirrors wcsForViz EXACTLY — t173). Z = the FIXED machine table minus the stock-floor
 *  depth (`stockFloorZ`, the stock bottom in part-local Z; a viz value — XY-only renderers pass null → the pin's WCS-Z). No
 *  envelope shown → {0,0,0} (part-zero at scene 0, the per-op view). Extracted verbatim from gcodeViz3d._partShift (t582). */
export function partZeroShift(machine, stock, stockFloorZ) {
    const m = machine, s = stock;
    if (!(m && m.show && m.x && m.y && m.z)) return { x: 0, y: 0, z: 0 };
    let x = 0, y = 0, wcsZ = 0;   // XY — the stock's WCS (G54 XY): the persistent fixture position.
    const pin = s && s.pin, wt = m.wcs && m.wcs.table;
    if (pin && pin !== 'origin' && Array.isArray(wt)) {
        const t = wt[parseInt(String(pin).replace(/[^0-9]/g, ''), 10) - 54];   // 'g54' → table[0]
        if (t) { x = Number(t.x) || 0; y = Number(t.y) || 0; wcsZ = Number(t.z) || 0; }
    } else {
        // No stock pinned to a WCS (ATC/machine-frame preview): sit at the ACTIVE WCS so a G53 move CANCELS to raw machine
        // coords on the fixed envelope (t163). Mirror wcsForViz's fallback: active table row, else workOrigin, else 0.
        const a = (Array.isArray(wt) && wt[(((m.wcs && m.wcs.active) || 1) - 1)]) || m.workOrigin;
        if (a) { x = Number(a.x) || 0; y = Number(a.y) || 0; }
    }
    // Z — the stock rests on the FIXED machine table; Z0 floats at the datum height (the stored WCS-Z is volatile per part).
    const tableFloor = Math.min(0, m.z), stockShown = s && s.show && s.z > 0 && stockFloorZ != null;
    const z = stockShown ? tableFloor - stockFloorZ : wcsZ;
    return { x, y, z };
}

export class PartFrame {
    constructor(scene, THREE) {
        this.group = new THREE.Group();
        this.group.name = 'partFrame';
        scene.add(this.group);
        this.shift = { x: 0, y: 0, z: 0 };
    }

    /** Add an object to the moving part frame (instead of scene.add). */
    add(obj) { this.group.add(obj); return obj; }

    /** Set the part-frame offset = machine coords of part-zero (the STOCK's WCS in machine view, else 0). The viz
     *  computes it (stock pin + WCS table) so op + stock share ONE source. Returns true if it changed. */
    update(shift) {
        const o = shift || { x: 0, y: 0, z: 0 };
        const nx = o.x || 0, ny = o.y || 0, nz = o.z || 0;
        const changed = nx !== this.shift.x || ny !== this.shift.y || nz !== this.shift.z;
        this.shift = { x: nx, y: ny, z: nz };
        this.group.position.set(nx, ny, nz);
        return changed;
    }
}
