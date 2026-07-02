import { test, expect } from '@playwright/test';

/**
 * LAYOUT SIM-ONLY MARKER DRAG (t87) — the human confirmed: "sim only just means it doesn't emit, but we should still drag it to
 * simulate a user position start." So the Layout FeatureCanvas sim-only marker is DRAGGABLE again (it writes userStarts via the
 * SAME onStartDrag seam the top panel uses; never emitted). featureCanvas._hit's blanket `if (h.simOnly) return` (from when the
 * marker + the emitting handle were COINCIDENT, pre-t76) is replaced by a real coincidence DISTANCE check: draggable when clear
 * (the default/separated case), emitting-wins ONLY when they degenerately coincide. Byte-parity untouched (sim-only).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// (1) DRAGGABLE at the default/separated positions — a real mouse drag of the Layout sim ◇ moves the SHARED pass-0 start
//     (userStarts, mirroring the top panel) and leaves the EMIT byte-identical.
test('(1) Layout sim-only marker is DRAGGABLE — drag writes userStarts (mirrors the top panel), emit byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 6000 });

  const read = () => page.evaluate(() => {
    const box = document.getElementById('userViz3dContainer');
    const host = box && box.parentElement && box.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    return { start0: (panel && panel.getPassStarts()[0]) || null, code: (document.getElementById('wiz_user_code') || {}).textContent || '' };
  });
  const before = await read();

  const handle = page.locator('#userVizContainer .fc-handle-sim').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 70, hb.y + 48, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => {
    const s = (await read()).start0;
    return before.start0 && s ? Math.hypot((s.x || 0) - (before.start0.x || 0), (s.y || 0) - (before.start0.y || 0)) : 0;
  }, { timeout: 4000 }).toBeGreaterThan(3);
  const after = await read();
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(before.code.length, 'sanity: emitted code exists').toBeGreaterThan(100);
  expect(after.code, 'THE INVARIANT — the sim-only drag never touches the EMIT (userStarts is never emitted)').toBe(before.code);
});

// (2) DEGENERATE overlap — when the sim marker and an EMITTING handle genuinely COINCIDE, the emitting handle wins the hit
//     (it writes the program); the sim marker doesn't steal it and nothing crashes. Synthetic FeatureCanvas with 2 coincident
//     move-handles; a pointer drag at that point must route to the EMITTING handle's onDrag, not the sim one.
test('(2) degenerate overlap: the emitting handle still wins the hit (sim marker yields, no crash)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { FeatureCanvas } = await import('/viz/featureCanvas.js');
    const cont = document.createElement('div'); cont.style.cssText = 'width:320px;height:260px;position:relative'; document.body.appendChild(cont);
    let simDragged = false, emitDragged = false;
    const spec = {
      stock: { w: 100, h: 80, ox: 0, oy: 0 }, items: [],
      handles: [
        { id: 'emit1', x: 50, y: 40, kind: 'move' },                       // an EMITTING handle
        { id: '__simstart0', x: 50, y: 40, kind: 'move', simOnly: true },  // the sim marker — COINCIDENT
      ],
      onDrag: (id) => { if (id === '__simstart0') simDragged = true; else emitDragged = true; },
    };
    const fc = new FeatureCanvas();
    fc.render(cont, spec);
    const svg = cont.querySelector('svg');
    const rect = cont.querySelector('.fc-handle-move'); const b = rect.getBoundingClientRect();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    let threw = false;
    try {
      const pe = (type, dx = 0, dy = 0) => svg.dispatchEvent(new PointerEvent(type, { clientX: cx + dx, clientY: cy + dy, button: 0, pointerId: 1, bubbles: true }));
      pe('pointerdown'); pe('pointermove', 24, 16); pe('pointerup', 24, 16);
    } catch (e) { threw = true; }
    cont.remove();
    return { simDragged, emitDragged, threw };
  });
  expect(r.threw, 'a coincident-handle drag does not crash').toBe(false);
  expect(r.emitDragged, 'the EMITTING handle wins the hit when coincident (it writes the program)').toBe(true);
  expect(r.simDragged, 'the sim marker yields — it does not steal a coincident emitting hit').toBe(false);
});
