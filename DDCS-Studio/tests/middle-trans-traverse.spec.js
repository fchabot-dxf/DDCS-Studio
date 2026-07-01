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
      // B-TRANS (b): the PRIMARY (X) leg targets ②'s primary coord via #22 (= #53 re-centre at rest, ②.X when placed); the
      // SECONDARY (Y) leg travels out by the Diag-travel #21. (dir2=neg → +#21 = Y#21.)
      autoHasTransMove: /G0 X\[#22-#52-#10-#6\] Y#21/.test(auto),   // #22 = the diagonal X target; −#6 recovers the tool's raw position (#52 comped)
      autoHasAutoTraverse: /auto-traverse to the perpendicular/.test(auto),
      // the diagonal move must come BEFORE the REPOSITION (the connecting travel of the PRIOR pass) — else the trace
      // anchors it to ② and pushes the 2nd probe AWAY (the bug the human caught). So the Y pass starts cleanly at ②.
      moveBeforeReposition: auto.indexOf('G0 X[#22-#52-#10-#6] Y#21') < auto.indexOf('auto-traverse to the perpendicular'),
      manualHas21: /#21/.test(manual),
      manualHasJogPerp: /jog clear, around to the perpendicular/.test(manual),
      legacyAutoMatches: w.generate({ ...base, approach: 'auto' }) === auto,
      legacyManualMatches: w.generate({ ...base, approach: 'manual' }) === manual,
      autoStarts: w.inferStarts({ ...base, inAxis: 'auto' }, stock).length,
      manualStarts: w.inferStarts({ ...base, inAxis: 'manual' }, stock).length,
    };
  });
  expect(r.autoHas21, 'auto trans-axis assigns the Diag travel #21').toBe(true);
  expect(r.autoHasTransMove, 'auto trans-axis targets ②’s primary via #22 (=#53 at rest) + travels out by #21 (B-TRANS fix b)').toBe(true);
  expect(r.autoHasAutoTraverse, 'auto trans-axis is hands-free, not an operator jog').toBe(true);
  expect(r.moveBeforeReposition, 'the diagonal move is the connecting travel BEFORE the REPOSITION (so the Y pass anchors at ②)').toBe(true);
  expect(r.manualHas21, 'manual has no Diag travel').toBe(false);
  expect(r.manualHasJogPerp, 'manual trans-axis is an operator jog').toBe(true);
  expect(r.legacyAutoMatches, 'a legacy approach:auto == inAxis/transAxis:auto (byte-identical)').toBe(true);
  expect(r.legacyManualMatches, 'a legacy approach:manual == inAxis/transAxis:manual').toBe(true);
  expect(r.autoStarts, 'auto → 2 per-pass starts').toBe(2);
  expect(r.manualStarts, 'manual → 4 per-pass starts').toBe(4);
});

// The real fix (was mis-diagnosed as "circular"): the trans-axis diagonal's PRIMARY leg re-centres to the MEASURED centre
// #53, so it heads to ②'s primary coord REGARDLESS OF AXIS ORDER. The old hardcoded `travelOwn` primary sign sent X-first
// the WRONG WAY: the in-axis cross-over flings the tool far past centre (in +dir1), so +#21 drove it FURTHER out, not back.
// X-first now matches the (already-working) Y-first. The secondary leg still travels out by #21 (the user-tuned distance).
test('the trans diagonal re-centres the PRIMARY axis to ② for BOTH axis orders (X-first == Y-first)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const w = new MiddleWizard();
    const stock = { x: 40, y: 40, z: 20, shape: 'boss' };   // NORMAL boss (dist=100 clears it → the probes succeed)
    // the diagonal endpoint's PRIMARY coord must land on ②'s primary (= the centre), for X-first AND Y-first
    const primErr = (axis) => {
      const p = { featureType: 'boss', twoAxis: true, axis, dir1: 'pos', dir2: 'pos', dist: 100, diagTravel: '50', inAxis: 'auto', transAxis: 'auto' };
      const code = w.generate(p), starts = w.inferStarts(p, stock);
      const segs = traceToolpath(code, { stock, start: starts[0], passStarts: starts }).segments || [];
      const diag = segs.filter((s) => (s.type === 'rapid' || s.rapid) && Math.abs(s.x2 - s.x1) > 1 && Math.abs(s.y2 - s.y1) > 1)[0];
      const prim = axis === 'X' ? 'x' : 'y';
      const centreLocal = (axis === 'X' ? 20 : 20) - starts[0][prim];   // centre = (20,20) for a 40×40 boss
      return Math.abs(diag[prim + '2'] - centreLocal);
    };
    return {
      xFirst: primErr('X'), yFirst: primErr('Y'),
      reCentreMove: /G0 X\[#22-#52-#10-#6\] Y/.test(w.generate({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'pos', dist: 100, inAxis: 'auto', transAxis: 'auto' })),
    };
  });
  expect(r.reCentreMove, 'the primary leg targets #22 (=#53 re-centre at rest, ②.X when placed), not a fixed travel').toBe(true);
  expect(r.xFirst, 'X-first: primary re-centres onto ② (was sent the wrong way)').toBeLessThan(2);
  expect(r.yFirst, 'Y-first: primary re-centres onto ② (matches the working order)').toBeLessThan(2);
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

test('form: a boss probe-both shows both toggles; the Diag travel field is REMOVED (derived from ②, always hidden); a pocket hides the toggles', async ({ page }) => {
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
  expect(boss.diag, 'Diag travel field is REMOVED from the UI (inc2a) — #21 now derives from the ② marker, always hidden').toBe(false);

  const pocket = await setAndRead('pocket', true);
  expect(pocket.inaxis, 'in-axis toggle hidden for a pocket').toBe(false);
  expect(pocket.transaxis, 'trans-axis toggle hidden for a pocket').toBe(false);
  expect(pocket.diag, 'Diag travel field stays removed for a pocket too').toBe(false);
});
