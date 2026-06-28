import { test, expect } from '@playwright/test';

// INC3: the boss probe-both reposition is split into two per-traverse toggles — IN-axis (wall→wall, #19/#20 cross-over
// vs jog) and TRANS-axis (X→Y, the NEW auto-traverse #21 / "Diag travel" vs jog). The core bug: the trans-axis used to
// always JOG (no lateral move), so AUTO never reached ②. Now AUTO emits a real diagonal move. Back-compat: the legacy
// single `approach` defaults both toggles (byte-identical). The toggles + Diag travel round-trip through the block stack.
test.use({ viewport: { width: 1280, height: 900 } });

test('macro: boss auto trans-axis emits the diagonal traverse (#21); manual jogs; legacy approach is byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const w = new MiddleWizard();
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 };
    const auto = w.generate({ ...base, inAxis: 'auto', transAxis: 'auto' });
    const manual = w.generate({ ...base, inAxis: 'manual', transAxis: 'manual' });
    const stock = { x: 100, y: 80, z: 20 };
    return {
      autoHas21: /#21\s*=/.test(auto),
      autoHasTransMove: /G0 X#21 Y#21/.test(auto),
      autoHasAutoTraverse: /auto-traverse to the perpendicular/.test(auto),
      // the diagonal move must come BEFORE the REPOSITION (the connecting travel of the PRIOR pass) — else the trace
      // anchors it to ② and pushes the 2nd probe AWAY (the bug the human caught). So the Y pass starts cleanly at ②.
      moveBeforeReposition: auto.indexOf('G0 X#21 Y#21') < auto.indexOf('auto-traverse to the perpendicular'),
      manualHas21: /#21/.test(manual),
      manualHasJogPerp: /jog clear, around to the perpendicular/.test(manual),
      legacyAutoMatches: w.generate({ ...base, approach: 'auto' }) === auto,
      legacyManualMatches: w.generate({ ...base, approach: 'manual' }) === manual,
      autoStarts: w.inferStarts({ ...base, inAxis: 'auto' }, stock).length,
      manualStarts: w.inferStarts({ ...base, inAxis: 'manual' }, stock).length,
    };
  });
  expect(r.autoHas21, 'auto trans-axis assigns the Diag travel #21').toBe(true);
  expect(r.autoHasTransMove, 'auto trans-axis emits the diagonal G0 move (the fix — it used to just jog)').toBe(true);
  expect(r.autoHasAutoTraverse, 'auto trans-axis is hands-free, not an operator jog').toBe(true);
  expect(r.moveBeforeReposition, 'the diagonal move is the connecting travel BEFORE the REPOSITION (so the Y pass anchors at ②)').toBe(true);
  expect(r.manualHas21, 'manual has no Diag travel').toBe(false);
  expect(r.manualHasJogPerp, 'manual trans-axis is an operator jog').toBe(true);
  expect(r.legacyAutoMatches, 'a legacy approach:auto == inAxis/transAxis:auto (byte-identical)').toBe(true);
  expect(r.legacyManualMatches, 'a legacy approach:manual == inAxis/transAxis:manual').toBe(true);
  expect(r.autoStarts, 'auto → 2 per-pass starts').toBe(2);
  expect(r.manualStarts, 'manual → 4 per-pass starts').toBe(4);
});

// Part 2a: the trans-axis diagonal LANDS near ② — its distance #21 is a SANE fixed default (50, like the corner's
// travelDist), NOT [#19+#20]/2 (≈ max-probe) which scaled with the probe distance and overshot FAR off-stock when
// max-probe >> the feature. The DIRECTION (travelOwn primary / travelOpp secondary, shared with the corner via
// probeBlocks) was already correct; only the magnitude was wrong. So the endpoint is now max-probe-INDEPENDENT.
test('the diagonal lands near ② and is independent of max-probe (sane #21=50, not scaled to dist)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const w = new MiddleWizard();
    const stock = { x: 100, y: 80, z: 20, shape: 'boss' };
    const endpointErr = (dist) => {
      const p = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20, dist, inAxis: 'auto', transAxis: 'auto' };
      const code = w.generate(p), starts = w.inferStarts(p, stock);
      const segs = traceToolpath(code, { stock, start: starts[0], passStarts: starts }).segments || [];
      const diag = segs.filter((s) => (s.type === 'rapid' || s.rapid) && Math.abs(s.x2 - s.x1) > 1 && Math.abs(s.y2 - s.y1) > 1)[0];
      const twoLocal = { x: starts[1].x - starts[0].x, y: starts[1].y - starts[0].y };
      return Math.hypot(diag.x2 - twoLocal.x, diag.y2 - twoLocal.y);   // distance from the diagonal endpoint to ②
    };
    return { err60: endpointErr(60), err100: endpointErr(100), default21: /#21\s*=\s*50\b/.test(w.generate({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20, inAxis: 'auto', transAxis: 'auto' })) };
  });
  expect(r.default21, 'the Diag-travel default is a sane fixed 50, not [#19+#20]/2').toBe(true);
  expect(r.err60, 'diagonal lands near ② at dist=60').toBeLessThan(12);
  expect(r.err100, 'diagonal lands near ② at dist=100 (the old overshoot case)').toBeLessThan(12);
  expect(Math.abs(r.err60 - r.err100), 'endpoint is max-probe-INDEPENDENT (decoupled from dist)').toBeLessThan(1);
});

test('round-trip: the per-traverse toggles + Diag travel reverse-sync from the block stack', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const back = await page.evaluate(async () => {
    const ops = await import('/blocks/opSession.js');
    const rec = await import('/blocks/opRecord.js');
    rec.recordOp('middle', { featureType: 'boss', findBoth: true, inAxis: 'manual', transAxis: 'auto', diagTravel: '25', axis: 'X', dir1: 'pos', dir2: 'neg' });
    const built = ops.buildActiveOpStack();
    window.ddcsLoadBlockStack(built.blocks);
    return ops.reconcileActiveOp();
  });
  expect(back.fields.m_inaxis, 'in-axis toggle reverse-synced').toBe('manual');
  expect(back.fields.m_transaxis, 'trans-axis toggle reverse-synced').toBe('auto');
  expect(back.fields.m_diag_travel, 'Diag travel reverse-synced from #21').toBe('25');
});

test('form: a boss probe-both shows both toggles + the Diag travel field; a pocket hides them', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });
  const shown = (id) => { const b = document.getElementById(id); return b && !b.classList.contains('hidden'); };
  const setAndRead = async (type, both) => page.evaluate(async ({ type, both }) => {
    document.getElementById('m_type').value = type;
    document.getElementById('m_both').checked = both;
    document.getElementById('m_transaxis').value = 'auto';
    window.ddcsStudio.wizardManager.update();
    const s = (id) => { const b = document.getElementById(id); return !!b && !b.classList.contains('hidden'); };
    return { inaxis: s('m_inaxis_block'), transaxis: s('m_transaxis_block'), diag: s('m_diag_block') };
  }, { type, both });

  const boss = await setAndRead('boss', true);
  expect(boss.inaxis, 'in-axis toggle shows for a boss').toBe(true);
  expect(boss.transaxis, 'trans-axis toggle shows for a boss probe-both').toBe(true);
  expect(boss.diag, 'Diag travel shows for a boss probe-both auto trans-axis').toBe(true);

  const pocket = await setAndRead('pocket', true);
  expect(pocket.inaxis, 'in-axis toggle hidden for a pocket').toBe(false);
  expect(pocket.transaxis, 'trans-axis toggle hidden for a pocket').toBe(false);
  expect(pocket.diag, 'Diag travel hidden for a pocket').toBe(false);
});
