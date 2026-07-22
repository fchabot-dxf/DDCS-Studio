// t1017/t1019 — the wizard VISUALIZATION panes go SIDE-BY-SIDE (row) on wide, STACKED (column) on narrow.
//  · wide (>=1024): 3D | 2D side-by-side, a VERTICAL splitter that resizes on the X axis, and NO collapse chevrons
//    (ruling A: the splitter IS the resize on a side-by-side; full-collapse is a stacked idiom).
//  · narrow (<=860): the single stacked column, chevrons present, unbroken.
// Pure layout — the emit is byte-identical (no op/param touched).
import { test, expect } from '@playwright/test';

async function open(page, op = 'user_pocket_data') {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); m.setPaneRatio(0.5); });
  await page.evaluate((o) => window.openWiz(o), op);
  await page.waitForSelector('.wiz-visual .viz-split [data-viz-pane="layout2d"] .feature-canvas', { state: 'visible' });
  await page.waitForTimeout(400);
}
const visSplit = () => [...document.querySelectorAll('.wiz-visual .viz-split')].find((e) => e.offsetParent !== null);

test('WIDE (>=1024): 3D | 2D side-by-side, vertical splitter resizes on X, NO chevrons, 2D renders', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await open(page);
  const r = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.wiz-visual .viz-split')].find((e) => e.offsetParent !== null);
    const a = s.querySelector(':scope > [data-viz-pane="preview3d"]').getBoundingClientRect();
    const b = s.querySelector(':scope > [data-viz-pane="layout2d"]').getBoundingClientRect();
    const bars = [...s.querySelectorAll(':scope > [data-viz-pane] > .wiz-pane-bar')];
    const sp = s.querySelector(':scope > .viz-pane-splitter');
    return {
      dir: getComputedStyle(s).flexDirection,
      sideBySide: Math.abs(a.top - b.top) < 30 && Math.abs(a.left - b.left) > 100,
      barsHidden: bars.length > 0 && bars.every((x) => getComputedStyle(x).display === 'none'),
      splitOn: s.dataset.splitOn, cursor: sp ? getComputedStyle(sp).cursor : null,
      has2d: !!s.querySelector('[data-viz-pane="layout2d"] .feature-canvas'),
    };
  });
  expect(r.dir).toBe('row');
  expect(r.sideBySide, '3D and 2D share a top and sit at different lefts (side-by-side)').toBe(true);
  expect(r.barsHidden, 'the collapse chevrons are hidden on wide (splitter is the resize)').toBe(true);
  expect(r.has2d, 'the 2D layout renders').toBe(true);

  if (r.splitOn === '1') {
    expect(r.cursor, 'the splitter is a vertical col-resize').toBe('col-resize');
    const drag = await page.evaluate(async () => {
      const s = [...document.querySelectorAll('.wiz-visual .viz-split')].find((e) => e.offsetParent !== null);
      const sp = s.querySelector(':scope > .viz-pane-splitter');
      const a = s.querySelector(':scope > [data-viz-pane="preview3d"]');
      const w0 = a.getBoundingClientRect().width;
      const bb = sp.getBoundingClientRect(), cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
      sp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: cx, clientY: cy }));
      sp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: cx - 140, clientY: cy }));
      sp.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: cx - 140, clientY: cy }));
      await new Promise((res) => setTimeout(res, 150));
      return { w0: Math.round(w0), w1: Math.round(a.getBoundingClientRect().width) };
    });
    expect(drag.w1, 'dragging the vertical splitter LEFT shrinks the left (3D) pane on the X axis').toBeLessThan(drag.w0 - 40);
  }
});

test('NARROW (<=860): stacked single column WITH chevrons, unbroken, 2D renders', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 950 });
  await open(page);
  const r = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.wiz-visual .viz-split')].find((e) => e.offsetParent !== null);
    const bars = [...s.querySelectorAll(':scope > [data-viz-pane] > .wiz-pane-bar')];
    return { dir: getComputedStyle(s).flexDirection, chevronsShown: bars.some((b) => getComputedStyle(b).display !== 'none'), has2d: !!s.querySelector('[data-viz-pane="layout2d"] .feature-canvas') };
  });
  expect(r.dir).toBe('column');
  expect(r.chevronsShown, 'the collapse chevrons are shown on narrow (the stacked idiom)').toBe(true);
  expect(r.has2d, 'the 2D renders on narrow').toBe(true);
});
