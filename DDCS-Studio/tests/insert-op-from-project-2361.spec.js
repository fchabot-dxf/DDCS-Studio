import { test, expect } from '@playwright/test';

/**
 * t2361 (BACKLOG #37) — INSERT OP FROM PROJECT, the preset successor. From the quick menu's Project section,
 * browse this workspace's saved projects, pick ONE op from any of them, it's inserted into the CURRENT program
 * with its saved params. See ui/projects/insertOpPicker.js's own header for the full ruling, incl. the
 * unregistered-user-op-type hazard (an op whose custom def lives only in another workspace never travels inside
 * the .mjson — refuse with the reason visible, never silently drop or guess).
 */
test.use({ viewport: { width: 1300, height: 980 } });

async function seed(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.ddcsGetBlockProgram, null, { timeout: 15000 });
    await page.evaluate(async () => {
        const store = await import('/ui/projects/projectStore.js');
        // A real builtin op (a registered builder) with a comment (t2289) and params the picker's summary reads.
        await store.saveProject('Bracket', {
            kind: 'ddcs.macro', v: 1, name: 'Bracket',
            stack: [{ id: 'srcOp1', type: 'op', opType: 'pocket', label: 'Pocket', params: { depth: 5, toolDia: 6 }, children: [], simChildren: [], comment: 'roughing pass' }],
        });
        // A user_* op whose def lives only in ANOTHER workspace — never registered here. Not a shipped data-op
        // twin (those self-register under user_* at boot too, e.g. user_pocket_data — a real opType, deliberately
        // NOT used here so this fixture stays genuinely unregistered): a made-up opType no def anywhere claims.
        await store.saveProject('Legacy', {
            kind: 'ddcs.macro', v: 1, name: 'Legacy',
            stack: [{ id: 'srcOp2', type: 'op', opType: 'user_from_another_workspace_xyz', label: 'Old fork', params: { depth: 3 }, children: [], simChildren: [] }],
        });
    });
}

async function openPicker(page) {
    await page.click('#hdrPostBtn');
    await page.click('#hdrPostMenu [data-act="projInsert"]');
    await expect(page.locator('#iopOverlay')).toBeVisible();
    return page.locator('#iopOverlay');
}

test('the quick menu\'s Project section carries an Insert op… row that opens the picker', async ({ page }) => {
    await seed(page);
    await page.click('#hdrPostBtn');
    const row = page.locator('#hdrPostMenu .hq-ws-row:has([data-act="projInsert"])');
    await expect(row.locator('[data-act="projInsert"]')).toBeVisible();
    await row.locator('[data-act="projInsert"]').click();
    await expect(page.locator('#iopOverlay')).toBeVisible();
    await expect(page.locator('#iopOverlay .wsm-title')).toHaveText('Insert op from project');
});

test('a project row expands to its ops: TYPE label, one-line params summary, and the op\'s own comment', async ({ page }) => {
    await seed(page);
    const ov = await openPicker(page);
    await expect(ov.locator('[data-projrow="Bracket"]')).toBeVisible();
    await ov.locator('[data-projrow="Bracket"] [data-iop="toggle"]').click();
    const opRow = ov.locator('.iop-op-row').first();
    await expect(opRow).toContainText('Pocket');
    await expect(opRow).toContainText('depth: 5');
    await expect(opRow).toContainText('roughing pass');
    await expect(opRow.locator('[data-iop="insert"]')).toBeVisible();
});

test('INSERT adds the op to the current program with its saved params — the list stays open', async ({ page }) => {
    await seed(page);
    const before = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).length);
    const ov = await openPicker(page);
    await ov.locator('[data-projrow="Bracket"] [data-iop="toggle"]').click();
    await ov.locator('.iop-op-row [data-iop="insert"]').click();
    await expect(page.locator('.toast')).toBeVisible();
    // the picker itself stays open — picking again is just picking again
    await expect(page.locator('#iopOverlay')).toBeVisible();
    const after = await page.evaluate(() => window.ddcsGetBlockProgram() || []);
    expect(after.length, 'the program grew by exactly the inserted op').toBe(before + 1);
    const inserted = after.find((o) => o.opType === 'pocket');
    expect(inserted, 'the inserted op carries the SAVED params, not defaults').toBeTruthy();
    expect(inserted.params.depth).toBe(5);
    expect(inserted.params.toolDia).toBe(6);
});

test('THE HAZARD: an op whose type has no builder registered here is refused, never silently dropped', async ({ page }) => {
    await seed(page);
    const ov = await openPicker(page);
    await ov.locator('[data-projrow="Legacy"] [data-iop="toggle"]').click();
    const opRow = ov.locator('.iop-op-row').first();
    await expect(opRow).toHaveClass(/iop-op-row-disabled/);
    await expect(opRow).toContainText('Not available in this workspace');
    // no Insert button on a refused row — nothing to silently click through
    await expect(opRow.locator('[data-iop="insert"]')).toHaveCount(0);
});
