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
 */
export class PartFrame {
    constructor(scene, THREE) {
        this.group = new THREE.Group();
        this.group.name = 'partFrame';
        scene.add(this.group);
        this.shift = { x: 0, y: 0, z: 0 };
    }

    /** Add an object to the moving part frame (instead of scene.add). */
    add(obj) { this.group.add(obj); return obj; }

    /** Offset = the active WCS (machine coords of part-zero) when a machine envelope is shown; else 0 (part-zero at
     *  scene 0). Returns true if the offset changed. */
    update(machine) {
        const on = !!(machine && machine.show && machine.x && machine.y && machine.z);
        const o = (on && machine.workOrigin) ? machine.workOrigin : { x: 0, y: 0, z: 0 };
        const nx = o.x || 0, ny = o.y || 0, nz = o.z || 0;
        const changed = nx !== this.shift.x || ny !== this.shift.y || nz !== this.shift.z;
        this.shift = { x: nx, y: ny, z: nz };
        this.group.position.set(nx, ny, nz);
        return changed;
    }
}
