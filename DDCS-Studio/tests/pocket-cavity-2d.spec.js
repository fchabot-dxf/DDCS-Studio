import { test, expect } from '@playwright/test';

// #15: in the 2D top-view a POCKET stock must READ as a pocket — a frame of material around a recessed CAVITY, mirroring
// the 3D "square donut" (gcodeViz3d builds the pocket as an extruded block with an inner hole inset by max(8, 25% of the
// smaller side)). Before this the 2D drew a plain tinted rect — a pocket was indistinguishable from a solid block.
// Perceptibility = the human's eyes; this guards that the cavity actually renders (recessed) and a boss does not.
test.use({ viewport: { width: 1280, height: 900 } });

test('2D pocket draws a recessed cavity; a boss stays solid', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const sample = (shape) => {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99999';
      document.body.appendChild(cv);
      const t2 = createToolpath2d(cv, {});
      t2.setStock({ x: 120, y: 100, z: 20, shape, show: true, datum: 'nnp', pin: 'origin' });
      t2.setSegments([]); t2.fit();
      const v = cv.__t2view, ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const at = (wx, wy) => { const d = ctx.getImageData(Math.round((v.ox + wx * v.scale) * dpr), Math.round((v.oy - wy * v.scale) * dpr), 1, 1).data; return d[0] + d[1] + d[2]; };
      const out = { center: at(60, 50), frame: at(4, 50) };   // centre (cavity for a pocket) vs near the wall (material)
      cv.remove();
      return out;
    };
    return { pocket: sample('pocket'), boss: sample('box') };
  });
  // a pocket's cavity centre is recessed → darker than the material frame
  expect(r.pocket.center, 'pocket cavity is recessed (darker than the frame)').toBeLessThan(r.pocket.frame);
  // a boss is solid material → the centre matches the frame (no cavity)
  expect(Math.abs(r.boss.center - r.boss.frame), 'a boss has no cavity (uniform tint)').toBeLessThan(30);
});
