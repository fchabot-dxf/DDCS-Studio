import { test, expect } from '@playwright/test';

// Settings → Preview "Default view = 2D" must actually open the preview in 2D: the toggle reads "2D", the 2D
// canvas is visible (not hidden behind a never-built 3D pane), and the toolpath draws. Regression: `mode` was
// set from the setting but setMode() never ran on init, so the canvas stayed hidden + the toggle stuck on "3D".
test.use({ viewport: { width: 1280, height: 900 } });

test('preview honours the 2D default view (toggle + visible canvas + rendered path)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.preview = s.preview || {}; s.preview.defaultView = '2d'; });

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(400);   // let setActive → setGcode → 2D draw run

  const r = await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const root = panel.el;
    const toggle = root.querySelector('.pp-mtoggle');
    const cv2d = root.querySelector('.pp-2d');
    let nonBg = -1, cw = 0, ch = 0;
    try {
      cw = cv2d.width; ch = cv2d.height;
      if (cw && ch) {
        const d = cv2d.getContext('2d').getImageData(0, 0, cw, ch).data;
        nonBg = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i] > 25 || d[i + 1] > 35 || d[i + 2] > 45) nonBg++; }
      }
    } catch (e) { /* canvas not sized */ }
    return {
      toggleText: toggle && toggle.textContent.trim(),
      cv2dShown: cv2d && getComputedStyle(cv2d).display !== 'none',
      vizBuilt: !!panel.viz,
      cw, ch, nonBg,
    };
  });

  expect(r.toggleText, 'toggle reads 2D').toBe('2D');
  expect(r.cv2dShown, '2D canvas visible').toBeTruthy();
  expect(r.vizBuilt, '3D viz NOT eagerly built for a 2D default').toBeFalsy();
  if (r.cw && r.ch) expect(r.nonBg, '2D canvas drew the toolpath (non-background pixels)').toBeGreaterThan(0);
});
