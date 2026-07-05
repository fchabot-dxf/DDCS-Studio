import { test, expect } from '@playwright/test';

const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';

/**
 * TOUCH-PULSE SIZE is ONE-SOURCED (t331, human t326) — the pulse RADIUS lives in the ONE TOUCH_PULSE token, PER-RENDERER
 * (px2D canvas-px / px3D world-projected px — the two scales legitimately differ), while colour/alpha/fade stay SHARED. NO
 * rogue base: the 3D _burstRadiusPx reads px3D (was a hardcoded 200), the 2D pulsePx reads px2D. A mutation of the token size
 * MOVES that renderer (the one-source proof). slow (fine re-probe) > fast is preserved in BOTH. Tuning (3D ~half, 2D ~2×) is a
 * human-eyeball target → assert the WIRING (reads-the-token + slow>fast), never a taste value.
 */
test('touch-pulse size is one-sourced: both renderers read TOUCH_PULSE (no rogue base); slow>fast; a token mutation moves each', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.setGcodeView === 'function' && typeof window.ddcsGetSettings === 'function');
  await page.locator('#editor').fill('G54\nG31 Z-15 F600\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });
  await page.waitForFunction(() => { const v = window.__gpPanel && window.__gpPanel.viz; return v && v._burstRadiusPx; }, { timeout: 8000 });

  const r = await page.evaluate(async () => {
    const { pulsePx, TOUCH_PULSE } = await import('/viz/pathStyle.js');
    const v = window.__gpPanel.viz;   // the SAME pathStyle module instance the 3D imports → a mutation here reaches _burstRadiusPx

    // (2D) pulsePx reads px2D; a mutation follows (proves no hardcode)
    const d2 = { fast: pulsePx(false), slow: pulsePx(true), tokFast: TOUCH_PULSE.px2D.fast, tokSlow: TOUCH_PULSE.px2D.slow };
    const savedFast = TOUCH_PULSE.px2D.fast; TOUCH_PULSE.px2D.fast = 123; const mut2 = pulsePx(false); TOUCH_PULSE.px2D.fast = savedFast;

    // (3D) _burstRadiusPx reads px3D at the clamp extremes (F50 → slow endpoint, F3000 → fast endpoint); a mutation follows (proves no rogue 200)
    const d3 = { slow: v._burstRadiusPx(50), fast: v._burstRadiusPx(3000), mid: v._burstRadiusPx(250), tokFast: TOUCH_PULSE.px3D.fast, tokSlow: TOUCH_PULSE.px3D.slow };
    const savedSlow = TOUCH_PULSE.px3D.slow; TOUCH_PULSE.px3D.slow = 999; const mut3 = v._burstRadiusPx(50); TOUCH_PULSE.px3D.slow = savedSlow;

    return { d2, mut2, d3, mut3, shared: { hasColor: 'color' in TOUCH_PULSE, hasAlpha: 'alpha' in TOUCH_PULSE, hasFade: 'fadeMs' in TOUCH_PULSE, noOldFast: !('fastPx' in TOUCH_PULSE) } };
  });

  // colour/alpha/fade stay SHARED (not per-renderer); the old flat fastPx/slowPx are gone
  expect(r.shared, 'the token keeps SHARED colour/alpha/fade + drops the old flat fastPx').toEqual({ hasColor: true, hasAlpha: true, hasFade: true, noOldFast: true });

  // 2D reads the token, slow>fast, a mutation follows
  expect(r.d2.fast, '2D pulsePx(fast) === TOUCH_PULSE.px2D.fast').toBe(r.d2.tokFast);
  expect(r.d2.slow, '2D pulsePx(slow) === TOUCH_PULSE.px2D.slow').toBe(r.d2.tokSlow);
  expect(r.d2.slow, '2D slow > fast (fine re-probe is bigger)').toBeGreaterThan(r.d2.fast);
  expect(r.mut2, '2D pulsePx FOLLOWS a token mutation (reads TOUCH_PULSE, not a hardcode)').toBe(123);

  // 3D reads the token endpoints (NO rogue base), slow>mid>fast, a mutation follows (toBeCloseTo — the lerp carries float ε)
  expect(r.d3.fast, '3D _burstRadiusPx(F3000) === TOUCH_PULSE.px3D.fast (the fast-probe endpoint)').toBeCloseTo(r.d3.tokFast, 6);
  expect(r.d3.slow, '3D _burstRadiusPx(F50) === TOUCH_PULSE.px3D.slow (the slow-reprobe endpoint)').toBeCloseTo(r.d3.tokSlow, 6);
  expect(r.d3.slow, '3D slow > mid').toBeGreaterThan(r.d3.mid);
  expect(r.d3.mid, '3D mid > fast').toBeGreaterThan(r.d3.fast);
  expect(r.mut3, '3D _burstRadiusPx FOLLOWS a token mutation (reads px3D, NO rogue 200)').toBeCloseTo(999, 6);
});
