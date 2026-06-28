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
    let segs = [], machine = null, stock = null, wcs = null, gridStep = 0, anchorToStart = false;
    let view = null;                 // { ox, oy, scale }: screenX = ox + x*scale, screenY = oy - y*scale (Y up)
    let cursor = null;               // program coords under the pointer → readout chip
    let start = null;                // operator start {x,y,z} → a DRAGGABLE handle (re-traces on release via opts.onStartDrag)
    let toolPos = null;              // LIVE tool/probe position from the sim (engine onPositionChange) → the moving head marker
    let drag = null, dragStart = false;
    const anim = { playing: false, k: 0, raf: null };

    const W = () => canvas.clientWidth, H = () => canvas.clientHeight;
    const tx = (x) => view.ox + x * view.scale;
    const ty = (y) => view.oy - y * view.scale;
    // The STOCK rides its "Sits at WCS" pin (table offset − workOrigin). The PATH has TWO frames, mirroring the 3D's
    // _anchorToStart (gcodeViz3d): an ANCHORED op (incremental/probe) EMANATES from the operator START marker (the
    // spindle pos) — the 3D's +starts[0] — while an ABSOLUTE/mill op rides the stock's WCS pin (#13). When anchored the
    // panel sets machine=null → the scene is LOCAL (pin=0) → the stock sits at part-zero and the start marker AT the path origin.
    const stockPin = () => {
        const s = stock;
        if (!s || !s.pin || s.pin === 'origin' || !(machine && machine.wcs && machine.wcs.table)) return { x: 0, y: 0 };
        const gi = parseInt(String(s.pin).replace(/[^0-9]/g, ''), 10) - 54;
        const t = machine.wcs.table[gi], wo = machine.workOrigin || {};
        return t ? { x: (Number(t.x) || 0) - (wo.x || 0), y: (Number(t.y) || 0) - (wo.y || 0) } : { x: 0, y: 0 };
    };
    // PATH transform: anchored → emanate from the operator start (spindle pos); else → the stock WCS pin (#13).
    const pathOff = () => (anchorToStart && start) ? { x: start.x, y: start.y } : stockPin();
    const ptx = (x) => tx(x + pathOff().x);
    const pty = (y) => ty(y + pathOff().y);
    // STOCK-PIN transform: the stock + the draggable start HANDLE ride the WCS pin. When anchored, machine=null →
    // pin=0, so the handle sits AT the start (= where the anchored path emanates); when absolute, both ride the pin (#13).
    const sptx = (x) => tx(x + stockPin().x);
    const spty = (y) => ty(y + stockPin().y);

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
        const { x: pinX, y: pinY } = stockPin();   // one source for the stock's WCS-pin offset (shared with the toolpath)
        return { minX: -Dx + pinX, maxX: s.x - Dx + pinX, minY: -Dy + pinY, maxY: s.y - Dy + pinY, shape: s.shape };
    }
    function sceneBounds() {
        let bb = null;
        const ext = (r) => { if (!r) return; bb = bb ? { minX: Math.min(bb.minX, r.minX), minY: Math.min(bb.minY, r.minY), maxX: Math.max(bb.maxX, r.maxX), maxY: Math.max(bb.maxY, r.maxY) } : { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY }; };
        ext(envelopeRect()); ext(stockRect());
        if (segs.length) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; segs.forEach((s) => { a = Math.min(a, s.x1, s.x2); c = Math.max(c, s.x1, s.x2); b = Math.min(b, s.y1, s.y2); d = Math.max(d, s.y1, s.y2); }); const p = pathOff(); ext({ minX: a + p.x, minY: b + p.y, maxX: c + p.x, maxY: d + p.y }); }
        if (!bb) bb = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        return { minX: Math.min(0, bb.minX), minY: Math.min(0, bb.minY), maxX: Math.max(0, bb.maxX), maxY: Math.max(0, bb.maxY) };   // always include the origin
    }
    const footprint = () => envelopeRect() || sceneBounds();
    const stepFor = (foot) => (gridStep > 0 ? gridStep : niceStep(Math.max(foot.maxX - foot.minX, foot.maxY - foot.minY)));

    // Snap the readout to GEOMETRY near the pointer. Two tiers, both within a screen-pixel radius: (1) discrete
    // POINTS — stock corners + centre, path nodes, the origin — preferred; (2) the nearest point ON AN EDGE —
    // stock edges or a path segment (perpendicular projection). Returns the snapped world point, or null (→ free).
    function snapPoint(px, py) {
        const TH2 = 11 * 11;
        const sr = stockRect();
        const p = pathOff();   // path nodes ride the same frame as the drawn toolpath (anchored→start, else→pin; stock corners use stockRect)
        // tier 1: discrete points
        let bestPt = null, bestPtD = TH2;
        const pt = (wx, wy) => { const dx = tx(wx) - px, dy = ty(wy) - py, d = dx * dx + dy * dy; if (d < bestPtD) { bestPtD = d; bestPt = { x: wx, y: wy }; } };
        pt(0, 0);
        if (sr) { pt(sr.minX, sr.minY); pt(sr.maxX, sr.minY); pt(sr.minX, sr.maxY); pt(sr.maxX, sr.maxY); pt((sr.minX + sr.maxX) / 2, (sr.minY + sr.maxY) / 2); }
        for (let i = 0; i < segs.length; i++) { const s = segs[i]; pt(s.x1 + p.x, s.y1 + p.y); pt(s.x2 + p.x, s.y2 + p.y); }
        if (bestPt) return bestPt;
        // tier 2: nearest point on an edge (clamped perpendicular projection, in screen space)
        let bestE = null, bestED = TH2;
        const edge = (ax, ay, bx, by) => {
            const asx = tx(ax), asy = ty(ay), dx = tx(bx) - asx, dy = ty(by) - asy, len2 = dx * dx + dy * dy;
            let t = len2 ? ((px - asx) * dx + (py - asy) * dy) / len2 : 0; t = Math.max(0, Math.min(1, t));
            const sx = asx + t * dx, sy = asy + t * dy, d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
            if (d < bestED) { bestED = d; bestE = { x: ax + t * (bx - ax), y: ay + t * (by - ay) }; }
        };
        if (sr) { edge(sr.minX, sr.minY, sr.maxX, sr.minY); edge(sr.maxX, sr.minY, sr.maxX, sr.maxY); edge(sr.maxX, sr.maxY, sr.minX, sr.maxY); edge(sr.minX, sr.maxY, sr.minX, sr.minY); }
        for (let i = 0; i < segs.length; i++) { const s = segs[i]; edge(s.x1 + p.x, s.y1 + p.y, s.x2 + p.x, s.y2 + p.y); }
        return bestE;
    }

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
        canvas.__t2cursor = cursor;   // debug + tests
        if (cursor) { if (cursor.snapped) drawSnap(ctx, cursor); drawReadout(ctx, cursor, w, h); }
    }
    function drawSnap(ctx, c) {   // snapped-to-geometry marker (cyan square) at the exact point
        const hx = tx(c.x), hy = ty(c.y);
        ctx.save(); ctx.strokeStyle = '#33d6ff'; ctx.lineWidth = 1.6; ctx.strokeRect(hx - 5, hy - 5, 10, 10); ctx.restore();
    }
    function drawStartHandle(ctx) {   // ruby start marker + grab-ring — the draggable operator start (matches the 3D ① marker)
        const hx = sptx(start.x), hy = spty(start.y);   // rides the stock pin (#13); when anchored (pin=0) it sits AT the start = the path origin
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
            ctx.beginPath(); ctx.moveTo(ptx(s.x1), pty(s.y1)); ctx.lineTo(ptx(s.x2), pty(s.y2)); ctx.stroke();
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
        // Head marker: ride the LIVE sim position (engine onPositionChange) when we have it, so the probe/tool travels
        // the path smoothly in sync with the 3D; else fall back to the current segment node. Both via ptx/pty (#13 pin).
        const head = segs[n - 1] || segs[0];
        const hx = toolPos ? ptx(toolPos.x) : ptx(n > 0 ? head.x2 : head.x1);
        const hy = toolPos ? pty(toolPos.y) : pty(n > 0 ? head.y2 : head.y1);
        ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
        canvas.__t2head = { sx: hx, sy: hy, live: !!toolPos };   // debug + tests: the drawn head (screen px)
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
    function setAnchor(v) { anchorToStart = !!v; if (view) paint(); }   // mirror the 3D's _anchorToStart: anchored → path emanates from the start, not the stock pin
    function setToolPosition(p) { toolPos = p ? { x: +p.x || 0, y: +p.y || 0 } : null; if (view && anim.playing) paint(); }   // live sim head (in sync with the 3D)
    function setGcode(text) { setSegments(traceToolpath(text).segments); }

    // ---- play / progress ----
    function stop() { if (anim.playing) { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = null; } toolPos = null; redraw(); }   // clear the live head when the sim stops
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
    const nearHandle = (e) => { if (!start || !view) return false; const r = canvas.getBoundingClientRect(); return Math.hypot(e.clientX - r.left - sptx(start.x), e.clientY - r.top - spty(start.y)) <= 12; };
    canvas.addEventListener('pointerdown', (e) => {
        if (!view) return;
        if (nearHandle(e)) { dragStart = true; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ } return; }   // grab the start handle (not a pan)
        drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!view) return;
        const r = canvas.getBoundingClientRect();
        if (dragStart) { const p = stockPin(); start = { x: (e.clientX - r.left - view.ox) / view.scale - p.x, y: (view.oy - (e.clientY - r.top)) / view.scale - p.y, z: start ? start.z : 0 }; paint(); return; }   // un-pin: the handle is drawn at +pin, so the program start = drawn − pin
        if (drag) { view.ox = drag.ox + (e.clientX - drag.x); view.oy = drag.oy + (e.clientY - drag.y); paint(); return; }
        const px = e.clientX - r.left, py = e.clientY - r.top, snap = snapPoint(px, py);
        cursor = snap ? { x: snap.x, y: snap.y, snapped: true } : { x: (px - view.ox) / view.scale, y: (view.oy - py) / view.scale, snapped: false };
        canvas.style.cursor = nearHandle(e) ? 'move' : (snap ? 'crosshair' : '');
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
        setGcode, setSegments, setMachine, setStock, setWcs, setGridStep, setStart, setAnchor, setToolPosition, redraw, fit, play, stop, toggle, seek,
        get playing() { return anim.playing; },
        get count() { return segs.length; },
    };
}
