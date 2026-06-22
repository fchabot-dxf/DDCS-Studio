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

test('slot: OPT-IN placement — stays at A↔B by default, attaches to a stock corner when picked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await setStock(page);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('slot'));
  await page.waitForSelector('#wiz_slot', { state: 'visible' });

  const code = (attach) => page.evaluate((a) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('sl_ax', 0); set('sl_ay', 0); set('sl_bx', 60); set('sl_by', 0); set('sl_width', 6); set('sl_toolDia', 6); set('sl_stockAttach', a);
    window.ddcsStudio.wizardManager.update();
    return document.getElementById('wiz_slot_code').textContent;
  }, attach);

  const stay = maxX(await code(''));     // no corner → stays where drawn (A→B ends at X60)
  const far = maxX(await code('pp'));    // attach far corner → slot shifts toward the far stock edge
  expect(stay, 'opt-in default leaves the slot at A↔B').toBeLessThan(70);
  expect(far, 'picking the far corner moves the slot onto it').toBeGreaterThan(stay + 25);

  const types = await page.evaluate(async () => {
    await window.ddcsStudio.wizardManager.insert();
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const op = prog.find((b) => b && b.type === 'op' && b.opType === 'slot');
    return op ? (op.children || []).map((c) => c.type) : [];
  });
  expect(types, 'the slot op wraps in a PlaceOnStock block').toContain('placeonstock');
});

test('text: OPT-IN placement — stays at x/y by default, drops into a stock corner when picked', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await setStock(page);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('text'));
  await page.waitForSelector('#wiz_text', { state: 'visible' });

  const code = (attach) => page.evaluate((a) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = String(v); };
    set('tx_text', 'AB'); set('tx_x', 0); set('tx_y', 0); set('tx_height', 10); set('tx_stockAttach', a);
    window.ddcsStudio.wizardManager.update();
    return document.getElementById('wiz_text_code').textContent;
  }, attach);

  const stay = maxX(await code(''));     // no corner → at x/y (near the origin)
  const far = maxX(await code('pp'));    // attach far corner → label jumps to the far stock edge
  expect(far, 'picking the far corner moves the label onto it').toBeGreaterThan(stay + 25);

  const types = await page.evaluate(async () => {
    await window.ddcsStudio.wizardManager.insert();
    const prog = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    const op = prog.find((b) => b && b.type === 'op' && b.opType === 'text');
    return op ? (op.children || []).map((c) => c.type) : [];
  });
  expect(types, 'the text op wraps in a PlaceOnStock block').toContain('placeonstock');
});
