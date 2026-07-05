import { test, expect } from '@playwright/test';

// INC-B2 / INC-B2b — the ONE-EMITTER hardened reference bar. The callMacro=false INLINE fallback (generic/disk) emits
// the SAME executable body as ⚙ Generate T.nc (tncProgram, {body:true}), sourcing the drawbar/sensor codes LIVE from
// the user's Settings → ATC I/O (4b — read at emit via ddcsGetSettings, NEVER snapshotted into the op/marker). Pins vs
// INDEPENDENT truth: user-codes · body≡generator · T#M6-unchanged · marker(round-trip + NO snapshot) · freshness ·
// reconcile-clean-null · RELOAD-freshness.
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.ddcsGetSettings);
});

const ATC = { magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }] };

// VERIFY (1) — the inline body sources the USER's LIVE drawbar codes (fails on the old hardcoded M154/M155 dance).
test('INC-B2 (1): the inline body sources the USER drawbar codes (live), not the assumed M154/M155', async ({ page }) => {
  const em = await page.evaluate(async (atc) => {
    const s = window.ddcsGetSettings(); s.atc = atc; s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }]; s.inputs = [];
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return emitMapped(atcChangeStack({ method: 'generic', callMacro: false })).text;
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
    const exe = (s) => (s || '').split('\n').filter((l) => {
      const t = l.trim();
      return t && !/^\(.*\)$/.test(t) && !/^O\d+/.test(t) && t !== 'M99';
    });
    const hasM99 = (s) => (s || '').split('\n').some((l) => l.trim() === 'M99');
    const hasO = (s) => (s || '').split('\n').some((l) => /^O\d+/.test(l.trim()));
    const linFull = tncProgram(atc, io), linBody = tncProgram(atc, io, { body: true });
    const dbAtc = { ...atc, grip: 'drawbar' };
    const dbFull = tncProgram(dbAtc, io), dbBody = tncProgram(dbAtc, io, { body: true });
    return {
      linExeEqual: JSON.stringify(exe(linBody)) === JSON.stringify(exe(linFull)),
      linFullM99: hasM99(linFull), linBodyM99: hasM99(linBody),
      dbExeEqual: JSON.stringify(exe(dbBody)) === JSON.stringify(exe(dbFull)),
      dbFullO: hasO(dbFull), dbBodyO: hasO(dbBody), dbFullM99: hasM99(dbFull), dbBodyM99: hasM99(dbBody),
    };
  }, ATC);
  expect(r.linExeEqual, 'linear inline body executable == the ⚙ Generate T.nc executable').toBe(true);
  expect(r.linFullM99, 'the standalone linear T.nc ends with the M99 return').toBe(true);
  expect(r.linBodyM99, 'the linear inline body OMITS the M99 wrapper').toBe(false);
  expect(r.dbExeEqual, 'interpreter inline body executable == the ⚙ Generate T.nc executable').toBe(true);
  expect(r.dbFullO, 'the standalone interpreter macro has an O-header').toBe(true);
  expect(r.dbBodyO, 'the interpreter inline body OMITS the O-header').toBe(false);
  expect(r.dbFullM99, 'the standalone interpreter macro ends with M99').toBe(true);
  expect(r.dbBodyM99, 'the interpreter inline body OMITS the M99 wrapper').toBe(false);
});

// VERIFY (3) — the DEFAULT (callMacro=true) T# M6 emit is byte-UNCHANGED by INC-B2 (macroCallStack untouched), and its
// target FOLLOWS the fixedT field (the T-word) — the T# M6 call CAN set a fixed tool where the inline body cannot.
test('INC-B2 (3): the default T# M6 emit is unchanged and its target follows fixedT', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    return {
      gen2: emitMapped(atcChangeStack({ method: 'generic', fixedT: 2, callMacro: true })).text,
      gen7: emitMapped(atcChangeStack({ method: 'generic', fixedT: 7, callMacro: true })).text,
      disk5: emitMapped(atcChangeStack({ method: 'disk', fixedT: 5, callMacro: true })).text,
    };
  });
  expect(r.gen2, 'generic default = a T2 M6 call').toMatch(/^T2 M6$/m);
  expect(r.gen7, 'the T# M6 target FOLLOWS fixedT (7)').toMatch(/^T7 M6$/m);
  expect(r.gen2, 'generic default carries the install note').toContain('call the installed T.nc macro');
  expect(r.gen2, 'generic default is NOT the inline body').not.toContain('#1504');
  expect(r.disk5, 'disk default = a T5 M6 call').toMatch(/^T5 M6$/m);
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

// VERIFY (5) — FRESHNESS: re-emitting after the LIVE drawbar code changes yields the NEW code (the body reads it each emit).
test('INC-B2 (5): re-emit after a live code change is FRESH', async ({ page }) => {
  const r = await page.evaluate(async (atc) => {
    const s = window.ddcsGetSettings(); s.atc = atc; s.inputs = [];
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }];
    const first = emitMapped(atcChangeStack({ method: 'generic', callMacro: false })).text;
    s.outputs = [{ type: 'drawbar', onCode: 'M56', offCode: 'M55' }];
    const second = emitMapped(atcChangeStack({ method: 'generic', callMacro: false })).text;
    return { first, second };
  }, ATC);
  expect(r.first, 'first emit uses M54').toContain('M54');
  expect(r.second, 're-emit after the code changed uses the NEW M56').toContain('M56');
  expect(r.second, 're-emit no longer carries the old M54').not.toContain('M54');
});

// VERIFY (6) — the Blocks reverse-sync over the new RAW inline stack returns a CLEAN null (benign no-op), never garbage.
test('INC-B2 (6): reconcile over the RAW inline stack → clean null (never garbage fields)', async ({ page }) => {
  const nulled = await page.evaluate(async (atc) => {
    const s = window.ddcsGetSettings(); s.atc = atc; s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }]; s.inputs = [];
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    rec.recordOp('atc_change', { method: 'generic', callMacro: false });   // no _atc — the body reads settings live (4b)
    const built = ops.buildActiveOpStack();
    window.ddcsLoadBlockStack(built.blocks);
    return ops.reconcileActiveOp();   // the atc_change reconciler finds no #100 target table → returns null
  }, ATC);
  expect(nulled, 'the inline body has no #100 model → the reconciler cleanly declines (no garbage fields)').toBeNull();
});

// VERIFY (7) — 4b ANTI-SNAPSHOT + RELOAD-FRESHNESS: the exported marker carries NO settings snapshot keys, and
// re-emitting after the live codes change yields the CURRENT codes (a reloaded file is never stale).
test('INC-B2b (7): the marker carries NO settings snapshot; re-emit uses the CURRENT live codes (reload-fresh)', async ({ page }) => {
  const r = await page.evaluate(async (atc) => {
    const s = window.ddcsGetSettings(); s.atc = atc; s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }]; s.inputs = [];
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    const pm = await import('/blocks/programModel.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
    rec.recordOp('atc_change', { method: 'generic', callMacro: false });   // the params the wizard now records (NO _atc)
    const built = ops.buildActiveOpStack();
    window.ddcsLoadBlockStack(built.blocks);
    const marker = pm.serializeWithMarkers().split('\n').find((l) => /@DDCS/.test(l)) || '';
    s.outputs = [{ type: 'drawbar', onCode: 'M56', offCode: 'M57' }];   // the user changes their drawbar code…
    const reEmit = emitMapped(atcChangeStack({ method: 'generic', callMacro: false })).text;   // …a reloaded op re-emits FRESH
    return { marker, reEmit };
  }, ATC);
  expect(r.marker, 'the inline op marker carries no _atc snapshot').not.toContain('_atc');
  expect(r.marker, 'no _outputs snapshot').not.toContain('_outputs');
  expect(r.marker, 'no _inputs snapshot').not.toContain('_inputs');
  expect(r.reEmit, 'reload/re-emit uses the CURRENT live drawbar code (M56)').toContain('M56');
  expect(r.reEmit, 'reload/re-emit no longer carries the old M54').not.toContain('M54');
});
