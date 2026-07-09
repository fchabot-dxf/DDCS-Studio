import { test, expect } from '@playwright/test';

/**
 * GUI blocks — the `sim` (preview rig) block. Declares a custom wizard's preview intent (rotary / machine /
 * magazine) in the stack — the blocks-native twin of the dev-panel checkboxes. It's metadata: emits no G-code,
 * read at save time → def.sim (the block WINS over the dev-panel, like the panel block). Intent is DECLARED, never
 * inferred from motion. Locks: registry + checkbox fields, emits nothing, simIntentFromStack precedence, and the
 * Class-B render guard (it actually draws).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('gui sim block: registered, checkbox fields, emits nothing, declares def.sim, renders', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const r = await page.evaluate(async () => {
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind } = await import('/blocks/blockly/bridge.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const U = await import('/blocks/userOps.js');

    const emitted = emitMapped([{ type: 'sim', params: { rotary: true } }, { type: 'move', params: { x: 1, y: 2, z: -5 } }]).text;

    // simIntentFromStack: a declaring sim block → the intent; an all-false block → null; no block → undefined
    const declares = U.simIntentFromStack([{ type: 'sim', params: { rotary: true, machine: false, magazine: false } }, { type: 'move', params: {} }]);
    const empty = U.simIntentFromStack([{ type: 'sim', params: { rotary: false, machine: false, magazine: false } }]);
    const none = U.simIntentFromStack([{ type: 'move', params: {} }]);

    return {
      has: !!BLOCKS.sim,
      fields: BLOCKS.sim && BLOCKS.sim.fields,
      rotaryKind: BLOCKS.sim && fieldKind(BLOCKS.sim, 'rotary'),
      emitted, declares, empty, none,
    };
  });

  expect(r.has).toBe(true);
  expect(r.fields).toEqual(['rotary', 'machine', 'magazine']);
  expect(r.rotaryKind, 'boolean fields render as checkboxes').toBe('checkbox');
  expect(r.emitted.toLowerCase(), 'sim block emits no G-code').not.toContain('sim');
  expect(r.emitted.length, 'the move still emitted').toBeGreaterThan(0);
  // precedence helper
  expect(r.declares).toEqual({ showRotaryRig: true, forceMachine: false, showMagazine: false, toolMachineFrame: false });
  expect(r.empty, 'a sim block declaring nothing → null intent').toBeNull();
  expect(r.none, 'no sim block → undefined (caller falls back to the dev-panel checkboxes)').toBeUndefined();

  // Class-B render guard: the sim block actually draws
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'sim', params: { rotary: true } }, { type: 'move', params: { x: 0, y: 0, z: -5 } }]));
  await page.waitForTimeout(300);
  const render = await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'sim'); return { found: !!b, h: b ? b.getHeightWidth().height : 0, rotary: b ? b.getFieldValue('ROTARY') : null }; });
  expect(render.found, 'sim block present').toBe(true);
  expect(render.h, 'sim block rendered (height > 0)').toBeGreaterThan(0);
  expect(render.rotary).toBe('TRUE');
});
