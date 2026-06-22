import { test, expect } from '@playwright/test';

// Part-zero datum = a 3D BOX POINT, a 3-char [X][Y][Z] code (n/c/p). The stock-editor picks it in 2D: a TOP-VIEW
// 3×3 grid for XY (the shared cornergrid) + a Top/Center/Bottom HEIGHT selector for Z. setStock places the chosen
// point at the origin across X/Y/Z. Legacy XY-only codes (fl/fr/bl/br/center, all top-Z) migrate to the 3-char form.
test.use({ viewport: { width: 1280, height: 900 } });

test('datum picker (2D XY grid + height selector) drives setStock across X/Y/Z', async ({ page }) => {
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

  // --- The popover picker (2D): a top-view 3×3 XY grid + Top/Center/Bottom height selector. ---
  await page.evaluate(() => {
    const panel = window.ddcsStudio.wizardManager._activePanel;
    const btn = panel.el.querySelector('.pp-stock');
    if (btn) btn.click();
  });
  await page.waitForSelector('#se_datum_pick rect[data-code]');
  const ui = await page.evaluate(() => {
    const pick = document.getElementById('se_datum_pick');
    return {
      cells: pick.querySelectorAll('rect[data-code]').length,
      zbtns: pick.querySelectorAll('button[data-z]').length,
      selCell: pick.querySelector('rect[data-code].on')?.getAttribute('data-code'),
      selZ: pick.querySelector('button[data-z].on')?.getAttribute('data-z'),
    };
  });
  expect(ui.cells, '3×3 XY top-view grid').toBe(9);
  expect(ui.zbtns, 'top / center / bottom height selector').toBe(3);
  expect(ui.selCell, 'an XY cell is selected').toBeTruthy();
  expect(ui.selZ, 'a height is selected').toBeTruthy();

  // Pick back-right (XY 'pp') + Bottom (Z 'n') → datum 'ppn'; caption + persisted settings update.
  await page.evaluate(() => document.querySelector('#se_datum_pick rect[data-code="pp"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.evaluate(() => document.querySelector('#se_datum_pick button[data-z="n"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(60);
  const after = await page.evaluate(() => ({
    selCell: document.querySelector('#se_datum_pick rect[data-code].on')?.getAttribute('data-code'),
    selZ: document.querySelector('#se_datum_pick button[data-z].on')?.getAttribute('data-z'),
    name: document.getElementById('se_datum_name').textContent,
    saved: window.ddcsGetSettings().stock.datum,
  }));
  expect(after.selCell, 'XY back-right cell picked').toBe('pp');
  expect(after.selZ, 'Bottom height picked').toBe('n');
  expect(after.saved, 'datum persisted to settings as [X][Y][Z]').toBe('ppn');
  expect(after.name.toLowerCase()).toContain('bottom');
  expect(after.name.toLowerCase()).toContain('right');
  expect(errors, 'no page errors').toEqual([]);
});
