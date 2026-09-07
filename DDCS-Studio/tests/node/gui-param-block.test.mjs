import { test, expect } from './support/harness.mjs';

/**
 * GUI blocks (A) — the `param` reporter. Plugged into a value socket it declares a knob (name + widget); it emits
 * its default (reduce), and at SAVE time extractParamBlocks turns it into a form binding + cleans the template to
 * a plain number. Locks: registry + dropdown, emit reduces it, and the binding extraction.
 *
 * NODE-TIER SPLIT: the original single browser test also asserted a Class-B render guard (the param pill actually
 * DRAWING in a Blockly socket via window.__blkws/getHeightWidth) — real Blockly/DOM rendering, not reproducible
 * under the node stub (register.mjs's document is structural-only). That portion stays in
 * tests/gui-param-block-drive.spec.js; everything below is the pure registry/emit/extraction logic, unchanged.
 */
test('gui param block: registered, emits + extracts a binding', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  // registry + the widget dropdown
  const reg = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    return { has: !!BLOCKS.param, kind: BLOCKS.param && BLOCKS.param.kind, widget: BLOCKS.param && fieldKind(BLOCKS.param, 'widget') };
  });
  expect(reg.has).toBe(true);
  expect(reg.kind).toBe('reporter');
  expect(reg.widget).toBe('dropdown');

  // emit reduces the param pill to its default number
  const emitted = await page.evaluate(async () => (await import('/blocks/blockEmitter.js')).emitMapped(
    [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: -7 } } } }]).text);
  expect(emitted).toContain('-7');

  // extractParamBlocks → a binding either way; (B/default) KEEPS the pill (round-trips), (A) replaces it with a number
  const ex = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = () => ({ type: 'param', params: { name: 'depth', widget: 'slider', value: -5 } });
    const keep = [{ type: 'move', params: { x: 0, y: 0, z: pill() } }];
    const bKeep = U.extractParamBlocks(keep);                         // default keepPills=true (B)
    const repl = [{ type: 'move', params: { x: 0, y: 0, z: pill() } }];
    const bRepl = U.extractParamBlocks(repl, new Set(), false);       // (A) replace
    return { bKeep, zKeep: keep[0].params.z, zRepl: repl[0].params.z };
  });
  expect(ex.bKeep).toHaveLength(1);
  expect(ex.bKeep[0]).toMatchObject({ param: 'depth', blockIndex: 0, key: 'z', type: 'number', default: -5, widget: 'slider' });
  expect(ex.zKeep, 'B (default): pill KEPT in the template → round-trips').toMatchObject({ type: 'param' });
  expect(ex.zRepl, 'A: pill replaced by its number').toBe(-5);
});
