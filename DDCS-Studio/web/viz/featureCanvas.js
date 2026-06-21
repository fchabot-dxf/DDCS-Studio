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
    }

    _bind() {
        const svg = this.svg;
        svg.addEventListener('pointerdown', (e) => {
            if (!this.spec || !this._tf || e.button !== 0) return;
            // The PATH ⌖ datum picker is a fixed screen-space widget → test it in viewBox units before world hits.
            const cell = this._hitDatum(this._clientToVB(e.clientX, e.clientY));
            if (cell) { if (this.spec.onPathDatum) this.spec.onPathDatum(cell.code); e.preventDefault(); return; }
            const w = this._toWorld(e);
            const hit = this._hit(w);
            if (!hit) {
                // Stock-attach markers sit on the stock's corners/edges (world space) → click one to set the corner.
                const att = this._hitAttach(w);
                if (att) { if (this.spec.onStockAttach) this.spec.onStockAttach(att.code); e.preventDefault(); return; }
            }
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            if (hit) this.active = { id: hit.id };           // grab a handle
            else this.pan = this._clientToVB(e.clientX, e.clientY); // else pan the background
            svg.style.cursor = 'grabbing';
            e.preventDefault();
        });
        svg.addEventListener('pointermove', (e) => {
            if (!this.spec || !this._tf) return;
            if (this.active) {
                // Handles live in the pattern's build frame; the view draws them placed → undo the placement here.
                if (this.spec.onDrag) { const w = this._toWorld(e), p = this._placement || { x: 0, y: 0 }; this.spec.onDrag(this.active.id, { x: w.x - (p.x || 0), y: w.y - (p.y || 0) }); }
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
        // Stock is datum-positioned (ox/oy); the pattern items + handles ride the placement (px/py) — same as drawn.
        const pl = spec.placement || { x: 0, y: 0 }, px = pl.x || 0, py = pl.y || 0;
        const sox = (spec.stock && spec.stock.ox) || 0, soy = (spec.stock && spec.stock.oy) || 0;
        acc(0, 0);
        if (spec.stock) { acc(sox, soy); acc(sox + spec.stock.w, soy + spec.stock.h); }
        (spec.items || []).forEach((it) => {
            if (it.kind === 'hole') acc(it.x + px, it.y + py);
            else if (it.kind === 'line') { acc(it.x1 + px, it.y1 + py); acc(it.x2 + px, it.y2 + py); }
            else if (it.kind === 'circle') { acc(it.cx - it.r + px, it.cy - it.r + py); acc(it.cx + it.r + px, it.cy + it.r + py); }
            else if (it.kind === 'rect') { acc(it.x + px, it.y + py); acc(it.x + it.w + px, it.y + it.h + py); }
        });
        (spec.handles || []).forEach((h) => acc(h.x + px, h.y + py));
        let w = x1 - x0, h = y1 - y0;
        if (!(w > 1)) { x0 -= 50; x1 += 50; w = x1 - x0; }
        if (!(h > 1)) { y0 -= 50; y1 += 50; h = y1 - y0; }
        const scale = Math.min(VW / w, VH / h) * 0.82;
        return { scale, cxw: (x0 + x1) / 2, cyw: (y0 + y1) / 2, cx: VW / 2, cy: VH / 2 };
    }

    _S(x, y) { const t = this._tf; return { x: t.cx + (x - t.cxw) * t.scale, y: t.cy - (y - t.cyw) * t.scale }; }
    _W(sx, sy) { const t = this._tf; return { x: t.cxw + (sx - t.cx) / t.scale, y: t.cyw - (sy - t.cy) / t.scale }; }
    /** World→screen WITH the toolpath placement applied. Pattern items/handles ride the placement (they're authored
     *  in the build frame); the stock + its attach markers do NOT (they're already in part coords). */
    _disp(x, y) { const p = this._placement || { x: 0, y: 0 }; return this._S(x + (p.x || 0), y + (p.y || 0)); }

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
        return best;
    }

    _draw(spec, VW, VH) {
        const grid = this.gGrid, items = this.gItems, handles = this.gHandles;
        grid.replaceChildren(); items.replaceChildren(); handles.replaceChildren();
        this._placement = spec.placement || { x: 0, y: 0 };   // pattern items/handles ride this; stock is datum-fixed

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

        // --- stock (datum-positioned: its datum corner sits at part-zero, the origin) ---------------------
        if (spec.stock && spec.stock.w > 0 && spec.stock.h > 0) {
            const sox = spec.stock.ox || 0, soy = spec.stock.oy || 0;
            const o = this._S(sox, soy + spec.stock.h);
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
                const c = this._disp(it.cx, it.cy);
                items.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: it.r * this._tf.scale, class: 'fc-guide' }));
            } else if (it.kind === 'line') {
                const a = this._disp(it.x1, it.y1), b = this._disp(it.x2, it.y2);
                items.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'fc-guide' }));
            } else if (it.kind === 'rect') {
                const p = this._disp(it.x, it.y + it.h);
                items.appendChild(svgEl('rect', { x: p.x, y: p.y, width: it.w * this._tf.scale, height: it.h * this._tf.scale, class: 'fc-guide' }));
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
            if (h.kind === 'move') {
                handles.appendChild(svgEl('rect', { x: c.x - 6, y: c.y - 6, width: 12, height: 12, class: 'fc-handle fc-handle-move', rx: 2 }));
            } else {
                handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 6, class: 'fc-handle' }));
            }
            if (h.label) {
                const t = svgEl('text', { x: c.x + 10, y: c.y - 8, class: 'fc-handle-label' });
                if (h.value != null && this.spec.onEdit) {
                    // Centroid-style: the dimension shows its VALUE and is click-to-edit (type, don't just drag).
                    t.textContent = `${h.label} ${r3(h.value)}`;
                    t.style.cursor = 'text';
                    t.style.textDecoration = 'underline';
                    t.style.pointerEvents = 'auto';   // labels may be pointer-events:none; the editable dim must catch clicks
                    t.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't let the canvas start a pan/drag
                    t.addEventListener('click', (e) => { e.stopPropagation(); this._editDim(h, c.x + 10, c.y - 8); });   // open AFTER mouseup so focus sticks
                } else {
                    t.textContent = h.label;
                }
                handles.appendChild(t);
            }
        });

        this._drawDatumWidget(spec, VW, VH);
        this._drawStockAttach(spec);
    }

    /** Stock-attach markers — small squares on the stock's 9 points (corners/edges/centre). Click one to choose which
     *  stock corner the path attaches to. Filled = current; green ring = the stock's own datum (the default attach). */
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

    /** 3×3 path-datum picker — a fixed screen-space widget (top-left). Each cell = which corner of the pattern
     *  anchors on the stock. Filled = the current path datum; ringed = the stock's own datum (the default). Clicking
     *  a cell calls spec.onPathDatum(code) where code is [X][Y] of n(min)/c(centre)/p(max). */
    _drawDatumWidget(spec, VW, VH) {
        this._datumCells = null;
        if (!spec || !spec.onPathDatum) return;
        const handles = this.gHandles;
        const cs = 16, gx = 12, gy = 26, pad = 5;
        // panel + title
        handles.appendChild(svgEl('rect', { x: gx - pad, y: 8, width: cs * 3 + pad * 2, height: cs * 3 + 18 + pad, rx: 4, fill: 'rgba(8,12,18,0.72)', stroke: '#2c3a4a', 'stroke-width': 1 }));
        const title = svgEl('text', { x: gx - pad + 4, y: 20, class: 'fc-handle-label', 'font-size': 9, fill: '#9fb3c8' });
        title.textContent = 'PATH ⌖'; handles.appendChild(title);
        const colC = ['n', 'c', 'p'], rowC = ['p', 'c', 'n'];   // left→right = minX..maxX ; top→bottom = maxY..minY
        const cur = String(spec.pathDatum || spec.stockDatum || 'nn');
        const stk = String(spec.stockDatum || 'nn');
        const cells = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
            const code = colC[c] + rowC[r];
            const x = gx + c * cs, y = gy + r * cs;
            const isCur = code === cur, isStk = code === stk;
            handles.appendChild(svgEl('rect', { x: x + 1, y: y + 1, width: cs - 2, height: cs - 2, rx: 2, fill: isCur ? '#ffcf3a' : 'rgba(120,150,180,0.12)', stroke: isStk ? '#5fd06a' : '#4a5a6a', 'stroke-width': isStk ? 2 : 1, style: 'cursor:pointer' }));
            cells.push({ x, y, w: cs, h: cs, code });
        }
        this._datumCells = cells;
    }

    /** Hit-test the datum widget in viewBox units → the clicked cell or null. */
    _hitDatum(vb) {
        if (!this._datumCells || !vb) return null;
        return this._datumCells.find((c) => vb.x >= c.x && vb.x <= c.x + c.w && vb.y >= c.y && vb.y <= c.y + c.h) || null;
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
}
