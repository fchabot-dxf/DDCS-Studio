import { test, expect } from '@playwright/test';

/**
 * t1625 — "OPEN AS MODAL": the Blocks tab's live Wizard View at FULL SIZE, in the REAL modal chrome, rendered
 * from the CURRENT canvas stack — unsaved, and close persists nothing. The panel STAYS (ruled): the button is a
 * width change, not a replacement.
 *
 * Mechanism under test: blocksApp.deriveLiveWizard() (the ONE derivation the drawer and the modal both read) →
 * setUserOpDef(derived def) → wizardManager.open('group') — the _openGroupForEdit precedent, so the def is in NO
 * registry and nothing CAN persist. The #wizard overlay is adopted onto document.body on first use (it was born
 * inside #studio-app and opened invisibly behind the hidden Studio tab — every other modal already lives on body).
 */
test.use({ viewport: { width: 1700, height: 1000 } });

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.ddcsEditWizardDef && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};

const customizeCorner = async (page) => {
    await page.evaluate(() => window.ddcsEditWizardDef('user_corner_data'));
    await page.waitForFunction(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((x) => x && x.type === 'op');
        return !!(op && (op.children || []).length);
    }, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
};

const snapshot = (page) => page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    return {
        registry: JSON.stringify(U.listUserOps()),
        dirty: window.ddcsWorkspaceDirtyToFile ? window.ddcsWorkspaceDirtyToFile() : null,
        // `_group` is stripped DELIBERATELY: it is a pre-existing TRANSIENT annotation userOps.flattenBlocks writes
        // onto live records on every walk (the drawer's own renders included) — WHEN it appears is timing, not
        // semantics, and this spec's first cut red-flagged exactly that artifact. Everything else (params, ids,
        // structure, the persisted _expose) is compared byte-for-byte.
        stack: JSON.stringify(window.ddcsGetBlockProgram() || [], (k, v) => (k === '_group' ? undefined : v)),
    };
});

test('THE GESTURE — the current canvas stack opens in the real chrome, full width, and close persists NOTHING', async ({ page }) => {
    await boot(page);
    await customizeCorner(page);
    const before = await snapshot(page);

    const btn = page.locator('#blkOpenModal');
    await expect(btn, 'the door is visible while a wizard is on the canvas').toBeVisible();
    await btn.click();

    const st = await page.evaluate(() => {
        const w = document.getElementById('wizard');
        const box = document.querySelector('.wiz-box');
        const vis = document.querySelector('#wiz_user .wiz-visual');
        const controls = document.querySelector('#wiz_user .wiz-controls');
        return {
            active: w.classList.contains('active'),
            onBody: w.parentElement === document.body,
            visible: w.getBoundingClientRect().width > 0 && getComputedStyle(w).display !== 'none',
            title: document.getElementById('wizTitle').textContent,
            twoPane: box.classList.contains('two-pane'),
            previewing: box.classList.contains('previewing'),
            boxW: box.getBoundingClientRect().width,
            insertHidden: getComputedStyle(document.querySelector('.wiz-foot .primary')).display === 'none',
            rows: document.querySelectorAll('#wiz_user_form [data-param]').length,
            // THE REAL LAYOUT claim, quantified: visuals BESIDE the form (two panes side by side), not stacked
            sideBySide: !!(vis && controls && Math.abs(vis.getBoundingClientRect().top - controls.getBoundingClientRect().top) < 80
                && vis.getBoundingClientRect().left > controls.getBoundingClientRect().left + 100),
        };
    });
    expect(st.active && st.visible, 'the REAL overlay is open and actually visible from the Blocks tab').toBe(true);
    expect(st.onBody, 'the overlay was adopted onto body (it was invisible inside the hidden #studio-app)').toBe(true);
    expect(st.title, 'the title says what this is').toMatch(/PREVIEW/);
    expect(st.twoPane, 'corner (form3d+2d) gets its REAL two-pane layout').toBe(true);
    expect(st.boxW, 'at full size — not the drawer width').toBeGreaterThan(1200);
    expect(st.sideBySide, 'form and visualization sit SIDE BY SIDE — the product layout, not the narrow stack').toBe(true);
    expect(st.rows, 'the full corner form rendered').toBeGreaterThanOrEqual(20);
    expect(st.previewing && st.insertHidden, 'INSERT is hidden — the preview’s one exit is close').toBe(true);

    await page.click('.wiz-close');
    await page.waitForFunction(() => !document.getElementById('wizard').classList.contains('active'), null, { timeout: 8000 });
    const after = await snapshot(page);
    expect(after.registry, 'the registry is byte-identical — nothing persisted').toBe(before.registry);
    expect(after.stack, 'the canvas stack is byte-identical — nothing touched').toBe(before.stack);
    expect(after.dirty, 'the workspace dirty state did not move').toBe(before.dirty);
});

test('NO WIZARD → NO DOOR: on a plain program the button is hidden', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move_rapid', params: { x: 1, y: 2, z: 3 } }]));
    await page.waitForTimeout(800);
    await expect(page.locator('#blkOpenModal'), 'the door EXISTS (an absent element would also read as hidden)').toHaveCount(1);
    await expect(page.locator('#blkOpenModal'), 'no wizard face → the door is not offered').toBeHidden();
});

test('A REAL OPEN AFTER A PREVIEW gets its INSERT back — the preview chrome cannot leak', async ({ page }) => {
    await boot(page);
    await customizeCorner(page);
    await page.click('#blkOpenModal');
    await page.waitForFunction(() => document.getElementById('wizard').classList.contains('active'), null, { timeout: 8000 });
    await page.click('.wiz-close');
    await page.waitForFunction(() => !document.getElementById('wizard').classList.contains('active'), null, { timeout: 8000 });
    await page.evaluate(() => window.openWiz('user_pause_confirm'));
    const st = await page.evaluate(() => ({
        active: document.getElementById('wizard').classList.contains('active'),
        previewing: document.querySelector('.wiz-box').classList.contains('previewing'),
        insertVisible: getComputedStyle(document.querySelector('.wiz-foot .primary')).display !== 'none',
        title: document.getElementById('wizTitle').textContent,
    }));
    expect(st.active, 'the real wizard opens (the body-adopted overlay serves Studio flows too)').toBe(true);
    expect(st.previewing, 'open() cleared the preview class').toBe(false);
    expect(st.insertVisible, 'INSERT is back for a real wizard').toBe(true);
    expect(st.title, 'and the title is the wizard’s own, not the preview banner').not.toMatch(/PREVIEW/);
});
