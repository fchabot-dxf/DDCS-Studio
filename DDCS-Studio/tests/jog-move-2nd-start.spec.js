import { test, expect } from '@playwright/test';

// INC2 (re-done, verify-REAL-symptom): the jog pendant must MOVE the SELECTED per-pass start via the REAL gesture
// (click ② in the pendant → press jog → it moves ON SCREEN and STICKS). The first attempt tested the MAIN editor
// (no inferStarts hints) + a programmatic selectStart → green on the wrong path. The REAL bug is in the WIZARD: the
// wizard supplies per-pass HINTS (middleView passes inferStarts as startHints), and on every re-trace the per-pass
// loop's hintFor(p) OVERRODE a jogged ② → it snapped back. Fix = per-pass USER overrides (userStarts) that BEAT the
// hint. This drives the REAL pendant ② button + jog button in the wizard.
test.use({ viewport: { width: 1280, height: 900 } });

test('REAL pendant gesture: select ② → jog moves it on screen + it STICKS (beats the wizard hint)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  // t1730 — 'middle' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_middle_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  // a BOSS probe-both → multi-pass + inferStarts hints (the condition the first test missed). t1730 — old m_* ids
  // retired; the twin's generic form renders every declared param as [data-param="<name>"].
  await page.evaluate(() => {
    const t = document.querySelector('[data-param="featureType"]'); if (t) { t.value = 'boss'; t.dispatchEvent(new Event('change', { bubbles: true })); }
    const b = document.querySelector('[data-param="twoAxis"]'); if (b) { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz && p.viz.starts && p.viz.starts.length >= 2; });

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel, viz = panel.viz;
    const btn2 = viz.jogPendant.querySelectorAll('.jog-start-btns button')[1];   // the REAL ② selector button
    btn2.click();
    const selected = viz.selectedStart;
    const before = { x: viz.starts[1].x, y: viz.starts[1].y };
    const sb = viz.jogPendant.querySelector('.jog-step-cycle'); if (sb) sb.dataset.step = '10';
    viz.jogPendant.querySelector('[data-axis="x"][data-dir="1"]').click();   // REAL jog X+ 10
    const afterJog = { x: viz.starts[1].x, y: viz.starts[1].y };
    panel.refresh();                                                          // a re-trace must NOT snap it back to the hint
    const afterRetrace = { x: viz.starts[1].x, y: viz.starts[1].y };
    panel.setView('2d');
    const m1 = (panel.el.querySelector('.pp-2d').__t2starts || []).find((m) => m.i === 1);
    return { selected, before, afterJog, afterRetrace, twoD: m1 && { x: m1.x, y: m1.y } };
  });

  expect(r.selected, 'clicking the ② button selected pass 1').toBe(1);
  expect(r.afterJog.x, 'the REAL jog moved ② +10 on the selected pass').toBeCloseTo(r.before.x + 10, 1);
  expect(r.afterRetrace, 'the jog STICKS across a re-trace — the wizard hint no longer overrides it').toEqual(r.afterJog);
  expect(r.twoD, 'the 2D ② marker reflects the jogged position').toEqual(r.afterJog);
});
