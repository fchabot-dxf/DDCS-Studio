import { test, expect } from '@playwright/test';

/**
 * PICK-PLACE POCKET-SWAP (P-C.3b, t195) — FULL per-pocket occupancy. On a real #1300 old→new change during a generic
 * (pick-place) op, the OLD tool RETURNS to its magazine pocket + the NEW tool LEAVES its pocket → onto the spindle, so
 * the magazine occupancy visibly changes. Reuses the SHARED #1300 detection (checkToolSwap); the EFFECT branches on the
 * choreography kind (push = retire to the station, UNCHANGED; pick-place = swap at the pockets). Cross-frame: the
 * pockets are machine coords on the fixed frame (t163). SIM/VISUAL only → emit byte-identical. Asserts the VALUE.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('a real tool change on a generic op swaps the magazine occupancy at the pockets + spindles the new tool', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.preview = s.preview || {}; s.preview.autoLoop = false;
    s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.atc = s.atc || {};
    s.atc.magazine = [{ pocket: 1, tool: 2, x: 100, y: 100, z: -50 }, { pocket: 2, tool: 5, x: 140, y: 100, z: -50 }];
    s.atc.tools = [{ num: 2, type: 'endmill', dia: 8, length: 40 }, { num: 5, type: 'ballnose', dia: 6, length: 50 }];
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'generic'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    host.__panel.setAtcSwap(atcChoreography({ method: 'generic' }), null);   // arm pick-place
    // a real change: old tool #1300=2 (a move sets it as the starting tool), then T5 M6 (2→5), then a move → the swap
    host.__gcode = '#1300=2\nG0 X50 Y50 Z10\nT5 M6\nG0 X60 Y60\nM30';
    host.querySelector('.pp-run').click();
  });
  // wait for the swap to land (the spindle tool becomes tool 5)
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._simTool && Number(v._simTool.num) === 5; }, null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz;
    const pockets = (v._magazine || []).map((p) => ({ num: p.tool && Number(p.tool.num), x: +Number(p.x).toFixed(0), y: +Number(p.y).toFixed(0) }));
    return { pockets, spindle: Number(v._simTool.num) };
  });
  // (c) the NEW tool is on the spindle
  expect(r.spindle, 'the spindle now holds the NEW tool (5)').toBe(5);
  // (a) the OLD tool (2) now occupies its magazine pocket
  const old = r.pockets.find((p) => p.num === 2);
  expect(old, 'the OLD tool (2) is back in its magazine pocket').toBeTruthy();
  // (b) the NEW tool (5) pocket is now EMPTY (removed from the magazine — it is on the spindle)
  expect(r.pockets.find((p) => p.num === 5), 'the NEW tool (5) pocket is now empty (on the spindle)').toBeFalsy();
  // (e) cross-frame — the old tool's pocket sits at its MACHINE coords (100,100), on the fixed frame
  expect({ x: old.x, y: old.y }, 'the returned tool is at its pocket machine coords (fixed frame)').toEqual({ x: 100, y: 100 });
});
