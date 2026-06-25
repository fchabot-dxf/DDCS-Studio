import { test, expect } from '@playwright/test';

/**
 * The REGION EDITOR (ui/regionEditor.js) — "make your own datum" authoring on the shared drawing core (shapeStage)
 * + region semantics (value + label). Produces a region-pick spec consumed by the shipped form widget + block field.
 * v1: rect regions (rotated rects bake to polygons on save). Locks: authoring a region → a spec, and loading a spec
 * (rect + poly) → save round-trips it.
 */
test.use({ viewport: { width: 1200, height: 900 } });

test('region editor: add a region, set value + label, save → a region-pick spec', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const spec = await page.evaluate(async () => {
    const { openRegionEditor } = await import('/ui/regionEditor.js');
    return await new Promise((resolve) => {
      openRegionEditor(null, (s) => resolve(s));
      const m = document.getElementById('re-modal');
      m.querySelector('[data-add="rect"]').click();                       // draw a region
      const set = (id, v) => { const el = m.querySelector(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('#re_val', '500'); set('#re_lbl', 'Med');
      m.querySelector('[data-re="save"]').click();
    });
  });

  expect(spec.viewBox).toBe('0 0 360 180');
  expect(spec.regions).toHaveLength(1);
  expect(spec.regions[0]).toMatchObject({ shape: 'rect', value: 500, label: 'Med' });
  expect(typeof spec.regions[0].value).toBe('number');
});

test('region editor: loads an existing spec (rect + poly) and round-trips it on save', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const out = await page.evaluate(async () => {
    const { openRegionEditor } = await import('/ui/regionEditor.js');
    const inSpec = { viewBox: '0 0 360 180', regions: [
      { shape: 'rect', x: 10, y: 10, w: 80, h: 50, value: 100, label: 'A' },
      { shape: 'poly', points: '200,20 300,20 250,90', value: 300, label: 'B' },
    ] };
    return await new Promise((resolve) => {
      openRegionEditor({ spec: inSpec }, (s) => resolve(s));
      document.getElementById('re-modal').querySelector('[data-re="save"]').click();
    });
  });

  expect(out.regions).toHaveLength(2);
  expect(out.regions[0]).toMatchObject({ shape: 'rect', x: 10, y: 10, w: 80, h: 50, value: 100, label: 'A' });
  expect(out.regions[1]).toMatchObject({ shape: 'poly', value: 300, label: 'B' });
  expect(out.regions[1].points, 'poly points survive the layer↔region bake').toBe('200,20 300,20 250,90');
});
