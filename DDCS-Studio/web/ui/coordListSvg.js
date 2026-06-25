/**
 * ui/coordListSvg.js — a lightweight points-marker renderer for the BLOCK-side coordinate-list preview.
 *
 * The form adapter (formWidgets.coordListWidget) uses the rich FeatureCanvas (grid / pan-zoom / drag). A Blockly
 * field can't host that (it's HTML + RAF + its own canvas, and in-field dragging fights Blockly's block-drag
 * gesture), so the BLOCK shows a compact static preview of the same points — exactly the split region-pick uses
 * (form widget vs the lighter field_regionpick). Both adapters share the coordinate-list STATE (a points list);
 * rich editing happens in the form / the ✎ editor, not inline in the block. Pure SVG, no interaction.
 */
const SVGNS = 'http://www.w3.org/2000/svg';

/** Bounding box of the points (+ pad), for the preview viewBox. */
export function coordListBounds(points, pad = 8) {
    if (!points || !points.length) return { x: 0, y: 0, w: 100, h: 60 };
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    let x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    if (!(w > 0)) w = 1; if (!(h > 0)) h = 1;
    return { x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad };
}

/** Draw numbered point markers into `svgEl` (viewBox fitted to the points). */
export function buildCoordMarkers(svgEl, points, bounds) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const b = bounds || coordListBounds(points);
    svgEl.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
    const r = Math.max(2, Math.min(b.w, b.h) * 0.05);
    (points || []).forEach((p, i) => {
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', r);
        c.setAttribute('fill', '#f5b301'); c.setAttribute('stroke', '#1e293b'); c.setAttribute('stroke-width', r * 0.28);
        c.setAttribute('data-pi', i);
        svgEl.appendChild(c);
    });
}
