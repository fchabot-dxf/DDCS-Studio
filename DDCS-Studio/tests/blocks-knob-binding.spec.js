import { test, expect } from '@playwright/test';

/**
 * KNOB-BINDING PROJECTION (t391, human "do knob, it helps me troubleshoot to use Blocks") — a data-op's FORM-BOUND params
 * show as PRE-TICKED knobs when opened in the Blocks tab (a binding IS a knob — same record). buildActiveOpStack seeds each
 * value binding's atom `_expose` (by macro-var identity), which round-trips (stackBridge record._expose → block.data) → devMode
 * augment/restoreExpose ticks the EXPOSE checkbox + names it. Display/provenance-only → emit byte-identical. GENERAL (any data-op).
 */
test.use({ viewport: { width: 1500, height: 1000 } });

async function openDataOpBlocks(page, optype, factoryPath, factory) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(async ([path, fn]) => { const U = await import('/blocks/userOps.js'); const M = await import(path); localStorage.removeItem('ddcs_user_ops'); U.createUserOp(M[fn]()); }, [factoryPath, factory]);
  await page.evaluate((op) => window.ddcsStudio.wizardManager.open(op), optype);
  await page.waitForSelector('#wiz_user_form', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(800);   // let devMode.augment run (grow + restoreExpose) + queued renders flush
}

test('a data-op opens in Blocks with its BOUND params PRE-TICKED as knobs (byte-identical emit)', async ({ page }) => {
  await openDataOpBlocks(page, 'user_corner_data', '/blocks/dataOps/cornerData.js', 'cornerDataDef');
  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    // each assign block → { fields } (so we don't hard-code the var field name), + its EXPOSE/PNAME state
    const assigns = ws.getAllBlocks().filter((b) => b.type === 'assign').map((b) => {
      const fields = {};
      for (const inp of b.inputList) for (const f of inp.fieldRow) { if (f.name) fields[f.name] = b.getFieldValue(f.name); }
      return fields;
    });
    return assigns;
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // the var field holds e.g. '#1'; find the dist atom (#1) and a derived-expression atom (#7 = [0-#1])
  const varOf = (a) => a.VAR ?? a.var ?? Object.values(a).find((v) => typeof v === 'string' && /^#\d/.test(v));
  const dist = r.find((a) => varOf(a) === '#1');
  const neg = r.find((a) => varOf(a) === '#7');   // #7 = [0-#1] — an EXPRESSION, not a plain-number knob
  expect(dist, 'the #1 (dist) assign atom is present in Blocks').toBeTruthy();
  expect(dist.EXPOSE_VALUE, 'the bound #1 (dist) atom is PRE-TICKED as a knob').toBe('TRUE');
  expect(dist.PNAME_VALUE, 'the knob is named after the bound param (dist)').toBe('dist');
  // a good sample of corner's bound scalars are all pre-ticked
  const tickedNames = r.filter((a) => a.EXPOSE_VALUE === 'TRUE').map((a) => a.PNAME_VALUE).sort();
  expect(tickedNames, 'the bound scalars pre-tick with their param names').toEqual(expect.arrayContaining(['dist', 'f_fast', 'f_slow', 'port', 'radius', 'retract']));
  // an EXPRESSION atom (#7=[0-#1]) is NOT a knob (only plain-number sockets)
  if (neg) expect(neg.EXPOSE_VALUE === 'TRUE', '#7 (an expression) is NOT pre-ticked').toBe(false);
});
