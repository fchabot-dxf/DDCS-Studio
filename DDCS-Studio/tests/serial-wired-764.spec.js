import { test, expect } from '@playwright/test';

/**
 * t764 (Text Stage 2, phase 2b — the wiring) — a text op whose text carries {SN} emits the DYNAMIC serial: the counter
 * bump at program top, the per-digit dispatch inline, and the glyph library ONCE per distinct height after the program
 * end. The SIM's persistent uservar store (simUserVars) bumps across runs → two runs engrave DIFFERENT serials. A
 * static-only text op is BYTE-IDENTICAL (the {SN} path is inert without the token). {DATE} → the insert-time stamp.
 */
test.use({ viewport: { width: 1000, height: 800 } });

// Emit a text op with the given params (via textStack + emitMapped, the real path).
const emitText = (page, over) => page.evaluate(async (o) => {
  const { textStack } = await import('/wizards/textWizard.js');
  const { TEXT_DEFAULTS } = await import('/blocks/dataOps/textData.js');
  const { emitMapped } = await import('/blocks/blockEmitter.js');
  return emitMapped(textStack({ ...TEXT_DEFAULTS, ...o })).text;
}, over);

test('a static-only text op is BYTE-IDENTICAL with the {SN} params present but no token (goldens hold)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const plain = await emitText(page, { text: 'PART A' });
  const withParams = await emitText(page, { text: 'PART A', snSlot: 200, snWidth: 8, snIncrement: 5 });
  expect(withParams, 'the serial params are inert when the text has no {SN} token').toBe(plain);
  expect(/@SN|#\d+ = #\d+ \+/.test(plain), 'no serial machinery leaks into a static text op').toBe(false);
});

test('TWO consecutive runs of a {SN} text op engrave DIFFERENT serials (the persistent store bumps)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { textStack } = await import('/wizards/textWizard.js');
    const { TEXT_DEFAULTS } = await import('/blocks/dataOps/textData.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { simUserVarStore, resetSimUserVars, setSimUserVar } = await import('/engine/simUserVars.js');
    const Engine = (await import('/engine/GcodeExecutionEngine.js')).GcodeExecutionEngine;
    resetSimUserVars(); setSimUserVar(490, 100);   // Initialize-counter → start at 100
    const prog = emitMapped(textStack({ ...TEXT_DEFAULTS, text: 'SN-{SN}', snSlot: 490, snWidth: 4, height: 8, depth: 0.4 })).text;
    const eng = new Engine({ createVarStore: () => simUserVarStore() });   // the SAME persistent store the panel uses
    const sig = (t) => (t.segments || []).filter((s) => s.feed && !s.rapid).map((s) => `${Math.round(s.x2 * 10)},${Math.round(s.y2 * 10)}`).join('|');
    const t1 = eng.trace(prog); const sn1 = simUserVarStore().get(490); const s1 = sig(t1);
    const t2 = eng.trace(prog); const sn2 = simUserVarStore().get(490); const s2 = sig(t2);
    resetSimUserVars();
    return { sn1, sn2, differ: s1 !== s2, bumpOnce: (prog.match(/#490 = #490 \+ 1/g) || []).length };
  });
  expect(r.sn1, 'run 1 bumps 100 → 101').toBe(101);
  expect(r.sn2, 'run 2 bumps 101 → 102 (the store persisted between Plays)').toBe(102);
  expect(r.differ, 'the two runs engrave different serials (101 vs 102)').toBe(true);
  expect(r.bumpOnce, 'the counter bumps exactly ONCE per program').toBe(1);
});

test('the glyph library emits ONCE per program with TWO {SN} tokens; a distinct height → a distinct set (dedupe)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { textStack } = await import('/wizards/textWizard.js');
    const { TEXT_DEFAULTS } = await import('/blocks/dataOps/textData.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    // TWO {SN} tokens, SAME height → one library set (O600 defined once); a second op at a DISTINCT height → a 2nd set (O620)
    const two = emitMapped(textStack({ ...TEXT_DEFAULTS, text: '{SN} {SN}', snWidth: 3, height: 8 })).text;
    const distinct = emitMapped([...textStack({ ...TEXT_DEFAULTS, text: 'A{SN}', height: 8 }), ...textStack({ ...TEXT_DEFAULTS, text: 'B{SN}', height: 14 })]).text;
    const count = (s, re) => (s.match(re) || []).length;
    return {
      libOnce: count(two, /O600 \( glyph 0 \)/g), dispCalls: count(two, /M98 P610/g),
      set0: count(distinct, /O600 \( glyph 0 \)/g), set1: count(distinct, /O620 \( glyph 0 \)/g),
    };
  });
  expect(r.libOnce, 'two {SN} tokens (same height) → the library O600 set defined ONCE').toBe(1);
  expect(r.dispCalls, 'both tokens dispatch through the shared library (2 inlines × 3 digits each)').toBeGreaterThanOrEqual(2);
  expect(r.set0, 'height-8 set defined once').toBe(1);
  expect(r.set1, 'the distinct height-14 op gets its OWN set (O620), no collision').toBe(1);
});

test('non-DDCS posts DEGRADE the {SN} to an honest note (no broken macro); V4.1 keeps the macro', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { textStack } = await import('/wizards/textWizard.js');
    const { TEXT_DEFAULTS } = await import('/blocks/dataOps/textData.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { DIALECTS } = await import('/wizards/dialects/index.js');
    const stack = textStack({ ...TEXT_DEFAULTS, text: 'A{SN}', snWidth: 3 });
    const grbl = emitMapped(stack, { dialect: DIALECTS['grbl'] }).text;
    const v41 = emitMapped(stack, { dialect: DIALECTS['ddcs-v41'] }).text;
    return {
      grblMacro: /#\d+ = #\d+ \+|WHILE|M98 P610|O600/.test(grbl), grblNote: /dynamic serial needs a DDCS/i.test(grbl),
      v41Macro: /#\d+ = #\d+ \+/.test(v41) && /O600/.test(v41),
    };
  });
  expect(r.grblMacro, 'grbl (no persistent-var macro) emits NO serial macro').toBe(false);
  expect(r.grblNote, 'grbl shows the honest degrade note').toBe(true);
  expect(r.v41Macro, 'V4.1 (a DDCS uservar controller) keeps the full macro — same design on #100-499').toBe(true);
});

test('{DATE} substitutes the insert-time stamp (static) — no dynamic clock; no serial machinery', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const withDate = await emitText(page, { text: '{DATE}', dateStamp: '2026-07-12' });
  expect(/@SN|#\d+ = #\d+ \+/.test(withDate), '{DATE} is static — no serial macro').toBe(false);
  expect(withDate.length, '{DATE} engraved real strokes (the stamp)').toBeGreaterThan(20);
});
