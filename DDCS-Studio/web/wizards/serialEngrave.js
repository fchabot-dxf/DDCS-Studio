/**
 * wizards/serialEngrave.js — the DYNAMIC {SN} serial engraving emit (Text Stage 2, t762). The serial lives ON THE
 * CONTROLLER: a PERSISTENT uservar counter is bumped once per program run, and the runtime number is engraved by
 * digit-glyph SUBPROGRAMS. "No using Studio to make new code" — the program self-updates per execution.
 *
 * Grounded (t758, Expert M350 dumps): uservar #100-#549 is the non-volatile macro-var store (park #470-471 proven
 * cross-run); confirmed ops = + - * / [brackets] · #[indirect] · var-coords (G0 X#n) · IF [expr] GOTO · WHILE..END ·
 * comparisons == != < > <= >=. NO INT/floor confirmed → digit extraction is a SUBTRACTIVE WHILE loop (no labels).
 * Dispatch = an IF-GOTO ladder in a shared sub. Glyphs are drawn INCREMENTAL (G91) from the cursor so they need no
 * bracket-expr coords / computed-P / G52 (all unconfirmed). The sim runs it via the t760 M98 engine + a cross-run
 * uservar store, proving the bump end-to-end. SCOPE: horizontal (rotation 0), single-stroke centreline digits, one pass.
 */
import { glyph, getFont } from './strokeFont.js';

// Declared working scratch (volatile — overwritten each run) + the persistent counter default.
export const SN_WORK = { cursorX: 150, cursorY: 151, digit: 152, remainder: 153 };
export const SN_SLOT_DEFAULT = 490;   // wizard-configurable, guarded 100-549

// Each distinct token HEIGHT gets its own O-word SET (the height-dedupe): base = 600 + setIndex*20. Glyph d = base+d,
// the dispatcher = base+10. Bases 600 / 620 / 640… stay clear of the slib ranges (t758: O1-499, O504-8999 free).
export const snBase = (setIndex) => 600 + setIndex * 20;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Monospace digit PITCH for (height,width): the widest digit's advance, so a serial reads as fixed-width columns. */
export function digitPitch(height, widthScale = 1, fontName = 'single-stroke') {
    const font = getFont(fontName); const sc = height / font.capHeight;
    let w = 0; for (let d = 0; d <= 9; d++) w = Math.max(w, glyph(String(d)).w);
    return r3(w * widthScale * sc);
}

/** The GLYPH LIBRARY for one (height,width) SET: O(base+0..9) draw digits 0-9 INCREMENTALLY from the pen (one depth
 *  pass, returning the pen to baseline-left net-zero); O(base+10) is the dispatcher (pen→cursor, IF-GOTO ladder to the
 *  right glyph, then advance the cursor by the pitch). Emitted ONCE per program per distinct height. Returns G-code lines. */
export function glyphLibrary(setIndex, height, widthScale, cut, fontName = 'single-stroke') {
    const base = snBase(setIndex);
    const font = getFont(fontName); const sc = height / font.capHeight;
    const { feed, plunge, clearance: clr, depth } = cut;
    const dz = r3(clr + depth);   // plunge/retract delta (clearance ⇄ -depth), constant
    const pitch = digitPitch(height, widthScale, fontName);
    const lines = [];
    for (let d = 0; d <= 9; d++) {
        lines.push(`O${base + d} ( glyph ${d} )`, 'G91');
        let px = 0, py = 0;
        for (const stroke of glyph(String(d)).s) {
            const pts = stroke.map(([x, y]) => [r3(x * widthScale * sc), r3(y * sc)]);
            const [sx, sy] = pts[0];
            lines.push(`G0 X${r3(sx - px)} Y${r3(sy - py)}`);   // pen-up to the stroke start
            px = sx; py = sy;
            lines.push(`G1 Z${-dz} F${plunge}`);                // plunge
            for (let i = 1; i < pts.length; i++) { const [x, y] = pts[i]; lines.push(`G1 X${r3(x - px)} Y${r3(y - py)} F${feed}`); px = x; py = y; }
            lines.push(`G0 Z${dz}`);                            // retract
        }
        lines.push(`G0 X${r3(-px)} Y${r3(-py)}`, 'G90', 'M99'); // pen back to baseline-left, end sub
    }
    // Dispatcher O(base+10): draw the digit in #152 at the cursor, then advance the cursor.
    const L = base * 10;   // unique label block per set
    // Position the pen over the cursor AT CLEARANCE Z (the incremental glyph plunges clr→-depth, so it MUST enter at +clr).
    lines.push(`O${base + 10} ( engrave digit #${SN_WORK.digit} at the cursor )`, `G90 G0 X#${SN_WORK.cursorX} Y#${SN_WORK.cursorY} Z${r3(clr)}`);
    for (let d = 0; d <= 9; d++) lines.push(`IF [#${SN_WORK.digit} == ${d}] GOTO ${L + d}`);
    lines.push(`GOTO ${L + 10}`);
    // each target: the N-label on its OWN line (DDCS convention — a label line carries no statement), then the call.
    for (let d = 0; d <= 9; d++) lines.push(`N${L + d}`, `M98 P${base + d}`, `GOTO ${L + 10}`);
    lines.push(`N${L + 10}`, `#${SN_WORK.cursorX} = #${SN_WORK.cursorX} + ${pitch}`, 'M99');
    return lines;
}

/** The BUMP — increment the persistent counter once at program start (this execution). */
export function serialBump(slot, increment) { return [`#${slot} = #${slot} + ${increment} ( bump serial )`]; }

/** The INLINE {SN} dispatch at a text cursor (cx,cy): seed the cursor + a remainder from the counter, then per digit
 *  (MSB→LSB) a SUBTRACTIVE WHILE extract → the digit → call the set's dispatcher (which draws it + advances). */
export function serialInline(slot, count, cx, cy, setIndex) {
    const W = SN_WORK; const disp = snBase(setIndex) + 10;
    const lines = [
        `( {SN} — engrave #${slot} as ${count} digits )`,
        `#${W.remainder} = #${slot}`,
        `#${W.cursorX} = ${r3(cx)}`,
        `#${W.cursorY} = ${r3(cy)}`,
    ];
    for (let i = count - 1; i >= 0; i--) {
        const place = Math.pow(10, i);
        lines.push(
            `#${W.digit} = 0`,
            `WHILE [#${W.remainder} >= ${place}] DO1`,   // subtractive: count how many `place`s fit → the digit
            `#${W.remainder} = #${W.remainder} - ${place}`,
            `#${W.digit} = #${W.digit} + 1`,
            'END1',
            `M98 P${disp}`,                              // draw the digit + advance the cursor
        );
    }
    return lines;
}
