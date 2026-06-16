import { test, expect } from '@playwright/test';

// #2b: Drill and Bore are two Mill-menu entries for the one hole wizard, MODE-LOCKED — Drill = peck (hole Ø =
// bit), Bore = helical (end mill). The shared METHOD toggle is hidden; the entry sets the method + the title and
// shows only that method's params.
test.use({ viewport: { width: 1280, height: 900 } });

test('Drill and Bore open the hole wizard mode-locked (toggle hidden)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz);

  await page.evaluate(() => window.openWiz('bore'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForTimeout(120);
  const bore = await page.evaluate(() => ({
    method: document.getElementById('d_method').value,
    title: document.getElementById('wizTitle').textContent.trim(),
    toggleHidden: getComputedStyle(document.getElementById('d_method_wrap')).display === 'none',
    boreShown: getComputedStyle(document.getElementById('d_method_bore')).display !== 'none',
    peckHidden: getComputedStyle(document.getElementById('d_method_peck')).display === 'none',
  }));
  expect(bore.method, 'Bore → helical').toBe('helical');
  expect(bore.title, 'title = BORE').toBe('BORE');
  expect(bore.toggleHidden, 'method toggle hidden').toBeTruthy();
  expect(bore.boreShown, 'bore params shown').toBeTruthy();
  expect(bore.peckHidden, 'peck params hidden').toBeTruthy();

  await page.evaluate(() => window.openWiz('drill'));
  await page.waitForTimeout(120);
  const drill = await page.evaluate(() => ({
    method: document.getElementById('d_method').value,
    title: document.getElementById('wizTitle').textContent.trim(),
    peckShown: getComputedStyle(document.getElementById('d_method_peck')).display !== 'none',
    boreHidden: getComputedStyle(document.getElementById('d_method_bore')).display === 'none',
  }));
  expect(drill.method, 'Drill → peck').toBe('peck');
  expect(drill.title, 'title = DRILL').toBe('DRILL');
  expect(drill.peckShown, 'peck params shown').toBeTruthy();
  expect(drill.boreHidden, 'bore params hidden').toBeTruthy();
});
