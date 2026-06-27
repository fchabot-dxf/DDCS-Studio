import { test, expect } from '@playwright/test';

/**
 * REGRESSION (ROADMAP Gaps #11): a custom op MUST get the editor hover-Edit ✎ chip — the headline custom-wizard loop
 * (make a wizard → insert → hover its G-code → ✎ Edit → its form opens). The codebase had NO test that a custom op
 * commits as an editable 'op' block and hover-resolves; #11 stayed "confirmed-but-unreproducible" because of that gap.
 *
 * The break #11 hypothesised — a builder-LESS op (`builderOf` undefined → `commitActiveOp` false → `commitDecodedCode`
 * decodes loose atoms with NO 'op' wrapper → no chip) — can't fire now: the wizard-to-blocks port gave EVERY built-in a
 * builder, and forking a built-in registers one via `createWizard → createUserOp`. These two tests pin that down with
 * the REAL flows (a plain custom op + the actual Save-as-wizard "fork Tool Length"), driving a real editor hover and
 * asserting the chip. If a future change reintroduces a builder-less commit path, the chip dies and these go red.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// Drive the editor: hover the op's first line (or scan a few lines) and read the floating #op-edit-chip.
async function chipFor(page, opMatch) {
  return page.evaluate(async (re) => {
    const prog = window.ddcsGetBlockProgram() || [];
    const op = prog.filter((b) => b && b.type === 'op').find((b) => new RegExp(re).test(b.opType || ''));
    if (!op) return { customFound: false };
    const ed = document.getElementById('editor');
    const lines = (window.ddcsLinesForOp && window.ddcsLinesForOp(op.id)) || [0];
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    for (const ln of (lines.length ? lines : [0])) {
      ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + ln * lh + lh / 2 - ed.scrollTop }));
      await new Promise((r) => setTimeout(r, 25));
      const c = document.getElementById('op-edit-chip');
      if (c && !c.hidden) return { customFound: true, opType: op.opType, chipText: c.textContent, chipDisabled: c.disabled };
    }
    return { customFound: true, opType: op.opType, chipText: null };
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
  expect(r.chipText, 'hovering the custom op shows its ✎ Edit chip').toContain('✎');
  expect(r.chipText).toContain('As Is');
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

  // open the fork, insert it, hover → chip.
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
  expect(r.chipText, 'hovering the forked op shows its ✎ Edit chip').toContain('✎');
  expect(r.chipText).toContain('Tool Length Copy');
});
