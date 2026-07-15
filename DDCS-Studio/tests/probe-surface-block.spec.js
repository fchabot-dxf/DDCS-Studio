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

test('probeSurfaceStack — composes the touch (fast+slow probe, check, retract, comp) and stays editor-CLEAN (no @DDCS)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const { probeSurfaceStack } = await import('/wizards/ops/probeSurface.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const stack = probeSurfaceStack({ axis: 'X', dir: '+', stopVar: '#1905', limitVar: '#1915', limitVal: '2', probeVar: '#8', retractVar: '#9', feedFast: '#3', feedSlow: '#4', port: '#5', level: 0, raw: '#1925', result: '#50', radius: '#6', compEnable: true });
    const text = emitMapped(stack).text, lines = text.split('\n');
    return {
      twoG31: lines.filter((l) => /^G31 X/.test(l.trim())).length,
      hasComp: lines.some((l) => l.trim().startsWith('#50=[#1925+#6]')),
      retracts: lines.filter((l) => l.trim() === 'G0 X#9').length,
      hasMarker: text.indexOf('@DDCS') >= 0,
    };
  });
  expect(r.twoG31, 'fast + slow probe').toBe(2);
  expect(r.hasComp, 'the read+comp emits the TRUE surface in one line').toBe(true);
  expect(r.retracts, 'a retract after the fast probe + after the read').toBe(2);
  expect(r.hasMarker, 'no @DDCS in the emitted G-code (Option B — editor stays clean; the sim reads the surface sim-side, inc2)').toBe(false);
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
const CORNER_GOLDEN = ["#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-#15]\n#19=10\n#20=5\n#17=[#19+#20]\n#18=[0-#17]\n#23=#15\n#24=#16\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nG91\nG31 X#8 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#9\nG31 X#8 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925+#6]\n#[#70]=#102\nG0 X#9\nIF #520<0 GOTO91\n#520=-5\nN91\nG90\nG53 Z#520\nG91\nG0 Y#24\nG0 X#23\nG0 Z[0-#19]\nG31 Y#8 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#9\nG31 Y#8 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926+#6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#9\nIF #520<0 GOTO92\n#520=-5\nN92\nG90\nG53 Z#520\nG91\nG90\n#1505=-5000\nGOTO2\nN1\nIF #520<0 GOTO93\n#520=-5\nN93\nG90\nG53 Z#520\n#1505=1\nN2\nM30","#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-#15]\n#19=10\n#20=5\n#17=[#19+#20]\n#18=[0-#17]\n#21=#15\n#22=0\n#23=#16\n#24=#15\n#70=805\n#1505=1\nG91\nG31 Z#7 F#3 P#5 L0 Q1\nIF #1922!=2 GOTO1\nG0 Z#10\nG31 Z#7 F#4 P#5 L0 Q1\nIF #1922!=2 GOTO1\n#73=[#70+2]\n#[#73]=[#1927-#6]\nG0 Z#19\nG0 X#21 Y#22\nG0 Z#18\nG31 X#7 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#10\nG31 X#7 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925-#6]\n#[#70]=#102\nG0 X#10\nIF #520<0 GOTO91\n#520=-5\nN91\nG90\nG53 Z#520\nG91\nG0 Y#24\nG0 X#23\nG0 Z#18\nG31 Y#7 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#10\nG31 Y#7 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926-#6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#10\nIF #520<0 GOTO92\n#520=-5\nN92\nG90\nG53 Z#520\nG91\nG90\n#1505=-5000\nGOTO2\nN1\nIF #520<0 GOTO93\n#520=-5\nN93\nG90\nG53 Z#520\n#1505=1\nN2\nM30","#1=500\n#2=5\n#3=200\n#4=50\n#5=3\n#6=2\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=50\n#16=[0-#15]\n#19=10\n#20=5\n#17=[#19+#20]\n#18=[0-#17]\n#21=0\n#22=#16\n#23=#15\n#24=#15\n#71=#578\n#72=[#71-1]\n#70=[805+[#72*5]]\n#1505=1\nG91\nG31 Z#7 F#3 P#5 L0 Q1\nIF #1922!=2 GOTO1\nG0 Z#10\nG31 Z#7 F#4 P#5 L0 Q1\nIF #1922!=2 GOTO1\n#73=[#70+2]\n#[#73]=[#1927-#6]\nG0 Z#19\nG0 X#21 Y#22\nG0 Z#18\nG31 Y#8 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#9\nG31 Y#8 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926+#6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#9\nIF #520<0 GOTO91\n#520=-5\nN91\nG90\nG53 Z#520\nG91\nG0 X#23\nG0 Y#24\nG0 Z#18\nG31 X#7 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#10\nG31 X#7 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925-#6]\n#[#70]=#102\nG0 X#10\nIF #520<0 GOTO92\n#520=-5\nN92\nG90\nG53 Z#520\nG91\nG90\n#1505=-5000\nGOTO2\nN1\nIF #520<0 GOTO93\n#520=-5\nN93\nG90\nG53 Z#520\n#1505=1\nN2\nM30","#1=300\n#2=3\n#3=300\n#4=40\n#5=4\n#6=1.5\n#7=[0-#1]\n#8=#1\n#9=[0-#2]\n#10=#2\n#15=30\n#16=[0-#15]\n#19=8\n#20=4\n#17=[#19+#20]\n#18=[0-#17]\n#23=#16\n#24=#16\n#70=810\n#1505=1\nG91\nG31 Y#7 F#3 P#5 L0 Q1\nIF #1921!=2 GOTO1\nG0 Y#10\nG31 Y#7 F#4 P#5 L0 Q1\nIF #1921!=2 GOTO1\n#101=[#1926-#6]\n#73=[#70+1]\n#[#73]=#101\nG0 Y#10\nIF #520<0 GOTO91\n#520=-5\nN91\nG90\nG53 Z#520\nG91\nG0 X#23\nG0 Y#24\nG0 Z[0-#19]\nG31 X#8 F#3 P#5 L0 Q1\nIF #1920!=2 GOTO1\nG0 X#9\nG31 X#8 F#4 P#5 L0 Q1\nIF #1920!=2 GOTO1\n#102=[#1925+#6]\n#[#70]=#102\nG0 X#9\nIF #520<0 GOTO92\n#520=-5\nN92\nG90\nG53 Z#520\nG91\nG90\n#1505=-5000\nGOTO2\nN1\nIF #520<0 GOTO93\n#520=-5\nN93\nG90\nG53 Z#520\n#1505=1\nN2\nM30"];

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

// ROTARY (t129 migration + t139 fit-comp ON) — known value-identical + OD-top FIX; the FIT now comps too (the declared
// toggle, consistent with known). The fit SIM is degenerate (the operator-jog reposition isn't simulated → garbage points),
// so the fit comp is verified by the DECLARATION (the touches emit the comp + readEnabledComps includes them) + a SYNTHETIC
// solver test (the ACTUAL macro's circle-solve on real OD points), NOT the broken sim. (Fixing the fit sim = the next task.)
test('ROTARY — known value-identical + OD-top FIX; fit comp ON verified by declaration + synthetic solver', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { RotaryCenterWizard } = await import('/wizards/rotaryCenterWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const stock = { x: 150, y: 76.2, z: 76.2, shape: 'cylinder', show: true };
    const w = new RotaryCenterWizard();
    const run = (p) => { const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: w.inferStart(p, stock) }); eng.trace(w.generate(p)); return { yc: eng.vars.get(54), zc: eng.vars.get(56), R: eng.vars.get(55), top: eng.vars.get(50) }; };
    const known = run({ method: 'known', diameter: 76.2, dist: 30, safeZ: 15, approach: 'auto', datum: 'top' });

    // FIT — comp ON, verified WITHOUT the degenerate operator-jog sim:
    const fitParams = { method: 'fit', dist: 30, safeZ: 15, datum: 'center' };
    const fitText = w.generate(fitParams);
    // (1) the 3 fit touches EMIT the comp (the declared surface): top −#6, +Y flank +#6, −Y flank −#6
    const fitEmit = { top: fitText.includes('#51=[#1927-#6]'), flankPlus: fitText.includes('#53=[#1926+#6]'), flankMinus: fitText.includes('#55=[#1926-#6]') };
    // (2) readEnabledComps(fit) now includes the 3 result vars → the disc-on-surface nudges the fit's discs (RELATIVE ±r)
    const TRIG = { '#1925': 'x', '#1926': 'y', '#1927': 'z' };
    const fitComps = {};
    for (const a of builderOf('rotary_center')(fitParams)) if (a && a.type === 'radiuscomp' && a.params && a.params.enable !== false) fitComps[String(a.params.result)] = { axis: TRIG[a.params.raw], sign: a.params.dir === '-' ? -1 : 1 };
    // (3) SYNTHETIC: run the ACTUAL macro's circle-solve on a clean OD circle. Comped points sit ON the OD; raw tool-centre
    // points sit at R+r. The solver must fit R_true (comped) vs R_true+r (raw), same centre — the geometry the sim can't show.
    const lines = fitText.split('\n');
    const i0 = lines.findIndex((l) => /Solve circle/.test(l)), i1 = lines.findIndex((l) => /Final retract/.test(l));
    const solver = lines.slice(i0 + 1, i1).join('\n');
    const Yc0 = 5, Zc0 = -10, Rt = 30, rad = 2;
    const solve = (pts) => { const e = new GcodeExecutionEngine({ autoAnswer: true, stock }); e.trace(Object.entries(pts).map(([k, v]) => `${k}=${v}`).join('\n') + '\n' + solver + '\nM30'); return { yc: e.vars.get(54), zc: e.vars.get(56), R: e.vars.get(55) }; };
    const comped = solve({ '#52': Yc0, '#51': Zc0 + Rt, '#53': Yc0 - Rt, '#54': Zc0, '#55': Yc0 + Rt, '#56': Zc0 });               // ON the true OD
    const raw = solve({ '#52': Yc0, '#51': Zc0 + Rt + rad, '#53': Yc0 - Rt - rad, '#54': Zc0, '#55': Yc0 + Rt + rad, '#56': Zc0 }); // tool-centre (R+r)
    return { known, fitEmit, fitComps, syn: { comped, raw, Yc0, Zc0, Rt, rad } };
  });
  // KNOWN unchanged (valid sim)
  expect(r.known.yc, 'Yc value-identical').toBeCloseTo(38.1, 1);
  expect(r.known.zc, 'Zc value-identical').toBeCloseTo(-38.1, 1);
  expect(r.known.R, 'R value-identical').toBeCloseTo(38.1, 1);
  expect(r.known.top, 'OD top = the TRUE surface (Zc + R)').toBeCloseTo(r.known.zc + r.known.R, 1);
  expect(r.known.top, 'the OD top is now 0 (was the raw 2)').toBeCloseTo(0, 1);
  // FIT (1) the touches emit the comp
  expect(r.fitEmit, 'the 3 fit touches emit the radius comp (the declared surface)').toEqual({ top: true, flankPlus: true, flankMinus: true });
  // (2) readEnabledComps includes the fit comps → the disc-on-surface nudges the fit's discs
  expect(r.fitComps, 'the fit comps are enabled-read for the disc-on-surface').toMatchObject({ '#51': { axis: 'z', sign: -1 }, '#53': { axis: 'y', sign: 1 }, '#55': { axis: 'y', sign: -1 } });
  // (3) the ACTUAL solver: comped → R_true; raw tool-centre → R_true+r; same centre either way (concentric)
  expect(r.syn.comped.R, 'comped points fit the TRUE OD radius').toBeCloseTo(r.syn.Rt, 3);
  expect(r.syn.raw.R, 'raw tool-centre points fit R_true + the stylus radius').toBeCloseTo(r.syn.Rt + r.syn.rad, 3);
  expect(r.syn.comped.R, 'the comp drops exactly the stylus radius').toBeCloseTo(r.syn.raw.R - r.syn.rad, 3);
  expect(r.syn.comped.yc, 'centre Yc unchanged by the comp').toBeCloseTo(r.syn.Yc0, 3);
  expect(r.syn.comped.zc, 'centre Zc unchanged by the comp').toBeCloseTo(r.syn.Zc0, 3);
  expect(r.syn.raw.yc, 'raw centre = same Yc (concentric)').toBeCloseTo(r.syn.Yc0, 3);
  expect(r.syn.raw.zc, 'raw centre = same Zc (concentric)').toBeCloseTo(r.syn.Zc0, 3);
});
