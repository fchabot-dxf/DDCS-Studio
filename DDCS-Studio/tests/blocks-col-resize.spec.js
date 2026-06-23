import { test, expect } from '@playwright/test';

// #3: on desktop, the Blocks preview column has a draggable left-edge handle (like the mobile drawer resize).
// Dragging it left widens the preview (--blk-pv-w on #blocks-app) and persists.
test.use({ viewport: { width: 1280, height: 900 } });

test('Blocks desktop: dragging the column handle resizes (and persists) the preview width', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => {
    const h = document.querySelector('#blocks-app .blk-col-resize');
    return h && getComputedStyle(h).display !== 'none';
  });

  const r = await page.evaluate(() => {
    const root = document.getElementById('blocks-app');
    const handle = root.querySelector('.blk-col-resize');
    const hr = handle.getBoundingClientRect();
    const startX = hr.left + hr.width / 2, y = hr.top + hr.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: y, bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX - 120, clientY: y, bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX - 120, clientY: y, bubbles: true, pointerId: 1 }));
    return {
      w: parseInt(root.style.getPropertyValue('--blk-pv-w'), 10),
      saved: parseInt(localStorage.getItem('ddcs_blk_pv_w'), 10),
    };
  });

  expect(r.w, 'preview column widened (≈380 default + 120 drag)').toBeGreaterThan(420);
  expect(r.saved, 'the new width persisted to localStorage').toBe(r.w);
});
