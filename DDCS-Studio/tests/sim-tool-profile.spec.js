import { test, expect } from '@playwright/test';

// The moving sim head is a SPINDLE ASSEMBLY: spindle ▸ collet ▸ tool, as separate meshes in one group (used for
// every op). The tool is the ACTUAL revolved profile (toolHalfProfile/Lathe — the magazine's builder); setSimTool
// rebuilds it to the per-op tool; each part can be toggled (setPartVisible).
test.use({ viewport: { width: 1280, height: 900 } });

test('sim head = spindle/collet/tool assembly with real tool profile + per-part visibility', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });

  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._ensureAnimTool();
    const p = viz._animParts;
    const out = {
      isGroup: !!viz._animTool.isGroup,
      toolGeo: p.tool.geometry.type, hasCollet: !!p.collet, hasSpindle: !!p.spindle,
    };
    viz.setPartVisible({ spindle: false, collet: false });   // hide two parts
    out.spindleHidden = p.spindle.visible === false;
    out.colletHidden = p.collet.visible === false;
    out.toolShown = p.tool.visible === true;
    viz.setSimTool({ type: 'probe', dia: 6 });   // rebuild to the 3D touch-probe model
    const g = viz._animParts.tool.geometry; g.computeBoundingBox();
    out.toolGeo2 = g.type;
    out.probeBodyR = g.boundingBox.max.x;        // body disc radius — wide (~18), not a thin endmill (~3)
    out.visPersist = viz._animParts.spindle.visible === false;   // hidden state survives a rebuild
    return out;
  });

  expect(r.isGroup, 'assembly is a group').toBeTruthy();
  expect(r.toolGeo, 'tool = revolved profile').toBe('LatheGeometry');
  expect(r.hasCollet && r.hasSpindle, 'collet + spindle present').toBeTruthy();
  expect(r.spindleHidden && r.colletHidden, 'parts toggle off').toBeTruthy();
  expect(r.toolShown, 'tool stays shown').toBeTruthy();
  expect(r.toolGeo2, 'rebuilt to new tool profile').toBe('LatheGeometry');
  expect(r.probeBodyR, 'probe has a wide body (not a thin endmill)').toBeGreaterThan(10);
  expect(r.visPersist, 'visibility persists across a tool rebuild').toBeTruthy();
});
