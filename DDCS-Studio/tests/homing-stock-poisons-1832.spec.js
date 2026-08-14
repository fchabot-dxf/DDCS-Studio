import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

/**
 * t1832/t1834 — BUG 2 of the three t1786 trace bugs, RE-RULED. Homing's own machine-frame intent unions across the
 * WHOLE `blk-preview-panel` program (`programSimContext`'s own documented "force it if ANY op needs it" design),
 * so `simStock()` withholds the workpiece for the entire trace, including a later op (Corner) that genuinely
 * probes it.
 *
 * t1832's ORIGINAL version of this test asserted the stock stays VISIBLE — that expectation was WRONG, and is
 * corrected here, not just patched. The advisor's t1834 ruling: THE HIDING IS CORRECT. A probe op PRODUCES the WCS
 * (this project's own standing rule, [[probes-never-read-wcs]]) — it never READS one. In a machine-frame view, the
 * stock's part-frame position is genuinely UNKNOWN until a probe runs, so drawing it beside those moves would
 * assert a spatial relationship nobody has measured yet — the false-picture failure this project treats as worst.
 * Hiding it is the honest answer; do NOT restore the old expectation thinking this is a regression.
 *
 * THE ACTUAL DEFECT was that the hiding was SILENT — a user watching the workpiece vanish had no way to tell this
 * apart from something broken. t1834's fix (opSimContext.js's `machineFrameContributors` + createPreviewPanel.js's
 * `setFrameNote`) makes the panel SAY what is withheld and why, in the user's language, as an honest caption (the
 * same neutral, non-alarming treatment as the existing `.pp-carve-note`) — not an error, not a warning. This test
 * now asserts THAT outcome: the stock stays hidden, AND the panel explains why, naming Homing.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('after a Homing op hides the workpiece for the whole preview, the panel explains why', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Real bar: Homing first (a genuine machine-frame op), then Corner (a genuine part-frame probe), one program.
    await openWizardViaBar(page, { group: 'Probe', optype: 'homing' });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });

    await openWizardViaBar(page, { group: 'Probe', optype: 'corner' });
    await expect(page.locator('#wiz_user_form [data-param="dist"]')).toBeVisible({ timeout: 5000 });
    await clickInsert(page);
    await page.waitForFunction(() => window.ddcsGetBlockProgram().filter((b) => b.type === 'op').length >= 2, null, { timeout: 10000 });

    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.__blkws, null, { timeout: 10000 });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => {
        const host = document.getElementById('blk-preview-panel');
        const panel = host && host.__panel;
        const simConfig = panel && panel.getSimConfig ? panel.getSimConfig() : null;
        const noteEl = host && host.querySelector('.pp-frame-note');
        return {
            hasPanel: !!panel,
            stock: simConfig && simConfig.stock,
            noteText: noteEl ? noteEl.textContent : null,
            noteVisible: noteEl ? noteEl.style.display !== 'none' : false,
        };
    });

    expect(r.hasPanel, 'sanity: the whole-program preview panel exists').toBe(true);
    // THE (now-confirmed-correct) HIDING: still null. A probe's part-frame position is genuinely unknown here.
    expect(r.stock, 'the workpiece stays hidden — its part-frame position is unknown in a machine-frame view').toBeNull();
    // THE FIX: the omission SPEAKS. Neutral caption, names the responsible op, explains the reason in plain words.
    expect(r.noteVisible, 'the frame note is shown when the stock is withheld').toBe(true);
    expect(r.noteText || '', 'the note names the reason (machine coordinates)').toMatch(/machine coordinates/i);
    expect(r.noteText || '', 'the note names Homing as the responsible op').toMatch(/homing/i);
});
