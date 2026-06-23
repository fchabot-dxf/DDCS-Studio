import { test, expect } from '@playwright/test';

// Round-trip wiring for the 6 ATC wizards (the project invariant: every op surfaces as a block + emit +
// reverse-sync). Each op: recordOp → BUILDERS.<type> stack → load into the block program → reconcile back to the
// FORM FIELDS. Drives the reconciler exactly the way wizardManager.pullFromBlocks does after a Blocks-tab edit.
test.use({ viewport: { width: 1000, height: 800 } });

const MAG = [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }];

async function roundTrip(page, type, params) {
  return page.evaluate(async ({ type, params }) => {
    const ops = await import('/blocks/opStacks.js');
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

test('atc_change round-trips manual park + auto pick&place', async ({ page }) => {
  const man = await roundTrip(page, 'atc_change', { mode: 'manual', x: 123, y: 234, z: 12 });
  expect(man.fields).toMatchObject({ atc_change_mode: 'manual', atc_change_x: 123, atc_change_y: 234, atc_change_z: 12 });

  const auto = await roundTrip(page, 'atc_change', { mode: 'auto', magazine: MAG, zClear: 7, fixedT: 2, waitSpindle: true, dustCover: true, confirm: true });
  expect(auto.fields).toMatchObject({ atc_change_mode: 'auto', atc_change_fixedt: 2, atc_change_zclear: 7, atc_change_m300: true, atc_change_cover: true, atc_change_confirm: true });

  // "From program (M6 Txx)" → #100 is a #var, so fixedT reads back as 0 (and the toggles are off).
  const prog = await roundTrip(page, 'atc_change', { mode: 'auto', magazine: MAG, zClear: 0, fixedT: 0, waitSpindle: false, dustCover: false, confirm: false });
  expect(prog.fields).toMatchObject({ atc_change_mode: 'auto', atc_change_fixedt: 0, atc_change_m300: false, atc_change_cover: false, atc_change_confirm: false });
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
    const ops = await import('/blocks/opStacks.js');
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
