import { test, expect } from '@playwright/test';

// DRAW THE FEATURE in the middle canvas (fixes the 'pocket not drawn' bug — the spec had items:[]). The op TYPE declares the
// default feature shape (pocket cavity / boss block / circle); a user-set stock.shape OVERRIDES it (declare-default +
// autonomy-override). So the canvas shows WHAT'S being probed, not just the stock rectangle.
test.use({ viewport: { width: 1280, height: 900 } });

async function featureOf(page, { type, circular, stockShape }) {
  return page.evaluate(({ type, circular, stockShape }) => {
    const set = (id, v) => { const e = document.getElementById(id); if (!e) return; if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('m_type', type); if (document.getElementById('m_circular')) set('m_circular', !!circular);
    const stk = window.ddcsGetSettings().stock; stk.x = 100; stk.y = 80; stk.z = 20; stk.show = true; stk.shape = stockShape;
    window.ddcsStudio.wizardManager.update();
    const svg = document.querySelector('#middleLayoutCanvas svg');
    const rect = svg.querySelector('rect.fc-feature-pocket, rect.fc-feature-boss');
    const circle = svg.querySelector('circle.fc-feature-pocket, circle.fc-feature-boss');
    const stockRect = svg.querySelector('rect.fc-stock');
    return {
      kind: rect ? 'rect' : (circle ? 'circle' : null),
      cls: rect ? rect.getAttribute('class') : (circle ? circle.getAttribute('class') : null),
      rectW: rect ? +rect.getAttribute('width') : null,
      stockW: stockRect ? +stockRect.getAttribute('width') : null,
    };
  }, { type, circular, stockShape });
}

test('op-type declares the feature shape; a user-set stock.shape overrides it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#middleLayoutCanvas svg'));

  // POCKET (default stock 'boss') → an inner CAVITY rect (blue), inset from the stock — the bug fix
  const pocket = await featureOf(page, { type: 'pocket', circular: false, stockShape: 'boss' });
  expect(pocket.kind, 'pocket → a rect cavity').toBe('rect');
  expect(pocket.cls, 'pocket cavity is blue').toContain('fc-feature-pocket');
  expect(pocket.rectW, 'the cavity is INSET (smaller than the stock)').toBeLessThan(pocket.stockW - 5);

  // BOSS → a boss block (green), the full stock footprint
  const boss = await featureOf(page, { type: 'boss', circular: false, stockShape: 'boss' });
  expect(boss.kind, 'boss → a rect').toBe('rect');
  expect(boss.cls, 'boss is green').toContain('fc-feature-boss');

  // CIRCULAR → a circle
  const circ = await featureOf(page, { type: 'boss', circular: true, stockShape: 'boss' });
  expect(circ.kind, 'circular → a circle').toBe('circle');

  // OVERRIDE: a user-set pocket stock beats the op-type default (here boss)
  const overP = await featureOf(page, { type: 'boss', circular: false, stockShape: 'pocket' });
  expect(overP.kind, 'stock.shape=pocket → a rect cavity (override)').toBe('rect');
  expect(overP.cls, 'override → pocket cavity (blue), not the boss op-type default').toContain('fc-feature-pocket');

  // OVERRIDE: a user-set cylinder stock → a circle (beats the rect op-type default)
  const overC = await featureOf(page, { type: 'boss', circular: false, stockShape: 'cylinder' });
  expect(overC.kind, 'stock.shape=cylinder → a circle (override)').toBe('circle');
});
