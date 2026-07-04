import { test, expect } from '@playwright/test';

/**
 * KNOB-KIT vs AUTHORING METADATA (t161, sibling of the t148 section cleanup). The Blocks-tab "expose as knob" kit
 * (devMode.augment → a `DECL_<FIELD>` row: dim marker + checkbox + name) belongs on VALUE-bearing atom fields, NOT on
 * a block's AUTHORING METADATA: a `section`'s title, the `panel` block's panel-type, the `param_group`'s group name.
 * Those read as "? knob false" noise. devMode.isAtom excludes kind section/structctl/panel/param_group, so the
 * augment loop skips them. This asserts the RESULT: metadata blocks get ZERO DECL_ rows; a real value atom KEEPS its
 * knob (not over-excluded). Authoring-only → no emit impact (byte-parity covered by the corner-parity specs).
 */
test.use({ viewport: { width: 1500, height: 1000 } });

async function openCornerBlocks(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_corner_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(700);   // let devMode.augment run + queued renders flush
}

test('metadata blocks (section/panel/param_group) get NO knob kit; a value atom keeps its knob', async ({ page }) => {
  await openCornerBlocks(page);
  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const ws = window.__blkws;
    const rows = ws.getAllBlocks().map((b) => ({
      type: b.type,
      kind: (BLOCKS[b.type] && BLOCKS[b.type].kind) || null,
      decl: (b.inputList || []).filter((i) => i.name && i.name.indexOf('DECL_') === 0).map((i) => i.name),
    }));
    return rows;
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const byKind = (k) => r.filter((x) => x.kind === k);
  // (a) the panel block exists and carries NO DECL_ knob row on its panel-type field
  const panels = byKind('panel');
  expect(panels.length, 'corner has a panel block').toBeGreaterThan(0);
  panels.forEach((p) => expect(p.decl, 'panel gets no knob kit (panel-type is authoring metadata)').toEqual([]));
  // (b) the param_group block exists and carries NO DECL_ knob row on its group-name field
  const groups = byKind('param_group');
  expect(groups.length, 'corner has a param_group block').toBeGreaterThan(0);
  groups.forEach((g) => expect(g.decl, 'param_group gets no knob kit (group name is authoring metadata)').toEqual([]));
  // (c) t148 regression guard — sections still get no knob kit
  byKind('section').forEach((s) => expect(s.decl, 'section gets no knob kit (title is authoring metadata)').toEqual([]));

  // (d) POSITIVE CONTROL — NOT over-excluded: a real value-bearing atom (NOT a metadata/guard kind, NOT the op) STILL
  //     grows its knob kit. Assert at least one such atom carries a DECL_ row (the expose affordance still works).
  const META = new Set(['section', 'panel', 'param_group', 'structctl', 'user_root']);
  const valueAtomsWithKnob = r.filter((x) => x.type !== 'op' && !String(x.type).endsWith('_op') && !META.has(x.kind) && x.decl.length > 0);
  expect(valueAtomsWithKnob.length, 'a real value atom still gets its knob (not over-excluded)').toBeGreaterThan(0);
});
