import { test, expect } from '@playwright/test';

/**
 * STRUCTURAL-CONTROL blocks (t154, item d MINIMAL). corner's STRUCTURAL section holds one control per structural param
 * (probeZFirst/travelApproach/wcs/syncA/corner/probeSeq) — GENERATED to REFLECT THE WIZARD FORM (they MUST match
 * CORNER_STRUCT_BINDINGS, the same source the runtime form renders from). They emit NOTHING; toggling one DRIVES the guards
 * (a live reprune of the preview) via replaceOp; they round-trip; and they keep their set value across the reprune.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

// (1) REFLECT THE FORM — the sc_* block defs match CORNER_STRUCT_BINDINGS exactly (one source, no drift).
test('(1) the structural-control blocks reflect CORNER_STRUCT_BINDINGS (param, kind, options)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { STRUCT_CTL_BLOCKS } = await import('/wizards/ops/structCtl.js');
    const { CORNER_STRUCT_BINDINGS } = await import('/blocks/dataOps/cornerData.js');
    const byParam = Object.fromEntries(STRUCT_CTL_BLOCKS.map((b) => [b.structParam, b]));
    const mism = [];
    for (const bind of CORNER_STRUCT_BINDINGS) {
      const blk = byParam[bind.param];
      if (!blk) { mism.push(bind.param + ':missing'); continue; }
      const wantOpts = bind.type === 'bool' ? null : (bind.widgetConfig && bind.widgetConfig.options) || null;
      if (JSON.stringify(blk._options) !== JSON.stringify(wantOpts)) mism.push(bind.param + ':options');
      if ((blk._options ? 'select' : 'toggle') !== (bind.type === 'bool' ? 'toggle' : 'select')) mism.push(bind.param + ':kind');
      if (blk.label !== bind.label) mism.push(bind.param + ':label');
      const wantDflt = bind.type === 'bool' ? !!bind.default : bind.default;   // t156 (agent-2 residual) — the DEFAULT is one-source too
      if (JSON.stringify(blk.defaults.value) !== JSON.stringify(wantDflt)) mism.push(bind.param + ':default');
    }
    return { count: STRUCT_CTL_BLOCKS.length, bindCount: CORNER_STRUCT_BINDINGS.length, mism };
  });
  expect(r.count, 'one control per structural binding').toBe(r.bindCount);
  expect(r.mism, 'every control matches its binding (param/kind/options/label)').toEqual([]);
});

async function openCornerBlocks(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(async () => { const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js'); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef()); });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_corner_data'));
  await page.waitForSelector('#wiz_user_form', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(500);
}

// (2) the STRUCTURAL section shows the 6 controls, seeded at the binding defaults
test('(2) the STRUCTURAL section shows the 6 controls at their defaults', async ({ page }) => {
  await openCornerBlocks(page);
  const ctls = await page.evaluate(() => Object.fromEntries(window.__blkws.getAllBlocks().filter((b) => b.type.indexOf('sc_') === 0).map((b) => [b.type, b.getFieldValue('VALUE')])));
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(Object.keys(ctls).sort()).toEqual(['sc_corner', 'sc_probeseq', 'sc_probezfirst', 'sc_synca', 'sc_travelapproach', 'sc_wcs']);
  expect(ctls.sc_probezfirst).toBe('FALSE');
  expect(ctls.sc_corner).toBe('FL');
  expect(ctls.sc_wcs).toBe('active');
});

// (3) DRIVES-GUARDS LIVE + keeps its value — toggling probeZFirst reprunes the preview (Z arm appears) and stays set
test('(3) toggling probeZFirst reprunes the preview live and the control keeps its value', async ({ page }) => {
  await openCornerBlocks(page);
  const gcode = () => page.evaluate(() => (document.getElementById('blk-gcode') || {}).textContent || '');
  const before = await gcode();
  expect(/Z Surface/i.test(before), 'default (probeZ off) has no Z-Surface').toBeFalsy();
  await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'sc_probezfirst'); b.setFieldValue('TRUE', 'VALUE'); });
  await page.waitForTimeout(700);
  const after = await gcode();
  expect(/Z Surface/i.test(after), 'toggling probeZFirst repruned live → the Z-Surface arm now emits').toBeTruthy();
  // the control kept its set value across the reprune (applyStructCtl re-synced it, no snap-back)
  const kept = await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'sc_probezfirst'); return b && b.getFieldValue('VALUE'); });
  expect(kept, 'the toggle keeps its value after the reprune').toBe('TRUE');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// (4) BYTE-PARITY — the controls emit nothing: at a fixed structural value the twin == cornerStack (spot-check via the op emit)
test('(4) the structural controls emit nothing (byte-parity preserved)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const def = CD.cornerDataDef(); registerUserOp(def);
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CD.CORNER_DEFAULTS, ...o });
    const em = (fn, p) => emitMapped(fn(p)).text;
    return { off: em(build, S({ probeZFirst: 0 })) === em(cornerStack, S({ probeZFirst: 0 })), on: em(build, S({ probeZFirst: 1 })) === em(cornerStack, S({ probeZFirst: 1 })) };
  });
  expect(r.off, 'probeZ off: twin == cornerStack (controls emit nothing)').toBe(true);
  expect(r.on, 'probeZ on: twin == cornerStack (controls emit nothing)').toBe(true);
});

// (5) NO CLOBBER (t156) — editing a VALUE socket then toggling a structural control MERGES (preserves the edit) instead of
//     replaceOp-ing from stale op.data. Without the isOpBlockEdited/mergeOpBlocks guard, the value edit reverts (spec RED).
test('(5) a value-socket edit survives a structural toggle (merge, not clobber)', async ({ page }) => {
  await openCornerBlocks(page);
  const gcode = () => page.evaluate(() => (document.getElementById('blk-gcode') || {}).textContent || '');
  // edit the #1 (Max probe distance) value socket: 500 → 250 (a live value edit that marks the op edited)
  const edited = await page.evaluate(() => {
    const ws = window.__blkws;
    const asn = ws.getAllBlocks().find((b) => b.type === 'assign' && b.getFieldValue('VAR') === '#1');
    if (!asn) return false;
    asn.setFieldValue('250', 'VALUE');   // the assign's value is a FIELD (not a socket) → set it directly
    return true;
  });
  expect(edited, 'found + edited the #1 value socket').toBe(true);
  await page.waitForTimeout(500);
  expect(/#1=250/.test(await gcode()), 'the value edit is live in the emit').toBeTruthy();
  // now toggle a structural control (probeZFirst)
  await page.evaluate(() => { const b = window.__blkws.getAllBlocks().find((x) => x.type === 'sc_probezfirst'); b.setFieldValue('TRUE', 'VALUE'); });
  await page.waitForTimeout(800);
  const after = await gcode();
  // (a) the value edit is PRESERVED (merge, not clobbered back to 500) AND (b) the structural toggle still repruned
  expect(/#1=250/.test(after), 'the #1=250 value edit is preserved after the structural toggle (merged, not clobbered)').toBeTruthy();
  expect(/#1=500/.test(after), 'the value did NOT revert to the default').toBeFalsy();
  expect(/Z Surface/i.test(after), 'the structural toggle still repruned (the Z arm changed)').toBeTruthy();
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
