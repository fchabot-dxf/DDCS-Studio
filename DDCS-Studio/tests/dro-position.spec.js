import { test, expect } from '@playwright/test';

/**
 * DRO PLACEMENT — the readout must sit on the LEFT, stacked under the top-left status block, CLEAR of the top-right
 * ViewCube (navCube.js renders it at canvas [width-size-m, m]). Pure CSS. Verify the REAL geometry (bounding rects) at
 * the full size AND a narrow two-pane size, computing the actual ViewCube screen rect and asserting no overlap.
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const HOST = '#viz3d-panel-host';
const RUN = `${HOST} .pp-run`;

async function mount(page, program) {
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  await page.locator('#editor').fill(program);
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
  await page.waitForFunction(() => { const v = window.__gpPanel && window.__gpPanel.viz; return v && v._cubeRect; }, { timeout: 8000 });
}

async function placement(page) {
  return page.evaluate(() => {
    const host = document.querySelector('#viz3d-panel-host');
    const dro = host.querySelector('.pp-dro');
    const status = host.querySelector('.pp-statusbar');
    const canvas = [...host.querySelectorAll('canvas')].find((c) => !c.classList.contains('pp-2d')) || host.querySelector('canvas');
    const v = window.__gpPanel.viz;
    const dr = dro.getBoundingClientRect(), sr = status.getBoundingClientRect(), pr = host.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    const { size, m } = v._cubeRect;   // ViewCube viewport (CSS px), top-right of the canvas
    const cube = { left: cr.left + cr.width - size - m, top: cr.top + m, right: cr.left + cr.width - m, bottom: cr.top + m + size };
    const ov = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return {
      droLeftGap: dr.left - pr.left,
      droRight: dr.right, halfX: pr.left + pr.width * 0.5,
      droTop: dr.top, statusBottom: sr.bottom,
      overlapsCube: ov({ left: dr.left, right: dr.right, top: dr.top, bottom: dr.bottom }, cube),
      droW: dr.width, droH: dr.height,
    };
  });
}

async function assertPlaced(page) {
  const g = await placement(page);
  expect(g.droW, 'DRO is rendered').toBeGreaterThan(10);
  expect(g.droLeftGap, 'DRO hugs the panel left edge').toBeLessThan(20);
  expect(g.droRight, 'DRO stays in the left half (away from the top-right cube)').toBeLessThan(g.halfX);
  expect(g.droTop, 'DRO is stacked below the status pill').toBeGreaterThanOrEqual(g.statusBottom - 1);
  expect(g.overlapsCube, 'DRO must NOT overlap the ViewCube').toBe(false);
}

test('DRO sits below the left status block, clear of the ViewCube (full size)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mount(page, 'G54\nG0 X10 Y10\nM30');
  await assertPlaced(page);
});

test('DRO placement holds at a narrow two-pane size', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 560 });
  await mount(page, 'G54\nG0 X10 Y10\nM30');
  await assertPlaced(page);
});
