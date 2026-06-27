import { test, expect } from '@playwright/test';

/**
 * #13 — a ticked knob (and the live form it drives) must SURVIVE a reprojection. The exposure lives in the
 * EXPOSE_/PNAME_/WIDGET_ dev fields, which aren't in fieldsOf(def) → the workspace↔model round-trip rebuilt the block
 * without them → the knob reset and FORM [LIVE] went empty. This is what made #12 "correct in isolation but broken
 * end-to-end" (the #12 test never reprojected between expose and assert). Fix: mirror the exposure into block.data
 * (`_expose`, routed OUT of params by stackBridge) — save on edit, restore in augment.
 *
 * The test drives the REAL Blocks tab: tick a knob → leave the tab and come back (a true reproject) → assert the knob,
 * its name/widget, AND the derived form all survive.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a ticked knob + its name/widget survive a reprojection (FORM [LIVE] persists)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);

  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } },
  ]));
  await page.evaluate(() => { window.showApp('editor'); window.showApp('blocks'); });
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  await page.waitForTimeout(500);

  // tick a NUMERIC knob (one with a WIDGET_ sibling, so the widget round-trip is exercised too) + name it.
  const before = await page.evaluate(async () => {
    const ws = window.__blkws;
    const mv = ws.getAllBlocks().find((b) => b.type === 'move');
    let vk = null;
    for (const input of mv.inputList) for (const f of input.fieldRow) {
      const n = f.name || '';
      if (n.indexOf('EXPOSE_') === 0 && mv.getField('WIDGET_' + n.slice(7))) { vk = n.slice(7); break; }
    }
    if (!vk) return { err: 'no numeric exposable field' };
    mv.setFieldValue('TRUE', 'EXPOSE_' + vk);
    mv.setFieldValue('myknob', 'PNAME_' + vk);
    mv.setFieldValue('slider', 'WIDGET_' + vk);
    await new Promise((r) => setTimeout(r, 150));
    const dm = await import('/blocks/devMode.js');
    const def = dm.deriveAuthoredDef(ws);
    return { vk, expose: mv.getFieldValue('EXPOSE_' + vk), pname: mv.getFieldValue('PNAME_' + vk), widget: mv.getFieldValue('WIDGET_' + vk), bindings: def ? def.bindings.map((b) => ({ p: b.param, w: b.widget })) : [], data: mv.data };
  });
  expect(before.err, 'found a numeric exposable knob').toBeUndefined();
  expect(before.expose).toBe('TRUE');
  expect(before.bindings.find((b) => b.p === 'myknob'), 'the knob is in the live form before reproject').toBeTruthy();

  // REPROJECT — leave Blocks, come back (workspaceToStack → model → stackToWorkspace; augment re-runs on the rebuild).
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(500);

  const after = await page.evaluate(async () => {
    const ws = window.__blkws;
    const mv = ws.getAllBlocks().find((b) => b.type === 'move');
    let vk = null, expose = null, pname = null, widget = null;
    for (const input of mv.inputList) for (const f of input.fieldRow) {
      const n = f.name || '';
      if (n.indexOf('EXPOSE_') === 0 && mv.getField('WIDGET_' + n.slice(7))) { vk = n.slice(7); expose = mv.getFieldValue(n); pname = mv.getFieldValue('PNAME_' + vk); widget = mv.getFieldValue('WIDGET_' + vk); break; }
    }
    const dm = await import('/blocks/devMode.js');
    const def = dm.deriveAuthoredDef(ws);
    return { vk, expose, pname, widget, bindings: def ? def.bindings.map((b) => ({ p: b.param, w: b.widget })) : [] };
  });

  expect(after.expose, 'the knob stayed TICKED through the reprojection').toBe('TRUE');
  expect(after.pname, 'the knob NAME survived').toBe('myknob');
  expect(after.widget, 'the knob WIDGET survived').toBe('slider');
  const stillThere = after.bindings.find((b) => b.p === 'myknob');
  expect(stillThere, 'the derived FORM [LIVE] still has the knob after reproject').toBeTruthy();
  expect(stillThere.w, 'the form widget survived too').toBe('slider');
});
