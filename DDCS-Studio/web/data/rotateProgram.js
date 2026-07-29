/**
 * data/rotateProgram.js — rotate a G-code program's XY geometry by an angle about a pivot.
 *
 * The "real alignment" companion-app fix (CAM-MENU-RESEARCH; alignment-real-correction memory): the operator
 * probes a fence, reads the misalignment angle, and Studio rotates the WHOLE program to match the physically
 * skewed part — the rotation DDCS can't do itself (no G68). Pure + testable; ALWAYS simulate the result before
 * cutting.
 *
 * Absolute (G90) moves rotate about (px,py); arc centre offsets I/J rotate as vectors (R-form arcs keep R, since
 * a radius is rotation-invariant). Modal position is tracked so a partial move (X-only or Y-only) rotates
 * correctly — it's rewritten with BOTH X and Y because rotation couples the axes. G91 incremental moves are NOT
 * rotated (flagged via `hadIncremental`) — Fusion posts are G90; an incremental program needs the operator's eye.
 */
const r3 = (n) => { const v = Math.round(n * 1000) / 1000; return Object.is(v, -0) ? 0 : v; };
const numAfter = (line, letter) => {
    const m = line.match(new RegExp(letter + '\\s*(-?\\d*\\.?\\d+)', 'i'));
    return m ? { val: parseFloat(m[1]), token: m[0] } : null;
};

/**
 * t1353 — THE PARAMETRIC-MOTION PREDICATE. One source, declared beside the transforms that consult it.
 *
 * Every transform in this file works the same way: find a number after an axis letter, replace it with another number.
 * That is exact on a program whose coordinates ARE numbers, and it is the wrong tool entirely on one whose coordinates
 * are macro registers or expressions — `G0 X0 Y#47`, `G1 X[0 + #40] F900`. The failure is not that the rewrite
 * declines to apply. Measured at t1351:
 *   TRANSLATE — rewrites the X and leaves the register Y: a HALF-SHIFTED move, so the raster shears.
 *   ROTATE    — couples X and Y, so it APPENDS the word it could not replace: `G0 X0 Y#47` becomes `... Y#47 Y0`,
 *               a second Y the controller obeys. That is UNCOMMANDED MOTION on a cutting line.
 *   MIRROR    — about X it matches nothing at all, so a two-sided setup cuts the same side twice.
 *
 * So the transforms REFUSE such a program instead of half-transforming it. The predicate is deliberately BROAD: an
 * axis or arc-offset word followed by `#` or `[` anywhere in the program. A false positive costs a refusal with a
 * reason on it; a false negative costs a wrong part. Modal-position tracking means one unrewritable word poisons
 * every later line, so program scope — not line scope — is the honest unit.
 *
 * IT TRACKS THE SAME EXEMPTIONS THE TRANSFORMS DO, and that is not a nicety — it is what keeps the guard from
 * refusing programs that were never at risk. G53 machine-frame moves and G91 INCREMENTAL regions are already returned
 * untouched by every transform above, so a register inside one cannot be half-rewritten.
 *
 * That exemption is load-bearing: measured across the registered ops, 24 of 54 emit a register axis word, ALL of them
 * the probe idiom `G31 X#8 F#3` — and every one sits inside a G91 region. Without the modal tracking this predicate
 * would refuse every probing program in the app, including the alignment rotation that exists to rotate one. With it,
 * the count of absolute register lines in corner/edge/middle/alignment is ZERO, and the guard costs those ops nothing.
 * A broad predicate is the safe default; a broad one that fires on the innocent is just a broken feature.
 *
 * @returns {{line: string, index: number, why: string}|null} the first offending line, or null when it is safe
 */
export function parametricMotion(gcode, absorbed = null) {
    const lines = String(gcode == null ? '' : gcode).split(/\r?\n/);
    const baked = absorbed instanceof Set ? absorbed : (Array.isArray(absorbed) ? new Set(absorbed) : null);
    let abs = true;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (/\bG91\b/.test(raw)) abs = false;                    // incremental: every transform leaves it alone
        if (/\bG90\b/.test(raw)) abs = true;
        // t1375 — AN ABSORBED LINE IS ALREADY ROTATED, by the atom that emitted it, and the EMITTER declares which
        // lines those are (it does not re-scan the text to find out — a map inferred from output is the double-rotate
        // hazard). Its parametric axis words are therefore not a refusal reason: they are the mechanism working.
        if (baked && baked.has(i)) continue;
        if (!abs || /\bG53\b/.test(raw)) continue;               // machine-frame / incremental: never transformed anyway
        const code = raw.replace(/\([^)]*\)/g, '').replace(/;.*$/, '');   // a comment is not motion
        const m = code.match(/\b([XYZIJKR])\s*([[#])/i);
        if (!m) continue;
        return {
            line: raw, index: i,
            why: `line ${i + 1} moves ${m[1].toUpperCase()} to a ${m[2] === '#' ? 'macro register' : 'runtime expression'}`
                + ' — its value is not known until the machine runs it, so it cannot be shifted, rotated or mirrored as text.',
        };
    }
    return null;
}

/** The refusal a transform returns instead of a half-applied program: the text UNCHANGED, plus the reason. */
function refuse(gcode, hit, what, extra) {
    return { text: String(gcode == null ? '' : gcode), refused: `${what} refused: ${hit.why}`, refusedAt: hit.index, ...extra };
}

/**
 * t1375 — THE SEAM WHERE AN ABSORBED RANGE MEETS TEXT THAT STILL ROTATES, and the one thing that can go wrong there.
 *
 * An absorbed op leaves the tool at a coordinate only the MACHINE knows (its moves are registers). Rotation couples the
 * axes, so a following PARTIAL move — one that names X but not Y — is rewritten with both, filling the missing axis
 * from the tracked modal position. After an absorbed range there is no such position: using the last literal one would
 * place the move somewhere the program never asked for, silently. This is the gap-or-overlap the mixed program hides,
 * so it is found UP FRONT and refuses the whole program rather than being discovered a line at a time.
 *
 * A full XY pair re-establishes the position, which is why an ordinary op following a surfacing op is fine: every
 * toolpath opens with a two-axis rapid to where it starts.
 */
function unseededPartial(lines, baked) {
    let abs = true, known = true;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
        const X = numAfter(raw, 'X'), Y = numAfter(raw, 'Y');
        if (baked && baked.has(i)) { if (/\b[XY]/i.test(raw.replace(/\([^)]*\)/g, ''))) known = false; continue; }
        if (!abs || /\bG53\b/.test(raw)) continue;
        if (!X && !Y) continue;
        if (X && Y) { known = true; continue; }                  // a full pair re-seeds the modal position
        if (!known) {
            return { line: raw, index: i,
                why: `line ${i + 1} moves only ${X ? 'X' : 'Y'}, and the op before it baked its own rotation — so the `
                    + 'other axis is a value only the machine knows. Rotation couples the axes, so completing this move '
                    + 'from a stale position would send it somewhere the program never asked for.' };
        }
    }
    return null;
}

/**
 * @param {string} gcode
 * @param {number} angleDeg  CCW degrees
 * @param {number} [px=0] @param {number} [py=0]  pivot (part datum) in the program frame
 * @param {{absorbed?: number[]|Set<number>}} [opts]  t1375 — line indices whose EMITTER already baked this rotation in
 *        (declared at emit time by the atom that did it; never inferred from the text). Those lines pass through
 *        untouched, their registers are not a refusal reason, and the position they leave cannot seed a partial move.
 * @returns {{ text:string, hadIncremental:boolean, rotated:number, absorbed:number }}
 */
export function rotateProgram(gcode, angleDeg, px = 0, py = 0, opts = {}) {
    const baked = (opts && opts.absorbed) ? (opts.absorbed instanceof Set ? opts.absorbed : new Set(opts.absorbed)) : null;
    const allLines = String(gcode == null ? '' : gcode).split(/\r?\n/);
    // t1353 — REFUSE rather than half-rotate. Rotation couples the axes, so a word it cannot replace is APPENDED
    // (measured: `G0 X0 Y#47` → `... Y#47 Y0`, uncommanded motion on a cutting line).
    { const hit = parametricMotion(gcode, baked); if (hit) return refuse(gcode, hit, 'rotate', { hadIncremental: false, rotated: 0, absorbed: 0 }); }
    // t1375 — and refuse the SEAM case too: a partial move that would have to be completed from a position an absorbed
    // op left at runtime. Whole-program, up front, for the same all-or-nothing reason.
    if (baked) { const hit = unseededPartial(allLines, baked); if (hit) return refuse(gcode, hit, 'rotate', { hadIncremental: false, rotated: 0, absorbed: 0 }); }
    const th = (Number(angleDeg) || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const rotPt = (x, y) => [px + (x - px) * cos - (y - py) * sin, py + (x - px) * sin + (y - py) * cos];
    const rotVec = (i, j) => [i * cos - j * sin, i * sin + j * cos];
    let curX = 0, curY = 0, abs = true, hadIncremental = false, rotated = 0, absorbed = 0;
    const out = allLines.map((raw, idx) => {
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
        // ALREADY ROTATED BY ITS EMITTER — pass it through verbatim. This is the whole of "the pass never re-scans":
        // it reads the declaration it was given and does nothing to those lines.
        if (baked && baked.has(idx)) { absorbed += 1; return raw; }
        const X = numAfter(raw, 'X'), Y = numAfter(raw, 'Y');
        const I = numAfter(raw, 'I'), J = numAfter(raw, 'J');
        if (!X && !Y && !I && !J) return raw;            // no planar geometry → pass through (Z, M-codes, …)
        if (!abs) { if (X || Y) hadIncremental = true; return raw; }   // don't rotate incremental moves

        let line = raw;
        if (X || Y) {
            const tx = X ? X.val : curX, ty = Y ? Y.val : curY;   // fill the missing axis from the tracked position
            const [rx, ry] = rotPt(tx, ty);
            // rewrite both axes (rotation couples them); append the missing one (G-code word order is free).
            line = X ? line.replace(X.token, 'X' + r3(rx)) : line + ' X' + r3(rx);
            line = Y ? line.replace(Y.token, 'Y' + r3(ry)) : line + ' Y' + r3(ry);
            curX = tx; curY = ty;   // track the ORIGINAL (pre-rotation) position for the next partial move
            rotated += 1;
        }
        if (I || J) {                                    // arc centre offset = a vector → rotate without the pivot
            const [ri, rj] = rotVec(I ? I.val : 0, J ? J.val : 0);
            if (I) line = line.replace(I.token, 'I' + r3(ri)); else line += ' I' + r3(ri);
            if (J) line = line.replace(J.token, 'J' + r3(rj)); else line += ' J' + r3(rj);
        }
        return line;
    });
    return { text: out.join('\n'), hadIncremental, rotated, absorbed };
}

/**
 * Translate a program's geometry by (dx,dy,dz) — shift the whole toolpath on the stock (a path-placement companion
 * to rotateProgram). Absolute (G90) X/Y/Z moves get the delta added; arc offsets I/J/K are RELATIVE vectors (centre
 * offsets) so they're unchanged; G91 incremental and G53 machine-coord moves are left alone (a shift would move them
 * wrongly). Per-axis independent, so partial moves carry the already-shifted modal position. Pure; simulate after.
 * @param {string} gcode @param {number} [dx=0] @param {number} [dy=0] @param {number} [dz=0]
 * @returns {{ text:string, hadIncremental:boolean, moved:number }}
 */
/**
 * t879 - MIRROR a program's geometry for a two-sided FLIP (the second setup). Flipping the part about the X axis
 * reflects Y (front/back); about the Y axis reflects X (left/right). The reflection is about the STOCK span
 * (Y'=sy-Y / X'=sx-X) so the part stays in its footprint (re-registered to the same corner). Cut geometry (Z<=0)
 * inverts through the stock thickness (Z'=-(Z+sz)) - a bottom feature authored in the design frame lands under the
 * new top; clearance/positioning moves (Z>0) stay above the part. An arc mirror REVERSES handedness (G2<->G3) and
 * flips the reflected centre offset. G91 incremental + G53 machine-coord moves are left alone. Pure; the SIM renders
 * it for free (the mirror is baked into the coordinates - the xform-rotate precedent).
 * @param {string} gcode @param {'X'|'Y'} axis  the flip axis @param {number} sx @param {number} sy  stock span
 * @param {number} sz  stock thickness (the Z-invert reference)
 * @returns {{ text:string, mirrored:number }}
 */
export function mirrorProgram(gcode, axis, sx = 0, sy = 0, sz = 0) {
    // t1353 — REFUSE rather than half-mirror. A mirror that matches nothing is the worst outcome here: the second
    // setup would cut the FIRST side again, on a part that has already been flipped in the fixture.
    { const hit = parametricMotion(gcode); if (hit) return refuse(gcode, hit, 'mirror', { mirrored: 0 }); }
    const isX = String(axis || 'X').toUpperCase() === 'X';   // flip ABOUT X -> reflect Y; flip ABOUT Y -> reflect X
    sx = Number(sx) || 0; sy = Number(sy) || 0; sz = Number(sz) || 0;
    let abs = true, mirrored = 0;
    const out = String(gcode == null ? '' : gcode).split(/\r?\n/).map((raw) => {
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
        if (!abs || /\bG53\b/.test(raw)) return raw;   // incremental / machine-coord: a mirror doesn't apply
        let line = raw;
        const X = numAfter(raw, 'X'), Y = numAfter(raw, 'Y'), Z = numAfter(raw, 'Z'), I = numAfter(raw, 'I'), J = numAfter(raw, 'J');
        if (isX) { if (Y) { line = line.replace(Y.token, 'Y' + r3(sy - Y.val)); mirrored += 1; } }
        else { if (X) { line = line.replace(X.token, 'X' + r3(sx - X.val)); mirrored += 1; } }
        if (Z && Z.val <= 1e-9) line = line.replace(Z.token, 'Z' + r3(-(Z.val + sz)));   // Z-invert the CUT geometry (clearance Z>0 stays above)
        if (/\bG0?[23]\b/.test(line)) {   // an arc: a mirror reverses handedness + flips the reflected centre offset
            if (isX && J) line = line.replace(J.token, 'J' + r3(-J.val));
            if (!isX && I) line = line.replace(I.token, 'I' + r3(-I.val));
            if (/\bG0?2\b/.test(line)) line = line.replace(/\bG0?2\b/, 'G3');   // G2->G3 (a mirror reverses arc handedness)
            else line = line.replace(/\bG0?3\b/, 'G2');
        }
        return line;
    });
    return { text: out.join('\n'), mirrored };
}

/**
 * t979 — RELATIVIZE a program's linear geometry for the surfacing "Skim" Z-mode: rewrite each ABSOLUTE (G90) X/Y/Z
 * move as an INCREMENTAL delta from the running position, so the whole op runs relative to wherever the tool starts
 * (jog to a corner, touch, face from there — no WCS datum). Per-axis: the FIRST reference of an axis becomes a 0
 * delta (that axis's start = the jogged position); subsequent moves are deltas. G53 machine-frame moves + already-
 * G91 moves are LEFT ALONE (the safe-Z retract stays absolute machine coords). Arc I/J are relative centre offsets
 * already → untouched. Pure; the caller wraps the result in G91 … G90. Simulate before cutting.
 * @param {string} gcode @returns {{ text:string, relativized:number }}
 */
export function relativizeProgram(gcode) {
    // Seed the running position at the program's coordinate ORIGIN (0,0,0) = the jog START (jog to the area corner at
    // the touched surface). So the very first absolute move is a real delta FROM the start — e.g. the opening `G0 Z<clr>`
    // stays a `+clr` LIFT, not a 0 no-op that would then let the first plunge dive the whole clearance+depth BELOW the
    // surface. Every axis therefore references the jog position, not its own first-seen value.
    const cur = { X: 0, Y: 0, Z: 0 };
    let abs = true, relativized = 0;
    const out = String(gcode == null ? '' : gcode).split(/\r?\n/).map((raw) => {
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
        if (!abs || /\bG53\b/.test(raw)) return raw;     // already incremental / machine-frame → leave absolute
        const toks = { X: numAfter(raw, 'X'), Y: numAfter(raw, 'Y'), Z: numAfter(raw, 'Z') };
        if (!toks.X && !toks.Y && !toks.Z) return raw;   // no linear geometry (M-codes, bare G-codes) → pass through
        let line = raw;
        for (const ax of ['X', 'Y', 'Z']) {
            const t = toks[ax];
            if (!t) continue;
            const delta = t.val - cur[ax];               // delta from the running position (seeded at the jog origin)
            line = line.replace(t.token, ax + r3(delta));
            cur[ax] = t.val;
            relativized += 1;
        }
        return line;
    });
    return { text: out.join('\n'), relativized };
}

export function translateProgram(gcode, dx = 0, dy = 0, dz = 0) {
    // t1353 — REFUSE rather than half-shift. Measured: the X of a row start takes the shift and its register Y does
    // not, so the raster shears. (The parametric surfacing atom no longer needs this path — it absorbs its own frame
    // — but the guard has to exist BEFORE the switch makes such bodies reachable, not after.)
    { const hit = parametricMotion(gcode); if (hit) return refuse(gcode, hit, 'translate', { hadIncremental: false, moved: 0 }); }
    dx = Number(dx) || 0; dy = Number(dy) || 0; dz = Number(dz) || 0;
    let abs = true, hadIncremental = false, moved = 0;
    const out = String(gcode == null ? '' : gcode).split(/\r?\n/).map((raw) => {
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
        const X = numAfter(raw, 'X'), Y = numAfter(raw, 'Y'), Z = numAfter(raw, 'Z');
        if (!X && !Y && !Z) return raw;                  // no linear geometry → pass through
        if (!abs) { hadIncremental = true; return raw; } // incremental moves: a shift doesn't apply
        if (/\bG53\b/.test(raw)) return raw;             // machine-coord move: don't shift it elsewhere in the machine
        let line = raw;
        if (X) line = line.replace(X.token, 'X' + r3(X.val + dx));
        if (Y) line = line.replace(Y.token, 'Y' + r3(Y.val + dy));
        if (Z) line = line.replace(Z.token, 'Z' + r3(Z.val + dz));
        moved += 1;
        return line;
    });
    return { text: out.join('\n'), hadIncremental, moved };
}
