import { test, expect } from './support/harness.mjs';

/**
 * t1640 — THE FORMFIELD GAINS AN OP PARAM MODE. t1636 measured this is not a fork: `deriveBindings`'s matcher
 * already supports `match:{type:atomType},key:param` with zero engine changes — every shipped twin that binds a
 * real op atom already uses exactly that shape (surfacingData.js's `SURFACING_BINDING_SPECS` bind w/h/toolDia via
 * `match:{type:'surfaceraster'}`). The gap was purely the `formfield` block's authoring UI, which hard-coded
 * `match:{type:'assign',var:matchvar}` and offered no way to target a leaf atom's own param — so a form authored
 * over an ordinary op's params (not a macro var) derived ZERO bindings.
 *
 * The fix: a second declared `bindMode` on the formfield block — 'assign' (today, byte-identical default) vs
 * 'opparam' (atomType + key instead of matchvar). No new disambiguation machinery for two atoms of the same type:
 * `match:{type}` already requires exactly one hit (deriveBindings throws else) — the correct authoring error, and
 * a spec worth building only if a real third case ever needs it (rule-of-three).
 *
 * t1512 (tier migration): SPLIT off browser→node. The 2 MODEL/round-trip tests here are pure module calls
 * (flattenBlocks/deriveBindings/bindingsToBlocks/bindingsFromStack) asserted on plain returned data. The 2 "REAL
 * APP"/dialog-driven tests (real save button, real save dialog, page.reload(), document.querySelector) stayed in
 * formfield-opparam-1640-drive.spec.js.
 */
const RASTER_PARAMS = { x: 0, y: 0, z0: 0, w: 100, h: 80, inset: 0, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', rowAxis: 'x', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 };

test('MODEL: an Op Param formfield over a real op atom derives a binding — deriveBindings\' existing {type} matcher, zero engine changes', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || true);
    const r = await page.evaluate((raster) => {
        return import('/blocks/userOps.js').then((U) => {
            const specs = [{ param: 'width', type: 'number', default: undefined, label: 'Width', match: { type: 'surfaceraster' }, key: 'w' }];
            const stack = [{ type: 'surfaceraster', params: raster }];
            const flat = U.flattenBlocks(stack);
            return import('/blocks/dataOps/deriveBindings.js').then(({ deriveBindings }) => {
                const bindings = deriveBindings(flat, specs);
                return { bindings, w: bindings[0] && bindings[0].default, key: bindings[0] && bindings[0].key };
            });
        });
    }, RASTER_PARAMS);
    expect(r.bindings.length, 'one binding derived').toBe(1);
    expect(r.key, 'the socket key is the atom\'s own param').toBe('w');
    expect(r.w, 'the default read from the matched socket (no explicit default given)').toBe(100);
});

test('LOSSLESS reverse round-trip: bindingsToBlocks renders an op-param spec as an Op Param formfield, bindingsFromStack reads it back byte-identical', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio || true);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        // the exact match:{type} shape surfacingData.js's own (private) SURFACING_BINDING_SPECS uses for w/h/toolDia
        const opParamSpecs = [{ param: 'w', type: 'number', default: 100, label: 'Width', match: { type: 'surfaceraster' }, key: 'w' }];
        const blocks = U.bindingsToBlocks(opParamSpecs);
        const back = U.bindingsFromStack(blocks);
        return { opParamSpecs, back, bindMode: blocks[0] && blocks[0].params.bindMode, atomType: blocks[0] && blocks[0].params.atomType, matchvar: blocks[0] && blocks[0].params.matchvar };
    });
    expect(r.bindMode, 'renders as Op Param, not the misleading assign default').toBe('opparam');
    expect(r.atomType, 'the atom type carries through').toBe('surfaceraster');
    expect(r.matchvar, 'matchvar is left at its harmless placeholder — unused in opparam mode').toBe('#1');
    expect(r.back, 'round-trips byte-identical to the original spec (match/key/param/type all preserved)').toEqual(r.opParamSpecs);
});
