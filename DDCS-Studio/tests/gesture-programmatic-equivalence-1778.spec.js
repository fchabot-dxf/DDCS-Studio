import { test, expect } from '@playwright/test';

/**
 * t1778 — GESTURE == PROGRAMMATIC EQUIVALENCE (the user's own question: "if a spec calls the JS functions
 * programmatically instead of driving the UI, is that verifiable as the same path?").
 *
 * SCOPE, stated plainly so this is not over-read: this proves the two ENTRY PATHS (a real bar-click chain vs
 * the openWiz/insertWiz function-call shortcut ~95 other specs use) produce the SAME resulting program.
 * It does NOT prove the render is correct — that is a separate question (additions 4 and 6 of this audit).
 * A pass here means: whatever those ~95 specs assert about, they are asserting about a state a real user's
 * clicks actually reach — not a state only a test can reach.
 *
 * NORMALISATION, declared once, not grown: Blockly stamps a fresh random block `id` on every block it creates,
 * so two independently-built trees of otherwise-identical blocks can never be strictly equal — `id` is the
 * ONLY thing stripped before comparing. No other exception exists. If a THIRD kind of value needs excusing to
 * make this pass, per the dispatch that is the answer (a real divergence), not an obstacle to normalise away —
 * so this file stops at one declared exception and reports rather than adding a second/third.
 */

test.use({ viewport: { width: 1500, height: 950 } });

const DISTINCTIVE = '777';

/** The ONE normalisation this file allows: strip Blockly's per-block random `id`, recursively, structure
 *  otherwise untouched. Declared once so both captures go through the identical rule. */
function stripIds(node) {
    if (Array.isArray(node)) return node.map(stripIds);
    if (node && typeof node === 'object') {
        const out = {};
        for (const k of Object.keys(node)) {
            if (k === 'id') continue;
            out[k] = stripIds(node[k]);
        }
        return out;
    }
    return node;
}

async function bootAndOpenBar(page) {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
}

/** The CANVAS half of "program + canvas": switch to the Blocks tab (a real click, `[data-app="blocks"]`) and
 *  read what Blockly actually rendered. NOT a full structural deep-equal against the program — Blockly's own
 *  serialization also carries each block's canvas x/y LAYOUT position, which legitimately differs run-to-run
 *  (auto-placement, not part of "the program") and would be a SECOND normalisation exception on top of `id`.
 *  Per the dispatch's own warning against growing the normaliser, this stays a narrower, honest check instead:
 *  the canvas holds the same COUNT of blocks and the same set of block TYPES, and the distinctive value the
 *  test planted is actually visible in the rendered code preview on the canvas — proving the canvas reflects
 *  the program (not just that the two programs match each other), without inventing a position-blind deep-equal. */
async function canvasSnapshot(page) {
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkWs, null, { timeout: 10000 });
    return page.evaluate((val) => {
        const blocks = window.__blkWs.getAllBlocks(false);
        const types = blocks.map((b) => b.type).sort();
        const codeEls = Array.from(document.querySelectorAll('pre[id^="wiz_"][id$="_code"], #blk_wiz_user pre'));
        const codeText = codeEls.map((el) => el.textContent || '').join('\n');
        return { blockCount: blocks.length, types, hasDistinctiveValue: codeText.includes(`#1=${val}`) };
    }, DISTINCTIVE);
}

test('the real bar-click gesture and the openWiz/insertWiz shortcut produce the SAME program (ids stripped)', async ({ browser }) => {
    test.setTimeout(60_000);

    // ── PATH A: the REAL gesture — bar click -> dropdown item -> fill -> real INSERT button. Same chain as
    // tests/primary-route-real-gesture-1776.spec.js, on its own fresh page/context (no shared state with B). ──
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await bootAndOpenBar(pageA);
    await pageA.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: 'Probe' }).click();
    await pageA.locator('.dock-header .toolbar-dropdown-content button[data-optype="corner"]').click();
    const fieldA = pageA.locator('#wiz_user_form [data-param="dist"]');
    await expect(fieldA).toBeVisible({ timeout: 5000 });
    await fieldA.fill(DISTINCTIVE);
    await fieldA.dispatchEvent('change');
    await pageA.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await pageA.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    const programA = await pageA.evaluate(() => window.ddcsGetBlockProgram());
    const canvasA = await canvasSnapshot(pageA);
    await ctxA.close();

    // ── PATH B: the PROGRAMMATIC shortcut — openWiz(...) instead of the bar click, insertWiz() instead of the
    // INSERT button click. The field fill itself is the SAME real DOM interaction on both paths — the thing
    // under test is whether SKIPPING THE BAR NAVIGATION changes the resulting program, not whether typing
    // differs from setting a value. ──
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await bootAndOpenBar(pageB);
    await pageB.waitForFunction(() => window.openWiz && window.insertWiz);
    await pageB.evaluate(() => window.openWiz('user_corner_data'));
    const fieldB = pageB.locator('#wiz_user_form [data-param="dist"]');
    await expect(fieldB).toBeVisible({ timeout: 5000 });
    await fieldB.fill(DISTINCTIVE);
    await fieldB.dispatchEvent('change');
    await pageB.evaluate(() => window.insertWiz());
    await pageB.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    const programB = await pageB.evaluate(() => window.ddcsGetBlockProgram());
    const canvasB = await canvasSnapshot(pageB);
    await ctxB.close();

    const normA = stripIds(programA);
    const normB = stripIds(programB);

    if (JSON.stringify(normA) !== JSON.stringify(normB)) {
        // Report exactly where, per the dispatch — a divergence here is itself the finding, not a bug in the test.
        console.log('PROGRAM A (real gesture, ids stripped):', JSON.stringify(normA, null, 2));
        console.log('PROGRAM B (programmatic shortcut, ids stripped):', JSON.stringify(normB, null, 2));
    }
    expect(normA, 'the real bar-click gesture and the openWiz/insertWiz shortcut must produce the SAME program, modulo block ids').toEqual(normB);

    // CANVAS half: both paths must render the same block SHAPE and both must actually show the planted value —
    // proving the canvas is a faithful function of the (already proven identical) program, not a second,
    // independently-diverging surface.
    expect(canvasA.blockCount, 'canvas A: at least one block rendered').toBeGreaterThan(0);
    expect(canvasA.types, 'the two canvases render the same set of block types').toEqual(canvasB.types);
    expect(canvasA.hasDistinctiveValue, 'canvas A shows the planted value').toBe(true);
    expect(canvasB.hasDistinctiveValue, 'canvas B shows the planted value').toBe(true);
});
