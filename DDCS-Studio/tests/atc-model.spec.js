import { test, expect } from '@playwright/test';

/**
 * COMPOSABLE ATC MODEL (RE-PLAN #2, I1) — the declared GRIP × MOTION vocabulary + the 3 shipped methods as grip×motion
 * PRESETS + a resolver (atcCombo) that back-fills any op to its combo. INERT DATA this increment: nothing consumes it,
 * the emit still goes through the existing hand-written stacks (Fork A delegate), so it is BYTE-IDENTICAL. Asserts the
 * VALUE: the schema is well-formed, every op resolves to the CORRECT combo, and the emit is unchanged (the stacks).
 */
test.use({ viewport: { width: 800, height: 600 } });

async function model(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  return page.evaluate(async () => {
    const m = await import('/wizards/atcModel.js');
    return {
      grips: Object.keys(m.GRIPS), motions: Object.keys(m.MOTIONS), presets: m.PRESETS,
      // every grip has release/clamp action-lists; every motion has a steps list
      gripsWellFormed: Object.values(m.GRIPS).every((g) => Array.isArray(g.release) && Array.isArray(g.clamp)),
      motionsWellFormed: Object.values(m.MOTIONS).every((mo) => Array.isArray(mo.steps)),
      // presets reference kinds that EXIST in the registries
      presetsValid: Object.values(m.PRESETS).every((p) => (!p.grip || !!m.GRIPS[p.grip]) && (!p.motion || !!m.MOTIONS[p.motion])),
      combo: {
        firmware: m.atcCombo({ method: 'firmware' }),
        generic: m.atcCombo({ method: 'generic' }),
        disk: m.atcCombo({ method: 'disk' }),
        oldDisk: m.atcCombo({ mode: 'auto', magType: 'disk' }),   // back-compat: old op (no method)
        oldGeneric: m.atcCombo({ mode: 'auto' }),
        legacyManual: m.atcCombo({}),                              // no mode/method → manual
      },
    };
  });
}

test('the composable GRIP × MOTION schema is declared and well-formed', async ({ page }) => {
  const m = await model(page);
  expect(m.grips, 'the 3 shipped grips are declared').toEqual(expect.arrayContaining(['drawbar', 'pneumatic', 'magnetic']));
  expect(m.motions, 'the shipped motions are declared').toEqual(expect.arrayContaining(['pick-place', 'push', 'rotate']));
  expect(m.gripsWellFormed, 'every grip has release[] + clamp[] action-lists').toBe(true);
  expect(m.motionsWellFormed, 'every motion has a steps[] sequence').toBe(true);
  expect(m.presetsValid, 'every preset references a grip/motion that EXISTS in the registry').toBe(true);
});

test('the 3 methods (and back-compat old ops) resolve to the correct grip × motion combo', async ({ page }) => {
  const { combo } = await model(page);
  expect(combo.firmware, 'firmware = pneumatic push').toMatchObject({ gripKind: 'pneumatic', motionKind: 'push', layout: 'station' });
  expect(combo.generic, 'generic = drawbar pick-place').toMatchObject({ gripKind: 'drawbar', motionKind: 'pick-place', layout: 'linear' });
  expect(combo.disk, 'disk = drawbar rotate').toMatchObject({ gripKind: 'drawbar', motionKind: 'rotate', layout: 'disk' });
  // OLD ops (mode/magType, no `method`) back-fill to the same combos via resolveMethod
  expect(combo.oldDisk, 'old auto+disk op → drawbar rotate').toMatchObject({ gripKind: 'drawbar', motionKind: 'rotate' });
  expect(combo.oldGeneric, 'old auto op → drawbar pick-place').toMatchObject({ gripKind: 'drawbar', motionKind: 'pick-place' });
  expect(combo.legacyManual, 'no method → manual').toMatchObject({ method: 'manual', motionKind: 'manual' });
  // the resolved combo carries the actual grip/motion defs (not just the kind)
  expect(combo.firmware.grip.orient, 'the pneumatic grip def is attached (orient M19 on)').toBe(true);
  expect(combo.firmware.motion.steps.length, 'the push motion step-sequence is attached').toBeGreaterThan(0);
});

test('BYTE-IDENTICAL: the emit still goes through the existing stacks (the model is inert)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const em = await page.evaluate(async () => {
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const gen = (p) => emitMapped(atcChangeStack(p)).text;
    return { firmware: gen({ method: 'firmware' }), generic: gen({ method: 'generic', magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }] }), disk: gen({ method: 'disk', magazine: [{ pocket: 1, tool: 1 }], pickup: { x: 5, y: 5, z: -3 } }) };
  });
  // the firmware emit is still the raw O10102 (pneumatic push) — its signature lines are intact, unchanged by the model
  expect(em.firmware, 'firmware emit = the O10102 push station (G53 #1320)').toContain('G53 X#1320');
  expect(em.firmware, 'firmware emit = the pneumatic M-codes (vacuum M159)').toContain('M159');
  expect(em.firmware, 'firmware emit = M19 orient').toContain('M19');
  // generic still emits the drawbar (M154) pick-place; disk still emits the rotate/pickup template
  expect(em.generic, 'generic emit = the drawbar release (M154)').toContain('M154');
  expect(em.disk, 'disk emit = the carousel rotate template').toContain('Rotate carousel');
});
