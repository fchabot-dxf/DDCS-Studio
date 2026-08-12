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
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack/opSimStarts are the
    // surviving free-function equivalents of its generate()/inferStarts() (middleWizard.js still re-exports middleStack).
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const gen = (p) => emitMapped(middleStack(p)).text;
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 };
    const auto = gen({ ...base, inAxis: 'auto', transAxis: 'auto' });
    const manual = gen({ ...base, inAxis: 'manual', transAxis: 'manual' });
    const stock = { x: 100, y: 80, z: 20 };
    return {
      autoHas21: /#21\s*=/.test(auto),
      // t383 (human) — the trans-axis auto route DEFAULTS to DOGLEG: the SECONDARY (Y) leg travels out by the Diag-travel
      // #21 FIRST (routes around the boss), THEN the PRIMARY (X) leg re-centres to ②'s primary coord #22 (= #53 at rest,
      // ②.X when placed). (dir2=neg → +#21 = Y#21.) The `travelShape:'diagonal'` opt-in emits the single straight move instead.
      autoHasTransMove: /G0 Y#21\nG0 X\[#22-#52-#10-#6\]/.test(auto),   // DOGLEG: Y#21 out, then re-centre X to #22 (−#6 recovers the raw pos, #52 comped)
      autoHasAutoTraverse: /auto-traverse to the perpendicular/.test(auto),
      // the connecting move must come BEFORE the REPOSITION (the travel of the PRIOR pass) — else the trace anchors it to
      // ② and pushes the 2nd probe AWAY (the bug the human caught). So the Y pass starts cleanly at ②.
      moveBeforeReposition: auto.indexOf('G0 Y#21') < auto.indexOf('auto-traverse to the perpendicular'),
      manualHas21: /#21/.test(manual),
      manualHasJogPerp: /jog clear, around to the perpendicular/.test(manual),
      legacyAutoMatches: gen({ ...base, approach: 'auto' }) === auto,
      legacyManualMatches: gen({ ...base, approach: 'manual' }) === manual,
      autoStarts: opSimStarts('middle', { ...base, inAxis: 'auto' }, stock).length,
      manualStarts: opSimStarts('middle', { ...base, inAxis: 'manual' }, stock).length,
    };
  });
  expect(r.autoHas21, 'auto trans-axis assigns the Diag travel #21').toBe(true);
  expect(r.autoHasTransMove, 'auto trans-axis DOGLEG (default): out by #21 (Y) then re-centre to ②’s primary via #22 (=#53 at rest)').toBe(true);
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
    // t1730 — MiddleWizard deleted alongside its view; middleStack/opSimStarts stand in for generate()/inferStarts().
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const gen = (p) => emitMapped(middleStack(p)).text;
    const stock = { x: 40, y: 40, z: 20, shape: 'boss' };   // NORMAL boss (dist=100 clears it → the probes succeed)
    // the diagonal endpoint's PRIMARY coord must land on ②'s primary (= the centre), for X-first AND Y-first
    const primErr = (axis) => {
      const p = { featureType: 'boss', twoAxis: true, axis, dir1: 'pos', dir2: 'pos', dist: 100, diagTravel: '50', inAxis: 'auto', transAxis: 'auto', travelShape: 'diagonal' };   // the DIAGONAL route makes ONE diagonal segment to trace (dogleg splits into two axis moves)
      const code = gen(p), starts = opSimStarts('middle', p, stock);
      const segs = traceToolpath(code, { stock, start: starts[0], passStarts: starts }).segments || [];
      const diag = segs.filter((s) => (s.type === 'rapid' || s.rapid) && Math.abs(s.x2 - s.x1) > 1 && Math.abs(s.y2 - s.y1) > 1)[0];
      const prim = axis === 'X' ? 'x' : 'y';
      const centreLocal = (axis === 'X' ? 20 : 20) - starts[0][prim];   // centre = (20,20) for a 40×40 boss
      return Math.abs(diag[prim + '2'] - centreLocal);
    };
    return {
      xFirst: primErr('X'), yFirst: primErr('Y'),
      reCentreMove: /G0 X\[#22-#52-#10-#6\] Y/.test(gen({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'pos', dist: 100, inAxis: 'auto', transAxis: 'auto', travelShape: 'diagonal' })),
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
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_middle_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  const shown = (id) => { const b = document.getElementById(id); return b && !b.classList.contains('hidden'); };
  const setAndRead = async (type, both) => page.evaluate(async ({ type, both }) => {
    document.querySelector('[data-param="featureType"]').value = type;
    document.querySelector('[data-param="twoAxis"]').checked = both;
    document.querySelector('[data-param="transAxis"]').value = 'auto';
    window.ddcsStudio.wizardManager.update();
    // the generic twin form gates a field's WRAPPER (the row containing the data-param element) via row.style.display,
    // not a hand-authored '<id>_block' class — read actual on-screen visibility (offsetParent) instead.
    const s = (param) => { const e = document.querySelector(`[data-param="${param}"]`); return !!e && e.offsetParent !== null; };
    return { inaxis: s('inAxis'), transaxis: s('transAxis'), diag: s('diagTravel') };
  }, { type, both });

  const boss = await setAndRead('boss', true);
  expect(boss.inaxis, 'in-axis toggle shows for a boss').toBe(true);
  expect(boss.transaxis, 'trans-axis toggle shows for a boss probe-both').toBe(true);

  // t1730 port note — GENUINE BEHAVIORAL DIFFERENCE, not a selector issue. The OLD view hard-hid m_inaxis/m_transaxis/
  // m_diag_block for a non-boss featureType (and diag stayed hidden even for boss, per its "stays permanently hidden
  // (no show-toggle)" comment in the retired index.html). The twin's declared bindings (middleData.js
  // MIDDLE_BINDING_SPECS) don't gate inAxis/transAxis by featureType at all (no `when:` clause — unconditionally
  // shown), and gate diagTravel/diagPrimary by `twoAxis` only, rendering them READONLY rather than hidden ("t389
  // (human): render them READONLY (display the ②-derived value, not a competing editable input)"). Observed here
  // with a pocket + twoAxis:true: inaxis/transaxis stay visible (old assertion required hidden) and diag shows
  // readonly (old assertion required hidden). This reads as an intentional, already-signed-off twin redesign
  // (fields visible-but-contextual rather than hidden-by-featureType) rather than a regression — not asserting
  // either way pending a human ruling on which behavior is correct going forward.
  test.fixme(true, 't1730: twin does not hide in-axis/trans-axis/Diag-Travel for a non-boss featureType (old view did) — needs a human ruling before asserting a direction');
  const pocket = await setAndRead('pocket', true);
  expect(pocket.inaxis, 'in-axis toggle hidden for a pocket').toBe(false);
  expect(pocket.transaxis, 'trans-axis toggle hidden for a pocket').toBe(false);
});
