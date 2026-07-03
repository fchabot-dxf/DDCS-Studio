import { test, expect } from '@playwright/test';

/**
 * REDIVIDE (t130, Option B, corner-piloted) — the Corner (data) wizard's blocks are organised into labeled concern
 * SECTIONS (a generic transparent-emit `section` container = the param_group generalization). user_root keeps its 2
 * mouths; the sections nest inside: PRESENTATION → FORM/LAYOUT-2D/3D-SIM/PROJECTED-GCODE (view peers); EXECUTION →
 * STRUCTURAL/VARIABLES/G-CODE. Sections are byte-transparent (emit their children in order), so the .nc is unchanged.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// (1) VALUE — the section block is TRANSPARENT: it emits exactly its DO children, in order (nothing added/reordered).
test('(1) a `section` block emits its children transparently (in order)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const kids = [
      { type: 'assign', params: { var: '#1', value: '11', note: '' } },
      { type: 'assign', params: { var: '#2', value: '22', note: '' } },
    ];
    const bare = emitMapped(kids).text;
    const wrapped = emitMapped([{ type: 'section', params: { title: 'X' }, children: kids }]).text;
    return { bare, wrapped };
  });
  expect(r.wrapped, 'wrapping atoms in a section does not change the emit').toBe(r.bare);
});

// (2) VALUE — ALL corner combos (probeZ on/off × 4 corners × probeSeq × syncA) emit byte-for-byte == cornerStack.
test('(2) all 32 combos: the sectioned twin == cornerStack byte-for-byte', async ({ page }) => {
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
    const fails = [];
    for (const probeZFirst of [0, 1]) for (const corner of ['FL', 'FR', 'BL', 'BR']) for (const probeSeq of ['YX', 'XY']) for (const syncA of [0, 1]) {
      const p = S({ probeZFirst, corner, probeSeq, syncA });
      if (em(build, p) !== em(cornerStack, p)) fails.push({ probeZFirst, corner, probeSeq, syncA });
    }
    return { total: 2 * 4 * 2 * 2, fails };
  });
  expect(r.total).toBe(32);
  expect(r.fails, 'every corner combo emits byte-identical to cornerStack').toEqual([]);
});

// (3) STRUCTURE + ROUND-TRIP — opening corner in the Blocks tab shows the 7 labeled sections in the right mouths.
test('(3) the 7 concern sections render in the right mouths (PRESENTATION peers + EXECUTION sections)', async ({ page }) => {
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
  await page.waitForTimeout(400);
  const secs = await page.evaluate(() => {
    const ws = window.__blkws;
    return ws.getAllBlocks().filter((b) => b.type === 'section').map((b) => {
      let top = b; while (top.previousConnection && top.previousConnection.targetBlock() && top.previousConnection.targetBlock().type === 'section') top = top.previousConnection.targetBlock();
      const sp = top.getSurroundParent && top.getSurroundParent();
      const inp = sp ? (sp.inputList || []).find((i) => { let c = i.connection && i.connection.targetBlock(); while (c) { if (c === top) return true; c = c.nextConnection && c.nextConnection.targetBlock(); } return false; }) : null;
      return { title: b.getFieldValue('TITLE'), mouth: inp ? inp.name : null };
    });
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  const byMouth = (m) => secs.filter((s) => s.mouth === m).map((s) => s.title);
  expect(byMouth('PRESENTATION').sort(), 'the 4 view peers nest in PRESENTATION').toEqual(['3D-SIM', 'FORM', 'LAYOUT-2D', 'PROJECTED-GCODE']);
  expect(byMouth('EXECUTION').sort(), 'the 3 execution sections nest in EXECUTION').toEqual(['G-CODE', 'STRUCTURAL', 'VARIABLES']);
});
