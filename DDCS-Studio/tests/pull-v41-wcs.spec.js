import { test, expect } from '@playwright/test';

/**
 * V4.1 WCS PULL from coord1 (t654). The V4.1 stores its coordinate table in the SYSDISK `coord1` file (block 1 = G54), NOT
 * in a var the /api/vars endpoint serves (#15xx declined). So the gateway reads the file + emits the SAME wcs payload the
 * Expert branch produces, and the review modal renders the WCS rows from hwProfile.wcs when the readVars path finds nothing.
 * This asserts the coord1 G54 offsets land in the review (the June rig: G54 = -300.29 / -116.06 / 1547.268).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const V41_WCS = {   // the payload ops._map_wcs_to_profile_v41 produces from the June coord1 (block 1 = G54)
    active: 1,
    workOrigin: { x: -300.29, y: -116.06, z: 1547.268 },
    table: { g54: [-300.29, -116.06, 1547.268], g55: [0, 0, 0], g56: [0, 0, 0], g57: [0, 0, 0], g58: [0, 0, 0], g59: [0, 0, 0] },
};

test('the review renders the V4.1 WCS table from coord1 (G54 taught) when /api/vars declines #15xx', async ({ page }) => {
    await page.route('**/api/profile', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'ddcs-v41', name: 'DDCS V4.1', hardwareTabs: [], wcs: V41_WCS }) }));
    await page.route('**/api/vars**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, values: {} }) }));   // the vars endpoint declines #15xx → empty → the file-read fallback fires
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings && window.ddcsSetMachine);
    // t1229 — this workspace IS the V4.1 being pulled from (the ordinary case), so the new mismatch gate stays out of
    // the way; a pull from a DIFFERENT controller is covered in tests/gateway-mismatch-gate-1229.spec.js.
    await page.evaluate(() => window.ddcsSetMachine({ name: 'june-rig', controllerId: 'ddcs-v41' }, true));
    await page.evaluate(() => window.openSettings());
    await page.click('.settings-main-tab[data-group="controller"]');
    await page.click('[data-target="set_tab_profile"]');
    await page.click('#set_profile_pull');
    await page.waitForSelector('#import-modal.active #import-body', { timeout: 8000 });
    // t2067 — the workspace has NO WCS (fresh machine) and the controller has a taught G54 → the pull now marks the WCS
    // row 'changed', so it surfaces even with "Show only changed" ticked (the empty-vs-taught case the user hit).
    const wcsTag = await page.evaluate(() => {
        const row = [...document.querySelectorAll('#import-modal .im-row')].find((r) => /active/i.test(r.querySelector('.im-lbl')?.textContent || ''));
        return row ? (row.querySelector('.im-tag')?.textContent || '') : null;
    });
    expect(wcsTag, 'the WCS row shows as "changed" (empty workspace vs a taught controller) — visible without unticking').toBe('changed');
    // untick anyway to review the full 6-system detail table below
    await page.evaluate(() => { const o = document.querySelector('#import-only'); if (o && o.checked) { o.checked = false; o.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForSelector('#import-modal.active #import-body .im-drow', { timeout: 8000 });

    const rows = await page.evaluate(() => [...document.querySelectorAll('#import-modal .im-drow')].map((r) => ({
        label: (r.querySelector('.im-dlbl') || {}).textContent || '', raw: (r.querySelector('.im-draw') || {}).textContent || '', derived: (r.querySelector('.im-dder') || {}).textContent || '',
    })));
    const g54 = rows.find((r) => /^G54/.test(r.label));
    expect(g54, 'a G54 detail row renders (from coord1, not readVars)').toBeTruthy();
    expect(g54.raw, 'G54 shows the coord1 offsets').toContain('-300.29');
    expect(g54.derived, 'G54 flagged active, read from the controller file (coord1/setting), not the live var-read').toMatch(/active.*(file|coord1)/i);
    // the empty systems render as zero rows (G55 present, all-zero) — the whole table pulled, not just the taught one
    expect(rows.find((r) => /^G55/.test(r.label)), 'G55 row present (all 6 systems shown)').toBeTruthy();

    // APPLY lands it in settings.machine.wcs (+ syncWorkOrigin) — the same path as the Expert WCS
    await page.evaluate(() => { const cb = [...document.querySelectorAll('#import-modal [data-cand]')].find((c) => /WCS/.test(c.closest('.im-row')?.parentElement?.textContent || '') || true); });
    await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('#import-modal [data-cand]')];
        // tick the WCS candidate then apply
        for (const b of boxes) { const lbl = b.parentElement.querySelector('.im-lbl')?.textContent || ''; if (/active/.test(lbl)) b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); }
        const apply = document.querySelector('#import-apply'); if (apply) apply.click();
    });
    // t1221 — WAIT for the apply to finish instead of reading in the same tick. This used to read the settings
    // synchronously right after the click and pass only because the WCS write happened to sit in applyCandidates'
    // synchronous prefix; the apply now takes an automatic safety copy first, so nothing lands before the first await.
    // The modal closing is the real completion signal.
    await page.waitForFunction(() => !document.getElementById('import-modal').classList.contains('active'), null, { timeout: 8000 });
    const applied = await page.evaluate(() => {
        const m = window.ddcsGetSettings().machine || {};
        return { table: m.wcs && m.wcs.table, active: m.wcs && m.wcs.active };
    });
    expect(applied.table && applied.table[0], 'APPLY writes the G54 offsets into settings.machine.wcs').toMatchObject({ x: -300.29, y: -116.06 });
});
