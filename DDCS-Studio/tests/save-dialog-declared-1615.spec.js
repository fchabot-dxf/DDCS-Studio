import { test, expect } from '@playwright/test';

/**
 * t1615 — the Save dialog READS the declaration (ruled; third instance of the save-path disease).
 *
 * The dialog asked Panel + Preview rig — questions the stack already answers as blocks (a `panel` block,
 * a `sim` preview-rig block). Ruling: stack declares → the dialog shows a READ-ONLY summary and does not
 * ask (blocks always win; with no control rendered, a conflict is impossible by construction); a bare
 * stack still asks; the NAME stays asked — the one genuinely new fact at save time. Every declared-value
 * assertion here reads its expectation off the CANVAS STACK in-page, never a copy. Plus the ruled honest
 * wording: saved into this workspace — rides your .ddcs file.
 */

const bootBlocks = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};
const settle = async (page) => {
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) return;
        last = n;
        await page.waitForTimeout(250);
    }
};

test('a stack that DECLARES panel + rigs: summary shown, no questions, the saved def carries the declared values', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await bootBlocks(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_corner_data'));
    await settle(page);
    // What the CANVAS declares — the one source every assertion below compares against.
    const decl = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const stack = window.ddcsGetBlockProgram() || [];
        const op = stack.find((b) => b && b.type === 'op');
        const flat = U.flattenBlocks(op ? op.children : stack);
        const panelBlk = flat.find((b) => b && b.type === 'panel');
        return { panel: panelBlk && panelBlk.params && panelBlk.params.panel, sim: U.simIntentFromStack(op ? op.children : stack) };
    });
    expect(decl.panel, 'the corner stack really does declare a panel').toBeTruthy();
    expect(decl.sim, 'and a preview rig').not.toBeUndefined();

    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 10000 });
    // No questions — the controls are NOT rendered (a hidden control could still disagree; absence cannot).
    await expect(page.locator('.blk-dev-savedlg .blk-dev-paneltype'), 'the Panel question is not asked').toHaveCount(0);
    await expect(page.locator('.blk-dev-savedlg .blk-dev-sim-rotary'), 'the rig checkboxes are not asked').toHaveCount(0);
    // The read-only summary IS the declaration.
    await expect(page.locator('.blk-dev-savedlg [data-decl-panel]'), 'a declared-panel summary renders').toHaveCount(1);
    const shownPanel = await page.evaluate(() => document.querySelector('.blk-dev-savedlg [data-decl-panel]').getAttribute('data-decl-panel'));
    expect(shownPanel, 'the summary shows the STACK declaration').toBe(decl.panel);
    await expect(page.locator('.blk-dev-savedlg [data-decl-sim]'), 'a declared-rig summary renders').toHaveCount(1);
    // The NAME is still asked — fill it and save (corner is maintained-as-data → "Save as new" is the path).
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 'decl reader probe');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForFunction(() => {
        const U = window.__blkws && true;
        return U;
    });
    const saved = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 'decl reader probe');
        return d ? { panel: d.panel, sim: d.sim } : null;
    });
    expect(saved, 'the wizard saved').not.toBeNull();
    expect(saved.panel, 'the saved panel IS the declared one').toBe(decl.panel);
    for (const k of ['showRotaryRig', 'forceMachine', 'showMagazine', 'probesForWcs']) {
        expect(!!(saved.sim && saved.sim[k]), `saved sim.${k} equals the declaration`).toBe(!!(decl.sim && decl.sim[k]));
    }
});

test('a BARE stack still asks — and the answers still land (the preserved fallback, pinned)', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await bootBlocks(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([
        { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
    ]));
    await settle(page);
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 10000 });
    await expect(page.locator('.blk-dev-savedlg .blk-dev-paneltype'), 'a bare stack IS asked for the panel').toHaveCount(1);
    await expect(page.locator('.blk-dev-savedlg .blk-dev-sim-rotary'), 'and the rig').toHaveCount(1);
    await page.selectOption('.blk-dev-savedlg .blk-dev-paneltype', 'form2d');
    await page.check('.blk-dev-savedlg .blk-dev-sim-rotary');
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 'bare stack answers');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    const saved = await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        const d = U.listUserOps().find((x) => x.label === 'bare stack answers');
        return d ? { panel: d.panel, rotary: !!(d.sim && d.sim.showRotaryRig) } : null;
    }, null, { timeout: 10000 }).then((h) => h.jsonValue());
    expect(saved.panel, 'the asked panel answer lands').toBe('form2d');
    expect(saved.rotary, 'the asked rig answer lands').toBe(true);
});

test('honest wording: the dialog says where the save goes', async ({ page }) => {
    test.setTimeout(120_000);
    page.on('dialog', (d) => d.accept());
    await bootBlocks(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { mode: 'cut', x: 1, y: 1, z: -1, feed: 500 } }]));
    await settle(page);
    await page.click('.blk-dev-savebtn');
    await page.waitForSelector('.blk-dev-savedlg', { timeout: 10000 });
    await expect(page.locator('.blk-dev-savedlg'), 'the ruled wording').toContainText('rides your .ddcs');
});
