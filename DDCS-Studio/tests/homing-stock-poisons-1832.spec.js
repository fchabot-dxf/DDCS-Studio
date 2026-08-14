import { test, expect } from '@playwright/test';
import { openWizardViaBar, clickInsert } from './support/barGesture.js';

/**
 * t1832 — BUG 2 of the three t1786 trace bugs (WORK-LOG t1826 confirmed all three by real gesture, cross-check
 * proved them independent of bug 1/bug 3): Homing poisons `forceMachine`/`machineFrameTool` for the WHOLE
 * `blk-preview-panel`, not just its own segment. A user builds a real, common program — Home the machine, then
 * probe a corner — switches to the Blocks tab, and the workpiece silently vanishes from the live preview for
 * the WHOLE program, including corner's own segment, which genuinely does interact with the stock (it probes
 * the stock's own corner).
 *
 * Asserts the OUTCOME a user sees — the stock is actually there — not that an internal flag has some value.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('after a Homing op is in the program, the live preview still shows the stock', async ({ page }) => {
    test.setTimeout(60_000);
    // t1832 — REAL, CONFIRMED FINDING, NOT FIXED HERE. `programSimContext`'s own documented design
    // (viz/opSimContext.js) unions EVERY op's declared intent into ONE flag applied to the whole-program
    // preview panel — "force the envelope if ANY op needs it." Homing's own toolMachineFrame intent implies
    // machineFrameTool, which `simStock()` (createPreviewPanel.js) reads as "ignore the workpiece for
    // collision" — correct for Homing's OWN switch-seeking motion, but the SAME flag then hides the stock for
    // corner's own segment too, even though corner genuinely probes it. The honest fix needs the trace/
    // collision machinery to be PER-SEGMENT aware of which op a move belongs to, not a single whole-panel flag
    // — a domain call about how machine-frame is applied (this project's own explicit standing rule: that
    // distinction is not a display toggle), reserved for the advisor, not made here. `test.fail()` keeps this
    // TRACKED and visible rather than silently red or silently deleted — see WORK-LOG t1832.
    test.fail(true, 'programSimContext unions every op\'s machine-frame intent onto the whole-program preview panel — Homing correctly hides the stock for its own segment, but the same flag also hides it for corner\'s own, genuinely stock-interacting segment; the honest fix needs per-segment awareness, a domain call reserved for the advisor (see WORK-LOG t1832)');
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
        return { hasPanel: !!panel, stock: simConfig && simConfig.stock };
    });

    expect(r.hasPanel, 'sanity: the whole-program preview panel exists').toBe(true);
    // THE OUTCOME: the workpiece is actually there for the user to see, not just a flag reading a particular value.
    expect(r.stock, 'the live preview still shows the stock after a Homing op is in the program').not.toBeNull();
});
