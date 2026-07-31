import { test, expect } from '@playwright/test';

// A wizard param edit WHILE the sim animation is running should refresh the animation onto the new path — restart
// the moving tool immediately, not finish the stale pass first. Driven by createPreviewPanel.scheduleLiveRestart.
test.use({ viewport: { width: 1280, height: 900 } });

test('the running sim animation refreshes when a wizard param changes mid-run', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 140, y: 120, z: 20, show: true, datum: 'nnp' }); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('d_pattern', 'grid'); set('d_cols', 2); set('d_rows', 2); set('d_dx', 20); set('d_dy', 20);
    window.ddcsStudio.wizardManager.update();
  });

  /**
   * ── t1385 — THE RE-PATH IS DETECTED BY WHICH PROGRAM IS LOADED, NOT BY ITS LENGTH ────────────────────────────────
   *
   * This test proved "the sim re-pathed" by watching `engine.program.length` GROW: more holes used to mean more emitted
   * lines, because the pattern was unrolled at build time. THE SWITCH walks the pattern at runtime, so the body is a
   * FIXED length whatever the hole count — a 2x2 grid and a 6x4 grid both emit 36 lines and only the loop BOUND differs
   * (`WHILE [#89 < 4]` → `WHILE [#89 < 24]`). So the old signal is gone by design, and 36 > 36 is false.
   *
   * Length was only ever a PROXY for "a different program is loaded". The bound is the actual quantity that changed, so
   * the assert reads it directly — which is strictly sharper: a re-path that loaded some OTHER 36-line program would have
   * satisfied the old growth check and fails this one.
   */
  const eng = () => page.evaluate(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    if (!p || !p.engine) return null;
    const text = (p.engine.program || []).map((s) => s.raw || '').join('\n');
    const m = text.match(/WHILE \[#\d+ < (\d+)\] DO1/);
    return { running: p.engine.running, len: p.engine.program.length, holes: m ? Number(m[1]) : null };
  });

  /**
   * THE LIVE-RESTART RACE, closed at the source: "mid-run" used to be assembled across round-trips — ensure playing,
   * poll, snapshot, then a separate evaluate for the edit — so under load the auto-play run (already seconds old)
   * could FINISH inside that gap or inside the restart's own 180ms debounce, and scheduleLiveRestart (which only
   * re-plays a RUNNING engine) rightly did nothing. Play + snapshot + edit now happen in ONE synchronous task:
   * the run button's handler runs play() inline (engine.running is true on return), the engine only advances on
   * timers — which cannot fire inside this task — so the edit provably lands mid-run with the whole 2x2 program
   * (many seconds) ahead of the debounce window.
   */
  const r = await page.evaluate(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    const b = p && p.el && p.el.querySelector('.pp-run');
    const running = () => !!(p && p.engine && p.engine.running);
    if (running()) b.click();          // stop the (auto-played, partially spent) run — reset to the top
    if (!running()) b.click();         // start a FRESH run: the whole 2x2 program now lies ahead
    if (!running()) return { started: false };
    const text = (p.engine.program || []).map((s) => s.raw || '').join('\n');
    const m = text.match(/WHILE \[#\d+ < (\d+)\] DO1/);
    const start = { running: p.engine.running, len: p.engine.program.length, holes: m ? Number(m[1]) : null };
    // SAME TASK as the running check — change the grid to many more holes WHILE running. The live-restart must
    // re-run the engine on the NEW program (without the fix it keeps the old 2x2 program until the pass finishes + loops).
    document.getElementById('d_cols').value = '6';
    document.getElementById('d_rows').value = '4';
    window.ddcsStudio.wizardManager.update();
    return { started: true, start };
  });
  expect(r.started, 'a fresh run is underway in the very task the edit lands in (the mid-run premise)').toBe(true);
  const start = r.start;
  expect(start.running, 'the animation is playing when the edit lands').toBe(true);
  expect(start.len, 'a program is running').toBeGreaterThan(0);
  expect(start.holes, 'and it is the 2x2 grid — 4 holes, read from the loop bound the engine actually loaded').toBe(4);

  await expect.poll(async () => (await eng())?.holes, { timeout: 5000 }).toBe(24);
  const after = await eng();
  expect(after.running, 'still animating after the refresh, not stopped').toBe(true);
  // AND THE FOLD IS WHY THE OLD CHECK COULD NOT WORK — asserted, so the next reader does not "fix" this back to a
  // length comparison: six times the holes, the SAME program length.
  expect(after.len, 'the parametric body is a fixed length — 6x the holes, same line count').toBe(start.len);
});
