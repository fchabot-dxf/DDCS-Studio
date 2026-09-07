import { test, expect } from './support/harness.mjs';

// BLOCK-NATIVE CAM PARAMS S1 — the cam_table/cam_field SCHEMAS + camFieldsFromStack reader + round-trip. ENGINE ONLY: both
// blocks emit [] (metadata, like formfield) so emit is byte-identical; the reader mirrors bindingsFromStack; NOT yet consumed
// by the emit path or the modal (that is S2/S4). The advisor's own verify: a cam_table holding 2 cam_field blocks round-trips
// block→stack→block, camFieldsFromStack reads them IN ORDER with mode+label+param, the op emit is BYTE-IDENTICAL, and the
// block renders with the family colour + the read-only param chip.
//
// TIER MIGRATION WORK PACKAGE 3 — split browser→node. 2 of the 3 tests are pure: import()+evaluate over
// /blocks/userOps.js (camFieldsFromStack) + /blocks/blockEmitter.js + /wizards/previewEmit.js, over a synthetic
// template built inline — no DOM. The 3rd ("S1 — a cam_table + 2 cam_field round-trip block→stack→block…") stayed
// in the browser tier (tests/cam-block-native-params-drive.spec.js): it drives a real Blockly workspace
// (`window.__blkws`), `window.ddcsLoadBlockStack`, `window.showApp`, and takes a screenshot — a genuine
// app+DOM+Blockly dependency.

// A user_root template with a cam_table (2 rows) in the PRESENTATION mouth + a real atom in EXECUTION.
const TEMPLATE = (withTable) => ([{
    type: 'user_root', id: 'ur1', params: {},
    uiChildren: withTable ? [{
        type: 'cam_table', id: 'ct1', params: {}, children: [
            { type: 'cam_field', id: 'cf1', params: { param: 'feed', label: 'Feed rate', mode: 'expose', baked: '', units: 'mm/min', dflt: '', nmin: '1', nmax: '9999' } },
            { type: 'cam_field', id: 'cf2', params: { param: 'depth', label: '', mode: 'bake', baked: '5', units: '', dflt: '', nmin: '', nmax: '' } },
        ],
    }] : [],
    children: [
        { type: 'feed', id: 'f1', params: { rate: 300 } },
        { type: 'move', id: 'm1', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
    ],
}]);

test('S1 — camFieldsFromStack reads the cam_field rows IN ORDER with mode/param/label; and the emit is BYTE-IDENTICAL', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (mk) => {
        const { camFieldsFromStack } = await import('/blocks/userOps.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const withTable = new Function('return ' + mk)()(true);
        const noTable = new Function('return ' + mk)()(false);
        return {
            rows: camFieldsFromStack(withTable),
            emitWith: emitMapped(withTable, activeDialectOpts()).text,
            emitNo: emitMapped(noTable, activeDialectOpts()).text,
        };
    }, TEMPLATE.toString());
    // the reader returns the two rows in mouth order
    expect(r.rows.length, 'two cam_field rows').toBe(2);
    expect(r.rows[0], 'row 1 = feed, exposed, with the pendant label + range').toEqual({ param: 'feed', mode: 'expose', label: 'Feed rate', units: 'mm/min', min: 1, max: 9999 });
    expect(r.rows[1], 'row 2 = depth, baked to 5 (no pendant range)').toEqual({ param: 'depth', mode: 'bake', baked: '5' });
    // BYTE-IDENTICAL: the cam_table + its rows contribute NOTHING to the emit (metadata, like formfield)
    expect(r.emitWith, 'adding the cam_table does not change a single byte of G-code').toBe(r.emitNo);
    expect(r.emitWith, 'and the real atoms still emit').toContain('F300');
});

test('S1 — the reader ignores a mode that is not "bake" (defaults expose) and drops empty inherits', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { camFieldsFromStack } = await import('/blocks/userOps.js');
        const t = [{ type: 'cam_table', id: 't', params: {}, children: [
            { type: 'cam_field', id: 'a', params: { param: 'x', mode: '', label: '', baked: '9', units: '', dflt: '', nmin: '', nmax: '' } },   // empty mode → expose; baked ignored (not bake)
            { type: 'cam_field', id: 'b', params: { param: 'y', mode: 'bake', baked: '', label: '', units: '', dflt: '', nmin: '', nmax: '' } }, // bake but empty baked → no baked key
        ] }];
        return camFieldsFromStack(t);
    });
    expect(r[0], 'empty mode defaults to expose; a non-bake row drops baked').toEqual({ param: 'x', mode: 'expose' });
    expect(r[1], 'bake with empty baked → mode only, no baked key').toEqual({ param: 'y', mode: 'bake' });
});
