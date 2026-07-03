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
            }
            try { svg.setPointerCapture(e.pointerId); } catch (_) {}
            // Grab a handle. For a POSITION handle, precompute the snap "from" points (the handle itself + the path's
            // 9 bbox anchors) so any path corner/edge/centre can snap onto a stock anchor while dragging.
            if (hit) this.active = { id: hit.id, kind: hit.kind, snapOffsets: hit.kind === 'move' ? this._snapOffsets(hit) : null };
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
                    const sn = (this.active.kind === 'move') ? this._snapToAnchor(w) : null;
                    this._snap = sn ? { x: sn.target.x, y: sn.target.y } : null;   // ring on the stock anchor that caught it
                    if (sn) w = { x: sn.x, y: sn.y };
                    const p = this._placement || { x: 0, y: 0 };
                    this.spec.onDrag(this.active.id, { x: w.x - (p.x || 0), y: w.y - (p.y || 0) });
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
            let id;
            if (this.active) { id = this.active.id; this.active = null; }
            else if (this.pan) { this.pan = null; }
            else return;
            this.svg.style.cursor = 'default';
            const hadSnap = !!this._snap; this._snap = null;
            try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
            if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);
            if (hadSnap && this.spec) this._draw(this.spec, this._vw, this._vh);   // clear the snap ring
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
        (spec.paths || []).forEach((pth) => (pth.pts || []).forEach((p) => acc(p.x + px, p.y + py)));
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
        // t87 — the SIM-ONLY marker IS draggable (writes userStarts, sim-only — "sim only means it doesn't emit, but we still
        // drag it to simulate a user start"). It only YIELDS the hit to an EMITTING handle when they DEGENERATELY COINCIDE
        // (e.g. an explicit 0 offset); normally (post-t76 anchor-offset fix) they're separated, so the sim marker grabs cleanly.
        if (best && best.simOnly) {
            const coincTol = 6 / this._tf.scale;
            const em = (this.spec.handles || []).find((h) => !h.simOnly && Math.hypot(h.x - best.x, h.y - best.y) < coincTol);
            if (em) return em;
        }
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
            } else if (it.kind === 'line') {
                const a = this._disp(it.x1, it.y1), b = this._disp(it.x2, it.y2);
                items.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: cls }));
            } else if (it.kind === 'rect') {
                const p = this._disp(it.x, it.y + it.h);
                items.appendChild(svgEl('rect', { x: p.x, y: p.y, width: it.w * this._tf.scale, height: it.h * this._tf.scale, class: cls }));
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
            if (h.simOnly) {
                // t73/t81 — the SIM-ONLY / manual-jog start marker: a HOLLOW CIRCLE ○ (was a diamond), the 2D-canvas twin of the
                // top panel's sim-only marker. Coloured by reposition source (cyan=auto / amber=manual), matching the top panel.
                const el = svgEl('circle', { cx: c.x, cy: c.y, r: 7, class: 'fc-handle fc-handle-sim', 'stroke-width': 2, ...hid });
                el.style.fill = 'none'; el.style.stroke = col || '#22d3ee';   // hollow, source-coloured stroke — beats .fc-handle
                handles.appendChild(el);
            } else if (h.kind === 'move') {
                // t81 — colour the emitting reposition handle by its travel SOURCE (cyan=auto / amber=manual), matching the top
                // panel; without a source it keeps the CSS fc-handle-move default (gold).
                const el = svgEl('rect', { x: c.x - 6, y: c.y - 6, width: 12, height: 12, class: 'fc-handle fc-handle-move', rx: 2, ...hid });
                if (col) { el.style.fill = col; el.style.stroke = col; }   // inline beats .fc-handle-move (gold); no source → CSS default
                handles.appendChild(el);
            } else {
                handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 6, class: 'fc-handle', ...hid }));
            }
            // Raw axis-delta readouts (the grid "dx"/"dy" labels) are unhelpful clutter — the handle stays
            // draggable (it still drives its field), we just drop its on-canvas text. Useful named dimensions
            // (Ø, W, pitch, …) keep their click-to-edit value label.
            const rawDelta = /^d[xy]$/i.test(String(h.label || ''));
            if (h.label && !rawDelta) {
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

        this._drawStockAttach(spec);
        this._drawCornerPick(spec);

        // Snap feedback: a green lock-ring + centre dot on the stock anchor (or part-zero) the dragged position handle
        // is locked onto — so it's obvious when the magnet caught (and which anchor).
        if (this._snap) {
            const c = this._S(this._snap.x, this._snap.y);
            handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 9, fill: 'none', stroke: '#5fd06a', 'stroke-width': 2, style: 'pointer-events:none' }));
            handles.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 2.6, fill: '#5fd06a', stroke: 'none', style: 'pointer-events:none' }));
        }
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
}
