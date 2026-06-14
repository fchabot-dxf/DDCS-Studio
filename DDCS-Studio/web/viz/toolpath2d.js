/**
 * viz/toolpath2d.js — the shared 2D toolpath preview (canvas). Extracted from the Blocks tab so every
 * preview (Blocks, Studio main, wizards) shows the SAME 2D view + progressive-reveal Play, alongside its 3D.
 *
 * Pure-ish: it only needs a <canvas>. Colours/typing match the 3D legend (rapid=grey dashed, feed/arc=cyan,
 * probe=red). `createToolpath2d(canvas)` returns a small controller: setGcode / redraw / play / stop / toggle.
 */

/** Parse G-code text → flat 2D segments [{type, x1,y1,x2,y2}] (type ∈ rapid|feed|probe). */
export function gcodeToSegments(text) {
  const segs = []; let x = 0, y = 0;
  String(text || '').split('\n').forEach((raw) => {
    const s = raw.replace(/\(.*?\)/g, '').trim(); if (!s) return;
    const mx = s.match(/X(-?[\d.]+)/), my = s.match(/Y(-?[\d.]+)/);
    let type = null;
    if (/^G31\b/.test(s)) type = 'probe';
    else if (/^G0\b/.test(s)) type = 'rapid';
    else if (/^G1\b/.test(s)) type = 'feed';
    else if (/^G[23]\b/.test(s)) type = 'feed';
    if (type && (mx || my)) { const nx = mx ? parseFloat(mx[1]) : x, ny = my ? parseFloat(my[1]) : y; segs.push({ type, x1: x, y1: y, x2: nx, y2: ny }); x = nx; y = ny; }
    else if (mx || my) { if (mx) x = parseFloat(mx[1]); if (my) y = parseFloat(my[1]); }
  });
  return segs;
}

/** Draw segments onto a canvas, auto-fit; `k` = number of segments to draw (null = all, for progressive Play). */
export function drawToolpath2d(canvas, segs, k) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  if (!segs.length) return;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  segs.forEach((s) => { a = Math.min(a, s.x1, s.x2); c = Math.max(c, s.x1, s.x2); b = Math.min(b, s.y1, s.y2); d = Math.max(d, s.y1, s.y2); });
  const pad = 22, sc = Math.min((W - 2 * pad) / Math.max(1, c - a), (H - 2 * pad) / Math.max(1, d - b));
  const tx = (v) => pad + (v - a) * sc, ty = (v) => H - pad - (v - b) * sc;
  const col = { rapid: '#5a6b7d', feed: '#33b1c9', probe: '#e35c5c' };
  const n = (k == null) ? segs.length : Math.max(0, Math.min(k, segs.length));
  segs.slice(0, n).forEach((s) => {
    ctx.strokeStyle = col[s.type] || '#888'; ctx.lineWidth = s.type === 'rapid' ? 1 : 2;
    ctx.setLineDash(s.type === 'rapid' ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(tx(s.x1), ty(s.y1)); ctx.lineTo(tx(s.x2), ty(s.y2)); ctx.stroke();
  });
  ctx.setLineDash([]);
}

/**
 * Bind a canvas → a 2D toolpath controller.
 *   setGcode(text) — parse + (re)draw   · redraw() — draw at the current Play position
 *   play()/stop()/toggle() — progressive-reveal animation (returns running state from toggle)
 *   playing, count — state
 */
export function createToolpath2d(canvas) {
  let segs = [];
  const anim = { playing: false, k: 0, raf: null };
  const draw = (k) => drawToolpath2d(canvas, segs, k);
  function redraw() { draw(anim.playing ? Math.floor(anim.k) : null); }
  function setGcode(text) { segs = gcodeToSegments(text); redraw(); }
  function stop() { if (anim.playing) { anim.playing = false; if (anim.raf) cancelAnimationFrame(anim.raf); anim.raf = null; } }
  function loop() {
    if (!anim.playing) return;
    anim.k += 1.2; if (anim.k >= segs.length) anim.k = 0;
    draw(Math.floor(anim.k));
    anim.raf = requestAnimationFrame(loop);
  }
  function play() { if (anim.playing || !segs.length) return; anim.playing = true; anim.k = 0; loop(); }
  function toggle() { if (anim.playing) { stop(); draw(null); return false; } play(); return anim.playing; }
  return {
    setGcode, redraw, draw, play, stop, toggle,
    get playing() { return anim.playing; },
    get count() { return segs.length; },
  };
}
