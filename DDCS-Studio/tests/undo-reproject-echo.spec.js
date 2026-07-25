import { test, expect } from '@playwright/test';

/**
 * UNDO fix (t1161) — kill the redundant reproject ECHO at its source. The header Undo (window.ddcsUndo / #btn-undo)
 * drives saveStates. A programmatic ddcsLoadBlockStack rendered the workspace FROM the model, then Blockly's BATCHED
 * (async) block events reprojected the just-built workspace back into the model — re-iding the blocks + re-filling
 * defaults (feed) + adding a redundant Undo state — so Undo oscillated among those id/normalization variants and never
 * reached the pre-load content. The fix: blocksApp.renderFromModel wraps the rebuild in Blockly.Events.disable()/enable()
 * so the echo is never generated; a REAL user edit fires later (events enabled) → it still reprojects + snapshots. These
 * tests drive the REAL Undo button. (Test 3 is the risk guard: the mute must NOT swallow a genuine block edit.)
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function bootBlocks(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.ddcsUndo && window.ddcsRedo);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));   // clean baseline (the 'open' save-state)
    await page.waitForFunction(() => (window.ddcsGetBlockProgram() || []).length === 0);
}
const load = (page, x) => page.evaluate((v) => window.ddcsLoadBlockStack([{ type: 'move', params: { mode: 'cut', x: v, y: 0, z: 0, feed: 2000 } }]), x);
const clickUndo = (page) => page.evaluate(() => { const b = document.getElementById('btn-undo'); b ? b.click() : window.ddcsUndo(); });
const clickRedo = (page) => page.evaluate(() => { const b = document.getElementById('btn-redo'); b ? b.click() : window.ddcsRedo(); });
const waitX = (page, x) => page.waitForFunction((v) => { const p = window.ddcsGetBlockProgram() || []; return p.length ? (p[0].params && p[0].params.x === v) : (v === 'EMPTY'); }, x, { timeout: 6000 });

test('load A → load B → Undo reverts to A (content), Redo re-applies B', async ({ page }) => {
    await bootBlocks(page);
    await load(page, 11); await page.waitForTimeout(350);   // let the async reproject echo fire (the id-variant snapshot)
    await load(page, 22); await page.waitForTimeout(350);
    await waitX(page, 22);   // B loaded
    await clickUndo(page);
    await waitX(page, 11);   // ← the bug: Undo could not reach A (the pre-load content); the fix makes it
    await clickRedo(page);
    await waitX(page, 22);   // Redo re-applies B
});

test('load then Undo reaches the empty baseline (not a same-content id-variant)', async ({ page }) => {
    await bootBlocks(page);
    await load(page, 7); await page.waitForTimeout(350);
    await waitX(page, 7);
    await clickUndo(page);
    await waitX(page, 'EMPTY');   // ← Undo from a single load returns to the empty 'open' baseline
});

test('a real block-value edit is undoable (the app-wide path still works after the sig change)', async ({ page }) => {
    await bootBlocks(page);
    await load(page, 5); await page.waitForTimeout(350);
    await waitX(page, 5);
    // edit the move's X value in the workspace (a real 'blockly'-origin change) 5 → 9 — the value is a math_number child
    // block on the X input (NUM field), not a field on the move block itself.
    const edited = await page.evaluate(() => {
        const ws = window.__blkws; if (!ws) return false;
        const mv = ws.getAllBlocks(false).find((b) => b.type === 'move'); if (!mv) return false;
        const xin = mv.getInput && mv.getInput('X'); const tb = xin && xin.connection && xin.connection.targetBlock();
        if (!tb) return false;
        tb.setFieldValue('9', 'NUM'); return true;
    });
    expect(edited, 'found + set the X field (5→9)').toBe(true);
    await waitX(page, 9);   // the edit reprojected into the model
    await clickUndo(page);
    await waitX(page, 5);   // Undo reverts the value edit
});
