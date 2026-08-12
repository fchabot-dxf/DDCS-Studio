import { test, expect } from '@playwright/test';

/**
 * t1454 — SURFACE 2 OF THE CONTEXT-MENU PASS: the BLOCKS CANVAS.
 *
 * ── THE FINDING THAT SHAPED IT ───────────────────────────────────────────────────────────────────────────────────
 * This canvas ALREADY HAS a right-click menu — Blockly's own, deliberately left alive (blocksApp's middle-pan guard
 * states it: *"RMB (button 2 = context menu) are untouched"*) — and its registry already ships **Duplicate, Delete,
 * Comment, Collapse/Expand and Inline**. Opening the app's `openMenu` on `contextmenu` would have suppressed all
 * five, and ONE OF THEM was among the entries this pass was asked to add. So "reuse the one mechanism" is honoured
 * as its real intent — the surface keeps ONE menu — by REGISTERING into Blockly's rather than covering it.
 *
 * The test therefore asserts BOTH halves, because either alone would be misleading: our entry appears, AND
 * Blockly's survive. A test that only checked ours would pass on the version that deleted Duplicate and Delete.
 *
 * t1734 — ▤ Show G-code (this pass's OTHER entry) is deleted along with the Projected G-code pane it targeted;
 * see the trimmed assertions below and blocks-code-panel-live-1589.spec.js for the fuller retirement note.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function seedAndOpen(page, wiz = 'pocket') {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.updateWiz && window.insertWiz && window.showApp && window.ddcsGetBlockProgram);
    await page.evaluate(async (w) => {
        window.openWiz(w, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
    }, wiz);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 0, { timeout: 8000 });
    await page.waitForTimeout(400);
}

/**
 * Open Blockly's context menu on the first `op` block with a REAL right-click, and read the entries it renders.
 *
 * ⚠ A SYNTHESISED `contextmenu` EVENT DOES NOT WORK HERE, measured: Blockly v13 opens its menu from its own gesture
 * handling (a pointerdown with button 2), not from a dispatched DOM event on the block's SVG root — the first cut
 * dispatched one and no menu appeared at all. Driving the real mouse is both the fix and the better test: it is the
 * gesture the user makes.
 */
const menuOnOp = async (page) => {
    const at = await page.evaluate(() => {
        const ws = window.__blkws;
        const op = ws.getAllBlocks(false).find((b) => b.type === 'op' || (typeof b.type === 'string' && b.type.endsWith('_op')));
        if (!op) return { err: 'no op block on the canvas' };
        const r = op.getSvgRoot().getBoundingClientRect();
        return { opId: op.id, opType: op.type, x: Math.round(r.left + Math.min(40, r.width / 2)), y: Math.round(r.top + 8) };
    });
    if (at.err) return at;
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.waitForTimeout(150);
    const items = await page.evaluate(() => {
        const menu = document.querySelector('.blocklyContextMenu, .blocklyWidgetDiv .blocklyMenu');
        return menu ? [...menu.querySelectorAll('.blocklyMenuItem, .goog-menuitem')].map((x) => x.textContent.trim()) : [];
    });
    return { ...at, items, opened: items.length > 0 };
};

/** Pick an open Blockly menu entry by label, with the real mouse (see the note on menuOnOp). */
const pickMenuItem = async (page, re) => {
    const box = await page.evaluate((src) => {
        const menu = document.querySelector('.blocklyContextMenu, .blocklyWidgetDiv .blocklyMenu');
        if (!menu) return null;
        const it = [...menu.querySelectorAll('.blocklyMenuItem, .goog-menuitem')].find((x) => new RegExp(src.s, src.f).test(x.textContent));
        if (!it) return null;
        const r = it.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    }, { s: re.source, f: re.flags });
    if (!box) throw new Error('menu entry not found: ' + re);
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(150);
};

test('THE CANVAS KEEPS ONE MENU — ours joins Blockly\'s, and Blockly\'s SURVIVE', async ({ page }) => {
    await seedAndOpen(page);
    const r = await menuOnOp(page);
    expect(r.err, 'the canvas really has an op block').toBeUndefined();
    expect(r.opened, 'right-clicking an op block opens a context menu').toBe(true);
    const all = r.items.join(' | ');
    // OURS — t1734: Show G-code deleted along with the Projected G-code pane it targeted; Edit survives
    expect(all, 'our Edit entry, naming the op').toMatch(/Edit/);
    // ⚠ BLOCKLY'S — the half a "replace the menu" implementation would have silently deleted. These are the reason
    // Duplicate and Delete are NOT re-added by us: they already exist here, and two of each would have to agree forever.
    expect(all, 'Blockly\'s Duplicate survives — it is already this surface\'s Duplicate').toMatch(/Duplicate/i);
    expect(all, 'and Blockly\'s Delete').toMatch(/Delete/i);
});

test('THE ENTRY ACTS — Edit opens the op\'s wizard', async ({ page }, testInfo) => {
    await seedAndOpen(page);
    await page.evaluate(() => { window.__ddcsEditCalls = []; const real = window.ddcsEditOp; window.ddcsEditOp = (id) => { window.__ddcsEditCalls.push(id); return real && real(id); }; });
    const r = await menuOnOp(page);
    await page.screenshot({ path: 'test-results/t1454-shots/blocks-canvas-menu.png' });
    await testInfo.attach('t1454-blocks-canvas-menu', { path: 'test-results/t1454-shots/blocks-canvas-menu.png', contentType: 'image/png' });

    // t1734 — this test used to also pick "Show G-code" and assert the code panel selected the op; that entry and
    // the pane it targeted are both deleted (see the file header). EDIT — pick it; assert it routed to the app's
    // ONE edit hook with THIS op's id.
    await pickMenuItem(page, /Edit/);
    const calls = await page.evaluate(() => window.__ddcsEditCalls || []);
    expect(calls.length, 'Edit called the app\'s one edit hook').toBeGreaterThan(0);
    expect(calls[0], '…with the op block\'s id, which IS the program op id (replaceOp uses the same)').toBe(r.opId);
});

test('THE ENTRIES ARE HIDDEN OFF AN OP — never a dead row', async ({ page }) => {
    await seedAndOpen(page);
    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        // a block that is NOT inside an op: the program framing (progstart) sits at the top level
        const loose = ws.getAllBlocks(false).find((b) => {
            let p = b; while (p && !(p.type === 'op' || (typeof p.type === 'string' && p.type.endsWith('_op')))) p = p.getParent && p.getParent();
            return !p;
        });
        if (!loose) return { skipped: 'every block on this canvas is inside an op' };
        const svg = loose.getSvgRoot(), rc = svg.getBoundingClientRect();
        svg.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(rc.left + 4), clientY: Math.round(rc.top + 4), button: 2 }));
        const menu = document.querySelector('.blocklyContextMenu, .blocklyWidgetDiv .blocklyMenu');
        const items = menu ? [...menu.querySelectorAll('.blocklyMenuItem, .goog-menuitem')].map((x) => x.textContent.trim()) : [];
        return { type: loose.type, items };
    });
    if (r.skipped) { test.info().annotations.push({ type: 'note', description: r.skipped }); return; }
    // t1734 — was Show G-code (deleted with the Projected G-code pane); Edit is now the entry this precondition guards.
    expect(r.items.join(' | '), `off an op (${r.type}), Edit must not appear`).not.toMatch(/Edit/);
});
