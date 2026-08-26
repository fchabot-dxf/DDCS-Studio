import { test, expect } from './support/harness.mjs';
import { opLabel, stripComment } from '../../web/shared/js/instrument/gcode-parse.js';
import { drillDataDef, DRILL_DEFAULTS } from '../../web/blocks/dataOps/drillData.js';
import { pocketDataDef, POCKET_DEFAULTS } from '../../web/blocks/dataOps/pocketData.js';
import { registerUserOp } from '../../web/blocks/userOps.js';
import { builderOf } from '../../web/blocks/opBuilders.js';
import { emitMapped } from '../../web/blocks/blockEmitter.js';
import { activeDialectOpts } from '../../web/wizards/previewEmit.js';

/**
 * t2061 — Tier 3's last parked item, collected. `opLabel()` used a single-level regex
 * (`/\(([^()]*)\)/`) to find a bare-comment op header — for a comment containing its OWN parentheses
 * (Studio's OLD drill header, "( ---- DRILL, parametric: 2 holes (grid) x peck · @work 52 ---- )"), the
 * regex matched the FIRST paren pair it could complete, which is the INNER "(grid)", not the header —
 * confirmed live at t2055, returning "grid" instead of the operation's actual name. Pocket's own header has
 * no nested parens and was always correct — the control that proves this was op-dependent, not universal.
 *
 * Fixed by building both `stripComment` and `opLabel` on ONE shared depth-tracker (`walkLine`, module-
 * private) instead of a regex for one and a depth-loop for the other that could (and did) disagree. Returns
 * the FULL trimmed header text, unmodified — matching what every non-nested header already shipped
 * (pocket's own is equally decorated with "----" dashes); truncating or cleaning up the text would make
 * drill's label inconsistent with every other op instead of fixing the actual defect, which was never about
 * how ornate a header is, only about capturing the right one.
 *
 * t2305 UPDATE — drill's REAL header is no longer nested at all: the nested `(grid)` this test's own name
 * cited was ITSELF a live defect (a comment DDCS closes at the first `)`, "everything after it parsed as
 * G-code" — see holecycle.js's own t2305 comment), fixed at the EMITTER by replacing the nesting with `:`.
 * That retires this test's own real-world nested-paren example; `opLabel`'s general nested-paren-handling
 * robustness (which this test used to prove via that real example) is still independently covered by the
 * SYNTHETIC case below ('(outer (mid (inner) mid) outer)') — unaffected by the emitter fix, since it is a
 * hand-written string, not a real emit. The golden string here was invalid G-code; updated, not just
 * re-asserted.
 */

test('drill\'s REAL emitted header, confirmed by execution: a clean, non-nested comment (t2305 fixed the nesting at the emitter)', () => {
    const def = registerUserOp(drillDataDef());
    const build = builderOf(def.opType);
    const params = { ...DRILL_DEFAULTS, pattern: 'grid', cols: 2, rows: 1, dx: 20 };
    const text = emitMapped(build(params), activeDialectOpts()).text;
    const headerLine = text.split(/\r?\n/).find((l) => /^\s*\(.*\)\s*$/.test(l));
    expect(headerLine, 'a real bare-comment header line exists in the real emit').toBeTruthy();
    const label = opLabel(headerLine);
    expect(label, 'the full header, no longer nested (t2305)').toBe('---- DRILL, parametric: 2 holes: grid x peck · @work 52 ----');
    expect(label).not.toBe('grid');
});

test('the CONTROL — pocket\'s own real header has no nested parens and is unaffected, byte-identical to before', () => {
    const def = registerUserOp(pocketDataDef());
    const build = builderOf(def.opType);
    const text = emitMapped(build({ ...POCKET_DEFAULTS }), activeDialectOpts()).text;
    const headerLine = text.split(/\r?\n/).find((l) => /^\s*\(.*\)\s*$/.test(l));
    expect(headerLine, 'a real bare-comment header line exists in the real emit').toBeTruthy();
    expect(opLabel(headerLine)).toBe('---- AREA CLEARING, parametric. Every var below speaks; change one and the loops re-derive. · @work 479 ----');
});

test('opLabel: doubly-nested parens survive as literal text, only the OUTERMOST delimiter pair is stripped', () => {
    expect(opLabel('(outer (mid (inner) mid) outer)')).toBe('outer (mid (inner) mid) outer');
});

test('opLabel: an unadorned single-level comment is unchanged (the common, pre-existing case)', () => {
    expect(opLabel('(Drill 6mm)')).toBe('Drill 6mm');
});

test('opLabel: a line with real G-code (not purely a comment) returns null', () => {
    expect(opLabel('G0 X10 (rapid to start)')).toBeNull();
    expect(opLabel('G1 X10 Y20 F500')).toBeNull();
});

test('opLabel: an empty comment or whitespace-only line returns null, not an empty string', () => {
    expect(opLabel('()')).toBeNull();
    expect(opLabel('   ')).toBeNull();
    expect(opLabel('')).toBeNull();
});

test('opLabel: a paren comment followed by a semicolon comment is STILL a pure-comment line — both are comment, not code', () => {
    // ';' starts a second, DIFFERENT comment form that also extends to end-of-line (the file's own header:
    // "Blank out DDCS comments: '(...)' spans and ';' to end-of-line") — neither is code, so the label from
    // the paren span is still extracted. Unchanged from the pre-fix behaviour (both old and new code share
    // this same stripComment(line).trim() gate); asserted here so a future change can't silently narrow it.
    expect(opLabel('(Facing pass) ; trailing note')).toBe('Facing pass');
});

test('stripComment: unchanged behaviour after the walkLine refactor — nested parens still fully blanked', () => {
    // Every commented character becomes a single space, one-for-one — asserted by RECONSTRUCTING the
    // expected string mechanically (same length, non-comment chars preserved) rather than hand-counting
    // spaces, which is exactly the kind of off-by-one a human easily gets wrong and a test should not repeat.
    const src = 'G0 X10 (a (b) c) Y20';
    const commentSpan = src.slice(src.indexOf('('), src.lastIndexOf(')') + 1);
    const expected = src.slice(0, src.indexOf('(')) + ' '.repeat(commentSpan.length) + src.slice(src.lastIndexOf(')') + 1);
    expect(stripComment(src)).toBe(expected);
    expect(stripComment('G1 X5 ; trailing')).toBe('G1 X5 ');
    expect(stripComment('(just a comment)').trim()).toBe('');
    expect(stripComment('(just a comment)').length).toBe('(just a comment)'.length);
});
