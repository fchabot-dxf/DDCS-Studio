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
  // t2635 — GENERALIZED, not corner-specific: climbs getSurroundParent() repeatedly (was exactly one hop, so
  // a section nested one level deeper — e.g. inside a split_horizontal's own LEFT/RIGHT pane, the REDIVIDE
  // composition's own shape — reported mouth:'LEFT'/'RIGHT' instead of the real top-level 'PRESENTATION'/
  // 'EXECUTION' it ultimately belongs under) until it reaches the block's own `user_root` ancestor, whose
  // named inputs ARE the mouths this test actually asks about. Works through ANY number of intermediate
  // structural wrappers (split_horizontal, group_box, a future tab_group, …), not just one.
  const secs = await page.evaluate(() => {
    const ws = window.__blkws;
    const findInput = (parent, child) => (parent.inputList || []).find((i) => { let c = i.connection && i.connection.targetBlock(); while (c) { if (c === child) return true; c = c.nextConnection && c.nextConnection.targetBlock(); } return false; });
    const mouthOf = (top) => {
      let cur = top;
      while (cur) {
        const sp = cur.getSurroundParent && cur.getSurroundParent();
        if (!sp) return null;
        const inp = findInput(sp, cur);
        if (inp && sp.type === 'user_root') return inp.name;
        cur = sp;
      }
      return null;
    };
    return ws.getAllBlocks().filter((b) => b.type === 'section').map((b) => {
      let top = b; while (top.previousConnection && top.previousConnection.targetBlock() && top.previousConnection.targetBlock().type === 'section') top = top.previousConnection.targetBlock();
      return { title: b.getFieldValue('TITLE'), mouth: mouthOf(top) };
    });
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  const byMouth = (m) => secs.filter((s) => s.mouth === m).map((s) => s.title);
  expect(byMouth('PRESENTATION').sort(), 'the 4 view peers nest in PRESENTATION').toEqual(['3D-SIM', 'FORM', 'LAYOUT-2D', 'PROJECTED-GCODE']);
  expect(byMouth('EXECUTION').sort(), 'the 3 execution sections nest in EXECUTION').toEqual(['G-CODE', 'STRUCTURAL', 'VARIABLES']);
});

// (4) CONCERN COLOUR (t132) — VALUE: each section renders in its DECLARED concern colour (authoring-only), and the colour
//     SURVIVES a workspace serialize→load round-trip (rides in the block's `data`, never emitted). The emit stays byte-exact.
// t2635 (owner amendment) — EXECUTION's own 3 sections moved from unrelated brights to a dark slate ramp
// (STRUCTURAL lightest → G-CODE darkest), so the two mouths read as two different KINDS of thing — see
// cornerData.js's own comment at these declarations for the contrast-check reasoning.
const EXPECT_COLOUR = { STRUCTURAL: '#475569', VARIABLES: '#334155', FORM: '#d946ef', 'LAYOUT-2D': '#3b82f6', '3D-SIM': '#6366f1', 'PROJECTED-GCODE': '#0ea5e9', 'G-CODE': '#1e293b' };
test('(4) each concern section renders in its declared colour, and it survives a round-trip', async ({ page }) => {
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
  await page.waitForTimeout(600);
  const colours = () => page.evaluate(() => Object.fromEntries(window.__blkws.getAllBlocks().filter((b) => b.type === 'section').map((b) => [b.getFieldValue('TITLE'), b.getColour()])));
  const before = await colours();
  for (const [title, hex] of Object.entries(EXPECT_COLOUR)) expect(before[title], `${title} renders in its declared colour`).toBe(hex);
  // round-trip: serialize the workspace to JSON and reload it → the colours must persist (they ride in the block `data`)
  await page.evaluate(async () => {
    const B = window.Blockly || (await import('/blocks/blockly/bridge.js')).getBlockly();
    const ws = window.__blkws; const state = B.serialization.workspaces.save(ws);
    ws.clear(); B.serialization.workspaces.load(state, ws);
  });
  await page.waitForTimeout(600);
  const after = await colours();
  for (const [title, hex] of Object.entries(EXPECT_COLOUR)) expect(after[title], `${title} colour survives the round-trip`).toBe(hex);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
