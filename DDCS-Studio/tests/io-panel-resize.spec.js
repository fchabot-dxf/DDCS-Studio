import { test, expect } from '@playwright/test';

/**
 * io-panel UI polish (P-C.2e, t187): (a) the ATC labels render LEGIBLY (larger/bolder), and (b) the floating I/O panel
 * has a visible corner grip (.io-resize, mirroring .viz3d-resize) that drag-resizes it. UI/CSS only → emit byte-identical.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('(a) the ATC pin label is legible (>= 11px, bold)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel && window.ddcsGetSettings);
  const r = await page.evaluate(() => {
    window.ddcsGetSettings().outputs = [{ id: 'o1', type: 'custom', label: 'Locating pin', pin: 6, onCode: 'M156', offCode: 'M157' }];
    window.ioPanel.show();
    const lbl = document.querySelector('.io-output[data-pin="6"] .io-atc-label');
    const cs = getComputedStyle(lbl);
    return { text: lbl.textContent, fontPx: parseFloat(cs.fontSize), weight: cs.fontWeight };
  });
  expect(r.text, 'the label renders').toBe('Locating pin');
  expect(r.fontPx, 'label font >= 11px (legible)').toBeGreaterThanOrEqual(11);
  expect(Number(r.weight), 'label is bold').toBeGreaterThanOrEqual(600);
});

test('(b) the floating panel has a resize grip that drag-resizes it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ioPanel);
  const r = await page.evaluate(() => {
    window.ioPanel.show();
    const el = document.getElementById('io-panel');
    el.classList.remove('embedded'); el.style.left = '40px'; el.style.top = '40px'; el.style.right = 'auto';
    const grip = el.querySelector('.io-resize');
    const b = el.getBoundingClientRect();
    const g = grip.getBoundingClientRect();
    const ev = (t, x, y) => grip.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', g.x + 8, g.y + 8);
    ev('pointermove', g.x + 8 + 70, g.y + 8 + 50);   // drag out (bigger)
    ev('pointerup', g.x + 8 + 70, g.y + 8 + 50);
    const a = el.getBoundingClientRect();
    return { hasGrip: !!grip, beforeW: Math.round(b.width), afterW: Math.round(a.width), beforeH: Math.round(b.height), afterH: Math.round(a.height) };
  });
  expect(r.hasGrip, 'the resize grip exists').toBe(true);
  expect(r.afterW, 'dragging the grip widened the panel').toBeGreaterThan(r.beforeW);
  expect(r.afterH, 'dragging the grip grew the panel height').toBeGreaterThan(r.beforeH);
});
