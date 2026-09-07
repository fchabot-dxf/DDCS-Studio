import { test, expect } from '@playwright/test';

// TRAVEL-START inc1 (EDGE) — DROP the "reach" ARROW (the GUI element), ADD a draggable ① START marker. The unit test for the
// GENERIC probeVector widget (canvasWidgets.js) moved to tests/node/edge-probe-vector.test.mjs (pure, no DOM). This file
// keeps the integration test: the DECOUPLED model — the start marker (the "reach") moves the SIM start; MAX PROBE (#1)
// stays a SEPARATE editable safety field, untouched. Real DOM/drag/mouse — stays in the browser tier.
test.use({ viewport: { width: 1280, height: 900 } });

// ── Integration: TRAVEL-START inc1 — the ① START marker (the "reach") is DECOUPLED from MAX PROBE ────────────────────
test('edge wizard: MAX PROBE is editable; dragging the ① start moves the start (sim) WITHOUT touching MAX PROBE; it persists', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_edge_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) .fc-handle'));

  // MAX PROBE is a NORMAL EDITABLE field (the V10.46 regression to undo: it must NOT be read-only)
  expect(await page.evaluate(() => document.querySelector('[data-param="dist"]').hasAttribute('readonly')), 'MAX PROBE is editable (not read-only)').toBeFalsy();
  await page.fill('[data-param="dist"]', '37');   // fill would THROW on a read-only input → this also proves editability
  await page.evaluate(() => document.querySelector('[data-param="dist"]').dispatchEvent(new Event('input', { bubbles: true })));
  await page.waitForFunction(() => document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) .fc-handle'));
  // t2599 — the tree-mode canvas's own auto-fit/rescale is still transitional for ~1s right after a marker first
  // appears (measured live on alignment_data; the same canvas the edge twin now shares) — reading geometry
  // before it settles targets a stale, still-shrinking layout.
  await page.waitForTimeout(1000);

  // the ① START handle (a 'move' rect: centre = x + w/2) + the world start before the drag
  const before = await page.evaluate(() => {
    const h = document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) .fc-handle');
    const svg = document.querySelector('[id*="userVizContainer"]:has([data-hid], .fc-handle) svg').getBoundingClientRect();
    const cx = h.hasAttribute('cx') ? +h.getAttribute('cx') : +h.getAttribute('x') + 6;
    const cy = h.hasAttribute('cy') ? +h.getAttribute('cy') : +h.getAttribute('y') + 6;
    const s = window.ddcsStudio.wizardManager._activePanel.getPassStarts()[0];
    return { cx, cy, svgL: svg.left, svgT: svg.top, startX: s.x, startY: s.y };
  });

  // drag the ① start
  await page.mouse.move(before.svgL + before.cx, before.svgT + before.cy);
  await page.mouse.down();
  await page.mouse.move(before.svgL + before.cx - 50, before.svgT + before.cy + 25, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await page.evaluate(() => {
    const s = window.ddcsStudio.wizardManager._activePanel.getPassStarts()[0];
    return { startX: s.x, startY: s.y, dist: document.querySelector('[data-param="dist"]').value };
  });
  // the start MOVED (the drag set the start position) …
  expect(Math.abs(after.startX - before.startX) + Math.abs(after.startY - before.startY), 'the start moved on drag').toBeGreaterThan(1);
  // … but MAX PROBE is UNCHANGED — DECOUPLED (the drag must NOT touch it)
  expect(after.dist, 'MAX PROBE is untouched by the start drag (decoupled)').toBe('37');

  // the start PERSISTS: editing MAX PROBE re-renders, but the dragged start STICKS (userStarts beats the inferred hint)
  await page.fill('[data-param="dist"]', '52');
  await page.evaluate(() => document.querySelector('[data-param="dist"]').dispatchEvent(new Event('input', { bubbles: true })));
  await page.waitForTimeout(150);
  const persisted = await page.evaluate(() => window.ddcsStudio.wizardManager._activePanel.getPassStarts()[0]);
  expect(Math.abs(persisted.x - after.startX) + Math.abs(persisted.y - after.startY), 'the dragged start persists across a MAX PROBE edit').toBeLessThan(0.5);
});
