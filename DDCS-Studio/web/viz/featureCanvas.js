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
    }

    _mount(container) {
        if (this.container === container && this.svg) return;
        this.container = container;
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
    }

    _bind() {
        const svg = this.svg;
        svg.addEventListener('pointerdown', (e) => {
            if (!this.spec || !this._tf || e.button !== 0) return;
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            const hit = this._hit(this._toWorld(e));
            if (hit) this.active = { id: hit.id };           // grab a handle
            else this.pan = this._clientToVB(e.clientX, e.clientY); // else pan the background
            svg.style.cursor = 'grabbing';
            e.preventDefault();
        });
        svg.addEventListener('pointermove', (e) => {
            if (!this.spec || !this._tf) return;
            if (this.active) {
                if (this.spec.onDrag) this.spec.onDrag(this.active.id, this._toWorld(e));
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
            let id;
            if (this.active) { id = this.active.id; this.active = null; }
            else if (this.pan) { this.pan = null; }
            else return;
            this.svg.style.cursor = 'default';
            try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
            if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);
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

        // Double-click empty space → re-frame (resume auto-fit).
        svg.addEventListener('dblclick', (e) => {
            if (!this.spec || !this._tf || this._hit(this._toWorld(e))) return;
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
        else { this._tf.cx = VW / 2; this._tf.cy = VH / 2; }
        this._draw(spec, VW, VH);
    }

    /** Fit the union of stock + items + handles + origin into the viewport with a margin. */
    _fit(spec, VW, VH) {
        let x0 = 0, y0 = 0, x1 = 0, y1 = 0, any = false;
        const acc = (x, y) => {
            if (!isFinite(x) || !isFinite(y)) return;
            if (!any) { x0 = x1 = x; y0 = y1 = y; any = true; }
            else { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        };
        acc(0, 0);
        if (spec.stock) { acc(0, 0); acc(spec.stock.w, spec.stock.h); }
        (spec.items || []).forEach((it) => {
            if (it.kind === 'hole') acc(it.x, it.y);
            else if (it.kind === 'line') { acc(it.x1, it.y1); acc(it.x2, it.y2); }
            else if (it.kind === 'circle') { acc(it.cx - it.r, it.cy - it.r); acc(it.cx + it.r, it.cy + it.r); }
            else if (it.kind === 'rect') { acc(it.x, it.y); acc(it.x + it.w, it.y + it.h); }
        });
        (spec.handles || []).forEach((h) => acc(h.x, h.y));
        let w = x1 - x0, h = y1 - y0;
        if (!(w > 1)) { x0 -= 50; x1 += 50; w = x1 - x0; }
        if (!(h > 1)) { y0 -= 50; y1 += 50; h = y1 - y0; }
        const scale = Math.min(VW / w, VH / h) * 0.82;
        return { scale, cxw: (x0 + x1) / 2, cyw: (y0 + y1) / 2, cx: VW / 2, cy: VH / 2 };
    }

    _S(x, y) { const t = this._tf; return { x: t.cx + (x - t.cxw) * t.scale, y: t.cy - (y - t.cyw) * t.scale }; }
    _W(sx, sy) { const t = this._tf; return { x: t.cxw + (sx - t.cx) / t.scale, y: t.cyw - (sy - t.cy) / t.scale }; }

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

    /** Nearest handle within a ~12px tolerance, or null. */
    _hit(w) {
        const tol = 13 / this._tf.scale;
        let best = null, bd = tol;
        (this.spec.handles || []).forEach((h) => {
            const d = Math.hypot(h.x - w.x, h.y - w.y);
            if (d <= bd) { bd = d; best = h; }
        });
        return best;
    }

    _draw(spec, VW, VH) {
        const grid = this.gGrid, items = this.gItems, handles = this.gHandles;
        grid.replaceChildren(); items.replaceChildren(); handles.replaceChildren();

        // --- grid ---------------------------------------------------------
        const tl = this._W(0, 0), br = this._W(VW, VH);
        const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x);
        const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y);
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

        // --- stock --------------------------------------------------------
        if (spec.stock && spec.stock.w > 0 && spec.stock.h > 0) {
            const o = this._S(0, spec.stock.h);
            items.appendChild(svgEl('rect', {
                x: o.x, y: o.y, width: spec.stock.w * this._tf.scale, height: spec.stock.h * this._tf.scale,
                class: 'fc-stock', rx: 2,
            }));
        }

        // --- work-origin crosshair ---------------------------------------
        const og = this._S(0, 0);
        grid.appendChild(svgEl('line', { x1: og.x - 9, y1: og.y, x2: og.x + 9, y2: og.y, class: 'fc-axis-x' }));
        grid.appendChild(svgEl('line', { x1: og.x, y1: og.y - 9, x2: og.x, y2: og.y + 9, class: 'fc-axis-y' }));

        // --- guides (rings / bounding rects / paths) ---------------------
        (spec.items || []).forEach((it) => {
            if (it.kind === 'circle') {
                const c = this._S(it.cx, it.cy);
                items.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: it.r * this._tf.scale, class: 'fc-guide' }));
            } else if (it.kind === 'line') {
                const a = this._S(it.x1, it.y1), b = this._S(it.x2, it.y2);
                items.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'fc-guide' }));
            } else if (it.kind === 'rect') {
                const p = this._S(it.x, it.y + it.h);
                items.appendChild(svgEl('rect', { x: p.x, y: p.y, width: it.w * this._tf.scale, height: it.h * this._tf.scale, class: 'fc-guide' }));
            }
        });

        // --- holes (drawn last so they sit on top of guides) -------------
        (spec.items || []).forEach((it) => {
            if (it.kind !== 'hole') return;
            const c = this._S(it.x, it.y);
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
            const c = this._S(h.x, h.y);
            if (h.kind === 'move') {
                handles.appendChild(svgEl('rect', { x: c.x - 6, y: c.y - 6, width: 12, height: 12, class: 'fc-handle fc-handle-move', rx: 2 }));
            } else {
                handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 6, class: 'fc-handle' }));
            }
            if (h.label) {
                const t = svgEl('text', { x: c.x + 10, y: c.y - 8, class: 'fc-handle-label' });
                t.textContent = h.label;
                handles.appendChild(t);
            }
        });
    }
}
