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
    point: {
        place: (d) => ({ x: d.x, y: d.y, kind: 'move', label: d.label }),
        drag: (d, w) => ({ [d.fx]: w.x, [d.fy]: w.y }),
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
        const d = byId[id]; if (d && d.field != null && Number.isFinite(value)) setFields({ [d.field]: value });
    };
    return { handles, onDrag, onEdit };
}
