import { test, expect } from '@playwright/test';

/**
 * PROBE-SURFACE BLOCK — foundation (turn 125 inc1). The radius-comp atom + the shared probeSurfaceStack builder +
 * the @DDCS surface marker, proven by migrating EDGE with FUNCTIONAL (stripAnnotations) byte-identical G-code.
 * GOLDEN = the hand-rolled edge emit captured BEFORE the migration (the swap must not change machine behaviour).
 */
const BASE = 'http://localhost:3211';
async function boot(page) { await page.goto(BASE); await page.waitForFunction(() => window.ddcsStudio); }

// EDGE param sweep + the frozen pre-migration golden (executable G-code only — comments/marker stripped).
const SWEEP = [
  { axis: 'X', dir: 'pos', wcs: 'active' },
  { axis: 'X', dir: 'neg', wcs: 'G54' },
  { axis: 'Y', dir: 'pos', wcs: 'active' },
  { axis: 'Y', dir: 'neg', wcs: 'G55', dist: 25, retract: 3, radius: 1.5, f_fast: 300, f_slow: 40, port: 4 },
];
const GOLDEN = [
  "#1=15\n#2=2\n#3=200\n#4=50\n#5=3\n#6=2\n#50=0\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nIF #1505==0 GOTO2\nG91\n#1905=0\n#1915=2\nG31 X#8 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#9\nG31 X#8 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#50=[#1925+#6]\nG0 X#9\n#[#70+0]=#50\nG90\n#1505=-5000\nGOTO2\nN1\nG90\n#1505=1\nN2\nM30",
  "#1=15\n#2=2\n#3=200\n#4=50\n#5=3\n#6=2\n#50=0\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#70=805\n#1505=1\nIF #1505==0 GOTO2\nG91\n#1905=0\n#1915=1\nG31 X#7 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#10\nG31 X#7 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#50=[#1925-#6]\nG0 X#10\n#[#70+0]=#50\nG90\n#1505=-5000\nGOTO2\nN1\nG90\n#1505=1\nN2\nM30",
  "#1=15\n#2=2\n#3=200\n#4=50\n#5=3\n#6=2\n#50=0\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nIF #1505==0 GOTO2\nG91\n#1906=0\n#1916=2\nG31 Y#8 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#9\nG31 Y#8 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#50=[#1926+#6]\nG0 Y#9\n#[#70+1]=#50\nG90\n#1505=-5000\nGOTO2\nN1\nG90\n#1505=1\nN2\nM30",
  "#1=25\n#2=3\n#3=300\n#4=40\n#5=4\n#6=1.5\n#50=0\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#70=810\n#1505=1\nIF #1505==0 GOTO2\nG91\n#1906=0\n#1916=1\nG31 Y#7 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#10\nG31 Y#7 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#50=[#1926-#6]\nG0 Y#10\n#[#70+1]=#50\nG90\n#1505=-5000\nGOTO2\nN1\nG90\n#1505=1\nN2\nM30",
];

test('radiuscomp atom — enable ON comps toward the wall; OFF passes through raw', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const mk = (params) => { const b = newBlock('radiuscomp'); b.params = { ...b.params, ...params }; return emitMapped([b]).text.trim(); };
    return {
      on: mk({ raw: '#1925', result: '#50', radius: '#6', dir: '+', enable: true }),
      off: mk({ raw: '#1925', result: '#50', radius: '#6', dir: '+', enable: false }),
      neg: mk({ raw: '#1926', result: '#101', radius: '#6', dir: '-', enable: true }),
    };
  });
  expect(r.on).toBe('#50=[#1925+#6]');     // the TRUE surface
  expect(r.off).toBe('#50=#1925');         // passthrough = the un-compensated tool centre (a config flip away)
  expect(r.neg).toBe('#101=[#1926-#6]');
});

test('probeSurfaceStack — composes the touch + emits the declared @DDCS surface marker', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const { probeSurfaceStack } = await import('/wizards/ops/probeSurface.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { isMarker, parseMarker } = await import('/blocks/opSchema.js');
    const stack = probeSurfaceStack({ axis: 'X', dir: '+', stopVar: '#1905', limitVar: '#1915', limitVal: '2', probeVar: '#8', retractVar: '#9', feedFast: '#3', feedSlow: '#4', port: '#5', level: 0, raw: '#1925', result: '#50', radius: '#6', compEnable: true });
    const lines = emitMapped(stack).text.split('\n');
    const marker = lines.find(isMarker);
    return {
      twoG31: lines.filter((l) => /^G31 X/.test(l.trim())).length,
      hasComp: lines.some((l) => l.trim().startsWith('#50=[#1925+#6]')),
      retracts: lines.filter((l) => l.trim() === 'G0 X#9').length,
      parsed: marker ? parseMarker(marker) : null,
    };
  });
  expect(r.twoG31, 'fast + slow probe').toBe(2);
  expect(r.hasComp, 'the read+comp emits the TRUE surface in one line').toBe(true);
  expect(r.retracts, 'a retract after the fast probe + after the read').toBe(2);
  expect(r.parsed?.opType).toBe('probe-surface');
  expect(r.parsed?.params).toMatchObject({ result: '#50', axis: 'X', dir: '+' });
});

test('EDGE migration — functional G-code BYTE-IDENTICAL to the hand-rolled touch (stripAnnotations)', async ({ page }) => {
  await boot(page);
  const out = await page.evaluate(async (sweep) => {
    const { edgeStack } = await import('/wizards/edgeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    return sweep.map((p) => stripAnnotations(emitMapped(edgeStack(p)).text));
  }, SWEEP);
  for (let i = 0; i < GOLDEN.length; i++) expect(out[i], `param set ${i} (${JSON.stringify(SWEEP[i])})`).toBe(GOLDEN[i]);
});


// CORNER migration (t127) — 3 touches (X/Y/Z) compose probeSurfaceStack; golden captured pre-migration.
const CORNER_SWEEP = [{"corner":"FL","probeZ":false,"probeSeq":"XY","wcs":"active"},{"corner":"BR","probeZ":true,"probeSeq":"XY","wcs":"G54"},{"corner":"FR","probeZ":true,"probeSeq":"YX","wcs":"active"},{"corner":"BL","probeZ":false,"probeSeq":"YX","wcs":"G55","dist":300,"retract":3,"radius":1.5,"f_fast":300,"f_slow":40,"port":4,"safeZ":8,"scanDepth":4,"travelDist":30}];
const CORNER_GOLDEN = ["#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-50]\n#17=15\n#18=[0-#17]\n#19=10\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nG91\nG0 Z#18\nG31 X#8 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#9\nG31 X#8 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925 + #6]\n#[#70]=#102\nG0 X#9\nG0 Z#17\nG0 X#15 Y#16\nG0 Z#18\nG31 Y#8 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#9\nG31 Y#8 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926 + #6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#9\nG0 Z#17\nG90\n#1505=-5000\nGOTO2\nN1\nG91\nG0 Z#17\nG90\n#1505=1\nN2\nM30","#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-50]\n#17=15\n#18=[0-#17]\n#19=10\n#70=805\n#1505=1\nG91\nG31 Z#7 F#3 P#5 L0 Q1\nIF #1922!=2 GOTO1\nG0 Z#10\nG31 Z#7 F#4 P#5 L0 Q1\nIF #1922!=2 GOTO1\n#73=[#70+2]\n#[#73]=[#1927-#6]\nG0 Z#19\nG0 X#15\nG0 Z#18\nG31 X#7 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#10\nG31 X#7 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925 - #6]\n#[#70]=#102\nG0 X#10\nG0 Z#17\nG0 X#16 Y#15\nG0 Z#18\nG31 Y#7 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#10\nG31 Y#7 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926 - #6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#10\nG0 Z#17\nG90\n#1505=-5000\nGOTO2\nN1\nG91\nG0 Z#17\nG90\n#1505=1\nN2\nM30","#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-50]\n#17=15\n#18=[0-#17]\n#19=10\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nG91\nG31 Z#7 F#3 P#5 L0 Q1\nIF #1922!=2 GOTO1\nG0 Z#10\nG31 Z#7 F#4 P#5 L0 Q1\nIF #1922!=2 GOTO1\n#73=[#70+2]\n#[#73]=[#1927-#6]\nG0 Z#19\nG0 Y#16\nG0 Z#18\nG31 Y#8 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#9\nG31 Y#8 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926 + #6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#9\nG0 Z#17\nG0 X#15 Y#15\nG0 Z#18\nG31 X#7 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#10\nG31 X#7 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925 - #6]\n#[#70]=#102\nG0 X#10\nG0 Z#17\nG90\n#1505=-5000\nGOTO2\nN1\nG91\nG0 Z#17\nG90\n#1505=1\nN2\nM30","#1=300\n#2=3\n#3=300\n#4=40\n#5=4\n#6=1.5\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=30\n#16=[0-30]\n#17=12\n#18=[0-#17]\n#19=8\n#70=810\n#1505=1\nG91\nG0 Z#18\nG31 Y#7 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#10\nG31 Y#7 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926 - #6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#10\nG0 Z#17\nG0 X#16 Y#16\nG0 Z#18\nG31 X#8 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#9\nG31 X#8 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925 + #6]\n#[#70]=#102\nG0 X#9\nG0 Z#17\nG90\n#1505=-5000\nGOTO2\nN1\nG91\nG0 Z#17\nG90\n#1505=1\nN2\nM30"];

test("CORNER migration — functional G-code BYTE-IDENTICAL to the hand-rolled walls (stripAnnotations)", async ({ page }) => {
  await boot(page);
  const out = await page.evaluate(async (sweep) => {
    const { cornerStack } = await import("/wizards/cornerWizard.js");
    const { emitMapped } = await import("/blocks/blockEmitter.js");
    const { stripAnnotations } = await import("/blocks/dataOps/equivalence.js");
    return sweep.map((p) => stripAnnotations(emitMapped(cornerStack(p)).text));
  }, CORNER_SWEEP);
  for (let i = 0; i < CORNER_GOLDEN.length; i++) expect(out[i], JSON.stringify(CORNER_SWEEP[i])).toBe(CORNER_GOLDEN[i]);
});

// ROTARY migration (t129) — VALUE-IDENTICAL (the comp relocates from #56 to the touches) + the named OD-top FIX.
test('ROTARY migration — known value-identical (Yc/Zc/R) + OD-top FIX (datum=top on the TRUE surface) + fit value-identical', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { RotaryCenterWizard } = await import('/wizards/rotaryCenterWizard.js');
    const stock = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true };
    const w = new RotaryCenterWizard();
    const run = (p) => { const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: w.inferStart(p, stock) }); eng.trace(w.generate(p)); return { yc: eng.vars.get(54), zc: eng.vars.get(56), R: eng.vars.get(55), top: eng.vars.get(50) }; };
    return {
      known: run({ method: 'known', diameter: 76.2, dist: 30, safeZ: 15, approach: 'auto', datum: 'top' }),
      fit: run({ method: 'fit', dist: 30, safeZ: 15, datum: 'center' }),
    };
  });
  // KNOWN: Yc/Zc/R unchanged (the comp relocated from #56 to the top touch; the flank ∓#6 cancels in the bisect)
  expect(r.known.yc, 'Yc value-identical').toBeCloseTo(38.1, 1);
  expect(r.known.zc, 'Zc value-identical').toBeCloseTo(-38.1, 1);
  expect(r.known.R, 'R value-identical').toBeCloseTo(38.1, 1);
  // OD-TOP FIX (named change): datum=top now writes the TRUE OD top (= Zc + R = 0), not the raw tool-centre top (was +radius = 2)
  expect(r.known.top, 'OD top = the TRUE surface (Zc + R) — the comp dropped the stylus radius').toBeCloseTo(r.known.zc + r.known.R, 1);
  expect(r.known.top, 'the OD top is now 0 (was the raw 2, a stylus radius high)').toBeCloseTo(0, 1);
  // FIT: value-identical (touches stay raw → the solver is unchanged)
  expect(r.fit.yc, 'fit Yc value-identical').toBeCloseTo(38.1, 1);
  expect(r.fit.zc, 'fit Zc value-identical').toBeCloseTo(159.3, 0);
  expect(r.fit.R, 'fit R value-identical').toBeCloseTo(161.85, 0);
});
