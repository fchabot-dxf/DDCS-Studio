import { test, expect } from '@playwright/test';

/**
 * DISK carousel-rotate + ring-occupancy (P-C.3c, t197) — the last ATC method. The disk magazine is a RING of pockets
 * that ROTATES to a FIXED PICKUP. On a real #1300 change during a disk (pick-place) op, the ring rotates so the target
 * pocket comes to the pickup, and the occupancy swaps THERE (old returns to its ring pocket, new leaves → the spindle).
 * Reuses the shared magazinePockets ring layout + P-C.3b's occupancy. SIM/VISUAL only → emit byte-identical. Asserts
 * the VALUE (the rotation state brings the target to the pickup; the occupancy swaps).
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('a disk op tool change rotates the ring to the pickup + swaps the occupancy there', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.preview = s.preview || {}; s.preview.autoLoop = false;
    s.machine = { x: 600, y: 400, z: -150, show: true, workOrigin: { x: 0, y: 0, z: 0 }, wcs: { active: 1, table: null } };
    s.atc = s.atc || {};
    s.atc.magType = 'disk'; s.atc.pickup = { x: 150, y: 100, z: -40 }; s.atc.diskDia = 120; s.atc.diskAxis = '+y';
    s.atc.magazine = [{ pocket: 1, tool: 2 }, { pocket: 2, tool: 5 }, { pocket: 3, tool: 7 }];
    s.atc.tools = [{ num: 2, type: 'endmill', dia: 8, length: 40 }, { num: 5, type: 'ballnose', dia: 6, length: 50 }, { num: 7, type: 'endmill', dia: 6, length: 40 }];
  });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('atc_change'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
  await page.evaluate(() => { const sel = document.getElementById('atc_change_method'); if (sel) { sel.value = 'disk'; sel.dispatchEvent(new Event('change', { bubbles: true })); } window.ddcsStudio.wizardManager.update(); });
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const { atcChoreography } = await import('/wizards/atcChangeWizard.js');
    const host = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d');
    host.__panel.setAtcSwap(atcChoreography({ method: 'disk' }), null);   // arm pick-place (disk)
    host.__gcode = '#1300=2\nG0 X50 Y50 Z10\nT5 M6\nG0 X60 Y60\nM30';   // change T2 → T5 (pocket 2)
    host.querySelector('.pp-run').click();
  });
  await page.waitForFunction(() => { const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz; return v && v._simTool && Number(v._simTool.num) === 5; }, null, { timeout: 8000 });
  const r = await page.evaluate(async () => {
    const { magazinePockets } = await import('/wizards/views/atcViews.js');
    const v = document.getElementById('atcChangeViz').parentElement.querySelector('.wiz-viz3d').__panel.viz;
    const atc = window.ddcsGetSettings().atc;
    const ring = magazinePockets(atc, v._diskTheta);   // the ring at the current rotation
    const target = ring.find((p) => p.tool && Number(p.tool.num) === 5);   // tool 5's pocket (the target)
    const occ = (v._magazine || []).map((p) => p.tool && Number(p.tool.num));
    return { theta: v._diskTheta, targetX: +Number(target.x).toFixed(0), targetY: +Number(target.y).toFixed(0), pickupX: +Number(atc.pickup.x).toFixed(0), pickupY: +Number(atc.pickup.y).toFixed(0), occ, spindle: Number(v._simTool.num) };
  });
  // (a) the ring ROTATED so the target pocket (tool 5) is at the fixed PICKUP
  expect(r.theta, 'the ring rotated (non-zero index → non-zero theta)').not.toBe(0);
  expect({ x: r.targetX, y: r.targetY }, 'tool 5 pocket rotated to the fixed pickup (the carousel indexed it)').toEqual({ x: r.pickupX, y: r.pickupY });
  // (b) the occupancy swapped at the pickup — the OLD tool (2) is back in the ring, the NEW (5) removed, spindle = new
  expect(r.occ, 'the OLD tool (2) is back in its ring pocket').toContain(2);
  expect(r.occ, 'the NEW tool (5) left its pocket (on the spindle)').not.toContain(5);
  expect(r.spindle, 'the spindle holds the NEW tool (5)').toBe(5);
});
