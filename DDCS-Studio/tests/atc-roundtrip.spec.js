import { test, expect } from '@playwright/test';

// Round-trip wiring for the 6 ATC wizards (the project invariant: every op surfaces as a block + emit +
// reverse-sync). Each op: recordOp → BUILDERS.<type> stack → load into the block program → reconcile back to the
// FORM FIELDS. Drives the reconciler exactly the way wizardManager.pullFromBlocks does after a Blocks-tab edit.
test.use({ viewport: { width: 1000, height: 800 } });

const MAG = [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }];

async function roundTrip(page, type, params) {
  return page.evaluate(async ({ type, params }) => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    rec.recordOp(type, params);
    const built = ops.buildActiveOpStack();        // sets shownOp = type, returns [progstart, op, progend]
    if (!built) return { err: 'no op stack — type not in BUILDERS' };
    window.ddcsLoadBlockStack(built.blocks);
    return ops.reconcileActiveOp();                 // block program → form fields
  }, { type, params });
}

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack);
});

test('atc_warmup round-trips its RPM / dwell stages', async ({ page }) => {
  const r = await roundTrip(page, 'atc_warmup', { rpm1: 6000, time1: 30, rpm2: 12000, time2: 45 });
  expect(r.type).toBe('atc_warmup');
  expect(r.fields).toMatchObject({ atc_warmup_rpm1: 6000, atc_warmup_time1: 30, atc_warmup_rpm2: 12000, atc_warmup_time2: 45 });
});

test('atc_check round-trips the tolerance', async ({ page }) => {
  const r = await roundTrip(page, 'atc_check', { tolerance: 0.7 });
  expect(r.type).toBe('atc_check');
  expect(r.fields.atc_check_tol).toBe(0.7);
});

test('atc_change round-trips every change method', async ({ page }) => {
  // M6 (default, recommended): safe park + delegated M6, target tool carried on the M6 note.
  const m6 = await roundTrip(page, 'atc_change', { method: 'm6', zClear: 5, fixedT: 2 });
  expect(m6.fields).toMatchObject({ atc_change_method: 'm6', atc_change_fixedt: 2, atc_change_zclear: 5 });

  // Firmware: the O10102 push station + M19 orient toggle. INC-B — the method identity round-trips through the INLINE
  // dance (callMacro:false), where the method-specific G-code (O10102/Z#1306) exists to reverse-parse.
  const fw = await roundTrip(page, 'atc_change', { method: 'firmware', orient: true, callMacro: false });
  expect(fw.fields).toMatchObject({ atc_change_method: 'firmware', atc_change_orient: true });
  const fwNoOrient = await roundTrip(page, 'atc_change', { method: 'firmware', orient: false, callMacro: false });
  expect(fwNoOrient.fields).toMatchObject({ atc_change_method: 'firmware', atc_change_orient: false });

  // Manual park.
  const man = await roundTrip(page, 'atc_change', { method: 'manual', x: 123, y: 234, z: 12 });
  expect(man.fields).toMatchObject({ atc_change_method: 'manual', atc_change_x: 123, atc_change_y: 234, atc_change_z: 12 });

  // Generic INLINE (callMacro:false) — INC-B2: the inline body is now the one-source tncProgram (method-agnostic —
  // generic vs disk route on the CONFIGURED changer, not the method label), so the block reverse-sync no longer has a
  // #100 target table to reverse-parse → a benign NO-OP (reconcile → null; the form keeps its values; method identity
  // lives in the declared params/marker, not the emit). SAME declare-not-infer posture as the T# M6 default below.
  const gen = await roundTrip(page, 'atc_change', { method: 'generic', magazine: MAG, zClear: 7, fixedT: 2, waitSpindle: true, dustCover: true, confirm: true, callMacro: false });
  expect(gen, 'generic inline reverse-syncs as a benign no-op (one-source body has no #100 model to parse)').toBeNull();

  // INC-B — the DEFAULT automatic emit is a method-agnostic `T# M6` call to the installed T.nc. It carries no
  // method-specific G-code, so the block reverse-sync is a benign NO-OP (reconcile → null → pullFromBlocks keeps the
  // form as-is; the op's params stay intact via the op record). The method identity lives in the declared params, not
  // the emit. (If we later want the T-word edited in Blocks to push back to the form, that's a small reconciler add.)
  const call = await roundTrip(page, 'atc_change', { method: 'firmware' });
  expect(call, 'a T# M6 call op reverse-syncs as a benign no-op (nothing method-specific in the emit to parse)').toBeNull();

  // Backward-compat: an OLD saved op (mode/magType, no method) still emits. Manual reverse-parses to its method; the auto
  // variants (mode:'auto' → generic/disk) now emit the one-source inline body → a benign no-op reconcile (see gen above).
  const legacyManual = await roundTrip(page, 'atc_change', { mode: 'manual', x: 1, y: 2, z: 3 });
  expect(legacyManual.fields.atc_change_method).toBe('manual');
  const legacyAuto = await roundTrip(page, 'atc_change', { mode: 'auto', magazine: MAG, fixedT: 2, callMacro: false });
  expect(legacyAuto, 'legacy auto inline reverse-syncs as a benign no-op').toBeNull();
  const legacyDisk = await roundTrip(page, 'atc_change', { mode: 'auto', magType: 'disk', magazine: MAG, pickup: { x: 5, y: 6, z: -2 }, fixedT: 2, callMacro: false });
  expect(legacyDisk, 'legacy disk inline reverse-syncs as a benign no-op').toBeNull();
});

test('atc_change automatic methods emit a T# M6 CALL by default; callMacro=false keeps the firmware-accurate inline dance', async ({ page }) => {
  const emit = (params) => page.evaluate(async (params) => {
    const w = await import('/wizards/atcChangeWizard.js');
    const bm = await import('/blocks/blockEmitter.js');
    return bm.emitMapped(w.atcChangeStack(params)).text;
  }, params);

  const m6 = await emit({ method: 'm6', zClear: 5, fixedT: 3, x: 50, y: 60 });
  expect(m6).toMatch(/\bM6\b/);
  expect(m6).toMatch(/G53 X#103/);   // change-position move

  // INC-B: the AUTOMATIC methods (firmware/generic/disk) DEFAULT to a T# M6 call to the installed T.nc.
  const fwCall = await emit({ method: 'firmware', fixedT: 4 });
  expect(fwCall).toMatch(/^T4 M6$/m);                              // T-word requested tool + M6 fires the installed macro
  expect(fwCall).toContain('call the installed T.nc macro');       // the header note
  expect(fwCall).not.toContain('G53 X#1320');                      // NOT the inline O10102 dance
  const genCall = await emit({ method: 'generic', fixedT: 2, magazine: MAG });
  expect(genCall).toMatch(/^T2 M6$/m);
  const diskCall = await emit({ method: 'disk', fixedT: 5, magazine: MAG, pickup: { x: 5, y: 5, z: -3 } });
  expect(diskCall).toMatch(/^T5 M6$/m);
  // fixedT 0 → the tool comes from a preceding program M6 Txx → a bare M6 call.
  const fromProg = await emit({ method: 'firmware', fixedT: 0 });
  expect(fromProg).toMatch(/^M6$/m);
  expect(fromProg).not.toMatch(/^T\d+ M6$/m);

  // callMacro=false → the firmware-accurate O10102 fixed-station push dance (the inline fallback — byte-untouched).
  const fw = await emit({ method: 'firmware', orient: true, callMacro: false });
  expect(fw).toContain('G53 Z#1306 F#563');
  expect(fw).toContain('G53 X#1320 Y#1321 F#563');
  expect(fw).toContain('G04 P#1322');
  expect(fw).toContain('G53 X#1323 Y#1324 F#1327');
  expect(fw).toContain('G53 X#1325 Y#1326 F#563');
  expect(fw).toMatch(/^M19$|\nM19\b/m);
});

test('atc_test round-trips drawbar + pocket dry-run', async ({ page }) => {
  const db = await roundTrip(page, 'atc_test', { mode: 'drawbar', cycles: 5, dwellMs: 700 });
  expect(db.fields).toMatchObject({ atc_test_mode: 'drawbar', atc_test_cycles: 5, atc_test_dwell: 700 });

  const pk = await roundTrip(page, 'atc_test', { mode: 'pockets', magazine: MAG, first: 1, count: 2, zClear: 9, descend: true });
  expect(pk.fields).toMatchObject({ atc_test_mode: 'pockets', atc_test_zclear: 9, atc_test_descend: true, atc_test_first: 1, atc_test_count: 2 });
});

test('atc_table round-trips the include-lengths / include-pockets toggles', async ({ page }) => {
  const r = await roundTrip(page, 'atc_table', { tools: [{ num: 1, length: 40 }], magazine: MAG, includeLengths: true, includePockets: false });
  expect(r.type).toBe('atc_table');
  expect(r.fields).toMatchObject({ atc_table_lengths: true, atc_table_pockets: false });
});

test('atc_length is registered for reverse-sync (no editable form fields)', async ({ page }) => {
  const r = await roundTrip(page, 'atc_length', {});
  expect(r, 'reconciler ran').not.toBeNull();
  expect(r.type).toBe('atc_length');
  expect(r.fields).toEqual({});   // all params come from Settings → Probes/ATC; nothing to reverse-sync
});

test('every ATC op has a BUILDERS stack AND a reconciler', async ({ page }) => {
  const missing = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    const types = ['atc_length', 'atc_check', 'atc_warmup', 'atc_change', 'atc_test', 'atc_table'];
    const bad = [];
    for (const t of types) {
      rec.recordOp(t, {});
      const built = ops.buildActiveOpStack();
      if (!built) { bad.push(t + ':no-builder'); continue; }
      window.ddcsLoadBlockStack(built.blocks);
      if (ops.reconcileActiveOp() == null) bad.push(t + ':no-reconciler');
    }
    return bad;
  });
  expect(missing, 'all ATC ops build + reconcile').toEqual([]);
});
