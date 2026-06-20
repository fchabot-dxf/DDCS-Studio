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
 * @param {string} gcode
 * @param {number} angleDeg  CCW degrees
 * @param {number} [px=0] @param {number} [py=0]  pivot (part datum) in the program frame
 * @returns {{ text:string, hadIncremental:boolean, rotated:number }}
 */
export function rotateProgram(gcode, angleDeg, px = 0, py = 0) {
    const th = (Number(angleDeg) || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const rotPt = (x, y) => [px + (x - px) * cos - (y - py) * sin, py + (x - px) * sin + (y - py) * cos];
    const rotVec = (i, j) => [i * cos - j * sin, i * sin + j * cos];
    let curX = 0, curY = 0, abs = true, hadIncremental = false, rotated = 0;
    const out = String(gcode == null ? '' : gcode).split(/\r?\n/).map((raw) => {
        if (/\bG91\b/.test(raw)) abs = false;
        if (/\bG90\b/.test(raw)) abs = true;
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
    return { text: out.join('\n'), hadIncremental, rotated };
}
