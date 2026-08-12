import { test, expect } from '@playwright/test';

/**
 * EXECUTION-LINE GLOW (t142, merged from glow-gcode/5d72c76 + live-verified). During a sim in the Blocks tab, the
 * PROJECTED G-code panel (#blk-gcode) lights the currently-EXECUTING line (`.gl.active-line`) plus a fading comet-tail
 * (`[data-exec-age]` 1..5) — driven by the shared preview panel's onLine(lineIndex) → setExecLine, mapping the sim's
 * current line index to the matching `.gl` span. Display-only: it emits nothing (the .nc is unaffected).
 *
 * t1734 — RETIRED: GAMEPLAN STEP 3 deleted the Projected G-code pane (#blk-gcode) and every line this test reads
 * (`.gl`, `.active-line`, `[data-exec-age]`) along with it — blocksApp's setExecLine/clearExec/execTrail and the
 * onLine callback that drove them are gone too (createPreviewPanel's `onLine` option is simply no longer passed).
 * The block-to-line link this glow served is an explicitly accepted loss (see the dispatch), not replaced by
 * anything on the new Wizard View / 3D tabs — there is no successor surface to repoint this at. Body kept verbatim,
 * unexecuted, as the historical record. See ARCHITECTURE.md and WORK-LOG t1734.
 */
test.use({ viewport: { width: 1400, height: 950 } });

test.fixme('the projected G-code lights the sim execution line + a fading comet-tail (index-mapped) — t1734: #blk-gcode deleted', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_corner_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('#blk-gcode .gl').length > 5, { timeout: 6000 });
  await page.waitForTimeout(300);

  const readGlow = () => page.evaluate(() => {
    const gls = [...document.querySelectorAll('#blk-gcode .gl')];
    const active = document.querySelector('#blk-gcode .gl.active-line');
    const tail = [...document.querySelectorAll('#blk-gcode .gl[data-exec-age]')];
    return { activeIndex: active ? gls.indexOf(active) : -1, tailCount: tail.length, total: gls.length };
  });

  const before = await readGlow();
  expect(before.activeIndex, 'no exec line before the sim runs').toBe(-1);

  // step the sim a few lines (each executes a line → onLine → setExecLine)
  const step = page.locator('#blocks-app .pp-step').first();
  for (let k = 0; k < 4; k++) { await step.click({ force: true }); await page.waitForTimeout(130); }
  const mid = await readGlow();
  expect(mid.activeIndex, 'the executing line glows on the projected G-code').toBeGreaterThanOrEqual(0);

  // step further → the active line ADVANCES and a fading comet-tail forms
  for (let k = 0; k < 4; k++) { await step.click({ force: true }); await page.waitForTimeout(130); }
  const later = await readGlow();
  expect(later.activeIndex, 'the active line advanced with the sim').toBeGreaterThan(mid.activeIndex);
  expect(later.tailCount, 'a fading comet-tail follows the active line').toBeGreaterThan(0);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
