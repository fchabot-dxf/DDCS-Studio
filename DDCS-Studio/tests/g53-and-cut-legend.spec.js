import { test, expect } from '@playwright/test';

// G53 machine-coordinate moves (ATC park / tool-change, bore re-centre) used to be SKIPPED by the engine, so the
// preview drew nothing for them. They now trace as absolute moves. Also: the preview legend lists "Cut" (G1
// feeds), which it never did — so a peck drill's plunges are labelled, not just the rapids.
test.use({ viewport: { width: 1280, height: 900 } });

test('G53 machine moves are traced (not skipped)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const parsed = traceToolpath('G90\nG0 X0 Y0 Z0\nG53 X100 Y50\nG53 Z-10\n', {});
    const segs = parsed.segments || [];
    return { count: segs.length, last: segs[segs.length - 1] || null };
  });
  expect(r.count, 'the two G53 moves produced segments').toBeGreaterThanOrEqual(2);
  expect(r.last.x2, 'G53 X100 reached (absolute machine coords)').toBeCloseTo(100, 0);
  expect(r.last.z2, 'G53 Z-10 reached').toBeCloseTo(-10, 0);
});

test('preview legend lists "Cut" for a program with G1 feeds (peck drill)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    const el = p && p.el && p.el.querySelector('.viz3d-legend');
    return el && el.textContent.length > 0;
  });
  const legend = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.el.querySelector('.viz3d-legend').textContent);
  expect(legend, 'Cut (G1 feed) is in the legend').toContain('Cut');
});
