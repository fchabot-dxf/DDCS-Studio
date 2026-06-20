var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../DDCS-Studio/web/wizards/ops/util.js
function num(v6, d) {
  return v6 === "" || v6 == null || isNaN(Number(v6)) ? d : Number(v6);
}
function val(v6, d = 0, off = 0) {
  if (typeof v6 === "string" && /[#[]/.test(v6)) return v6.trim();
  return r3(num(v6, d) + off);
}
var r3;
var init_util = __esm({
  "../DDCS-Studio/web/wizards/ops/util.js"() {
    r3 = (n) => Math.round(n * 1e3) / 1e3;
  }
});

// ../DDCS-Studio/web/wizards/ops/drill.js
function peckDrill(pt, p) {
  const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
  const q = Math.max(0.1, num(p.peck, depth));
  const reentry = 0.5;
  const L2 = [`G0 X${pt.x} Y${pt.y}`];
  let prev = 0, d = 0;
  while (d < depth - 1e-6) {
    d = Math.min(d + q, depth);
    if (prev > 0) L2.push(`G0 Z${r3(-(prev - reentry))}`);
    L2.push(`G1 Z${r3(-d)} F${feed}`);
    L2.push(`G0 Z${clr}`);
    prev = d;
  }
  return L2;
}
var drillBlock;
var init_drill = __esm({
  "../DDCS-Studio/web/wizards/ops/drill.js"() {
    init_util();
    drillBlock = {
      type: "drill",
      label: "Drill",
      kind: "leaf",
      category: "Ops",
      defaults: { x: 0, y: 0, depth: 5, peck: 5, feed: 100, clearance: 5 },
      fields: ["x", "y", "depth", "peck", "feed", "clearance"],
      emit: (p, dx = 0, dy = 0) => peckDrill({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p)
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/bore.js
function helicalBore(pt, p) {
  const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
  const r = (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2, pitch = Math.max(0.05, num(p.pitch, 0.5));
  const cx = pt.x, cy = pt.y;
  if (r <= 0.01) return [`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `G1 Z${r3(-depth)} F${feed}`, `G0 Z${clr}`];
  const L2 = [`G0 X${r3(cx + r)} Y${cy}   ( bore radius )`, `G0 Z${clr}`];
  const arc = `G3 X${r3(cx + r)} Y${cy} I${r3(-r)} J0`;
  let z = 0;
  while (z < depth - 1e-6) {
    z = Math.min(z + pitch, depth);
    L2.push(`G1 Z${r3(-z)} F${feed}`, `${arc} F${feed}   ( full circle )`);
  }
  L2.push(`${arc}   ( finish pass )`, `G0 Z${clr}`);
  return L2;
}
var boreBlock;
var init_bore = __esm({
  "../DDCS-Studio/web/wizards/ops/bore.js"() {
    init_util();
    boreBlock = {
      type: "bore",
      label: "Bore",
      kind: "leaf",
      category: "Ops",
      defaults: { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, feed: 120, clearance: 5 },
      fields: ["x", "y", "holeDia", "toolDia", "depth", "pitch", "feed", "clearance"],
      emit: (p, dx = 0, dy = 0) => helicalBore({ x: r3(num(p.x, 0) + dx), y: r3(num(p.y, 0) + dy) }, p)
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/line.js
function lineCut(p) {
  const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 50), y1 = num(p.y1, 0);
  const clr = num(p.clearance, 5), depth = num(p.depth, 3), feed = num(p.feed, 200);
  const step = Math.max(0.05, num(p.stepdown, depth));
  const ends = [[r3(x0), r3(y0)], [r3(x1), r3(y1)]];
  const L2 = [`G0 X${ends[0][0]} Y${ends[0][1]}   ( line start )`, `G0 Z${clr}`];
  let z = 0, cur = 0;
  while (z < depth - 1e-6) {
    z = Math.min(z + step, depth);
    L2.push(`G1 Z${r3(-z)} F${feed}   ( step down )`);
    cur = 1 - cur;
    L2.push(`G1 X${ends[cur][0]} Y${ends[cur][1]} F${feed}`);
  }
  L2.push(`G0 Z${clr}   ( retract )`);
  return L2;
}
var lineBlock;
var init_line = __esm({
  "../DDCS-Studio/web/wizards/ops/line.js"() {
    init_util();
    lineBlock = {
      type: "line",
      label: "Line",
      kind: "leaf",
      category: "Ops",
      defaults: { x0: 0, y0: 0, x1: 50, y1: 0, depth: 3, stepdown: 1, feed: 200, clearance: 5 },
      fields: ["x0", "y0", "x1", "y1", "depth", "stepdown", "feed", "clearance"],
      emit: (p, dx = 0, dy = 0) => lineCut({
        ...p,
        x0: num(p.x0, 0) + dx,
        y0: num(p.y0, 0) + dy,
        x1: num(p.x1, 50) + dx,
        y1: num(p.y1, 0) + dy
      })
    };
  }
});

// ../DDCS-Studio/web/wizards/clearing.js
function rectContour(x0, y0, x1, y1) {
  return [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]];
}
function circleContour(cx, cy, r, seg = 96) {
  const c2 = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg;
    c2.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return [c2];
}
function polygonContour(cx, cy, r, sides = 6) {
  const n = Math.max(3, Math.round(sides)), c2 = [], off = -Math.PI / 2 + Math.PI / n;
  for (let i = 0; i < n; i++) {
    const a = off + 2 * Math.PI * i / n;
    c2.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return [c2];
}
function ellipseContour(cx, cy, rx, ry, seg = 96) {
  const c2 = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg;
    c2.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return [c2];
}
function scanlineFill(contours, yStep) {
  let ymin = Infinity, ymax = -Infinity;
  for (const c2 of contours) for (const p of c2) {
    if (p.y < ymin) ymin = p.y;
    if (p.y > ymax) ymax = p.y;
  }
  if (!isFinite(ymin) || ymax - ymin < 1e-6 || !(yStep > 0)) return [];
  const rows = [];
  for (let y = ymin + yStep * 0.5; y < ymax; y += yStep) {
    const xs = [];
    for (const c2 of contours) {
      const n = c2.length;
      for (let i = 0; i < n; i++) {
        const a = c2[i], b2 = c2[(i + 1) % n];
        if (a.y <= y && b2.y > y || b2.y <= y && a.y > y) {
          xs.push({ x: a.x + (y - a.y) / (b2.y - a.y) * (b2.x - a.x), w: b2.y > a.y ? 1 : -1 });
        }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p.x - q.x);
    const spans = [];
    let wind = 0, start = 0;
    for (const c2 of xs) {
      const prev = wind;
      wind += c2.w;
      if (prev === 0 && wind !== 0) start = c2.x;
      else if (prev !== 0 && wind === 0 && c2.x - start > 1e-4) spans.push([start, c2.x]);
    }
    if (spans.length) rows.push({ y, spans });
  }
  return rows;
}
function fillLevelMoves(rows, ctx2) {
  const { z, clr, feed, plunge } = ctx2;
  const L2 = [];
  let dir = 1, started = false, liftNext = false;
  for (let ri = 0; ri < rows.length; ri++) {
    const ordered = dir > 0 ? rows[ri].spans : rows[ri].spans.slice().reverse();
    const y = rows[ri].y;
    for (let si = 0; si < ordered.length; si++) {
      const [xlo, xhi] = ordered[si];
      const xs = dir > 0 ? xlo : xhi, xe = dir > 0 ? xhi : xlo;
      if (!started) {
        L2.push(`G0 X${r32(xs)} Y${r32(y)}`, `G1 Z${r32(z)} F${plunge}`);
        started = true;
      } else if (si > 0 || liftNext) {
        L2.push(`G0 Z${r32(clr)}`, `G0 X${r32(xs)} Y${r32(y)}`, `G1 Z${r32(z)} F${plunge}`);
      } else {
        L2.push(`G1 X${r32(xs)} Y${r32(y)} F${feed}`);
      }
      L2.push(`G1 X${r32(xe)} Y${r32(y)} F${feed}`);
      liftNext = false;
    }
    liftNext = ordered.length > 1;
    dir = -dir;
  }
  return L2;
}
function contourLevel(contours, ctx2) {
  const { z, clr, feed, plunge } = ctx2;
  const L2 = [];
  for (const c2 of contours) {
    if (c2.length < 2) continue;
    L2.push(`G0 Z${r32(clr)}`, `G0 X${r32(c2[0].x)} Y${r32(c2[0].y)}`, `G1 Z${r32(z)} F${plunge}`);
    for (let i = 1; i < c2.length; i++) L2.push(`G1 X${r32(c2[i].x)} Y${r32(c2[i].y)} F${feed}`);
    L2.push(`G1 X${r32(c2[0].x)} Y${r32(c2[0].y)} F${feed}`);
  }
  return L2;
}
function concentricRect(x0, y0, x1, y1, step, ctx2) {
  const { z, clr, feed, plunge } = ctx2;
  const L2 = [];
  let inset = 0, first = true;
  for (; ; ) {
    const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
    if (bx - ax < 1e-6 || by - ay < 1e-6) break;
    if (first) {
      L2.push(`G0 X${r32(ax)} Y${r32(ay)}`, `G1 Z${r32(z)} F${plunge}`);
      first = false;
    } else L2.push(`G1 X${r32(ax)} Y${r32(ay)} F${feed}`);
    L2.push(
      `G1 X${r32(bx)} Y${r32(ay)} F${feed}`,
      `G1 X${r32(bx)} Y${r32(by)} F${feed}`,
      `G1 X${r32(ax)} Y${r32(by)} F${feed}`,
      `G1 X${r32(ax)} Y${r32(ay)} F${feed}`
    );
    inset += step;
  }
  void clr;
  return L2;
}
function concentricCircle(cx, cy, Rc, step, ctx2) {
  const { z, clr, feed, plunge } = ctx2;
  const L2 = [];
  let rad = Rc, first = true;
  while (rad > 1e-6) {
    const sx = cx + rad, sy = cy;
    if (first) {
      L2.push(`G0 X${r32(sx)} Y${r32(sy)}`, `G1 Z${r32(z)} F${plunge}`);
      first = false;
    } else L2.push(`G1 X${r32(sx)} Y${r32(sy)} F${feed}`);
    L2.push(`G3 X${r32(sx)} Y${r32(sy)} I${r32(-rad)} J0 F${feed}`);
    rad -= step;
  }
  if (!first) L2.push(`G1 X${r32(cx)} Y${r32(cy)} F${feed}`);
  void clr;
  return L2;
}
function zigzagFill(contours, step, ctx2, opts = {}) {
  const { z, clr, feed, plunge } = ctx2;
  const ang = (opts.angleDeg || 0) * Math.PI / 180, oneway = !!opts.oneway, reverse = !!opts.reverse;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const toScan = (p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });
  const toWorld = (x, y) => ({ x: x * cos - y * sin, y: x * sin + y * cos });
  const rows = scanlineFill(contours.map((c2) => c2.map(toScan)), step);
  const L2 = [];
  const G0 = (x, y) => {
    const w2 = toWorld(x, y);
    return `G0 X${r32(w2.x)} Y${r32(w2.y)}`;
  };
  const G1 = (x, y) => {
    const w2 = toWorld(x, y);
    return `G1 X${r32(w2.x)} Y${r32(w2.y)} F${feed}`;
  };
  let dir = reverse ? -1 : 1, started = false, liftNext = false;
  for (let ri = 0; ri < rows.length; ri++) {
    const ordered = dir > 0 ? rows[ri].spans : rows[ri].spans.slice().reverse();
    const y = rows[ri].y;
    for (let si = 0; si < ordered.length; si++) {
      const [xlo, xhi] = ordered[si];
      const xs = dir > 0 ? xlo : xhi, xe = dir > 0 ? xhi : xlo;
      if (!started) {
        L2.push(G0(xs, y), `G1 Z${r32(z)} F${plunge}`);
        started = true;
      } else if (oneway || si > 0 || liftNext) {
        L2.push(`G0 Z${r32(clr)}`, G0(xs, y), `G1 Z${r32(z)} F${plunge}`);
      } else {
        L2.push(G1(xs, y));
      }
      L2.push(G1(xe, y));
      liftNext = false;
    }
    liftNext = ordered.length > 1;
    if (!oneway) dir = -dir;
  }
  return L2;
}
function concentricFill(rg, step, ctx2, opts = {}) {
  const { z, clr, feed, plunge } = ctx2;
  const insideOut = opts.order === "inside-out", finish = !!opts.finishPass;
  const L2 = [];
  let first = true;
  const plungeTo = (x, y) => {
    L2.push(`G0 X${r32(x)} Y${r32(y)}`, `G1 Z${r32(z)} F${plunge}`);
    first = false;
  };
  if (rg.kind === "circle") {
    const radii = [];
    for (let rad = rg.r; rad > 1e-6; rad -= step) radii.push(rad);
    const seq2 = insideOut ? radii.slice().reverse() : radii;
    if (insideOut && seq2.length) plungeTo(rg.cx, rg.cy);
    for (const rad of seq2) {
      const sx = rg.cx + rad, sy = rg.cy;
      if (first) plungeTo(sx, sy);
      else L2.push(`G1 X${r32(sx)} Y${r32(sy)} F${feed}`);
      L2.push(`G3 X${r32(sx)} Y${r32(sy)} I${r32(-rad)} J0 F${feed}`);
    }
    if (!insideOut && !first) L2.push(`G1 X${r32(rg.cx)} Y${r32(rg.cy)} F${feed}`);
    if (finish && seq2.length) {
      const sx = rg.cx + rg.r;
      L2.push(`G0 Z${r32(clr)}`, `G0 X${r32(sx)} Y${r32(rg.cy)}`, `G1 Z${r32(z)} F${plunge}`, `G3 X${r32(sx)} Y${r32(rg.cy)} I${r32(-rg.r)} J0 F${feed}`);
    }
    return L2;
  }
  const x0 = rg.x, y0 = rg.y, x1 = rg.x + rg.w, y1 = rg.y + rg.h;
  const rings = [];
  for (let inset = 0; ; inset += step) {
    const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset;
    if (bx - ax < 1e-6 || by - ay < 1e-6) break;
    rings.push({ ax, ay, bx, by });
  }
  const seq = insideOut ? rings.slice().reverse() : rings;
  for (const { ax, ay, bx, by } of seq) {
    if (first) plungeTo(ax, ay);
    else L2.push(`G1 X${r32(ax)} Y${r32(ay)} F${feed}`);
    L2.push(
      `G1 X${r32(bx)} Y${r32(ay)} F${feed}`,
      `G1 X${r32(bx)} Y${r32(by)} F${feed}`,
      `G1 X${r32(ax)} Y${r32(by)} F${feed}`,
      `G1 X${r32(ax)} Y${r32(ay)} F${feed}`
    );
  }
  if (finish && rings.length) {
    const o = rings[0];
    L2.push(
      `G0 Z${r32(clr)}`,
      `G0 X${r32(o.ax)} Y${r32(o.ay)}`,
      `G1 Z${r32(z)} F${plunge}`,
      `G1 X${r32(o.bx)} Y${r32(o.ay)} F${feed}`,
      `G1 X${r32(o.bx)} Y${r32(o.by)} F${feed}`,
      `G1 X${r32(o.ax)} Y${r32(o.by)} F${feed}`,
      `G1 X${r32(o.ax)} Y${r32(o.ay)} F${feed}`
    );
  }
  return L2;
}
function depthLevels(depth, stepdown) {
  const D = Math.max(0, depth), sd = Math.max(0.05, stepdown), out = [];
  for (let d = sd; ; d += sd) {
    out.push(Math.min(d, D));
    if (d >= D) break;
  }
  return out;
}
var r32;
var init_clearing = __esm({
  "../DDCS-Studio/web/wizards/clearing.js"() {
    r32 = (n) => Math.round(n * 1e3) / 1e3;
  }
});

// ../DDCS-Studio/web/wizards/ops/slot.js
function slotPath(p) {
  const x0 = num(p.x0, 0), y0 = num(p.y0, 0), x1 = num(p.x1, 60), y1 = num(p.y1, 0);
  const tool = Math.max(0.1, num(p.tool, 6));
  const width = Math.max(tool, num(p.width, tool));
  const so = Math.max(0.2, tool * num(p.stepoverPct, 40) / 100);
  const depth = num(p.depth, 4);
  const clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
  const levels = depthLevels(depth, num(p.stepdown, 1.5));
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const L2 = [];
  if (len < 1e-6) {
    L2.push("( zero-length slot \u2014 single plunge )");
    for (const d of levels) L2.push(`G0 X${r3(x0)} Y${r3(y0)}`, `G1 Z${r3(-d)} F${plunge}`, `G0 Z${clr}`);
    return L2;
  }
  const nx = -dy / len, ny = dx / len;
  const band = Math.max(0, width - tool);
  const offs = [];
  if (band < 1e-6) offs.push(0);
  else {
    const half = band / 2;
    for (let o = -half; o < half - 1e-6; o += so) offs.push(o);
    offs.push(half);
  }
  for (const d of levels) {
    const z = -d;
    L2.push(`( level Z${r3(z)} )`);
    let dir = 1, first = true;
    for (const o of offs) {
      let sx = x0 + nx * o, sy = y0 + ny * o, ex = x1 + nx * o, ey = y1 + ny * o;
      if (dir < 0) {
        [sx, ex] = [ex, sx];
        [sy, ey] = [ey, sy];
      }
      if (first) {
        L2.push(`G0 X${r3(sx)} Y${r3(sy)}`, `G1 Z${r3(z)} F${plunge}`);
        first = false;
      } else L2.push(`G1 X${r3(sx)} Y${r3(sy)} F${feed}`);
      L2.push(`G1 X${r3(ex)} Y${r3(ey)} F${feed}`);
      dir = -dir;
    }
    L2.push(`G0 Z${clr}`);
  }
  return L2;
}
var slotBlock;
var init_slot = __esm({
  "../DDCS-Studio/web/wizards/ops/slot.js"() {
    init_util();
    init_clearing();
    slotBlock = {
      type: "slot",
      label: "Slot",
      kind: "leaf",
      category: "Ops",
      defaults: { x0: 0, y0: 0, x1: 60, y1: 0, width: 6, tool: 6, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 },
      fields: ["x0", "y0", "x1", "y1", "width", "tool", "stepoverPct", "depth", "stepdown", "feed", "plunge", "clearance"],
      emit: (p, dx = 0, dy = 0) => slotPath({
        ...p,
        x0: num(p.x0, 0) + dx,
        y0: num(p.y0, 0) + dy,
        x1: num(p.x1, 60) + dx,
        y1: num(p.y1, 0) + dy
      })
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/region.js
function regionDesc(p) {
  const x = num(p.x, 0), y = num(p.y, 0), w2 = num(p.w, 50), h = num(p.h, 30);
  if (p.shape === "circle") {
    const r = w2 / 2;
    return { kind: "circle", cx: x, cy: y, r, contour: circleContour(x, y, r) };
  }
  if (p.shape === "polygon") {
    const r = w2 / 2, n = Math.max(3, Math.round(num(p.sides, 6)));
    return { kind: "polygon", cx: x, cy: y, r, sides: n, contour: polygonContour(x, y, r, n) };
  }
  if (p.shape === "ellipse") {
    const rx = w2 / 2, ry = h / 2;
    return { kind: "ellipse", cx: x, cy: y, rx, ry, contour: ellipseContour(x, y, rx, ry) };
  }
  return { kind: "rect", x, y, w: w2, h, contour: rectContour(x, y, x + w2, y + h) };
}
function coerceRegion(v6) {
  return v6 && v6.contour ? v6 : regionDesc({ shape: "rect", x: 0, y: 0, w: 50, h: 30 });
}
var regionBlock;
var init_region = __esm({
  "../DDCS-Studio/web/wizards/ops/region.js"() {
    init_util();
    init_clearing();
    regionBlock = {
      type: "region",
      label: "Region",
      kind: "reporter",
      returns: "region",
      category: "Shapes",
      defaults: { shape: "rect", x: 0, y: 0, w: 50, h: 30, sides: 6 },
      fields: ["shape", "x", "y", "w", "h", "sides"],
      // shape: rect/circle/polygon/ellipse; w=diameter (circle/polygon), w×h=ellipse; sides=polygon
      reduce: (p) => regionDesc(p)
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/wall.js
function circleWall(rg, z, clr, feed, plunge) {
  const x = r3(rg.cx + rg.r), y = r3(rg.cy);
  return [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( wall )`];
}
var wallBlock;
var init_wall = __esm({
  "../DDCS-Studio/web/wizards/ops/wall.js"() {
    init_util();
    init_clearing();
    init_region();
    wallBlock = {
      type: "wall",
      label: "Wall",
      kind: "leaf",
      category: "Ops",
      defaults: { region: null, z: "z", feed: 400, plunge: 200, clearance: 5 },
      fields: ["region", "z", "feed", "plunge", "clearance"],
      sockets: { region: "region" },
      emit: (p) => {
        const rg = coerceRegion(p.region);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        return rg.kind === "circle" ? circleWall(rg, z, clr, feed, plunge) : contourLevel(rg.contour, { z, clr, feed, plunge });
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/stepover.js
function onewayMoves(rows, ctx2, reverse) {
  const { z, clr, feed, plunge } = ctx2;
  const L2 = [];
  let started = false;
  for (const row of rows) {
    for (const [xlo, xhi] of row.spans) {
      const xs = reverse ? xhi : xlo, xe = reverse ? xlo : xhi;
      if (!started) {
        L2.push(`G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`);
        started = true;
      } else L2.push(`G0 Z${r3(clr)}`, `G0 X${r3(xs)} Y${r3(row.y)}`, `G1 Z${r3(z)} F${plunge}`);
      L2.push(`G1 X${r3(xe)} Y${r3(row.y)} F${feed}`);
    }
  }
  return L2;
}
function fillStrategy(p, z) {
  const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
  const ctx2 = { z, clr: num(p.clearance, 5), feed: num(p.feed, 600), plunge: num(p.plunge, 200) };
  if (p.strategy === "concentric")
    return rg.kind === "circle" ? concentricCircle(rg.cx, rg.cy, rg.r, step, ctx2) : concentricRect(rg.x, rg.y, rg.x + rg.w, rg.y + rg.h, step, ctx2);
  const rows = scanlineFill(rg.contour, step);
  if (p.direction === "oneway") return onewayMoves(rows, ctx2, false);
  if (p.direction === "otherway") return onewayMoves(rows, ctx2, true);
  return fillLevelMoves(rows, ctx2);
}
function fillSegments(p) {
  const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
  const rows = scanlineFill(rg.contour, step), oneWay = p.direction === "oneway" || p.direction === "otherway";
  const rev = p.direction === "otherway";
  const segs = [];
  let dir = rev ? -1 : 1;
  for (const row of rows) {
    const spans = dir > 0 ? row.spans : row.spans.slice().reverse();
    for (const [xlo, xhi] of spans) {
      const [x0, x1] = dir > 0 ? [xlo, xhi] : [xhi, xlo];
      segs.push({ x0: r3(x0), y0: r3(row.y), x1: r3(x1), y1: r3(row.y) });
    }
    if (!oneWay) dir = -dir;
  }
  return segs;
}
var stepoverBlock;
var init_stepover = __esm({
  "../DDCS-Studio/web/wizards/ops/stepover.js"() {
    init_util();
    init_clearing();
    init_region();
    stepoverBlock = {
      type: "stepover",
      label: "Step Over",
      kind: "fill",
      category: "Modify",
      defaults: { region: null, stepover: 4, strategy: "parallel", direction: "bothways", z: "z", feed: 600, plunge: 200, clearance: 5 },
      fields: ["region", "stepover", "strategy", "direction", "z", "feed", "plunge", "clearance"],
      // region = a Region socket; z follows the StepDown
      sockets: { region: "region" },
      lines: (p, z) => fillStrategy(p, z),
      // auto-cut (empty body)
      segments: (p) => fillSegments(p)
      // per-pass body: {x0,y0,x1,y1} in scope
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/fill.js
function zigzagLines(p, z) {
  const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
  return zigzagFill(rg.contour, step, ctxOf(p, z), {
    angleDeg: num(p.angle, 0),
    oneway: p.direction === "oneway" || p.direction === "otherway",
    reverse: p.direction === "otherway"
  });
}
function concentricLines(p, z) {
  const rg = coerceRegion(p.region), step = Math.max(0.1, num(p.stepover, 4));
  return concentricFill(rg, step, ctxOf(p, z), { order: p.order, finishPass: p.finishPass });
}
var ctxOf, fillZigzagBlock, fillConcentricBlock;
var init_fill = __esm({
  "../DDCS-Studio/web/wizards/ops/fill.js"() {
    init_util();
    init_clearing();
    init_region();
    ctxOf = (p, z) => ({ z, clr: num(p.clearance, 5), feed: num(p.feed, 600), plunge: num(p.plunge, 200) });
    fillZigzagBlock = {
      type: "fillzigzag",
      label: "Fill Zigzag",
      kind: "fill",
      category: "Modify",
      defaults: { region: null, stepover: 4, angle: 0, direction: "bothways", z: "z", feed: 600, plunge: 200, clearance: 5 },
      fields: ["region", "stepover", "angle", "direction", "z", "feed", "plunge", "clearance"],
      // region = a Region socket; z follows the Step Down
      sockets: { region: "region" },
      lines: (p, z) => zigzagLines(p, z)
    };
    fillConcentricBlock = {
      type: "fillconcentric",
      label: "Fill Concentric",
      kind: "fill",
      category: "Modify",
      defaults: { region: null, stepover: 4, order: "outside-in", finishPass: false, z: "z", feed: 600, plunge: 200, clearance: 5 },
      fields: ["region", "stepover", "order", "finishPass", "z", "feed", "plunge", "clearance"],
      sockets: { region: "region" },
      lines: (p, z) => concentricLines(p, z)
    };
  }
});

// ../DDCS-Studio/web/wizards/strokeFont.js
function glyph(ch) {
  const c2 = (ch || "").toUpperCase();
  return G[c2] || (G[ch] || G[" "]);
}
var G, FONT_CAP_HEIGHT;
var init_strokeFont = __esm({
  "../DDCS-Studio/web/wizards/strokeFont.js"() {
    G = {
      " ": { w: 4, s: [] },
      "A": { w: 6, s: [[[0, 0], [2.5, 7], [5, 0]], [[1, 2.8], [4, 2.8]]] },
      "B": { w: 6, s: [[[0, 0], [0, 7]], [[0, 7], [3.5, 7], [4.6, 6], [4.6, 4.8], [3.5, 3.8], [0, 3.8]], [[0, 3.8], [4, 3.8], [5, 2.7], [5, 1], [3.8, 0], [0, 0]]] },
      "C": { w: 6, s: [[[5, 5.4], [3.8, 7], [1.6, 7], [0, 5.2], [0, 1.8], [1.6, 0], [3.8, 0], [5, 1.6]]] },
      "D": { w: 6, s: [[[0, 0], [0, 7]], [[0, 7], [3, 7], [5, 5], [5, 2], [3, 0], [0, 0]]] },
      "E": { w: 5.5, s: [[[5, 7], [0, 7], [0, 0], [5, 0]], [[0, 3.5], [3.8, 3.5]]] },
      "F": { w: 5.5, s: [[[0, 0], [0, 7], [5, 7]], [[0, 3.6], [3.8, 3.6]]] },
      "G": { w: 6.2, s: [[[5, 5.4], [3.8, 7], [1.6, 7], [0, 5.2], [0, 1.8], [1.6, 0], [3.9, 0], [5, 1.4], [5, 3], [3, 3]]] },
      "H": { w: 6, s: [[[0, 0], [0, 7]], [[5, 0], [5, 7]], [[0, 3.5], [5, 3.5]]] },
      "I": { w: 3, s: [[[1.5, 0], [1.5, 7]], [[0.2, 7], [2.8, 7]], [[0.2, 0], [2.8, 0]]] },
      "J": { w: 5, s: [[[4, 7], [4, 1.6], [3, 0], [1.3, 0], [0, 1.5]]] },
      "K": { w: 6, s: [[[0, 0], [0, 7]], [[5, 7], [0, 3.3]], [[1.7, 4.3], [5, 0]]] },
      "L": { w: 5, s: [[[0, 7], [0, 0], [4.6, 0]]] },
      "M": { w: 7, s: [[[0, 0], [0, 7], [3, 2.8], [6, 7], [6, 0]]] },
      "N": { w: 6, s: [[[0, 0], [0, 7], [5, 0], [5, 7]]] },
      "O": { w: 6.4, s: [[[2.6, 7], [4.2, 6.3], [5.2, 4.6], [5.2, 2.4], [4.2, 0.7], [2.6, 0], [1, 0.7], [0, 2.4], [0, 4.6], [1, 6.3], [2.6, 7]]] },
      "P": { w: 6, s: [[[0, 0], [0, 7], [3.6, 7], [5, 6], [5, 4.6], [3.6, 3.6], [0, 3.6]]] },
      "Q": { w: 6.4, s: [[[2.6, 7], [4.2, 6.3], [5.2, 4.6], [5.2, 2.4], [4.2, 0.7], [2.6, 0], [1, 0.7], [0, 2.4], [0, 4.6], [1, 6.3], [2.6, 7]], [[3.2, 1.8], [5.4, -0.3]]] },
      "R": { w: 6, s: [[[0, 0], [0, 7], [3.6, 7], [5, 6], [5, 4.6], [3.6, 3.6], [0, 3.6]], [[2.9, 3.6], [5, 0]]] },
      "S": { w: 6, s: [[[5, 5.6], [3.8, 7], [1.5, 7], [0.2, 5.9], [0.6, 4.4], [2.6, 3.7], [4.6, 3], [5, 1.5], [3.8, 0], [1.4, 0], [0, 1.4]]] },
      "T": { w: 5.6, s: [[[0, 7], [5.2, 7]], [[2.6, 7], [2.6, 0]]] },
      "U": { w: 6, s: [[[0, 7], [0, 2], [1.6, 0], [3.4, 0], [5, 2], [5, 7]]] },
      "V": { w: 6, s: [[[0, 7], [2.5, 0], [5, 7]]] },
      "W": { w: 7.6, s: [[[0, 7], [1.3, 0], [3, 4], [4.7, 0], [6, 7]]] },
      "X": { w: 6, s: [[[0, 0], [5, 7]], [[0, 7], [5, 0]]] },
      "Y": { w: 6, s: [[[0, 7], [2.5, 3.6], [5, 7]], [[2.5, 3.6], [2.5, 0]]] },
      "Z": { w: 6, s: [[[0, 7], [5, 7], [0, 0], [5, 0]]] },
      "0": { w: 6, s: [[[2.4, 7], [3.8, 6.3], [4.8, 4.6], [4.8, 2.4], [3.8, 0.7], [2.4, 0], [1, 0.7], [0, 2.4], [0, 4.6], [1, 6.3], [2.4, 7]], [[1, 1.6], [3.8, 5.4]]] },
      "1": { w: 4.5, s: [[[0.8, 5.4], [2.4, 7], [2.4, 0]], [[0.6, 0], [4.2, 0]]] },
      "2": { w: 6, s: [[[0, 5.5], [1.5, 7], [3.6, 7], [4.8, 5.6], [4.4, 4], [0, 0], [5, 0]]] },
      "3": { w: 6, s: [[[0, 6], [1.5, 7], [3.6, 7], [4.7, 6], [4.1, 4.6], [2.4, 4], [4.1, 3.4], [4.8, 1.9], [3.6, 0], [1.4, 0], [0, 1]]] },
      "4": { w: 6, s: [[[3.6, 0], [3.6, 7], [0, 2.3], [5, 2.3]]] },
      "5": { w: 6, s: [[[4.8, 7], [1, 7], [0.5, 4], [1.6, 4.5], [3.4, 4.6], [4.7, 3.3], [4.4, 1.1], [3, 0], [1, 0], [0, 1]]] },
      "6": { w: 6, s: [[[4.4, 6], [3, 7], [1.4, 6.4], [0.3, 4.4], [0, 2.3], [0.8, 0.6], [2.4, 0], [3.8, 0.6], [4.5, 2], [3.8, 3.4], [2.3, 3.9], [0.8, 3.3], [0.2, 2.3]]] },
      "7": { w: 5.6, s: [[[0, 7], [5, 7], [2, 0]]] },
      "8": { w: 6, s: [[[2.4, 7], [3.7, 6.5], [4, 5.3], [2.4, 4], [0.8, 5.3], [1.1, 6.5], [2.4, 7]], [[2.4, 4], [4.1, 3.1], [4.5, 1.5], [2.4, 0], [0.3, 1.5], [0.7, 3.1], [2.4, 4]]] },
      "9": { w: 6, s: [[[0.6, 1], [2, 0], [3.6, 0.6], [4.7, 2.6], [5, 4.7], [4.2, 6.4], [2.6, 7], [1.2, 6.4], [0.5, 5], [1.2, 3.6], [2.7, 3.1], [4.2, 3.7], [4.8, 4.7]]] },
      "-": { w: 5, s: [[[0.8, 3.5], [4.2, 3.5]]] },
      "_": { w: 5.5, s: [[[0, -0.2], [5, -0.2]]] },
      ".": { w: 2.6, s: [[[0.6, 0], [1.6, 0], [1.6, 0.9], [0.6, 0.9], [0.6, 0]]] },
      ",": { w: 2.6, s: [[[1.6, 0.9], [1.6, 0], [0.6, -1]]] },
      ":": { w: 2.6, s: [[[0.6, 4.4], [1.6, 4.4], [1.6, 5.3], [0.6, 5.3], [0.6, 4.4]], [[0.6, 1.4], [1.6, 1.4], [1.6, 2.3], [0.6, 2.3], [0.6, 1.4]]] },
      "/": { w: 5, s: [[[0, 0], [4.6, 7]]] },
      "#": { w: 6.4, s: [[[1.4, 0], [2.1, 7]], [[3.6, 0], [4.3, 7]], [[0.3, 2.1], [5.4, 2.1]], [[0.3, 4.9], [5.4, 4.9]]] },
      "+": { w: 6, s: [[[2.5, 1.4], [2.5, 5.6]], [[0.4, 3.5], [4.6, 3.5]]] },
      "=": { w: 6, s: [[[0.4, 2.4], [4.6, 2.4]], [[0.4, 4.6], [4.6, 4.6]]] },
      "*": { w: 5.4, s: [[[2.4, 2.4], [2.4, 6.4]], [[0.7, 3.4], [4.1, 5.4]], [[4.1, 3.4], [0.7, 5.4]]] },
      "(": { w: 3.2, s: [[[2.4, 7.4], [0.6, 5], [0.6, 2], [2.4, -0.4]]] },
      ")": { w: 3.2, s: [[[0.6, 7.4], [2.4, 5], [2.4, 2], [0.6, -0.4]]] },
      "!": { w: 2.6, s: [[[1.1, 7], [1.1, 2]], [[0.6, 0], [1.6, 0], [1.6, 0.9], [0.6, 0.9], [0.6, 0]]] },
      "?": { w: 5.4, s: [[[0.3, 5.5], [1.6, 7], [3.2, 7], [4.4, 5.7], [3.8, 4.2], [2.3, 3.6], [2.3, 2.2]], [[2.3, 0], [2.3, 0.9]]] }
    };
    FONT_CAP_HEIGHT = 7;
  }
});

// ../DDCS-Studio/web/wizards/textGeometry.js
function num2(v6, d) {
  return v6 === "" || v6 == null || isNaN(Number(v6)) ? d : Number(v6);
}
function layoutText(params) {
  const text = params.text == null ? "TEXT" : String(params.text);
  const H3 = Math.max(1, num2(params.height, 12));
  const scale = H3 / FONT_CAP_HEIGHT;
  const tracking = num2(params.spacing, 1.2);
  const align = params.align || "left";
  const ox = num2(params.x, 0), oy = num2(params.y, 0);
  const lines = text.split("\n");
  const linePitch = H3 * 1.6;
  const strokes = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const acc = (px, py) => {
    if (px < x0) x0 = px;
    if (py < y0) y0 = py;
    if (px > x1) x1 = px;
    if (py > y1) y1 = py;
  };
  lines.forEach((ln, li) => {
    let lw = 0;
    for (const ch of ln) lw += glyph(ch).w * scale + tracking;
    if (ln.length) lw -= tracking;
    const baseY = oy - li * linePitch;
    let cx = align === "center" ? ox - lw / 2 : align === "right" ? ox - lw : ox;
    for (const ch of ln) {
      const g = glyph(ch);
      for (const stroke of g.s) {
        const placed = stroke.map(([x, y]) => [cx + x * scale, baseY + y * scale]);
        strokes.push(placed);
        for (const [px, py] of placed) acc(px, py);
      }
      cx += g.w * scale + tracking;
    }
  });
  if (!isFinite(x0)) {
    x0 = x1 = ox;
    y0 = y1 = oy;
  }
  return { strokes, bbox: { x0, y0, x1, y1 }, scale, height: H3 };
}
function disc(cx, cy, r, seg = 8) {
  const c2 = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg + 0.3927;
    c2.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return c2;
}
function strokeContours(poly, hw) {
  const out = [];
  for (let i = 0; i + 1 < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const nx = -dy / len * hw, ny = dx / len * hw;
    out.push(ccw([{ x: ax + nx, y: ay + ny }, { x: bx + nx, y: by + ny }, { x: bx - nx, y: by - ny }, { x: ax - nx, y: ay - ny }]));
  }
  for (const [x, y] of poly) out.push(disc(x, y, hw));
  return out;
}
function textContours(params) {
  const { strokes } = layoutText(params);
  const hw = Math.max(0.1, num2(params.strokeWidth, 2.5) / 2);
  const contours = [];
  for (const poly of strokes) for (const c2 of strokeContours(poly, hw)) contours.push(c2);
  return contours;
}
var ccw;
var init_textGeometry = __esm({
  "../DDCS-Studio/web/wizards/textGeometry.js"() {
    init_strokeFont();
    ccw = (pts) => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p.x * q.y - q.x * p.y;
      }
      return a < 0 ? pts.slice().reverse() : pts;
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/fillText.js
var fillTextBlock;
var init_fillText = __esm({
  "../DDCS-Studio/web/wizards/ops/fillText.js"() {
    init_util();
    init_clearing();
    init_textGeometry();
    fillTextBlock = {
      type: "filltext",
      label: "Fill Text",
      kind: "fill",
      category: "Modify",
      defaults: {
        text: "TEXT",
        height: 12,
        spacing: 1.2,
        align: "left",
        x: 0,
        y: 0,
        strokeWidth: 2.5,
        toolDia: 1.5,
        stepoverPct: 50,
        z: "z",
        feed: 400,
        plunge: 120,
        clearance: 4
      },
      fields: ["text", "height", "spacing", "align", "x", "y", "strokeWidth", "toolDia", "stepoverPct", "z", "feed", "plunge", "clearance"],
      lines: (p, z) => {
        const tool = Math.max(0.1, num(p.toolDia, 1.5));
        const so = Math.max(0.15, tool * num(p.stepoverPct, 50) / 100);
        const rows = scanlineFill(textContours(p), so);
        if (!rows.length) return ["( nothing to engrave )"];
        return fillLevelMoves(rows, { z, clr: num(p.clearance, 4), feed: num(p.feed, 400), plunge: num(p.plunge, 120) });
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/stepdown.js
var stepdownBlock;
var init_stepdown = __esm({
  "../DDCS-Studio/web/wizards/ops/stepdown.js"() {
    stepdownBlock = {
      type: "stepdown",
      label: "Step Down",
      kind: "depth",
      category: "Modify",
      defaults: { to: 5, by: 1 },
      fields: ["to", "by"]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/probe.js
var probeBlock;
var init_probe = __esm({
  "../DDCS-Studio/web/wizards/ops/probe.js"() {
    init_util();
    probeBlock = {
      type: "probe",
      label: "Probe",
      kind: "leaf",
      category: "Move",
      defaults: { axis: "Z", to: -10, feed: 100, port: 3, level: 0 },
      fields: ["axis", "to", "feed", "port", "level"],
      // to/feed/port accept literals OR #var/[expr] refs (probe macros probe to #8 at feed #3, port #5).
      emit: (p, dx, dy, dialect8) => dialect8.probeMove(
        p.axis || "Z",
        val(p.to, -10),
        { feed: val(p.feed, 100), port: val(p.port, 3), level: num(p.level, 0) }
      )
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/array.js
function patternPoints(p) {
  const pts = [];
  const type = p.pattern || "grid";
  if (type === "circle") {
    const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.dia, 50) / 2;
    const n = Math.max(1, Math.round(num(p.count, 6))), a0 = num(p.startAngle, 0) * Math.PI / 180;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 2 * Math.PI / n;
      pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    }
  } else if (type === "line") {
    const n = Math.max(1, Math.round(num(p.count, 3))), s = num(p.spacing, 20), a = num(p.angle, 0) * Math.PI / 180;
    const x0 = num(p.x0, 0), y0 = num(p.y0, 0);
    for (let k = 0; k < n; k++) pts.push({ x: x0 + k * s * Math.cos(a), y: y0 + k * s * Math.sin(a) });
  } else if (type === "rect") {
    const w2 = num(p.w, 100), h = num(p.h, 80), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
    const nx = Math.max(2, Math.round(num(p.nx, 2))), ny = Math.max(2, Math.round(num(p.ny, 2)));
    const seen = /* @__PURE__ */ new Set(), add = (x, y) => {
      const k = r3(x) + "," + r3(y);
      if (!seen.has(k)) {
        seen.add(k);
        pts.push({ x, y });
      }
    };
    for (let i = 0; i < nx; i++) {
      const x = x0 + w2 * i / (nx - 1);
      add(x, y0);
      add(x, y0 + h);
    }
    for (let j = 0; j < ny; j++) {
      const y = y0 + h * j / (ny - 1);
      add(x0, y);
      add(x0 + w2, y);
    }
  } else {
    const cols = Math.max(1, Math.round(num(p.cols, 3))), rows = Math.max(1, Math.round(num(p.rows, 3)));
    const dx = num(p.dx, 20), dy = num(p.dy, 20), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pts.push({ x: x0 + i * dx, y: y0 + j * dy });
  }
  return pts.map((pt) => ({ x: r3(pt.x), y: r3(pt.y) }));
}
var arrayBlock;
var init_array = __esm({
  "../DDCS-Studio/web/wizards/ops/array.js"() {
    init_util();
    arrayBlock = {
      type: "array",
      label: "Array",
      kind: "container",
      category: "Modify",
      defaults: { pattern: "grid", x0: 0, y0: 0, cols: 3, rows: 2, dx: 20, dy: 20, count: 4, spacing: 20, angle: 0, dia: 50, startAngle: 0, skip: "" },
      fields: ["pattern"],
      // pattern-specific fields resolved by fieldsFor()
      /** Pattern points; mirrors x0/y0 → cx/cy so circle reads the same origin. */
      points: (p) => patternPoints({ ...p, cx: num(p.x0, 0), cy: num(p.y0, 0) }),
      /** Which fields to show depends on the chosen pattern. */
      fieldsFor(p) {
        const base = ["pattern", "x0", "y0"];
        if (p.pattern === "circle") return [...base, "dia", "count", "startAngle", "skip"];
        if (p.pattern === "line") return [...base, "count", "spacing", "angle", "skip"];
        return [...base, "cols", "rows", "dx", "dy", "skip"];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/helix.js
function helixPoints(p) {
  const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.radius, 10);
  const depth = num(p.depth, 10), pitch = Math.max(0.2, num(p.pitch, 2)), seg = Math.max(8, Math.round(num(p.seg, 24)));
  const a0 = num(p.startAngle, 0) * Math.PI / 180, n = Math.round(Math.max(1, depth / pitch) * seg), pts = [];
  for (let k = 1; k <= n; k++) {
    const a = a0 + k * 2 * Math.PI / seg;
    pts.push({ x: r3(cx + R * Math.cos(a)), y: r3(cy + R * Math.sin(a)), z: r3(-depth * k / n) });
  }
  return pts;
}
var helixBlock;
var init_helix = __esm({
  "../DDCS-Studio/web/wizards/ops/helix.js"() {
    init_util();
    helixBlock = {
      type: "helix",
      label: "Helix",
      kind: "path",
      category: "Modify",
      defaults: { cx: 0, cy: 0, radius: 10, depth: 10, pitch: 2, startAngle: 0, seg: 24, clearance: 5 },
      fields: ["cx", "cy", "radius", "depth", "pitch", "startAngle", "seg", "clearance"],
      points: helixPoints
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/count.js
var countBlock;
var init_count = __esm({
  "../DDCS-Studio/web/wizards/ops/count.js"() {
    countBlock = {
      type: "count",
      label: "Count",
      kind: "loop",
      category: "Control",
      defaults: { var: "i", from: 1, to: 4, by: 1 },
      fields: ["var", "from", "to", "by"]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/iff.js
var ifBlock;
var init_iff = __esm({
  "../DDCS-Studio/web/wizards/ops/iff.js"() {
    ifBlock = {
      type: "if",
      label: "If",
      kind: "cond",
      category: "Control",
      defaults: { cond: "" },
      fields: ["cond"],
      sockets: { cond: "boolean" }
      // cond renders as a hexagon boolean socket, not a number input
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/compare.js
var compareBlock;
var init_compare = __esm({
  "../DDCS-Studio/web/wizards/ops/compare.js"() {
    compareBlock = {
      type: "compare",
      label: "Compare",
      kind: "reporter",
      returns: "boolean",
      category: "Control",
      defaults: { a: 0, op: "<", b: 0 },
      fields: ["a", "op", "b"],
      // a, b are numeric value sockets; op is a relational select
      reduce: (p, scope, rc) => {
        const a = rc(p.a), b2 = rc(p.b);
        switch (p.op) {
          case "<":
            return a < b2 ? 1 : 0;
          case ">":
            return a > b2 ? 1 : 0;
          case "<=":
            return a <= b2 ? 1 : 0;
          case ">=":
            return a >= b2 ? 1 : 0;
          case "==":
            return a === b2 ? 1 : 0;
          case "!=":
            return a !== b2 ? 1 : 0;
          default:
            return 0;
        }
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/set.js
var setBlock;
var init_set = __esm({
  "../DDCS-Studio/web/wizards/ops/set.js"() {
    setBlock = {
      type: "set",
      label: "Set",
      kind: "var",
      category: "Variables",
      defaults: { name: "a", value: 0 },
      fields: ["name", "value"]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/move.js
var moveBlock;
var init_move = __esm({
  "../DDCS-Studio/web/wizards/ops/move.js"() {
    init_util();
    moveBlock = {
      type: "move",
      label: "Move",
      kind: "leaf",
      category: "Move",
      defaults: { mode: "cut", x: 0, y: 0, z: 0, feed: 200 },
      fields: ["mode", "x", "y", "z", "feed"],
      // Only the axes that are set are emitted (a blank/absent axis is omitted → single-axis moves like `G0 X#9`).
      // Each coordinate/feed accepts a literal OR a #var/[expr] (val), so `Move(rapid, X=#9)` → `G0 X#9`.
      emit: (p, dx = 0, dy = 0) => {
        const words = [];
        if (p.x != null && p.x !== "") words.push(`X${val(p.x, 0, dx)}`);
        if (p.y != null && p.y !== "") words.push(`Y${val(p.y, 0, dy)}`);
        if (p.z != null && p.z !== "") words.push(`Z${val(p.z, 0)}`);
        if (p.a != null && p.a !== "") words.push(`A${val(p.a, 0)}`);
        if (p.b != null && p.b !== "") words.push(`B${val(p.b, 0)}`);
        const xyz = words.join(" ");
        if (p.mode === "rapid") return [`G0 ${xyz}`];
        if (p.mode === "probe") return [`G31 ${xyz} F${val(p.feed, 50)}`];
        return [`G1 ${xyz} F${val(p.feed, 200)}`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/arc.js
var arcBlock;
var init_arc = __esm({
  "../DDCS-Studio/web/wizards/ops/arc.js"() {
    init_util();
    arcBlock = {
      type: "arc",
      label: "Arc",
      kind: "leaf",
      category: "Move",
      defaults: { arc: "ccw", x: 0, y: 0, i: 0, j: 0, feed: 200 },
      fields: ["arc", "x", "y", "i", "j", "feed"],
      // arc = direction select (ccw=G3 / cw=G2); i,j = centre offset
      emit: (p, dx = 0, dy = 0) => {
        const g = p.arc === "cw" ? 2 : 3;
        return [`G${g} X${val(p.x, 0, dx)} Y${val(p.y, 0, dy)} I${val(p.i, 0)} J${val(p.j, 0)} F${val(p.feed, 200)}   ( arc )`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/spindle.js
var spindleBlock;
var init_spindle = __esm({
  "../DDCS-Studio/web/wizards/ops/spindle.js"() {
    init_util();
    spindleBlock = {
      type: "spindle",
      label: "Spindle",
      kind: "leaf",
      category: "Machine",
      defaults: { rpm: 12e3, dir: "cw" },
      fields: ["rpm", "dir"],
      // dir = cw (M3) / ccw (M4); rpm 0 → M5 (off)
      emit: (p) => {
        const dir = p.dir === "ccw" ? 4 : 3, lbl = p.dir === "ccw" ? "CCW" : "CW";
        if (typeof p.rpm === "string" && /[#[]/.test(p.rpm)) return [`M${dir} S${p.rpm.trim()}   ( spindle ${lbl} )`];
        const r = num(p.rpm, 0);
        if (r <= 0) return ["M5   ( spindle off )"];
        return [`M${dir} S${val(r)}   ( spindle ${lbl} )`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/feed.js
var feedBlock;
var init_feed = __esm({
  "../DDCS-Studio/web/wizards/ops/feed.js"() {
    init_util();
    feedBlock = {
      type: "feed",
      label: "Feed",
      kind: "leaf",
      category: "Machine",
      defaults: { rate: 200 },
      fields: ["rate"],
      emit: (p) => [`F${val(p.rate, 200)}   ( feedrate )`]
      // rate accepts a literal or #var/[expr]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/dwell.js
var dwellBlock;
var init_dwell = __esm({
  "../DDCS-Studio/web/wizards/ops/dwell.js"() {
    init_util();
    dwellBlock = {
      type: "dwell",
      label: "Dwell",
      kind: "leaf",
      category: "Machine",
      defaults: { sec: 1 },
      fields: ["sec"],
      emit: (p, dx, dy, dialect8) => dialect8.dwell(num(p.sec, 0))
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/coolant.js
var coolantBlock;
var init_coolant = __esm({
  "../DDCS-Studio/web/wizards/ops/coolant.js"() {
    coolantBlock = {
      type: "coolant",
      label: "Coolant",
      kind: "leaf",
      category: "Machine",
      defaults: { flow: "flood" },
      fields: ["flow"],
      // select: flood / mist / off
      emit: (p) => [{ flood: "M8   ( flood )", mist: "M7   ( mist )", off: "M9   ( coolant off )" }[p.flow] || "M9   ( coolant off )"]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/tool.js
var toolBlock;
var init_tool = __esm({
  "../DDCS-Studio/web/wizards/ops/tool.js"() {
    init_util();
    toolBlock = {
      type: "tool",
      label: "Tool",
      kind: "leaf",
      category: "Machine",
      defaults: { n: 1 },
      fields: ["n"],
      emit: (p) => [`T${Math.max(0, Math.round(num(p.n, 1)))} M6   ( tool change )`]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/wcs.js
var wcsBlock;
var init_wcs = __esm({
  "../DDCS-Studio/web/wizards/ops/wcs.js"() {
    wcsBlock = {
      type: "wcs",
      label: "WCS",
      kind: "leaf",
      category: "Machine",
      defaults: { wcs: "G54" },
      fields: ["wcs"],
      // select: G54…G59
      emit: (p, dx, dy, dialect8) => {
        if (!p.wcs || p.wcs === "active") return [];
        let w2 = p.wcs;
        if (w2.startsWith("G59P")) w2 = w2.replace("G59P", "G59 P");
        if (w2.includes(" P") && dialect8 && dialect8.caps && dialect8.caps.flow === "none") {
          return [`( ${w2} - warning: extended WCS not supported on ${dialect8.name} )`];
        }
        return [`${w2}   ( work offset )`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/distmode.js
var distModeBlock;
var init_distmode = __esm({
  "../DDCS-Studio/web/wizards/ops/distmode.js"() {
    distModeBlock = {
      type: "distmode",
      label: "Distance",
      kind: "leaf",
      category: "Machine",
      defaults: { dist: "abs" },
      fields: ["dist"],
      // select: abs (G90) / inc (G91)
      emit: (p) => [`${p.dist === "inc" ? "G91" : "G90"}   ( ${p.dist === "inc" ? "incremental" : "absolute"} )`]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/comment.js
var commentBlock;
var init_comment = __esm({
  "../DDCS-Studio/web/wizards/ops/comment.js"() {
    commentBlock = {
      type: "comment",
      label: "Comment",
      kind: "leaf",
      category: "Mark Up",
      defaults: { text: "note" },
      fields: ["text"],
      emit: (p) => [`( ${String(p.text ?? "").replace(/[()]/g, "")} )`]
      // strip parens so the comment can't break the file
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/variable.js
var variableBlock;
var init_variable = __esm({
  "../DDCS-Studio/web/wizards/ops/variable.js"() {
    variableBlock = {
      type: "variable",
      label: "Variable",
      kind: "reporter",
      category: "Variables",
      defaults: { name: "a" },
      fields: ["name"],
      // A runtime macro ref (#100) or a [bracket expr] passes through LITERALLY — that's how a #var coordinate
      // (e.g. `G0 Z#18`) survives in a value socket. A plain name is a compile-time Set variable → its scope value.
      reduce: (p, scope) => {
        const k = p.name;
        if (typeof k === "string" && /[#[]/.test(k)) return k;
        const n = scope[k];
        return n == null ? 0 : Number(n);
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/math.js
var mathBlock;
var init_math = __esm({
  "../DDCS-Studio/web/wizards/ops/math.js"() {
    mathBlock = {
      type: "math",
      label: "Math",
      kind: "reporter",
      category: "Math",
      defaults: { a: 0, op: "/", b: 0 },
      fields: ["a", "op", "b"],
      // a, b are value sockets; op is a select (+ − × ÷ %)
      reduce: (p, scope, rc) => {
        const a = rc(p.a), b2 = rc(p.b);
        switch (p.op) {
          case "+":
            return a + b2;
          case "-":
            return a - b2;
          case "*":
            return a * b2;
          case "/":
            return a / b2;
          case "%":
            return a % b2;
          default:
            return a;
        }
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/words.js
function renderToken(tok2, f) {
  if (tok2 && tok2.raw !== void 0) return tok2.raw;
  const { letter, value } = tok2;
  if ((letter === "G" || letter === "M") && f.padGM && /^\d$/.test(String(value))) {
    return `${letter}0${value}`;
  }
  return `${letter}${value}`;
}
function line(parts, comment2, f = fmt) {
  const toks = Array.isArray(parts) ? parts : [parts];
  let code = toks.map((t) => renderToken(t, f)).join(f.sep);
  if (comment2 && f.comment !== "none") {
    code = f.comment === "line" ? `( ${comment2} )${f.eol}${code}` : `${code} ( ${comment2} )`;
  }
  if (typeof f.transform === "function") code = f.transform(code, { parts: toks, comment: comment2 });
  return code;
}
var fmt, w, M;
var init_words = __esm({
  "../DDCS-Studio/web/wizards/words.js"() {
    fmt = {
      padGM: false,
      // false: G0 / M3 (current)   |  true: G00 / M03
      sep: " ",
      // ' ': "G0 X#9" (current)    |  '': "G0X#9"
      eol: "\n",
      // '\n' (current)             |  '\r\n' for USB/Windows .nc
      comment: "inline",
      // 'inline' (current) | 'line' (own line above) | 'none' (strip)
      blankBetweenBlocks: "\n",
      // extra EOL appended by block() (current: one blank line) | '' for none
      transform: null
      // (renderedLine: string, ctx) => string — applied to every line()
    };
    w = (letter, value = "") => ({ letter, value });
    M = (v6) => w("M", v6);
  }
});

// ../DDCS-Studio/web/wizards/ops/macro.js
var machineMoveBlock, endProgramBlock, mcodeBlock, rawBlock;
var init_macro = __esm({
  "../DDCS-Studio/web/wizards/ops/macro.js"() {
    init_util();
    init_words();
    machineMoveBlock = {
      type: "machinemove",
      label: "Machine Move",
      kind: "leaf",
      category: "Move",
      defaults: { axis: "Z", to: "#99", var: "#99" },
      fields: ["axis", "to", "var"],
      // DDCS rule: G53 needs a VARIABLE (a literal fails on M350). If `to` is already a #var (e.g. a stored #57
      // from Read Machine) → move straight to it; if it's a number → stage it in `var` first, then move.
      emit: (p, dx, dy, dialect8) => {
        const axis = p.axis || "Z", t = p.to;
        if (typeof t === "string" && t.trim().startsWith("#")) return dialect8.machineMove(axis, t.trim());
        const v6 = p.var || "#99";
        return [`${v6}=${r3(num(t, 0))}`, ...dialect8.machineMove(axis, v6)];
      }
    };
    endProgramBlock = {
      type: "endprogram",
      label: "End Program",
      kind: "leaf",
      category: "Machine",
      defaults: {},
      fields: [],
      emit: (p, dx, dy, dialect8) => dialect8.endProgram()
    };
    mcodeBlock = {
      type: "mcode",
      label: "M-Code",
      kind: "leaf",
      category: "Machine",
      defaults: { code: 154, note: "" },
      fields: ["code", "note"],
      // raw custom M-code (accessory output / sensor wait / pause)
      emit: (p) => [line([M(Math.max(0, Math.round(num(p.code, 0))))], p.note && String(p.note).replace(/[()]/g, "").trim() || "M-code")]
    };
    rawBlock = {
      type: "raw",
      label: "Raw G-code",
      kind: "leaf",
      category: "Machine",
      defaults: { text: "" },
      fields: ["text"],
      // verbatim escape hatch (e.g. a controller-specific G4 P / dwell)
      emit: (p) => [String(p.text ?? "")]
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js
var AX, dialect;
var init_ddcs_expert_m350 = __esm({
  "../DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js"() {
    AX = { X: 0, Y: 1, Z: 2, A: 3 };
    dialect = {
      id: "ddcs-expert-m350",
      name: "DDCS Expert M350",
      programModel: "inline",
      probeModel: "g31",
      dwellUnits: "ms",
      vars: {
        dro: 880,
        probeStatus: 1920,
        probeTrig: 1925,
        wcsBase: 805,
        wcsStride: 5,
        activeWcs: 578,
        toolTable: 1430,
        // ATC tool-changer firmware tables. currentTool/capacity/pockets live in SYSDISK/camsetting (#1000-1499,
        // slot = var-1000 — boundary-confirmed by the captured sentinels) so the gateway can READ them over SMB;
        // targetTool #1504 is a runtime var (M6 Txx). Param meanings from default_vars.js (#1300/#1330/#1350/#1370).
        atc: { currentTool: 1300, capacity: 1301, targetTool: 1504, pocketX: 1330, pocketY: 1350, pocketZ: 1370 },
        ax: AX
      },
      caps: { vars: true, flow: "goto", probeStatusCheck: true, hmi: true, toolTable: true, probePort: true, inputRead: true, atc: true },
      // the fullest profile (inputRead = generic live-input poll #[1520+N], slib O10300; atc = full pick&place model)
      // G31 Z-10 F100 P3 L0 Q1   (snippets.nc:9 · words.nc:6 "G31 Z#7 F#3 P#5 L0 Q1")
      probeMove: (axis, dist, { feed = 100, port = 3, level = 0 } = {}) => [`G31 ${axis}${dist} F${feed} P${port} L${level} Q1`],
      // IF #1922!=2 GOTO1   (3D PROBE G55.nc:29 · snippets.nc:10). status block #1920+axis; "!=2" = did NOT trigger
      probeStatus: (axis, label) => [`IF #${1920 + AX[axis]}!=2 GOTO${label}`],
      // #50=#1927   (words.nc:12). trigger-position block #1925+axis
      probeRead: (axis, varName) => [`${varName}=#${1925 + AX[axis]}`],
      // #57=#882   (SAVE_WCS_XY_AUTO.nc:16). machine-DRO block #880+axis
      readMachine: (axis, varName) => [`${varName}=#${880 + AX[axis]}`],
      // G53 Z#99   (snippets.nc:4). NO G0 prefix; ref MUST be a #var on M350 (a literal fails)
      machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
      // #[805+[idx-1]*5+ax]=value   (SAVE_WCS_XY_AUTO.nc:21-26). base 805, stride 5; X=base,Y=+1,Z=+2,A=+3
      setWorkOffset: (wcsExpr, axis, value) => [`#[805+[${wcsExpr}-1]*5+${AX[axis]}]=${value}`],
      readActiveWcs: (varName) => [`${varName}=#578`],
      // #578 = active WCS index 1=G54… (COPY_WCS.nc:15)
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G04 P${Math.round(sec * 1e3)}`],
      // P = ms (slib-g.nc:691 "G04 P100 //100ms")
      endProgram: () => ["M30"],
      // universal end; no M2/M02 in any capture
      ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} GOTO${label}`],
      // symbolic ops ==/!=/<=; GOTO no space
      goto: (label) => [`GOTO${label}`],
      label: (n) => [`N${n}`],
      // Wait until input N (0-based: pin 0 = IN01 = #1520) reaches level L (0/1): poll #[1520+N] in a
      // WHILE..DO1..END1 with a 10 ms dwell — the verbatim factory sensor-wait idiom (slib-m.nc O10300:
      // `WHILE [#[1520+#4-1] != #6] DO1 / G04 P10 / END1`). P = ms (slib-g.nc:691). No timeout: the poll waits indefinitely.
      waitInput: (n, level) => [`WHILE [#[1520+${n}] != ${level}] DO1   ( wait input ${n} = ${level} )`, "G04 P10", "END1"],
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      // M3.nc / M4.nc
      spindleOff: () => ["M5"],
      coolant: (on) => [on ? "M8" : "M9"],
      // flood M8 / off M9 (mist M7 not present in dump)
      hmiPrompt: (msg) => [`#1505=1(${msg})`],
      // blocking OK/Cancel; ESC sets #1505=0
      hmiCancelVar: "#1505",
      // the prompt's cancel signal — ESC sets it to 0 (confirmBlock bails on it)
      hmiToast: (msg) => [`#1505=-5000(${msg})`],
      // display-only banner
      hmiInput: (varName, prompt2) => [`#2070=${String(varName).replace("#", "")}(${prompt2})`],
      // blocking numeric input
      // recognize(line): the PARSE INVERSE of the dialect-specific emit above (the rest is decoded by the shared
      // core parser). Returns { type, params } or null. Probe/status/DRO reads are syntactically just `#x=#sys`
      // / `IF #status!=2 GOTO` — distinguished ONLY by this controller's magic var numbers (vars above), so these
      // must be tried before the generic assign/ifgoto. Mirrors the verified emit forms 1:1 (round-trips).
      recognize(line2) {
        const AXR = ["X", "Y", "Z", "A"];
        const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
        let m;
        if (m = line2.match(/^G31 ([XYZA])(\S+) F(\S+) P(\S+) L(\d+) Q1$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]), port: nos(m[4]), level: +m[5] } };
        if (m = line2.match(/^IF #(\d+)!=2 GOTO(\d+)$/)) {
          const ax = +m[1] - 1920;
          if (ax >= 0 && ax <= 3) return { type: "probecheck", params: { axis: AXR[ax], goto: +m[2] } };
        }
        if (m = line2.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?) GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
        if (m = line2.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
        if (m = line2.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
        if (m = line2.match(/^#\[805\+\[(.+?)-1\]\*5\+(\d+)\]=(.+)$/)) {
          const ax = +m[2];
          if (ax >= 0 && ax <= 3) return { type: "setworkoffset", params: { wcs: m[1], axis: AXR[ax], value: m[3] } };
        }
        if (m = line2.match(/^#1505=-5000\((.*)\)$/)) return { type: "message", params: { text: m[1] } };
        if (m = line2.match(/^#2070=([^(]+)\((.*)\)$/)) return { type: "asknumber", params: { var: "#" + m[1].trim(), prompt: m[2] } };
        if (m = line2.match(/^(#\d+)=#(\d+)$/)) {
          const sys = +m[2];
          let ax = sys - 1925;
          if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
          ax = sys - 880;
          if (ax >= 0 && ax <= 3) return { type: "readmachine", params: { axis: AXR[ax], var: m[1] } };
        }
        if (m = line2.match(/^M0*(\d+)$/)) {
          const mc = +m[1];
          if (mc >= 50 && mc <= 91) return { type: "outpin", params: { pin: mc - 50 >> 1, state: (mc - 50) % 2 === 0 ? "on" : "off" } };
        }
        return null;
      },
      notes: "In-program Macro-B-INSPIRED dialect (real Fanuc Macro B does NOT run on M350). G53 needs a #var (no literal, no G0). WCS via direct #[805+] indirect write, stride 5. \u26A0\uFE0F NEVER emit G10 L20/L2 with axis words: V1 on-machine (2026-06-19) proved G10 L20 P6 X25 writes NO offset and the X word executes as a G90/G01 MOVE (Mach X 5\u219273.286) \u2014 broken AND dangerous. Direct register write is the only safe WCS set. Dwell P=ms. WHILE/DO/END also exist (word ops, bracketed). Verified vs bridge/controllers/expert-m350 \u2014 appcode/snippets.nc, SYSDISK/slib-*.nc, CNCDISK captures."
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/ddcs-v41.js
var AX2, dialect2;
var init_ddcs_v41 = __esm({
  "../DDCS-Studio/web/wizards/dialects/ddcs-v41.js"() {
    AX2 = { X: 0, Y: 1, Z: 2, A: 3 };
    dialect2 = {
      id: "ddcs-v41",
      name: "DDCS V4.1",
      programModel: "inline",
      probeModel: "g31",
      dwellUnits: "ms",
      // dro = machine pos #1500-1503; wcsWork = workpiece pos #1506-1509 (what zero*.nc writes); toolTable #1560/#764.
      vars: { dro: 1500, wcsWork: 1506, probeStatus: null, probeTrig: 1500, wcsBase: 1512, wcsStride: 6, activeWcs: null, toolTable: 1560, atc: null, ax: AX2 },
      // atc null: the #1300/#1330 ATC firmware tables are unmapped on V4.1 (the dump shows them as generic "system parameter area")
      caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false, atc: false },
      // G31 L#682; success read from DRO #1502; no confirmed pick&place ATC model
      // G91 G31 Z-1000 L#682 Q1 K0 F#106  (probe-float.nc, live). L#682 = probe-selector config param; no P-port word.
      probeMove: (axis, dist, { feed = 100 } = {}) => [`G31 ${axis}${dist} L#682 Q1 K0 F${feed}`],
      probeStatus: () => [],
      // no status var — success read from post-probe DRO #1502 (probe-fix.nc)
      probeRead: (axis, varName) => [`${varName}=#${1500 + AX2[axis]}`],
      // post-probe machine pos #1500+ax (probe-fix.nc: #108=#1502)
      readMachine: (axis, varName) => [`${varName}=#${1500 + AX2[axis]}`],
      // DRO X#1500/Y#1501/Z#1502/A#1503 (safez.nc)
      machineMove: (axis, ref) => [`G0 G53 ${axis}${ref}`],
      // CONFIRMED live: probe-fix.nc "G0G53Z#102" (G0 + G53)
      // CONFIRMED live (probe-vertex.nc): zero at the probed point with G90 G92 <axis><WORK value> — a work coord,
      // NOT a machine coord like Expert's register write. ("zero here" macros zeroz/zeroxy write #1506-1509 directly.)
      setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}`],
      readActiveWcs: () => [],
      // TO CONFIRM
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G04 P${Math.round(sec * 1e3)}`],
      // ms (firmware G04P1000)
      endProgram: () => ["M30"],
      ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs}GOTO${label}`],
      // NO space before GOTO (probe-h.nc:7)
      goto: (label) => [`GOTO${label}`],
      label: (n) => [`N${n}`],
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      spindleOff: () => ["M5"],
      coolant: (on) => [on ? "M8" : "M9"],
      hmiPrompt: () => [],
      // TO CONFIRM — V4.1 uses MarcoDialog "*.rc", #1505 unconfirmed
      hmiToast: () => [],
      hmiInput: () => [],
      // recognize(line): parse inverse of the V4.1-specific emit (probe G31…L#682, tight IF…GOTO, G90 G92 WCS,
      // #1500+ DRO reads). No status/HMI vars here (those fold to nothing on V4.1). Probe-read and read-machine
      // share #1500+ax, so both decode to proberead (V4.1 conflates them) — byte-identical either way.
      recognize(line2) {
        const AXR = ["X", "Y", "Z", "A"];
        const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
        let m;
        if (m = line2.match(/^G31 ([XYZA])(\S+) L#682 Q1 K0 F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if (m = line2.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?)GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
        if (m = line2.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
        if (m = line2.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
        if (m = line2.match(/^G90 G92 ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: "#578", axis: m[1], value: m[2] } };
        if (m = line2.match(/^(#\d+)=#(\d+)$/)) {
          const ax = +m[2] - 1500;
          if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
        }
        return null;
      },
      notes: "\u2248Expert FORM, vars at #1500+ (DRO #1500-1503, workpiece #1506-1509, WCS base #1512 stride 6). Zero via G92 with a WORK coord (or direct #1506-1509 write), NOT the indirect #[805+] write. No probe status var (result = post-probe DRO #1502). Machine move = G0 G53. ifGoto has NO space before GOTO. HMI via MarcoDialog *.rc \u2014 TO CONFIRM. CONFIRMED live on \\\\10.0.0.50\\SYSDISK (2026-06-13)."
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/ddcs-v3-dm500.js
var AX3, OP, dialect3;
var init_ddcs_v3_dm500 = __esm({
  "../DDCS-Studio/web/wizards/dialects/ddcs-v3-dm500.js"() {
    AX3 = { X: 0, Y: 1, Z: 2, A: 3 };
    OP = { "==": "EQ", "!=": "NE", "<": "LT", ">": "GT", "<=": "LE", ">=": "GE" };
    dialect3 = {
      id: "ddcs-v3-dm500",
      name: "DDCS V3 / DM500",
      programModel: "inline",
      probeModel: "move-until-input",
      dwellUnits: "s",
      vars: { dro: 864, probeStatus: null, probeTrig: 864, wcsBase: 804, wcsStride: 4, activeWcs: 455, toolTable: 1430, atc: null, ax: AX3 },
      // atc null: no confirmed tool-changer firmware model on the DM500
      caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false, atc: false },
      // M101/G01/M102 halts on the probe input; manual tool change only
      // move-until-input: arm (M101) → feed move → disarm (M102). probe.nc:23-25.
      probeMove: (axis, dist, { feed = 100 } = {}) => ["M101", `G91 G01 ${axis}${dist} F${feed}`, "M102"],
      probeStatus: () => [],
      // implicit — motion halts on input; no status var
      probeRead: (axis, varName) => [`${varName}=#${864 + AX3[axis]}`],
      // capture machine DRO at contact (probe.nc:4-6)
      readMachine: (axis, varName) => [`${varName}=#${864 + AX3[axis]}`],
      // DRO X#864/Y#865/Z#866/A#867
      machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
      // G53 gated by config #395; dump safe-Z is M98 P101 — TO CONFIRM
      // DM500 macros zero with G92 (defprobe.nc:21) — value is a WORK coord (plate thickness), NOT a machine coord
      // like Expert's register write. Cross-profile value semantics unresolved → VERIFY on hardware.
      setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}   ( set datum - VERIFY on hardware )`],
      readActiveWcs: (varName) => [`${varName}=#455`],
      // #455/#516 select coord system
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G04 P${sec}`],
      // P = SECONDS (probe.nc, slib.nc G82 P#9)
      endProgram: () => ["M30"],
      // m30.nc empty → controller default
      ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${OP[op] || op}${rhs} GOTO${label}`],
      // word ops; see notes re !=
      goto: (label) => [`GOTO${label}`],
      label: (n) => [`N${n}`],
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      spindleOff: () => ["M5"],
      coolant: (on) => [on ? "M8" : "M9"],
      hmiPrompt: () => [],
      // no scripted operator prompt (pause hook = a Z-lift only)
      hmiToast: () => [],
      hmiInput: () => [],
      // recognize(line): parse inverse of the DM500-specific emit (WORD IF ops, #864+ DRO, G92 WCS). The
      // move-until-input probe (M101 / G91 G01 … / M102) is a 3-line op the per-line parser can't fold back yet,
      // so its lines stay verbatim (raw) — lossless round-trip; proper decode needs parser look-ahead (TODO).
      recognize(line2) {
        const AXR = ["X", "Y", "Z", "A"];
        const OPI = { EQ: "==", NE: "!=", LT: "<", GT: ">", LE: "<=", GE: ">=" };
        let m;
        if (/^M10[12]$/.test(line2) || /^G91 G01 [XYZA]\S* F\S+$/.test(line2)) return { type: "raw", params: { text: line2 } };
        if (m = line2.match(/^IF (.+?)(EQ|NE|LT|GT|LE|GE)(.+?) GOTO(\d+)$/)) return { type: "ifgoto", params: { lhs: m[1], op: OPI[m[2]], rhs: m[3], goto: +m[4] } };
        if (m = line2.match(/^GOTO(\d+)$/)) return { type: "goto", params: { n: +m[1] } };
        if (m = line2.match(/^N(\d+)$/)) return { type: "label", params: { n: +m[1] } };
        if (m = line2.match(/^G90 G92 ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: "#578", axis: m[1], value: m[2] } };
        if (m = line2.match(/^(#\d+)=#(\d+)$/)) {
          const ax = +m[2] - 864;
          if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
        }
        return null;
      },
      notes: "STRUCTURALLY different: move-until-input probing (M101/G01/M102, no G31), #864-866 DRO, G92 WCS, dwell in SECONDS, WORD IF operators (EQ/LT/GT \u2014 `!=`/`NE` NOT in the dump; mapped to NE best-effort, verify before use). machineMove G53 gated by config #395 (dump safe-Z = M98 P101 subprogram) \u2014 TO CONFIRM. HMI absent. Verified vs bridge/controllers/dm500/install."
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/centroid.js
var AX4, dialect4;
var init_centroid = __esm({
  "../DDCS-Studio/web/wizards/dialects/centroid.js"() {
    AX4 = { X: 0, Y: 1, Z: 2, A: 3 };
    dialect4 = {
      id: "centroid",
      name: "Centroid CNC12 (Acorn)",
      programModel: "inline",
      probeModel: "move-until-input",
      dwellUnits: "s",
      // Centroid probes by move-until-input (stop AT contact) and writes WCS with G92/G10 — so it reads NO
      // trigger/status var. The machine-pos / WCS-offset / tool-table system vars are in operators-manual
      // §11.2.16 (not in our dump) ⇒ left null + TO CONFIRM. #4120 req tool / #4203 in-spindle are known.
      vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX4 },
      caps: { vars: true, flow: "goto", probeStatusCheck: false, hmi: true, toolTable: true, probePort: false },
      // M115 probe / M225 msg — TO CONFIRM on hardware
      // M115 /Z-10 P3 F20  (manual:309 "M115 /Z P3 F20"; corner-probe-FL.mac:38 "M115 /Z[..] P[..] F[..]").
      // Move-until-input: stops AT contact and AUTO-CANCELS WITH AN ERROR if the bound is reached without
      // contact (manual:868-869) — so no-contact protection is built in. `level` is unused on Centroid.
      probeMove: (axis, dist, { feed = 10, port = 3 } = {}) => [`M115 /${axis}${dist} P${port} F${feed}`],
      probeStatus: () => [],
      // [] — M115 errors out on no-contact (manual:868); no in-program status read
      probeRead: () => [],
      // [] — stops AT contact; define the point with setWorkOffset (G92), no trigger var
      readMachine: () => [],
      // TO CONFIRM — machine-pos system var is in operators manual §11.2.16, not in dump
      // G53 Z.5 / G53 X1  (manual:135-136). Machine-frame move; ref may be a LITERAL or #var (unlike DDCS,
      // which requires a #var). Optional trailing "L<feedrate>" (manual:174 "G53 X1 Y-1 L200").
      machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
      // G92 X<val>  (corner-probe-FL.mac:54 "G92 X[..]"; manual:312 "G92 Z.5"). Sets the ACTIVE WCS so current
      // pos = value — wcsExpr is unused (G92 acts on whatever WCS is active). Alt: G10 P<param> R<val> (manual:692).
      setWorkOffset: (wcsExpr, axis, value) => [`G92 ${axis}${value}`],
      readActiveWcs: () => [],
      // TO CONFIRM — active-WCS index var is in operators manual §11.2.16, not in dump
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G4 P${sec}`],
      // P = SECONDS (manual:495 "G4 P4 ;Wait 4 seconds"; :313 "G4 P .5")
      endProgram: () => ["M30"],
      // M30 for a top-level macro; M99 if the .mac is a subprogram (manual:193)
      // IF #100==1 THEN GOTO 200  (manual:451 "IF #50005 THEN GOTO 500"; :626 "IF #150 == 0 THEN GOTO 200").
      // Note THEN, and the space before the label. Verified ops: == (and =), <, > ; '!=','<=','>=' TO CONFIRM.
      ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} THEN GOTO ${label}`],
      goto: (label) => [`GOTO ${label}`],
      // space after GOTO (manual:453 "GOTO 1000") — unlike DDCS's GOTO1
      label: (n) => [`N${n}`],
      // N-block destinations (manual:98 "N1000", :510 "N200")
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      spindleOff: () => ["M5"],
      // manual:728 "M5 ;Stop Spindle"
      coolant: (on) => [on ? "M8" : "M9"],
      // standard flood/off; Acorn-PLC alt is M94/M95 SV_3 (manual:524)
      hmiPrompt: (msg) => [`M225 #0 "${msg}"`],
      // M225 #<timer> "msg"; timer 0 = wait for Cycle Start (manual:296-300).
      //                                              TO CONFIRM: dump pre-loads a user var (#100=0, manual:288); #0-as-0 unverified.
      hmiToast: (msg) => [`M225 #0 "${msg}"`],
      // Centroid has no non-blocking banner in a .mac — M225 always
      //                                              pauses; a timed display needs a preloaded timer var (see notes).
      hmiInput: (varName, prompt2) => [`M224 ${varName} "${prompt2}" #0`],
      // M224 <retvar> "prompt" <?>: dump (manual:514
      //   "M224 #100 \"..\" #105") then reads the FIRST var (#100) as the operator entry; trailing var role TO CONFIRM.
      notes: 'Centroid CNC12 (Acorn): in-program #var/branching like DDCS but a DISTINCT dialect \u2014 IF\u2026THEN\u2026GOTO/ELSE (note THEN; "GOTO 200" has a space, vs DDCS "GOTO1"), and PROBING is M115/M116 (move-until-input) not G31. M115 stops AT contact and AUTO-ERRORS on no-contact, so probeStatus/probeRead fold to [] (the DDCS fast/slow + IF\u2026GOTO collapses to an M115/M116 pair \u2014 LESS code). WCS via G92 (or G10 P R), not an indirect #var write. Dwell P = SECONDS (G4 P4). machineMove G53 takes a literal (no #var needed, unlike DDCS). HMI: M225 display (always pauses the macro \u2014 no non-blocking toast in a .mac), M224 operator input; the #0-as-zero-timer shortcut and M224 var-order are TO CONFIRM (dump pre-allocates a user timer var). NULL vars: machine-pos / active-WCS / WCS-offset / tool-table system vars live in mill operators manual \xA711.2.16, which is NOT in the captured dump \u21D2 readMachine/readActiveWcs return [] (TO CONFIRM). Verified vs bridge/controllers/centroid \u2014 assets/Centroid_CNC12_Macro_Programming.txt + corner-probe-FL.mac. NOT tested on owned hardware.'
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/rs274ngc.js
var AX5, NEG, dialect5;
var init_rs274ngc = __esm({
  "../DDCS-Studio/web/wizards/dialects/rs274ngc.js"() {
    AX5 = { X: 0, Y: 1, Z: 2, A: 3 };
    NEG = { "==": "ne", "!=": "eq", "<": "ge", ">": "le", "<=": "gt", ">=": "lt" };
    dialect5 = {
      id: "rs274ngc",
      name: "RS274NGC (LinuxCNC)",
      // grblHAL shares these forms but is its own post (grblhal.js)
      programModel: "inline",
      probeModel: "g38",
      dwellUnits: "s",
      // All confirmed in grblHAL ngc_params.c (each tagged `// LinuxCNC`): probeTrig #5061-69 (:301),
      // probeStatus #5070 (:302), activeWcs #5220 (:308), wcsBase #5221 stride 20 (:309 + :258 "/20"),
      // dro #5420-28 current-position (:321), toolTable #5401-09 active-tool offsets (:320-321, #5400=tool# :319).
      vars: { dro: 5420, probeStatus: 5070, probeTrig: 5061, wcsBase: 5221, wcsStride: 20, activeWcs: 5220, toolTable: 5401, ax: AX5 },
      caps: { vars: true, flow: "oword", probeStatusCheck: false, hmi: false, toolTable: true, probePort: false },
      // G38.2 alarms on no-contact; structured O-word flow
      // G38.2 Z-10 F100  (probe-hole.ngc:22 "G91 G38.2 X#1000"; gridprobe.ngc:35 "G38.2Z#8"). G38.2 ALARMs on
      // no-contact (host/controller catches) ⇒ probeStatus folds away, like Centroid's M115. `port`/`level` unused.
      probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],
      probeStatus: () => [],
      // [] — G38.2 alarms on no-contact; success param #5070 exists but no in-program GOTO branch
      // #50=#5061  (probe-hole.ngc:19 "#1001=#5061", :31 "#1005=#5062"). Trigger-position block #5061+axis (ngc_params.c:301)
      probeRead: (axis, varName) => [`${varName}=#${5061 + AX5[axis]}`],
      // #50=#5420  (ngc_params.c:321 work_position #5420-28). Current position in the active frame.
      readMachine: (axis, varName) => [`${varName}=#${5420 + AX5[axis]}`],
      machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],
      // machine-frame rapid; ref may be a literal or #var (gcode.c:65 G53 non-modal)
      // G10 L20 P1 X<val>  (sets WCS P so current pos = val). wcsExpr = active-WCS index 1..9. Standard RS274NGC
      // (LinuxCNC §G10; grblHAL gcode.c G10 modal :74). The clean DDCS-#[805+] equivalent.
      setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],
      readActiveWcs: (varName) => [`${varName}=#5220`],
      // #5220 = active coord-system number 1=G54… (ngc_params.c:308)
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G4 P${sec}`],
      // P = SECONDS in RS274NGC (gridprobe/LinuxCNC dwell)
      endProgram: () => ["M30"],
      // M30 (M2 also ends; .ngc files use M2, e.g. gridprobe.ngc:45)
      // FLOW IS STRUCTURED O-WORDS, NOT GOTO (grblHAL ngc_flowctrl.c:45-56 If/ElseIf/Else/EndIf/While/EndWhile/Sub).
      // ifGoto/label render a skip-block: `o<n> if [cond-negated]` … `o<n> endif`. goto() has no clean 1-line form.
      ifGoto: (lhs, op, rhs, label) => [`o${label} if [${lhs} ${NEG[op]} ${rhs}]`],
      goto: () => [],
      // [] — an unconditional GOTO has no single-line O-word equivalent (restructure: else/endif or M2)
      label: (n) => [`o${n} endif`],
      // closes the o<n> if-block opened by the matching ifGoto
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      spindleOff: () => ["M5"],
      coolant: (on) => [on ? "M8" : "M9"],
      // flood M8 / off M9 (mist M7 also standard)
      hmiPrompt: (msg) => [`(MSG,${msg})`, "M0"],
      // operator confirm = on-screen message + M0 program pause (resume on Cycle Start); no cancel signal
      hmiToast: (msg) => [`(MSG,${msg})`],
      // operator-message comment (probe-hole.ngc:84 uses (debug,…))
      hmiInput: () => [],
      // [] — no blocking numeric input in stream mode
      // recognize(line): parse inverse of the RS274NGC-specific emit. Flow is STRUCTURED O-WORDS: ifGoto emits
      // `o<n> if [cond NEGATED]` and label emits `o<n> endif`, so the inverse un-negates the word operator (INV).
      // Probe = G38.2; WCS = G10 L20; message = (MSG,…) — which looks like a comment, hence recognize runs first.
      recognize(line2) {
        const AXR = ["X", "Y", "Z", "A"];
        const nos = (s) => /[#[]/.test(s) ? s : Number.isFinite(Number(s)) ? Number(s) : s;
        const INV = { ne: "==", eq: "!=", ge: "<", le: ">", gt: "<=", lt: ">=" };
        let m;
        if (m = line2.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if (m = line2.match(/^o(\d+) if \[(.+?) (eq|ne|lt|gt|le|ge) (.+?)\]$/)) return { type: "ifgoto", params: { lhs: m[2], op: INV[m[3]], rhs: m[4], goto: +m[1] } };
        if (m = line2.match(/^o(\d+) endif$/)) return { type: "label", params: { n: +m[1] } };
        if (m = line2.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
        if (m = line2.match(/^\(MSG,(.*)\)$/)) return { type: "message", params: { text: m[1] } };
        if (m = line2.match(/^(#\d+)=#(\d+)$/)) {
          const sys = +m[2];
          let ax = sys - 5061;
          if (ax >= 0 && ax <= 3) return { type: "proberead", params: { axis: AXR[ax], var: m[1] } };
          ax = sys - 5420;
          if (ax >= 0 && ax <= 3) return { type: "readmachine", params: { axis: AXR[ax], var: m[1] } };
        }
        return null;
      },
      notes: 'RS274NGC family \u2014 grblHAL + LinuxCNC under ONE binding (grblHAL copied LinuxCNC: #5061 is tagged "// LinuxCNC" in ngc_params.c). Cleanest ~1:1 with DDCS concepts and free/open \u21D2 best distribution target. THE KEY DIFFERENCE: flow is STRUCTURED O-WORDS (o<n> if/elseif/else/endif, while/endwhile, sub/endsub/call) with WORD operators (eq ne lt gt le ge, ngc_expr.c:122) \u2014 NOT IF\u2026GOTO. So ifGoto/label here render a skip-block (ifGoto \u2192 "o<n> if [neg-cond]", label \u2192 "o<n> endif"); this models the common forward-skip idiom only \u2014 back-jump loops must be authored as o<n> while, and goto() returns [] (no 1-line equivalent). A fully general RS274NGC port wants a structured-flow emitter, not the GOTO line-emitter (cf. SCHEMA note on script dialects). Probing: G38.2 ALARMs on no-contact \u21D2 probeStatus folds to [] (like Centroid). WCS via G10 L20 (the clean DDCS-#[805+] equivalent). Dwell P = seconds. No blocking HMI in stream mode \u21D2 hmiPrompt/hmiInput [] , hmiToast \u2192 (MSG,\u2026). Caveat: grblHAL full O-word flow runs only for macros on SD/littlefs (stream mode limited); LinuxCNC has no such limit. Digital I/O (M62-65 / M66) is out of the SCHEMA core surface but available. Verified vs grblHAL-core-src (ngc_params/flowctrl/expr/gcode.c) + linuxcnc nc_files (gridprobe.ngc, probe-hole.ngc).'
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/grblhal.js
var dialect6;
var init_grblhal = __esm({
  "../DDCS-Studio/web/wizards/dialects/grblhal.js"() {
    init_rs274ngc();
    dialect6 = {
      ...dialect5,
      // identical RS274NGC emit forms + recognize() + vars (grblHAL = LinuxCNC for codegen)
      id: "grblhal",
      name: "grblHAL",
      caps: { ...dialect5.caps, flowStreamable: false },
      // O-word flow only from SD/littlefs, not while streaming
      notes: "grblHAL \u2014 RS274NGC emit forms shared with LinuxCNC (re-exports rs274ngc.js): same #5061 probe params, G38.2, G10 L20, O-word flow. The ONE difference is a capability, not syntax: grblHAL O-word flow runs only for macros on SD/littlefs, NOT while streaming over serial \u2014 so probe/ATC (flow-heavy) macros must be saved to the SD card. caps.flowStreamable=false. Verified vs grblHAL-core-src (shared with rs274ngc)."
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/grbl.js
var AX6, dialect7;
var init_grbl = __esm({
  "../DDCS-Studio/web/wizards/dialects/grbl.js"() {
    AX6 = { X: 0, Y: 1, Z: 2, A: 3 };
    dialect7 = {
      id: "grbl",
      name: "grbl 1.1",
      programModel: "streamed",
      probeModel: "g38",
      dwellUnits: "s",
      g53NeedsVar: false,
      // grbl G53 takes a literal coord directly (no #var staging — grbl has no #vars)
      vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX6 },
      caps: { vars: false, flow: "none", probeStatusCheck: false, hmi: false, toolTable: false, probePort: false },
      // streamed; host owns the logic
      probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],
      // result pushed as [PRB:…] over serial
      probeStatus: () => [],
      // [] — no in-program status var (host reads [PRB:…:1/0])
      probeRead: () => [],
      // [] — no #vars; host captures the probe report
      readMachine: () => [],
      // [] — no #vars; host reads the status report (<…|MPos:…>)
      machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],
      // machine-frame rapid (literal coord; G90 + G0 on the block)
      setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],
      // grbl 1.1 supports G10 L2/L20
      readActiveWcs: () => [],
      // [] — no #vars
      distMode: (mode) => mode === "inc" ? "G91" : "G90",
      dwell: (sec) => [`G4 P${sec}`],
      // P = seconds
      endProgram: () => ["M30"],
      // grbl supports M2 / M30
      ifGoto: () => [],
      // [] — no flow control in the part program (host state machine)
      goto: () => [],
      // [] — none
      label: () => [],
      // [] — none
      spindle: (dir, rpm) => [`${dir === "ccw" ? "M4" : "M3"} S${rpm}`],
      spindleOff: () => ["M5"],
      coolant: (on) => [on ? "M8" : "M9"],
      // flood M8 / off M9 (mist M7 also supported)
      hmiPrompt: () => [],
      // [] — no blocking prompt (host UI)
      hmiToast: (msg) => [`(${msg})`],
      // grbl ignores ( ) comments; host may surface them
      hmiInput: () => [],
      // recognize(line): grbl-specific emit is just probe / WCS / message (no #var or flow lines to fold back).
      recognize(line2) {
        const nos = (s) => Number.isFinite(Number(s)) ? Number(s) : s;
        let m;
        if (m = line2.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/)) return { type: "probe", params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if (m = line2.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/)) return { type: "setworkoffset", params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
        if (m = line2.match(/^\((MSG,)?(.*)\)$/)) return { type: "message", params: { text: m[2] } };
        return null;
      },
      notes: "Standard grbl 1.1 \u2014 streamed, host owns the logic. NO #vars / IF-GOTO / WHILE / subroutines / canned cycles (FINDINGS.md). A CUTTING target: geometry wizards emit clean grbl; probe/ATC on-controller flow folds to nothing (probing is host-side: stream G38.2, read [PRB:\u2026], issue G10 L20). G53 takes a literal (g53NeedsVar:false). grblHAL SD O-word flow = the rs274ngc post instead. Verified vs bridge/controllers/grbl."
    };
  }
});

// ../DDCS-Studio/web/wizards/dialects/index.js
function getDialect(profileId) {
  return DIALECTS[profileId] || DEFAULT_DIALECT;
}
function getCaps(id) {
  return { ...DEFAULT_CAPS, ...DIALECTS[id] && DIALECTS[id].caps || {} };
}
function listPosts() {
  return Object.values(DIALECTS).map((d) => ({ id: d.id, name: d.name, verified: POST_VERIFIED.has(d.id) }));
}
function isPostVerified(id) {
  return POST_VERIFIED.has(id);
}
function getActivePostId() {
  try {
    return localStorage.getItem(ACTIVE_POST_KEY) || "auto";
  } catch (e) {
    return "auto";
  }
}
function setActivePostId(id) {
  const v6 = id && DIALECTS[id] ? id : "auto";
  try {
    localStorage.setItem(ACTIVE_POST_KEY, v6);
  } catch (e) {
  }
  return v6;
}
function resolveActivePost(profileId) {
  const id = getActivePostId();
  return id !== "auto" && DIALECTS[id] ? DIALECTS[id] : getDialect(profileId);
}
var DIALECTS, DEFAULT_DIALECT, DEFAULT_CAPS, POST_VERIFIED, ACTIVE_POST_KEY;
var init_dialects = __esm({
  "../DDCS-Studio/web/wizards/dialects/index.js"() {
    init_ddcs_expert_m350();
    init_ddcs_v41();
    init_ddcs_v3_dm500();
    init_centroid();
    init_rs274ngc();
    init_grblhal();
    init_grbl();
    DIALECTS = {
      "ddcs-expert-m350": dialect,
      "ddcs-v41": dialect2,
      "ddcs-v3-dm500": dialect3,
      "centroid": dialect4,
      "rs274ngc": dialect5,
      "grblhal": dialect6,
      "grbl": dialect7
    };
    DEFAULT_DIALECT = dialect;
    DEFAULT_CAPS = { vars: true, flow: "goto", probeStatusCheck: true, hmi: true, toolTable: true, probePort: true, flowStreamable: true };
    POST_VERIFIED = /* @__PURE__ */ new Set(["ddcs-expert-m350", "ddcs-v41"]);
    ACTIVE_POST_KEY = "ddcs_active_post";
  }
});

// ../DDCS-Studio/web/wizards/cuttingBlocks.js
function num3(v6, d) {
  return v6 === "" || v6 == null || isNaN(Number(v6)) ? d : Number(v6);
}
function headerBlock({ spindle, rpm, dialect: dialect8 } = {}) {
  const d = dialect8 || DEFAULT_DIALECT;
  const L2 = ["G90   ( absolute )"];
  const r = num3(rpm, 0) > 0 ? num3(rpm, 0) : num3(spindle && spindle.defaultRpm, 0);
  if (r > 0) {
    L2.push(`${spindle && spindle.dir === "ccw" ? "M4" : "M3"} S${r}   ( spindle on )`);
    const up = num3(spindle && spindle.spinUp, 0);
    if (up > 0) {
      const dw = d.dwell(up);
      dw[dw.length - 1] += "   ( spin-up dwell )";
      L2.push(...dw);
    }
  }
  return L2;
}
function footerBlock({ endProgram, dialect: dialect8 } = {}) {
  const ep = endProgram || {};
  const d = dialect8 || DEFAULT_DIALECT;
  const L2 = [];
  if (ep.spindleOff !== false) L2.push("M5   ( spindle off )");
  if (ep.coolantOff !== false) L2.push("M9   ( coolant off )");
  const litG53 = d.g53NeedsVar === false;
  if (ep.retract !== false) {
    if (litG53) {
      const mv = d.machineMove("Z", num3(ep.retractZ, 0));
      mv[mv.length - 1] += "   ( retract )";
      L2.push(...mv);
    } else {
      L2.push(`#101 = ${num3(ep.retractZ, 0)}   ( safe Z - G53 needs a variable )`);
      const mv = d.machineMove("Z", "#101");
      mv[mv.length - 1] += "   ( retract )";
      L2.push(...mv);
    }
  }
  if (ep.park === true) {
    if (litG53) {
      const mx = d.machineMove("X", num3(ep.parkX, 0)), my = d.machineMove("Y", num3(ep.parkY, 0));
      my[my.length - 1] += "   ( park )";
      L2.push(...mx, ...my);
    } else {
      L2.push(`#102 = ${num3(ep.parkX, 0)}   ( park X - G53 needs a variable )`);
      L2.push(`#103 = ${num3(ep.parkY, 0)}   ( park Y - G53 needs a variable )`);
      const mx = d.machineMove("X", "#102"), my = d.machineMove("Y", "#103");
      my[my.length - 1] += "   ( park )";
      L2.push(...mx, ...my);
    }
  }
  L2.push(ep.end === "M2" ? "M2" : "M30");
  return L2;
}
var init_cuttingBlocks = __esm({
  "../DDCS-Studio/web/wizards/cuttingBlocks.js"() {
    init_dialects();
  }
});

// ../DDCS-Studio/web/wizards/ops/program.js
var progStartBlock, truthy, progEndBlock;
var init_program = __esm({
  "../DDCS-Studio/web/wizards/ops/program.js"() {
    init_util();
    init_cuttingBlocks();
    progStartBlock = {
      type: "progstart",
      label: "Program Start",
      kind: "leaf",
      category: "Machine",
      defaults: { rpm: 12e3, dir: "cw", spinUp: 0, clearance: 5 },
      fields: ["rpm", "dir", "spinUp", "clearance"],
      emit: (p, dx, dy, dialect8) => [
        ...headerBlock({ spindle: { dir: p.dir, spinUp: num(p.spinUp, 0) }, rpm: num(p.rpm, 0), dialect: dialect8 }),
        `G0 Z${num(p.clearance, 5)}   ( clearance )`
      ]
    };
    truthy = (v6) => v6 !== false && v6 !== "false" && v6 !== 0 && v6 !== "0";
    progEndBlock = {
      type: "progend",
      label: "Program End",
      kind: "leaf",
      category: "Machine",
      defaults: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: "M30" },
      fields: ["spindleOff", "coolantOff", "retract", "retractZ", "park", "parkX", "parkY", "end"],
      emit: (p, dx, dy, dialect8) => footerBlock({
        endProgram: {
          spindleOff: truthy(p.spindleOff),
          coolantOff: truthy(p.coolantOff),
          retract: truthy(p.retract),
          retractZ: num(p.retractZ, 0),
          park: p.park === true || p.park === "true",
          parkX: num(p.parkX, 0),
          parkY: num(p.parkY, 0),
          end: p.end || "M30"
        },
        dialect: dialect8
      })
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/flow.js
var labelBlock, gotoBlock, ifGotoBlock;
var init_flow = __esm({
  "../DDCS-Studio/web/wizards/ops/flow.js"() {
    init_util();
    labelBlock = {
      type: "label",
      label: "Label",
      kind: "leaf",
      category: "Control",
      defaults: { n: 1 },
      fields: ["n"],
      emit: (p, dx, dy, dialect8) => dialect8.label(Math.max(0, Math.round(num(p.n, 1))))
    };
    gotoBlock = {
      type: "goto",
      label: "Goto",
      kind: "leaf",
      category: "Control",
      defaults: { n: 1 },
      fields: ["n"],
      emit: (p, dx, dy, dialect8) => dialect8.goto(Math.max(0, Math.round(num(p.n, 1))))
    };
    ifGotoBlock = {
      type: "ifgoto",
      label: "If Goto",
      kind: "leaf",
      category: "Control",
      defaults: { lhs: "#1920", op: "!=", rhs: "2", goto: 1 },
      fields: ["lhs", "op", "rhs", "goto"],
      emit: (p, dx, dy, dialect8) => dialect8.ifGoto(
        p.lhs || "#1920",
        p.op || "!=",
        String(p.rhs ?? "0"),
        Math.max(0, Math.round(num(p.goto, 1)))
      )
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/measure.js
var probeReadBlock, probeCheckBlock, readMachineBlock, toolOffsetBlock;
var init_measure = __esm({
  "../DDCS-Studio/web/wizards/ops/measure.js"() {
    init_util();
    probeReadBlock = {
      type: "proberead",
      label: "Probe Read",
      kind: "leaf",
      category: "Machine",
      defaults: { axis: "Z", var: "#50" },
      fields: ["axis", "var"],
      emit: (p, dx, dy, dialect8) => dialect8.probeRead(p.axis || "Z", p.var || "#50")
    };
    probeCheckBlock = {
      type: "probecheck",
      label: "Probe Check",
      kind: "leaf",
      category: "Control",
      defaults: { axis: "Z", goto: 1 },
      fields: ["axis", "goto"],
      // jump to label <goto> if the probe didn't trigger
      emit: (p, dx, dy, dialect8) => dialect8.probeStatus(p.axis || "Z", Math.max(0, Math.round(num(p.goto, 1))))
    };
    readMachineBlock = {
      type: "readmachine",
      label: "Read Machine",
      kind: "leaf",
      category: "Machine",
      defaults: { axis: "Z", var: "#57" },
      fields: ["axis", "var"],
      emit: (p, dx, dy, dialect8) => dialect8.readMachine(p.axis || "Z", p.var || "#57")
    };
    toolOffsetBlock = {
      type: "tooloffset",
      label: "Tool Offset",
      kind: "leaf",
      category: "Machine",
      defaults: { tool: "#1300", value: "#102" },
      fields: ["tool", "value"],
      // Write a tool-length offset into the controller's tool table. PROFILE-AWARE: the table base comes from
      // dialect.vars.toolTable (Expert/DM500 #1430, V4.1 #1560), addressed by tool number → #[base + T - 1] = value.
      emit: (p, dx, dy, dialect8) => {
        const base = dialect8.vars && dialect8.vars.toolTable || 1430;
        return [`#[${base}+${p.tool || "#1300"}-1]=${p.value || "#102"}`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/setworkoffset.js
var setWorkOffsetBlock;
var init_setworkoffset = __esm({
  "../DDCS-Studio/web/wizards/ops/setworkoffset.js"() {
    init_util();
    setWorkOffsetBlock = {
      type: "setworkoffset",
      label: "Set WCS Offset",
      kind: "leaf",
      category: "Machine",
      defaults: { wcs: "#578", axis: "X", value: "#50" },
      fields: ["wcs", "axis", "value"],
      emit: (p, dx, dy, dialect8) => dialect8.setWorkOffset(
        p.wcs || "#578",
        p.axis || "X",
        p.value === "" || p.value == null ? 0 : typeof p.value === "number" ? num(p.value, 0) : p.value
      )
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/assign.js
var assignBlock;
var init_assign = __esm({
  "../DDCS-Studio/web/wizards/ops/assign.js"() {
    assignBlock = {
      type: "assign",
      label: "Set #",
      kind: "leaf",
      category: "Variables",
      defaults: { var: "#100", value: "0", note: "" },
      fields: ["var", "value", "note"],
      emit: (p) => {
        const v6 = p.var || "#100";
        const expr = p.value === "" || p.value == null ? "0" : p.value;
        const n = String(p.note ?? "").replace(/[()]/g, "").trim();
        return [n ? `${v6}=${expr} ( ${n} )` : `${v6}=${expr}`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/hmi.js
var clean, confirmBlock, pauseBlock, messageBlock, askNumberBlock;
var init_hmi = __esm({
  "../DDCS-Studio/web/wizards/ops/hmi.js"() {
    init_util();
    clean = (s) => String(s == null ? "" : s).replace(/[()]/g, "").trim();
    confirmBlock = {
      type: "confirm",
      label: "Confirm",
      kind: "leaf",
      category: "Control",
      defaults: { msg: "Press Enter to continue", cancel: 2 },
      fields: ["msg", "cancel"],
      // Operator OK/Cancel gate: the controller's blocking prompt (dialect.hmiPrompt → Expert `#1505=1(msg)`)
      // PLUS an ESC→cancel jump to <cancel>. PROFILE-AWARE: on controllers with no scripted prompt (V4.1/DM500
      // hmiPrompt → []) the whole gate folds to nothing, so the macro runs straight through (the operator just
      // positions the tool and starts the program). One granular block for "confirm or bail".
      emit: (p, dx, dy, dialect8) => {
        const prompt2 = dialect8.hmiPrompt(clean(p.msg));
        if (!prompt2.length) return [];
        if (!dialect8.hmiCancelVar) return prompt2;
        const lbl = Math.max(0, Math.round(num(p.cancel, 2)));
        return [...prompt2, ...dialect8.ifGoto(dialect8.hmiCancelVar, "==", "0", lbl)];
      }
    };
    pauseBlock = {
      type: "pause",
      label: "Pause",
      kind: "leaf",
      category: "Control",
      defaults: {},
      fields: [],
      emit: () => ["M00   ( pause - press Cycle Start to resume )"]
      // universal program stop
    };
    messageBlock = {
      type: "message",
      label: "Message",
      kind: "leaf",
      category: "Mark Up",
      defaults: { text: "check setup" },
      fields: ["text"],
      emit: (p, dx, dy, dialect8) => {
        const t = clean(p.text);
        const out = dialect8.hmiToast(t);
        return out.length ? out : [`( MSG: ${t} )`];
      }
    };
    askNumberBlock = {
      type: "asknumber",
      label: "Ask Number",
      kind: "leaf",
      category: "Control",
      defaults: { var: "#100", prompt: "enter value" },
      fields: ["var", "prompt"],
      emit: (p, dx, dy, dialect8) => {
        const v6 = (p.var || "#100").trim(), pr = clean(p.prompt);
        const out = dialect8.hmiInput(v6, pr);
        return out.length ? out : [`( ASK ${v6}: ${pr} - controller has no scripted input )`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/corner_config.js
var cornerConfigBlock;
var init_corner_config = __esm({
  "../DDCS-Studio/web/wizards/ops/corner_config.js"() {
    cornerConfigBlock = {
      type: "corner_config",
      label: "Config",
      kind: "leaf",
      category: "Control",
      defaults: { corner: "FL", probeSeq: "YX" },
      fields: ["corner", "probeSeq"],
      emit: (p) => {
        const corner = p.corner || "FL";
        const probeSeq = p.probeSeq || "YX";
        const cNum = { FL: 1, FR: 2, BL: 3, BR: 4 }[corner] || 1;
        const sNum = { XY: 1, YX: 2 }[probeSeq] || 2;
        return [
          `#30=${cNum} ( Corner: 1=FL 2=FR 3=BL 4=BR )`,
          `#31=${sNum} ( Sequence: 1=XY 2=YX )`
        ];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/cnc.js
var isOword, noFlow, isDDCS, pathModeBlock, drillCycleBlock, cancelCycleBlock, outPinBlock, waitInputBlock;
var init_cnc = __esm({
  "../DDCS-Studio/web/wizards/ops/cnc.js"() {
    init_util();
    isOword = (dialect8) => !!(dialect8.caps && dialect8.caps.flow === "oword");
    noFlow = (dialect8) => !!(dialect8.caps && dialect8.caps.flow === "none");
    isDDCS = (dialect8) => !!(dialect8.id && String(dialect8.id).startsWith("ddcs"));
    pathModeBlock = {
      type: "pathmode",
      label: "Path Mode",
      kind: "leaf",
      category: "Machine",
      defaults: { mode: "blend", tol: 0.01 },
      fields: ["mode", "tol"],
      gate: (d) => noFlow(d) ? "no G64 P / exact-stop" : null,
      // greyed on classic grbl (Blocks canvas)
      // G64 P<tol> = blend within tolerance (fast); G61 = exact stop (precise). RS274 standard; DDCS/Centroid
      // accept it (Fanuc-style). Classic grbl has no G64 P → fold to a comment.
      emit: (p, dx, dy, dialect8) => {
        const exact = p.mode === "exact";
        if (noFlow(dialect8)) return [`( path mode ${exact ? "exact stop" : "blend"} - not supported on ${dialect8.name} )`];
        if (exact) return ["G61"];
        const tol = num(p.tol, 0.01);
        return [tol > 0 ? `G64 P${r3(tol)}` : "G64"];
      }
    };
    drillCycleBlock = {
      type: "drillcycle",
      label: "Drill Cycle",
      kind: "leaf",
      category: "Ops",
      defaults: { cycle: "peck", x: "", y: "", z: -5, r: 2, q: 1, dwell: 0, feed: 200 },
      fields: ["cycle", "x", "y", "z", "r", "q", "dwell", "feed"],
      gate: (d) => noFlow(d) ? "no canned cycles \u2014 use the Drill wizard" : null,
      // Native canned cycle (modal): give X/Y to drill at a point, or leave blank to use the current position;
      // cancel with the Cancel Cycle atom (G80). G82 dwell P is in the dialect's dwell units. Classic grbl has no
      // canned cycles → fold to a comment (use the Drill wizard, which expands to plain moves).
      emit: (p, dx, dy, dialect8) => {
        if (noFlow(dialect8)) return [`( ${p.cycle} drill cycle - no canned cycles on ${dialect8.name}; use the Drill wizard )`];
        const G3 = { drill: "G81", dwell: "G82", peck: "G83", bore: "G85" }[p.cycle] || "G81";
        const at = (axis, v6) => v6 === "" || v6 == null ? "" : ` ${axis}${r3(num(v6, 0))}`;
        let s = `${G3}${at("X", p.x)}${at("Y", p.y)} Z${r3(num(p.z, -5))} R${r3(num(p.r, 2))}`;
        if (p.cycle === "peck") s += ` Q${r3(num(p.q, 1))}`;
        if (p.cycle === "dwell") s += ` P${r3(num(p.dwell, 0))}`;
        return [`${s} F${r3(num(p.feed, 200))}`];
      }
    };
    cancelCycleBlock = {
      type: "cancelcycle",
      label: "Cancel Cycle",
      kind: "leaf",
      category: "Ops",
      defaults: {},
      fields: [],
      gate: (d) => noFlow(d) ? "no canned cycles" : null,
      emit: (p, dx, dy, dialect8) => noFlow(dialect8) ? [] : ["G80"]
      // cancel any modal canned cycle
    };
    outPinBlock = {
      type: "outpin",
      label: "Output Pin",
      kind: "leaf",
      category: "Machine",
      defaults: { pin: 0, state: "on", sync: true },
      fields: ["pin", "state", "sync"],
      gate: (d) => isOword(d) || isDDCS(d) ? null : "no generic output \u2014 use an M-Code atom",
      // Digital output, per post:
      //   RS274/grblHAL → M62/M63 (synced) / M64/M65 (immediate) P<n>.
      //   DDCS          → raw output bit via M50/M52/M54… (set) / M51/M53/M55… (clear), i.e. M(50+2n)/M(51+2n);
      //                   these map to #1552+n in the firmware I/O macros (slib O10050-O10091). Pins 0-20.
      //   classic grbl  → no generic output → honest hint (use the M-Code atom).
      emit: (p, dx, dy, dialect8) => {
        const on = p.state !== "off";
        const pin = Math.max(0, Math.round(num(p.pin, 0)));
        if (isOword(dialect8)) return [`M${p.sync ? on ? 62 : 63 : on ? 64 : 65} P${pin}`];
        if (isDDCS(dialect8)) {
          if (pin > 20) return [`( output P${pin} out of range - DDCS raw outputs are pins 0-20 [M50-M91] )`];
          return [`M${(on ? 50 : 51) + pin * 2}   ( output P${pin} ${on ? "on" : "off"} )`];
        }
        return [`( output P${pin} ${on ? "on" : "off"} - use an M-Code atom on ${dialect8.name} )`];
      }
    };
    waitInputBlock = {
      type: "waitinput",
      label: "Wait Input",
      kind: "leaf",
      category: "Machine",
      defaults: { pin: 0, mode: "rise", timeout: 0, var: "#5399" },
      fields: ["pin", "mode", "timeout", "var"],
      gate: (d) => isOword(d) || isDDCS(d) && d.caps && d.caps.inputRead ? null : "wait-on-input: M66 (RS274) or DDCS Expert only \u2014 V4.1/DM500 use a sensor M-Code",
      // RS274/grblHAL wait-on-input: M66 P<n> L<mode> Q<timeout> → result in #5399 (L: 0 immediate, 1 rise, 2 fall,
      // 3 high, 4 low). DDCS EXPERT (caps.inputRead) → generic live-input poll WHILE [#[1520+N]!=L] (slib O10300);
      // V4.1/DM500 lack it → fold to a hint (use a named sensor M-code M300-307).
      emit: (p, dx, dy, dialect8) => {
        const pin = Math.max(0, Math.round(num(p.pin, 0)));
        if (isOword(dialect8)) {
          const L2 = { imm: 0, rise: 1, fall: 2, high: 3, low: 4 }[p.mode] ?? 1;
          const q = num(p.timeout, 0);
          return [`M66 P${pin} L${L2}${q > 0 ? ` Q${r3(q)}` : ""}`];
        }
        if (isDDCS(dialect8) && dialect8.caps && dialect8.caps.inputRead && dialect8.waitInput) {
          return dialect8.waitInput(pin, p.mode === "fall" || p.mode === "low" ? 0 : 1);
        }
        return [`( wait input P${pin} - use an M-Code atom on ${dialect8.name} )`];
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/more.js
var stopBlock, planeBlock, feedModeBlock, homeBlock, callBlock, returnBlock;
var init_more = __esm({
  "../DDCS-Studio/web/wizards/ops/more.js"() {
    init_util();
    stopBlock = {
      type: "stop",
      label: "Stop",
      kind: "leaf",
      category: "Control",
      defaults: { stop: "M0" },
      fields: ["stop"],
      // M0 = program stop · M1 = optional stop
      emit: (p) => [{ M0: "M0   ( program stop )", M1: "M1   ( optional stop )" }[p.stop] || "M0   ( program stop )"]
    };
    planeBlock = {
      type: "plane",
      label: "Plane",
      kind: "leaf",
      category: "Coordinates",
      defaults: { plane: "G17" },
      fields: ["plane"],
      emit: (p) => [{ G17: "G17   ( XY plane )", G18: "G18   ( XZ plane )", G19: "G19   ( YZ plane )" }[p.plane] || "G17   ( XY plane )"]
    };
    feedModeBlock = {
      type: "feedmode",
      label: "Feed Mode",
      kind: "leaf",
      category: "Cutting",
      defaults: { fmode: "G94" },
      fields: ["fmode"],
      emit: (p) => [{ G94: "G94   ( feed per min )", G95: "G95   ( feed per rev )" }[p.fmode] || "G94   ( feed per min )"]
    };
    homeBlock = {
      type: "home",
      label: "Home",
      kind: "leaf",
      category: "Move",
      defaults: { axes: "Z" },
      fields: ["axes"],
      // axes to reference-return via their 0 intermediate, e.g. Z, XY, XYZ
      emit: (p) => {
        const words = (String(p.axes || "Z").toUpperCase().match(/[XYZA]/g) || ["Z"]).map((a) => `${a}0`).join(" ");
        return [`G28 ${words}   ( reference return )`];
      }
    };
    callBlock = {
      type: "call",
      label: "Call (M98)",
      kind: "leaf",
      category: "Control",
      defaults: { prog: 9e3 },
      fields: ["prog"],
      // O-number of an installed subprogram (probe.nc, T.nc, a CAM slot…)
      emit: (p) => [`M98 P${num(p.prog, 0)}   ( call subprogram )`]
    };
    returnBlock = {
      type: "return",
      label: "Return (M99)",
      kind: "leaf",
      category: "Control",
      defaults: {},
      fields: [],
      emit: () => ["M99   ( subprogram return )"]
    };
  }
});

// ../DDCS-Studio/web/wizards/ops/expr.js
function evalExpr(src, scope = {}) {
  if (typeof src === "number") return src;
  const s = String(src);
  let i = 0;
  const ws = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };
  function add() {
    let v7 = mul();
    for (; ; ) {
      ws();
      const c2 = s[i];
      if (c2 === "+") {
        i++;
        v7 += mul();
      } else if (c2 === "-") {
        i++;
        v7 -= mul();
      } else return v7;
    }
  }
  function mul() {
    let v7 = unary();
    for (; ; ) {
      ws();
      const c2 = s[i];
      if (c2 === "*") {
        i++;
        v7 *= unary();
      } else if (c2 === "/") {
        i++;
        v7 /= unary();
      } else if (c2 === "%") {
        i++;
        v7 %= unary();
      } else return v7;
    }
  }
  function unary() {
    ws();
    if (s[i] === "-") {
      i++;
      return -unary();
    }
    if (s[i] === "+") {
      i++;
      return unary();
    }
    return primary();
  }
  function primary() {
    ws();
    if (s[i] === "(") {
      i++;
      const v7 = add();
      ws();
      if (s[i] !== ")") throw new Error("expected )");
      i++;
      return v7;
    }
    const n = /^\d*\.?\d+(?:e[-+]?\d+)?/i.exec(s.slice(i));
    if (n) {
      i += n[0].length;
      return parseFloat(n[0]);
    }
    const id = /^[A-Za-z_]\w*/.exec(s.slice(i));
    if (id) {
      i += id[0].length;
      if (id[0] in scope) return Number(scope[id[0]]);
      throw new Error("unknown var: " + id[0]);
    }
    throw new Error("unexpected: " + (s[i] ?? "end"));
  }
  ws();
  if (i >= s.length) throw new Error("empty expression");
  const v6 = add();
  ws();
  if (i < s.length) throw new Error("trailing input: " + s.slice(i));
  if (!Number.isFinite(v6)) throw new Error("not a finite number");
  return v6;
}
var init_expr = __esm({
  "../DDCS-Studio/web/wizards/ops/expr.js"() {
  }
});

// ../DDCS-Studio/web/wizards/ops/index.js
var PALETTE, RECAT, CATEGORIES, BLOCKS;
var init_ops = __esm({
  "../DDCS-Studio/web/wizards/ops/index.js"() {
    init_drill();
    init_bore();
    init_line();
    init_slot();
    init_wall();
    init_region();
    init_stepover();
    init_fill();
    init_fillText();
    init_stepdown();
    init_probe();
    init_array();
    init_helix();
    init_count();
    init_iff();
    init_compare();
    init_set();
    init_move();
    init_arc();
    init_spindle();
    init_feed();
    init_dwell();
    init_coolant();
    init_tool();
    init_wcs();
    init_distmode();
    init_comment();
    init_variable();
    init_math();
    init_macro();
    init_program();
    init_flow();
    init_measure();
    init_setworkoffset();
    init_assign();
    init_hmi();
    init_corner_config();
    init_cnc();
    init_more();
    init_expr();
    init_clearing();
    PALETTE = [
      regionBlock,
      // Shapes (boundary → fills/walls via a region socket)
      moveBlock,
      arcBlock,
      probeBlock,
      machineMoveBlock,
      homeBlock,
      // Move (+ G53 machine-coord move + G28 home)
      spindleBlock,
      feedBlock,
      feedModeBlock,
      dwellBlock,
      coolantBlock,
      toolBlock,
      wcsBlock,
      distModeBlock,
      planeBlock,
      pathModeBlock,
      // Machine modal state (+ G94/95 feed mode, G17-19 plane)
      progStartBlock,
      progEndBlock,
      endProgramBlock,
      mcodeBlock,
      rawBlock,
      probeReadBlock,
      readMachineBlock,
      toolOffsetBlock,
      setWorkOffsetBlock,
      outPinBlock,
      waitInputBlock,
      // Machine (framing, end, raw, probe/DRO capture, tool-table/WCS write, digital I/O M62-66)
      lineBlock,
      slotBlock,
      boreBlock,
      drillBlock,
      wallBlock,
      drillCycleBlock,
      cancelCycleBlock,
      // Ops (feature presets + wall finish + native canned cycles G81-85/G80)
      arrayBlock,
      helixBlock,
      fillZigzagBlock,
      fillConcentricBlock,
      fillTextBlock,
      stepoverBlock,
      stepdownBlock,
      // Modify (stamp/sweep + lateral fills [zigzag/concentric/text] + depth pass wrappers)
      countBlock,
      ifBlock,
      compareBlock,
      probeCheckBlock,
      ifGotoBlock,
      labelBlock,
      gotoBlock,
      callBlock,
      returnBlock,
      stopBlock,
      pauseBlock,
      confirmBlock,
      askNumberBlock,
      // Control (loop/cond/bool + probe-branch + if-goto + label/goto + M98/M99 subprogram + M0/M1 stop + pause/confirm/input)
      mathBlock,
      // Math (reporter — drags into value sockets)
      setBlock,
      assignBlock,
      variableBlock,
      // Variables (compile-time Set + runtime Set # + reporter)
      commentBlock,
      messageBlock,
      // Mark Up (comment + on-screen operator message)
      cornerConfigBlock
      // Universal Corner Macro config (emits #30 and #31)
    ];
    RECAT = {
      spindle: "Cutting",
      feed: "Cutting",
      dwell: "Cutting",
      coolant: "Cutting",
      tool: "Cutting",
      wcs: "Coordinates",
      distmode: "Coordinates",
      setworkoffset: "Coordinates",
      tooloffset: "Coordinates",
      progstart: "Program",
      progend: "Program",
      endprogram: "Program",
      proberead: "Probing",
      readmachine: "Probing",
      mcode: "Signals",
      raw: "Signals",
      outpin: "Signals",
      waitinput: "Signals",
      pathmode: "Move"
    };
    PALETTE.forEach((d) => {
      if (RECAT[d.type]) d.category = RECAT[d.type];
    });
    CATEGORIES = ["Shapes", "Move", "Ops", "Modify", "Cutting", "Coordinates", "Program", "Probing", "Control", "Math", "Variables", "Signals", "Mark Up"];
    BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));
  }
});

// ../DDCS-Studio/web/blocks/blockly/bridge.js
function fieldKind(def, field3) {
  if (optionsFor(def, field3)) return "dropdown";
  const sock = def.sockets && def.sockets[field3];
  if (sock === "region") return "region";
  if (sock === "boolean") return "boolean";
  const d = def.defaults[field3];
  if (typeof d === "boolean") return "checkbox";
  if (typeof d === "number") return "value";
  return "text";
}
function jsonDef(def) {
  const args = [];
  let message = def.label, n = 0;
  for (const f of fieldsOf(def)) {
    const k = fieldKind(def, f);
    message += ` ${f} %${++n}`;
    const desc = getDesc(f);
    if (k === "dropdown") args.push({ type: "field_dropdown", name: FN(f), options: optionsFor(def, f).map((o) => Array.isArray(o) ? o : [o, o]), tooltip: desc });
    else if (k === "checkbox") args.push({ type: "field_checkbox", name: FN(f), checked: def.defaults[f] !== false, tooltip: desc });
    else if (k === "text") args.push({ type: "field_input", name: FN(f), text: String(def.defaults[f] ?? ""), tooltip: desc });
    else if (k === "region") args.push({ type: "input_value", name: FN(f), check: "Region", tooltip: desc });
    else if (k === "boolean") args.push({ type: "input_value", name: FN(f), check: "Boolean", tooltip: desc });
    else args.push({ type: "input_value", name: FN(f), check: "Number", tooltip: desc });
  }
  if (isWrap(def)) {
    message += ` %${++n}`;
    args.push({ type: "input_statement", name: "DO" });
  }
  const block = {
    type: def.type,
    message0: message,
    args0: args,
    inputsInline: true,
    style: catSlug(def.category) + "_style",
    tooltip: `${def.label} (${def.category})`
  };
  if (def.kind === "reporter") block.output = outputCheck(def);
  else {
    block.previousStatement = null;
    block.nextStatement = null;
  }
  return block;
}
function installBlockly(Blockly2) {
  _Blockly = Blockly2;
  Blockly2.defineBlocksWithJsonArray([...PALETTE.map(jsonDef), ...OP_BLOCKS]);
}
function buildToolbox() {
  const byCat = {};
  PALETTE.forEach((def) => {
    const inputs = {};
    fieldsOf(def).forEach((f) => {
      if (fieldKind(def, f) === "value") inputs[FN(f)] = shadow(def.defaults[f]);
    });
    (byCat[def.category] ||= []).push({ kind: "block", type: def.type, ...Object.keys(inputs).length ? { inputs } : {} });
  });
  const cats = CATEGORIES.filter((c2) => byCat[c2]).map((c2) => ({
    kind: "category",
    name: c2,
    categorystyle: catSlug(c2) + "_cat",
    contents: byCat[c2]
  }));
  return { kind: "categoryToolbox", contents: cats };
}
var SELECTS, catSlug, FN, REPORTER_CHECK, outputCheck, isWrap, fieldsOf, DESCRIPTIONS, getDesc, optionsFor, makeOpDef, OP_BLOCKS, _Blockly, getBlockly, shadow;
var init_bridge = __esm({
  "../DDCS-Studio/web/blocks/blockly/bridge.js"() {
    init_ops();
    SELECTS = {
      corner: ["FL", "FR", "BL", "BR"],
      probeSeq: ["XY", "YX"],
      axis: ["X", "Y", "Z", "A", "B", "C"],
      axisDir: ["pos", "neg"],
      featureType: ["boss", "pocket", "bore"],
      wcs: ["active", "G54", "G55", "G56", "G57", "G58", "G59", "G59P1", "G59P2", "G59P3", "G59P4", "G59P5", "G59P6", "G59P7", "G59P8", "G59P9", "G59P10"],
      slave: [["A", "3"], ["B", "4"], ["C", "5"]],
      atcMode: ["auto", "manual"],
      testMode: ["current", "all"],
      wcsSys: [["Auto", "0"], ["G54", "54"], ["G55", "55"], ["G56", "56"], ["G57", "57"], ["G58", "58"], ["G59", "59"]],
      commType: [["Popup", "popup"], ["Status", "status"], ["Input", "input"], ["Beep", "beep"], ["Dwell", "dwell"]],
      fmode: ["G94", "G95"],
      plane: ["G17", "G18", "G19"],
      dist: ["abs", "inc"],
      stop: ["M0", "M1"],
      cycle: ["drill", "dwell", "peck", "bore"],
      state: ["on", "off"]
    };
    catSlug = (c2) => (c2 || "Ops").toLowerCase().replace(/\s+/g, "");
    FN = (field3) => field3.toUpperCase();
    REPORTER_CHECK = { boolean: "Boolean", region: "Region" };
    outputCheck = (def) => REPORTER_CHECK[def.returns] || "Number";
    isWrap = (def) => ["container", "path", "loop", "cond", "depth", "fill"].includes(def.kind);
    fieldsOf = (def, params) => (def.fieldsFor ? def.fieldsFor(params || def.defaults) : def.fields) || [];
    DESCRIPTIONS = {
      fmode: "Feed Mode: G94 (Units/Min) or G95 (Units/Rev)",
      plane: "Arc/Compensation Plane (G17 XY, G18 XZ, G19 YZ)",
      dist: "Distance Mode: Absolute (G90) or Incremental (G91)",
      stop: "Stop Type: M0 (Program Stop) or M1 (Optional Stop)",
      cycle: "Canned Cycle Type (Drill, Dwell, Peck, Bore)",
      state: "Output State (On/Off)",
      mode: "Mode of operation",
      x: "X coordinate",
      y: "Y coordinate",
      z: "Z coordinate",
      r: "Retract/R plane",
      q: "Peck depth / Timeout",
      dwell: "Dwell time (ms or s)",
      feed: "Feed rate",
      pin: "I/O Pin Number",
      var: "Variable to store result",
      tol: "Tolerance / Blend radius",
      op: "Operator",
      axes: "Axes to reference",
      prog: "Program Number (O-word)",
      sys: "Work Coordinate System (0-6)",
      axisx: "Enable X Axis",
      axisy: "Enable Y Axis",
      axisz: "Enable Z Axis",
      sync: "Synchronize movement",
      slave: "Slave axis alignment",
      type: "Communication type",
      color: "Popup/Beep color or mode",
      corner: "Corner to probe",
      probeseq: "Probe Sequence (XY or YX)",
      wcs: "Target WCS for result",
      probez: "Probe Z axis first",
      synca: "Sync A axis",
      qstop: "Quick stop on error",
      axis: "Axis to probe/move",
      axisdir: "Direction of movement",
      featuretype: "Feature type (Boss, Pocket, Bore)",
      dir1: "Direction 1",
      dir2: "Direction 2",
      twoaxis: "Enable 2-Axis probe",
      waitspindle: "Wait for spindle",
      dustcover: "Dust cover control",
      confirm: "Wait for operator confirmation",
      radius: "Radius of the feature",
      depth: "Depth to cut",
      step: "Stepover / Stepdown amount",
      speed: "Spindle speed (RPM)",
      dir: "Spindle direction (CW / CCW)",
      coolant: "Coolant (Flood / Mist / Off)",
      tool: "Tool Number (T)",
      value: "Value to set"
    };
    getDesc = (f) => DESCRIPTIONS[f.toLowerCase()] || `The ${f} parameter`;
    optionsFor = (def, field3) => {
      if (field3 === "op") return def.type === "compare" || def.type === "ifgoto" ? ["<", ">", "<=", ">=", "==", "!="] : ["+", "-", "*", "/", "%"];
      if (field3 === "mode") {
        if (def.type === "pathmode") return ["blend", "exact"];
        if (def.type === "waitinput") return ["imm", "rise", "fall", "high", "low"];
        if (def.type === "move") return ["cut", "rapid", "probe"];
      }
      return SELECTS[field3] || null;
    };
    makeOpDef = (type, label, msgAdd = "", argsAdd = []) => ({
      type,
      message0: `\u2B21 %1 ${msgAdd}`,
      args0: [
        { type: "field_label_serializable", name: "LABEL", text: label, tooltip: getDesc(type) },
        ...argsAdd.map((a) => ({ ...a, tooltip: getDesc(a.name) }))
      ],
      message1: "%1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Recorded op \u2014 edit via its wizard."
    });
    OP_BLOCKS = [
      makeOpDef("op", "op"),
      makeOpDef("corner_op", "Corner Probe", "Corner %2 Seq %3 WCS %4 Z-First %5 Sync %6 Slave %7 Stop %8", [
        { type: "field_dropdown", name: "CORNER", options: SELECTS.corner.map((o) => [o, o]) },
        { type: "field_dropdown", name: "PROBESEQ", options: SELECTS.probeSeq.map((o) => [o, o]) },
        { type: "field_dropdown", name: "WCS", options: SELECTS.wcs.map((o) => [o, o]) },
        { type: "field_checkbox", name: "PROBEZ", checked: false },
        { type: "field_checkbox", name: "SYNCA", checked: false },
        { type: "field_dropdown", name: "SLAVE", options: SELECTS.slave },
        { type: "field_checkbox", name: "QSTOP", checked: false }
      ]),
      makeOpDef("edge_op", "Edge Probe", "Axis %2 Dir %3 WCS %4 Sync %5 Slave %6 Stop %7", [
        { type: "field_dropdown", name: "AXIS", options: SELECTS.axis.map((o) => [o, o]) },
        { type: "field_dropdown", name: "AXISDIR", options: SELECTS.axisDir.map((o) => [o, o]) },
        { type: "field_dropdown", name: "WCS", options: SELECTS.wcs.map((o) => [o, o]) },
        { type: "field_checkbox", name: "SYNCA", checked: false },
        { type: "field_dropdown", name: "SLAVE", options: SELECTS.slave },
        { type: "field_checkbox", name: "QSTOP", checked: false }
      ]),
      makeOpDef("circular_op", "Circular Probe", "Type %2 WCS %3 Stop %4", [
        { type: "field_dropdown", name: "FEATURETYPE", options: SELECTS.featureType.map((o) => [o, o]) },
        { type: "field_dropdown", name: "WCS", options: SELECTS.wcs.map((o) => [o, o]) },
        { type: "field_checkbox", name: "QSTOP", checked: false }
      ]),
      makeOpDef("middle_op", "Middle Probe", "Type %2 Axis %3 Dir %4 %5 2-Axis Dir2 %6 WCS %7 Sync %8 Slave %9 Stop %10", [
        { type: "field_dropdown", name: "FEATURETYPE", options: SELECTS.featureType.map((o) => [o, o]) },
        { type: "field_dropdown", name: "AXIS", options: SELECTS.axis.map((o) => [o, o]) },
        { type: "field_dropdown", name: "DIR1", options: SELECTS.axisDir.map((o) => [o, o]) },
        { type: "field_checkbox", name: "TWOAXIS", checked: false },
        { type: "field_dropdown", name: "DIR2", options: SELECTS.axisDir.map((o) => [o, o]) },
        { type: "field_dropdown", name: "WCS", options: SELECTS.wcs.map((o) => [o, o]) },
        { type: "field_checkbox", name: "SYNCA", checked: false },
        { type: "field_dropdown", name: "SLAVE", options: SELECTS.slave },
        { type: "field_checkbox", name: "QSTOP", checked: false }
      ]),
      makeOpDef("atc_change_op", "ATC Tool Change", "Mode %2 Wait-Spindle %3 Dust-Cover %4 Confirm %5", [
        { type: "field_dropdown", name: "MODE", options: SELECTS.atcMode.map((o) => [o, o]) },
        { type: "field_checkbox", name: "WAITSPINDLE", checked: true },
        { type: "field_checkbox", name: "DUSTCOVER", checked: false },
        { type: "field_checkbox", name: "CONFIRM", checked: false }
      ]),
      makeOpDef("atc_test_op", "ATC Magazine Test", "Mode %2 Wait-Spindle %3 Dust-Cover %4", [
        { type: "field_dropdown", name: "MODE", options: SELECTS.testMode.map((o) => [o, o]) },
        { type: "field_checkbox", name: "WAITSPINDLE", checked: true },
        { type: "field_checkbox", name: "DUSTCOVER", checked: false }
      ]),
      makeOpDef("atc_check_op", "ATC Tool Check", "Wait-Spindle %2 Dust-Cover %3", [
        { type: "field_checkbox", name: "WAITSPINDLE", checked: true },
        { type: "field_checkbox", name: "DUSTCOVER", checked: false }
      ]),
      makeOpDef("atc_length_op", "ATC Tool Length", ""),
      makeOpDef("atc_warmup_op", "ATC Spindle Warmup", ""),
      makeOpDef("surfacing_op", "Surfacing", ""),
      makeOpDef("pocket_op", "Pocket", ""),
      makeOpDef("slot_op", "Slot", ""),
      makeOpDef("drill_op", "Drill", ""),
      makeOpDef("text_op", "Text", ""),
      makeOpDef("wcs_op", "WCS", "Target %2 X %3 Y %4 Z %5 Sync %6 Slave %7", [
        { type: "field_dropdown", name: "SYS", options: SELECTS.wcsSys },
        { type: "field_checkbox", name: "AXISX", checked: true },
        { type: "field_checkbox", name: "AXISY", checked: true },
        { type: "field_checkbox", name: "AXISZ", checked: true },
        { type: "field_checkbox", name: "SYNC", checked: false },
        { type: "field_dropdown", name: "SLAVE", options: SELECTS.slave }
      ]),
      makeOpDef("comm_op", "Communication", "Type %2 Mode %3 Color %4", [
        { type: "field_dropdown", name: "TYPE", options: SELECTS.commType },
        { type: "field_number", name: "MODE", value: 1 },
        { type: "field_number", name: "COLOR", value: -1 }
      ])
    ];
    _Blockly = null;
    getBlockly = () => _Blockly;
    shadow = (v6) => ({ shadow: { type: "math_number", fields: { NUM: Number(v6) || 0 } } });
  }
});

// ../DDCS-Studio/web/blocks/blockly/theme.js
function tok(name, fallback) {
  try {
    const v6 = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v6 || fallback;
  } catch (_) {
    return fallback;
  }
}
function ddcsTheme(Blockly2) {
  const app = document.body && document.body.getAttribute("data-theme") || "default";
  if (cache[app]) return cache[app];
  const blockStyles = {};
  for (const k in CAT) blockStyles[k + "_style"] = { colourPrimary: CAT[k] };
  Object.assign(blockStyles, {
    logic_blocks: { colourPrimary: CAT.control },
    loop_blocks: { colourPrimary: CAT.control },
    math_blocks: { colourPrimary: CAT.math },
    variable_blocks: { colourPrimary: CAT.variables },
    text_blocks: { colourPrimary: CAT.markup }
  });
  const categoryStyles = {};
  for (const k in CAT) categoryStyles[k + "_cat"] = { colour: CAT[k] };
  const accent = tok("--accent", "#2dd4bf");
  const theme = Blockly2.Theme.defineTheme("ddcs-" + app, {
    base: Blockly2.Themes.Classic,
    blockStyles,
    categoryStyles,
    // CHROME follows the app theme (fallbacks = the original dark scheme for themeless contexts):
    componentStyles: {
      workspaceBackgroundColour: tok("--bg", "#0d1117"),
      toolboxBackgroundColour: tok("--panel2", tok("--panel", "#161d28")),
      toolboxForegroundColour: tok("--text", "#cbd5e1"),
      flyoutBackgroundColour: tok("--panel2", tok("--panel", "#11171f")),
      flyoutForegroundColour: tok("--text-dim", "#8b97a6"),
      flyoutOpacity: 1,
      scrollbarColour: tok("--border", "#39465a"),
      insertionMarkerColour: accent,
      insertionMarkerOpacity: 0.4,
      markerColour: accent,
      cursorColour: accent,
      selectedGlowColour: accent,
      selectedGlowOpacity: 0.6
    },
    fontStyle: { family: "ui-sans-serif, system-ui, Segoe UI, sans-serif", size: 11 }
  });
  cache[app] = theme;
  return theme;
}
var CAT, cache;
var init_theme = __esm({
  "../DDCS-Studio/web/blocks/blockly/theme.js"() {
    CAT = {
      shapes: "#3b82f6",
      move: "#14b8a6",
      ops: "#22c55e",
      modify: "#a855f7",
      // the former overloaded 'Machine' bucket, split into granular groups (see wizards/ops/index.js RECAT)
      cutting: "#f97316",
      coordinates: "#0ea5e9",
      program: "#64748b",
      probing: "#e11d48",
      signals: "#8b5cf6",
      control: "#f59e0b",
      math: "#84cc16",
      variables: "#06b6d4",
      markup: "#94a3b8",
      machine: "#64748b"
      // legacy alias (no blocks use it now)
    };
    cache = {};
  }
});

// ../DDCS-Studio/web/ui/uiUtils.js
function makeDraggable(element, handle, opts = {}) {
  if (!element || !handle || handle.dataset.dragBound) return;
  handle.dataset.dragBound = "1";
  handle.style.cursor = "move";
  handle.style.touchAction = "none";
  const ignore = opts.ignore || "button, input, select, textarea, a";
  let sx = 0, sy = 0, ox = 0, oy = 0, pid = null;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest && e.target.closest(ignore)) return;
    const r = element.getBoundingClientRect();
    Object.assign(element.style, {
      position: "fixed",
      margin: "0",
      transform: "none",
      left: r.left + "px",
      top: r.top + "px",
      right: "auto",
      bottom: "auto"
    });
    sx = e.clientX;
    sy = e.clientY;
    ox = r.left;
    oy = r.top;
    pid = e.pointerId;
    try {
      handle.setPointerCapture(pid);
    } catch (_) {
    }
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (pid === null || e.pointerId !== pid) return;
    element.style.left = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx)) + "px";
    element.style.top = Math.max(0, Math.min(window.innerHeight - 30, oy + e.clientY - sy)) + "px";
  });
  const end = () => {
    if (pid === null) return;
    try {
      handle.releasePointerCapture(pid);
    } catch (_) {
    }
    pid = null;
    if (opts.onEnd) opts.onEnd();
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
var el, UIUtils;
var init_uiUtils = __esm({
  "../DDCS-Studio/web/ui/uiUtils.js"() {
    el = (id) => document.getElementById(id);
    UIUtils = class {
      static showTooltip(element, content, xOffset = 10) {
        const tooltip = el("global-tooltip");
        if (!tooltip) return;
        const rect = element.getBoundingClientRect();
        const margin = 8;
        tooltip.textContent = content;
        tooltip.style.display = "block";
        const tw = tooltip.offsetWidth || 300;
        const th = tooltip.offsetHeight || 60;
        let left = rect.right + xOffset;
        if (left + tw > window.innerWidth - margin) left = rect.left - tw - xOffset;
        if (left < margin) left = margin;
        let top = rect.top;
        if (top + th > window.innerHeight - margin) top = window.innerHeight - th - margin;
        if (top < margin) top = margin;
        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
      }
      static hideTooltip() {
        const tooltip = el("global-tooltip");
        if (tooltip) {
          tooltip.style.display = "none";
        }
      }
      static insertAtCursor(textArea, text) {
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = textArea.value.slice(0, start) + text + textArea.value.slice(end);
        const newPos = start + text.length;
        const selEnd = Math.min(textArea.value.length, newPos + 1);
        textArea.selectionStart = newPos;
        textArea.selectionEnd = selEnd;
        textArea.dispatchEvent(new Event("input"));
      }
      static downloadFile(filename, content) {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      static formatGCode(code) {
        if (!code) return "";
        const safeCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const formatLine = (line2) => line2.replace(
          /(\([^\)]*\)|(?<!&(?:lt|gt|amp));[^\n]*)|(\b[Gg]31\b)|([Mm]\d+)|([XYZABxyzab])/g,
          (match, comment2, g31, mcode, axis) => {
            if (comment2) return `<span class="g-comment">${match}</span>`;
            if (g31) return `<span style="color:#60a5fa; font-weight:bold;">${match}</span>`;
            if (mcode) return `<span style="color:#fca5a5">${match}</span>`;
            if (axis) return `<span style="color:#facc15">${match}</span>`;
            return match;
          }
        );
        return safeCode.split(/\r?\n/).map(
          (line2, index) => `<span class="g-line" data-line-index="${index}">${formatLine(line2)}</span>`
        ).join("\n");
      }
    };
  }
});

// ../DDCS-Studio/web/blocks/blockModel.js
function newBlock(type) {
  const def = BLOCKS[type];
  if (!def) throw new Error(`unknown block type: ${type}`);
  const b2 = { id: `${type}${++_seq}`, type, params: { ...def.defaults } };
  if (["container", "path", "loop", "cond", "depth", "fill"].includes(def.kind)) b2.children = [];
  return b2;
}
function resolveValue(v6, scope) {
  if (v6 == null || v6 === "") return 0;
  if (typeof v6 === "number") return v6;
  if (typeof v6 === "string") {
    try {
      return evalExpr(v6, scope);
    } catch {
      return NaN;
    }
  }
  const def = BLOCKS[v6.type];
  return def && def.reduce ? def.reduce(v6.params || {}, scope, (c2) => resolveValue(c2, scope)) : 0;
}
function resolveBool(v6, scope) {
  if (v6 == null || v6 === "") return false;
  if (typeof v6 === "number") return v6 !== 0;
  if (typeof v6 === "string") {
    try {
      return evalExpr(v6, scope) !== 0;
    } catch {
      return false;
    }
  }
  const def = BLOCKS[v6.type];
  return def && def.reduce ? !!def.reduce(v6.params || {}, scope, (c2) => resolveValue(c2, scope)) : false;
}
function resolveParams(params, scope) {
  const out = {};
  for (const k in params) {
    const v6 = params[k];
    if (v6 && typeof v6 === "object") out[k] = resolveValue(v6, scope);
    else if (typeof v6 === "string") {
      try {
        out[k] = evalExpr(v6, scope);
      } catch {
        out[k] = v6;
      }
    } else out[k] = v6;
  }
  return out;
}
function emit(block, dx = 0, dy = 0, anc = [], scope = /* @__PURE__ */ Object.create(null), dialect8 = DEFAULT_DIALECT) {
  const def = BLOCKS[block.type];
  const own = [...anc, block.id];
  if (block.type === "op") {
    const out = [];
    (block.children || []).forEach((c2) => out.push(...emit(c2, dx, dy, own, scope, dialect8)));
    return out;
  }
  if (!def) return [tag(`( unknown block ${block.type} )`, own)];
  if (def.kind === "var") {
    let val2;
    try {
      val2 = evalExpr(block.params.value, scope);
    } catch {
      val2 = 0;
    }
    scope[block.params.name] = val2;
    return [tag(`( ${block.params.name} = ${r3(val2)} )`, own)];
  }
  if (def.kind === "loop") {
    const name = block.params.var || "i";
    const ev = (x, d) => {
      try {
        return evalExpr(x, scope);
      } catch {
        return d;
      }
    };
    const from = ev(block.params.from, 1), to = ev(block.params.to, 0), by = ev(block.params.by, 1) || 1;
    const steps = by > 0 ? Math.floor((to - from) / by) + 1 : by < 0 ? Math.floor((from - to) / -by) + 1 : 0;
    const out = [];
    for (let s = 0; s < Math.max(0, Math.min(steps, 1e5)); s++) {
      const k = from + s * by;
      const child = Object.create(scope);
      child[name] = k;
      out.push(tag(`( ${def.label} ${name}=${r3(k)} )`, own));
      (block.children || []).forEach((c2) => out.push(...emit(c2, dx, dy, own, child, dialect8)));
    }
    return out;
  }
  if (def.kind === "cond") {
    const on = resolveBool(block.params.cond, scope);
    const out = [tag(`( ${def.label} ${on ? "true" : "false"} )`, own)];
    if (on) (block.children || []).forEach((c2) => out.push(...emit(c2, dx, dy, own, scope, dialect8)));
    return out;
  }
  if (def.kind === "depth") {
    const ev = (x, d) => {
      try {
        return evalExpr(x, scope);
      } catch {
        return d;
      }
    };
    const to = ev(block.params.to, 5), by = ev(block.params.by, 1) || 1;
    const out = [];
    for (const L2 of depthLevels(to, by)) {
      const child = Object.create(scope);
      child.z = -L2;
      out.push(tag(`( ${def.label} z=${r3(-L2)} )`, own));
      (block.children || []).forEach((c2) => out.push(...emit(c2, dx, dy, own, child, dialect8)));
    }
    return out;
  }
  if (def.kind === "fill") {
    const p2 = resolveParams(block.params, scope);
    const z = num(p2.z, 0);
    const out = [tag(`( ${p2.strategy ? p2.strategy + " fill" : def.label} z=${r3(z)} )`, own)];
    if ((block.children || []).length && def.segments) {
      def.segments(p2).forEach((seg) => {
        const child = Object.create(scope);
        Object.assign(child, seg);
        block.children.forEach((c2) => out.push(...emit(c2, dx, dy, own, child, dialect8)));
      });
    } else def.lines(p2, z).forEach((ln) => out.push(tag(ln, own)));
    out.push(tag(`G0 Z${r3(num(p2.clearance, 5))}   ( retract )`, own));
    return out;
  }
  const p = resolveParams(block.params, scope);
  if (def.kind === "container") {
    const pts = def.points(p);
    const skip = new Set(String(p.skip || "").split(/[ ,]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0));
    const out = [];
    pts.forEach((pt, i) => {
      if (skip.has(i + 1)) return;
      (block.children || []).forEach((c2) => {
        out.push(tag(`( ${def.label} ${i + 1} @ ${pt.x},${pt.y} )`, own));
        out.push(...emit(c2, dx + pt.x, dy + pt.y, own, scope, dialect8));
      });
    });
    return out;
  }
  if (def.kind === "path") {
    const pts = def.points(p);
    const clr = num(p.clearance, 5);
    const out = [];
    if (pts.length) out.push(tag(`G0 X${pts[0].x} Y${pts[0].y}   ( ${def.label} start )`, own), tag(`G0 Z${clr}`, own));
    pts.forEach((pt) => (block.children || []).forEach((c2) => {
      const cd = BLOCKS[c2.type];
      if (cd && cd.step) out.push(tag(cd.step(resolveParams(c2.params, scope), pt), [...own, c2.id]));
      else out.push(...emit(c2, pt.x, pt.y, own, scope, dialect8));
    }));
    out.push(tag(`G0 Z${clr}   ( retract )`, own));
    return out;
  }
  return def.emit(p, dx, dy, dialect8).map((ln) => tag(ln, own));
}
function emitMapped(blocks, settings = {}) {
  const dialect8 = settings.dialect || getDialect(settings.profileId);
  const scope = /* @__PURE__ */ Object.create(null);
  const T2 = [];
  (blocks || []).forEach((b2) => {
    T2.push(...emit(b2, 0, 0, [], scope, dialect8));
  });
  applyModalFeed(T2);
  applyCapGating(T2, dialect8);
  balanceOwords(T2, dialect8);
  const lines = T2.map((t) => t.line);
  return { text: lines.join("\n"), lines, map: T2.map((t) => t.src) };
}
function applyModalFeed(T2) {
  let modalF = null;
  for (const t of T2) {
    const m = t.line.match(/ F(-?\d+(?:\.\d+)?)\b/);
    if (m) {
      const f = Number(m[1]);
      if (modalF !== null && f === modalF) t.line = t.line.slice(0, m.index) + t.line.slice(m.index + m[0].length);
      else modalF = f;
    } else if (/ F[#[]/.test(t.line)) {
      modalF = null;
    }
  }
}
function applyCapGating(T2, dialect8) {
  const caps = getCaps(dialect8.id);
  if (caps.vars && caps.flow !== "none") return;
  for (const t of T2) {
    const code = (t.line || "").trim();
    if (!code || code.startsWith("(") || code.startsWith(";")) continue;
    const hasVar = /#\d|#\[/.test(code);
    const isFlow = /^(IF\b|GOTO\b|N\d|o\d+ )/.test(code);
    if (!caps.vars && hasVar || caps.flow === "none" && (isFlow || hasVar)) {
      t.line = `( gated: ${code.replace(/[()]/g, "").trim()} )`;
    }
  }
}
function balanceOwords(T2, dialect8) {
  if (getCaps(dialect8.id).flow !== "oword") return;
  const ifs = /* @__PURE__ */ new Set(), endifs = /* @__PURE__ */ new Set();
  for (const t of T2) {
    const s = (t.line || "").trim();
    let m = s.match(/^o(\d+)\s+if\b/);
    if (m) ifs.add(m[1]);
    m = s.match(/^o(\d+)\s+endif$/);
    if (m) endifs.add(m[1]);
  }
  const valid = new Set([...ifs].filter((n) => endifs.has(n)));
  for (let i = T2.length - 1; i >= 0; i--) {
    const m = (T2[i].line || "").trim().match(/^o(\d+)\s+(if|endif)\b/);
    if (m && !valid.has(m[1])) T2.splice(i, 1);
  }
}
var _seq, tag;
var init_blockModel = __esm({
  "../DDCS-Studio/web/blocks/blockModel.js"() {
    init_ops();
    init_dialects();
    init_util();
    _seq = 0;
    tag = (line2, src) => ({ line: line2, src });
  }
});

// ../DDCS-Studio/web/blocks/opRecord.js
var opRecord_exports = {};
__export(opRecord_exports, {
  getLastOp: () => getLastOp,
  recordOp: () => recordOp
});
function recordOp(type, params) {
  lastOp = { type, params: { ...params } };
}
function getLastOp() {
  return lastOp;
}
var lastOp;
var init_opRecord = __esm({
  "../DDCS-Studio/web/blocks/opRecord.js"() {
    lastOp = null;
  }
});

// ../DDCS-Studio/web/shared/js/profiles/controllerProfiles.js
function getActiveProfile() {
  let id = DEFAULT_PROFILE_ID;
  try {
    id = localStorage.getItem(PROFILE_KEY) || DEFAULT_PROFILE_ID;
  } catch (e) {
  }
  return CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
}
function setActiveProfile(id) {
  const profile = CONTROLLER_PROFILES[id] || CONTROLLER_PROFILES[DEFAULT_PROFILE_ID];
  try {
    localStorage.setItem(PROFILE_KEY, profile.id);
  } catch (e) {
  }
  return profile;
}
function registerProfile(profile) {
  if (profile && profile.id) {
    if (!Array.isArray(profile.hardwareTabs)) profile.hardwareTabs = [];
    CONTROLLER_PROFILES[profile.id] = profile;
  }
  return profile;
}
var CONTROLLER_PROFILES, DEFAULT_PROFILE_ID, PROFILE_KEY;
var init_controllerProfiles = __esm({
  "../DDCS-Studio/web/shared/js/profiles/controllerProfiles.js"() {
    CONTROLLER_PROFILES = {
      "ddcs-expert-m350": {
        id: "ddcs-expert-m350",
        name: "DDCS Expert M350",
        source: "builtin",
        // Hardware tabs shown by DEFAULT for this controller (in addition to the always-on basic tabs).
        // ATC is left OFF by default (most setups are manual tool change) — the user can toggle it on.
        hardwareTabs: ["probes", "limits"],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        // Probe config with a native controller variable (Pr+500 macro mirror, Expert-confirmed).
        // #1078/#1080/#632 are production-proven (community macro_cam13); the rest are from the
        // official Variables-ENG list. Fields with no native var (slow feed, scan stroke, safe Z)
        // are deliberately absent — they stay Studio-side.
        probeVars: {
          port: { ctrl: "#1078", pr: "Pr578", label: "Floating probe port" },
          level: { ctrl: "#1080", pr: "Pr580", label: "Floating probe level" },
          fastFeed: { ctrl: "#632", pr: "Pr132", label: "Probing speed" },
          retract: { ctrl: "#640", pr: "Pr140", label: "Retraction after probe" },
          setterPort: { ctrl: "#1075", pr: "Pr575", label: "Fixed probe port" },
          setterLevel: { ctrl: "#1077", pr: "Pr577", label: "Fixed probe level" },
          blockHeight: { ctrl: "#633", pr: "Pr133", label: "Probe block thickness" }
        }
      },
      "ddcs-v41": {
        id: "ddcs-v41",
        name: "DDCS V4.1",
        source: "builtin",
        varFamily: "v4.1",
        // which default_vars list to load (variableDB)
        hardwareTabs: ["probes", "limits"],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        // The V4.1 macro-address offset for its config params isn't confirmed (see default_vars_v41.js),
        // so probe config stays Studio-side until verified on hardware. Reference: bridge/controllers/v4.1/.
        probeVars: {}
      },
      "ddcs-v3-dm500": {
        id: "ddcs-v3-dm500",
        name: "DDCS V3 / DM500",
        source: "builtin",
        varFamily: "v3",
        hardwareTabs: ["probes", "limits"],
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        // TODO: verify ATC base var on a real DM500
        // Probe config sourced from the DM500's own parameter table (bridge/controllers/dm500/install/eng).
        // The DM500 has a single probe input — no configurable port. Verify these #NNNN are macro-readable
        // at runtime before trusting them on real hardware (the user has no DM500 — this is reference/sim).
        probeVars: {
          level: { ctrl: "#70", label: "Probe signal electric level" },
          fastFeed: { ctrl: "#2011", label: "Probe feedrate" },
          retract: { ctrl: "#75", label: "Back distance after probe" },
          blockHeight: { ctrl: "#69", label: "Thickness of tool sensor" }
        }
      },
      "generic": {
        id: "generic",
        name: "Generic / unknown",
        source: "builtin",
        hardwareTabs: [],
        // unknown controller — show only the basic tabs until identified
        atc: { toolTableBaseVar: 1430, defaultToolCount: 10 },
        probeVars: {}
        // unknown controller — nothing is safely controller-resident
      }
    };
    DEFAULT_PROFILE_ID = "ddcs-expert-m350";
    PROFILE_KEY = "ddcs_controller_profile";
  }
});

// ../DDCS-Studio/web/wizards/communicationWizard.js
function commStack(params = {}) {
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (lhs, op, rhs, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs, op, rhs, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const RAW = (t) => {
    const b2 = newBlock("raw");
    b2.params = { text: t };
    S.push(b2);
  };
  const dialect8 = getDialect2();
  if (!dialect8) {
    C("Error: No dialect loaded");
    return S;
  }
  const caps = getCaps(dialect8.id);
  const type = params.type;
  if (["popup", "status", "input"].includes(type)) {
    if (params.slot1) A("#1510", params.slot1);
    if (params.slot2) A("#1511", params.slot2);
    if (params.slot3) A("#1512", params.slot3);
    if (params.slot4) A("#1513", params.slot4);
  }
  const msg = fmtCtrl(params.msg);
  if (type === "popup") {
    const mode = Number(params.popupMode);
    if (!caps.hmi) {
      C(`Fallback: Controller does not support HMI popups`);
      MSG(msg);
      if (mode === 1 || mode === 3) RAW("M00 ( Pause for operator acknowledgement )");
    } else {
      if (mode === 1) {
        C("Popup - OK/Cancel");
        RAW(dialect8.hmiPrompt(msg, 1).join("\n"));
        IF("#1505", "==", "0", 9);
        C("--- action if OK ---");
        LB(9);
      } else if (mode === 3) {
        C("Popup - Binary Choice");
        RAW(dialect8.hmiPrompt(msg, 3).join("\n"));
        IF("#1505", "==", "0", 8);
        C("--- ENTER action ---");
        GO(9);
        LB(8);
        C("--- ESC action ---");
        LB(9);
      } else {
        C("Popup - Toast");
        RAW(dialect8.hmiToast ? dialect8.hmiToast(msg).join("\n") : dialect8.hmiPrompt(msg, -5e3).join("\n"));
      }
    }
  } else if (type === "status") {
    const line2 = fmtLine(params.msg);
    const useColor = params.statusColor != null && Number(params.statusColor) !== -1;
    const mode = params.statusMode != null && params.statusMode !== "" ? Number(params.statusMode) : 1;
    const dwell = params.statusDwell && Number(params.statusDwell) > 0 ? Number(params.statusDwell) : 0;
    C(mode === -3e3 ? "Persistent Status Bar" : "Status Bar Update");
    if (!caps.hmi) {
      C("Fallback: Status bar text not supported");
      MSG(line2);
    } else {
      if (useColor) A("#2039", Number(params.statusColor), "Status bar color - BGR");
      A("#1503", `${mode}(${line2})`);
      if (useColor) A("#2039", "-1", "Restore default color");
      if (dwell > 0 && mode !== -3e3) RAW(`G4 P${dwell}  ( Dwell - keep message visible )`);
    }
  } else if (type === "input") {
    const idNum = Number(String(params.id).replace("#", ""));
    const useId = Number.isFinite(idNum) && idNum >= 50 && idNum <= 499 ? idNum : 100;
    if (!caps.hmi) {
      C("Fallback: Numeric input not supported");
      MSG(`Missing input for #${useId}: ${msg}`);
      RAW("M00 ( Pause to manually edit variable if needed )");
    } else {
      C("Numeric Input - DDCS Safe");
      RAW(dialect8.hmiInput ? dialect8.hmiInput(`#${useId}`, msg).join("\n") : `#2070=${useId}(${msg})`);
      if (params.dest && String(params.dest).trim() !== "") A(String(params.dest), `#${useId}`, "Copy to persistent");
    }
  } else if (type === "beep") {
    const dur = params.val != null && params.val !== "" ? params.val : 500;
    const cyc = params.cycle != null && params.cycle !== "" ? Number(params.cycle) : 0;
    if (cyc > 0) {
      C(`System Beep - ${Math.round(dur / (cyc * 2))} pulses of ${cyc}ms`);
      A("#2043", cyc, "Pulse width ms");
      A("#2042", dur, "Total duration ms");
    } else {
      C("System Beep");
      A("#2042", dur, "Beep duration ms");
    }
  } else if (type === "dwell") {
    C("Dwell");
    if (dialect8 && dialect8.dwell) RAW(dialect8.dwell(params.val).join("\n"));
    else RAW(`G4 P${params.val}`);
  } else {
    C(`Unknown communication type: ${type}`);
  }
  return S;
}
var getDialect2, fmtCtrl, fmtLine, CommunicationWizard;
var init_communicationWizard = __esm({
  "../DDCS-Studio/web/wizards/communicationWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_dialects();
    init_controllerProfiles();
    getDialect2 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    fmtCtrl = (msg) => String(msg || "").replace(/\r\n|\r|\n/g, " / ").replace(/\s*\/\s*/g, " / ").trim();
    fmtLine = (msg) => String(msg || "").replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
    CommunicationWizard = class {
      constructor() {
      }
      // BGR color presets for #2039 status bar color control
      static get COLOR_PRESETS() {
        return [
          { label: "Default (green)", value: -1 },
          { label: "Blue", value: 16711680 },
          { label: "Green", value: 65280 },
          { label: "Red", value: 255 },
          { label: "Cyan", value: 16776960 },
          { label: "Magenta", value: 16711935 },
          { label: "Yellow", value: 65535 },
          { label: "Light Blue", value: 16744576 },
          { label: "Light Green", value: 8454016 },
          { label: "Light Red", value: 8421631 },
          { label: "Light Cyan", value: 16777088 },
          { label: "Light Magenta", value: 16744703 },
          { label: "Light Yellow", value: 8454143 },
          { label: "Dark Blue", value: 8388608 },
          { label: "Dark Green", value: 32768 },
          { label: "Dark Red", value: 128 },
          { label: "Dark Cyan", value: 8421376 },
          { label: "Dark Magenta", value: 8388736 },
          { label: "Dark Yellow", value: 32896 },
          { label: "White", value: 16777215 },
          { label: "Light Gray", value: 13882323 },
          { label: "Gray", value: 8421504 },
          { label: "Dark Gray", value: 4210752 },
          { label: "Black", value: 0 }
        ];
      }
      generate(params) {
        recordOp("comm", params);
        return emitMapped(commStack(params)).text;
      }
      /**
       * Generate an HTML preview simulating the DDCS controller screen
       */
      generateScreenPreview(params) {
        const { type, msg, val: val2, cycle, id, statusColor, statusMode } = params;
        const safeMsg = type === "popup" ? this.formatMessageForPreview(msg) || "&nbsp;" : this.escapeMessageForPreview(this.formatMessageSingleLine(msg)) || "&nbsp;";
        switch (type) {
          case "popup": {
            const modeNum = Number(params.popupMode);
            let btns = `<div class="comm-dialog-btn">Enter</div>`;
            let btnRowClass = "comm-dialog-btns popup single";
            if (modeNum === 1) btns = `<div class="comm-dialog-btn">Esc</div><div class="comm-dialog-btn">Enter</div>`;
            if (modeNum === 3) btns = `<div class="comm-dialog-btn">Esc</div><div class="comm-dialog-btn">Enter</div>`;
            if (modeNum === 1 || modeNum === 3) btnRowClass = "comm-dialog-btns popup";
            const titleLabel = modeNum === 1 ? "OK / Cancel" : modeNum === 3 ? "Choice" : "Message";
            return `<div class="comm-dialog-overlay"><div class="comm-dialog popup-dialog">
                    <div class="comm-dialog-title">${titleLabel}</div>
                    <div class="comm-dialog-body">
                        <div class="comm-dialog-msg">${safeMsg}</div>
                        <div class="${btnRowClass}">${btns}</div>
                    </div>
                </div></div>`;
          }
          case "input": {
            return `<div class="comm-dialog-overlay"><div class="comm-dialog input-dialog">
                    <div class="comm-dialog-title">Edit</div>
                    <div class="comm-dialog-body">
                        <div class="comm-dialog-msg">${safeMsg}</div>
                        <div class="comm-dialog-input">0_</div>
                        <div class="comm-dialog-btns">
                            <div class="comm-dialog-btn">Esc</div>
                            <div class="comm-dialog-btn">Enter</div>
                        </div>
                    </div>
                </div></div>`;
          }
          case "status": {
            const colorVal = Number(statusColor);
            let barBg = "#00ff00";
            if (!isNaN(colorVal) && colorVal !== -1) {
              const b2 = colorVal >> 16 & 255;
              const g = colorVal >> 8 & 255;
              const r = colorVal & 255;
              barBg = `rgb(${r},${g},${b2})`;
            }
            const modeNum = Number(statusMode);
            const persistent = modeNum === -3e3;
            return `<div class="comm-status-bar" style="background:${barBg}">${safeMsg}${persistent ? ' <span style="opacity:0.6;font-size:0.85em">[persistent]</span>' : ""}&nbsp;</div>`;
          }
          case "beep": {
            const durNum = Math.max(30, Number(val2) || 500);
            const cycleNum = Math.max(0, Number(cycle) || 0);
            const modeLabel = cycleNum > 0 ? `Pulsed: ${cycleNum}ms on / ${cycleNum}ms off` : "Continuous tone";
            return `<div class="comm-simple-overlay"><div class="comm-simple-stack">
                    <div class="comm-simple-note">\u{1F514} Beep &mdash; ${durNum}ms<br/><span class="comm-simple-sub">${modeLabel}</span></div>
                    <button type="button" class="comm-dialog-btn comm-beep-preview-btn" onclick="window.playCommBeepPreview && window.playCommBeepPreview(${durNum}, ${cycleNum})">Play Sound</button>
                </div></div>`;
          }
          case "dwell": {
            const sec = val2 || "?";
            return `<div class="comm-simple-overlay"><div class="comm-simple-note">\u23F1 Pause &mdash; G4 P${sec}</div></div>`;
          }
          default:
            return "";
        }
      }
      /**
       * Get UI field visibility based on communication type
       */
      getFieldVisibility(type) {
        return {
          showMode: type === "popup" || type === "status",
          showPopupMode: type === "popup",
          showStatusMode: type === "status",
          showValue: type === "beep" || type === "dwell",
          showCycle: type === "beep",
          showMessage: type !== "dwell" && type !== "beep",
          showSlots: ["popup", "status", "input"].includes(type),
          showVar: type === "input",
          showColor: type === "status",
          modeLabel: type === "status" ? "STATUS MODE" : "POPUP MODE",
          valLabel: type === "beep" ? "DURATION" : type === "dwell" ? "DURATION" : "VALUE",
          valHint: type === "beep" ? "#2042 total beep duration in ms (e.g. 1000 = 1 sec)" : type === "dwell" ? "e.g. P1.0 or P3000 \u2014 units unconfirmed (seconds or ms)" : ""
        };
      }
      formatMessageForController(msg) {
        const text = String(msg || "");
        return text.replace(/\r\n|\r|\n/g, " / ").replace(/\s*\/\s*/g, " / ").trim();
      }
      formatMessageSingleLine(msg) {
        return String(msg || "").replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
      }
      escapeMessageForPreview(msg) {
        return String(msg || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      }
      formatMessageForPreview(msg) {
        const escaped = this.escapeMessageForPreview(msg);
        return escaped.replace(/\r\n|\r|\n/g, "<br/>").replace(/\s*\/\s*/g, "<br/>");
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/wcsWizard.js
function wcsStack(params = {}) {
  const auto = params.sys === "0";
  const axes = [];
  if (params.axisX) axes.push({ off: 0, var: "#880" });
  if (params.axisY) axes.push({ off: 1, var: "#881" });
  if (params.axisZ) axes.push({ off: 2, var: "#882" });
  const S = [];
  const C = (text) => {
    const b2 = newBlock("comment");
    b2.params = { text };
    S.push(b2);
  };
  const A = (v6, value, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value, note: note || "" };
    S.push(b2);
  };
  C("WCS | Direct register writes");
  const dialect8 = getDialect3();
  if (!dialect8) {
    C("Error: No dialect loaded");
    return S;
  }
  const { wcsBase, wcsStride } = dialect8.vars;
  if (!wcsBase || !wcsStride) {
    C("Error: Dialect does not support direct WCS register writes");
    return S;
  }
  C("M350 Ready - G10 not used");
  if (auto) {
    C("Auto-detect active WCS from #578");
    A("#150", "#578");
    A("#151", `${wcsBase}+[#150-1]*${wcsStride}`);
    C("Zero selected axes");
    axes.forEach((a) => A(`#[#151+${a.off}]`, a.var));
  } else {
    const base = wcsBase + (parseInt(params.sys, 10) - 53 - 1) * wcsStride;
    C(`Fixed WCS: G${params.sys} - Base address #${base}`);
    C("Zero selected axes");
    axes.forEach((a) => A(`#${base + a.off}`, a.var));
  }
  if (params.sync) {
    const slave = params.slave, slaveOffset = slave === "3" ? 3 : 4;
    C(`Dual Gantry Sync - Slave ${slave === "3" ? "A" : "B"}`);
    if (auto) {
      A("#152", `[#151+${slaveOffset}]`, "Base WCS + Slave Offset");
      A("#[#152]", `#88${slave}`);
    } else {
      const base = wcsBase + (parseInt(params.sys, 10) - 53 - 1) * wcsStride;
      A(`#${base + slaveOffset}`, `#88${slave}`);
    }
  }
  return S;
}
var getDialect3, WCSWizard;
var init_wcsWizard = __esm({
  "../DDCS-Studio/web/wizards/wcsWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_dialects();
    init_controllerProfiles();
    getDialect3 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    WCSWizard = class {
      constructor() {
        this.wcsBaseMap = { "54": 805, "55": 810, "56": 815, "57": 820, "58": 825, "59": 830 };
      }
      generate(params) {
        recordOp("wcs", params);
        return emitMapped(wcsStack(params)).text;
      }
      getWCSName(sys) {
        return sys === "0" ? "Active WCS" : `G${sys}`;
      }
      getWCSBase(sys) {
        return sys === "0" ? "Auto-detected" : this.wcsBaseMap[sys] || "Unknown";
      }
      isValidWCS(sys) {
        return sys === "0" || sys >= "54" && sys <= "59";
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/dialect.js
var init_dialect = __esm({
  "../DDCS-Studio/web/wizards/dialect.js"() {
    init_words();
  }
});

// ../DDCS-Studio/web/wizards/probeBlocks.js
function toNum(v6, def = 0) {
  if (v6 === void 0 || v6 === null) return def;
  const n = Number(v6);
  return Number.isFinite(n) ? n : def;
}
function srcVal(src, literal) {
  return src ? src.ctrl : literal;
}
function srcNote(src, note) {
  return src ? `${note} - controller ${src.pr}` : note;
}
var init_probeBlocks = __esm({
  "../DDCS-Studio/web/wizards/probeBlocks.js"() {
    init_words();
    init_dialect();
  }
});

// ../DDCS-Studio/web/wizards/cornerWizard.js
function cornerStack(params = {}) {
  const corner = params.corner || "FL";
  const probeZ = !!params.probeZ;
  const probeSeq = params.probeSeq === "YX" ? "YX" : "XY";
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const dist = num(params.dist, 500), retract = num(params.retract, 5);
  const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const level = num(params.level, 0), safeZ = num(params.safeZ, 10);
  const travelDist = num(params.travelDist, 50), scanDepth = num(params.scanDepth, 5), radius = num(params.radius, 2);
  const src = params.sources || {};
  const [xDir, yDir] = { FL: ["+", "+"], FR: ["-", "+"], BL: ["+", "-"], BR: ["-", "-"] }[corner] || ["+", "+"];
  const dirLabel = (d) => d === "+" ? "pos" : "neg";
  const plungeDepth = safeZ + scanDepth, td = travelDist || 0;
  const firstAx = probeSeq === "YX" ? "Y" : "X", firstDir = probeSeq === "YX" ? yDir : xDir;
  const secondAx = probeSeq === "YX" ? "X" : "Y", secondDir = probeSeq === "YX" ? xDir : yDir;
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const PR = (ax, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis: ax, to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (ax, goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis: ax, goto };
    S.push(b2);
  };
  const MOVE = (props) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", ...props };
    S.push(b2);
  };
  const MV = (ax, v6) => MOVE({ [ax.toLowerCase()]: v6 });
  const RAW = (text) => {
    const b2 = newBlock("raw");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const travelOwn = (d) => d === "+" ? "#15" : "#16";
  const travelOpp = (d) => d === "+" ? "#16" : "#15";
  const probeWall = (ax, dir) => {
    const av = AX7[ax], probeVar = dir === "+" ? "#8" : "#7", retractVar = dir === "+" ? "#9" : "#10";
    const compOp = dir === "+" ? "+" : "-";
    PR(ax, probeVar, "#3");
    CK(ax, 1);
    MV(ax, retractVar);
    PR(ax, probeVar, "#4");
    CK(ax, 1);
    C(`Apply ${ax} WCS with Radius Comp`);
    if (ax === "X") {
      A("#102", `[${av.result} ${compOp} #6]`, `Trigger Pos ${compOp} Radius`);
      A("#[#70]", "#102", `Save to ${wcsLabel} X`);
    } else {
      A("#101", `[${av.result} ${compOp} #6]`, `Trigger Pos ${compOp} Radius`);
      A("#73", "[#70+1]", "WCS Y Address");
      A("#[#73]", "#101", `Save to ${wcsLabel} Y`);
    }
    MV(ax, retractVar);
    MV("Z", "#17");
  };
  C(`Corner | ${corner} OUTSIDE | X ${dirLabel(xDir)} Y ${dirLabel(yDir)}${probeZ ? " + Z Surface" : ""} | ${wcsLabel}`);
  C(`Probe dist: ${dist}mm | Retract: ${retract}mm | Travel: ${travelDist}mm`);
  C(`Fast: ${fFast} | Slow: ${fSlow} | SafeZ: ${safeZ}mm | ScanDepth: ${scanDepth}mm`);
  C("=== CONFIGURATION ===");
  A("#1", dist, "Max probe distance");
  A("#2", srcVal(src.retract, retract), srcNote(src.retract, "Retract distance"));
  A("#3", srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, "Fast feedrate"));
  A("#4", fSlow, "Slow feedrate");
  A("#5", srcVal(src.port, port), srcNote(src.port, "Probe port"));
  A("#6", radius, "Probe stylus radius");
  C("=== CALCULATED MOTIONS ===");
  A("#7", "[0-#1]", "Negative max probe");
  A("#8", "#1", "Positive max probe");
  A("#9", "[0-#2]", "Negative retract");
  A("#10", "#2", "Positive retract");
  if (td > 0) {
    A("#15", td, "Positive travel");
    A("#16", `[0-${td}]`, "Negative travel");
  } else {
    A("#15", 0, "Travel not used");
    A("#16", 0, "Travel not used");
  }
  A("#17", plungeDepth, "Plunge depth = safeZ + scanDepth");
  A("#18", "[0-#17]", "Negative plunge");
  A("#19", safeZ, "Safe Z retract distance");
  if (wcs === "active") {
    C("Read Active WCS");
    A("#71", "#578", "Active WCS index: 1=G54 2=G55 etc");
    A("#72", "[#71-1]", "Zero-based index");
    A("#70", "[805+[#72*5]]", "Base WCS address");
  } else {
    C(`Target: ${wcs}`);
    A("#70", WCS_BASE[wcs], "Base WCS address");
  }
  C("Confirm Start");
  A("#1505", "1", `${probeZ ? "Hover OVER the" : "Hover OUTSIDE the"} ${corner} corner material. Press Enter`);
  DM("inc");
  if (probeZ) {
    const firstTravelVar = firstDir === "+" ? "#16" : "#15";
    C("Step 1: Z Surface Probe");
    PR("Z", "#7", "#3");
    CK("Z", 1);
    MV("Z", "#10");
    PR("Z", "#7", "#4");
    CK("Z", 1);
    A("#73", "[#70+2]", "WCS Z Address");
    A("#[#73]", "#1927", `Save ${wcsLabel} Z offset - machine coord`);
    MV("Z", "#19");
    MV(firstAx, firstTravelVar);
  }
  let step = probeZ ? 2 : 1;
  C(`Step ${step++}: ${firstAx} Probe`);
  MV("Z", "#18");
  probeWall(firstAx, firstDir);
  C(`Step ${step++}: Travel past corner and set up for ${secondAx}`);
  MOVE({ [firstAx.toLowerCase()]: travelOwn(firstDir), [secondAx.toLowerCase()]: travelOpp(secondDir) });
  MV("Z", "#18");
  C(`Step ${step++}: ${secondAx} Probe`);
  probeWall(secondAx, secondDir);
  if (params.syncA) {
    const s = params.slave || "3";
    C("Dual Gantry Sync");
    DM("abs");
    RAW("G1 A0 F#3");
    DM("inc");
    A("#74", `[#70+${s}]`, "Base WCS + Slave Offset");
    A("#[#74]", "#883", "Sync A offset with Y");
  }
  DM("abs");
  A("#1505", "-5000", `Corner ${corner} found`);
  GO(2);
  C("=== ERROR HANDLER ===");
  LB(1);
  DM("inc");
  MV("Z", "#17");
  DM("abs");
  A("#1505", "1", "ERROR: Probe failed to trigger");
  LB(2);
  END();
  return S;
}
var AX7, WCS_BASE, CornerWizard;
var init_cornerWizard = __esm({
  "../DDCS-Studio/web/wizards/cornerWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    AX7 = {
      X: { status: "#1920", result: "#1925", off: 0 },
      Y: { status: "#1921", result: "#1926", off: 1 },
      Z: { status: "#1922", result: "#1927", off: 2 }
    };
    WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
    CornerWizard = class {
      constructor() {
      }
      toNum(v6, def = 0) {
        return toNum(v6, def);
      }
      generate(params) {
        recordOp("corner", params);
        return emitMapped(cornerStack(params)).text;
      }
      /**
       * Infer where the spindle should START for this corner/config, in the 3D-preview stock frame
       * (stock spans X[0..x] Y[0..y], top at Z=0). The macro is incremental, so this start positions the
       * whole probe path at the chosen corner. Uses the SAME corner→direction convention as cornerStack():
       *   - Z-first ("hover OVER the corner material") → just INSIDE the corner, above the top.
       *   - otherwise ("hover OUTSIDE the corner")     → just OUTSIDE the corner, within probe reach.
       * Purely a preview/sim hint — never written to the G-code, never touches the WCS.
       */
      inferStart(params, stock) {
        const n = (v6, d) => this.toNum(v6, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80);
        const corner = params.corner || "FL";
        const zFirst = !!(params.probeZ || params.probeZFirst);
        const seq = params.probeSeq || "YX";
        const safeZ = n(params.safeZ, 10), radius = n(params.radius, 2);
        const travel = n(params.travelDist, 50), dist = n(params.dist, 500);
        const cornerXY = { FL: [0, 0], FR: [sx, 0], BL: [0, sy], BR: [sx, sy] }[corner] || [0, 0];
        const dir = { FL: [1, 1], FR: [-1, 1], BL: [1, -1], BR: [-1, -1] }[corner] || [1, 1];
        const overMat = radius + 5;
        const inFront = Math.max(8, Math.min(travel, dist * 0.3));
        const nearEdge = Math.min(20, travel * 0.8);
        const firstIsX = seq !== "YX";
        const kFor = (isX) => zFirst ? overMat : isX === firstIsX ? -inFront : nearEdge;
        return { x: cornerXY[0] + dir[0] * kFor(true), y: cornerXY[1] + dir[1] * kFor(false), z: safeZ };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/middleWizard.js
function middleStack(params = {}) {
  const featureType = params.featureType === "boss" ? "boss" : "pocket";
  const axis = params.axis === "Y" ? "Y" : "X";
  const dir1Plus = (params.dir1 || "pos") === "pos";
  const twoAxis = !!params.twoAxis || !!params.findBoth;
  const second = axis === "X" ? "Y" : "X";
  const resolvedDir2 = typeof params.dir2 === "string" ? params.dir2 : dir1Plus ? "neg" : "pos";
  const dir2Plus = resolvedDir2 === "pos";
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const dist = num(params.dist, 20), retract = num(params.retract, 2), safeZ = num(params.safeZ, 10);
  const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (l, o, r, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs: l, op: o, rhs: r, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const MM = (ax, ref) => {
    const b2 = newBlock("machinemove");
    b2.params = { axis: ax, to: ref };
    S.push(b2);
  };
  const MV = (ax, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [ax.toLowerCase()]: v6 };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const PR = (ax, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis: ax, to, feed, port: "#5", level: 0 };
    S.push(b2);
  };
  const CK = (ax, g) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis: ax, goto: g };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const twoPass = (ax, plus, resultVar) => {
    const av = AX8[ax], pv = plus ? "#8" : "#7", rv = plus ? "#9" : "#10", lim = plus ? "2" : "1";
    A(av.stop, "0");
    A(av.limit, lim);
    PR(ax, pv, "#3");
    CK(ax, 1);
    MV(ax, rv);
    PR(ax, pv, "#4");
    CK(ax, 1);
    A(resultVar, av.result);
    MV(ax, rv);
  };
  const reposition = () => {
    A("#57", "#882");
    MV("Z", "#17");
    A("#1505", "1", "Press Enter when repositioned");
    IF("#1505", "==", "0", 2);
    MM("Z", "#57");
  };
  const seq = (ax, firstPlus, base) => {
    twoPass(ax, firstPlus, `#${base}`);
    if (featureType === "boss") reposition();
    twoPass(ax, !firstPlus, `#${base + 1}`);
    A(`#${base + 2}`, `[#${base}+#${base + 1}]/2`);
  };
  A("#1", dist, "Max probe distance");
  A("#2", retract, "Retract distance");
  A("#3", fFast, "Fast feedrate");
  A("#4", fSlow, "Slow feedrate");
  A("#5", port, "Probe port");
  A("#51", 0, "Wall 1 pos");
  A("#52", 0, "Wall 2 pos");
  A("#53", 0, "Center pos");
  A("#54", 0, "Wall 3 pos");
  A("#55", 0, "Wall 4 pos");
  A("#56", 0, "Center pos 2");
  A("#7", "[0-#1]", "Negative max probe");
  A("#8", "#1", "Positive max probe");
  A("#9", "[0-#2]", "Negative retract");
  A("#10", "#2", "Positive retract");
  A("#17", safeZ, "Safe Z retract");
  if (wcs === "active") {
    A("#71", "#578", "Active WCS index: 1=G54 2=G55 etc");
    A("#72", "[#71-1]", "Zero-based index");
    A("#70", "[805+[#72*5]]", "Base WCS address");
  } else A("#70", WCS_BASE2[wcs]);
  A("#1505", "1", "Press Enter to probe - ESC=cancel");
  IF("#1505", "==", "0", 2);
  DM("inc");
  seq(axis, dir1Plus, 51);
  if (twoAxis) {
    reposition();
    C(`2axis_${axis === "X" ? "XtoY" : "YtoX"}_${resolvedDir2}`);
    seq(second, dir2Plus, 54);
    MV("Z", "#17");
    A(`#[#70+${AX8[axis].off}]`, "#53");
    A(`#[#70+${AX8[second].off}]`, "#56");
  } else {
    MV("Z", "#17");
    A(`#[#70+${AX8[axis].off}]`, "#53");
  }
  if (params.syncA && (axis === "Y" || twoAxis)) {
    const s = params.slave || "3";
    A("#74", `[#70+${s}]`);
    A("#[#74]", "#883");
  }
  DM("abs");
  A("#1505", "-5000");
  GO(2);
  LB(1);
  DM("inc");
  MV("Z", "#17");
  DM("abs");
  A("#1505", "1");
  LB(2);
  END();
  return S;
}
var AX8, WCS_BASE2, MiddleWizard;
var init_middleWizard = __esm({
  "../DDCS-Studio/web/wizards/middleWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    AX8 = {
      X: { stop: "#1905", limit: "#1915", status: "#1920", result: "#1925", off: 0 },
      Y: { stop: "#1906", limit: "#1916", status: "#1921", result: "#1926", off: 1 }
    };
    WCS_BASE2 = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
    MiddleWizard = class {
      generate(params) {
        recordOp("middle", params);
        return emitMapped(middleStack(params)).text;
      }
      /** Preview/sim start hint (stock frame): pocket → centre inside the cavity; boss → just outside the first wall. */
      inferStart(params, stock) {
        const n = (v6, d) => num(v6, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        if ((params.featureType || "pocket") !== "boss") return { x: cx, y: cy, z: probeZ };
        const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
        const pos = (params.dir1 || "pos") === "pos";
        return (params.axis || "X") === "X" ? { x: pos ? -outset : sx + outset, y: cy, z: probeZ } : { x: cx, y: pos ? -outset : sy + outset, z: probeZ };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/circularWizard.js
function circularStack(params = {}) {
  const inside = params.featureType === "boss" ? false : true;
  const level = num(params.level, 0), dist = num(params.dist, 20), retract = num(params.retract, 2);
  const safeZ = num(params.safeZ, 10), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const src = params.sources || {};
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const wcsArg = wcs === "active" ? "#578" : String(parseInt(String(wcs).replace("G", ""), 10) - 53);
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (l, o, r, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs: l, op: o, rhs: r, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const PR = (axis, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis, to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (axis, goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis, goto };
    S.push(b2);
  };
  const RD = (axis, v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const RM = (axis, v6) => {
    const b2 = newBlock("readmachine");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const MM = (axis, to) => {
    const b2 = newBlock("machinemove");
    b2.params = { axis, to };
    S.push(b2);
  };
  const SWO = (axis, value) => {
    const b2 = newBlock("setworkoffset");
    b2.params = { wcs: wcsArg, axis, value };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const pp = (axis, plus, resultVar) => {
    const pv = plus ? "#8" : "#7", rv = plus ? "#9" : "#10";
    PR(axis, pv, "#3");
    CK(axis, 1);
    MV(axis, rv);
    PR(axis, pv, "#4");
    CK(axis, 1);
    RD(axis, resultVar);
    MV(axis, rv);
  };
  const reposition = (msg, recentre) => {
    RM("Z", "#57");
    MV("Z", "#17");
    if (recentre) MM(recentre.axis, recentre.value);
    C(`REPOSITION: ${msg}`);
    CF("Press Enter when repositioned - ESC=cancel", 2);
    MM("Z", "#57");
    DM("inc");
  };
  C("Two-pass probe, X then Y, re-centred so Y is a true diameter");
  C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
  C("Motion Variables");
  A("#1", dist, "Max probe distance");
  A("#2", srcVal(src.retract, retract), srcNote(src.retract, "Retract distance"));
  A("#3", srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, "Fast feedrate"));
  A("#4", fSlow, "Slow feedrate");
  A("#5", srcVal(src.port, port), srcNote(src.port, "Probe port"));
  A("#7", "[0-#1]", "Negative max probe");
  A("#8", "#1", "Positive max probe");
  A("#9", "[0-#2]", "Negative retract");
  A("#10", "#2", "Positive retract");
  A("#17", Math.round(safeZ), "Safe Z distance");
  C("Confirm Start");
  CF("Press Enter to probe - ESC=cancel", 2);
  DM("inc");
  if (inside) {
    C("=== X axis: probe both walls across the bore ===");
    C("Probe +X wall");
    pp("X", true, "#51");
    C("Probe -X wall (crosses the bore)");
    pp("X", false, "#52");
    A("#53", "[#51+#52]/2", "X centre");
    C("Re-centre in X so the Y touch is a true diameter, not a chord");
    MM("X", "#53");
    DM("inc");
    C("=== Y axis: probe both walls at the X centre ===");
    C("Probe +Y wall");
    pp("Y", true, "#54");
    C("Probe -Y wall (crosses the bore)");
    pp("Y", false, "#55");
    A("#56", "[#54+#55]/2", "Y centre");
  } else {
    C("=== X axis: probe each side from outside ===");
    C("Probe +X face (approach from +X)");
    pp("X", false, "#51");
    reposition("move clear, around to the -X side of the boss");
    C("Probe -X face (approach from -X)");
    pp("X", true, "#52");
    A("#53", "[#51+#52]/2", "X centre");
    C("Re-centre in X at SAFE Z (boss centre is solid - never cross it at depth)");
    reposition("move clear, around to the +Y side of the boss", { axis: "X", value: "#53" });
    C("Probe +Y face (approach from +Y)");
    pp("Y", false, "#54");
    reposition("move clear, around to the -Y side of the boss");
    C("Probe -Y face (approach from -Y)");
    pp("Y", true, "#55");
    A("#56", "[#54+#55]/2", "Y centre");
  }
  C("Diameters + roundness");
  A("#58", "[#51-#52]", "X diameter");
  A("#59", "[#54-#55]", "Y diameter");
  A("#60", "[#58+#59]/2", "Mean diameter");
  A("#61", "[#58-#59]", "Out-of-round (X dia - Y dia)");
  C("Final retract");
  MV("Z", "#17");
  C("Write centre to WCS");
  SWO("X", "#53");
  SWO("Y", "#56");
  DM("abs");
  MSG2("Centre #53/#56 - mean dia #60 - round #61");
  GO(2);
  LB(1);
  DM("inc");
  MV("Z", "#17");
  DM("abs");
  A("#1505", "1", "Probe failed - no contact");
  LB(2);
  END();
  return S;
}
var CircularWizard;
var init_circularWizard = __esm({
  "../DDCS-Studio/web/wizards/circularWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    CircularWizard = class {
      generate(params) {
        recordOp("circular", params);
        return emitMapped(circularStack(params)).text;
      }
      /** Preview spindle start (3D stock frame): bore → centre just below top; boss → outside +X. */
      inferStart(params, stock) {
        const n = (v6, d) => num(v6, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        if ((params.featureType || "bore") === "boss") {
          const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
          return { x: -outset, y: cy, z: probeZ };
        }
        return { x: cx, y: cy, z: probeZ };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/rotaryCenterWizard.js
function rotaryCenterStack(params = {}) {
  const method = params.method === "fit" ? "fit" : "known";
  const datum = params.datum === "top" ? "top" : "center";
  const level = num(params.level, 0), diameter = num(params.diameter, 76.2), dist = num(params.dist, 30);
  const retract = num(params.retract, 2), safeZ = num(params.safeZ, 15), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const src = params.sources || {};
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const wcsArg = wcs === "active" ? "#578" : String(parseInt(String(wcs).replace("G", ""), 10) - 53);
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const PR = (axis, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis, to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (axis, goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis, goto };
    S.push(b2);
  };
  const RD = (axis, v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const RM = (axis, v6) => {
    const b2 = newBlock("readmachine");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const MM = (axis, to) => {
    const b2 = newBlock("machinemove");
    b2.params = { axis, to };
    S.push(b2);
  };
  const SWO = (axis, value) => {
    const b2 = newBlock("setworkoffset");
    b2.params = { wcs: wcsArg, axis, value };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const pp = (axis, plus, resultVar) => {
    const pv = plus ? "#8" : "#7", rv = plus ? "#9" : "#10";
    PR(axis, pv, "#3");
    CK(axis, 1);
    MV(axis, rv);
    PR(axis, pv, "#4");
    CK(axis, 1);
    RD(axis, resultVar);
    MV(axis, rv);
  };
  const reposition = (msg) => {
    RM("Z", "#57");
    MV("Z", "#17");
    C(`REPOSITION: ${msg}`);
    CF("Press Enter when repositioned - ESC=cancel", 2);
    MM("Z", "#57");
    DM("inc");
  };
  C(`Rotary centreline | ${method === "fit" ? "3-point fit" : "known dia " + diameter} | Z0 at ${datum === "top" ? "OD top" : "centreline"} | ${wcsLabel}`);
  C("Horizontal 4th axis: spin X -> probe top in Z, flanks in Y. Centreline runs along X.");
  C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
  C("Motion Variables");
  A("#1", dist, "Max probe distance");
  A("#2", srcVal(src.retract, retract), srcNote(src.retract, "Retract"));
  A("#3", srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, "Fast feed"));
  A("#4", fSlow, "Slow feed");
  A("#5", srcVal(src.port, port), srcNote(src.port, "Probe port"));
  A("#7", "[0-#1]", "Neg max");
  A("#8", "#1", "Pos max");
  A("#9", "[0-#2]", "Neg retract");
  A("#10", "#2", "Pos retract");
  A("#17", Math.round(safeZ), "Safe Z");
  C("Confirm Start");
  CF("Press Enter to probe - ESC=cancel", 2);
  DM("inc");
  if (method === "known") {
    C("=== Known diameter: top + two flanks ===");
    C("Probe top (Z down)");
    pp("Z", false, "#50");
    C("Probe +Y flank");
    pp("Y", true, "#52");
    C("Probe -Y flank");
    pp("Y", false, "#53");
    C("Centre + radius");
    A("#54", "[#52+#53]/2", "Yc = midpoint of flanks");
    A("#55", `${diameter}/2`, "R = known diameter / 2");
    A("#56", "[#50-#55]", "Zc = top - R");
  } else {
    C("=== 3-point circle fit (no diameter) === ADVANCED: verify on machine");
    C("Point 1: top (capture Z trigger + current Y)");
    pp("Z", false, "#51");
    RM("Y", "#52");
    reposition("move clear to the +Y side of the cylinder");
    C("Point 2: +Y flank (capture Y trigger + current Z)");
    pp("Y", true, "#53");
    RM("Z", "#54");
    reposition("move clear to the -Y side of the cylinder");
    C("Point 3: -Y flank (capture Y trigger + current Z)");
    pp("Y", false, "#55");
    RM("Z", "#56");
    C("Solve circle through P1(#52,#51) P2(#53,#54) P3(#55,#56) [a=Y b=Z]");
    A("#60", "[#52*#52]+[#51*#51]", "|P1|^2");
    A("#61", "[#53*#53]+[#54*#54]", "|P2|^2");
    A("#62", "[#55*#55]+[#56*#56]", "|P3|^2");
    A("#63", "2*[[#52*[#54-#56]]+[#53*[#56-#51]]+[#55*[#51-#54]]]", "d (twice signed area)");
    A("#54", "[[#60*[#54-#56]]+[#61*[#56-#51]]+[#62*[#51-#54]]]/#63", "Yc");
    A("#56", "[[#60*[#55-#53]]+[#61*[#52-#55]]+[#62*[#53-#52]]]/#63", "Zc");
    A("#55", "SQRT[[[#52-#54]*[#52-#54]]+[[#51-#56]*[#51-#56]]]", "R");
    A("#50", "[#56+#55]", "OD top = Zc + R");
  }
  C("Final retract");
  MV("Z", "#17");
  C(`Write work origin (Z0 at ${datum === "top" ? "OD top" : "centreline"})`);
  SWO("Y", "#54");
  SWO("Z", datum === "top" ? "#50" : "#56");
  DM("abs");
  MSG2("Centreline Y#54 Z#56 - R#55");
  GO(2);
  LB(1);
  DM("inc");
  MV("Z", "#17");
  DM("abs");
  A("#1505", "1", "Probe failed - no contact");
  LB(2);
  END();
  return S;
}
var RotaryCenterWizard;
var init_rotaryCenterWizard = __esm({
  "../DDCS-Studio/web/wizards/rotaryCenterWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    RotaryCenterWizard = class {
      generate(params) {
        recordOp("rotary_center", params);
        return emitMapped(rotaryCenterStack(params)).text;
      }
      /** Preview start (stock frame): above the cylinder top, centred, ready to probe down. */
      inferStart(params, stock) {
        const n = (v6, d) => num(v6, d);
        const sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        return { x: n(stock && stock.x, 150) / 2, y: sy / 2, z: Math.min(5, sz * 0.5) };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/rotaryClockWizard.js
function rotaryClockStack(params = {}) {
  const level = num(params.level, 0), span = num(params.span, 20), dist = num(params.dist, 30);
  const retract = num(params.retract, 2), safeZ = num(params.safeZ, 10), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const src = params.sources || {};
  const action = ["set", "report", "rotate"].includes(params.action) ? params.action : "set";
  const refAngle = params.reference === "side" ? 90 : 0, refLabel = refAngle ? "+Y side (3 o clock)" : "top (+Z)";
  const refTerm = refAngle ? `-${refAngle}` : "";
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const wcsArg = wcs === "active" ? "#578" : String(parseInt(String(wcs).replace("G", ""), 10) - 53);
  const actLabel = action === "report" ? "measure only" : action === "rotate" ? "rotate to 0" : "set A0";
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const PR = (axis, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis, to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (axis, goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis, goto };
    S.push(b2);
  };
  const RD = (axis, v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const RM = (axis, v6) => {
    const b2 = newBlock("readmachine");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const SWO = (axis, value) => {
    const b2 = newBlock("setworkoffset");
    b2.params = { wcs: wcsArg, axis, value };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const ppZdown = (resultVar) => {
    PR("Z", "#7", "#3");
    CK("Z", 1);
    MV("Z", "#10");
    PR("Z", "#7", "#4");
    CK("Z", 1);
    RD("Z", resultVar);
    MV("Z", "#10");
  };
  C(`Rotary clock | ${actLabel} | ref ${refLabel} | span ${span}mm | ${wcsLabel}`);
  C("Indicate a flat: probe two points across it in Y, find tilt, datum A. No centreline needed.");
  C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
  C("Motion Variables");
  A("#1", dist, "Max probe distance");
  A("#2", srcVal(src.retract, retract), srcNote(src.retract, "Retract"));
  A("#3", srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, "Fast feed"));
  A("#4", fSlow, "Slow feed");
  A("#5", srcVal(src.port, port), srcNote(src.port, "Probe port"));
  A("#6", span, "Y span between the two flat touches");
  A("#7", "[0-#1]", "Neg max");
  A("#8", "#1", "Pos max");
  A("#9", "[0-#2]", "Neg retract");
  A("#10", "#2", "Pos retract");
  A("#17", Math.round(safeZ), "Safe Z");
  C("Confirm Start");
  CF("Position over the flat, near A0. Enter to probe - ESC=cancel", 2);
  DM("inc");
  C("Point A: probe down onto the flat");
  ppZdown("#51");
  MV("Z", "#17");
  MV("Y", "#6");
  C("Point B: probe down onto the flat");
  ppZdown("#52");
  C("Tilt of the flat (degrees) = atan( dZ / span )");
  A("#53", "ATAN[[#52-#51]]/[#6]", "phi = atan2(Zb-Za, span)");
  RM("A", "#54");
  if (action === "report") {
    C("Measure only - A offset left unchanged");
  } else if (action === "rotate") {
    C(`Rotate the flat to ${refLabel}, then zero A there - SPINS THE PART (verify direction)`);
    A("#58", `[0-#53${refTerm}]`, "Rotation to reach the reference");
    MV("A", "#58");
    RM("A", "#59");
    SWO("A", "#59");
  } else {
    C(`Set A0 at ${refLabel} without rotating (verify direction on your machine)`);
    SWO("A", `[#54-#53${refTerm}]`);
  }
  C("Final retract");
  MV("Z", "#17");
  DM("abs");
  MSG2(action === "report" ? "Flat tilt #53 deg (measured)" : "Flat tilt #53 deg - A datum set");
  GO(2);
  LB(1);
  DM("inc");
  MV("Z", "#17");
  DM("abs");
  A("#1505", "1", "Probe failed - no contact");
  LB(2);
  END();
  return S;
}
var RotaryClockWizard;
var init_rotaryClockWizard = __esm({
  "../DDCS-Studio/web/wizards/rotaryClockWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    RotaryClockWizard = class {
      generate(params) {
        recordOp("rotary_clock", params);
        return emitMapped(rotaryClockStack(params)).text;
      }
      /** Preview start (stock frame): above the flat near the top, offset to point A (-Y half of span). */
      inferStart(params, stock) {
        const n = (v6, d) => num(v6, d);
        const sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76), span = n(params.span, 20);
        return { x: n(stock && stock.x, 150) / 2, y: sy / 2 - span / 2, z: Math.min(5, sz * 0.5) };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/edgeWizard.js
function edgeStack(params = {}) {
  const axis = params.axis === "Y" ? "Y" : "X", av = AX9[axis];
  const dir = params.dir === "neg" ? "neg" : "pos", plus = dir === "pos";
  const wcs = params.wcs || "active", wcsLabel = wcs === "active" ? "Active WCS" : wcs;
  const dist = num(params.dist, 15), retract = num(params.retract, 2);
  const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
  const level = num(params.level, 0);
  const probeVar = plus ? "#8" : "#7", retractVar = plus ? "#9" : "#10", limitVal = plus ? "2" : "1";
  const S = [];
  const C = (text) => {
    const b2 = newBlock("comment");
    b2.params = { text };
    S.push(b2);
  };
  const A = (v6, value, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(value), note: note || "" };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const PR = (to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis, to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis, goto };
    S.push(b2);
  };
  const IF = (lhs, op, rhs, goto) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs, op, rhs, goto };
    S.push(b2);
  };
  const MV = (v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const END = () => {
    S.push(newBlock("endprogram"));
  };
  C("Motion Variables");
  A("#1", dist, "Max probe distance");
  A("#2", retract, "Retract distance");
  A("#3", fFast, "Fast feedrate");
  A("#4", fSlow, "Slow feedrate");
  A("#5", port, "Probe port");
  C("Result storage");
  A("#50", 0, "Edge contact position");
  C("Pre-calculated motion values");
  A("#7", "[0-#1]", "Negative max probe");
  A("#8", "#1", "Positive max probe");
  A("#9", "[0-#2]", "Negative retract");
  A("#10", "#2", "Positive retract");
  if (wcs === "active") {
    C("Read Active WCS");
    A("#71", "#578", "Active WCS index: 1=G54 2=G55 etc");
    A("#72", "[#71-1]", "Zero-based index");
    A("#70", "[805+[#72*5]]", "Base WCS address");
  } else {
    C(`Target: ${wcs}`);
    A("#70", WCS_BASE3[wcs], "Base WCS address");
  }
  C("Confirm Start");
  A("#1505", 1, `Press Enter to probe ${axis} ${dir} - ESC=cancel`);
  IF("#1505", "==", "0", 2);
  DM("inc");
  C(`Probe ${axis} ${dir}`);
  A(av.stop, "0", "Stop mode: decelerate");
  A(av.limit, limitVal, `Limit protect: ${plus ? "positive" : "negative"}`);
  PR(probeVar, "#3");
  CK(1);
  MV(retractVar);
  PR(probeVar, "#4");
  CK(1);
  A("#50", av.result, "Save edge position");
  MV(retractVar);
  C("Write to WCS");
  A(`#[#70+${av.off}]`, "#50", `Set ${wcsLabel} ${axis} to edge`);
  DM("abs");
  A("#1505", "-5000", "Edge found");
  GO(2);
  LB(1);
  DM("abs");
  A("#1505", 1, "Probe failed - no contact");
  LB(2);
  END();
  return S;
}
var AX9, WCS_BASE3, EdgeWizard;
var init_edgeWizard = __esm({
  "../DDCS-Studio/web/wizards/edgeWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    AX9 = {
      X: { status: "#1920", result: "#1925", stop: "#1905", limit: "#1915", off: 0 },
      Y: { status: "#1921", result: "#1926", stop: "#1906", limit: "#1916", off: 1 }
    };
    WCS_BASE3 = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
    EdgeWizard = class {
      generate(params) {
        recordOp("edge", params);
        return emitMapped(edgeStack(params)).text;
      }
      /** Preview/sim start hint (stock frame): park clear of the wall being probed, perpendicular axis at centre —
       *  the single-wall version of the Middle/Corner inferStart, so the probe approaches the face from open space.
       *  dir pos probes +axis (hits the near/0 face from outside); dir neg probes −axis (hits the far face). */
      inferStart(params, stock) {
        const n = (v6, d) => num(v6, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        const outset = Math.max(6, Math.min(n(params.dist, 15) * 0.6, 15));
        const pos = (params.dir || "pos") !== "neg";
        return (params.axis || "X") === "X" ? { x: pos ? -outset : sx + outset, y: cy, z: probeZ } : { x: cx, y: pos ? -outset : sy + outset, z: probeZ };
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/alignmentWizard.js
function alignmentStack(params = {}) {
  const checkAxis = params.checkAxis === "Y" ? "Y" : "X";
  const probeAxis = checkAxis === "X" ? "Y" : "X";
  const dir = params.probeDir === "neg" ? "neg" : "pos", plus = dir === "pos";
  const dirLabel = plus ? "pos" : "neg";
  const safeZ = num(params.safeZ, 10), dist = num(params.dist, 20), retract = num(params.retract, 2);
  const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 20), port = num(params.port, 0);
  const tolerance = num(params.tolerance, 0);
  const src = params.sources || {};
  const probeVar = plus ? "#8" : "#7", retractVar = plus ? "#9" : "#10";
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (l, o, r, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs: l, op: o, rhs: r, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const RM = (axis, v6) => {
    const b2 = newBlock("readmachine");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const PR = (axis, to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis, to, feed, port: "#5", level: num(params.level, 0) };
    S.push(b2);
  };
  const CK = (axis, goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis, goto };
    S.push(b2);
  };
  const RD = (axis, v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis, var: v6 };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const twoPass = (resultVar) => {
    PR(probeAxis, probeVar, "#3");
    CK(probeAxis, 1);
    MV(probeAxis, retractVar);
    PR(probeAxis, probeVar, "#4");
    CK(probeAxis, 1);
    RD(probeAxis, resultVar);
    MV(probeAxis, retractVar);
  };
  C(`Alignment | Fence along: ${checkAxis} | Probe: ${probeAxis} ${dirLabel}`);
  C(`Misalignment = contact_B - contact_A over the span along ${checkAxis}`);
  C(`Tolerance: ${tolerance}mm | SafeZ: ${safeZ}mm | Fast: ${fFast} | Slow: ${fSlow}`);
  C("Motion Variables");
  A("#1", dist, "Max probe distance");
  A("#2", srcVal(src.retract, retract), srcNote(src.retract, "Retract distance"));
  A("#3", srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, "Fast feedrate"));
  A("#4", fSlow, "Slow feedrate");
  A("#5", srcVal(src.port, port), srcNote(src.port, "Probe port"));
  C("Pre-calculated motion values");
  A("#7", "[0-#1]", "Negative max probe");
  A("#8", "#1", "Positive max probe");
  A("#9", "[0-#2]", "Negative retract");
  A("#10", "#2", "Positive retract");
  A("#19", safeZ, "Safe Z lift distance - positive");
  A("#20", `[0-${safeZ}]`, "Safe Z descend distance - negative");
  C("Result storage");
  A("#50", 0, "Point A probe contact");
  A("#51", 0, "Point B probe contact");
  A("#52", 0, "Delta: B - A wander");
  A("#53", 0, "Span absolute value");
  A("#54", 0, "Misalignment angle degrees");
  A("#70", 0, "Point A checkAxis machine coord");
  A("#71", 0, "Point B checkAxis machine coord");
  A("#72", 0, "Span signed: B - A");
  C(`===== POINT A: First probe along ${checkAxis} fence =====`);
  C("Position probe at point A along the fence, at probing height");
  CF("Press Enter when in position at point A - ESC=cancel", 2);
  RM(checkAxis, "#70");
  DM("inc");
  twoPass("#50");
  MV("Z", "#19");
  DM("abs");
  C(`===== POINT B: Second probe along ${checkAxis} fence =====`);
  C(`REPOSITION: jog to point B along the ${checkAxis} fence - keep same Y/Z`);
  CF("Press Enter when in position at point B - ESC=cancel", 2);
  RM(checkAxis, "#71");
  A("#72", "[#71-#70]", `Span = B - A along ${checkAxis}`);
  DM("inc");
  MV("Z", "#20");
  twoPass("#51");
  DM("abs");
  C("===== COMPUTE ALIGNMENT =====");
  A("#52", "[#51-#50]", `Delta: fence wander in ${probeAxis} from A to B`);
  A("#53", "ABS[#72]", `Absolute span along ${checkAxis}`);
  IF("#53", "==", "0", 1);
  A("#54", "ATAN[#52]/[#53]", "Misalignment angle (deg) = atan2(delta, span) \u2014 two-operand atan[a]/[b] form");
  MV("Z", "#19");
  DM("abs");
  C("===== RESULTS =====");
  A("#1510", "#52", "Delta: fence wander in probe axis");
  A("#1511", "#53", "Span: absolute distance along check axis");
  A("#1512", "#54", "Angle: misalignment in degrees");
  MSG2("Drift=#1510mm Span=#1511mm Angle=#1512deg");
  GO(2);
  LB(1);
  DM("abs");
  A("#1505", "1", "Probe failed or zero span - check position");
  LB(2);
  END();
  return S;
}
var AlignmentWizard;
var init_alignmentWizard = __esm({
  "../DDCS-Studio/web/wizards/alignmentWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    AlignmentWizard = class {
      constructor() {
      }
      generate(params) {
        recordOp("alignment", params);
        return emitMapped(alignmentStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/viz/toolProfile.js
function toolHalfProfile(tool) {
  const type = tool && tool.type || "endmill";
  const dia = numOr(tool && tool.dia, 6);
  const r = dia / 2;
  const len = numOr(tool && tool.length, dia * 4);
  const ang = numOr(tool && tool.angle, DEFAULT_ANGLE[type] || 0);
  switch (type) {
    case "ballnose": {
      const pts = [];
      const segs = 10;
      for (let i = 0; i <= segs; i++) {
        const a = Math.PI / 2 * (i / segs);
        pts.push([r * Math.sin(a), r - r * Math.cos(a)]);
      }
      pts.push([r, Math.max(len, r)]);
      return pts;
    }
    case "vbit":
    case "chamfer":
    case "engraver":
    case "spotdrill": {
      const coneH = r / Math.tan((ang || 90) / 2 * Math.PI / 180);
      return [[0, 0], [r, coneH], [r, Math.max(len, coneH)]];
    }
    case "drill": {
      const tipH = r / Math.tan((ang || 118) / 2 * Math.PI / 180);
      return [[0, 0], [r, tipH], [r, Math.max(len, tipH)]];
    }
    case "tapered": {
      const tip = r * 0.3;
      return [[tip, 0], [r, len * 0.6], [r, len]];
    }
    case "face":
    case "surfacing":
      return [[r, 0], [r, Math.max(len * 0.35, r * 0.6)]];
    case "tap":
    case "reamer":
    case "endmill":
    default:
      return [[r, 0], [r, len]];
  }
}
function toolProfileSvg(tool, { w: w2 = 40, h = 60, color = "var(--accent, #6cc)", stroke = "#888", bg = "transparent" } = {}) {
  const half = toolHalfProfile(tool);
  const maxR = Math.max(0.1, ...half.map((p) => p[0]));
  const maxZ = Math.max(0.1, ...half.map((p) => p[1]));
  const pad = 3;
  const sx = (w2 / 2 - pad) / maxR;
  const sz = (h - 2 * pad) / maxZ;
  const cx = w2 / 2;
  const toXY = (p, sign) => [(cx + sign * p[0] * sx).toFixed(1), (h - pad - p[1] * sz).toFixed(1)];
  const right = half.map((p) => toXY(p, 1));
  const left = half.slice().reverse().map((p) => toXY(p, -1));
  const poly = right.concat(left).map((q) => q[0] + "," + q[1]).join(" ");
  return `<svg viewBox="0 0 ${w2} ${h}" width="${w2}" height="${h}" class="tool-profile" aria-hidden="true">` + (bg !== "transparent" ? `<rect width="${w2}" height="${h}" fill="${bg}"/>` : "") + `<polygon points="${poly}" fill="${color}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round"/></svg>`;
}
var DEFAULT_ANGLE, numOr;
var init_toolProfile = __esm({
  "../DDCS-Studio/web/viz/toolProfile.js"() {
    DEFAULT_ANGLE = { vbit: 90, chamfer: 90, engraver: 30, spotdrill: 90, drill: 118 };
    numOr = (v6, d) => {
      const n = Number(v6);
      return Number.isFinite(n) && n > 0 ? n : d;
    };
  }
});

// ../DDCS-Studio/web/wizards/atcLengthWizard.js
function atcLengthStack(params = {}) {
  const blockHeight = num(params.blockHeight, 50), safeZ = num(params.safeZ, 10), maxDist = num(params.maxDist, 100);
  const retract = num(params.retract, 3), fFast = num(params.f_fast, 300), fSlow = num(params.f_slow, 50);
  const port = num(params.port, 2), level = num(params.level, 0);
  const src = params.sources || {};
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (l, o, r, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs: l, op: o, rhs: r, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const SPOFF = () => {
    const b2 = newBlock("spindle");
    b2.params = { rpm: 0 };
    S.push(b2);
  };
  const COOLOFF = () => {
    const b2 = newBlock("coolant");
    b2.params = { flow: "off" };
    S.push(b2);
  };
  const PR = (to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis: "Z", to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis: "Z", goto };
    S.push(b2);
  };
  const RD = (v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis: "Z", var: v6 };
    S.push(b2);
  };
  const TO = (tool, value) => {
    const b2 = newBlock("tooloffset");
    b2.params = { tool, value };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  C("ATC | Tool Length Setter");
  C(`Block Height: ${blockHeight}mm | Safe Z: ${safeZ}mm`);
  C(`Fast: ${fFast} | Slow: ${fSlow} | Max Plunge: ${maxDist}mm`);
  C("=== CONFIGURATION ===");
  A("#1", maxDist, "Max search distance");
  A("#2", retract, "Retract distance");
  A("#3", fFast, "Fast approach feedrate");
  A("#4", fSlow, "Slow precision touch feedrate");
  A("#5", srcVal(src.setterPort, port), srcNote(src.setterPort, "Probe port"));
  A("#6", srcVal(src.blockHeight, blockHeight), srcNote(src.blockHeight, "Tool setter block height"));
  A("#19", safeZ, "Safe Z height");
  C("=== CALCULATED MOTIONS ===");
  A("#7", "[0-#1]", "Negative plunge");
  A("#10", "#2", "Positive retract");
  C("Confirm Start");
  CF("Hover tool above setter. Press Enter", 2);
  SPOFF();
  COOLOFF();
  DM("inc");
  C("Step 1: Fast Probe Down");
  PR("#7", "#3");
  CK(1);
  MV("Z", "#10");
  C("Step 2: Slow Precision Touch");
  PR("#7", "#4");
  CK(1);
  DM("abs");
  C("Calculate and store the tool length offset");
  RD("#101");
  A("#102", "[#101 - #6]", "Length = MachineZ - BlockHeight");
  A("#103", curToolVar(getDialect4()), "Read current tool number");
  IF("#103", "<", "1", 3);
  TO("#103", "#102");
  MV("Z", "#19");
  MSG2("Tool length successfully saved");
  GO(2);
  C("=== ERROR HANDLERS ===");
  LB(1);
  DM("abs");
  A("#1505", "1", "ERROR: Tool Setter missed");
  GO(2);
  LB(3);
  DM("abs");
  A("#1505", "1", "ERROR: No tool number set - check #1300");
  LB(2);
  END();
  return S;
}
var getDialect4, curToolVar, AtcLengthWizard;
var init_atcLengthWizard = __esm({
  "../DDCS-Studio/web/wizards/atcLengthWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    init_dialects();
    init_controllerProfiles();
    getDialect4 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    curToolVar = (d) => "#" + (d && d.vars && d.vars.atc && d.vars.atc.currentTool || 1300);
    AtcLengthWizard = class {
      generate(params) {
        recordOp("atc_length", params);
        return emitMapped(atcLengthStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/atcWarmupWizard.js
function atcWarmupStack(params = {}) {
  const rpm1 = num(params.rpm1, 6e3), time1 = num(params.time1, 30);
  const rpm2 = num(params.rpm2, 12e3), time2 = num(params.time2, 30);
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const SP = (rpm) => {
    const b2 = newBlock("spindle");
    b2.params = { rpm, dir: "cw" };
    S.push(b2);
  };
  const SPOFF = () => {
    const b2 = newBlock("spindle");
    b2.params = { rpm: 0 };
    S.push(b2);
  };
  const COOLOFF = () => {
    const b2 = newBlock("coolant");
    b2.params = { flow: "off" };
    S.push(b2);
  };
  const DW = (sec) => {
    const b2 = newBlock("dwell");
    b2.params = { sec };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  C("Spindle Warm-up");
  C(`Stage 1: ${rpm1} RPM for ${time1}s`);
  C(`Stage 2: ${rpm2} RPM for ${time2}s`);
  CF("Warm up spindle? Press Enter", 999);
  SPOFF();
  COOLOFF();
  C("Stage 1");
  MSG2(`Starting at ${rpm1} RPM`);
  SP(rpm1);
  DW(time1);
  C("Stage 2");
  MSG2(`Ramping to ${rpm2} RPM`);
  SP(rpm2);
  DW(time2);
  SPOFF();
  MSG2("Warmup complete - spindle ready");
  LB(999);
  END();
  return S;
}
var AtcWarmupWizard;
var init_atcWarmupWizard = __esm({
  "../DDCS-Studio/web/wizards/atcWarmupWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    AtcWarmupWizard = class {
      generate(params) {
        recordOp("atc_warmup", params);
        return emitMapped(atcWarmupStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/atcChangeWizard.js
function H(S) {
  return {
    C: (t) => {
      const b2 = newBlock("comment");
      b2.params = { text: t };
      S.push(b2);
    },
    A: (v6, val2, note) => {
      const b2 = newBlock("assign");
      b2.params = { var: v6, value: String(val2), note: note || "" };
      S.push(b2);
    },
    IF: (l, o, r, g) => {
      const b2 = newBlock("ifgoto");
      b2.params = { lhs: l, op: o, rhs: r, goto: g };
      S.push(b2);
    },
    GO: (n) => {
      const b2 = newBlock("goto");
      b2.params = { n };
      S.push(b2);
    },
    LB: (n) => {
      const b2 = newBlock("label");
      b2.params = { n };
      S.push(b2);
    },
    SPOFF: () => {
      const b2 = newBlock("spindle");
      b2.params = { rpm: 0 };
      S.push(b2);
    },
    COOLOFF: () => {
      const b2 = newBlock("coolant");
      b2.params = { flow: "off" };
      S.push(b2);
    },
    MM: (axis, to) => {
      const b2 = newBlock("machinemove");
      b2.params = { axis, to };
      S.push(b2);
    },
    MC: (code, note) => {
      const b2 = newBlock("mcode");
      b2.params = { code, note };
      S.push(b2);
    },
    CF: (msg, cancel) => {
      const b2 = newBlock("confirm");
      b2.params = { msg, cancel };
      S.push(b2);
    },
    PAUSE: () => S.push(newBlock("pause")),
    MSG: (text) => {
      const b2 = newBlock("message");
      b2.params = { text };
      S.push(b2);
    },
    END: () => S.push(newBlock("endprogram"))
  };
}
function manualStack(params) {
  const x = num(params.x, 100), y = num(params.y, 100), z = num(params.z, 0);
  const d = getDialect5();
  const dro = d && d.vars && d.vars.dro || 880;
  const S = [];
  const { C, A, SPOFF, COOLOFF, MM, PAUSE, MSG: MSG2, END } = H(S);
  C("ATC | Manual Tool Change");
  C(`Park: X${x} Y${y} Z${z} - operator swaps the tool by hand`);
  C("=== CONFIGURATION ===");
  A("#1", x, "Park X");
  A("#2", y, "Park Y");
  A("#3", z, "Park Z");
  C("Stop spindle and coolant");
  SPOFF();
  COOLOFF();
  A("#1155", `#${dro} + 0`, "Save Tool Change X - washed for DDCS priming");
  A("#1156", `#${dro + 1} + 0`, "Save Tool Change Y - washed for DDCS priming");
  C("Park clear of the work - safe Z first, then XY");
  MM("Z", "#3");
  MM("X", "#1");
  MM("Y", "#2");
  C("Manual swap - operator loosens collet, swaps tool, retightens");
  MSG2("Swap tool by hand, then press Cycle Start");
  PAUSE();
  C("Complete");
  MSG2("Tool change complete");
  END();
  return S;
}
function autoStack(params) {
  const d = getDialect5();
  const S = [];
  const { C, A, IF, GO, LB, SPOFF, COOLOFF, MM, MC, CF, MSG: MSG2, END } = H(S);
  const atc = d && d.vars && d.vars.atc;
  if (!atc) {
    C("ATC | Automatic Tool Change");
    C(`Not available on ${d ? d.name : "this controller"} \u2014 no confirmed ATC firmware model.`);
    C("Use Manual mode, or select the DDCS Expert post.");
    END();
    return S;
  }
  const zClear = num(params.zClear, 0), fixedT = num(params.fixedT, 0);
  const useM300 = params.waitSpindle !== false, useCover = params.dustCover === true, confirm2 = params.confirm === true;
  const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && p.tool !== "" && p.tool != null);
  const cur = "#" + atc.currentTool;
  const tgt = fixedT > 0 ? String(fixedT) : "#" + atc.targetTool;
  C("ATC | Automatic Tool Change \u2014 magazine pick & place");
  C("Pockets + park XYZ come from Settings \u2192 Tool table magazine");
  C(fixedT > 0 ? `TEST MODE: fixed target tool T${fixedT}` : `Target tool from ${tgt} \u2014 set by M6 Txx; save as T.nc`);
  C("VERIFY FIRST RUN with no tool in spindle + hand on e-stop");
  if (!mag.length) {
    C("!! Magazine is EMPTY \u2014 add pockets in Settings \u2192 Tool table (or Import from controller).");
    END();
    return S;
  }
  C("=== CONFIGURATION ===");
  A("#100", tgt, "Target tool");
  A("#101", cur, "Current tool in spindle, 0 = empty");
  A("#102", String(zClear), "Z change height - MACHINE coords");
  C("=== VALIDATE ===");
  IF("#100", "==", "#101", 900);
  if (confirm2) {
    A("#1510", "#100", "Show target tool");
    CF("Change to this tool? Press Enter", 999);
  }
  C("=== SPINDLE OFF + RETRACT ===");
  SPOFF();
  COOLOFF();
  if (useM300) MC(300, "Wait: spindle-stopped sensor");
  if (useCover) MC(162, "Dust cover OPEN");
  MM("Z", "#102");
  C("=== PUT AWAY CURRENT TOOL \u2014 skipped if spindle empty or tool not in magazine ===");
  IF("#101", "<", "1", 20);
  mag.forEach((p, i) => IF("#101", "==", String(num(p.tool, 0)), 100 + i));
  GO(20);
  mag.forEach((p, i) => {
    LB(100 + i);
    C(`Return T${num(p.tool, 0)} to pocket ${i + 1}`);
    A("#110", String(num(p.x, 0)), "Pocket X");
    A("#111", String(num(p.y, 0)), "Pocket Y");
    A("#112", String(num(p.z, 0)), "Pocket Z");
    MM("X", "#110");
    MM("Y", "#111");
    MM("Z", "#112");
    MC(154, "Drawbar RELEASE");
    MC(301, "Wait: drawbar-released sensor");
    MM("Z", "#102");
    A(cur, "0", "Spindle now empty");
    GO(20);
  });
  LB(20);
  C("=== PICK UP TARGET TOOL ===");
  mag.forEach((p, i) => IF("#100", "==", String(num(p.tool, 0)), 200 + i));
  A("#1505", "1", "ERROR: target tool has no pocket in the magazine");
  GO(999);
  mag.forEach((p, i) => {
    LB(200 + i);
    C(`Fetch T${num(p.tool, 0)} from pocket ${i + 1}`);
    A("#110", String(num(p.x, 0)), "Pocket X");
    A("#111", String(num(p.y, 0)), "Pocket Y");
    A("#112", String(num(p.z, 0)), "Pocket Z");
    MM("X", "#110");
    MM("Y", "#111");
    MC(154, "Collet OPEN before descending");
    MC(301, "Wait: drawbar-released sensor");
    MM("Z", "#112");
    MC(155, "Drawbar LOCK");
    MC(302, "Wait: tool-locked sensor");
    MM("Z", "#102");
    if (useCover) MC(163, "Dust cover CLOSE");
    A(cur, "#100", "Current tool = target");
    MSG2("Tool change complete");
    GO(999);
  });
  C("=== HANDLERS ===");
  LB(900);
  MSG2("Tool already in spindle - nothing to do");
  GO(999);
  LB(999);
  END();
  return S;
}
function atcChangeStack(params = {}) {
  return params.mode === "auto" ? autoStack(params) : manualStack(params);
}
var getDialect5, AtcChangeWizard;
var init_atcChangeWizard = __esm({
  "../DDCS-Studio/web/wizards/atcChangeWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_dialects();
    init_controllerProfiles();
    getDialect5 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    AtcChangeWizard = class {
      generate(params) {
        recordOp("atc_change", params);
        return emitMapped(atcChangeStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/atcTestWizard.js
function H2(S) {
  return {
    C: (t) => {
      const b2 = newBlock("comment");
      b2.params = { text: t };
      S.push(b2);
    },
    A: (v6, val2, note) => {
      const b2 = newBlock("assign");
      b2.params = { var: v6, value: String(val2), note: note || "" };
      S.push(b2);
    },
    IF: (l, o, r, g) => {
      const b2 = newBlock("ifgoto");
      b2.params = { lhs: l, op: o, rhs: r, goto: g };
      S.push(b2);
    },
    LB: (n) => {
      const b2 = newBlock("label");
      b2.params = { n };
      S.push(b2);
    },
    SPOFF: () => {
      const b2 = newBlock("spindle");
      b2.params = { rpm: 0 };
      S.push(b2);
    },
    COOLOFF: () => {
      const b2 = newBlock("coolant");
      b2.params = { flow: "off" };
      S.push(b2);
    },
    MM: (axis, to) => {
      const b2 = newBlock("machinemove");
      b2.params = { axis, to };
      S.push(b2);
    },
    MC: (code, note) => {
      const b2 = newBlock("mcode");
      b2.params = { code, note };
      S.push(b2);
    },
    DW: (sec) => {
      const b2 = newBlock("dwell");
      b2.params = { sec };
      S.push(b2);
    },
    CF: (msg, cancel) => {
      const b2 = newBlock("confirm");
      b2.params = { msg, cancel };
      S.push(b2);
    },
    MSG: (text) => {
      const b2 = newBlock("message");
      b2.params = { text };
      S.push(b2);
    },
    END: () => S.push(newBlock("endprogram"))
  };
}
function drawbarStack(params) {
  const cycles = Math.max(1, num(params.cycles, 10));
  const dwellSec = Math.max(0, num(params.dwellMs, 500)) / 1e3;
  const S = [];
  const { C, A, IF, LB, SPOFF, COOLOFF, MC, DW, MSG: MSG2, END } = H2(S);
  C("ATC | Drawbar Cycle Test - commissioning");
  C(`${cycles} release/lock cycles - sensors M301/M302 verified each cycle`);
  C("NO tool in the spindle. A hang on a wait = that sensor/valve needs adjusting");
  C("=== CONFIGURATION ===");
  A("#100", 1, "Cycle counter");
  A("#101", cycles, "Cycles");
  SPOFF();
  COOLOFF();
  MC(300, "Wait: spindle-stopped sensor");
  LB(10);
  C("CYCLE START");
  MSG2("Cycle #100: RELEASE");
  MC(154, "Drawbar RELEASE");
  MC(301, "Wait: drawbar-released sensor");
  DW(dwellSec);
  MSG2("Cycle #100: LOCK");
  MC(155, "Drawbar LOCK");
  MC(302, "Wait: tool-locked sensor");
  DW(dwellSec);
  A("#100", "[#100+1]", "Next cycle");
  IF("#100", "<=", "#101", 10);
  C("Complete - drawbar left LOCKED");
  MSG2("Drawbar test complete");
  END();
  return S;
}
function pocketsStack(params) {
  const d = getDialect6();
  const S = [];
  const { C, A, LB, SPOFF, COOLOFF, MM, CF, MSG: MSG2, END } = H2(S);
  const atc = d && d.vars && d.vars.atc;
  const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && p.tool !== "" && p.tool != null);
  const first = Math.max(1, num(params.first, 1));
  const count = Math.max(1, num(params.count, mag.length || 1));
  const sel = mag.slice(first - 1, first - 1 + count);
  const zClear = num(params.zClear, 0);
  const descend = params.descend === true;
  C("ATC | Pocket Dry-Run - commissioning");
  C("Visits each taught magazine pocket (Settings \u2192 Tool table) at clearance Z");
  C("NO tool in spindle, NO drawbar action - visual alignment check at each stop");
  if (!atc) {
    C(`Not available on ${d ? d.name : "this controller"} \u2014 select the DDCS Expert post.`);
    END();
    return S;
  }
  if (!sel.length) {
    C("!! Magazine is EMPTY \u2014 add pockets in Settings \u2192 Tool table (or Import from controller).");
    END();
    return S;
  }
  C("=== CONFIGURATION ===");
  A("#102", String(zClear), "Z clearance height - MACHINE coords");
  SPOFF();
  COOLOFF();
  MM("Z", "#102");
  sel.forEach((p, i) => {
    C(`Pocket ${first + i} \u2014 T${num(p.tool, 0)}`);
    A("#110", String(num(p.x, 0)), "Pocket X");
    A("#111", String(num(p.y, 0)), "Pocket Y");
    MM("X", "#110");
    MM("Y", "#111");
    if (descend) {
      A("#112", String(num(p.z, 0)), "Pocket Z");
      MM("Z", "#112");
    }
    CF(`Pocket ${first + i} \u2014 verify alignment. Enter = next`, 999);
    if (descend) MM("Z", "#102");
  });
  C("Complete");
  MSG2("Pocket dry-run complete");
  LB(999);
  END();
  return S;
}
function atcTestStack(params = {}) {
  return params.mode === "pockets" ? pocketsStack(params) : drawbarStack(params);
}
var getDialect6, AtcTestWizard;
var init_atcTestWizard = __esm({
  "../DDCS-Studio/web/wizards/atcTestWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_dialects();
    init_controllerProfiles();
    getDialect6 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    AtcTestWizard = class {
      generate(params) {
        recordOp("atc_test", params);
        return emitMapped(atcTestStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/atcToolCheckWizard.js
function atcToolCheckStack(params = {}) {
  const d = getDialect7();
  const toolBase = d && d.vars && d.vars.toolTable || 1430;
  const curTool = "#" + (d && d.vars && d.vars.atc && d.vars.atc.currentTool || 1300);
  const blockHeight = num(params.blockHeight, 50), safeZ = num(params.safeZ, 10), maxDist = num(params.maxDist, 100);
  const retract = num(params.retract, 3), fFast = num(params.f_fast, 300), fSlow = num(params.f_slow, 50);
  const port = num(params.port, 2), level = num(params.level, 0), tol = num(params.tolerance, 0.5);
  const src = params.sources || {};
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  const A = (v6, val2, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(val2), note: note || "" };
    S.push(b2);
  };
  const IF = (l, o, r, g) => {
    const b2 = newBlock("ifgoto");
    b2.params = { lhs: l, op: o, rhs: r, goto: g };
    S.push(b2);
  };
  const GO = (n) => {
    const b2 = newBlock("goto");
    b2.params = { n };
    S.push(b2);
  };
  const LB = (n) => {
    const b2 = newBlock("label");
    b2.params = { n };
    S.push(b2);
  };
  const DM = (m) => {
    const b2 = newBlock("distmode");
    b2.params = { dist: m };
    S.push(b2);
  };
  const CF = (msg, cancel) => {
    const b2 = newBlock("confirm");
    b2.params = { msg, cancel };
    S.push(b2);
  };
  const PR = (to, feed) => {
    const b2 = newBlock("probe");
    b2.params = { axis: "Z", to, feed, port: "#5", level };
    S.push(b2);
  };
  const CK = (goto) => {
    const b2 = newBlock("probecheck");
    b2.params = { axis: "Z", goto };
    S.push(b2);
  };
  const RD = (v6) => {
    const b2 = newBlock("proberead");
    b2.params = { axis: "Z", var: v6 };
    S.push(b2);
  };
  const MV = (axis, v6) => {
    const b2 = newBlock("move");
    b2.params = { mode: "rapid", [axis.toLowerCase()]: v6 };
    S.push(b2);
  };
  const MSG2 = (text) => {
    const b2 = newBlock("message");
    b2.params = { text };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  C("ATC | Tool Breakage / Length Re-check");
  C(`Tolerance +/-${tol}mm | Block ${blockHeight}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
  C("Aborts if the tool is broken, missing, or the wrong length. Compares to tool table.");
  C("=== CONFIGURATION ===");
  A("#1", maxDist, "Max search distance");
  A("#2", retract, "Retract");
  A("#3", fFast, "Fast approach");
  A("#4", fSlow, "Slow touch");
  A("#5", srcVal(src.setterPort, port), srcNote(src.setterPort, "Setter port"));
  A("#6", srcVal(src.blockHeight, blockHeight), srcNote(src.blockHeight, "Tool setter block height"));
  A("#19", safeZ, "Safe Z");
  A("#20", tol, "Tolerance");
  A("#21", "[0-#20]", "Negative tolerance");
  A("#7", "[0-#1]", "Negative plunge");
  A("#10", "#2", "Positive retract");
  C("Confirm Start");
  CF("Hover tool over the setter. Press Enter", 2);
  DM("inc");
  C("Fast probe down");
  PR("#7", "#3");
  CK(1);
  MV("Z", "#10");
  C("Slow precision touch");
  PR("#7", "#4");
  CK(1);
  DM("abs");
  C("Measure + compare to the stored tool length");
  RD("#51");
  A("#52", "[#51-#6]", "Measured length = MachineZ - block height");
  A("#53", curTool, "Current tool number");
  IF("#53", "<", "1", 3);
  A("#54", `[${toolBase}+#53-1]`, "Tool table address");
  A("#55", "#[#54]", "Expected stored length");
  A("#56", "[#52-#55]", "Deviation");
  IF("#56", ">", "#20", 4);
  IF("#56", "<", "#21", 4);
  C("Tool OK");
  MV("Z", "#19");
  MSG2("Tool OK - length deviation #56 mm");
  GO(2);
  C("=== FAULT HANDLERS ===");
  LB(1);
  DM("abs");
  A("#1505", "1", "FAULT: no contact - tool broken or missing");
  GO(2);
  LB(3);
  DM("abs");
  A("#1505", "1", "ERROR: no tool number set - check #1300");
  GO(2);
  LB(4);
  DM("abs");
  MV("Z", "#19");
  A("#1505", "1", "FAULT: length off by #56 mm - broken or wrong tool");
  GO(2);
  LB(2);
  END();
  return S;
}
var getDialect7, AtcToolCheckWizard;
var init_atcToolCheckWizard = __esm({
  "../DDCS-Studio/web/wizards/atcToolCheckWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_probeBlocks();
    init_dialects();
    init_controllerProfiles();
    getDialect7 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    AtcToolCheckWizard = class {
      generate(params) {
        recordOp("atc_check", params);
        return emitMapped(atcToolCheckStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/atcTableWizard.js
function atcTableStack(params = {}) {
  const d = getDialect8();
  const S = [];
  const C = (text) => {
    const b2 = newBlock("comment");
    b2.params = { text };
    S.push(b2);
  };
  const A = (v6, value, note) => {
    const b2 = newBlock("assign");
    b2.params = { var: v6, value: String(value), note: note || "" };
    S.push(b2);
  };
  const END = () => S.push(newBlock("endprogram"));
  const atc = d && d.vars && d.vars.atc;
  const toolBase = d && d.vars && d.vars.toolTable || 1430;
  const tools = (Array.isArray(params.tools) ? params.tools : []).filter((t) => t && t.num != null && t.num !== "" && t.length !== "" && t.length != null && Number.isFinite(Number(t.length)));
  const mag = (Array.isArray(params.magazine) ? params.magazine : []).filter((p) => p && (p.x !== "" || p.y !== "" || p.z !== ""));
  const doLengths = params.includeLengths !== false;
  const doPockets = params.includePockets !== false && !!atc;
  C("ATC | Write Tool Table to controller");
  C("RUN THIS ON THE CONTROLLER to apply the tool table + pockets \u2014 variable writes only, no motion.");
  C("Source: Settings \u2192 Tool table (library lengths + magazine pockets).");
  if (doLengths) {
    C(`=== TOOL LENGTHS (table base #${toolBase}) ===`);
    if (!tools.length) C("(no tool lengths set in the library)");
    tools.forEach((t) => {
      const n = parseInt(t.num, 10);
      A(`#${toolBase + n - 1}`, Number(t.length), `T${n}${t.name ? " " + t.name : ""} length`);
    });
  }
  if (doPockets) {
    C(`=== POCKET POSITIONS (#${atc.pocketX}/#${atc.pocketY}/#${atc.pocketZ}) \u2014 UNVERIFIED: running this is the test ===`);
    if (!mag.length) C("(no pockets in the magazine)");
    mag.forEach((p, i) => {
      const idx = num(p.pocket, i + 1);
      A(`#${atc.pocketX + idx - 1}`, num(p.x, 0), `Pocket ${idx} X`);
      A(`#${atc.pocketY + idx - 1}`, num(p.y, 0), `Pocket ${idx} Y`);
      A(`#${atc.pocketZ + idx - 1}`, num(p.z, 0), `Pocket ${idx} Z`);
    });
  } else if (params.includePockets !== false && !atc) {
    C("Pockets: not available on this controller (no mapped ATC model)");
  }
  END();
  return S;
}
var getDialect8, AtcTableWizard;
var init_atcTableWizard = __esm({
  "../DDCS-Studio/web/wizards/atcTableWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_util();
    init_dialects();
    init_controllerProfiles();
    getDialect8 = () => {
      try {
        return resolveActivePost(getActiveProfile().id);
      } catch (_) {
        return null;
      }
    };
    AtcTableWizard = class {
      generate(params) {
        recordOp("atc_table", params);
        return emitMapped(atcTableStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/blocks/programFraming.js
function makeStart(params = {}) {
  const sp = params.spindle || {};
  const rpm = num(params.rpm, 0) > 0 ? num(params.rpm, 0) : num(sp.defaultRpm, 0);
  const b2 = newBlock("progstart");
  b2.params = { rpm, dir: sp.dir || "cw", spinUp: num(sp.spinUp, 0), clearance: num(params.clearance, 5) };
  return b2;
}
function makeEnd(params = {}) {
  const ep = params.endProgram || {};
  const b2 = newBlock("progend");
  b2.params = {
    spindleOff: ep.spindleOff !== false,
    coolantOff: ep.coolantOff !== false,
    retract: ep.retract !== false,
    retractZ: num(ep.retractZ, 0),
    park: ep.park === true,
    parkX: num(ep.parkX, 0),
    parkY: num(ep.parkY, 0),
    end: ep.end || "M30"
  };
  return b2;
}
var init_programFraming = __esm({
  "../DDCS-Studio/web/blocks/programFraming.js"() {
    init_blockModel();
    init_util();
  }
});

// ../DDCS-Studio/web/wizards/drillWizard.js
function drillStack(params = {}) {
  const arr = newBlock("array");
  arr.params = {
    pattern: params.pattern || "grid",
    x0: num(params.x0, 0),
    y0: num(params.y0, 0),
    cols: num(params.cols, 3),
    rows: num(params.rows, 2),
    dx: num(params.dx, 20),
    dy: num(params.dy, 20),
    count: num(params.count, 4),
    spacing: num(params.spacing, 20),
    angle: num(params.angle, 0),
    dia: num(params.dia, 50),
    startAngle: num(params.startAngle, 0),
    w: num(params.w, 100),
    h: num(params.h, 80),
    nx: num(params.nx, 2),
    ny: num(params.ny, 2),
    // rect-perimeter pattern
    skip: params.skip || ""
  };
  const helical = params.method === "helical";
  const hole = newBlock(helical ? "bore" : "drill");
  hole.params = helical ? { x: 0, y: 0, holeDia: num(params.holeDia, 12), toolDia: num(params.toolDia, 6), depth: num(params.depth, 5), pitch: num(params.pitch, 0.5), feed: num(params.feed, 100), clearance: num(params.clearance, 5) } : { x: 0, y: 0, depth: num(params.depth, 5), peck: num(params.peck, 5), feed: num(params.feed, 100), clearance: num(params.clearance, 5) };
  arr.children = [hole];
  return [makeStart(params), arr, makeEnd(params)];
}
var DrillWizard;
var init_drillWizard = __esm({
  "../DDCS-Studio/web/wizards/drillWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_programFraming();
    init_ops();
    init_util();
    DrillWizard = class {
      generate(params) {
        recordOp("drill", params);
        return emitMapped(drillStack(params)).text;
      }
      /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
      inferStart() {
        return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) };
      }
    };
  }
});

// ../DDCS-Studio/web/shared/js/client.js
var client_exports = {};
__export(client_exports, {
  deriveStatus: () => deriveStatus,
  deviceName: () => deviceName,
  makeClient: () => makeClient
});
function resolveBase(opts) {
  if (opts.base != null) return opts.base;
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q != null) {
      localStorage.setItem("ddcs_api", q);
      return q;
    }
    return localStorage.getItem("ddcs_api") || "";
  } catch {
    return "";
  }
}
function resolveToken() {
  try {
    const q = new URLSearchParams(location.search).get("token");
    if (q != null) {
      localStorage.setItem("ddcs_token", q);
      return q;
    }
    return localStorage.getItem("ddcs_token") || "";
  } catch {
    return "";
  }
}
function makeClient(opts = {}) {
  const base = resolveBase(opts);
  const tok2 = opts.token ?? resolveToken();
  const authH = tok2 ? { Authorization: "Bearer " + tok2 } : {};
  async function call(path, init = {}) {
    const r = await fetch(base + path, { ...init, headers: { ...authH, ...init.headers || {} } });
    if (r.status === 401) throw new Error(`${path} -> 401 (set ?token=\u2026 for the cloud API)`);
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
    return r.json();
  }
  const postJSON = (path, body) => call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return {
    mode: base ? "remote" : "local",
    descriptor: () => call("/api/descriptor"),
    profile: () => call("/api/profile"),
    // controller profile in the shared shape (controllerProfiles.js)
    readVars: (ns) => call("/api/vars?ns=" + (ns || []).join(",")),
    // live watch-list values (read-only)
    listQueue: () => call("/api/queue"),
    listHistory: (limit = 100) => call("/api/history?limit=" + limit),
    getStatus: (id) => call("/api/status?id=" + encodeURIComponent(id)),
    listFiles: () => call("/api/files"),
    readFile: (name) => call("/api/file?name=" + encodeURIComponent(name)),
    deleteFile: (name) => postJSON("/api/files/delete", { name }),
    submitJob: (name, nc, map) => postJSON("/api/jobs", { name, nc, map }),
    getConfig: () => call("/api/config"),
    setConfig: (updates) => postJSON("/api/config", updates),
    readSysfile: (name) => call("/api/sysfile?name=" + encodeURIComponent(name)),
    // SYSDISK macro file (key-N.nc / slib-m.nc)
    writeSysfile: (name, content, mode = "write") => postJSON("/api/sysfile", { name, content, mode })
    // backed-up write/append
  };
}
function deviceName(d) {
  if (!d) return "";
  if (d.machine_name) return d.machine_name;
  if (d.controller_name) return d.controller_name;
  const m = (d.dest || "").match(/^\\\\([^\\]+)\\/);
  if (m) return m[1];
  return "local";
}
function deriveStatus(client, d) {
  if (!d) return { ok: false, dot: "bad", label: "unreachable", device: "", descriptor: null };
  const device = deviceName(d);
  if ("online" in d) {
    return d.online ? { ok: true, dot: "ok", label: "cloud", device, descriptor: d } : { ok: true, dot: "warn", label: "gateway offline", device, descriptor: d };
  }
  const dest = d.dest || "";
  const isRemote = dest.startsWith("\\\\") || dest.startsWith("//");
  if (!dest) return { ok: true, dot: "warn", label: "no controller set", device: "", descriptor: d };
  if (!d.controller_connected) return { ok: true, dot: "warn", label: "controller offline", device, descriptor: d };
  if (!isRemote) return { ok: true, dot: "warn", label: "sandbox", device: "local folder", descriptor: d };
  return { ok: true, dot: "ok", label: "live", device, descriptor: d };
}
var init_client = __esm({
  "../DDCS-Studio/web/shared/js/client.js"() {
  }
});

// ../DDCS-Studio/web/ui/ioTable.js
function uid(p) {
  return p + "_" + Date.now().toString(36) + _seq2++;
}
function field(text, control, w2) {
  const wrap = document.createElement("label");
  wrap.style.cssText = "display:flex; flex-direction:column; gap:2px; font-size:10px; color:#6b6150;";
  wrap.appendChild(document.createTextNode(text));
  control.style.cssText = INP + (w2 ? ` width:${w2}px;` : "");
  wrap.appendChild(control);
  return wrap;
}
function renderIoTable(container, kind, list2, onChange2) {
  if (!container) return;
  const isInput = kind === "input";
  const TYPES = isInput ? INPUT_TYPES : OUTPUT_TYPES;
  const pinMax = isInput ? 24 : 20;
  const rerender = () => renderIoTable(container, kind, list2, onChange2);
  container.innerHTML = "";
  if (!list2.length) {
    const e = document.createElement("div");
    e.className = "settings-hint";
    e.textContent = `No ${isInput ? "inputs" : "outputs"} yet \u2014 use "${isInput ? "+ Add input" : "+ Add output"}" below to add the ones your machine has.`;
    container.appendChild(e);
  }
  list2.forEach((row) => {
    const usedByOthers = new Set(list2.filter((r) => r !== row).map((r) => r.pin).filter((p) => p !== "" && p != null).map(String));
    const tr = document.createElement("div");
    tr.style.cssText = "display:flex; align-items:flex-end; gap:8px 12px; flex-wrap:wrap; padding:10px 12px; margin-bottom:9px; border:1px solid rgba(90,75,40,0.2); border-radius:7px; background:rgba(255,255,255,0.72); box-shadow:0 1px 3px rgba(0,0,0,0.09);";
    const name = document.createElement("span");
    name.style.cssText = "min-width:130px; font-weight:600; color:#3a3a3a; padding-bottom:4px;";
    name.textContent = (TYPES.find((t) => t.type === row.type) || {}).label || row.type;
    if (row.group) {
      const badge = document.createElement("span");
      badge.textContent = row.group.toUpperCase();
      badge.style.cssText = "margin-left:6px; font-size:9px; font-weight:700; background:#6b7b3a; color:#fff; padding:1px 5px; border-radius:3px; vertical-align:middle;";
      name.appendChild(badge);
    }
    tr.appendChild(name);
    if (isInput && row.type === "limit") {
      const ax = document.createElement("select");
      LIMIT_AXES.forEach(([a, l]) => {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = l;
        if (row.axis === a) o.selected = true;
        ax.appendChild(o);
      });
      ax.addEventListener("change", () => {
        row.axis = ax.value;
        onChange2();
      });
      tr.appendChild(field("Axis", ax, 56));
    }
    const pin = document.createElement("select");
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "\u2014";
    pin.appendChild(none);
    for (let p = 1; p <= pinMax; p++) {
      const o = document.createElement("option");
      o.value = String(p);
      o.textContent = String(p);
      if (usedByOthers.has(String(p))) o.disabled = true;
      if (String(row.pin) === String(p)) o.selected = true;
      pin.appendChild(o);
    }
    pin.addEventListener("change", () => {
      row.pin = pin.value === "" ? "" : Number(pin.value);
      onChange2();
      rerender();
    });
    tr.appendChild(field("Pin", pin, 64));
    if (isInput) {
      const lvl = document.createElement("select");
      [["0", "NC"], ["1", "NO"]].forEach(([v6, t]) => {
        const o = document.createElement("option");
        o.value = v6;
        o.textContent = t;
        if (String(row.level) === v6) o.selected = true;
        lvl.appendChild(o);
      });
      lvl.addEventListener("change", () => {
        row.level = Number(lvl.value);
        onChange2();
      });
      tr.appendChild(field("Level", lvl, 64));
      if (row.type === "setter") {
        [["x", "X"], ["y", "Y"], ["z", "Z"], ["w", "W"], ["h", "H"]].forEach(([k, t]) => {
          const i = document.createElement("input");
          i.type = "number";
          i.step = "0.1";
          i.value = row[k] ?? "";
          i.addEventListener("change", () => {
            row[k] = i.value === "" ? "" : Number(i.value);
            onChange2();
          });
          tr.appendChild(field(t, i, 52));
        });
      }
    } else {
      const on = document.createElement("input");
      on.type = "text";
      on.value = row.onCode ?? "";
      on.addEventListener("change", () => {
        row.onCode = on.value;
        onChange2();
      });
      tr.appendChild(field("ON M-code", on, 78));
      const off = document.createElement("input");
      off.type = "text";
      off.value = row.offCode ?? "";
      off.addEventListener("change", () => {
        row.offCode = off.value;
        onChange2();
      });
      tr.appendChild(field("OFF M-code", off, 78));
    }
    const rm = document.createElement("button");
    rm.className = "toolbar-btn";
    rm.textContent = "\u2715";
    rm.title = "Remove";
    rm.style.cssText = "margin-left:auto; padding:2px 9px; align-self:center;";
    rm.addEventListener("click", () => {
      const i = list2.indexOf(row);
      if (i >= 0) list2.splice(i, 1);
      onChange2();
      rerender();
    });
    tr.appendChild(rm);
    container.appendChild(tr);
  });
  const add = document.createElement("div");
  add.style.cssText = "display:flex; gap:8px; align-items:center; margin-top:12px;";
  const sel = document.createElement("select");
  sel.style.cssText = INP;
  TYPES.forEach((t) => {
    const o = document.createElement("option");
    o.value = t.type;
    o.textContent = t.label;
    sel.appendChild(o);
  });
  const btn = document.createElement("button");
  btn.className = "toolbar-btn settings-io";
  btn.textContent = isInput ? "+ Add input" : "+ Add output";
  btn.addEventListener("click", () => {
    const def = TYPES.find((x) => x.type === sel.value) || {};
    const row = isInput ? { id: uid("in"), type: sel.value, label: def.label, pin: "", level: 0 } : { id: uid("out"), type: sel.value, label: def.label, pin: "", onCode: def.onCode || "", offCode: def.offCode || "" };
    if (isInput && sel.value === "setter") Object.assign(row, { x: 0, y: 0, z: 0, w: 20, h: 20 });
    if (isInput && sel.value === "limit") row.axis = "x_min";
    list2.push(row);
    onChange2();
    rerender();
  });
  add.appendChild(sel);
  add.appendChild(btn);
  container.appendChild(add);
}
function renderMagazineTable(container, atc, onChange2) {
  if (!container) return;
  if (!Array.isArray(atc.magazine)) atc.magazine = [];
  const rerender = () => renderMagazineTable(container, atc, onChange2);
  container.innerHTML = "";
  const ctl = document.createElement("div");
  ctl.style.cssText = "display:flex; gap:16px; align-items:flex-end; margin-bottom:12px; flex-wrap:wrap;";
  const typeSel = document.createElement("select");
  [["straight", "Straight / linear"], ["disk", "Disk / carousel"]].forEach(([v6, t]) => {
    const o = document.createElement("option");
    o.value = v6;
    o.textContent = t;
    if ((atc.magType || "straight") === v6) o.selected = true;
    typeSel.appendChild(o);
  });
  typeSel.addEventListener("change", () => {
    atc.magType = typeSel.value;
    onChange2();
    rerender();
  });
  ctl.appendChild(field("Magazine type", typeSel, 150));
  const cnt = document.createElement("input");
  cnt.type = "number";
  cnt.min = "0";
  cnt.max = "99";
  cnt.value = atc.magazine.length;
  cnt.addEventListener("change", () => {
    const n = Math.max(0, Math.min(99, parseInt(cnt.value, 10) || 0));
    while (atc.magazine.length < n) {
      const k = atc.magazine.length + 1;
      atc.magazine.push({ pocket: k, tool: "", name: "", x: "", y: "", z: "" });
    }
    atc.magazine.length = n;
    onChange2();
    rerender();
  });
  ctl.appendChild(field("Pockets", cnt, 60));
  container.appendChild(ctl);
  if (atc.magType === "disk") {
    const note = document.createElement("div");
    note.className = "settings-hint";
    note.textContent = "Disk: a carousel-rotate output + pocket-index sensor input were added (Output / Input). One fixed pickup; the magazine rotates each pocket to it.";
    container.appendChild(note);
  }
  if (!atc.magazine.length) {
    const e = document.createElement("div");
    e.className = "settings-hint";
    e.textContent = "Set the pocket count to build the magazine table.";
    container.appendChild(e);
    return;
  }
  const COLS = [["Pocket", 46], ["Tool", 168], ["Description", 150], ["Park X", 66], ["Park Y", 66], ["Park Z", 66]];
  const head = document.createElement("div");
  head.style.cssText = "display:flex; gap:8px; font-size:10px; color:#6b6150; font-weight:600; padding:2px;";
  COLS.forEach(([h, w2]) => {
    const s = document.createElement("span");
    s.textContent = h;
    s.style.width = w2 + "px";
    head.appendChild(s);
  });
  container.appendChild(head);
  atc.magazine.forEach((row, i) => {
    row.pocket = i + 1;
    const tr = document.createElement("div");
    tr.style.cssText = "display:flex; gap:8px; align-items:center; padding:3px 2px; border-bottom:1px solid rgba(0,0,0,0.08);";
    const pk = document.createElement("span");
    pk.textContent = i + 1;
    pk.style.cssText = "width:46px; font-weight:600; color:#3a3a3a;";
    tr.appendChild(pk);
    const sel = document.createElement("select");
    sel.innerHTML = toolOptionsHTML("\u2014 empty \u2014");
    sel.value = row.tool === "" || row.tool == null ? "" : String(row.tool);
    sel.style.cssText = INP + " width:158px;";
    const desc = document.createElement("span");
    desc.style.cssText = "width:150px; font-size:11px; color:#6b6150; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    const fillDesc = () => {
      const t = getTool(row.tool);
      desc.textContent = t ? [t.type, t.flutes !== "" ? t.flutes + "F" : "", t.feed !== "" ? "F" + t.feed : ""].filter(Boolean).join(" \xB7 ") || t.name || "\u2014" : "(empty)";
    };
    fillDesc();
    sel.addEventListener("change", () => {
      row.tool = sel.value === "" ? "" : Number(sel.value);
      fillDesc();
      onChange2();
    });
    tr.appendChild(sel);
    tr.appendChild(desc);
    const cell = (key, w2) => {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "0.1";
      inp.value = row[key] ?? "";
      inp.style.cssText = INP + ` width:${w2}px;`;
      inp.addEventListener("change", () => {
        row[key] = inp.value === "" ? "" : Number(inp.value);
        onChange2();
      });
      return inp;
    };
    tr.appendChild(cell("x", 58));
    tr.appendChild(cell("y", 58));
    tr.appendChild(cell("z", 58));
    container.appendChild(tr);
  });
}
var INPUT_TYPES, OUTPUT_TYPES, LIMIT_AXES, INP, _seq2;
var init_ioTable = __esm({
  "../DDCS-Studio/web/ui/ioTable.js"() {
    init_toolPicker();
    INPUT_TYPES = [
      { type: "probe", label: "3D Probe" },
      { type: "touch", label: "Touch-plate (ground)" },
      { type: "setter", label: "Tool Setter" },
      { type: "limit", label: "Limit switch" },
      { type: "estop", label: "E-stop" },
      { type: "sensor", label: "Sensor" }
    ];
    OUTPUT_TYPES = [
      { type: "coolant", label: "Coolant", onCode: "M8", offCode: "M9" },
      { type: "drawbar", label: "Drawbar (ATC)", onCode: "M154", offCode: "M155" },
      { type: "dustcover", label: "Dust cover (ATC)", onCode: "M305", offCode: "M306" },
      { type: "rotate", label: "Carousel rotate (ATC)", onCode: "", offCode: "" },
      { type: "mist", label: "Mist", onCode: "M7", offCode: "M9" },
      { type: "custom", label: "Custom", onCode: "", offCode: "" }
    ];
    LIMIT_AXES = [["x_min", "X\u2212"], ["x_max", "X+"], ["y_min", "Y\u2212"], ["y_max", "Y+"], ["z_min", "Z\u2212"], ["z_max", "Z+"]];
    INP = "padding:3px 6px; border:1px solid #b3a98f; border-radius:3px; font-size:12px; background:#fff; color:#222;";
    _seq2 = 0;
  }
});

// ../DDCS-Studio/web/ui/themes.js
var THEMES, ThemeManager;
var init_themes = __esm({
  "../DDCS-Studio/web/ui/themes.js"() {
    THEMES = ["studio", "normal", "steampunk", "futuristic", "organic"];
    ThemeManager = class {
      constructor() {
        this.themes = THEMES;
        let saved = null;
        try {
          saved = localStorage.getItem("ddcs_theme");
        } catch (e) {
        }
        const initial = saved && this.themes.includes(saved) ? saved : document.body ? document.body.getAttribute("data-theme") : null;
        const idx = initial && this.themes.includes(initial) ? this.themes.indexOf(initial) : 0;
        this.currentThemeIndex = idx;
        this.applyTheme(this.themes[this.currentThemeIndex]);
      }
      toggle() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        this.applyTheme(this.themes[this.currentThemeIndex]);
      }
      setCurrent(themeName) {
        const index = this.themes.indexOf(themeName);
        if (index !== -1) {
          this.currentThemeIndex = index;
          this.applyTheme(themeName);
        }
      }
      getCurrent() {
        return this.themes[this.currentThemeIndex];
      }
      applyTheme(themeName) {
        document.body.setAttribute("data-theme", themeName);
        try {
          localStorage.setItem("ddcs_theme", themeName);
        } catch (e) {
        }
        const styleBtn = document.getElementById("styleBtn");
        if (styleBtn) {
          styleBtn.innerHTML = '<span class="op-icon">\u{1F3A8}</span><span class="op-label">' + themeName.toUpperCase() + "</span>";
        }
      }
    };
  }
});

// ../DDCS-Studio/web/data/atcGenerator.js
function num4(v6, d) {
  return v6 === "" || v6 == null || isNaN(Number(v6)) ? d : Number(v6);
}
function generateToolChangeNc(atc, outputs) {
  atc = atc || {};
  const mag = (Array.isArray(atc.magazine) ? atc.magazine : []).filter((p) => p && p.tool !== "" && p.tool != null);
  const nameOf = {};
  (Array.isArray(atc.tools) ? atc.tools : []).forEach((t) => {
    if (t && t.num != null && t.num !== "") nameOf[Number(t.num)] = t.name || "";
  });
  const label = (p) => {
    const nm = p.name || nameOf[num4(p.tool, 0)] || "";
    return nm ? " - " + nm : "";
  };
  const drawbar = (outputs || []).find((o) => o.type === "drawbar") || {};
  const release = (drawbar.onCode || "M154").trim();
  const clamp = (drawbar.offCode || "M155").trim();
  const safeZ = num4(atc.safeZ, 10);
  const dwell = 500;
  const L2 = [];
  const w2 = (s) => L2.push(s);
  w2("(T.nc - tool-change macro generated by DDCS Studio)");
  w2("(GENERATED TEMPLATE - review every line + dry-run before cutting. NOT validated on a live ATC.)");
  w2("(Straight/linear magazine, " + mag.length + " pockets. Drawbar: release " + release + " / clamp " + clamp + ".)");
  w2("(#1504=requested tool [Tn M6]  #1300=tool in spindle  #1430+=tool-length table)");
  w2("");
  w2("IF #1504==#1300 GOTO999            ; requested tool already in spindle");
  w2("M5  M9                             ; spindle + coolant OFF before any drawbar action");
  w2("M300                              ; wait: spindle stopped (delete if no sensor)");
  w2("#4 = " + safeZ);
  w2("G53 G0 Z#4                         ; lift to safe Z (G53 needs a variable)");
  w2("");
  w2("(===== return the current tool to its pocket =====)");
  w2("IF #1300==0 GOTO500               ; spindle empty - nothing to return");
  mag.forEach((p, i) => w2("IF #1300==" + num4(p.tool, 0) + " GOTO" + (101 + i) + "         ; current tool -> pocket " + num4(p.pocket, i + 1)));
  w2("GOTO500                           ; current tool not in magazine - skip return");
  mag.forEach((p, i) => {
    w2("N" + (101 + i) + " (return T" + num4(p.tool, 0) + " to pocket " + num4(p.pocket, i + 1) + label(p) + ")");
    w2("#1 = " + num4(p.x, 0) + "  #2 = " + num4(p.y, 0) + "  #3 = " + num4(p.z, 0));
    w2("G53 G0 X#1 Y#2");
    w2("G53 G0 Z#3");
    w2(release + "                          ; drawbar release");
    w2("G04 P" + dwell);
    w2("M301                              ; wait: drawbar released (delete if no sensor)");
    w2("G53 G0 Z#4");
    w2("GOTO500");
  });
  w2("");
  w2("N500 (===== fetch the requested tool =====)");
  mag.forEach((p, i) => w2("IF #1504==" + num4(p.tool, 0) + " GOTO" + (201 + i) + "         ; requested tool -> pocket " + num4(p.pocket, i + 1)));
  w2("#1505 = 1(Tool not in magazine!) ; requested tool has no pocket");
  w2("GOTO999");
  mag.forEach((p, i) => {
    w2("N" + (201 + i) + " (fetch T" + num4(p.tool, 0) + " from pocket " + num4(p.pocket, i + 1) + label(p) + ")");
    w2("#1 = " + num4(p.x, 0) + "  #2 = " + num4(p.y, 0) + "  #3 = " + num4(p.z, 0));
    w2("G53 G0 X#1 Y#2");
    w2(release + "                          ; open collet BEFORE descending over the tool shank");
    w2("M301                              ; wait: drawbar released (delete if no sensor)");
    w2("G53 G0 Z#3                          ; descend over the tool");
    w2(clamp + "                          ; drawbar clamp");
    w2("G04 P" + dwell);
    w2("M302                              ; wait: drawbar clamped (delete if no sensor)");
    w2("G53 G0 Z#4");
    w2("#1300 = #1504               ; record the new tool");
    w2("GOTO999");
  });
  w2("");
  w2("N999");
  w2("M99");
  return L2.join("\n");
}
var init_atcGenerator = __esm({
  "../DDCS-Studio/web/data/atcGenerator.js"() {
  }
});

// ../DDCS-Studio/web/ui/cloud/providers.js
function getProvider(id) {
  return CFG[id] || null;
}
function providerLabel(id) {
  return (CFG[id] || {}).label || id;
}
function providerIcon(id) {
  return ICONS[id] || "";
}
function clientId(id) {
  try {
    const v6 = localStorage.getItem("ddcs_clientid_" + id);
    if (v6) return v6;
  } catch (e) {
  }
  return DEFAULT_CLIENT_IDS[id] || "";
}
function setClientId(id, v6) {
  try {
    v6 ? localStorage.setItem("ddcs_clientid_" + id, v6) : localStorage.removeItem("ddcs_clientid_" + id);
  } catch (e) {
  }
}
var CFG, ICONS, PROVIDER_IDS, AVAILABLE_PROVIDER_IDS, DEFAULT_CLIENT_IDS, redirectUri;
var init_providers = __esm({
  "../DDCS-Studio/web/ui/cloud/providers.js"() {
    CFG = {
      google: {
        label: "Google Drive",
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/drive.file",
        extraAuth: { access_type: "offline", prompt: "consent" },
        corsToken: false
        // Google's token endpoint blocks browser fetch — needs GIS (TODO)
      },
      dropbox: {
        label: "Dropbox",
        authorize: "https://www.dropbox.com/oauth2/authorize",
        token: "https://api.dropboxapi.com/oauth2/token",
        scope: "files.content.write files.content.read",
        extraAuth: { token_access_type: "offline" },
        corsToken: true
      },
      onedrive: {
        label: "OneDrive",
        authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "Files.ReadWrite offline_access",
        extraAuth: {},
        corsToken: true
      }
    };
    ICONS = {
      google: '<svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>',
      dropbox: '<svg width="16" height="16" viewBox="0 0 43 40" aria-hidden="true"><path fill="#0061FF" d="M12.6 0 0 8.1l8.7 7 12.8-7.9zM0 22.1l12.6 8.2 8.9-7.4-12.8-7.9zm21.5.8 8.9 7.4L43 22.1l-8.7-6.9zM43 8.1 30.4 0l-8.9 7.2 12.8 7.9zM21.5 24.5l-8.9 7.4-3.8-2.5v2.8l12.7 7.6 12.7-7.6v-2.8l-3.8 2.5z"/></svg>',
      onedrive: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#0364B8" d="M13.6 9.7a4.3 4.3 0 0 0-8.1-1.4A3.8 3.8 0 0 0 6 15.9h12.3a3.2 3.2 0 0 0 .4-6.4 3.7 3.7 0 0 0-5.1-.2z"/></svg>'
    };
    PROVIDER_IDS = Object.keys(CFG);
    AVAILABLE_PROVIDER_IDS = ["google"];
    DEFAULT_CLIENT_IDS = {
      // PUBLIC OAuth client IDs (safe in the browser — no secret). drive.file SPA client; secret stays out of git.
      google: "895572525139-mapt84pm4lfudmjfq553k6pm4m2o0e77.apps.googleusercontent.com",
      dropbox: "",
      onedrive: ""
    };
    redirectUri = () => location.origin + "/oauth-callback.html";
  }
});

// ../DDCS-Studio/web/ui/cloud/pkce.js
function randBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
async function makeChallenge() {
  const verifier = b64url(randBytes(48).buffer);
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(dig) };
}
function buildAuthUrl(p, { clientId: clientId2, redirectUri: redirectUri2, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId2,
    redirect_uri: redirectUri2,
    response_type: "code",
    scope: p.scope,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    ...p.extraAuth || {}
  });
  return `${p.authorize}?${q.toString()}`;
}
async function exchangeCode(p, { code, clientId: clientId2, redirectUri: redirectUri2, verifier }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId2,
    redirect_uri: redirectUri2,
    code_verifier: verifier
  });
  const r = await fetch(p.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`token exchange ${r.status}`);
  return r.json();
}
var b64url, randToken, makeState;
var init_pkce = __esm({
  "../DDCS-Studio/web/ui/cloud/pkce.js"() {
    b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    randToken = (n = 32) => [...randBytes(n)].map((b2) => b2.toString(16).padStart(2, "0")).join("");
    makeState = () => randToken(16);
  }
});

// ../DDCS-Studio/web/ui/cloud/googleDrive.js
var googleDrive_exports = {};
__export(googleDrive_exports, {
  connectGoogle: () => connectGoogle,
  del: () => del,
  ensureRoot: () => ensureRoot,
  getAccessToken: () => getAccessToken,
  getUserInfo: () => getUserInfo,
  list: () => list,
  mkdir: () => mkdir,
  read: () => read,
  rename: () => rename,
  setRoot: () => setRoot,
  write: () => write
});
function setRoot(id) {
  try {
    id ? localStorage.setItem(FOLDER_KEY, id) : localStorage.removeItem(FOLDER_KEY);
  } catch (e) {
  }
}
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = res;
    s.onerror = () => rej(new Error("Google Identity Services failed to load"));
    document.head.appendChild(s);
  });
}
async function connectGoogle(clientId2) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId2,
      scope: SCOPE,
      callback: (r) => r && r.access_token ? resolve(r.access_token) : reject(new Error(r && r.error || "no token")),
      error_callback: (e) => reject(new Error(e && e.type || "sign-in cancelled"))
    });
    client.requestAccessToken();
  });
}
async function api(url, opts = {}, retried = false) {
  const r = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + token(), ...opts.headers || {} } });
  if (r.status === 401 && !retried) {
    try {
      await silentRefresh();
    } catch (e) {
      throw new Error("cloud-auth");
    }
    return api(url, opts, true);
  }
  if (r.status === 401) throw new Error("cloud-auth");
  if (!r.ok) throw new Error("Drive " + r.status);
  return r;
}
async function silentRefresh() {
  if (window.pywebview && window.pywebview.api) {
    let t = {};
    try {
      t = await (await fetch("/api/oauth/google/token")).json();
    } catch (e) {
    }
    if (t.access_token) {
      try {
        localStorage.setItem(TOK, t.access_token);
      } catch (e) {
      }
      return;
    }
    throw new Error("silent-fail");
  }
  await loadGis();
  const cid = clientId("google");
  if (!cid) throw new Error("no client id");
  return new Promise((resolve, reject) => {
    const c2 = window.google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: SCOPE,
      callback: (resp) => {
        if (resp && resp.access_token) {
          try {
            localStorage.setItem(TOK, resp.access_token);
          } catch (e) {
          }
          resolve();
        } else reject(new Error("no token"));
      },
      error_callback: () => reject(new Error("silent-fail"))
    });
    c2.requestAccessToken({ prompt: "" });
  });
}
async function ensureRoot() {
  let id = "";
  try {
    id = localStorage.getItem(FOLDER_KEY) || "";
  } catch (e) {
  }
  if (id) {
    try {
      const r = await (await api(`${API}/files/${id}?fields=id,trashed`)).json();
      if (r.id && !r.trashed) return id;
    } catch (e) {
    }
  }
  const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='DDCS Studio' and trashed=false`);
  const found = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
  id = found.files && found.files[0] && found.files[0].id || "";
  if (!id) {
    const made = await (await api(`${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "DDCS Studio", mimeType: FOLDER_MIME }) })).json();
    id = made.id;
  }
  try {
    localStorage.setItem(FOLDER_KEY, id);
  } catch (e) {
  }
  return id;
}
async function list(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const r = await (await api(`${API}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&orderBy=folder,name`)).json();
  return (r.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    type: f.mimeType === FOLDER_MIME ? "folder" : "project",
    savedAt: f.modifiedTime
  }));
}
async function read(fileId) {
  return (await api(`${API}/files/${fileId}?alt=media`)).json();
}
async function mkdir(name, parentId) {
  const r = await (await api(`${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }) })).json();
  return r.id;
}
async function write(name, obj, parentId) {
  const safe = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${safe}' and trashed=false`);
  const ex = await (await api(`${API}/files?q=${q}&fields=files(id)`)).json();
  const content = JSON.stringify(obj, null, 2);
  if (ex.files && ex.files[0]) {
    await api(`${UPLOAD}/files/${ex.files[0].id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content });
    return ex.files[0].id;
  }
  const boundary = "ddcs" + Math.random().toString(16).slice(2);
  const meta = JSON.stringify({ name, parents: [parentId], mimeType: "application/json" });
  const multipart = `--${boundary}\r
Content-Type: application/json; charset=UTF-8\r
\r
${meta}\r
--${boundary}\r
Content-Type: application/json\r
\r
${content}\r
--${boundary}--`;
  const r = await (await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart })).json();
  return r.id;
}
async function del(id) {
  await api(`${API}/files/${id}`, { method: "DELETE" });
}
async function rename(id, name) {
  await api(`${API}/files/${id}?fields=id`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
}
async function getUserInfo() {
  try {
    const u = (await (await api(`${API}/about?fields=user`)).json()).user || {};
    return { name: u.displayName || "", email: u.emailAddress || "" };
  } catch (e) {
    return { name: "", email: "" };
  }
}
var SCOPE, API, UPLOAD, FOLDER_MIME, TOK, FOLDER_KEY, token, getAccessToken;
var init_googleDrive = __esm({
  "../DDCS-Studio/web/ui/cloud/googleDrive.js"() {
    init_providers();
    SCOPE = "https://www.googleapis.com/auth/drive.file";
    API = "https://www.googleapis.com/drive/v3";
    UPLOAD = "https://www.googleapis.com/upload/drive/v3";
    FOLDER_MIME = "application/vnd.google-apps.folder";
    TOK = "ddcs_cloud_token";
    FOLDER_KEY = "ddcs_gdrive_folder";
    token = () => {
      try {
        return localStorage.getItem(TOK) || "";
      } catch (e) {
        return "";
      }
    };
    getAccessToken = () => token();
  }
});

// ../DDCS-Studio/web/ui/cloudAccount.js
function getAccount() {
  try {
    return { connected: !!localStorage.getItem(TOK2), provider: localStorage.getItem(PROV) || "", email: localStorage.getItem(EMAIL) || "", name: localStorage.getItem(NAME) || "" };
  } catch (e) {
    return { connected: false, provider: "", email: "", name: "" };
  }
}
function disconnect() {
  try {
    [TOK2, PROV, EMAIL, REFRESH, NAME].forEach((k) => localStorage.removeItem(k));
  } catch (e) {
  }
  window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
}
async function captureGoogleIdentity() {
  try {
    const { getUserInfo: getUserInfo2 } = await Promise.resolve().then(() => (init_googleDrive(), googleDrive_exports));
    const u = await getUserInfo2();
    if (u.email) localStorage.setItem(EMAIL, u.email);
    if (u.name) localStorage.setItem(NAME, u.name);
  } catch (e) {
  }
  window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
}
function connect(provider = "google") {
  const p = getProvider(provider);
  if (!p) return;
  if (provider === "google" && window.pywebview && window.pywebview.api) {
    connectGoogleDesktop();
    return;
  }
  if (!clientId(provider)) {
    const v6 = window.prompt(
      `Connect ${p.label} \u2014 your OWN account (no server, no secret).

No client ID is configured. Register a PUBLIC / SPA OAuth app for ${p.label}` + (provider === "google" ? " (Authorized JavaScript origin = " + location.origin + ")" : `, redirect URI:
   ${redirectUri()}`) + `

Paste its Client ID:`
    );
    if (!v6) return;
    setClientId(provider, v6.trim());
  }
  if (provider === "google") {
    connectGoogleFlow();
    return;
  }
  openConnectModal(provider);
}
async function connectGoogleFlow() {
  try {
    const { connectGoogle: connectGoogle2 } = await Promise.resolve().then(() => (init_googleDrive(), googleDrive_exports));
    const tok2 = await connectGoogle2(clientId("google"));
    localStorage.setItem(TOK2, tok2);
    localStorage.setItem(PROV, "google");
    window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
    captureGoogleIdentity();
  } catch (e) {
    if (String(e && e.message) !== "sign-in cancelled") window.alert("Google sign-in failed: " + (e && e.message));
  }
}
async function connectGoogleDesktop() {
  let r;
  try {
    r = await (await fetch("/oauth/google/start")).json();
  } catch (e) {
    window.alert("Could not reach the gateway to start Google sign-in.");
    return;
  }
  if (!r.ok) {
    window.alert("Google sign-in unavailable: " + (r.error || "set a Google Desktop client id in the gateway Setup."));
    return;
  }
  const deadline = Date.now() + 18e4;
  const tick = async () => {
    let t = {};
    try {
      t = await (await fetch("/api/oauth/google/token")).json();
    } catch (e) {
    }
    if (t.access_token) {
      try {
        localStorage.setItem(TOK2, t.access_token);
        localStorage.setItem(PROV, "google");
      } catch (e) {
      }
      window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
      captureGoogleIdentity();
      return;
    }
    if (Date.now() < deadline) setTimeout(tick, 1500);
  };
  setTimeout(tick, 2e3);
}
async function openConnectModal(provider) {
  const p = getProvider(provider);
  const cid = clientId(provider);
  const ov = document.createElement("div");
  ov.className = "cloud-modal";
  ov.innerHTML = `<div class="cloud-modal-panel"><div class="proj-head"><span class="proj-title">\u{1F517} Connect ${p.label}</span><button class="op-btn" data-cm="cancel" title="Cancel">\u2715</button></div><div class="cloud-modal-body"><div class="cloud-modal-status">Opening ${p.label} sign-in\u2026</div><div class="hint">A secure ${p.label} window opens \u2014 approve access and it returns here automatically. Your token stays in this browser; nothing is sent to a server.</div></div><div class="cloud-modal-foot"><button class="op-btn" data-cm="retry">Open sign-in</button><span style="flex:1"></span><button class="op-btn" data-cm="cancel">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  const statusEl = ov.querySelector(".cloud-modal-status");
  const { verifier, challenge } = await makeChallenge();
  const state = makeState();
  const ruri = redirectUri();
  const url = buildAuthUrl(p, { clientId: cid, redirectUri: ruri, challenge, state });
  let popup = null;
  const onMsg = async (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type !== "ddcs-oauth-code" || d.state !== state) return;
    window.removeEventListener("message", onMsg);
    if (d.error) {
      statusEl.textContent = "Sign-in failed: " + d.error;
      return;
    }
    try {
      statusEl.textContent = "Finishing\u2026";
      if (!p.corsToken) throw new Error(`${p.label}: code received, but its token exchange needs the provider SDK (TODO).`);
      const tok2 = await exchangeCode(p, { code: d.code, clientId: cid, redirectUri: ruri, verifier });
      localStorage.setItem(TOK2, tok2.access_token || "");
      localStorage.setItem(PROV, provider);
      if (tok2.refresh_token) localStorage.setItem(REFRESH, tok2.refresh_token);
      cleanup(true);
    } catch (err) {
      statusEl.textContent = err.message;
    }
  };
  const open = () => {
    popup = window.open(url, "ddcs_oauth", "width=520,height=680");
    statusEl.textContent = popup ? `Waiting for ${p.label} sign-in\u2026` : "Popup blocked \u2014 allow popups, then \u201COpen sign-in\u201D.";
  };
  const cleanup = (ok) => {
    window.removeEventListener("message", onMsg);
    try {
      popup && popup.close();
    } catch (_) {
    }
    ov.remove();
    if (ok) window.dispatchEvent(new CustomEvent("ddcs:cloud-account"));
  };
  window.addEventListener("message", onMsg);
  ov.addEventListener("click", (e) => {
    const t = e.target.closest("[data-cm]");
    if (!t) {
      if (e.target === ov) cleanup(false);
      return;
    }
    if (t.dataset.cm === "cancel") cleanup(false);
    else open();
  });
  open();
}
function renderCloudLogin(container) {
  if (!container) return;
  const a = getAccount();
  if (a.connected && !a.name && !a.email && !captureGoogleIdentity._tried) {
    captureGoogleIdentity._tried = true;
    captureGoogleIdentity();
  }
  const wrap = document.createElement("div");
  wrap.className = "cloud-login";
  const status = document.createElement("div");
  status.className = "cloud-status" + (a.connected ? "" : " muted");
  status.textContent = a.connected ? `Connected \xB7 ${providerLabel(a.provider)}${a.name ? " \xB7 " + a.name : ""}${a.email ? " \xB7 " + a.email : ""}` : "Not connected \u2014 sign in to sync your projects to your own Google Drive.";
  wrap.appendChild(status);
  if (a.connected) {
    const dc = document.createElement("button");
    dc.className = "op-btn";
    dc.textContent = "Disconnect";
    dc.addEventListener("click", () => disconnect());
    wrap.appendChild(dc);
  } else {
    const row = document.createElement("div");
    row.className = "cloud-providers";
    for (const id of AVAILABLE_PROVIDER_IDS) {
      const b2 = document.createElement("button");
      b2.className = "op-btn cloud-connect";
      b2.innerHTML = providerIcon(id) + "<span>Connect " + providerLabel(id) + "</span>";
      b2.addEventListener("click", () => connect(id));
      row.appendChild(b2);
    }
    wrap.appendChild(row);
  }
  container.replaceChildren(wrap);
  if (!container._cloudWired) {
    container._cloudWired = true;
    window.addEventListener("ddcs:cloud-account", () => renderCloudLogin(container));
  }
}
var TOK2, PROV, EMAIL, REFRESH, NAME;
var init_cloudAccount = __esm({
  "../DDCS-Studio/web/ui/cloudAccount.js"() {
    init_providers();
    init_pkce();
    TOK2 = "ddcs_cloud_token";
    PROV = "ddcs_cloud_provider";
    EMAIL = "ddcs_cloud_email";
    REFRESH = "ddcs_cloud_refresh";
    NAME = "ddcs_cloud_name";
  }
});

// ../DDCS-Studio/web/ui/settingsPanel.js
var settingsPanel_exports = {};
__export(settingsPanel_exports, {
  STANDARD_TOOLS: () => STANDARD_TOOLS,
  STOCK_TEMPLATES: () => STOCK_TEMPLATES,
  TOOL_TYPES: () => TOOL_TYPES,
  applySettings: () => applySettings,
  closeSettings: () => closeSettings,
  getInputs: () => getInputs,
  getOutputs: () => getOutputs,
  getRotaryAxes: () => getRotaryAxes,
  getSettings: () => getSettings,
  libraryTools: () => libraryTools,
  normalizeTool: () => normalizeTool,
  openSettings: () => openSettings,
  probeSrc: () => probeSrc,
  probeSrcAvailable: () => probeSrcAvailable,
  resolveProbeSources: () => resolveProbeSources,
  setProbeSrc: () => setProbeSrc,
  syncIO: () => syncIO
});
function normalizeTool(t, fallbackNum) {
  const fb = fallbackNum != null ? fallbackNum : "";
  if (typeof t === "number") return { num: fb, name: "", type: "", dia: "", flutes: "", length: t, rpm: "", feed: "", plunge: "" };
  const o = t && typeof t === "object" ? t : {};
  return {
    num: o.num != null && o.num !== "" ? o.num : fb,
    name: o.name || "",
    type: o.type || "",
    dia: o.dia ?? "",
    flutes: o.flutes ?? "",
    length: o.length ?? "",
    rpm: o.rpm ?? "",
    feed: o.feed ?? "",
    plunge: o.plunge ?? ""
  };
}
function libraryTools(atc) {
  const tools = Array.isArray(atc && atc.tools) ? atc.tools : [];
  return tools.map((t, i) => normalizeTool(t, i + 1)).filter((t) => t.name || t.type || t.dia !== "" || t.flutes !== "" || t.length !== "" || t.rpm !== "" || t.feed !== "" || t.plunge !== "");
}
function migrateIO(s) {
  if (!Array.isArray(s.inputs)) s.inputs = [];
  if (!Array.isArray(s.outputs)) s.outputs = [];
  if (s.inputs.length === 0) {
    const p = s.probes || {};
    s.inputs.push({ id: "probe", type: "probe", label: "3D Probe", pin: p.probePin ?? "", level: p.probeLevel ?? 0 });
    s.inputs.push({
      id: "setter",
      type: "setter",
      label: "Tool Setter",
      pin: p.setterPin ?? "",
      level: p.setterLevel ?? 0,
      x: p.setterX,
      y: p.setterY,
      z: p.setterZ,
      w: p.setterW,
      h: p.setterH
    });
    const L2 = s.limits || {};
    for (const [axis, label, pinK, lvlK] of LIMIT_AXES2) {
      if (L2[pinK] !== "" && L2[pinK] != null) s.inputs.push({ id: "limit_" + axis, type: "limit", axis, label, pin: L2[pinK], level: L2[lvlK] || 0 });
    }
  }
  return s;
}
function syncFlatFromIO(s) {
  const first = (t) => (s.inputs || []).find((i) => i.type === t);
  const probe = first("probe"), setter = first("setter");
  s.probes = s.probes || {};
  if (probe) {
    s.probes.probePin = probe.pin;
    s.probes.probeLevel = probe.level;
  }
  if (setter) Object.assign(s.probes, { setterPin: setter.pin, setterLevel: setter.level, setterX: setter.x, setterY: setter.y, setterZ: setter.z, setterW: setter.w, setterH: setter.h });
  s.limits = s.limits || {};
  for (const [, , pinK, lvlK] of LIMIT_AXES2) {
    s.limits[pinK] = "";
    s.limits[lvlK] = 0;
  }
  for (const inp of s.inputs || []) {
    if (inp.type !== "limit") continue;
    const row = LIMIT_AXES2.find((a) => a[0] === inp.axis);
    if (row) {
      s.limits[row[2]] = inp.pin;
      s.limits[row[3]] = inp.level || 0;
    }
  }
}
function loadSettings() {
  try {
    const raw2 = localStorage.getItem(DDCS_SETTINGS_KEY);
    if (raw2) {
      const p = JSON.parse(raw2);
      const merged = migrateIO({
        toolsSeeded: p.toolsSeeded === true,
        stock: { ...SETTINGS_DEFAULTS.stock, ...p.stock || {} },
        stockTemplates: Array.isArray(p.stockTemplates) ? p.stockTemplates : [],
        machine: { ...SETTINGS_DEFAULTS.machine, ...p.machine || {} },
        view: { ...SETTINGS_DEFAULTS.view, ...p.view || {} },
        probes: {
          ...SETTINGS_DEFAULTS.probes,
          ...p.probes || {},
          sources: { ...SETTINGS_DEFAULTS.probes.sources, ...(p.probes || {}).sources || {} }
        },
        limits: { ...SETTINGS_DEFAULTS.limits, ...p.limits || {} },
        hardwareTabs: { ...SETTINGS_DEFAULTS.hardwareTabs, ...p.hardwareTabs || {} },
        preview: { ...SETTINGS_DEFAULTS.preview, ...p.preview || {} },
        compose: { ...SETTINGS_DEFAULTS.compose, ...p.compose || {} },
        atc: { ...SETTINGS_DEFAULTS.atc, ...p.atc || {} },
        head: { ...SETTINGS_DEFAULTS.head, ...p.head || {} },
        spindle: { ...SETTINGS_DEFAULTS.spindle, ...p.spindle || {} },
        endProgram: { ...SETTINGS_DEFAULTS.endProgram, ...p.endProgram || {} },
        motors: { ...SETTINGS_DEFAULTS.motors, ...p.motors || {} },
        inputs: Array.isArray(p.inputs) ? p.inputs : [],
        outputs: Array.isArray(p.outputs) ? p.outputs : [],
        macros: Array.isArray(p.macros) ? p.macros : []
      });
      if (!merged.toolsSeeded && (!Array.isArray(merged.atc.tools) || merged.atc.tools.length === 0)) {
        merged.atc.tools = standardTools();
      }
      merged.toolsSeeded = true;
      return merged;
    }
  } catch (e) {
  }
  return migrateIO(JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)));
}
function saveSettings() {
  try {
    localStorage.setItem(DDCS_SETTINGS_KEY, JSON.stringify(_ddcsSettings));
  } catch (e) {
  }
  window.dispatchEvent(new CustomEvent("ddcs:settings-changed", { detail: _ddcsSettings }));
}
function getSettings() {
  return _ddcsSettings;
}
function getInputs() {
  return _ddcsSettings.inputs || [];
}
function getOutputs() {
  return _ddcsSettings.outputs || [];
}
function getRotaryAxes() {
  const m = _ddcsSettings.motors || {};
  const out = {};
  for (const ax of ["a", "b"]) {
    if (m[ax] && m[ax].role === "rotary") out[ax] = m[ax].around || "x";
  }
  return out;
}
function syncIO() {
  syncFlatFromIO(_ddcsSettings);
  saveSettings();
}
function probeSrc(field3) {
  const pv = (getActiveProfile().probeVars || {})[field3];
  if (!pv) return null;
  return (_ddcsSettings.probes.sources || {})[field3] === "ctrl" ? pv : null;
}
function probeSrcAvailable(field3) {
  return !!(getActiveProfile().probeVars || {})[field3];
}
function setProbeSrc(field3, mode) {
  if (!_ddcsSettings.probes.sources) _ddcsSettings.probes.sources = {};
  _ddcsSettings.probes.sources[field3] = mode === "ctrl" ? "ctrl" : "studio";
  saveSettings();
}
function resolveProbeSources(fields) {
  const out = {};
  for (const f of fields) {
    const s = probeSrc(f);
    if (s) out[f] = s;
  }
  return out;
}
function applySettings(incoming) {
  if (!incoming || typeof incoming !== "object") return;
  const D = SETTINGS_DEFAULTS, S = _ddcsSettings;
  if (incoming.stock) S.stock = { ...D.stock, ...S.stock, ...incoming.stock };
  if (incoming.machine) S.machine = { ...D.machine, ...S.machine, ...incoming.machine };
  if (incoming.probes) S.probes = { ...D.probes, ...S.probes, ...incoming.probes, sources: { ...D.probes.sources, ...(S.probes || {}).sources || {}, ...(incoming.probes || {}).sources || {} } };
  if (incoming.limits) S.limits = { ...D.limits, ...S.limits, ...incoming.limits };
  if (incoming.atc) S.atc = { ...D.atc, ...S.atc, ...incoming.atc };
  if (incoming.head) S.head = { ...D.head, ...S.head, ...incoming.head };
  if (incoming.spindle) S.spindle = { ...D.spindle, ...S.spindle, ...incoming.spindle };
  if (incoming.endProgram) S.endProgram = { ...D.endProgram, ...S.endProgram, ...incoming.endProgram };
  if (incoming.motors) S.motors = { ...D.motors, ...S.motors, ...incoming.motors };
  if (incoming.hardwareTabs) S.hardwareTabs = { ...D.hardwareTabs, ...S.hardwareTabs, ...incoming.hardwareTabs };
  if (incoming.preview) S.preview = { ...D.preview, ...S.preview, ...incoming.preview };
  if (incoming.compose) S.compose = { ...D.compose, ...S.compose, ...incoming.compose };
  if (incoming.view) S.view = { ...D.view, ...S.view, ...incoming.view };
  if (Array.isArray(incoming.stockTemplates)) S.stockTemplates = incoming.stockTemplates;
  if (Array.isArray(incoming.inputs)) {
    S.inputs = incoming.inputs;
    syncFlatFromIO(S);
  }
  if (Array.isArray(incoming.outputs)) S.outputs = incoming.outputs;
  if (Array.isArray(incoming.macros)) S.macros = incoming.macros;
  saveSettings();
  if (_fillSettingsInputs) _fillSettingsInputs();
}
function buildSettingsOverlay() {
  const parent = document.getElementById("settings-app");
  if (!parent) return;
  if (parent.querySelector(".settings-body")) return;
  parent.classList.remove("hidden");
  parent.innerHTML = `
        <style>
            #settings-app { display: flex; flex-direction: column; }
            #settings-app .settings-head { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--panel); flex: 0 0 auto; display: flex; align-items: center; }
            #settings-app .settings-main-tab, #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab:active { position: relative; padding: 6px 6px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; font-family: inherit; color: var(--text-dim); background: transparent; border: none; border-radius: 0; box-shadow: none; text-shadow: none; filter: none; transform: none; cursor: pointer; transition: 120ms; }
            #settings-app .settings-main-tab:hover, #settings-app .settings-main-tab.active { color: var(--text-main); }
            #settings-app .settings-main-tab.active::after { content: ''; position: absolute; left: 4px; right: 4px; bottom: -8px; height: 3px; background: var(--accent); border-radius: var(--radius, 3px) var(--radius, 3px) 0 0; }
            #settings-app .settings-body { display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden; }
            #settings-app .settings-sidebar { width: 160px; flex: 0 0 160px; display: flex; flex-direction: column; gap: 2px; padding: 12px 8px; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; }
            #settings-app .settings-sidebar .settings-tab { display: block; width: 100%; text-align: left; padding: 7px 12px; font-size: 12.5px; font-weight: 600; border-radius: var(--radius, 4px); border: none; background: transparent; color: var(--text-dim); cursor: pointer; transition: 120ms; }
            #settings-app .settings-sidebar .settings-tab:hover { background: var(--bg); color: var(--text-main); }
            #settings-app .settings-sidebar .settings-tab.active { background: var(--bg); color: var(--text-main); border-left: 3px solid var(--accent); padding-left: 9px; }
            #settings-app .settings-sidebar .sidebar-group-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); padding: 8px 12px 4px; opacity: .6; }
            #settings-app .settings-sidebar .sidebar-group-label:first-child { padding-top: 2px; }
            #settings-app .settings-content { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
            #settings-app .settings-foot { flex: 0 0 auto; padding: 8px 16px; border-top: 1px solid var(--border); background: var(--panel); display: flex; gap: 8px; }
        </style>
            <div class="settings-head">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div class="settings-tabs" style="display: flex; gap: 8px;">
                        <button class="settings-main-tab active" data-group="general">General</button>
                        <button class="settings-main-tab" data-group="hardware">Hardware</button>
                    </div>
                </div>
            </div>
            <div class="settings-body">
                <div class="settings-sidebar">
                    <div class="sidebar-group-label" data-group-label="general">General</div>
                    <button class="settings-tab active" data-group="general" data-target="set_tab_profile">Profile</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_appearance">Appearance</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_preview">Preview</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_compose">Editor</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_variables">Variables</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_program">Program</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_macros">Macros</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_feedback">Feedback</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_gateway">Gateway</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_cloud">Cloud</button>
                    <button class="settings-tab" data-group="general" data-target="set_tab_about">About</button>
                    <div class="sidebar-group-label" data-group-label="hardware" style="display:none;">Hardware</div>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_machine" style="display:none;">Machine</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_spindle" style="display:none;">Head</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_input" style="display:none;">Input</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_output" style="display:none;">Output</button>
                    <button class="settings-tab" data-group="hardware" data-target="set_tab_atc" style="display:none;">Tool table</button>
                </div>
                <div class="settings-content">
                <!-- GENERAL: PREVIEW (3D/2D toolpath view + simulation) -->
                <div id="set_tab_preview" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOLPATH PREVIEW</div>
                        <div class="settings-field">Default view
                            <select id="set_pv_view"><option value="3d">3D</option><option value="2d">2D (top-down)</option></select>
                        </div>
                        <div class="settings-field">Default play speed
                            <select id="set_pv_speed"><option value="1">1\xD7</option><option value="2">2\xD7</option><option value="5">5\xD7</option><option value="10">10\xD7</option></select>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_rapids"> Show rapid moves (yellow) in the 3D view</label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">FOLLOW CAMERA</div>
                        <div class="settings-hint">Toggle the follow-cam (the \u2316 button in the preview bar) to keep the tool centred while playing. Damping smooths how fast the camera catches up.</div>
                        <label class="settings-check"><input type="checkbox" id="set_pv_follow_default"> Centre-lock the camera when a preview opens</label>
                        <label class="settings-check"><input type="checkbox" id="set_pv_autoloop"> Auto-play in a loop when a preview opens</label>
                        <div class="settings-field" style="margin-top:10px">Centre-lock damping \u2014 <span id="set_pv_followdamp_val">50%</span>
                            <input type="range" id="set_pv_followdamp" min="0" max="100" step="5" style="width:100%; max-width:280px;">
                        </div>
                        <div class="settings-hint">Low = snaps to the tool \xB7 High = smooth, gentle follow.</div>
                    </div>
                </div>
                <!-- GENERAL: COMPOSING (authoring assists \u2014 Blocks suggestions + Studio editor autocomplete) -->
                <div id="set_tab_compose" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR ASSISTS</div>
                        <div class="settings-hint">Authoring help across both editors \u2014 the Blocks tab and the Studio text editor. All optional.</div>
                        <label class="settings-check"><input type="checkbox" id="set_cp_suggestions"> Block suggestions \u2014 the "Suggested next" chip strip in the Blocks tab</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_autocomplete"> Editor autocomplete \u2014 context suggestions at the cursor in the Studio editor</label>
                        <label class="settings-check"><input type="checkbox" id="set_cp_ghost"> Suggestion box \u2014 a floating box of likely next blocks on the canvas (click, or Tab takes the first)</label>
                    </div>
                </div>
                <!-- GENERAL: PROFILE -->
                <div id="set_tab_profile">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER</div>
                        <div class="settings-row">
                            <select id="set_profile" title="Controller profile \u2014 presets the hardware your machine has" style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                            <button class="toolbar-btn settings-io" id="set_profile_pull" title="Fetch this machine's profile (tabs + pins) from the bridged controller. Offline controllers like the DDCS 3.1: use Import profile.">\u21A7 Pull from controller</button>
                        </div>
                        <div class="settings-hint">Which controller you have (DDCS Expert, 4.1, \u2026) \u2014 sets the G-code dialect/post and presets your hardware tabs. (The <b>Profile</b> below saves your actual settings + variables for it.)</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">POST PROCESSOR</div>
                        <div class="settings-row">
                            <select id="set_post" title="Which controller's G-code to generate. 'Follow machine profile' uses your machine's native post; override to emit code for another controller." style="background:#222; color:#ddd; border:1px solid #888; font-size:13px; padding:4px 8px;"></select>
                        </div>
                        <div class="settings-hint" id="set_post_hint">Which controller's G-code the Blocks view generates. Defaults to your machine's post; override to target another controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">PROFILE (settings + variables)</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_profile_export">\u2B07 Export profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_import">\u2B06 Import profile</button>
                            <button class="toolbar-btn settings-io" id="set_profile_cloud_save">\u2601 Save to cloud</button>
                            <button class="toolbar-btn settings-io" id="set_profile_cloud_load">\u2601 Load from cloud</button>
                        </div>
                        <div class="settings-hint">One JSON with your machine/stock/limits + user variables. The desktop app saves it to a local file automatically; <b>Save/Load to cloud</b> keeps named profiles in your own Google Drive (Settings \u2192 Cloud) \u2014 pull at the machine, load on a remote PC for a faithful sim.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">EDITOR</div>
                        <label class="settings-check"><input type="checkbox" id="set_suggest_on"> Smart suggestion bar (predictive keys above the keyboard)</label>
                        <div class="settings-hint">A phone-style row suggesting the likely next G-code / macro token. Turning it off hides the row and reclaims the space.</div>
                    </div>
                    <!-- legacy hardware-tab toggles kept hidden so profile gating still works (replaced by the Input/Output tables) -->
                    <div style="display:none">
                        <input type="checkbox" id="set_show_probes"><input type="checkbox" id="set_show_atc"><input type="checkbox" id="set_show_limits">
                    </div>
                </div>

                <!-- GENERAL: VARIABLES -->
                <div id="set_tab_variables" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">VARIABLES (CSV)</div>
                        <div class="settings-row">
                            <label class="toolbar-btn settings-io">\u{1F4C2} Import CSV<input type="file" id="set_csv_input" accept=".csv,text/csv" style="display:none"></label>
                            <button class="toolbar-btn settings-io" id="set_export">\u2B07 Export CSV</button>
                            <span class="settings-hint" id="set_var_count"></span>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: FEEDBACK -->
                <div id="set_tab_feedback" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">FEEDBACK</div>
                        <div class="settings-row">
                            <button class="toolbar-btn settings-io" id="set_report">\u{1F41B} Report a bug</button>
                        </div>
                    </div>
                </div>

                <!-- GENERAL: NETWORK (cloud account + machine network) -->
                <div id="set_tab_gateway" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CONTROLLER</div>
                        <div class="settings-hint">Point the gateway at your controller's CNCDISK share \u2014 or scan the LAN to find it. Needs the gateway (the desktop app); the hosted page can't reach a machine on your network.</div>
                        <div id="set_machinenet_mount" style="margin-top:8px"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">LAN ACCESS</div>
                        <div class="settings-hint">Open Studio from a phone/laptop on the same wifi \u2014 your exe serves it. Use this URL, not the hosted page.</div>
                        <div id="set_lan_mount" style="margin-top:8px"></div>
                    </div>
                </div>

                <!-- GENERAL: CLOUD (project storage \u2014 separate from the machine) -->
                <div id="set_tab_cloud" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CLOUD STORAGE</div>
                        <div class="settings-hint">Sign in to save &amp; sync your projects to your own Google Drive \u2014 files go straight to your account, we never see them.</div>
                        <div id="set_cloud_mount" style="margin-top:8px"></div>
                    </div>
                </div>

                <!-- GENERAL: APPEARANCE -->
                <div id="set_tab_appearance" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">THEME</div>
                        <div class="settings-row">
                            <select id="set_theme" title="UI theme"></select>
                        </div>
                        <div class="settings-hint">Switches the whole UI skin. Saved on this device.</div>
                    </div>
                </div>

                <!-- GENERAL: PROGRAM (end-of-program routine) -->
                <div id="set_tab_program" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">END OF PROGRAM</div>
                        <div class="settings-hint">The safe footer appended to generated programs. On the DDCS, retract &amp; park use <b>G53</b> machine coordinates (G28 isn't configured).</div>
                        <label class="settings-check"><input type="checkbox" id="set_end_spindleoff"> Stop spindle (M5)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_coolantoff"> Coolant off (M9)</label>
                        <label class="settings-check"><input type="checkbox" id="set_end_retract"> Retract Z to safe height (G53)</label>
                        <div class="settings-grid">
                            <label>Safe Z (G53, mm)<input type="number" id="set_end_retractz" step="1"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_end_park"> Park XY for unload (G53)</label>
                        <div class="settings-grid">
                            <label>Park X (G53)<input type="number" id="set_end_parkx" step="1"></label>
                            <label>Park Y (G53)<input type="number" id="set_end_parky" step="1"></label>
                        </div>
                        <div class="settings-grid">
                            <label>Program end<select id="set_end_end"><option value="M30">M30 (end + rewind)</option><option value="M2">M2 (end)</option><option value="none">None</option></select></label>
                        </div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_end_insert">\u2B07 Insert end-of-program</button>
                        </div>
                        <div class="settings-hint">Drops the footer into the editor at the cursor. Global default; per-wizard overrides are planned.</div>
                    </div>
                </div>

                <!-- GENERAL: MACROS (custom M-codes + K-buttons; part of the profile) -->
                <div id="set_tab_macros" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">CUSTOM M-CODES</div>
                        <div class="settings-hint">Macros called <b>from a program</b> \u2014 O100nn \u21C4 <b>M<i>nn</i></b> (e.g. M15 tool-break check). Build one with a wizard in Studio, then <b>\uFF0B Add from editor</b>. <b>Generate</b> wraps it as the installable O100nn block. Saved with your Profile.</div>
                        <div id="mcodes_list"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="mcodes_add_editor">\uFF0B Add from editor</button>
                            <button class="toolbar-btn settings-io" id="mcodes_add_blank">\uFF0B Add blank</button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">K-BUTTONS (K1\u2013K7)</div>
                        <div class="settings-hint">The 7 panel buttons \u2014 each runs <b>key-<i>N</i>.nc</b> when pressed. Type/paste a body or <b>\u21EA From editor</b>, then <b>Generate</b> for the install file. Empty = unused.</div>
                        <div id="kbuttons_list"></div>
                    </div>
                </div>

                <!-- GENERAL: ABOUT -->
                <div id="set_tab_about" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">DDCS STUDIO</div>
                        <div class="settings-hint">Version <b id="set_about_ver">\u2014</b></div>
                        <div class="settings-hint">Modular G-code generator &amp; 3D simulator for the DDCS Expert / FOINNC M350 controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">CREDITS</div>
                        <div class="settings-hint">Built by Fr\xE9d\xE9ric Chabot \xB7 MIT License</div>
                    </div>
                </div>

                <!-- MACHINE TAB -->
                <div id="set_tab_machine" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">MACHINE ENVELOPE (mm)</div>
                        <div class="settings-grid">
                            <label>Travel X<input type="number" id="set_mach_x" min="0" step="1"></label>
                            <label>Travel Y<input type="number" id="set_mach_y" min="0" step="1"></label>
                            <label>Travel Z<input type="number" id="set_mach_z" min="0" step="1"></label>
                        </div>
                        <div class="settings-section-title sub">LIMIT / ORIGIN POSITION (mm from min corner)</div>
                        <div class="settings-grid">
                            <label>Origin X<input type="number" id="set_mach_ox" step="1"></label>
                            <label>Origin Y<input type="number" id="set_mach_oy" step="1"></label>
                            <label>Origin Z<input type="number" id="set_mach_oz" step="1"></label>
                        </div>
                        <div class="settings-section-title sub">WORK ORIGIN \u2014 machine coords of part-zero (mm)</div>
                        <div class="settings-hint">Where your G54 part-zero sits in machine coordinates (after homing + probing). Makes <code>G53</code> machine-frame moves (safe-Z retract, park) draw correctly in the sim. Leave 0 if program-zero = machine-zero. Auto-filled from a controller dump when available.</div>
                        <div class="settings-grid">
                            <label>Work origin X<input type="number" id="set_mach_wx" step="0.001"></label>
                            <label>Work origin Y<input type="number" id="set_mach_wy" step="0.001"></label>
                            <label>Work origin Z<input type="number" id="set_mach_wz" step="0.001"></label>
                        </div>
                        <label class="settings-check"><input type="checkbox" id="set_mach_show"> Show machine envelope in 3D</label>
                        <div class="settings-hint">Origin = program zero position within the envelope.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">AXES</div>
                        <div class="settings-hint">X/Y/Z are linear. Set A/B to <b>rotary</b> for a 4th/5th rotary axis \u2014 the 3D sim then spins the part on those axes' moves. One machine config covers both 3-axis and rotary jobs (the program decides).</div>
                        <div class="settings-grid">
                            <label>A \u2014 role<select id="set_axis_a_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>A \u2014 spins around<select id="set_axis_a_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                            <label>B \u2014 role<select id="set_axis_b_role"><option value="unused">Unused</option><option value="linear">Linear</option><option value="rotary">Rotary</option></select></label>
                            <label>B \u2014 spins around<select id="set_axis_b_around"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: SPINDLE -->
                <div id="set_tab_spindle" style="display:none">
                    <div class="settings-section" id="set_spin_add" style="display:none">
                        <div class="settings-section-title">HEAD</div>
                        <div class="settings-hint">Add the machine's toolhead \u2014 spindle / router today (plasma &amp; laser coming). Sets speed/direction and inserts M3/M4 + S into programs.</div>
                        <button class="toolbar-btn settings-io" id="set_spin_add_btn">\u2795 Add head</button>
                    </div>
                    <div id="set_spin_config" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">HEAD</div>
                            <div class="settings-grid">
                                <label>Type<select id="set_head_type"><option value="spindle">Router / Spindle</option><option value="plasma">Plasma</option><option value="laser">Laser</option></select></label>
                            </div>
                        </div>
                        <div id="set_head_spindle">
                            <div class="settings-section">
                                <div class="settings-section-title">SPINDLE / VFD</div>
                                <div class="settings-grid">
                                    <label>Max RPM<input type="number" id="set_spin_maxrpm" min="0" step="100"></label>
                                    <label>Default RPM<input type="number" id="set_spin_defrpm" min="0" step="100"></label>
                                    <label>Direction<select id="set_spin_dir"><option value="cw">M3 \u2014 clockwise</option><option value="ccw">M4 \u2014 counter-clockwise</option></select></label>
                                </div>
                                <div class="settings-grid">
                                    <label>Spin-up dwell (s)<input type="number" id="set_spin_up" min="0" step="0.1"></label>
                                    <label>Spin-down dwell (s)<input type="number" id="set_spin_down" min="0" step="0.1"></label>
                                </div>
                            </div>
                        </div>
                        <div id="set_head_plasma" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">PLASMA</div>
                                <div class="settings-hint">Coming soon \u2014 pierce height/delay, THC (torch-height control), arc-OK input.</div>
                            </div>
                        </div>
                        <div id="set_head_laser" style="display:none">
                            <div class="settings-section">
                                <div class="settings-section-title">LASER</div>
                                <div class="settings-hint">Coming soon \u2014 power %, PWM / M-code mapping.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- LIMITS TAB -->
                <div id="set_tab_limits" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">LIMIT SWITCHES</div>
                        <div class="settings-section-title sub">X AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_x_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_x_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_x_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Y AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_y_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_y_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_y_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">Z AXIS</div>
                        <div class="settings-grid">
                            <label>Min Pin<input type="number" id="set_z_min_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_min_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                            <label>Max Pin<input type="number" id="set_z_max_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_z_max_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-hint">Set the pin inputs used for hard limits. Leave empty if unused.</div>
                    </div>
                </div>

                <!-- PROBES TAB -->
                <div id="set_tab_probes" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title sub">3D PROBE (PINS)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_probe_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_probe_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-section-title sub">TOOL SETTER (PINS & LOCATION)</div>
                        <div class="settings-grid">
                            <label>Input Pin<input type="number" id="set_setter_pin" min="0" step="1"></label>
                            <label>Active Level<select id="set_setter_level"><option value="0">0 (NC)</option><option value="1">1 (NO)</option></select></label>
                        </div>
                        <div class="settings-grid">
                            <label>Loc X<input type="number" id="set_setter_x" step="0.1"></label>
                            <label>Loc Y<input type="number" id="set_setter_y" step="0.1"></label>
                            <label>Loc Z<input type="number" id="set_setter_z" step="0.1"></label>
                            <label>Width<input type="number" id="set_setter_w" step="0.1" min="1"></label>
                            <label>Height<input type="number" id="set_setter_h" step="0.1" min="1"></label>
                        </div>
                        <div class="settings-hint">Used by generators for G31 commands, and by engine to simulate physical collisions accurately.</div>
                    </div>
                </div>

                <!-- HARDWARE: INPUT -->
                <div id="set_tab_input" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">INPUTS</div>
                        <div class="settings-hint">Add the inputs your machine has \u2014 probes, limit switches, sensors. Pins 1\u201324, one use each. Wizards read probe pins from here.</div>
                        <div id="io_input_table"></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">3D PROBE DEFAULTS</div>
                        <div class="settings-hint">What the touch-probe wizards (corner, edge, middle, circular, alignment, rotary) start from each time. <b>Stylus radius</b> drives radius compensation; pin &amp; level come from the 3D-probe input row above.</div>
                        <div class="settings-grid">
                            <label>Stylus radius (mm)<input type="number" id="set_pd_radius" min="0" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_pd_ffast" min="0" step="1"></label>
                            <label>Slow feed<input type="number" id="set_pd_fslow" min="0" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_pd_retract" min="0" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_pd_safez" step="1"></label>
                            <label>Max search (mm)<input type="number" id="set_pd_maxdist" min="0" step="1"></label>
                            <label>Q-stop<input type="number" id="set_pd_qstop" min="0" max="2" step="1"></label>
                        </div>
                    </div>
                </div>

                <!-- HARDWARE: OUTPUT -->
                <div id="set_tab_output" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">OUTPUTS</div>
                        <div class="settings-hint">Coolant, drawbar, dust cover, etc. Pins 1\u201320. The ATC tab adds its drawbar / dust-cover / carousel-rotate here.</div>
                        <div id="io_output_table"></div>
                    </div>
                </div>

                <!-- TOOL TABLE TAB (always present; "+ Add tool changer (ATC)" lives here) -->
                <div id="set_tab_atc" style="display:none">
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LIBRARY&nbsp;&nbsp;(length offset \u2192 #[base + tool \u2212 1])</div>
                        <div class="settings-grid">
                            <label>Base variable<input type="number" id="set_atc_basevar" step="1"></label>
                        </div>
                        <div id="set_atc_libsummary" style="margin-top:8px;"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="set_atc_library">\u{1F6E0} Tool library\u2026</button>
                            <button class="toolbar-btn settings-io" id="set_atc_insert">\u2B07 Insert tool table</button>
                        </div>
                        <div class="settings-hint">"Tool library" lists the tools you own (\xD8, flutes, feeds/speeds) \u2014 the Mill wizards and the ATC magazine pick from it. "Insert tool table" drops the #var = length offsets (tools that have a length) into the editor to push them to the controller.</div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">TOOL LENGTH PROBE (defaults for the Tool Length wizard)</div>
                        <div class="settings-grid">
                            <label>Block height (mm)<input type="number" id="set_atc_blockheight" step="0.1"></label>
                            <label>Safe Z (mm)<input type="number" id="set_atc_safez" step="0.1"></label>
                            <label>Max search (mm)<input type="number" id="set_atc_maxdist" step="1"></label>
                            <label>Retract (mm)<input type="number" id="set_atc_retract" step="0.1"></label>
                            <label>Fast feed<input type="number" id="set_atc_ffast" step="1"></label>
                            <label>Slow feed<input type="number" id="set_atc_fslow" step="1"></label>
                            <label>Q-stop<input type="number" id="set_atc_qstop" step="1"></label>
                        </div>
                        <div class="settings-hint">Tool-setter pin &amp; location live in the Input tab. The Tool Length wizard probes against the setter and writes the result to the tool table above.</div>
                    </div>
                    <div class="settings-section" id="set_atc_add" style="display:none">
                        <div class="settings-section-title">TOOL CHANGER (ATC)</div>
                        <div class="settings-hint">Add an automatic tool changer to set up the magazine and generate the T.nc tool-change macro. This adds the drawbar (and, for a disk magazine, carousel-rotate / index) I/O to Output/Input.</div>
                        <button class="toolbar-btn settings-io" id="set_atc_add_btn">\u2795 Add tool changer (ATC)</button>
                    </div>
                    <div id="set_atc_magazine_wrap" style="display:none">
                        <div class="settings-section">
                            <div class="settings-section-title">TOOL MAGAZINE</div>
                            <div class="settings-hint">Straight = each pocket has a park XYZ; disk = one pickup + rotate-to-pocket (auto-adds rotate / index I/O). The drawbar lives in Output.</div>
                            <div id="atc_magazine"></div>
                            <div class="settings-row" style="margin-top:12px;">
                                <button class="toolbar-btn settings-io" id="atc_gen_tnc">\u2699 Generate T.nc</button>
                                <button class="toolbar-btn settings-io" id="atc_dl_tnc" style="display:none">\u2B07 Download T.nc</button>
                            </div>
                            <div class="settings-hint">Builds the tool-change macro from the table above. Save it as <b>T.nc</b> on the controller \u2014 review &amp; dry-run first (generated template).</div>
                            <textarea id="atc_tnc_out" readonly spellcheck="false" style="display:none; width:100%; height:240px; margin-top:8px; font:12px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:8px; box-sizing:border-box;"></textarea>
                        </div>
                    </div>
                </div>

                        </div><!-- end settings-content -->
            `;
  wireSettingsOverlay(parent);
}
async function renderMachineNet(mount) {
  if (!mount) return;
  mount.textContent = "Checking gateway\u2026";
  let d = null;
  try {
    d = await (await fetch("/api/descriptor")).json();
  } catch (e) {
    d = null;
  }
  if (!d) {
    mount.innerHTML = `<div class="settings-hint">Run the <b>desktop app</b> (the gateway) to connect a controller \u2014 the hosted page can't reach a machine on your LAN.</div>`;
    return;
  }
  const connected = !!d.controller_connected;
  const fam = d.controller_family && d.controller_family !== "unknown" ? d.controller_family : "";
  const dest = d.dest || "";
  const wrap = document.createElement("div");
  wrap.innerHTML = '<div class="cloud-status' + (connected ? "" : " muted") + '">' + (connected ? "Connected" + (fam ? " \xB7 " + fam : "") + (dest ? " \xB7 " + dest : "") : "Not connected" + (dest ? " \xB7 " + dest : " \u2014 no controller share set")) + '</div><label style="display:block;margin-top:8px">Controller share (SMB)<input id="mn_dest" type="text" placeholder="\\\\10.0.0.50\\cncdisk" value="' + dest.replace(/"/g, "&quot;") + '"></label><div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button class="op-btn" data-mn="save">Save &amp; connect</button><button class="op-btn" data-mn="scan">\u{1F50D} Scan LAN</button><span class="mn-msg" style="flex:1"></span></div><div class="mn-results" style="margin-top:6px"></div>';
  mount.replaceChildren(wrap);
  const msg = wrap.querySelector(".mn-msg");
  const results = wrap.querySelector(".mn-results");
  async function save(val2) {
    const v6 = (val2 != null ? val2 : wrap.querySelector("#mn_dest").value).trim();
    if (!v6) {
      msg.textContent = "Enter a share path.";
      return;
    }
    msg.textContent = "Saving\u2026";
    try {
      const r = await (await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dest: v6 }) })).json();
      if (r && r.ok === false) {
        msg.textContent = r.error || "Save failed.";
        return;
      }
    } catch (e) {
      msg.textContent = "Save failed (gateway unreachable).";
      return;
    }
    renderMachineNet(mount);
  }
  async function scan2() {
    msg.textContent = "Scanning the LAN\u2026";
    results.textContent = "";
    let list2 = [];
    try {
      list2 = (await (await fetch("/api/scan")).json()).controllers || [];
    } catch (e) {
      msg.textContent = "Scan failed.";
      return;
    }
    msg.textContent = list2.length ? list2.length + " found \u2014 pick one" : "No controllers found on the LAN.";
    results.replaceChildren(...list2.map((c2) => {
      const b2 = document.createElement("button");
      b2.className = "op-btn";
      b2.style.cssText = "display:block;width:100%;text-align:left;margin-top:4px";
      b2.textContent = (c2.family || "controller") + " \xB7 " + c2.ip + "  (" + c2.dest + ")";
      b2.addEventListener("click", () => save(c2.dest));
      return b2;
    }));
  }
  wrap.addEventListener("click", (e) => {
    const t = e.target.closest("[data-mn]");
    if (!t) return;
    if (t.dataset.mn === "save") save();
    else scan2();
  });
}
async function renderLanAccess(mount) {
  if (!mount) return;
  mount.textContent = "Checking\u2026";
  let c2 = null;
  try {
    c2 = await (await fetch("/api/config")).json();
  } catch (e) {
    c2 = null;
  }
  if (!c2) {
    mount.innerHTML = '<div class="settings-hint">Available in the desktop app (the gateway).</div>';
    return;
  }
  const port = location.port || c2.port || 8765;
  const lanOn = c2.host === "0.0.0.0";
  const lanIp = c2.lan_ip || "";
  const lanUrl = lanOn && lanIp ? "http://" + lanIp + ":" + port + "/" : "";
  const wrap = document.createElement("div");
  wrap.innerHTML = '<div class="cloud-status">This PC: <code>http://localhost:' + port + "</code></div>" + (lanUrl ? '<div class="cloud-status" style="margin-top:4px">On your wifi: <code>' + lanUrl + `</code></div><div class="settings-hint" style="margin-top:2px">Other devices on the same network can open this \u2014 scan the code or share the link.</div><img src="/api/lan-qr" alt="Scan to open on your phone" width="148" height="148" style="margin-top:8px;background:#fff;border-radius:6px;padding:6px" onerror="this.style.display='none'">` : '<div class="settings-hint" style="margin-top:4px">Served on this PC only \u2014 set <code>host</code> to <code>0.0.0.0</code> in the gateway config to allow other devices.</div>');
  mount.replaceChildren(wrap);
}
function wireSettingsOverlay(ov) {
  const q = (id) => ov.querySelector("#" + id);
  const num11 = (v6, d) => {
    const n = parseFloat(v6);
    return Number.isFinite(n) ? n : d;
  };
  renderCloudLogin(q("set_cloud_mount"));
  renderMachineNet(q("set_machinenet_mount"));
  renderLanAccess(q("set_lan_mount"));
  function updateVarCount() {
    const db = window.ddcsStudio && window.ddcsStudio.variableDB;
    const el3 = q("set_var_count");
    if (el3 && db) el3.textContent = `${db.getAll().length} variables loaded`;
  }
  function fill() {
    const s = _ddcsSettings;
    if (!s.hardwareTabs) s.hardwareTabs = { probes: true, atc: false, limits: true };
    q("set_show_probes").checked = s.hardwareTabs.probes !== false;
    q("set_show_atc").checked = s.hardwareTabs.atc === true;
    q("set_show_limits").checked = s.hardwareTabs.limits !== false;
    const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
    if (q("set_pv_view")) q("set_pv_view").value = pv.defaultView || "3d";
    if (q("set_pv_speed")) q("set_pv_speed").value = String(pv.defaultSpeed || 1);
    if (q("set_pv_rapids")) q("set_pv_rapids").checked = pv.showRapids !== false;
    if (q("set_pv_follow_default")) q("set_pv_follow_default").checked = pv.followDefault !== false;
    if (q("set_pv_autoloop")) q("set_pv_autoloop").checked = pv.autoLoop !== false;
    const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
    if (q("set_cp_suggestions")) q("set_cp_suggestions").checked = cp.suggestions !== false;
    if (q("set_cp_autocomplete")) q("set_cp_autocomplete").checked = cp.autocomplete !== false;
    if (q("set_cp_ghost")) q("set_cp_ghost").checked = cp.ghost !== false;
    if (q("set_pv_followdamp")) {
      const d = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;
      q("set_pv_followdamp").value = String(d);
      const lbl = q("set_pv_followdamp_val");
      if (lbl) lbl.textContent = d + "%";
    }
    const ad = SETTINGS_DEFAULTS.atc, a = s.atc || (s.atc = {});
    q("set_atc_blockheight").value = a.blockHeight ?? ad.blockHeight;
    q("set_atc_safez").value = a.safeZ ?? ad.safeZ;
    q("set_atc_maxdist").value = a.maxDist ?? ad.maxDist;
    q("set_atc_retract").value = a.retract ?? ad.retract;
    q("set_atc_ffast").value = a.fFast ?? ad.fFast;
    q("set_atc_fslow").value = a.fSlow ?? ad.fSlow;
    q("set_atc_qstop").value = a.qStop ?? ad.qStop;
    q("set_atc_basevar").value = a.baseVar ?? ad.baseVar;
    renderLibSummary();
    q("set_mach_x").value = s.machine.x;
    q("set_mach_y").value = s.machine.y;
    q("set_mach_z").value = s.machine.z;
    q("set_mach_ox").value = s.machine.ox;
    q("set_mach_oy").value = s.machine.oy;
    q("set_mach_oz").value = s.machine.oz;
    {
      const w2 = s.machine.workOrigin || { x: 0, y: 0, z: 0 };
      q("set_mach_wx").value = w2.x;
      q("set_mach_wy").value = w2.y;
      q("set_mach_wz").value = w2.z;
    }
    q("set_mach_show").checked = !!s.machine.show;
    if (q("set_axis_a_role")) {
      const mo = s.motors || {};
      q("set_axis_a_role").value = mo.a && mo.a.role || "unused";
      q("set_axis_a_around").value = mo.a && mo.a.around || "x";
      q("set_axis_b_role").value = mo.b && mo.b.role || "unused";
      q("set_axis_b_around").value = mo.b && mo.b.around || "y";
    }
    q("set_probe_pin").value = s.probes.probePin;
    q("set_probe_level").value = s.probes.probeLevel;
    q("set_setter_pin").value = s.probes.setterPin;
    q("set_setter_level").value = s.probes.setterLevel;
    q("set_setter_x").value = s.probes.setterX;
    q("set_setter_y").value = s.probes.setterY;
    q("set_setter_z").value = s.probes.setterZ;
    q("set_setter_w").value = s.probes.setterW;
    q("set_setter_h").value = s.probes.setterH;
    const prd = SETTINGS_DEFAULTS.probes;
    if (q("set_pd_radius")) {
      q("set_pd_radius").value = s.probes.radius ?? prd.radius;
      q("set_pd_ffast").value = s.probes.fastFeed ?? prd.fastFeed;
      q("set_pd_fslow").value = s.probes.slowFeed ?? prd.slowFeed;
      q("set_pd_retract").value = s.probes.retract ?? prd.retract;
      q("set_pd_safez").value = s.probes.safeZ ?? prd.safeZ;
      q("set_pd_maxdist").value = s.probes.maxDist ?? prd.maxDist;
      q("set_pd_qstop").value = s.probes.qStop ?? prd.qStop;
    }
    q("set_x_min_pin").value = s.limits.xMinPin;
    q("set_x_min_level").value = s.limits.xMinLevel;
    q("set_x_max_pin").value = s.limits.xMaxPin;
    q("set_x_max_level").value = s.limits.xMaxLevel;
    q("set_y_min_pin").value = s.limits.yMinPin;
    q("set_y_min_level").value = s.limits.yMinLevel;
    q("set_y_max_pin").value = s.limits.yMaxPin;
    q("set_y_max_level").value = s.limits.yMaxLevel;
    q("set_z_min_pin").value = s.limits.zMinPin;
    q("set_z_min_level").value = s.limits.zMinLevel;
    q("set_z_max_pin").value = s.limits.zMaxPin;
    q("set_z_max_level").value = s.limits.zMaxLevel;
    const sp = s.spindle || (s.spindle = {}), spd = SETTINGS_DEFAULTS.spindle;
    if (q("set_spin_maxrpm")) {
      q("set_spin_maxrpm").value = sp.maxRpm ?? spd.maxRpm;
      q("set_spin_defrpm").value = sp.defaultRpm ?? spd.defaultRpm;
      q("set_spin_dir").value = sp.dir || spd.dir;
      q("set_spin_up").value = sp.spinUp ?? spd.spinUp;
      q("set_spin_down").value = sp.spinDown ?? spd.spinDown;
    }
    if (q("set_head_type")) {
      q("set_head_type").value = s.head && s.head.type || "spindle";
      applyHeadType();
    }
    const ep = s.endProgram || (s.endProgram = {}), epd = SETTINGS_DEFAULTS.endProgram;
    if (q("set_end_end")) {
      q("set_end_spindleoff").checked = ep.spindleOff !== false;
      q("set_end_coolantoff").checked = ep.coolantOff !== false;
      q("set_end_retract").checked = ep.retract !== false;
      q("set_end_retractz").value = ep.retractZ ?? epd.retractZ;
      q("set_end_park").checked = ep.park === true;
      q("set_end_parkx").value = ep.parkX ?? epd.parkX;
      q("set_end_parky").value = ep.parkY ?? epd.parkY;
      q("set_end_end").value = ep.end || epd.end;
    }
    updateVarCount();
  }
  fill();
  _fillSettingsInputs = fill;
  function applyHardwareTabs() {
    const ht = _ddcsSettings.hardwareTabs || {};
    const show = (id, on) => {
      const e = ov.querySelector("#" + id);
      if (e) e.style.display = on ? "" : "none";
    };
    show("set_spin_config", ht.spindle === true);
    show("set_spin_add", ht.spindle !== true);
    show("set_atc_magazine_wrap", ht.atc === true);
    show("set_atc_add", ht.atc !== true);
  }
  function applyHeadType() {
    const t = _ddcsSettings.head && _ddcsSettings.head.type || "spindle";
    const show = (id, on) => {
      const e = ov.querySelector("#" + id);
      if (e) e.style.display = on ? "" : "none";
    };
    show("set_head_spindle", t === "spindle");
    show("set_head_plasma", t === "plasma");
    show("set_head_laser", t === "laser");
  }
  const postSel = q("set_post");
  function fillPostOptions() {
    if (!postSel) return;
    const machinePost = getDialect(getActiveProfile().id);
    postSel.innerHTML = ['<option value="auto">Follow controller (' + machinePost.name + ")</option>"].concat(listPosts().map((p) => '<option value="' + p.id + '">' + p.name + (p.verified ? "  \u2713" : "  \u26A0 unverified") + "</option>")).join("");
    postSel.value = getActivePostId();
    updatePostHint();
  }
  function updatePostHint() {
    const hint = q("set_post_hint");
    if (!hint) return;
    const id = getActivePostId();
    if (id === "auto") {
      hint.textContent = "Following the controller (" + getDialect(getActiveProfile().id).name + "). Override to generate for another controller.";
      hint.style.color = "";
    } else if (!isPostVerified(id)) {
      hint.textContent = "\u26A0 Unverified post \u2014 dump-derived, simulator/reference only. Not validated on hardware.";
      hint.style.color = "#e0a020";
    } else {
      hint.textContent = "Generating for " + getDialect(id).name + " (verified).";
      hint.style.color = "";
    }
  }
  if (postSel) {
    fillPostOptions();
    postSel.addEventListener("change", () => {
      setActivePostId(postSel.value);
      updatePostHint();
      if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();
    });
  }
  const profileSel = q("set_profile");
  function fillProfileOptions() {
    if (!profileSel) return;
    profileSel.innerHTML = Object.values(CONTROLLER_PROFILES).map((p) => '<option value="' + p.id + '">' + p.name + (p.source === "controller" ? " (from controller)" : "") + "</option>").join("");
    profileSel.value = getActiveProfile().id;
  }
  if (profileSel) {
    fillProfileOptions();
    profileSel.addEventListener("change", () => {
      const p = setActiveProfile(profileSel.value);
      const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
      if (p && p.varFamily && vdb) vdb.setControllerVars(p.varFamily);
      _ddcsSettings.hardwareTabs = {
        probes: p.hardwareTabs.includes("probes"),
        atc: p.hardwareTabs.includes("atc"),
        limits: p.hardwareTabs.includes("limits")
      };
      saveSettings();
      fill();
      applyHardwareTabs();
      fillPostOptions();
    });
    makeClient().profile().then((p) => {
      if (p && p.id && Array.isArray(p.hardwareTabs)) {
        registerProfile(p);
        fillProfileOptions();
      }
    }).catch(() => {
    });
    const pullBtn = q("set_profile_pull");
    if (pullBtn) pullBtn.addEventListener("click", () => openImportModal());
  }
  function applyControllerProfile(p) {
    if (!p) return;
    if (Array.isArray(p.hardwareTabs)) {
      _ddcsSettings.hardwareTabs = {
        probes: p.hardwareTabs.includes("probes"),
        atc: p.hardwareTabs.includes("atc"),
        limits: p.hardwareTabs.includes("limits")
      };
    }
    const pn = p.pins;
    if (pn) {
      const ins = [];
      if (pn.probe !== "" && pn.probe != null) ins.push({ id: "probe", type: "probe", label: "3D Probe", pin: pn.probe, level: pn.probeLevel || 0 });
      if (pn.setter !== "" && pn.setter != null) ins.push({ id: "setter", type: "setter", label: "Tool Setter", pin: pn.setter, level: pn.setterLevel || 0, x: 10, y: 10, z: -50, w: 20, h: 20 });
      const lim = pn.limits || {};
      const LMAP = [["xMin", "x_min", "Limit X\u2212"], ["xMax", "x_max", "Limit X+"], ["yMin", "y_min", "Limit Y\u2212"], ["yMax", "y_max", "Limit Y+"], ["zMin", "z_min", "Limit Z\u2212"], ["zMax", "z_max", "Limit Z+"]];
      for (const [k, axis, label] of LMAP) {
        if (lim[k] !== "" && lim[k] != null) ins.push({ id: "limit_" + axis, type: "limit", axis, label, pin: lim[k], level: lim[k + "Level"] || 0 });
      }
      _ddcsSettings.inputs = ins;
      syncFlatFromIO(_ddcsSettings);
    }
    const m = _ddcsSettings.machine || (_ddcsSettings.machine = {});
    if (p.geometry && p.geometry.travel) {
      const t = p.geometry.travel;
      if (t.x != null && t.x > 0) m.x = t.x;
      if (t.y != null && t.y > 0) m.y = t.y;
      if (t.z != null && t.z > 0) m.z = t.z;
    }
    if (p.wcs && p.wcs.workOrigin) {
      const wo = p.wcs.workOrigin;
      m.workOrigin = { x: +wo.x || 0, y: +wo.y || 0, z: +wo.z || 0 };
    }
    saveSettings();
    fill();
    applyHardwareTabs();
  }
  applyHardwareTabs();
  window.ddcsRefreshControllerUI = () => {
    try {
      fillProfileOptions();
      fillPostOptions();
      applyHardwareTabs();
      fill();
    } catch (e) {
    }
  };
  function activeDialect() {
    const pid = getActivePostId();
    return getDialect(pid && pid !== "auto" ? pid : getActiveProfile().id);
  }
  function upsertToolLength(a, num12, len) {
    a.tools = a.tools || [];
    let rec = a.tools.find((t) => parseInt(t && t.num, 10) === num12);
    if (!rec) {
      rec = normalizeTool({}, num12);
      rec.num = num12;
      a.tools.push(rec);
    }
    rec.length = len;
  }
  async function applyHardwareProfile(p) {
    if (!p || !p.id) throw new Error("no profile");
    registerProfile(p);
    setActiveProfile(p.id);
    applyControllerProfile(p);
    const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
    const ap = getActiveProfile();
    if (ap && ap.varFamily && vdb) vdb.setControllerVars(ap.varFamily);
    fillProfileOptions();
    fillPostOptions();
    const it = ov.querySelector("#io_input_table");
    if (it) renderIoTable(it, "input", getInputs(), syncIO);
    const ot = ov.querySelector("#io_output_table");
    if (ot) renderIoTable(ot, "output", getOutputs(), syncIO);
  }
  async function scanController() {
    let hwProfile = null;
    try {
      hwProfile = await makeClient().profile();
    } catch (e) {
    }
    const d = hwProfile && hwProfile.id ? getDialect(hwProfile.id) : activeDialect();
    const atc = d.vars && d.vars.atc;
    const tb = d.vars && d.vars.toolTable || 1430;
    const wcsBase = d.vars && d.vars.wcsBase || 805, wcsStride = d.vars && d.vars.wcsStride || 5, activeWcsVar = d.vars && d.vars.activeWcs || 578;
    const MAX = 24;
    const need = /* @__PURE__ */ new Set([activeWcsVar]);
    for (let k = 0; k < 6 * wcsStride; k++) need.add(wcsBase + k);
    for (let i = 0; i < MAX; i++) {
      need.add(tb + i);
      if (atc) {
        need.add(atc.pocketX + i);
        need.add(atc.pocketY + i);
        need.add(atc.pocketZ + i);
      }
    }
    let values = {}, connected = false;
    try {
      const res = await makeClient().readVars([...need].map(String));
      connected = !!(res && res.connected);
      values = res && res.values || {};
    } catch (e) {
    }
    const obj = (n) => {
      const x = values[String(n)];
      return x && x.available ? x : null;
    };
    const cands = [], notes = [];
    if (hwProfile && hwProfile.id) {
      connected = true;
      cands.push({ group: "Hardware & I/O", label: `Profile \u201C${hwProfile.name}\u201D`, value: "tabs + pin map", changed: true, kind: "hardware", data: hwProfile });
    } else notes.push({ group: "Hardware & I/O", label: "Not available", value: "no gateway profile", kind: "note" });
    let magReadable = false, magCount = 0;
    if (atc) for (let i = 0; i < MAX; i++) {
      const x = obj(atc.pocketX + i), y = obj(atc.pocketY + i), z = obj(atc.pocketZ + i);
      if (x || y || z) magReadable = true;
      const xx = x ? x.value : 0, yy = y ? y.value : 0, zz = z ? z.value : 0;
      if (!xx && !yy && !zz) continue;
      magCount++;
      cands.push({ group: "ATC magazine", label: `Pocket ${i + 1} (T${i + 1})`, value: `X${xx} Y${yy} Z${zz}`, changed: [x, y, z].some((o) => o && o.userSet), kind: "magazine", data: { pocket: i + 1, tool: i + 1, name: "", x: xx, y: yy, z: zz } });
    }
    if (!atc) notes.push({ group: "ATC magazine", label: "Not available on this controller", value: "no mapped ATC model", kind: "note" });
    else if (!magReadable) notes.push({ group: "ATC magazine", label: "Not readable", value: "controller returned nothing", kind: "note" });
    else if (!magCount) notes.push({ group: "ATC magazine", label: "No taught pockets", value: "all at default (0)", kind: "note" });
    let lenReadable = false, lenCount = 0;
    for (let i = 0; i < MAX; i++) {
      const L2 = obj(tb + i);
      if (L2) lenReadable = true;
      if (!L2 || L2.value === 0) continue;
      lenCount++;
      cands.push({ group: "Tool lengths", label: `T${i + 1} length`, value: String(L2.value), changed: !!L2.userSet, kind: "length", data: { num: i + 1, length: L2.value } });
    }
    if (!lenReadable) notes.push({ group: "Tool lengths", label: "Not readable on this controller", value: "\u2014", kind: "note" });
    else if (!lenCount) notes.push({ group: "Tool lengths", label: "None set", value: "all at default (0)", kind: "note" });
    const idxO = obj(activeWcsVar);
    const idx = idxO && idxO.value >= 1 && idxO.value <= 6 ? Math.round(idxO.value) : 1;
    const base = wcsBase + (idx - 1) * wcsStride;
    const wx = obj(base), wy = obj(base + 1), wz = obj(base + 2);
    if (wx || wy || wz) {
      if (wx && wx.value || wy && wy.value || wz && wz.value)
        cands.push({ group: "WCS work offset", label: `G${53 + idx} work origin`, value: `X${wx ? wx.value : 0} Y${wy ? wy.value : 0} Z${wz ? wz.value : 0}`, changed: [wx, wy, wz].some((o) => o && o.userSet), kind: "wcs", data: { x: wx ? wx.value : 0, y: wy ? wy.value : 0, z: wz ? wz.value : 0 } });
      else notes.push({ group: "WCS work offset", label: `G${53 + idx} at default`, value: "origin = 0", kind: "note" });
    } else notes.push({ group: "WCS work offset", label: "Not readable", value: "\u2014", kind: "note" });
    const tv = hwProfile && hwProfile.geometry && hwProfile.geometry.travel;
    const mc = _ddcsSettings.machine || {};
    if (tv && [tv.x, tv.y, tv.z].some((v6) => v6 != null && v6 > 0)) {
      const tx = tv.x > 0 ? tv.x : mc.x, ty = tv.y > 0 ? tv.y : mc.y, tz = tv.z > 0 ? tv.z : mc.z;
      const changed = tv.x > 0 && tv.x !== mc.x || tv.y > 0 && tv.y !== mc.y || tv.z > 0 && tv.z !== mc.z;
      cands.push({ group: "Machine envelope", label: "Travel X/Y/Z", value: `${tx} \xD7 ${ty} \xD7 ${tz} mm`, changed, kind: "travel", data: { x: tv.x, y: tv.y, z: tv.z } });
    } else if (hwProfile && hwProfile.id) {
      notes.push({ group: "Machine envelope", label: "Not set", value: "soft limits off \u2014 keeping current", kind: "note" });
    }
    return { connected, candidates: cands.concat(notes), controller: hwProfile && hwProfile.id ? { id: hwProfile.id, name: hwProfile.name } : null };
  }
  async function applyCandidates(checked) {
    const a = _ddcsSettings.atc || (_ddcsSettings.atc = {});
    const mag = checked.filter((c2) => c2.kind === "magazine").map((c2) => c2.data).sort((x, y) => x.pocket - y.pocket);
    if (mag.length) {
      a.magazine = mag;
      a.tools = a.tools || [];
      mag.forEach((p) => {
        const tn = Number(p.tool);
        if (tn > 0 && !a.tools.some((t) => parseInt(t && t.num, 10) === tn)) a.tools.push(normalizeTool({}, tn));
      });
    }
    checked.filter((c2) => c2.kind === "length").forEach((c2) => upsertToolLength(a, c2.data.num, c2.data.length));
    const wcs = checked.find((c2) => c2.kind === "wcs");
    if (wcs) (_ddcsSettings.machine || (_ddcsSettings.machine = {})).workOrigin = wcs.data;
    const tvc = checked.find((c2) => c2.kind === "travel");
    if (tvc) {
      const mm = _ddcsSettings.machine || (_ddcsSettings.machine = {});
      if (tvc.data.x > 0) mm.x = tvc.data.x;
      if (tvc.data.y > 0) mm.y = tvc.data.y;
      if (tvc.data.z > 0) mm.z = tvc.data.z;
    }
    for (const c2 of checked.filter((c3) => c3.kind === "hardware")) {
      try {
        await applyHardwareProfile(c2.data);
      } catch (e) {
      }
    }
    saveSettings();
    fill();
    const mt = ov.querySelector("#atc_magazine");
    if (mt) renderMagazineTable(mt, _ddcsSettings.atc, atcOnChange);
    renderLibSummary();
  }
  let _importCands = [];
  let _importController = null;
  function buildImportModal() {
    if (document.getElementById("import-modal")) return;
    const m = document.createElement("div");
    m.id = "import-modal";
    m.innerHTML = `
            <style>
                #import-modal { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
                #import-modal.active { display: flex; }
                #import-modal .im-panel { background: var(--panel); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius, 6px); width: min(620px, 95vw); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
                #import-modal .im-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; letter-spacing: .5px; }
                #import-modal .im-head button { background: transparent; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
                #import-modal .im-body { overflow: auto; padding: 4px 14px 10px; min-height: 80px; }
                #import-modal .im-empty { padding: 24px 8px; text-align: center; color: var(--text-dim); }
                #import-modal .im-banner { margin: 8px 2px 2px; padding: 8px 10px; border-radius: 4px; font-size: 12px; background: rgba(224,160,32,.16); border: 1px solid rgba(224,160,32,.5); color: var(--text-main); }
                #import-modal .im-group { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-dim); padding: 12px 4px 4px; font-weight: 700; }
                #import-modal .im-row { display: grid; grid-template-columns: 22px 1fr auto auto; align-items: center; gap: 8px; padding: 5px 4px; border-bottom: 1px solid var(--border); cursor: pointer; }
                #import-modal .im-lbl { font-weight: 600; }
                #import-modal .im-val { font-family: monospace; font-size: 11.5px; color: var(--text-dim); }
                #import-modal .im-tag { font-size: 9.5px; text-transform: uppercase; letter-spacing: .5px; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
                #import-modal .im-tag.chg { background: rgba(60,180,90,.22); color: #3cb24f; }
                #import-modal .im-tag.def { background: rgba(128,128,128,.18); color: var(--text-dim); }
                #import-modal .im-tag.na { background: transparent; color: var(--text-dim); font-style: italic; }
                #import-modal .im-note-row { cursor: default; opacity: .85; }
                #import-modal .im-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
                #import-modal .im-only { font-size: 11.5px; color: var(--text-dim); display: flex; align-items: center; gap: 5px; cursor: pointer; }
            </style>
            <div class="im-panel">
                <div class="im-head"><span>\u21A7 Pull from controller</span><button id="import-close" title="Close">\u2715</button></div>
                <div class="im-body" id="import-body"></div>
                <div class="im-foot">
                    <label class="im-only"><input type="checkbox" id="import-only" checked> Show only changed</label>
                    <span style="flex:1"></span>
                    <button class="toolbar-btn settings-io" id="import-cancel">Cancel</button>
                    <button class="toolbar-btn settings-io" id="import-apply" disabled>Apply</button>
                </div>
            </div>`;
    document.body.appendChild(m);
    const close = () => m.classList.remove("active");
    m.querySelector("#import-close").addEventListener("click", close);
    m.querySelector("#import-cancel").addEventListener("click", close);
    m.addEventListener("mousedown", (e) => {
      if (e.target === m) close();
    });
  }
  function renderImportReview() {
    const m = document.getElementById("import-modal");
    const body = m.querySelector("#import-body");
    const applyBtn = m.querySelector("#import-apply");
    const onlyChanged = m.querySelector("#import-only").checked;
    const isNote = (c2) => c2.kind === "note";
    if (!_importCands.length) {
      body.innerHTML = '<div class="im-empty">Nothing readable on the controller.</div>';
      applyBtn.disabled = true;
      return;
    }
    const shown = _importCands.filter((c2) => isNote(c2) || !onlyChanged || c2.changed);
    const hiddenDefaults = _importCands.filter((c2) => !isNote(c2) && !c2.changed).length;
    const groups = {};
    shown.forEach((c2) => {
      (groups[c2.group] = groups[c2.group] || []).push(c2);
    });
    let html = "";
    if (_importController && _importController.id && _importController.id !== getActiveProfile().id) {
      html += `<div class="im-banner">Connected controller: <b>${_importController.name}</b> \u2014 applying <b>Hardware &amp; I/O</b> switches your machine profile + post from <b>${getActiveProfile().name}</b> to it.</div>`;
    }
    Object.keys(groups).forEach((g) => {
      html += `<div class="im-group">${g}</div>`;
      groups[g].forEach((c2) => {
        if (isNote(c2)) {
          html += `<div class="im-row im-note-row"><span></span><span class="im-lbl">${c2.label}</span><span class="im-val">${c2.value}</span><span class="im-tag na">n/a</span></div>`;
          return;
        }
        const i = _importCands.indexOf(c2);
        html += `<label class="im-row"><input type="checkbox" data-cand="${i}"${c2.checked ? " checked" : ""}><span class="im-lbl">${c2.label}</span><span class="im-val">${c2.value}</span><span class="im-tag ${c2.changed ? "chg" : "def"}">${c2.changed ? "changed" : "default"}</span></label>`;
      });
    });
    if (onlyChanged && hiddenDefaults) html += `<div class="im-empty">+${hiddenDefaults} value${hiddenDefaults > 1 ? "s" : ""} at factory default \u2014 untick \u201CShow only changed\u201D to add them.</div>`;
    body.innerHTML = html;
    body.querySelectorAll("[data-cand]").forEach((cb) => cb.addEventListener("change", () => {
      _importCands[+cb.dataset.cand].checked = cb.checked;
      updateApply();
    }));
    updateApply();
  }
  function updateApply() {
    const applyBtn = document.querySelector("#import-apply");
    const n = _importCands.filter((c2) => c2.checked).length;
    applyBtn.disabled = !n;
    applyBtn.textContent = n ? `Apply ${n}` : "Apply";
  }
  async function openImportModal() {
    buildImportModal();
    const m = document.getElementById("import-modal");
    const body = m.querySelector("#import-body");
    _importCands = [];
    body.innerHTML = '<div class="im-empty">Reading the controller\u2026</div>';
    m.querySelector("#import-apply").disabled = true;
    m.classList.add("active");
    let scan2;
    try {
      scan2 = await scanController();
    } catch (e) {
      scan2 = { connected: false, candidates: [] };
    }
    if (!scan2.connected) {
      body.innerHTML = '<div class="im-empty">Not bridged to a controller \u2014 run the desktop app / gateway, or Import a saved profile instead.</div>';
      return;
    }
    _importController = scan2.controller || null;
    _importCands = scan2.candidates.map((c2) => ({ ...c2, checked: !!c2.changed }));
    renderImportReview();
    m.querySelector("#import-only").onchange = renderImportReview;
    m.querySelector("#import-apply").onclick = async () => {
      const checked = _importCands.filter((c2) => c2.checked);
      const btn = m.querySelector("#import-apply");
      btn.disabled = true;
      btn.textContent = "Applying\u2026";
      try {
        await applyCandidates(checked);
        m.classList.remove("active");
      } catch (e) {
        body.innerHTML = '<div class="im-empty">Apply failed: ' + (e && e.message ? e.message : e) + "</div>";
      }
    };
  }
  function renderLibSummary() {
    const cont = q("set_atc_libsummary");
    if (!cont) return;
    const tools = libraryTools(_ddcsSettings.atc || {});
    if (!tools.length) {
      cont.innerHTML = '<span class="settings-hint">No tools yet \u2014 open the library to add them.</span>';
      return;
    }
    const chips = tools.map((t) => "T" + t.num + (t.name ? " " + t.name : t.dia !== "" ? " \xD8" + t.dia : "")).join("  \xB7  ");
    cont.innerHTML = '<span class="settings-hint">' + tools.length + " tool" + (tools.length > 1 ? "s" : "") + ":  " + chips + "</span>";
  }
  const _atcInsert = q("set_atc_insert");
  if (_atcInsert) {
    _atcInsert.addEventListener("click", () => {
      const a = _ddcsSettings.atc || {};
      const base = parseInt(a.baseVar, 10) || 1430;
      const lines = [];
      libraryTools(a).forEach((t) => {
        const v6 = t.length, n = parseInt(t.num, 10);
        if (v6 === "" || v6 == null || !Number.isFinite(Number(v6)) || !Number.isFinite(n)) return;
        lines.push("#" + (base + n - 1) + "=" + Number(v6) + " ( T" + n + (t.name ? " " + t.name : "") + " length )");
      });
      if (!lines.length) {
        alert("No tool lengths set in the library.");
        return;
      }
      const code = "( Tool table )\n" + lines.join("\n") + "\n";
      const em = window.ddcsStudio && window.ddcsStudio.editorManager || window.editorManager;
      if (em && typeof em.insert === "function") em.insert(code);
    });
  }
  function nextToolNum(tools) {
    let mx = 0;
    (tools || []).forEach((t) => {
      const n = parseInt(t && t.num, 10);
      if (Number.isFinite(n) && n > mx) mx = n;
    });
    return mx + 1;
  }
  function lenVarLabel(num12, base) {
    const n = parseInt(num12, 10);
    return Number.isFinite(n) ? "#" + (base + n - 1) : "#\u2014";
  }
  function renderToolLibRows() {
    const body = document.getElementById("toollib-rows");
    if (!body) return;
    const a = _ddcsSettings.atc || {};
    const base = parseInt(a.baseVar, 10) || 1430;
    const tools = a.tools || (a.tools = []);
    const opt = (cur) => '<option value="">\u2014</option>' + TOOL_TYPES.map((ty) => '<option value="' + ty + '"' + (ty === cur ? " selected" : "") + ">" + ty + "</option>").join("");
    const cell = (i, f, val2, step) => '<td><input type="number" step="' + (step || "any") + '" data-tool="' + i + '" data-field="' + f + '" value="' + (val2 === "" || val2 == null ? "" : val2) + '"></td>';
    if (!tools.length) {
      body.innerHTML = '<tr><td colspan="11" class="tl-empty">No tools yet \u2014 \u201C\uFF0B Add tool\u201D to start your library.</td></tr>';
      return;
    }
    let html = "";
    tools.forEach((raw2, i) => {
      const t = normalizeTool(raw2, i + 1);
      html += '<tr><td class="tl-numcell"><input type="number" step="1" min="1" max="99" data-tool="' + i + '" data-field="num" value="' + (t.num === "" || t.num == null ? "" : t.num) + '"><span class="tl-var" data-var="' + i + '">' + lenVarLabel(t.num, base) + '</span></td><td><input type="text" data-tool="' + i + '" data-field="name" value="' + String(t.name).replace(/"/g, "&quot;") + '" placeholder="e.g. 6mm flat 2F"></td><td><select data-tool="' + i + '" data-field="type">' + opt(t.type) + '</select></td><td class="tl-prof" data-prof="' + i + '">' + toolProfileSvg(t, { w: 26, h: 40 }) + "</td>" + cell(i, "dia", t.dia) + cell(i, "flutes", t.flutes, "1") + cell(i, "length", t.length, "0.001") + cell(i, "rpm", t.rpm, "1") + cell(i, "feed", t.feed, "1") + cell(i, "plunge", t.plunge, "1") + '<td><button class="tl-del" data-del="' + i + '" title="Remove tool">\u2715</button></td></tr>';
    });
    body.innerHTML = html;
  }
  function buildToolLibModal() {
    if (document.getElementById("toollib-modal")) return;
    const m = document.createElement("div");
    m.id = "toollib-modal";
    m.innerHTML = `
            <style>
                #toollib-modal { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
                #toollib-modal.active { display: flex; }
                #toollib-modal .tl-panel { background: var(--panel); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius, 6px); width: min(980px, 95vw); max-height: 88vh; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.5); }
                #toollib-modal .tl-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; letter-spacing: .5px; }
                #toollib-modal .tl-head button { background: transparent; border: none; color: var(--text-dim); font-size: 18px; cursor: pointer; }
                #toollib-modal .tl-body { overflow: auto; padding: 8px 16px 16px; }
                #toollib-modal table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
                #toollib-modal th { position: sticky; top: 0; background: var(--panel); text-align: left; font-size: 10.5px; letter-spacing: .5px; text-transform: uppercase; color: var(--text-dim); padding: 6px 6px; border-bottom: 1px solid var(--border); }
                #toollib-modal td { padding: 3px 4px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                #toollib-modal .tl-numcell { white-space: nowrap; }
                #toollib-modal .tl-numcell input { width: 46px; }
                #toollib-modal .tl-var { display: inline-block; margin-left: 6px; font-size: 10px; color: var(--text-dim); }
                #toollib-modal .tl-prof { text-align: center; width: 34px; }
                #toollib-modal .tl-prof svg { display: block; margin: 0 auto; }
                #toollib-modal .tl-empty { padding: 16px; text-align: center; color: var(--text-dim); }
                #toollib-modal input, #toollib-modal select { width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text-main); border: 1px solid var(--border); border-radius: 3px; padding: 4px 6px; font: inherit; }
                #toollib-modal td:nth-child(4) input, #toollib-modal td:nth-child(5) input, #toollib-modal td:nth-child(6) input,
                #toollib-modal td:nth-child(7) input, #toollib-modal td:nth-child(8) input, #toollib-modal td:nth-child(9) input { width: 70px; }
                #toollib-modal .tl-del { width: auto; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-size: 14px; padding: 2px 6px; }
                #toollib-modal .tl-del:hover { color: #d66; }
                #toollib-modal .tl-foot { padding: 10px 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
                #toollib-modal .tl-hint { font-size: 11px; color: var(--text-dim); }
            </style>
            <div class="tl-panel">
                <div class="tl-head"><span>\u{1F6E0} Tool library</span><button id="toollib-close" title="Close">\u2715</button></div>
                <div class="tl-body">
                    <table>
                        <thead><tr>
                            <th>Tool #</th><th>Name</th><th>Type</th><th>Profile</th><th>\xD8 mm</th><th>Flutes</th><th>Length</th><th>RPM</th><th>Feed</th><th>Plunge</th><th></th>
                        </tr></thead>
                        <tbody id="toollib-rows"></tbody>
                    </table>
                </div>
                <div class="tl-foot">
                    <button class="toolbar-btn settings-io" id="toollib-add">\uFF0B Add tool</button>
                    <span class="tl-hint">Tool # \u2192 length offset #[base + #\u22121]. Feeds in mm/min. The Mill wizards' Tool \u25BE and the ATC magazine read this list.</span>
                    <button class="toolbar-btn settings-io" id="toollib-done">Done</button>
                </div>
            </div>`;
    document.body.appendChild(m);
    const close = () => m.classList.remove("active");
    m.querySelector("#toollib-close").addEventListener("click", close);
    m.querySelector("#toollib-done").addEventListener("click", close);
    m.addEventListener("mousedown", (e) => {
      if (e.target === m) close();
    });
    m.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.tool == null || !t.dataset.field) return;
      const i = parseInt(t.dataset.tool, 10), f = t.dataset.field;
      const a = _ddcsSettings.atc;
      a.tools = a.tools || [];
      const rec = normalizeTool(a.tools[i], i + 1);
      let val2 = t.value;
      if (f !== "name" && f !== "type") val2 = val2 === "" ? "" : parseFloat(val2);
      rec[f] = val2;
      a.tools[i] = rec;
      saveSettings();
      if (f === "num") {
        const span = m.querySelector('.tl-var[data-var="' + i + '"]');
        if (span) span.textContent = lenVarLabel(rec.num, parseInt(a.baseVar, 10) || 1430);
      }
      if (f === "type" || f === "dia" || f === "length") {
        const cellEl = m.querySelector('.tl-prof[data-prof="' + i + '"]');
        if (cellEl) cellEl.innerHTML = toolProfileSvg(rec, { w: 26, h: 40 });
      }
      renderLibSummary();
    });
    m.addEventListener("click", (e) => {
      if (e.target.id === "toollib-add") {
        const a = _ddcsSettings.atc;
        a.tools = a.tools || [];
        a.tools.push(normalizeTool({}, nextToolNum(a.tools)));
        saveSettings();
        renderToolLibRows();
        renderLibSummary();
        return;
      }
      const del2 = e.target.dataset ? e.target.dataset.del : null;
      if (del2 != null) {
        const a = _ddcsSettings.atc;
        a.tools = a.tools || [];
        a.tools.splice(parseInt(del2, 10), 1);
        saveSettings();
        renderToolLibRows();
        renderLibSummary();
      }
    });
  }
  const _atcLibrary = q("set_atc_library");
  if (_atcLibrary) {
    _atcLibrary.addEventListener("click", () => {
      buildToolLibModal();
      renderToolLibRows();
      document.getElementById("toollib-modal").classList.add("active");
    });
  }
  const closeOv = () => {
    saveSettings();
    ov.classList.remove("active");
    setTimeout(() => {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }, 300);
  };
  const onInput = () => {
    const s = _ddcsSettings;
    if (!s.hardwareTabs) s.hardwareTabs = {};
    s.hardwareTabs.probes = q("set_show_probes").checked;
    s.hardwareTabs.atc = q("set_show_atc").checked;
    s.hardwareTabs.limits = q("set_show_limits").checked;
    applyHardwareTabs();
    const pv = s.preview || (s.preview = { ...SETTINGS_DEFAULTS.preview });
    if (q("set_pv_view")) pv.defaultView = q("set_pv_view").value;
    if (q("set_pv_speed")) pv.defaultSpeed = num11(q("set_pv_speed").value, 1);
    if (q("set_pv_rapids")) pv.showRapids = q("set_pv_rapids").checked;
    if (q("set_pv_follow_default")) pv.followDefault = q("set_pv_follow_default").checked;
    if (q("set_pv_autoloop")) pv.autoLoop = q("set_pv_autoloop").checked;
    const cp = s.compose || (s.compose = { ...SETTINGS_DEFAULTS.compose });
    if (q("set_cp_suggestions")) cp.suggestions = q("set_cp_suggestions").checked;
    if (q("set_cp_autocomplete")) cp.autocomplete = q("set_cp_autocomplete").checked;
    if (q("set_cp_ghost")) cp.ghost = q("set_cp_ghost").checked;
    if (q("set_pv_followdamp")) {
      pv.followDamp = num11(q("set_pv_followdamp").value, 50);
      const lbl = q("set_pv_followdamp_val");
      if (lbl) lbl.textContent = pv.followDamp + "%";
    }
    const a = s.atc || (s.atc = {});
    a.blockHeight = num11(q("set_atc_blockheight").value, a.blockHeight);
    a.safeZ = num11(q("set_atc_safez").value, a.safeZ);
    a.maxDist = num11(q("set_atc_maxdist").value, a.maxDist);
    a.retract = num11(q("set_atc_retract").value, a.retract);
    a.fFast = num11(q("set_atc_ffast").value, a.fFast);
    a.fSlow = num11(q("set_atc_fslow").value, a.fSlow);
    a.qStop = num11(q("set_atc_qstop").value, a.qStop);
    const _nb = num11(q("set_atc_basevar").value, a.baseVar);
    if (_nb !== a.baseVar) {
      a.baseVar = _nb;
      renderLibSummary();
    }
    s.machine.x = num11(q("set_mach_x").value, s.machine.x);
    s.machine.y = num11(q("set_mach_y").value, s.machine.y);
    s.machine.z = num11(q("set_mach_z").value, s.machine.z);
    s.machine.ox = num11(q("set_mach_ox").value, s.machine.ox);
    s.machine.oy = num11(q("set_mach_oy").value, s.machine.oy);
    s.machine.oz = num11(q("set_mach_oz").value, s.machine.oz);
    {
      const w2 = s.machine.workOrigin || (s.machine.workOrigin = { x: 0, y: 0, z: 0 });
      w2.x = num11(q("set_mach_wx").value, w2.x);
      w2.y = num11(q("set_mach_wy").value, w2.y);
      w2.z = num11(q("set_mach_wz").value, w2.z);
    }
    s.machine.show = q("set_mach_show").checked;
    s.probes.probePin = num11(q("set_probe_pin").value, s.probes.probePin);
    s.probes.probeLevel = num11(q("set_probe_level").value, s.probes.probeLevel);
    s.probes.setterPin = num11(q("set_setter_pin").value, s.probes.setterPin);
    s.probes.setterLevel = num11(q("set_setter_level").value, s.probes.setterLevel);
    s.probes.setterX = num11(q("set_setter_x").value, s.probes.setterX);
    s.probes.setterY = num11(q("set_setter_y").value, s.probes.setterY);
    s.probes.setterZ = num11(q("set_setter_z").value, s.probes.setterZ);
    s.probes.setterW = num11(q("set_setter_w").value, s.probes.setterW);
    s.probes.setterH = num11(q("set_setter_h").value, s.probes.setterH);
    if (q("set_pd_radius")) {
      s.probes.radius = num11(q("set_pd_radius").value, s.probes.radius);
      s.probes.fastFeed = num11(q("set_pd_ffast").value, s.probes.fastFeed);
      s.probes.slowFeed = num11(q("set_pd_fslow").value, s.probes.slowFeed);
      s.probes.retract = num11(q("set_pd_retract").value, s.probes.retract);
      s.probes.safeZ = num11(q("set_pd_safez").value, s.probes.safeZ);
      s.probes.maxDist = num11(q("set_pd_maxdist").value, s.probes.maxDist);
      s.probes.qStop = num11(q("set_pd_qstop").value, s.probes.qStop);
    }
    s.limits.xMinPin = q("set_x_min_pin").value ? num11(q("set_x_min_pin").value, null) : null;
    s.limits.xMinLevel = num11(q("set_x_min_level").value, s.limits.xMinLevel);
    s.limits.xMaxPin = q("set_x_max_pin").value ? num11(q("set_x_max_pin").value, null) : null;
    s.limits.xMaxLevel = num11(q("set_x_max_level").value, s.limits.xMaxLevel);
    s.limits.yMinPin = q("set_y_min_pin").value ? num11(q("set_y_min_pin").value, null) : null;
    s.limits.yMinLevel = num11(q("set_y_min_level").value, s.limits.yMinLevel);
    s.limits.yMaxPin = q("set_y_max_pin").value ? num11(q("set_y_max_pin").value, null) : null;
    s.limits.yMaxLevel = num11(q("set_y_max_level").value, s.limits.yMaxLevel);
    s.limits.zMinPin = q("set_z_min_pin").value ? num11(q("set_z_min_pin").value, null) : null;
    s.limits.zMinLevel = num11(q("set_z_min_level").value, s.limits.zMinLevel);
    s.limits.zMaxPin = q("set_z_max_pin").value ? num11(q("set_z_max_pin").value, null) : null;
    s.limits.zMaxLevel = num11(q("set_z_max_level").value, s.limits.zMaxLevel);
    const sp = s.spindle || (s.spindle = {});
    if (q("set_spin_maxrpm")) {
      sp.maxRpm = num11(q("set_spin_maxrpm").value, sp.maxRpm);
      sp.defaultRpm = num11(q("set_spin_defrpm").value, sp.defaultRpm);
      sp.dir = q("set_spin_dir").value || sp.dir;
      sp.spinUp = num11(q("set_spin_up").value, sp.spinUp);
      sp.spinDown = num11(q("set_spin_down").value, sp.spinDown);
    }
    if (q("set_head_type")) {
      s.head = s.head || {};
      s.head.type = q("set_head_type").value || "spindle";
      applyHeadType();
    }
    const ep = s.endProgram || (s.endProgram = {});
    if (q("set_end_end")) {
      ep.spindleOff = q("set_end_spindleoff").checked;
      ep.coolantOff = q("set_end_coolantoff").checked;
      ep.retract = q("set_end_retract").checked;
      ep.retractZ = num11(q("set_end_retractz").value, ep.retractZ);
      ep.park = q("set_end_park").checked;
      ep.parkX = num11(q("set_end_parkx").value, ep.parkX);
      ep.parkY = num11(q("set_end_parky").value, ep.parkY);
      ep.end = q("set_end_end").value || ep.end;
    }
    saveSettings();
  };
  ov.querySelectorAll('input[type="number"], input[type="checkbox"], input[type="range"], select').forEach((el3) => {
    el3.addEventListener("input", onInput);
    el3.addEventListener("change", onInput);
  });
  const _sg = q("set_suggest_on");
  if (_sg) {
    _sg.checked = localStorage.getItem("ddcs_suggest_on") !== "off";
    _sg.addEventListener("change", () => {
      try {
        localStorage.setItem("ddcs_suggest_on", _sg.checked ? "on" : "off");
      } catch (e) {
      }
      window.dispatchEvent(new CustomEvent("ddcs:suggest-changed"));
    });
  }
  const _theme = q("set_theme");
  if (_theme) {
    const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
    const cur = tm && tm.getCurrent && tm.getCurrent() || localStorage.getItem("ddcs_theme") || THEMES[0];
    _theme.innerHTML = THEMES.map((t) => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join("");
    _theme.value = cur;
    _theme.addEventListener("change", () => {
      const tm2 = window.ddcsStudio && window.ddcsStudio.themeManager;
      if (tm2 && tm2.setCurrent) tm2.setCurrent(_theme.value);
      else {
        document.body.setAttribute("data-theme", _theme.value);
        try {
          localStorage.setItem("ddcs_theme", _theme.value);
        } catch (e) {
        }
      }
    });
  }
  const _aboutVer = q("set_about_ver");
  if (_aboutVer) {
    const v6 = document.querySelector(".ver");
    _aboutVer.textContent = v6 ? v6.textContent.trim() : "V10.20";
  }
  const _emInsert = (code) => {
    const em = window.ddcsStudio && window.ddcsStudio.editorManager || window.editorManager;
    if (em && typeof em.insert === "function") em.insert(code);
  };
  const _endInsert = q("set_end_insert");
  if (_endInsert) _endInsert.addEventListener("click", () => {
    const ep = _ddcsSettings.endProgram || {};
    const lines = ["( End of program - DDCS Studio )"];
    if (ep.spindleOff !== false) lines.push("M5   ( spindle off )");
    if (ep.coolantOff !== false) lines.push("M9   ( coolant off )");
    if (ep.retract !== false) {
      lines.push("#101 = " + num11(ep.retractZ, 0) + "   ( safe Z - G53 needs a variable )");
      lines.push("G53 G0 Z#101   ( retract )");
    }
    if (ep.park === true) {
      lines.push("#102 = " + num11(ep.parkX, 0) + "  #103 = " + num11(ep.parkY, 0));
      lines.push("G53 G0 X#102 Y#103   ( park for unload )");
    }
    if (ep.end && ep.end !== "none") lines.push(ep.end);
    _emInsert(lines.join("\n") + "\n");
  });
  q("set_csv_input").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const db = window.ddcsStudio && window.ddcsStudio.variableDB;
      if (db) db.loadFromCSV(ev.target.result);
      if (window.refreshDeckVariables) window.refreshDeckVariables();
      updateVarCount();
    };
    r.readAsText(f);
  });
  q("set_export").addEventListener("click", () => {
    const db = window.ddcsStudio && window.ddcsStudio.variableDB;
    if (db) UIUtils.downloadFile("ddcs_variables.csv", db.exportCSV());
  });
  q("set_report").addEventListener("click", () => {
    const code = (document.getElementById("editor") || {}).value || "";
    const body = "Version: V10.20\n\nDescribe your feedback or bug below:\n\n" + (code ? "--- Editor Code ---\n" + code : "(editor empty)");
    window.location.href = "mailto:dansemur@gmail.com?subject=" + encodeURIComponent("DDCS Studio Feedback / Bug Report") + "&body=" + encodeURIComponent(body);
  });
  q("set_profile_export").addEventListener("click", () => {
    if (window.ddcsExportProfile) window.ddcsExportProfile();
  });
  q("set_profile_import").addEventListener("click", () => {
    if (window.ddcsImportProfile) window.ddcsImportProfile();
  });
  const cloudSave = q("set_profile_cloud_save");
  if (cloudSave) cloudSave.addEventListener("click", async () => {
    if (!window.ddcsSaveProfileToCloud) return;
    let def = "";
    try {
      def = getActiveProfile().name || "";
    } catch (e) {
    }
    const name = window.prompt("Save this profile to your cloud as:", def || "My machine");
    if (!name) return;
    const orig = cloudSave.textContent;
    cloudSave.disabled = true;
    cloudSave.textContent = "Saving\u2026";
    try {
      const n = await window.ddcsSaveProfileToCloud(name);
      alert("Saved \u201C" + n + "\u201D to your cloud.");
    } catch (e) {
      alert("Cloud save failed: " + (e && e.message ? e.message : e));
    } finally {
      cloudSave.disabled = false;
      cloudSave.textContent = orig;
    }
  });
  const cloudLoad = q("set_profile_cloud_load");
  if (cloudLoad) cloudLoad.addEventListener("click", () => openCloudProfilePicker());
  async function openCloudProfilePicker() {
    let items = [];
    try {
      items = await window.ddcsListCloudProfiles() || [];
    } catch (e) {
      alert("Could not reach your cloud: " + (e && e.message ? e.message : e));
      return;
    }
    if (!items.length) {
      alert("No cloud profiles yet \u2014 sign in (Settings \u2192 Cloud) and use \u201CSave to cloud\u201D.");
      return;
    }
    let m = document.getElementById("cloudprof-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "cloudprof-modal";
      m.innerHTML = '<style>#cloudprof-modal { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.5); }#cloudprof-modal .cp-panel { background:var(--panel); color:var(--text-main); border:1px solid var(--border); border-radius:var(--radius,6px); width:min(460px,94vw); max-height:80vh; display:flex; flex-direction:column; box-shadow:0 12px 40px rgba(0,0,0,.5); }#cloudprof-modal .cp-head { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border); font-weight:700; }#cloudprof-modal .cp-head button { background:transparent; border:none; color:var(--text-dim); font-size:18px; cursor:pointer; }#cloudprof-modal .cp-body { overflow:auto; padding:6px 12px 12px; }#cloudprof-modal .cp-row { display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--border); }#cloudprof-modal .cp-name { flex:1; font-weight:600; } #cloudprof-modal .cp-date { font-size:11px; color:var(--text-dim); }</style><div class="cp-panel"><div class="cp-head"><span>\u2601 Load profile from cloud</span><button data-cp="x">\u2715</button></div><div class="cp-body" id="cloudprof-body"></div></div>';
      document.body.appendChild(m);
      m.addEventListener("mousedown", (e) => {
        if (e.target === m || e.target.dataset && e.target.dataset.cp === "x") m.remove();
      });
    }
    const body = m.querySelector("#cloudprof-body");
    body.innerHTML = items.map((it) => {
      const d = it.savedAt ? new Date(it.savedAt).toLocaleString() : "";
      return '<div class="cp-row"><span class="cp-name">' + it.name + '</span><span class="cp-date">' + d + '</span><button class="toolbar-btn settings-io" data-load="' + it.id + '">Load</button><button class="op-btn" data-del="' + it.id + '" title="Delete">\u2715</button></div>';
    }).join("");
    body.querySelectorAll("[data-load]").forEach((b2) => b2.addEventListener("click", async () => {
      if (!confirm("Load this profile? It replaces your current settings + variables.")) return;
      b2.disabled = true;
      b2.textContent = "Loading\u2026";
      try {
        await window.ddcsLoadCloudProfile(b2.dataset.load);
        m.remove();
        fill();
        applyHardwareTabs();
        alert("Profile loaded.");
      } catch (e) {
        alert("Load failed: " + (e && e.message ? e.message : e));
        b2.disabled = false;
        b2.textContent = "Load";
      }
    }));
    body.querySelectorAll("[data-del]").forEach((b2) => b2.addEventListener("click", async () => {
      if (!confirm("Delete this cloud profile?")) return;
      try {
        await window.ddcsDeleteCloudProfile(b2.dataset.del);
        openCloudProfilePicker();
      } catch (e) {
        alert("Delete failed: " + (e && e.message ? e.message : e));
      }
    }));
  }
  function macrosArr() {
    return _ddcsSettings.macros || (_ddcsSettings.macros = []);
  }
  function editorText() {
    const e = document.getElementById("editor");
    return e ? e.value : "";
  }
  function macroFileText(m) {
    const name = (m.name || "macro").trim();
    const body = String(m.body || "").replace(/\r/g, "").replace(/\s+$/, "");
    const t = m.trigger || {};
    const hasEnd = /\b(M99|M30|M0?2)\b/.test(body);
    if (t.kind === "mcode") {
      const n = Math.max(0, parseInt(t.code, 10) || 0);
      return `O${1e4 + n} ( ${name} \u2014 M${n} )
${body}${hasEnd ? "" : "\nM99"}
`;
    }
    if (t.kind === "kbutton") {
      const k = Math.min(7, Math.max(1, parseInt(t.key, 10) || 1));
      return `( save as key-${k}.nc on SYSDISK \u2014 K${k} button )
${body}${hasEnd ? "" : "\nM30"}
`;
    }
    return `( save as ${(name || "macro").replace(/[^\w-]+/g, "_")}.nc )
${body}${hasEnd ? "" : "\nM30"}
`;
  }
  const insertToEditor = (txt) => {
    const em = window.ddcsStudio && window.ddcsStudio.editorManager || window.editorManager;
    if (em && typeof em.insert === "function") em.insert(txt);
    else alert("Editor not available.");
  };
  const findKbtn = (k) => macrosArr().find((m) => (m.trigger || {}).kind === "kbutton" && (m.trigger || {}).key === k);
  const ensureKbtn = (k) => {
    let m = findKbtn(k);
    if (!m) {
      m = { name: "", trigger: { kind: "kbutton", key: k }, body: "" };
      macrosArr().push(m);
    }
    return m;
  };
  async function pushMcode(m) {
    const n = parseInt((m.trigger || {}).code, 10) || 0;
    const oNum = "O" + (1e4 + n);
    if (!confirm(`Merge M${n} (${oNum}) into the controller's macro library (slib-m.nc)?

The existing slib-m.nc is backed up first (slib-m.nc.bak). You must REBOOT the controller afterward for it to load.`)) return;
    try {
      const cur = await makeClient().readSysfile("slib-m.nc");
      if (!cur || cur.ok === false) {
        alert("Could not read slib-m.nc \u2014 needs the gateway/desktop app + a connected controller." + (cur && cur.error ? "\n(" + cur.error + ")" : ""));
        return;
      }
      if (new RegExp("(^|\\s)" + oNum + "(\\s|$)").test(cur.content || "")) {
        alert(`${oNum} is already in slib-m.nc \u2014 remove it on the controller first so it isn't duplicated, then push again.`);
        return;
      }
      const res = await makeClient().writeSysfile("slib-m.nc", "\n" + macroFileText(m), "append");
      if (res && res.ok) alert(`Merged ${oNum} (M${n}) into slib-m.nc${res.backup ? " \u2014 backup " + res.backup : ""}.

Reboot the controller to load it; then M${n} is callable from a program.`);
      else alert("Push failed: " + (res && res.error || "unknown"));
    } catch (err) {
      alert("Push failed: " + (err && err.message ? err.message : err));
    }
  }
  async function pushKbutton(k, m) {
    if (!confirm(`Write key-${k}.nc to the controller (the K${k} button)?

The existing key-${k}.nc is backed up first (key-${k}.nc.bak).`)) return;
    try {
      const res = await makeClient().writeSysfile("key-" + k + ".nc", macroFileText(m), "write");
      if (res && res.ok) alert(`Wrote key-${k}.nc${res.backup ? " \u2014 backup " + res.backup : ""}.
Press K${k} to run it (reboot if the controller doesn't pick it up).`);
      else alert("Push failed: " + (res && res.error || "needs the gateway/desktop app + a connected controller"));
    } catch (err) {
      alert("Push failed: " + (err && err.message ? err.message : err));
    }
  }
  function renderMcodes() {
    const host = q("mcodes_list");
    if (!host) return;
    const rows = macrosArr().map((m, i) => ({ m, i })).filter((x) => (x.m.trigger || {}).kind === "mcode");
    if (!rows.length) {
      host.innerHTML = '<div class="settings-hint">No custom M-codes yet \u2014 \u201C\uFF0B Add from editor\u201D or \u201C\uFF0B Add blank\u201D.</div>';
      return;
    }
    host.innerHTML = rows.map(({ m, i }) => `<div class="macro-card" data-i="${i}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label style="font-size:11px; color:var(--text-dim);">M<input type="number" class="mc-f" data-f="num" value="${(m.trigger || {}).code != null ? m.trigger.code : 15}" min="0" max="99" style="width:52px; margin-left:2px;"></label>
                <input class="mc-f" data-f="name" value="${String(m.name || "").replace(/"/g, "&quot;")}" placeholder="Name" style="flex:1; min-width:120px;">
                <span class="mc-o" style="font-size:10px; color:var(--text-dim);">\u2192 O${1e4 + (parseInt((m.trigger || {}).code, 10) || 0)}</span>
            </div>
            <textarea class="mc-f" data-f="body" spellcheck="false" placeholder="macro body (G-code)" style="width:100%; height:110px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${String(m.body || "").replace(/</g, "&lt;")}</textarea>
            <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="gen">\u2B07 Generate</button><button class="toolbar-btn settings-io" data-act="push">\u2B06 Push to controller</button><span style="flex:1"></span><button class="op-btn" data-act="del" title="Delete">\u2715</button></div>
        </div>`).join("");
  }
  function renderKbuttons() {
    const host = q("kbuttons_list");
    if (!host) return;
    let html = "";
    for (let k = 1; k <= 7; k++) {
      const m = findKbtn(k);
      html += `<div class="kbtn-row" data-k="${k}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <b style="width:30px;">K${k}</b>
                    <input class="kb-f" data-f="name" value="${m ? String(m.name || "").replace(/"/g, "&quot;") : ""}" placeholder="(unused)" style="flex:1;">
                    <span style="font-size:10px; color:var(--text-dim);">key-${k}.nc</span>
                </div>
                <textarea class="kb-f" data-f="body" spellcheck="false" placeholder="button macro body" style="width:100%; height:80px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${m ? String(m.body || "").replace(/</g, "&lt;") : ""}</textarea>
                <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="ked">\u21EA From editor</button><button class="toolbar-btn settings-io" data-act="kgen">\u2B07 Generate</button><button class="toolbar-btn settings-io" data-act="kpush">\u2B06 Push</button><span style="flex:1"></span><button class="op-btn" data-act="kclr" title="Clear">\u2715</button></div>
            </div>`;
    }
    host.innerHTML = html;
  }
  const mch = q("mcodes_list");
  if (mch) {
    mch.addEventListener("input", (e) => {
      const c2 = e.target.closest(".macro-card");
      if (!c2 || !e.target.dataset.f) return;
      const m = macrosArr()[+c2.dataset.i];
      if (!m) return;
      const f = e.target.dataset.f;
      if (f === "name") m.name = e.target.value;
      else if (f === "body") m.body = e.target.value;
      else if (f === "num") {
        m.trigger = m.trigger || { kind: "mcode" };
        m.trigger.kind = "mcode";
        m.trigger.code = parseInt(e.target.value, 10) || 0;
        const s = c2.querySelector(".mc-o");
        if (s) s.textContent = "\u2192 O" + (1e4 + m.trigger.code);
      }
      saveSettings();
    });
    mch.addEventListener("click", (e) => {
      const c2 = e.target.closest(".macro-card");
      if (!c2) return;
      const i = +c2.dataset.i;
      const a = e.target.dataset.act;
      if (a === "del") {
        macrosArr().splice(i, 1);
        saveSettings();
        renderMcodes();
      } else if (a === "gen") insertToEditor(macroFileText(macrosArr()[i]));
      else if (a === "push") pushMcode(macrosArr()[i]);
    });
  }
  const kbh = q("kbuttons_list");
  if (kbh) {
    kbh.addEventListener("input", (e) => {
      const r = e.target.closest(".kbtn-row");
      if (!r || !e.target.dataset.f) return;
      const m = ensureKbtn(+r.dataset.k);
      if (e.target.dataset.f === "name") m.name = e.target.value;
      else m.body = e.target.value;
      saveSettings();
    });
    kbh.addEventListener("click", (e) => {
      const r = e.target.closest(".kbtn-row");
      if (!r) return;
      const k = +r.dataset.k;
      const a = e.target.dataset.act;
      if (a === "ked") {
        ensureKbtn(k).body = editorText().trim();
        saveSettings();
        renderKbuttons();
      } else if (a === "kgen") {
        const m = findKbtn(k);
        if (!m || !String(m.body).trim()) {
          alert("K" + k + " is empty.");
          return;
        }
        insertToEditor(macroFileText(m));
      } else if (a === "kpush") {
        const m = findKbtn(k);
        if (!m || !String(m.body).trim()) {
          alert("K" + k + " is empty.");
          return;
        }
        pushKbutton(k, m);
      } else if (a === "kclr") {
        const i = macrosArr().findIndex((x) => (x.trigger || {}).kind === "kbutton" && (x.trigger || {}).key === k);
        if (i >= 0) macrosArr().splice(i, 1);
        saveSettings();
        renderKbuttons();
      }
    });
  }
  const _mcAddEd = q("mcodes_add_editor");
  if (_mcAddEd) _mcAddEd.addEventListener("click", () => {
    macrosArr().push({ name: "New M-code", trigger: { kind: "mcode", code: 15 }, body: editorText().trim() });
    saveSettings();
    renderMcodes();
  });
  const _mcAddBlank = q("mcodes_add_blank");
  if (_mcAddBlank) _mcAddBlank.addEventListener("click", () => {
    macrosArr().push({ name: "New M-code", trigger: { kind: "mcode", code: 15 }, body: "" });
    saveSettings();
    renderMcodes();
  });
  renderMcodes();
  renderKbuttons();
  const genTnc = q("atc_gen_tnc");
  if (genTnc) genTnc.addEventListener("click", () => {
    const nc = generateToolChangeNc(_ddcsSettings.atc, getOutputs());
    const out = q("atc_tnc_out");
    if (out) {
      out.value = nc;
      out.style.display = "block";
    }
    const dl = q("atc_dl_tnc");
    if (dl) dl.style.display = "";
  });
  const dlTnc = q("atc_dl_tnc");
  if (dlTnc) dlTnc.addEventListener("click", () => {
    const out = q("atc_tnc_out");
    if (out && out.value) UIUtils.downloadFile("T.nc", out.value);
  });
  ["a", "b"].forEach((ax) => {
    const role = q("set_axis_" + ax + "_role"), around = q("set_axis_" + ax + "_around");
    const apply = () => {
      _ddcsSettings.motors = _ddcsSettings.motors || {};
      _ddcsSettings.motors[ax] = { role: role.value, around: around.value };
      saveSettings();
    };
    if (role) role.addEventListener("change", apply);
    if (around) around.addEventListener("change", apply);
  });
  const mainTabs = [...ov.querySelectorAll(".settings-main-tab")];
  const sideTabs = [...ov.querySelectorAll(".settings-sidebar .settings-tab")];
  const sideGroupLabels = [...ov.querySelectorAll(".settings-sidebar .sidebar-group-label")];
  const ALL_IDS = [
    "set_tab_profile",
    "set_tab_appearance",
    "set_tab_preview",
    "set_tab_compose",
    "set_tab_variables",
    "set_tab_program",
    "set_tab_macros",
    "set_tab_feedback",
    "set_tab_gateway",
    "set_tab_cloud",
    "set_tab_about",
    "set_tab_machine",
    "set_tab_spindle",
    "set_tab_input",
    "set_tab_output",
    "set_tab_atc"
  ];
  function showPanel(id) {
    ALL_IDS.forEach((p) => {
      const el3 = ov.querySelector("#" + p);
      if (el3) el3.style.display = p === id ? "block" : "none";
    });
    sideTabs.forEach((b2) => b2.classList.toggle("active", b2.dataset.target === id));
    if (id === "set_tab_input") renderIoTable(ov.querySelector("#io_input_table"), "input", getInputs(), syncIO);
    if (id === "set_tab_output") renderIoTable(ov.querySelector("#io_output_table"), "output", getOutputs(), syncIO);
    if (id === "set_tab_atc") renderMagazineTable(ov.querySelector("#atc_magazine"), _ddcsSettings.atc, atcOnChange);
  }
  function showGroup(g) {
    mainTabs.forEach((b2) => b2.classList.toggle("active", b2.dataset.group === g));
    sideTabs.forEach((b2) => {
      b2.style.display = b2.dataset.group === g ? "" : "none";
    });
    sideGroupLabels.forEach((l) => {
      l.style.display = l.dataset.groupLabel === g ? "" : "none";
    });
    if (g === "hardware") applyHardwareTabs();
    const firstVisible = sideTabs.find((b2) => b2.dataset.group === g && b2.style.display !== "none");
    if (firstVisible) showPanel(firstVisible.dataset.target);
  }
  mainTabs.forEach((t) => t.addEventListener("click", () => showGroup(t.dataset.group)));
  sideTabs.forEach((t) => t.addEventListener("click", () => showPanel(t.dataset.target)));
  showGroup("general");
  function addSubsystem(kind) {
    if (kind === "atc") {
      _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
      _ddcsSettings.hardwareTabs.atc = true;
      const outs = getOutputs();
      if (!outs.some((o) => o.type === "drawbar")) outs.push({ id: "drawbar_atc", type: "drawbar", label: "Drawbar (ATC)", pin: "", onCode: "M154", offCode: "M155", group: "atc" });
      saveSettings();
      applyHardwareTabs();
      showPanel("set_tab_atc");
    }
    if (kind === "spindle") {
      _ddcsSettings.hardwareTabs = _ddcsSettings.hardwareTabs || {};
      _ddcsSettings.hardwareTabs.spindle = true;
      saveSettings();
      applyHardwareTabs();
      showPanel("set_tab_spindle");
    }
  }
  const _spinAddBtn = q("set_spin_add_btn");
  if (_spinAddBtn) _spinAddBtn.addEventListener("click", () => addSubsystem("spindle"));
  const _atcAddBtn = q("set_atc_add_btn");
  if (_atcAddBtn) _atcAddBtn.addEventListener("click", () => addSubsystem("atc"));
  function atcOnChange() {
    const atc = _ddcsSettings.atc;
    const outs = getOutputs(), ins = getInputs();
    if (atc.magType === "disk") {
      if (!outs.some((o) => o.id === "rotate_atc")) outs.push({ id: "rotate_atc", type: "rotate", label: "Carousel rotate (ATC)", pin: "", onCode: "", offCode: "", group: "atc" });
      if (!ins.some((i) => i.id === "index_atc")) ins.push({ id: "index_atc", type: "sensor", label: "Pocket index (ATC)", pin: "", level: 0, group: "atc" });
    } else {
      const ro = outs.findIndex((o) => o.id === "rotate_atc");
      if (ro >= 0) outs.splice(ro, 1);
      const ix = ins.findIndex((i) => i.id === "index_atc");
      if (ix >= 0) ins.splice(ix, 1);
    }
    saveSettings();
  }
}
function openSettings() {
  window.dispatchEvent(new CustomEvent("ddcs:stop-previews"));
  if (window.ddcsStopPreview) window.ddcsStopPreview();
  buildSettingsOverlay();
  const app = document.getElementById("settings-app");
  if (app) app.classList.remove("hidden");
}
function closeSettings() {
  const app = document.getElementById("settings-app");
  if (app) app.classList.add("hidden");
}
var DDCS_SETTINGS_KEY, TOOL_TYPES, STANDARD_TOOLS, standardTools, STOCK_TEMPLATES, SETTINGS_DEFAULTS, LIMIT_AXES2, _ddcsSettings, _fillSettingsInputs;
var init_settingsPanel = __esm({
  "../DDCS-Studio/web/ui/settingsPanel.js"() {
    init_uiUtils();
    init_controllerProfiles();
    init_dialects();
    init_client();
    init_ioTable();
    init_toolProfile();
    init_themes();
    init_atcGenerator();
    init_cloudAccount();
    DDCS_SETTINGS_KEY = "ddcs_studio_settings";
    TOOL_TYPES = ["endmill", "drill", "ballnose", "chamfer", "vbit", "spotdrill", "face", "tap", "reamer", "engraver", "other"];
    STANDARD_TOOLS = [
      { num: 1, name: "6mm Flat Endmill", type: "endmill", dia: 6, flutes: 2, length: "", rpm: 18e3, feed: 1200, plunge: 400 },
      { num: 2, name: '1/8" Flat Endmill', type: "endmill", dia: 3.175, flutes: 2, length: "", rpm: 18e3, feed: 800, plunge: 300 },
      { num: 3, name: "6mm Ball Nose", type: "ballnose", dia: 6, flutes: 2, length: "", rpm: 18e3, feed: 1e3, plunge: 350 },
      { num: 4, name: "60\xB0 V-Bit", type: "vbit", dia: 6, flutes: 1, length: "", rpm: 18e3, feed: 600, plunge: 200 }
    ];
    standardTools = () => STANDARD_TOOLS.map((t) => ({ ...t }));
    STOCK_TEMPLATES = [
      { name: "3-axis plate (small)", x: 150, y: 100, z: 20, shape: "boss" },
      { name: "3-axis board (large)", x: 400, y: 300, z: 18, shape: "boss" },
      { name: "Rotary block 3\u2033", x: 150, y: 76.2, z: 76.2, shape: "boss" },
      { name: "Rotary cylinder \xD83\u2033", x: 150, y: 76.2, z: 76.2, shape: "cylinder" }
    ];
    SETTINGS_DEFAULTS = {
      stock: { x: 100, y: 80, z: 20, shape: "boss", show: true },
      stockTemplates: [],
      // user-saved presets: { name, x, y, z, shape }
      machine: { x: 300, y: 300, z: 120, ox: 0, oy: 0, oz: 0, show: true, workOrigin: { x: 0, y: 0, z: 0 } },
      view: { theta: -1.5708, phi: 1.0472 },
      // 3D preview start orientation (front: +X right, +Y back)
      probes: {
        probePin: 3,
        probeLevel: 0,
        // IN03 = YunKia V6 3D probe (confirmed)
        setterPin: 2,
        setterLevel: 0,
        // IN02 = fixed Tool Setter (confirmed); was 4 (IN04 = unwired)
        setterX: 10,
        setterY: 10,
        setterZ: -50,
        setterW: 20,
        setterH: 20,
        // 3D-probe global defaults the touch-probe wizards (corner/edge/middle/circular/alignment/rotary)
        // start from. radius drives radius compensation; feeds/retract/safeZ/maxDist/qStop seed each op.
        radius: 2,
        fastFeed: 200,
        slowFeed: 50,
        retract: 2,
        safeZ: 10,
        maxDist: 100,
        qStop: 1,
        // Per-field source: 'studio' = literal from the form (current behaviour) | 'ctrl' = generated
        // code reads the controller's own parameter at runtime (e.g. F#632 P#1078 — see
        // PROBE-CONFIG-SOURCE.md). Only fields the active controller profile lists in probeVars
        // can be 'ctrl'; the wizard inputs show a controller glyph to flip each one.
        sources: {
          port: "studio",
          level: "studio",
          fastFeed: "studio",
          retract: "studio",
          setterPort: "studio",
          setterLevel: "studio",
          blockHeight: "studio"
        }
      },
      limits: {
        xMinPin: "",
        xMinLevel: 0,
        xMaxPin: "",
        xMaxLevel: 0,
        yMinPin: "",
        yMinLevel: 0,
        yMaxPin: "",
        yMaxLevel: 0,
        zMinPin: "",
        zMinLevel: 0,
        zMaxPin: "",
        zMaxLevel: 0
      },
      // Which hardware tabs are shown (manual toggles, persisted). Defaults match the M350 profile:
      // Probes + Limits on, ATC off (no clutter unless you have a tool changer). Fully manual so non-bridge
      // users can configure for accurate simulation; a controller profile just presets these.
      hardwareTabs: { probes: true, atc: false, limits: true, spindle: false },
      // 3D/2D toolpath preview (read by viz/createPreviewPanel via window.ddcsGetSettings().preview).
      preview: { followDamp: 50, showRapids: true, defaultView: "3d", defaultSpeed: 1, followDefault: true, autoLoop: true },
      // Composing assists (Blocks suggestions, Studio editor autocomplete, ghost next-block).
      compose: { suggestions: true, autocomplete: true, ghost: true },
      // ATC: tool-length probe defaults (consumed by the Tool Length wizard) + the tool-offset table.
      // baseVar = DDCS tool-offset table base (#1430 = tool 1); tools[i] = stored length for tool i+1.
      atc: {
        baseVar: 1430,
        tools: standardTools(),
        blockHeight: 50,
        safeZ: 10,
        maxDist: 100,
        retract: 3,
        fFast: 300,
        fSlow: 50,
        qStop: 1,
        magType: "straight",
        magazine: []
        // magType: straight|disk; magazine[]: {pocket,tool,name,x,y,z}
      },
      // Toolhead fitted to the machine. spindle/router is the working type; plasma/laser are stubs.
      // Type-specific config lives in its own object (spindle below; plasma/laser TBD).
      head: { type: "spindle" },
      // Spindle / VFD — Studio-side authoring defaults. The DDCS controller owns the live spindle
      // params (PWM/analog, max RPM #582); these seed generated M3/M4 + S words, spin-up/down dwell,
      // and the warm-up wizard target. Added via the Head tab's "Add head".
      spindle: { maxRpm: 24e3, defaultRpm: 18e3, dir: "cw", spinUp: 3, spinDown: 3 },
      // End-of-program routine — the safe footer appended to generated programs. DDCS note: G53
      // machine-coord moves are verified; G28 is NOT configured, so retract/park use G53. Global
      // default; per-wizard overrides can layer on top later.
      endProgram: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: "M30" },
      // Dynamic machine I/O — the new source of truth; seeded from probes/limits on first load.
      inputs: [],
      outputs: [],
      // Custom controller macros (PART OF THE PROFILE): each = { id, name, trigger, body }. trigger.kind =
      // 'mcode' (O100nn → Mnn, called from a program) | 'kbutton' (key-1..7.nc, a panel button) | 'program'
      // (a named .nc). Authored in the Macros tab; rides in Export/Import/cloud via buildProfile.
      macros: [],
      // Axis roles — X/Y/Z linear; A/B optionally rotary. The sim reads this to spin the solid on a
      // rotary-axis move (around the declared Cartesian axis). Two rotary axes are allowed (A and B).
      motors: {
        x: { role: "linear" },
        y: { role: "linear" },
        z: { role: "linear" },
        a: { role: "unused", around: "x" },
        b: { role: "unused", around: "y" }
      }
    };
    LIMIT_AXES2 = [
      ["x_min", "Limit X\u2212", "xMinPin", "xMinLevel"],
      ["x_max", "Limit X+", "xMaxPin", "xMaxLevel"],
      ["y_min", "Limit Y\u2212", "yMinPin", "yMinLevel"],
      ["y_max", "Limit Y+", "yMaxPin", "yMaxLevel"],
      ["z_min", "Limit Z\u2212", "zMinPin", "zMinLevel"],
      ["z_max", "Limit Z+", "zMaxPin", "zMaxLevel"]
    ];
    _ddcsSettings = loadSettings();
    if (_ddcsSettings.atc) _ddcsSettings.atc.tools = libraryTools(_ddcsSettings.atc);
    window.ddcsProbeSrc = probeSrc;
    window.ddcsProbeSrcAvailable = probeSrcAvailable;
    window.ddcsSetProbeSrc = setProbeSrc;
    window.ddcsResolveProbeSources = resolveProbeSources;
    _fillSettingsInputs = null;
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
    window.ddcsGetSettings = getSettings;
    window.ddcsApplySettings = applySettings;
  }
});

// ../DDCS-Studio/web/wizards/toolPicker.js
function getToolLibrary() {
  const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
  return libraryTools(s.atc || {}).map((t) => {
    const dia = t.dia !== "" && t.dia != null ? "\xD8" + t.dia : "";
    const label = "T" + t.num + (t.name ? " \xB7 " + t.name : "") + (dia ? " (" + dia + ")" : "");
    return { ...t, label };
  });
}
function toolOptionsHTML(placeholder = "Tool\u2026 (from library)") {
  const opts = ['<option value="">' + placeholder + "</option>"];
  getToolLibrary().forEach((t) => {
    opts.push('<option value="' + t.num + '">' + t.label + "</option>");
  });
  return opts.join("");
}
function getTool(num11) {
  return getToolLibrary().find((t) => Number(t.num) === Number(num11)) || null;
}
function populateToolSelect(selectEl) {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = toolOptionsHTML();
  selectEl.value = keep;
}
function toolFieldMap(tool, ids) {
  const m = {};
  if (!tool || !ids) return m;
  const put = (key, id) => {
    if (id && tool[key] !== "" && tool[key] != null) m[id] = tool[key];
  };
  put("dia", ids.dia);
  put("feed", ids.feed);
  put("plunge", ids.plunge);
  put("rpm", ids.rpm);
  return m;
}
var init_toolPicker = __esm({
  "../DDCS-Studio/web/wizards/toolPicker.js"() {
    init_settingsPanel();
  }
});

// ../DDCS-Studio/web/wizards/pocketWizard.js
function pocketStack(params = {}) {
  const shape = params.shape || "rect";
  const tool = Math.max(0.1, num(params.toolDia, 6)), r = tool / 2;
  const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
  const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
  const ox = num(params.originX, 0), oy = num(params.originY, 0);
  const raster = (params.strategy || "spiral") === "raster";
  const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
  let region = newBlock("region"), tooSmall, cx, cy;
  if (shape === "circle") {
    const Rc = num(params.dia, 50) / 2 - r;
    tooSmall = Rc <= 0;
    cx = ox;
    cy = oy;
    region.params = { shape: "circle", x: ox, y: oy, w: 2 * Rc };
  } else {
    const w2 = num(params.w, 80), h = num(params.h, 60), iw = w2 - 2 * r, ih = h - 2 * r;
    tooSmall = iw <= 0 || ih <= 0;
    cx = ox + w2 / 2;
    cy = oy + h / 2;
    region.params = { shape: "rect", x: ox + r, y: oy + r, w: iw, h: ih };
  }
  if (tooSmall) {
    const hole = newBlock("drill");
    hole.params = { x: cx, y: cy, depth, peck: by, feed: plunge, clearance: clr };
    return [makeStart(params), hole, makeEnd(params)];
  }
  const over = newBlock("stepover");
  over.params = { region, stepover: so, strategy: raster ? "parallel" : "concentric", direction: "bothways", z: "z", feed, plunge, clearance: clr };
  const down = newBlock("stepdown");
  down.params = { to: depth, by };
  down.children = [over];
  if (raster) {
    const wall = newBlock("wall");
    wall.params = { region, z: "z", feed, plunge, clearance: clr };
    down.children.push(wall);
  }
  return [makeStart(params), down, makeEnd(params)];
}
var PocketWizard;
var init_pocketWizard = __esm({
  "../DDCS-Studio/web/wizards/pocketWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_programFraming();
    init_util();
    PocketWizard = class {
      generate(params) {
        recordOp("pocket", params);
        return emitMapped(pocketStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/slotWizard.js
function slotStack(params = {}) {
  const slot = newBlock("slot");
  slot.params = {
    x0: num(params.ax, 0),
    y0: num(params.ay, 0),
    x1: num(params.bx, 60),
    y1: num(params.by, 0),
    width: num(params.width, num(params.toolDia, 6)),
    tool: num(params.toolDia, 6),
    stepoverPct: num(params.stepoverPct, 40),
    depth: num(params.depth, 4),
    stepdown: num(params.stepdown, 1.5),
    feed: num(params.feed, 600),
    plunge: num(params.plunge, 150),
    clearance: num(params.clearance, 5)
  };
  return [makeStart(params), slot, makeEnd(params)];
}
var SlotWizard;
var init_slotWizard = __esm({
  "../DDCS-Studio/web/wizards/slotWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_programFraming();
    init_util();
    SlotWizard = class {
      generate(params) {
        recordOp("slot", params);
        return emitMapped(slotStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/surfacingWizard.js
function surfacingStack(params = {}) {
  const tool = Math.max(0.1, num(params.toolDia, 12));
  const so = Math.max(0.2, tool * num(params.stepoverPct, 60) / 100);
  const clr = num(params.clearance, 5), feed = num(params.feed, 800), plunge = num(params.plunge, 200);
  const ox = num(params.originX, 0), oy = num(params.originY, 0);
  const raster = (params.strategy || "raster") === "raster";
  const region = newBlock("region");
  region.params = { shape: "rect", x: ox, y: oy, w: num(params.w, 100), h: num(params.h, 80) };
  const over = newBlock("stepover");
  over.params = { region, stepover: so, strategy: raster ? "parallel" : "concentric", direction: "bothways", z: "z", feed, plunge, clearance: clr };
  const down = newBlock("stepdown");
  down.params = { to: num(params.depth, 0.5), by: num(params.stepdown, 0.5) };
  down.children = [over];
  return [makeStart(params), down, makeEnd(params)];
}
var SurfacingWizard;
var init_surfacingWizard = __esm({
  "../DDCS-Studio/web/wizards/surfacingWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_programFraming();
    init_util();
    SurfacingWizard = class {
      generate(params) {
        recordOp("surfacing", params);
        const w2 = num(params.w, 100), h = num(params.h, 80);
        const stack2 = w2 <= 0 || h <= 0 ? [makeStart(params), makeEnd(params)] : surfacingStack(params);
        return emitMapped(stack2).text;
      }
    };
  }
});

// ../DDCS-Studio/web/wizards/textWizard.js
function num9(v6, d) {
  return v6 === "" || v6 == null || isNaN(Number(v6)) ? d : Number(v6);
}
function textStack(params = {}) {
  const depth = num9(params.depth, 0.4);
  const stepdown = num9(params.stepdown, depth) || depth;
  const tool = Math.max(0.1, num9(params.toolDia, 1.5));
  const clr = num9(params.clearance, 4);
  const safeText = String(params.text == null ? "" : params.text).replace(/[()\n]/g, " ");
  const S = [];
  const C = (t) => {
    const b2 = newBlock("comment");
    b2.params = { text: t };
    S.push(b2);
  };
  C(`Text "${safeText}" - DDCS Studio`);
  C(`engrave fill | tool \xD8${tool} | stroke ${num9(params.strokeWidth, 2.5)} | depth ${depth}`);
  const ps = newBlock("progstart");
  ps.params = { ...ps.params, rpm: num9(params.rpm, ps.params.rpm), dir: params.dir || ps.params.dir, clearance: clr };
  S.push(ps);
  const ft = newBlock("filltext");
  ft.params = {
    ...ft.params,
    text: params.text == null ? "TEXT" : String(params.text),
    height: num9(params.height, 12),
    spacing: num9(params.spacing, 1.2),
    align: params.align || "left",
    x: num9(params.x, 0),
    y: num9(params.y, 0),
    strokeWidth: num9(params.strokeWidth, 2.5),
    toolDia: tool,
    stepoverPct: num9(params.stepoverPct, 50),
    z: "z",
    feed: num9(params.feed, 400),
    plunge: num9(params.plunge, 120),
    clearance: clr
  };
  const sd = newBlock("stepdown");
  sd.params = { ...sd.params, to: depth, by: stepdown };
  sd.children = [ft];
  S.push(sd);
  S.push(newBlock("progend"));
  return S;
}
var TextWizard;
var init_textWizard = __esm({
  "../DDCS-Studio/web/wizards/textWizard.js"() {
    init_blockModel();
    init_opRecord();
    init_textGeometry();
    TextWizard = class {
      generate(params) {
        recordOp("text", params);
        return emitMapped(textStack(params)).text;
      }
    };
  }
});

// ../DDCS-Studio/web/viz/navCube.js
function initCube(viz) {
  const THREE = viz.THREE;
  viz._cubeScene = new THREE.Scene();
  viz._cubeCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  viz._cubeCam.up.set(0, 0, 1);
  const labels = ["RIGHT", "LEFT", "BACK", "FRONT", "TOP", "BOTTOM"];
  viz._cubeViews = ["right", "left", "back", "front", "top", "bottom"];
  const mats = labels.map((label) => {
    const c2 = document.createElement("canvas");
    c2.width = c2.height = 128;
    const x = c2.getContext("2d");
    x.fillStyle = "#cdd5df";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "#7e8a9a";
    x.lineWidth = 7;
    x.strokeRect(4, 4, 120, 120);
    x.fillStyle = "#2b3340";
    x.font = "bold 19px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(label, 64, 66);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c2) });
  });
  viz._cubeMats = mats;
  viz._cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
  viz._cubeScene.add(viz._cube);
  viz._cubeScene.add(new THREE.LineSegments(new THREE.EdgesGeometry(viz._cube.geometry), new THREE.LineBasicMaterial({ color: 5595246 })));
  viz._cubeScene.add(new THREE.AxesHelper(0.95));
}
function cubeFaceAt(viz, e) {
  if (!viz._cubeScene || !viz._cubeRect) return -2;
  const r = viz.renderer.domElement.getBoundingClientRect();
  const { size, m } = viz._cubeRect;
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  const left = r.width - size - m, top = m;
  if (cx < left || cx > left + size || cy < top || cy > top + size) return -2;
  const ndc = new viz.THREE.Vector2((cx - left) / size * 2 - 1, -((cy - top) / size * 2 - 1));
  viz.raycaster.setFromCamera(ndc, viz._cubeCam);
  const hit = viz.raycaster.intersectObject(viz._cube, false)[0];
  return hit && hit.face ? hit.face.materialIndex : -1;
}
function highlightCubeFace(viz, idx) {
  if (!viz._cubeMats) return;
  let changed = false;
  for (let i = 0; i < viz._cubeMats.length; i++) {
    const hex = i === idx ? 6728447 : 16777215;
    if (viz._cubeMats[i].color.getHex() !== hex) {
      viz._cubeMats[i].color.setHex(hex);
      changed = true;
    }
  }
  if (changed) viz.render();
}
function nearestVisibleFace(viz, e) {
  if (!viz._cubeRect) return -1;
  const THREE = viz.THREE;
  const r = viz.renderer.domElement.getBoundingClientRect();
  const { size, m } = viz._cubeRect;
  const cx = e.clientX - r.left, cy = e.clientY - r.top;
  const left = r.width - size - m, top = m;
  const centers = [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]];
  const cam = viz._cubeCam.position;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < 6; i++) {
    const c2 = centers[i];
    if (c2[0] * cam.x + c2[1] * cam.y + c2[2] * cam.z <= 0) continue;
    const v6 = new THREE.Vector3(c2[0], c2[1], c2[2]).project(viz._cubeCam);
    const sx = left + (v6.x * 0.5 + 0.5) * size, sy = top + (-v6.y * 0.5 + 0.5) * size;
    const d = (sx - cx) ** 2 + (sy - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
function pickCube(viz, e) {
  const idx = cubeFaceAt(viz, e);
  if (idx === -2) return false;
  const face = idx >= 0 ? idx : nearestVisibleFace(viz, e);
  if (face >= 0) {
    const v6 = viz._cubeViews[face];
    if (v6) viz.setView(v6);
  }
  return true;
}
var init_navCube = __esm({
  "../DDCS-Studio/web/viz/navCube.js"() {
  }
});

// ../DDCS-Studio/web/viz/jogPendant.js
function setupJogPendant(viz) {
  const div = document.createElement("div");
  div.className = "viz3d-jog-pendant";
  div.style.cssText = "color: #fff; z-index: 100; font-size: 11px; display: none; user-select: none; box-sizing: border-box;";
  div.innerHTML = `
            <div class="jog-grid-wrap" style="display: none; background: rgba(18,18,22,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; margin-bottom: 6px;">
                <div class="jog-start-sel" style="display: none; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <span style="color:#9fb4c8;">Start</span>
                    <span class="jog-start-btns" style="display: flex; gap: 4px;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; color: #888; margin-bottom: 6px;">
                    <span style="color:#9fb4c8;">Step</span>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="1"> 1.0</label>
                    <label style="cursor:pointer;"><input type="radio" name="jogStep" value="10" checked> 10</label>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 32px 32px; gap: 6px;">
                    <button class="toolbar-btn" data-axis="z" data-dir="-1" style="font-weight:bold; padding:0;">Z-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="1" style="font-weight:bold; padding:0;">Y+</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="1" style="font-weight:bold; padding:0;">Z+</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="-1" style="font-weight:bold; padding:0;">X-</button>
                    <button class="toolbar-btn" data-axis="y" data-dir="-1" style="font-weight:bold; padding:0;">Y-</button>
                    <button class="toolbar-btn" data-axis="x" data-dir="1" style="font-weight:bold; padding:0;">X+</button>
                </div>
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                    <button class="toolbar-btn" data-axis="xy" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset X/Y to 0">0 XY</button>
                    <button class="toolbar-btn" data-axis="z" data-dir="0" style="flex:1; height:24px; padding:0; background:#2b3340; border-color:#555; color:#e6ecf2;" title="Reset Z to 0">0 Z</button>
                </div>
            </div>
        `;
  viz.container.appendChild(div);
  viz.jogPendant = div;
  div.addEventListener("pointerdown", (e) => e.stopPropagation());
  div.querySelectorAll("button[data-axis]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const axis = btn.getAttribute("data-axis");
      const dir = parseFloat(btn.getAttribute("data-dir"));
      const stepInput = div.querySelector('input[type="radio"]:checked');
      const step = stepInput ? parseFloat(stepInput.value) : 1;
      const idx = viz.selectedStart || 0;
      if (viz.starts && viz.starts[idx]) {
        const s = viz.starts[idx];
        if (axis === "x") s.x += dir * step;
        if (axis === "y") s.y += dir * step;
        if (axis === "z") s.z += dir * step;
        if (axis === "xy" && dir === 0) {
          s.x = 0;
          s.y = 0;
        }
        if (axis === "z" && dir === 0) {
          s.z = 0;
        }
        viz._positionMarkers();
        viz._rebuild();
        viz.render();
        if (typeof viz.onStartChange === "function") viz.onStartChange(viz.starts);
      }
    });
  });
  const startSel = div.querySelector(".jog-start-sel");
  const startBtns = div.querySelector(".jog-start-btns");
  const renderStarts = () => {
    const n = viz.starts && viz.starts.length || 1;
    startSel.style.display = n > 1 ? "flex" : "none";
    startBtns.innerHTML = "";
    const sel = viz.selectedStart || 0;
    for (let i = 0; i < n; i++) {
      const b2 = document.createElement("button");
      b2.textContent = String(i + 1);
      b2.title = `Jog start ${i + 1}`;
      if (i === sel) b2.classList.add("on");
      b2.addEventListener("click", () => {
        if (viz.selectStart) viz.selectStart(i);
      });
      startBtns.appendChild(b2);
    }
  };
  viz._renderJogStarts = renderStarts;
  renderStarts();
}
var init_jogPendant = __esm({
  "../DDCS-Studio/web/viz/jogPendant.js"() {
  }
});

// ../DDCS-Studio/web/viz/gcodeViz3d.js
var GcodeViz3D;
var init_gcodeViz3d = __esm({
  "../DDCS-Studio/web/viz/gcodeViz3d.js"() {
    init_navCube();
    init_jogPendant();
    init_settingsPanel();
    GcodeViz3D = class {
      constructor(container) {
        const THREE = window.THREE;
        if (!THREE) throw new Error("three.js not loaded");
        this.THREE = THREE;
        this.container = container;
        this.active = false;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(329482);
        this.scene = scene;
        const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 1e6);
        camera.up.set(0, 0, 1);
        this.persp = camera;
        const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e6, 1e6);
        ortho.up.set(0, 0, 1);
        this.ortho = ortho;
        this._ortho = false;
        this.camera = camera;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        container.appendChild(renderer.domElement);
        this.renderer = renderer;
        this.target = new THREE.Vector3(0, 0, 0);
        this.radius = 200;
        this.followCam = false;
        this.followLerp = 0.16;
        this._followRaf = null;
        this.theta = -Math.PI / 2;
        this.phi = Math.PI / 3;
        this.lineGroups = {};
        this._dataBounds = null;
        this._stock = null;
        this._machine = null;
        this.stockMesh = null;
        this.stockEdges = null;
        this.machineBox = null;
        this._segs = [];
        this._passCount = 1;
        this.starts = [{ x: 0, y: 0, z: 0 }];
        this.spindleMarkers = [];
        this.selectedStart = 0;
        this._downMarker = -1;
        this._axisMat = {};
        this.pathGroup = new THREE.Group();
        this.scene.add(this.pathGroup);
        this.raycaster = new THREE.Raycaster();
        this.onStartChange = null;
        this.showRapids = true;
        this._animOn = true;
        this._animSimSpeed = 1;
        this._animPaused = false;
        this._gizmoPx = 60;
        this._animRaf = null;
        this._animDist = 0;
        this._animLast = 0;
        this._animSegs = [];
        this._animMs = 0;
        this._setupJogPendant();
        this._initStaticScene();
        this._initCube();
        this._bindControls();
        this._applyCamera();
        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(container);
        this._resize();
      }
      _initStaticScene() {
        const THREE = this.THREE;
        const grid = new THREE.GridHelper(200, 20, 2771046, 1451055);
        grid.rotation.x = Math.PI / 2;
        this.grid = grid;
        this.scene.add(grid);
        const axes = new THREE.AxesHelper(25);
        this.axes = axes;
        this.scene.add(axes);
        this._gridLabels = {
          xp: this._makeTextSprite("+X"),
          xn: this._makeTextSprite("-X"),
          yp: this._makeTextSprite("+Y"),
          yn: this._makeTextSprite("-Y")
        };
        for (const k in this._gridLabels) this.scene.add(this._gridLabels[k]);
      }
      _makeTextSprite(text) {
        const THREE = this.THREE;
        const c2 = document.createElement("canvas");
        c2.width = 128;
        c2.height = 64;
        const ctx2 = c2.getContext("2d");
        ctx2.fillStyle = "#7fa8cc";
        ctx2.font = "bold 48px sans-serif";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(text, 64, 36);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), depthTest: false, transparent: true }));
        sp.renderOrder = 1;
        return sp;
      }
      // Interactive ViewCube — implementation in viz/navCube.js
      _initCube() {
        initCube(this);
      }
      _cubeFaceAt(e) {
        return cubeFaceAt(this, e);
      }
      _highlightCubeFace(idx) {
        highlightCubeFace(this, idx);
      }
      _pickCube(e) {
        return pickCube(this, e);
      }
      // A draggable start marker for one pass: ruby probe tip
      _makeMarker(pass) {
        const THREE = this.THREE;
        const grp = new THREE.Group();
        const ruby = new THREE.Mesh(
          new THREE.SphereGeometry(3, 20, 20),
          new THREE.MeshBasicMaterial({ color: 12849710, depthTest: false })
        );
        ruby.renderOrder = 11;
        grp.add(ruby);
        grp.add(this._makeNumberSprite(pass + 1));
        return grp;
      }
      // A camera-facing numbered badge floating above the ruby (order of execution)
      _makeNumberSprite(n) {
        const THREE = this.THREE;
        const c2 = document.createElement("canvas");
        c2.width = c2.height = 64;
        const ctx2 = c2.getContext("2d");
        ctx2.beginPath();
        ctx2.arc(32, 32, 29, 0, Math.PI * 2);
        ctx2.fillStyle = "rgba(18,18,22,0.88)";
        ctx2.fill();
        ctx2.lineWidth = 4;
        ctx2.strokeStyle = "#ffffff";
        ctx2.stroke();
        ctx2.fillStyle = "#ffffff";
        ctx2.font = "bold 38px sans-serif";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(String(n), 32, 35);
        const tex = new THREE.CanvasTexture(c2);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
        sp.scale.set(11, 11, 1);
        sp.position.set(0, 0, 11);
        sp.renderOrder = 13;
        return sp;
      }
      // JOG START pendant — implementation in viz/jogPendant.js
      _setupJogPendant() {
        setupJogPendant(this);
      }
      // Recreate markers only when the pass count changes
      _ensureMarkers() {
        if (this.spindleMarkers.length === this._passCount) return;
        for (const m of this.spindleMarkers) this.scene.remove(m);
        this.spindleMarkers = [];
        this._hoverKey = void 0;
        for (let p = 0; p < this._passCount; p++) {
          const m = this._makeMarker(p);
          this.spindleMarkers.push(m);
          this.scene.add(m);
        }
        if (this.selectedStart >= this._passCount) this.selectedStart = 0;
        if (this._renderJogStarts) this._renderJogStarts();
      }
      _positionMarkers() {
        for (let p = 0; p < this.spindleMarkers.length; p++) {
          const s = this.starts[p] || { x: 0, y: 0, z: 0 };
          this.spindleMarkers[p].position.set(s.x, s.y, s.z);
        }
        this._highlightSelectedStart();
      }
      // Choose which start the jog pendant drives (and which ruby is highlighted).
      selectStart(i) {
        const n = this.spindleMarkers.length || 1;
        this.selectedStart = Math.max(0, Math.min(n - 1, i | 0));
        this._highlightSelectedStart();
        if (this._renderJogStarts) this._renderJogStarts();
        this.render();
      }
      // Brighten the selected ruby, dim the rest, so it's clear which start the pendant jogs.
      _highlightSelectedStart() {
        for (let p = 0; p < this.spindleMarkers.length; p++) {
          const ruby = this.spindleMarkers[p].children[0];
          if (!ruby || !ruby.material) continue;
          const sel = p === this.selectedStart;
          ruby.material.color.setHex(sel ? 16722500 : 12849710);
          ruby.material.transparent = !sel;
          ruby.material.opacity = sel ? 1 : 0.5;
        }
      }
      // Ray-pick a start marker (ruby + numbered badge) under the pointer; returns pass index or -1.
      _pickMarker(e) {
        if (!this.spindleMarkers.length) return -1;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        let best = -1, bestDist = Infinity;
        for (let p = 0; p < this.spindleMarkers.length; p++) {
          const hit = this.raycaster.intersectObject(this.spindleMarkers[p], true)[0];
          if (hit && hit.distance < bestDist) {
            bestDist = hit.distance;
            best = p;
          }
        }
        return best;
      }
      // Keep each gizmo a constant on-screen size (independent of zoom): world size ∝ the
      // world-per-pixel at the marker (camera distance for perspective, frustum for ortho).
      _scaleMarkers() {
        if (!this.spindleMarkers.length) return;
        const H3 = this.container.clientHeight || 1;
        const targetPx = this._gizmoPx || 90, base = 26;
        const ortho = this.camera.isOrthographicCamera;
        const tanHalf = Math.tan(this.persp.fov * Math.PI / 180 / 2);
        for (const m of this.spindleMarkers) {
          const worldPerPx = ortho ? (this.camera.top - this.camera.bottom) / H3 : 2 * this.camera.position.distanceTo(m.position) * tanHalf / H3;
          m.scale.setScalar(Math.max(1e-4, targetPx * worldPerPx / base));
        }
        if (this.jogPendant) {
          this.jogPendant.style.display = this.starts && this.starts.length > 0 ? "block" : "none";
        }
      }
      // Set a pass's start programmatically (pass defaults to 0)
      setStart(x, y, z, pass) {
        const p = pass | 0;
        if (!this.starts[p]) this.starts[p] = { x: 0, y: 0, z: 0 };
        this.starts[p].x = x;
        this.starts[p].y = y;
        if (typeof z === "number") this.starts[p].z = z;
        this._rebuild();
        this.render();
        if (typeof this.onStartChange === "function") this.onStartChange(this.starts);
      }
      setShowRapids(on) {
        this.showRapids = !!on;
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.render();
      }
      // Snap the camera to a standard view (keeps the current target + radius)
      setView(name) {
        const H3 = Math.PI / 2;
        const views = {
          top: [-H3, 0],
          bottom: [-H3, Math.PI],
          front: [-H3, H3],
          back: [H3, H3],
          right: [0, H3],
          left: [Math.PI, H3],
          iso: [Math.PI / 4, Math.PI / 3]
        };
        const v6 = views[name] || views.iso;
        this.theta = v6[0];
        this.phi = v6[1];
        this.camera = this.ortho;
        this._ortho = true;
        this._applyCamera();
        this.render();
      }
      _ensureAnimTool() {
        if (this._animTool) return;
        const THREE = this.THREE;
        this._animTool = new THREE.Mesh(
          new THREE.SphereGeometry(2.5, 16, 16),
          new THREE.MeshBasicMaterial({ color: 16777215, depthTest: false })
        );
        this._animTool.renderOrder = 25;
        this._animTool.visible = false;
        this.scene.add(this._animTool);
      }
      // Toggle a tool dot that travels the whole path in execution order, feed-true (real program time)
      setAnimate(on) {
        this._animOn = !!on;
        this._ensureAnimTool();
        this._animTool.visible = this._animOn;
        this._dimRoute(this._animOn);
        if (this._animOn) {
          this._animDist = 0;
          this._animLast = 0;
          if (!this._animRaf) this._animTick();
        } else {
          if (this._animRaf) cancelAnimationFrame(this._animRaf);
          this._animRaf = null;
          this._applyPartRotation(0, 0);
          this.render();
        }
      }
      // Trail mode: while playing, keep the full route (the type-grouped lines) visible but faint — a thin 50%
      // "ghost" of the whole path — and reveal the bold solid "executed" overlay up to the tool head, so you can
      // read where you are against where you're going. Restores the original opacity on stop.
      _dimRoute(on) {
        this._trailOn = on;
        for (const k in this.lineGroups) {
          const o = this.lineGroups[k];
          if (!o) continue;
          if (on) {
            if (o.material.__op0 == null) o.material.__op0 = o.material.opacity != null ? o.material.opacity : 1;
            o.material.transparent = true;
            o.material.opacity = 0.5;
          } else if (o.material.__op0 != null) {
            o.material.opacity = o.material.__op0;
            o.material.transparent = o.material.__op0 < 1;
          }
        }
        if (this._trailLine) {
          this._trailLine.visible = on;
          if (!on) {
            if (this._trailTipIdx != null && this._trailTipOrig) {
              const o = this._trailTipOrig, pa = this._trailLine.geometry.getAttribute("position");
              pa.setXYZ(this._trailTipIdx, o.x, o.y, o.z);
              pa.needsUpdate = true;
            }
            this._trailTipIdx = null;
            this._trailTipOrig = null;
            this._trailLine.geometry.setDrawRange(0, 0);
          }
        }
        this.render();
      }
      // Called by execution engine to update tool position during execution
      setToolPosition(pos) {
        if (!pos || !Number.isFinite(pos.x) && !Number.isFinite(pos.y) && !Number.isFinite(pos.z)) return;
        this._ensureAnimTool();
        this._animTool.visible = true;
        const o = this.starts[0] || { x: 0, y: 0, z: 0 };
        this._animTool.position.set((pos.x || 0) + o.x, (pos.y || 0) + o.y, (pos.z || 0) + o.z);
        if (this._trailLine && this._animSegs && this._animSegs.length) {
          if (!this._trailOn) this._dimRoute(true);
          this._updateTrailTip(this._animTool.position);
        }
        this.render();
      }
      // Grow the bold trail so its tip sits EXACTLY on the tool head, drawing a partial current segment instead of
      // revealing whole segments (which read as a visibility toggle). Completed segments draw fully; the current
      // segment is shortened to a→toolhead by temporarily moving its end vertex (restored when the tip advances).
      _updateTrailTip(tp) {
        const line2 = this._trailLine, segs = this._animSegs;
        if (!line2 || !segs || !segs.length) return;
        const pos = line2.geometry.getAttribute("position");
        if (this._trailTipIdx != null && this._trailTipOrig) {
          const o = this._trailTipOrig;
          pos.setXYZ(this._trailTipIdx, o.x, o.y, o.z);
        }
        let ci = 0, best = Infinity, qx = 0, qy = 0, qz = 0;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          const dx = s.bx - s.ax, dy = s.by - s.ay, dz = s.bz - s.az;
          const len2 = dx * dx + dy * dy + dz * dz || 1e-9;
          let t = ((tp.x - s.ax) * dx + (tp.y - s.ay) * dy + (tp.z - s.az) * dz) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = s.ax + dx * t, cy = s.ay + dy * t, cz = s.az + dz * t;
          const dd = (tp.x - cx) ** 2 + (tp.y - cy) ** 2 + (tp.z - cz) ** 2;
          if (dd < best) {
            best = dd;
            ci = i;
            qx = cx;
            qy = cy;
            qz = cz;
          }
        }
        const vIdx = 2 * ci + 1;
        this._trailTipOrig = { x: pos.getX(vIdx), y: pos.getY(vIdx), z: pos.getZ(vIdx) };
        this._trailTipIdx = vIdx;
        pos.setXYZ(vIdx, qx, qy, qz);
        pos.needsUpdate = true;
        line2.geometry.setDrawRange(0, 2 * (ci + 1));
      }
      _animTick() {
        if (!this._animOn || !this.active) {
          this._animRaf = null;
          return;
        }
        const segs = this._animSegs;
        if (segs && segs.length) {
          const now = typeof performance !== "undefined" ? performance.now() : 0;
          const dt = this._animLast ? Math.min(0.1, (now - this._animLast) / 1e3) : 0;
          this._animLast = now;
          const total = this._animMs || 1;
          if (!this._animPaused) {
            this._animDist += dt * 1e3 * (this._animSimSpeed || 1);
            if (this._animDist >= total) {
              this._animDist = total;
              this._animPaused = true;
              setTimeout(() => {
                this._animDist = 0;
                this._animPaused = false;
                this._animLast = 0;
              }, 1e3);
            }
          }
          let d = Math.min(this._animDist, total);
          for (let i = 0; i < segs.length; i++) {
            const sg = segs[i];
            if (d <= sg.ms || i === segs.length - 1) {
              const t = sg.ms > 0 ? Math.min(1, d / sg.ms) : 1;
              this._animTool.position.set(sg.ax + (sg.bx - sg.ax) * t, sg.ay + (sg.by - sg.ay) * t, sg.az + (sg.bz - sg.az) * t);
              this._applyPartRotation(sg.a1 + (sg.a2 - sg.a1) * t, sg.b1 + (sg.b2 - sg.b1) * t);
              if (this._trailLine) this._trailLine.geometry.setDrawRange(0, 2 * i);
              break;
            }
            d -= sg.ms;
          }
          this.render();
        }
        this._animRaf = requestAnimationFrame(() => this._animTick());
      }
      // Spin the part group to the given rotary angles (degrees). A spins around its declared
      // Cartesian axis (getRotaryAxes), defaulting to X; B around its declared axis, if any.
      _applyPartRotation(a, b2) {
        const pg = this._partGroup;
        if (!pg) return;
        const rax = this._rotaryAxes || {};
        const deg = Math.PI / 180;
        pg.rotation.set(0, 0, 0);
        pg.rotation[rax.a || "x"] = (a || 0) * deg;
        if (rax.b) pg.rotation[rax.b] = (b2 || 0) * deg;
      }
      // Short beep at the end of each animation loop (Web Audio; silent until a user gesture)
      _beep() {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          if (!this._audio) this._audio = new Ctx();
          const ctx2 = this._audio;
          if (ctx2.state === "suspended") ctx2.resume();
          const o = ctx2.createOscillator(), g = ctx2.createGain();
          o.type = "square";
          o.frequency.value = 880;
          g.gain.value = 0.04;
          o.connect(g);
          g.connect(ctx2.destination);
          o.start();
          o.stop(ctx2.currentTime + 0.12);
        } catch (_) {
        }
      }
      _ndc(e) {
        const r = this.renderer.domElement.getBoundingClientRect();
        return new this.THREE.Vector2(
          (e.clientX - r.left) / r.width * 2 - 1,
          -((e.clientY - r.top) / r.height * 2 - 1)
        );
      }
      // Disabled gizmo picking
      _pickGizmo(e) {
        return null;
      }
      _setHighlight(pass, axis) {
      }
      // t along axisDir (unit) from lineOrigin to the point closest to the pointer ray
      _closestAxisT(ray, lineOrigin, axisDir) {
        const d = axisDir.dot(w0);
        const e = ray.direction.dot(w0);
        const denom = c - b * b;
        if (Math.abs(denom) < 1e-9) return 0;
        return (b * e - c * d) / denom;
      }
      setSegments(parsed, fit = true) {
        this._segs = parsed && parsed.segments || [];
        this._passCount = Math.max(1, parsed && parsed.stats && parsed.stats.passes || 1);
        while (this.starts.length < this._passCount) this.starts.push({ x: 0, y: 0, z: 0 });
        this.starts.length = this._passCount;
        this._ensureMarkers();
        this._rebuild();
        if (fit) this.fitAll();
        else this.render();
      }
      // Walk each pass, clamping probes to the stock so they stop at the wall instead of
      // running the full search distance (which would drift the path off into space).
      // Emits world-coordinate line groups (one per move type) and positions the markers.
      _rebuild() {
        const THREE = this.THREE;
        for (const k in this.lineGroups) {
          const o = this.lineGroups[k];
          if (o) {
            this.pathGroup.remove(o);
            o.geometry.dispose();
            o.material.dispose();
          }
        }
        this.lineGroups = {};
        const st = this._stock;
        const pocket = !!(st && st.shape === "pocket");
        let box = null;
        let cavity = null;
        if (st && st.show && st.x > 0 && st.y > 0 && st.z > 0) {
          box = { min: { x: 0, y: 0, z: -st.z }, max: { x: st.x, y: st.y, z: 0 } };
          if (pocket) {
            const w2 = Math.max(8, Math.min(st.x, st.y) * 0.25);
            cavity = { min: { x: w2, y: w2, z: -st.z }, max: { x: st.x - w2, y: st.y - w2, z: 0 } };
          }
        }
        const CAP = 20;
        const byPass = [];
        for (const s of this._segs) {
          const p = s.pass | 0;
          (byPass[p] || (byPass[p] = [])).push(s);
        }
        const feedPos = [], rapidPos = [], retractPos = [], probeFastPos = [], probeSlowPos = [], jogPos = [];
        let maxProbeFeed = 0;
        for (const s of this._segs) {
          if ((s.type === "probe" || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed;
        }
        const animSegs = [];
        const ROT_DEG_PER_MIN = 3600;
        const pushSeg = (ax, ay, az, bx, by, bz, rate, a1, b1, a2, b2, col) => {
          a1 = a1 || 0;
          b1 = b1 || 0;
          a2 = a2 || 0;
          b2 = b2 || 0;
          const len = Math.hypot(bx - ax, by - ay, bz - az);
          const da = Math.abs(a2 - a1) + Math.abs(b2 - b1);
          if (len < 1e-9 && da < 1e-9) return;
          const ms = len >= 1e-9 ? len / (rate > 0 ? rate : 600) * 6e4 : da / ROT_DEG_PER_MIN * 6e4;
          animSegs.push({ ax, ay, az, bx, by, bz, ms, a1, b1, a2, b2, col: col != null ? col : 16769357 });
        };
        let bounds = null;
        const grow = (x, y, z) => {
          bounds = this._growBounds(bounds, x, y, z, x, y, z);
        };
        let prevEnd = null;
        for (let p = 0; p < this._passCount; p++) {
          const segs = byPass[p] || [];
          const mk = this.starts[p] || { x: 0, y: 0, z: 0 };
          if (prevEnd) {
            jogPos.push(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z);
            grow(prevEnd.x, prevEnd.y, prevEnd.z);
            grow(mk.x, mk.y, mk.z);
            pushSeg(prevEnd.x, prevEnd.y, prevEnd.z, mk.x, mk.y, mk.z, 6e3, 0, 0, 0, 0, 16751117);
          }
          let cur = { x: 0, y: 0, z: 0 };
          for (const s of segs) {
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1, dz = s.z2 - s.z1;
            const type = s.type || (s.probe ? "probe" : s.rapid ? "rapid" : "feed");
            const start = cur;
            let end = { x: start.x + dx, y: start.y + dy, z: start.z + dz };
            if (type === "probe" && box) {
              const Aw = { x: start.x + mk.x, y: start.y + mk.y, z: start.z + mk.z };
              const Bw = { x: end.x + mk.x, y: end.y + mk.y, z: end.z + mk.z };
              let tt = null;
              const ro = this._boxRange(Aw, Bw, box.min, box.max);
              if (ro.hit && ro.tEnter > 1e-6 && ro.tEnter < 1 - 1e-6) tt = ro.tEnter;
              if (cavity) {
                const rc = this._boxRange(Aw, Bw, cavity.min, cavity.max);
                if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6 && rc.tExit < 1 - 1e-6) {
                  if (tt == null || rc.tExit < tt) tt = rc.tExit;
                }
              }
              if (tt != null) {
                end = { x: start.x + dx * tt, y: start.y + dy * tt, z: start.z + dz * tt };
              }
            }
            const ax = start.x + mk.x, ay = start.y + mk.y, az = start.z + mk.z;
            const bx = end.x + mk.x, by = end.y + mk.y, bz = end.z + mk.z;
            grow(ax, ay, az);
            grow(bx, by, bz);
            const slowProbe = type === "probe" && (s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed;
            const arr = type === "rapid" ? rapidPos : type === "retract" ? retractPos : type === "probe" ? slowProbe ? probeSlowPos : probeFastPos : feedPos;
            const col = type === "rapid" ? 16763904 : type === "retract" ? 3394645 : type === "probe" ? slowProbe ? 9684477 : 3900150 : 3538896;
            arr.push(ax, ay, az, bx, by, bz);
            pushSeg(ax, ay, az, bx, by, bz, type === "rapid" || type === "retract" ? 6e3 : s.feed > 0 ? s.feed : 600, s.a1, s.b1, s.a2, s.b2, col);
            cur = end;
          }
          prevEnd = { x: cur.x + mk.x, y: cur.y + mk.y, z: cur.z + mk.z };
        }
        this._animSegs = animSegs;
        this._animMs = animSegs.reduce((t, s) => t + s.ms, 0);
        this._rotaryAxes = getRotaryAxes();
        let feedCol = null;
        if (feedPos.length) {
          const zMin = bounds ? bounds.minZ : 0, zRange = bounds ? bounds.maxZ - bounds.minZ || 1 : 1;
          const cLow = new THREE.Color(675792), cHigh = new THREE.Color(3538896), tmp = new THREE.Color();
          feedCol = [];
          for (let i = 0; i < feedPos.length; i += 3) {
            tmp.copy(cLow).lerp(cHigh, (feedPos[i + 2] - zMin) / zRange);
            feedCol.push(tmp.r, tmp.g, tmp.b);
          }
        }
        this.lineGroups.feed = this._addLine(feedPos, { vertexColors: feedCol });
        this.lineGroups.rapid = this._addLine(rapidPos, { color: 16763904, opacity: 0.6 });
        if (this.lineGroups.rapid) this.lineGroups.rapid.visible = this.showRapids;
        this.lineGroups.retract = this._addLine(retractPos, { color: 3394645, opacity: 0.85 });
        this.lineGroups.probe = this._addLine(probeFastPos, { color: 3900150, dotted: true });
        this.lineGroups.probeSlow = this._addLine(probeSlowPos, { color: 9684477 });
        this.lineGroups.jog = this._addLine(jogPos, { color: 16751117, opacity: 0.95, dashed: true });
        if (this._trailLine) {
          this.pathGroup.remove(this._trailLine);
          this._trailLine.geometry.dispose();
          this._trailLine.material.dispose();
          this._trailLine = null;
        }
        this._trailTipIdx = null;
        this._trailTipOrig = null;
        this._trailOn = false;
        this._trailFat = null;
        if (animSegs.length) {
          const tp = [], tc = [], C = new THREE.Color();
          for (const s of animSegs) {
            tp.push(s.ax, s.ay, s.az, s.bx, s.by, s.bz);
            C.set(s.col != null ? s.col : 16769357);
            tc.push(C.r, C.g, C.b, C.r, C.g, C.b);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
          g.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
          g.setDrawRange(0, 0);
          const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 6 });
          mat.depthTest = false;
          const line2 = new THREE.LineSegments(g, mat);
          line2.renderOrder = 22;
          line2.visible = false;
          this.pathGroup.add(line2);
          this._trailLine = line2;
          this._trailFat = [];
          for (let k = 0; k < 4; k++) {
            const c2 = new THREE.LineSegments(g, mat);
            c2.renderOrder = 21;
            line2.add(c2);
            this._trailFat.push(c2);
          }
          this._layoutTrailFat();
        }
        this._positionMarkers();
        this._dataBounds = bounds;
      }
      // Build a LineSegments from a flat positions array; null if empty.
      _addLine(pos, opt) {
        if (!pos || !pos.length) return null;
        const THREE = this.THREE;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        let mat;
        if (opt.vertexColors) {
          g.setAttribute("color", new THREE.Float32BufferAttribute(opt.vertexColors, 3));
          mat = new THREE.LineBasicMaterial({ vertexColors: true });
        } else if (opt.dashed || opt.dotted) {
          const op = opt.opacity != null ? opt.opacity : 1;
          const dashSize = opt.dotted ? 0.6 : 3, gapSize = opt.dotted ? 1.4 : 2;
          mat = new THREE.LineDashedMaterial({ color: opt.color, transparent: op < 1, opacity: op, dashSize, gapSize });
        } else {
          const op = opt.opacity != null ? opt.opacity : 1;
          mat = new THREE.LineBasicMaterial({ color: opt.color, transparent: op < 1, opacity: op });
        }
        mat.depthTest = false;
        const lines = new THREE.LineSegments(g, mat);
        lines.renderOrder = 20;
        if (opt.dashed || opt.dotted) lines.computeLineDistances();
        this.pathGroup.add(lines);
        return lines;
      }
      // Parametric range [tEnter, tExit] where the line A→B crosses an axis-aligned box.
      _boxRange(A, B, boxMin, boxMax) {
        const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
        let tEnter = -Infinity, tExit = Infinity;
        for (const ax of ["x", "y", "z"]) {
          if (Math.abs(d[ax]) < 1e-9) {
            if (A[ax] < boxMin[ax] - 1e-6 || A[ax] > boxMax[ax] + 1e-6) return { hit: false };
          } else {
            let t1 = (boxMin[ax] - A[ax]) / d[ax];
            let t2 = (boxMax[ax] - A[ax]) / d[ax];
            if (t1 > t2) {
              const t = t1;
              t1 = t2;
              t2 = t;
            }
            if (t1 > tEnter) tEnter = t1;
            if (t2 < tExit) tExit = t2;
          }
        }
        return { hit: tEnter <= tExit, tEnter, tExit };
      }
      fit(b2) {
        const cx = (b2.minX + b2.maxX) / 2;
        const cy = (b2.minY + b2.maxY) / 2;
        const cz = (b2.minZ + b2.maxZ) / 2;
        this.target.set(cx, cy, cz);
        const sx = b2.maxX - b2.minX, sy = b2.maxY - b2.minY, sz = b2.maxZ - b2.minZ;
        const radius = Math.max(1, 0.5 * Math.hypot(sx, sy, sz));
        const fov = this.camera.fov * Math.PI / 180;
        this.radius = radius / Math.sin(fov / 2) * 1.25;
        const sv = typeof window !== "undefined" && window.ddcsGetSettings && window.ddcsGetSettings().view || {};
        this.theta = typeof sv.theta === "number" ? sv.theta : -Math.PI / 2;
        this.phi = typeof sv.phi === "number" ? sv.phi : Math.PI / 3;
        const span = Math.max(sx, sy, 10);
        const floorZ = this._stock && this._stock.show && this._stock.z > 0 ? -this._stock.z : b2.minZ;
        if (this.grid) {
          this.grid.scale.setScalar(span / 200);
          this.grid.position.set(cx, cy, floorZ);
        }
        if (this.axes) this.axes.scale.setScalar(Math.max(1, span / 200));
        if (this._gridLabels) {
          const half = span / 2, off = span * 0.07, lw = span * 0.14, z = floorZ;
          const L2 = this._gridLabels;
          L2.xp.position.set(cx + half + off, cy, z);
          L2.xn.position.set(cx - half - off, cy, z);
          L2.yp.position.set(cx, cy + half + off, z);
          L2.yn.position.set(cx, cy - half - off, z);
          for (const k in L2) L2[k].scale.set(lw, lw / 2, 1);
        }
        this._applyCamera();
      }
      _growBounds(b2, x0, y0, z0, x1, y1, z1) {
        if (!b2) return { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 };
        b2.minX = Math.min(b2.minX, x0);
        b2.minY = Math.min(b2.minY, y0);
        b2.minZ = Math.min(b2.minZ, z0);
        b2.maxX = Math.max(b2.maxX, x1);
        b2.maxY = Math.max(b2.maxY, y1);
        b2.maxZ = Math.max(b2.maxZ, z1);
        return b2;
      }
      // Frame the union of toolpath + stock + machine envelope (whichever are present)
      fitAll() {
        let b2 = null;
        const d = this._dataBounds;
        if (d) b2 = this._growBounds(b2, d.minX, d.minY, d.minZ, d.maxX, d.maxY, d.maxZ);
        const s = this._stock;
        if (s && s.show && s.x > 0 && s.y > 0 && s.z > 0) b2 = this._growBounds(b2, 0, 0, -s.z, s.x, s.y, 0);
        const m = this._machine;
        if (m && m.show && m.x > 0 && m.y > 0 && m.z > 0) {
          const ox = m.ox || 0, oy = m.oy || 0, oz = m.oz || 0;
          b2 = this._growBounds(b2, -ox, -oy, -oz, m.x - ox, m.y - oy, m.z - oz);
        }
        if (b2) this.fit(b2);
        this.render();
      }
      // Translucent stock block — WCS zero at the top, min XY corner: X[0..x] Y[0..y] Z[-z..0]
      setStock(stock) {
        const THREE = this.THREE;
        this._stock = stock || null;
        if (!this._partGroup) {
          this._partGroup = new THREE.Group();
          this.scene.add(this._partGroup);
        }
        const pg = this._partGroup;
        pg.rotation.set(0, 0, 0);
        if (this.stockMesh) {
          pg.remove(this.stockMesh);
          this.stockMesh.geometry.dispose();
          this.stockMesh.material.dispose();
          this.stockMesh = null;
        }
        if (this.stockEdges) {
          pg.remove(this.stockEdges);
          this.stockEdges.geometry.dispose();
          this.stockEdges.material.dispose();
          this.stockEdges = null;
        }
        if (stock && stock.show && stock.x > 0 && stock.y > 0 && stock.z > 0) {
          const pocket = stock.shape === "pocket";
          const fillCol = pocket ? 6983614 : 9416298;
          const edgeCol = pocket ? 8828671 : 10934140;
          let geo;
          const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.12, depthWrite: false });
          const mesh = new THREE.Mesh();
          if (pocket) {
            const w2 = Math.max(8, Math.min(stock.x, stock.y) * 0.25);
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(stock.x, 0);
            shape.lineTo(stock.x, stock.y);
            shape.lineTo(0, stock.y);
            shape.lineTo(0, 0);
            const hole = new THREE.Path();
            hole.moveTo(w2, w2);
            hole.lineTo(stock.x - w2, w2);
            hole.lineTo(stock.x - w2, stock.y - w2);
            hole.lineTo(w2, stock.y - w2);
            hole.lineTo(w2, w2);
            shape.holes.push(hole);
            geo = new THREE.ExtrudeGeometry(shape, { depth: stock.z, bevelEnabled: false });
            mesh.position.set(0, 0, -stock.z);
          } else if (stock.shape === "cylinder") {
            const axis = Object.values(getRotaryAxes())[0] || "x";
            const dims = { x: stock.x, y: stock.y, z: stock.z };
            const cross = axis === "x" ? [dims.y, dims.z] : axis === "y" ? [dims.x, dims.z] : [dims.x, dims.y];
            const r = Math.min(cross[0], cross[1]) / 2;
            geo = new THREE.CylinderGeometry(r, r, dims[axis], 48);
            if (axis === "x") geo.rotateZ(Math.PI / 2);
            else if (axis === "z") geo.rotateX(Math.PI / 2);
            mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
          } else {
            geo = new THREE.BoxGeometry(stock.x, stock.y, stock.z);
            mesh.position.set(stock.x / 2, stock.y / 2, -stock.z / 2);
          }
          mesh.geometry = geo;
          mesh.material = mat;
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.55 }));
          edges.position.copy(mesh.position);
          const C = new THREE.Vector3(stock.x / 2, stock.y / 2, -stock.z / 2);
          pg.position.copy(C);
          mesh.position.sub(C);
          edges.position.sub(C);
          this.stockMesh = mesh;
          pg.add(mesh);
          this.stockEdges = edges;
          pg.add(edges);
        }
      }
      // Tool Setter Block
      setProbes(probes) {
        const THREE = this.THREE;
        if (this.setterMesh) {
          this.scene.remove(this.setterMesh);
          this.setterMesh.geometry.dispose();
          this.setterMesh.material.dispose();
          this.setterMesh = null;
        }
        if (this.setterEdges) {
          this.scene.remove(this.setterEdges);
          this.setterEdges.geometry.dispose();
          this.setterEdges.material.dispose();
          this.setterEdges = null;
        }
        if (probes && probes.setterW > 0 && probes.setterH > 0) {
          const fillCol = 16711935;
          const edgeCol = 16738047;
          const mat = new THREE.MeshBasicMaterial({ color: fillCol, transparent: true, opacity: 0.25, depthWrite: false });
          const geo = new THREE.CylinderGeometry(probes.setterW / 2, probes.setterW / 2, probes.setterH, 16);
          geo.rotateX(Math.PI / 2);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(probes.setterX, probes.setterY, probes.setterZ - probes.setterH / 2);
          this.setterMesh = mesh;
          this.scene.add(mesh);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.6 }));
          edges.position.copy(mesh.position);
          this.setterEdges = edges;
          this.scene.add(edges);
        }
      }
      // Wireframe machine envelope — origin = program-zero offset from the envelope's min corner
      setMachine(machine) {
        const THREE = this.THREE;
        this._machine = machine || null;
        if (this.machineBox) {
          this.scene.remove(this.machineBox);
          this.machineBox.geometry.dispose();
          this.machineBox.material.dispose();
          this.machineBox = null;
        }
        if (machine && machine.show && machine.x > 0 && machine.y > 0 && machine.z > 0) {
          const src = new THREE.BoxGeometry(machine.x, machine.y, machine.z);
          const eg = new THREE.EdgesGeometry(src);
          src.dispose();
          const box = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 7109260, transparent: true, opacity: 0.4 }));
          const ox = machine.ox || 0, oy = machine.oy || 0, oz = machine.oz || 0;
          box.position.set(machine.x / 2 - ox, machine.y / 2 - oy, machine.z / 2 - oz);
          this.machineBox = box;
          this.scene.add(box);
        }
      }
      // Re-pivot the orbit on the point under the cursor (the stock surface if hovered,
      // otherwise the point at that screen location on the focus plane). Camera stays put.
      _setPivotFromCursor(e) {
        const THREE = this.THREE;
        this.raycaster.setFromCamera(this._ndc(e), this.camera);
        let pivot = null;
        if (this.stockMesh) {
          const hit = this.raycaster.intersectObject(this.stockMesh, false)[0];
          if (hit) pivot = hit.point.clone();
        }
        if (!pivot) {
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          const plane = new THREE.Plane(camDir, -camDir.dot(this.target));
          const pt = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(plane, pt)) pivot = pt;
        }
        if (!pivot) return;
        const off = this.camera.position.clone().sub(pivot);
        this.radius = Math.max(1, off.length());
        this.phi = Math.acos(Math.max(-1, Math.min(1, off.z / this.radius)));
        this.theta = Math.atan2(off.y, off.x);
        this.target.copy(pivot);
      }
      _applyCamera() {
        this.phi = Math.max(5e-4, Math.min(Math.PI - 5e-4, this.phi));
        const sinPhi = Math.sin(this.phi);
        const x = this.radius * sinPhi * Math.cos(this.theta);
        const y = this.radius * sinPhi * Math.sin(this.theta);
        const z = this.radius * Math.cos(this.phi);
        this.camera.up.set(-Math.cos(this.phi) * Math.cos(this.theta), -Math.cos(this.phi) * Math.sin(this.theta), sinPhi);
        this.camera.position.set(this.target.x + x, this.target.y + y, this.target.z + z);
        this.camera.lookAt(this.target);
        if (this.camera.isOrthographicCamera) {
          const halfH = this.radius * Math.tan(this.persp.fov * Math.PI / 180 / 2);
          const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
          this.camera.left = -halfH * aspect;
          this.camera.right = halfH * aspect;
          this.camera.top = halfH;
          this.camera.bottom = -halfH;
          this.camera.updateProjectionMatrix();
        }
        this.camera.updateMatrixWorld();
        this._layoutTrailFat();
      }
      // Fat trail: 4 offset copies of the trail line (children of _trailLine → they share its geometry, draw-range,
      // tip edits, colours and visibility) nudged ±right/±up in SCREEN space, so the bold executed path renders a
      // few px thick on any GPU (GL linewidth is capped at 1px on ANGLE). Offsets recompute here so the thickness
      // stays ~constant on screen through zoom.
      _layoutTrailFat() {
        const fat = this._trailFat;
        if (!fat || !fat.length) return;
        const THREE = this.THREE, cam = this.camera;
        const h = this.renderer && this.renderer.domElement.clientHeight || 600;
        const fov = (cam.fov || this.persp && this.persp.fov || 45) * Math.PI / 180;
        const o = 2 * this.radius * Math.tan(fov / 2) / h * 1.1;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
        const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize();
        fat[0].position.copy(right).multiplyScalar(o);
        fat[1].position.copy(right).multiplyScalar(-o);
        fat[2].position.copy(up).multiplyScalar(o);
        fat[3].position.copy(up).multiplyScalar(-o);
      }
      /** Centre-lock the camera on the tool. on → a rAF loop eases the orbit target onto the tool each frame. */
      setFollowCam(on) {
        this.followCam = !!on;
        if (this.followCam) {
          if (!this._followRaf) this._followTick();
        }
      }
      setFollowLerp(v6) {
        const n = +v6;
        if (Number.isFinite(n)) this.followLerp = Math.max(0.01, Math.min(0.6, n));
      }
      _followTick() {
        if (!this.followCam || !this.active) {
          this._followRaf = null;
          return;
        }
        if (this._animTool && this._animTool.visible) {
          const before = this.target.clone();
          this.target.lerp(this._animTool.position, this.followLerp);
          if (this.target.distanceToSquared(before) > 1e-5) {
            this._applyCamera();
            this.render();
          }
        }
        this._followRaf = requestAnimationFrame(() => this._followTick());
      }
      _toPerspective() {
        if (!this._ortho) return;
        this._ortho = false;
        this.camera = this.persp;
        this._applyCamera();
      }
      _bindControls() {
        const THREE = this.THREE;
        const el3 = this.renderer.domElement;
        el3.style.touchAction = "none";
        el3.style.userSelect = "none";
        let mode = null, px = 0, py = 0;
        const pointers = /* @__PURE__ */ new Map();
        const onMove = (e) => {
          if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (mode === "pinch") {
            if (pointers.size < 2) return;
            const pts = [...pointers.values()];
            const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
            this.radius = Math.max(0.5, Math.min(5e5, this._pinchRadius * (this._pinchDist / d)));
            const pdx = mx - this._pinchMid.x, pdy = my - this._pinchMid.y;
            this._pinchMid = { x: mx, y: my };
            const ps = this.radius * 15e-4;
            const r0 = new THREE.Vector3(), u0 = new THREE.Vector3();
            this.camera.matrixWorld.extractBasis(r0, u0, new THREE.Vector3());
            this.target.addScaledVector(r0, -pdx * ps);
            this.target.addScaledVector(u0, pdy * ps);
            this._applyCamera();
            this.render();
            return;
          }
          if (mode === "gizmo") {
            this.raycaster.setFromCamera(this._ndc(e), this.camera);
            const t1 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
            const delta = t1 - this._dragT0;
            const s = this.starts[this._dragPass] || (this.starts[this._dragPass] = { x: 0, y: 0, z: 0 });
            s.x = this._dragStart0.x + this._dragDir.x * delta;
            s.y = this._dragStart0.y + this._dragDir.y * delta;
            s.z = this._dragStart0.z + this._dragDir.z * delta;
            this._rebuild();
            this.render();
            return;
          }
          const dx = e.clientX - px, dy = e.clientY - py;
          px = e.clientX;
          py = e.clientY;
          if (mode === "rot") {
            this.theta -= dx * 0.01;
            this.phi -= dy * 0.01;
          } else if (mode === "pan") {
            const panScale = this.radius * 15e-4;
            const right = new THREE.Vector3(), up = new THREE.Vector3();
            this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
            this.target.addScaledVector(right, -dx * panScale);
            this.target.addScaledVector(up, dy * panScale);
          } else {
            return;
          }
          this._applyCamera();
          this.render();
        };
        const onUp = (e) => {
          if (e) pointers.delete(e.pointerId);
          if (mode === "pinch" && pointers.size < 2) mode = null;
          if (pointers.size > 0) return;
          if (mode === "gizmo" && typeof this.onStartChange === "function") {
            this.onStartChange(this.starts);
          }
          if (mode !== "gizmo" && this._downMarker >= 0 && e && Math.hypot(e.clientX - this._downX, e.clientY - this._downY) < 5) {
            this.selectStart(this._downMarker);
          }
          this._downMarker = -1;
          mode = null;
          try {
            if (this._pid != null) el3.releasePointerCapture(this._pid);
          } catch (_) {
          }
          this._pid = null;
          if (this.renderer) this.renderer.domElement.style.cursor = "default";
          this._setHighlight(null, null);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
        };
        el3.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size === 2) {
            const pts = [...pointers.values()];
            this._pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
            this._pinchRadius = this.radius;
            this._pinchMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            mode = "pinch";
            this._toPerspective();
            return;
          }
          if (pointers.size > 2) return;
          if (e.button === 0 && this._pickCube(e)) {
            pointers.delete(e.pointerId);
            return;
          }
          const g = e.button === 0 && !e.shiftKey ? this._pickGizmo(e) : null;
          if (g) {
            mode = "gizmo";
            this._dragPass = g.pass;
            this.selectStart(g.pass);
            this._dragDir = g.axis === "x" ? new THREE.Vector3(1, 0, 0) : g.axis === "y" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
            const s = this.starts[g.pass] || { x: 0, y: 0, z: 0 };
            this._dragStart0 = new THREE.Vector3(s.x, s.y, s.z);
            this.raycaster.setFromCamera(this._ndc(e), this.camera);
            this._dragT0 = this._closestAxisT(this.raycaster.ray, this._dragStart0, this._dragDir);
            this._setHighlight(g.pass, g.axis);
            this.renderer.domElement.style.cursor = "grabbing";
          } else {
            this._downMarker = e.button === 0 && !e.shiftKey ? this._pickMarker(e) : -1;
            this._downX = e.clientX;
            this._downY = e.clientY;
            if (e.button === 1) mode = e.shiftKey ? "rot" : "pan";
            else mode = e.button === 2 || e.shiftKey ? "pan" : "rot";
            if (mode === "rot") this._toPerspective();
          }
          px = e.clientX;
          py = e.clientY;
          if (e.pointerType !== "touch") {
            try {
              el3.setPointerCapture(e.pointerId);
              this._pid = e.pointerId;
            } catch (_) {
            }
          }
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        });
        el3.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
        el3.addEventListener("contextmenu", (e) => e.preventDefault());
        el3.addEventListener("mousedown", (e) => {
          if (e.button === 1) e.preventDefault();
        });
        el3.addEventListener("pointermove", (e) => {
          if (mode) return;
          const faceIdx = this._cubeFaceAt(e);
          if (faceIdx !== -2) {
            this._highlightCubeFace(faceIdx);
            el3.style.cursor = "pointer";
            this._setHighlight(null, null);
            return;
          }
          this._highlightCubeFace(-1);
          const g = this._pickGizmo(e);
          this._setHighlight(g ? g.pass : null, g ? g.axis : null);
        });
        el3.addEventListener("pointerleave", () => {
          if (!mode) {
            this._setHighlight(null, null);
            this._highlightCubeFace(-1);
          }
        });
        el3.addEventListener("wheel", (e) => {
          e.preventDefault();
          const old = this.radius;
          const next = Math.max(0.5, Math.min(5e5, old * Math.exp(e.deltaY * 2e-3)));
          this.raycaster.setFromCamera(this._ndc(e), this.camera);
          this.raycaster.params.Line.threshold = old * 0.02;
          const objs = [];
          if (this.stockMesh) objs.push(this.stockMesh);
          if (this.pathGroup) objs.push(this.pathGroup);
          const hit = objs.length ? this.raycaster.intersectObjects(objs, true)[0] : null;
          let zoomPoint = hit ? hit.point : null;
          if (!zoomPoint) {
            const THREE2 = this.THREE;
            const camDir = new THREE2.Vector3();
            this.camera.getWorldDirection(camDir);
            const plane = new THREE2.Plane(camDir, -camDir.dot(this.target));
            const p = new THREE2.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, p)) zoomPoint = p;
          }
          if (zoomPoint) this.target.lerp(zoomPoint, 1 - next / old);
          this.radius = next;
          this._applyCamera();
          this.render();
        }, { passive: false });
      }
      _resize() {
        const w2 = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w2, h, false);
        this.persp.aspect = w2 / h;
        this.persp.updateProjectionMatrix();
        this._applyCamera();
        this.render();
      }
      // Called when the 3D tab becomes visible — the container had zero size while
      // hidden, so re-measure and re-render.
      // Re-parent the viewer's canvas into another container (used for the wizard previews).
      attach(container) {
        if (!container) return;
        const cv = this.renderer.domElement;
        container.style.position = "relative";
        cv.style.position = "absolute";
        cv.style.inset = "0";
        cv.style.zIndex = "2";
        if (this.container !== container) {
          this.container = container;
          container.appendChild(cv);
          if (this._ro) {
            this._ro.disconnect();
            this._ro.observe(container);
          }
        }
        if (this.jogPendant) container.appendChild(this.jogPendant);
        this._resize();
      }
      setActive(on) {
        this.active = on;
        if (on) {
          this._resize();
          if (this._animOn) {
            this._ensureAnimTool();
            this._animTool.visible = true;
            if (!this._animRaf) {
              this._animLast = 0;
              this._animTick();
            }
          }
        } else if (this._animRaf) {
          cancelAnimationFrame(this._animRaf);
          this._animRaf = null;
        }
      }
      render() {
        const r = this.renderer;
        const w2 = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
        this._scaleMarkers();
        r.setScissorTest(false);
        r.setViewport(0, 0, w2, h);
        r.render(this.scene, this.camera);
        if (this._cubeScene) {
          const size = Math.max(64, Math.min(96, w2 * 0.16)), m = 10;
          const sp = Math.sin(this.phi);
          this._cubeCam.position.set(sp * Math.cos(this.theta), sp * Math.sin(this.theta), Math.cos(this.phi)).multiplyScalar(3.4);
          this._cubeCam.lookAt(0, 0, 0);
          this._cubeCam.updateMatrixWorld();
          const vx = w2 - size - m, vy = h - size - m;
          r.setViewport(vx, vy, size, size);
          r.setScissor(vx, vy, size, size);
          r.setScissorTest(true);
          r.autoClear = false;
          r.clearDepth();
          r.render(this._cubeScene, this._cubeCam);
          r.autoClear = true;
          r.setScissorTest(false);
          r.setViewport(0, 0, w2, h);
          this._cubeRect = { size, m };
        }
      }
      dispose() {
        if (this._ro) this._ro.disconnect();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
      }
    };
  }
});

// ../DDCS-Studio/web/engine/virtualIO.js
function resolveVirtualPin(port, mode) {
  const key = `${mode}_${port}`;
  return HARDWARE_PIN_MAP[key] || key;
}
function resetVirtualIO() {
  for (const id of _pendingHandshakes) clearTimeout(id);
  _pendingHandshakes.clear();
  ioState.outputs.clear();
  ioState.inputs.clear();
  console.log("[VIRTUAL IO] State reset \u2014 all pins cleared.");
}
function setVirtualOutput(pin, value) {
  const prev = ioState.outputs.get(pin);
  ioState.outputs.set(pin, value);
  if (prev !== value) {
    console.log(`[VIRTUAL IO] Output ${pin}: ${prev ?? "undefined"} \u2192 ${value}`);
  }
  triggerVirtualHandshake(pin, value);
}
function getVirtualInput(pin) {
  return ioState.inputs.get(pin) ?? false;
}
function injectVirtualInput(pin, state) {
  ioState.inputs.set(pin, state);
  console.log(`[VIRTUAL IO] Injected input ${pin} = ${state}`);
  _dispatchIoChange(pin, state);
}
function triggerVirtualHandshake(outputPin, state = true) {
  const stateRuleKey = `${outputPin}_${state ? "ON" : "OFF"}`;
  const rule = M3K_TRUTH_TABLE[stateRuleKey] || (state === true ? M3K_TRUTH_TABLE[outputPin] : null);
  if (!rule) {
    return;
  }
  console.log(
    `[VIRTUAL IO] Output ${outputPin} (${state ? "ON" : "OFF"}). Simulating ${rule.description} with ${rule.delayMs} ms delay\u2026`
  );
  const id = setTimeout(() => {
    _pendingHandshakes.delete(id);
    ioState.inputs.set(rule.targetInput, rule.setState);
    console.log(`[VIRTUAL IO] Input ${rule.targetInput} \u2192 ${rule.setState} (handshake complete)`);
    _dispatchIoChange(rule.targetInput, rule.setState);
    if (rule.sideEffects) {
      for (const fx of rule.sideEffects) {
        ioState.inputs.set(fx.pin, fx.state);
        console.log(`[VIRTUAL IO] Side-effect: input ${fx.pin} \u2192 ${fx.state}`);
        _dispatchIoChange(fx.pin, fx.state);
      }
    }
  }, rule.delayMs);
  _pendingHandshakes.add(id);
}
function triggerProbeCollision() {
  const pin = "IN_PROBE_COLLISION";
  ioState.inputs.set(pin, true);
  console.log(`[VIRTUAL IO] Probe collision detected \u2014 alarm ${pin} asserted`);
  _dispatchIoChange(pin, true);
}
function _dispatchIoChange(pin, state) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent("io_change", {
        detail: { pin, state },
        bubbles: false,
        cancelable: false
      })
    );
  }
}
var ioState, HARDWARE_PIN_MAP, M3K_TRUTH_TABLE, _pendingHandshakes;
var init_virtualIO = __esm({
  "../DDCS-Studio/web/engine/virtualIO.js"() {
    ioState = {
      /** Digital outputs — things the controller commands (e.g. solenoids, relays) */
      outputs: /* @__PURE__ */ new Map(),
      /** Digital inputs — sensor feedback lines (e.g. limit switches, proximity sensors) */
      inputs: /* @__PURE__ */ new Map()
    };
    HARDWARE_PIN_MAP = {
      OUT_4: "OUT_SPINDLE_UNCLAMP",
      OUT_5: "OUT_SPINDLE_CLAMP",
      IN_4: "IN_PROBE",
      // Standard probe input
      IN_5: "IN_DRAWBAR_CLOSED",
      // Clamp sensor (Wizard default)
      IN_6: "IN_DRAWBAR_OPEN"
      // Unclamp sensor
    };
    M3K_TRUTH_TABLE = {
      // -----------------------------------------------------------------------
      // ATC / Spindle clamp cycle
      // -----------------------------------------------------------------------
      /** Unclamp solenoid fires → drawbar open sensor confirms */
      OUT_SPINDLE_UNCLAMP: {
        targetInput: "IN_DRAWBAR_OPEN",
        delayMs: 450,
        // [HYPOTHESIS] pneumatic travel time ~450 ms
        setState: true,
        description: "Spindle unclamp solenoid \u2192 drawbar-open proximity sensor",
        sideEffects: [
          { pin: "IN_DRAWBAR_CLOSED", state: false }
        ]
      },
      /** Unclamp solenoid turns off (single acting) → drawbar closed sensor confirms */
      OUT_SPINDLE_UNCLAMP_OFF: {
        targetInput: "IN_DRAWBAR_CLOSED",
        delayMs: 400,
        // [HYPOTHESIS] pneumatic travel time
        setState: true,
        description: "Spindle unclamp solenoid OFF \u2192 drawbar-closed proximity sensor",
        sideEffects: [
          { pin: "IN_DRAWBAR_OPEN", state: false }
        ]
      },
      /** Clamp solenoid fires → drawbar closed sensor confirms */
      OUT_SPINDLE_CLAMP: {
        targetInput: "IN_DRAWBAR_CLOSED",
        delayMs: 400,
        // [HYPOTHESIS]
        setState: true,
        description: "Spindle clamp solenoid \u2192 drawbar-closed proximity sensor",
        // Side effect: clamp also de-asserts the open sensor
        sideEffects: [
          { pin: "IN_DRAWBAR_OPEN", state: false }
        ]
      },
      // -----------------------------------------------------------------------
      // ATC magazine carousel
      // -----------------------------------------------------------------------
      /** Carousel advance command → carousel-at-position sensor */
      OUT_CAROUSEL_ADVANCE: {
        targetInput: "IN_CAROUSEL_AT_POS",
        delayMs: 600,
        // [HYPOTHESIS] motor + decel time
        setState: true,
        description: "Carousel advance \u2192 carousel-at-position proximity sensor"
      },
      /** Carousel retract (home) */
      OUT_CAROUSEL_RETRACT: {
        targetInput: "IN_CAROUSEL_AT_HOME",
        delayMs: 600,
        // [HYPOTHESIS]
        setState: true,
        description: "Carousel retract \u2192 carousel-at-home proximity sensor"
      },
      // -----------------------------------------------------------------------
      // DDCS native ATC dialect (M154/M155 drawbar · M300/M302-304 sensors · M305/306 cover)
      // Ports for these are CONFIGURED ON THE CONTROLLER (params #1120-#1199, #1250-52),
      // so the sim models them as semantic pins, not numbered ones.
      // -----------------------------------------------------------------------
      /** M154 — tool release output ON → collet opens */
      OUT_TOOL_RELEASE: {
        targetInput: "IN_TOOL_OPEN",
        // M303 waits on this
        delayMs: 450,
        setState: true,
        description: "M154 tool release \u2192 tool-open sensor",
        sideEffects: [
          { pin: "IN_TOOL_LOCKED", state: false },
          { pin: "IN_TOOL_CLOSED", state: false }
        ]
      },
      /** M155 — tool release output OFF (lock) → collet clamps */
      OUT_TOOL_RELEASE_OFF: {
        targetInput: "IN_TOOL_LOCKED",
        // M302 waits on this
        delayMs: 400,
        setState: true,
        description: "M155 tool lock \u2192 tool-locked sensor",
        sideEffects: [
          { pin: "IN_TOOL_OPEN", state: false },
          { pin: "IN_TOOL_CLOSED", state: true }
          // M304 waits on this
        ]
      },
      /** M305 — dust cover open */
      OUT_DUST_COVER: {
        targetInput: "IN_DUST_COVER_OPEN",
        delayMs: 600,
        setState: true,
        description: "M305 dust cover open \u2192 cover sensor"
      },
      /** M306 — dust cover close */
      OUT_DUST_COVER_OFF: {
        targetInput: "IN_DUST_COVER_OPEN",
        delayMs: 600,
        setState: false,
        description: "M306 dust cover close \u2192 cover sensor releases"
      },
      /** M3/M4 — spindle running → "stopped" sensor drops */
      OUT_SPINDLE: {
        targetInput: "IN_SPINDLE_STOPPED",
        delayMs: 100,
        setState: false,
        description: "Spindle start \u2192 spindle-stopped sensor clears"
      },
      /** M5 — spindle off → spins down, then the stopped sensor confirms (M300 waits on it) */
      OUT_SPINDLE_OFF: {
        targetInput: "IN_SPINDLE_STOPPED",
        delayMs: 800,
        setState: true,
        description: "Spindle stop \u2192 spindle-stopped sensor (spin-down)"
      },
      // -----------------------------------------------------------------------
      // Air blast / coolant
      // -----------------------------------------------------------------------
      /** Air-blast valve open → pressure-present sensor (near-instant) */
      OUT_AIR_BLAST: {
        targetInput: "IN_AIR_PRESSURE_OK",
        delayMs: 80,
        // [HYPOTHESIS] valve open time
        setState: true,
        description: "Air-blast valve \u2192 air-pressure-present sensor"
      },
      // -----------------------------------------------------------------------
      // Probe collision detection
      // -----------------------------------------------------------------------
      /** Probe attempted to exceed stock bounds → collision alarm flags (no delay) */
      PROBE_COLLISION: {
        targetInput: "IN_PROBE_COLLISION",
        delayMs: 0,
        // Immediate — no physical travel
        setState: true,
        description: "Probe hit stock boundary \u2192 collision alarm"
      }
    };
    _pendingHandshakes = /* @__PURE__ */ new Set();
    if (typeof window !== "undefined") {
      window.virtualIO = {
        setOutput: setVirtualOutput,
        getInput: getVirtualInput,
        injectInput: injectVirtualInput,
        reset: resetVirtualIO,
        dumpState() {
          console.group("[VIRTUAL IO] Current state");
          console.log("Outputs:", Object.fromEntries(ioState.outputs));
          console.log("Inputs: ", Object.fromEntries(ioState.inputs));
          console.groupEnd();
        },
        truthTable: M3K_TRUTH_TABLE
      };
    }
  }
});

// ../DDCS-Studio/web/engine/core/tokenizer.js
function tokenizeWords(line2) {
  const words = [];
  let i = 0;
  const n = line2.length;
  const isLetter = (c2) => c2 >= "A" && c2 <= "Z" || c2 >= "a" && c2 <= "z";
  while (i < n) {
    const ch = line2[i];
    if (isLetter(ch)) {
      const letter = ch.toUpperCase();
      i += 1;
      let value = "";
      while (i < n && !isLetter(line2[i])) {
        value += line2[i];
        i += 1;
      }
      words.push({ letter, value: value.trim() });
    } else {
      i += 1;
    }
  }
  return words;
}
var init_tokenizer = __esm({
  "../DDCS-Studio/web/engine/core/tokenizer.js"() {
  }
});

// ../DDCS-Studio/web/engine/core/expression.js
function lex(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c2 = s[i];
    if (c2 === " " || c2 === "	") {
      i += 1;
      continue;
    }
    if (c2 >= "0" && c2 <= "9" || c2 === ".") {
      let num11 = "";
      while (i < s.length && (s[i] >= "0" && s[i] <= "9" || s[i] === ".")) {
        num11 += s[i];
        i += 1;
      }
      if (num11 === "." || num11.length === 0) return null;
      toks.push(Number.parseFloat(num11));
      continue;
    }
    if (c2 === "#" || c2 === "[" || c2 === "]" || c2 === "+" || c2 === "-" || c2 === "*" || c2 === "/") {
      toks.push(c2);
      i += 1;
      continue;
    }
    if (c2 >= "A" && c2 <= "Z" || c2 >= "a" && c2 <= "z") {
      let name = "";
      while (i < s.length && /[A-Za-z]/.test(s[i])) {
        name += s[i];
        i += 1;
      }
      toks.push({ fn: name.toUpperCase() });
      continue;
    }
    return null;
  }
  return toks;
}
function evalExpr2(str, vars, opts = {}) {
  const unsetValue = opts.unsetValue === void 0 ? null : opts.unsetValue;
  if (str == null) return null;
  const s = String(str).trim();
  if (s === "") return null;
  const toks = lex(s);
  if (toks === null) return null;
  let p = 0;
  const peek = () => toks[p];
  function parseExpr() {
    let v6 = parseTerm();
    while (v6 !== null && (peek() === "+" || peek() === "-")) {
      const op = toks[p++];
      const r = parseTerm();
      if (r === null) return null;
      v6 = op === "+" ? v6 + r : v6 - r;
    }
    return v6;
  }
  function parseTerm() {
    let v6 = parseFactor();
    while (v6 !== null && (peek() === "*" || peek() === "/")) {
      const op = toks[p++];
      const r = parseFactor();
      if (r === null) return null;
      v6 = op === "*" ? v6 * r : r !== 0 ? v6 / r : null;
    }
    return v6;
  }
  function parseFactor() {
    const t = peek();
    if (t === "+") {
      p += 1;
      return parseFactor();
    }
    if (t === "-") {
      p += 1;
      const f = parseFactor();
      return f === null ? null : -f;
    }
    if (t === "[") {
      p += 1;
      const v6 = parseExpr();
      if (peek() === "]") p += 1;
      return v6;
    }
    if (t && typeof t === "object" && t.fn) {
      const fn = MACRO_FUNCTIONS[t.fn];
      if (!fn) return null;
      p += 1;
      if (peek() !== "[") return null;
      p += 1;
      const arg = parseExpr();
      if (peek() === "]") p += 1;
      if (arg === null) return null;
      return fn(arg);
    }
    if (t === "#") {
      p += 1;
      let idx;
      if (peek() === "[") {
        p += 1;
        idx = parseExpr();
        if (peek() === "]") p += 1;
      } else if (typeof peek() === "number") {
        idx = toks[p++];
      } else {
        return null;
      }
      if (idx == null || !Number.isFinite(idx)) return null;
      const v6 = vars.get(Math.round(idx));
      return v6 === void 0 || v6 === null ? unsetValue : v6;
    }
    if (typeof t === "number") {
      p += 1;
      return t;
    }
    return null;
  }
  return parseExpr();
}
function validateExpression(str) {
  if (str == null) return false;
  const s = String(str).trim();
  if (s === "") return false;
  const dummy = { get: () => 1 };
  return evalExpr2(s, dummy, { unsetValue: 1 }) !== null;
}
var MACRO_FUNCTIONS;
var init_expression = __esm({
  "../DDCS-Studio/web/engine/core/expression.js"() {
    MACRO_FUNCTIONS = {
      ABS: Math.abs,
      SQRT: Math.sqrt,
      ROUND: Math.round,
      FIX: Math.floor,
      FUP: Math.ceil,
      LN: Math.log,
      EXP: Math.exp,
      SIN: (d) => Math.sin(d * Math.PI / 180),
      COS: (d) => Math.cos(d * Math.PI / 180),
      TAN: (d) => Math.tan(d * Math.PI / 180),
      ASIN: (v6) => Math.asin(v6) * 180 / Math.PI,
      ACOS: (v6) => Math.acos(v6) * 180 / Math.PI,
      ATAN: (v6) => Math.atan(v6) * 180 / Math.PI
    };
  }
});

// ../DDCS-Studio/web/engine/core/condition.js
function normalizeCondition(expr) {
  if (expr == null) return "";
  return String(expr).trim().replace(/\bEQ\b/gi, "==").replace(/\bNE\b/gi, "!=").replace(/\bGT\b/gi, ">").replace(/\bLT\b/gi, "<").replace(/\bGE\b/gi, ">=").replace(/\bLE\b/gi, "<=").replace(/\b<>\b/g, "!=").replace(/(?<![<>!=])=(?![<>!=])/g, "==");
}
function evaluateCondition(expr, vars, opts = {}) {
  const normalized = normalizeCondition(expr);
  const match = normalized.match(COMPARATOR_RE);
  if (!match) return false;
  const left = evalExpr2(match[1].trim(), vars, opts);
  const op = match[2];
  const right = evalExpr2(match[3].trim(), vars, opts);
  if (left == null || right == null) return false;
  switch (op) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    default:
      return false;
  }
}
function validateCondition(expr) {
  if (expr == null) return false;
  const normalized = normalizeCondition(expr);
  const match = normalized.match(COMPARATOR_RE);
  if (!match) return false;
  return validateExpression(match[1].trim()) && validateExpression(match[3].trim());
}
var COMPARATOR_RE;
var init_condition = __esm({
  "../DDCS-Studio/web/engine/core/condition.js"() {
    init_expression();
    COMPARATOR_RE = /^(.*?)(==|!=|<=|>=|<|>)(.*)$/;
  }
});

// ../DDCS-Studio/web/engine/core/program.js
function stripLine(raw2) {
  let s = String(raw2), prev;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, " ");
  } while (s !== prev);
  return s.replace(/;.*$/, " ").trim();
}
function loadProgram(text, opts = {}) {
  const { keepEmpty = false, repositionMarkers = false } = opts;
  const lines = String(text || "").split(/\r?\n/);
  const program = [];
  const labels = /* @__PURE__ */ new Map();
  lines.forEach((raw2, lineIndex) => {
    if (repositionMarkers && /reposition:/i.test(raw2)) {
      program.push({ type: "reposition", raw: raw2, lineIndex });
      return;
    }
    const stripped = stripLine(raw2);
    if (!stripped && !keepEmpty) return;
    const tokens = tokenizeWords(stripped);
    const labelToken = tokens.find((t) => t.letter === "N" && t.value != null);
    const label = labelToken ? Number.parseInt(labelToken.value, 10) : null;
    if (label != null && Number.isFinite(label)) {
      labels.set(label, program.length);
    }
    program.push({ raw: raw2, stripped, tokens, label, lineIndex });
  });
  return { program, labels, totalLines: lines.length };
}
var init_program2 = __esm({
  "../DDCS-Studio/web/engine/core/program.js"() {
    init_tokenizer();
  }
});

// ../DDCS-Studio/web/engine/core/arc.js
function arcPoints(start, end, off, motion, plane, scale = 1) {
  let a, b2, lin;
  if (plane === 18) {
    a = "x";
    b2 = "z";
    lin = "y";
  } else if (plane === 19) {
    a = "y";
    b2 = "z";
    lin = "x";
  } else {
    a = "x";
    b2 = "y";
    lin = "z";
  }
  const sa = start[a], sb = start[b2], ea = end[a], eb = end[b2];
  const sLin = start[lin], eLin = end[lin];
  const offFor = (axis) => axis === "x" ? off.I : axis === "y" ? off.J : off.K;
  let cx, cy;
  if (offFor(a) != null || offFor(b2) != null) {
    cx = sa + (offFor(a) || 0) * scale;
    cy = sb + (offFor(b2) || 0) * scale;
  } else if (off.R != null) {
    const R = off.R * scale;
    const mx = (sa + ea) / 2, my = (sb + eb) / 2;
    const dx = ea - sa, dy = eb - sb;
    const d = Math.hypot(dx, dy);
    if (d === 0 || Math.abs(R) < d / 2 - 1e-6) return [start, end];
    const h = Math.sqrt(Math.max(0, R * R - d * d / 4));
    const ux = -dy / d, uy = dx / d;
    const sign = (motion === 2 ? -1 : 1) * (R >= 0 ? 1 : -1);
    cx = mx + sign * h * ux;
    cy = my + sign * h * uy;
  } else {
    return [start, end];
  }
  const r = Math.hypot(sa - cx, sb - cy);
  let a0 = Math.atan2(sb - cy, sa - cx);
  let a1 = Math.atan2(eb - cy, ea - cx);
  if (motion === 3) {
    if (a1 <= a0) a1 += Math.PI * 2;
  } else {
    if (a1 >= a0) a1 -= Math.PI * 2;
  }
  let sweep = a1 - a0;
  if (Math.abs(sweep) < 1e-9) sweep = (motion === 3 ? 1 : -1) * Math.PI * 2;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = a0 + sweep * t;
    const p = { x: 0, y: 0, z: 0 };
    p[a] = cx + r * Math.cos(ang);
    p[b2] = cy + r * Math.sin(ang);
    p[lin] = sLin + (eLin - sLin) * t;
    pts.push(p);
  }
  return pts;
}
var init_arc2 = __esm({
  "../DDCS-Studio/web/engine/core/arc.js"() {
  }
});

// ../DDCS-Studio/web/engine/GcodeExecutionEngine.js
var GcodeExecutionEngine;
var init_GcodeExecutionEngine = __esm({
  "../DDCS-Studio/web/engine/GcodeExecutionEngine.js"() {
    init_virtualIO();
    init_tokenizer();
    init_expression();
    init_condition();
    init_program2();
    init_arc2();
    GcodeExecutionEngine = class _GcodeExecutionEngine {
      constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, onWait = null, stock = null, stockOffset = null, wcsOffset = null, syntaxValidator = null, createVarStore = null, autoAnswer = true, autoAnswerMs = 800, simSpeed = 1, rapidRate = 6e3 } = {}) {
        this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
        this.simSpeed = Number.isFinite(simSpeed) && simSpeed > 0 ? simSpeed : 1;
        this.rapidRate = Number.isFinite(rapidRate) && rapidRate > 0 ? rapidRate : 6e3;
        this.createVarStore = typeof createVarStore === "function" ? createVarStore : () => /* @__PURE__ */ new Map();
        this.onLineChange = onLineChange;
        this.onStatus = onStatus;
        this.onFinish = onFinish;
        this.onPositionChange = onPositionChange;
        this.onWait = onWait;
        this.stock = stock || null;
        this._stockOffset = stockOffset || { x: 0, y: 0, z: 0 };
        this._wcsOffset = wcsOffset || { x: 0, y: 0, z: 0 };
        this.syntaxValidator = typeof syntaxValidator === "function" ? syntaxValidator : null;
        this.autoAnswer = autoAnswer !== false;
        this.autoAnswerMs = Number.isFinite(autoAnswerMs) ? autoAnswerMs : 800;
        this._autoTimers = /* @__PURE__ */ new Map();
        this.resetState();
      }
      verifySyntax(text) {
        if (this.syntaxValidator) {
          return this.syntaxValidator(text);
        }
        return _GcodeExecutionEngine.defaultSyntaxVerify(text);
      }
      static defaultSyntaxVerify(text) {
        const errors = [];
        const lines = String(text || "").split(/\r?\n/);
        const reportError = (lineIndex, message) => {
          errors.push({ lineIndex, line: lines[lineIndex], message });
        };
        lines.forEach((raw2, lineIndex) => {
          const trimmedRaw = raw2.trim();
          const stripped = stripLine(raw2);
          if (!stripped) return;
          const ifMatch = stripped.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
          if (ifMatch) {
            const condition = ifMatch[1].trim();
            if (!condition) {
              reportError(lineIndex, "Empty IF condition");
            } else if (!validateCondition(condition)) {
              reportError(lineIndex, "Invalid IF condition syntax");
            }
            return;
          }
          const gotoMatch = stripped.match(/^GOTO\s*(\d+)$/i);
          if (gotoMatch) {
            return;
          }
          if (/^(M30|M02|M2|M99)\b/i.test(stripped)) {
            return;
          }
          if (/^#/.test(stripped)) {
            const assignMatch = stripped.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
            if (!assignMatch) {
              reportError(lineIndex, "Invalid macro assignment");
              return;
            }
            const lhs = assignMatch[1].trim();
            const rhs = assignMatch[2].trim();
            const indexExpr = lhs.startsWith("[") ? lhs.slice(1, -1) : lhs;
            if (!validateExpression(indexExpr)) {
              reportError(lineIndex, "Invalid assignment target");
            }
            if (!validateExpression(rhs)) {
              reportError(lineIndex, "Invalid assignment expression");
            }
            return;
          }
          const words = tokenizeWords(stripped);
          if (words.length === 0) {
            reportError(lineIndex, "Unrecognizable G-code line");
            return;
          }
          for (const word2 of words) {
            if (word2.letter === "G") {
              const value = Number.parseFloat(word2.value);
              if (!Number.isFinite(value)) {
                reportError(lineIndex, `Invalid G-code word value: ${word2.value}`);
              }
            } else if (word2.letter !== "N") {
              if (!validateExpression(word2.value)) {
                reportError(lineIndex, `Invalid expression for ${word2.letter}`);
              }
            }
          }
        });
        return { valid: errors.length === 0, errors };
      }
      resetState() {
        resetVirtualIO();
        this._clearAutoTimers();
        this.vars = this.createVarStore();
        this.pos = { x: 0, y: 0, z: 0 };
        this.absolute = true;
        this.unitScale = 1;
        this.motion = 0;
        this.feedVal = 0;
        this.plane = 17;
        this.program = [];
        this.labels = /* @__PURE__ */ new Map();
        this.ip = 0;
        this.currentLineIndex = null;
        this.running = false;
        this.paused = false;
        this._waitPin = null;
        this._move = null;
        this._probeArmed = false;
        this._traceSink = null;
        this.timer = null;
        this.stats = {
          feed: 0,
          rapid: 0,
          probe: 0,
          skipped: 0,
          steps: 0
        };
        this.totalLines = 0;
        this._started = false;
      }
      loadProgram(text) {
        const { program, labels, totalLines } = loadProgram(text, { keepEmpty: true });
        this.program = program;
        this.labels = labels;
        this.totalLines = totalLines;
      }
      run(text) {
        this.stop();
        this.resetState();
        this.loadProgram(text);
        if (this.program.length === 0) {
          this._setStatus("No program loaded", false);
          this._finish();
          return;
        }
        this.running = true;
        this._setStatus("Starting execution", true);
        this._scheduleTick();
      }
      /**
       * Synchronous "trace" pass — run the whole program to completion (probes auto-detect, input waits
       * auto-clear, no delays) and return the EXACT path the engine takes: { segments, bounds, stats }.
       * The preview's drawn route comes from this, so it can never disagree with the played tool — both go
       * through _executeStep with the same vars + control flow. Arcs are linearized; loops that never resolve
       * are bounded by a step cap (stats.capped). Leaves the engine reset (ready for a subsequent run()).
       */
      trace(text) {
        this.stop();
        this.resetState();
        this.loadProgram(text);
        const cb = { line: this.onLineChange, pos: this.onPositionChange, status: this.onStatus, wait: this.onWait };
        this.onLineChange = null;
        this.onPositionChange = null;
        this.onStatus = null;
        this.onWait = null;
        const sink = [];
        this._traceSink = sink;
        this.running = true;
        const cap = Math.max(this.program.length * 50, 5e3);
        let guard = 0;
        try {
          while (this.ip >= 0 && this.ip < this.program.length && guard++ < cap) {
            const done = this._executeStep(this.program[this.ip]);
            if (done) break;
          }
        } finally {
          this.running = false;
          this._traceSink = null;
          this.onLineChange = cb.line;
          this.onPositionChange = cb.pos;
          this.onStatus = cb.status;
          this.onWait = cb.wait;
        }
        return this._buildTraceResult(sink, guard >= cap);
      }
      _buildTraceResult(segments, capped) {
        const b2 = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
        let feed = 0, rapid = 0, probe = 0;
        for (const s of segments) {
          b2.minX = Math.min(b2.minX, s.x1, s.x2);
          b2.maxX = Math.max(b2.maxX, s.x1, s.x2);
          b2.minY = Math.min(b2.minY, s.y1, s.y2);
          b2.maxY = Math.max(b2.maxY, s.y1, s.y2);
          b2.minZ = Math.min(b2.minZ, s.z1, s.z2);
          b2.maxZ = Math.max(b2.maxZ, s.z1, s.z2);
          if (s.probe) probe += 1;
          else if (s.rapid) rapid += 1;
          else feed += 1;
        }
        return {
          segments,
          bounds: segments.length ? b2 : null,
          stats: { feed, rapid, probe, retract: 0, passes: 1, skipped: this.stats.skipped, drawable: segments.length > 0, capped: !!capped }
        };
      }
      stop() {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this._clearAutoTimers();
        this.running = false;
        this.paused = false;
        this._move = null;
        this._setWaitPin(null);
        this._setStatus("Execution stopped", false);
      }
      // Execute exactly one step. Starts (paused) from the top if no run is in
      // progress; pauses a continuous run in place otherwise. A move in flight
      // completes instantly — one step = one whole line.
      step(text) {
        if (!this.running) {
          this.resetState();
          this.loadProgram(text);
          if (this.program.length === 0) {
            this._setStatus("No program loaded", false);
            this._finish();
            return;
          }
          this.running = true;
        }
        this.paused = true;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this._move) {
          this._finishMove();
          return;
        }
        this._tick();
      }
      // Resume continuous execution after a pause/step.
      resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        if (this._move) this._move.last = null;
        this._setStatus("Resuming execution", true);
        this._scheduleTick();
      }
      pause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this._move) this._move.last = null;
        this._setStatus("Paused", true);
      }
      _scheduleTick() {
        if (!this.running || this.paused) return;
        this.timer = setTimeout(() => this._tick(), this._nextDelayMs != null ? this._nextDelayMs : this.stepDelay);
      }
      _tick() {
        if (!this.running) return;
        this._nextDelayMs = 8;
        if (this._move) {
          this._advanceMove();
          if (this.running && !this.paused) this._scheduleTick();
          return;
        }
        if (this.ip >= this.program.length) {
          this._finish();
          return;
        }
        const step = this.program[this.ip];
        this._setCurrentLine(step.lineIndex);
        const done = this._executeStep(step);
        if (done) {
          this._finish();
          return;
        }
        if (this.running && !this.paused) {
          this._scheduleTick();
        }
      }
      _setCurrentLine(lineIndex) {
        if (this.currentLineIndex !== lineIndex) {
          this.currentLineIndex = lineIndex;
          if (typeof this.onLineChange === "function") {
            this.onLineChange({ lineIndex, ip: this.ip, raw: this.program[this.ip].raw });
          }
        }
        this._setStatus(`Running line ${lineIndex + 1}/${this.totalLines}`, true);
      }
      _setStatus(message, running = this.running) {
        if (typeof this.onStatus === "function") {
          this.onStatus({ message, running, stats: { ...this.stats } });
        }
      }
      _finish() {
        this.running = false;
        this.paused = false;
        this._move = null;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        this._clearAutoTimers();
        this._setWaitPin(null);
        this._setStatus("Execution complete", false);
        if (typeof this.onFinish === "function") {
          this.onFinish({ stats: { ...this.stats } });
        }
      }
      // Advance the in-flight timed move by the wall-clock elapsed since the last tick,
      // scaled by simSpeed (changing speed mid-move takes effect immediately).
      _advanceMove() {
        const mv = this._move;
        if (!mv) return;
        const now = Date.now();
        const dt = mv.last == null ? 0 : Math.min(250, now - mv.last);
        mv.last = now;
        mv.elapsed += dt * (this.simSpeed > 0 ? this.simSpeed : 1);
        const t = mv.durMs > 0 ? Math.min(1, mv.elapsed / mv.durMs) : 1;
        if (t >= 1) {
          this._finishMove();
          return;
        }
        if (typeof this.onPositionChange === "function") {
          this.onPositionChange({
            x: mv.from.x + (mv.to.x - mv.from.x) * t,
            y: mv.from.y + (mv.to.y - mv.from.y) * t,
            z: mv.from.z + (mv.to.z - mv.from.z) * t
          });
        }
        this._nextDelayMs = 16;
      }
      // Land the in-flight move: snap to the target, fire any deferred probe touch.
      _finishMove() {
        const mv = this._move;
        if (!mv) return;
        this._move = null;
        this.pos = { ...mv.to };
        if (typeof this.onPositionChange === "function") {
          this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
        }
        if (mv.touchName) this._touchPulse(mv.touchName);
      }
      // Pulse a probe input ON briefly so the I/O panel shows the touch.
      _touchPulse(pinName) {
        injectVirtualInput(pinName, true);
        setTimeout(() => injectVirtualInput(pinName, false), 400);
      }
      // Slab ray/segment-vs-AABB. Returns the entry/exit params along A→B (0..1 spans the move).
      // Identical to gcodeViz3d._boxRange so the engine's probe collision matches what the 3D view draws.
      _rayBox(A, B, min, max) {
        const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
        let tEnter = -Infinity, tExit = Infinity;
        for (const ax of ["x", "y", "z"]) {
          if (Math.abs(d[ax]) < 1e-9) {
            if (A[ax] < min[ax] - 1e-6 || A[ax] > max[ax] + 1e-6) return { hit: false };
          } else {
            let t1 = (min[ax] - A[ax]) / d[ax], t2 = (max[ax] - A[ax]) / d[ax];
            if (t1 > t2) {
              const t = t1;
              t1 = t2;
              t2 = t;
            }
            if (t1 > tEnter) tEnter = t1;
            if (t2 < tExit) tExit = t2;
          }
        }
        return { hit: tEnter <= tExit, tEnter, tExit };
      }
      // Track the input pin execution is parked on (null = not waiting) and notify the UI.
      _setWaitPin(wait) {
        const prev = this._waitPin;
        if (!prev && !wait) return;
        if (prev && wait && prev.pinName === wait.pinName && prev.target === wait.target) return;
        this._waitPin = wait;
        if (typeof this.onWait === "function") this.onWait(wait);
      }
      // Virtual sensor: answer a waited input after autoAnswerMs unless something else
      // (the truth table, or a manual click) already satisfied it. One timer per pin.
      _scheduleAutoAnswer(pinName, targetState) {
        if (this._autoTimers.has(pinName)) return;
        const id = setTimeout(() => {
          this._autoTimers.delete(pinName);
          if (!this.running) return;
          if (getVirtualInput(pinName) === targetState) return;
          injectVirtualInput(pinName, targetState);
          this._setStatus(`${pinName} auto-answered (virtual sensor)`, true);
        }, this.autoAnswerMs);
        this._autoTimers.set(pinName, id);
      }
      _clearAutoTimers() {
        if (!this._autoTimers) return;
        for (const id of this._autoTimers.values()) clearTimeout(id);
        this._autoTimers.clear();
      }
      _executeStep(step) {
        const line2 = step.stripped;
        this.stats.steps += 1;
        if (!line2) {
          this.ip += 1;
          return false;
        }
        if (/^\s*[();]/.test(step.raw.trim())) {
          this.ip += 1;
          return false;
        }
        const ifMatch = line2.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
        if (ifMatch) {
          const conditionText = ifMatch[1].trim().replace(/^\[|\]$/g, "");
          const targetLabel = Number.parseInt(ifMatch[2], 10);
          if (this._evaluateCondition(conditionText) && this.labels.has(targetLabel)) {
            this.ip = this.labels.get(targetLabel);
            return false;
          }
          this.ip += 1;
          return false;
        }
        const gotoMatch = line2.match(/^GOTO\s*(\d+)$/i);
        if (gotoMatch) {
          const targetLabel = Number.parseInt(gotoMatch[1], 10);
          if (this.labels.has(targetLabel)) {
            this.ip = this.labels.get(targetLabel);
            return false;
          }
          this.ip += 1;
          return false;
        }
        if (/^(M30|M02|M2|M99)\b/i.test(line2)) {
          return true;
        }
        if (this._handleModbus(line2)) {
          this.ip += 1;
          return false;
        }
        if (/^#/.test(line2)) {
          this._handleAssignment(line2);
          this.ip += 1;
          return false;
        }
        const words = tokenizeWords(line2);
        if (words.length === 0) {
          this.ip += 1;
          return false;
        }
        if (words.every((w2) => w2.letter === "N")) {
          this.ip += 1;
          return false;
        }
        const wm = {};
        const gcodes = [];
        const mcodes = [];
        for (const word2 of words) {
          if (word2.letter === "G") {
            const value = Number.parseFloat(word2.value);
            if (Number.isFinite(value)) gcodes.push(value);
          } else if (word2.letter === "M") {
            const value = Number.parseFloat(word2.value);
            if (Number.isFinite(value)) mcodes.push(value);
          } else if (word2.letter !== "N") {
            wm[word2.letter] = this._evaluateExpression(word2.value);
          }
        }
        const waitForInput = (m, pin, pinName, target2) => {
          if (getVirtualInput(pinName) === target2) {
            this._setStatus(`M${m} ${pinName} is ${target2 ? "ON" : "OFF"} (cleared)`, true);
            return false;
          }
          if (this._traceSink) {
            injectVirtualInput(pinName, target2);
            return false;
          }
          this._setStatus(`M${m} waiting for ${pinName} to be ${target2 ? "ON" : "OFF"}...`, true);
          this._setWaitPin({ pin, pinName, target: target2 });
          if (this.autoAnswer) this._scheduleAutoAnswer(pinName, target2);
          return true;
        };
        const ATC_WAITS = {
          300: ["IN_SPINDLE_STOPPED", true],
          // M300 wait spindle stopped
          302: ["IN_TOOL_LOCKED", true],
          // M302 wait tool locked
          303: ["IN_TOOL_OPEN", true],
          // M303 wait tool open (collet released)
          304: ["IN_TOOL_CLOSED", true]
          // M304 wait tool closed
        };
        let waiting = false;
        for (const m of mcodes) {
          if (m === 6) {
            if (wm.T != null && Number.isFinite(wm.T)) {
              this.vars.set(1504, Math.round(wm.T));
              this.vars.set(1300, Math.round(wm.T));
              this._setStatus(`M6 \u2192 target tool #1504 = ${Math.round(wm.T)}`, true);
            }
          } else if (m === 3 || m === 4) {
            setVirtualOutput("OUT_SPINDLE", true);
          } else if (m === 5) {
            setVirtualOutput("OUT_SPINDLE", false);
          } else if (m === 154 || m === 155) {
            setVirtualOutput("OUT_TOOL_RELEASE", m === 154);
            this._setStatus(`M${m} \u2192 drawbar ${m === 154 ? "RELEASE" : "LOCK"}`, true);
          } else if (m === 305 || m === 306) {
            setVirtualOutput("OUT_DUST_COVER", m === 305);
            this._setStatus(`M${m} \u2192 dust cover ${m === 305 ? "OPEN" : "CLOSE"}`, true);
          } else if (ATC_WAITS[m]) {
            const [pinName, target2] = ATC_WAITS[m];
            if (waitForInput(m, null, pinName, target2)) waiting = true;
          } else if (m === 10 || m === 11) {
            if (wm.P != null) {
              const pinName = resolveVirtualPin(wm.P, "OUT");
              setVirtualOutput(pinName, m === 10);
              this._setStatus(`M${m} \u2192 ${pinName} = ${m === 10 ? "ON" : "OFF"}`, true);
            }
          } else if (m === 31 || m === 33) {
            if (wm.P != null) {
              if (waitForInput(m, wm.P, resolveVirtualPin(wm.P, "IN"), m === 31)) waiting = true;
            }
          } else if (m === 101 || m === 102) {
            this._probeArmed = m === 101;
          }
        }
        if (waiting) {
          this._nextDelayMs = 50;
          return false;
        }
        this._setWaitPin(null);
        if (gcodes.includes(4) && wm.P != null && Number.isFinite(wm.P) && wm.P > 0) {
          const ms = wm.P / (this.simSpeed > 0 ? this.simSpeed : 1);
          this._nextDelayMs = Math.max(8, Math.min(1e4, ms));
          this._setStatus(`G4 dwell ${wm.P} ms`, true);
          this.ip += 1;
          return false;
        }
        for (const g of gcodes) {
          if (g === 20) this.unitScale = 25.4;
          else if (g === 21) this.unitScale = 1;
          else if (g === 90) this.absolute = true;
          else if (g === 91) this.absolute = false;
          else if (g === 17) this.plane = 17;
          else if (g === 18) this.plane = 18;
          else if (g === 19) this.plane = 19;
          else if ([0, 1, 2, 3].includes(g)) this.motion = g;
        }
        if (wm.F != null && Number.isFinite(wm.F)) {
          this.feedVal = wm.F;
        }
        const hasAxis = wm.X != null || wm.Y != null || wm.Z != null;
        const hasArcArg = wm.I != null || wm.J != null || wm.K != null || wm.R != null;
        if (!hasAxis && !hasArcArg) {
          this.ip += 1;
          return false;
        }
        const g53 = gcodes.includes(53);
        const target = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
        let bad = false;
        const setAxis = (key, field3) => {
          if (wm[key] == null) return;
          const value = wm[key];
          if (!Number.isFinite(value)) {
            bad = true;
            return;
          }
          target[field3] = g53 ? value * this.unitScale - (this._wcsOffset[field3] || 0) : this.absolute ? value * this.unitScale : this.pos[field3] + value * this.unitScale;
        };
        setAxis("X", "x");
        setAxis("Y", "y");
        setAxis("Z", "z");
        if (bad) {
          this.stats.skipped += 1;
          this.ip += 1;
          return false;
        }
        const isProbe = gcodes.includes(31) || this._probeArmed;
        const effMotion = isProbe ? 1 : this.motion;
        if (effMotion === 0 || effMotion === 1) {
          let touchName = null;
          if (isProbe) {
            this.stats.probe += 1;
            const PROBE_STATUS_VAR = { x: 1920, y: 1921, z: 1922 };
            const scannedAxes = [];
            if (wm.X != null) scannedAxes.push("x");
            if (wm.Y != null) scannedAxes.push("y");
            if (wm.Z != null) scannedAxes.push("z");
            for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 1);
            const probePort = wm.P;
            const probes = typeof window !== "undefined" && window.ddcsGetSettings ? window.ddcsGetSettings().probes : null;
            let boxMin = null;
            let boxMax = null;
            let cavMin = null, cavMax = null;
            if (probes && probePort === probes.setterPin) {
              boxMin = { x: probes.setterX - probes.setterW / 2, y: probes.setterY - probes.setterH / 2, z: probes.setterZ - 0.01 };
              boxMax = { x: probes.setterX + probes.setterW / 2, y: probes.setterY + probes.setterH / 2, z: probes.setterZ + 0.01 };
            } else if (this.stock && (this.stock.x > 0 || this.stock.y > 0 || this.stock.z > 0)) {
              boxMin = { x: 0, y: 0, z: -this.stock.z };
              boxMax = { x: this.stock.x, y: this.stock.y, z: 0 };
              if (this.stock.shape === "pocket") {
                const w2 = Math.max(8, Math.min(this.stock.x, this.stock.y) * 0.25);
                cavMin = { x: w2, y: w2, z: -this.stock.z };
                cavMax = { x: this.stock.x - w2, y: this.stock.y - w2, z: 0 };
              }
            }
            const O = this._stockOffset || { x: 0, y: 0, z: 0 };
            if (boxMin && boxMax) {
              const aStart = { x: O.x + this.pos.x, y: O.y + this.pos.y, z: O.z + this.pos.z };
              const bEnd = { x: O.x + target.x, y: O.y + target.y, z: O.z + target.z };
              const dir = { x: target.x - this.pos.x, y: target.y - this.pos.y, z: target.z - this.pos.z };
              let tt = null;
              const consider = (t) => {
                if (t != null && t > 1e-6 && t <= 1 && (tt == null || t < tt)) tt = t;
              };
              const ro = this._rayBox(aStart, bEnd, boxMin, boxMax);
              if (ro.hit) {
                if (ro.tEnter > 1e-6) consider(ro.tEnter);
                else if (ro.tExit > 1e-6 && ro.tExit <= 1) consider(ro.tExit);
              }
              if (cavMin && cavMax) {
                const rc = this._rayBox(aStart, bEnd, cavMin, cavMax);
                if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6) consider(rc.tExit);
              }
              if (tt != null) {
                target.x = this.pos.x + dir.x * tt;
                target.y = this.pos.y + dir.y * tt;
                target.z = this.pos.z + dir.z * tt;
                triggerProbeCollision();
                const touchPin = Number.isFinite(probePort) ? probePort : probes ? probes.probePin : null;
                if (touchPin != null && Number.isFinite(touchPin)) {
                  touchName = resolveVirtualPin(touchPin, "IN");
                }
                for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
                this.vars.set(1925, O.x + target.x);
                this.vars.set(1926, O.y + target.y);
                this.vars.set(1927, O.z + target.z);
              }
            }
            if (this._traceSink) {
              for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
              this.vars.set(1925, O.x + target.x);
              this.vars.set(1926, O.y + target.y);
              this.vars.set(1927, O.z + target.z);
            }
          } else if (effMotion === 0) {
            this.stats.feed += 1;
          }
          const rapid = effMotion === 0 && !isProbe;
          if (this._traceSink) {
            this._traceSink.push({
              x1: this.pos.x,
              y1: this.pos.y,
              z1: this.pos.z,
              x2: target.x,
              y2: target.y,
              z2: target.z,
              rapid,
              probe: isProbe,
              type: isProbe ? "probe" : rapid ? "rapid" : "feed",
              feed: this.feedVal,
              line: step.lineIndex
              // source line → lets the preview seek the tool to a clicked code line
            });
            this.pos = target;
            this.ip += 1;
            return false;
          }
          {
            const d = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
            const rate = rapid ? this.rapidRate : this.feedVal > 0 ? this.feedVal : 600;
            const realMs = rate > 0 ? d / rate * 6e4 : 0;
            const speed = this.simSpeed > 0 ? this.simSpeed : 1;
            if (realMs / speed > 50) {
              this._move = { from: { ...this.pos }, to: target, durMs: realMs, elapsed: 0, last: null, touchName };
              const kind = isProbe ? "G31 probe" : rapid ? "G0 rapid" : "G1 feed";
              this._setStatus(`${kind} ${d.toFixed(1)} mm at F${rate} \u2014 ${(realMs / 1e3).toFixed(1)} s${speed !== 1 ? ` @ ${speed}\xD7` : ""}`, true);
              this._nextDelayMs = 16;
              this.ip += 1;
              return false;
            }
            this._nextDelayMs = Math.max(12, realMs / speed);
            if (touchName) this._touchPulse(touchName);
          }
          this.pos = target;
          if (typeof this.onPositionChange === "function") {
            this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
          }
        } else if (this._traceSink) {
          const off = { I: wm.I, J: wm.J, K: wm.K, R: wm.R };
          const anyNull = ["I", "J", "K", "R"].some((k) => wm[k] != null && !Number.isFinite(wm[k]));
          if (anyNull) {
            this.stats.skipped += 1;
          } else {
            const pts = arcPoints(this.pos, target, off, effMotion, this.plane, this.unitScale);
            let prev = this.pos;
            for (let i = 1; i < pts.length; i++) {
              this._traceSink.push({
                x1: prev.x,
                y1: prev.y,
                z1: prev.z,
                x2: pts[i].x,
                y2: pts[i].y,
                z2: pts[i].z,
                rapid: false,
                probe: false,
                type: "feed",
                feed: this.feedVal,
                line: step.lineIndex
              });
              prev = pts[i];
            }
            this.pos = target;
          }
        } else {
          this.stats.skipped += 1;
        }
        this.ip += 1;
        return false;
      }
      // MSETDATA / MGETDATA — the real DDCS Expert Modbus channel (controllers/expert-m350/FINDINGS.md):
      // a 6-arg register transfer [X1 startVar, X2 slave#, X3 regAddr, X4 byteLen, X5 funcCode, X6 excVar].
      // MSETDATA pushes vars #X1..#(X1+X4-1) to the slave (one decimal byte each); MGETDATA pulls them back.
      // There is no real Modbus slave in the browser sim, so we TRACE the transfer (it is NOT a digital-output
      // command — that was the old, wrong interpretation) and set the exception var to 0 (OK).
      _handleModbus(line2) {
        const m = line2.match(/\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]/i);
        if (!m) return false;
        const op = m[1].toUpperCase();
        const args = m[2].split(",").map((a) => a.trim()).filter((a) => a !== "");
        if (args.length !== 6) {
          this._setStatus(`${op} needs 6 args [X1..X6], got ${args.length}`, true);
          return true;
        }
        const [startVar, slave, reg, byteLen, fn, excVar] = args.map((a) => this._evaluateExpression(a));
        if (op === "MSETDATA") {
          const bytes = [];
          if (Number.isFinite(startVar) && Number.isFinite(byteLen)) {
            for (let i = 0; i < byteLen; i++) bytes.push(this.vars.get(Math.round(startVar + i)) ?? 0);
          }
          if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);
          this._setStatus(`MSETDATA push -> slave ${slave} reg ${reg} fn ${fn}: [${bytes.join(",")}]`, true);
        } else {
          if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);
          this._setStatus(`MGETDATA pull <- slave ${slave} reg ${reg} fn ${fn} (no slave in sim; vars unchanged)`, true);
        }
        return true;
      }
      _handleAssignment(line2) {
        const assignMatch = line2.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
        if (!assignMatch) return;
        const lhs = assignMatch[1].trim();
        const rhs = assignMatch[2].trim();
        let idx = null;
        if (lhs.startsWith("[") && lhs.endsWith("]")) {
          idx = this._evaluateExpression(lhs.slice(1, -1));
        } else {
          idx = Number.parseInt(lhs, 10);
        }
        const value = this._evaluateExpression(rhs);
        if (idx != null && Number.isFinite(idx) && value != null) {
          this.vars.set(Math.round(idx), value);
        }
      }
      _evaluateCondition(expression) {
        return evaluateCondition(expression, this.vars, { unsetValue: 0 });
      }
      _evaluateExpression(str) {
        return evalExpr2(str, this.vars, { unsetValue: 0 });
      }
    };
  }
});

// ../DDCS-Studio/web/engine/trace.js
function traceToolpath(text, opts = {}) {
  const eng = new GcodeExecutionEngine({
    autoAnswer: true,
    // hands-free: virtual sensors/probes satisfy so loops terminate
    stock: opts.stock || null,
    stockOffset: opts.start || null,
    wcsOffset: opts.wcsOffset || null,
    // work origin in MACHINE coords → G53 moves draw in the part frame
    createVarStore: opts.createVarStore || null
  });
  return eng.trace(String(text || ""));
}
var init_trace = __esm({
  "../DDCS-Studio/web/engine/trace.js"() {
    init_GcodeExecutionEngine();
  }
});

// ../DDCS-Studio/web/viz/toolpath2d.js
function strokeSegs(ctx2, segs, from, to, tx, ty, style) {
  ctx2.globalAlpha = style.alpha;
  for (let i = from; i < to; i++) {
    const s = segs[i], t = typeOf(s);
    ctx2.strokeStyle = COL[t] || "#888";
    ctx2.lineWidth = t === "rapid" ? style.width * 0.6 : style.width;
    ctx2.setLineDash(t === "rapid" ? [4, 3] : []);
    ctx2.beginPath();
    ctx2.moveTo(tx(s.x1), ty(s.y1));
    ctx2.lineTo(tx(s.x2), ty(s.y2));
    ctx2.stroke();
  }
  ctx2.globalAlpha = 1;
  ctx2.setLineDash([]);
}
function drawToolpath2d(canvas, segs, k) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H3 = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H3 * dpr;
  const ctx2 = canvas.getContext("2d");
  ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2.clearRect(0, 0, W, H3);
  if (!segs.length) return;
  let a = Infinity, b2 = Infinity, c2 = -Infinity, d = -Infinity;
  segs.forEach((s) => {
    a = Math.min(a, s.x1, s.x2);
    c2 = Math.max(c2, s.x1, s.x2);
    b2 = Math.min(b2, s.y1, s.y2);
    d = Math.max(d, s.y1, s.y2);
  });
  const pad = 22, sc = Math.min((W - 2 * pad) / Math.max(1, c2 - a), (H3 - 2 * pad) / Math.max(1, d - b2));
  const tx = (v6) => pad + (v6 - a) * sc, ty = (v6) => H3 - pad - (v6 - b2) * sc;
  if (k == null) {
    strokeSegs(ctx2, segs, 0, segs.length, tx, ty, { alpha: 1, width: 2 });
    return;
  }
  const n = Math.max(0, Math.min(k, segs.length));
  strokeSegs(ctx2, segs, n, segs.length, tx, ty, { alpha: 0.22, width: 1.5 });
  strokeSegs(ctx2, segs, 0, n, tx, ty, { alpha: 1, width: 2.6 });
  const head = segs[n - 1] || segs[0];
  const hx = tx(n > 0 ? head.x2 : head.x1), hy = ty(n > 0 ? head.y2 : head.y1);
  ctx2.fillStyle = "#ffd24a";
  ctx2.beginPath();
  ctx2.arc(hx, hy, 4, 0, Math.PI * 2);
  ctx2.fill();
}
function createToolpath2d(canvas) {
  let segs = [];
  const anim = { playing: false, k: 0, raf: null };
  const draw = (k) => drawToolpath2d(canvas, segs, k);
  function redraw() {
    draw(anim.playing ? Math.floor(anim.k) : null);
  }
  function setSegments(next) {
    segs = next || [];
    redraw();
  }
  function setGcode(text) {
    setSegments(traceToolpath(text).segments);
  }
  function stop() {
    if (anim.playing) {
      anim.playing = false;
      if (anim.raf) cancelAnimationFrame(anim.raf);
      anim.raf = null;
    }
    redraw();
  }
  function loop() {
    if (!anim.playing) return;
    anim.k += 1.2;
    if (anim.k >= segs.length) anim.k = 0;
    draw(Math.floor(anim.k));
    anim.raf = requestAnimationFrame(loop);
  }
  function play() {
    if (anim.playing || !segs.length) return;
    anim.playing = true;
    anim.k = 0;
    loop();
  }
  function toggle() {
    if (anim.playing) {
      stop();
      return false;
    }
    play();
    return anim.playing;
  }
  function seek(k) {
    anim.playing = true;
    anim.k = k;
    draw(Math.floor(k));
  }
  return {
    setGcode,
    setSegments,
    redraw,
    draw,
    play,
    stop,
    toggle,
    seek,
    get playing() {
      return anim.playing;
    },
    get count() {
      return segs.length;
    }
  };
}
var COL, typeOf;
var init_toolpath2d = __esm({
  "../DDCS-Studio/web/viz/toolpath2d.js"() {
    init_trace();
    COL = { rapid: "#5a6b7d", feed: "#33b1c9", probe: "#e35c5c" };
    typeOf = (s) => s.probe ? "probe" : s.rapid ? "rapid" : s.type || "feed";
  }
});

// ../DDCS-Studio/web/gcodeParser.js
var init_gcodeParser = __esm({
  "../DDCS-Studio/web/gcodeParser.js"() {
    init_tokenizer();
    init_expression();
    init_program2();
  }
});

// ../DDCS-Studio/web/engine/GcodeSimulator.js
var init_GcodeSimulator = __esm({
  "../DDCS-Studio/web/engine/GcodeSimulator.js"() {
    init_gcodeParser();
    init_virtualIO();
    init_tokenizer();
    init_expression();
    init_condition();
    init_program2();
  }
});

// ../DDCS-Studio/web/engine/index.js
var init_engine = __esm({
  "../DDCS-Studio/web/engine/index.js"() {
    init_GcodeExecutionEngine();
    init_GcodeSimulator();
  }
});

// ../DDCS-Studio/web/ui/stockEditor.js
function tplLabel(t) {
  const dims = t.shape === "cylinder" ? `\xD8${t.y}\xD7${t.x}` : `${t.x}\xD7${t.y}\xD7${t.z}`;
  return `${esc(t.name)} \u2014 ${dims}`;
}
function allTpls() {
  const user = getSettings().stockTemplates || [];
  return STOCK_TEMPLATES.map((t) => ({ t, builtin: true })).concat(user.map((t) => ({ t, builtin: false })));
}
function toggleStockEditor(anchor) {
  if (_pop) {
    closeStockEditor();
    return;
  }
  openStockEditor(anchor);
}
function openStockEditor(anchor) {
  closeStockEditor();
  _anchor = anchor || null;
  const s = getSettings().stock || {};
  const pop = document.createElement("div");
  pop.className = "stock-editor-pop";
  pop.style.cssText = "position:fixed; left:50%; top:13%; transform:translateX(-50%); z-index:10050;background:rgba(20,22,28,0.98); border:1px solid rgba(255,255,255,0.14); border-radius:8px;padding:12px 14px; color:#e6ecf2; font-size:12px; width:300px; box-shadow:0 10px 34px rgba(0,0,0,0.55);";
  pop.innerHTML = `
        <style>
            .stock-editor-pop input, .stock-editor-pop select { width:100%; box-sizing:border-box; background:#11141a; color:#e6ecf2; border:1px solid #3a414d; border-radius:4px; padding:3px 5px; }
            .stock-editor-pop label.col { display:flex; flex-direction:column; gap:2px; }
        </style>
        <div class="stock-editor-head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:bold; letter-spacing:1px; color:#9fb4cc;">STOCK</span>
            <button id="se_close" class="toolbar-btn" style="padding:1px 8px;" title="Close">\u2715</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:10px;">
            <label class="col">Template
                <select id="se_tpl">
                    <option value="">\u2014 template \u2014</option>
                </select>
            </label>
            <div style="display:flex; gap:6px;">
                <button id="se_tpl_save" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px;" title="Save current settings as a template">\u2B50 Save template</button>
                <button id="se_tpl_del" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px; display:none;" title="Delete selected template">\u{1F5D1} Delete</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
            <label class="col">X<input id="se_x" type="number" min="0" step="1"></label>
            <label class="col">Y<input id="se_y" type="number" min="0" step="1"></label>
            <label class="col">Z<input id="se_z" type="number" min="0" step="1"></label>
        </div>
        <label class="col" style="margin-bottom:10px;">Shape
            <select id="se_shape">
                <option value="boss">Boss \u2014 probe the outside</option>
                <option value="pocket">Pocket \u2014 probe the inside</option>
                <option value="cylinder">Cylinder \u2014 rotary stock</option>
            </select>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; width:auto;"><input id="se_show" type="checkbox" style="width:auto;"> Show stock in 3D</label>
        <div style="margin-top:10px; color:#7f8a99; font-size:11px;">Cylinder lies along the rotary axis (Y = diameter, X = length).</div>
    `;
  document.body.appendChild(pop);
  _pop = pop;
  makeDraggable(pop, pop.querySelector(".stock-editor-head"));
  const q = (id) => pop.querySelector("#" + id);
  q("se_x").value = s.x ?? "";
  q("se_y").value = s.y ?? "";
  q("se_z").value = s.z ?? "";
  q("se_shape").value = s.shape || "boss";
  q("se_show").checked = s.show !== false;
  const updateTplDel = () => {
    const sel = q("se_tpl");
    const del2 = q("se_tpl_del");
    if (!sel || !del2) return;
    const i = sel.value === "" ? -1 : parseInt(sel.value, 10);
    const list2 = allTpls();
    del2.style.display = i >= 0 && list2[i] && !list2[i].builtin ? "" : "none";
  };
  const rebuildTplDropdown = (selIdx) => {
    const sel = q("se_tpl");
    if (!sel) return;
    const list2 = allTpls();
    sel.innerHTML = '<option value="">\u2014 template \u2014</option>' + list2.map((e, i) => `<option value="${i}">${e.builtin ? "" : "\u2B50 "}${tplLabel(e.t)}</option>`).join("");
    sel.value = selIdx != null ? String(selIdx) : "";
    updateTplDel();
  };
  rebuildTplDropdown();
  const commit = () => applySettings({ stock: {
    x: parseFloat(q("se_x").value) || 0,
    y: parseFloat(q("se_y").value) || 0,
    z: parseFloat(q("se_z").value) || 0,
    shape: q("se_shape").value,
    show: q("se_show").checked
  } });
  ["se_x", "se_y", "se_z", "se_shape", "se_show"].forEach((id) => {
    q(id).addEventListener("input", commit);
    q(id).addEventListener("change", commit);
  });
  q("se_tpl").addEventListener("change", () => {
    const i = q("se_tpl").value === "" ? -1 : parseInt(q("se_tpl").value, 10);
    const all = allTpls();
    updateTplDel();
    if (i < 0 || !all[i]) return;
    const t = all[i].t;
    q("se_x").value = t.x;
    q("se_y").value = t.y;
    q("se_z").value = t.z;
    q("se_shape").value = t.shape || "boss";
    commit();
  });
  q("se_tpl_save").addEventListener("click", () => {
    const name = (prompt("Save current stock as a template \u2014 name?") || "").trim();
    if (!name) return;
    const currentTemplates = getSettings().stockTemplates || [];
    const newTemplate = {
      name,
      x: parseFloat(q("se_x").value) || 0,
      y: parseFloat(q("se_y").value) || 0,
      z: parseFloat(q("se_z").value) || 0,
      shape: q("se_shape").value || "boss"
    };
    const updated = [...currentTemplates, newTemplate];
    applySettings({ stockTemplates: updated });
    rebuildTplDropdown(STOCK_TEMPLATES.length + updated.length - 1);
  });
  q("se_tpl_del").addEventListener("click", () => {
    const sel = q("se_tpl");
    const i = sel.value === "" ? -1 : parseInt(sel.value, 10);
    const list2 = allTpls();
    if (i < 0 || !list2[i] || list2[i].builtin) return;
    const userIdx = i - STOCK_TEMPLATES.length;
    const currentTemplates = getSettings().stockTemplates || [];
    const updated = [...currentTemplates];
    updated.splice(userIdx, 1);
    applySettings({ stockTemplates: updated });
    rebuildTplDropdown();
  });
  q("se_close").addEventListener("click", closeStockEditor);
  pop.addEventListener("pointerdown", (e) => e.stopPropagation());
  setTimeout(() => document.addEventListener("pointerdown", _onDoc, true), 0);
}
function _onDoc(e) {
  if (!_pop) return;
  if (_pop.contains(e.target)) return;
  if (_anchor && (e.target === _anchor || _anchor.contains(e.target))) return;
  closeStockEditor();
}
function closeStockEditor() {
  if (_pop) {
    _pop.remove();
    _pop = null;
    _anchor = null;
    document.removeEventListener("pointerdown", _onDoc, true);
  }
}
var _pop, _anchor, esc;
var init_stockEditor = __esm({
  "../DDCS-Studio/web/ui/stockEditor.js"() {
    init_settingsPanel();
    init_uiUtils();
    _pop = null;
    _anchor = null;
    esc = (v6) => String(v6).replace(/[<>&]/g, (c2) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c2]);
  }
});

// ../DDCS-Studio/web/viz/createPreviewPanel.js
function createPreviewPanel(container, opts = {}) {
  const get = (k) => typeof opts[k] === "function" ? opts[k]() : opts[k];
  container.classList.add("preview-panel");
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.insertAdjacentHTML("beforeend", PANEL_HTML);
  const q = (sel) => container.querySelector(sel);
  const cv2d = q(".pp-2d");
  const statusEl = q(".pp-status");
  const t2 = createToolpath2d(cv2d);
  let viz = null;
  let mode = previewPrefs().defaultView === "2d" ? "2d" : "3d", active2 = false, segs = [], fitted = false;
  let lastVizMode = mode === "io" ? "3d" : mode;
  let lastRunCode = null, loopOn = false, loopTimer = null, autoStarted = false;
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      if (mode === "2d") t2.redraw();
    }).observe(container);
  }
  const setStatus2 = (text, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("has-error", !!isError);
    const cp = q(".pp-copy");
    if (cp) cp.classList.toggle("visible", !!(text && text.length));
  };
  const SPEEDS = [1, 2, 5, 10];
  let speedIx = Math.max(0, SPEEDS.indexOf(Number(previewPrefs().defaultSpeed) || 1));
  const simSpeed = () => SPEEDS[speedIx] || 1;
  function applyPreviewSettings() {
    if (!viz) return;
    const pv = previewPrefs();
    const damp = Number.isFinite(pv.followDamp) ? pv.followDamp : 50;
    if (viz.setFollowLerp) viz.setFollowLerp(0.32 - damp / 100 * 0.3);
    if (viz.setShowRapids) viz.setShowRapids(pv.showRapids !== false);
  }
  const nearest2d = (pos) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], dx = s.x2 - pos.x, dy = s.y2 - pos.y, dd = dx * dx + dy * dy;
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    }
    return bi + 1;
  };
  function ensureViz() {
    if (viz) return viz;
    try {
      viz = new GcodeViz3D(container);
      viz._gizmoPx = 36;
      viz._animOn = false;
      viz.setStock(stockForViz());
      viz.setMachine(machineForViz());
      applyPreviewSettings();
    } catch (e) {
      console.warn("preview 3D unavailable \u2014 using 2D", e);
      viz = null;
      setMode("2d");
    }
    return viz;
  }
  let engine = null;
  function ensureEngine() {
    if (engine) return engine;
    engine = new GcodeExecutionEngine({
      autoAnswer: window.ioPanel ? window.ioPanel.isAutoSensors() : true,
      stock: stockForViz(),
      wcsOffset: wcsForViz(),
      simSpeed: simSpeed(),
      createVarStore: opts.createVarStore || null,
      onLineChange: ({ lineIndex, raw: raw2 }) => {
        if (typeof opts.onLine === "function") opts.onLine(lineIndex);
        if (raw2) setStatus2(`Executing line ${lineIndex + 1}: ${raw2.trim()}`);
      },
      onPositionChange: (pos) => {
        if (viz && viz.setToolPosition) viz.setToolPosition(pos);
        if (mode === "2d" && segs.length) t2.seek(nearest2d(pos));
      },
      onStatus: ({ message }) => setStatus2(message),
      onWait: (wait) => {
        if (!window.ioPanel) return;
        if (mode !== "io" && wait) window.ioPanel.show();
        window.ioPanel.setWait(wait);
      },
      // docked I/O view already shows it; else float
      onFinish: () => {
        updateRunBtn();
        if (typeof opts.onLine === "function") opts.onLine(null);
        if (loopOn) {
          clearTimeout(loopTimer);
          loopTimer = setTimeout(() => {
            lastRunCode = get("getGcode") || lastRunCode;
            engine.run(lastRunCode);
            updateRunBtn();
          }, 800);
        }
      }
    });
    return engine;
  }
  function updateRunBtn() {
    const b2 = q(".pp-run");
    if (!b2) return;
    const running = !!(engine && engine.running), paused = !!(engine && engine.paused);
    b2.classList.toggle("on", running && !paused);
    b2.innerHTML = running && !paused ? ICON_STOP : ICON_PLAY;
  }
  function setGcode(text) {
    const code = text != null ? text : get("getGcode") || "";
    const st = get("getStart");
    let parsed;
    try {
      parsed = traceToolpath(code, { stock: stockForViz(), start: st, wcsOffset: wcsForViz() });
    } catch (e) {
      console.warn("trace failed", e);
      parsed = { segments: [], stats: {} };
    }
    segs = parsed.segments || [];
    t2.setSegments(segs);
    if (mode === "3d") {
      const v6 = ensureViz();
      if (v6) {
        v6.setActive(true);
        if (st && v6.starts) v6.starts[0] = { x: +st.x || 0, y: +st.y || 0, z: +st.z || 0 };
        v6.setSegments(parsed, !fitted);
        fitted = true;
      }
    }
    const s = parsed.stats || {};
    setStatus2(!s.drawable ? "No drawable moves" : [s.feed && `${s.feed} cuts`, s.probe && `${s.probe} probes`, s.rapid && `${s.rapid} rapids`].filter(Boolean).join(" \xB7 "));
    syncJog();
    renderLegend(parsed);
  }
  const refresh = () => setGcode();
  function syncJog() {
    const j = q(".pp-jog");
    if (j) j.style.display = mode === "3d" && viz && viz.jogPendant && viz.starts && viz.starts.length > 0 ? "" : "none";
    const f = q(".pp-follow");
    if (f) f.style.display = mode === "3d" && viz ? "" : "none";
  }
  const LEGEND = [
    // colours match the 3D view (gcodeViz3d line groups)
    { key: "feed", label: "Cut", color: "#35d0ff" },
    { key: "probe", label: "Probe", color: "#3b82f6" },
    { key: "probeSlow", label: "Probe slow", color: "#93c5fd" },
    { key: "retract", label: "Retract", color: "#33cc55" },
    { key: "jog", label: "Jog", color: "#ff9a0d" },
    { key: "rapid", label: "Rapid", color: "#ffcc00" }
  ];
  function renderLegend(parsed) {
    const el3 = q(".viz3d-legend");
    if (!el3) return;
    const ss = parsed && parsed.segments || [];
    let maxProbeFeed = 0;
    for (const s of ss) {
      if ((s.type === "probe" || s.probe) && (s.feed || 0) > maxProbeFeed) maxProbeFeed = s.feed;
    }
    const present = /* @__PURE__ */ new Set();
    for (const s of ss) {
      const type = s.type || (s.probe ? "probe" : s.rapid ? "rapid" : "feed");
      if (type === "rapid") present.add("rapid");
      else if (type === "retract") present.add("retract");
      else if (type === "probe") present.add((s.feed || 0) > 0 && (s.feed || 0) < maxProbeFeed ? "probeSlow" : "probe");
      else present.add("feed");
    }
    if (viz && viz.starts && viz.starts.length > 1) present.add("jog");
    el3.innerHTML = LEGEND.filter((x) => present.has(x.key)).map((x) => `<span style="color:${x.color}">${x.label}</span>`).join("");
    el3.style.display = el3.childElementCount ? "" : "none";
  }
  function setMode(next) {
    const ioBtn = q(".pp-io");
    if (next !== "io") lastVizMode = next;
    mode = next;
    stopPlay();
    if (mode === "io") {
      if (cv2d) cv2d.style.display = "none";
      if (viz) {
        viz.setActive(false);
        if (viz.renderer) viz.renderer.domElement.style.display = "none";
      }
      if (window.ioPanel) window.ioPanel.show(container);
      if (ioBtn) ioBtn.classList.add("on");
      syncJog();
      return;
    }
    if (window.ioPanel && window.ioPanel.isVisible()) window.ioPanel.hide();
    if (ioBtn) ioBtn.classList.remove("on");
    const mt = q(".pp-mtoggle");
    if (mt) mt.textContent = mode === "2d" ? "2D" : "3D";
    if (cv2d) cv2d.style.display = mode === "2d" ? "" : "none";
    if (mode === "2d") {
      if (viz) {
        viz.setActive(false);
        if (viz.renderer) viz.renderer.domElement.style.display = "none";
      }
    } else {
      const v6 = ensureViz();
      if (v6) {
        if (v6.renderer) v6.renderer.domElement.style.display = "";
        v6.setActive(true);
      }
    }
    if (active2) setGcode();
    if (mode === "2d") t2.redraw();
  }
  function play() {
    const eng = ensureEngine();
    eng.simSpeed = simSpeed();
    eng.autoAnswer = window.ioPanel ? window.ioPanel.isAutoSensors() : true;
    eng.stock = stockForViz();
    eng._stockOffset = get("getStart") || { x: 0, y: 0, z: 0 };
    eng._wcsOffset = wcsForViz() || { x: 0, y: 0, z: 0 };
    if (mode === "3d") ensureViz();
    if (viz) viz.setAnimate(false);
    lastRunCode = get("getGcode") || "";
    eng.run(lastRunCode);
    updateRunBtn();
  }
  function stopPlay() {
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
    if (engine && engine.running) engine.stop();
    t2.stop();
    if (viz) viz.setAnimate(false);
    if (typeof opts.onLine === "function") opts.onLine(null);
    updateRunBtn();
  }
  function seekLine(i) {
    if (!segs.length || i == null) return;
    let best = null;
    for (const s of segs) {
      if (s.line != null && s.line <= i) best = s;
    }
    const pos = best ? { x: best.x2, y: best.y2, z: best.z2 } : { x: segs[0].x1, y: segs[0].y1, z: segs[0].z1 };
    if (mode === "3d") {
      const v6 = ensureViz();
      if (v6 && v6.setToolPosition) v6.setToolPosition(pos);
    } else t2.seek(nearest2d(pos));
  }
  function renderStock() {
    if (viz) viz.setStock(stockForViz());
    if (engine) engine.stock = stockForViz();
  }
  q(".pp-stock").addEventListener("click", (e) => toggleStockEditor(e.currentTarget));
  q(".pp-mtoggle").addEventListener("click", () => setMode(mode === "io" ? lastVizMode : mode === "2d" ? "3d" : "2d"));
  q(".pp-run").addEventListener("click", () => {
    const eng = ensureEngine();
    if (eng.running && !eng.paused) stopPlay();
    else if (eng.running && eng.paused) {
      eng.resume();
      updateRunBtn();
    } else play();
  });
  q(".pp-step").addEventListener("click", () => {
    const eng = ensureEngine();
    if (viz && !eng.running) viz.setAnimate(false);
    eng.step(get("getGcode") || "");
    updateRunBtn();
  });
  q(".pp-loop").addEventListener("click", () => {
    loopOn = !loopOn;
    q(".pp-loop").classList.toggle("on", loopOn);
    if (!loopOn && loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  });
  q(".pp-speed").addEventListener("click", () => {
    speedIx = (speedIx + 1) % SPEEDS.length;
    q(".pp-speed").textContent = SPEEDS[speedIx] + "\xD7";
    if (engine) engine.simSpeed = simSpeed();
  });
  q(".pp-copy").addEventListener("click", () => {
    if (statusEl && statusEl.textContent && navigator.clipboard) navigator.clipboard.writeText(statusEl.textContent);
  });
  q(".pp-jog").addEventListener("click", () => {
    const v6 = ensureViz();
    if (!v6 || !v6.jogPendant) return;
    const grid = v6.jogPendant.querySelector(".jog-grid-wrap");
    if (!grid) return;
    const open = grid.style.display === "none";
    grid.style.display = open ? "" : "none";
    q(".pp-jog").classList.toggle("on", open);
  });
  q(".pp-io").addEventListener("click", () => setMode(mode === "io" ? lastVizMode : "io"));
  q(".pp-follow").addEventListener("click", () => {
    const v6 = ensureViz();
    if (!v6 || !v6.setFollowCam) return;
    const on = !v6.followCam;
    v6.setFollowCam(on);
    q(".pp-follow").classList.toggle("on", on);
  });
  window.addEventListener("ddcs:stop-previews", stopPlay);
  window.addEventListener("ddcs:settings-changed", () => {
    renderStock();
    if (viz) viz.setMachine(machineForViz());
    applyPreviewSettings();
    if (active2) setGcode();
  });
  function setActive(on) {
    active2 = !!on;
    if (!active2) {
      stopPlay();
      autoStarted = false;
      if (viz) viz.setActive(false);
      return;
    }
    if (mode === "3d") {
      const v6 = ensureViz();
      if (v6) v6.setActive(true);
    }
    setGcode();
    autoStartOnOpen();
  }
  function autoStartOnOpen() {
    if (autoStarted || !active2) return;
    const pv = previewPrefs();
    if (mode === "3d" && pv.followDefault !== false) {
      const v6 = ensureViz();
      if (v6 && v6.setFollowCam) {
        v6.setFollowCam(true);
        const fb = q(".pp-follow");
        if (fb) fb.classList.add("on");
      }
    }
    if (!segs.length) return;
    autoStarted = true;
    if (pv.autoLoop !== false) {
      loopOn = true;
      const lb = q(".pp-loop");
      if (lb) lb.classList.add("on");
      play();
    }
  }
  return { setGcode, refresh, setActive, setView: setMode, stop: stopPlay, seekLine, get viz() {
    return viz;
  }, get engine() {
    return engine;
  }, el: container };
}
var stockForViz, wcsForViz, machineForViz, previewPrefs, ICON_PLAY, ICON_STOP, ICON_STEP, ICON_COPY, ICON_JOG, ICON_LOOP, ICON_FOLLOW, PANEL_HTML;
var init_createPreviewPanel = __esm({
  "../DDCS-Studio/web/viz/createPreviewPanel.js"() {
    init_gcodeViz3d();
    init_toolpath2d();
    init_trace();
    init_engine();
    init_stockEditor();
    stockForViz = () => {
      const s = window.ddcsGetSettings && window.ddcsGetSettings().stock || null;
      return s && s.show ? s : null;
    };
    wcsForViz = () => {
      const m = window.ddcsGetSettings && window.ddcsGetSettings().machine || null;
      return m && m.workOrigin ? m.workOrigin : null;
    };
    machineForViz = () => window.ddcsGetSettings && window.ddcsGetSettings().machine || null;
    previewPrefs = () => window.ddcsGetSettings && window.ddcsGetSettings().preview || {};
    ICON_PLAY = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M4.5 3 12.5 8 4.5 13Z"/></svg>';
    ICON_STOP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/></svg>';
    ICON_STEP = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M3.5 3 10 8 3.5 13Z"/><rect x="11" y="3" width="2.4" height="10" rx="1"/></svg>';
    ICON_COPY = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" style="vertical-align:middle" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1"/></svg>';
    ICON_JOG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="vertical-align:middle" aria-hidden="true"><path d="M8 2 6 4.5h4z"/><path d="M8 14 6 11.5h4z"/><path d="M2 8 4.5 6v4z"/><path d="M14 8 11.5 6v4z"/></svg>';
    ICON_LOOP = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>';
    ICON_FOLLOW = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle" aria-hidden="true"><path d="M2 5.5V4a2 2 0 0 1 2-2h1.5"/><path d="M10.5 2H12a2 2 0 0 1 2 2v1.5"/><path d="M14 10.5V12a2 2 0 0 1-2 2h-1.5"/><path d="M5.5 14H4a2 2 0 0 1-2-2v-1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>';
    PANEL_HTML = `
  <canvas class="pp-2d" aria-hidden="true" style="position:absolute;top:0;left:0;width:100%;height:100%;display:none;background:#0d1117;z-index:1"></canvas>
  <div class="pp-statusbar">
    <button class="pp-copy viz3d-status-copy" type="button" title="Copy this status line to the clipboard" aria-label="Copy status">${ICON_COPY}</button>
    <div class="pp-status viz3d-status"></div>
  </div>
  <div class="viz3d-controls">
    <button class="pp-mtoggle viz3d-2dtoggle" type="button" title="Toggle 2D / 3D view">3D</button>
    <button class="pp-stock" type="button" title="Stock \u2014 set the workpiece (dimensions, shape, show, templates)" aria-label="Stock">\u{1F4E6}</button>
    <button class="pp-speed" type="button" title="Simulation speed \u2014 tap to cycle 1\xD7 2\xD7 5\xD7 10\xD7" aria-label="Simulation speed">1\xD7</button>
    <button class="pp-run" type="button" title="Run the program \xB7 while running, click to stop and reset to the start">${ICON_PLAY}</button>
    <button class="pp-step" type="button" title="Execute one line at a time (pauses a running program)">${ICON_STEP}</button>
    <button class="pp-loop" type="button" title="Loop: restart the program when it completes" aria-label="Loop">${ICON_LOOP}</button>
    <button class="pp-follow" type="button" title="Follow-cam \u2014 keep the tool centred while playing (Settings \u2192 Preview to set damping)" aria-label="Follow cam" style="display:none">${ICON_FOLLOW}</button>
    <button class="pp-jog" type="button" title="Jog the start marker (X/Y/Z step buttons)" aria-label="Jog" style="display:none">${ICON_JOG}</button>
    <button class="pp-io" type="button" title="Show/hide the virtual I/O panel (sensors and outputs)">I/O</button>
  </div>
  <div class="viz3d-legend"></div>
  <div class="viz3d-hint">drag orbit \xB7 wheel zoom \xB7 right/middle-drag pan</div>
`;
  }
});

// ../DDCS-Studio/web/blocks/gcodeToStack.js
function word(letter, code) {
  const m = code.match(new RegExp(letter + VAL, "i"));
  if (!m) return void 0;
  const v6 = m[1];
  if (/[#[]/.test(v6)) return v6;
  const n = Number(v6);
  return Number.isFinite(n) ? n : v6;
}
function pick(o) {
  const r = {};
  for (const k in o) if (o[k] !== void 0) r[k] = o[k];
  return r;
}
function parseLine(line2, opts = {}) {
  const raw2 = String(line2);
  const trimmed = raw2.trim();
  if (!trimmed) return null;
  const cm = raw2.match(/\s\(([^)]*)\)\s*$/);
  const comment2 = cm ? cm[1].trim() : null;
  const code = (cm ? raw2.slice(0, cm.index) : raw2).trim();
  if (!code) return comment2 != null ? { type: "comment", params: { text: comment2 } } : null;
  const dialect8 = opts.dialect;
  if (dialect8 && typeof dialect8.recognize === "function") {
    const r = dialect8.recognize(code, comment2);
    if (r) return r;
  }
  if (/^\([^)]*\)$/.test(code)) return { type: "comment", params: { text: code.slice(1, -1).trim() } };
  if (code === "M00") return { type: "pause", params: {} };
  const G3 = (n) => new RegExp("\\bG0*" + n + "\\b", "i").test(code);
  const M2 = (n) => new RegExp("\\bM0*" + n + "\\b", "i").test(code);
  const w2 = (L2) => word(L2, code);
  if (G3(53)) {
    for (const ax of ["X", "Y", "Z", "A"]) {
      const v6 = w2(ax);
      if (v6 !== void 0) return { type: "machinemove", params: { axis: ax, to: v6 } };
    }
    return { type: "raw", params: { text: raw2 } };
  }
  if (G3(31)) return { type: "move", params: pick({ mode: "probe", x: w2("X"), y: w2("Y"), z: w2("Z"), feed: w2("F") }) };
  if (G3(2)) return { type: "arc", params: pick({ arc: "cw", x: w2("X"), y: w2("Y"), i: w2("I"), j: w2("J"), feed: w2("F") }) };
  if (G3(3)) return { type: "arc", params: pick({ arc: "ccw", x: w2("X"), y: w2("Y"), i: w2("I"), j: w2("J"), feed: w2("F") }) };
  if (G3(1)) return { type: "move", params: pick({ mode: "cut", x: w2("X"), y: w2("Y"), z: w2("Z"), feed: w2("F") }) };
  if (G3(0)) return { type: "move", params: pick({ mode: "rapid", x: w2("X"), y: w2("Y"), z: w2("Z") }) };
  if (G3(4)) {
    const p = w2("P");
    const ms = !dialect8 || dialect8.dwellUnits !== "s";
    return { type: "dwell", params: { sec: typeof p === "number" ? ms ? p / 1e3 : p : p } };
  }
  for (let n = 54; n <= 59; n++) if (G3(n)) return { type: "wcs", params: { wcs: "G" + n } };
  if (G3(17)) return { type: "plane", params: { plane: "G17" } };
  if (G3(18)) return { type: "plane", params: { plane: "G18" } };
  if (G3(19)) return { type: "plane", params: { plane: "G19" } };
  if (G3(90)) return { type: "distmode", params: { dist: "abs" } };
  if (G3(91)) return { type: "distmode", params: { dist: "inc" } };
  if (G3(94)) return { type: "feedmode", params: { fmode: "G94" } };
  if (G3(95)) return { type: "feedmode", params: { fmode: "G95" } };
  if (G3(28)) {
    const axes = (code.toUpperCase().match(/[XYZA](?=[-+.\d])/g) || []).filter((a, i, arr) => arr.indexOf(a) === i);
    return { type: "home", params: { axes: axes.join("") || "Z" } };
  }
  if (M2(3) || M2(4)) return { type: "spindle", params: pick({ rpm: w2("S"), dir: M2(4) ? "ccw" : "cw" }) };
  if (M2(5)) return { type: "spindle", params: { rpm: 0, dir: "cw" } };
  if (M2(6)) {
    const t = w2("T");
    return { type: "tool", params: { n: t !== void 0 ? t : 1 } };
  }
  if (M2(8)) return { type: "coolant", params: { flow: "flood" } };
  if (M2(7)) return { type: "coolant", params: { flow: "mist" } };
  if (M2(9)) return { type: "coolant", params: { flow: "off" } };
  if (M2(30) || M2(2)) return { type: "endprogram", params: {} };
  if (code === "M0") return { type: "stop", params: { stop: "M0" } };
  if (code === "M1") return { type: "stop", params: { stop: "M1" } };
  if (M2(98)) {
    const p = w2("P");
    if (typeof p === "number") return { type: "call", params: { prog: p } };
  }
  if (M2(99)) return { type: "return", params: {} };
  const mm = code.match(/\bM0*(\d+)\b/i);
  if (mm) return { type: "mcode", params: { code: Number(mm[1]) } };
  if (/^F/i.test(code) && w2("F") !== void 0) return { type: "feed", params: { rate: w2("F") } };
  if (/^#/.test(code) && code.includes("=")) {
    const i = code.indexOf("=");
    const v6 = code.slice(0, i).trim(), expr = code.slice(i + 1).trim();
    if (v6) return { type: "assign", params: comment2 ? { var: v6, value: expr, note: comment2 } : { var: v6, value: expr } };
  }
  return { type: "raw", params: { text: raw2 } };
}
function matchWaitInputPoll(lines, i, opts) {
  const d = opts && opts.dialect;
  if (!(d && d.caps && d.caps.inputRead)) return null;
  const m = String(lines[i]).trim().match(/^WHILE\s*\[#\[1520\+(\d+)\]\s*!=\s*([01])\]\s*DO1\b/i);
  if (!m) return null;
  let j = i + 1;
  while (j < lines.length && !lines[j].trim()) j++;
  if (j >= lines.length || !/^G0*4\s+P[\d.]+/i.test(lines[j].trim())) return null;
  let k = j + 1;
  while (k < lines.length && !lines[k].trim()) k++;
  if (k >= lines.length || !/^END1\b/i.test(lines[k].trim())) return null;
  return { rec: { type: "waitinput", params: { pin: Number(m[1]), mode: Number(m[2]) === 1 ? "high" : "low" } }, end: k };
}
function parseGcodeToStack(text, opts = {}) {
  const out = [];
  let modalFeed = null;
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const wi = matchWaitInputPoll(lines, i, opts);
    if (wi) {
      out.push(wi.rec);
      i = wi.end;
      continue;
    }
    const rec = parseLine(lines[i], opts);
    if (!rec) continue;
    if (rec.type === "arc" || rec.type === "move" && (rec.params.mode === "cut" || rec.params.mode === "probe")) {
      if (typeof rec.params.feed === "number") modalFeed = rec.params.feed;
      else if (rec.params.feed === void 0 && modalFeed !== null) rec.params.feed = modalFeed;
      else if (typeof rec.params.feed === "string") modalFeed = null;
    }
    out.push(rec);
  }
  return out;
}
function reconcileGcodeToStack(editedText, currentStack, opts = {}) {
  if (!isAllLeaf(currentStack)) return null;
  return parseGcodeToStack(editedText, opts);
}
var VAL, WRAPPER_KINDS, isLeafRecord, isAllLeaf;
var init_gcodeToStack = __esm({
  "../DDCS-Studio/web/blocks/gcodeToStack.js"() {
    init_ops();
    VAL = "(#[A-Za-z0-9_.]+|\\[[^\\]]*\\]|[-+]?\\d*\\.?\\d+)";
    WRAPPER_KINDS = /* @__PURE__ */ new Set(["container", "path", "loop", "cond", "depth", "fill"]);
    isLeafRecord = (r) => {
      const d = BLOCKS[r.type];
      return !!d && !WRAPPER_KINDS.has(d.kind) && !(r.children && r.children.length);
    };
    isAllLeaf = (stack2) => (stack2 || []).every(isLeafRecord);
  }
});

// ../DDCS-Studio/web/blocks/opStacks.js
var opStacks_exports = {};
__export(opStacks_exports, {
  buildActiveOpStack: () => buildActiveOpStack,
  commitActiveOp: () => commitActiveOp,
  commitDecodedCode: () => commitDecodedCode,
  deleteOp: () => deleteOp,
  duplicateOp: () => duplicateOp,
  hasActiveOpStack: () => hasActiveOpStack,
  reconcileActiveOp: () => reconcileActiveOp,
  replaceOp: () => replaceOp,
  unportedActiveOp: () => unportedActiveOp
});
function scanAtoms(blocks, set2) {
  for (const b2 of blocks || []) {
    if (!b2) continue;
    if (set2.has(b2.type)) return true;
    if (b2.children && scanAtoms(b2.children, set2)) return true;
  }
  return false;
}
function opRequires(children) {
  const r = [];
  if (scanAtoms(children, VAR_ATOMS)) r.push("vars");
  if (scanAtoms(children, FLOW_ATOMS)) r.push("flow");
  return r;
}
function makeOp(opType, params, children) {
  return {
    id: `op${++_opSeq}`,
    type: "op",
    opType,
    label: OP_LABELS[opType] || opType,
    requires: opRequires(children),
    params: params ? JSON.parse(JSON.stringify(params)) : {},
    children
  };
}
function hasActiveOpStack() {
  const op = getLastOp();
  return !!(op && BUILDERS[op.type]);
}
function unportedActiveOp() {
  const op = getLastOp();
  return op && !BUILDERS[op.type] ? op.type : null;
}
function buildActiveOpStack() {
  const op = getLastOp(), s = sig(op);
  if (!op || !BUILDERS[op.type]) {
    shownOp = null;
    return null;
  }
  shownOp = op.type;
  if (s === loadedSig) return null;
  loadedSig = s;
  const framed = BUILDERS[op.type](op.params);
  const start = framed.find((b2) => b2 && b2.type === "progstart");
  const end = framed.find((b2) => b2 && b2.type === "progend");
  const bare = framed.filter((b2) => b2 && b2.type !== "progstart" && b2.type !== "progend");
  const opC = makeOp(op.type, op.params, bare);
  return { blocks: start && end ? [start, opC, end] : [opC] };
}
function maxLabelNum(blocks) {
  let m = 0;
  _walk(blocks, (b2) => {
    if (b2.type === "label" && b2.params) m = Math.max(m, Math.round(num(b2.params.n, 0)));
  });
  return m;
}
function offsetLabels(blocks, off) {
  if (!off) return blocks;
  _walk(blocks, (b2) => {
    if (!b2.params) return;
    if (b2.type === "label" || b2.type === "goto") b2.params.n = Math.round(num(b2.params.n, 1)) + off;
    else if (b2.type === "ifgoto") b2.params.goto = Math.round(num(b2.params.goto, 1)) + off;
  });
  return blocks;
}
function normalizeEnds(blocks) {
  const hasProgend = blocks.some((b2) => b2 && b2.type === "progend");
  let end = null;
  const strip = (arr) => {
    const out = [];
    for (const b2 of arr || []) {
      if (b2 && b2.type === "endprogram") {
        end = b2;
        continue;
      }
      if (b2 && b2.children) b2.children = strip(b2.children);
      out.push(b2);
    }
    return out;
  };
  const cleaned = strip(blocks);
  if (!hasProgend && end) cleaned.push(end);
  return cleaned;
}
function appendIntoProgram(bare, framed) {
  if (!bare || !bare.length) return false;
  const cur = typeof window !== "undefined" && window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() || [] : [];
  let next;
  if (!cur.length) {
    next = framed || bare;
  } else {
    offsetLabels(bare, maxLabelNum(cur));
    const endIdx = cur.findIndex((b2) => b2 && b2.type === "progend");
    if (endIdx >= 0) next = [...cur.slice(0, endIdx), ...bare, ...cur.slice(endIdx)];
    else if (framed) {
      const start = framed.find((b2) => b2 && b2.type === "progstart"), end = framed.find((b2) => b2 && b2.type === "progend");
      next = start && end ? [start, ...cur, ...bare, end] : [...cur, ...bare];
    } else next = [...cur, ...bare];
    next = normalizeEnds(next);
  }
  if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
  loadedSig = null;
  return true;
}
function commitActiveOp() {
  const op = getLastOp();
  if (!op || !BUILDERS[op.type]) return false;
  const framed = BUILDERS[op.type](op.params);
  const start = framed.find((b2) => b2 && b2.type === "progstart");
  const end = framed.find((b2) => b2 && b2.type === "progend");
  const bare = framed.filter((b2) => b2 && b2.type !== "progstart" && b2.type !== "progend");
  const opC = makeOp(op.type, op.params, bare);
  return appendIntoProgram([opC], start && end ? [start, opC, end] : [opC]);
}
function replaceOp(opId, params) {
  const cur = typeof window !== "undefined" && window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() || [] : [];
  const idx = cur.findIndex((b2) => b2 && b2.type === "op" && b2.id === opId);
  if (idx < 0) return false;
  const opType = cur[idx].opType;
  if (!BUILDERS[opType]) return false;
  const framed = BUILDERS[opType](params);
  const bare = framed.filter((b2) => b2 && b2.type !== "progstart" && b2.type !== "progend");
  const opC = makeOp(opType, params, bare);
  opC.id = opId;
  const next = [...cur.slice(0, idx), opC, ...cur.slice(idx + 1)];
  recordOp(opType, params);
  if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
  return true;
}
function deleteOp(opId) {
  const cur = typeof window !== "undefined" && window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() || [] : [];
  const idx = cur.findIndex((b2) => b2 && b2.type === "op" && b2.id === opId);
  if (idx < 0) return false;
  const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
  if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
  return true;
}
function duplicateOp(opId) {
  const cur = typeof window !== "undefined" && window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() || [] : [];
  const idx = cur.findIndex((b2) => b2 && b2.type === "op" && b2.id === opId);
  if (idx < 0) return false;
  const src = cur[idx];
  if (!BUILDERS[src.opType]) return false;
  const framed = BUILDERS[src.opType](src.params);
  const bare = framed.filter((b2) => b2 && b2.type !== "progstart" && b2.type !== "progend");
  const copy = makeOp(src.opType, src.params, bare);
  const next = [...cur.slice(0, idx + 1), copy, ...cur.slice(idx + 1)];
  if (window.ddcsLoadBlockStack) window.ddcsLoadBlockStack(next);
  return true;
}
function commitDecodedCode(code) {
  if (!code || !code.trim()) return false;
  let bare;
  try {
    bare = parseGcodeToStack(code, dialectOpts());
  } catch (_) {
    return false;
  }
  return appendIntoProgram(bare, null);
}
function reconcileActiveOp() {
  if (!shownOp || !RECONCILERS[shownOp]) return null;
  const prog = typeof window !== "undefined" && window.ddcsGetBlockProgram ? window.ddcsGetBlockProgram() : null;
  if (!prog || !prog.length) return null;
  const fields = RECONCILERS[shownOp](prog);
  return fields ? { type: shownOp, fields } : null;
}
var dialectOpts, BUILDERS, find, OP_LABELS, VAR_ATOMS, FLOW_ATOMS, _opSeq, formNum, RECONCILERS, loadedSig, shownOp, sig, _walk;
var init_opStacks = __esm({
  "../DDCS-Studio/web/blocks/opStacks.js"() {
    init_opRecord();
    init_util();
    init_gcodeToStack();
    init_dialects();
    init_controllerProfiles();
    init_surfacingWizard();
    init_pocketWizard();
    init_slotWizard();
    init_drillWizard();
    init_wcsWizard();
    init_edgeWizard();
    init_communicationWizard();
    init_middleWizard();
    init_cornerWizard();
    init_alignmentWizard();
    init_atcLengthWizard();
    init_atcToolCheckWizard();
    init_atcWarmupWizard();
    init_atcChangeWizard();
    init_atcTestWizard();
    init_atcTableWizard();
    init_circularWizard();
    init_rotaryClockWizard();
    init_rotaryCenterWizard();
    init_textWizard();
    dialectOpts = () => {
      try {
        return { dialect: resolveActivePost(getActiveProfile().id) };
      } catch (_) {
        return {};
      }
    };
    BUILDERS = {
      surfacing: surfacingStack,
      pocket: pocketStack,
      slot: slotStack,
      drill: drillStack,
      wcs: wcsStack,
      edge: edgeStack,
      comm: commStack,
      middle: middleStack,
      corner: cornerStack,
      alignment: alignmentStack,
      atc_length: atcLengthStack,
      atc_check: atcToolCheckStack,
      atc_warmup: atcWarmupStack,
      atc_change: atcChangeStack,
      atc_test: atcTestStack,
      atc_table: atcTableStack,
      circular: circularStack,
      rotary_clock: rotaryClockStack,
      rotary_center: rotaryCenterStack,
      text: textStack
    };
    find = (prog, type) => {
      for (const b2 of prog || []) {
        if (!b2) continue;
        if (b2.type === type) return b2;
        if (b2.children) {
          const f = find(b2.children, type);
          if (f) return f;
        }
      }
      return null;
    };
    OP_LABELS = {
      surfacing: "Surfacing",
      pocket: "Pocket",
      slot: "Slot",
      drill: "Drill",
      text: "Text",
      wcs: "WCS",
      edge: "Edge Probe",
      middle: "Middle Probe",
      corner: "Corner Probe",
      alignment: "Alignment",
      circular: "Circular Probe",
      rotary_clock: "Rotary Clock",
      rotary_center: "Rotary Centre",
      comm: "Communication",
      atc_length: "Tool Length",
      atc_check: "Tool Check",
      atc_warmup: "Spindle Warmup",
      atc_change: "Tool Change",
      atc_test: "ATC Test"
    };
    VAR_ATOMS = /* @__PURE__ */ new Set(["assign", "probe", "proberead", "readmachine", "setworkoffset", "tooloffset", "machinemove"]);
    FLOW_ATOMS = /* @__PURE__ */ new Set(["ifgoto", "goto", "label"]);
    _opSeq = 0;
    formNum = (id, d) => {
      if (typeof document === "undefined") return d;
      const e = document.getElementById(id);
      return e ? num(e.value, d) : d;
    };
    RECONCILERS = {
      surfacing(prog) {
        const down = find(prog, "stepdown"), over = down && down.children && down.children[0], rg = over && over.params && over.params.region;
        if (!down || !over || !rg || !rg.params) return null;
        const tool = formNum("sf_toolDia", 12);
        return {
          sf_originX: rg.params.x,
          sf_originY: rg.params.y,
          sf_w: rg.params.w,
          sf_h: rg.params.h,
          sf_depth: down.params.to,
          sf_stepdown: down.params.by,
          sf_strategy: over.params.strategy === "parallel" ? "raster" : "spiral",
          sf_stepoverPct: tool > 0 ? r3(num(over.params.stepover, 0) / tool * 100) : void 0,
          sf_feed: over.params.feed,
          sf_plunge: over.params.plunge,
          sf_clearance: over.params.clearance
        };
      },
      slot(prog) {
        const s = find(prog, "slot");
        if (!s || !s.params) return null;
        const p = s.params;
        return {
          sl_ax: p.x0,
          sl_ay: p.y0,
          sl_bx: p.x1,
          sl_by: p.y1,
          sl_width: p.width,
          sl_toolDia: p.tool,
          sl_stepoverPct: p.stepoverPct,
          sl_depth: p.depth,
          sl_stepdown: p.stepdown,
          sl_feed: p.feed,
          sl_plunge: p.plunge,
          sl_clearance: p.clearance
        };
      },
      pocket(prog) {
        const down = find(prog, "stepdown");
        if (!down || !Array.isArray(down.children)) return null;
        const over = down.children.find((c2) => c2.type === "stepover"), rg = over && over.params && over.params.region;
        if (!over || !rg || !rg.params) return null;
        const tool = formNum("p_toolDia", 6), r = tool / 2;
        const f = {
          p_shape: rg.params.shape,
          p_depth: down.params.to,
          p_stepdown: down.params.by,
          p_strategy: over.params.strategy === "parallel" ? "raster" : "spiral",
          p_stepoverPct: tool > 0 ? r3(num(over.params.stepover, 0) / tool * 100) : void 0,
          p_feed: over.params.feed,
          p_plunge: over.params.plunge,
          p_clearance: over.params.clearance
        };
        if (rg.params.shape === "circle") {
          f.p_dia = r3(num(rg.params.w, 0) + tool);
          f.p_originX = rg.params.x;
          f.p_originY = rg.params.y;
        } else {
          f.p_w = r3(num(rg.params.w, 0) + tool);
          f.p_h = r3(num(rg.params.h, 0) + tool);
          f.p_originX = r3(num(rg.params.x, 0) - r);
          f.p_originY = r3(num(rg.params.y, 0) - r);
        }
        return f;
      },
      drill(prog) {
        const arr = find(prog, "array");
        if (!arr || !arr.params) return null;
        const p = arr.params, hole = arr.children && arr.children[0];
        const f = { d_pattern: p.pattern, d_originX: p.x0, d_originY: p.y0, d_skip: p.skip || "" };
        if (p.pattern === "circle") {
          f.d_dia = p.dia;
          f.d_count = p.count;
          f.d_startAngle = p.startAngle;
        } else if (p.pattern === "line") {
          f.d_lcount = p.count;
          f.d_spacing = p.spacing;
          f.d_angle = p.angle;
        } else if (p.pattern === "rect") {
          f.d_w = p.w;
          f.d_h = p.h;
          f.d_nx = p.nx;
          f.d_ny = p.ny;
        } else {
          f.d_cols = p.cols;
          f.d_rows = p.rows;
          f.d_dx = p.dx;
          f.d_dy = p.dy;
        }
        if (hole && hole.params) {
          const h = hole.params;
          f.d_method = hole.type === "bore" ? "helical" : "peck";
          f.d_depth = h.depth;
          f.d_feed = h.feed;
          f.d_clearance = h.clearance;
          if (hole.type === "bore") {
            f.d_holeDia = h.holeDia;
            f.d_toolDia = h.toolDia;
            f.d_pitch = h.pitch;
          } else f.d_peck = h.peck;
        }
        return f;
      }
    };
    loadedSig = null;
    shownOp = null;
    sig = (op) => op ? `${op.type}:${JSON.stringify(op.params)}` : null;
    _walk = (arr, fn) => {
      for (const b2 of arr || []) {
        if (!b2) continue;
        fn(b2);
        if (b2.children) _walk(b2.children, fn);
      }
    };
  }
});

// ../DDCS-Studio/web/blocks/programModel.js
function dialectOpts2() {
  try {
    return { dialect: resolveActivePost(getActiveProfile().id) };
  } catch (_) {
    return {};
  }
}
function editor() {
  const s = window.ddcsStudio;
  return s && s.editorManager;
}
function findOpInStack(blocks, anc) {
  for (const b2 of blocks || []) {
    if (!b2) continue;
    if (b2.type === "op" && anc.includes(b2.id)) return b2;
    if (b2.children) {
      const f = findOpInStack(b2.children, anc);
      if (f) return f;
    }
  }
  return null;
}
function opAtLine(i) {
  const anc = proj.map && proj.map[i];
  return anc && anc.length ? findOpInStack(stack, anc) : null;
}
function linesForOp(opId) {
  const out = [];
  (proj.map || []).forEach((anc, i) => {
    if (anc && anc.includes(opId)) out.push(i);
  });
  return out;
}
function editorMatchesProjection() {
  const e = editor();
  return !!(e && e.editor && e.getValue() === proj.text);
}
function onChange(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}
function setStack(next, origin = "api") {
  stack = Array.isArray(next) ? next : [];
  proj = emitMapped(stack, dialectOpts2());
  projectToEditor();
  subs.forEach((fn) => {
    try {
      fn({ stack, proj, origin });
    } catch (_) {
    }
  });
}
function projectToEditor() {
  const e = editor();
  if (!e || !e.editor) return;
  if (proj.text.trim() && e.getValue() !== proj.text && document.activeElement !== e.editor) {
    applying = true;
    try {
      e.setValue(proj.text);
    } finally {
      applying = false;
    }
  }
}
function reconcileFromEditor() {
  const e = editor();
  if (!e || !e.editor) return;
  const text = e.getValue();
  if (text === proj.text) return;
  const ns = reconcileGcodeToStack(text, stack, dialectOpts2());
  if (!ns) return;
  setStack(ns, "editor");
}
function initProgramModel() {
  window.ddcsGetBlockGcode = getGcode;
  window.ddcsGetBlockProgram = getStack;
  window.ddcsLoadBlockStack = (s) => setStack(s, "load");
  window.ddcsRefreshBlocks = () => setStack(stack, "refresh");
  window.ddcsOpAtLine = (i) => editorMatchesProjection() ? opAtLine(i) : null;
  window.ddcsLinesForOp = linesForOp;
  const e = editor();
  if (!e || !e.editor || e.editor.__pmWired) return;
  e.editor.__pmWired = true;
  let deb = null;
  e.editor.addEventListener("input", () => {
    if (applying) return;
    clearTimeout(deb);
    deb = setTimeout(reconcileFromEditor, 500);
  });
  e.editor.addEventListener("blur", () => {
    clearTimeout(deb);
    reconcileFromEditor();
    const cur = editor();
    if (cur && proj.text.trim() && cur.getValue() !== proj.text) {
      applying = true;
      try {
        cur.setValue(proj.text);
      } finally {
        applying = false;
      }
    }
  });
}
var stack, proj, applying, subs, getStack, getGcode;
var init_programModel = __esm({
  "../DDCS-Studio/web/blocks/programModel.js"() {
    init_blockModel();
    init_gcodeToStack();
    init_dialects();
    init_controllerProfiles();
    stack = [];
    proj = { text: "", lines: [], map: [] };
    applying = false;
    subs = /* @__PURE__ */ new Set();
    getStack = () => stack;
    getGcode = () => proj.text;
  }
});

// ../DDCS-Studio/web/blocks/blockly/stackBridge.js
function toRecord(b2) {
  if (b2.type === "op" || b2.type.endsWith("_op")) {
    let meta = {};
    try {
      meta = JSON.parse(b2.data || "{}");
    } catch (_) {
    }
    const params = { ...meta.params || {} };
    if (b2.type === "corner_op") {
      params.corner = b2.getFieldValue("CORNER") || "FL";
      params.probeSeq = b2.getFieldValue("PROBESEQ") || "YX";
      params.wcs = b2.getFieldValue("WCS") || "active";
      params.probeZ = b2.getFieldValue("PROBEZ") === "TRUE";
      params.syncA = b2.getFieldValue("SYNCA") === "TRUE";
      params.slave = b2.getFieldValue("SLAVE") || "3";
      params.qStop = b2.getFieldValue("QSTOP") === "TRUE";
    } else if (b2.type === "edge_op") {
      params.axis = b2.getFieldValue("AXIS") || "X";
      params.dir = b2.getFieldValue("AXISDIR") || "pos";
      params.wcs = b2.getFieldValue("WCS") || "active";
      params.syncA = b2.getFieldValue("SYNCA") === "TRUE";
      params.slave = b2.getFieldValue("SLAVE") || "3";
      params.qStop = b2.getFieldValue("QSTOP") === "TRUE";
    } else if (b2.type === "middle_op") {
      params.featureType = b2.getFieldValue("FEATURETYPE") || "pocket";
      params.axis = b2.getFieldValue("AXIS") || "X";
      params.dir1 = b2.getFieldValue("DIR1") || "pos";
      params.twoAxis = b2.getFieldValue("TWOAXIS") === "TRUE";
      params.dir2 = b2.getFieldValue("DIR2") || "pos";
      params.wcs = b2.getFieldValue("WCS") || "active";
      params.syncA = b2.getFieldValue("SYNCA") === "TRUE";
      params.slave = b2.getFieldValue("SLAVE") || "3";
      params.qStop = b2.getFieldValue("QSTOP") === "TRUE";
    } else if (b2.type === "circular_op") {
      params.featureType = b2.getFieldValue("FEATURETYPE") || "bore";
      params.wcs = b2.getFieldValue("WCS") || "active";
      params.qStop = b2.getFieldValue("QSTOP") === "TRUE";
    } else if (b2.type === "atc_change_op") {
      params.mode = b2.getFieldValue("MODE") || "auto";
      params.waitSpindle = b2.getFieldValue("WAITSPINDLE") === "TRUE";
      params.dustCover = b2.getFieldValue("DUSTCOVER") === "TRUE";
      params.confirm = b2.getFieldValue("CONFIRM") === "TRUE";
    } else if (b2.type === "atc_test_op") {
      params.mode = b2.getFieldValue("MODE") || "current";
      params.waitSpindle = b2.getFieldValue("WAITSPINDLE") === "TRUE";
      params.dustCover = b2.getFieldValue("DUSTCOVER") === "TRUE";
    } else if (b2.type === "atc_check_op") {
      params.waitSpindle = b2.getFieldValue("WAITSPINDLE") === "TRUE";
      params.dustCover = b2.getFieldValue("DUSTCOVER") === "TRUE";
    } else if (b2.type === "wcs_op") {
      params.sys = b2.getFieldValue("SYS") || "0";
      params.axisX = b2.getFieldValue("AXISX") === "TRUE";
      params.axisY = b2.getFieldValue("AXISY") === "TRUE";
      params.axisZ = b2.getFieldValue("AXISZ") === "TRUE";
      params.sync = b2.getFieldValue("SYNC") === "TRUE";
      params.slave = b2.getFieldValue("SLAVE") || "A";
    } else if (b2.type === "comm_op") {
      params.type = b2.getFieldValue("TYPE") || "popup";
      if (params.type === "popup") params.popupMode = b2.getFieldValue("MODE");
      if (params.type === "status") {
        params.statusMode = b2.getFieldValue("MODE");
        params.statusColor = b2.getFieldValue("COLOR");
      }
    }
    const doInput = b2.getInput("DO"), first = doInput && doInput.connection && doInput.connection.targetBlock();
    return {
      id: b2.id,
      type: "op",
      opType: meta.opType,
      label: b2.getFieldValue("LABEL") || meta.label,
      requires: meta.requires || [],
      params,
      children: first ? chain(first) : []
    };
  }
  const def = BLOCKS[b2.type];
  if (!def) return { id: b2.id, type: b2.type, params: {} };
  const r = { id: b2.id, type: b2.type, params: {} };
  for (const f of fieldsOf(def)) {
    const k = fieldKind(def, f), name = FN(f);
    if (k === "value" || k === "region" || k === "boolean") {
      const inp = b2.getInput(name), tgt = inp && inp.connection && inp.connection.targetBlock();
      if (tgt && tgt.isShadow()) r.params[f] = Number(tgt.getFieldValue("NUM"));
      else if (tgt) r.params[f] = toRecord(tgt);
      else r.params[f] = def.defaults[f];
    } else if (k === "checkbox") r.params[f] = b2.getFieldValue(name) === "TRUE";
    else r.params[f] = b2.getFieldValue(name);
  }
  if (isWrap(def)) {
    const doInput = b2.getInput("DO"), first = doInput && doInput.connection && doInput.connection.targetBlock();
    r.children = first ? chain(first) : [];
  }
  return r;
}
function chain(block) {
  const out = [];
  for (let b2 = block; b2; b2 = b2.getNextBlock()) out.push(toRecord(b2));
  return out;
}
function workspaceToStack(ws) {
  const tops = ws.getTopBlocks(true).filter((b2) => {
    const d = BLOCKS[b2.type];
    return !d || d.kind !== "reporter";
  });
  return tops.flatMap((t) => chain(t));
}
function recToJson(rec) {
  if (rec.type === "op") {
    const type = HAS_CUSTOM_OP[rec.opType + "_op"] ? rec.opType + "_op" : "op";
    const node2 = {
      type,
      id: rec.id,
      fields: { LABEL: rec.label || rec.opType || "op" },
      data: JSON.stringify({ opType: rec.opType, params: rec.params || {} })
    };
    if (type === "corner_op") {
      node2.fields.CORNER = rec.params.corner || "FL";
      node2.fields.PROBESEQ = rec.params.probeSeq || "YX";
      node2.fields.WCS = rec.params.wcs || "active";
      node2.fields.PROBEZ = rec.params.probeZ ? "TRUE" : "FALSE";
      node2.fields.SYNCA = rec.params.syncA ? "TRUE" : "FALSE";
      node2.fields.SLAVE = rec.params.slave || "3";
      node2.fields.QSTOP = rec.params.qStop ? "TRUE" : "FALSE";
    } else if (type === "edge_op") {
      node2.fields.AXIS = rec.params.axis || "X";
      node2.fields.AXISDIR = rec.params.dir || "pos";
      node2.fields.WCS = rec.params.wcs || "active";
      node2.fields.SYNCA = rec.params.syncA ? "TRUE" : "FALSE";
      node2.fields.SLAVE = rec.params.slave || "3";
      node2.fields.QSTOP = rec.params.qStop ? "TRUE" : "FALSE";
    } else if (type === "middle_op") {
      node2.fields.FEATURETYPE = rec.params.featureType || "pocket";
      node2.fields.AXIS = rec.params.axis || "X";
      node2.fields.DIR1 = rec.params.dir1 || "pos";
      node2.fields.TWOAXIS = rec.params.twoAxis ? "TRUE" : "FALSE";
      node2.fields.DIR2 = rec.params.dir2 || "pos";
      node2.fields.WCS = rec.params.wcs || "active";
      node2.fields.SYNCA = rec.params.syncA ? "TRUE" : "FALSE";
      node2.fields.SLAVE = rec.params.slave || "3";
      node2.fields.QSTOP = rec.params.qStop ? "TRUE" : "FALSE";
    } else if (type === "circular_op") {
      node2.fields.FEATURETYPE = rec.params.featureType || "bore";
      node2.fields.WCS = rec.params.wcs || "active";
      node2.fields.QSTOP = rec.params.qStop ? "TRUE" : "FALSE";
    } else if (type === "atc_change_op") {
      node2.fields.MODE = rec.params.mode || "auto";
      node2.fields.WAITSPINDLE = rec.params.waitSpindle !== false ? "TRUE" : "FALSE";
      node2.fields.DUSTCOVER = rec.params.dustCover ? "TRUE" : "FALSE";
      node2.fields.CONFIRM = rec.params.confirm ? "TRUE" : "FALSE";
    } else if (type === "atc_test_op") {
      node2.fields.MODE = rec.params.mode || "current";
      node2.fields.WAITSPINDLE = rec.params.waitSpindle !== false ? "TRUE" : "FALSE";
      node2.fields.DUSTCOVER = rec.params.dustCover ? "TRUE" : "FALSE";
    } else if (type === "atc_check_op") {
      node2.fields.WAITSPINDLE = rec.params.waitSpindle !== false ? "TRUE" : "FALSE";
      node2.fields.DUSTCOVER = rec.params.dustCover ? "TRUE" : "FALSE";
    } else if (type === "wcs_op") {
      node2.fields.SYS = rec.params.sys || "0";
      node2.fields.AXISX = rec.params.axisX !== false ? "TRUE" : "FALSE";
      node2.fields.AXISY = rec.params.axisY !== false ? "TRUE" : "FALSE";
      node2.fields.AXISZ = rec.params.axisZ !== false ? "TRUE" : "FALSE";
      node2.fields.SYNC = rec.params.sync ? "TRUE" : "FALSE";
      node2.fields.SLAVE = rec.params.slave || "A";
    } else if (type === "comm_op") {
      node2.fields.TYPE = rec.params.type || "popup";
      node2.fields.MODE = rec.params.type === "status" ? rec.params.statusMode || 1 : rec.params.popupMode || 1;
      node2.fields.COLOR = rec.params.statusColor || -1;
    }
    if (rec.children && rec.children.length) node2.inputs = { DO: { block: chainToJson(rec.children) } };
    return node2;
  }
  const def = BLOCKS[rec.type], node = { type: rec.type };
  if (!def) return node;
  const fields = {}, inputs = {};
  for (const f of fieldsOf(def)) {
    const k = fieldKind(def, f), name = FN(f), v6 = rec.params[f];
    if (k === "value" || k === "region" || k === "boolean") {
      if (v6 && typeof v6 === "object" && v6.type) inputs[name] = { block: recToJson(v6) };
      else if (k === "value" && typeof v6 === "string" && /[#[]/.test(v6)) inputs[name] = { block: { type: "variable", fields: { NAME: v6 } } };
      else if (k === "value") inputs[name] = { shadow: { type: "math_number", fields: { NUM: Number(v6) || 0 } } };
    } else if (k === "checkbox") fields[name] = !!v6;
    else fields[name] = String(v6 ?? "");
  }
  if (isWrap(def) && rec.children && rec.children.length) inputs.DO = { block: chainToJson(rec.children) };
  if (Object.keys(fields).length) node.fields = fields;
  if (Object.keys(inputs).length) node.inputs = inputs;
  return node;
}
function chainToJson(records) {
  let head = null, tail = null;
  for (const c2 of records || []) {
    const j = recToJson(c2);
    if (head) tail.next = { block: j };
    else head = j;
    tail = j;
  }
  return head;
}
function stackToWorkspace(stack2, ws) {
  const B = getBlockly();
  const head = chainToJson(stack2 || []);
  if (!head) {
    ws.clear();
    return;
  }
  head.x = 24;
  head.y = 24;
  B.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [head] } }, ws);
}
var HAS_CUSTOM_OP;
var init_stackBridge = __esm({
  "../DDCS-Studio/web/blocks/blockly/stackBridge.js"() {
    init_ops();
    init_bridge();
    HAS_CUSTOM_OP = {};
    OP_BLOCKS.forEach((b2) => HAS_CUSTOM_OP[b2.type] = true);
  }
});

// ../DDCS-Studio/web/ui/gateway/util.js
function el2(tag2, attrs = {}, ...kids) {
  const n = document.createElement(tag2);
  for (const [k, v6] of Object.entries(attrs || {})) {
    if (v6 === null || v6 === void 0) continue;
    if (k === "class") n.className = v6;
    else if (k === "html") n.innerHTML = v6;
    else if (k.startsWith("on") && typeof v6 === "function") n.addEventListener(k.slice(2), v6);
    else n.setAttribute(k, v6);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === void 0 || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}
function toast(msg, bad = false) {
  const t = el2("div", { class: "toast" + (bad ? " bad" : "") }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
var clear, fmtEta;
var init_util2 = __esm({
  "../DDCS-Studio/web/ui/gateway/util.js"() {
    clear = (n) => {
      while (n.firstChild) n.removeChild(n.firstChild);
    };
    fmtEta = (s) => s === null || s === void 0 ? "\u2014" : s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s` : `${s}s`;
  }
});

// ../DDCS-Studio/web/ui/gatewayStatus.js
var EXE_DOWNLOAD_URL;
var init_gatewayStatus = __esm({
  "../DDCS-Studio/web/ui/gatewayStatus.js"() {
    init_client();
    EXE_DOWNLOAD_URL = "https://github.com/fchabot-dxf/DDCS-Studio/releases/latest";
  }
});

// ../DDCS-Studio/web/ui/gateway/views/status.js
var status_default;
var init_status = __esm({
  "../DDCS-Studio/web/ui/gateway/views/status.js"() {
    init_util2();
    init_client();
    init_gatewayStatus();
    status_default = {
      id: "status",
      label: "Status",
      mount(ctx2) {
        this.conn = el2("section", { class: "block" });
        this.desc = el2("section", { class: "block" });
        this.vars = el2("section", { class: "block" });
        ctx2.root.append(this.conn, this.desc, this.vars);
        this.onPoll(ctx2);
      },
      async onPoll(ctx2) {
        let d = null;
        try {
          d = await ctx2.client.descriptor();
        } catch {
          d = null;
        }
        const s = deriveStatus(ctx2.client, d);
        this.conn.replaceChildren(
          el2("div", { class: "section-label" }, "Connection"),
          el2(
            "div",
            { class: "row" },
            el2("span", { class: "dot " + (s.dot || "bad") }),
            el2("span", { class: "job" }, s.label || "unreachable"),
            s.device ? el2("span", { class: "muted" }, "\xB7 " + s.device) : null
          )
        );
        this.desc.replaceChildren(el2("div", { class: "section-label" }, "Controller"));
        if (!d) {
          this.desc.append(
            el2("div", { class: "muted" }, "No gateway answering. Connect one in the Console tab (a local daemon or a service URL), or:"),
            el2("a", {
              class: "op-btn",
              href: EXE_DOWNLOAD_URL,
              target: "_blank",
              rel: "noopener",
              style: "margin-top:10px;display:inline-block;text-decoration:none"
            }, "\u2B07 Get DDCS Studio for desktop")
          );
        } else {
          const rows = [
            ["machine", d.machine_name || deviceName(d) || "\u2014"],
            ["controller disk", d.dest || "\u2014"],
            ["connected", d.controller_connected ? "yes" : "online" in d ? d.online ? "cloud" : "offline" : "no"],
            ["backend", d.backend || "\u2014"],
            ["gateway version", d.version || "\u2014"]
          ];
          const tbl = el2("table");
          for (const [k, v7] of rows) tbl.append(el2("tr", {}, el2("td", {}, k), el2("td", { class: "mono" }, String(v7))));
          this.desc.append(tbl);
        }
        this.vars.replaceChildren(el2("div", { class: "section-label" }, "Live values  (read-only)"));
        let v6 = null;
        try {
          v6 = await ctx2.client.readVars([]);
        } catch {
          v6 = null;
        }
        const entries = v6 && typeof v6 === "object" ? Object.entries(v6.values || v6) : [];
        if (!entries.length) {
          this.vars.append(el2("div", { class: "muted" }, "no watch list (set one on the gateway)"));
          return;
        }
        const grid = el2("div", { class: "grid-3" });
        for (const [k, val2] of entries.slice(0, 12))
          grid.append(el2("div", { class: "stat" }, el2("div", { class: "k" }, k), el2("div", { class: "v" }, String(val2))));
        this.vars.append(grid);
      }
    };
  }
});

// ../DDCS-Studio/web/shared/js/instrument/gcode-parse.js
function stripComment(line2) {
  const out = [];
  let depth = 0;
  for (const ch of line2) {
    if (depth === 0 && ch === ";") break;
    if (ch === "(") {
      depth++;
      out.push(" ");
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      out.push(" ");
    } else out.push(depth ? " " : ch);
  }
  return out.join("");
}
function opLabel(line2) {
  const m = line2.match(/\(([^()]*)\)/);
  if (m && !stripComment(line2).trim()) return m[1].trim();
  return null;
}
function scan(lines, { rapid = 6e3, defaultFeed = 1e3, zupEps = 1e-4 } = {}) {
  let x = 0, y = 0, z = 0, have = false, feed = 0, mode = null, curOp = null, cum = 0;
  const moves = [];
  for (let i = 0; i < lines.length; i++) {
    const raw2 = lines[i];
    const lab = opLabel(raw2);
    if (lab !== null) curOp = lab;
    const code = stripComment(raw2);
    const words = [...code.matchAll(WORD)];
    if (!words.length) continue;
    let nx = x, ny = y, nz = z, saw = false;
    for (const [, letter, val2] of words) {
      const u = letter.toUpperCase();
      const v6 = parseFloat(val2);
      if (u === "G" && [0, 1, 2, 3].includes(v6)) mode = v6 | 0;
      else if (u === "X") {
        nx = v6;
        saw = true;
      } else if (u === "Y") {
        ny = v6;
        saw = true;
      } else if (u === "Z") {
        nz = v6;
        saw = true;
      } else if (u === "F") feed = v6;
    }
    if (!saw || mode === null) {
      x = nx;
      y = ny;
      z = nz;
      continue;
    }
    if (!have) {
      x = nx;
      y = ny;
      z = nz;
      have = true;
      continue;
    }
    const dist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2 + (nz - z) ** 2);
    const rate = mode === 0 ? rapid : feed > 0 ? feed : defaultFeed;
    cum += rate > 0 ? dist / rate * 60 : 0;
    moves.push({ idx: i, cumT: cum, zup: nz - z > zupEps, op: curOp });
    x = nx;
    y = ny;
    z = nz;
  }
  return { moves, totalTime: cum };
}
var WORD;
var init_gcode_parse = __esm({
  "../DDCS-Studio/web/shared/js/instrument/gcode-parse.js"() {
    WORD = /([A-Za-z])\s*([-+]?\d*\.?\d+)/g;
  }
});

// ../DDCS-Studio/web/shared/js/instrument/instrument.js
function findM30(lines) {
  for (let i = 0; i < lines.length; i++) if (/\bM30\b/.test(stripComment(lines[i]))) return i;
  return null;
}
function chooseByTime(zups, totalT, max) {
  if (!zups.length || totalT <= 0) return zups.slice(0, max);
  const step = totalT / max;
  const chosen = [];
  let nxt = step;
  for (const m of zups) {
    if (m.cumT >= nxt) {
      chosen.push(m);
      while (nxt <= m.cumT) nxt += step;
      if (chosen.length >= max) break;
    }
  }
  return chosen;
}
function chooseByLine(zups, max) {
  if (zups.length <= max) return zups.slice();
  const chosen = [];
  const step = zups.length / max;
  for (let k = 1; k <= max; k++) chosen.push(zups[Math.min(zups.length - 1, Math.round(k * step) - 1)]);
  return chosen.filter((m, i) => i === 0 || m !== chosen[i - 1]);
}
function instrument(text, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const source = opts.source || "job.nc";
  const lines = text.split(/\r?\n/);
  const { moves, totalTime } = scan(lines, { rapid: o.rapid, defaultFeed: o.defaultFeed });
  const zups = moves.filter((m) => m.zup);
  const reserve = o.max - 1;
  const chosen = o.pacing === "line" ? chooseByLine(zups, reserve) : chooseByTime(zups, totalTime, reserve);
  const m30 = findM30(lines);
  const inserts = /* @__PURE__ */ new Map();
  const add = (idx, item) => {
    (inserts.get(idx) || inserts.set(idx, []).get(idx)).push(item);
  };
  for (const m of chosen) add(m.idx, { kind: "beacon", op: m.op, cumT: m.cumT });
  if (m30 !== null) add(m30 - 1, { kind: "complete", op: chosen.length ? chosen[chosen.length - 1].op : null, cumT: totalTime });
  const out = [];
  let n = 0, markerDone = false;
  const beacons = [];
  const firstBeaconLine = chosen.length ? chosen[0].idx : m30 ? m30 - 1 : null;
  const mset = msetdataCall(o.varNum);
  for (let i = 0; i < lines.length; i++) {
    if (!markerDone && firstBeaconLine !== null && i === firstBeaconLine) {
      out.push(`#${o.markerVar} = ${o.marker}`);
      markerDone = true;
    }
    out.push(lines[i]);
    for (const { kind, op, cumT } of inserts.get(i) || []) {
      n++;
      out.push(`#${o.varNum} = ${n}`);
      out.push(mset);
      beacons.push({
        n,
        orig_line: i + 1,
        op,
        cum_time_s: r2(cumT),
        percent: totalTime > 0 ? r1(100 * cumT / totalTime) : null,
        complete: kind === "complete"
      });
    }
  }
  const map = {
    source,
    var: o.varNum,
    marker_var: o.markerVar,
    marker: o.marker,
    msetdata: mset,
    total_est_time_s: r2(totalTime),
    total_beacons: n,
    beacons
  };
  return { nc: out.join("\n") + "\n", map };
}
var DEFAULTS, msetdataCall, r2, r1;
var init_instrument = __esm({
  "../DDCS-Studio/web/shared/js/instrument/instrument.js"() {
    init_gcode_parse();
    DEFAULTS = {
      max: 255,
      varNum: 250,
      markerVar: 251,
      marker: 111,
      pacing: "time",
      rapid: 6e3,
      defaultFeed: 1e3
    };
    msetdataCall = (varNum = 250) => `MSETDATA[${varNum},1,0,2,16,300]`;
    r2 = (x) => Math.round(x * 100) / 100;
    r1 = (x) => Math.round(x * 10) / 10;
  }
});

// ../DDCS-Studio/web/ui/gateway/views/send.js
var field2, int, clampInt, send_default;
var init_send = __esm({
  "../DDCS-Studio/web/ui/gateway/views/send.js"() {
    init_util2();
    init_instrument();
    field2 = (labelText, control) => el2("div", {}, el2("span", { class: "label" }, labelText), control);
    int = (v6, d) => {
      const n = parseInt(v6, 10);
      return Number.isFinite(n) ? n : d;
    };
    clampInt = (v6, lo, hi, d) => Math.min(hi, Math.max(lo, int(v6, d)));
    send_default = {
      id: "send",
      label: "Send",
      mount(ctx2) {
        let file = { name: "", text: "" };
        const drop = el2("div", { class: "drop" }, "\u2913  Drop a .nc here, or click to choose");
        const input = el2("input", { type: "file", accept: ".nc,.tap,.txt,.gcode", style: "display:none" });
        const useStudio = el2("button", { class: "op-btn" }, "\u2B06 Use current Studio program");
        const nameField = el2("input", { type: "text", placeholder: "job name (e.g. bracket_v3.nc)", style: "flex:1" });
        const beacons = el2("input", { type: "checkbox", checked: "" });
        const count = el2("input", { type: "number", value: String(DEFAULTS.max), min: "1", max: "255", style: "width:90px" });
        const pacing = el2(
          "select",
          {},
          el2("option", { value: "time" }, "by time (wall-clock)"),
          el2("option", { value: "line" }, "by line count")
        );
        const varN = el2("input", { type: "number", value: String(DEFAULTS.varNum), style: "width:70px" });
        const markerV = el2("input", { type: "number", value: String(DEFAULTS.markerVar), style: "width:70px" });
        const markerN = el2("input", { type: "number", value: String(DEFAULTS.marker), style: "width:70px" });
        const settings = el2(
          "div",
          { class: "block" },
          el2("div", { class: "grid-2" }, field2("Beacon count (1\u2013255)", count), field2("Pacing", pacing)),
          el2(
            "details",
            {},
            el2("summary", { class: "muted", style: "cursor:pointer;margin:8px 0" }, "advanced \u2014 var / marker (rarely changed; the frame is proven)"),
            el2("div", { class: "grid-3" }, field2("counter var", varN), field2("marker var", markerV), field2("marker value", markerN))
          )
        );
        const btn = el2("button", { class: "primary", disabled: "" }, "Send (tracked)");
        const info = el2("div", { class: "hint" });
        const accept = (name, text) => {
          file = { name, text };
          nameField.value = name;
          drop.textContent = `\u2713 ${name} (${text.length} bytes)`;
          btn.disabled = !text;
        };
        const sync = () => {
          settings.classList.toggle("hidden", !beacons.checked);
          btn.textContent = beacons.checked ? "Send (tracked)" : "Send (deliver-only)";
        };
        beacons.onchange = sync;
        const load = (f) => {
          const r = new FileReader();
          r.onload = () => accept(f.name, String(r.result));
          r.readAsText(f);
        };
        drop.onclick = () => input.click();
        input.onchange = (e) => e.target.files[0] && load(e.target.files[0]);
        drop.ondragover = (e) => {
          e.preventDefault();
          drop.classList.add("over");
        };
        drop.ondragleave = () => drop.classList.remove("over");
        drop.ondrop = (e) => {
          e.preventDefault();
          drop.classList.remove("over");
          e.dataTransfer.files[0] && load(e.dataTransfer.files[0]);
        };
        useStudio.onclick = () => {
          const text = (document.getElementById("editor")?.value || "").trim();
          if (!text) {
            toast("Studio editor is empty", true);
            return;
          }
          accept("studio-program.nc", text);
        };
        btn.onclick = async () => {
          const name = (nameField.value || file.name || "job.nc").trim();
          btn.disabled = true;
          try {
            let nc = file.text, map;
            if (beacons.checked) {
              const res = instrument(file.text, {
                max: clampInt(count.value, 1, 255, DEFAULTS.max),
                pacing: pacing.value,
                varNum: int(varN.value, DEFAULTS.varNum),
                markerVar: int(markerV.value, DEFAULTS.markerVar),
                marker: int(markerN.value, DEFAULTS.marker),
                source: name
              });
              nc = res.nc;
              map = res.map;
            }
            const r = await ctx2.client.submitJob(name, nc, map);
            toast("Queued " + r.jobId);
            info.textContent = `Queued ${r.jobId} \u2014 ${r.tracked ? `tracked (${map.total_beacons} beacons, est ${map.total_est_time_s}s)` : "deliver-only"}`;
          } catch (e) {
            toast("Send failed: " + e.message, true);
          } finally {
            btn.disabled = false;
          }
        };
        ctx2.root.append(el2(
          "section",
          { class: "block" },
          el2("div", { class: "section-label" }, "Send a program"),
          drop,
          input,
          el2("div", { class: "row", style: "margin-top:10px" }, useStudio),
          el2(
            "div",
            { class: "row", style: "margin-top:12px" },
            el2("label", { class: "row", style: "gap:6px;cursor:pointer" }, beacons, "Beacons (track progress)")
          ),
          settings,
          el2("div", { class: "row", style: "margin-top:12px" }, nameField, btn),
          info,
          el2(
            "div",
            { class: "wiz-usage" },
            "Beacons ON instruments the job for progress tracking; OFF = deliver-only (probe / util macros). The operator presses Cycle Start at the machine."
          )
        ));
        sync();
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gateway/views/merge.js
var merge_default;
var init_merge = __esm({
  "../DDCS-Studio/web/ui/gateway/views/merge.js"() {
    init_util2();
    merge_default = {
      id: "merge",
      label: "Merge",
      mount(ctx2) {
        const list2 = el2("div", { class: "block muted" }, "No programs added yet.");
        const addStudio = el2("button", { class: "op-btn" }, "\u2B06 Add current Studio program");
        const drop = el2("div", { class: "drop" }, "\u2913  Drop .nc files to merge  (coming soon)");
        const mergeBtn = el2("button", { class: "primary", disabled: "" }, "Merge into one job");
        const todo = () => toast("Multi-tool merge is a stub \u2014 not wired yet");
        addStudio.onclick = todo;
        drop.onclick = todo;
        ctx2.root.append(el2(
          "section",
          { class: "block" },
          el2("div", { class: "section-label" }, "Multi-tool job merge"),
          el2(
            "div",
            { class: "wiz-usage" },
            "Combine several single-tool programs into one job: ordered by tool, with a tool change (T / M6) and a safe retract inserted between each, under one program frame (a single end). Pull ops from Studio or pick controller files, set the tool order, then merge + send as one multi-tool run."
          ),
          el2("div", { class: "row", style: "margin-top:10px" }, addStudio),
          drop,
          list2,
          el2("div", { class: "row", style: "margin-top:12px" }, mergeBtn),
          el2("div", { class: "hint" }, "Stub \u2014 UI placeholder; merge logic not implemented yet.")
        ));
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gateway/views/tracker.js
var stat, tracker_default;
var init_tracker = __esm({
  "../DDCS-Studio/web/ui/gateway/views/tracker.js"() {
    init_util2();
    stat = (k, v6) => el2(
      "div",
      { class: "bt-stat" },
      el2("div", { class: "k" }, k),
      el2("div", { class: "v" }, v6)
    );
    tracker_default = {
      id: "tracker",
      label: "Tracking",
      mount(ctx2) {
        this.wrap = el2("section", { class: "block bigtrack" });
        ctx2.root.append(this.wrap);
        this.onPoll(ctx2);
      },
      async onPoll(ctx2) {
        let items = [];
        try {
          items = await ctx2.client.listQueue();
        } catch {
          return;
        }
        const active2 = items.filter((i) => ["running", "delivered", "stalled"].includes(i.state)).sort((a, b2) => a.jobId < b2.jobId ? 1 : -1)[0];
        this.render(active2);
      },
      render(j) {
        const c2 = this.wrap;
        if (!j) {
          c2.replaceChildren(
            el2("div", { class: "bt-idle" }, "IDLE"),
            el2(
              "div",
              { class: "muted", style: "text-align:center" },
              "No active job \u2014 it appears here on delivery."
            )
          );
          return;
        }
        const pct = Math.round(j.percent ?? 0);
        const fill = el2("div", { class: "bt-fill" });
        fill.style.width = pct + "%";
        c2.replaceChildren(
          el2(
            "div",
            { class: "bt-top" },
            el2("span", { class: "bt-job" }, j.name || j.jobId),
            el2("span", { class: "bt-state s-" + j.state }, (j.state || "").toUpperCase())
          ),
          el2("div", { class: "bt-pct" }, pct + "%"),
          el2("div", { class: "bt-bar" }, fill),
          el2(
            "div",
            { class: "bt-stats" },
            stat("ETA", fmtEta(j.eta_s)),
            stat("Operation", j.op || "\u2014"),
            stat("Line", j.line != null ? String(j.line) : "\u2014"),
            stat("Beacon", j.last_beacon ? `${j.last_beacon}/${j.total_beacons ?? "?"}` : "\u2014")
          )
        );
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gateway/views/files.js
var files_default;
var init_files = __esm({
  "../DDCS-Studio/web/ui/gateway/views/files.js"() {
    init_util2();
    files_default = {
      id: "files",
      label: "Files (CNCDISK)",
      mount(ctx2) {
        this.list = el2("section", { class: "block" });
        this.viewer = el2("section", { class: "block hidden" });
        ctx2.root.append(this.list, this.viewer);
        this.onPoll(ctx2);
      },
      async onPoll(ctx2) {
        let idx;
        try {
          idx = await ctx2.client.listFiles();
        } catch {
          return;
        }
        const c2 = this.list;
        c2.replaceChildren(el2("div", { class: "section-label" }, "CNCDISK \xB7 " + (idx.path || "")));
        if (idx.error) {
          c2.append(el2("div", { class: "muted" }, "unreachable: " + idx.error));
          return;
        }
        if (!idx.files.length) {
          c2.append(el2("div", { class: "muted" }, "(empty)"));
          return;
        }
        const tbl = el2("table", {}, el2("tr", {}, el2("th", {}, "name"), el2("th", {}, "size"), el2("th", {}, "")));
        for (const f of idx.files) {
          tbl.append(el2(
            "tr",
            {},
            el2("td", { class: "mono" }, f.name),
            el2("td", { class: "mono" }, String(f.size)),
            el2("td", {}, el2(
              "div",
              { class: "row" },
              el2("button", { class: "op-btn", onclick: () => this.view(ctx2, f.name) }, "view"),
              el2("button", { class: "op-btn danger", onclick: () => this.del(ctx2, f.name) }, "delete")
            ))
          ));
        }
        c2.append(tbl);
      },
      async del(ctx2, name) {
        if (!confirm(`Delete ${name} from the controller?`)) return;
        try {
          const r = await ctx2.client.deleteFile(name);
          r.ok ? toast("Deleted " + name) : toast("Delete refused: " + r.error, true);
          this.onPoll(ctx2);
        } catch (e) {
          toast("Delete failed: " + e.message, true);
        }
      },
      async view(ctx2, name) {
        try {
          const r = await ctx2.client.readFile(name);
          const v6 = this.viewer;
          v6.classList.remove("hidden");
          v6.replaceChildren();
          if (!r.ok) {
            v6.append(el2("div", { class: "muted" }, "cannot read: " + r.error));
            return;
          }
          v6.append(
            el2(
              "div",
              { class: "row spread" },
              el2("div", { class: "section-label" }, "G-code \xB7 " + name),
              el2("button", { class: "op-btn", onclick: () => v6.classList.add("hidden") }, "close")
            ),
            el2("div", { class: "preview-block" }, el2("pre", {}, r.content))
          );
        } catch (e) {
          toast("Read failed: " + e.message, true);
        }
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gateway/views/jobs.js
var fmtWhen, jobs_default;
var init_jobs = __esm({
  "../DDCS-Studio/web/ui/gateway/views/jobs.js"() {
    init_util2();
    fmtWhen = (iso) => iso ? iso.replace("T", " ").replace("Z", "") : "\u2014";
    jobs_default = {
      id: "jobs",
      label: "Jobs",
      mount(ctx2) {
        this.queue = el2("section", { class: "block" });
        this.events = el2("section", { class: "block" });
        this.history = el2("section", { class: "block" });
        ctx2.root.append(this.queue, this.events, this.history);
        this.onPoll(ctx2);
      },
      async onPoll(ctx2) {
        let items = [];
        try {
          items = await ctx2.client.listQueue();
        } catch {
        }
        this.renderQueue(items);
        const active2 = items.filter((i) => ["running", "delivered", "stalled"].includes(i.state)).sort((a, b2) => a.jobId < b2.jobId ? 1 : -1)[0];
        this.renderEvents(active2);
        let rows = [];
        try {
          rows = await ctx2.client.listHistory();
        } catch {
        }
        this.renderHistory(rows);
      },
      renderQueue(items) {
        const c2 = this.queue;
        c2.replaceChildren(el2("div", { class: "section-label" }, "Queue"));
        if (!items || !items.length) {
          c2.append(el2("div", { class: "muted" }, "empty"));
          return;
        }
        for (const j of items)
          c2.append(el2(
            "div",
            { class: "q" },
            el2("span", { class: "pill " + (j.state || "queued") }, j.state || "queued"),
            el2("span", { class: "mono" }, j.name || j.jobId)
          ));
      },
      renderEvents(j) {
        const c2 = this.events;
        c2.replaceChildren(el2("div", { class: "section-label" }, "Events"));
        const ev = j && j.events || [];
        if (!ev.length) {
          c2.append(el2("div", { class: "muted" }, "\u2014"));
          return;
        }
        const ul = el2("ul", { class: "log" });
        [...ev].reverse().forEach((e) => ul.append(el2("li", {}, e)));
        c2.append(ul);
      },
      renderHistory(rows) {
        const c2 = this.history;
        c2.replaceChildren(el2("div", { class: "section-label" }, "History"));
        if (!rows || !rows.length) {
          c2.append(el2("div", { class: "muted" }, "no finished jobs yet"));
          return;
        }
        const tbl = el2("table", {}, el2(
          "tr",
          {},
          el2("th", {}, "job"),
          el2("th", {}, "result"),
          el2("th", {}, "duration"),
          el2("th", {}, "finished")
        ));
        for (const r of rows) {
          tbl.append(el2(
            "tr",
            {},
            el2("td", { class: "mono" }, r.name || r.jobId),
            el2("td", {}, el2("span", { class: "pill " + (r.final_state || "") }, r.final_state || "\u2014")),
            el2("td", { class: "mono" }, r.duration_s == null ? "\u2014" : fmtEta(r.duration_s)),
            el2("td", { class: "mono" }, fmtWhen(r.ended_at))
          ));
        }
        c2.append(tbl);
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gateway/service.js
function getService() {
  let base = "", token2 = "";
  try {
    base = localStorage.getItem(BASE_KEY) || "";
    token2 = localStorage.getItem(TOK_KEY) || "";
  } catch {
  }
  return { mode: base ? "cloud" : "local", base, token: token2 };
}
function setService({ base = "", token: token2 = "" } = {}) {
  try {
    if (base) localStorage.setItem(BASE_KEY, base);
    else localStorage.removeItem(BASE_KEY);
    if (token2) localStorage.setItem(TOK_KEY, token2);
    else localStorage.removeItem(TOK_KEY);
  } catch {
  }
}
var BASE_KEY, TOK_KEY;
var init_service = __esm({
  "../DDCS-Studio/web/ui/gateway/service.js"() {
    BASE_KEY = "ddcs_api";
    TOK_KEY = "ddcs_token";
  }
});

// ../DDCS-Studio/web/ui/gateway/views/admin.js
var admin_default;
var init_admin = __esm({
  "../DDCS-Studio/web/ui/gateway/views/admin.js"() {
    init_util2();
    init_service();
    admin_default = {
      id: "admin",
      label: "Console",
      async mount(ctx2) {
        this.serviceCard = el2("section", { class: "block" });
        this.card = el2("section", { class: "block" });
        ctx2.root.append(this.serviceCard, this.card);
        this.renderService(ctx2);
        await this.render(ctx2);
      },
      // Optional cloud-service picker — CLIENT-side: which /api the Gateway talks to. Local-first by default so
      // users stay autonomous (no service needed); pointing at a service just sets ddcs_api/ddcs_token (service.js).
      // Always rendered, even when no gateway answers, so you can re-point at a different service.
      renderService(ctx2) {
        const svc = getService();
        const baseIn = el2("input", { type: "text", value: svc.base, placeholder: "https://your-service.example/  (Cloudflare / self-host)", style: "width:100%" });
        const tokIn = el2("input", { type: "text", value: svc.token, placeholder: "access token (optional)", style: "width:100%" });
        const localGw = el2("button", { class: "op-btn" }, "\u21A9 Use local gateway (127.0.0.1:8765)");
        localGw.onclick = () => {
          baseIn.value = "http://127.0.0.1:8765";
          tokIn.value = "";
        };
        const cloudFields = el2(
          "div",
          { class: "block" },
          el2("div", { class: "row" }, localGw),
          el2("div", { style: "margin-top:8px" }, el2("span", { class: "label" }, "Service URL"), baseIn),
          el2("div", { style: "margin-top:8px" }, el2("span", { class: "label" }, "Access token"), tokIn),
          el2(
            "div",
            { class: "hint" },
            "Same PC: point at http://127.0.0.1:<port> \u2014 the hosted page reaches a local gateway (localhost is allowed even from HTTPS; the gateway already sends CORS). Other PC / remote: the gateway needs HTTPS or a tunnel (browsers block an HTTPS page \u2192 http:// on a LAN IP)."
          )
        );
        const local = el2("input", { type: "radio", name: "gw-svc" });
        local.checked = svc.mode === "local";
        const cloud = el2("input", { type: "radio", name: "gw-svc" });
        cloud.checked = svc.mode === "cloud";
        const sync = () => cloudFields.classList.toggle("hidden", !cloud.checked);
        local.onchange = cloud.onchange = sync;
        const gdrive = el2("button", { class: "op-btn", disabled: "" }, "\u{1F517} Connect Google Drive (OAuth) \u2014 coming soon");
        const apply = el2("button", { class: "primary" }, "Apply");
        apply.onclick = () => {
          setService(cloud.checked ? { base: baseIn.value.trim(), token: tokIn.value.trim() } : {});
          toast("Service updated \u2014 reloading");
          setTimeout(() => location.reload(), 400);
        };
        this.serviceCard.replaceChildren(
          el2("div", { class: "section-label" }, "Service (optional)"),
          el2(
            "div",
            { class: "wiz-usage" },
            "Local-first: by default the Gateway uses the gateway on this PC \u2014 no account, fully autonomous. Optionally point it at a cloud service (your own Cloudflare / self-host endpoint now; OAuth'd cloud storage like Google Drive later). Clearing it returns to local."
          ),
          el2("label", { class: "row", style: "gap:6px;cursor:pointer;margin-top:8px" }, local, "Local (this PC) \u2014 autonomous"),
          el2("label", { class: "row", style: "gap:6px;cursor:pointer" }, cloud, "Cloud service"),
          cloudFields,
          el2("div", { class: "row", style: "margin-top:8px" }, gdrive),
          el2("div", { class: "row", style: "margin-top:12px" }, apply)
        );
        sync();
      },
      async render(ctx2) {
        let d;
        try {
          d = await ctx2.client.descriptor();
        } catch {
          this.card.replaceChildren(el2("div", { class: "muted" }, "gateway unreachable"));
          return;
        }
        if ("online" in d) return this.renderCloud(d);
        let cfg = {};
        try {
          cfg = await ctx2.client.getConfig();
        } catch {
        }
        let prof = null;
        try {
          prof = await ctx2.client.profile();
        } catch {
        }
        this.renderSetup(ctx2, d, cfg, prof);
      },
      renderCloud(d) {
        const rows = [
          ["machine name", d.machine_name || "\u2014"],
          ["controller", d.dest || "\u2014"],
          ["gateway online", d.online ? "yes" : "no"],
          ["controller connected", d.controller_connected ? "yes" : "no"],
          ["backend", d.backend]
        ];
        const tbl = el2("table");
        for (const [k, v6] of rows) tbl.append(el2("tr", {}, el2("td", {}, k), el2("td", { class: "mono" }, String(v6))));
        this.card.replaceChildren(
          el2("div", { class: "section-label" }, "Gateway (cloud view)"),
          tbl,
          el2(
            "div",
            { class: "wiz-usage" },
            "This is the cloud console \u2014 it can't configure the gateway (the gateway is outbound-only). Set it up in the Setup tab of the gateway's own console, on the machine PC."
          )
        );
      },
      // Controller-profile card: what hardware the connected controller actually reports, and whether it
      // matches the expected baseline. Source "controller" = read live off the machine; "builtin" = the
      // fallback baseline (controller not read). Validation surfaces a wrong share / decode / ATC-misconfig.
      profileBlock(prof) {
        const wrap = el2(
          "section",
          { style: "margin-top:18px" },
          el2("div", { class: "section-label" }, "Controller profile")
        );
        if (!prof) {
          wrap.append(el2("div", { class: "muted" }, "controller not read \u2014 connect the controller to detect its hardware"));
          return wrap;
        }
        const live = prof.source === "controller";
        wrap.append(el2(
          "div",
          { class: "row", style: "gap:8px;align-items:center" },
          el2("span", {}, prof.name || prof.id || "\u2014"),
          el2(
            "span",
            { class: "mono muted", style: "font-size:11px;border:1px solid #3a3a3a;border-radius:4px;padding:1px 6px" },
            live ? "from controller" : "builtin baseline"
          )
        ));
        const tabs = prof.hardwareTabs || [];
        const chips = el2(
          "div",
          { class: "row", style: "gap:6px;margin-top:8px;flex-wrap:wrap" },
          el2("span", { class: "muted", style: "font-size:12px" }, "tabs:")
        );
        if (tabs.length) {
          for (const t of tabs) chips.append(el2(
            "span",
            { style: "font-size:11px;background:#26331f;color:#9fd17a;border-radius:4px;padding:1px 7px" },
            t
          ));
        } else chips.append(el2("span", { class: "muted", style: "font-size:12px" }, "none"));
        wrap.append(chips);
        const p = prof.pins;
        if (p) {
          const lvl = (n) => n === 1 ? "P" : "N";
          const parts = [];
          if (p.probe) parts.push(`probe IN${p.probe} (${lvl(p.probeLevel)})`);
          if (p.setter) parts.push(`setter IN${p.setter} (${lvl(p.setterLevel)})`);
          const lim = Object.keys(p.limits || {}).length;
          if (lim) parts.push(`${lim} limit input${lim > 1 ? "s" : ""}`);
          if (parts.length) wrap.append(el2("div", { class: "muted mono", style: "font-size:12px;margin-top:6px" }, parts.join("  \xB7  ")));
        }
        const v6 = prof.validation;
        if (live && v6) {
          if (v6.ok) {
            wrap.append(el2(
              "div",
              { class: "row", style: "gap:6px;margin-top:10px" },
              el2("span", { class: "dot ok" }),
              el2(
                "span",
                { style: "font-size:12px" },
                `matches baseline (${v6.paramCount} params, anchors OK)`
              )
            ));
          } else {
            wrap.append(el2(
              "div",
              { class: "row", style: "gap:6px;margin-top:10px" },
              el2("span", { class: "dot warn" }),
              el2("span", { style: "font-size:12px" }, "profile mismatch")
            ));
            for (const w2 of v6.warnings || []) wrap.append(el2("div", { class: "hint", style: "color:#d1a35a" }, "\u2022 " + w2));
          }
        }
        return wrap;
      },
      renderSetup(ctx2, d, cfg, prof) {
        const dest = cfg.dest || "";
        const isRemote = dest.startsWith("\\\\") || dest.startsWith("//");
        const statusText = !dest ? "no controller set \u2014 enter the controller disk below" : !isRemote ? "sandbox (local folder)" : d.controller_connected ? "live \u2014 connected to " + dest : "controller offline \u2014 " + dest + " not reachable";
        const statusDot = !dest || !isRemote || !d.controller_connected ? "warn" : "ok";
        const name = el2("input", { type: "text", value: cfg.machine_name || "", placeholder: "e.g. Ultimate Bee" });
        const destField = el2("input", { type: "text", value: dest, placeholder: "\\\\10.0.0.50\\cncdisk", style: "width:100%" });
        const beacons = el2("input", { type: "checkbox" });
        beacons.checked = !!cfg.enable_slave;
        const lan = el2("input", { type: "checkbox" });
        lan.checked = cfg.host === "0.0.0.0";
        const lanUrl = cfg.lan_ip ? `http://${cfg.lan_ip}:${cfg.port || 8765}` : "";
        const lanHint = el2(
          "span",
          { class: "hint" },
          lan.checked && lanUrl ? `On your phone/tablet, open ${lanUrl}` : "Off = this PC only."
        );
        lan.onchange = () => {
          lanHint.textContent = lan.checked ? lanUrl ? `On your phone/tablet, open ${lanUrl}` : "LAN address unavailable \u2014 check after restart." : "Off = this PC only.";
        };
        const PORTS = [8765, 8766, 8767, 8768, 8769];
        const portSel = el2("select", {}, PORTS.map((p) => el2("option", { value: String(p) }, String(p))));
        portSel.value = String(cfg.port || 8765);
        const save = el2("button", { class: "primary" }, "Save");
        const info = el2("div", { class: "hint" });
        save.onclick = async () => {
          save.disabled = true;
          try {
            const r = await ctx2.client.setConfig({
              machine_name: name.value,
              dest: destField.value.trim(),
              enable_slave: beacons.checked,
              host: lan.checked ? "0.0.0.0" : "127.0.0.1",
              port: parseInt(portSel.value, 10)
            });
            if (!r.ok) {
              toast(r.error || "save failed", true);
              info.textContent = r.error || "";
            } else {
              toast("Saved");
              info.textContent = r.restart_needed ? "Saved. Restart the gateway to apply (beacons / network binding)." : "Saved + applied.";
              await this.render(ctx2);
            }
          } catch (e) {
            toast("save failed: " + e.message, true);
          } finally {
            save.disabled = false;
          }
        };
        this.card.replaceChildren(
          el2("div", { class: "section-label" }, "Connection"),
          el2("div", { class: "row" }, el2("span", { class: "dot " + statusDot }), el2("span", {}, statusText)),
          el2("div", { class: "section-label", style: "margin-top:18px" }, "Setup"),
          el2("div", {}, el2("span", { class: "label" }, "Machine name"), name),
          el2(
            "div",
            { style: "margin-top:10px" },
            el2("span", { class: "label" }, "Controller disk (network share)"),
            destField,
            el2("span", { class: "hint" }, "Must be a network share, e.g. \\\\10.0.0.50\\cncdisk \u2014 local folders aren't allowed.")
          ),
          el2(
            "label",
            { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
            beacons,
            "Beacons (Modbus progress \u2014 Expert only; leave off for V4.1)"
          ),
          el2(
            "label",
            { class: "row", style: "margin-top:12px;gap:6px;cursor:pointer" },
            lan,
            "Allow other devices on my network (serve Studio on the LAN)"
          ),
          lanHint,
          el2(
            "div",
            { style: "margin-top:12px" },
            el2("span", { class: "label" }, "Serve port (desktop app)"),
            portSel,
            el2("span", { class: "hint" }, "Loopback port the app serves on (8765-8769). Restart to apply.")
          ),
          el2("div", { class: "row", style: "margin-top:14px" }, save),
          info,
          this.profileBlock(prof),
          el2("div", { class: "wiz-usage" }, `gateway v${d.version || "?"} \xB7 backend ${d.backend || "?"}`)
        );
      }
    };
  }
});

// ../DDCS-Studio/web/ui/gatewayPanel.js
var gatewayPanel_exports = {};
__export(gatewayPanel_exports, {
  initGatewayPanel: () => initGatewayPanel,
  setGatewayPanelVisible: () => setGatewayPanelVisible
});
function initGatewayPanel() {
  if (inited) return;
  inited = true;
  const panel = document.getElementById("gateway-app");
  tabsEl = el2("div", { class: "tabs" });
  const root = el2("div", { class: "gw-view" });
  panel.append(tabsEl, root);
  ctx = { client: makeClient(), root, status: null, refresh: () => activate(active) };
  VIEWS.forEach((v6) => tabsEl.append(el2("div", { class: "tab", onclick: () => activate(v6) }, v6.label)));
  activate(status_default);
  setInterval(poll, POLL_MS);
}
function setGatewayPanelVisible(on) {
  visible = on;
  if (on && inited) poll();
}
function activate(view) {
  active = view;
  [...tabsEl.children].forEach((t, i) => t.classList.toggle("on", VIEWS[i] === view));
  clear(ctx.root);
  view.mount(ctx);
}
async function poll() {
  if (!visible) return;
  let desc = null;
  try {
    desc = await ctx.client.descriptor();
  } catch {
    desc = null;
  }
  ctx.status = deriveStatus(ctx.client, desc);
  if (active.onPoll) {
    try {
      await active.onPoll(ctx);
    } catch {
    }
  }
}
var VIEWS, POLL_MS, inited, visible, active, ctx, tabsEl;
var init_gatewayPanel = __esm({
  "../DDCS-Studio/web/ui/gatewayPanel.js"() {
    init_client();
    init_util2();
    init_status();
    init_send();
    init_merge();
    init_tracker();
    init_files();
    init_jobs();
    init_admin();
    VIEWS = [status_default, send_default, merge_default, tracker_default, files_default, jobs_default, admin_default];
    POLL_MS = 1500;
    inited = false;
    visible = false;
    active = status_default;
    ctx = null;
    tabsEl = null;
  }
});

// ../DDCS-Studio/web/shared/js/validate/validate.js
function scanComments(line2) {
  const code = [];
  const errors = [];
  let depth = 0;
  for (let col = 0; col < line2.length; col++) {
    const ch = line2[col];
    if (depth === 0 && ch === ";") break;
    if (ch === "(") {
      if (depth === 0) depth = 1;
      else errors.push({
        col,
        code: "E-NESTPAREN",
        msg: "nested '(' inside a comment - DDCS comments cannot nest; this breaks the parser (flags the NEXT line as 'syntax error')"
      });
      code.push(" ");
    } else if (ch === ")") {
      if (depth > 0) depth -= 1;
      else errors.push({ col, code: "E-STRAYPAREN", msg: "')' with no matching '(' - stray close paren" });
      code.push(" ");
    } else {
      code.push(depth > 0 ? " " : ch);
    }
  }
  if (depth > 0) errors.push({ col: line2.length, code: "E-OPENCOMMENT", msg: "comment '(' never closed on this line" });
  return { code: code.join(""), errors };
}
function lintLine(n, raw2, findings, primed) {
  const { code, errors } = scanComments(raw2);
  for (const e of errors) findings.push({ line: n, sev: "ERROR", code: e.code, msg: e.msg });
  const opens = (code.match(/\[/g) || []).length, closes = (code.match(/\]/g) || []).length;
  if (opens !== closes) {
    findings.push({ line: n, sev: "ERROR", code: "E-BRACKET", msg: `unbalanced [ ] (${opens} '[' vs ${closes} ']')` });
  }
  if (GOTO_SPACE.test(code)) {
    findings.push({ line: n, sev: "ERROR", code: "E-GOTOSPACE", msg: "space after GOTO - must be 'GOTO1' / 'GOTO[expr]', not 'GOTO 1'" });
  }
  for (const match of code.matchAll(STRAY_WORD)) {
    if (!VALID_MACRO_WORDS.has(match[0].toUpperCase())) {
      findings.push({ line: n, sev: "ERROR", code: "E-STRAYWORD", msg: `unrecognized word '${match[0]}' outside of a comment` });
    }
  }
  const fo = FANUC_OPS.exec(code);
  if (fo && IF_WORD.test(code)) {
    findings.push({ line: n, sev: "WARN", code: "W-FANUCOP", msg: `FANUC operator '${fo[1]}' is unreliable - use C-style ==, !=, <, >, <=, >=` });
  }
  if (G10.test(code)) {
    findings.push({ line: n, sev: "WARN", code: "W-G10", msg: "G10 is broken on DDCS (causes unwanted motion) - write #805+ offsets directly" });
  }
  const g = G53_BARE.exec(code);
  if (g && AXIS_BARE_CONST.test(g[1])) {
    findings.push({ line: n, sev: "WARN", code: "W-G53CONST", msg: "G53 with a bare constant fails - operand must include a #var (e.g. 'G53 X#x', not 'G53 X0')" });
  }
  for (const im of code.matchAll(INPUT2070)) {
    const dest = Number(im[1]);
    if (isPersistent(dest)) {
      findings.push({ line: n, sev: "WARN", code: "W-2070RANGE", msg: `#2070 -> #${dest} (persistent) fails silently - input to #50-#499 then copy to persistent` });
    }
  }
  for (const mm of code.matchAll(MCALL)) {
    const args = mm[2].split(",").filter((a) => a.trim() !== "");
    if (args.length !== 6) {
      findings.push({ line: n, sev: "ERROR", code: "E-MARGS", msg: `${mm[1]} needs 6 args [X1..X6], got ${args.length}` });
    }
  }
  const am = ASSIGN.exec(code.trim());
  if (am) {
    const target = Number(am[1]);
    const rhs = am[2];
    const refs = [...rhs.matchAll(HASH_REF)].map((x) => Number(x[1]));
    if (isPersistent(target) && refs.some((r) => r >= 880 && r <= 999)) {
      if (!/[+\-*/]/.test(rhs) && !primed.has(target)) {
        findings.push({
          line: n,
          sev: "WARN",
          code: "W-PRIME",
          msg: `#${target} = #${refs[0]} can freeze (priming bug) - prime #${target} with a constant earlier, or wash the RHS ('#${target} = #${refs[0]} + 0')`
        });
      }
    }
    for (const r of refs) {
      if (r >= 1630 && r <= 1636) {
        findings.push({ line: n, sev: "ERROR", code: "E-CH1630", msg: `reading #${r} (analyze-channel status) WEDGES the analyzer (needs reboot). Do not read #1630-#1636 from a running job` });
      }
    }
    if (target >= 1620 && target <= 1626) {
      findings.push({ line: n, sev: "WARN", code: "W-CH1620", msg: `writing #${target} commands analyze-channel exec (1=pause). Intentional? (this is what M47/feed-hold use)` });
    }
  }
}
function validate(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const primed = /* @__PURE__ */ new Set();
  for (const raw2 of lines) {
    const { code } = scanComments(raw2);
    const m = LITERAL_ASSIGN.exec(code.trim());
    if (m) primed.add(Number(m[1]));
  }
  const findings = [];
  lines.forEach((raw2, i) => lintLine(i + 1, raw2, findings, primed));
  const errors = findings.filter((f) => f.sev === "ERROR").length;
  return { ok: errors === 0, errors, warnings: findings.length - errors, findings };
}
function summarize(result) {
  if (result.ok && result.warnings === 0) return "DDCS check: clean";
  const parts = [];
  if (result.errors) parts.push(`${result.errors} error${result.errors === 1 ? "" : "s"}`);
  if (result.warnings) parts.push(`${result.warnings} warning${result.warnings === 1 ? "" : "s"}`);
  return `DDCS check: ${parts.join(", ")}`;
}
var FANUC_OPS, ASSIGN, HASH_REF, GOTO_SPACE, G53_BARE, AXIS_BARE_CONST, INPUT2070, MCALL, LITERAL_ASSIGN, IF_WORD, G10, STRAY_WORD, VALID_MACRO_WORDS, isPersistent;
var init_validate = __esm({
  "../DDCS-Studio/web/shared/js/validate/validate.js"() {
    FANUC_OPS = /(?<![A-Za-z0-9_])(EQ|NE|LT|GT|LE|GE)(?![A-Za-z0-9_])/;
    ASSIGN = /^#(\d+)\s*=\s*(.+?)\s*$/;
    HASH_REF = /#(\d+)/g;
    GOTO_SPACE = /\bGOTO\s+[0-9[]/;
    G53_BARE = /\bG53\b(.*)/;
    AXIS_BARE_CONST = /(?<![#[\d.])\b[XYZABCUVW]\s*[-+]?\d/;
    INPUT2070 = /#2070\s*=\s*(\d+)/g;
    MCALL = /\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]/g;
    LITERAL_ASSIGN = /^#(\d+)\s*=\s*[-+]?\d+(?:\.\d+)?\s*$/;
    IF_WORD = /\bIF\b/;
    G10 = /\bG10\b/;
    STRAY_WORD = /[A-Za-z]{2,}/g;
    VALID_MACRO_WORDS = /* @__PURE__ */ new Set([
      "IF",
      "THEN",
      "GOTO",
      "WHILE",
      "DO",
      "END",
      "EQ",
      "NE",
      "GT",
      "GE",
      "LT",
      "LE",
      "AND",
      "OR",
      "XOR",
      "MOD",
      "SIN",
      "COS",
      "TAN",
      "ATAN",
      "ASIN",
      "ACOS",
      "SQRT",
      "ABS",
      "ROUND",
      "FIX",
      "FUP",
      "LN",
      "EXP",
      "MSETDATA",
      "MGETDATA"
    ]);
    isPersistent = (n) => n >= 1153 && n <= 1193 || n >= 2039 && n <= 2071 || n >= 2500 && n <= 2599;
  }
});

// ../DDCS-Studio/web/ui/headerPost.js
var headerPost_exports = {};
__export(headerPost_exports, {
  initHeaderPost: () => initHeaderPost
});
function initHeaderPost() {
  const sel = document.getElementById("hdrPost");
  if (!sel) return;
  const warnEl = document.getElementById("hdrPostWarn");
  const fillOptions = () => {
    const machinePost = getDialect(getActiveProfile().id);
    sel.innerHTML = [`<option value="auto">Auto \xB7 ${machinePost.name}</option>`].concat(listPosts().map((p) => `<option value="${p.id}">${p.name}${p.verified ? "" : " \u26A0"}</option>`)).join("");
    sel.value = getActivePostId();
  };
  const lint = () => {
    if (!warnEl) return;
    const post = resolveActivePost(getActiveProfile().id);
    const caps = getCaps(post.id);
    const ed2 = document.getElementById("editor");
    const text = ed2 ? ed2.value : "";
    const hasVars = /#\d/.test(text);
    const hasProbe = /\b(?:G38\.2|G31|M101)\b/.test(text);
    let msg = "";
    if (!caps.vars && hasVars) {
      msg = `${post.name} can't run this program \u2014 it uses #variables (a probe/ATC macro). Probing on this controller is host-side (stream G38.2 \u2192 read [PRB:] \u2192 G10 L20); the emitted macro won't execute as-is.`;
    } else if (caps.flowStreamable === false && (hasProbe || hasVars)) {
      msg = `${post.name}: load this macro from SD/littlefs \u2014 its O-word flow doesn't run while streaming over serial.`;
    }
    let linterMsg = "";
    if (post.id.includes("ddcs")) {
      const res = validate(text);
      if (!res.ok || res.warnings > 0) {
        linterMsg = summarize(res) + " - " + res.findings.map((f) => `Line ${f.line}: ${f.msg}`).join(" | ");
      }
    }
    const combinedMsg = [msg, linterMsg].filter(Boolean).join("\n\n");
    warnEl.hidden = !combinedMsg;
    warnEl.title = combinedMsg;
    const statusBar = document.getElementById("editor-statusbar");
    const statusText = document.getElementById("editor-status-text");
    if (statusBar && statusText) {
      statusBar.classList.toggle("hidden", !linterMsg);
      statusText.textContent = linterMsg;
    }
  };
  const copyBtn = document.getElementById("editor-status-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const statusText = document.getElementById("editor-status-text");
      if (!statusText || !statusText.textContent) return;
      const text = statusText.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (e) {
        }
        document.body.removeChild(ta);
      }
      copyBtn.style.color = "#00ff00";
      setTimeout(() => copyBtn.style.color = "", 500);
    });
  }
  fillOptions();
  sel.addEventListener("change", () => {
    setActivePostId(sel.value);
    const post = resolveActivePost(getActiveProfile().id);
    const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
    if (vdb && post) {
      let fam = "expert";
      if (post.id.includes("v4")) fam = "v4.1";
      else if (post.id.includes("centroid")) fam = "centroid";
      else if (post.id.includes("rs274ngc") || post.id.includes("linuxcnc")) fam = "rs274ngc";
      else if (post.id.includes("mach3")) fam = "mach3";
      else if (post.id.includes("mach4")) fam = "mach4";
      else if (post.id.includes("uccnc")) fam = "uccnc";
      vdb.setControllerVars(fam);
    }
    if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();
    window.dispatchEvent(new CustomEvent("ddcs:settings-changed"));
    lint();
  });
  window.addEventListener("ddcs:settings-changed", () => {
    fillOptions();
    lint();
  });
  const ed = document.getElementById("editor");
  if (ed) ed.addEventListener("input", lint);
  lint();
}
var init_headerPost = __esm({
  "../DDCS-Studio/web/ui/headerPost.js"() {
    init_dialects();
    init_controllerProfiles();
    init_validate();
  }
});

// web/src/extensionApp.js
init_bridge();
init_theme();

// ../DDCS-Studio/web/wizardManager.js
init_uiUtils();

// ../DDCS-Studio/web/wizards/views/commView.js
init_uiUtils();
init_communicationWizard();
var wizard = new CommunicationWizard();
var commView = {
  type: "comm",
  panelId: "wiz_comm",
  codeElId: "wiz_comm_code",
  large: false,
  inputIds: [
    "c_type",
    "c_msg",
    "c_val",
    "c_cycle",
    "c_id",
    "c_dest",
    "c_popup_mode",
    "c_status_mode",
    "c_status_dwell",
    "c_status_color",
    "c_slot1",
    "c_slot2",
    "c_slot3",
    "c_slot4"
  ],
  /** Default message text + dwell-default clearing (runs when the panel is shown). */
  onShow() {
    const msgEl = el("c_msg");
    if (msgEl && !msgEl.value) {
      msgEl.value = "Enter message...";
      msgEl.dataset.isDefault = "true";
      if (!msgEl._defaultClearBound) {
        msgEl._defaultClearBound = true;
        msgEl.addEventListener("keydown", function clearDefault() {
          if (msgEl.dataset.isDefault === "true") {
            msgEl.value = "";
            delete msgEl.dataset.isDefault;
          }
        }, { once: false });
        msgEl.addEventListener("focus", function() {
          if (msgEl.dataset.isDefault === "true") msgEl.select();
        });
      }
    }
    const valEl = el("c_val");
    if (valEl && !valEl._dwellDefaultClearBound) {
      valEl._dwellDefaultClearBound = true;
      valEl.addEventListener("beforeinput", () => {
        const commTypeEl = el("c_type");
        if (!commTypeEl || commTypeEl.value !== "dwell") return;
        if (valEl.dataset.isDwellDefault === "true") {
          valEl.value = "";
          delete valEl.dataset.isDwellDefault;
        }
      });
    }
  },
  update() {
    const type = el("c_type").value;
    const params = {
      type,
      msg: el("c_msg")?.value || "",
      val: el("c_val")?.value || "",
      cycle: el("c_cycle")?.value || "",
      popupMode: el("c_popup_mode")?.value || "",
      id: el("c_id")?.value || "",
      dest: el("c_dest")?.value || "",
      slot1: el("c_slot1")?.value || "",
      slot2: el("c_slot2")?.value || "",
      slot3: el("c_slot3")?.value || "",
      slot4: el("c_slot4")?.value || "",
      statusColor: el("c_status_color")?.value ?? "-1",
      statusMode: el("c_status_mode")?.value || "1",
      statusDwell: el("c_status_dwell")?.value || ""
    };
    const commValEl = el("c_val");
    if (type === "dwell" && commValEl) {
      if (!commValEl.value || commValEl.dataset.isDwellDefault === "true") {
        commValEl.value = "5.0";
        commValEl.dataset.isDwellDefault = "true";
        params.val = "5.0";
      }
    } else if (commValEl && commValEl.dataset.isDwellDefault === "true") {
      delete commValEl.dataset.isDwellDefault;
    }
    const descEl = el("comm_desc");
    const modeDescs = {
      "-5000": "<b>Toast</b> \u2014 Displays message instantly without stopping the macro. No operator input required.",
      "1": "<b>OK / Cancel</b> \u2014 Halts macro, operator presses Enter (continue) or Esc (cancel). Returns 1 (Enter) or 0 (Esc) \u2014 macro branches on result.",
      "3": "<b>Binary Choice</b> \u2014 Halts macro, operator presses Enter or Esc to choose between two actions. Returns 1 (Enter) or 0 (Esc) \u2014 macro branches on result."
    };
    if (descEl) {
      const descs = {
        popup: "<b>Popup</b> (#1505) \u2014 Shows a dialog box on screen. Mode controls whether macro pauses and how the operator responds.",
        status: "<b>Status Bar</b> (#1503) \u2014 Writes a message to the bottom green bar without stopping the macro. Use for progress updates, current operation labels or live feedback during a run. Requires Pr269=YES.",
        input: "<b>Numeric Input</b> (#2070) \u2014 Pauses macro and shows an Edit dialog for the operator to type a number. Result goes into a temp variable (#50\u2013#499), then you copy it to a persistent variable. Use for runtime parameters like speeds or offsets.",
        beep: "<b>Beep</b> (#2042/#2043) \u2014 #2042 sets total beep duration (ms). #2043 sets pulse cycle (ms): 0 = continuous tone; >0 = ON for cycle, OFF for cycle, repeated within #2042 duration (e.g. #2043=100 with #2042=1000 gives five 100ms beeps).",
        dwell: "<b>Dwell</b> (G4 P) \u2014 Pauses macro execution for a fixed time in seconds. Use for spindle spin-up, coolant settling or any timed wait."
      };
      const modeEl = type === "popup" ? el("c_popup_mode") : el("c_status_mode");
      const modeDesc = type === "popup" && modeEl ? modeDescs[modeEl.value] || "" : "";
      const statusModeDesc = type === "status" && modeEl ? modeEl.value === "-3000" ? "<b>Persistent</b> \u2014 message stays on screen after macro ends. Operator can jog freely while reading it." : "" : "";
      descEl.innerHTML = (descs[type] || "") + (modeDesc ? " " + modeDesc : "") + (statusModeDesc ? " " + statusModeDesc : "");
    }
    const visibility = wizard.getFieldVisibility(type);
    const modeBlock = el("c_mode_block");
    const valBlock = el("c_val_block");
    const msgBlock = el("c_msg_block");
    const slotsBlock = el("c_slots_block");
    const varBlock = el("c_var_block");
    const colorBlock = el("c_color_block");
    if (modeBlock) modeBlock.classList.toggle("hidden", !visibility.showMode);
    const popupModeEl = el("c_popup_mode");
    const statusModeEl = el("c_status_mode");
    const modeLabelEl = el("c_mode_label");
    if (popupModeEl) popupModeEl.style.display = visibility.showPopupMode ? "" : "none";
    if (statusModeEl) statusModeEl.style.display = visibility.showStatusMode ? "" : "none";
    if (modeLabelEl) modeLabelEl.textContent = visibility.modeLabel || "MODE";
    const dwellBlock2 = el("c_dwell_block");
    const currentStatusMode = el("c_status_mode")?.value || "1";
    if (dwellBlock2) dwellBlock2.classList.toggle("hidden", !(type === "status" && currentStatusMode !== "-3000"));
    if (valBlock) valBlock.classList.toggle("hidden", !visibility.showValue);
    if (msgBlock) msgBlock.classList.toggle("hidden", !visibility.showMessage);
    if (slotsBlock) slotsBlock.classList.toggle("hidden", !visibility.showSlots);
    if (varBlock) varBlock.classList.toggle("hidden", !visibility.showVar);
    if (colorBlock) colorBlock.classList.toggle("hidden", !visibility.showColor);
    const cycleBlock = el("c_cycle_block");
    if (cycleBlock) cycleBlock.classList.toggle("hidden", !visibility.showCycle);
    if (visibility.showMessage) {
      const msgEl = el("c_msg");
      if (msgEl && !msgEl.value && msgEl.dataset.isDefault !== "true") {
        msgEl.value = "Enter message...";
        msgEl.dataset.isDefault = "true";
      }
    }
    const valLabel = el("c_val_label");
    const valHint = el("c_val_hint");
    if (valLabel) valLabel.textContent = visibility.valLabel || "VALUE";
    if (valHint) valHint.textContent = visibility.valHint || "";
    const gcode = wizard.generate(params);
    el("wiz_comm_code").innerHTML = gcode;
    const screenPreview = el("comm_screen_preview");
    if (screenPreview) {
      screenPreview.innerHTML = wizard.generateScreenPreview(params);
    }
  }
};

// ../DDCS-Studio/web/wizards/views/wcsView.js
init_uiUtils();
init_wcsWizard();
var wizard2 = new WCSWizard();
var wcsView = {
  type: "wcs",
  panelId: "wiz_wcs",
  codeElId: "wiz_wcs_code",
  large: false,
  inputIds: ["w_sys", "w_x", "w_y", "w_z", "w_sync", "w_slave"],
  update() {
    const params = {
      sys: el("w_sys").value,
      axisX: el("w_x")?.checked || false,
      axisY: el("w_y")?.checked || false,
      axisZ: el("w_z")?.checked || false,
      sync: el("w_sync")?.checked || false,
      slave: el("w_slave")?.value || "3"
    };
    const gcode = wizard2.generate(params);
    el("wiz_wcs_code").innerHTML = UIUtils.formatGCode(gcode);
    const wcsStatus = el("wcsStatus");
    if (wcsStatus) wcsStatus.textContent = `${wizard2.getWCSName(params.sys)} - Base: ${wizard2.getWCSBase(params.sys)}`;
  }
};

// ../DDCS-Studio/web/wizards/views/cornerView.js
init_uiUtils();
init_cornerWizard();
var wizard3 = new CornerWizard();
function startCornerAnim() {
  const animate = el("c_animate")?.checked !== false;
  const corner = el("c_corner")?.value || "FL";
  const seq = el("c_probe_seq")?.value || "YX";
  const zfirst = el("c_probe_z_first")?.checked || false;
  if (window.__cornerAnimator) {
    try {
      window.__cornerAnimator.stop();
    } catch (e) {
    }
  }
  if (window.__cornerAnimStartTimer) {
    clearTimeout(window.__cornerAnimStartTimer);
    window.__cornerAnimStartTimer = null;
  }
  if (!animate) return;
  if (!window.__cornerAnimator && window.CornerVizAnimator) {
    window.__cornerAnimator = new window.CornerVizAnimator();
  }
  if (window.__cornerAnimator) {
    window.__cornerAnimStartTimer = setTimeout(() => {
      window.__cornerAnimStartTimer = null;
      window.__cornerAnimator.play(corner, seq, zfirst);
    }, 80);
  }
}
var cornerView = {
  type: "corner",
  panelId: "wiz_corner",
  codeElId: "wiz_corner_code",
  large: true,
  twoPane: true,
  inputIds: [
    "c_corner",
    "c_probe_seq",
    "c_probe_z_first",
    "c_sync_a",
    "c_wcs",
    "c_travel_dist",
    "c_safe_z",
    "c_scan_depth",
    "c_radius",
    "c_feed_fast",
    "c_feed_slow",
    "c_dist",
    "c_retract",
    "c_port",
    "c_level",
    "c_q",
    "c_slave"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { c_port: "port", c_level: "level", c_feed_fast: "fastFeed", c_retract: "retract" },
  startAnim: startCornerAnim,
  onOpen() {
    setTimeout(async () => {
      startCornerAnim();
    }, 50);
  },
  // (params → form for editing is the central PARAM_FIELDS.corner map in wizardManager — no per-view setForm.)
  update(ctx2) {
    const params = {
      corner: el("c_corner").value,
      probeZ: el("c_probe_z_first")?.checked || false,
      probeZFirst: el("c_probe_z_first")?.checked || false,
      syncA: el("c_sync_a").checked,
      slave: el("c_slave")?.value || "3",
      probeSeq: el("c_probe_seq").value,
      wcs: el("c_wcs").value,
      dist: el("c_dist").value,
      retract: el("c_retract").value,
      f_fast: el("c_feed_fast").value,
      f_slow: el("c_feed_slow")?.value || "50",
      qStop: el("c_q")?.value || "1",
      port: window.ddcsGetSettings().probes.probePin,
      level: window.ddcsGetSettings().probes.probeLevel,
      safeZ: el("c_safe_z").value,
      travelDist: el("c_travel_dist").value,
      scanDepth: el("c_scan_depth")?.value || "5",
      radius: el("c_radius")?.value || "2.0",
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const gcode = wizard3.generate(params);
    el("wiz_corner_code").innerHTML = UIUtils.formatGCode(gcode);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "cornerVizContainer", wizard3.inferStart(params, stock));
    const dirMap = { FL: "X pos, Y pos", FR: "X neg, Y pos", BL: "X pos, Y neg", BR: "X neg, Y neg" };
    const cornerStatus = el("cornerVizStatus");
    if (cornerStatus) cornerStatus.textContent = `Corner: ${params.corner} (${dirMap[params.corner]}) - ${params.probeSeq}` + (params.probeZ ? " + Z" : "");
    startCornerAnim();
  }
};

// ../DDCS-Studio/web/wizards/views/middleView.js
init_uiUtils();
init_middleWizard();
var wizard4 = new MiddleWizard();
var middleView = {
  type: "middle",
  panelId: "wiz_middle",
  codeElId: "wiz_middle_code",
  large: true,
  twoPane: true,
  inputIds: [
    "m_type",
    "m_axis",
    "m_dir",
    "m_dir2",
    "m_both",
    "m_sync_a",
    "m_wcs",
    "m_slave",
    "m_dist",
    "m_retract",
    "m_safe_z",
    "m_feed_fast",
    "m_feed_slow",
    "m_port",
    "m_level",
    "m_q"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { m_port: "port", m_level: "level", m_feed_fast: "fastFeed", m_retract: "retract" },
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
    }, 50);
  },
  async update(ctx2) {
    const dir1val = el("m_dir")?.value || "pos";
    const dir2val = el("m_dir2")?.value || (dir1val === "pos" ? "neg" : "pos");
    const params = {
      featureType: el("m_type")?.value || "pocket",
      axis: el("m_axis")?.value || "X",
      dir1: dir1val,
      dir2: dir2val,
      findBoth: el("m_both")?.checked || false,
      syncA: el("m_sync_a")?.checked || false,
      slave: el("m_slave")?.value || "3",
      wcs: el("m_wcs")?.value || "active",
      dist: el("m_dist")?.value || "20",
      retract: el("m_retract")?.value || "2",
      safeZ: el("m_safe_z")?.value || "10",
      clearance: "2",
      f_fast: el("m_feed_fast")?.value || "200",
      f_slow: el("m_feed_slow")?.value || "50",
      qStop: el("m_q")?.value || "1",
      port: window.ddcsGetSettings().probes.probePin,
      level: window.ddcsGetSettings().probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const middleDesc = el("middle_desc");
    if (middleDesc) {
      const pocketDetail = params.findBoth ? "With <b>Probe Both Axes</b> enabled, it completes both edge touches on the selected axis, then repeats the same two-edge cycle on the perpendicular axis." : "With <b>Probe Both Axes</b> disabled, it still probes <b>two opposite edges on the selected axis</b> and calculates the midpoint on that axis.";
      const bossDetail = params.findBoth ? "With <b>Probe Both Axes</b> enabled, it performs the two-edge cycle on the selected axis, then repeats on the perpendicular axis (with reposition pauses where required)." : "With <b>Probe Both Axes</b> disabled, it performs <b>two opposite-edge probes on the selected axis</b> and computes midpoint/offset from that axis only.";
      middleDesc.innerHTML = params.featureType === "boss" ? `<b>Boss (outside feature):</b> Start with the probe near one external wall of the boss at probe height. Keep approach clear so the stylus can move away for retract and return safely. ${bossDetail}` : `<b>Pocket (inside feature):</b> Start near the pocket center so there is travel room in both directions on the chosen axis. The macro performs internal wall touches and retract moves to establish center/offset safely. ${pocketDetail}`;
    }
    const dir2Block = el("m_dir2_block");
    const dir2El = el("m_dir2");
    if (dir2Block) dir2Block.classList.toggle("hidden", !params.findBoth);
    if (params.findBoth && dir2El) dir2El.value = dir2val;
    const gcode = wizard4.generate(params);
    el("wiz_middle_code").innerHTML = UIUtils.formatGCode(gcode);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "middleVizContainer", wizard4.inferStart(params, stock));
    const middleStatus = el("middleVizStatus");
    const dirLabel = params.dir1 === "pos" ? "pos" : "neg";
    const bothLabel = params.findBoth ? ` (both: ${params.dir1}/${params.dir2})` : "";
    if (middleStatus) middleStatus.textContent = `Middle: ${params.featureType} | ${params.axis} ${dirLabel}${bothLabel}`;
    if (window.discoverAnimSteps && window.PathAnimator) {
      try {
        const animInput = window.discoverAnimSteps({
          featureType: params.featureType,
          axis: params.axis,
          dir1: params.dir1,
          twoAxis: !!params.findBoth,
          dir2: params.dir2
        });
        console.debug("middleView.update: animInput", animInput);
        const animate = el("m_animate")?.checked !== false;
        console.debug("middleView.update: animate =", animate);
        if (window.__middleAnimTimeout) {
          clearTimeout(window.__middleAnimTimeout);
          window.__middleAnimTimeout = null;
        }
        if (window.__middleAnimator) {
          try {
            console.debug("middleView.update: stopping previous animator (if any)");
            window.__middleAnimator.stop();
          } catch (e) {
            console.debug("middleView.update: stop() threw", e);
          }
        }
        if (animate) {
          if (!window.__middleAnimator) {
            window.__middleAnimator = new window.PathAnimator({ loop: true });
            console.debug("middleView.update: created __middleAnimator");
          }
          window.__middleAnimTimeout = setTimeout(() => {
            window.__middleAnimTimeout = null;
            const wcsId = `middle_probe_${params.featureType}_${params.axis}_${params.dir1}_wcs`;
            animInput.wcsEls = [document.getElementById(wcsId)].filter(Boolean);
            console.debug("middleView.update: starting playSequence with animInput");
            window.__middleAnimator.playSequence(animInput).then(() => {
              console.debug("middleView.update: playSequence completed");
            }).catch((err) => {
              console.debug("middleView.update: playSequence rejected", err);
            });
          }, 60);
        } else {
          console.debug("middleView.update: static mode - showing all paths");
          const allSteps = [
            ...animInput.axis1Steps || [],
            ...animInput.jogPath ? [animInput.jogPath] : [],
            ...animInput.axis2Steps || []
          ];
          setTimeout(() => {
            allSteps.forEach((step) => {
              if (!step || !step.selector) return;
              const pathEl = document.querySelector(step.selector);
              if (pathEl) {
                pathEl.classList.add("path-draw");
                const parent = pathEl.closest("g");
                if (parent) {
                  if (step.type === "probe") parent.classList.add("is-probing");
                  else if (step.type === "retract") parent.classList.add("is-retracting");
                  else if (step.type === "jog") parent.classList.add("is-jogging");
                }
                console.debug("middleView.update: added path-draw to", step.selector);
              }
            });
          }, 60);
        }
      } catch (err) {
        console.warn("MiddleViz autoplay failed", err);
      }
    }
  }
};

// ../DDCS-Studio/web/wizards/views/circularView.js
init_uiUtils();
init_circularWizard();
var wizard5 = new CircularWizard();
var circularView = {
  type: "circular",
  panelId: "wiz_circular",
  codeElId: "wiz_circular_code",
  large: true,
  twoPane: true,
  inputIds: [
    "circ_type",
    "circ_wcs",
    "circ_dist",
    "circ_retract",
    "circ_safe_z",
    "circ_feed_fast",
    "circ_feed_slow",
    "circ_q"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { circ_feed_fast: "fastFeed", circ_retract: "retract" },
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
    }, 50);
  },
  update(ctx2) {
    const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
    const params = {
      featureType: el("circ_type")?.value || "bore",
      wcs: el("circ_wcs")?.value || "active",
      dist: el("circ_dist")?.value || "20",
      retract: el("circ_retract")?.value || "2",
      safeZ: el("circ_safe_z")?.value || "10",
      f_fast: el("circ_feed_fast")?.value || "200",
      f_slow: el("circ_feed_slow")?.value || "50",
      qStop: el("circ_q")?.value || "1",
      port: settings.probes.probePin,
      level: settings.probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const desc = el("circ_desc");
    if (desc) {
      desc.innerHTML = params.featureType === "boss" ? "<b>Boss (outside):</b> start with the stylus clear of one side at probe height. The macro probes each face, pausing for you to move clear around the boss between faces, and re-centres in X before the Y pair so the Y touch is a true diameter. Reports centre, mean diameter and out-of-round." : "<b>Bore (inside):</b> start near the hole centre at probe height. The macro probes +X/-X across the bore, re-centres in X, then probes +Y/-Y \u2014 so the Y touch is a true diameter, not a chord. Reports centre, mean diameter and out-of-round.";
    }
    const gcode = wizard5.generate(params);
    el("wiz_circular_code").innerHTML = UIUtils.formatGCode(gcode);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "circularVizContainer", wizard5.inferStart(params, stock));
    const status = el("circularVizStatus");
    if (status) status.textContent = `Circular: ${params.featureType} | centre + diameter | ${params.wcs}`;
  }
};

// ../DDCS-Studio/web/wizards/views/rotaryCenterView.js
init_uiUtils();
init_rotaryCenterWizard();
var wizard6 = new RotaryCenterWizard();
var rotaryCenterView = {
  type: "rotary_center",
  panelId: "wiz_rotary_center",
  codeElId: "wiz_rotary_center_code",
  large: true,
  twoPane: true,
  inputIds: [
    "rc_method",
    "rc_datum",
    "rc_diameter",
    "rc_wcs",
    "rc_dist",
    "rc_retract",
    "rc_safe_z",
    "rc_feed_fast",
    "rc_feed_slow",
    "rc_q"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { rc_feed_fast: "fastFeed", rc_retract: "retract" },
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
    }, 50);
  },
  update(ctx2) {
    const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
    const method = el("rc_method")?.value || "known";
    const params = {
      method,
      datum: el("rc_datum")?.value || "center",
      diameter: el("rc_diameter")?.value || "76.2",
      wcs: el("rc_wcs")?.value || "active",
      dist: el("rc_dist")?.value || "30",
      retract: el("rc_retract")?.value || "2",
      safeZ: el("rc_safe_z")?.value || "15",
      f_fast: el("rc_feed_fast")?.value || "200",
      f_slow: el("rc_feed_slow")?.value || "50",
      qStop: el("rc_q")?.value || "1",
      port: settings.probes.probePin,
      level: settings.probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const diaBlock = el("rc_diameter_block");
    if (diaBlock) diaBlock.classList.toggle("hidden", method !== "known");
    const desc = el("rc_desc");
    if (desc) {
      desc.innerHTML = method === "fit" ? "<b>3-point fit:</b> probe the top, then the +Y and -Y flanks (with reposition pauses), and the macro solves the Y-Z circle for centre + radius \u2014 no diameter needed. <b>Advanced \u2014 verify the math on the machine before relying on it.</b>" : "<b>Known diameter:</b> enter the blank diameter; probe the top and both flanks. Yc is the flank midpoint (exact at any height); centreline Z = top \u2212 radius. Robust, 3 touches.";
    }
    const gcode = wizard6.generate(params);
    el("wiz_rotary_center_code").innerHTML = UIUtils.formatGCode(gcode);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "rotaryCenterVizContainer", wizard6.inferStart(params, stock));
    const status = el("rotaryCenterVizStatus");
    if (status) status.textContent = `Rotary centre: ${method} | Z0 ${params.datum} | ${params.wcs}`;
  }
};

// ../DDCS-Studio/web/wizards/views/rotaryClockView.js
init_uiUtils();
init_rotaryClockWizard();
var wizard7 = new RotaryClockWizard();
var rotaryClockView = {
  type: "rotary_clock",
  panelId: "wiz_rotary_clock",
  codeElId: "wiz_rotary_clock_code",
  large: true,
  twoPane: true,
  inputIds: [
    "rcl_action",
    "rcl_reference",
    "rcl_span",
    "rcl_wcs",
    "rcl_dist",
    "rcl_retract",
    "rcl_safe_z",
    "rcl_feed_fast",
    "rcl_feed_slow",
    "rcl_q"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { rcl_feed_fast: "fastFeed", rcl_retract: "retract" },
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
    }, 50);
  },
  update(ctx2) {
    const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
    const action = el("rcl_action")?.value || "set";
    const params = {
      action,
      reference: el("rcl_reference")?.value || "top",
      span: el("rcl_span")?.value || "20",
      wcs: el("rcl_wcs")?.value || "active",
      dist: el("rcl_dist")?.value || "30",
      retract: el("rcl_retract")?.value || "2",
      safeZ: el("rcl_safe_z")?.value || "10",
      f_fast: el("rcl_feed_fast")?.value || "200",
      f_slow: el("rcl_feed_slow")?.value || "50",
      qStop: el("rcl_q")?.value || "1",
      port: settings.probes.probePin,
      level: settings.probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const desc = el("rcl_desc");
    if (desc) {
      const actTxt = action === "report" ? "measures the flat\u2019s tilt and reports it \u2014 it does NOT touch the A offset." : action === "rotate" ? "measures the tilt then <b>rotates the part</b> to the reference and zeros A there." : "measures the tilt and sets the A work offset so the reference reads A0 \u2014 without rotating the part.";
      desc.innerHTML = `<b>Clock to a flat:</b> probe the flat at two points across it (span apart in Y); tilt = atan(\u0394Z / span). This ${actTxt} No centreline needed. <b>Verify the A direction on your machine</b> \u2014 flip the span sign if it datums the wrong way.`;
    }
    const gcode = wizard7.generate(params);
    el("wiz_rotary_clock_code").innerHTML = UIUtils.formatGCode(gcode);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "rotaryClockVizContainer", wizard7.inferStart(params, stock));
    const status = el("rotaryClockVizStatus");
    if (status) status.textContent = `Rotary clock: ${action} | ref ${params.reference} | ${params.wcs}`;
  }
};

// ../DDCS-Studio/web/wizards/views/edgeView.js
init_uiUtils();
init_edgeWizard();
var wizard8 = new EdgeWizard();
function startEdgeAnim() {
  const animate = el("p_animate")?.checked !== false;
  const axis = el("p_axis")?.value || "X";
  const dir = el("p_dir")?.value || "pos";
  if (window.__edgeAnimator) {
    try {
      window.__edgeAnimator.stop();
    } catch (e) {
    }
  }
  if (!window.__edgeAnimator && window.EdgeVizAnimator) {
    window.__edgeAnimator = new window.EdgeVizAnimator();
  }
  if (window.__edgeAnimator && animate) {
    if (window.__edgeAnimStartTimer) {
      clearTimeout(window.__edgeAnimStartTimer);
      window.__edgeAnimStartTimer = null;
    }
    window.__edgeAnimStartTimer = setTimeout(() => {
      window.__edgeAnimStartTimer = null;
      try {
        window.__edgeAnimator.play(axis, dir);
      } catch (e) {
      }
    }, 80);
  }
}
var edgeView = {
  type: "edge",
  panelId: "wiz_edge",
  codeElId: "wiz_edge_code",
  large: true,
  twoPane: true,
  inputIds: [
    "p_axis",
    "p_dir",
    "p_dist",
    "p_feed_fast",
    "p_feed_slow",
    "p_retract",
    "p_port",
    "p_level",
    "p_q",
    "p_sync_a",
    "p_wcs",
    "p_slave"
  ],
  // Controller-source chips: which inputs map to which probe-config field (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { p_port: "port", p_level: "level", p_feed_fast: "fastFeed", p_retract: "retract" },
  startAnim: startEdgeAnim,
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
      setTimeout(() => {
        startEdgeAnim();
      }, 60);
    }, 50);
  },
  update(ctx2) {
    const params = {
      axis: el("p_axis")?.value || "X",
      dir: el("p_dir")?.value || "pos",
      wcs: el("p_wcs")?.value || "active",
      dist: el("p_dist")?.value || "15",
      retract: el("p_retract")?.value || "2",
      syncA: el("p_sync_a")?.checked || false,
      slave: el("p_slave")?.value || "3",
      f_fast: el("p_feed_fast")?.value || "200",
      f_slow: el("p_feed_slow")?.value || "50",
      qStop: el("p_q")?.value || "1",
      port: window.ddcsGetSettings().probes.probePin,
      level: window.ddcsGetSettings().probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    console.debug("edgeView.update", params);
    const gcode = wizard8.generate(params);
    const stock = window.ddcsGetSettings && window.ddcsGetSettings().stock || {};
    ctx2.preview3D(gcode, "probeVizContainer", wizard8.inferStart(params, stock));
    console.debug("edge generate => containsG31=", /G31/.test(gcode));
    el("wiz_edge_code").innerHTML = UIUtils.formatGCode(gcode);
    const edgeStatus = el("edgeVizStatus");
    if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === "pos" ? "+" : "-"}`;
  }
};

// ../DDCS-Studio/web/wizards/views/alignmentView.js
init_uiUtils();
init_alignmentWizard();
var wizard9 = new AlignmentWizard();
function startAlignmentAnim() {
  const animate = el("al_animate")?.checked !== false;
  const checkAxis = el("al_check_axis")?.value || "X";
  const probeDir = el("al_probe_dir")?.value || "pos";
  if (window.__alignAnimStartTimer) {
    clearTimeout(window.__alignAnimStartTimer);
    window.__alignAnimStartTimer = null;
  }
  if (window.__alignAnimator) {
    try {
      window.__alignAnimator.stop();
    } catch (e) {
    }
  }
  if (!animate) return;
  if (!window.__alignAnimator && window.AlignVizAnimator) {
    window.__alignAnimator = new window.AlignVizAnimator();
  }
  if (window.__alignAnimator) {
    window.__alignAnimStartTimer = setTimeout(() => {
      window.__alignAnimStartTimer = null;
      try {
        window.__alignAnimator.play(checkAxis, probeDir);
      } catch (e) {
      }
    }, 80);
  }
}
var alignmentView = {
  type: "alignment",
  panelId: "wiz_alignment",
  codeElId: "wiz_alignment_code",
  large: true,
  twoPane: true,
  inputIds: [
    "al_check_axis",
    "al_probe_dir",
    "al_tolerance",
    "al_dist",
    "al_retract",
    "al_safe_z",
    "al_feed_fast",
    "al_feed_slow",
    "al_port",
    "al_level",
    "al_q"
  ],
  // Controller-source chips (PROBE-CONFIG-SOURCE.md)
  probeSrcFields: { al_port: "port", al_level: "level", al_feed_fast: "fastFeed", al_retract: "retract" },
  startAnim: startAlignmentAnim,
  onOpen(ctx2) {
    setTimeout(() => {
      ctx2.update();
      setTimeout(() => {
        startAlignmentAnim();
      }, 60);
    }, 50);
  },
  update(ctx2) {
    const params = {
      checkAxis: el("al_check_axis")?.value || "X",
      probeDir: el("al_probe_dir")?.value || "pos",
      tolerance: el("al_tolerance")?.value || "0.2",
      dist: el("al_dist")?.value || "20",
      retract: el("al_retract")?.value || "2",
      safeZ: el("al_safe_z")?.value || "10",
      f_fast: el("al_feed_fast")?.value || "200",
      f_slow: el("al_feed_slow")?.value || "50",
      qStop: el("al_q")?.value || "1",
      port: window.ddcsGetSettings().probes.probePin,
      level: window.ddcsGetSettings().probes.probeLevel,
      sources: window.ddcsResolveProbeSources(["port", "level", "fastFeed", "retract"])
    };
    const gcode = wizard9.generate(params);
    el("wiz_alignment_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "alignmentVizContainer");
    const probeAxis = params.checkAxis === "X" ? "Y" : "X";
    const status = el("alignmentVizStatus");
    if (status) {
      status.textContent = `Alignment | Check: ${params.checkAxis} | Probe: ${probeAxis}`;
    }
    startAlignmentAnim();
  }
};

// ../DDCS-Studio/web/wizards/views/atcViews.js
init_uiUtils();
init_util();
init_toolProfile();
init_atcLengthWizard();
init_atcWarmupWizard();
init_atcChangeWizard();
init_atcTestWizard();
init_atcToolCheckWizard();
init_atcTableWizard();
var lengthWizard = new AtcLengthWizard();
var warmupWizard = new AtcWarmupWizard();
var changeWizard = new AtcChangeWizard();
var testWizard = new AtcTestWizard();
var toolCheckWizard = new AtcToolCheckWizard();
var tableWizard = new AtcTableWizard();
var setStatus = (id, text) => {
  const e = el(id);
  if (e) e.textContent = text;
};
var atcLengthView = {
  type: "atc_length",
  panelId: "wiz_atc_length",
  codeElId: "wiz_atc_length_code",
  large: true,
  twoPane: true,
  inputIds: [],
  // no wizard inputs — params come from Settings → ATC (tool-setter pin from Probes)
  update(mgr) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const a = s.atc || {};
    const p = s.probes || {};
    const params = {
      blockHeight: a.blockHeight ?? 50,
      safeZ: a.safeZ ?? 10,
      maxDist: a.maxDist ?? 100,
      retract: a.retract ?? 3,
      qStop: a.qStop ?? 1,
      f_fast: a.fFast ?? 300,
      f_slow: a.fSlow ?? 50,
      port: p.setterPin,
      level: p.setterLevel,
      sources: window.ddcsResolveProbeSources(["setterPort", "setterLevel", "blockHeight"])
    };
    const gcode = lengthWizard.generate(params);
    el("wiz_atc_length_code").innerHTML = UIUtils.formatGCode(gcode);
    if (mgr) mgr.preview3D(gcode, "atcLengthViz");
    setStatus("atcLengthVizStatus", "Z touch on the tool setter \xB7 \u25B6 traces the fast approach, slow touch + retract");
  }
};
var atcCheckView = {
  type: "atc_check",
  panelId: "wiz_atc_check",
  codeElId: "wiz_atc_check_code",
  large: true,
  twoPane: true,
  inputIds: ["atc_check_tol"],
  // tolerance only — setter + feeds come from Settings → ATC / Probes
  update(mgr) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const a = s.atc || {};
    const p = s.probes || {};
    const params = {
      blockHeight: a.blockHeight ?? 50,
      safeZ: a.safeZ ?? 10,
      maxDist: a.maxDist ?? 100,
      retract: a.retract ?? 3,
      qStop: a.qStop ?? 1,
      f_fast: a.fFast ?? 300,
      f_slow: a.fSlow ?? 50,
      port: p.setterPin,
      level: p.setterLevel,
      tolerance: el("atc_check_tol")?.value || "0.5",
      sources: window.ddcsResolveProbeSources(["setterPort", "setterLevel", "blockHeight"])
    };
    const gcode = toolCheckWizard.generate(params);
    el("wiz_atc_check_code").innerHTML = UIUtils.formatGCode(gcode);
    if (mgr) mgr.preview3D(gcode, "atcCheckViz");
    setStatus("atcCheckVizStatus", "Z re-tap on the setter \xB7 \u25B6 traces the probe; aborts if broken / wrong length");
  }
};
var atcWarmupView = {
  type: "atc_warmup",
  panelId: "wiz_atc_warmup",
  codeElId: "wiz_atc_warmup_code",
  large: true,
  twoPane: true,
  inputIds: ["atc_warmup_rpm1", "atc_warmup_time1", "atc_warmup_rpm2", "atc_warmup_time2"],
  update(mgr) {
    const params = {
      rpm1: el("atc_warmup_rpm1")?.value || "6000",
      time1: el("atc_warmup_time1")?.value || "30",
      rpm2: el("atc_warmup_rpm2")?.value || "12000",
      time2: el("atc_warmup_time2")?.value || "30"
    };
    const gcode = warmupWizard.generate(params);
    el("wiz_atc_warmup_code").innerHTML = UIUtils.formatGCode(gcode);
    if (mgr) mgr.preview3D(gcode, "atcWarmupViz");
    setStatus("atcWarmupVizStatus", "Spindle warm-up \xB7 no toolpath \u2014 \u25B6 steps the RPM / dwell stages");
  }
};
var atcChangeView = {
  type: "atc_change",
  panelId: "wiz_atc_change",
  codeElId: "wiz_atc_change_code",
  large: true,
  twoPane: true,
  inputIds: [
    "atc_change_mode",
    "atc_change_x",
    "atc_change_y",
    "atc_change_z",
    "atc_change_zclear",
    "atc_change_capacity",
    "atc_change_fixedt",
    "atc_change_m300",
    "atc_change_cover",
    "atc_change_confirm"
  ],
  update(mgr) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const mode = el("atc_change_mode")?.value || "manual";
    const manualRow = el("atc_change_manual_params");
    const autoRow = el("atc_change_auto_params");
    if (manualRow) manualRow.style.display = mode === "manual" ? "" : "none";
    if (autoRow) autoRow.style.display = mode === "auto" ? "" : "none";
    const params = {
      mode,
      // manual
      x: el("atc_change_x")?.value || "100",
      y: el("atc_change_y")?.value || "100",
      z: el("atc_change_z")?.value || "0",
      // auto
      zClear: el("atc_change_zclear")?.value || "0",
      fixedT: el("atc_change_fixedt")?.value || "0",
      waitSpindle: el("atc_change_m300")?.checked !== false,
      dustCover: el("atc_change_cover")?.checked === true,
      confirm: el("atc_change_confirm")?.checked === true,
      magazine: s.atc && s.atc.magazine || []
      // pockets + park XYZ come from Settings → Tool table
    };
    const gcode = changeWizard.generate(params);
    el("wiz_atc_change_code").innerHTML = UIUtils.formatGCode(gcode);
    if (mgr) mgr.preview3D(gcode, "atcChangeViz");
    setStatus("atcChangeVizStatus", mode === "auto" ? "Auto ATC pick & place \xB7 pocket moves come from controller tables (#1330/#1350/#1370)" : "Manual park \xB7 \u25B6 traces the safe-Z retract then the move to the swap position");
  }
};
var atcTestView = {
  type: "atc_test",
  panelId: "wiz_atc_test",
  codeElId: "wiz_atc_test_code",
  large: true,
  twoPane: true,
  inputIds: [
    "atc_test_mode",
    "atc_test_cycles",
    "atc_test_dwell",
    "atc_test_first",
    "atc_test_count",
    "atc_test_zclear",
    "atc_test_descend"
  ],
  update(mgr) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const mode = el("atc_test_mode")?.value || "drawbar";
    const drawbarRow = el("atc_test_drawbar_params");
    const pocketRow = el("atc_test_pocket_params");
    if (drawbarRow) drawbarRow.style.display = mode === "drawbar" ? "" : "none";
    if (pocketRow) pocketRow.style.display = mode === "pockets" ? "" : "none";
    const params = {
      mode,
      cycles: el("atc_test_cycles")?.value || "10",
      dwellMs: el("atc_test_dwell")?.value || "500",
      first: el("atc_test_first")?.value || "1",
      count: el("atc_test_count")?.value || "8",
      zClear: el("atc_test_zclear")?.value || "0",
      descend: el("atc_test_descend")?.checked === true,
      magazine: s.atc && s.atc.magazine || []
      // pocket dry-run visits the Settings → Tool table magazine
    };
    const gcode = testWizard.generate(params);
    el("wiz_atc_test_code").innerHTML = UIUtils.formatGCode(gcode);
    if (mgr) mgr.preview3D(gcode, "atcTestViz");
    setStatus("atcTestVizStatus", mode === "pockets" ? "Pocket dry-run \xB7 visits each magazine pocket (Settings \u2192 Tool table) at clearance Z" : "Drawbar cycle \xB7 no toolpath \u2014 \u25B6 steps the release / lock sequence");
  }
};

// ../DDCS-Studio/web/wizards/views/drillView.js
init_uiUtils();
init_drillWizard();

// ../DDCS-Studio/web/viz/featureCanvas.js
var SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag2, attrs) {
  const e = document.createElementNS(SVGNS, tag2);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function niceStep(minWorld) {
  if (!(minWorld > 0) || !isFinite(minWorld)) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(minWorld)));
  const c2 = minWorld / p;
  const m = c2 <= 1 ? 1 : c2 <= 2 ? 2 : c2 <= 5 ? 5 : 10;
  return m * p;
}
var FeatureCanvas = class {
  constructor() {
    this.container = null;
    this.svg = null;
    this.gGrid = this.gItems = this.gHandles = null;
    this.spec = null;
    this.active = null;
    this.pan = null;
    this._tf = null;
    this._userAdjusted = false;
    this._vw = 0;
    this._vh = 0;
    this._minScale = 0.02;
    this._maxScale = 500;
  }
  _mount(container) {
    if (this.container === container && this.svg) return;
    this.container = container;
    container.innerHTML = "";
    const svg = svgEl("svg", { class: "feature-canvas", width: "100%", height: "100%" });
    svg.style.touchAction = "none";
    svg.style.display = "block";
    this.svg = svg;
    this.gGrid = svgEl("g", {});
    this.gItems = svgEl("g", {});
    this.gHandles = svgEl("g", {});
    svg.append(this.gGrid, this.gItems, this.gHandles);
    container.appendChild(svg);
    this._bind();
  }
  _bind() {
    const svg = this.svg;
    svg.addEventListener("pointerdown", (e) => {
      if (!this.spec || !this._tf || e.button !== 0) return;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (_) {
      }
      const hit = this._hit(this._toWorld(e));
      if (hit) this.active = { id: hit.id };
      else this.pan = this._clientToVB(e.clientX, e.clientY);
      svg.style.cursor = "grabbing";
      e.preventDefault();
    });
    svg.addEventListener("pointermove", (e) => {
      if (!this.spec || !this._tf) return;
      if (this.active) {
        if (this.spec.onDrag) this.spec.onDrag(this.active.id, this._toWorld(e));
        e.preventDefault();
      } else if (this.pan) {
        const v6 = this._clientToVB(e.clientX, e.clientY);
        this._tf.cxw -= (v6.x - this.pan.x) / this._tf.scale;
        this._tf.cyw += (v6.y - this.pan.y) / this._tf.scale;
        this.pan = v6;
        this._userAdjusted = true;
        this._draw(this.spec, this._vw, this._vh);
        e.preventDefault();
      } else {
        svg.style.cursor = this._hit(this._toWorld(e)) ? "grab" : "default";
      }
    });
    const end = (e) => {
      let id;
      if (this.active) {
        id = this.active.id;
        this.active = null;
      } else if (this.pan) {
        this.pan = null;
      } else return;
      this.svg.style.cursor = "default";
      try {
        this.svg.releasePointerCapture(e.pointerId);
      } catch (_) {
      }
      if (id != null && this.spec && this.spec.onDragEnd) this.spec.onDragEnd(id);
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("wheel", (e) => {
      if (!this.spec || !this._tf) return;
      e.preventDefault();
      const v6 = this._clientToVB(e.clientX, e.clientY);
      const w02 = this._W(v6.x, v6.y);
      const s = Math.max(this._minScale, Math.min(this._maxScale, this._tf.scale * Math.exp(-e.deltaY * 15e-4)));
      this._tf.scale = s;
      this._tf.cxw = w02.x - (v6.x - this._tf.cx) / s;
      this._tf.cyw = w02.y + (v6.y - this._tf.cy) / s;
      this._userAdjusted = true;
      this._draw(this.spec, this._vw, this._vh);
    }, { passive: false });
    svg.addEventListener("dblclick", (e) => {
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
    this._vw = VW;
    this._vh = VH;
    this.svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    if (!this._tf || !this._userAdjusted && !this.active) this._tf = this._fit(spec, VW, VH);
    else {
      this._tf.cx = VW / 2;
      this._tf.cy = VH / 2;
    }
    this._draw(spec, VW, VH);
  }
  /** Fit the union of stock + items + handles + origin into the viewport with a margin. */
  _fit(spec, VW, VH) {
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0, any = false;
    const acc = (x, y) => {
      if (!isFinite(x) || !isFinite(y)) return;
      if (!any) {
        x0 = x1 = x;
        y0 = y1 = y;
        any = true;
      } else {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    };
    acc(0, 0);
    if (spec.stock) {
      acc(0, 0);
      acc(spec.stock.w, spec.stock.h);
    }
    (spec.items || []).forEach((it) => {
      if (it.kind === "hole") acc(it.x, it.y);
      else if (it.kind === "line") {
        acc(it.x1, it.y1);
        acc(it.x2, it.y2);
      } else if (it.kind === "circle") {
        acc(it.cx - it.r, it.cy - it.r);
        acc(it.cx + it.r, it.cy + it.r);
      } else if (it.kind === "rect") {
        acc(it.x, it.y);
        acc(it.x + it.w, it.y + it.h);
      }
    });
    (spec.handles || []).forEach((h2) => acc(h2.x, h2.y));
    let w2 = x1 - x0, h = y1 - y0;
    if (!(w2 > 1)) {
      x0 -= 50;
      x1 += 50;
      w2 = x1 - x0;
    }
    if (!(h > 1)) {
      y0 -= 50;
      y1 += 50;
      h = y1 - y0;
    }
    const scale = Math.min(VW / w2, VH / h) * 0.82;
    return { scale, cxw: (x0 + x1) / 2, cyw: (y0 + y1) / 2, cx: VW / 2, cy: VH / 2 };
  }
  _S(x, y) {
    const t = this._tf;
    return { x: t.cx + (x - t.cxw) * t.scale, y: t.cy - (y - t.cyw) * t.scale };
  }
  _W(sx, sy) {
    const t = this._tf;
    return { x: t.cxw + (sx - t.cx) / t.scale, y: t.cyw - (sy - t.cy) / t.scale };
  }
  /** client (CSS px) → viewBox units, accounting for viewBox scaling. */
  _clientToVB(clientX, clientY) {
    const p = this.svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  _toWorld(e) {
    const v6 = this._clientToVB(e.clientX, e.clientY);
    return this._W(v6.x, v6.y);
  }
  /** Nearest handle within a ~12px tolerance, or null. */
  _hit(w2) {
    const tol = 13 / this._tf.scale;
    let best = null, bd = tol;
    (this.spec.handles || []).forEach((h) => {
      const d = Math.hypot(h.x - w2.x, h.y - w2.y);
      if (d <= bd) {
        bd = d;
        best = h;
      }
    });
    return best;
  }
  _draw(spec, VW, VH) {
    const grid = this.gGrid, items = this.gItems, handles = this.gHandles;
    grid.replaceChildren();
    items.replaceChildren();
    handles.replaceChildren();
    const tl = this._W(0, 0), br = this._W(VW, VH);
    const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y);
    const step = niceStep(16 / this._tf.scale);
    const major = step * 5;
    const line2 = (x1, y1, x2, y2, cls) => {
      const a = this._S(x1, y1), b2 = this._S(x2, y2);
      grid.appendChild(svgEl("line", { x1: a.x, y1: a.y, x2: b2.x, y2: b2.y, class: cls }));
    };
    if (step > 0 && (maxX - minX) / step < 400) {
      for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
        line2(x, minY, x, maxY, Math.abs(x % major) < 1e-6 ? "fc-grid-major" : "fc-grid-minor");
      }
      for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
        line2(minX, y, maxX, y, Math.abs(y % major) < 1e-6 ? "fc-grid-major" : "fc-grid-minor");
      }
    }
    if (spec.stock && spec.stock.w > 0 && spec.stock.h > 0) {
      const o = this._S(0, spec.stock.h);
      items.appendChild(svgEl("rect", {
        x: o.x,
        y: o.y,
        width: spec.stock.w * this._tf.scale,
        height: spec.stock.h * this._tf.scale,
        class: "fc-stock",
        rx: 2
      }));
    }
    const og = this._S(0, 0);
    grid.appendChild(svgEl("line", { x1: og.x - 9, y1: og.y, x2: og.x + 9, y2: og.y, class: "fc-axis-x" }));
    grid.appendChild(svgEl("line", { x1: og.x, y1: og.y - 9, x2: og.x, y2: og.y + 9, class: "fc-axis-y" }));
    (spec.items || []).forEach((it) => {
      if (it.kind === "circle") {
        const c2 = this._S(it.cx, it.cy);
        items.appendChild(svgEl("circle", { cx: c2.x, cy: c2.y, r: it.r * this._tf.scale, class: "fc-guide" }));
      } else if (it.kind === "line") {
        const a = this._S(it.x1, it.y1), b2 = this._S(it.x2, it.y2);
        items.appendChild(svgEl("line", { x1: a.x, y1: a.y, x2: b2.x, y2: b2.y, class: "fc-guide" }));
      } else if (it.kind === "rect") {
        const p = this._S(it.x, it.y + it.h);
        items.appendChild(svgEl("rect", { x: p.x, y: p.y, width: it.w * this._tf.scale, height: it.h * this._tf.scale, class: "fc-guide" }));
      }
    });
    (spec.items || []).forEach((it) => {
      if (it.kind !== "hole") return;
      const c2 = this._S(it.x, it.y);
      const rad = Math.max(3, (it.r || 0) * this._tf.scale);
      items.appendChild(svgEl("circle", { cx: c2.x, cy: c2.y, r: rad, class: it.skipped ? "fc-hole-skip" : "fc-hole" }));
      if (it.skipped) {
        const k = rad * 0.7;
        items.appendChild(svgEl("line", { x1: c2.x - k, y1: c2.y - k, x2: c2.x + k, y2: c2.y + k, class: "fc-hole-skip" }));
        items.appendChild(svgEl("line", { x1: c2.x - k, y1: c2.y + k, x2: c2.x + k, y2: c2.y - k, class: "fc-hole-skip" }));
      }
      if (it.n != null) {
        const t = svgEl("text", { x: c2.x, y: c2.y - rad - 3, class: "fc-hole-label" });
        t.textContent = it.n;
        items.appendChild(t);
      }
    });
    (spec.handles || []).forEach((h) => {
      const c2 = this._S(h.x, h.y);
      if (h.kind === "move") {
        handles.appendChild(svgEl("rect", { x: c2.x - 6, y: c2.y - 6, width: 12, height: 12, class: "fc-handle fc-handle-move", rx: 2 }));
      } else {
        handles.appendChild(svgEl("circle", { cx: c2.x, cy: c2.y, r: 6, class: "fc-handle" }));
      }
      if (h.label) {
        const t = svgEl("text", { x: c2.x + 10, y: c2.y - 8, class: "fc-handle-label" });
        t.textContent = h.label;
        handles.appendChild(t);
      }
    });
  }
};

// ../DDCS-Studio/web/wizards/views/drillView.js
init_toolPicker();
var wizard10 = new DrillWizard();
var layout = new FeatureCanvas();
var v = (id) => {
  const e = el(id);
  return e ? e.value : void 0;
};
var num5 = (val2, d) => val2 === "" || val2 == null || isNaN(Number(val2)) ? d : Number(val2);
var r33 = (n) => Math.round(n * 1e3) / 1e3;
var parseSkip = (s) => new Set(String(s || "").split(/[ ,]+/).map((t) => parseInt(t, 10)).filter((n) => n > 0));
function setFields(map) {
  let first = null;
  for (const id in map) {
    const e = el(id);
    if (!e) continue;
    e.value = String(r33(map[id]));
    first = first || e;
  }
  if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyTool() {
  const sel = el("d_tool");
  if (!sel || !sel.value) return;
  const t = getTool(sel.value);
  if (!t) return;
  const map = {};
  if (t.dia !== "" && t.dia != null) map[v("d_method") === "helical" ? "d_toolDia" : "d_holeDia"] = t.dia;
  if (t.feed !== "" && t.feed != null) map.d_feed = t.feed;
  if (t.rpm !== "" && t.rpm != null) map.d_rpm = t.rpm;
  if (Object.keys(map).length) setFields(map);
}
function buildDrillSpec(params, stock) {
  const pat = params.pattern || "grid";
  const ox = num5(params.originX, 0), oy = num5(params.originY, 0);
  const holeR = Math.max(0.5, num5(params.holeDia, 6) / 2);
  const handles = [{ id: "origin", x: ox, y: oy, kind: "move", label: "pos" }];
  const items = [];
  if (pat === "circle") {
    const R = num5(params.dia, 50) / 2, a0 = num5(params.startAngle, 0) * Math.PI / 180;
    items.push({ kind: "circle", cx: ox, cy: oy, r: R });
    handles.push({ id: "ring", x: ox + R * Math.cos(a0), y: oy + R * Math.sin(a0), kind: "size", label: "\xD8 / \u2220" });
  } else if (pat === "grid") {
    const cols = Math.max(1, Math.round(num5(params.cols, 3))), rows = Math.max(1, Math.round(num5(params.rows, 3)));
    const dx = num5(params.dx, 20), dy = num5(params.dy, 20);
    items.push({ kind: "rect", x: ox, y: oy, w: (cols - 1) * dx, h: (rows - 1) * dy });
    handles.push({ id: "size", x: ox + (cols - 1) * dx, y: oy + (rows - 1) * dy, kind: "size", label: "spacing" });
  } else if (pat === "rect") {
    const w2 = num5(params.w, 100), h = num5(params.h, 80);
    items.push({ kind: "rect", x: ox, y: oy, w: w2, h });
    handles.push({ id: "size", x: ox + w2, y: oy + h, kind: "size", label: "W \xD7 H" });
  } else if (pat === "line") {
    const n = Math.max(1, Math.round(num5(params.count, 3))), s = num5(params.spacing, 20), a = num5(params.angle, 0) * Math.PI / 180;
    const ex = ox + (n - 1) * s * Math.cos(a), ey = oy + (n - 1) * s * Math.sin(a);
    items.push({ kind: "line", x1: ox, y1: oy, x2: ex, y2: ey });
    handles.push({ id: "end", x: ex, y: ey, kind: "size", label: "len / \u2220" });
  }
  const skip = parseSkip(params.skip);
  patternPoints(params).forEach((p, i) => items.push({ kind: "hole", x: p.x, y: p.y, n: i + 1, r: holeR, skipped: skip.has(i + 1) }));
  return {
    stock: stock && stock.x > 0 && stock.y > 0 ? { w: stock.x, h: stock.y } : null,
    items,
    handles,
    onDrag(id, w2) {
      if (id === "origin") {
        setFields({ d_originX: w2.x, d_originY: w2.y });
        return;
      }
      if (pat === "circle") {
        const dx = w2.x - ox, dy = w2.y - oy;
        setFields({ d_dia: 2 * Math.hypot(dx, dy), d_startAngle: Math.atan2(dy, dx) * 180 / Math.PI });
      } else if (pat === "grid") {
        const cols = Math.max(1, Math.round(num5(params.cols, 3))), rows = Math.max(1, Math.round(num5(params.rows, 3)));
        const m = {};
        if (cols > 1) m.d_dx = Math.max(0, (w2.x - ox) / (cols - 1));
        if (rows > 1) m.d_dy = Math.max(0, (w2.y - oy) / (rows - 1));
        setFields(m);
      } else if (pat === "rect") {
        setFields({ d_w: Math.max(1, w2.x - ox), d_h: Math.max(1, w2.y - oy) });
      } else if (pat === "line") {
        const n = Math.max(1, Math.round(num5(params.count, 3)));
        const dx = w2.x - ox, dy = w2.y - oy, m = { d_angle: Math.atan2(dy, dx) * 180 / Math.PI };
        if (n > 1) m.d_spacing = Math.max(0, Math.hypot(dx, dy) / (n - 1));
        setFields(m);
      }
    }
  };
}
var drillView = {
  type: "drill",
  panelId: "wiz_drill",
  codeElId: "wiz_drill_code",
  large: true,
  twoPane: true,
  inputIds: [
    "d_pattern",
    "d_skip",
    "d_originX",
    "d_originY",
    "d_cols",
    "d_rows",
    "d_dx",
    "d_dy",
    "d_dia",
    "d_count",
    "d_startAngle",
    "d_w",
    "d_h",
    "d_nx",
    "d_ny",
    "d_lcount",
    "d_spacing",
    "d_angle",
    "d_method",
    "d_holeDia",
    "d_peck",
    "d_toolDia",
    "d_pitch",
    "d_depth",
    "d_clearance",
    "d_feed",
    "d_rpm"
  ],
  probeSrcFields: {},
  // not a probe wizard — keep the shared controller-source decorator a no-op
  // Custom params → form (pattern variants: `count` lives in d_count for circle but d_lcount for line, so a
  // flat map can't express it). The inverse of update()'s reads; used by wizardManager._seedForm on edit.
  setForm(p = {}) {
    const set2 = (id, val2) => {
      const e = el(id);
      if (e && val2 != null) e.value = val2;
    };
    set2("d_pattern", p.pattern);
    set2("d_method", p.method);
    set2("d_skip", p.skip);
    set2("d_originX", p.originX);
    set2("d_originY", p.originY);
    set2("d_depth", p.depth);
    set2("d_clearance", p.clearance);
    set2("d_feed", p.feed);
    set2("d_rpm", p.rpm);
    set2("d_holeDia", p.holeDia);
    set2("d_peck", p.peck);
    set2("d_toolDia", p.toolDia);
    set2("d_pitch", p.pitch);
    if (p.pattern === "grid") {
      set2("d_cols", p.cols);
      set2("d_rows", p.rows);
      set2("d_dx", p.dx);
      set2("d_dy", p.dy);
    } else if (p.pattern === "circle") {
      set2("d_dia", p.dia);
      set2("d_count", p.count);
      set2("d_startAngle", p.startAngle);
    } else if (p.pattern === "rect") {
      set2("d_w", p.w);
      set2("d_h", p.h);
      set2("d_nx", p.nx);
      set2("d_ny", p.ny);
    } else if (p.pattern === "line") {
      set2("d_lcount", p.count);
      set2("d_spacing", p.spacing);
      set2("d_angle", p.angle);
    }
  },
  onOpen(ctx2) {
    const sel = el("d_tool");
    if (sel) {
      const keep = sel.value;
      sel.innerHTML = toolOptionsHTML();
      sel.value = keep;
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", () => applyTool());
      }
    }
    ctx2.update();
  },
  update(ctx2) {
    const pattern = v("d_pattern") || "grid";
    const method = v("d_method") || "peck";
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const originX = num5(v("d_originX"), 0), originY = num5(v("d_originY"), 0);
    const params = {
      pattern,
      method,
      skip: v("d_skip") || "",
      originX,
      originY,
      cx: originX,
      cy: originY,
      x0: originX,
      y0: originY,
      depth: v("d_depth"),
      clearance: v("d_clearance"),
      feed: v("d_feed"),
      rpm: v("d_rpm"),
      holeDia: v("d_holeDia"),
      peck: v("d_peck"),
      toolDia: v("d_toolDia"),
      pitch: v("d_pitch"),
      spindle: s.spindle,
      head: s.head,
      endProgram: s.endProgram
    };
    if (pattern === "grid") Object.assign(params, { cols: v("d_cols"), rows: v("d_rows"), dx: v("d_dx"), dy: v("d_dy") });
    else if (pattern === "circle") Object.assign(params, { dia: v("d_dia"), count: v("d_count"), startAngle: v("d_startAngle") });
    else if (pattern === "rect") Object.assign(params, { w: v("d_w"), h: v("d_h"), nx: v("d_nx"), ny: v("d_ny") });
    else if (pattern === "line") Object.assign(params, { count: v("d_lcount"), spacing: v("d_spacing"), angle: v("d_angle") });
    ["grid", "circle", "rect", "line"].forEach((p) => {
      const e = el("d_pat_" + p);
      if (e) e.style.display = p === pattern ? "" : "none";
    });
    if (el("d_method_peck")) el("d_method_peck").style.display = method === "peck" ? "" : "none";
    if (el("d_method_bore")) el("d_method_bore").style.display = method === "helical" ? "" : "none";
    const gcode = wizard10.generate(params);
    el("wiz_drill_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "drillVizContainer");
    layout.render(el("drillLayoutCanvas"), buildDrillSpec(params, s.stock));
    const status = el("drillVizStatus");
    if (status) {
      const holes = (gcode.match(/\( hole \d+\/\d+ \)/g) || []).length;
      status.textContent = `${pattern} \xB7 ${method === "helical" ? "bore" : "peck"} \xB7 ${holes} holes`;
    }
    const lstatus = el("drillLayoutStatus");
    if (lstatus) lstatus.textContent = "LAYOUT \xB7 drag handles \xB7 scroll = zoom \xB7 drag bg = pan \xB7 dbl-click = fit";
  }
};

// ../DDCS-Studio/web/wizards/views/pocketView.js
init_uiUtils();
init_pocketWizard();
init_toolPicker();
var wizard11 = new PocketWizard();
var layout2 = new FeatureCanvas();
var v2 = (id) => {
  const e = el(id);
  return e ? e.value : void 0;
};
var num6 = (val2, d) => val2 === "" || val2 == null || isNaN(Number(val2)) ? d : Number(val2);
var r34 = (n) => Math.round(n * 1e3) / 1e3;
function setFields2(map) {
  let first = null;
  for (const id in map) {
    const e = el(id);
    if (!e) continue;
    e.value = String(r34(map[id]));
    first = first || e;
  }
  if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyTool2() {
  const sel = el("p_tool");
  if (!sel || !sel.value) return;
  const m = toolFieldMap(getTool(sel.value), { dia: "p_toolDia", feed: "p_feed", plunge: "p_plunge", rpm: "p_rpm" });
  if (Object.keys(m).length) setFields2(m);
}
function buildPocketSpec(params, stock) {
  const ox = num6(params.originX, 0), oy = num6(params.originY, 0);
  const items = [], handles = [{ id: "origin", x: ox, y: oy, kind: "move", label: "pos" }];
  if (params.shape === "circle") {
    const R = num6(params.dia, 50) / 2;
    items.push({ kind: "circle", cx: ox, cy: oy, r: R });
    handles.push({ id: "size", x: ox + R, y: oy, kind: "size", label: "\xD8" });
  } else {
    const w2 = num6(params.w, 80), h = num6(params.h, 60);
    items.push({ kind: "rect", x: ox, y: oy, w: w2, h });
    handles.push({ id: "size", x: ox + w2, y: oy + h, kind: "size", label: "W \xD7 H" });
  }
  return {
    stock: stock && stock.x > 0 && stock.y > 0 ? { w: stock.x, h: stock.y } : null,
    items,
    handles,
    onDrag(id, w2) {
      if (id === "origin") {
        setFields2({ p_originX: w2.x, p_originY: w2.y });
        return;
      }
      if (params.shape === "circle") setFields2({ p_dia: Math.max(1, 2 * Math.hypot(w2.x - ox, w2.y - oy)) });
      else setFields2({ p_w: Math.max(1, w2.x - ox), p_h: Math.max(1, w2.y - oy) });
    }
  };
}
var pocketView = {
  type: "pocket",
  panelId: "wiz_pocket",
  codeElId: "wiz_pocket_code",
  large: true,
  twoPane: true,
  inputIds: [
    "p_shape",
    "p_originX",
    "p_originY",
    "p_w",
    "p_h",
    "p_dia",
    "p_strategy",
    "p_toolDia",
    "p_stepoverPct",
    "p_depth",
    "p_stepdown",
    "p_clearance",
    "p_feed",
    "p_plunge",
    "p_rpm"
  ],
  probeSrcFields: {},
  onOpen(ctx2) {
    const sel = el("p_tool");
    if (sel) {
      populateToolSelect(sel);
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", applyTool2);
      }
    }
    ctx2.update();
  },
  update(ctx2) {
    const shape = v2("p_shape") || "rect";
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const originX = num6(v2("p_originX"), 0), originY = num6(v2("p_originY"), 0);
    const params = {
      shape,
      strategy: v2("p_strategy") || "spiral",
      originX,
      originY,
      w: v2("p_w"),
      h: v2("p_h"),
      dia: v2("p_dia"),
      toolDia: v2("p_toolDia"),
      stepoverPct: v2("p_stepoverPct"),
      depth: v2("p_depth"),
      stepdown: v2("p_stepdown"),
      clearance: v2("p_clearance"),
      feed: v2("p_feed"),
      plunge: v2("p_plunge"),
      rpm: v2("p_rpm"),
      spindle: s.spindle,
      head: s.head,
      endProgram: s.endProgram
    };
    if (el("p_dim_rect")) el("p_dim_rect").style.display = shape === "rect" ? "" : "none";
    if (el("p_dim_circle")) el("p_dim_circle").style.display = shape === "circle" ? "" : "none";
    const gcode = wizard11.generate(params);
    el("wiz_pocket_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "pocketVizContainer");
    layout2.render(el("pocketLayoutCanvas"), buildPocketSpec(params, s.stock));
    const status = el("pocketVizStatus");
    if (status) {
      const passes = (gcode.match(/\( Step Down z=/g) || []).length;
      status.textContent = `${shape} \xB7 ${params.strategy} \xB7 ${passes} Z pass${passes === 1 ? "" : "es"}`;
    }
    const lstatus = el("pocketLayoutStatus");
    if (lstatus) lstatus.textContent = "LAYOUT \xB7 drag handles \xB7 scroll = zoom \xB7 drag bg = pan \xB7 dbl-click = fit";
  }
};

// ../DDCS-Studio/web/wizards/views/slotView.js
init_uiUtils();
init_slotWizard();
init_toolPicker();
var wizard12 = new SlotWizard();
var layout3 = new FeatureCanvas();
var v3 = (id) => {
  const e = el(id);
  return e ? e.value : void 0;
};
var num7 = (val2, d) => val2 === "" || val2 == null || isNaN(Number(val2)) ? d : Number(val2);
var r35 = (n) => Math.round(n * 1e3) / 1e3;
function setFields3(map) {
  let first = null;
  for (const id in map) {
    const e = el(id);
    if (!e) continue;
    e.value = String(r35(map[id]));
    first = first || e;
  }
  if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyTool3() {
  const sel = el("sl_tool");
  if (!sel || !sel.value) return;
  const m = toolFieldMap(getTool(sel.value), { dia: "sl_toolDia", feed: "sl_feed", plunge: "sl_plunge", rpm: "sl_rpm" });
  if (Object.keys(m).length) setFields3(m);
}
function buildSlotSpec(params, stock) {
  const ax = num7(params.ax, 0), ay = num7(params.ay, 0), bx = num7(params.bx, 60), by = num7(params.by, 0);
  const W = Math.max(num7(params.toolDia, 6), num7(params.width, num7(params.toolDia, 6)));
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const hw = W / 2;
  const items = [
    { kind: "line", x1: ax, y1: ay, x2: bx, y2: by },
    // centreline
    { kind: "line", x1: ax + nx * hw, y1: ay + ny * hw, x2: bx + nx * hw, y2: by + ny * hw },
    // +edge
    { kind: "line", x1: ax - nx * hw, y1: ay - ny * hw, x2: bx - nx * hw, y2: by - ny * hw }
    // -edge
  ];
  const handles = [
    { id: "a", x: ax, y: ay, kind: "move", label: "A" },
    { id: "b", x: bx, y: by, kind: "move", label: "B" },
    { id: "width", x: mx + nx * hw, y: my + ny * hw, kind: "size", label: "width" }
  ];
  return {
    stock: stock && stock.x > 0 && stock.y > 0 ? { w: stock.x, h: stock.y } : null,
    items,
    handles,
    onDrag(id, w2) {
      if (id === "a") {
        setFields3({ sl_ax: w2.x, sl_ay: w2.y });
        return;
      }
      if (id === "b") {
        setFields3({ sl_bx: w2.x, sl_by: w2.y });
        return;
      }
      if (id === "width") {
        const proj2 = (w2.x - mx) * nx + (w2.y - my) * ny;
        setFields3({ sl_width: Math.max(num7(params.toolDia, 6), 2 * Math.abs(proj2)) });
      }
    }
  };
}
var slotView = {
  type: "slot",
  panelId: "wiz_slot",
  codeElId: "wiz_slot_code",
  large: true,
  twoPane: true,
  inputIds: [
    "sl_ax",
    "sl_ay",
    "sl_bx",
    "sl_by",
    "sl_width",
    "sl_toolDia",
    "sl_stepoverPct",
    "sl_depth",
    "sl_stepdown",
    "sl_clearance",
    "sl_feed",
    "sl_plunge",
    "sl_rpm"
  ],
  probeSrcFields: {},
  onOpen(ctx2) {
    const sel = el("sl_tool");
    if (sel) {
      populateToolSelect(sel);
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", applyTool3);
      }
    }
    ctx2.update();
  },
  update(ctx2) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const params = {
      ax: v3("sl_ax"),
      ay: v3("sl_ay"),
      bx: v3("sl_bx"),
      by: v3("sl_by"),
      width: v3("sl_width"),
      toolDia: v3("sl_toolDia"),
      stepoverPct: v3("sl_stepoverPct"),
      depth: v3("sl_depth"),
      stepdown: v3("sl_stepdown"),
      clearance: v3("sl_clearance"),
      feed: v3("sl_feed"),
      plunge: v3("sl_plunge"),
      rpm: v3("sl_rpm"),
      spindle: s.spindle,
      head: s.head,
      endProgram: s.endProgram
    };
    const gcode = wizard12.generate(params);
    el("wiz_slot_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "slotVizContainer");
    layout3.render(el("slotLayoutCanvas"), buildSlotSpec(params, s.stock));
    const status = el("slotVizStatus");
    if (status) {
      const len = Math.hypot(num7(v3("sl_bx"), 60) - num7(v3("sl_ax"), 0), num7(v3("sl_by"), 0) - num7(v3("sl_ay"), 0));
      const passes = (gcode.match(/\( level Z/g) || []).length;
      status.textContent = `${r35(len)} mm \xB7 ${num7(v3("sl_width"), 6)} wide \xB7 ${passes} Z pass${passes === 1 ? "" : "es"}`;
    }
    const lstatus = el("slotLayoutStatus");
    if (lstatus) lstatus.textContent = "LAYOUT \xB7 drag A / B / width \xB7 scroll = zoom \xB7 drag bg = pan \xB7 dbl-click = fit";
  }
};

// ../DDCS-Studio/web/wizards/views/surfacingView.js
init_uiUtils();
init_surfacingWizard();
init_toolPicker();
var wizard13 = new SurfacingWizard();
var layout4 = new FeatureCanvas();
var v4 = (id) => {
  const e = el(id);
  return e ? e.value : void 0;
};
var num8 = (val2, d) => val2 === "" || val2 == null || isNaN(Number(val2)) ? d : Number(val2);
var r36 = (n) => Math.round(n * 1e3) / 1e3;
function setFields4(map) {
  let first = null;
  for (const id in map) {
    const e = el(id);
    if (!e) continue;
    e.value = String(r36(map[id]));
    first = first || e;
  }
  if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyTool4() {
  const sel = el("sf_tool");
  if (!sel || !sel.value) return;
  const m = toolFieldMap(getTool(sel.value), { dia: "sf_toolDia", feed: "sf_feed", plunge: "sf_plunge", rpm: "sf_rpm" });
  if (Object.keys(m).length) setFields4(m);
}
function buildSurfacingSpec(params, stock) {
  const ox = num8(params.originX, 0), oy = num8(params.originY, 0);
  const w2 = num8(params.w, 100), h = num8(params.h, 80);
  return {
    stock: stock && stock.x > 0 && stock.y > 0 ? { w: stock.x, h: stock.y } : null,
    items: [{ kind: "rect", x: ox, y: oy, w: w2, h }],
    handles: [
      { id: "origin", x: ox, y: oy, kind: "move", label: "pos" },
      { id: "size", x: ox + w2, y: oy + h, kind: "size", label: "W \xD7 H" }
    ],
    onDrag(id, p) {
      if (id === "origin") setFields4({ sf_originX: p.x, sf_originY: p.y });
      else setFields4({ sf_w: Math.max(1, p.x - ox), sf_h: Math.max(1, p.y - oy) });
    }
  };
}
var surfacingView = {
  type: "surfacing",
  panelId: "wiz_surfacing",
  codeElId: "wiz_surfacing_code",
  large: true,
  twoPane: true,
  inputIds: [
    "sf_originX",
    "sf_originY",
    "sf_w",
    "sf_h",
    "sf_strategy",
    "sf_toolDia",
    "sf_stepoverPct",
    "sf_depth",
    "sf_stepdown",
    "sf_clearance",
    "sf_feed",
    "sf_plunge",
    "sf_rpm"
  ],
  probeSrcFields: {},
  // Default the area to the whole current stock top whenever the wizard is opened.
  onOpen(ctx2) {
    const sel = el("sf_tool");
    if (sel) {
      populateToolSelect(sel);
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", applyTool4);
      }
    }
    const st = window.ddcsGetSettings && window.ddcsGetSettings().stock || null;
    if (st && st.x > 0 && st.y > 0) setFields4({ sf_originX: 0, sf_originY: 0, sf_w: st.x, sf_h: st.y });
    else ctx2.update();
  },
  update(ctx2) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const params = {
      originX: v4("sf_originX"),
      originY: v4("sf_originY"),
      w: v4("sf_w"),
      h: v4("sf_h"),
      strategy: v4("sf_strategy") || "raster",
      toolDia: v4("sf_toolDia"),
      stepoverPct: v4("sf_stepoverPct"),
      depth: v4("sf_depth"),
      stepdown: v4("sf_stepdown"),
      clearance: v4("sf_clearance"),
      feed: v4("sf_feed"),
      plunge: v4("sf_plunge"),
      rpm: v4("sf_rpm"),
      spindle: s.spindle,
      head: s.head,
      endProgram: s.endProgram
    };
    const gcode = wizard13.generate(params);
    el("wiz_surfacing_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "surfacingVizContainer");
    layout4.render(el("surfacingLayoutCanvas"), buildSurfacingSpec(params, s.stock));
    const status = el("surfacingVizStatus");
    if (status) {
      const passes = (gcode.match(/\( Step Down z=/g) || []).length;
      status.textContent = `${num8(v4("sf_w"), 100)} \xD7 ${num8(v4("sf_h"), 80)} \xB7 ${params.strategy} \xB7 ${passes} Z pass${passes === 1 ? "" : "es"}`;
    }
    const lstatus = el("surfacingLayoutStatus");
    if (lstatus) lstatus.textContent = "LAYOUT \xB7 drag handles \xB7 scroll = zoom \xB7 drag bg = pan \xB7 dbl-click = fit";
  }
};

// ../DDCS-Studio/web/wizards/views/textView.js
init_uiUtils();
init_textWizard();
init_toolPicker();
var wizard14 = new TextWizard();
var layout5 = new FeatureCanvas();
var v5 = (id) => {
  const e = el(id);
  return e ? e.value : void 0;
};
var num10 = (val2, d) => val2 === "" || val2 == null || isNaN(Number(val2)) ? d : Number(val2);
var r37 = (n) => Math.round(n * 1e3) / 1e3;
function setFields5(map) {
  let first = null;
  for (const id in map) {
    const e = el(id);
    if (!e) continue;
    e.value = String(r37(map[id]));
    first = first || e;
  }
  if (first) first.dispatchEvent(new Event("input", { bubbles: true }));
}
function applyTool5() {
  const sel = el("tx_tool");
  if (!sel || !sel.value) return;
  const m = toolFieldMap(getTool(sel.value), { dia: "tx_toolDia", feed: "tx_feed", plunge: "tx_plunge", rpm: "tx_rpm" });
  if (Object.keys(m).length) setFields5(m);
}
function buildTextSpec(params, stock) {
  const ox = num10(params.x, 0), oy = num10(params.y, 0), H3 = num10(params.height, 12);
  const { strokes } = layoutText(params);
  const items = [];
  for (const poly of strokes) {
    for (let i = 0; i + 1 < poly.length; i++) {
      items.push({ kind: "line", x1: poly[i][0], y1: poly[i][1], x2: poly[i + 1][0], y2: poly[i + 1][1] });
    }
  }
  return {
    stock: stock && stock.x > 0 && stock.y > 0 ? { w: stock.x, h: stock.y } : null,
    items,
    handles: [
      { id: "origin", x: ox, y: oy, kind: "move", label: "pos" },
      { id: "height", x: ox, y: oy + H3, kind: "size", label: "height" }
    ],
    onDrag(id, w2) {
      if (id === "origin") setFields5({ tx_x: w2.x, tx_y: w2.y });
      else setFields5({ tx_height: Math.max(2, w2.y - oy) });
    }
  };
}
var textView = {
  type: "text",
  panelId: "wiz_text",
  codeElId: "wiz_text_code",
  large: true,
  twoPane: true,
  inputIds: [
    "tx_text",
    "tx_x",
    "tx_y",
    "tx_height",
    "tx_spacing",
    "tx_align",
    "tx_strokeWidth",
    "tx_toolDia",
    "tx_stepoverPct",
    "tx_depth",
    "tx_stepdown",
    "tx_clearance",
    "tx_feed",
    "tx_plunge",
    "tx_rpm"
  ],
  probeSrcFields: {},
  onOpen(ctx2) {
    const sel = el("tx_tool");
    if (sel) {
      populateToolSelect(sel);
      if (!sel.dataset.wired) {
        sel.dataset.wired = "1";
        sel.addEventListener("change", applyTool5);
      }
    }
    ctx2.update();
  },
  update(ctx2) {
    const s = window.ddcsGetSettings && window.ddcsGetSettings() || {};
    const params = {
      text: v5("tx_text"),
      x: v5("tx_x"),
      y: v5("tx_y"),
      height: v5("tx_height"),
      spacing: v5("tx_spacing"),
      align: v5("tx_align") || "left",
      strokeWidth: v5("tx_strokeWidth"),
      toolDia: v5("tx_toolDia"),
      stepoverPct: v5("tx_stepoverPct"),
      depth: v5("tx_depth"),
      stepdown: v5("tx_stepdown"),
      clearance: v5("tx_clearance"),
      feed: v5("tx_feed"),
      plunge: v5("tx_plunge"),
      rpm: v5("tx_rpm"),
      spindle: s.spindle,
      head: s.head,
      endProgram: s.endProgram
    };
    const gcode = wizard14.generate(params);
    el("wiz_text_code").innerHTML = UIUtils.formatGCode(gcode);
    ctx2.preview3D(gcode, "textVizContainer");
    layout5.render(el("textLayoutCanvas"), buildTextSpec(params, s.stock));
    const status = el("textVizStatus");
    if (status) {
      const passes = (gcode.match(/\( level Z/g) || []).length;
      status.textContent = `"${String(params.text || "").slice(0, 18)}" \xB7 h${num10(params.height, 12)} \xB7 ${passes} Z pass${passes === 1 ? "" : "es"}`;
    }
    const lstatus = el("textLayoutStatus");
    if (lstatus) lstatus.textContent = "LAYOUT \xB7 drag pos / height \xB7 scroll = zoom \xB7 drag bg = pan \xB7 dbl-click = fit";
  }
};

// ../DDCS-Studio/web/wizards/views/index.js
var WIZARD_VIEWS = [
  commView,
  wcsView,
  cornerView,
  middleView,
  circularView,
  rotaryCenterView,
  rotaryClockView,
  edgeView,
  alignmentView,
  drillView,
  pocketView,
  slotView,
  surfacingView,
  textView,
  atcLengthView,
  atcCheckView,
  atcWarmupView,
  atcChangeView,
  atcTestView
];
var viewByType = new Map(WIZARD_VIEWS.map((v6) => [v6.type, v6]));

// ../DDCS-Studio/web/ui/sound.js
var audioUrl = "assets/audio/421337__jaszunio15__click_100.wav";
var VOLUME = 0.5;
var clickSound = new Audio(audioUrl);
clickSound.preload = "auto";
clickSound.volume = VOLUME;
var audioCtx = null;
var reversedBuffer = null;
var gainNode = null;
(async function initBuffers() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = VOLUME;
    gainNode.connect(audioCtx.destination);
    const resp = await fetch(audioUrl);
    const arrayBuf = await resp.arrayBuffer();
    const buf = await audioCtx.decodeAudioData(arrayBuf);
    reversedBuffer = audioCtx.createBuffer(
      buf.numberOfChannels,
      buf.length,
      buf.sampleRate
    );
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const srcData = buf.getChannelData(ch);
      const dstData = reversedBuffer.getChannelData(ch);
      for (let i = 0, j = buf.length - 1; i < buf.length; i++, j--) {
        dstData[i] = srcData[j];
      }
    }
  } catch (e) {
    console.warn("sound.js: failed to prepare reversed buffer", e);
    reversedBuffer = null;
  }
})();
function playClick() {
  try {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {
    });
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {
    });
  } catch (e) {
  }
}
function playClickReverse() {
  if (audioCtx && reversedBuffer) {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {
      });
      const src = audioCtx.createBufferSource();
      src.buffer = reversedBuffer;
      if (gainNode) {
        src.connect(gainNode);
      } else {
        src.connect(audioCtx.destination);
      }
      src.start(0);
    } catch (e) {
      playClick();
    }
  } else {
    playClick();
  }
}

// ../DDCS-Studio/web/ui/probeSrcGlyph.js
init_uiUtils();
init_settingsPanel();
var GLYPH_SVG = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><circle cx="5" cy="5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><circle class="psrc-dot" cx="5" cy="5" r="2" fill="currentColor"/></svg>';
function applyState(input, btn, field3) {
  const src = probeSrc(field3);
  const isSelect = input.tagName === "SELECT";
  if (src) {
    if (isSelect) {
      input.disabled = true;
    } else {
      if (input.dataset.psrcStudio === void 0) input.dataset.psrcStudio = input.value;
      input.value = src.ctrl;
      input.readOnly = true;
    }
    input.classList.add("psrc-ctrl");
    btn.classList.add("psrc-lit");
    btn.title = `${src.label}: reads ${src.pr} (${src.ctrl}) on the controller at runtime \u2014 click to override with a Studio value`;
  } else {
    if (isSelect) {
      input.disabled = false;
    } else {
      if (input.dataset.psrcStudio !== void 0) {
        input.value = input.dataset.psrcStudio;
        delete input.dataset.psrcStudio;
      }
      input.readOnly = false;
    }
    input.classList.remove("psrc-ctrl");
    btn.classList.remove("psrc-lit");
    btn.title = "Studio value \u2014 click to read this from the controller\u2019s parameter page at runtime";
  }
}
function decorateInput(inputId, field3) {
  const input = el(inputId);
  if (!input || !probeSrcAvailable(field3)) return;
  let btn = input.parentElement?.querySelector?.(`.psrc-glyph[data-for="${inputId}"]`);
  if (!btn) {
    const wrap = document.createElement("span");
    wrap.className = "psrc-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "psrc-glyph";
    btn.dataset.for = inputId;
    btn.innerHTML = GLYPH_SVG;
    wrap.appendChild(btn);
    btn.addEventListener("click", () => {
      setProbeSrc(field3, probeSrc(field3) ? "studio" : "ctrl");
      applyState(input, btn, field3);
    });
  }
  applyState(input, btn, field3);
}
function decorateProbeSrc(view) {
  const map = view && view.probeSrcFields;
  if (!map) return;
  for (const [inputId, field3] of Object.entries(map)) decorateInput(inputId, field3);
}

// ../DDCS-Studio/web/wizardManager.js
init_createPreviewPanel();

// ../DDCS-Studio/web/ui/cloud/cloudVolume.js
async function getAdapter(provider) {
  if (provider === "google") return Promise.resolve().then(() => (init_googleDrive(), googleDrive_exports));
  if (provider === "dropbox") return import("./dropbox.js");
  return null;
}

// ../DDCS-Studio/web/ui/wizardTemplates.js
init_cloudAccount();
init_opRecord();
var LKEY = (op) => `ddcs_tpl_${op}`;
var CLOUD_FILE = (op) => `ddcs-templates-${op}.mjson`;
var esc2 = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c2]);
function readLocal(op) {
  try {
    return JSON.parse(localStorage.getItem(LKEY(op)) || "[]");
  } catch (_) {
    return [];
  }
}
function writeLocal(op, list2) {
  try {
    localStorage.setItem(LKEY(op), JSON.stringify(list2));
  } catch (_) {
  }
}
function cloudConnected() {
  try {
    return !!getAccount().connected;
  } catch (_) {
    return false;
  }
}
async function adapter() {
  const acc = getAccount();
  if (!acc.connected || !acc.provider) return null;
  return getAdapter(acc.provider);
}
async function cloudFileRef(a, op) {
  const root = await a.ensureRoot();
  const items = await a.list(root);
  const hit = items.find((i) => i.name === CLOUD_FILE(op));
  return { root, ref: hit ? hit.ref : null };
}
async function cloudRead(op) {
  try {
    const a = await adapter();
    if (!a) return [];
    const { ref } = await cloudFileRef(a, op);
    if (!ref) return [];
    const obj = await a.read(ref);
    return Array.isArray(obj && obj.templates) ? obj.templates : [];
  } catch (_) {
    return [];
  }
}
async function cloudWrite(op, list2) {
  const a = await adapter();
  if (!a) throw new Error("no cloud connected");
  const { root } = await cloudFileRef(a, op);
  await a.write(CLOUD_FILE(op), { templates: list2 }, root);
}
async function listTemplates(op) {
  const local = readLocal(op).map((t) => ({ name: t.name, params: t.params, where: "local" }));
  let cloud = [];
  if (cloudConnected()) cloud = (await cloudRead(op)).map((t) => ({ name: t.name, params: t.params, where: "cloud" }));
  return [...local, ...cloud];
}
async function saveTemplate(op, name, params, where = "local") {
  const rec = { name, params };
  if (where === "cloud") {
    const list2 = (await cloudRead(op)).filter((t) => t.name !== name);
    list2.push(rec);
    await cloudWrite(op, list2);
  } else {
    const list2 = readLocal(op).filter((t) => t.name !== name);
    list2.push(rec);
    writeLocal(op, list2);
  }
}
async function deleteTemplate(op, name, where = "local") {
  if (where === "cloud") await cloudWrite(op, (await cloudRead(op)).filter((t) => t.name !== name));
  else writeLocal(op, readLocal(op).filter((t) => t.name !== name));
}
var _pop2 = null;
var _onDocDown = null;
function closeTemplatesPopover() {
  if (_onDocDown) {
    document.removeEventListener("pointerdown", _onDocDown, true);
    _onDocDown = null;
  }
  if (_pop2 && _pop2.parentNode) _pop2.parentNode.removeChild(_pop2);
  _pop2 = null;
}
function openTemplatesPopover(wm, anchor) {
  if (_pop2) {
    closeTemplatesPopover();
    return;
  }
  const op = wm && wm._activeType;
  if (!op || !anchor) return;
  const label = typeof wm.opLabel === "function" && wm.opLabel(op) || op;
  const pop = document.createElement("div");
  pop.className = "wiz-tpl-pop";
  pop.innerHTML = `<div class="wt-head">Templates \u2014 ${esc2(label)}</div><button class="wt-save" type="button">+ Save current as template\u2026</button><div class="wt-list">Loading\u2026</div>`;
  document.body.appendChild(pop);
  _pop2 = pop;
  const r = anchor.getBoundingClientRect();
  pop.style.top = Math.round(r.bottom + 6) + "px";
  pop.style.left = Math.round(Math.min(r.left, window.innerWidth - 252)) + "px";
  pop.querySelector(".wt-save").addEventListener("click", async () => {
    try {
      wm.update();
    } catch (_) {
    }
    const last = getLastOp();
    const params = last && last.type === op ? last.params : null;
    if (!params) {
      alert("Nothing to save yet \u2014 adjust the wizard first.");
      return;
    }
    const name = (window.prompt("Template name:") || "").trim();
    if (!name) return;
    let where = "local";
    if (cloudConnected()) where = window.confirm("Save to your connected cloud?\n\nOK = Cloud  \xB7  Cancel = Local") ? "cloud" : "local";
    try {
      await saveTemplate(op, name, params, where);
    } catch (e) {
      alert("Save failed: " + (e && e.message || e));
    }
    renderList();
  });
  async function renderList() {
    const listEl = pop.querySelector(".wt-list");
    let list2 = [];
    try {
      list2 = await listTemplates(op);
    } catch (_) {
    }
    if (!list2.length) {
      listEl.innerHTML = '<div class="wt-empty">No templates yet.</div>';
      return;
    }
    listEl.innerHTML = list2.map((t, i) => `<div class="wt-row" data-i="${i}"><span class="wt-name" title="Load">${esc2(t.name)}</span><span class="wt-where" title="${t.where === "cloud" ? "Cloud" : "Local"}">${t.where === "cloud" ? "\u2601" : "\u{1F4BE}"}</span><button class="wt-del" type="button" title="Delete">\u2715</button></div>`).join("");
    [...listEl.querySelectorAll(".wt-row")].forEach((row, i) => {
      const t = list2[i];
      row.querySelector(".wt-name").addEventListener("click", () => {
        try {
          wm._seedForm(op, t.params);
          wm.update();
        } catch (_) {
        }
        closeTemplatesPopover();
      });
      row.querySelector(".wt-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await deleteTemplate(op, t.name, t.where);
        } catch (_) {
        }
        renderList();
      });
    });
  }
  renderList();
  _onDocDown = (e) => {
    if (_pop2 && !_pop2.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closeTemplatesPopover();
  };
  setTimeout(() => document.addEventListener("pointerdown", _onDocDown, true), 0);
}

// ../DDCS-Studio/web/wizardManager.js
var PROBE_DEFAULT_FIELDS = {
  c_radius: "radius",
  al_feed_fast: "fastFeed",
  c_feed_fast: "fastFeed",
  circ_feed_fast: "fastFeed",
  m_feed_fast: "fastFeed",
  p_feed_fast: "fastFeed",
  rc_feed_fast: "fastFeed",
  rcl_feed_fast: "fastFeed",
  al_feed_slow: "slowFeed",
  c_feed_slow: "slowFeed",
  circ_feed_slow: "slowFeed",
  m_feed_slow: "slowFeed",
  p_feed_slow: "slowFeed",
  rc_feed_slow: "slowFeed",
  rcl_feed_slow: "slowFeed",
  al_retract: "retract",
  c_retract: "retract",
  circ_retract: "retract",
  m_retract: "retract",
  p_retract: "retract",
  rc_retract: "retract",
  rcl_retract: "retract",
  al_safe_z: "safeZ",
  c_safe_z: "safeZ",
  circ_safe_z: "safeZ",
  m_safe_z: "safeZ",
  rc_safe_z: "safeZ",
  rcl_safe_z: "safeZ",
  al_dist: "maxDist",
  c_dist: "maxDist",
  circ_dist: "maxDist",
  m_dist: "maxDist",
  p_dist: "maxDist",
  rc_dist: "maxDist",
  rcl_dist: "maxDist",
  al_q: "qStop",
  c_q: "qStop",
  circ_q: "qStop",
  m_q: "qStop",
  p_q: "qStop",
  rc_q: "qStop",
  rcl_q: "qStop"
};
var PARAM_FIELDS = {
  surfacing: { originX: "sf_originX", originY: "sf_originY", w: "sf_w", h: "sf_h", strategy: "sf_strategy", toolDia: "sf_toolDia", stepoverPct: "sf_stepoverPct", depth: "sf_depth", stepdown: "sf_stepdown", clearance: "sf_clearance", feed: "sf_feed", plunge: "sf_plunge", rpm: "sf_rpm" },
  pocket: { shape: "p_shape", strategy: "p_strategy", originX: "p_originX", originY: "p_originY", w: "p_w", h: "p_h", dia: "p_dia", toolDia: "p_toolDia", stepoverPct: "p_stepoverPct", depth: "p_depth", stepdown: "p_stepdown", clearance: "p_clearance", feed: "p_feed", plunge: "p_plunge", rpm: "p_rpm" },
  slot: { ax: "sl_ax", ay: "sl_ay", bx: "sl_bx", by: "sl_by", width: "sl_width", toolDia: "sl_toolDia", stepoverPct: "sl_stepoverPct", depth: "sl_depth", stepdown: "sl_stepdown", clearance: "sl_clearance", feed: "sl_feed", plunge: "sl_plunge", rpm: "sl_rpm" },
  text: { text: "tx_text", x: "tx_x", y: "tx_y", height: "tx_height", spacing: "tx_spacing", align: "tx_align", strokeWidth: "tx_strokeWidth", toolDia: "tx_toolDia", stepoverPct: "tx_stepoverPct", depth: "tx_depth", stepdown: "tx_stepdown", clearance: "tx_clearance", feed: "tx_feed", plunge: "tx_plunge", rpm: "tx_rpm" },
  corner: { corner: "c_corner", probeZ: "c_probe_z_first", syncA: "c_sync_a", slave: "c_slave", probeSeq: "c_probe_seq", wcs: "c_wcs", dist: "c_dist", retract: "c_retract", f_fast: "c_feed_fast", f_slow: "c_feed_slow", qStop: "c_q", safeZ: "c_safe_z", travelDist: "c_travel_dist", scanDepth: "c_scan_depth", radius: "c_radius" },
  edge: { axis: "p_axis", dir: "p_dir", wcs: "p_wcs", dist: "p_dist", retract: "p_retract", syncA: "p_sync_a", slave: "p_slave", f_fast: "p_feed_fast", f_slow: "p_feed_slow", qStop: "p_q" },
  middle: { featureType: "m_type", axis: "m_axis", findBoth: "m_both", syncA: "m_sync_a", slave: "m_slave", wcs: "m_wcs", dist: "m_dist", retract: "m_retract", safeZ: "m_safe_z", f_fast: "m_feed_fast", f_slow: "m_feed_slow", qStop: "m_q", dir1: "m_dir", dir2: "m_dir2" },
  wcs: { sys: "w_sys", axisX: "w_x", axisY: "w_y", axisZ: "w_z", sync: "w_sync", slave: "w_slave" },
  alignment: { checkAxis: "al_check_axis", probeDir: "al_probe_dir", tolerance: "al_tolerance", dist: "al_dist", retract: "al_retract", safeZ: "al_safe_z", f_fast: "al_feed_fast", f_slow: "al_feed_slow", qStop: "al_q" },
  circular: { featureType: "circ_type", wcs: "circ_wcs", dist: "circ_dist", retract: "circ_retract", safeZ: "circ_safe_z", f_fast: "circ_feed_fast", f_slow: "circ_feed_slow", qStop: "circ_q" },
  rotary_clock: { action: "rcl_action", reference: "rcl_reference", span: "rcl_span", wcs: "rcl_wcs", dist: "rcl_dist", retract: "rcl_retract", safeZ: "rcl_safe_z", f_fast: "rcl_feed_fast", f_slow: "rcl_feed_slow", qStop: "rcl_q" },
  rotary_center: { method: "rc_method", datum: "rc_datum", diameter: "rc_diameter", wcs: "rc_wcs", dist: "rc_dist", retract: "rc_retract", safeZ: "rc_safe_z", f_fast: "rc_feed_fast", f_slow: "rc_feed_slow", qStop: "rc_q" },
  comm: { type: "c_type", msg: "c_msg", val: "c_val", cycle: "c_cycle", popupMode: "c_popup_mode", id: "c_id", dest: "c_dest", slot1: "c_slot1", slot2: "c_slot2", slot3: "c_slot3", slot4: "c_slot4", statusColor: "c_status_color", statusMode: "c_status_mode", statusDwell: "c_status_dwell" },
  atc_check: { tolerance: "atc_check_tol" },
  atc_warmup: { rpm1: "atc_warmup_rpm1", time1: "atc_warmup_time1", rpm2: "atc_warmup_rpm2", time2: "atc_warmup_time2" },
  atc_change: { mode: "atc_change_mode", x: "atc_change_x", y: "atc_change_y", z: "atc_change_z", zClear: "atc_change_zclear", capacity: "atc_change_capacity", fixedT: "atc_change_fixedt", waitSpindle: "atc_change_m300", dustCover: "atc_change_cover", confirm: "atc_change_confirm" },
  atc_test: { mode: "atc_test_mode", cycles: "atc_test_cycles", dwellMs: "atc_test_dwell", first: "atc_test_first", count: "atc_test_count", zClear: "atc_test_zclear", descend: "atc_test_descend" }
};
var WizardManager = class {
  constructor(editorManager) {
    this.editorManager = editorManager;
    this.views = WIZARD_VIEWS;
    this.wizardElement = el("wizard");
    console.debug("WizardManager: constructor - registry size=", this.views.length, "wizardElement=", !!this.wizardElement);
    if (this.wizardElement) {
      this.setupEventListeners();
      console.debug("WizardManager: event listeners set up");
    } else {
      console.warn("WizardManager: wizard element (#wizard) not found");
    }
  }
  setupEventListeners() {
    let downOnBackdrop = false;
    this.wizardElement.addEventListener("pointerdown", (e) => {
      downOnBackdrop = e.target.id === "wizard";
    });
    this.wizardElement.addEventListener("click", (e) => {
      if (e.target.id === "wizard" && downOnBackdrop) this.close();
    });
    this.wizardElement.addEventListener("click", (e) => {
      const ln = e.target.closest('pre[id^="wiz_"][id$="_code"] .g-line');
      if (!ln) return;
      const i = parseInt(ln.getAttribute("data-line-index"), 10);
      const panel = this._activePanel;
      if (!Number.isFinite(i) || !panel || panel.engine && panel.engine.running) return;
      const codeEl = ln.closest('pre[id^="wiz_"][id$="_code"]');
      codeEl.querySelectorAll(".g-line.active-line").forEach((s) => s.classList.remove("active-line"));
      ln.classList.add("active-line");
      if (panel.seekLine) panel.seekLine(i);
    });
    const box = this.wizardElement.querySelector(".wiz-box");
    const head = box && box.querySelector(".wiz-head");
    if (box && head) makeDraggable(box, head, { ignore: "select, button, input, .wiz-gear, .wiz-close, .wiz-templates" });
    const tplBtn = this.wizardElement.querySelector(".wiz-templates");
    if (tplBtn) tplBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTemplatesPopover(this, tplBtn);
    });
    window.addEventListener("ddcs:settings-changed", () => {
      if (this.wizardElement && this.wizardElement.classList.contains("active")) this.update();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.wizardElement && this.wizardElement.classList.contains("active")) {
          this.close();
          e.preventDefault();
        }
      }
    });
    this.setupWizardInputListeners();
  }
  setupWizardInputListeners() {
    const wizInputs = this.views.flatMap((v6) => v6.inputIds || []);
    wizInputs.forEach((id) => {
      const element = el(id);
      if (!element) return;
      const tag2 = element.tagName.toLowerCase();
      const type = (element.type || "").toLowerCase();
      if (tag2 === "select" || type === "checkbox" || type === "radio") {
        element.addEventListener("change", () => this.update());
      } else {
        element.addEventListener("input", () => this.update());
      }
    });
  }
  /** Pre-fill the touch-probe wizards' per-op fields from the global 3D-probe defaults. */
  applyProbeDefaults() {
    const p = window.ddcsGetSettings && window.ddcsGetSettings().probes || null;
    if (!p) return;
    for (const [id, key] of Object.entries(PROBE_DEFAULT_FIELDS)) {
      const v6 = p[key];
      if (v6 == null) continue;
      const e = el(id);
      if (e) e.value = v6;
    }
  }
  /** The view whose panel is currently visible (or null). */
  activeView() {
    return this.views.find((v6) => {
      const e = el(v6.panelId);
      return e && e.style.display !== "none";
    }) || null;
  }
  open(type) {
    playClick();
    this._activeType = type;
    closeTemplatesPopover();
    this.editingOpId = null;
    {
      const b2 = document.querySelector(".wiz-box");
      if (b2) b2.classList.remove("editing");
    }
    window.dispatchEvent(new CustomEvent("ddcs:stop-previews"));
    if (window.ddcsStopPreview) window.ddcsStopPreview();
    const view = viewByType.get(type) || null;
    const box = document.querySelector(".wiz-box");
    if (box) Object.assign(box.style, { position: "", left: "", top: "", right: "", bottom: "", transform: "", margin: "" });
    console.debug("WizardManager.open()", type, "view=", !!view, "wizardElement=", this.wizardElement);
    if (!this.wizardElement) {
      console.warn("WizardManager.open(): no wizard container available");
      return;
    }
    if (view ? view.large : type === "probe") {
      box.classList.add("large");
    } else {
      box.classList.remove("large");
    }
    box.classList.toggle("two-pane", !!(view && view.twoPane));
    this.wizardElement.style.display = "flex";
    this.wizardElement.classList.add("active");
    this.views.forEach((v6) => {
      const elem = el(v6.panelId);
      if (elem) elem.style.display = "none";
    });
    const wizElem = el("wiz_" + type);
    if (wizElem) {
      wizElem.style.display = "block";
      if (view && typeof view.onShow === "function") view.onShow(this);
      decorateProbeSrc(view);
      this.applyProbeDefaults();
      this.update();
      if (view && typeof view.onOpen === "function") view.onOpen(this);
    }
  }
  /**
   * Open a wizard to EDIT an existing op (from the editor's hover chip). Seeds the form from the op's params
   * — the single source of truth (no snapshot) — glows the modal to mark it as editing, and on insert REPLACES
   * that op (replaceOp rebuilds its blocks from the edited params) instead of appending a new one.
   */
  /** Does this op type support seeding its form from params (so it can be edited in place)? */
  canEdit(opType) {
    const view = viewByType.get(opType);
    return !!(opType && (PARAM_FIELDS[opType] || view && typeof view.setForm === "function"));
  }
  /** params → form: a custom view.setForm() when it has one (e.g. drill's pattern variants), else the central
   *  PARAM_FIELDS map (value/checkbox decided by element type). params are the single source of truth — no snapshot. */
  _seedForm(opType, params) {
    const view = viewByType.get(opType);
    if (view && typeof view.setForm === "function") {
      view.setForm(params || {});
      return;
    }
    const map = PARAM_FIELDS[opType];
    if (!map || !params) return;
    for (const key in map) {
      const e = el(map[key]);
      if (!e) continue;
      const val2 = params[key];
      if (val2 == null) continue;
      if (e.type === "checkbox") e.checked = !!val2;
      else e.value = val2;
    }
  }
  openForEdit(opId) {
    const prog = window.ddcsGetBlockProgram && window.ddcsGetBlockProgram() || [];
    const op = prog.find((b2) => b2 && b2.type === "op" && b2.id === opId);
    if (!op || !op.opType) return;
    this.open(op.opType);
    this._seedForm(op.opType, op.params);
    this.update();
    this.editingOpId = opId;
    const box = document.querySelector(".wiz-box");
    if (box) box.classList.add("editing");
  }
  // Back-compat entry points (older callers and window.* glue)
  openCorner() {
    this.open("corner");
  }
  openMiddle() {
    this.open("middle");
  }
  openEdge() {
    this.open("edge");
  }
  openAlignment() {
    this.open("alignment");
  }
  /**
   * Hide the wizard overlay.  If `reverse` is truthy the click sound will
   * play backwards; callers that are performing an insert should pass
   * `false` so only the forward animation is heard.
   */
  close(reverse = true) {
    if (reverse) {
      playClickReverse();
    }
    closeTemplatesPopover();
    this.wizardElement.classList.remove("active");
    this.wizardElement.style.display = "none";
    this.editingOpId = null;
    const box = this.wizardElement.querySelector(".wiz-box");
    if (box) box.classList.remove("editing");
  }
  update() {
    const view = this.activeView();
    if (view) return view.update(this);
  }
  // Back-compat named update/anim entry points used by app.js listeners
  updateCornerWizard() {
    return viewByType.get("corner").update(this);
  }
  updateMiddleWizard() {
    return viewByType.get("middle").update(this);
  }
  updateEdgeWizard() {
    return viewByType.get("edge").update(this);
  }
  updateAlignmentWizard() {
    return viewByType.get("alignment").update(this);
  }
  updateCommunicationWizard() {
    return viewByType.get("comm").update(this);
  }
  updateWCSWizard() {
    return viewByType.get("wcs").update(this);
  }
  updateAtcLengthWizard() {
    return viewByType.get("atc_length").update(this);
  }
  updateAtcWarmupWizard() {
    return viewByType.get("atc_warmup").update(this);
  }
  updateAtcChangeWizard() {
    return viewByType.get("atc_change").update(this);
  }
  _startCornerAnim() {
    viewByType.get("corner").startAnim();
  }
  _startEdgeAnim() {
    viewByType.get("edge").startAnim();
  }
  _startAlignmentAnim() {
    viewByType.get("alignment").startAnim();
  }
  async insert() {
    const view = this.activeView();
    const code = view ? el(view.codeElId)?.textContent : "";
    let committed = false;
    try {
      const ops = await Promise.resolve().then(() => (init_opStacks(), opStacks_exports));
      if (this.editingOpId) {
        const { getLastOp: getLastOp2 } = await Promise.resolve().then(() => (init_opRecord(), opRecord_exports));
        const op = getLastOp2();
        committed = op ? ops.replaceOp(this.editingOpId, op.params) : false;
      } else {
        committed = ops.commitActiveOp() || !!code && ops.commitDecodedCode(code);
      }
    } catch (e) {
      console.warn("commit op failed", e);
    }
    if (!committed && !this.editingOpId && code) this.editorManager.insert(code);
    if (committed || code) {
      try {
        const v6 = this._activePanel && this._activePanel.viz;
        const ws = v6 && v6.starts ? v6.starts[0] : null;
        if (ws) {
          window.__pendingSpindleStart = { x: ws.x, y: ws.y, z: ws.z };
          if (window.ddcsSetSpindleStart) window.ddcsSetSpindleStart(ws.x, ws.y, ws.z, 0);
        }
      } catch (e) {
      }
      playClick();
    } else {
      console.warn("WizardManager: No visible wizard or empty code.");
    }
    this.close(false);
  }
  // Render the wizard's generated G-code in the active wizard's viz area using THE shared preview panel
  // (identical code + UI to Studio main + Blocks). The SVG schematic is hidden (kept in wizards/views/* +
  // _svgPreview.bak.js for the DDCS CAM-menu thumbnails). The wizard feeds its own op code + inferred start.
  preview3D(gcode, containerId, start) {
    const svgCont = document.getElementById(containerId);
    if (!svgCont || !svgCont.parentElement) return;
    const parent = svgCont.parentElement;
    let host = parent.querySelector(".wiz-viz3d");
    if (!host) {
      host = document.createElement("div");
      host.className = "wiz-viz3d";
      host.style.cssText = "position:relative; width:100%;";
      parent.insertBefore(host, svgCont);
      const visual = host.closest(".wiz-visual") || parent;
      const oldLeg = visual && visual.querySelector(".viz-legend");
      if (oldLeg) oldLeg.remove();
      host.__panel = createPreviewPanel(host, {
        getGcode: () => host.__gcode || "",
        getStart: () => host.__start,
        onLine: (i) => this._highlightWizLine(host, i)
        // play → highlight the executing line in the CODE PREVIEW (like Studio main)
      });
    }
    svgCont.style.display = "none";
    host.__gcode = gcode || "";
    host.__start = start || null;
    this._activePanel = host.__panel;
    host.__panel.setActive(true);
  }
  // Highlight the executing (or clicked) line in this wizard's CODE PREVIEW — same blue as the Studio editor.
  // i = null clears. Scope to the host's own wizard BODY (#wiz_<name>.wiz-body) — all wizards share one .wiz-box,
  // so a broader scope would grab the first wizard's code, not the active one.
  _highlightWizLine(host, i) {
    const body = host && host.closest && host.closest(".wiz-body") || document;
    body.querySelectorAll('pre[id^="wiz_"][id$="_code"] .g-line.active-line').forEach((s) => s.classList.remove("active-line"));
    if (i == null) return;
    const codeEl = body.querySelector('pre[id^="wiz_"][id$="_code"]');
    const ln = codeEl && codeEl.querySelector(`.g-line[data-line-index="${i}"]`);
    if (ln) ln.classList.add("active-line");
  }
  // Old private name kept as an alias for any external callers
  _preview3D(gcode, containerId) {
    return this.preview3D(gcode, containerId);
  }
  togglePreview() {
    const commPreview = el("comm_preview_block");
    const wcsPreview = el("wcs_preview_block");
    const probePreview = el("probe_preview_block");
    if (commPreview) commPreview.classList.toggle("hidden");
    if (wcsPreview) wcsPreview.classList.toggle("hidden");
    if (probePreview) probePreview.classList.toggle("hidden");
  }
};

// ../DDCS-Studio/web/ui/commandDeck.js
init_uiUtils();

// ../DDCS-Studio/web/ui/suggestBar.js
var SUG_KEY = "ddcs_suggest_on";
var suggestEnabled = () => {
  try {
    return localStorage.getItem(SUG_KEY) !== "off";
  } catch (e) {
    return true;
  }
};
var T = (arr) => arr.map((x) => typeof x === "string" ? { label: x.trim() || x, insert: x } : x);
function suggestFor(lineBeforeCursor) {
  const raw2 = String(lineBeforeCursor || "");
  const code = raw2.replace(/\([^)]*\)/g, "");
  if (/(^|\n)[^\S\n]*$/.test(code)) return T(["G0 ", "G1 ", "G31 ", "IF ", "M3 ", "#", "("]);
  const cur = code.replace(/[\s\S]*\n/, "");
  const words = cur.trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] || "";
  const isIf = words[0] === "IF";
  const hasG31 = words.includes("G31");
  if (/^(G0|G1|G2|G3|G53)$/.test(last)) return T(["X", "Y", "Z", "A", "F"]);
  if (last === "G31") return T(["X", "Y", "Z", "F", "P", "L", "Q"]);
  if (last === "G4") return T(["P"]);
  if (last === "M") return T(["3", "5", "8", "9", "30"]);
  if (last === "#") return T(["1505", "1925", "1920", "1922", "880", "882"]);
  if (last === "IF") return T(["#1920", "#1922", "#1505"]);
  if (last === "GOTO") return T(["1", "2", "3"]);
  if (last === "=") return T(["1", "0", "#", "["]);
  if (isIf && /[!=<>]+\d*$/.test(last)) return T(["GOTO"]);
  if (isIf && /^#?\d+$/.test(last)) return T(["!=", "==", "<", ">"]);
  if (hasG31 && /^[XYZFPLQ]$/.test(last) || /^[XYZABF]$/.test(last)) return T(["#", "-"]);
  if (/^[XYZA]-?\d*\.?\d*$/.test(last)) return T(["Y", "Z", "F", "#"]);
  return T(["G1 ", "GOTO", "IF ", "#", "M5 "]);
}
function initSuggestBar() {
  const row = document.createElement("div");
  row.className = "ddcs-suggest-bar";
  row.style.cssText = "display:flex; gap:6px; align-items:center; overflow:hidden; padding:4px 8px; min-height:30px; border-bottom:1px solid rgba(255,255,255,0.06);";
  const chips = document.createElement("div");
  chips.style.cssText = "display:flex; gap:6px; flex:1 1 auto; overflow:hidden; flex-wrap:nowrap;";
  row.appendChild(chips);
  const lineBeforeCursor = () => {
    const ed2 = document.getElementById("editor");
    if (!ed2) return "";
    const pos = Number.isInteger(ed2.selectionStart) ? ed2.selectionStart : ed2.value.length;
    return ed2.value.slice(0, pos);
  };
  function fit() {
    const max = chips.clientWidth;
    if (!max) return;
    let used = 0;
    Array.from(chips.children).forEach((b2, i) => {
      b2.style.display = "";
      used += b2.offsetWidth + 6;
      if (i > 0 && used > max) b2.style.display = "none";
    });
  }
  function render() {
    if (!suggestEnabled()) {
      row.style.display = "none";
      return;
    }
    row.style.display = "flex";
    chips.innerHTML = "";
    for (const s of suggestFor(lineBeforeCursor())) {
      const b2 = document.createElement("button");
      b2.className = "toolbar-btn ddcs-suggest-chip";
      b2.style.cssText = "padding:2px 10px; font-size:12px; white-space:nowrap; flex:0 0 auto;";
      b2.textContent = s.label;
      b2.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (window.insert) window.insert(s.insert);
        setTimeout(render, 0);
      }, { passive: false });
      chips.appendChild(b2);
    }
    requestAnimationFrame(fit);
  }
  const ed = document.getElementById("editor");
  if (ed) ["input", "keyup", "click", "focus"].forEach((ev) => ed.addEventListener(ev, render));
  window.addEventListener("ddcs:suggest-changed", render);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(chips);
  window.addEventListener("resize", fit);
  render();
  return row;
}

// ../DDCS-Studio/web/ui/commandDeck.js
init_dialects();
init_controllerProfiles();
init_cnc();
init_dwell();
var _svg = (body, color = "currentColor") => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
var HEADER_ICONS = {
  comm: _svg('<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" fill="#ffffff" stroke="#3b82f6"/><circle cx="8.5" cy="11.5" r="1.1" fill="#10b981" stroke="none"/><circle cx="12" cy="11.5" r="1.1" fill="#f59e0b" stroke="none"/><circle cx="15.5" cy="11.5" r="1.1" fill="#ef4444" stroke="none"/>', "#3b82f6"),
  // WCS = work origin: Y-up / X-right axes meeting at a filled origin dot
  wcs: _svg('<path d="M5 3V19" stroke="#10b981"/><polyline points="2.5 6 5 3 7.5 6" stroke="#10b981"/><path d="M5 19H21" stroke="#3b82f6"/><polyline points="18 16.5 21 19 18 21.5" stroke="#3b82f6"/><circle cx="5" cy="19" r="2" fill="#ef4444" stroke="none"/>', "#10b981"),
  warmup: _svg('<path d="M3.5 6Q12 2.5 20.5 6L14 18Q12 20 10.5 18Z" fill="#cbd5e1" stroke="#475569"/><path d="M5.5 9.5Q12 7.5 18 10.5" stroke="#2563eb"/><path d="M7 13Q12 11.5 16.5 14" stroke="#2563eb"/><path d="M9 16.3Q12 15.3 14.5 16.8" stroke="#2563eb"/><ellipse cx="12" cy="20.6" rx="4" ry="1.8" fill="#e2e8f0" stroke="#475569"/>', "#475569"),
  // Probe = ruby touch sensor: steel body + shaft, a solid ruby ball touching a surface line
  probe: _svg('<path d="M9 3h6v3l-1.5 2h-3L9 6z" stroke="#64748b"/><line x1="12" y1="10" x2="12" y2="14.8" stroke="#64748b"/><line x1="5" y1="21" x2="19" y2="21" stroke="#f59e0b"/><circle cx="12" cy="17.3" r="2.4" fill="#e11d48" stroke="#e11d48"/>', "#64748b"),
  atc: _svg('<polyline points="22 5 22 10.5 16.5 10.5" stroke="#10b981"/><path d="M4.06 9.5A8 8 0 0 1 18 6.6l4 3.9" stroke="#10b981"/><polyline points="2 19 2 13.5 7.5 13.5" stroke="#f97316"/><path d="M2 13.5l4 3.9A8 8 0 0 0 19.94 14.5" stroke="#f97316"/>', "#8b5cf6"),
  mill: _svg('<path d="M9 2.5h6v6l1.2 1.5v9.5h-8.4v-9.5l1.2-1.5z" stroke="#64748b"/><path d="M9.6 18.7c2-1.4 3.4-3.9 4.4-7.4" stroke="#14b8a6"/><path d="M9.6 15.2c1.1-.8 1.9-2.1 2.5-3.8" stroke="#14b8a6"/><line x1="9" y1="19.5" x2="15" y2="19.5" stroke="#f59e0b" stroke-width="2.5"/>', "#64748b"),
  load: _svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', "#f59e0b"),
  insert: _svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>', "#14b8a6"),
  copy: _svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', "#6366f1"),
  clear: _svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>', "#ef4444"),
  // Export = share / upload: open-top box with an up arrow rising out (per the supplied glyph)
  export: _svg('<path d="M16 9h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2"/><line x1="12" y1="14" x2="12" y2="3"/><polyline points="8 7 12 3 16 7"/>', "#0ea5e9"),
  // I/O = two opposite arrows (output out · input in)
  io: _svg('<line x1="3" y1="8" x2="14" y2="8" stroke="#22c55e"/><polyline points="11 5 14 8 11 11" stroke="#22c55e"/><line x1="21" y1="16" x2="10" y2="16" stroke="#38bdf8"/><polyline points="13 13 10 16 13 19" stroke="#38bdf8"/>', "#22c55e")
};
window.loadGcodeFile = function loadGcodeFile() {
  let input = document.getElementById("gcode-file-input");
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.id = "gcode-file-input";
    input.accept = ".nc,.gcode,.gco,.g,.ngc,.tap,.cnc,.txt";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (e) => {
        const ed = document.getElementById("editor");
        if (ed) {
          ed.value = e.target.result || "";
          ed.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      r.readAsText(f);
      input.value = "";
    });
    document.body.appendChild(input);
  }
  input.click();
};
window.insertGcodeFile = function insertGcodeFile() {
  let input = document.getElementById("gcode-insert-input");
  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.id = "gcode-insert-input";
    input.accept = ".nc,.gcode,.gco,.g,.ngc,.tap,.cnc,.txt";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (e) => {
        const ed = document.getElementById("editor");
        if (!ed) return;
        const text = e.target.result || "";
        const pos = Number.isInteger(ed.selectionStart) ? ed.selectionStart : ed.value.length;
        const before = ed.value.slice(0, pos), after = ed.value.slice(pos);
        const lead = before && !before.endsWith("\n") ? "\n" : "";
        const tail = text.endsWith("\n") ? "" : "\n";
        ed.value = before + lead + text + tail + after;
        const caret = (before + lead + text + tail).length;
        try {
          ed.setSelectionRange(caret, caret);
        } catch (_) {
        }
        ed.dispatchEvent(new Event("input", { bubbles: true }));
      };
      r.readAsText(f);
      input.value = "";
    });
    document.body.appendChild(input);
  }
  input.click();
};
var IO_BLOCKS = { outpin: outPinBlock, waitinput: waitInputBlock, dwell: dwellBlock };
window.ddcsInsertIo = function ddcsInsertIo(type) {
  const block = IO_BLOCKS[type];
  const ed = document.getElementById("editor");
  if (!block || !ed) return;
  let dialect8;
  try {
    dialect8 = resolveActivePost(getActiveProfile().id);
  } catch (_) {
    dialect8 = {};
  }
  const out = block.emit({ ...block.defaults }, 0, 0, dialect8);
  const text = (Array.isArray(out) ? out : [out]).join("\n");
  let pos = Number.isInteger(ed.selectionStart) ? ed.selectionStart : ed.value.length;
  if (document.activeElement !== ed) {
    const m = ed.value.match(/\n[ \t]*M30\b/i);
    pos = m ? m.index + 1 : ed.value.length;
  }
  const before = ed.value.slice(0, pos), after = ed.value.slice(pos);
  const lead = before && !before.endsWith("\n") ? "\n" : "";
  ed.value = before + lead + text + "\n" + after;
  const caret = (before + lead + text + "\n").length;
  try {
    ed.focus();
    ed.setSelectionRange(caret, caret);
  } catch (_) {
  }
  ed.dispatchEvent(new Event("input", { bubbles: true }));
};
var VAR_FILTERS = [
  { key: "user", label: "User", test: (v6) => !v6.isSys },
  { key: "hasDesc", label: "Has Desc", test: (v6) => (v6.d || "").trim().length > 0 },
  { key: "probe", label: "Probe", test: (v6) => /probe|g31/i.test((v6.d || "") + " " + v6.i) },
  { key: "wcs", label: "WCS", test: (v6) => /wcs|work offset|g5[4-9]/i.test(v6.d || "") },
  { key: "axis", label: "Axis", test: (v6) => /axis/i.test(v6.d || "") },
  { key: "signal", label: "Signal", test: (v6) => /signal/i.test(v6.d || "") },
  { key: "offset", label: "Offset", test: (v6) => /offset/i.test(v6.d || "") },
  { key: "tool", label: "Tool", test: (v6) => /tool/i.test(v6.d || "") },
  { key: "port", label: "Port", test: (v6) => /port/i.test(v6.d || "") },
  { key: "status", label: "Status", test: (v6) => /status/i.test(v6.d || "") },
  { key: "input", label: "Input", test: (v6) => /input/i.test(v6.d || "") },
  { key: "output", label: "Output", test: (v6) => /output/i.test(v6.d || "") },
  { key: "func", label: "Func", test: (v6) => /func/i.test(v6.d || "") },
  { key: "key", label: "Key", test: (v6) => /\bkey\b/i.test(v6.d || "") }
];
var CommandDeck = class {
  constructor(editorManager, variableDB = null) {
    this.editorManager = editorManager;
    this.variableDB = variableDB;
    this.panel = el("deck-panel");
    this._varGrid = null;
    this._varSearch = null;
    this._activeTab = "move";
    this._activeFilters = /* @__PURE__ */ new Set();
    this.build();
    const dock = document.getElementById("controller-dock") || this.panel;
    if (dock) {
      dock.addEventListener("click", (e) => {
        const b2 = e.target && e.target.closest ? e.target.closest("button") : null;
        if (b2 && b2.dataset.__ddcs_handled === "1") {
          delete b2.dataset.__ddcs_handled;
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }
    window.refreshDeckVariables = () => this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : "");
    window.addEventListener("variableDB:ready", (e) => {
      const fam = e && e.detail && e.detail.family || (this.variableDB ? this.variableDB.getControllerVars() : null);
      if (fam && this._ctrlSel && this._ctrlSel.value !== fam) this._ctrlSel.value = fam;
      this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : "");
    });
  }
  build() {
    this.renderHeader();
    const body = document.querySelector(".dock-body");
    if (!body) return;
    const all = document.getElementById("deck-panel") || document.createElement("div");
    all.id = "deck-panel";
    all.className = "dock-row macro-grid-area";
    all.innerHTML = "";
    this.buildMacroGroups(all);
    this._wireDeckButtons(all);
    const makePanel = (id, groupClasses, hidden) => {
      const panel = document.createElement("div");
      panel.className = "deck-tab-panel";
      panel.id = id;
      if (hidden) panel.style.display = "none";
      const gc = document.createElement("div");
      gc.className = "dock-row macro-grid-area";
      groupClasses.forEach((c2) => {
        const g = all.querySelector(".deck-group." + c2);
        if (g) gc.appendChild(g);
      });
      panel.appendChild(gc);
      return panel;
    };
    const movePanel = makePanel("deck-tab-move", ["numpad", "axes"], false);
    const gmPanel = makePanel("deck-tab-gm", ["g-codes", "m-codes"], true);
    const mathPanel = makePanel("deck-tab-math", ["math", "functions"], true);
    const logicPanel = makePanel("deck-tab-logic", ["control-flow", "wcs"], true);
    const varPanel = document.createElement("div");
    varPanel.className = "deck-tab-panel";
    varPanel.id = "deck-tab-variables";
    varPanel.style.display = "none";
    this.buildVariablesPanel(varPanel);
    body.innerHTML = "";
    body.appendChild(initSuggestBar());
    body.appendChild(this._makeEditorRow());
    body.appendChild(this._buildTabStrip());
    body.appendChild(movePanel);
    body.appendChild(gmPanel);
    body.appendChild(mathPanel);
    body.appendChild(logicPanel);
    body.appendChild(varPanel);
    this.renderHandle();
  }
  // Restore the chevron handle (DockManager handles the expand/collapse click).
  renderHandle() {
    const handle = document.querySelector("#controller-dock .header-handle");
    if (!handle) return;
    handle.innerHTML = '<span class="chevron">\u25B2</span>';
    handle.setAttribute("aria-label", "Toggle keyboard dock");
  }
  // KEYBOARD / VARIABLES tab strip for the top of the dock body
  _buildTabStrip() {
    const strip = document.createElement("div");
    strip.className = "deck-tabs";
    strip.innerHTML = `
            <button class="deck-tab ddcs-tab active" data-deck-tab="move">\u2328 MOVE</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="gm">\u2317 G-M</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="math">\u2211 MATH</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="logic">\u21C5 LOGIC</button>
            <button class="deck-tab ddcs-tab" data-deck-tab="variables"># VARIABLES</button>
        `;
    strip.querySelectorAll(".deck-tab").forEach((t) => {
      t.addEventListener("pointerdown", (e) => {
        e.preventDefault();
      }, { passive: false });
      t.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchTab(t.dataset.deckTab);
      });
    });
    return strip;
  }
  switchTab(name) {
    this._activeTab = name;
    const panels = { move: "deck-tab-move", gm: "deck-tab-gm", math: "deck-tab-math", logic: "deck-tab-logic", variables: "deck-tab-variables" };
    for (const [key, id] of Object.entries(panels)) {
      const p = document.getElementById(id);
      if (p) p.style.display = name === key ? "" : "none";
    }
    document.querySelectorAll("#controller-dock .deck-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.deckTab === name);
    });
    if (name === "variables") {
      this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : "");
    }
  }
  // Build + wire a BACK/SPACE/ENTER editor-keys row (one per keyboard tab).
  _makeEditorRow() {
    const editorRow = document.createElement("div");
    editorRow.className = "dock-row editor-keys-row grid-3";
    editorRow.innerHTML = `
            <button class="toolbar-btn" data-ddcs-role="back">\u232B BACK</button>
            <button class="toolbar-btn" data-ddcs-role="space">\u2423 SPACE</button>
            <button class="toolbar-btn" data-ddcs-role="enter">\u21B5 ENTER</button>
        `;
    this._wireEditorRow(editorRow);
    return editorRow;
  }
  _wireEditorRow(editorRow) {
    const backBtn = editorRow.querySelector('[data-ddcs-role="back"]');
    const spaceBtn = editorRow.querySelector('[data-ddcs-role="space"]');
    const enterBtn = editorRow.querySelector('[data-ddcs-role="enter"]');
    if (backBtn) backBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      backBtn.dataset.__ddcs_handled = "1";
      const ed = document.getElementById("editor");
      if (ed) {
        const start = ed.selectionStart;
        const end = ed.selectionEnd;
        if (start !== end) {
          ed.value = ed.value.slice(0, start) + ed.value.slice(end);
          ed.setSelectionRange(start, Math.min(ed.value.length, start + 1));
        } else if (start > 0) {
          ed.value = ed.value.slice(0, start - 1) + ed.value.slice(start);
          const newPos = start - 1;
          ed.setSelectionRange(newPos, Math.min(ed.value.length, newPos + 1));
        }
        ed.dispatchEvent(new Event("input"));
        ed.setAttribute("inputmode", "none");
        ed.blur();
      }
    }, { passive: false });
    if (spaceBtn) spaceBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      spaceBtn.dataset.__ddcs_handled = "1";
      window.insert && window.insert(" ");
      const ed = document.getElementById("editor");
      if (ed) {
        ed.setAttribute("inputmode", "none");
        ed.blur();
      }
    }, { passive: false });
    if (enterBtn) enterBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      enterBtn.dataset.__ddcs_handled = "1";
      window.insert && window.insert("\n");
      const ed = document.getElementById("editor");
      if (ed) {
        ed.setAttribute("inputmode", "none");
        ed.blur();
      }
    }, { passive: false });
  }
  _wireDeckButtons(container) {
    container.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          btn.dataset.__ddcs_handled = "1";
          if (typeof btn.onclick === "function") {
            btn.onclick.call(btn, e);
          }
        } catch (err) {
        }
        const ed = document.getElementById("editor");
        if (ed) {
          ed.setAttribute("inputmode", "none");
          ed.blur();
        }
      }, { passive: false });
    });
  }
  // VARIABLES tab: search + filters + a scrollable box of key-styled chips
  buildVariablesPanel(panel) {
    panel.innerHTML = "";
    this._activeFilters = /* @__PURE__ */ new Set();
    const ctrlRow = document.createElement("div");
    ctrlRow.className = "deck-var-ctrlrow";
    ctrlRow.style.cssText = "display:none;";
    const ctrlLbl = document.createElement("span");
    ctrlLbl.textContent = "Variable set:";
    ctrlLbl.style.cssText = "font-size:11px; opacity:.7;";
    const ctrlSel = document.createElement("select");
    ctrlSel.className = "deck-var-ctrlsel";
    ctrlSel.style.cssText = "font-size:11px;";
    ctrlSel.innerHTML = '<option value="expert">Expert M350</option><option value="v4.1">DDCS V4.1</option><option value="v3">DDCS V3 / DM500</option>';
    ctrlSel.value = this.variableDB ? this.variableDB.getControllerVars() : "expert";
    this._ctrlSel = ctrlSel;
    ctrlSel.addEventListener("change", async () => {
      if (!this.variableDB) return;
      await this.variableDB.setControllerVars(ctrlSel.value);
      if (this._varStatus) this._varStatus.textContent = "";
      this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : "");
    });
    const pullBtn = document.createElement("button");
    pullBtn.className = "toolbar-btn";
    pullBtn.style.cssText = "padding:2px 8px; font-size:11px;";
    pullBtn.textContent = "\u21A7 Pull from controller";
    pullBtn.title = "Detect the connected controller via the gateway and load its variable set";
    pullBtn.addEventListener("pointerdown", (e) => e.preventDefault(), { passive: false });
    pullBtn.addEventListener("click", () => this._pullControllerVars(ctrlSel));
    const ctrlStatus = document.createElement("span");
    ctrlStatus.style.cssText = "font-size:10px; opacity:.7;";
    this._varStatus = ctrlStatus;
    ctrlRow.appendChild(ctrlLbl);
    ctrlRow.appendChild(ctrlSel);
    ctrlRow.appendChild(pullBtn);
    ctrlRow.appendChild(ctrlStatus);
    panel.appendChild(ctrlRow);
    const searchRow = document.createElement("div");
    searchRow.className = "deck-var-searchrow";
    const search = document.createElement("input");
    search.type = "text";
    search.className = "deck-var-search";
    search.placeholder = "Search variables\u2026";
    search.setAttribute("autocomplete", "off");
    const filterBtn = document.createElement("button");
    filterBtn.className = "deck-var-filterbtn";
    filterBtn.textContent = "Filters";
    searchRow.appendChild(search);
    searchRow.appendChild(filterBtn);
    panel.appendChild(searchRow);
    const filterRow = document.createElement("div");
    filterRow.className = "deck-var-filters";
    filterRow.style.display = "none";
    VAR_FILTERS.forEach((f) => {
      const chip = document.createElement("button");
      chip.className = "deck-var-filterchip";
      chip.textContent = f.label;
      chip.dataset.filterKey = f.key;
      chip.addEventListener("pointerdown", (e) => {
        e.preventDefault();
      }, { passive: false });
      chip.addEventListener("click", () => {
        if (this._activeFilters.has(f.key)) {
          this._activeFilters.delete(f.key);
          chip.classList.remove("active");
        } else {
          this._activeFilters.add(f.key);
          chip.classList.add("active");
        }
        this.renderVariables(this._varSearch.value.trim().toLowerCase());
      });
      filterRow.appendChild(chip);
    });
    panel.appendChild(filterRow);
    filterBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
    }, { passive: false });
    filterBtn.addEventListener("click", () => {
      const show = filterRow.style.display === "none";
      filterRow.style.display = show ? "flex" : "none";
      filterBtn.classList.toggle("active", show);
    });
    const scroll = document.createElement("div");
    scroll.className = "deck-var-scroll";
    const grid = document.createElement("div");
    grid.className = "deck-var-grid";
    scroll.appendChild(grid);
    panel.appendChild(scroll);
    this._varGrid = grid;
    this._varSearch = search;
    search.addEventListener("input", () => this.renderVariables(search.value.trim().toLowerCase()));
    this.renderVariables();
  }
  // Pull-from-controller: ask the gateway which controller it's connected to (the read-only
  // fingerprint) and load that controller's variable set. Falls back to a manual pick if offline.
  async _pullControllerVars(sel) {
    if (this._varStatus) this._varStatus.textContent = "detecting\u2026";
    let fam = null;
    try {
      const { makeClient: makeClient2 } = await Promise.resolve().then(() => (init_client(), client_exports));
      const d = await makeClient2().descriptor();
      fam = d && d.controller_family;
    } catch (e) {
    }
    const target = fam === "v4.1" ? "v4.1" : fam === "expert-m350" ? "expert" : null;
    if (!target) {
      if (this._varStatus) this._varStatus.textContent = "no controller detected \u2014 pick a set manually";
      return;
    }
    if (this.variableDB) await this.variableDB.setControllerVars(target);
    if (sel) sel.value = target;
    this.renderVariables(this._varSearch ? this._varSearch.value.trim().toLowerCase() : "");
    if (this._varStatus) this._varStatus.textContent = `loaded ${target === "v4.1" ? "DDCS V4.1" : "Expert M350"} (via gateway)`;
  }
  renderVariables(filter = "") {
    const grid = this._varGrid;
    if (!grid || !this.variableDB) return;
    grid.innerHTML = "";
    let vars = this.variableDB.getAll();
    if (filter) {
      vars = vars.filter((v6) => (String(v6.i) + " " + (v6.d || "")).toLowerCase().includes(filter));
    }
    const active2 = this._activeFilters;
    if (active2 && active2.size) {
      const tests = VAR_FILTERS.filter((f) => active2.has(f.key));
      vars = vars.filter((v6) => tests.every((f) => f.test(v6)));
    }
    if (vars.length === 0) {
      const empty = document.createElement("div");
      empty.className = "deck-var-empty";
      empty.textContent = filter || active2 && active2.size ? "No matching variables" : "No variables loaded";
      grid.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    let displayVars = vars;
    const LIMIT = 500;
    let limited = false;
    if (displayVars.length > LIMIT) {
      displayVars = displayVars.slice(0, LIMIT);
      limited = true;
    }
    displayVars.forEach((v6) => {
      const id = String(v6.i).split("-")[0];
      const desc = v6.d || "User Variable";
      const btn = document.createElement("button");
      btn.className = "toolbar-btn deck-var-chip";
      const idEl = document.createElement("span");
      idEl.className = "var-id";
      idEl.textContent = id;
      const descEl = document.createElement("span");
      descEl.className = "var-desc";
      descEl.textContent = desc;
      btn.appendChild(idEl);
      btn.appendChild(descEl);
      btn.addEventListener("mouseenter", () => UIUtils.showTooltip(btn, `${desc}

ID: ${v6.i}
Type: ${v6.t || ""}`));
      btn.addEventListener("mouseleave", () => UIUtils.hideTooltip());
      btn.onclick = () => {
        if (this.editorManager) this.editorManager.insert(null, id);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.dataset.__ddcs_handled = "1";
        if (typeof btn.onclick === "function") btn.onclick.call(btn, e);
        const ed = document.getElementById("editor");
        if (ed) {
          ed.setAttribute("inputmode", "none");
          ed.blur();
        }
      }, { passive: false });
      frag.appendChild(btn);
    });
    if (limited) {
      const limitNote = document.createElement("div");
      limitNote.className = "deck-var-limit";
      limitNote.style.cssText = "grid-column: 1 / -1; text-align: center; font-size: 10px; opacity: 0.6; padding: 10px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 4px;";
      limitNote.textContent = `Showing first 500 of ${vars.length} variables. Use the search bar to find more.`;
      frag.appendChild(limitNote);
    }
    grid.appendChild(frag);
  }
  // Helper: Render header left/center/right
  renderHeader() {
    const leftTarget = document.querySelector(".dock-header .header-left");
    if (leftTarget) {
      leftTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="openWiz && openWiz('comm')" title="Comm / MDI console"><span class="btn-ico">${HEADER_ICONS.comm}</span><span class="btn-tx">Comm</span></button>
                    <button class="toolbar-btn" onclick="openWiz && openWiz('wcs')" title="Work coordinate systems"><span class="btn-ico">${HEADER_ICONS.wcs}</span><span class="btn-tx">WCS</span></button>
                    <button class="toolbar-btn" onclick="openWiz && openWiz('atc_warmup')" title="Spindle warm-up sequence"><span class="btn-ico">${HEADER_ICONS.warmup}</span><span class="btn-tx">Warm-up</span></button>
                </div>
            `;
    }
    const centerTarget = document.querySelector(".dock-header .header-center");
    if (centerTarget) {
      centerTarget.innerHTML = `
                <div style="display:flex; gap:6px; width:auto; align-items:center;">
                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.probe}</span><span class="btn-tx">Probe</span><span class="btn-caret">\u25BC</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="openCornerWiz && openCornerWiz()">\u{1F4D0} Corner</button>
                            <button onclick="openMiddleWiz && openMiddleWiz()">\u{1F3AF} Middle</button>
                            <button onclick="openWiz && openWiz('circular')">\u2B55 Bore/Boss</button>
                            <button onclick="openEdgeWiz && openEdgeWiz()">\u{1F4CF} Edge</button>
                            <button onclick="openAlignmentWiz && openAlignmentWiz()">\u{1F9ED} Align</button>
                            <div style="padding:4px 12px; font-size:10px; opacity:.55; text-transform:uppercase; letter-spacing:1px;">Rotary</div>
                            <button onclick="openWiz && openWiz('rotary_center')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="4" y="8" width="13" height="8" rx="2" stroke="#64748b"/><ellipse cx="17" cy="12" rx="2" ry="4" stroke="#64748b"/><line x1="1.5" y1="12" x2="22.5" y2="12" stroke="#e11d48" stroke-dasharray="3 2"/></svg>Centreline</button>
                            <button onclick="openWiz && openWiz('rotary_clock')">\u{1F552} Clock A0</button>
                        </div>
                    </div>
                    
                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.atc}</span><span class="btn-tx">ATC</span><span class="btn-caret">\u25BC</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="openWiz && openWiz('atc_length')">\u{1F4CF} Tool Length</button>
                            <button onclick="openWiz && openWiz('atc_check')">\u{1F6E1} Tool Check</button>
                            <button onclick="openWiz && openWiz('atc_change')">\u{1F527} Tool Change</button>
                            <button onclick="openWiz && openWiz('atc_table')">\u{1F4CB} Tool Table</button>
                            <button onclick="openWiz && openWiz('atc_test')">\u{1F9EA} ATC Test</button>
                        </div>
                    </div>

                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.mill}</span><span class="btn-tx">Mill</span><span class="btn-caret">\u25BC</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="openWiz && openWiz('drill')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><ellipse cx="12" cy="12" rx="9" ry="5.5" stroke="#94a3b8" stroke-width="2.5"/><ellipse cx="12" cy="12" rx="6.5" ry="3.6" fill="#1e293b" stroke="none"/></svg>Drill / holes</button>
                            <button onclick="openWiz && openWiz('pocket')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="5" width="18" height="14" rx="1.5" stroke="#94a3b8" stroke-width="2.5"/><rect x="7" y="9" width="10" height="6" rx="1" fill="#1e293b" stroke="none"/></svg>Pocket</button>
                            <button onclick="openWiz && openWiz('slot')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="9" width="18" height="6" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="7" y1="12" x2="17" y2="12" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/></svg>Slot</button>
                            <button onclick="openWiz && openWiz('surfacing')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#94a3b8" stroke-width="2.5"/><path d="M5 8h14M5 12h14M5 16h14" stroke="#1e293b" stroke-width="1.5"/></svg>Surfacing</button>
                            <button onclick="openWiz && openWiz('text')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><path d="M5 6h14M12 6v13" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/></svg>Text / engrave</button>
                        </div>
                    </div>

                    <div class="toolbar-dropdown">
                        <button class="toolbar-btn wizard-btn" style="min-width: 100px;"><span class="btn-ico">${HEADER_ICONS.io}</span><span class="btn-tx">I/O</span><span class="btn-caret">\u25BC</span></button>
                        <div class="toolbar-dropdown-content">
                            <button onclick="ddcsInsertIo && ddcsInsertIo('outpin')">\u26A1 Set Output</button>
                            <button onclick="ddcsInsertIo && ddcsInsertIo('waitinput')">\u23F1 Wait Input</button>
                            <button onclick="ddcsInsertIo && ddcsInsertIo('dwell')">\u23F3 Dwell</button>
                        </div>
                    </div>

                    <!-- Comm and WCS buttons are provided in the left header; avoid duplicates here -->
                </div>
            `;
      centerTarget.querySelectorAll(".toolbar-dropdown > button").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const parent = btn.parentElement;
          centerTarget.querySelectorAll(".toolbar-dropdown").forEach((d) => {
            if (d !== parent) {
              d.classList.remove("active");
              const cc = d.querySelector(".toolbar-dropdown-content");
              if (cc) {
                cc.style.position = "";
                cc.style.left = "";
                cc.style.top = "";
                cc.style.minWidth = "";
                cc.style.paddingTop = "";
              }
            }
          });
          const content = parent.querySelector(".toolbar-dropdown-content");
          const willOpen = !parent.classList.contains("active");
          parent.classList.toggle("active");
          if (content && willOpen) {
            try {
              const rect = btn.getBoundingClientRect();
              const pad = 6;
              content.style.position = "fixed";
              content.style.left = `${Math.max(6, Math.round(rect.left - pad))}px`;
              content.style.top = `${Math.round(rect.top - pad)}px`;
              content.style.minWidth = `${Math.max(btn.offsetWidth + pad * 2, 0)}px`;
              content.style.paddingTop = `${btn.offsetHeight + pad + 4}px`;
            } catch (err) {
              content.style.position = "";
            }
          } else if (content) {
            content.style.position = "";
            content.style.left = "";
            content.style.top = "";
            content.style.minWidth = "";
            content.style.paddingTop = "";
          }
        });
      });
      document.addEventListener("click", () => {
        centerTarget.querySelectorAll(".toolbar-dropdown").forEach((d) => {
          d.classList.remove("active");
          const cc = d.querySelector(".toolbar-dropdown-content");
          if (cc) {
            cc.style.position = "";
            cc.style.left = "";
            cc.style.top = "";
            cc.style.minWidth = "";
            cc.style.paddingTop = "";
          }
        });
      });
    }
    const rightTarget = document.querySelector(".dock-header .header-right");
    if (rightTarget) {
      rightTarget.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="toolbar-btn" onclick="loadGcodeFile && loadGcodeFile()" title="Load a G-code / .nc file into the editor (replaces the current program)"><span class="btn-ico">${HEADER_ICONS.load}</span><span class="btn-tx">Load</span></button>
                    <button class="toolbar-btn" onclick="insertGcodeFile && insertGcodeFile()" title="Insert a G-code file at the cursor \u2014 keeps your current program"><span class="btn-ico">${HEADER_ICONS.insert}</span><span class="btn-tx">Insert</span></button>
                    <button class="toolbar-btn" onclick="copyCode && copyCode()" title="Copy editor to clipboard"><span class="btn-ico">${HEADER_ICONS.copy}</span><span class="btn-tx">Copy</span></button>
                    <button class="toolbar-btn" onclick="clearCode && clearCode()" title="Clear the editor"><span class="btn-ico">${HEADER_ICONS.clear}</span><span class="btn-tx">Clear</span></button>
                    <button class="toolbar-btn" onclick="downloadFile && downloadFile()" title="Export / download the program"><span class="btn-ico">${HEADER_ICONS.export}</span><span class="btn-tx">Export</span></button>
                </div>
            `;
    }
    document.querySelectorAll(".dock-header .header-left button, .dock-header .header-center button, .dock-header .header-right button").forEach((btn) => btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
    }, { passive: false }));
    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t && t.dataset && t.dataset.__ddcs_handled) {
        try {
          ev.stopImmediatePropagation();
          ev.preventDefault();
        } catch (e) {
        }
        try {
          delete t.dataset.__ddcs_handled;
        } catch (e) {
        }
      }
    }, true);
    requestAnimationFrame(() => {
      this._fitHeader();
      this._fitAppHeader();
    });
    if (!this._headerFitInit) {
      this._headerFitInit = true;
      const fit = () => requestAnimationFrame(() => {
        this._fitHeader();
        this._fitAppHeader();
      });
      window.addEventListener("resize", fit);
      if (window.MutationObserver) {
        const mo = new MutationObserver(fit);
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
      }
    }
  }
  // Priority+ fit for the wizard toolbar: keep the most labels possible. Stage 1 (.is-compact)
  // drops only the editor-action labels (Load/Insert/Copy/Clear/Export); if it STILL overflows,
  // stage 2 (.is-mini) drops the wizard labels too. remove→measure→add is synchronous (no flicker).
  _fitHeader() {
    const hc = document.querySelector(".dock-header .header-controls");
    if (!hc) return;
    hc.classList.remove("is-compact", "is-mini");
    if (hc.scrollWidth > hc.clientWidth + 2) {
      hc.classList.add("is-compact");
      if (hc.scrollWidth > hc.clientWidth + 2) hc.classList.add("is-mini");
    }
  }
  // Top app-header: staged so the right-edge icons never overflow the window. Stage 1 drops the
  // op-button labels (.is-compact); if it still overflows, stage 2 drops STUDIO/GATEWAY labels +
  // version (.is-mini). Measured each call (load + resize + theme change) — no fixed breakpoints.
  _fitAppHeader() {
    const h = document.querySelector(".app-header");
    if (!h) return;
    h.classList.remove("is-compact", "is-mini");
    if (h.scrollWidth > h.clientWidth) {
      h.classList.add("is-compact");
      if (h.scrollWidth > h.clientWidth) h.classList.add("is-mini");
    }
  }
  // Helper: build macro groups into provided container
  buildMacroGroups(container) {
    if (!container) return;
    container.innerHTML = `
            <div class="deck-group numpad">
                <div class="group-header">NUMPAD</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Insert 7" onclick="window.insert && window.insert('7')">7</button>
                    <button class="toolbar-btn" title="Insert 8" onclick="window.insert && window.insert('8')">8</button>
                    <button class="toolbar-btn" title="Insert 9" onclick="window.insert && window.insert('9')">9</button>
                    <button class="toolbar-btn" title="Insert 4" onclick="window.insert && window.insert('4')">4</button>
                    <button class="toolbar-btn" title="Insert 5" onclick="window.insert && window.insert('5')">5</button>
                    <button class="toolbar-btn" title="Insert 6" onclick="window.insert && window.insert('6')">6</button>
                    <button class="toolbar-btn" title="Insert 1" onclick="window.insert && window.insert('1')">1</button>
                    <button class="toolbar-btn" title="Insert 2" onclick="window.insert && window.insert('2')">2</button>
                    <button class="toolbar-btn" title="Insert 3" onclick="window.insert && window.insert('3')">3</button>
                    <button class="toolbar-btn" title="Decimal point" onclick="window.insert && window.insert('.')">.</button>
                    <button class="toolbar-btn" title="Insert 0" onclick="window.insert && window.insert('0')">0</button>
                    <button class="toolbar-btn" title="Minus sign" onclick="window.insert && window.insert('-')">-</button>
                </div>
            </div>

            <div class="deck-group axes">
                <div class="group-header">AXES & ADDRESSES</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="X axis address" onclick="window.insert && window.insert('X')">X</button>
                    <button class="toolbar-btn axis-blue" title="Y axis address" onclick="window.insert && window.insert('Y')">Y</button>
                    <button class="toolbar-btn axis-blue" title="Z axis address" onclick="window.insert && window.insert('Z')">Z</button>
                    <button class="toolbar-btn axis-blue" title="A axis address" onclick="window.insert && window.insert('A')">A</button>
                    <button class="toolbar-btn axis-blue" title="B axis address" onclick="window.insert && window.insert('B')">B</button>
                    <button class="toolbar-btn axis-blue" title="Macro variable prefix" onclick="window.insert && window.insert('#')">#</button>
                    <button class="toolbar-btn axis-blue" title="C axis address" onclick="window.insert && window.insert('C')">C</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset I" onclick="window.insert && window.insert('I')">I</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset J" onclick="window.insert && window.insert('J')">J</button>
                    <button class="toolbar-btn axis-blue" title="Arc center offset K" onclick="window.insert && window.insert('K')">K</button>
                </div>
            </div>

            <div class="deck-group math">
                <div class="group-header">MATH & LOGIC</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Open expression bracket" onclick="window.insert && window.insert('[')">[</button>
                    <button class="toolbar-btn" title="Close expression bracket" onclick="window.insert && window.insert(']')">]</button>
                    <button class="toolbar-btn" title="Assignment equals" onclick="window.insert && window.insert('=')">=</button>
                    <button class="toolbar-btn" title="Addition operator" onclick="window.insert && window.insert('+')">+</button>
                    <button class="toolbar-btn" title="Subtraction operator" onclick="window.insert && window.insert('-')">-</button>
                    <button class="toolbar-btn" title="Multiplication operator" onclick="window.insert && window.insert('*')">*</button>
                    <button class="toolbar-btn" title="Division operator" onclick="window.insert && window.insert('/')">/</button>
                    <button class="toolbar-btn" title="Equality comparison" onclick="window.insert && window.insert('==')">==</button>
                    <button class="toolbar-btn" title="Inequality comparison" onclick="window.insert && window.insert('!=')">!=</button>
                    <button class="toolbar-btn" title="Less-than comparison" onclick="window.insert && window.insert('<')">&lt;</button>
                    <button class="toolbar-btn" title="Greater-than comparison" onclick="window.insert && window.insert('>')">&gt;</button>
                </div>
            </div>

            <div class="deck-group functions">
                <div class="group-header">FUNCTIONS</div>
                <div class="grid-3">
                    <button class="toolbar-btn" title="Square root \u2014 SQRT[expr]" onclick="window.insert && window.insert('SQRT[')">SQRT[</button>
                    <button class="toolbar-btn" title="Absolute value \u2014 ABS[expr]" onclick="window.insert && window.insert('ABS[')">ABS[</button>
                    <button class="toolbar-btn" title="Sine, degrees \u2014 SIN[expr]" onclick="window.insert && window.insert('SIN[')">SIN[</button>
                    <button class="toolbar-btn" title="Cosine, degrees \u2014 COS[expr]" onclick="window.insert && window.insert('COS[')">COS[</button>
                    <button class="toolbar-btn" title="Arctangent, degrees \u2014 ATAN[y]/[x]" onclick="window.insert && window.insert('ATAN[')">ATAN[</button>
                    <button class="toolbar-btn" title="Modulo \u2014 a MOD b" onclick="window.insert && window.insert(' MOD ')">MOD</button>
                </div>
            </div>

            <div class="deck-group control-flow">
                <div class="group-header">CONTROL FLOW</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="Conditional \u2014 C-style, no brackets on a simple IF (e.g. IF #1920!=2 GOTO1)" onclick="window.insert && window.insert('IF ')">IF</button>
                    <button class="toolbar-btn axis-blue" title="Jump to an N-label \u2014 NO space before the number (GOTO1)" onclick="window.insert && window.insert('GOTO')">GOTO</button>
                    <button class="toolbar-btn axis-blue" title="Label target \u2014 N1, N2 ... (success path jumps past the error handlers)" onclick="window.insert && window.insert('N')">N</button>
                    <button class="toolbar-btn" title="Open comment / operator message \u2014 ( text )" onclick="window.insert && window.insert('(')">(</button>
                    <button class="toolbar-btn" title="Close comment / operator message" onclick="window.insert && window.insert(')')">)</button>
                    <button class="toolbar-btn axis-blue" title="Operator message / pass-fail popup \u2014 #1505=1(msg) error, #1505=-5000(msg) ok" onclick="window.insert && window.insert('#1505')">#1505</button>
                    <button class="toolbar-btn" title="Number format inside a #1505/#1503 message \u2014 e.g. %.3f (3 decimals), %.0f (integer). NOT modulo." onclick="window.insert && window.insert('%')">%</button>
                </div>
            </div>

            <div class="deck-group g-codes">
                <div class="group-header">G-CODES</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="Rapid positioning" onclick="window.insert && window.insert('G0 ')">G0</button>
                    <button class="toolbar-btn axis-blue" title="Linear interpolation" onclick="window.insert && window.insert('G1 ')">G1</button>
                    <button class="toolbar-btn axis-blue" title="Clockwise arc (I/J/K or R)" onclick="window.insert && window.insert('G2 ')">G2</button>
                    <button class="toolbar-btn axis-blue" title="Counter-clockwise arc (I/J/K or R)" onclick="window.insert && window.insert('G3 ')">G3</button>
                    <button class="toolbar-btn axis-blue" title="Dwell \u2014 G4 P&lt;seconds&gt;" onclick="window.insert && window.insert('G4 ')">G4</button>
                    <button class="toolbar-btn axis-blue" title="Machine coordinate move" onclick="window.insert && window.insert('G53 ')">G53</button>
                    <button class="toolbar-btn axis-blue" title="Absolute programming mode" onclick="window.insert && window.insert('G90 ')">G90</button>
                    <button class="toolbar-btn axis-blue" title="Incremental programming mode" onclick="window.insert && window.insert('G91 ')">G91</button>
                    <button class="toolbar-btn axis-blue" title="Probe move" onclick="window.insert && window.insert('G31 ')">G31</button>
                    <button class="toolbar-btn m-red" title="Program stop / pause" onclick="window.insert && window.insert('M0 ')">M0</button>
                    <button class="toolbar-btn m-red" title="Program end and rewind" onclick="window.insert && window.insert('M30')">M30</button>
                </div>
            </div>

            <div class="deck-group wcs">
                <div class="group-header">WORK OFFSETS</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G54" onclick="window.insert && window.insert('G54 ')">G54</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G55" onclick="window.insert && window.insert('G55 ')">G55</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G56" onclick="window.insert && window.insert('G56 ')">G56</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G57" onclick="window.insert && window.insert('G57 ')">G57</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G58" onclick="window.insert && window.insert('G58 ')">G58</button>
                    <button class="toolbar-btn axis-blue" title="Select work coordinate system G59" onclick="window.insert && window.insert('G59 ')">G59</button>
                </div>
            </div>

            <div class="deck-group m-codes">
                <div class="group-header">PROGRAM & MACHINE WORDS</div>
                <div class="grid-3">
                    <button class="toolbar-btn axis-blue" title="G-code address" onclick="window.insert && window.insert('G')">G</button>
                    <button class="toolbar-btn axis-blue" title="M-code address" onclick="window.insert && window.insert('M')">M</button>
                    <button class="toolbar-btn axis-blue" title="Parameter word (G31 probe input port)" onclick="window.insert && window.insert('P')">P</button>
                    <button class="toolbar-btn axis-blue" title="Probe trigger level \u2014 G31 L0 (NPN) / L1 (PNP)" onclick="window.insert && window.insert('L')">L</button>
                    <button class="toolbar-btn axis-blue" title="Probe stop mode \u2014 G31 Q1 (immediate) / Q0 (decelerate)" onclick="window.insert && window.insert('Q')">Q</button>
                    <button class="toolbar-btn axis-blue" title="Arc radius or parameter" onclick="window.insert && window.insert('R')">R</button>
                    <button class="toolbar-btn m-green" title="Spindle ON clockwise" onclick="window.insert && window.insert('M3 ')">M3</button>
                    <button class="toolbar-btn m-red" title="Spindle OFF" onclick="window.insert && window.insert('M5 ')">M5</button>
                    <button class="toolbar-btn m-green" title="Coolant ON" onclick="window.insert && window.insert('M8 ')">M8</button>
                    <button class="toolbar-btn m-red" title="Coolant OFF" onclick="window.insert && window.insert('M9 ')">M9</button>
                    <button class="toolbar-btn axis-blue" title="Tool radius offset register" onclick="window.insert && window.insert('D')">D</button>
                    <button class="toolbar-btn axis-blue" title="Feed rate word" onclick="window.insert && window.insert('F')">F</button>
                    <button class="toolbar-btn axis-blue" title="Tool length offset register" onclick="window.insert && window.insert('H')">H</button>
                    <button class="toolbar-btn axis-blue" title="Spindle speed word" onclick="window.insert && window.insert('S')">S</button>
                    <button class="toolbar-btn axis-blue" title="Tool selection word" onclick="window.insert && window.insert('T')">T</button>
                </div>
            </div>
        `;
  }
};

// web/src/extensionApp.js
init_themes();
init_programModel();
init_stackBridge();
init_gcodeToStack();
init_dialects();
init_controllerProfiles();
init_client();

// web/src/gcodeLint.js
function codeOf(line2) {
  return line2.replace(/\([^)]*\)/g, (m) => " ".repeat(m.length)).replace(/;.*$/, (m) => " ".repeat(m.length));
}
function ruleM350G53(text, post) {
  if (!post || post.id !== "ddcs-expert-m350") return [];
  const out = [];
  text.split(/\r?\n/).forEach((raw2, i) => {
    const line2 = codeOf(raw2);
    const g53 = /\bG53\b/i.exec(line2);
    if (!g53) return;
    if (/\bG0(?:0)?\b/i.test(line2)) {
      out.push({
        line: i,
        startCol: g53.index,
        endCol: g53.index + 3,
        severity: "warning",
        message: 'DDCS M350: G53 takes no G0 prefix \u2014 use a bare "G53 <axis>#var".',
        code: "ddcs.g53-no-g0"
      });
    }
    const after = line2.slice(g53.index + 3);
    const axisRe = /([XYZABC])\s*(#?[-+0-9.\[\]]+)/gi;
    let a;
    while (a = axisRe.exec(after)) {
      if (!a[2].includes("#")) {
        const col = g53.index + 3 + a.index;
        const ax = a[1].toUpperCase();
        out.push({
          line: i,
          startCol: col,
          endCol: col + a[0].length,
          severity: "error",
          message: `DDCS M350: G53 ${ax} needs a #var ref (e.g. "G53 ${ax}#99") \u2014 a literal fails on this firmware.`,
          code: "ddcs.g53-needs-var"
        });
      }
    }
  });
  return out;
}
var RULES = [ruleM350G53];
function lintGcode(text, post) {
  if (!text) return [];
  return RULES.flatMap((rule) => {
    try {
      return rule(text, post) || [];
    } catch (_) {
      return [];
    }
  });
}

// web/src/extensionApp.js
function dialectOpts3() {
  try {
    return { dialect: resolveActivePost(getActiveProfile().id) };
  } catch (_) {
    return {};
  }
}
document.addEventListener("DOMContentLoaded", () => {
  let __logSeq = 0;
  ["log", "warn", "error"].forEach((lvl) => {
    const orig = console[lvl].bind(console);
    console[lvl] = (...args) => {
      orig(...args);
      try {
        const text = args.map((a) => typeof a === "string" ? a : (() => {
          try {
            return JSON.stringify(a);
          } catch (_) {
            return String(a);
          }
        })()).join(" ");
        if ((lvl !== "log" || text.indexOf("DDCS") >= 0) && window.vscode) {
          window.vscode.postMessage({ type: "log", text: "#" + ++__logSeq + " [" + lvl + "] " + text.slice(0, 1500) });
        }
      } catch (_) {
      }
    };
  });
  try {
    new ThemeManager();
  } catch (err) {
    console.warn("[DDCS] ThemeManager init failed:", err && err.message ? err.message : err);
  }
  const B = window.Blockly;
  if (!B) {
    console.error("Blockly not found!");
    return;
  }
  const apiBase = window.__ddcsApiBase || "";
  if (apiBase) {
    try {
      localStorage.setItem("ddcs_api", apiBase);
    } catch (_) {
    }
  }
  const gwEl = document.getElementById("gw-status");
  const setGw = (txt, color) => {
    if (gwEl) {
      gwEl.textContent = txt;
      gwEl.style.color = color;
    }
  };
  setGw("gateway: connecting\u2026", "#8b97a6");
  makeClient({ base: apiBase }).descriptor().then((d) => {
    console.log("[DDCS] gateway descriptor:", d);
    setGw("gateway: connected", "#2dd4bf");
  }).catch((err) => {
    console.warn("[DDCS] gateway probe failed:", err);
    setGw("gateway: offline", "#f87171");
  });
  installBlockly(B);
  const theme = ddcsTheme(B);
  const toolbox = buildToolbox();
  const ws = B.inject("ws", {
    toolbox,
    theme,
    renderer: "geras",
    grid: { spacing: 26, length: 2, colour: "#1b2733", snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.9 },
    trashcan: true,
    move: { smoothScroll: true }
  });
  window.__workspace = ws;
  const dummyEditorManager = {
    insert: (code) => {
    },
    getValue: () => "",
    setValue: () => {
    },
    editor: { addEventListener: () => {
    } }
  };
  window.ddcsStudio = { editorManager: dummyEditorManager };
  initProgramModel();
  const reportLint = (text) => {
    if (!window.vscode) return;
    let post = null;
    try {
      post = resolveActivePost(getActiveProfile().id);
    } catch (_) {
    }
    try {
      window.vscode.postMessage({ type: "diagnostics", items: lintGcode(text, post) });
    } catch (_) {
    }
  };
  let muteChanges = false;
  let blocksActive = true;
  let lastSentText = null;
  onChange(({ stack: stack2, proj: proj2, origin }) => {
    const tlen = proj2 && proj2.text ? proj2.text.length : 0;
    console.log(`[DDCS] onChange origin=${origin} stackLen=${stack2 ? stack2.length : "null"} textLen=${tlen} blocksActive=${blocksActive}`);
    if (origin !== "blockly" && window.__workspace) {
      muteChanges = true;
      if (window.Blockly) window.Blockly.Events.disable();
      try {
        stackToWorkspace(stack2, window.__workspace);
      } finally {
        if (window.Blockly) window.Blockly.Events.enable();
        muteChanges = false;
      }
    }
    if (origin !== "vscode" && window.vscode) {
      console.log(`[DDCS] \u2192 postMessage documentChanged textLen=${tlen}`);
      lastSentText = proj2.text;
      window.vscode.postMessage({ type: "documentChanged", text: proj2.text });
    }
    reportLint(proj2.text);
  });
  window.addEventListener("vscode:updateDocument", (e) => {
    const text = e.detail;
    const norm = (s) => (s || "").replace(/\r\n/g, "\n");
    if (norm(text) === norm(lastSentText)) {
      console.log("[DDCS] vscode:updateDocument IGNORED (echo of our own change)");
      return;
    }
    const currentStack = getStack();
    const newStack = reconcileGcodeToStack(text, currentStack, dialectOpts3());
    console.log(`[DDCS] vscode:updateDocument textLen=${text ? text.length : 0} curStackLen=${currentStack ? currentStack.length : "null"} reconciledLen=${newStack ? newStack.length : "null"}`);
    if (newStack) {
      setStack(newStack, "vscode");
    }
  });
  window.__workspace.addChangeListener((e) => {
    if (e.isUiEvent || muteChanges || !blocksActive || e.type === Blockly.Events.FINISHED_LOADING) {
      if (!e.isUiEvent) console.log(`[DDCS] ws-change IGNORED type=${e.type} muted=${muteChanges} blocksActive=${blocksActive}`);
      return;
    }
    const stack2 = workspaceToStack(window.__workspace);
    console.log(`[DDCS] ws\u2192model setStack(blockly) stackLen=${stack2 ? stack2.length : "null"} (event ${e.type})`);
    setStack(stack2, "blockly");
  });
  window.wizardManager = new WizardManager(dummyEditorManager);
  window.openWiz = (type) => window.wizardManager.open(type);
  window.closeWiz = () => window.wizardManager.close();
  window.openPreview = () => {
    try {
      window.vscode && window.vscode.postMessage({ type: "openPreview", start: window.__pendingSpindleStart || null });
    } catch (_) {
    }
  };
  const sendSettings = () => {
    try {
      const store = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) store[k] = localStorage.getItem(k);
      }
      window.vscode && window.vscode.postMessage({ type: "settings", store });
    } catch (_) {
    }
  };
  window.addEventListener("ddcs:settings-changed", sendSettings);
  sendSettings();
  window.insertWiz = () => {
    console.log("[DDCS] insertWiz() clicked");
    return window.wizardManager.insert();
  };
  window.openCornerWiz = () => window.openWiz("corner");
  window.openMiddleWiz = () => window.openWiz("middle");
  window.openEdgeWiz = () => window.openWiz("edge");
  window.openAlignmentWiz = () => window.openWiz("alignment");
  window.clearCode = () => setStack([], "clear");
  try {
    const deck = new CommandDeck(dummyEditorManager, null);
    deck.renderHeader();
    window.__commandDeck = deck;
    document.querySelectorAll(".dock-header .header-right button").forEach((btn) => {
      const tx = (btn.querySelector(".btn-tx") || {}).textContent || "";
      if (tx.trim() !== "Clear") {
        btn.style.display = "none";
      }
    });
    console.log("[DDCS] commandDeck toolbar rendered");
  } catch (err) {
    console.error("[DDCS] commandDeck.renderHeader failed:", err && err.message ? err.message : err);
  }
  const mainEl = document.querySelector(".main");
  const gatewayApp = document.getElementById("gateway-app");
  const settingsApp = document.getElementById("settings-app");
  let _gatewayInited = false;
  window.showApp = async (which) => {
    const isBlocks = which === "blocks", isGateway = which === "gateway", isSettings = which === "settings";
    console.log(`[DDCS] showApp(${which})`);
    blocksActive = isBlocks;
    if (mainEl) mainEl.style.display = isBlocks ? "" : "none";
    gatewayApp && gatewayApp.classList.toggle("hidden", !isGateway);
    settingsApp && settingsApp.classList.toggle("hidden", !isSettings);
    document.querySelectorAll(".ext-tab").forEach((t) => t.classList.toggle("active", t.dataset.app === which));
    if (isGateway) {
      try {
        const mod = await Promise.resolve().then(() => (init_gatewayPanel(), gatewayPanel_exports));
        if (!_gatewayInited) {
          mod.initGatewayPanel();
          _gatewayInited = true;
        }
        mod.setGatewayPanelVisible(true);
      } catch (err) {
        console.error("[DDCS] gateway panel failed:", err);
      }
    } else {
      try {
        (await Promise.resolve().then(() => (init_gatewayPanel(), gatewayPanel_exports))).setGatewayPanelVisible(false);
      } catch (_) {
      }
    }
    if (isSettings) {
      try {
        (await Promise.resolve().then(() => (init_settingsPanel(), settingsPanel_exports))).openSettings();
      } catch (err) {
        console.error("[DDCS] settings panel failed:", err);
      }
    }
    if (isBlocks && window.__workspace) {
      const gs = getStack();
      console.log(`[DDCS] re-project on Blocks show, modelStackLen=${gs ? gs.length : "null"}`);
      muteChanges = true;
      if (window.Blockly) window.Blockly.Events.disable();
      try {
        stackToWorkspace(gs, window.__workspace);
      } finally {
        if (window.Blockly) window.Blockly.Events.enable();
        muteChanges = false;
      }
      if (window.Blockly) {
        try {
          window.Blockly.svgResize(window.__workspace);
        } catch (_) {
        }
      }
    }
  };
  Promise.resolve().then(() => (init_headerPost(), headerPost_exports)).then((m) => m.initHeaderPost()).catch((err) => console.error("[DDCS] header post init failed:", err));
  window.showApp("blocks");
});
