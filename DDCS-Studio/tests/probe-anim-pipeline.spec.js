import { test, expect } from '@playwright/test';

/**
 * PROBE ANIMATION PIPELINE — a regression guard that the probe-WCS animation actually FIRES and RENDERS during a real
 * Simulate. This exists because the animation once silently did nothing on screen while the unit tests (asserting
 * .visible) stayed green — the gap was that probeAxisTouched / the rAF render loop weren't being exercised.
 *
 * HONEST SCOPE: this asserts the pipeline runs (probeAxisTouched fires per axis with a live _animTool, the glow pulses,
 * the disc grows, the line extends, render() is driven many times). It does NOT — cannot — assert the pixels are
 * visible; 3D on-screen visibility is verified by a human. It guards the "nothing fires" failure mode, not "too faint".
 */
const BASE = process.env.STUDIO_URL || 'http://localhost:3211';
const RUN = '#viz3d-panel-host .pp-run';

test('probe-WCS animation fires + renders during a real probe Simulate (Z→X→Y)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  await page.goto(BASE);
  await page.waitForFunction(() => !!window.ioPanel && typeof window.ddcsGetSettings === 'function' && typeof window.setGcodeView === 'function');
  await page.locator('#editor').fill('G54\nM3 S12000\nG31 Z-15 F3000\nG31 X-25 F3000\nG31 Y-20 F3000\nG0 Z5\nM30');
  await page.evaluate(() => { window.ddcsGetSettings().preview.autoLoop = false; });
  await page.evaluate(() => window.setGcodeView('3d'));
  await page.waitForSelector(RUN, { state: 'attached', timeout: 8000 });

  await page.evaluate(() => {
    const v = window.__gpPanel.viz;
    window.__diag = { probe: [], glowPulse: 0, growDisc: 0, extendLine: 0, render: 0 };
    const wrap = (name, after) => { const o = v[name].bind(v); v[name] = (...a) => { const r = o(...a); after(); return r; }; };
    const op = v.probeAxisTouched.bind(v);
    v.probeAxisTouched = (ax) => { window.__diag.probe.push({ ax, animToolNull: !v._animTool }); return op(ax); };
    wrap('_glowPulse', () => { window.__diag.glowPulse++; });
    wrap('_growDisc', () => { window.__diag.growDisc++; });
    wrap('_extendLine', () => { window.__diag.extendLine++; });
    wrap('render', () => { window.__diag.render++; });
  });

  await page.locator(RUN).click();
  await page.waitForTimeout(7000);   // feed-timed probes + the rAF pulse/grow animations
  const d = await page.evaluate(() => window.__diag);

  // probeAxisTouched fired once per axis, each with a LIVE _animTool (the advisor's first hypothesis: it must not bail)
  expect(d.probe.map((p) => p.ax)).toEqual(['z', 'x', 'y']);
  expect(d.probe.every((p) => p.animToolNull === false), '_animTool is non-null on every probe').toBe(true);
  // the prominent animation fired: a glow pulse on every probe, the disc grew (1st axis), the line extended (2nd axis)
  expect(d.glowPulse, 'glow pulses on every probe').toBe(3);
  expect(d.growDisc, 'disc grows on the 1st axis').toBe(1);
  expect(d.extendLine, 'line extends on the 2nd axis').toBe(1);
  // render() was driven many times (the rAF animations self-render — the "does it reach the screen" hypothesis)
  expect(d.render, 'render() is driven by the animation').toBeGreaterThan(100);
  expect(errors, 'no JS errors during the probe animation').toEqual([]);
});
