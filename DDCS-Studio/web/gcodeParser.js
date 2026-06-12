/**
 * DDCS Studio — G-code toolpath parser (with macro #variable evaluator)
 *
 * Parses motion (G0/G1/G2/G3 + G31 probe) into 3D line segments for the preview.
 * It now evaluates the DDCS macro variables the wizards emit, so probe macros
 * render too:
 *   - tracks `#N = expr` assignments (incl. indirect `#[expr] = …`)
 *   - evaluates `[ ]` arithmetic with + - * / and direct/indirect `#` refs
 *   - resolves `#`-based word values (e.g. `G31 X#8`, `G0 Z#18`)
 *
 * Scope: straight-line motion in program order. It does NOT follow IF/GOTO or
 * loops. Moves it still can't resolve (unknown system vars like #578/#1925, or
 * G53 machine-coordinate moves) are skipped.
 */

import { tokenizeWords } from './engine/core/tokenizer.js';
import { evalExpr } from './engine/core/expression.js';

/**
 * Controller parameter vars seeded from Studio settings, so code generated in
 * "read from controller" mode (#632/#640/#1078/... — PROBE-CONFIG-SOURCE.md) previews
 * with sensible values instead of dropping the moves as unresolvable.
 */
function ctrlVarSeed() {
    const cfg = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : null;
    const p = (cfg && cfg.probes) || {}, a = (cfg && cfg.atc) || {};
    return [
        [631, 1],                              // Pr131 probe detection times
        [632, Number(a.fFast) || 200],         // Pr132 probing speed
        [633, Number(a.blockHeight) || 50],    // Pr133 setter block thickness
        [640, Number(a.retract) || 2],         // Pr140 retraction after probe
        [1075, Number(p.setterPin) || 0],      // Pr575 fixed probe port
        [1077, Number(p.setterLevel) || 0],    // Pr577 fixed probe level
        [1078, Number(p.probePin) || 0],       // Pr578 floating probe port
        [1080, Number(p.probeLevel) || 0],     // Pr580 floating probe level
    ];
}

export function parseGcode(text) {
    const segments = []; // { x1,y1,z1, x2,y2,z2, a1,b1,a2,b2, rapid, probe }
    const vars = new Map(ctrlVarSeed());

    let pos = { x: 0, y: 0, z: 0, a: 0, b: 0 }; // a/b = rotary axis angles (degrees)
    let motion = 0;        // 0 rapid, 1 feed, 2 CW arc, 3 CCW arc
    let absolute = true;   // G90 / G91
    let unitScale = 1;     // G20 inch = 25.4, G21 mm = 1 (stored in mm)
    let plane = 17;        // G17 XY, G18 ZX, G19 YZ
    let feedVal = 0;       // modal feed (F); used to tell fast vs slow probes apart
    let started = false;
    let pass = 0;          // increments at each manual REPOSITION (one draggable start per pass)

    const bounds = {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    };
    let feedCount = 0, rapidCount = 0, retractCount = 0, probeCount = 0, jogCount = 0, skipped = 0;

    const grow = (p) => {
        if (p.x < bounds.minX) bounds.minX = p.x;
        if (p.y < bounds.minY) bounds.minY = p.y;
        if (p.z < bounds.minZ) bounds.minZ = p.z;
        if (p.x > bounds.maxX) bounds.maxX = p.x;
        if (p.y > bounds.maxY) bounds.maxY = p.y;
        if (p.z > bounds.maxZ) bounds.maxZ = p.z;
    };

    const lines = String(text || '').split(/\r?\n/);

    for (const raw of lines) {
        // Manual reposition flag (uniform "REPOSITION:" comment emitted by the wizards).
        // The operator re-parks the probe by hand → start a new pass at the program origin;
        // the 3D viewer gives each pass its own draggable ruby so it can be placed.
        if (/reposition:/i.test(raw)) {
            pass++;
            pos = { x: 0, y: 0, z: 0, a: 0, b: 0 };
        }
        // Unconditional GOTO = end of the success path; skip failure handlers under N-labels.
        if (raw.trim().toUpperCase().startsWith('GOTO')) break;
        // Retract moves are G0 moves the wizard comments as "Retract"
        const isRetract = /retract/i.test(raw);

        // Strip comments: ( ... ) and ; trailing
        const line = raw.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ');
        if (!line.trim()) continue;
        const trimmed = line.trim();

        // --- Variable assignment: #N = expr  (or  #[expr] = expr) ---
        if (trimmed[0] === '#') {
            const eq = trimmed.indexOf('=');
            if (eq > 0 && trimmed[eq + 1] !== '=') { // single '=' (not '==')
                const lhs = trimmed.slice(1, eq).trim();
                const rhs = trimmed.slice(eq + 1).trim();
                const idx = lhs[0] === '[' ? evalExpr(lhs, vars) : parseInt(lhs, 10);
                const val = evalExpr(rhs, vars);
                if (idx != null && Number.isFinite(idx) && val != null) vars.set(Math.round(idx), val);
                continue;
            }
            // A '#' line that isn't an assignment (e.g. a comparison) — nothing to draw
            skipped++;
            continue;
        }

        // --- Motion / modal line ---
        const words = tokenizeWords(line);
        if (words.length === 0) continue;

        const gcodes = [];
        const wm = {}; // letter -> evaluated number (or null if unresolvable)
        for (const w of words) {
            if (w.letter === 'G') {
                const g = parseFloat(w.value);
                if (Number.isFinite(g)) gcodes.push(g);
            } else {
                wm[w.letter] = evalExpr(w.value, vars);
            }
        }

        // Apply modal settings (G31 does NOT change the modal motion)
        const isProbe = gcodes.indexOf(31) !== -1;
        const isMachine = gcodes.indexOf(53) !== -1; // machine coords — unknown origin
        for (const g of gcodes) {
            if (g === 20) unitScale = 25.4;
            else if (g === 21) unitScale = 1;
            else if (g === 90) absolute = true;
            else if (g === 91) absolute = false;
            else if (g === 17) plane = 17;
            else if (g === 18) plane = 18;
            else if (g === 19) plane = 19;
            else if (g === 0 || g === 1 || g === 2 || g === 3) motion = g;
        }

        const has = (k) => Object.prototype.hasOwnProperty.call(wm, k);
        if (has('F') && wm.F != null) feedVal = wm.F;  // track modal feed
        const hasAxis = has('X') || has('Y') || has('Z') || has('A') || has('B');
        const hasArcOff = has('I') || has('J') || has('K') || has('R');
        if (!hasAxis && !hasArcOff) continue;          // modal-only / non-motion line
        if (isMachine) { skipped++; continue; }        // G53 machine-coord move — skip

        // Resolve target; if any present axis is unresolvable, skip the move
        const target = { x: pos.x, y: pos.y, z: pos.z, a: pos.a, b: pos.b };
        let bad = false;
        const axis = (k, lk) => {
            if (!has(k)) return;
            const v = wm[k];
            if (v === null || v === undefined) { bad = true; return; }
            target[lk] = absolute ? v * unitScale : pos[lk] + v * unitScale;
        };
        axis('X', 'x'); axis('Y', 'y'); axis('Z', 'z');
        // Rotary words (A/B) are degrees — never unit-scaled. A rotary-only move yields a
        // zero-length XYZ segment that still carries the angle, so the viewer can spin the
        // part instead of translating the tool (see gcodeViz3d part group).
        const rot = (k, lk) => {
            if (!has(k)) return;
            const v = wm[k];
            if (v === null || v === undefined) { bad = true; return; }
            target[lk] = absolute ? v : pos[lk] + v;
        };
        rot('A', 'a'); rot('B', 'b');
        if (bad) { skipped++; continue; }

        const effMotion = isProbe ? 1 : motion;        // a probe draws like a feed line
        if (!started) { grow(pos); started = true; }

        if (effMotion === 0 || effMotion === 1) {
            const type = isProbe ? 'probe' : (effMotion === 0 ? (isRetract ? 'retract' : 'rapid') : 'feed');
            segments.push({
                x1: pos.x, y1: pos.y, z1: pos.z,
                x2: target.x, y2: target.y, z2: target.z,
                a1: pos.a, b1: pos.b, a2: target.a, b2: target.b,
                rapid: effMotion === 0, probe: isProbe, type, pass, feed: feedVal,
            });
            if (isProbe) probeCount++;
            else if (effMotion === 0) { if (isRetract) retractCount++; else rapidCount++; }
            else feedCount++;
            grow(target);
            pos = target;
        } else {
            // Arc G2/G3 — need resolvable I/J/K or R
            const off = { I: wm.I, J: wm.J, K: wm.K, R: wm.R };
            const anyArcNull = ['I', 'J', 'K', 'R'].some(k => has(k) && (wm[k] === null || wm[k] === undefined));
            if (anyArcNull) { skipped++; continue; }
            const pts = gpArcPoints(pos, target, off, effMotion, plane, unitScale);
            let prev = pos;
            for (let i = 1; i < pts.length; i++) {
                const p = pts[i];
                segments.push({ x1: prev.x, y1: prev.y, z1: prev.z, x2: p.x, y2: p.y, z2: p.z, a1: pos.a, b1: pos.b, a2: pos.a, b2: pos.b, rapid: false, probe: false, type: 'feed', pass });
                grow(p);
                prev = p;
            }
            feedCount++;
            pos = target;
        }
    }

    return {
        segments,
        bounds: started ? bounds : null,
        stats: { feed: feedCount, rapid: rapidCount, retract: retractCount, probe: probeCount, jog: jogCount, passes: pass + 1, skipped, drawable: segments.length > 0 },
    };
}

// Interpolate a G2/G3 arc into points (center from I/J/K offsets or R radius).
function gpArcPoints(start, end, w, motion, plane, scale) {
    let a, b, lin;
    if (plane === 18) { a = 'x'; b = 'z'; lin = 'y'; }
    else if (plane === 19) { a = 'y'; b = 'z'; lin = 'x'; }
    else { a = 'x'; b = 'y'; lin = 'z'; }

    const sa = start[a], sb = start[b], ea = end[a], eb = end[b];
    const sLin = start[lin], eLin = end[lin];

    const offFor = (axis) => (axis === 'x' ? w.I : axis === 'y' ? w.J : w.K);

    let cx, cy;
    if (offFor(a) !== undefined && offFor(a) !== null || offFor(b) !== undefined && offFor(b) !== null) {
        cx = sa + ((offFor(a) || 0)) * scale;
        cy = sb + ((offFor(b) || 0)) * scale;
    } else if (w.R !== undefined && w.R !== null) {
        const R = w.R * scale;
        const mx = (sa + ea) / 2, my = (sb + eb) / 2;
        const dx = ea - sa, dy = eb - sb;
        const d = Math.hypot(dx, dy);
        if (d === 0 || Math.abs(R) < d / 2 - 1e-6) return [start, end];
        const h = Math.sqrt(Math.max(0, R * R - (d * d) / 4));
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
    if (motion === 3) { if (a1 <= a0) a1 += Math.PI * 2; }
    else { if (a1 >= a0) a1 -= Math.PI * 2; }
    let sweep = a1 - a0;
    if (Math.abs(sweep) < 1e-9) sweep = (motion === 3 ? 1 : -1) * Math.PI * 2;

    const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ang = a0 + sweep * t;
        const p = { x: 0, y: 0, z: 0 };
        p[a] = cx + r * Math.cos(ang);
        p[b] = cy + r * Math.sin(ang);
        p[lin] = sLin + (eLin - sLin) * t;
        pts.push(p);
    }
    return pts;
}
