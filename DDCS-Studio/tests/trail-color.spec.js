import { test, expect } from '@playwright/test';

// The bold "executed" trail used to be a single amber colour — even over probe moves. It now carries per-vertex
// colours matching the route move-type (probe blue, rapid yellow, retract green, cut cyan, jog orange).
test.use({ viewport: { width: 1280, height: 900 } });

test('executed trail is coloured per move-type (probe segment is blue, not amber)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('edge'));   // a pure probe op
  await page.waitForSelector('#wiz_edge', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._trailLine && p.viz._trailLine.geometry.getAttribute('color');
  });
  const r = await page.evaluate(() => {
    const col = window.ddcsStudio.wizardManager._activePanel.viz._trailLine.geometry.getAttribute('color');
    let blueDom = false;
    for (let i = 0; i < col.count; i++) {
      const rr = col.getX(i), gg = col.getY(i), bb = col.getZ(i);
      if (bb > rr + 0.2 && bb > gg) blueDom = true;   // a probe (blue) vertex — amber would never satisfy this
    }
    return { count: col.count, blueDom };
  });
  expect(r.count, 'trail has per-vertex colours').toBeGreaterThan(0);
  expect(r.blueDom, 'a probe segment in the trail is blue (not amber)').toBeTruthy();
});
