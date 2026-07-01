import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1400, height: 1000 } });

test('corner data wizard: the shared layout renders handles and drag-writes the start offsets', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
  });

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);

  await page.evaluate(() => {
    window.showApp && window.showApp('studio');
    window.ddcsStudio.wizardManager.open('user_corner_port');
  });

  await page.waitForSelector('#wiz_user', { state: 'visible' });
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'visible' });
  await page.waitForSelector('#userVizContainer2D svg.feature-canvas', { state: 'visible' });

  const before = await page.evaluate(() => ({
    handles: document.querySelectorAll('#userVizContainer2D .fc-handle, #userVizContainer2D .fc-handle-move').length,
    x: document.querySelector('#wiz_user_form [data-param="cross1_x"]').value,
    y: document.querySelector('#wiz_user_form [data-param="cross1_y"]').value,
  }));

  expect(before.handles, 'the shared corner layout renders draggable handles').toBeGreaterThanOrEqual(2);

  const handle = page.locator('#userVizContainer2D .fc-handle-move').nth(1);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => ({
    x: document.querySelector('#wiz_user_form [data-param="cross1_x"]').value,
    y: document.querySelector('#wiz_user_form [data-param="cross1_y"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));

  const moved = after.x !== before.x || after.y !== before.y;
  expect(moved, 'dragging the layout handle rewrote the start-offset fields').toBe(true);
  expect(after.code, 'the corner wizard re-emitted after the drag').not.toBe('');

  await page.evaluate(() => {
    localStorage.removeItem('ddcs_user_ops');
    localStorage.removeItem('ddcs_wizard_layout');
  });
});