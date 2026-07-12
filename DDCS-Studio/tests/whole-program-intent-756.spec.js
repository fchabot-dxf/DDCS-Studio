import { test, expect } from '@playwright/test';

/**
 * t756 (R-C) — the EDITOR + BLOCKS previews consume the WHOLE-PROGRAM declared intent (programSimContext) via the ONE
 * applyProgramIntent seam, so a program with an alignment op SEATS, a machine op (homing/ATC) draws the MACHINE FRAME,
 * a rotary program shows the RIG — the same truths the wizard previews honor by construction. Blocks == editor for the
 * same program (starts + flags). The legacy Blocks inferStart start-source is retired to the declared opSimStarts.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const bare = (opType) => [{ type: 'op', opType, id: 'op_' + opType, children: [] }];

// Open the editor 3D preview, load a program, and read the applied intent flags off its viz.
async function editorIntentFor(page, stack) {
  await page.evaluate(() => window.setGcodeView && window.setGcodeView('3d'));
  await page.waitForFunction(() => window.__gpPanel, null, { timeout: 8000 });
  await page.evaluate(() => { const p = window.__gpPanel; if (p.setView) p.setView('3d'); });
  await page.waitForFunction(() => window.__gpPanel && window.__gpPanel.viz, null, { timeout: 8000 });
  await page.evaluate((s) => window.ddcsLoadBlockStack(s), stack);
  await page.evaluate(() => window.setGcodeView && window.setGcodeView('3d'));   // re-apply the intent on the loaded program
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const v = window.__gpPanel.viz;
    return { rig: !!v._showRotaryFixture, machineBox: !!v._forceMachineBox, machineFrameTool: !!v._toolMachineFrame, seat: !!v._seatAtStart, starts: (v.starts || []).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), z: Math.round(s.z) })) };
  });
}

test('EDITOR: alignment → seat · homing → machine frame · rotary → rig (whole-program intent)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.setGcodeView && window.ddcsLoadBlockStack);

  const align = await editorIntentFor(page, bare('alignment'));
  expect(align.seat, 'an alignment program seats the initial position at the Start').toBe(true);

  const homing = await editorIntentFor(page, bare('homing'));
  expect(homing.machineBox, 'a homing program draws the machine envelope (machine frame)').toBe(true);
  expect(homing.machineFrameTool, 'a homing program renders the tool in the machine frame').toBe(true);

  const rotary = await editorIntentFor(page, bare('rotary_clock'));
  expect(rotary.rig, 'a rotary program shows the 4th-axis rig').toBe(true);

  // and a plain mill program has NONE of them (the union is all-false)
  const mill = await editorIntentFor(page, bare('pocket'));
  expect(mill.rig || mill.machineBox || mill.machineFrameTool || mill.seat, 'a plain mill program forces no intent').toBe(false);
});

test('BLOCKS preview equals the EDITOR on the same program (flags + starts)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.setGcodeView && window.ddcsLoadBlockStack);

  for (const opType of ['alignment', 'homing', 'rotary_clock', 'pocket']) {
    const stack = bare(opType);
    // EDITOR
    await page.evaluate(() => window.showApp('studio'));
    const ed = await editorIntentFor(page, stack);
    // BLOCKS — same program, force its preview to 3D, read the same flags
    await page.evaluate((s) => window.ddcsLoadBlockStack(s), stack);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => document.getElementById('blk-preview-panel') && document.getElementById('blk-preview-panel').__panel, null, { timeout: 8000 });
    await page.evaluate(() => document.getElementById('blk-preview-panel').__panel.setView('3d'));
    await page.waitForFunction(() => { const p = document.getElementById('blk-preview-panel').__panel; return p && p.viz; }, null, { timeout: 8000 });
    await page.waitForTimeout(250);
    const bl = await page.evaluate(() => {
      const v = document.getElementById('blk-preview-panel').__panel.viz;
      return { rig: !!v._showRotaryFixture, machineBox: !!v._forceMachineBox, machineFrameTool: !!v._toolMachineFrame, seat: !!v._seatAtStart, starts: (v.starts || []).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), z: Math.round(s.z) })) };
    });
    expect(bl.rig, `${opType}: rig matches editor`).toBe(ed.rig);
    expect(bl.machineBox, `${opType}: machine frame matches editor`).toBe(ed.machineBox);
    expect(bl.machineFrameTool, `${opType}: machine-frame tool matches editor`).toBe(ed.machineFrameTool);
    expect(bl.seat, `${opType}: seat matches editor`).toBe(ed.seat);
    expect(bl.starts, `${opType}: the declared starts match editor (same opSimStarts source)`).toEqual(ed.starts);
  }
});

test('the legacy inferStart start-source is GONE from the Blocks/editor preview paths (grep-guard)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  const check = async (path) => page.evaluate(async (p) => (await (await fetch(p)).text()), path);
  const blocks = await check('/blocks/blocksApp.js');
  const editor = await check('/ui/gcodePreviewTab.js');
  // no imperative inferStart CALL, and no direct per-flag preview intent set in the preview paths (all via applyProgramIntent)
  expect(/\.inferStart\s*\(/.test(blocks), 'no inferStart call remains in the Blocks preview path').toBe(false);
  expect(/setRotaryFixture\s*\(/.test(blocks), 'no imperative setRotaryFixture in the Blocks preview path (uses applyProgramIntent)').toBe(false);
  expect(/\.inferStart\s*\(/.test(editor), 'no inferStart call in the editor preview path').toBe(false);
  expect(/applyProgramIntent/.test(blocks) && /applyProgramIntent/.test(editor), 'both preview paths use the ONE applyProgramIntent seam').toBe(true);
});
