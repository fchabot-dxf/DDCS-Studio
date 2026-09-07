import { test, expect } from './support/harness.mjs';

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
  expect(m.grips, 'the grips are named by MECHANISM: drawbar/collet, pusher, magnet').toEqual(expect.arrayContaining(['drawbar', 'pusher', 'magnet']));
  expect(m.motions, 'the shipped motions are declared').toEqual(expect.arrayContaining(['pick-place', 'push', 'rotate']));
  expect(m.gripsWellFormed, 'every grip has release[] + clamp[] action-lists').toBe(true);
  expect(m.motionsWellFormed, 'every motion has a steps[] sequence').toBe(true);
  expect(m.presetsValid, 'every preset references a grip/motion that EXISTS in the registry').toBe(true);
});

test('the 3 methods (and back-compat old ops) resolve to the correct grip × motion combo', async ({ page }) => {
  const { combo } = await model(page);
  expect(combo.firmware, 'firmware = pusher push (named by mechanism)').toMatchObject({ gripKind: 'pusher', motionKind: 'push', layout: 'station' });
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

test('INC-B2: the inline fallback (callMacro:false) emits the ONE-SOURCE tncProgram body — firmware unchanged, generic/disk source the user I/O codes', async ({ page }) => {
  // INC-B2 RETIRES the old assumed autoStack/diskAutoStack: the generic/disk INLINE fallback now emits the SAME
  // executable body as ⚙ Generate T.nc (tncProgram, {body:true}), sourcing the drawbar/sensor codes from the user's
  // Settings → ATC I/O (threaded via _atc/_outputs/_inputs). Firmware inline (the O10102 push) is untouched.
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const em = await page.evaluate(async () => {
    // INC-B2b (4b): the inline body reads the changer config + codes LIVE from settings — set them, don't thread params.
    const s = window.ddcsGetSettings();
    s.atc = { magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }] };
    s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }];   // NON-default drawbar codes (prove one-source)
    s.inputs = [];
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const gen = (p) => emitMapped(atcChangeStack({ ...p, callMacro: false })).text;
    return {
      firmware: gen({ method: 'firmware' }),
      generic: gen({ method: 'generic' }),
      disk: gen({ method: 'disk' }),
    };
  });
  // firmware inline = still the raw O10102 (pneumatic push) — untouched by INC-B2
  expect(em.firmware, 'firmware emit = the O10102 push station (G53 #1320)').toContain('G53 X#1320');
  expect(em.firmware, 'firmware emit = the pneumatic M-codes (vacuum M159)').toContain('M159');
  expect(em.firmware, 'firmware emit = M19 orient').toContain('M19');
  // generic/disk inline = the one-source tncProgram body: it sources the USER's drawbar codes (M54/M55), NOT the old
  // hardcoded assumed M154/M155 dance, and uses the T.nc #1504-requested-tool dispatch (drops the old #100 model).
  expect(em.generic, 'generic inline sources the USER drawbar release code (M54)').toContain('M54');
  expect(em.generic, 'generic inline sources the USER drawbar clamp code (M55)').toContain('M55');
  expect(em.generic, 'generic inline is NOT the old assumed M154 dance').not.toContain('M154');
  expect(em.generic, 'generic inline uses the T.nc #1504 requested-tool dispatch').toContain('#1504');
  expect(em.disk, 'disk inline routes through the SAME one-source body (user M54 code)').toContain('M54');
});

test('I2: the choreography descriptor is COMPUTED from the model, IDENTICAL to the old fixed table', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => !!window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcModel.js');
    const vars = { 1306: -10, 1320: 100, 1321: 200, 1323: 150, 1324: 200, 1325: 150, 1326: 250 };
    const fw = atcChoreography({ method: 'firmware' });
    // re-export back-compat: atcViews imports atcChoreography FROM atcChangeWizard — must resolve to the same fn
    const { atcChoreography: viaWizard } = await import('/wizards/atcChangeWizard.js');
    const fwViaWizard = viaWizard({ method: 'firmware' });
    return {
      firmware: { kind: fw.kind, stationVars: fw.stationVars, region: fw.region(vars), device: fw.device, label: fw.label },
      generic: atcChoreography({ method: 'generic' }),
      disk: atcChoreography({ method: 'disk' }),
      m6: atcChoreography({ method: 'm6' }),
      manual: atcChoreography({ method: 'manual' }),
      viaWizard: { kind: fwViaWizard.kind, device: fwViaWizard.device },
    };
  });
  // firmware = the OLD fixed-table push descriptor (kind + stationVars + the region builder's OUTPUT), now grip-device-tagged
  expect(r.firmware.kind, 'firmware kind = push (unchanged)').toBe('push');
  expect(r.firmware.stationVars, 'firmware stationVars = the old #1306/#1320-1326').toEqual([1306, 1320, 1321, 1323, 1324, 1325, 1326]);
  expect(r.firmware.region, 'the region builder produces the SAME station from the vars').toEqual({ z: -10, start: { x: 100, y: 200 }, end: { x: 150, y: 200 }, retreat: { x: 150, y: 250 } });
  expect(r.firmware.label, 'firmware label unchanged').toBe('fixed-station push (O10102)');
  expect(r.firmware.device, 'device sourced from the pneumatic GRIP (additive, unconsumed by the sim)').toBe('pusher');
  // generic/disk = the OLD pick-place descriptors (magazine/carousel), device from the drawbar grip
  expect(r.generic, 'generic = the old magazine pick-place descriptor').toMatchObject({ kind: 'pick-place', variant: 'magazine', label: 'magazine pick & place', device: 'collet' });
  expect(r.disk, 'disk = the old carousel pick-place descriptor').toMatchObject({ kind: 'pick-place', variant: 'carousel', label: 'carousel pick & place', device: 'collet' });
  expect(r.m6, 'm6 = the old macro-call descriptor').toMatchObject({ kind: 'macro-call', label: 'controller M6 (T.nc)' });
  expect(r.manual, 'manual = null (no inline choreography), as before').toBeNull();
  // the re-export path (atcChangeWizard → atcModel) yields the identical descriptor
  expect(r.viaWizard, 'atcChoreography re-exported from atcChangeWizard = the same').toEqual({ kind: 'push', device: 'pusher' });
});
