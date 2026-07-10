import { test, expect } from '@playwright/test';

// These tests drive the Middle wizard's SVG schematic in the hidden #middleVizContainer. The 'stroke-dashoffset toggles'
// test (t646) is now DETERMINISTIC — it stops the autoplay animator, kills the CSS transition, and reads the steady state
// synchronously, so it no longer races on getTotalLength/mid-transition frames. Retries remain for the other tests here,
// which drive the REAL autoplay animator and can still be load-sensitive under full-suite parallel contention.
test.describe.configure({ retries: 2 });

test.describe('MiddleViz utilities & animator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    // open via the manager — toolbar labels collapse to icon-only (v10.10), text click is unreliable
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
    // The live wizard now shows the shared 3D preview and hides #middleVizContainer; the SVG
    // schematic (+ its id-mapping / animator utilities under test here) is loaded by drawMiddleViz,
    // which the app's own SVG open path (openMiddleWiz / control-change listeners) calls. Drive it
    // here so the SVG is injected, then assert it's attached (container stays display:none).
    await page.evaluate(() => window.drawMiddleViz());
    await page.waitForSelector('#middleVizContainer svg', { state: 'attached' });
  });

  test('getVizIds returns canonical selectors and resolveVizIds finds existing elements', async ({ page }) => {
    const ids = await page.evaluate(() => window.getVizIds({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: true }));
    expect(ids.axisGroupId).toBe('#middle_probe_pocket_X_pos');
    expect(ids.probePathId).toContain('probepath');   // step-suffixed naming since the SVG rework

    // resolve against the single-axis artwork — the twoAxis variant needs the missing _2axis_ SVG groups (see fixme below)
    const resolved = await page.evaluate(() => window.resolveVizIds({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: false }));
    // probePathSelector should resolve to an actual selector string or null
    expect(resolved.probePathSelector).not.toBeNull();
    // retractPathSelector should also resolve (some SVGs use _retractarrow variant)
    expect(resolved.retractPathSelector).not.toBeNull();
  });

  test('PathAnimator plays sequential steps for axis (fast timings for test)', async ({ page }) => {
    // arrange: discover steps for a single-axis pocket flow
    const animInput = await page.evaluate(() => window.discoverAnimSteps({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: false }));
    expect(animInput.axis1Steps.length).toBeGreaterThan(0);

    // instantiate animator with fast pace for test determinism (no loop)
    await page.evaluate(() => { window.__anim = new window.PathAnimator({ pxPerSec: 500, loop: false }); });

    // start the animation and await completion
    await page.evaluate((s) => window.__anim.playSequence(s), animInput);

    // After completion (no loop), all steps should still have path-draw (stays visible until loop clear)
    for (const step of animInput.axis1Steps) {
      await expect(page.locator(step.selector)).toHaveClass(/path-draw/);
    }
  });

  test('MiddleVizManager.updateVisibility exposes opposite-axis 2axis child for Find Both', async ({ page }) => {
    // STALE DESIGN: dedicated `_2axis_*` overlay groups were never the plan — the SVG
    // visualizes Find Both by CHAINING the single-axis step groups in sequence
    // (axis1 → jog → axis2). Rewrite around updateVisibility/discoverAnimSteps chaining
    // and drop the `_2axis_` id candidates from middleVizUtils while at it.
    test.fixme();
    await page.evaluate(() => {
      const m = new window.MiddleVizManager('#middleVizContainer');
      // show pocket, axis X pos, findBoth true, dir2 pos
      m.updateVisibility({ featureType: 'pocket', axis: 'X', dir1: 'pos', findBoth: true, dir2: 'pos' });
      window.__mvm = m;
    });

    // opposite-axis parent should be visible (Y_pos)
    await expect(page.locator('#middleVizContainer #middle_probe_pocket_Y_pos')).toBeVisible();
    // the corresponding 2axis child should be visible
    await expect(page.locator('#middleVizContainer #middle_probe_pocket_Y_pos_2axis_YtoX_pos')).toBeVisible();
  });

  test('Autoplay starts animation when Middle wizard opens', async ({ page }) => {
    // capture console output for diagnostics
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

    // ensure controls are set to a known single-axis case
    await page.selectOption('#m_type', 'pocket');
    await page.selectOption('#m_axis', 'X');
    await page.selectOption('#m_dir', 'pos');

    // open the Middle wizard (updateMiddleWizard will be called and autoplay should start)
    // open via the manager — toolbar labels collapse to icon-only (v10.10), text click is unreliable
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
    await page.evaluate(() => window.drawMiddleViz());   // inject the SVG schematic (live open path uses 3D preview)
    await page.waitForSelector('#middleVizContainer svg', { state: 'attached' });
    // Re-run the wizard update now that the SVG exists so autoplay discovers steps against it
    // (mirrors the live control-change listener: change → updateMiddleWizard → PathAnimator autoplay).
    await page.evaluate(() => window.ddcsStudio.wizardManager.updateMiddleWizard());

    // discover the steps for a known single-axis case
    const animInput = await page.evaluate(() => {
      return window.discoverAnimSteps({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: false });
    });
    const probeSel = animInput.axis1Steps.length > 0 ? animInput.axis1Steps[0].selector : null;

    // give console messages a short moment to arrive
    await page.waitForTimeout(120);
    // ensure drawMiddleViz and PathAnimator were invoked
    expect(logs.some(l => /drawMiddleViz: start|SVG loaded/.test(l.text))).toBeTruthy();
    expect(logs.some(l => /PathAnimator.playSequence START/.test(l.text))).toBeTruthy();

    // the probe path (step1) should receive the .path-draw class shortly after opening
    if (probeSel) {
      await expect(page.locator(probeSel)).toHaveClass(/path-draw/, { timeout: 1200 });

      // ensure multiple steps were discovered
      expect(animInput.axis1Steps.length).toBeGreaterThanOrEqual(2);

      // wait for animator to finish and assert final state
      await page.waitForFunction(() => document.body.getAttribute('data-middle-anim') === 'done', null, { timeout: 8000 });
      const animState = await page.evaluate(() => document.body.getAttribute('data-middle-anim'));
      expect(animState).toBe('done');
    } else {
      test.skip();
    }
  });

  test('stroke-dashoffset toggles when `.path-draw` is applied', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // open via the manager — toolbar labels collapse to icon-only (v10.10), text click is unreliable
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
    await page.evaluate(() => window.drawMiddleViz());   // inject the SVG schematic (live open path uses 3D preview)
    await page.waitForSelector('#middleVizContainer svg', { state: 'attached' });

    // Ensure a known view
    await page.selectOption('#m_type', 'pocket');
    await page.selectOption('#m_axis', 'X');
    await page.selectOption('#m_dir', 'pos');

    const probeSel = await page.evaluate(() => {
      const animInput = window.discoverAnimSteps({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: false });
      return animInput.axis1Steps.length > 0 ? animInput.axis1Steps[0].selector : null;
    });

    if (!probeSel) {
      test.skip();
      return;
    }

    // t646 — DETERMINISTIC steady-state read (was flaky: the looping autoplay animator concurrently mutated this
    // element's inline stroke-dashoffset, and the CSS 1s dashoffset TRANSITION meant an immediate getComputedStyle
    // read caught a MID-TRANSITION value, not the target). Fix: stop the animator, kill the transition, set a known
    // hidden state (dashoffset = path length), and toggle .path-draw + read both computed values SYNCHRONOUSLY in one
    // evaluate so no autoplay callback can slip in. This tests the pure CSS-class behaviour: .path-draw → 0 !important;
    // without it → the (non-zero) path-length offset. Geometry-race-proof too (len is clamped ≥ 1 if getTotalLength=0).
    const res = await page.locator(probeSel).evaluate((el) => {
        try { window.__middleAnimator && window.__middleAnimator.stop(); } catch (e) {}
        el.style.transition = 'none';                                                   // no 1s animation → instant, steady-state reads
        const len = Math.max(1, Math.ceil(el.getTotalLength ? el.getTotalLength() : 0) + 1);
        el.style.strokeDasharray = String(len);
        el.classList.remove('path-draw');                                               // hidden: inline dashoffset = path length
        el.style.strokeDashoffset = String(len);
        const before = getComputedStyle(el).getPropertyValue('stroke-dashoffset');
        el.classList.add('path-draw');                                                  // drawn: .path-draw forces 0 !important (beats inline len)
        const after = getComputedStyle(el).getPropertyValue('stroke-dashoffset');
        return { before, after };
    });
    expect(parseFloat(res.before), 'hidden: dashoffset = path length (non-zero)').not.toBe(0);
    expect(parseFloat(res.after), 'drawn: .path-draw forces dashoffset to 0').toBe(0);
  });

  test('jog/traverse uses dashoffset reveal (no compound dasharray)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // open via the manager — toolbar labels collapse to icon-only (v10.10), text click is unreliable
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
    await page.evaluate(() => window.drawMiddleViz());   // inject the SVG schematic (live open path uses 3D preview)
    await page.waitForSelector('#middleVizContainer svg', { state: 'attached' });

    // Configure controls to a two-axis case so a jog path exists
    await page.selectOption('#m_type', 'pocket');
    await page.selectOption('#m_axis', 'X');
    await page.selectOption('#m_dir', 'pos');
    await page.check('#m_both');

    const animInput = await page.evaluate(() => window.discoverAnimSteps({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: true }));
    const jogSel = animInput.jogPath ? animInput.jogPath.selector : (animInput.axis1Steps || []).find(s => s.type === 'jog')?.selector || null;
    if (!jogSel) { test.skip(); return; }

    // Ensure element is present and not initially drawn
    await page.locator(jogSel).evaluate(el => el.classList.remove('path-draw'));

    // Start animator (fast, no loop) and run the sequence
    await page.evaluate(() => { window.__anim = new window.PathAnimator({ pxPerSec: 500, loop: false }); });
    await page.evaluate((s) => window.__anim.playSequence(s), animInput);

    // Immediately after start: dasharray must be a simple TWO-value pattern (e.g. 8 6) — not a long compound list.
    // getComputedStyle serializes it as "8px, 6px", so normalise (strip px, split on space/comma) and assert 2 values.
    const dashParts = (s) => s.replace(/px/g, '').split(/[\s,]+/).filter(Boolean);
    const dashDuring = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dasharray'));
    expect(dashParts(dashDuring).length, 'two-value dash pattern, not a compound list').toBe(2);
    expect(dashParts(dashDuring).every((p) => /^\d+(?:\.\d+)?$/.test(p)), 'dash values are plain numbers').toBeTruthy();

    // During the reveal the jog element itself should NOT animate its stroke-dashoffset
    // (dashes must remain stationary); a mask reveals the path instead.
    const offsetDuring = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dashoffset'));
    expect(parseFloat(offsetDuring), 'jog dashoffset stays 0 (mask reveal, not offset animation)').toBe(0);

    // Ensure final state uses offset=0 and dash pattern still two-value
    await page.waitForFunction((sel) => parseFloat(getComputedStyle(document.querySelector(sel)).getPropertyValue('stroke-dashoffset')) === 0, jogSel);
    const finalDash = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dasharray'));
    expect(dashParts(finalDash).length, 'final dash still a two-value pattern').toBe(2);
  });

  test('PathAnimator respects fastMultiplier and fastPxPerSec', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // open via the manager — toolbar labels collapse to icon-only (v10.10), text click is unreliable
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
    await page.evaluate(() => window.drawMiddleViz());   // inject the SVG schematic (live open path uses 3D preview)
    await page.waitForSelector('#middleVizContainer svg', { state: 'attached' });

    const animInput = await page.evaluate(() => window.discoverAnimSteps({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: true }));
    const jogSel = animInput.jogPath ? animInput.jogPath.selector : (animInput.axis1Steps || []).find(s => s.type === 'jog')?.selector || null;
    if (!jogSel) { test.skip(); return; }

    const len = await page.locator(jogSel).evaluate(el => el.getTotalLength());

    const durA = await page.evaluate((sel) => {
      const a = new window.PathAnimator({ pxPerSec: 100, fastMultiplier: 2, loop: false });
      return a._durationForStep(document.querySelector(sel), 'jog');
    }, jogSel);
    const expectedA = Math.max(200, Math.round((len / (100 * 2)) * 1000));
    expect(durA).toBe(expectedA);

    const durB = await page.evaluate((sel) => {
      const b = new window.PathAnimator({ pxPerSec: 100, fastPxPerSec: 300, loop: false });
      return b._durationForStep(document.querySelector(sel), 'jog');
    }, jogSel);
    const expectedB = Math.max(200, Math.round((len / 300) * 1000));
    expect(durB).toBe(expectedB);
  });
});