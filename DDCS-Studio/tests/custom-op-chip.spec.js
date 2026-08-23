import { test, expect } from '@playwright/test';

/**
 * REGRESSION (ROADMAP Gaps #11): a custom op MUST get an editor op-chip — the headline custom-wizard loop
 * (make a wizard → insert → its chip renders → ✎ Edit → its form opens). The codebase had NO test that a custom op
 * commits as an editable 'op' block and gets a chip; #11 stayed "confirmed-but-unreproducible" because of that gap.
 *
 * The break #11 hypothesised — a builder-LESS op (`builderOf` undefined → `commitActiveOp` false → `commitDecodedCode`
 * decodes loose atoms with NO 'op' wrapper → no chip) — can't fire now: the wizard-to-blocks port gave EVERY built-in a
 * builder, and forking a built-in registers one via `createWizard → createUserOp`. These two tests pin that down with
 * the REAL flows (a plain custom op + the actual Save-as-wizard "fork Tool Length"), asserting the chip appears in the
 * persistent row. If a future change reintroduces a builder-less commit path, the chip dies and these go red.
 *
 * t-opchips — REWRITTEN for the persistent row: the chip used to be hover-revealed (had to mouse over the op's own
 * line to see it); it's just PRESENT now, found by the op's own id — no hover scan needed.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// Find the op record matching `opMatch`, then its own chip in the persistent row by data-op-id.
async function chipFor(page, opMatch) {
  return page.evaluate((re) => {
    const prog = window.ddcsGetBlockProgram() || [];
    const op = prog.filter((b) => b && b.type === 'op').find((b) => new RegExp(re).test(b.opType || ''));
    if (!op) return { customFound: false };
    const c = document.querySelector(`.op-chip[data-op-id="${op.id}"]`);
    return { customFound: true, opType: op.opType, chipTitle: c ? c.title : null, chipDisabled: c ? c.disabled : null };
  }, opMatch);
}

test('a plain custom op → insert → the editor shows its ✎ Edit chip', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const template = [{ type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } }];
    U.createUserOp(U.userOpFromStack('asis', 'As Is', template, U.extractParamBlocks(template, new Set(), true), 'form3d'));
  });
  await page.evaluate(() => window.openWiz('user_asis'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
  await page.waitForTimeout(150);

  const committed = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op' && b.opType === 'user_asis'));
  expect(committed, 'the custom op commits AS an editable op block (not loose atoms)').toBe(true);

  const r = await chipFor(page, '^user_asis$');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(r.customFound).toBe(true);
  expect(r.chipTitle, 'the custom op gets its own chip, tooltip carrying the label').toContain('As Is');
  expect(r.chipDisabled, 'a custom op is editable (chip enabled)').toBe(false);
});

test('fork a built-in ("Tool Length") via Save-as-wizard → insert the fork → its ✎ Edit chip shows', async ({ page }) => {
  const alerts = [];
  page.on('dialog', (d) => { alerts.push(d.message()); d.accept(); });
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.insertWiz && window.closeWiz && window.showApp && window.ddcsGetBlockProgram);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // insert the built-in Tool Length op, open Blocks (mounts the authoring surface), Save-as-wizard it (the real fork).
  await page.evaluate(async () => { window.openWiz('atc_length', undefined, true); window.updateWiz && window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz(); });
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws, { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const m = document.querySelector('.blk-dev-savedlg');
    m.querySelector('.blk-dev-opname').value = 'Tool Length Copy';
    m.querySelector('.blk-dev-save').click();
  });
  await page.waitForTimeout(250);

  const reg = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const ob = await import('/blocks/opBuilders.js');
    const f = U.listUserOps().find((d) => /tool_length/.test(d.opType));
    return { forkedType: f && f.opType, builder: f ? !!ob.builderOf(f.opType) : false };
  });
  expect(reg.forkedType, 'the fork registered as a user op').toBeTruthy();
  expect(reg.builder, 'the fork has a builder (forking captures the stack → createUserOp registers one)').toBe(true);

  // open the fork, insert it, hover → chip. t1944 — a fresh insert: the canvas still has the ORIGINAL atc_length
  // op from line 70 (t1942: Insert on a non-empty canvas now confirms; this test is about the fork's own chip,
  // not that dialog).
  await page.evaluate(() => window.ddcsLoadBlockStack([]));
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(100);
  await page.evaluate((t) => window.openWiz(t), reg.forkedType);
  // the #wiz_user visibility check is flaky right after a blocks→editor view switch, but the open/insert path still
  // runs (proven by trace) — soft-wait, then proceed and assert on the real outcome (the committed op + the chip).
  try { await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 4000 }); } catch (_) { /* proceed anyway */ }
  await page.waitForTimeout(150);
  await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
  await page.waitForTimeout(150);

  const committed = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).some((b) => b && b.type === 'op' && /tool_length/.test(b.opType || '')));
  expect(committed, 'the forked op commits AS an op block').toBe(true);

  const r = await chipFor(page, 'tool_length');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(r.customFound).toBe(true);
  expect(r.chipTitle, 'the forked op gets its own chip, tooltip carrying its label').toContain('Tool Length Copy');
});
