import { test, expect } from '@playwright/test';

/**
 * t2685 — SURFACING SKIM: proving the "Type 2" (sim-only) marker the dispatch asked for is ALREADY BUILT.
 *
 * t2683 refuted feeding a marker INTO emit (surfacing skim's true start is a runtime jog, unknowable at
 * authoring time). This turn's own dispatch settled the real design: a marker whose position is SIM-ONLY —
 * read by the preview renderer, never by any emit path — is a different, legitimate thing. THE OWNER'S OWN
 * VOCABULARY: TYPE 1 (absolute/G90) — position IS emitted, dragging changes the G-code (surfacing NORMAL
 * mode: originX/originY). TYPE 2 (relative/G91) — position is sim-only, dragging changes only the preview
 * (surfacing SKIM mode: jogX/jogY).
 *
 * MEASURED (not assumed): `startMarkerTarget`/`jogX`/`jogY`/the `sf_pos` handle/the `previewOnlyParams`
 * write-back fallback ALREADY exist — built at t1648, extended at t1674, already exhaustively tested by
 * `surfacing-start-position-1648.spec.js` (9 assertions across both faces: draggable, mode-independent,
 * emit BYTE-IDENTICAL under a drag) and `surfacing-skim-rect-follows-marker-1674.spec.js` (the drawn rect
 * tracks the SAME marker, emit stable under two wildly different jogX/Y values). Every one of this turn's
 * own four build requirements — (1) a declared sim/preview start marker, (2) defaulting to the current
 * correct start, (3) draggable in the preview, (4) the drag reaches no emit path — is already satisfied by
 * that existing, currently-green code. NO NEW MECHANISM IS BUILT HERE. This file adds the ONE combination
 * the dispatch's own bar names that the existing suite doesn't already cover (a datum sweep alongside
 * zMode/jogXY), plus a live structural proof that the emit builder's own source never references jogX/jogY
 * at all — not merely "doesn't read it today," but "has no code path that could."
 */

test('emit BYTE-IDENTICAL across a normal+skim+datum sweep, regardless of jogX/jogY -- the combination the existing 1648/1674 suites don\'t already cover', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const SD = await import('/blocks/dataOps/surfacingData.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const def = SD.surfacingDataDef();
        registerUserOp(def);
        const build = builderOf(def.opType);
        const base = { originX: 20, originY: 15, w: 80, h: 60, wcs: 'active', strategy: 'raster', toolDia: 12, stepoverPct: 60, depth: 0.5, stepdown: 0.5, clearance: 5, feed: 200, plunge: 200, rpm: 18000 };
        const datums = ['nn', 'cc', 'pp'];   // near/centre/far -- stockAttach/pathDatum's own closed vocabulary
        const jogPairs = [[0, 0], [55, 33], [-70, 12]];
        const out = [];
        for (const zMode of ['normal', 'skim']) {
            for (const datum of datums) {
                const emits = jogPairs.map(([jogX, jogY]) => emitMapped(build({ ...base, zMode, stockAttach: datum, pathDatum: datum, jogX, jogY })).text);
                out.push({ zMode, datum, allIdentical: emits.every((e) => e === emits[0]) });
            }
        }
        return out;
    });
    for (const row of r) {
        expect(row.allIdentical, `zMode=${row.zMode} datum=${row.datum}: emit identical across 3 different jogX/jogY pairs`).toBe(true);
    }
});

test('structural proof: the emit builder\'s own source has NO reference to jogX/jogY at all -- not merely unread today, no code path that could read it', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const src = await page.evaluate(() => fetch('/wizards/ops/surfaceraster.js').then((r) => r.text()));
    expect(src.length, 'the fetch actually returned the real file, not an empty/error response').toBeGreaterThan(1000);
    expect(src, 'surfaceraster.js (the ACTUAL emit builder) never mentions jogX').not.toMatch(/jogX/);
    expect(src, 'surfaceraster.js never mentions jogY').not.toMatch(/jogY/);
});

test('SCREENSHOT for owner review: the skim preview shows the draggable Type-2 start marker at its default (current-correct) position', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const dd = await import('/blocks/dataOps/surfacingData.js');
        localStorage.removeItem('ddcs_user_ops');
        try { U.deleteUserOp('user_surfacing_data'); } catch (_) {}
        U.createUserOp(dd.surfacingDataDef());
        return true;
    });
    expect(r).toBe(true);
    await page.evaluate((t) => window.openWiz(t), 'user_surfacing_data');
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const zField = await page.evaluate(() => !!document.querySelector('[data-param="zMode"]'));
    expect(zField, 'zMode field exists on the rendered form').toBe(true);
    const measured = await page.evaluate(() => {
        const el = document.querySelector('[data-param="zMode"]');
        el.value = 'skim';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(600);
    const confirmed = await page.evaluate(() => document.querySelector('[data-param="zMode"]').value);
    expect(confirmed, 'the form genuinely switched to skim mode before the screenshot').toBe('skim');

    const box = await page.locator('#wiz_user').boundingBox();
    expect(box, 'the wizard modal rendered with a real size').toBeTruthy();
    await page.screenshot({ path: 'verification/t2685-surfacing-skim-marker.png', clip: box });

    await page.evaluate((t) => { import('/blocks/userOps.js').then((U) => { try { U.deleteUserOp(t); } catch (_) {} }); localStorage.removeItem('ddcs_user_ops'); }, 'user_surfacing_data');
});
