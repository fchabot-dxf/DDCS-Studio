import { test, expect } from '@playwright/test';

/**
 * t752 — COLLAPSIBLE WIZARD PANES + per-theme motion tokens + the header undo/redo yield rider.
 * t784 — SPLIT the atomic .wiz-visual collapse into INDIVIDUAL panes: the 2D layout and the 3D verify fold
 *   independently, each via a slim SIDE-CHEVRON strip (≥44px touch, both platforms; the t752 top title bars retire).
 *   PLATFORM-SPLIT reflow: desktop the surviving pane FILLS the freed space; mobile the surviving pane KEEPS its size
 *   and the freed space goes to the FORM below. State is app-wide per pane KIND (panePrefs, localStorage ddcs_panes).
 *  - The motion is DECLARED per theme (--drawer-* tokens); ONE engine reads them; reduced-motion ⇒ instant; ≤350ms cap.
 *  - RIDER: the header undo/redo stay REACHABLE at 360px (the hy-controls yield step).
 *  - View-only: emit is byte-identical whether a pane is collapsed or not.
 *
 * NOTE (t784 assert changes — strength KEPT, target moved): the t752 asserts that targeted the whole `.wiz-visual`
 * single bar/collapse now target the INDIVIDUAL `[data-viz-pane="preview3d"|"layout2d"]` panes and their side strips.
 * Every original property (shrink-to-bar, app-wide-per-kind, survives-reload, motion tokens, reduced-motion, emit
 * byte-identity) is still asserted — plus the new per-platform reflow + the ≥44px strip.
 */

const openWiz = async (page, type) => {
  await page.evaluate((t) => window.openWiz(t), type);
  await page.waitForSelector(`#wiz_${type}`, { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForFunction((t) => {
    const w = document.getElementById(`wiz_${t}`);
    return w && w.querySelector('.wiz-visual [data-viz-pane] > .wiz-pane-bar');
  }, type, { timeout: 8000 });
};
const pane = (page, type, kind) => page.locator(`#wiz_${type} [data-viz-pane="${kind}"]`);
const strip = (page, type, kind) => page.locator(`#wiz_${type} [data-viz-pane="${kind}"] > .wiz-pane-bar`);
const bodyH = (page, type, kind) => page.evaluate(([t, k]) => {
  const b = document.querySelector(`#wiz_${t} [data-viz-pane="${k}"] > .wiz-pane-body`);
  return b ? Math.round(b.getBoundingClientRect().height) : -1;
}, [type, kind]);
const visualH = (page, type) => page.evaluate((t) => Math.round(document.querySelector(`#wiz_${t} .wiz-visual`).getBoundingClientRect().height), type);

test.describe('collapse gives the form the space (mobile) — the surviving pane keeps its size', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('collapsing the 3D shrinks ITS pane to the strip; the 2D keeps its size + the form gains the space', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');

    const p3 = pane(page, 'contour', 'preview3d');
    const h3Expanded = (await p3.boundingBox()).height;
    expect(h3Expanded, 'the 3D pane is tall when expanded').toBeGreaterThan(150);
    const twoDbefore = await bodyH(page, 'contour', 'layout2d');
    const visBefore = await visualH(page, 'contour');

    await strip(page, 'contour', 'preview3d').click();
    // wait for the collapse ANIMATION to actually finish (attribute flips instantly, height settles up to ~350ms) —
    // under workers=2 load a bare attribute-wait measured mid-animation (~184px). Mirror the height-settle guard.
    await page.waitForFunction(() => { const el = document.querySelector('#wiz_contour [data-viz-pane="preview3d"]'); return el.getAttribute('data-collapsed') === '1' && el.getBoundingClientRect().height < 40; }, null, { timeout: 3000 });
    const h3Collapsed = (await p3.boundingBox()).height;
    expect(h3Collapsed, 'collapsed the 3D pane folds to a SLIM bar (just the chevron, ≤~28px)').toBeLessThanOrEqual(28);
    expect(h3Expanded - h3Collapsed, 'collapsing frees the 3D height').toBeGreaterThan(100);

    // the OTHER pane keeps its size (mobile: fixed height, not grown), and the visual total shrinks → form gains
    const twoDafter = await bodyH(page, 'contour', 'layout2d');
    expect(Math.abs(twoDafter - twoDbefore), 'the 2D pane KEEPS its size (does not grow)').toBeLessThan(8);
    expect(await visualH(page, 'contour'), 'the visual shrinks so the form below reclaims the space').toBeLessThan(visBefore - 100);

    // the strip toggles it back (wait for the expand animation to actually restore the height)
    await strip(page, 'contour', 'preview3d').click();
    await page.waitForFunction(() => { const el = document.querySelector('#wiz_contour [data-viz-pane="preview3d"]'); return el.getAttribute('data-collapsed') === '0' && el.getBoundingClientRect().height > 150; }, null, { timeout: 3000 });
    expect((await p3.boundingBox()).height, 'expands back to full').toBeGreaterThan(150);
  });

  test('the strips are chevron-ONLY (no text label), ≥44px touch, and leave NO empty band above either canvas', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');
    for (const kind of ['layout2d', 'preview3d']) {
      const r = await page.evaluate((k) => {
        const p = document.querySelector(`#wiz_contour [data-viz-pane="${k}"]`);
        const bar = p.querySelector(':scope > .wiz-pane-bar');
        const body = p.querySelector(':scope > .wiz-pane-body');
        const canvas = body.querySelector('.viz-canvas');
        const status = body.querySelector(':scope > .viz-status');
        const bb = bar.getBoundingClientRect(), bdy = body.getBoundingClientRect(), cv = canvas.getBoundingClientRect();
        return {
          w: Math.round(bb.width), h: Math.round(bb.height), text: bar.textContent.trim(),
          padTop: getComputedStyle(body).paddingTop, statusPos: status ? getComputedStyle(status).position : 'none',
          band: Math.round(cv.top - bdy.top),
        };
      }, kind);
      expect(r.w + 16, `${kind} strip ≥44px EFFECTIVE touch (28px visible + the 16px ::before gutter extension — t785, user: narrower strip)`).toBeGreaterThanOrEqual(44);
      expect(r.h, `${kind} strip ≥44px tall when expanded (touch target)`).toBeGreaterThanOrEqual(44);
      expect(r.text, `${kind} strip has NO visible text label (chevron only)`).toBe('');
      // no reserved band: the body has no top padding + the status chip OVERLAYS (absolute), so the canvas fills.
      expect(r.padTop, `${kind} body has no top-padding band`).toBe('0px');
      expect(r.statusPos, `${kind} status chip overlays (absolute), not a reserved row`).toBe('absolute');
      if (kind === 'layout2d') expect(r.band, 'the 2D canvas top ≈ the pane body top (no empty band above)').toBeLessThanOrEqual(2);
    }
  });

  test('the collapsed state is app-wide per pane KIND — 3 wizards inherit the folded 3D + it survives a reload', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });

    await openWiz(page, 'contour');
    await strip(page, 'contour', 'preview3d').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour [data-viz-pane="preview3d"]').getAttribute('data-collapsed') === '1');
    await page.evaluate(() => window.closeWiz && window.closeWiz());

    // two OTHER wizards open already with the 3D collapsed (the pref is per-kind, app-wide)
    for (const t of ['drill', 'surfacing']) {
      await openWiz(page, t);
      expect(await pane(page, t, 'preview3d').getAttribute('data-collapsed'), `${t} inherits the collapsed 3D`).toBe('1');
      expect(await pane(page, t, 'layout2d').getAttribute('data-collapsed'), `${t}'s 2D is independent (still expanded)`).toBe('0');
      await page.evaluate(() => window.closeWiz && window.closeWiz());
    }

    // survives a reload (persisted to localStorage per KIND, not the profile)
    const stored = await page.evaluate(() => localStorage.getItem('ddcs_panes'));
    expect(stored, 'collapsed state is in the app-wide ddcs_panes store, keyed by the 3D kind').toContain('preview3d');
    await page.reload();
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await openWiz(page, 'contour');
    expect(await pane(page, 'contour', 'preview3d').getAttribute('data-collapsed'), 'the 3D collapse survived reload').toBe('1');
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('desktop reflow — the surviving pane FILLS the freed space', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('collapse the 3D → the 2D expands to fill; collapse the 2D → the 3D fills (both ways)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');

    const h2Both = (await pane(page, 'contour', 'layout2d').boundingBox()).height;
    const h3Both = (await pane(page, 'contour', 'preview3d').boundingBox()).height;

    // collapse the 3D → the 2D fills the freed column
    await strip(page, 'contour', 'preview3d').click();
    // t869 rider — a REAL READINESS SIGNAL, not a timing window: wait until the reflow has SETTLED — the collapsed pane
    // folded to the strip (≤28, the .wiz-pane-body height transition complete) AND the surviving pane grew to fill. Keys
    // off the SAME height-settle the assertions check (the sibling mobile test at :53 uses this pattern); robust under a
    // loaded box + reduced-motion (no transitionend attach race, no fixed delay racing the animation).
    await page.waitForFunction((h2b) => {
        const c = document.querySelector('#wiz_contour [data-viz-pane="preview3d"]');
        const s = document.querySelector('#wiz_contour [data-viz-pane="layout2d"]');
        return c && s && c.getAttribute('data-collapsed') === '1' && c.getBoundingClientRect().height <= 28 && s.getBoundingClientRect().height > h2b + 100;
    }, h2Both, { timeout: 5000 });
    const h2Filled = (await pane(page, 'contour', 'layout2d').boundingBox()).height;
    const h3Strip = (await pane(page, 'contour', 'preview3d').boundingBox()).height;
    expect(h2Filled, 'the 2D grew to fill the freed 3D space').toBeGreaterThan(h2Both + 100);
    expect(h3Strip, 'the collapsed 3D folds to a slim bar (≤~28px)').toBeLessThanOrEqual(28);

    // expand 3D, then collapse the 2D → the 3D fills (symmetric)
    await strip(page, 'contour', 'preview3d').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour [data-viz-pane="preview3d"]').getAttribute('data-collapsed') === '0', null, { timeout: 3000 });
    await strip(page, 'contour', 'layout2d').click();
    // t869 rider — the same layout-stable settle wait (no timing window): the 2D folded to a strip AND the 3D grew to fill.
    await page.waitForFunction((h3b) => {
        const c = document.querySelector('#wiz_contour [data-viz-pane="layout2d"]');
        const s = document.querySelector('#wiz_contour [data-viz-pane="preview3d"]');
        return c && s && c.getAttribute('data-collapsed') === '1' && c.getBoundingClientRect().height <= 28 && s.getBoundingClientRect().height > h3b + 100;
    }, h3Both, { timeout: 5000 });
    const h3Filled = (await pane(page, 'contour', 'preview3d').boundingBox()).height;
    const h2Strip = (await pane(page, 'contour', 'layout2d').boundingBox()).height;
    expect(h3Filled, 'the 3D grew to fill the freed 2D space').toBeGreaterThan(h3Both + 100);
    expect(h2Strip, 'the collapsed 2D folds to a slim bar (≤~28px)').toBeLessThanOrEqual(28);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('motion tokens + reduced-motion', () => {
  test.use({ viewport: { width: 1200, height: 900 } });

  test('each theme declares a DISTINCT drawer-motion personality (token block)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    const sigs = {};
    for (const th of ['studio', 'normal', 'futuristic', 'organic', 'steampunk']) {
      sigs[th] = await page.evaluate((t) => {
        document.body.setAttribute('data-theme', t);   // the --drawer-* tokens are [data-theme] CSS rules
        const cs = getComputedStyle(document.body);
        return ['--drawer-dur', '--drawer-ease', '--drawer-reveal', '--drawer-dir', '--drawer-corner-expanded', '--drawer-corner-collapsed'].map((n) => cs.getPropertyValue(n).trim()).join('|');
      }, th);
    }
    // every theme's token signature is distinct (personality per theme)
    const uniq = new Set(Object.values(sigs));
    expect(uniq.size, `all 5 themes have a distinct drawer personality: ${JSON.stringify(sigs)}`).toBe(5);
    // each declares a real reveal keyword
    for (const [th, s] of Object.entries(sigs)) {
      expect(['slide', 'roll', 'fade', 'wipe', 'unfold'].some((r) => s.includes(r)), `${th} has a reveal`).toBe(true);
    }
  });

  test('the engine caps duration ≤350ms and goes INSTANT under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');
    await strip(page, 'contour', 'preview3d').click();
    // under reduced-motion the engine sets the effective duration to 0ms (on the toggled pane)
    const durEff = await page.evaluate(() => document.querySelector('#wiz_contour [data-viz-pane="preview3d"]').style.getPropertyValue('--drawer-dur-eff'));
    expect(durEff, 'reduced-motion ⇒ instant (0ms)').toBe('0ms');
    // and it still actually collapsed (functionally works)
    expect(await pane(page, 'contour', 'preview3d').getAttribute('data-collapsed')).toBe('1');
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});

test.describe('header rider + emit', () => {
  test('undo/redo stay REACHABLE (on-screen) at 360px (hy-controls yield step)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => {
      const h = document.querySelector('.app-header');
      const onScreen = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const b = e.getBoundingClientRect(); return b.left >= -0.5 && b.right <= window.innerWidth + 0.5; };
      return { overflow: h.scrollWidth - h.clientWidth, undo: onScreen('btn-undo'), redo: onScreen('btn-redo'), foldStep: h.classList.contains('hy-controls') };
    });
    expect(r.overflow, 'the header fits at 360px').toBeLessThanOrEqual(0);
    expect(r.undo, 'undo is on-screen at 360px').toBe(true);
    expect(r.redo, 'redo is on-screen at 360px').toBe(true);
    expect(r.foldStep, 'the hy-controls yield step engaged').toBe(true);
  });

  test('emit is BYTE-IDENTICAL whether a pane is collapsed or not (view-only)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
    await openWiz(page, 'contour');
    const read = () => page.evaluate(() => { const pre = document.querySelector('#wiz_contour_code'); return pre ? pre.textContent : ''; });
    const expanded = await read();
    await strip(page, 'contour', 'preview3d').click();
    await page.waitForFunction(() => document.querySelector('#wiz_contour [data-viz-pane="preview3d"]').getAttribute('data-collapsed') === '1');
    const collapsed = await read();
    expect(collapsed, 'collapsing a pane does not change the emitted G-code').toBe(expanded);
    await page.evaluate(async () => { const m = await import('/ui/panePrefs.js'); m.resetPanes(); });
  });
});
