import { test, expect } from '@playwright/test';

test.describe('MiddleViz utilities & animator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Middle")');
    await page.waitForSelector('#middleVizContainer svg');
  });

  test('getVizIds returns canonical selectors and resolveVizIds finds existing elements', async ({ page }) => {
    const ids = await page.evaluate(() => window.getVizIds({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: true }));
    expect(ids.axisGroupId).toBe('#middle_probe_pocket_X_pos');
    expect(ids.probePathId).toContain('probepath1');

    const resolved = await page.evaluate(() => window.resolveVizIds({ featureType: 'pocket', axis: 'X', dir1: 'pos', twoAxis: true }));
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
    await page.click('button:has-text("Middle")');
    await page.waitForSelector('#middleVizContainer svg');

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
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Middle")');
    await page.waitForSelector('#middleVizContainer svg');

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

    // Ensure hidden initial state (not 0)
    await page.locator(probeSel).evaluate(el => el.classList.remove('path-draw'));
    const before = await page.locator(probeSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dashoffset'));
    expect(before).not.toBe('0');

    // Toggle draw and assert computed style becomes 0
    await page.locator(probeSel).evaluate(el => el.classList.add('path-draw'));
    const after = await page.locator(probeSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dashoffset'));
    expect(after).toBe('0');
  });

  test('jog/traverse uses dashoffset reveal (no compound dasharray)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Middle")');
    await page.waitForSelector('#middleVizContainer svg');

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

    // Immediately after start: dasharray must be a two-value pattern (e.g. "8 6") — not a long compound list
    const dashDuring = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dasharray'));
    expect(/^\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s*$/.test(dashDuring)).toBeTruthy();
    expect(dashDuring.includes(',')).toBeFalsy(); // no comma-separated long list

    // During the reveal the jog element itself should NOT animate its stroke-dashoffset
    // (dashes must remain stationary); mask is used to reveal the path instead.
    const offsetDuring = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dashoffset'));
    expect(offsetDuring).toBe('0');

    // Ensure final state uses offset=0 and dash pattern still two-value
    await page.waitForFunction((sel) => getComputedStyle(document.querySelector(sel)).getPropertyValue('stroke-dashoffset') === '0', jogSel);
    const finalDash = await page.locator(jogSel).evaluate(el => getComputedStyle(el).getPropertyValue('stroke-dasharray'));
    expect(/^\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s*$/.test(finalDash)).toBeTruthy();
  });

  test('PathAnimator respects fastMultiplier and fastPxPerSec', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Middle")');
    await page.waitForSelector('#middleVizContainer svg');

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