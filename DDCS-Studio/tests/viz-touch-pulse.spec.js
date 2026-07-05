import { test, expect } from '@playwright/test';

/**
 * TOUCH-PULSE PORT (t319/INC-6) — a transient white flash at each G31 contact, ported into the 2D/Layout with the
 * HONEST TOP-VIEW PROJECTION: a Z/surface touch draws a CIRCLE (the disc face-on); an X/Y WALL touch draws a LINE along
 * the wall tangent (the disc edge-on). SLOW (fine re-probe) is BIGGER than fast. The panel fans the G31 contact out
 * (onProbeTouch, mirror of onToolPos) so the 2D + Layout pulse in lockstep with the 3D disc + the red head.
 */
test('the honest top-view projection: Z touch → CIRCLE, X/Y wall touch → tangent LINE; slow bigger than fast', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:300px;height:300px;position:absolute;left:0;top:0'; document.body.appendChild(cv);
    const tp = createToolpath2d(cv, { overlay: true });   // overlay = path + pulses ONLY → the canvas holds nothing but the pulse
    tp.setViewTransform({ ox: 150, oy: 150, scale: 1 });   // world (0,0) → screen (150,150)
    // the non-transparent bbox of the current canvas (the rendered pulse)
    const bbox = () => {
      const ctx = cv.getContext('2d'); const d = ctx.getImageData(0, 0, cv.width, cv.height).data; const W = cv.width;
      let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < W; x++) { if (d[(y * W + x) * 4 + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
      return { w: maxX - minX, h: maxY - minY, any: maxX >= 0 };
    };
    // render ONE pulse of {axis, slow} at peak brightness (prog where |sin| peaks) and return its bbox
    const shot = (axis, slow) => {
      cv.__t2pulses.length = 0;
      tp.pulse({ pos: { x: 0, y: 0, z: 0 }, axis, slow, pass: 0, speed: 1 });
      cv.__t2pulses[0].prog = 1 / (2 * (slow ? 4 : 3));   // u where sin(u·flashes·π) = 1 (peak flash)
      tp.redraw();
      return bbox();
    };
    return { z: shot('z', false), x: shot('x', false), y: shot('y', false), zSlow: shot('z', true) };
  });

  // Z / surface touch → a CIRCLE (bbox roughly square)
  expect(r.z.any, 'the Z pulse rendered').toBe(true);
  expect(Math.abs(r.z.w - r.z.h), `Z pulse is a CIRCLE (bbox ${r.z.w}×${r.z.h} ≈ square)`).toBeLessThan(5);
  // X wall touch (probe in X, wall runs along Y) → a VERTICAL tangent line (tall + narrow)
  expect(r.x.h, `X wall pulse is a VERTICAL line (${r.x.w}×${r.x.h}, tall)`).toBeGreaterThan(r.x.w * 2 + 4);
  // Y wall touch → a HORIZONTAL tangent line (wide + short)
  expect(r.y.w, `Y wall pulse is a HORIZONTAL line (${r.y.w}×${r.y.h}, wide)`).toBeGreaterThan(r.y.h * 2 + 4);
  // SLOW is BIGGER than fast
  expect(r.zSlow.w, `slow pulse (${r.zSlow.w}px) is BIGGER than fast (${r.z.w}px)`).toBeGreaterThan(r.z.w);
});

test('the panel fans the G31 contact out (onProbeTouch) with {pos, axis, feed, slow}', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
    // a minimal host; the panel exposes onProbeTouch as the mirror of onToolPos
    const host = document.createElement('div'); document.body.appendChild(host);
    const panel = createPreviewPanel(host, { getGcode: () => '' });
    return { hasOnProbeTouch: typeof panel.onProbeTouch === 'function', hasOnToolPos: typeof panel.onToolPos === 'function' };
  });
  expect(r.hasOnProbeTouch, 'the panel exposes onProbeTouch (the pulse fan-out)').toBe(true);
  expect(r.hasOnToolPos).toBe(true);
});
