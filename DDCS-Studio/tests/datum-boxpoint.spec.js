import { test, expect } from '@playwright/test';

// Part-zero datum = a 3D BOX POINT (26 of them: 8 corners + 12 edge mids + 6 face centres). The stock-editor
// shows them on an isometric box; setStock places the chosen point at the origin across X/Y/Z. Legacy XY-only
// codes (fl/fr/bl/br/center, all top-Z) migrate to the 3-char [X][Y][Z] form.
test.use({ viewport: { width: 1280, height: 900 } });

test('datum picker renders 26 box points and selection drives setStock across X/Y/Z', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  // Open a wizard to get a live preview viz, then open the stock editor popover.
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && typeof p.viz.setStock === 'function';
  });

  // --- The viz datum math: place the chosen box point at the origin (pin = origin). ---
  const geom = await page.evaluate(() => {
    const v = window.ddcsStudio.wizardManager._activePanel.viz;
    v.setMachine(null);
    const place = (datum) => {
      v.setStock({ x: 100, y: 80, z: 20, shape: 'boss', show: true, datum, pin: 'origin' });
      const p = v._partGroup.position; return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
    };
    // Box centred on partGroup, spanning ±[x/2,y/2,z/2] = ±[50,40,10]. The datum point must land on (0,0,0):
    return {
      topFrontLeft: place('nnp'),  // X min, Y min, Z top  → box centre at (+50,+40,-10)
      botBackRight: place('ppn'),  // X max, Y max, Z bottom→ box centre at (-50,-40,+10)
      centreTop:    place('ccp'),  // X/Y centre, Z top     → (0,0,-10)
      legacyFl:     place('fl'),   // legacy → 'nnp'
      legacyCenter: place('center'), // legacy → 'ccp'
    };
  });
  expect(geom.topFrontLeft).toEqual({ x: 50, y: 40, z: -10 });
  expect(geom.botBackRight).toEqual({ x: -50, y: -40, z: 10 });
  expect(geom.centreTop).toEqual({ x: 0, y: 0, z: -10 });
  expect(geom.legacyFl).toEqual(geom.topFrontLeft);       // legacy fl migrates to nnp
  expect(geom.legacyCenter).toEqual(geom.centreTop);      // legacy center migrates to ccp

  // --- The popover picker: 26 dots, one selected, clicking another updates the datum + caption + settings. ---
  await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const btn = panel.el.querySelector('.pp-stock');
    if (btn) btn.click();
  });
  await page.waitForSelector('#se_datum_pick circle[data-d]');
  const ui = await page.evaluate(() => {
    const pick = document.getElementById('se_datum_pick');
    const dots = pick.querySelectorAll('circle[data-d]');
    const sel = pick.querySelector('circle.sel');
    return { count: dots.length, selected: sel && sel.getAttribute('data-d'), name: (document.getElementById('se_datum_name') || {}).textContent };
  });
  expect(ui.count, '26 box points').toBe(26);
  expect(ui.selected, 'one point is selected').toBeTruthy();

  // Click the back-right-bottom corner (ppn) → datum + caption + persisted settings update.
  await page.evaluate(() => document.querySelector('#se_datum_pick circle[data-d="ppn"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(60);
  const after = await page.evaluate(() => ({
    selected: document.querySelector('#se_datum_pick circle.sel')?.getAttribute('data-d'),
    name: document.getElementById('se_datum_name').textContent,
    saved: window.ddcsGetSettings().stock.datum,
  }));
  expect(after.selected).toBe('ppn');
  expect(after.saved, 'datum persisted to settings').toBe('ppn');
  expect(after.name.toLowerCase()).toContain('bottom');
  expect(errors, 'no page errors').toEqual([]);
});
