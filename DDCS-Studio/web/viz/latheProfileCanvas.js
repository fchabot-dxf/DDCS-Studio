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
import { halfProfile, normalizeBar, radiusOf, diameterOf } from '../data/lathe.js';

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
        // THE DRAWING FRAME IS THE BAR ITSELF — its half-section, Z across and radius up. The canvas draws `stock` as
        // the outline rectangle, so the bar needs no second silhouette on top of it.
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: r },
        items: [
            // the centreline: a lathe drawing is meaningless without it
            { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
            // THE ALLOWANCE — the material that gets faced off, between the datum and the raw end
            { kind: 'rect', x: zToCanvas(prof.allowance.z1), y: 0, w: prof.allowance.z2 - prof.allowance.z1, h: r, cls: 'fc-feature' },
            // Z0, the finished face
            { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: r },
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

// ── THE WIRING (t1273) ──────────────────────────────────────────────────────────────────────────────────────────
/** The DECLARED layout kind a lathe op puts in its template (`{type:'layout', params:{kind}}`), so the wizard's 2D
 *  pane draws THIS instead of the mill's XY stock rectangle. Declared data — it travels in the `.wiz` like the rest. */
export const LATHE_LAYOUT_KIND = 'lathe_profile';

/**
 * WHICH BAR THE PICTURE SHOWS. A lathe workspace's stock is a cylinder; when one is configured we draw THAT, so the
 * canvas is about the operator's actual bar. With none configured we fall back to the op's own default rather than
 * drawing nothing — an empty pane teaches nobody what the numbers mean.
 */
export function barFromSettings(fallback) {
    let s = null;
    try { s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings().stock || null) : null; } catch (_) { s = null; }
    const dia = s && (s.shape === 'cylinder') && Number(s.diameter) > 0 ? Number(s.diameter) : null;
    return normalizeBar({
        diameter: dia || (fallback && fallback.diameter) || 20,
        stickOut: (dia && Number(s.z) > 0) ? Number(s.z) : ((fallback && fallback.stickOut) || 60),
        allowance: (fallback && fallback.allowance) != null ? fallback.allowance : 1,
    });
}

/**
 * THE ONE ENTRY the wizard panel calls: an op declaring the lathe layout → its half-profile spec, with every drag
 * routed to `setFields` (the same writer every other canvas handle uses, so a lathe drag and a mill drag reach the
 * form the same way). An op that does not declare it → null, and the mill layout runs untouched.
 * @param {object} def       the user-op def (its layout kind + opType)
 * @param {object} params    the live form params
 * @param {(patch:object)=>void} setFields  writes {param: value} into the form fields
 */
export function latheLayoutSpec(def, params, setFields) {
    const kind = def && def.layout && def.layout.kind;
    if (kind !== LATHE_LAYOUT_KIND) return null;
    const p = params || {};
    const write = (patch) => { if (typeof setFields === 'function') setFields(patch); };
    // FACING: the face line writes the allowance. OD: the shoulder corner writes the diameter and the length.
    if (/facing/.test(String(def.opType || ''))) {
        const bar = barFromSettings({ allowance: Number(p.allowance) || 0 });
        return latheProfileSpec(bar, (allowance) => write({ allowance }));
    }
    const bar = barFromSettings(null);
    return odProfileSpec(bar, {
        kind: p.kind, targetDiameter: p.targetDiameter, endDiameter: p.endDiameter, depth: p.depth,
    }, write);
}

// ── OD TURNING (t1273) ──────────────────────────────────────────────────────────────────────────────────────────
/** The shoulder corner: where the turned diameter meets the untouched bar. It IS the op — both its numbers. */
export const SHOULDER_HANDLE_ID = 'shoulder';
/** The face corner. A taper only: it is where the SECOND diameter lives, so it only exists when there are two. */
export const FACE_DIA_HANDLE_ID = 'faceDia';

const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * The half-profile with the FINISHED SHAPE drawn on it, and the corner handles that define it.
 *
 * ── ONE HANDLE, TWO OUTPUTS (the tieDiagTravel pattern the pilot proved) ─────────────────────────────────────────
 * The shoulder corner is a single grab that writes BOTH numbers: its X is the diameter being turned, its Z is how
 * far along the bar the turn runs. That is not a convenience — it is what the corner IS. Splitting it into two
 * sliders would ask a person to describe a point they can already see.
 *
 * A TAPER ADDS THE SECOND CORNER, and each diameter sits on the corner it physically belongs to: on a taper the
 * shoulder is the FAR end (so it carries the far-end Ø) and the added face corner carries the target Ø. Labelling
 * them the other way round would put a number on a corner that is not at that diameter — a picture that lies.
 *
 * CLAMPED INSIDE THE BAR: a target at or outside the bar diameter is a pass that never touches metal, and a depth
 * of zero or less is not a turn. The handle stops at what the machine can actually do.
 *
 * @param {object} bar   {diameter, stickOut, allowance}
 * @param {object} od    {kind, targetDiameter, endDiameter, depth}
 * @param {(patch:object) => void} onChange  called with the changed FIELDS ({targetDiameter, depth, …}) on a drag
 */
export function odProfileSpec(bar, od, onChange) {
    const b = normalizeBar(bar);
    const prof = halfProfile(b);
    const barR = radiusOf(b.diameter);
    const o = od || {};
    const taper = o.kind === 'taper';
    const targetR = radiusOf(Number(o.targetDiameter) || 0);
    // AN UNSET FAR END FOLLOWS THE TARGET, exactly as the emit does (the socket holds the reference until someone
    // types or drags a number). Reading it as 0 would draw a cone to a point the moment you picked Taper — a picture
    // of something the program was never going to cut.
    const endR = (taper && Number(o.endDiameter) > 0) ? radiusOf(Number(o.endDiameter)) : targetR;
    const depth = Math.max(0, Number(o.depth) || 0);
    const zEnd = -depth;                         // the turn runs from the finished face TOWARD the chuck

    const lo = Math.min(targetR, endR);
    const items = [
        { kind: 'line', x1: zToCanvas(prof.centreline.z1), y1: 0, x2: zToCanvas(prof.centreline.z2), y2: 0 },
        // THE MATERIAL THIS OP REMOVES — between the finished surface and the bar, over the turned length
        { kind: 'rect', x: zToCanvas(zEnd), y: lo, w: depth, h: Math.max(0, barR - lo), cls: 'fc-feature' },
        // THE FINISHED SURFACE: one line from the face end to the far end. Sloped when the two radii differ — the
        // taper is drawn by the same line, because a taper is not a different shape, it is different numbers.
        { kind: 'line', x1: zToCanvas(0), y1: targetR, x2: zToCanvas(zEnd), y2: endR },
        // the shoulder itself: where the turned surface climbs back to the untouched bar
        { kind: 'line', x1: zToCanvas(zEnd), y1: endR, x2: zToCanvas(zEnd), y2: barR },
        // Z0, the finished face
        { kind: 'line', x1: zToCanvas(prof.datum.z), y1: 0, x2: zToCanvas(prof.datum.z), y2: barR },
    ];

    const handles = [
        { id: SHOULDER_HANDLE_ID, x: zToCanvas(zEnd), y: endR, kind: 'size', teal: true,
          label: taper ? 'far end' : 'shoulder', value: taper ? o.endDiameter : o.targetDiameter },
    ];
    if (taper) handles.push({ id: FACE_DIA_HANDLE_ID, x: zToCanvas(0), y: targetR, kind: 'size', axis: 'y', teal: true,
                              label: 'face Ø', value: o.targetDiameter });

    return {
        // the frame IS the bar's half-section — the canvas draws it as the outline, so no second silhouette
        stock: { ox: prof.bounds.z1, oy: 0, w: prof.bounds.z2 - prof.bounds.z1, h: barR },
        items,
        handles,
        onDrag: (id, world) => {
            if (typeof onChange !== 'function') return;
            // …a hair inside the bar, never AT it: a pass at exactly the bar radius cuts nothing but air.
            const insideBar = (r) => Math.min(Math.max(0, r), barR - 0.001);
            if (id === SHOULDER_HANDLE_ID) {
                const dia = r3(diameterOf(insideBar(world.y)));
                const len = r3(Math.max(0.001, -canvasToZ(world.x)));    // depth grows into −Z; zero is not a turn
                onChange(taper ? { endDiameter: dia, depth: len } : { targetDiameter: dia, depth: len });
                return;
            }
            if (id === FACE_DIA_HANDLE_ID) onChange({ targetDiameter: r3(diameterOf(insideBar(world.y))) });
        },
    };
}
