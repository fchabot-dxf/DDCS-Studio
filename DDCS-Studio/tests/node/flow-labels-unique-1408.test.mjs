import { test, expect } from './support/harness.mjs';

/**
 * t1408 — EVERY `N` IN A PROGRAM IS UNIQUE, AND THE PROOF IS THAT BOTH OPS RUN.
 *
 * TIER MIGRATION (batch 12): split out of tests/flow-labels-unique-1408.spec.js. This is the ONE test in that
 * file with zero dependency on real app-boot globals (`window.openWiz`/`insertWiz`/`updateWiz`/etc, published
 * only by the real app.js boot sequence, never by the node harness's minimal page.goto() stub) — it only
 * imports `/wizards/ops/surfaceraster.js` and calls its plain exported functions. The dispatch's own note on
 * this file ("the audit notes a 'DIRECT BODY IS UNMOVED' test that stays") reads, on actually reading every
 * test body, the OPPOSITE way round: the 4 "EVERY OP RUNS" tests and "THE LABELS STAY INSIDE DEMONSTRATED
 * FORM" all call `window.openWiz`/`insertWiz`/etc and stay in tests/flow-labels-unique-1408-drive.spec.js;
 * "THE DIRECT BODY IS UNMOVED" (this one) is the pure one and moves. See the WORK-LOG entry for this batch.
 *
 * THE DEFAULTS ARE THE LEGACY NUMBERS — so nothing that reads the body DIRECTLY moved.
 *
 * This is the half of the change that keeps the arc's bridges honest: `surfaceRasterLines(p)` carries no label params,
 * so it prints exactly the numbers it has printed since t1329. Only the EMITTED PROGRAM renumbers, which is what has
 * to happen for the numbers to be unique. Asserted so the two halves cannot drift into one.
 */
test('THE DIRECT BODY IS UNMOVED — the legacy numbers are the declaration defaults', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, surfaceRasterBlock } = await import('/wizards/ops/surfaceraster.js');
        const S = { w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 };
        const body = surfaceRasterLines(S).join('\n');
        const ring = surfaceRasterLines({ ...S, strategy: 'concentric' }).join('\n');
        const ramp = surfaceRasterLines({ ...S, entry: 'ramp' }).join('\n');
        const helix = surfaceRasterLines({ ...S, entry: 'helix' }).join('\n');
        const skim = surfaceRasterLines({ ...S, zMode: 'skim' }).join('\n');
        const inset = surfaceRasterLines({ ...S, inset: 3 }).join('\n');
        return {
            row: ['GOTO91', 'GOTO13', 'N13', 'GOTO14', 'N14', 'GOTO15', 'N15', 'GOTO16', 'N16', 'GOTO17', 'N17', 'GOTO18', 'N18'].every((w) => body.includes(w)),
            ring: ['GOTO21', 'N21', 'GOTO22', 'N22'].every((w) => ring.includes(w)),
            ramp: ['GOTO41', 'N41', 'GOTO42', 'N42'].every((w) => ramp.includes(w)),
            helix: ['GOTO51', 'N51', 'GOTO52', 'N52'].every((w) => helix.includes(w)),
            skim: ['GOTO93', 'N93', 'GOTO94', 'N94'].every((w) => skim.includes(w)),
            inset: ['GOTO95', 'N95', 'GOTO96', 'N96'].every((w) => inset.includes(w)),
            // and the DECLARATION only claims labels the body will really write
            plungeParallel: surfaceRasterBlock.flowLabels({ strategy: 'parallel', entry: 'plunge' }),
            rampConcentric: surfaceRasterBlock.flowLabels({ strategy: 'concentric', entry: 'ramp', inset: 3, confirmEvery: 2 }),
        };
    });
    for (const k of ['row', 'ring', 'ramp', 'helix', 'skim', 'inset'])
        expect(r[k], `the ${k} labels still print their legacy numbers on a direct call`).toBe(true);
    // A LABEL IS CLAIMED ONLY WHEN THE BODY EMITS IT — holecycle's own rule, so the numbering stays tight and honest.
    expect(r.plungeParallel, 'a plain parallel/plunge body claims its refusal + the six row labels, nothing else')
        .toEqual(['errLabel', 'okLabel', 'rowStepLabel', 'rowCutLabel', 'rowNearLabel', 'rowEndLabel', 'rowFarLabel', 'rowStartLabel']);
    expect(r.rampConcentric, 'a concentric ramp with an inset and a confirm cadence claims exactly those')
        .toEqual(['errLabel', 'okLabel', 'insetErrLabel', 'insetOkLabel', 'ringStepLabel', 'ringCutLabel', 'confirmLabel', 'rampPlungeLabel', 'rampEndLabel']);
});
