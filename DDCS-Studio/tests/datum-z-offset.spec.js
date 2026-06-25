import { test, expect } from '@playwright/test';

// The stock datum's Z (top/center/bottom) is CODE-affecting now: the ops author depths from the TOP (Z0 = top, cuts
// negative), so a BOTTOM datum offsets the whole path UP by the stock height (Z-5 → Z+15), CENTER by half, TOP by 0.
// This re-references a top-authored program to whichever datum you actually touch off. Verified via placementShift
// (pure) + the emitted program through the PlaceOnStock atom. Default datum is top → +0, so existing programs are
// unchanged.
test.use({ viewport: { width: 1280, height: 900 } });

test('datum Z offsets the placement by the stock height (top=0, center=half, bottom=full)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const m = await import('/wizards/ops/placement.js');
    const bbox = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const base = { stockZ: 20, stockW: 100, stockH: 80 };
    const z = (datum, extra) => m.placementShift(bbox, { stockDatum: datum, ...base, ...(extra || {}) }).z;
    return {
      top: z('nnp'), center: z('nnc'), bottom: z('nnn'),
      botWithOff: z('nnn', { offZ: 3 }),                                  // datum offset + manual offZ stack
      topOptIn: m.placementShift(bbox, { stockDatum: 'nnp', ...base, optIn: true }).z,
      botOptIn: m.placementShift(bbox, { stockDatum: 'nnn', ...base, optIn: true }).z,
      botNoHeight: m.placementShift(bbox, { stockDatum: 'nnn', stockW: 100, stockH: 80 }).z,   // no stockZ → no offset
    };
  });
  expect(r.top, 'top datum: no Z offset').toBe(0);
  expect(r.center, 'center datum: +half height').toBe(10);
  expect(r.bottom, 'bottom datum: +full height').toBe(20);
  expect(r.botWithOff, 'datum offset + manual offZ stack').toBe(23);
  expect(r.topOptIn, 'opt-in (slot/text) top: 0').toBe(0);
  expect(r.botOptIn, 'opt-in still re-references the datum Z').toBe(20);
  expect(r.botNoHeight, 'no stock height → no datum offset (safe)').toBe(0);
});

test('a bottom-datum program emits the cut offset up by the stock height', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const bm = await import('/blocks/blockEmitter.js');
    const pf = await import('/blocks/programFraming.js');
    const mk = (datum) => {
      const mv = bm.newBlock('move');
      mv.params = { ...mv.params, mode: 'cut', x: 0, y: 0, z: -5, feed: 100 };   // cut 5 below Z0
      return bm.emitProgram([pf.makePlace({ stockDatum: datum, stockZ: 20, stockW: 100, stockH: 80 }, { minX: 0, maxX: 0, minY: 0, maxY: 0 }, [mv])]);
    };
    return { top: mk('nnp'), bottom: mk('nnn') };
  });
  expect(r.top, 'top datum: cut stays at Z-5 (referenced from the top)').toContain('Z-5');
  expect(r.bottom, 'bottom datum: cut re-referenced to Z+15 (5 below the top of a 20mm blank)').toContain('Z15');
  expect(r.bottom, 'bottom datum no longer plunges below the stock').not.toContain('Z-5');
});
