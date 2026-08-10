/**
 * viz/featureCanvas.js — 2D top-down parametric layout canvas (SVG).
 *
 * A small, generic editable surface: it draws stock + a wizard's feature geometry and a set of
 * draggable HANDLES. The golden rule (so we never reopen the CAM trap): handles drive the op's
 * PARAMETERS, never freeform geometry. A handle drag just hands a world point back to the op,
 * which writes the matching wizard field(s) and lets the normal update() loop redraw everything.
 *
 * Two-way binding falls out of the existing wizard plumbing:
 *   field typed  → wizardManager update() → op rebuilds spec → render()        (field → canvas)
 *   handle drag  → spec.onDrag(id, world) → set field + dispatch 'input' → update() → render()
 *                                                                                 (canvas → field)
 *
 * Conventions (match the 3D viz, gcodeViz3d.js): work coords are X-right / Y-up; WCS zero sits at
 * the stock's min-XY corner, stock spans [0..w] × [0..h].
 *
 * Rendering is hand-rolled SVG (no SVG.js / paper.js) to stay dependency-free and consistent with
 * the rest of Studio. The viewBox is kept in pixel units (1 viewBox unit = 1 screen px) so handle
 * sizes and labels are in real pixels; only world points are scaled via the fitted transform.
 */

const SVGNS = 'http://www.w3.org/2000/svg';
const r3 = (n) => Math.round(n * 1000) / 1000;

import { displayOf } from './displayPrefs.js';   // t744 — the ONE declared preview-visibility registry ({visible,alpha}), shared with the 3D + toolpath2d

/**
 * THE EDGE GUTTER, declared once (t1275). Two places need it and they disagreed: `_followHandle` PARKS a dragged
 * marker at exactly this many px from the edge, and `_handleInGutter` asked whether it was STRICTLY INSIDE that band.
 * At exactly 80 the second answered "no", so refit-on-drop (t732) never fired for the one case it exists for — the
 * marker sat pinned on the gutter after every drop. One constant, and the comparison is inclusive of where the park
 * actually lands.
 */
const GUTTER_PX = 80;
/**
 * …and how much room the refit-on-drop must leave, IN THE SAME PIXELS. The roomy fit used to be a blanket scale
 * FRACTION (0.55), which lands the extreme marker at 22.5% of the viewport — 79px in the 354px-tall layout pane this
 * canvas actually gets, i.e. still inside the very gutter the refit exists to escape. A margin measured against the
 * gutter cannot be defeated by a short pane.
 */
const ROOMY_MARGIN_PX = GUTTER_PX + 24;

function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
}

/** Smallest 1/2/5×10^k step that is ≥ minWorld (for a readable grid). */
function niceStep(minWorld) {
    if (!(minWorld > 0) || !isFinite(minWorld)) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(minWorld)));
    const c = minWorld / p;
    const m = c <= 1 ? 1 : c <= 2 ? 2 : c <= 5 ? 5 : 10;
    return m * p;
}

export class FeatureCanvas {
    constructor() {
        this.container = null;
        this.svg = null;
        this.gGrid = this.gItems = this.gHandles = null;
        this.spec = null;
        this.active = null;        // { id } while a handle is being dragged
        this.pan = null;           // { x, y } (viewBox units) while panning the background
        this._tf = null;           // world↔screen transform; frozen during a drag, persisted after pan/zoom
        this._userAdjusted = false; // true once the user pans/zooms — stop auto-fitting (dbl-click re-fits)
        this._vw = 0; this._vh = 0; // last viewBox size, for redraws outside render()
        this._minScale = 0.02; this._maxScale = 500;
        this._onTransform = null;  // t309 — a Layout ANIMATION OVERLAY subscribes here; fired on EVERY _draw (pan/zoom/fit/resize/render), the single choke point, so an overlaid toolpath2d canvas re-pins its view from _tf and stays pixel-exact under the handles.
    }

    /** t309 — the live world↔screen transform, for an overlay canvas to register 1:1 with the SVG. */
    getTransform() { const t = this._tf; return t ? { scale: t.scale, cxw: t.cxw, cyw: t.cyw, cx: t.cx, cy: t.cy, vw: this._vw, vh: this._vh } : null; }
    /** t309 — register a callback fired on every transform change (pan/zoom/fit/resize/render) with (tf, VW, VH). */
    onTransform(cb) { this._onTransform = (typeof cb === 'function') ? cb : null; }

    _mount(container) {
        if (this.container === container && this.svg) return;
        this.container = container;
        container.style.position = container.style.position || 'relative';   // anchor the inline dimension-edit input
        container.innerHTML = '';
        const svg = svgEl('svg', { class: 'feature-canvas', width: '100%', height: '100%' });
        svg.style.touchAction = 'none';
        svg.style.display = 'block';
        this.svg = svg;
        this.gGrid = svgEl('g', {});
        this.gItems = svgEl('g', {});
        this.gHandles = svgEl('g', {});
        svg.append(this.gGrid, this.gItems, this.gHandles);
        container.appendChild(svg);
        this._bind();
        // Re-render when the container resizes (modal grows on open, splitter drag, window resize). The viewBox is
        // set 1:1 to the pixel size at render time, so a stale viewBox maps client→world at the wrong (and, if the
        // aspect changed, non-uniform) scale — the cause of "drag scaled/inverted". rAF-throttled; no resize loop
        // because render() only changes the viewBox, not the pixel size.
        if (this._ro) this._ro.disconnect();
        this._ro = new ResizeObserver(() => {
            if (this._roPending || !this.spec || !this.container) return;
            this._roPending = true;
            requestAnimationFrame(() => { this._roPending = false; if (this.spec && this.container) this.render(this.container, this.spec); });
        });
        this._ro.observe(container);
    }

    _bind() {
        const svg = this.svg;
        svg.addEventListener('pointerdown', (e) => {
            if (!this.spec || !this._tf || e.button !== 0) return;
            const w = this._toWorld(e);
            const hit = this._hit(w);
            if (!hit) {
                // Stock-attach markers sit on the stock's corners (a quick alternative to the form's STOCK ANCHOR
                // picker). The PATH anchor lives only in the form pickers — so the canvas never superposes two sets.
                const att = this._hitAttach(w);
                if (att) { if (this.spec.onStockAttach) this.spec.onStockAttach(att.code); e.preventDefault(); return; }
                // t112 — a click on a stock CORNER target sets the `corner` param (the GUI corner-selector).
                const cn = this._hitCorner(w);
                if (cn) { if (this.spec.onCornerPick) this.spec.onCornerPick(cn.code); e.preventDefault(); return; }
                // t345 E6 — a click on a stock EDGE/WALL sets axis+dir in one gesture (the GUI edge picker; mirrors corner-pick).
                const eg = this._hitEdge(w);
                if (eg) { if (this.spec.onEdgePick) this.spec.onEdgePick(eg.axis, eg.dir); e.preventDefault(); return; }
            }
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            // Grab a handle. For a POSITION handle, precompute the snap "from" points (the handle itself + the path's
            // 9 bbox anchors) so any path corner/edge/centre can snap onto a stock anchor while dragging.
            if (hit) this.active = { id: hit.id, kind: hit.kind, noSnap: !!hit.noSnap, snapOffsets: (hit.kind === 'move' && !hit.noSnap) ? this._snapOffsets(hit) : null };
            else this.pan = this._clientToVB(e.clientX, e.clientY); // else pan the background
            svg.style.cursor = 'grabbing';
            e.preventDefault();
        });
        svg.addEventListener('pointermove', (e) => {
            if (!this.spec || !this._tf) return;
            if (this.active) {
                // Handles live in the pattern's build frame; the view draws them placed → undo the placement here.
                if (this.spec.onDrag) {
                    let w = this._toWorld(e);
                    // A POSITION ('move') handle snaps onto a stock anchor (corner/edge/centre) or part-zero when close,
                    // so you can drop the path exactly on a stock feature. Other handles (size/width) don't snap.
                    const sn = (this.active.kind === 'move' && !this.active.noSnap) ? this._snapToAnchor(w) : null;
                    this._snap = sn ? { x: sn.target.x, y: sn.target.y } : null;   // ring on the stock anchor that caught it
                    if (sn) w = { x: sn.x, y: sn.y };
                    const p = this._placement || { x: 0, y: 0 };
                    this.spec.onDrag(this.active.id, { x: w.x - (p.x || 0), y: w.y - (p.y || 0) });
                    // t532 — PAN the view to FOLLOW the handle when it nears the viewport edge, so a handle dragged PAST the
                    // stock stays VISIBLE (the auto-fit is frozen during a drag to avoid swim; without this a handle walks off
                    // the frozen viewBox = "stuck at the perimeter"). SCOPED to noSnap markers = the FREE-position sim-start
                    // probe points (alignment/rotary) that are meant to leave the stock — NOT corner/path/ATC handles, whose
                    // exact drag coords + anti-flicker (the wall holds) must not be perturbed by a pan. Translate only, then redraw.
                    // …and REMEMBER that it panned. That fact is the reliable signal the drop needs: asking
                    // afterwards whether the handle LOOKS like it is in the gutter reads `this.spec`, which at
                    // pointerup still holds the pre-drag position — so the question got answered about where the
                    // marker WAS, and the refit declined to run.
                    if (this.active.noSnap && this._followHandle()) { this._followed = true; this._draw(this.spec, this._vw, this._vh); }
                }
                e.preventDefault();
            } else if (this.pan) {
                const v = this._clientToVB(e.clientX, e.clientY);
                this._tf.cxw -= (v.x - this.pan.x) / this._tf.scale;   // move content with the cursor
                this._tf.cyw += (v.y - this.pan.y) / this._tf.scale;   // (Y flips between world and screen)
                this.pan = v;
                this._userAdjusted = true;
                this._draw(this.spec, this._vw, this._vh);
                e.preventDefault();
            } else {
                svg.style.cursor = this._hit(this._toWorld(e)) ? 'grab' : 'default';
            }
        });
        const end = (e) => {
            const act = this.active;
            let id;
            if (this.active) { id = this.active.id; this.active = null; }
            else if (this.pan) { this.pan = null; }
            else return;
            this.svg.style.cursor = 'default';
            const hadSnap = !!this._snap; this._snap = null;
            try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
            if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);
            // t732 — REFIT-ON-DROP so the canvas ACCOMMODATES a marker dragged to the edge. A free (noSnap) sim-start marker
            // is held at the 80px gutter by _followHandle during the drag; with the frozen viewBox and no refit it would PIN
            // there — the next drag can't leave the fitted view, so it goes nowhere (the user's felt symptom). If it landed in
            // the gutter, refit (roomy) to include ALL markers + a generous margin so it sits well inside and the next drag
            // continues; make the roomy view STICK (_userAdjusted) so a field-change re-fit doesn't snap it back to the gutter.
            const followed = this._followed; this._followed = false;
            if (act && act.noSnap && this.spec && (followed || this._handleInGutter(id))) {
                this._userAdjusted = true;
                this._tf = this._fit(this.spec, this._vw, this._vh, true);
                // …AND AGAIN ON THE NEXT RENDER. At pointerup `this.spec` still holds the handle where it was BEFORE the
                // drag: the drag wrote a form field, and the re-render carrying the new position has not arrived yet. So
                // the fit above unions an extent the marker is no longer in, and it lands back on the gutter — which is
                // why it worked on every OTHER drop (the one that happened to fit a caught-up spec) and not the rest.
                this._refitPending = true;
                this._draw(this.spec, this._vw, this._vh);
            } else if (hadSnap && this.spec) {
                this._draw(this.spec, this._vw, this._vh);   // clear the snap ring
            }
        };
        svg.addEventListener('pointerup', end);
        svg.addEventListener('pointercancel', end);

        // Wheel → zoom about the cursor (keeps the point under the pointer fixed).
        svg.addEventListener('wheel', (e) => {
            if (!this.spec || !this._tf) return;
            e.preventDefault();
            const v = this._clientToVB(e.clientX, e.clientY);
            const w0 = this._W(v.x, v.y);
            const s = Math.max(this._minScale, Math.min(this._maxScale, this._tf.scale * Math.exp(-e.deltaY * 0.0015)));
            this._tf.scale = s;
            this._tf.cxw = w0.x - (v.x - this._tf.cx) / s;
            this._tf.cyw = w0.y + (v.y - this._tf.cy) / s;
            this._userAdjusted = true;
            this._draw(this.spec, this._vw, this._vh);
        }, { passive: false });

        // Double-click a handle → an inline DUAL-INPUT editor (type the value instead of dragging); empty space → re-frame.
        svg.addEventListener('dblclick', (e) => {
            if (!this.spec || !this._tf) return;
            const hit = this._hit(this._toWorld(e));
            if (hit) { if (hit.edit && this.spec.onEditDual) { e.preventDefault(); e.stopPropagation(); this._editDual(hit); } return; }
            this._userAdjusted = false;
            this._tf = this._fit(this.spec, this._vw, this._vh);
            this._draw(this.spec, this._vw, this._vh);
        });
    }

    /** Public entry: (re)draw `spec` into `container`. Cheap to call on every field change. */
    render(container, spec) {
        if (!container) return;
        this._mount(container);
        this.spec = spec;
        const rect = this.svg.getBoundingClientRect();
        const VW = Math.max(40, Math.round(rect.width)) || 600;
        const VH = Math.max(40, Math.round(rect.height)) || 360;
        this._vw = VW; this._vh = VH;
        this.svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        // Auto-fit until the user pans/zooms (then they own the view; dbl-click re-fits). Also freeze
        // the fit while a handle is being dragged so the view doesn't "swim" under the cursor.
        if (!this._tf || (!this._userAdjusted && !this.active)) this._tf = this._fit(spec, VW, VH);
        else if (this._refitPending && !this.active) { this._refitPending = false; this._tf = this._fit(spec, VW, VH, true); }   // the drop's refit, now that the spec has caught up
        else { this._tf.cx = VW / 2; this._tf.cy = VH / 2; }
        this._draw(spec, VW, VH);
    }

    /** Fit the union of stock + items + handles + origin into the viewport with a margin. `roomy` (t732 — a refit-on-drop
     *  after a marker landed in the edge gutter) leaves a GENEROUS margin so the marker sits well inside and the next drag
     *  has room to move (else it re-pins against the frozen viewBox). */
    _fit(spec, VW, VH, roomy) {
        let x0 = 0, y0 = 0, x1 = 0, y1 = 0, any = false;
        const acc = (x, y) => {
            if (!isFinite(x) || !isFinite(y)) return;
            if (!any) { x0 = x1 = x; y0 = y1 = y; any = true; }
            else { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        };
        // Stock is datum-positioned (ox/oy); the pattern items + handles ride the placement (px/py) — same as drawn.
        const pl = spec.placement || { x: 0, y: 0 }, px = pl.x || 0, py = pl.y || 0;
        const sox = (spec.stock && spec.stock.ox) || 0, soy = (spec.stock && spec.stock.oy) || 0;
        acc(0, 0);
        if (spec.stock) { acc(sox, soy); acc(sox + spec.stock.w, soy + spec.stock.h); }
        if (spec.machine) { const mx = Number(spec.machine.x) || 0, my = Number(spec.machine.y) || 0; acc(mx, my); acc(Math.min(0, mx), Math.min(0, my)); }
        (spec.items || []).forEach((it) => {
            if (it.kind === 'hole') acc(it.x + px, it.y + py);
            else if (it.kind === 'line') { acc(it.x1 + px, it.y1 + py); acc(it.x2 + px, it.y2 + py); }
            else if (it.kind === 'circle') { acc(it.cx - it.r + px, it.cy - it.r + py); acc(it.cx + it.r + px, it.cy + it.r + py); }
            else if (it.kind === 'rect') { acc(it.x + px, it.y + py); acc(it.x + it.w + px, it.y + it.h + py); }
        });
        (spec.handles || []).forEach((h) => acc(h.x + px, h.y + py));
        (spec.paths || []).forEach((pth) => (pth.pts || []).forEach((p) => acc(p.x + px, p.y + py)));
        // t528 — a MARGIN around the stock: since a handle can now be dragged PAST the stock edge (envelope-bound, not
        // stock-bound), keep a band of empty space around the stock so a just-past-the-edge handle stays VISIBLE + grabbable
        // (the fit already unions the handles above; this guarantees breathing room even when a handle sits right on the edge).
        if (spec.stock) { const pad = 0.15 * Math.max(Number(spec.stock.w) || 0, Number(spec.stock.h) || 0); if (pad > 0) { acc(sox - pad, soy - pad); acc(sox + spec.stock.w + pad, soy + spec.stock.h + pad); } }
        let w = x1 - x0, h = y1 - y0;
        if (!(w > 1)) { x0 -= 50; x1 += 50; w = x1 - x0; }
        if (!(h > 1)) { y0 -= 50; y1 += 50; h = y1 - y0; }
        // roomy → leave a PIXEL margin bigger than the gutter on every side, so a just-dropped edge marker sits well
        // inside it whatever the pane's shape. Plain fits keep the old 0.82 breathing factor, unchanged.
        const scale = roomy
            ? Math.min(Math.max(40, VW - 2 * ROOMY_MARGIN_PX) / w, Math.max(40, VH - 2 * ROOMY_MARGIN_PX) / h)
            : Math.min(VW / w, VH / h) * 0.82;
        return { scale, cxw: (x0 + x1) / 2, cyw: (y0 + y1) / 2, cx: VW / 2, cy: VH / 2 };
    }

    _S(x, y) { const t = this._tf; return { x: t.cx + (x - t.cxw) * t.scale, y: t.cy - (y - t.cyw) * t.scale }; }
    _W(sx, sy) { const t = this._tf; return { x: t.cxw + (sx - t.cx) / t.scale, y: t.cyw - (sy - t.cy) / t.scale }; }
    /** t532 — auto-pan the (drag-frozen) viewBox so the ACTIVE handle stays ≥ a margin inside the viewport. Follows the
     *  handle's ACTUAL rendered position (this.spec.handles, i.e. the CLAMPED value post-onDrag) — NOT the raw cursor world,
     *  which is unclamped and would run the pan off past the envelope. Translate ONLY (scale fixed → no swim). Returns true
     *  if it panned. Lets a dragged handle move PAST the stock edge while staying visible (else it strands off the frozen viewBox). */
    _followHandle() {
        const t = this._tf; if (!t || !this.active || !(this._vw > 0) || !(this._vh > 0)) return false;
        const h = (this.spec.handles || []).find((x) => String(x.id) === String(this.active.id));
        if (!h || !isFinite(h.x) || !isFinite(h.y)) return false;
        const p = this._placement || { x: 0, y: 0 };
        const s = this._S(h.x + (p.x || 0), h.y + (p.y || 0)), m = GUTTER_PX;   // keep the handle ≥ the gutter from every edge
        let dx = 0, dy = 0;
        if (s.x < m) dx = s.x - m; else if (s.x > this._vw - m) dx = s.x - (this._vw - m);
        if (s.y < m) dy = s.y - m; else if (s.y > this._vh - m) dy = s.y - (this._vh - m);
        if (!dx && !dy) return false;
        t.cxw += dx / t.scale;   // shift the world-centre so the handle moves back toward the interior
        t.cyw -= dy / t.scale;   // Y flips (screen-down = world-up)
        return true;
    }
    /** t732 — did the handle `id` land within the edge gutter (the ≤ margin px band where _followHandle holds it)? Drives
     *  the refit-on-drop: a marker stranded here can't be dragged further until the view accommodates it. */
    _handleInGutter(id, margin = GUTTER_PX) {
        const t = this._tf; if (!t || !(this._vw > 0) || !(this._vh > 0)) return false;
        const h = (this.spec.handles || []).find((x) => String(x.id) === String(id));
        if (!h || !isFinite(h.x) || !isFinite(h.y)) return false;
        const p = this._placement || { x: 0, y: 0 };
        const s = this._S(h.x + (p.x || 0), h.y + (p.y || 0));
        // INCLUSIVE: _followHandle parks the marker at EXACTLY `margin`, so a strict `<` answered no for the very
        // position the follow creates — the refit never ran and the marker stayed pinned on the gutter.
        return s.x <= margin || s.x >= this._vw - margin || s.y <= margin || s.y >= this._vh - margin;
    }
    /** World→screen WITH the toolpath placement applied. Pattern items/handles ride the placement (they're authored
     *  in the build frame); the stock + its attach markers do NOT (they're already in part coords). */
    _disp(x, y) { const p = this._placement || { x: 0, y: 0 }; return this._S(x + (p.x || 0), y + (p.y || 0)); }

    /** A small "↓Nmm" tag near a cavity's centre — the 2D reflection of a DECLARED pocket floor depth. OFFSET DOWN in
     *  SCREEN space (constant px, zoom-independent) so it clears the origin drag HANDLE that sits at the cavity centre. */
    _featureDepthLabel(items, wx, wy, depth) {
        const c = this._disp(wx, wy);
        const t = svgEl('text', { x: c.x, y: c.y + 15, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'fill:#bcd0ea; font-size:10px; paint-order:stroke; stroke:#0d0f14; stroke-width:2px; pointer-events:none;' });
        t.textContent = '↓' + r3(depth) + 'mm';
        items.appendChild(t);
    }

    /** client (CSS px) → viewBox units, accounting for viewBox scaling. */
    _clientToVB(clientX, clientY) {
        const p = this.svg.createSVGPoint();
        p.x = clientX; p.y = clientY;
        return p.matrixTransform(this.svg.getScreenCTM().inverse());
    }

    _toWorld(e) {
        const v = this._clientToVB(e.clientX, e.clientY);
        return this._W(v.x, v.y);
    }

    /** Nearest handle within a ~12px tolerance, or null. Handles are authored in the build frame, drawn placed → map
     *  the world point back by the placement before comparing. */
    _hit(w) {
        const tol = 13 / this._tf.scale, p = this._placement || { x: 0, y: 0 };
        const wx = w.x - (p.x || 0), wy = w.y - (p.y || 0);
        let best = null, bd = tol;
        (this.spec.handles || []).forEach((h) => {
            const d = Math.hypot(h.x - wx, h.y - wy);
            if (d <= bd) { bd = d; best = h; }
        });
        // t87 — the SIM-ONLY marker IS draggable (writes userStarts, sim-only — "sim only means it doesn't emit, but we still
        // drag it to simulate a user start"). It only YIELDS the hit to an EMITTING handle when they DEGENERATELY COINCIDE
        // (e.g. an explicit 0 offset); normally (post-t76 anchor-offset fix) they're separated, so the sim marker grabs cleanly.
        // t726 P2b — the mill ENTRY marker YIELDS to a coincident feature handle too (like the sim-only ○ did): its default
        // sits at the cut entry, which for drill/bore IS the pos handle — so a drag there grabs the FEATURE, not the entry.
        if (best && (best.simOnly || best.yieldCoincident)) {
            const coincTol = 6 / this._tf.scale;
            const em = (this.spec.handles || []).find((h) => !h.simOnly && !h.yieldCoincident && Math.hypot(h.x - best.x, h.y - best.y) < coincTol);
            if (em) return em;
        }
        return best;
    }

    _draw(spec, VW, VH) {
        const grid = this.gGrid, items = this.gItems, handles = this.gHandles;
        grid.replaceChildren(); items.replaceChildren(); handles.replaceChildren();
        this._placement = spec.placement || { x: 0, y: 0 };   // pattern items/handles ride this; stock is datum-fixed
        if (this._onTransform && this._tf) this._onTransform(this._tf, VW, VH);   // t309 — re-pin the animation overlay to the current transform (this is the ONE place all pan/zoom/fit/resize/render land)

        // --- grid ---------------------------------------------------------
        const tl = this._W(0, 0), br = this._W(VW, VH);
        let minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x);
        let minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y);
        // t578 — for a MACHINE frame, FIT the grid to the envelope + a small machine-coord margin (clamped to the viewport, so a
        // zoom-in still fills the pane). The grid then FRAMES the envelope exactly instead of sprawling across the whole pane
        // (or reading undersized). Part/stock layouts (no spec.machine) keep the full-viewport grid.
        if (spec.machine) {
            const X = Number(spec.machine.x) || 0, Y = Number(spec.machine.y) || 0;
            const ex0 = Math.min(0, X), ex1 = Math.max(0, X), ey0 = Math.min(0, Y), ey1 = Math.max(0, Y);
            const mgn = Math.max(Math.abs(X), Math.abs(Y), 10) * 0.04;   // a small, uniform border around the envelope
            minX = Math.max(minX, ex0 - mgn); maxX = Math.min(maxX, ex1 + mgn);
            minY = Math.max(minY, ey0 - mgn); maxY = Math.min(maxY, ey1 + mgn);
        }
        const step = niceStep(16 / this._tf.scale);
        const major = step * 5;
        const line = (x1, y1, x2, y2, cls) => {
            const a = this._S(x1, y1), b = this._S(x2, y2);
            grid.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls }));
        };
        if (step > 0 && (maxX - minX) / step < 400) {
            for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
                line(x, minY, x, maxY, Math.abs(x % major) < 1e-6 ? 'fc-grid-major' : 'fc-grid-minor');
            }
            for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
                line(minX, y, maxX, y, Math.abs(y % major) < 1e-6 ? 'fc-grid-major' : 'fc-grid-minor');
            }
        }

        // --- stock (datum-positioned: its datum corner sits at part-zero, the origin) ---------------------
        if (spec.stock && spec.stock.w > 0 && spec.stock.h > 0 && displayOf('stock').visible) {   // t744 — the ONE visibility registry
            const sox = spec.stock.ox || 0, soy = spec.stock.oy || 0;
            const o = this._S(sox, soy + spec.stock.h);
            items.appendChild(svgEl('rect', {
                x: o.x, y: o.y, width: spec.stock.w * this._tf.scale, height: spec.stock.h * this._tf.scale,
                class: 'fc-stock', rx: 2,
            }));
        }

        // --- origin: the MACHINE frame (envelope + home + edge labels, machine-coherent — matches the 3D sim's
        //     convention, one source) when spec.machine is set; else the part-zero crosshair (stock/wizard layout). ----
        if (spec.machine && displayOf('envelope').visible) {   // t744 — the envelope element gates the Layout's machine frame too
            this._drawMachineFrame(spec.machine);
        } else if (!spec.machine) {
            // the part-zero crosshair sits at spec.origin (world) when set — so the stock modal's datum moves it to the
            // selected corner, matching the 3D — else at the min-XY corner (the default for wizard layouts).
            const ow = spec.origin || { x: 0, y: 0 };
            const og = this._S(ow.x || 0, ow.y || 0);
            grid.appendChild(svgEl('line', { x1: og.x - 9, y1: og.y, x2: og.x + 9, y2: og.y, class: 'fc-axis-x' }));
            grid.appendChild(svgEl('line', { x1: og.x, y1: og.y - 9, x2: og.x, y2: og.y + 9, class: 'fc-axis-y' }));
        }

        // --- paths (generic polylines, e.g. a parsed G-code toolpath outline) — each {pts,cls} drawn as one <path> --
        (spec.paths || []).forEach((pth) => {
            if (!pth || !pth.pts || pth.pts.length < 2) return;
            let d = '';
            for (let i = 0; i < pth.pts.length; i++) {
                const s = this._disp(pth.pts[i].x, pth.pts[i].y);
                d += (i ? 'L' : 'M') + r3(s.x) + ' ' + r3(s.y) + ' ';
            }
            items.appendChild(svgEl('path', { d, class: pth.cls || 'fc-guide', fill: 'none' }));
        });

        // --- guides (rings / bounding rects / paths). A guide defaults to the dashed fc-guide; an item may set its own
        //     `cls` (e.g. a FEATURE shape — a filled pocket cavity / boss) so the canvas shows WHAT'S being probed. -----
        (spec.items || []).forEach((it) => {
            const cls = it.cls || 'fc-guide';
            if (it.kind === 'circle') {
                const c = this._disp(it.cx, it.cy);
                items.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: it.r * this._tf.scale, class: cls }));
                if (it.depth != null) this._featureDepthLabel(items, it.cx, it.cy, it.depth);
            } else if (it.kind === 'line') {
                const a = this._disp(it.x1, it.y1), b = this._disp(it.x2, it.y2);
                items.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls }));
            } else if (it.kind === 'rect') {
                const p = this._disp(it.x, it.y + it.h);
                items.appendChild(svgEl('rect', { x: p.x, y: p.y, width: it.w * this._tf.scale, height: it.h * this._tf.scale, class: cls }));
                if (it.depth != null) this._featureDepthLabel(items, it.x + it.w / 2, it.y + it.h / 2, it.depth);
            }
        });

        // --- holes (drawn last so they sit on top of guides) -------------
        (spec.items || []).forEach((it) => {
            if (it.kind !== 'hole') return;
            const c = this._disp(it.x, it.y);
            const rad = Math.max(3, (it.r || 0) * this._tf.scale);
            items.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: rad, class: it.skipped ? 'fc-hole-skip' : 'fc-hole' }));
            if (it.skipped) {
                const k = rad * 0.7;
                items.appendChild(svgEl('line', { x1: c.x - k, y1: c.y - k, x2: c.x + k, y2: c.y + k, class: 'fc-hole-skip' }));
                items.appendChild(svgEl('line', { x1: c.x - k, y1: c.y + k, x2: c.x + k, y2: c.y - k, class: 'fc-hole-skip' }));
            }
            if (it.n != null) {
                const t = svgEl('text', { x: c.x, y: c.y - rad - 3, class: 'fc-hole-label' });
                t.textContent = it.n;
                items.appendChild(t);
            }
        });

        // --- handles (top layer, always above holes) ---------------------
        (spec.handles || []).forEach((h) => {
            const c = this._disp(h.x, h.y);
            const col = h.color || null;   // t81 — reposition SOURCE colour (auto=cyan / manual=amber), matching the top panel; null → the CSS default
            // t89 — set the source colour via INLINE STYLE, not a presentation ATTRIBUTE. A class-based stylesheet rule
            // (.fc-handle{fill:#ffce54} gold) OUTRANKS an SVG presentation attribute, so an attribute-set fill/stroke was
            // SILENTLY overridden to gold (getComputedStyle showed rgb(255,206,84) despite the attribute reading #22d3ee).
            // Inline style beats the class rule → the computed colour is actually the cyan/amber source colour.
            // t122 — expose the handle's STABLE decl id (e.g. 'start_pos' / 'reposition_pos' / '__simstart0') as data-hid so a
            // handle is identifiable by its BOUND source, not by sort-by-screen-position (which misattributes when a drag crosses
            // the other handle). Additive attribute — the drag hit-test still uses the internal geometry.
            const hid = h.id != null ? { 'data-hid': String(h.id) } : null;
            // t1684 (census finding 2) — SHAPE axis, orthogonal to colour: a decl may carry `emits` (does dragging this
            // handle write a value that reaches the emitted G-code — corner's #21-#24 reposition, unified with lathe's
            // former `teal`). undefined = undeclared → UNCHANGED (solid, matching every pre-existing handle); an explicit
            // false renders HOLLOW (stroke-only) on a move/sim marker. Matches the 3D + 2D-toolpath renderers' own reading.
            const hollow = h.emits === false;
            if (h.simOnly || h.kind === 'move') {
                // START-MARKER glyph language (t293) — ONE language across the 3D preview, the 2D toolpath, and here:
                // AUTO reposition (the machine drives there) = a filled CYAN SQUARE ■; MANUAL / the operator jog Start
                // = a filled AMBER CIRCLE ●. simOnly (pass-0) is always the manual Start. Shape + colour agree.
                const startManual = h.simOnly || col === '#ffb300';
                const fill = col || (startManual ? '#ffb300' : '#22d3ee');
                let el;
                if (startManual) el = svgEl('circle', { cx: c.x, cy: c.y, r: 7, class: 'fc-handle fc-handle-sim', ...hid });   // circle = manual jog
                else el = svgEl('rect', { x: c.x - 6, y: c.y - 6, width: 12, height: 12, class: 'fc-handle fc-handle-move', rx: 2, ...hid });   // square = auto reposition
                if (hollow) { el.style.fill = 'none'; el.style.stroke = fill; el.style.strokeWidth = '2'; }
                else { el.style.fill = fill; el.style.stroke = fill; }
                handles.appendChild(el);
            } else {
                const el = svgEl('circle', { cx: c.x, cy: c.y, r: 6, class: 'fc-handle', ...hid });
                const emitCol = h.emits ? '#14b8a6' : null;   // t1684 — emits:true (lathe's dimension handles) tints TEAL, the declared convention
                const fillCol = emitCol || col;
                if (fillCol) { el.style.fill = fillCol; el.style.stroke = fillCol; }   // a GROUP-coloured point handle (e.g. the ATC setup canvas's blue pockets vs orange station); inline beats the .fc-handle CSS default. Uncoloured handles are unaffected.
                handles.appendChild(el);
            }
            // Raw axis-delta readouts (the grid "dx"/"dy" labels) are unhelpful clutter — the handle stays
            // draggable (it still drives its field), we just drop its on-canvas text. Useful named dimensions
            // (Ø, W, pitch, …) keep their click-to-edit value label.
            const rawDelta = /^d[xy]$/i.test(String(h.label || ''));
            if (h.label && !rawDelta) {
                // Label direction: declared by the datum corner (handleScale → labelDir) so the
                // glyph sits OUTSIDE the shape.  Default (no labelDir) = upper-right (current behaviour).
                const lx = (h.labelDir && h.labelDir.lx) || 1;
                const ly = (h.labelDir && h.labelDir.ly) || -1;
                const tx = c.x + 10 * lx;
                const ty = c.y + 8 * ly;
                const t = svgEl('text', { x: tx, y: ty, class: 'fc-handle-label' });
                if (lx < 0) t.setAttribute('text-anchor', 'end');
                if (h.value != null && this.spec.onEdit) {
                    // Centroid-style: the dimension shows its VALUE and is click-to-edit (type, don't just drag).
                    t.textContent = `${h.label} ${r3(h.value)}`;
                    t.style.cursor = 'text';
                    t.style.textDecoration = 'underline';
                    t.style.pointerEvents = 'auto';   // labels may be pointer-events:none; the editable dim must catch clicks
                    t.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't let the canvas start a pan/drag
                    t.addEventListener('click', (e) => { e.stopPropagation(); this._editDim(h, tx, ty); });   // open AFTER mouseup so focus sticks
                } else if (h.displayVals) {
                    t.textContent = `${h.label} ${r3(h.displayVals[0])}×${r3(h.displayVals[1])}`;
                } else {
                    t.textContent = h.label;
                }
                handles.appendChild(t);
            }
        });

        this._drawStockAttach(spec);
        this._drawCornerPick(spec);
        this._drawEdgePick(spec);   // t345 E6 — the GUI edge/wall picker (opt-in via spec.onEdgePick)

        // Snap feedback: a green lock-ring + centre dot on the stock anchor (or part-zero) the dragged position handle
        // is locked onto — so it's obvious when the magnet caught (and which anchor).
        if (this._snap) {
            const c = this._S(this._snap.x, this._snap.y);
            handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 9, fill: 'none', stroke: '#5fd06a', 'stroke-width': 2, style: 'pointer-events:none' }));
            handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 2.6, fill: '#5fd06a', stroke: 'none', style: 'pointer-events:none' }));
        }
    }

    /** Machine-frame chrome (spec.machine = {x,y,z} travel extents) — the envelope rect, the machine HOME at coord 0
     *  with +X (red) / +Y (green) axis arms, and the +X/-X/+Y/-Y edge labels at each edge centre. Deliberately mirrors
     *  the 3D sim's machine frame (gcodeViz3d: home at scene 0, envelope [0..m], the same +X/+Y label text + red/green)
     *  so the 2D top-down and the 3D read as ONE machine frame. Only used by the ATC setup canvas; part/stock wizards
     *  don't set spec.machine, so their part-zero crosshair is untouched. */
    _drawMachineFrame(m) {
        const X = Number(m.x) || 0, Y = Number(m.y) || 0;
        const x0 = Math.min(0, X), x1 = Math.max(0, X), y0 = Math.min(0, Y), y1 = Math.max(0, Y);
        // envelope rect (min-XY corner → the top-left in screen space, since screen Y is flipped)
        const tl = this._S(x0, y1);
        this.gItems.appendChild(svgEl('rect', { x: tl.x, y: tl.y, width: Math.abs(X) * this._tf.scale, height: Math.abs(Y) * this._tf.scale, fill: 'rgba(90,140,190,0.05)', stroke: '#4a6a8a', 'stroke-width': 1.5, rx: 2, style: 'pointer-events:none' }));
        const cxw = (x0 + x1) / 2, cyw = (y0 + y1) / 2, span = Math.max(Math.abs(X), Math.abs(Y), 10), off = span * 0.06;
        const label = (wx, wy, text, color) => {
            const s = this._S(wx, wy);
            const t = svgEl('text', { x: s.x, y: s.y, fill: color, 'text-anchor': 'middle', style: 'dominant-baseline:middle; font:bold 12px system-ui,sans-serif; pointer-events:none;' });
            t.textContent = text; this.gHandles.appendChild(t);
        };
        label(x1 + off, cyw, '+X', '#ff6b6b'); label(x0 - off, cyw, '-X', '#ff6b6b');
        label(cxw, y1 + off, '+Y', '#5fd35f'); label(cxw, y0 - off, '-Y', '#5fd35f');
        // machine HOME — a dot + short axis arms pointing INTO the envelope. Default machine-0 (ATC); a DECLARED home corner
        // (m.homeX/homeY, e.g. homing's <edge>Home: zMaxHome / xMinHome) marks the actual home end. Arms point toward centre.
        const hasHome = Number.isFinite(+m.homeX) || Number.isFinite(+m.homeY);
        const hx = +m.homeX || 0, hy = +m.homeY || 0;
        const o = this._S(hx, hy), arm = Math.max(16, span * 0.11 * this._tf.scale);
        const inX = hasHome ? (hx <= cxw ? 1 : -1) : 1, inY = hasHome ? (hy <= cyw ? 1 : -1) : 1;   // point INTO the envelope
        const axis = (dx, dy, color) => this.gHandles.appendChild(svgEl('line', { x1: o.x, y1: o.y, x2: o.x + dx, y2: o.y + dy, stroke: color, 'stroke-width': 2, style: 'pointer-events:none' }));
        axis(inX * arm, 0, '#ff6b6b');     // toward the reachable X (screen right = world +X)
        axis(0, -inY * arm, '#5fd35f');    // toward the reachable Y (screen up = world +Y)
        this.gHandles.appendChild(svgEl('circle', { cx: o.x, cy: o.y, r: 3.4, fill: '#e6edf5', stroke: '#0b0e13', 'stroke-width': 1, style: 'pointer-events:none' }));
        const hl = svgEl('text', { x: o.x + 7 * inX, y: o.y + 15, fill: '#9fb0c3', 'text-anchor': inX < 0 ? 'end' : 'start', style: 'font:600 10px system-ui,sans-serif; pointer-events:none;' });
        hl.textContent = hasHome ? 'HOME' : 'HOME 0,0'; this.gHandles.appendChild(hl);
    }

    /** Stock-attach markers — small squares on the stock's 9 points (corners/edges/centre). Click one to choose which
     *  stock corner the path attaches to (mirrors the form's STOCK ANCHOR picker). Filled = current; green ring = the
     *  stock's own datum (the default attach). The PATH anchor is form-only, so the canvas never shows two marker sets. */
    _drawStockAttach(spec) {
        this._attachPts = null;
        if (!spec || !spec.onStockAttach || !spec.stock || !(spec.stock.w > 0) || !(spec.stock.h > 0)) return;
        const handles = this.gHandles;
        const w = spec.stock.w, h = spec.stock.h, sox = spec.stock.ox || 0, soy = spec.stock.oy || 0;
        const xc = ['n', 'c', 'p'], xs = [sox, sox + w / 2, sox + w], ys = [soy, soy + h / 2, soy + h];
        const cur = String(spec.stockAttach || spec.stockDatum || 'nn'), stk = String(spec.stockDatum || 'nn');
        const pts = [];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            const code = xc[i] + xc[j], c = this._S(xs[i], ys[j]);
            const isCur = code === cur, isStk = code === stk;
            handles.appendChild(svgEl('rect', { x: c.x - 5, y: c.y - 5, width: 10, height: 10, rx: 2, 'data-attach': code, fill: isCur ? '#4ab3ff' : 'rgba(120,160,200,0.16)', stroke: isStk ? '#5fd06a' : '#5a6f86', 'stroke-width': isStk ? 2 : 1, style: 'cursor:pointer' }));
            pts.push({ x: xs[i], y: ys[j], code });
        }
        this._attachPts = pts;
    }

    /** Hit-test the stock-attach markers in world units → the nearest marker or null. */
    _hitAttach(w) {
        if (!this._attachPts || !w) return null;
        const tol = 11 / this._tf.scale;
        let best = null, bd = tol;
        this._attachPts.forEach((p) => { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d <= bd) { bd = d; best = p; } });
        return best;
    }

    /** Corner-selector (t112) — click a stock CORNER to set the `corner` param (GUI-first, augments the Corner dropdown).
     *  4 ring targets on the stock corners FL/FR/BL/BR (FL=min-XY … BR=max-XY — matches cornerXY/the emit); the CURRENT
     *  corner is filled, hover-highlights via CSS. Clicking → spec.onCornerPick(code) sets the corner → the emit + the
     *  now-per-corner markers/sim all follow (prefill done). Opt-in: only ops whose spec carries onCornerPick + `corner`. */
    _drawCornerPick(spec) {
        this._cornerPts = null;
        if (!spec || !spec.onCornerPick || !spec.stock || !(spec.stock.w > 0) || !(spec.stock.h > 0)) return;
        const w = spec.stock.w, h = spec.stock.h, ox = spec.stock.ox || 0, oy = spec.stock.oy || 0;
        const cur = String(spec.corner || 'FL');
        const corners = [
            { code: 'FL', x: ox, y: oy }, { code: 'FR', x: ox + w, y: oy },
            { code: 'BL', x: ox, y: oy + h }, { code: 'BR', x: ox + w, y: oy + h },
        ];
        const pts = [];
        for (const cn of corners) {
            const c = this._S(cn.x, cn.y);
            this.gHandles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 7, 'data-corner': cn.code, class: 'fc-corner-pick' + (cn.code === cur ? ' fc-corner-pick-cur' : ''), style: 'cursor:pointer' }));
            pts.push({ x: cn.x, y: cn.y, code: cn.code });
        }
        this._cornerPts = pts;
    }

    /** Hit-test the corner-pick targets in world units → the nearest corner or null. */
    _hitCorner(w) {
        if (!this._cornerPts || !w) return null;
        const tol = 12 / this._tf.scale;
        let best = null, bd = tol;
        this._cornerPts.forEach((p) => { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d <= bd) { bd = d; best = p; } });
        return best;
    }

    /** Edge/wall picker (t345 E6) — click a stock WALL to set axis+dir in one gesture (GUI-first, augments the Axis/Direction
     *  dropdowns; UX parity with the corner picker). 4 clickable EDGE strips: Left(x=0)→X/pos · Right(x=W)→X/neg ·
     *  Front(y=0)→Y/pos · Back(y=H)→Y/neg (matches edgeStack's axis/dir → the probed wall). The CURRENT wall gets a filled
     *  class; hover-highlights via CSS. Clicking → spec.onEdgePick(axis, dir) → the emit + the E3 wall glyph + the sim-start
     *  all follow. Opt-in: only ops whose spec carries onEdgePick (an axis+dir op). Drawn in gHandles (top, clickable). */
    _drawEdgePick(spec) {
        this._edgeSegs = null;
        if (!spec || !spec.onEdgePick || !spec.stock || !(spec.stock.w > 0) || !(spec.stock.h > 0)) return;
        const w = spec.stock.w, h = spec.stock.h, ox = spec.stock.ox || 0, oy = spec.stock.oy || 0;
        const sel = spec.edgeSel || {};
        const curAxis = sel.axis === 'Y' ? 'Y' : 'X', curDir = sel.dir === 'neg' ? 'neg' : 'pos';
        const edges = [
            { axis: 'X', dir: 'pos', x1: ox, y1: oy, x2: ox, y2: oy + h },           // left face (x=0)
            { axis: 'X', dir: 'neg', x1: ox + w, y1: oy, x2: ox + w, y2: oy + h },   // right face (x=W)
            { axis: 'Y', dir: 'pos', x1: ox, y1: oy, x2: ox + w, y2: oy },           // front face (y=0)
            { axis: 'Y', dir: 'neg', x1: ox, y1: oy + h, x2: ox + w, y2: oy + h },   // back face (y=H)
        ];
        const segs = [];
        for (const eg of edges) {
            const a = this._S(eg.x1, eg.y1), b = this._S(eg.x2, eg.y2);
            const isCur = eg.axis === curAxis && eg.dir === curDir;
            this.gHandles.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'data-axis': eg.axis, 'data-dir': eg.dir, class: 'fc-edge-pick' + (isCur ? ' fc-edge-pick-cur' : ''), style: 'cursor:pointer' }));
            segs.push(eg);
        }
        this._edgeSegs = segs;
    }

    /** Hit-test the edge-pick strips in world units → the nearest wall's {axis, dir} or null (perpendicular dist to the segment). */
    _hitEdge(w) {
        if (!this._edgeSegs || !w) return null;
        const tol = 10 / this._tf.scale;
        let best = null, bd = tol;
        for (const s of this._edgeSegs) {
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len2 = dx * dx + dy * dy || 1;
            let t = ((w.x - s.x1) * dx + (w.y - s.y1) * dy) / len2; t = Math.max(0, Math.min(1, t));
            const px = s.x1 + t * dx, py = s.y1 + t * dy, d = Math.hypot(px - w.x, py - w.y);
            if (d <= bd) { bd = d; best = { axis: s.axis, dir: s.dir }; }
        }
        return best;
    }

    /** Build-frame bounding box of the path geometry (items + paths), or null if empty. */
    _itemsBBox(spec) {
        let x0 = 0, y0 = 0, x1 = 0, y1 = 0, any = false;
        const acc = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; if (!any) { x0 = x1 = x; y0 = y1 = y; any = true; } else { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } };
        (spec.items || []).forEach((it) => {
            if (it.kind === 'hole') acc(it.x, it.y);
            else if (it.kind === 'line') { acc(it.x1, it.y1); acc(it.x2, it.y2); }
            else if (it.kind === 'circle') { acc(it.cx - it.r, it.cy - it.r); acc(it.cx + it.r, it.cy + it.r); }
            else if (it.kind === 'rect') { acc(it.x, it.y); acc(it.x + it.w, it.y + it.h); }
        });
        (spec.paths || []).forEach((p) => (p.pts || []).forEach((pt) => acc(pt.x, pt.y)));
        return any ? { minX: x0, minY: y0, maxX: x1, maxY: y1 } : null;
    }

    /** Snap-FROM offsets for a dragged position handle (relative to the handle): the handle itself + the path bbox's
     *  9 anchor points (corners / edge mids / centre). Lets ANY path anchor be the point that lands on a stock anchor,
     *  while you still drag only the one position handle. */
    _snapOffsets(handle) {
        const offs = [{ x: 0, y: 0 }];   // the handle point itself
        const b = this._itemsBBox(this.spec);
        if (b) {
            const xs = [b.minX, (b.minX + b.maxX) / 2, b.maxX], ys = [b.minY, (b.minY + b.maxY) / 2, b.maxY];
            for (const ax of xs) for (const ay of ys) offs.push({ x: ax - handle.x, y: ay - handle.y });
        }
        return offs;
    }

    /** Snap the dragged position to a stock anchor (or part-zero): try every (snap-from path anchor → stock anchor)
     *  pair and return the handle world point that lands the closest pair within tolerance, plus the target anchor for
     *  the highlight ring. null = no snap (free drag). */
    _snapToAnchor(w) {
        if (!w || !this._tf) return null;
        const tol = 7 / this._tf.scale;   // a SMALL magnetic radius (px) — only catches when the cursor is genuinely close
        const targets = (this._attachPts || []).slice();
        targets.push({ x: 0, y: 0, code: 'origin' });   // part-zero is an anchor too
        const offs = (this.active && this.active.snapOffsets) || [{ x: 0, y: 0 }];
        let best = null, bd = tol;
        for (const t of targets) for (const o of offs) {
            const cx = t.x - o.x, cy = t.y - o.y;   // handle world that lands path-anchor `o` exactly on target `t`
            const d = Math.hypot(cx - w.x, cy - w.y);
            if (d <= bd) { bd = d; best = { x: cx, y: cy, target: t }; }
        }
        return best;
    }

    /** Inline-edit a dimension's VALUE (click-to-type on its on-canvas label) → spec.onEdit(id, value). Generic, so
     *  every wizard's handles become typeable just by giving the handle a `value` and the spec an `onEdit`. */
    _editDim(h, sx, sy) {
        if (!this.spec || !this.spec.onEdit) return;
        const old = this.container.querySelector('.fc-dim-edit'); if (old) old.remove();
        const inp = document.createElement('input');
        inp.type = 'number'; inp.step = 'any'; inp.value = r3(h.value); inp.className = 'fc-dim-edit';
        inp.setAttribute('data-handle', h.id);
        inp.style.cssText = `position:absolute; left:${sx}px; top:${sy - 14}px; width:66px; font-size:12px; padding:1px 3px; z-index:20; background:var(--panel,#161b22); color:var(--text-main,#dfe6ee); border:1px solid var(--accent,#4af); border-radius:4px;`;
        this.container.appendChild(inp);
        inp.focus(); inp.select();
        let done = false;
        const commit = () => { if (done) return; done = true; const val = parseFloat(inp.value); inp.remove(); if (Number.isFinite(val)) this.spec.onEdit(h.id, val); };
        const cancel = () => { if (done) return; done = true; inp.remove(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') cancel(); });
        inp.addEventListener('blur', commit);
    }

    /** DUAL inline editor (double-click a handle): two labelled number inputs (X/Y for a position handle, W/H for a size
     *  handle) overlaid at the handle → spec.onEditDual(id, [a, b]) on Enter/blur, Esc cancels. The handle opts in via
     *  `h.edit = { labels:[l1,l2], vals:[v1,v2] }`. Generic — every wizard's handles become dual-typeable this way. */
    _editDual(h) {
        if (!this.spec || !this.spec.onEditDual || !h.edit) return;
        const old = this.container.querySelector('.fc-dim-edit-dual'); if (old) old.remove();
        const c = this._disp(h.x, h.y);
        const labels = h.edit.labels || ['X', 'Y'], vals = h.edit.vals || [0, 0];
        const box = document.createElement('div');
        box.className = 'fc-dim-edit-dual';
        box.style.cssText = `position:absolute; left:${c.x + 12}px; top:${c.y - 12}px; z-index:21; display:flex; align-items:center; gap:3px; background:var(--panel,#161b22); color:var(--text-main,#dfe6ee); border:1px solid var(--accent,#4af); border-radius:4px; padding:2px 4px; box-shadow:0 3px 10px rgba(0,0,0,0.5);`;
        const inputs = [];
        for (let i = 0; i < 2; i++) {
            const lab = document.createElement('span'); lab.textContent = labels[i]; lab.style.cssText = 'font-size:10px; color:#9fb4cc;';
            const inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.value = r3(vals[i]);
            inp.style.cssText = 'width:52px; font-size:12px; padding:1px 3px; background:#0d0f14; color:var(--text-main,#dfe6ee); border:1px solid #3a414d; border-radius:3px;';
            box.appendChild(lab); box.appendChild(inp); inputs.push(inp);
        }
        this.container.appendChild(box);
        inputs[0].focus(); inputs[0].select();
        let done = false;
        const commit = () => { if (done) return; done = true; const a = parseFloat(inputs[0].value), b = parseFloat(inputs[1].value); box.remove(); if (Number.isFinite(a) && Number.isFinite(b)) this.spec.onEditDual(h.id, [a, b]); };
        const cancel = () => { if (done) return; done = true; box.remove(); };
        box.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); cancel(); } });
        box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) commit(); });   // leaving the box (not tabbing between the 2 inputs) commits
        box.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't let the canvas start a pan/drag
    }
}
