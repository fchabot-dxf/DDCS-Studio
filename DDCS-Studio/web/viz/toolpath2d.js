/**
 * viz/toolpath2d.js — the shared 2D TOP-DOWN scene (canvas). It mirrors the 3D view from straight above:
 * grid + machine envelope + stock + toolpath + coordinate axes/labels — everything the 3D scene has, flat.
 *
 * Why 2D earns its place over a 3D top-view: pixels map 1:1 to mm, so COORDINATES are cheap here — a faint
 * coordinate grid, sparse axis labels and a live cursor X/Y readout, no unprojection. It also needs no WebGL
 * (the automatic fallback) and is lighter on phones. Coordinates are the program/work frame (part-zero at 0).
 *
 * The route comes from the EXECUTION ENGINE's trace (engine/trace.js) so parametric/probe macros draw correctly.
 * Play shows a TRAIL: upcoming faint/thin, executed bold, a dot at the tool head. Colours match the 3D legend.
 *
 * View: a pannable/zoomable transform. fit() frames the scene (called on toggle); zoom (wheel) + pan (drag)
 * persist after that — we do NOT auto-recenter on every redraw, so live wizard edits don't yank the view.
 */
import { traceToolpath } from '../engine/trace.js';

// Colours MATCH THE 3D LEGEND: rapid = yellow (dashed), retract = green, probe = blue (slow = light blue, dotted),
// feed = a blue→teal gradient by DEPTH (Z) across the path — which also surfaces the Z you can't see top-down.
const FEED_LOW = 0x0a4fd0, FEED_HIGH = 0x35ffd0;
const typeOf = (s) => s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
function lerpHex(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255, r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}
function segColor(s, zMin, zRange, maxPF) {
    const t = typeOf(s);
    if (t === 'rapid') return '#ffcc00';
    if (t === 'retract') return '#33cc55';
    if (t === 'probe') return ((s.feed || 0) > 0 && (s.feed || 0) < maxPF) ? '#93c5fd' : '#3b82f6';
    return lerpHex(FEED_LOW, FEED_HIGH, zRange ? (((s.z1 || 0) + (s.z2 || 0)) / 2 - zMin) / zRange : 0.5);
}
const OLD_DATUM = { fl: 'nnp', fr: 'pnp', bl: 'npp', br: 'ppp', center: 'ccp' };

// A "nice" step (1/2/5 × 10^n) ~14 cells across a span — the grid increment when not pinned in Preview.
function niceStep(span) {
    const raw = (span || 1) / 14;
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
// Datum offset (from the stock min corner) for a 3-char [X][Y][Z] code (or a migrated legacy code).
function datumXY(s) {
    let dc = s.datum || 'nnp'; if (!/^[ncp]{3}$/.test(dc)) dc = OLD_DATUM[dc] || 'nnp';
    const f = { n: 0, c: 0.5, p: 1 };
    return [f[dc[0]] * s.x, f[dc[1]] * s.y];
}

/** Bind a canvas → a 2D top-down scene controller (mirrors the GcodeViz3D inputs that matter in plan view). */
export function createToolpath2d(canvas, opts = {}) {
    let segs = [], machine = null, stock = null, wcs = null, gridStep = 0;
    let view = null;                 // { ox, oy, scale }: screenX = ox + x*scale, screenY = oy - y*scale (Y up)
    let cursor = null;               // program coords under the pointer → readout chip
    let start = null;                // operator start {x,y,z} → a DRAGGABLE handle (re-traces on release via opts.onStartDrag)
    let drag = null, dragStart = false;
    const anim = { playing: false, k: 0, raf: null };

    const W = () => canvas.clientWidth, H = () => canvas.clientHeight;
    const tx = (x) => view.ox + x * view.scale;
    const ty = (y) => view.oy - y * view.scale;

    // ---- scene geometry (program/work frame; part-zero at 0,0) ----
    function envelopeRect() {
        const m = machine;
        if (!m || !m.show || !m.x || !m.y || !m.z) return null;
        const wo = m.workOrigin || {}, wx = wo.x || 0, wy = wo.y || 0;
        return { minX: Math.min(0, m.x) - wx, maxX: Math.max(0, m.x) - wx, minY: Math.min(0, m.y) - wy, maxY: Math.max(0, m.y) - wy };
    }
    function stockRect() {
        const s = stock;
        if (!s || s.show === false || !(s.x > 0) || !(s.y > 0)) return null;
        const [Dx, Dy] = datumXY(s);
        let pinX = 0, pinY = 0;
        if (s.pin && s.pin !== 'origin' && machine && machine.wcs && machine.wcs.table) {
            const gi = parseInt(String(s.pin).replace(/[^0-9]/g, ''), 10) - 54;
            const t = machine.wcs.table[gi], wo = machine.workOrigin || {};
            if (t) { pinX = (Number(t.x) || 0) - (wo.x || 0); pinY = (Number(t.y) || 0) - (wo.y || 0); }
        }
        return { minX: -Dx + pinX, maxX: s.x - Dx + pinX, minY: -Dy + pinY, maxY: s.y - Dy + pinY, shape: s.shape };
    }
    function sceneBounds() {
        let bb = null;
        const ext = (r) => { if (!r) return; bb = bb ? { minX: Math.min(bb.minX, r.minX), minY: Math.min(bb.minY, r.minY), maxX: Math.max(bb.maxX, r.maxX), maxY: Math.max(bb.maxY, r.maxY) } : { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY }; };
        ext(envelopeRect()); ext(stockRect());
        if (segs.length) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; segs.forEach((s) => { a = Math.min(a, s.x1, s.x2); c = Math.max(c, s.x1, s.x2); b = Math.min(b, s.y1, s.y2); d = Math.max(d, s.y1, s.y2); }); ext({ minX: a, minY: b, maxX: c, maxY: d }); }
        if (!bb) bb = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        return { minX: Math.min(0, bb.minX), minY: Math.min(0, bb.minY), maxX: Math.max(0, bb.maxX), maxY: Math.max(0, bb.maxY) };   // always include the origin
    }
    const footprint = () => envelopeRect() || sceneBounds();
    const stepFor = (foot) => (gridStep > 0 ? gridStep : niceStep(Math.max(foot.maxX - foot.minX, foot.maxY - foot.minY)));

    // ---- drawing ----
    function paint() {
        const dpr = window.devicePixelRatio || 1, w = W(), h = H();
        const nw = Math.round(w * dpr), nh = Math.round(h * dpr);
        if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; }   // resize only on real size change
        const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        if (!view) return;
        canvas.__t2view = view;   // expose the world→screen transform (debug + tests): sx=ox+x*scale, sy=oy-y*scale
        const foot = footprint(), step = stepFor(foot);
        drawGrid(ctx, foot, step);
        const env = envelopeRect(); if (env) drawRect(ctx, env, 'rgba(108,122,140,0.55)', null);
        const st = stockRect(); if (st) drawRect(ctx, st, st.shape === 'pocket' ? 'rgba(134,182,255,0.65)' : 'rgba(166,215,124,0.65)', st.shape === 'pocket' ? 'rgba(106,143,190,0.10)' : 'rgba(143,174,106,0.10)');
        drawOriginAxes(ctx, foot);
        drawPath(ctx, anim.playing ? Math.floor(anim.k) : null);
        drawLabels(ctx, foot, step, w, h);
        if (start) drawStartHandle(ctx);
        if (cursor) drawReadout(ctx, cursor, w, h);
    }
    function drawStartHandle(ctx) {   // ruby start marker + grab-ring — the draggable operator start (matches the 3D ① marker)
        const hx = tx(start.x), hy = ty(start.y);
        ctx.save();
        ctx.fillStyle = 'rgba(231,76,91,0.9)'; ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(231,76,91,0.7)'; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    function drawGrid(ctx, foot, step) {
        if (!(step > 0)) return;
        ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(94,107,122,0.16)'; ctx.beginPath();
        for (let k = Math.ceil(foot.minX / step - 1e-9); k <= Math.floor(foot.maxX / step + 1e-9); k++) { const x = tx(k * step); ctx.moveTo(x, ty(foot.minY)); ctx.lineTo(x, ty(foot.maxY)); }
        for (let j = Math.ceil(foot.minY / step - 1e-9); j <= Math.floor(foot.maxY / step + 1e-9); j++) { const y = ty(j * step); ctx.moveTo(tx(foot.minX), y); ctx.lineTo(tx(foot.maxX), y); }
        ctx.stroke(); ctx.restore();
    }
    function drawRect(ctx, r, line, fill) {
        const x0 = tx(r.minX), x1 = tx(r.maxX), yTop = ty(r.maxY), yBot = ty(r.minY);
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop); }
        if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1.4; ctx.strokeRect(x0, yTop, x1 - x0, yBot - yTop); }
    }
    function drawOriginAxes(ctx, foot) {   // X axis (red) at y=0, Y axis (green) at x=0 — matches the 3D colours
        ctx.save(); ctx.lineWidth = 1.4;
        if (foot.minY <= 0 && foot.maxY >= 0) { ctx.strokeStyle = 'rgba(255,107,107,0.6)'; ctx.beginPath(); ctx.moveTo(tx(foot.minX), ty(0)); ctx.lineTo(tx(foot.maxX), ty(0)); ctx.stroke(); }
        if (foot.minX <= 0 && foot.maxX >= 0) { ctx.strokeStyle = 'rgba(95,211,95,0.6)'; ctx.beginPath(); ctx.moveTo(tx(0), ty(foot.minY)); ctx.lineTo(tx(0), ty(foot.maxY)); ctx.stroke(); }
        ctx.restore();
    }
    function strokeSegs(ctx, from, to, alpha, width, zMin, zRange, maxPF) {
        ctx.globalAlpha = alpha;
        for (let i = from; i < to; i++) {
            const s = segs[i], t = typeOf(s);
            ctx.strokeStyle = segColor(s, zMin, zRange, maxPF);
            ctx.lineWidth = t === 'rapid' ? width * 0.6 : width;
            ctx.setLineDash(t === 'probe' ? [2, 3] : (t === 'rapid' ? [5, 4] : []));   // probe dotted, rapid dashed (match 3D)
            ctx.beginPath(); ctx.moveTo(tx(s.x1), ty(s.y1)); ctx.lineTo(tx(s.x2), ty(s.y2)); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    function drawPath(ctx, k) {
        if (!segs.length) return;
        let zMin = Infinity, zMax = -Infinity, maxPF = 0;   // feed depth-gradient range + the fast-probe feed threshold
        for (const s of segs) { zMin = Math.min(zMin, s.z1, s.z2); zMax = Math.max(zMax, s.z1, s.z2); if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxPF) maxPF = s.feed; }
        const zR = (zMax - zMin) || 1;
        if (k == null) { strokeSegs(ctx, 0, segs.length, 1, 2, zMin, zR, maxPF); return; }
        const n = Math.max(0, Math.min(k, segs.length));
        strokeSegs(ctx, n, segs.length, 0.22, 1.5, zMin, zR, maxPF);
        strokeSegs(ctx, 0, n, 1, 2.6, zMin, zR, maxPF);
        const head = segs[n - 1] || segs[0]; const hx = tx(n > 0 ? head.x2 : head.x1), hy = ty(n > 0 ? head.y2 : head.y1);
        ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    }
    function drawLabels(ctx, foot, step, w, h) {   // sparse coord labels along the bottom (X) + left (Y) frame
        if (!(step > 0)) return;
        ctx.save(); ctx.font = '10px sans-serif';
        // X labels along the bottom — inset from the edge (clear of the toolbar) + a touch brighter so they read.
        ctx.fillStyle = '#90a0b2'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; let last = -1e9;
        for (let k = Math.ceil(foot.minX / step); k <= Math.floor(foot.maxX / step) + 1e-9; k++) { const px = tx(k * step); if (px < 16 || px > w - 4 || px - last < 38) continue; last = px; ctx.fillText(String(Math.round(k * step)), px, h - 7); }
        // Y labels along the left.
        ctx.fillStyle = '#6b7888'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; last = 1e9;
        for (let j = Math.ceil(foot.minY / step); j <= Math.floor(foot.maxY / step) + 1e-9; j++) { const py = ty(j * step); if (py < 8 || py > h - 12 || last - py < 26) continue; last = py; ctx.fillText(String(Math.round(j * step)), 3, py); }
        ctx.restore();
    }
    function drawReadout(ctx, c, w, h) {   // tooltip BESIDE the cursor (clear of the pointer graphic + the status bar)
        const txt = `X ${c.x.toFixed(1)}   Y ${c.y.toFixed(1)}`;
        ctx.save(); ctx.font = '11px sans-serif'; ctx.textBaseline = 'top';
        const pad = 6, bw = ctx.measureText(txt).width + pad * 2, bh = 18;
        const px = tx(c.x), py = ty(c.y);
        let sx = px + 18;                                // to the RIGHT of the cursor, clear of the arrow
        const sy = Math.max(2, Math.min(h - bh - 2, py - bh / 2));   // vertically centred on the cursor
        if (sx + bw > w - 2) sx = px - 18 - bw;          // flip left near the right edge
        sx = Math.max(2, sx);
        ctx.fillStyle = 'rgba(13,17,23,0.9)'; ctx.fillRect(sx, sy, bw, bh);
        ctx.strokeStyle = 'rgba(120,140,160,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = '#cdd9e6'; ctx.textAlign = 'left'; ctx.fillText(txt, sx + pad, sy + 4);
        ctx.restore();
    }

    // ---- view ----
    function fit() {
        const bb = sceneBounds(), w = W(), h = H(), pad = 28;
        const bw = Math.max(1, bb.maxX - bb.minX), bh = Math.max(1, bb.maxY - bb.minY);
        const scale = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
        const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
        view = { ox: w / 2 - cx * scale, oy: h / 2 + cy * scale, scale };
        paint();
    }
    const redraw = () => { if (view) paint(); else fit(); };

    // ---- inputs ----
    function setSegments(next) { segs = next || []; if (view) paint(); else fit(); }
    function setMachine(m) { machine = m || null; if (view) paint(); }
    function setStock(s) { stock = s || null; if (view) paint(); }
    function setWcs(w) { wcs = w || null; }
    function setGridStep(s) { gridStep = Number(s) || 0; if (view) paint(); }
    function setStart(p) { start = p ? { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 } : null; if (view) paint(); }
    function setGcode(text) { setSegments(traceToolpath(text).segments); }

    // ---- play / progress ----
    function stop() { if (anim.playing) { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = null; } redraw(); }
    function loop() { if (!anim.playing) return; anim.k += 1.2; if (anim.k >= segs.length) anim.k = 0; paint(); anim.raf = requestAnimationFrame(loop); }
    function play() { if (anim.playing || !segs.length) return; anim.playing = true; anim.k = 0; loop(); }
    function toggle() { if (anim.playing) { stop(); return false; } play(); return anim.playing; }
    function seek(k) { anim.playing = true; anim.k = k; if (view) paint(); else fit(); }

    // ---- interaction: wheel zoom (about cursor) + drag pan + hover readout (pointer events → touch too) ----
    canvas.addEventListener('wheel', (e) => {
        if (!view) return; e.preventDefault();
        const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        const wx = (sx - view.ox) / view.scale, wy = (view.oy - sy) / view.scale;
        const ns = Math.max(0.02, Math.min(400, view.scale * Math.exp(-e.deltaY * 0.0015)));
        view.scale = ns; view.ox = sx - wx * ns; view.oy = sy + wy * ns; paint();
    }, { passive: false });
    const nearHandle = (e) => { if (!start || !view) return false; const r = canvas.getBoundingClientRect(); return Math.hypot(e.clientX - r.left - tx(start.x), e.clientY - r.top - ty(start.y)) <= 12; };
    canvas.addEventListener('pointerdown', (e) => {
        if (!view) return;
        if (nearHandle(e)) { dragStart = true; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ } return; }   // grab the start handle (not a pan)
        drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!view) return;
        const r = canvas.getBoundingClientRect();
        if (dragStart) { start = { x: (e.clientX - r.left - view.ox) / view.scale, y: (view.oy - (e.clientY - r.top)) / view.scale, z: start ? start.z : 0 }; paint(); return; }
        if (drag) { view.ox = drag.ox + (e.clientX - drag.x); view.oy = drag.oy + (e.clientY - drag.y); paint(); return; }
        cursor = { x: (e.clientX - r.left - view.ox) / view.scale, y: (view.oy - (e.clientY - r.top)) / view.scale };
        canvas.style.cursor = nearHandle(e) ? 'move' : '';
        if (!anim.playing) paint();
    });
    const endDrag = (e) => {
        if (dragStart && start && opts.onStartDrag) opts.onStartDrag({ x: start.x, y: start.y, z: start.z });   // re-trace once on release (not per move)
        dragStart = false; drag = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
    };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('mouseleave', () => { cursor = null; if (!anim.playing) paint(); });

    return {
        setGcode, setSegments, setMachine, setStock, setWcs, setGridStep, setStart, redraw, fit, play, stop, toggle, seek,
        get playing() { return anim.playing; },
        get count() { return segs.length; },
    };
}
