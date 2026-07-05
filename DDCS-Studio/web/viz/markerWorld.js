// The per-pass MARKER WORLD — the ONE shared, WIZARD-AGNOSTIC source both preview surfaces read so they can't diverge:
// the 3D preview (gcodeViz3d._markerWorld → the ruby sprite) AND the bottom Layout (panelTypes.layoutSpecFromOp → the
// reposition handle). Given the per-pass DECLARED starts (with the `pinned` + `anchorsAtPrev` flags computePassStarts sets)
// and the per-pass runtime ENDs, it returns where pass p's marker actually renders:
//   • pinned         → the row itself (a datum-PINNED wall: its world is ABSOLUTE — the operator dropped it on the stock).
//   • anchorsAtPrev  → the previous pass's RUNTIME END (post probe+retract+lift) + this pass's reposition delta (the
//                      dog-leg destination — the machine-correct wall approach, t107).
//   • else           → the declared row.
// Reads ONLY generic pass-record fields (x/y/z, pinned, anchorsAtPrev) — NOTHING wizard-specific. A new wizard inherits
// marker-holds + both-panels-coincident by feeding its OWN datum-pinned worlds through computePassStarts; this mechanism
// is untouched (t301 Seam C — the pilot-principle consumer path).
export function markerWorldOf(starts, passEnds, p) {
    const row = (starts && starts[p]) || { x: 0, y: 0, z: 0 };
    if (row.pinned) return row;
    const prev = starts && starts[p - 1];
    const end = passEnds && passEnds[p - 1];
    if (row.anchorsAtPrev && p > 0 && end && prev) {
        return { x: end.x + (row.x - prev.x), y: end.y + (row.y - prev.y), z: end.z + (row.z - prev.z) };
    }
    return row;
}
