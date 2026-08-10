import { test, expect } from '@playwright/test';
import { autoAppDialog } from './_appDialog.js';

// t1107 — a per-BUILT-IN "Restore default" in the Wizard manager (Settings → Wizards). The safety net now built-ins are
// becoming editable: revert JUST one built-in to factory — its layout override (rename/reorder/regroup/icon/hide) AND its
// opensAs data-twin — leaving every other wizard and every custom op untouched. Shown ONLY when that built-in is actually
// customized (a layout override OR a diverged twin). Distinct from the blanket ↺ Reset to factory (whole bar).
test.use({ viewport: { width: 1400, height: 1000 } });
const SCRATCH = 'scratchpad';

const render = (page) => page.evaluate(async () => {
    const { renderWizardLibrary } = await import('/ui/wizardManagerPanel.js');
    let div = document.getElementById('twp');
    if (!div) { div = document.createElement('div'); div.id = 'twp'; div.style.cssText = 'position:fixed; inset:0; z-index:99999; overflow:auto; padding:16px; background:var(--bg,#0d1117);'; document.body.appendChild(div); }
    renderWizardLibrary(div);
});

test('per-wizard Restore: shows only on a customized built-in; reverts THAT one; leaves neighbours + custom ops untouched', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    await autoAppDialog(page, { accept: true });
    await page.evaluate(async () => {
        localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
        const L = await import('/blocks/wizardLibrary.js');
        const U = await import('/blocks/userOps.js');
        L.createWizard(U.userOpFromStack('rtest', 'R Test', [{ type: 'move', params: { x: 0, y: 0, z: -5 } }], []));   // a neighbouring CUSTOM op
    });
    await render(page);
    const mgr = page.locator('#twp');
    const restoreBtn = (id) => mgr.locator(`[data-entry="${id}"] button`, { hasText: 'Restore default' });

    // (1) a PRISTINE built-in shows NO Restore; a custom op shows NO Restore (it has Delete instead)
    await expect(restoreBtn('drill')).toHaveCount(0);
    await expect(restoreBtn('surfacing')).toHaveCount(0);
    await expect(mgr.locator('[data-entry="user_rtest"] button', { hasText: 'Delete' })).toHaveCount(1);
    await expect(restoreBtn('user_rtest')).toHaveCount(0);

    // (2) customize TWO built-ins (rename) → both show Restore
    await page.evaluate(async () => { const L = await import('/blocks/wizardLibrary.js'); L.setEntryOverride('drill', { label: 'My Drill' }); L.setEntryOverride('surfacing', { label: 'My Surface' }); });
    await render(page);
    await expect(restoreBtn('drill')).toHaveCount(1);
    await expect(restoreBtn('surfacing')).toHaveCount(1);
    await expect(mgr.locator('[data-entry="drill"] input[type="text"]')).toHaveValue('My Drill');   // the rename input carries the override
    await page.screenshot({ path: `${SCRATCH}/wizard-restore-default.png` });   // VIEWED — the Restore action on a customized built-in

    // (3) Restore ONE (drill) → its override clears; the NEIGHBOUR (surfacing) + the custom op are UNTOUCHED
    await restoreBtn('drill').click();
    await page.waitForTimeout(150);
    const st = await page.evaluate(async () => { const L = await import('/blocks/wizardLibrary.js'); return { drill: L.entryHasOverride('drill'), surf: L.entryHasOverride('surfacing') }; });
    expect(st.drill, 'drill override cleared').toBe(false);
    expect(st.surf, 'surfacing override UNTOUCHED').toBe(true);
    await render(page);
    await expect(mgr.locator('[data-entry="drill"] input[type="text"]'), 'drill back to its factory label').toHaveValue('Drill');
    await expect(restoreBtn('drill'), 'drill no longer customized → no Restore').toHaveCount(0);
    await expect(restoreBtn('surfacing'), 'the neighbour is still customized → still has Restore').toHaveCount(1);
    await expect(mgr.locator('[data-entry="user_rtest"] button', { hasText: 'Delete' }), 'the custom op survives untouched').toHaveCount(1);
});

test('per-wizard Restore: a diverged TWIN shows Restore (no layout override) and reseeding restores the factory twin', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    await autoAppDialog(page, { accept: true });
    const before = await page.evaluate(async () => {
        localStorage.removeItem('ddcs_wizard_layout');
        const U = await import('/blocks/userOps.js');
        const d = U.getUserDef('user_drill_data'); if (!d) return null;
        const bumped = { ...JSON.parse(JSON.stringify(d)), defV: (Number(d.defV) || 1) + 1 };   // a re-author bumps defV past the factory seed
        U.updateUserOp(bumped);
        return { diverged: window.ddcsUserOpDivergedFromFactory('user_drill_data'), noLayout: !(await import('/blocks/wizardLibrary.js')).entryHasOverride('drill') };
    });
    expect(before.diverged, 'the bumped twin reads as diverged').toBe(true);
    expect(before.noLayout, 'and there is NO layout override — the twin alone triggers Restore').toBe(true);
    await render(page);
    const mgr = page.locator('#twp');
    const restoreBtn = (id) => mgr.locator(`[data-entry="${id}"] button`, { hasText: 'Restore default' });
    await expect(restoreBtn('drill'), 'a diverged twin shows Restore even with no layout override').toHaveCount(1);
    // Restore → the twin reseeds to factory immediately (no reboot); it is no longer diverged
    await restoreBtn('drill').click();
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({ diverged: window.ddcsUserOpDivergedFromFactory('user_drill_data'), stillRegistered: !!window.ddcsUserOpDivergedFromFactory && !!document }));
    expect(after.diverged, 'after Restore the twin is back to factory (defV re-seeded, no longer diverged)').toBe(false);
    await render(page);
    await expect(restoreBtn('drill'), 'and the Restore action is gone (pristine again)').toHaveCount(0);
});
