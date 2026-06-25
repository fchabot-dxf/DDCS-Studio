import { test, expect } from '@playwright/test';

// CONTOUR wizard (modelled on Pocket): traces a region's boundary OFFSET to a side (outside/inside/on) by the tool
// radius, stepping down to depth. The boundary you type is the FINISHED edge; the toolpath is the offset contour.
// rect w=50 + tool Ø6 (r=3): outside cut spans 56 (50+2r), inside 44 (50−2r), on 50. Placement shifts the path so
// its min corner sits at part-zero, so the GROWN extent (56) is the tell-tale of the outside offset.
test.use({ viewport: { width: 1280, height: 950 } });

test('contour wizard: opens, renders 2D/3D, emits the offset toolpath', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/api\/descriptor|404/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);

  // Open via the manager (same path the command-deck button uses).
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('contour'));
  await page.waitForSelector('#wiz_contour', { state: 'visible' });

  // The 2D layout canvas must mount an SVG (renders the boundary + offset toolpath + handles).
  await page.waitForSelector('#contourLayoutCanvas svg.feature-canvas', { timeout: 5000 });
  const handleCount = await page.locator('#contourLayoutCanvas .fc-handle').count();
  const pathCount = await page.locator('#contourLayoutCanvas path.fc-path').count();   // the solid offset toolpath
  expect(handleCount, '2D layout has draggable handles').toBeGreaterThan(0);
  expect(pathCount, '2D layout draws the offset toolpath as a path').toBeGreaterThan(0);

  // The 3D preview host should mount too.
  await page.waitForSelector('#contourVizContainer ~ .wiz-viz3d, #wiz_contour .wiz-viz3d', { timeout: 5000 });

  // Set rect / outside / 50×30 / tool Ø6, then re-run.
  await page.selectOption('#ct_shape', 'rect');
  await page.selectOption('#ct_side', 'outside');
  await page.fill('#ct_w', '50');
  await page.fill('#ct_h', '30');
  await page.fill('#ct_toolDia', '6');
  await page.fill('#ct_depth', '2');
  await page.fill('#ct_stepdown', '2');
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.waitForTimeout(80);

  const code = await page.locator('#wiz_contour_code').innerText();
  // Outside rect grows by the tool radius: 50→56, 30→36 (path shifted to start at part-zero).
  expect(code, 'outside rect grows by 2r in X (56)').toMatch(/X56\b/);
  expect(code, 'outside rect grows by 2r in Y (36)').toMatch(/Y36\b/);
  expect(code, 'the un-offset boundary (50) is NOT the cut').not.toMatch(/X50\b/);
  expect(code, 'one Z pass at the typed depth').toContain('Step Down z=-2');

  expect(errors, 'no page errors').toEqual([]);
});

test('contour wizard: side switches the offset; circle is a G3 arc', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('contour'));
  await page.waitForSelector('#wiz_contour', { state: 'visible' });

  const codeFor = async (side, shape) => {
    await page.selectOption('#ct_shape', shape);
    await page.selectOption('#ct_side', side);
    if (shape === 'rect') { await page.fill('#ct_w', '50'); await page.fill('#ct_h', '30'); }
    else { await page.fill('#ct_dia', '50'); }
    await page.fill('#ct_toolDia', '6');
    await page.evaluate(() => window.ddcsStudio.wizardManager.update());
    await page.waitForTimeout(60);
    return page.locator('#wiz_contour_code').innerText();
  };

  expect(await codeFor('inside', 'rect'), 'inside shrinks to 44').toMatch(/X44\b/);
  expect(await codeFor('on', 'rect'), 'on traces the boundary itself (50)').toMatch(/X50\b/);

  const circ = await codeFor('outside', 'circle');
  expect(circ, 'circle contour is a true G3 arc').toContain('G3');
  expect(circ, 'circle Ø50 outside → R28 → X56 on the rim').toMatch(/X56\b/);
});

test('contour op round-trips: BUILDERS.contour → reconcile reads the TRUE boundary', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const cw = await import('/wizards/contourWizard.js');
    const rec = await import('/blocks/opRecord.js');

    const params = { shape: 'rect', originX: 10, originY: 5, w: 50, h: 30, side: 'outside', toolDia: 6, depth: 4, stepdown: 2, feed: 400, plunge: 200, clearance: 5, wcs: 'G55' };
    // Builder exists + produces a stack with a stepdown wrapping a contour over a region.
    const stack = cw.contourStack(params);
    const find = (arr, t) => { for (const b of (arr || [])) { if (!b) continue; if (b.type === t) return b; const f = b.children && find(b.children, t); if (f) return f; } return null; };
    const down = find(stack, 'stepdown');
    const contour = down && down.children.find((b) => b.type === 'contour');
    const region = contour && contour.params.region;

    // Drive the reconciler the same way the app does: record the op, build its op-stack into the program,
    // then reverse-sync from the (un-edited) block program.
    rec.recordOp('contour', params);
    const built = ops.buildActiveOpStack();            // sets shownOp = 'contour' and returns [progstart, op, progend]
    window.ddcsLoadBlockStack(built.blocks);
    const back = ops.reconcileActiveOp();              // read the block program back → form fields

    return {
      regionShape: region && region.params && region.params.shape,
      regionW: region && region.params && region.params.w,
      regionX: region && region.params && region.params.x,
      side: contour && contour.params.side,
      tool: contour && contour.params.tool,
      reconciled: back,
    };
  });

  // Builder shape: StepDown{ Contour(region) }, region = the TRUE 50-wide rect (NOT offset by the tool radius).
  expect(r.regionShape).toBe('rect');
  expect(r.regionW, 'region is the TRUE boundary width (un-offset)').toBe(50);
  expect(r.regionX, 'region carries the typed origin').toBe(10);
  expect(r.side).toBe('outside');
  expect(r.tool).toBe(6);

  // Reverse-sync reads the stepdown depth/by + the contour side/tool + the region dims straight (no un-offset).
  expect(r.reconciled, 'reconciler ran for the contour op').not.toBeNull();
  expect(r.reconciled.type).toBe('contour');
  const f = r.reconciled.fields;
  expect(f.ct_shape).toBe('rect');
  expect(f.ct_side).toBe('outside');
  expect(Number(f.ct_w), 'reverse-sync recovers the TRUE width 50').toBe(50);
  expect(Number(f.ct_toolDia)).toBe(6);
  expect(Number(f.ct_depth)).toBe(4);
  expect(Number(f.ct_stepdown)).toBe(2);
  expect(f.ct_wcs).toBe('G55');
});
