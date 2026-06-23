import { test, expect } from '@playwright/test';

// Goal: every ATC preview shows the MACHINE ENVELOPE — tool changes are inherently machine-frame (G53), so the
// envelope must draw even when a given trace doesn't reach a G53 (auto-change with no tool loaded, warmup/drawbar
// with no motion, the parameter-write table). The view calls mgr.previewMachine(viz, true) → panel.setForceMachine
// → viz.setMachine(machineForViz()), so viz.machineBox exists and the route is NOT anchored to the start.
test.use({ viewport: { width: 1280, height: 900 } });

const ATC = [
  { type: 'atc_length', viz: 'atcLengthViz' },
  { type: 'atc_check', viz: 'atcCheckViz' },
  { type: 'atc_warmup', viz: 'atcWarmupViz' },
  { type: 'atc_change', viz: 'atcChangeViz' },
  { type: 'atc_test', viz: 'atcTestViz' },
  { type: 'atc_table', viz: 'atcTableViz' },
];

for (const w of ATC) {
  test(`${w.type}: machine envelope draws in the preview`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // A shown machine envelope (travel + show) + a small magazine so pockets place.
    await page.addInitScript(() => localStorage.setItem('ddcs_studio_settings', JSON.stringify({
      machine: { x: 400, y: 300, z: 120, show: true },
      atc: { magType: 'straight', magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }], tools: [{ num: 1, type: 'endmill', dia: 6, length: 40 }, { num: 2, type: 'ballnose', dia: 6, length: 45 }] },
    })));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), w.type);
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });

    const got = await page.evaluate((vizId) => {
      const cont = document.getElementById(vizId);
      const host = cont && cont.parentElement && cont.parentElement.querySelector('.wiz-viz3d');
      const viz = host && host.__panel && host.__panel.viz;
      return { built: !!viz, machineBox: !!(viz && viz.machineBox), anchor: viz ? viz._anchorToStart : null };
    }, w.viz);

    expect(errors, errors.join('\n')).toEqual([]);
    expect(got.built, `${w.type} 3D viz built`).toBeTruthy();
    expect(got.anchor, `${w.type} pinned to machine frame (not start-anchored)`).toBe(false);
    expect(got.machineBox, `${w.type} envelope drawn`).toBeTruthy();
  });
}
