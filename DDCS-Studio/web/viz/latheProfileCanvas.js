/**
 * viz/latheProfileCanvas.js — THE HALF-PROFILE, drawn (t1271). The pilot's marker-derived handle lives here.
 *
 * A lathe part is read as one half of its section: Z across, X (radius) up, the centreline along the bottom. Nobody
 * draws the mirrored half — it is the same profile again, twice the ink for no information.
 *
 * IT DRAWS THE MODEL'S DATA, IT DOES NOT COMPUTE GEOMETRY. `halfProfile()` (data/lathe.js) says where the bar, the
 * datum and the allowance are; this maps that into the shared FeatureCanvas frame and back. If the picture ever
 * disagrees with the emit, exactly one of them read the model wrong — there is no second opinion to reconcile.
 *
 * ── THE FACE LINE IS THE HANDLE (the mechanism the family inherits) ──────────────────────────────────────────────
 * Dragging the face line in Z does not "move a line": it WRITES THE ALLOWANCE — how much material sits ahead of the
 * finished face — and the emit follows, because the allowance is the bound parameter the macro's #var header holds.
 * That is the tieDiagTravel pattern: a handle is a second way to type a number, never a second source of truth. The
 * form mirrors it live, and a test drags it and re-reads the EMIT, because a handle that moves pixels without moving
 * the program is the exact failure this pattern exists to prevent.
 *
 * THE CANVAS FRAME: FeatureCanvas is X-right / Y-up, so the lathe's Z maps to canvas x and its RADIUS to canvas y.
 * That mapping is stated once, here, in zToCanvas/canvasToZ — the two are inverses and are tested as such.
 */
import { halfProfile, normalizeBar, radiusOf } from '../data/lathe.js';

/** Lathe Z → canvas x. The bar runs left (chuck, −Z) to right (raw face, +Z), which is how a turner faces one. */
export const zToCanvas = (z) => z;
/** …and back. Inverses by construction; a test asserts it rather than trusting the symmetry. */
export const canvasToZ = (x) => x;

export const FACE_HANDLE_ID = 'faceLine';

/**
 * Build the canvas spec for a bar.
 * @param {object} bar        {diameter, stickOut, allowance}
 * @param {(allowance:number) => void} onAllowance  called with the NEW allowance while the face line is dragged
 * @returns a FeatureCanvas spec: shapes to draw, one draggable handle, and the drag→parameter write
 */
export function latheProfileSpec(bar, onAllowance) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const r = radiusOf(b.diameter);

    return {
        // the drawing frame: the whole bar plus a little air above the OD so the outline is not on the edge
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: r * 1.35 },
        items: [
            // the bar silhouette, from the model's own outline — not recomputed here
            { kind: 'poly', points: prof.outline.map((p) => ({ x: zToCanvas(p.z), y: p.x })), label: `Ø${b.diameter}` },
            // the centreline: a lathe drawing is meaningless without it
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0, dashed: true, label: 'centreline' },
            // THE ALLOWANCE — the material that gets faced off, between the datum and the raw end
            { kind: 'band', x1: zToCanvas(prof.allowance.z1), x2: zToCanvas(prof.allowance.z2), y1: 0, y2: r, label: 'to remove' },
            // Z0, the finished face
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: r * 1.2, label: 'Z0 — finished face' },
        ],
        handles: [
            // TEAL = it drives the emit (the declared convention: teal handles write bound parameters; amber ones are
            // sim-only). It sits on the RAW END, because that is what moves when you decide to remove more or less.
            { id: FACE_HANDLE_ID, x: zToCanvas(prof.allowance.z2), y: r, kind: 'size', axis: 'x', teal: true,
              label: 'face', value: b.allowance },
        ],
        onDrag: (id, world) => {
            if (id !== FACE_HANDLE_ID || typeof onAllowance !== 'function') return;
            // …clamped at the finished face: dragging PAST Z0 would mean negative material, which is not a smaller
            // cut, it is a cut into the finished part. The handle stops where the part starts.
            const z = Math.max(0, canvasToZ(world.x));
            onAllowance(Math.round(z * 1000) / 1000);
        },
    };
}
