import { test, expect } from '@playwright/test';

// DRAW THE FEATURE in the middle canvas. The STOCK shape is the ONE source — the 2D canvas reads it, the SAME value the 3D
// reads, so they always match. The op-type PRESELECTS it (a pocket op declares a pocket stock), and the stock panel
// OVERRIDES it (declare-default + autonomy-override). So: pick pocket → a cavity in BOTH; override the stock to boss → both
// show a boss (the bug the human caught — the 2D used to ignore a 'boss' override).
test.use({ viewport: { width: 1280, height: 900 } });

test('the op preselects the stock shape (2D matches 3D); the stock panel overrides it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#middleLayoutCanvas svg'));

  // pick an op-type → it PRESELECTS the stock shape; read the synced stock.shape + the drawn feature
  const pickOp = (type, circular) => page.evaluate(({ type, circular }) => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('m_type', type); if (document.getElementById('m_circular')) set('m_circular', !!circular);
    window.ddcsStudio.wizardManager.update();
    const svg = document.querySelector('#middleLayoutCanvas svg');
    const r = svg.querySelector('rect.fc-feature-pocket, rect.fc-feature-boss');
    const c = svg.querySelector('circle.fc-feature-pocket, circle.fc-feature-boss');
    return { stockShape: window.ddcsGetSettings().stock.shape, kind: r ? 'rect' : (c ? 'circle' : null), cls: (r || c) ? (r || c).getAttribute('class') : null, rectW: r ? +r.getAttribute('width') : null, stockW: (svg.querySelector('rect.fc-stock') || {}).getAttribute ? +svg.querySelector('rect.fc-stock').getAttribute('width') : null };
  }, { type, circular });

  // POCKET op → preselects a pocket stock → an inner CAVITY (blue), inset from the stock
  const p = await pickOp('pocket', false);
  expect(p.stockShape, 'pocket op preselects a pocket stock').toBe('pocket');
  expect(p.kind).toBe('rect');
  expect(p.cls).toContain('fc-feature-pocket');
  expect(p.rectW, 'the cavity is INSET (smaller than the stock)').toBeLessThan(p.stockW - 5);

  // BOSS op → preselects a boss stock → a green block
  const b = await pickOp('boss', false);
  expect(b.stockShape, 'boss op preselects a boss stock').toBe('boss');
  expect(b.kind).toBe('rect');
  expect(b.cls).toContain('fc-feature-boss');

  // CIRCULAR → preselects a cylinder stock → a circle
  const c = await pickOp('boss', true);
  expect(c.stockShape, 'circular preselects a cylinder stock').toBe('cylinder');
  expect(c.kind).toBe('circle');

  // OVERRIDE via the stock panel: change stock.shape WITHOUT changing the op-type → the 2D follows it (not clobbered)
  await pickOp('pocket', false);   // back to a pocket op (stock.shape = pocket)
  const over = await page.evaluate(() => {
    window.ddcsGetSettings().stock.shape = 'boss';                     // the user overrides the shape in the stock panel
    window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // saveSettings broadcasts this → the wizard re-renders
    const svg = document.querySelector('#middleLayoutCanvas svg');
    const r = svg.querySelector('rect.fc-feature-pocket, rect.fc-feature-boss');
    return { stockShape: window.ddcsGetSettings().stock.shape, cls: r ? r.getAttribute('class') : null };
  });
  expect(over.stockShape, 'the override survives (no op-type change → not re-preselected)').toBe('boss');
  expect(over.cls, 'the 2D canvas FOLLOWS the stock override → a boss block').toContain('fc-feature-boss');
});
