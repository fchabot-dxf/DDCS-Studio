import { test, expect } from '@playwright/test';

// INC-B2 — the ONE-EMITTER hardened reference bar. The callMacro=false INLINE fallback (generic/disk) no longer
// hand-rolls an ASSUMED drawbar dance; it emits the SAME executable body as ⚙ Generate T.nc (tncProgram, {body:true}),
// sourcing the drawbar/sensor codes from the user's Settings → ATC I/O. These 6 VERIFY points pin that vs INDEPENDENT
// truth (not twin-vs-self): user-codes-appear · body≡generator · T#M6-byte-identical · marker-round-trip · freshness ·
// reconcile-over-RAW (clean null, never garbage).
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack);
});

const ATC = { magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }] };

// VERIFY (1) — the inline body sources the USER's declared drawbar codes (fails on the old hardcoded M154/M155 dance).
test('INC-B2 (1): the inline body sources the USER drawbar codes, not the assumed M154/M155', async ({ page }) => {
  const em = await page.evaluate(async (atc) => {
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    // NON-default release/clamp codes → they MUST appear (and the old assumed M154/M155 must NOT).
    const outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }];
    return emitMapped(atcChangeStack({ method: 'generic', callMacro: false, _atc: atc, _outputs: outputs, _inputs: [] })).text;
  }, ATC);
  expect(em, 'the user release code M54 appears').toContain('M54');
  expect(em, 'the user clamp code M55 appears').toContain('M55');
  expect(em, 'the OLD assumed drawbar release M154 is gone').not.toContain('M154');
  expect(em, 'the OLD assumed drawbar clamp M155 is gone').not.toContain('M155');
});

// VERIFY (2) — the inline body's EXECUTABLE program == the ⚙ Generate T.nc executable program, modulo the wrapper
// (O-header / M99) and comment wording. Compared against the LIVE generator output (one emitter), for BOTH routes.
test('INC-B2 (2): inline body ≡ the ⚙ Generate T.nc body, modulo the O-header/M99 wrapper', async ({ page }) => {
  const r = await page.evaluate(async (atc) => {
    const { tncProgram } = await import('/wizards/atcModel.js');
    const io = { outputs: [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }], inputs: [] };
    // executable = drop comment-only lines + the O-header + the M99 wrapper line
    const exe = (s) => (s || '').split('\n').filter((l) => {
      const t = l.trim();
      return t && !/^\(.*\)$/.test(t) && !/^O\d+/.test(t) && t !== 'M99';
    });
    const hasM99 = (s) => (s || '').split('\n').some((l) => l.trim() === 'M99');
    const hasO = (s) => (s || '').split('\n').some((l) => /^O\d+/.test(l.trim()));
    // linear route (no declared grip → generateToolChangeNc)
    const linFull = tncProgram(atc, io), linBody = tncProgram(atc, io, { body: true });
    // interpreter route (a declared drawbar changer → motionToTnc, which HAS an O-header wrapper)
    const dbAtc = { ...atc, grip: 'drawbar' };
    const dbFull = tncProgram(dbAtc, io), dbBody = tncProgram(dbAtc, io, { body: true });
    return {
      linExeEqual: JSON.stringify(exe(linBody)) === JSON.stringify(exe(linFull)),
      linFullM99: hasM99(linFull), linBodyM99: hasM99(linBody),
      dbExeEqual: JSON.stringify(exe(dbBody)) === JSON.stringify(exe(dbFull)),
      dbFullO: hasO(dbFull), dbBodyO: hasO(dbBody), dbFullM99: hasM99(dbFull), dbBodyM99: hasM99(dbBody),
    };
  }, ATC);
  // linear (generateToolChangeNc): executable identical; the standalone T.nc keeps M99, the inline body drops it.
  expect(r.linExeEqual, 'linear inline body executable == the ⚙ Generate T.nc executable').toBe(true);
  expect(r.linFullM99, 'the standalone linear T.nc ends with the M99 return').toBe(true);
  expect(r.linBodyM99, 'the linear inline body OMITS the M99 wrapper').toBe(false);
  // interpreter (motionToTnc): executable identical; the standalone macro has BOTH an O-header AND M99, the body drops both.
  expect(r.dbExeEqual, 'interpreter inline body executable == the ⚙ Generate T.nc executable').toBe(true);
  expect(r.dbFullO, 'the standalone interpreter macro has an O-header').toBe(true);
  expect(r.dbBodyO, 'the interpreter inline body OMITS the O-header').toBe(false);
  expect(r.dbFullM99, 'the standalone interpreter macro ends with M99').toBe(true);
  expect(r.dbBodyM99, 'the interpreter inline body OMITS the M99 wrapper').toBe(false);
});

// VERIFY (3) — the DEFAULT (callMacro=true) T# M6 emit is byte-UNCHANGED by INC-B2 (macroCallStack untouched).
test('INC-B2 (3): the default T# M6 emit is unchanged (only the inline fallback changed)', async ({ page }) => {
  const r = await page.evaluate(async (atc) => {
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const gen = emitMapped(atcChangeStack({ method: 'generic', fixedT: 2, _atc: atc, callMacro: true })).text;
    const disk = emitMapped(atcChangeStack({ method: 'disk', fixedT: 5, _atc: atc, callMacro: true })).text;
    return { gen, disk };
  }, ATC);
  expect(r.gen, 'generic default = a T2 M6 call').toMatch(/^T2 M6$/m);
  expect(r.gen, 'generic default carries the install note').toContain('call the installed T.nc macro');
  expect(r.gen, 'generic default is NOT the inline body').not.toContain('#1504');
  expect(r.disk, 'disk default = a T5 M6 call').toMatch(/^T5 M6$/m);
});

// VERIFY (4) — the @DDCS marker round-trips the DECLARED op identity (method + fixedT + callMacro).
test('INC-B2 (4): the marker round-trips method + fixedT + callMacro for an inline op', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    const line = markerLine('atc_change', { method: 'generic', fixedT: 2, callMacro: false });
    return { line, parsed: parseMarker(line) };
  });
  expect(r.line, 'the marker rides as a @DDCS comment').toMatch(/@DDCS/);
  expect(r.parsed.opType).toBe('atc_change');
  expect(r.parsed.params, 'method + fixedT + callMacro recover on load').toMatchObject({ method: 'generic', fixedT: 2, callMacro: false });
});

// VERIFY (5) — FRESHNESS (graft ii): re-emitting after the drawbar code CHANGES yields the NEW code, not a stale one.
test('INC-B2 (5): re-emit after a code change is FRESH (the inline body reads the codes each emit)', async ({ page }) => {
  const r = await page.evaluate(async (atc) => {
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const emit = (on) => emitMapped(atcChangeStack({ method: 'generic', callMacro: false, _atc: atc, _outputs: [{ type: 'drawbar', onCode: on, offCode: 'M55' }], _inputs: [] })).text;
    return { first: emit('M54'), second: emit('M56') };
  }, ATC);
  expect(r.first, 'first emit uses M54').toContain('M54');
  expect(r.second, 're-emit after the code changed uses the NEW M56').toContain('M56');
  expect(r.second, 're-emit no longer carries the old M54').not.toContain('M54');
});

// VERIFY (6) — the Blocks reverse-sync over the new RAW inline stack returns a CLEAN null (benign no-op), never garbage.
test('INC-B2 (6): reconcile over the RAW inline stack → clean null (never garbage fields)', async ({ page }) => {
  const nulled = await page.evaluate(async (atc) => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    rec.recordOp('atc_change', { method: 'generic', fixedT: 2, callMacro: false, _atc: atc, _outputs: [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }], _inputs: [] });
    const built = ops.buildActiveOpStack();
    window.ddcsLoadBlockStack(built.blocks);
    return ops.reconcileActiveOp();   // the atc_change reconciler finds no #100 target table → returns null
  }, ATC);
  expect(nulled, 'the inline body has no #100 model → the reconciler cleanly declines (no garbage fields)').toBeNull();
});
