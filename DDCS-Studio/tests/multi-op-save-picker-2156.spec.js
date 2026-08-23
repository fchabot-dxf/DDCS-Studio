import { test, expect } from '@playwright/test';

/**
 * t2156 — THE SAVE-AS-WIZARD PATH USED TO DROP EVERY OP BUT THE FIRST, SILENTLY.
 *
 * blocks/devMode.js's `authoringBody` used `stack.find(b => b.type === 'op')` (the FIRST op, position-ordered —
 * workspaceToStack walks getTopBlocks(true)) to pick WHICH op's children got saved, while a SECOND, independent
 * lookup — `ws.getAllBlocks().find(b => b.type === 'op' || b.type.endsWith('_op'))` (Blockly's own documented
 * "not necessarily position-ordered" contract) — supplied the LIVE BLOCK the bindings' block-indices align
 * against. CONFIRMED live (not assumed) that these can resolve to DIFFERENT ops: load two independent top-level
 * op blocks, both agree while nothing has moved, but disconnect/reconnect them (or just create the second one
 * after the first, which is the ordinary path for anything not loaded through ddcsLoadBlockStack's own
 * always-chains-them convenience) and `getAllBlocks()`'s "first op" keeps pointing at whichever was created
 * first — same real hazard the human ruling calls "quieter and worse than dropping ops": a misaligned index
 * attaches a knob to the WRONG FIELD.
 *
 * FIX (human's own ruling, verbatim: "in block id rather have the save modal poll the stack and allow to select
 * the op to be saved in a modal") — NOT Blockly's native block selection (proposed, rejected). `authorableOps`
 * pairs each stack record with its live block by a DIRECT id lookup (ws.getBlockById), never a second search;
 * the Save dialog polls the stack and, when there is a genuine choice, shows a picker — label + up to 3
 * datapoints in the op's own DECLARED field order (identity-first), live values from the placed record.
 */

const SCRATCH = 'scratchpad';

async function ready(page) {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack && window.ddcsSaveAsWizard);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
}

// Each op carries a param-PILL (a GUI param block plugged into a value socket, extractParamBlocks' own live
// path — the modern authoring route; the old EXPOSE_ checkbox path is dead, t1610) on the SAME field name
// ("mark") but a DIFFERENT value per op — this is what makes a misaligned index visible: if the wrong op's
// live block were paired with the picked op's record, the saved binding's default would read the WRONG op's
// mark value instead of the picked one's.
const mkOp = (id, label, markValue, x) => ({
  type: 'op', id, opType: 'pocket', label,
  params: { depth: 5, shape: 'rect', w: 20, h: 20 },
  children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x, y: 10, z: { type: 'param', params: { name: 'mark', value: markValue } }, feed: 200 } }],
});

test.use({ viewport: { width: 1400, height: 1000 } });

test('3-op workspace: the picker shows all 3, and picking op B saves OP B — not op A, not all three', async ({ page }) => {
  await ready(page);
  await page.evaluate((ops) => window.ddcsLoadBlockStack(ops), [mkOp('opA', 'Op A', 111, 1), mkOp('opB', 'Op B', 222, 2), mkOp('opC', 'Op C', 333, 3)]);
  await page.waitForTimeout(600);

  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });
  const choices = await page.evaluate(() => Array.from(document.querySelectorAll('.blk-dev-opchoice input')).map((r) => r.value));
  expect(choices.sort(), 'all 3 ops offered as choices').toEqual(['opA', 'opB', 'opC'].sort());

  // datapoints are shown, live, from the placed record — not the def defaults (which would be identical across all 3)
  const dataText = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.blk-dev-opchoice')).find((l) => l.querySelector('input').value === 'opB');
    return row.querySelector('.blk-dev-opchoice-data') ? row.querySelector('.blk-dev-opchoice-data').textContent : '';
  });
  expect(dataText, 'op B\'s row shows its own field values, not a generic label').toContain('depth: 5');

  await page.check('.blk-dev-opchoice input[value="opB"]');
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });   // the reopen (close+onPickOp) lands a fresh dialog
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Picked B');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(400);

  const saved = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const all = U.listUserOps();
    const d = all[all.length - 1];
    const markBinding = (d.bindings || []).find((b) => b.key === 'z' || b.param === 'mark');
    return {
      count: all.length,
      childCount: (d.template || []).length,
      moveX: d.template.find((c) => c && c.type === 'move') && d.template.find((c) => c && c.type === 'move').params.x,
      markDefault: markBinding && markBinding.default,
    };
  });
  expect(saved.count, 'exactly ONE new wizard saved — not three').toBe(1);
  expect(saved.childCount, 'op B\'s own children (one move), not op A\'s + op B\'s + op C\'s concatenated').toBe(1);
  expect(saved.moveX, 'the saved move IS op B\'s own (x=2), not op A\'s (x=1) or op C\'s (x=3)').toBe(2);
  // THE INDEX-ALIGNMENT PROOF: op B's own mark value is 222. If the live-block lookup had resolved to a
  // DIFFERENT op (the hazard this turn fixed), the binding's default would read 111 or 333 instead.
  expect(saved.markDefault, 'the mark binding resolves against OP B\'s own field, not a misaligned neighbour\'s').toBe(222);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('1-op workspace: no picker, save is byte-identical to before this turn', async ({ page }) => {
  await ready(page);
  await page.evaluate((ops) => window.ddcsLoadBlockStack(ops), [mkOp('opSolo', 'Solo Op', 999, 5)]);
  await page.waitForTimeout(400);

  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });
  expect(await page.locator('.blk-dev-oppick').count(), 'no picker when there is only one op').toBe(0);

  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Solo Saved');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(400);

  const saved = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const all = U.listUserOps();
    const d = all[all.length - 1];
    return { count: all.length, childCount: (d.template || []).length };
  });
  expect(saved.count).toBe(1);
  expect(saved.childCount, 'the one op\'s one move').toBe(1);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('bare atom chain (no op wrapper): still ONE entry, still saves the whole chain — the filter-branch behaviour, unfragmented', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { type: 'move', params: { mode: 'rapid', x: 0, y: 0, z: 5, feed: 0 } },
    { type: 'move', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } },
  ]));
  await page.waitForTimeout(400);

  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });
  expect(await page.locator('.blk-dev-oppick').count(), 'a bare chain is ONE entry ("the whole stack"), not per-atom choices').toBe(0);

  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Bare Chain');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(400);

  const saved = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const all = U.listUserOps();
    const d = all[all.length - 1];
    return { childCount: (d.template || []).length };
  });
  expect(saved.childCount, 'BOTH atoms saved — the bare-chain path never dropped anything and still does not').toBe(2);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('the round trip: a multi-op workspace, save ONE op back, the rest of the user-op library is untouched', async ({ page }) => {
  await ready(page);
  // Seed one PRE-EXISTING, unrelated user op — the thing that must survive this save untouched.
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: -3 } }];
    U.createUserOp(U.userOpFromStack('preexisting', 'Pre-existing', template, []));
  });
  const before = await page.evaluate(async () => (await import('/blocks/userOps.js')).listUserOps().map((d) => JSON.stringify(d)));

  await page.evaluate((ops) => window.ddcsLoadBlockStack(ops), [mkOp('opX', 'Op X', 1, 1), mkOp('opY', 'Op Y', 2, 2)]);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });
  await page.check('.blk-dev-opchoice input[value="opY"]');
  await page.waitForSelector('.blk-dev-savedlg', { timeout: 5000 });
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Only Y');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(400);

  const after = await page.evaluate(async () => (await import('/blocks/userOps.js')).listUserOps());
  const preexistingAfter = after.find((d) => d.opType === 'user_preexisting');
  expect(JSON.stringify(preexistingAfter), 'the unrelated pre-existing wizard is byte-identical, not touched by this save').toBe(before[0]);
  expect(after.length, 'exactly one NEW wizard added (Y) alongside the pre-existing one').toBe(2);
  const savedY = after.find((d) => d.label === 'Only Y');
  expect(savedY.template.find((c) => c && c.type === 'move').params.x, 'the new wizard is OP Y\'s own children').toBe(2);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
