// gcode-parse.js — G-code scanning for the browser instrumenter (JS port of checkpoint_insert.py's
// scan/strip_comment/op_label). Pure functions, no DOM. The Python self-test is the spec.

const WORD = /([A-Za-z])\s*([-+]?\d*\.?\d+)/g;

// Walk a line char-by-char, tracking DDCS comment status: nesting-aware '(...)' spans + ';' to end-of-line
// (which ends the walk entirely — nothing after it is code OR comment, by DDCS convention). Calls
// onChar(ch, depth) once per character reached. ONE depth-tracker — stripComment blanks every commented
// character; opLabel needs the comment's OWN text (minus the outermost delimiter pair that marks it as a
// comment in the first place), so it can't be derived by re-parsing stripComment's already-blanked output;
// both are built on this one walk instead of each tracking depth its own way.
function walkLine(line, onChar) {
  let depth = 0;
  for (const ch of line) {
    if (depth === 0 && ch === ";") break;
    if (ch === "(") { depth++; onChar(ch, depth); continue; }
    if (ch === ")") { onChar(ch, depth); depth = Math.max(0, depth - 1); continue; }
    onChar(ch, depth);
  }
}

// Blank out DDCS comments: '(...)' spans and ';' to end-of-line. Enough for word extraction.
export function stripComment(line) {
  const out = [];
  walkLine(line, (ch, depth) => out.push(depth > 0 ? " " : ch));
  return out.join("");
}

// If a line is essentially just a '(...)' comment (a CAM op header), return its full text — nesting-aware.
// t2061 — was a single-level regex (`/\(([^()]*)\)/`) that matched the FIRST paren pair it could complete;
// for a comment that contains its own parens (e.g. Studio's real drill header, "... 2 holes (grid) x
// peck ..."), that is the INNER pair, not the label — confirmed live: returned "grid" instead of the
// header. Now walks the SAME depth-tracker stripComment uses: every character at depth >= 1 is kept
// (including nested parens, as literal text — "(grid)" survives unchanged), and only the OUTERMOST
// delimiter pair (depth exactly 1 at the paren itself) is dropped, the same way it always was for a
// non-nested header. Returns the FULL trimmed text, unmodified — matching what already ships for every
// other op's header (pocket's own is equally decorated and was never touched by this bug); truncating or
// cleaning it up here would make drill's label inconsistent with every other op instead of fixing the
// actual defect, which was never about how ornate a header is, only about capturing the RIGHT one.
export function opLabel(line) {
  if (stripComment(line).trim()) return null;   // not purely a comment line
  const chars = [];
  walkLine(line, (ch, depth) => {
    if (ch === "(" || ch === ")") { if (depth > 1) chars.push(ch); return; }
    if (depth > 0) chars.push(ch);
  });
  const label = chars.join("").trim();
  return label || null;
}

// One forward pass: track modal motion/pos/feed, per-move time, Z-up flag, current op label.
// Returns { moves: [{idx, cumT, zup, op}], totalTime }.
export function scan(lines, { rapid = 6000, defaultFeed = 1000, zupEps = 1e-4 } = {}) {
  let x = 0, y = 0, z = 0, have = false, feed = 0, mode = null, curOp = null, cum = 0;
  const moves = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lab = opLabel(raw);
    if (lab !== null) curOp = lab;
    const code = stripComment(raw);
    const words = [...code.matchAll(WORD)];
    if (!words.length) continue;
    let nx = x, ny = y, nz = z, saw = false;
    for (const [, letter, val] of words) {
      const u = letter.toUpperCase();
      const v = parseFloat(val);
      if (u === "G" && [0, 1, 2, 3].includes(v)) mode = v | 0;
      else if (u === "X") { nx = v; saw = true; }
      else if (u === "Y") { ny = v; saw = true; }
      else if (u === "Z") { nz = v; saw = true; }
      else if (u === "F") feed = v;
    }
    if (!saw || mode === null) { x = nx; y = ny; z = nz; continue; }
    if (!have) { x = nx; y = ny; z = nz; have = true; continue; }
    const dist = Math.sqrt((nx - x) ** 2 + (ny - y) ** 2 + (nz - z) ** 2);
    const rate = mode === 0 ? rapid : (feed > 0 ? feed : defaultFeed);
    cum += rate > 0 ? (dist / rate) * 60.0 : 0;
    moves.push({ idx: i, cumT: cum, zup: (nz - z) > zupEps, op: curOp });
    x = nx; y = ny; z = nz;
  }
  return { moves, totalTime: cum };
}
