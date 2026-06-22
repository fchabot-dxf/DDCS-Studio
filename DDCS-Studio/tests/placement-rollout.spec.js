import { test, expect } from '@playwright/test';

// Placement rolled out to the other mill wizards: each wraps its op in PlaceOnStock, so the path follows the stock
// datum + a chosen corner, and the op surfaces a PlaceOnStock block. One check per wizard (mirrors the drill suite).
test.use({ viewport: { width: 1280, height: 900 } });

const maxX = (s) => Math.max(...(s.match(/X\s*(-?\d*\.?\d+)/gi) || []).map((t) => parseFloat(t.replace(/X/i, ''))));
const setStock = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 100, y: 80, z: 20, show: true, datum: 'nnp' }); });

test('pocket: attach corner moves the cut onto the stock + a PlaceOnStock block appears', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await setStock(page);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('pocket'));
  await page.waitForSelector('#wiz_pocket', { state: 'visible' });

  const code = (attach) => page.evaluate((a) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('p_shape', 'rect'); set('p_w', 40); set('p_h', 30); set('p_originX', 0); set('p_originY', 0); set('p_toolDia', 6);
    set('p_stockAttach', a);
    window.ddcsStudio.wizardManager.update();
    return document.getElementById('wiz_pocket_code').textContent;
  }, attach);

  const near = maxX(await code('nn'));   // attached at the near (min) corner
  const far = maxX(await code('pp'));    // attached at the far (max) corner → cut shifts toward +X
  expect(far, 'attaching to the far corner pushes the pocket toward the far stock edge').toBeGreaterThan(near + 30);

  const types = await page.evaluate(async () => {
    await window.ddcsStudio.wizardManager.insert();
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const op = prog.find((b) => b && b.type === 'op' && b.opType === 'pocket');
    return op ? (op.children || []).map((c) => c.type) : [];
  });
  expect(types, 'the pocket op wraps its cut in a PlaceOnStock block').toContain('placeonstock');
});

test('surfacing: attach corner moves the pass onto the stock + a PlaceOnStock block appears', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await setStock(page);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });

  const code = (attach) => page.evaluate((a) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('sf_w', 40); set('sf_h', 30); set('sf_originX', 0); set('sf_originY', 0); set('sf_toolDia', 12); set('sf_stockAttach', a);
    window.ddcsStudio.wizardManager.update();
    return document.getElementById('wiz_surfacing_code').textContent;
  }, attach);

  const near = maxX(await code('nn')), far = maxX(await code('pp'));
  expect(far, 'attaching to the far corner pushes the faced area toward the far stock edge').toBeGreaterThan(near + 30);

  const types = await page.evaluate(async () => {
    await window.ddcsStudio.wizardManager.insert();
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const op = prog.find((b) => b && b.type === 'op' && b.opType === 'surfacing');
    return op ? (op.children || []).map((c) => c.type) : [];
  });
  expect(types, 'the surfacing op wraps its pass in a PlaceOnStock block').toContain('placeonstock');
});
