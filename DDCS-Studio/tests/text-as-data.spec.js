import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, port #5: TEXT (engraving). Its { template, bindings } def (blocks/dataOps/textData.js)
 * emits BYTE-IDENTICAL G-code to textStack across a param sweep — incl. align center/right and stock-attach with varied
 * text, which only pass because the two header comments were made static and fillText now declares extent(). NO new atom
 * (fillText was already flat). `font` is a bound socket (the FONT SEAM — strokeFont FONTS registry), so a text-as-data op
 * is forkable by font. Frontiers held UNBOUND (divergence tripwires): `clearance` (fan-out → progstart + leaf); rpm/dir
 * are frozen at the progstart default. (Text has NO wcs block.)
 */
test('text-as-data: byte-identical G-code to textStack across a param sweep + binding-wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { textStack } = await import('/wizards/textWizard.js');
    const { textDataDef, TEXT_DEFAULTS, TEXT_DATA_OPTYPE, TEXT_BINDINGS } = await import('/blocks/dataOps/textData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(textDataDef());
    const dataBuilder = builderOf(TEXT_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from textStack

    const base = TEXT_DEFAULTS;
    const S = (o) => ({ ...base, ...o });

    const sweep = [
      S({}),                                                          // defaults
      S({ text: 'HELLO' }),                                          // different string
      S({ text: 'AB 12 CD' }),
      S({ height: 20 }),                                             // bigger
      S({ height: 8, strokeWidth: 1.5 }),                           // small + thin stroke
      S({ width: 1.5 }),                                            // extended (horizontal scale)
      S({ width: 0.7 }),                                            // condensed
      S({ slant: 12 }),                                             // oblique / italic
      S({ width: 1.3, slant: -8 }),                                 // both, back-slant
      S({ spacing: 3 }),                                            // tracking
      S({ align: 'center' }),                                       // alignment (maps in layoutText)
      S({ align: 'right', x: 60 }),
      S({ x: 12, y: -6 }),                                          // opt-in absolute position
      S({ strokeWidth: 4, toolDia: 2 }),                           // ribbon width + tool
      S({ stepoverPct: 35 }),                                      // finer fill
      S({ depth: 1, stepdown: 0.5 }),                              // multi-pass depth
      S({ feed: 600, plunge: 200 }),                               // feeds
      S({ originX: 13, originY: 7 }),                              // opt-in raw offset
      // ── stock-ATTACH with varied text (only byte-identical because fillText declares extent()) ──
      S({ stockAttach: 'pp', stockW: 200, stockH: 150, stockDatum: 'nnp', text: 'XY', height: 16, x: 5 }),
      S({ stockAttach: 'cc', stockW: 180, stockH: 140, text: 'ABCDE', height: 10 }),
    ];

    const main = emitEquivalence(textStack, dataBuilder, sweep);   // RAW (comments are static now)
    // FRONTIER — clearance fans out to progstart + the filltext leaf → varying it MUST diverge.
    const clearanceDiv = emitEquivalence(textStack, dataBuilder, [S({ clearance: 25 })]);

    // BINDING WIRING — every binding routes its param to the same socket textStack uses. `align` maps in layoutText (at
    // EMIT, not the stack) so its socket stores the raw value — but pass a VALID 'center' to also prove the map routes.
    const sentinelFor = (b) => (b.type === 'number' ? 4242 : (b.param === 'align' ? 'center' : '__SENTINEL__'));
    const wiringFails = [];
    const REF_BINDINGS = [
      { param: 'originX', blockIndex: 3, key: 'offX' },
      { param: 'originY', blockIndex: 3, key: 'offY' },
      { param: 'offZ', blockIndex: 3, key: 'offZ' },
      { param: 'stockAttach', blockIndex: 3, key: 'stockAttach' },
      { param: 'pathDatum', blockIndex: 3, key: 'pathDatum' },
      { param: 'stockDatum', blockIndex: 3, key: 'stockDatum' },
      { param: 'stockW', blockIndex: 3, key: 'stockW' },
      { param: 'stockH', blockIndex: 3, key: 'stockH' },
      { param: 'stockZ', blockIndex: 3, key: 'stockZ' },
      { param: 'depth', blockIndex: 4, key: 'to' },
      { param: 'stepdown', blockIndex: 4, key: 'by' },
      { param: 'text', blockIndex: 5, key: 'text' },
      { param: 'font', blockIndex: 5, key: 'font' },
      { param: 'height', blockIndex: 5, key: 'height' },
      { param: 'width', blockIndex: 5, key: 'width' },
      { param: 'slant', blockIndex: 5, key: 'slant' },
      { param: 'spacing', blockIndex: 5, key: 'spacing' },
      { param: 'align', blockIndex: 5, key: 'align' },
      { param: 'x', blockIndex: 5, key: 'x' },
      { param: 'y', blockIndex: 5, key: 'y' },
      { param: 'strokeWidth', blockIndex: 5, key: 'strokeWidth' },
      { param: 'toolDia', blockIndex: 5, key: 'toolDia' },
      { param: 'stepoverPct', blockIndex: 5, key: 'stepoverPct' },
      { param: 'feed', blockIndex: 5, key: 'feed' },
      { param: 'plunge', blockIndex: 5, key: 'plunge' },
    ];
    const refOf = (param) => REF_BINDINGS.find((x) => x.param === param);
    for (const b of TEXT_BINDINGS) {
      const sent = sentinelFor(b);
      const r = refOf(b.param);
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: sent })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(textStack(S({ [b.param]: sent })))[(r ? r.blockIndex : b.blockIndex)] || {}).params || {};
      const dataOk = dataSock[b.key] === sent, refOk = refSock[b.key] === sent;
      if (!dataOk || !refOk) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, dataOk, refOk });
    }

    const sampleText = emitMapped(dataBuilder(sweep[0])).text;
    return {
      bindingCount: TEXT_BINDINGS.length,
      wiringFails,
      independentPath: dataBuilder !== textStack,
      pristine: BUILDERS[TEXT_DATA_OPTYPE] === undefined && SCHEMA[TEXT_DATA_OPTYPE] === undefined,
      resolves: typeof dataBuilder === 'function',
      main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 600), b: main.firstDiff.b.slice(0, 600) } },
      clearancePass: clearanceDiv.pass,
      sampleHasCut: /G1 X-?\d/.test(sampleText),
      sampleHasPlunge: /G1 Z-/.test(sampleText),
    };
  });

  expect(r.resolves, 'text-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT textStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  expect(r.bindingCount, 'all bindable text params are bound (incl. font/width/slant)').toBe(25);
  expect(r.wiringFails, 'every binding routes to the same socket textStack uses').toEqual([]);
  if (!r.main.pass) console.log('FIRST DIFF @', JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--- textStack ---\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--- data def ---\n' + (r.main.firstDiff && r.main.firstDiff.b));
  expect(r.main.count, 'the sweep is substantial').toBeGreaterThan(13);
  expect(r.main.pass, 'text-as-data == textStack byte-for-byte across the sweep (incl. align + stock-attach)').toBe(true);
  expect(r.sampleHasCut, 'emits real engraving motion').toBe(true);
  expect(r.sampleHasPlunge, 'emits a real plunge to depth').toBe(true);
  expect(r.clearancePass, 'frontier: clearance fans out to progstart + the leaf, unbound here').toBe(false);
});
