import { test, expect } from './support/harness.mjs';
import { drillPatternGeometry } from '../../web/blocks/dataOps/drillData.js';
import { skipSet } from '../../web/wizards/ops/holecycle.js';
import { drillDataDef, DRILL_DEFAULTS } from '../../web/blocks/dataOps/drillData.js';
import { registerUserOp } from '../../web/blocks/userOps.js';
import { builderOf } from '../../web/blocks/opBuilders.js';
import { emitMapped } from '../../web/blocks/blockEmitter.js';
import { activeDialectOpts } from '../../web/wizards/previewEmit.js';

/**
 * t2042 — TIER 3 #21 SETTLED AS LIVE, and fixed: `drill_data`/`bore_data`'s shared preview
 * (`drillPatternGeometry`) drew every hole regardless of a declared `skip` — a PHANTOM HOLE the real
 * emit's own controller-side IF/GOTO would never actually cut. THE INVERSE of everything else this
 * arc found: here the CLASSIC view (`drillView.js`) was already correct, and the TWIN's own shared
 * preview was wrong.
 *
 * Confirmed live end to end BEFORE fixing anything (not from reading alone): drove the REAL registered
 * builder with a skip set, read the ACTUAL emitted G-code — `IF #89 == 1 GOTO93 ( hole 2 skipped )`, a
 * genuine controller-side jump around the peck motion — while `drillPatternGeometry`, called directly
 * with the SAME params, drew all 3 holes with zero skip-awareness. Reaches the PICTURE only (the real
 * emit was always correct); a phantom hole shown, not a missing cut.
 *
 * Fixed by exporting `skipSet` (`holecycle.js` — the ONE declared parse the real emit's own IF/GOTO
 * gates on) rather than writing a new function; `drillPatternGeometry` now omits a skipped hole's ring
 * entirely (not the drillView-style strikethrough — that convention is item/`kind:'hole'`-shaped, this
 * preview draws hole-rings as paths, a different pre-existing primitive; adopting the DECLARED rule
 * doesn't require also adopting that rendering shape). `drillView.js`'s own `parseSkip` — a byte-
 * identical, independently-hand-typed local copy of the exact same parse — collapsed onto the same
 * export too, since it was already sitting right there once `skipSet` was exported.
 */

test('THE LIVE BUG, confirmed end to end: the real emit skips hole 2, and the preview used to draw it anyway', () => {
    const def = registerUserOp(drillDataDef());
    const build = builderOf(def.opType);
    const params = { ...DRILL_DEFAULTS, pattern: 'grid', originX: 0, originY: 0, cols: 3, rows: 1, dx: 20, dy: 20, skip: '2', holeDia: 8 };
    const stack = build(params);
    const text = emitMapped(stack, activeDialectOpts()).text;
    expect(text, 'the real emit genuinely skips hole 2 on the controller').toMatch(/IF #\w+ == 1 GOTO\w+\s+\( hole 2 skipped \)/);
    // THE FIX: the preview must now agree — 2 holes drawn, not 3.
    const spec = drillPatternGeometry(params);
    expect(spec.paths, 'the preview now omits the hole the machine will never cut').toHaveLength(2);
});

test('drillPatternGeometry omits exactly the declared skip indices, for bore_data\'s shared preview too', () => {
    const CASES = [
        { skip: '', want: 3 },       // no skip -> all 3 drawn (unaffected default case)
        { skip: '1', want: 2 },
        { skip: '1,3', want: 1 },
        { skip: '1 2 3', want: 0 },   // space-separated, matching skipSet's own delimiter
        { skip: '99', want: 3 },     // an out-of-range skip index matches nothing, harmlessly
    ];
    for (const c of CASES) {
        const params = { pattern: 'grid', originX: 0, originY: 0, cols: 3, rows: 1, dx: 20, dy: 20, skip: c.skip, holeDia: 8 };
        const drill = drillPatternGeometry(params);           // drill: holeR is a fixed display dot
        const bore = drillPatternGeometry(params, true);       // bore_data passes boreDia=true — the SAME shared function
        expect(drill.paths, `drill skip="${c.skip}"`).toHaveLength(c.want);
        expect(bore.paths, `bore skip="${c.skip}"`).toHaveLength(c.want);
    }
});

test('skipSet parses the operator\'s comma/space-separated skip list the same way the real emit does', () => {
    expect([...skipSet({ skip: '2, 3' })].sort()).toEqual([2, 3]);
    expect([...skipSet({ skip: '' })]).toEqual([]);
    expect([...skipSet({})]).toEqual([]);
});
