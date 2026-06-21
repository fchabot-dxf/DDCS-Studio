import { test, expect } from '@playwright/test';

// On-vector dimension editing (Centroid-style): the wizard's 2D canvas handles show their VALUE and are
// click-to-edit (type the dimension, not just drag). Generic in FeatureCanvas; prototyped on the drill wizard.
test.use({ viewport: { width: 1280, height: 900 } });

test('drill canvas dimension label shows the value and is click-to-edit', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => {
    const e = document.getElementById('d_pattern'); if (e) { e.value = 'grid'; e.dispatchEvent(new Event('input', { bubbles: true })); }
    window.ddcsStudio.wizardManager.update();
  });

  // the spacing dimension shows its value on the canvas
  const dim = page.locator('#drillLayoutCanvas .fc-handle-label', { hasText: 'dx' });
  await expect(dim).toHaveCount(1);

  // click it → inline editor → type a precise value → the field updates
  await dim.click();
  const inp = page.locator('#drillLayoutCanvas .fc-dim-edit');
  await expect(inp).toHaveCount(1);
  await inp.fill('35');
  await inp.press('Enter');
  await expect(page.locator('#d_dx')).toHaveValue('35');
});
