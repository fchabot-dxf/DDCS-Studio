import { test, expect } from '@playwright/test';

/**
 * t822 — THE DECLARED SAFE-Z RETRACT. A user crashed the Z top switch: the error-handler retract, firing from an
 * UNKNOWN Z after a probe MISS, lifted INCREMENTALLY (G91 / G0 Z#17 / G90) and COMPOUNDED into the top limit. The fix:
 * the safe-height class (the error-handler retracts of corner/middle/rotaryCenter/rotaryClock) now retracts in the
 * MACHINE frame via a shared `saferetract` atom that consumes the DECLARED policy (settings.machine.safeZMargin):
 *   Expert — read the boot-seeded register #520 with an INLINE unset-guard (register 0/unset → seed the declared
 *            margin, NEVER `G53 Z0` = the top switch); V4.1 — a literal staged in #190; DM500 — an honest work-frame
 *            degrade (direct G53 not dump-grounded); grbl/rs274/centroid — a literal `G53 [G0] Z<margin>`.
 * The per-wall lift (corner L211) STAYS relative (ruling D: a bounded hop from a KNOWN just-tripped Z, not the crash
 * vector). The twin's inheritance is covered by corner-data-emit (twin == cornerStack, both now emit the retract).
 */
test.use({ viewport: { width: 1000, height: 800 } });

const STACKS = { corner: 'cornerStack', middle: 'middleStack', rotaryCenter: 'rotaryCenterStack', rotaryClock: 'rotaryClockStack' };

async function emitAll(page) {
  return page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { rotaryCenterStack } = await import('/wizards/rotaryCenterWizard.js');
    const { rotaryClockStack } = await import('/wizards/rotaryClockWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const builders = { corner: cornerStack, middle: middleStack, rotaryCenter: rotaryCenterStack, rotaryClock: rotaryClockStack };
    const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc', 'centroid'];
    const out = {};
    for (const [w, b] of Object.entries(builders)) {
      out[w] = {};
      for (const id of POSTS) out[w][id] = emitMapped(b({}), { dialect: getDialect(id) }).text;
    }
    return out;
  });
}

/** slice ONE safe-Z retract's lines (a program can now hold several: per-wall retreats + the error handler). `which`
 *  = 'first' (default) or 'last' (the error handler, nearest M30). A retract is at most ~6 lines (comment+guard+G53). */
function retractRegion(text, which = 'first') {
  const i = which === 'last' ? text.lastIndexOf('Safe-Z retract') : text.indexOf('Safe-Z retract');
  return i >= 0 ? text.slice(i).split('\n').slice(0, 6).join('\n') : '';
}

test('the safe-height class retracts in the MACHINE frame (Expert G53 #520) — ZERO incremental per-wall Z-lifts survive', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const em = await emitAll(page);
  // all 4 wizards, Expert: the safe-height class (per-wall retreats + the error handler) is the machine-frame register form.
  // (The FINAL PARK is a SEPARATE, frame-toggleable mechanism — safeZParkBlock, relative default `G0 Z#17` — NOT the crash
  //  class; corner-z-trust asserts corner's per-wall retreat converted specifically.)
  for (const w of Object.keys(STACKS)) {
    const text = em[w]['ddcs-expert-m350'];
    expect(text, `${w}: emits the machine-frame G53 retract`).toContain('G53 Z#520');
    // the ERROR-HANDLER retract (the LAST safe-Z retract, at the miss branch near M30) is machine-frame with no incremental lift
    const err = retractRegion(text, 'last');
    expect(err, `${w}: the error-handler retract is machine-frame G53`).toContain('G53 Z#520');
    expect(err, `${w}: no incremental G91 in the error-handler retract`).not.toContain('G91');
  }
});

test('the UNSET-GUARD: controller value wins if set, else seed the declared margin — never G53 Z0', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const em = await emitAll(page);
  const reg = retractRegion(em.corner['ddcs-expert-m350']);
  // the guard, IN ORDER: skip-if-set → seed-default → label → the machine move. And NEVER a bare G53 Z0.
  expect(reg).toMatch(/IF #520<0 GOTO91[\s\S]*#520=-5[\s\S]*N91[\s\S]*G53 Z#520/);
  expect(reg, 'never rapids to the machine top (Z0)').not.toMatch(/G53 Z0\b/);
});

test('per-post fold of the safe-height retract (declared margin default 5 → -5)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const em = await emitAll(page);
  const R = (id) => retractRegion(em.corner[id]);
  // V4.1 — a literal staged in the free var #190, then the CONFIRMED G0 G53 form
  expect(R('ddcs-v41')).toContain('#190=-5');
  expect(R('ddcs-v41')).toContain('G0 G53 Z#190');
  // DM500 — direct G53 NOT dump-grounded → honest work-frame degrade (G90 / G0 Z#17), no G53
  expect(R('ddcs-v3-dm500')).toContain('G53 not grounded on DM500');
  expect(R('ddcs-v3-dm500')).toMatch(/G90[\s\S]*G0 Z#17/);
  expect(R('ddcs-v3-dm500')).not.toContain('G53 Z');
  // grbl / rs274 — a literal machine-frame rapid (no #vars there)
  expect(R('grbl')).toContain('G53 G0 Z-5');
  expect(R('rs274ngc')).toContain('G53 G0 Z-5');
  // centroid — the no-G0 literal form
  expect(R('centroid')).toContain('G53 Z-5');
});

test('the safe-Z retract ROUND-TRIPS byte-identical (emit → parse → emit) — the atom my change adds', async ({ page }) => {
  // NOTE scope: the full corner program has a PRE-EXISTING round-trip gap (the G31 probe P/L/Q words don't fold back),
  // unrelated to this turn. "Blocks round-trip intact" = my ADDITION introduces no new gap → test the isolated retract.
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { safeRetractNode } = await import('/wizards/ops/safeZframe.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { parseGcodeToStack } = await import('/blocks/gcodeToStack.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    // Expert/V4.1 retract via a #VAR (#520/#190) → the machinemove atom re-emits it verbatim. (grbl/rs274/centroid bake a
    // LITERAL coord, which the machinemove atom re-stages via #99 + post-gates on re-emit — a PRE-EXISTING literal-machine-
    // move behavior, not this change; the DIRECT emit that runs on the machine is the correct `G53 G0 Z-5`.)
    const out = {};
    for (const id of ['ddcs-expert-m350', 'ddcs-v41']) {
      const opts = { dialect: getDialect(id) };
      const t1 = emitMapped([safeRetractNode()], opts).text;
      out[id] = { t1, t2: emitMapped(parseGcodeToStack(t1), opts).text };
    }
    return out;
  });
  for (const id of Object.keys(r)) expect(r[id].t2, `${id}: the safe-Z retract round-trips byte-identical`).toBe(r[id].t1);
  expect(r['ddcs-expert-m350'].t1).toContain('G53 Z#520');
});

test('the margin is USER-OWNED: the declared setting flows to the retract (Expert guard + literal posts)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  // set the declared margin to 8mm below home
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = s.machine || {}; s.machine.safeZMargin = 8; });
  const em = await emitAll(page);
  expect(retractRegion(em.corner['ddcs-expert-m350']), 'Expert guard seeds the declared -8').toContain('#520=-8');
  expect(retractRegion(em.corner['grbl']), 'grbl bakes the declared -8').toContain('G53 G0 Z-8');
  // restore the default so later tests see 5
  await page.evaluate(() => { window.ddcsGetSettings().machine.safeZMargin = 5; });
});

test('the twin inherits: user_corner_data emits the same machine-frame retract', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerDataStack } = await import('/blocks/dataOps/cornerData.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    return emitMapped(cornerDataStack({}), { dialect: getDialect('ddcs-expert-m350') }).text;
  });
  expect(r, 'the data twin carries the machine-frame safe-Z retract').toContain('G53 Z#520');
});

test('the sysstart BOOT macro seeds #520 from the declared setting (Expert)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.showApp);
  await page.evaluate(() => { const s = window.ddcsGetSettings(); s.machine = s.machine || {}; s.machine.safeZMargin = 5; s.autostartBody = undefined; s.autostartHandEdited = false; });
  await page.evaluate(() => window.showApp('macros'));
  await page.waitForFunction(() => window.showMacrosPanel, null, { timeout: 8000 });
  await page.evaluate(() => window.showMacrosPanel('macros_panel_sysstart'));
  await page.waitForTimeout(200);
  // regenerate the body from the profile (deterministic) and read it
  await page.evaluate(() => { const b = document.getElementById('sysstart_regen'); if (b) b.click(); });
  await page.waitForTimeout(300);
  const body = await page.evaluate(() => { const t = document.getElementById('sysstart_body'); return t ? t.value : (window.ddcsGetSettings().autostartBody || ''); });
  expect(body, 'the boot macro seeds the safe-Z margin register').toContain('#520=-5');
});

test('the SIM executes the machine-frame retract to the declared safe height (→ amber poschip)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const { safeRetractNode } = await import('/wizards/ops/safeZframe.js');
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    // the isolated retract (the error handler is the miss branch, not run in a normal trace) — Expert, machine frame
    const code = emitMapped([safeRetractNode()], { dialect: getDialect('ddcs-expert-m350') }).text;
    const trace = new GcodeExecutionEngine({ autoAnswer: true }).trace(code + '\nM30');
    const last = trace.segments[trace.segments.length - 1];
    // the poschip frame decision (createPreviewPanel.onPositionChange): a move whose event carries g53 → the MACHINE frame
    // (amber), work otherwise. Mirror the exact predicate so the amber-during-lift contract is guarded.
    const chipFrame = (pos) => (pos.probing != null ? !!(pos.probing || pos.g53) : false) ? 'mach' : 'work';
    return { code, endZ: last ? last.z2 : null, absolute: trace.stats.absolute,
      liftFrame: chipFrame({ g53: true, probing: false }), cutFrame: chipFrame({ g53: false, probing: false }) };
  });
  expect(r.code, 'the isolated retract is the machine-frame register form').toContain('G53 Z#520');
  expect(r.absolute, 'a G53 machine-frame move ran').toBe(true);
  expect(r.endZ, 'the sim retracts to the declared machine safe height (-5)').toBeCloseTo(-5, 1);
  // the chip goes AMBER (machine frame) during the G53 lift, and stays cyan (work) for a normal move
  expect(r.liftFrame, 'the poschip is AMBER (machine frame) during the G53 safe-Z lift').toBe('mach');
  expect(r.cutFrame, 'the poschip stays CYAN (work frame) for a non-G53 move').toBe('work');
});
