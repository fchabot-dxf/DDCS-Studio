// t996 — the cutting-op RPM binding. Before: the data-op twin had no rpm binding, so the form/tool rpm never reached
// progstart.params.rpm → spindleHeadPatch always used the machine Head default (the tool RPM was IGNORED). Now: a
// socket-held rpm binding → progstart. Blank → the Head default (byte-identical); a typed value / a picked tool's
// library rpm OVERRIDES it (M3 S<rpm>, and spindleHeadPatch yields to the explicit rpm).
import { test, expect } from '@playwright/test';

test('surfacing twin rpm: blank → Head default; typed → M3 S<rpm> (spindleHeadPatch yields)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const SD = await import('/blocks/dataOps/surfacingData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    window.ddcsGetSettings().spindle = { defaultRpm: 10000, dir: 'cw', spinUp: 0 };   // a known Head so blank≠typed
    registerUserOp(SD.surfacingDataDef());
    const build = builderOf(SD.SURFACING_DATA_OPTYPE);
    const m3 = (t) => { const m = t.match(/M[34] S(\d+)/); return m ? Number(m[1]) : null; };
    const blank = emitMapped(build({ ...SD.SURFACING_DEFAULTS })).text;         // no rpm → Head (spindleHeadPatch)
    const typed = emitMapped(build({ ...SD.SURFACING_DEFAULTS, rpm: 8000 })).text;   // rpm 8000 → override
    return { blankRpm: m3(blank), typedRpm: m3(typed) };
  });
  expect(r.blankRpm, 'blank rpm → the machine Head default (byte-identical, spindleHeadPatch fills)').toBe(10000);
  expect(r.typedRpm, 'typed rpm 8000 → M3 S8000 (the tool/form rpm WINS, spindleHeadPatch yields)').toBe(8000);
});

test('every cutting twin wires rpm → progstart: blank=Head, typed=override (pocket derived + drill/slot static)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    window.ddcsGetSettings().spindle = { defaultRpm: 10000, dir: 'cw', spinUp: 0 };
    const m3 = (t) => { const m = t.match(/M[34] S(\d+)/); return m ? Number(m[1]) : null; };
    const check = async (mod, defsName, optype) => {
      const M = await import(mod); registerUserOp(M[defsName]());
      const b = builderOf(M[optype.d]);
      const D = M[optype.defaults];
      return { blank: m3(emitMapped(b({ ...D })).text), typed: m3(emitMapped(b({ ...D, rpm: 7000 })).text) };
    };
    return {
      pocket: await check('/blocks/dataOps/pocketData.js', 'pocketDataDef', { d: 'POCKET_DATA_OPTYPE', defaults: 'POCKET_DEFAULTS' }),
      drill: await check('/blocks/dataOps/drillData.js', 'drillDataDef', { d: 'DRILL_DATA_OPTYPE', defaults: 'DRILL_DEFAULTS' }),
      slot: await check('/blocks/dataOps/slotData.js', 'slotDataDef', { d: 'SLOT_DATA_OPTYPE', defaults: 'SLOT_DEFAULTS' }),
    };
  });
  for (const op of ['pocket', 'drill', 'slot']) {
    expect(r[op].blank, `${op}: blank rpm → Head default`).toBe(10000);
    expect(r[op].typed, `${op}: typed rpm 7000 → override`).toBe(7000);
  }
});
