/**
 * ui/shapeStage.js — the shared 2D DRAWING CORE: a layer model rendered to SVG with Figma-style move/resize/rotate
 * handles, plus the pure gesture math. Extracted from ui/iconEditor.js so BOTH the icon composer AND the region
 * editor (region picks) consume ONE drawing implementation — "reuse" = shared CODE, not a shared tool, and the
 * region stays its own primitive (see docs/archive/RICH-WIDGETS-AND-ICONS.md "Track D"). Pure: no DOM/event wiring, no modal.
 *
 * A layer = { type, x, y, w, h, rot, ... } in stage coords. The icon composer adds tile/text/rect/line/circle/arrow;
 * the region editor will add region semantics (value/label/hit-test) on top of the SAME shapes — without touching
 * this core. Behaviour is identical to the code that used to live in iconEditor (W/H are now parameters, not module
 * constants), so the icon editor is unchanged.
 */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const SNAP_PX = 8;   // t1183 — a MOVE snaps the layer centre to the canvas centre within this stage-px threshold (per axis)

export function rotateVec(v, deg) { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }

/** Stage coords of a box's normalized point (nx,ny ∈ [0,1]), honouring its rotation about the centre. */
export function boxPoint(nx, ny, b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = rotateVec({ x: (nx - 0.5) * b.w, y: (ny - 0.5) * b.h }, b.rot || 0);
    return { x: cx + r.x, y: cy + r.y };
}

/** Normalized handle points (corner/edge) for the resize hit-map. */
export const HANDLE_XY = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };

/** Render the stage SVG markup from the layer list (the selected layer gets a Figma-style handle frame). `bg` is the
 *  stage background fill (default black for the icon composer; the region editor passes 'transparent' to overlay a
 *  backdrop). */
export function stageSvg(layers, sel, W, H, bg = '#000', guide = null) {
    const body = layers.map((L, i) => {
        const t = `translate(${L.x} ${L.y}) rotate(${L.rot || 0} ${L.w / 2} ${L.h / 2})`;
        let el = '';
        if (L.type === 'tile') el = `<image href="${L.uri}" x="0" y="0" width="${L.w}" height="${L.h}" preserveAspectRatio="none"/>`;
        else if (L.type === 'text') el = `<text x="0" y="${L.h * 0.75}" font-family="Consolas, monospace" font-size="${L.size || 20}" fill="${L.color || '#ffd23f'}" style="white-space:pre;">${esc(L.text)}</text>`;
        else if (L.type === 'rect') el = `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'line') el = `<line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'circle') el = `<ellipse cx="${L.w / 2}" cy="${L.h / 2}" rx="${L.w / 2}" ry="${L.h / 2}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        else if (L.type === 'arrow') el = `<g stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}" fill="none"><line x1="0" y1="${L.h / 2}" x2="${L.w}" y2="${L.h / 2}"/><polyline points="${L.w - 12},${L.h / 2 - 8} ${L.w},${L.h / 2} ${L.w - 12},${L.h / 2 + 8}"/></g>`;
        else if (L.type === 'poly') el = `<polygon points="${L.points || ''}" fill="${L.fill || 'none'}" stroke="${L.color || '#3cf'}" stroke-width="${L.sw != null ? L.sw : 3}"/>`;
        let deco = '';
        if (i === sel) {
            const hs = 6, hh = hs / 2;
            const pts = [['nw', 0, 0], ['n', L.w / 2, 0], ['ne', L.w, 0], ['e', L.w, L.h / 2], ['se', L.w, L.h], ['s', L.w / 2, L.h], ['sw', 0, L.h], ['w', 0, L.h / 2]];
            const cur = { nw: 'nwse', n: 'ns', ne: 'nesw', e: 'ew', se: 'nwse', s: 'ns', sw: 'nesw', w: 'ew' };
            deco = `<rect x="0" y="0" width="${L.w}" height="${L.h}" fill="none" stroke="#0ea5e9" stroke-width="1" vector-effect="non-scaling-stroke"/>`
                + `<line x1="${L.w / 2}" y1="0" x2="${L.w / 2}" y2="-20" stroke="#0ea5e9" stroke-width="1"/>`
                + `<circle data-h="rot" cx="${L.w / 2}" cy="-24" r="5" fill="#fff" stroke="#0ea5e9" stroke-width="1.5" style="cursor:grab;"/>`
                + pts.map(([k, px, py]) => `<rect data-h="${k}" x="${px - hh}" y="${py - hh}" width="${hs}" height="${hs}" fill="#fff" stroke="#0ea5e9" stroke-width="1.5" style="cursor:${cur[k]}-resize;"/>`).join('');
        }
        return `<g data-li="${i}" transform="${t}" style="cursor:move;">${el}${deco}</g>`;
    }).join('');
    // t1183 — subtle centre guide line(s) drawn ON TOP while a move-snap is active (guide.x → vertical, guide.y → horizontal).
    const guideM = guide ? ((guide.x ? `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="6 4" opacity=".85" vector-effect="non-scaling-stroke"/>` : '')
        + (guide.y ? `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="6 4" opacity=".85" vector-effect="non-scaling-stroke"/>` : '')) : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}${guideM}</svg>`;
}

/** pointerdown → the gesture for the picked handle ('rot' / a corner-edge key) or, with no handle, a body MOVE
 *  (needs the pointer P to record the grab offset). Returns a gesture object consumed by applyGesture. */
export function startGesture(handle, layer, P) {
    const b0 = { x: layer.x, y: layer.y, w: layer.w, h: layer.h, rot: layer.rot || 0 };
    if (handle === 'rot') return { type: 'rotate', cx: b0.x + b0.w / 2, cy: b0.y + b0.h / 2 };
    if (handle && HANDLE_XY[handle]) { const [hx, hy] = HANDLE_XY[handle]; return { type: 'resize', hx, hy, rot: b0.rot, w0: b0.w, h0: b0.h, anchor: boxPoint(1 - hx, 1 - hy, b0), cx0: b0.x + b0.w / 2, cy0: b0.y + b0.h / 2 }; }   // cx0/cy0 = the start centre (t1183 Ctrl = resize-from-centre)
    return { type: 'move', ox: P.x - layer.x, oy: P.y - layer.y };
}

/** pointermove → mutate the layer per the gesture. Returns { snap:{x,y} } for a MOVE (which axes snapped to the canvas
 *  centre — the caller draws the guide), else null. MODIFIERS (t1183): SHIFT while resizing = uniform (aspect-locked live);
 *  CTRL while resizing = symmetric from the layer's own centre (the start centre stays fixed); SHIFT+CTRL composes.
 *  W/H (the canvas size) enable the MOVE centre-snap; omit them (the region editor) and there is no snap. Rotate keeps its
 *  SHIFT 15deg snap. */
export function applyGesture(gesture, L, P, shiftKey, ctrlKey, W, H) {
    if (gesture.type === 'move') {
        L.x = Math.round(P.x - gesture.ox); L.y = Math.round(P.y - gesture.oy);
        const snap = { x: false, y: false };
        if (W != null && H != null) {   // snap the layer CENTRE to the canvas centre, INDEPENDENTLY per axis, within SNAP_PX
            const cx = L.x + L.w / 2, cy = L.y + L.h / 2;
            if (Math.abs(cx - W / 2) <= SNAP_PX) { L.x = Math.round(W / 2 - L.w / 2); snap.x = true; }
            if (Math.abs(cy - H / 2) <= SNAP_PX) { L.y = Math.round(H / 2 - L.h / 2); snap.y = true; }
        }
        return { snap };
    }
    if (gesture.type === 'rotate') { let a = Math.atan2(P.y - gesture.cy, P.x - gesture.cx) * 180 / Math.PI + 90; if (shiftKey) a = Math.round(a / 15) * 15; L.rot = Math.round(a); return null; }
    if (gesture.type === 'resize') {
        const ar = gesture.w0 / gesture.h0 || 1, uniform = L.lock || shiftKey;
        // aspect-lock: the driving axis sets the other (an edge handle drives the free axis; a corner drives the larger ratio).
        const lockAxes = (nW, nH) => gesture.hx === 0.5 ? [nH * ar, nH] : gesture.hy === 0.5 ? [nW, nW / ar]
            : (nW / gesture.w0 >= nH / gesture.h0 ? [nW, nW / ar] : [nH * ar, nH]);
        if (ctrlKey) {   // FROM CENTRE: symmetric — the start centre (cx0,cy0) stays fixed; half-extents from the pointer.
            const ld = rotateVec({ x: P.x - gesture.cx0, y: P.y - gesture.cy0 }, -gesture.rot);
            let nW = gesture.hx === 0.5 ? gesture.w0 : Math.max(6, 2 * Math.abs(ld.x));
            let nH = gesture.hy === 0.5 ? gesture.h0 : Math.max(6, 2 * Math.abs(ld.y));
            if (uniform) [nW, nH] = lockAxes(nW, nH);
            L.w = nW; L.h = nH; L.x = gesture.cx0 - nW / 2; L.y = gesture.cy0 - nH / 2; L.bw = nW; L.bh = nH; L.scale = 1;
        } else {   // default: the OPPOSITE point (anchor) stays fixed, in the layer's rotated frame.
            const ld = rotateVec({ x: P.x - gesture.anchor.x, y: P.y - gesture.anchor.y }, -gesture.rot);
            let nW = gesture.hx === 0.5 ? gesture.w0 : Math.max(6, Math.abs(ld.x));
            let nH = gesture.hy === 0.5 ? gesture.h0 : Math.max(6, Math.abs(ld.y));
            if (uniform) [nW, nH] = lockAxes(nW, nH);
            const off = rotateVec({ x: (gesture.hx - 0.5) * nW, y: (gesture.hy - 0.5) * nH }, gesture.rot);
            const cx = gesture.anchor.x + off.x, cy = gesture.anchor.y + off.y;
            L.w = nW; L.h = nH; L.x = cx - nW / 2; L.y = cy - nH / 2; L.bw = nW; L.bh = nH; L.scale = 1;
        }
        return null;
    }
    return null;
}
