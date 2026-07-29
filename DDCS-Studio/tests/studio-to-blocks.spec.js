import { test, expect } from '@playwright/test';

// "Studio → Blocks" on the BLOCKLY tab: using a STUDIO wizard records the op; opening the Blocks tab renders
// it as Blockly blocks (real param values) and emits the matching G-code via emitMapped. Reverse: editing a
// block's value, then returning to STUDIO, reconciles the wizard form.
test.use({ viewport: { width: 1400, height: 1000 } });

const openBlocks = async (page) => {
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length >= 0);
  await page.waitForTimeout(150);   // let the change listener emit
};

test('Blocks tab opens the active cutting op (surfacing) as Blockly blocks with real values', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.fill('#sf_w', '123');
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());   // → recordOp('surfacing', …)

  await openBlocks(page);
  const r = await page.evaluate(() => ({
    types: window.__blkws.getAllBlocks().map((b) => b.type),
    code: document.getElementById('blk-gcode').textContent,
  }));
  // t1361 — surfacing is ONE atom now: `stepdown{ surfacefill }` collapsed into `surfaceraster`, which carries the
  // depth loop and the row walk itself. The Blocks tab renders it like any other atom (it is in the PALETTE, so it
  // gets its Blockly def with the rest) — this is the same claim about the same tab, naming the block that is there.
  expect(r.types, 'workspace has the surfacing op stack').toContain('surfaceraster');
  expect(r.types).toEqual(expect.arrayContaining(['progstart', 'surfaceraster', 'progend']));
  // …and the width reaches the emit. It is a NAMED HEADER VAR rather than a literal in every row now, which is the
  // point of the switch: one place says 123, and the machine counts the rows from it.
  expect(r.code, 'emitted G-code reflects the edited width').toContain('#40=123');
});

test('Blocks tab opens a snippet op (WCS) emitted bare — no program framing', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('wcs'));
  await page.waitForSelector('#wiz_wcs', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());

  await openBlocks(page);
  const code = await page.evaluate(() => document.getElementById('blk-gcode').textContent);
  expect(code).toMatch(/#\d/);                         // a #-register write present
  expect(code).not.toContain('M30');                  // bare: no End Program
  expect(code).not.toContain('( clearance )');        // bare: no Program Start
});

// Reverse path (redesigned): editing a Blockly block re-projects the CODE — the block stack is the data, the
// STUDIO editor is its live projection (form-reconcile was dropped in favour of code projection; see
// BLOCKS-TAB.md "Current architecture"). So a block edit shows up in the projected G-code / editor, not the form.
test('Blocks → STUDIO reverse sync: editing a Blockly block re-projects the code', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsGetBlockGcode);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.fill('#sf_toolDia', '12');
  await page.fill('#sf_depth', '2');
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());

  await openBlocks(page);
  // t1361 — edit the depth on the block that owns it now: `surfaceraster`'s DEPTH socket (a math_number shadow, the
  // same shape StepDown's TO socket was). The op's depth pass lives inside the one atom since the switch.
  await page.evaluate(() => {
    const ws = window.__blkws;
    const blk = ws.getAllBlocks().find((b) => b.type === 'surfaceraster');
    const tgt = blk && blk.getInput('DEPTH') && blk.getInput('DEPTH').connection.targetBlock();
    if (tgt) tgt.setFieldValue('7', 'NUM');
  });
  await page.waitForTimeout(200);

  // The projection (block G-code, which the Studio editor mirrors) now cuts down to the new depth — as the header var
  // the depth loop reads, which is where a depth lives in a program the machine derives.
  const proj = await page.evaluate(() => window.ddcsGetBlockGcode());
  expect(proj, 'block edit re-projected to a deeper cut (#42 = the total depth)').toContain('#42=7');
  // editor is the live projection of the (edited) block program
  const editor = await page.evaluate(() => window.ddcsStudio.editorManager.getValue());
  expect(editor).toBe(proj);
});
