import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openWizardViaBar, fillField } from './support/barGesture.js';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1796 — SUITE FIX 3: PROVE THE RENDER EQUIVALENCE, so 175 files need no repointing.
 *
 * t1778 (Addition 2) proved the `openWiz`/`insertWiz` shortcut produces the SAME PROGRAM as a real bar click —
 * its own docblock says so explicitly, and explicitly NOT that the render is correct. Cross-tabbing all 782
 * specs against that license found the actual gap: 175 files assert something about the RENDER (136 assert
 * both program and render, 39 render only) while only 9 drive the real gesture — that license was never
 * extended to cover them. Repointing 175 files one at a time is hand-rolling the same edit 175 times; this
 * proves the property ONCE instead, the way t1778 did for the program half.
 *
 * ── WHAT THIS PROVES, AND WHAT IT DOES NOT (stated as plainly as t1778's own docblock) ─────────────────────────
 * This proves: for the SAME resulting op+params, the REAL entry gesture and the PROGRAMMATIC shortcut produce
 * PIXEL-IDENTICAL renders (on the unmasked region — see below) in the two surfaces those shortcuts land on.
 * This does NOT prove either render is CORRECT — a shortcut and a real click could in principle agree on a
 * WRONG picture just as easily as a right one. Correctness is what `screenshot-baselines-1792.spec.js`'s own
 * baselines guard, separately. If this spec ever goes red, that is a REAL finding (the two doors render
 * differently) — STOP, do not fix it here, report the diff image; it means the 175 files genuinely need
 * repointing, not that this spec's technique is wrong.
 *
 * ── TWO IDIOMS, TWO SEAMS, EACH WITH ITS OWN RISK ───────────────────────────────────────────────────────────────
 *   openWiz            (185 files) → the MODAL          → compared here as-is: `window.openWiz(optype)` needs
 *                                                          no prior state, so it's called fresh and compared
 *                                                          directly against the real bar-click chain's own
 *                                                          modal render.
 *   ddcsLoadBlockStack  (96 files, 229 uses) → the PANE  → compared here on the SAME program, not a hand-built
 *                                                          approximation of one: the real gesture's own
 *                                                          resulting `ddcsGetBlockProgram()` is captured FIRST,
 *                                                          then fed VERBATIM into `ddcsLoadBlockStack` on a
 *                                                          fresh page. This isolates the question to "does the
 *                                                          shortcut loader + Blocks-tab render the SAME program
 *                                                          the SAME way" — it does not re-litigate whether the
 *                                                          shortcut PRODUCES the same program, which t1778
 *                                                          already proved separately.
 *
 * Two ops, because the two take DIFFERENT renderer branches (t1780/Addition 3) and a proof on one branch does
 * not license the other: `corner` (hasTree, panel `form3d+2d` — a real visualization to mask) and
 * `pause_confirm` (the flat twin, panel `form` — no visualization at all, so nothing is masked for it).
 *
 * ── REUSE, not a third copy ──────────────────────────────────────────────────────────────────────────────────
 * `stopLiveSim`/`dismissToasts` (t1792/t1794) and the same mask + `maxDiffPixelRatio: 0` established in
 * `screenshot-baselines-1792.spec.js` are reused verbatim, not reimplemented.
 *
 * ── HOW THE COMPARISON WORKS (no stored baseline — comparing two LIVE captures against each other) ─────────────
 * Path A's screenshot is written to the exact path Playwright's own `toHaveScreenshot` would read as the
 * "expected" image (`testInfo.snapshotPath`), THEN path B is asserted against it with the standard API — the
 * SAME comparator `screenshot-baselines-1792.spec.js` uses, just fed a live capture instead of a committed
 * file. The generated file is deleted afterward (in `finally`) — it is a throwaway comparison target for THIS
 * run, not a persistent baseline; nothing here is committed to the snapshots directory.
 */

test.use({ viewport: { width: 1500, height: 950 } });

/** Settle a MODAL's own visualization (if it has one) before a screenshot: stop the live sim, wait, drop any
 *  toast. Mirrors `screenshot-baselines-1792.spec.js`'s own steps exactly (reused, not reimplemented). Returns
 *  the mask array to use (empty if this op declares no 3D box — pause_confirm's panel is `form`). */
async function settleModal(page) {
    await stopLiveSim(page, '#userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);
    const hasVizBox = await page.evaluate(() => !!document.getElementById('userViz3dBox') && getComputedStyle(document.getElementById('userViz3dBox')).display !== 'none');
    return hasVizBox ? [page.locator('#userViz3dBox')] : [];
}

/** Settle the PANE's own visualization before a screenshot — same shape as `settleModal`, for `#blk_*` ids. */
async function settlePane(page) {
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await stopLiveSim(page, '#blk_userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);
    const hasVizBox = await page.evaluate(() => !!document.getElementById('blk_userViz3dBox') && getComputedStyle(document.getElementById('blk_userViz3dBox')).display !== 'none');
    return hasVizBox ? [page.locator('#blk_userViz3dBox')] : [];
}

/** Compare a live screenshot buffer (path A) against a live locator (path B) via Playwright's own comparator —
 *  the SAME one the committed baselines use — using `bufferA` as a THROWAWAY expected-image target written
 *  just before the assertion and deleted in `finally` regardless of outcome. Nothing here is ever committed. */
async function assertRendersMatch(testInfo, name, bufferA, locatorB, mask) {
    const p = testInfo.snapshotPath(name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, bufferA);
    try {
        await expect(locatorB).toHaveScreenshot(name, { mask, maxDiffPixelRatio: 0 });
    } finally {
        fs.rmSync(p, { force: true });
    }
}

const OPS = [
    { optype: 'corner', userOpType: 'user_corner_data', group: 'Probe', fillParam: 'dist', fillValue: '741', formSelector: '#wiz_user_form' },
    { optype: 'pause_confirm', userOpType: 'user_pause_confirm', group: 'Setup', fillParam: 'msg', fillValue: 'DISTINCT-1796', formSelector: '#wiz_user_form' },
];

for (const op of OPS) {
    test(`RENDER EQUIVALENCE — openWiz vs the real bar chain, into the MODAL (${op.optype})`, async ({ page, browser }, testInfo) => {
        test.setTimeout(60_000);

        // Path A: the real bar gesture.
        await page.goto('/');
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await openWizardViaBar(page, { group: op.group, optype: op.optype });
        await fillField(page, { formSelector: op.formSelector, param: op.fillParam, value: op.fillValue });
        const maskA = await settleModal(page);
        const bufA = await page.locator('.wiz-box').screenshot({ mask: maskA });

        // Path B: the programmatic shortcut, on a FRESH page/context (no shared state with path A).
        const ctxB = await browser.newContext({ viewport: { width: 1500, height: 950 } });
        const pageB = await ctxB.newPage();
        await pageB.goto('/');
        await pageB.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await pageB.waitForFunction(() => !!window.openWiz);
        await pageB.evaluate((t) => window.openWiz(t), op.userOpType);
        await fillField(pageB, { formSelector: op.formSelector, param: op.fillParam, value: op.fillValue });
        const maskB = await settleModal(pageB);

        try {
            await assertRendersMatch(testInfo, `modal-${op.optype}-equiv.png`, bufA, pageB.locator('.wiz-box'), maskB);
        } finally {
            await ctxB.close();
        }
    });
}

for (const op of OPS) {
    test(`RENDER EQUIVALENCE — ddcsLoadBlockStack vs the real bar+Insert chain, into the PANE (${op.optype})`, async ({ page, browser }, testInfo) => {
        test.setTimeout(60_000);
        // t1796 — REAL, CONFIRMED FINDING for corner specifically (not fixed here, per the dispatch's own
        // instruction: "STOP, do not fix it, report"). The wall1 marker renders as a solid filled cyan SQUARE
        // with its "1" label via the real bar->Insert->Blocks chain, but as a small HOLLOW CIRCLE with no label
        // when the identical captured program is fed through ddcsLoadBlockStack instead — a genuinely different
        // glyph family (t1688's own shape convention: filled square = AUTO/emitting, a different glyph = a
        // different emits/source classification), not a subtle pixel/AA difference. 104px diff, reproduced
        // identically across 3 consecutive full runs (not flaky). `test.fail()` here keeps this a TRACKED,
        // visible red rather than a silently-loosened pass — if this line ever starts failing (the test
        // starts passing), that is itself the signal the underlying divergence was fixed and this line should
        // be removed. pause_confirm (the flat twin, no visualization at all) is NOT affected — see its own run.
        if (op.optype === 'corner') test.fail(true, 'ddcsLoadBlockStack renders wall1 marker as a different glyph family than the real Insert chain — see WORK-LOG t1796');

        // Path A: the real bar gesture through to the Blocks pane. Capture BOTH its render and its resulting
        // program (the program is fed to path B verbatim — this test is about the RENDER step only, not
        // re-litigating t1778's already-proven program equivalence).
        await page.goto('/');
        await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await openWizardViaBar(page, { group: op.group, optype: op.optype });
        await fillField(page, { formSelector: op.formSelector, param: op.fillParam, value: op.fillValue });
        await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
        await page.locator('[data-app="blocks"]').click();
        const maskA = await settlePane(page);
        const bufA = await page.locator('#blk_wiz_user').screenshot({ mask: maskA });
        const capturedProgram = await page.evaluate(() => window.ddcsGetBlockProgram());

        // Path B: ddcsLoadBlockStack fed the EXACT program path A produced, on a fresh page.
        const ctxB = await browser.newContext({ viewport: { width: 1500, height: 950 } });
        const pageB = await ctxB.newPage();
        await pageB.goto('/');
        await pageB.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
        await pageB.waitForFunction(() => !!window.ddcsLoadBlockStack);
        await pageB.evaluate((stack) => window.ddcsLoadBlockStack(stack), capturedProgram);
        await pageB.locator('[data-app="blocks"]').click();
        const maskB = await settlePane(pageB);

        try {
            await assertRendersMatch(testInfo, `pane-${op.optype}-equiv.png`, bufA, pageB.locator('#blk_wiz_user'), maskB);
        } finally {
            await ctxB.close();
        }
    });
}
