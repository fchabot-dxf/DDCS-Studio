/**
 * viz/toolpath2d.js — the shared 2D toolpath preview (canvas). Used by every preview (Blocks, Studio main,
 * wizards) so they show the SAME 2D view alongside their 3D.
 *
 * The route comes from the EXECUTION ENGINE's trace (engine/trace.js): it resolves #vars, follows IF/GOTO
 * loops and auto-detects probes, so parametric/probe macros draw correctly (a regex parser couldn't resolve
 * `G0 Z#18`). Play shows progress as a TRAIL: the upcoming route is faint/thin, the executed part bold, with
 * a dot at the tool head — so you can read where you are in the program at a glance.
 *
 * Colours match the 3D legend (rapid=grey dashed, feed=cyan, probe=red).
 */
import { traceToolpath } from '../engine/trace.js';

const COL = { rapid: '#5a6b7d', feed: '#33b1c9', probe: '#e35c5c' };
const typeOf = (s) => (s.probe ? 'probe' : (s.rapid ? 'rapid' : (s.type || 'feed')));

/** Draw segments [from,to) in one style. style = { alpha, width } (rapids are always dashed). */
function strokeSegs(ctx, segs, from, to, tx, ty, style) {
    ctx.globalAlpha = style.alpha;
    for (let i = from; i < to; i++) {
        const s = segs[i], t = typeOf(s);
        ctx.strokeStyle = COL[t] || '#888';
        ctx.lineWidth = t === 'rapid' ? style.width * 0.6 : style.width;
        ctx.setLineDash(t === 'rapid' ? [4, 3] : []);
        ctx.beginPath(); ctx.moveTo(tx(s.x1), ty(s.y1)); ctx.lineTo(tx(s.x2), ty(s.y2)); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
}

/**
 * Draw the toolpath onto a canvas, auto-fit. `k` = trail head (count of executed segments):
 *   k == null  → the whole route at normal weight (idle / static view)
 *   k a number → upcoming route faint + executed [0,k) bold + a dot at the tool head (play / progress)
 */
export function drawToolpath2d(canvas, segs, k) {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!segs.length) return;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    segs.forEach((s) => { a = Math.min(a, s.x1, s.x2); c = Math.max(c, s.x1, s.x2); b = Math.min(b, s.y1, s.y2); d = Math.max(d, s.y1, s.y2); });
    const pad = 22, sc = Math.min((W - 2 * pad) / Math.max(1, c - a), (H - 2 * pad) / Math.max(1, d - b));
    const tx = (v) => pad + (v - a) * sc, ty = (v) => H - pad - (v - b) * sc;

    if (k == null) {                                   // idle: the full route, normal weight
        strokeSegs(ctx, segs, 0, segs.length, tx, ty, { alpha: 1, width: 2 });
        return;
    }
    const n = Math.max(0, Math.min(k, segs.length));
    strokeSegs(ctx, segs, n, segs.length, tx, ty, { alpha: 0.22, width: 1.5 });   // upcoming (faint, thin)
    strokeSegs(ctx, segs, 0, n, tx, ty, { alpha: 1, width: 2.6 });                // executed trail (bold)
    const head = segs[n - 1] || segs[0];                                          // tool head dot
    const hx = tx(n > 0 ? head.x2 : head.x1), hy = ty(n > 0 ? head.y2 : head.y1);
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
}

/**
 * Bind a canvas → a 2D toolpath controller.
 *   setGcode(text) — trace + (re)draw the route   · setSegments(segs) — use pre-traced segments (host shares one trace)
 *   redraw() — draw at the current trail position   · seek(k) — set the trail head (engine-driven progress)
 *   play()/stop()/toggle() — progress sweep over the resolved route (returns running state from toggle)
 */
export function createToolpath2d(canvas) {
    let segs = [];
    const anim = { playing: false, k: 0, raf: null };
    const draw = (k) => drawToolpath2d(canvas, segs, k);
    function redraw() { draw(anim.playing ? Math.floor(anim.k) : null); }
    function setSegments(next) { segs = next || []; redraw(); }
    function setGcode(text) { setSegments(traceToolpath(text).segments); }
    function stop() { if (anim.playing) { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = null; } redraw(); }
    function loop() {
        if (!anim.playing) return;
        anim.k += 1.2; if (anim.k >= segs.length) anim.k = 0;
        draw(Math.floor(anim.k));
        anim.raf = requestAnimationFrame(loop);
    }
    function play() { if (anim.playing || !segs.length) return; anim.playing = true; anim.k = 0; loop(); }
    function toggle() { if (anim.playing) { stop(); return false; } play(); return anim.playing; }
    /** Drive the trail head from outside (e.g. the execution engine's move progress): k = executed segments. */
    function seek(k) { anim.playing = true; anim.k = k; draw(Math.floor(k)); }
    return {
        setGcode, setSegments, redraw, draw, play, stop, toggle, seek,
        get playing() { return anim.playing; },
        get count() { return segs.length; },
    };
}
