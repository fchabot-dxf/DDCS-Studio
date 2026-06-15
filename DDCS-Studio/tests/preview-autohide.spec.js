import { test, expect } from '@playwright/test';

// Space-saving preview chrome: the controls + legend + hint auto-hide when idle and reveal on pointer activity
// (hover/tap), and the controls are icon-only (📦 Stock, bare Speed select). Functions stay reachable.
test.use({ viewport: { width: 1280, height: 900 } });

test('preview chrome auto-hides + reveals on pointer activity; icon-only controls', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => [...document.querySelectorAll('.preview-panel')].some((p) => p.querySelector('.viz3d-controls')));

  // icon-only: Stock = 📦, Speed is a bare <select> (no 'Speed' text label wrapper)
  const icons = await page.evaluate(() => {
    const c = [...document.querySelectorAll('.preview-panel')].find((p) => p.querySelector('.viz3d-controls')).querySelector('.viz3d-controls');
    return { stock: c.querySelector('.pp-stock').textContent.trim(), hasSpeed: !!c.querySelector('.pp-speed'), labels: c.querySelectorAll('label').length };
  });
  expect(icons.stock).toBe('📦');
  expect(icons.hasSpeed).toBeTruthy();
  expect(icons.labels, 'no Speed text label wrapper').toBe(0);

  // idle → chrome fades out
  await page.waitForTimeout(2900);
  const hidden = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    const c = p.querySelector('.viz3d-controls');
    return { cls: p.classList.contains('controls-shown'), op: getComputedStyle(c).opacity, pe: getComputedStyle(c).pointerEvents };
  });
  expect(hidden.cls, 'controls-shown removed after idle').toBeFalsy();
  expect(parseFloat(hidden.op), 'controls faded out').toBeLessThan(0.1);
  expect(hidden.pe, 'hidden controls do not catch clicks (canvas orbit works)').toBe('none');

  // pointer activity → reveals (opacity 1, clickable)
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    p.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
  });
  await page.waitForTimeout(300);   // let the 0.18s opacity transition finish
  const shown = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.viz3d-controls'));
    const c = p.querySelector('.viz3d-controls');
    return { cls: p.classList.contains('controls-shown'), op: getComputedStyle(c).opacity, pe: getComputedStyle(c).pointerEvents };
  });
  expect(shown.cls).toBeTruthy();
  expect(parseFloat(shown.op), 'controls revealed').toBeGreaterThan(0.9);
  expect(shown.pe).toBe('auto');
});
