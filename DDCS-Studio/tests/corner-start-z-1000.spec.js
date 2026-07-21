// t1000 — the corner probe start-marker drag must NOT move Z. The drag (onStartDrag) pinned np.z into userStarts[p],
// so an X/Y drag shifted the sim start Z (a misleading preview; emit-safe — the markers emit nothing). The start Z must
// stay the X/Y-INDEPENDENT approach-Z (the on-open value). SIM-ONLY (byte-identical emit).
import { test, expect } from '@playwright/test';

const panelStarts = (page) => page.evaluate(() => {
  const c = document.getElementById('userViz3dContainer');
  const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
  const panel = host && host.__panel;
  return panel && typeof panel.getPassStarts === 'function' ? { ok: true } : { ok: false };
});

async function openCorner(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  await page.waitForTimeout(300);
}

test('dragging the corner start X/Y keeps the sim start Z (the on-open approach-Z)', async ({ page }) => {
  await openCorner(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    if (!panel || typeof panel.onStartDrag !== 'function') return { wired: false };
    const s0 = panel.getPassStarts()[0];
    const z0 = s0.z;
    // drag pass-0's start to a new X/Y, feeding a DELIBERATELY WRONG z (999) — the drag must ignore it and keep the approach-Z
    panel.onStartDrag({ x: (+s0.x || 0) + 20, y: (+s0.y || 0) + 15, z: 999 }, 0);
    const after = panel.getPassStarts()[0];
    return { wired: true, z0, zAfter: after.z, xMoved: Math.abs((+after.x || 0) - (+s0.x || 0)) > 1 };
  });
  expect(r.wired, 'the corner preview exposes onStartDrag + getPassStarts').toBe(true);
  expect(r.xMoved, 'the X/Y drag applied (x moved)').toBe(true);
  expect(r.zAfter, 'the start Z stays the on-open approach-Z (X/Y-independent, not the dragged 999)').toBeCloseTo(r.z0, 3);
});
