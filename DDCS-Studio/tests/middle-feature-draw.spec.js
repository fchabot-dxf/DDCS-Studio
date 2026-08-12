import { test, expect } from '@playwright/test';

// DRAW THE FEATURE in the middle canvas. The STOCK shape is the ONE source — the 2D canvas reads it, the SAME value the 3D
// reads, so they always match. The op-type PRESELECTS it (a pocket op declares a pocket stock), and the stock panel
// OVERRIDES it (declare-default + autonomy-override). So: pick pocket → a cavity in BOTH; override the stock to boss → both
// show a boss (the bug the human caught — the 2D used to ignore a 'boss' override).
test.use({ viewport: { width: 1280, height: 900 } });

// t1730 port note — TWO GENUINE BEHAVIORAL GAPS, not selector issues, both confirmed by reading source (not guessed):
// (1) "the op-type PRESELECTS the stock shape" was `syncStockShape()`, code LOCAL to the retired middleView.js
//     (module-scoped `_lastShapeKey`, called from that view's own update() — never a shared/declared mechanism any
//     other renderer read). No twin equivalent — confirmed via middleData.js/panelTypes.js/userOpView.js, none of
//     which preselect stock.shape from featureType. UNREACHABLE from the live wizard bar for a while already
//     (middle's bar slot has `opensAs: 'user_middle_data'` — commandDeck.js routes every bar click straight to the
//     twin; only the OLD form of this test's opening gesture, a direct wizardManager.open('middle') call bypassing
//     the bar, ever exercised the legacy view's code path).
// (2) "a boss/cylinder stock draws its own fc-feature-boss glyph" was ALSO middleView.js-local (its own
//     buildFeatureItems). The twin's shared Layout-canvas source (panelTypes.js:275, "Only inside cavities draw;
//     an outer boss/solid has none") and the shared stock-modal source (engine/workpiece.js:171, "OUTSIDE features
//     (boss/round-boss) ARE the outer outline ... how/if they overlay a glyph is a later ... decision, not made
//     here") both deliberately draw NO glyph for boss/cylinder — only a pocket cavity gets one. This predates t1730
//     (the comments don't reference it) — it's a pre-existing, already-deferred scope limit, not a regression from
//     this act.
// Both tracked here rather than silently dropped, pending a human ruling on whether either is worth closing. The
// "pocket cavity" + "2D follows a stock-shape change" behaviors below are UNAFFECTED by either gap and asserted
// directly.
test.fixme('op-type preselects stock shape; boss/cylinder draw their own feature glyph — t1730: neither has a twin equivalent (both were middleView.js-local)', async () => {});

test('the 2D canvas reads stock.shape (matches 3D): a pocket cavity draws, and a stock-shape change is followed (not stuck on a stale cavity)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  // t1730 — 'middle' opens the twin now (its coded view is retired); '#wiz_user' is the shared twin panel.
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_middle_data'));
  await page.waitForSelector('#wiz_user', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#userVizContainer svg'));

  // set an EXPLICIT stock.shape (bypassing preselection entirely — see fixme above) and read what the 2D draws.
  // t1730 — old m_* ids retired; the twin's generic form renders every declared param as [data-param="<name>"], and
  // the Layout 2D canvas mounts in the shared #userVizContainer (form3d+2d panel mode), not a per-wizard id.
  const setShape = (shape) => page.evaluate((shape) => {
    window.ddcsGetSettings().stock.shape = shape;
    window.ddcsStudio.wizardManager.update();
    const svg = document.querySelector('#userVizContainer svg');
    const r = svg.querySelector('rect.fc-feature-pocket');
    return { stockShape: window.ddcsGetSettings().stock.shape, hasPocketCavity: !!r, cls: r ? r.getAttribute('class') : null, rectW: r ? +r.getAttribute('width') : null, stockW: (svg.querySelector('rect.fc-stock') || {}).getAttribute ? +svg.querySelector('rect.fc-stock').getAttribute('width') : null };
  }, shape);
  await page.evaluate(() => { const e = document.querySelector('[data-param="featureType"]'); if (e) { e.value = 'pocket'; e.dispatchEvent(new Event('change', { bubbles: true })); } });

  // POCKET stock → an inner CAVITY (blue), inset from the stock — the shared workpieceBackdrop path (workpiece.js)
  const p = await setShape('pocket');
  expect(p.stockShape).toBe('pocket');
  expect(p.hasPocketCavity, 'a pocket stock draws its cavity').toBe(true);
  expect(p.rectW, 'the cavity is INSET (smaller than the stock)').toBeLessThan(p.stockW - 5);

  // FOLLOW: switching AWAY from pocket makes the pocket cavity DISAPPEAR — proof the 2D reads the CURRENT
  // stock.shape on every render (not stuck on a stale cavity — the original bug this spec guards: "the 2D used to
  // ignore a 'boss' override"), even though boss itself draws no glyph of its own (gap (2) above).
  const b = await setShape('boss');
  expect(b.stockShape).toBe('boss');
  expect(b.hasPocketCavity, 'the stale pocket cavity is GONE once stock.shape is no longer pocket').toBe(false);

  // and back to pocket → the cavity reappears (not a one-way/init-only read)
  const back = await setShape('pocket');
  expect(back.hasPocketCavity, 'the cavity reappears when stock.shape returns to pocket').toBe(true);
});
