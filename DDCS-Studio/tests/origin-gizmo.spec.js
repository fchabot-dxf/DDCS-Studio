import { test, expect } from '@playwright/test';

// The WCS work-origin gizmo: a labelled crosshair + dot at part-zero, riding the part frame, kept CONSTANT screen
// size by _scaleMarkers (so it doesn't grow with zoom), and tracking the datum (datum-Z) when it changes.
test.use({ viewport: { width: 1280, height: 900 } });

test('work-origin gizmo: exists at part-zero, constant size on zoom, tracks the datum', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => {
    const p = window.ddcsStudio.wizardManager._activePanel;
    return p && p.viz && p.viz._originGizmo;
  });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    const og = viz._originGizmo;
    // It rides the part frame (so a WCS shift moves it with the part) and carries a "WCS" text label child.
    const onPartFrame = og.parent === viz.partFrame.group;
    const hasLabel = !!viz._originLabel && og.children.includes(viz._originLabel);
    // X/Y are part-zero (it marks the WCS origin); Z tracks the datum exactly like the X axis line.
    const pos = { x: og.position.x, y: og.position.y, z: og.position.z };
    const axisZ = viz._axisLineX.geometry.attributes.position.getZ(0);   // the X axis line's datum Z

    // Constant screen size: the WORLD scale must shrink as we zoom IN (radius down) so the on-screen px stays put.
    viz.radius = 400; viz._applyCamera(); viz.render();
    const sFar = og.scale.x;
    viz.radius = 80; viz._applyCamera(); viz.render();
    const sNear = og.scale.x;

    return { onPartFrame, hasLabel, pos, axisZ, sFar, sNear };
  });

  expect(r.onPartFrame, 'gizmo rides the part frame (tracks the WCS shift)').toBeTruthy();
  expect(r.hasLabel, 'gizmo carries the WCS text label').toBeTruthy();
  expect(Math.abs(r.pos.x), 'X at part-zero').toBeLessThan(1e-6);
  expect(Math.abs(r.pos.y), 'Y at part-zero').toBeLessThan(1e-6);
  expect(r.pos.z, 'Z tracks the datum (same floor as the axis lines)').toBeCloseTo(r.axisZ, 6);
  // Constant on-screen size → world scale shrinks as we zoom IN (camera nearer). A fixed-world-size object would
  // KEEP its scale (ratio 1) and grow on screen; this one shrinks roughly with the 5× distance change.
  expect(r.sNear, 'world scale shrinks when zoomed in (constant px)').toBeLessThan(r.sFar);
  expect(r.sNear / r.sFar, 'scale shrinks substantially with zoom (not fixed-world-size)').toBeLessThan(0.75);

  expect(errors).toEqual([]);
});
