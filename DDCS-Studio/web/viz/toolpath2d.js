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
import { passAnchorFor } from '../engine/passAnchor.js';   // t94/t107 — an AUTO reposition pass's ROUTE draws from the RUNTIME END of the previous pass (t107 machine-faithful, via passEnds), else the static previous START (t94), not its own net-endpoint marker
import { PATH_TYPES, PATH_STATE, HEAD, TOUCH_PULSE, pulsePx, feedRgb, hexCss } from './pathStyle.js';   // t317/t319 — the ONE declared path-visual palette (type × state) + the touch-pulse token, shared with the 3D + the legend

// Colours + progress states are the ONE declared source in viz/pathStyle.js (t317) — rapid=yellow(dashed),
// retract=green, probe=blue(slow=light blue, dotted), feed=a blue→teal gradient by DEPTH (Z) which also surfaces the
// Z you can't see top-down. The 3D + the legend read the SAME module. Exported for the one-source parity assertion.
const typeOf = (s) => s.type || (s.probe ? 'probe' : s.rapid ? 'rapid' : 'feed');
export function segColor(s, zMin, zRange, maxPF) {
    const t = typeOf(s);
    if (t === 'rapid') return hexCss(PATH_TYPES.rapid.color);
    if (t === 'retract') return hexCss(PATH_TYPES.retract.color);
    if (t === 'probe') return hexCss(((s.feed || 0) > 0 && (s.feed || 0) < maxPF) ? PATH_TYPES.probeSlow.color : PATH_TYPES.probeFast.color);
    return feedRgb(zRange ? (((s.z1 || 0) + (s.z2 || 0)) / 2 - zMin) / zRange : 0.5);
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
    const overlay = !!opts.overlay;  // t309 — OVERLAY MODE (the Layout animation layer): draw ONLY the path + red head dot; the host (featureCanvas SVG) owns grid/stock/handles + the view (via setViewTransform), so we never auto-fit or draw the scene chrome.
    let segs = [], machine = null, stock = null, wcs = null, gridStep = 0, anchorToStart = false;
    let view = null;                 // { ox, oy, scale }: screenX = ox + x*scale, screenY = oy - y*scale (Y up)
    let cursor = null;               // program coords under the pointer → readout chip
    let starts = [];                 // per-pass operator starts [{x,y,z}] → numbered DRAGGABLE handles (onStartDrag(pos, pass) on release)
    let startSources = [];           // per-pass reposition source ['auto'|'manual',…] → marker colour (auto=cyan, manual=amber)
    let startEmits = [];             // per-pass emitting flag [bool,…] → marker SHAPE (emitting=filled ◆, sim-only=hollow ◇) — orthogonal to the colour
    let passEnds = null;             // t107 — per-pass RUNTIME world-ENDs (from the trace): an anchorsAtPrev pass anchors its route at passEnds[p-1] (machine-faithful) + relocates its marker to end+cross; null → t94 static-start
    let toolPos = null;              // LIVE tool/probe position from the sim (engine onPositionChange) → the moving head marker
    let drag = null, dragStart = null;   // dragStart = the per-pass start INDEX being dragged (null = none)
    const anim = { playing: false, k: 0, raf: null };
    const pulses = [];          // t319/INC-6 — active on-touch pulses [{x,y,pass,axis,slow,prog,speed,flashes,last}]; drawn as the HONEST top-view projection (Z=circle, X/Y wall=line)
    let pulseRaf = null;
    const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

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
    // PATH transform: anchored → emanate from a pass's start marker (INC4: each REPOSITION pass rides its OWN start ②,
    // not always pass-0/①, so a boss-both 2nd-axis probe sits at ②); else → the stock WCS pin (#13). Single-pass /
    // no pass → pass 0, so existing single-pass behaviour is unchanged.
    const passOff = (pass) => {
        const i = (pass != null && pass >= 0 && pass < starts.length) ? pass : 0;
        const a = passAnchorFor(starts, passEnds, i);   // t94/t107 — auto reposition passes anchor at the previous pass's RUNTIME END (machine-faithful), else the static previous start (else self); the marker sprite relocates to end+cross via markerWorld
        return (anchorToStart && a) ? { x: a.x, y: a.y } : stockPin();
    };
    // t107 — where a marker HANDLE renders: a reposition-DESTINATION marker (anchorsAtPrev) sits where its dog-leg ENDS —
    // the previous pass's runtime END (passEnds) + the pass's reposition delta (its declared marker − the previous one =
    // the emitted #23/#24). Display-only VIEW of the declared `starts` (the drag still writes starts); no runtime end / not
    // flagged → the declared row. Matches the 3D's _markerWorld + the drawn route end + the probe fire (one source: passEnds).
    const markerWorld = (i) => {
        const row = starts[i]; if (!row) return { x: 0, y: 0 };
        const prev = starts[i - 1], end = passEnds && passEnds[i - 1];
        if (row.anchorsAtPrev && i > 0 && end && prev) return { x: end.x + (row.x - prev.x), y: end.y + (row.y - prev.y) };
        return row;
    };
    const pathOff = () => passOff(0);   // pass-0 default (where no per-segment pass applies)
    const ptx = (x, pass) => tx(x + passOff(pass).x);
    const pty = (y, pass) => ty(y + passOff(pass).y);
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
        if (segs.length) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; segs.forEach((s) => { const o = passOff(s.pass); a = Math.min(a, s.x1 + o.x, s.x2 + o.x); c = Math.max(c, s.x1 + o.x, s.x2 + o.x); b = Math.min(b, s.y1 + o.y, s.y2 + o.y); d = Math.max(d, s.y1 + o.y, s.y2 + o.y); }); ext({ minX: a, minY: b, maxX: c, maxY: d }); }
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
        const sr = stockRect();   // path nodes ride the same per-pass frame as the drawn toolpath (passOff(s.pass)); stock corners use stockRect
        // tier 1: discrete points
        let bestPt = null, bestPtD = TH2;
        const pt = (wx, wy) => { const dx = tx(wx) - px, dy = ty(wy) - py, d = dx * dx + dy * dy; if (d < bestPtD) { bestPtD = d; bestPt = { x: wx, y: wy }; } };
        pt(0, 0);
        if (sr) { pt(sr.minX, sr.minY); pt(sr.maxX, sr.minY); pt(sr.minX, sr.maxY); pt(sr.maxX, sr.maxY); pt((sr.minX + sr.maxX) / 2, (sr.minY + sr.maxY) / 2); }
        for (let i = 0; i < segs.length; i++) { const s = segs[i], o = passOff(s.pass); pt(s.x1 + o.x, s.y1 + o.y); pt(s.x2 + o.x, s.y2 + o.y); }
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
        for (let i = 0; i < segs.length; i++) { const s = segs[i], o = passOff(s.pass); edge(s.x1 + o.x, s.y1 + o.y, s.x2 + o.x, s.y2 + o.y); }
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
        if (overlay) { drawPath(ctx, anim.playing ? Math.floor(anim.k) : null); drawPulses(ctx); return; }   // t309/t319 — overlay = path + head + touch pulses; the SVG under-lays the grid/stock/handles
        const foot = footprint(), step = stepFor(foot);
        drawGrid(ctx, foot, step);
        const env = envelopeRect(); if (env) drawRect(ctx, env, 'rgba(108,122,140,0.55)', null);
        const st = stockRect();
        if (st) {
            const isPk = st.shape === 'pocket';
            drawRect(ctx, st, isPk ? 'rgba(134,182,255,0.65)' : 'rgba(166,215,124,0.65)', isPk ? 'rgba(106,143,190,0.10)' : 'rgba(143,174,106,0.10)');
            if (isPk) drawPocketCavity(ctx, st);   // #15: the inner cavity so a pocket READS as a pocket (mirrors the 3D square-donut)
        }
        drawOriginAxes(ctx, foot);
        drawPath(ctx, anim.playing ? Math.floor(anim.k) : null);
        drawPulses(ctx);   // t319 — the on-touch pulses over the path
        drawLabels(ctx, foot, step, w, h);
        if (starts.length) drawStartHandles(ctx);
        canvas.__t2starts = starts.map((s, i) => ({ i, sx: sptx(s.x), sy: spty(s.y), x: s.x, y: s.y, source: startSources[i] || 'auto', emits: !!startEmits[i] }));   // debug + tests: the drawn per-pass start handles + colour source + SHAPE (emits)
        canvas.__t2cursor = cursor;   // debug + tests
        if (cursor) { if (cursor.snapped) drawSnap(ctx, cursor); drawReadout(ctx, cursor, w, h); }
    }
    function drawSnap(ctx, c) {   // snapped-to-geometry marker (cyan square) at the exact point
        const hx = tx(c.x), hy = ty(c.y);
        ctx.save(); ctx.strokeStyle = '#33d6ff'; ctx.lineWidth = 1.6; ctx.strokeRect(hx - 5, hy - 5, 10, 10); ctx.restore();
    }
    // Each per-pass operator start + a grab-ring + a NUMBERED badge (①②…), parity with the 3D markers. Coloured by reposition
    // SOURCE (auto=cyan, manual=amber). SHAPE by emits (orthogonal): SIM-ONLY / manual-jog = a hollow CIRCLE ○; EMITTING (a drag
    // writes a macro var) = a FILLED diamond ◆. All draggable (distinct from the RED moving head). Multi-pass → one per pass.
    function drawStartHandles(ctx) {
        for (let i = 0; i < starts.length; i++) {
            const s = markerWorld(i), hx = sptx(s.x), hy = spty(s.y);               // t107 — relocate a reposition-destination marker to its runtime dog-leg END (matches the route + probe fire)
            // t293 — ONE glyph language (matches the Layout + 3D): AUTO reposition (machine drives there) = a filled CYAN
            // SQUARE ■; MANUAL jog / the operator Start = a filled AMBER CIRCLE ●. Shape + colour agree. Pass-0 is ALWAYS the
            // operator's first jog (the Start) → manual; every later pass follows its reposition SOURCE (auto vs manual travel).
            const manual = i === 0 || startSources[i] === 'manual';
            const col = manual ? '#ffb300' : '#22d3ee';
            const ringCol = manual ? 'rgba(255,179,0,0.45)' : 'rgba(34,211,238,0.45)';
            ctx.save();
            ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.8; ctx.lineJoin = 'round';   // a static reference, NOT red (probe) or orange (tool)
            if (manual) { ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); ctx.fill(); }   // MANUAL / Start = filled AMBER CIRCLE ●
            else { ctx.fillRect(hx - 6, hy - 6, 12, 12); }                           // AUTO = filled CYAN SQUARE ■
            ctx.lineWidth = 1.4; ctx.strokeStyle = ringCol; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.stroke();   // grab-ring (nearHandle's 12px hit-test)
            ctx.restore();   // no numbered badge — the top panel carries glyph + colour only; the named label lives on the Layout canvas
        }
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
    // #15: a POCKET reads as a FRAME of material around a CAVITY. Mirror the 3D "square donut" (gcodeViz3d): inset the
    // cavity by the SAME wall thickness — max(8, 25% of the smaller side) — and darken it (a recess) with a wall outline.
    function drawPocketCavity(ctx, st) {
        const w = Math.max(8, Math.min(st.maxX - st.minX, st.maxY - st.minY) * 0.25);
        const c = { minX: st.minX + w, minY: st.minY + w, maxX: st.maxX - w, maxY: st.maxY - w };
        if (!(c.maxX > c.minX && c.maxY > c.minY)) return;   // wall too thick for the stock → no cavity
        drawRect(ctx, c, 'rgba(134,182,255,0.85)', 'rgba(10,14,22,0.45)');   // recessed (darker) cavity + a bright inner wall
    }
    function drawOriginAxes(ctx, foot) {   // X axis (red) at y=0, Y axis (green) at x=0 — matches the 3D colours
        ctx.save(); ctx.lineWidth = 1.4;
        if (foot.minY <= 0 && foot.maxY >= 0) { ctx.strokeStyle = 'rgba(255,107,107,0.6)'; ctx.beginPath(); ctx.moveTo(tx(foot.minX), ty(0)); ctx.lineTo(tx(foot.maxX), ty(0)); ctx.stroke(); }
        if (foot.minX <= 0 && foot.maxX >= 0) { ctx.strokeStyle = 'rgba(95,211,95,0.6)'; ctx.beginPath(); ctx.moveTo(tx(0), ty(foot.minY)); ctx.lineTo(tx(0), ty(foot.maxY)); ctx.stroke(); }
        ctx.restore();
    }
    function strokeSegs(ctx, from, to, alpha, width, zMin, zRange, maxPF) {
        ctx.globalAlpha = alpha;
        const isSlowProbe = (s) => (s.type === 'probe' || s.probe) && (s.feed || 0) > 0 && (s.feed || 0) < maxPF;   // t319 — the WHITE slow re-probe
        const drawSeg = (s) => {
            const t = typeOf(s);
            // a 2-axis RAPID is a trans-axis TRAVERSE/reposition vector → colour it by its pass SOURCE (auto=cyan,
            // manual=amber). Single-axis rapids + probe/feed keep their TYPE colours.
            const transV = t === 'rapid' && Math.abs((s.x2 || 0) - (s.x1 || 0)) > 0.05 && Math.abs((s.y2 || 0) - (s.y1 || 0)) > 0.05;
            const manualTrav = transV && startSources[s.pass] === 'manual';   // a MANUAL jog travel arcs UP ('rainbow'); AUTO stays straight
            ctx.strokeStyle = transV ? (startSources[s.pass] === 'manual' ? hexCss(PATH_TYPES.jog.color) : '#22d3ee') : segColor(s, zMin, zRange, maxPF);   // t317 — the MANUAL jog LINE = the one amber; the AUTO traverse keeps the marker-cyan (a separate glyph layer)
            ctx.lineWidth = t === 'rapid' ? width * 0.6 : width;
            ctx.setLineDash(t === 'probe' ? [2, 3] : (t === 'rapid' ? [5, 4] : []));   // probe dotted, rapid dashed (match 3D)
            const ax = ptx(s.x1, s.pass), ay = pty(s.y1, s.pass), bx = ptx(s.x2, s.pass), by = pty(s.y2, s.pass);   // each pass rides its own start (INC4)
            ctx.beginPath(); ctx.moveTo(ax, ay);
            if (manualTrav) {   // a pronounced UPWARD 'rainbow' arc — a quadratic through a control point above the midpoint (screen-up = smaller y)
                const mx = (ax + bx) / 2, my = (ay + by) / 2, arc = Math.max(14, Math.hypot(bx - ax, by - ay) * 0.45);
                ctx.quadraticCurveTo(mx, my - arc, bx, by);
            } else { ctx.lineTo(bx, by); }
            ctx.stroke();
        };
        // t319 — TWO passes so the WHITE slow probe draws LAST and wins the collinear overlap with the fast blue re-probe.
        // Non-overlapping segments are order-independent → byte-neutral for every non-probe type.
        for (let i = from; i < to; i++) { const s = segs[i]; if (!isSlowProbe(s)) drawSeg(s); }
        for (let i = from; i < to; i++) { const s = segs[i]; if (isSlowProbe(s)) drawSeg(s); }
        ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
    function drawPath(ctx, k) {
        if (!segs.length) return;
        let zMin = Infinity, zMax = -Infinity, maxPF = 0;   // feed depth-gradient range + the fast-probe feed threshold
        for (const s of segs) { zMin = Math.min(zMin, s.z1, s.z2); zMax = Math.max(zMax, s.z1, s.z2); if ((s.type === 'probe' || s.probe) && (s.feed || 0) > maxPF) maxPF = s.feed; }
        const zR = (zMax - zMin) || 1;
        if (k == null) { strokeSegs(ctx, 0, segs.length, PATH_STATE.static.alpha, PATH_STATE.static.width, zMin, zR, maxPF); return; }   // t317 — STATE tokens from the ONE palette (static/future/traveled), shared with the 3D dim + the human's coming mods
        const n = Math.max(0, Math.min(k, segs.length));
        strokeSegs(ctx, n, segs.length, PATH_STATE.future.alpha, PATH_STATE.future.width, zMin, zR, maxPF);   // t313/t317 — future/untraveled (alpha 0.8, still dimmer than traveled) from the ONE palette
        strokeSegs(ctx, 0, n, PATH_STATE.traveled.alpha, PATH_STATE.traveled.width, zMin, zR, maxPF);   // t313/t317 — traveled (alpha 1, width 3.12) from the ONE palette
        // Head marker: ride the LIVE sim position (engine onPositionChange) when we have it, so the probe/tool travels
        // the path smoothly in sync with the 3D; else fall back to the current segment node. Both via ptx/pty (#13 pin).
        const head = segs[n - 1] || segs[0];
        const hp = toolPos ? toolPos.pass : (head && head.pass);   // INC4: the live tool rides its CURRENT pass's start ②
        const hx = toolPos ? ptx(toolPos.x, hp) : ptx(n > 0 ? head.x2 : head.x1, hp);
        const hy = toolPos ? pty(toolPos.y, hp) : pty(n > 0 ? head.y2 : head.y1, hp);
        ctx.fillStyle = hexCss(HEAD.color); ctx.beginPath(); ctx.arc(hx, hy, HEAD.r, 0, Math.PI * 2); ctx.fill();   // t317 — RED moving probe tip (the ruby, matching the 3D) from the ONE palette
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
    // t309 — pin the world→screen transform EXTERNALLY (the Layout overlay sets it from featureCanvas._tf so the path
    // registers pixel-exact under the SVG handles). ox/oy/scale map exactly: sx = ox + x*scale, sy = oy - y*scale.
    function setViewTransform(v) { if (!v) return; view = { ox: +v.ox || 0, oy: +v.oy || 0, scale: +v.scale || 1 }; paint(); }
    function fit() {
        if (overlay) { if (view) paint(); return; }   // t309 — the overlay never auto-fits; the host owns the view (setViewTransform)
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
    function setStarts(arr) { starts = Array.isArray(arr) ? arr.filter(Boolean).map((p) => ({ x: +p.x || 0, y: +p.y || 0, z: +p.z || 0, anchorsAtPrev: !!p.anchorsAtPrev })) : []; if (view) paint(); }   // per-pass operator starts (①②…); t94 keep anchorsAtPrev so passOff resolves the route draw-anchor
    function setStart(p) { setStarts(p ? [p] : []); }   // back-compat: a single operator start = pass 0
    function setStartSources(arr) { startSources = Array.isArray(arr) ? arr.slice() : []; if (view) paint(); }   // per-pass marker colour (auto=cyan, manual=amber)
    function setStartEmits(arr) { startEmits = Array.isArray(arr) ? arr.slice() : []; if (view) paint(); }   // per-pass marker SHAPE: emitting (a drag edits the program) = filled ◆, sim-only = hollow ◇
    function setPassEnds(arr) { passEnds = Array.isArray(arr) ? arr : null; if (view) paint(); }   // t107 — per-pass RUNTIME world-ENDs (from the trace): an anchorsAtPrev pass anchors its route at passEnds[p-1] + relocates its marker to end+cross
    function setAnchor(v) { anchorToStart = !!v; if (view) paint(); }   // mirror the 3D's _anchorToStart: anchored → path emanates from the start, not the stock pin
    function setToolPosition(p) { toolPos = p ? { x: +p.x || 0, y: +p.y || 0, pass: p.pass } : null; if (view && anim.playing) paint(); }   // live sim head (in sync with the 3D); pass → per-pass anchor (INC4)
    function setGcode(text) { setSegments(traceToolpath(text).segments); }

    // ---- play / progress ----
    function stop() { if (anim.playing) { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = null; } toolPos = null; redraw(); }   // clear the live head when the sim stops
    function loop() { if (!anim.playing) return; anim.k += 1.2; if (anim.k >= segs.length) anim.k = 0; paint(); anim.raf = requestAnimationFrame(loop); }
    function play() { if (anim.playing || !segs.length) return; anim.playing = true; anim.k = 0; loop(); }
    function toggle() { if (anim.playing) { stop(); return false; } play(); return anim.playing; }
    function seek(k) { anim.playing = true; anim.k = k; if (view) paint(); else fit(); }

    // ---- on-touch PULSE (t319/INC-6) — a transient white flash at each G31 contact, in lockstep with the red head ----
    // The HONEST TOP-VIEW PROJECTION by axis: a Z/surface touch is a CIRCLE (the disc face-on); an X/Y WALL touch is a
    // LINE along the wall tangent (the disc edge-on). SLOW = BIGGER (fine re-probe). Fades over TOUCH_PULSE.fadeMs of SIM
    // time (speed-scaled) — SAME both previews. Positioned via ptx/pty (the SAME per-pass anchored frame as the head).
    function pulse(ev) {
        if (!ev || !ev.pos) return;
        pulses.push({ x: +ev.pos.x || 0, y: +ev.pos.y || 0, pass: ev.pass, axis: String(ev.axis || 'z').toLowerCase(), slow: !!ev.slow, speed: +ev.speed || 1, flashes: ev.slow ? 4 : 3, prog: 0, last: nowMs() });
        if (!pulseRaf) pulseLoop();
    }
    function pulseLoop() {
        const t = nowMs();
        for (const p of pulses) { const dt = t - p.last; p.last = t; p.prog = Math.min(1, p.prog + (dt * (p.speed || 1)) / (TOUCH_PULSE.fadeMs || 16000)); }
        for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].prog >= 1) pulses.splice(i, 1);
        if (view) paint();
        pulseRaf = pulses.length ? requestAnimationFrame(pulseLoop) : null;
    }
    function drawPulses(ctx) {
        if (!pulses.length || !view) return;
        const col = hexCss(TOUCH_PULSE.color);
        for (const p of pulses) {
            const u = p.prog, flash = Math.abs(Math.sin(u * p.flashes * Math.PI)), fade = u < 0.75 ? 1 : Math.max(0, 1 - (u - 0.75) / 0.25);
            const a = TOUCH_PULSE.alpha * flash * fade; if (a <= 0.002) continue;
            const cx = ptx(p.x, p.pass), cy = pty(p.y, p.pass), r = pulsePx(p.slow);
            ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.beginPath();
            if (p.axis === 'z') ctx.arc(cx, cy, r, 0, Math.PI * 2);                    // Z/surface → CIRCLE (Ø = the disc face-on)
            else if (p.axis === 'x') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); }  // X wall (probe in X, wall runs along Y) → a VERTICAL tangent LINE
            else { ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); }                    // Y wall → a HORIZONTAL tangent LINE
            ctx.stroke(); ctx.restore();
        }
    }
    canvas.__t2pulses = pulses;   // debug + tests: the active pulse list

    // ---- interaction: wheel zoom (about cursor) + drag pan + hover readout (pointer events → touch too) ----
    canvas.addEventListener('wheel', (e) => {
        if (!view) return; e.preventDefault();
        const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
        const wx = (sx - view.ox) / view.scale, wy = (view.oy - sy) / view.scale;
        const ns = Math.max(0.02, Math.min(400, view.scale * Math.exp(-e.deltaY * 0.0015)));
        view.scale = ns; view.ox = sx - wx * ns; view.oy = sy + wy * ns; paint();
    }, { passive: false });
    const nearHandle = (e) => {   // → the per-pass start INDEX under the pointer (within 12px), or -1
        if (!starts.length || !view) return -1;
        const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        for (let i = starts.length - 1; i >= 0; i--) { const w = markerWorld(i); if (Math.hypot(px - sptx(w.x), py - spty(w.y)) <= 12) return i; }   // t107 — hit-test the DISPLAYED (relocated) marker; reverse → topmost/highest pass wins on overlap
        return -1;
    };
    canvas.addEventListener('pointerdown', (e) => {
        if (!view) return;
        const hi = nearHandle(e); if (hi >= 0) { dragStart = hi; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ } return; }   // grab a start handle (not a pan)
        drag = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!view) return;
        const r = canvas.getBoundingClientRect();
        if (dragStart != null) { const p = stockPin(), cur = starts[dragStart], d = markerWorld(dragStart), drift = { x: d.x - (cur ? cur.x : 0), y: d.y - (cur ? cur.y : 0) }; starts[dragStart] = { x: (e.clientX - r.left - view.ox) / view.scale - p.x - drift.x, y: (view.oy - (e.clientY - r.top)) / view.scale - p.y - drift.y, z: cur ? cur.z : 0, anchorsAtPrev: cur ? cur.anchorsAtPrev : false }; paint(); return; }   // un-pin: handle drawn at +pin → program start = drawn − pin; t94 keep anchorsAtPrev; t107 subtract the passEnds relocation drift so the DISPLAYED (relocated) marker follows the cursor (pass-0 sim-only = drift 0, unchanged)
        if (drag) { view.ox = drag.ox + (e.clientX - drag.x); view.oy = drag.oy + (e.clientY - drag.y); paint(); return; }
        const px = e.clientX - r.left, py = e.clientY - r.top, snap = snapPoint(px, py);
        cursor = snap ? { x: snap.x, y: snap.y, snapped: true } : { x: (px - view.ox) / view.scale, y: (view.oy - py) / view.scale, snapped: false };
        canvas.style.cursor = nearHandle(e) >= 0 ? 'move' : (snap ? 'crosshair' : '');
        if (!anim.playing) paint();
    });
    const endDrag = (e) => {
        if (dragStart != null && starts[dragStart] && opts.onStartDrag) { const s = starts[dragStart]; opts.onStartDrag({ x: s.x, y: s.y, z: s.z }, dragStart); }   // re-trace once on release (not per move), with the dragged pass index
        dragStart = null; drag = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* */ }
    };
    canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('mouseleave', () => { cursor = null; if (!anim.playing) paint(); });

    return {
        setGcode, setSegments, setMachine, setStock, setWcs, setGridStep, setStart, setStarts, setStartSources, setStartEmits, setPassEnds, setAnchor, setToolPosition, setViewTransform, pulse, redraw, fit, play, stop, toggle, seek,
        get playing() { return anim.playing; },
        get count() { return segs.length; },
    };
}
