/**
 * viz/canvasWidgets.js — reusable CANVAS-HANDLE gestures for the FeatureCanvas (the canvas analogue of formWidgets.js).
 *
 * FeatureCanvas already gives the generic drag PLUMBING (hit-test a handle, hand back a world point via spec.onDrag).
 * What every wizard view currently HAND-ROLLS is the param MATH — where to place each handle from the current value,
 * and how a drag maps back to the field. This registry owns that math ONCE, keyed by gesture type, so a view (or, later,
 * an end user in the wizard maker) DECLARES its handles:
 *
 *     const { handles, onDrag, onEdit } = buildCanvasWidgets([
 *         { type: 'point',  fx: 'tx_x', fy: 'tx_y', x: ox, y: oy, label: 'pos' },
 *         { type: 'length', field: 'tx_height', ax: ox, ay: oy, axis: 'y', value: H, min: 2, label: 'height' },
 *         { type: 'scaleX', field: 'tx_width',  ax: ox, edgeX: ox + lineW, ay: oy, value: width, min: 0.2, label: 'width' },
 *         { type: 'shear',  field: 'tx_slant',  ax: ox + lineW, ay: oy, h: H, value: slant, label: 'slant°' },
 *     ], setFields);
 *
 * GOLDEN RULE (same as FeatureCanvas): a handle drives a PARAM (a form field), never freeform geometry. The view passes
 * the geometry CONTEXT it computed from its params (anchors / edge / height); the gesture does place + drag + click-to-edit.
 * Add a gesture = one entry here; every view AND every custom op gets it for free. Reused across milling wizards.
 */

const DEG = 180 / Math.PI;
const clampMin = (v, m) => (m == null ? v : Math.max(m, v));

/** Each gesture: place(d) → a handle {x,y,kind,label?,value?}; drag(d, world) → a {field: value} map (or null). `d` is
 *  the view's declaration (the field id(s) + the geometry context). FeatureCanvas renders kind 'move' as a snapping
 *  square and anything else as a circle (with a click-to-edit value label when `value` + spec.onEdit are present). */
export const CANVAS_GESTURES = {
    // POSITION → two fields. Square 'move' handle (FeatureCanvas snaps it to stock anchors).
    // Optional anchor ax/ay makes it RELATIVE: the fields hold world − anchor (a delta, e.g. a G91 incremental
    // reposition offset from the previous pass's start). Absent anchor → absolute (back-compat: ax/ay default 0).
    point: {
        place: (d) => ({ x: (d.ax || 0) + d.x, y: (d.ay || 0) + d.y, kind: 'move', label: d.label }),
        drag: (d, w) => ({ [d.fx]: w.x - (d.ax || 0), [d.fy]: w.y - (d.ay || 0) }),
    },
    // 1D LENGTH from an anchor along an axis (e.g. height). Handle at anchor + value·axis; drag → the axis distance.
    length: {
        place: (d) => ({ x: d.ax + (d.axis === 'x' ? d.value : 0), y: d.ay + (d.axis === 'x' ? 0 : d.value), kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: clampMin(d.axis === 'x' ? w.x - d.ax : w.y - d.ay, d.min) }),
    },
    // Horizontal SCALE factor about an x-anchor. Handle at the current right edge; drag scales proportionally (so the
    // tracking/constant part of the span is preserved — the factor follows the cursor's fraction of the current span).
    scaleX: {
        place: (d) => ({ x: d.edgeX, y: d.ay, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => { const span = d.edgeX - d.ax; if (Math.abs(span) < 1e-6) return null; return { [d.field]: clampMin(d.value * (w.x - d.ax) / span, d.min) }; },
    },
    // SHEAR / skew angle (deg): horizontal offset over a height `h` about a baseline anchor. Handle rides the slanted top.
    shear: {
        place: (d) => ({ x: d.ax + Math.tan(d.value / DEG) * d.h, y: d.ay + d.h, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: Math.atan2(w.x - d.ax, d.h) * DEG }),
    },
    // 2D SIZE / corner from an anchor → two fields. The handle sits at anchor + extents (ex/ey); a drag maps the corner
    // offset back to each field through a per-axis DIVISOR `sx`/`sy` (1 = literal W/H · `cols-1` = grid pitch · 0.5 =
    // half-extent radius), and clamps with `minw`/`minh`. A zero divisor skips that axis (e.g. a single-column grid).
    rect: {
        place: (d) => ({ x: d.ax + d.ex, y: d.ay + d.ey, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => {
            const m = {};
            if (d.sx) m[d.field] = clampMin((w.x - d.ax) / d.sx, d.minw);
            if (d.sy) m[d.fieldH] = clampMin((w.y - d.ay) / d.sy, d.minh);
            return m;
        },
    },
    // POLAR handle about a center → a radius field + an angle field (the "rotate" gesture, fused with radius like a
    // drill ring/line-end). Handle at center + r·(cos,sin)a; a drag sets the angle (atan2) and scales the dragged
    // distance into the radius field via `rScale` (2 = Ø from a radius · 1/(n-1) = pitch). Omit `fieldA` for radius-only,
    // or `rScale` for angle-only (pure rotate). `minR` clamps the radius.
    radial: {
        place: (d) => ({ x: d.cx + d.r * Math.cos(d.a), y: d.cy + d.r * Math.sin(d.a), kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => {
            const dx = w.x - d.cx, dy = w.y - d.cy, m = {};
            if (d.fieldA) m[d.fieldA] = Math.atan2(dy, dx) * DEG;
            if (d.rScale) m[d.field] = clampMin(Math.hypot(dx, dy) * d.rScale, d.minR);
            return m;
        },
    },
    // PERPENDICULAR projection onto an axis `(nx,ny)` about an anchor → one symmetric field (e.g. a slot width measured
    // off its centreline). The handle rides the axis at `off` (the current half-extent); a drag projects the cursor onto
    // the axis (signed distance), takes |·|·`scale` (2 = a half-distance → full width), and clamps to `min` (the tool Ø).
    projLength: {
        place: (d) => ({ x: d.cx + d.nx * d.off, y: d.cy + d.ny * d.off, kind: 'size', label: d.label, value: d.value }),
        drag: (d, w) => ({ [d.field]: clampMin(d.scale * Math.abs((w.x - d.cx) * d.nx + (w.y - d.cy) * d.ny), d.min) }),
    },
    // PROBE-VECTOR about an anchor → an axis ENUM + a dir ENUM + a reach scalar (ONE drag = three controls). The handle is
    // the arrow TIP: a probe is AXIS-ALIGNED, so the drag angle SNAPS to the nearest cardinal (|dx|≥|dy| → X else Y; the
    // sign → pos/neg), and the length sets the reach (`d.field`). Anchor (cx,cy) = the probe start; the view draws the
    // shaft. NOTE: axis/dir are STRINGS — the view's setFields must pass enums through (not round them like a number).
    probeVector: {
        place: (d) => {
            const ux = d.axis === 'Y' ? 0 : (d.dir === 'neg' ? -1 : 1);
            const uy = d.axis === 'Y' ? (d.dir === 'neg' ? -1 : 1) : 0;
            return { x: d.cx + ux * d.dist, y: d.cy + uy * d.dist, kind: 'size', label: d.label, value: d.dist };
        },
        drag: (d, w) => {
            const dx = w.x - d.cx, dy = w.y - d.cy, horiz = Math.abs(dx) >= Math.abs(dy);
            return {
                [d.fieldAxis]: horiz ? 'X' : 'Y',
                [d.fieldDir]: (horiz ? dx : dy) >= 0 ? 'pos' : 'neg',
                [d.field]: clampMin(Math.hypot(dx, dy), d.minR),
            };
        },
    },
};

/** Declarations → { handles, onDrag, onEdit } for a FeatureCanvas spec. `setFields(map)` writes the op's form fields
 *  (id → value) and triggers the normal update()/redraw loop. Unknown gesture types are skipped (defensive). */
export function buildCanvasWidgets(widgets, setFields) {
    const byId = {};
    const handles = [];
    (widgets || []).forEach((d, i) => {
        const g = CANVAS_GESTURES[d.type];
        if (!g) return;
        const id = d.id || (d.type + ':' + (d.field || d.fx || i));
        byId[id] = d;
        handles.push({ id, ...g.place(d) });
    });
    const onDrag = (id, world) => {
        const d = byId[id]; if (!d) return;
        const updates = CANVAS_GESTURES[d.type].drag(d, world);
        if (updates) setFields(updates);
    };
    const onEdit = (id, value) => {   // click-to-type a dimension's value (FeatureCanvas inline editor)
        const d = byId[id]; if (!(d && d.field != null && Number.isFinite(value))) return;
        setFields({ [d.field]: d.editMin != null ? Math.max(d.editMin, value) : value });
    };
    return { handles, onDrag, onEdit };
}
