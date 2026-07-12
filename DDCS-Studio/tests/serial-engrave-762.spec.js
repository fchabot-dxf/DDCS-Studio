import { test, expect } from '@playwright/test';

/**
 * t762 (Text Stage 2, phase 2a) — the DYNAMIC {SN} serial emit CORE (wizards/serialEngrave.js) proven end-to-end in the
 * sim: a persistent uservar counter is bumped once per run and the runtime number is engraved by digit-glyph
 * subprograms (the t760 M98 engine executes them). TWO consecutive runs sharing the counter store engrave DIFFERENT
 * serials (the bump), at the correct depth, with the glyph library emitted ONCE per (height) set. Confirmed-ops-only
 * (WHILE extraction, IF-GOTO dispatch, incremental-G91 glyphs, var-coords).
 */
test.use({ viewport: { width: 1000, height: 800 } });

const assemble = (SE, { slot = 490, count = 2, inc = 1, H = 10, W = 1, cut }) =>
  ['G90', ...SE.serialBump(slot, inc), ...SE.serialInline(slot, count, 0, 0, 0), 'M30', ...SE.glyphLibrary(0, H, W, cut)].join('\n') + '\n';

test('TWO consecutive runs engrave DIFFERENT serials (the persistent counter bumps), at the correct depth', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const SE = await import('/wizards/serialEngrave.js');
    const Engine = (await import('/engine/GcodeExecutionEngine.js')).GcodeExecutionEngine;
    const cut = { feed: 400, plunge: 120, clearance: 4, depth: 0.4 };
    const slot = 490;
    const prog = ['G90', ...SE.serialBump(slot, 1), ...SE.serialInline(slot, count = 2, 0, 0, 0), 'M30', ...SE.glyphLibrary(0, 10, 1, cut)].join('\n') + '\n';
    // a SHARED persistent store (models the controller's non-volatile uservar file) → #490 survives run→run
    const persist = new Map(); persist.set(slot, 41);
    const eng = new Engine({ createVarStore: () => persist });
    const feedSig = (t) => (t.segments || []).filter((s) => s.feed && !s.rapid).map((s) => `${Math.round(s.x2 * 10)},${Math.round(s.y2 * 10)}`).join('|');
    const t1 = eng.trace(prog); const sn1 = persist.get(slot); const sig1 = feedSig(t1);
    const t2 = eng.trace(prog); const sn2 = persist.get(slot); const sig2 = feedSig(t2);
    return { sn1, sn2, sig1, sig2, minZ: Math.round(t1.bounds.minZ * 10) / 10, nFeed: (t1.segments || []).filter((s) => s.feed && !s.rapid).length };
  });
  expect(r.sn1, 'run 1 bumps the counter 41 → 42').toBe(42);
  expect(r.sn2, 'run 2 bumps it again 42 → 43 (the store persisted)').toBe(43);
  expect(r.nFeed, 'the serial actually engraved (feed strokes drawn)').toBeGreaterThan(5);
  expect(r.sig1, 'the two runs engrave DIFFERENT strokes (42 vs 43)').not.toBe(r.sig2);
  expect(r.minZ, 'engraves at the configured depth (0.4mm), not the clearance-deep bug').toBe(-0.4);
});

test('the glyph library is ONE set per height (O600-610); a distinct height gets a distinct set (O620-630) — dedupe-ready', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const SE = await import('/wizards/serialEngrave.js');
    const cut = { feed: 400, plunge: 120, clearance: 4, depth: 0.4 };
    const set0 = SE.glyphLibrary(0, 10, 1, cut).join('\n');   // height A → base 600
    const set1 = SE.glyphLibrary(1, 20, 1, cut).join('\n');   // height B → base 620
    const oWords = (s) => [...s.matchAll(/^O(\d+)/gm)].map((m) => Number(m[1])).sort((a, b) => a - b);
    return { base0: SE.snBase(0), base1: SE.snBase(1), o0: oWords(set0), o1: oWords(set1), disp0: set0.includes('P610'), inlineDisp: SE.serialInline(490, 3, 0, 0, 1).join('\n').includes('P630') };
  });
  expect(r.base0, 'set 0 base').toBe(600);
  expect(r.base1, 'set 1 base (distinct height → distinct O-block, no collision)').toBe(620);
  expect(r.o0, 'set 0 defines O600-610 (10 glyphs + dispatcher)').toEqual([600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610]);
  expect(r.o1, 'set 1 defines O620-630').toEqual([620, 621, 622, 623, 624, 625, 626, 627, 628, 629, 630]);
  expect(r.inlineDisp, 'an inline for set 1 calls its dispatcher O630 (not O610)').toBe(true);
});

test('zero-padded fixed width: extraction yields all N digits, leading zeros included (000042 for width 6)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const SE = await import('/wizards/serialEngrave.js');
    const Engine = (await import('/engine/GcodeExecutionEngine.js')).GcodeExecutionEngine;
    const cut = { feed: 400, plunge: 120, clearance: 4, depth: 0.4 };
    // width 6, serial 41 → engraves 000042 → 6 digit glyphs (4 leading zeros + '4' + '2')
    const prog = ['G90', ...SE.serialBump(490, 1), ...SE.serialInline(490, 6, 0, 0, 0), 'M30', ...SE.glyphLibrary(0, 10, 1, cut)].join('\n') + '\n';
    const persist = new Map(); persist.set(490, 41);
    const eng = new Engine({ createVarStore: () => persist });
    const t = eng.trace(prog);
    // the pen advances once per digit → the last engraved X spans ~6 pitches
    return { maxX: Math.round(t.bounds.maxX), pitch: Math.round(SE.digitPitch(10, 1)) };
  });
  expect(r.maxX, '6 digits laid out at the monospace pitch').toBeGreaterThanOrEqual(r.pitch * 5);
});
