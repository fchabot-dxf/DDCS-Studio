import { test, expect } from '@playwright/test';

// ⟳ Align is now a GUI: the modal draws the toolpath in the same 2D layout canvas (FeatureCanvas) with a
// draggable pivot + rotation handle and a live blue "rotated result" outline. Typing an angle must update the
// preview and "Rotate editor program" must rewrite the editor (90° about the datum sends X20 Y0 → X0 Y20).
test.use({ viewport: { width: 1280, height: 900 } });

test('Align modal renders the path in a 2D canvas; angle + Apply rotate the program', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  // A simple square so the rotation is easy to read.
  await page.evaluate(() => window.ddcsStudio.editorManager.setValue(
    'G90\nG0 X0 Y0\nG1 X20 Y0 F100\nG1 X20 Y10\nG1 X0 Y10\nG1 X0 Y0'));

  await page.evaluate(() => window.ddcsAlignRotate());

  // The canvas draws the actual path shape: original (ghost) + rotated (blue) outlines + the pivot/handle.
  const canvas = page.locator('[data-canvas] svg.feature-canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.locator('[data-canvas] .fc-path-ghost').count()).toBeGreaterThan(0);
  await expect.poll(() => page.locator('[data-canvas] .fc-path').count()).toBeGreaterThan(0);
  // pivot (move square) + rotation handle (circle)
  await expect.poll(() => page.locator('[data-canvas] .fc-handle, [data-canvas] .fc-handle-move').count()).toBeGreaterThanOrEqual(2);

  // Type an exact angle → the handle label reflects it (drag is the primary control; the field is the fine-tune).
  await page.fill('input[data-ang]', '90');
  await page.dispatchEvent('input[data-ang]', 'input');
  await expect(page.locator('[data-canvas] .fc-handle-label', { hasText: '°' })).toContainText('90');

  // Apply → editor rewritten: 90° CCW about (0,0) turns X20 Y0 into X0 Y20.
  await page.click('[data-rgo]');
  const out = await page.evaluate(() => ({
    text: document.getElementById('editor').value,
    status: document.querySelector('[data-rout]')?.textContent || '',
  }));
  expect(out.status).toContain('Rotated');
  expect(out.text).toContain('Y20');
});
