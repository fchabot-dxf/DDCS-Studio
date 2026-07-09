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

/** Read the WCS / pin table ONCE — the shared source both the machine-frame part offset (partZeroShift) and the part-frame
 *  stock pin (stockPinOffset) derive from, so how the pin is indexed + which fallback fires can't drift between renderers.
 *  `isPinned` = the stock declares a real WCS pin AND a table exists (matches _partShift's pinned branch — NOT whether the
 *  row resolves; a pinned-but-missing row stays at 0, it does NOT fall to the active-WCS fallback). */
function readWcs(machine, stock) {
    const m = machine, s = stock;
    const shown = !!(m && m.show && m.x && m.y && m.z);
    const wt = m && m.wcs && m.wcs.table;
    const wo = (m && m.workOrigin) || {};
    const pin = s && s.pin;
    const isPinned = !!(pin && pin !== 'origin' && Array.isArray(wt));
    const pinRow = isPinned ? (wt[parseInt(String(pin).replace(/[^0-9]/g, ''), 10) - 54] || null) : null;   // 'g54' → table[0]
    const activeRow = (Array.isArray(wt) && wt[(((m && m.wcs && m.wcs.active) || 1) - 1)]) || null;
    return { m, s, shown, wo, isPinned, pinRow, activeRow };
}

/** THE part-frame offset — machine coords of part-zero. XY = the stock's "Sits at WCS" pin (its table row), else the active
 *  WCS row / machine.workOrigin fallback (mirrors wcsForViz EXACTLY — t173). Z = the FIXED machine table minus the stock-floor
 *  depth (`stockFloorZ`, the stock bottom in part-local Z; a viz value — XY-only renderers pass null → the pin's WCS-Z). No
 *  envelope shown → {0,0,0} (part-zero at scene 0, the per-op view). Extracted verbatim from gcodeViz3d._partShift (t582). */
export function partZeroShift(machine, stock, stockFloorZ) {
    const r = readWcs(machine, stock);
    if (!r.shown) return { x: 0, y: 0, z: 0 };
    let x = 0, y = 0, wcsZ = 0;   // XY — the stock's WCS (G54 XY): the persistent fixture position.
    if (r.isPinned) {
        if (r.pinRow) { x = Number(r.pinRow.x) || 0; y = Number(r.pinRow.y) || 0; wcsZ = Number(r.pinRow.z) || 0; }
    } else {
        // No stock pinned to a WCS (ATC/machine-frame preview): sit at the ACTIVE WCS so a G53 move CANCELS to raw machine
        // coords on the fixed envelope (t163). Mirror wcsForViz's fallback: active table row, else workOrigin, else 0.
        const a = r.activeRow || r.wo;
        if (a) { x = Number(a.x) || 0; y = Number(a.y) || 0; }
    }
    // Z — the stock rests on the FIXED machine table; Z0 floats at the datum height (the stored WCS-Z is volatile per part).
    const tableFloor = Math.min(0, r.m.z), stockShown = r.s && r.s.show && r.s.z > 0 && stockFloorZ != null;
    const z = stockShown ? tableFloor - stockFloorZ : wcsZ;
    return { x, y, z };
}

/** The 2D top-down STOCK PIN — the fixture offset of the stock from part-zero in the PART frame: the stock's WCS table row
 *  MINUS the active work origin, ONLY when the stock is explicitly pinned (else {0,0} — an unpinned stock IS part-zero).
 *  Same table read as partZeroShift (ONE source: the pin index + lookup can't drift); the part-frame base subtracts
 *  workOrigin (partZeroShift is machine-frame). Byte-identical to toolpath2d's former local stockPin() (t584). */
export function stockPinOffset(machine, stock) {
    const r = readWcs(machine, stock);
    if (!r.pinRow) return { x: 0, y: 0 };
    return { x: (Number(r.pinRow.x) || 0) - (Number(r.wo.x) || 0), y: (Number(r.pinRow.y) || 0) - (Number(r.wo.y) || 0) };
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
