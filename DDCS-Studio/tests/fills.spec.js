import { test, expect } from '@playwright/test';

// The heavy fill blocks: Fill Zigzag (arbitrary angle + cut direction) and Fill Concentric (ring order +
// finish pass). Kernels live in clearing.js; the blocks layer under Step Down over a Region socket.
test.use({ viewport: { width: 1000, height: 800 } });

test('zigzag + concentric fill kernels (angle, direction, order, finish)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const r = await page.evaluate(async () => {
    const C = await import('/wizards/clearing.js');
    const rectC = C.rectContour(0, 0, 40, 20);
    const ctx = { z: -2, clr: 5, feed: 600, plunge: 200 };
    const lifts = (s) => s.filter((l) => l.startsWith('G0 Z')).length;
    return {
      zz0: C.zigzagFill(rectC, 4, ctx, { angleDeg: 0 }),
      zz90: C.zigzagFill(rectC, 4, ctx, { angleDeg: 90 }),
      oneway: C.zigzagFill(rectC, 4, ctx, { oneway: true }),
      // angle-0 both-ways must equal the legacy scanline path (no behaviour change at defaults)
      legacy: C.fillLevelMoves(C.scanlineFill(rectC, 4), ctx),
      co: C.concentricFill({ kind: 'rect', x: 0, y: 0, w: 40, h: 20 }, 4, ctx, {}),
      ci: C.concentricFill({ kind: 'rect', x: 0, y: 0, w: 40, h: 20 }, 4, ctx, { order: 'inside-out' }),
      cf: C.concentricFill({ kind: 'rect', x: 0, y: 0, w: 40, h: 20 }, 4, ctx, { finishPass: true }),
      // legacy concentric (outside-in, no finish) — must be byte-identical to the default
      legacyCo: C.concentricRect(0, 0, 40, 20, 4, ctx),
      lifts: { z: lifts, ow: lifts(C.zigzagFill(rectC, 4, ctx, { oneway: true })), bw: lifts(C.zigzagFill(rectC, 4, ctx, {})) },
    };
  });

  // defaults are byte-identical to the legacy kernels → reworking wizards onto these changes nothing
  expect(r.zz0.join('\n')).toBe(r.legacy.join('\n'));
  expect(r.co.join('\n')).toBe(r.legacyCo.join('\n'));

  // angle rotates the scan → different toolpath
  expect(r.zz90.join('\n')).not.toBe(r.zz0.join('\n'));

  // one-way lifts+returns every pass → more retracts than both-ways
  expect(r.lifts.ow).toBeGreaterThan(r.lifts.bw);

  // concentric ring order: outside-in starts at the outer corner, inside-out does not
  expect(r.co[0]).toBe('G0 X0 Y0');
  expect(r.ci[0]).not.toBe('G0 X0 Y0');

  // finish pass appends an extra clean outer ring
  expect(r.cf.length).toBeGreaterThan(r.co.length);
});

test('Fill blocks emit through Step Down > Fill > Region', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const out = await page.evaluate(async () => {
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const make = (fillType) => {
      const sd = newBlock('stepdown'); sd.params.to = 4; sd.params.by = 2;
      const f = newBlock(fillType); f.params.stepover = 5;
      const rg = newBlock('region'); rg.params = { shape: 'rect', x: 0, y: 0, w: 40, h: 20 };
      f.params.region = rg; sd.children = [f];
      return emitMapped([sd]).text;
    };
    return { zig: make('fillzigzag'), con: make('fillconcentric') };
  });

  expect(out.zig).toContain('( Fill Zigzag z=-2 )');   // deterministic header from def.label
  expect(out.zig).toContain('Step Down z=-2');         // two Z levels (depthLevels 2,4)
  expect(out.zig).toContain('z=-4');
  expect(out.zig).toMatch(/G1 X40/);                   // cuts across the 40 mm width
  expect(out.con).toContain('( Fill Concentric z=-2 )');
  expect(out.con).toMatch(/G1 X40 Y0/);                // outer ring of the rect
});
