import { test, expect } from '@playwright/test';

/**
 * t2415 (BACKLOG #23) — an author-declared SWITCHABLE child persists its disabled state, closing the hazard
 * t2307's own `disableGuard.js` could only REFUSE until now ("the toggles add a capability; the refusal
 * removes the danger — do the refusal first" — the owner's own sequencing, t2307 built the refusal, this turn
 * builds the toggle it promised as the escape hatch).
 *
 * THE MECHANISM (an application of the SAME shipped machinery corner's own `probeZFirst` already proves, not
 * new design): drill's ONE switchable child — the `holecycle` atom, which stamps the whole pattern (an
 * `array{drill}` in the old shape) — is wrapped in a `guard` in the def's own template (drillData.js's
 * `guardHolePattern`), keyed to a new STRUCTURAL binding (`holesEnabled`, no blockIndex/match — drives the
 * prune, not a value socket, `DRILL_STRUCT_BINDINGS`). Right-clicking Disable Block on `holecycle` (the SAME
 * native Blockly gesture t2307's own test already drives) is synced into `holesEnabled` by a listener in
 * blocksApp.js — found NOT by walking the disabled block's live canvas parent (the guard is TRANSPARENT there;
 * pruneGuards already unwrapped it at instantiate time for the default/kept case, confirmed live before this
 * was built) but by looking up the op's own REGISTRY def, whose template still carries the guard
 * (`findGuardWhenForBlockType`, shared with disableGuard.js so the two can never disagree about which
 * children are switchable). `disableGuard.js` itself now skips its own refusal for exactly this case — the
 * premise it refuses on ("this state was never going to persist") is false for a declared-switchable child.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function bootPlacedDrill(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.evaluate(async () => {
    const { _framed, makeOp } = await import('/blocks/opBuilders.js');
    const { DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
    const params = { ...DRILL_DEFAULTS };
    const framed = _framed('user_drill_data', params);
    const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
    const op = makeOp('user_drill_data', params, bare);
    const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
    window.ddcsLoadBlockStack(stack);
  });
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
  await page.waitForTimeout(400);
}

test('disabling the pattern atom (holecycle) is NOT reverted, and persists holesEnabled:false in the model', async ({ page }) => {
  await bootPlacedDrill(page);
  const before = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.holesEnabled);
  expect(before).toBe(true);

  await page.evaluate(async () => {
    const ws = window.__blkws;
    const blk = ws.getAllBlocks(false).find((b) => b.type === 'holecycle');
    blk.setDisabledReason(true, 'MANUALLY_DISABLED');
    await new Promise((r) => setTimeout(r, 400));
  });

  // t2415 — the sync routes a STRUCTURAL param through mergeOpBlocks/replaceOp (the SAME rebuild sc_*
  // structural controls already use, not a light `.data`-only patch): the guard PRUNES the pattern away
  // immediately, matching the params — so `holecycle` is not "present but still disabled," it is GONE from
  // the live canvas, exactly as a fresh reimport with holesEnabled:false would build it. disableGuard.js's own
  // revert never gets a chance to matter here (the block it would have reverted no longer exists).
  const stillThere = await page.evaluate(() => !!window.__blkws.getAllBlocks(false).find((b) => b.type === 'holecycle'));
  expect(stillThere, 'the pruned pattern is removed from the live canvas, not left disabled-but-present').toBe(false);

  const after = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.holesEnabled);
  expect(after, 'holesEnabled synced to false in the canonical model').toBe(false);

  const gcode = await page.evaluate(() => window.ddcsGetBlockGcode());
  expect(gcode, 'the disabled pattern cuts nothing').not.toMatch(/Z-5/);
});

test('re-enabling via the holesEnabled form checkbox restores the pattern and holesEnabled:true', async ({ page }) => {
  await bootPlacedDrill(page);
  await page.evaluate(async () => {
    const ws = window.__blkws;
    const blk = ws.getAllBlocks(false).find((b) => b.type === 'holecycle');
    blk.setDisabledReason(true, 'MANUALLY_DISABLED');
    await new Promise((r) => setTimeout(r, 400));
  });
  // t2415 — holecycle is gone from the canvas now (see the test above); re-enabling has to go through the
  // FORM's own holesEnabled checkbox (the same field a real operator would use), not a since-removed block.
  await page.evaluate(async () => {
    const el = document.querySelector('[data-param="holesEnabled"]');
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
  });
  const after = await page.evaluate(() => window.ddcsGetBlockProgram().find((b) => b.type === 'op').params.holesEnabled);
  expect(after, 'the checkbox write-back restores holesEnabled:true').toBe(true);
  const restored = await page.evaluate(() => !!window.__blkws.getAllBlocks(false).find((b) => b.type === 'holecycle'));
  expect(restored, 'the pattern atom is rebuilt onto the canvas').toBe(true);
});

test('the full export→reimport round trip: disabled survives opFromMarker', async ({ page }) => {
  await bootPlacedDrill(page);
  await page.evaluate(async () => {
    const ws = window.__blkws;
    const blk = ws.getAllBlocks(false).find((b) => b.type === 'holecycle');
    blk.setDisabledReason(true, 'MANUALLY_DISABLED');
    await new Promise((r) => setTimeout(r, 400));
  });
  const result = await page.evaluate(async () => {
    const { opFromMarker } = await import('/blocks/programModel.js');
    const params = window.ddcsGetBlockProgram().find((b) => b.type === 'op').params;
    const reimported = opFromMarker('user_drill_data', params);
    return { holesEnabled: params.holesEnabled, reimportedHolesEnabled: reimported && reimported.params && reimported.params.holesEnabled };
  });
  expect(result.holesEnabled, 'exported params carry the disabled state').toBe(false);
  expect(result.reimportedHolesEnabled, 'opFromMarker regenerates the op still disabled — the reimport does NOT silently re-enable it').toBe(false);
});

test('regression: an UNDECLARED child (wcs) is still refused by disableGuard.js, unchanged', async ({ page }) => {
  await bootPlacedDrill(page);
  const childId = await page.evaluate(() => {
    const ws = window.__blkws;
    // t2415 — progstart/progend are TOP-LEVEL siblings of the op (opBuilders.js's own _framed lifts them out),
    // not children of it — disableGuard.js's own enclosingOp() walk correctly finds no enclosing op for them,
    // so they were never in EITHER guard's scope (a different, already-out-of-scope case, not this one). `wcs`
    // is a genuine child (inside op → user_root → …) with no declared guard, the real undeclared-child case.
    const blk = ws.getAllBlocks(false).find((b) => b.type === 'wcs');
    if (!blk) return null;
    blk.setDisabledReason(true, 'MANUALLY_DISABLED');
    return blk.id;
  });
  expect(childId).not.toBeNull();
  await page.waitForFunction((id) => {
    const blk = window.__blkws.getBlockById(id);
    return blk && !blk.hasDisabledReason('MANUALLY_DISABLED');
  }, childId, { timeout: 5000 });
  const disabledAfter = await page.evaluate((id) => window.__blkws.getBlockById(id).hasDisabledReason('MANUALLY_DISABLED'), childId);
  expect(disabledAfter, 'an undeclared child is still reverted, exactly as t2307 shipped').toBe(false);
});

test('regression: emit is byte-identical to the legacy drillStack when nothing is disabled', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const { instantiate } = await import('/blocks/userOps.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { drillStack } = await import('/wizards/stacks/drillWizard.js');
    const { drillDataDef, DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
    const def = drillDataDef();
    const dataText = emitMapped(instantiate(def, DRILL_DEFAULTS)).text;
    const legacyText = emitMapped(drillStack(DRILL_DEFAULTS)).text;
    return { equal: dataText === legacyText };
  });
  expect(r.equal, 'holesEnabled default true keeps the guard\'s own kept/unwrapped shape byte-identical').toBe(true);
});
