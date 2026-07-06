import { test, expect } from '@playwright/test';

/**
 * WORKPIECE PIVOT — P0 THE getWorkpiece() SEAM (seam-only, NO consumer migrated, BYTE-IDENTICAL).
 *
 * getWorkpiece() PROJECTS the flat settings.stock → { outer, features[] } — a derived VIEW (mirrors
 * stockForViz/wcsForViz), NOT a storage rewrite. ASSERT-THE-VALUE (not just "something changed"):
 *  (1) the DERIVED legacy pocket cavity EQUALS the current hardcoded 25% inset (gcodeViz3d.js:1098 /
 *      middleView.js:48) across shapes — asserted vs INDEPENDENT hand-computed truth, not the impl;
 *  (2) the additive stock.features[] round-trips through save→load (localStorage) idempotently;
 *  (3) the ~36 existing readers are UNCHANGED — settings.stock still exposes the flat x/y/z/shape.
 */

test('P0 seam: getWorkpiece() projects flat stock byte-identical; features[] round-trips; flat readers unchanged', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings);

  // ── (1) PURE PROJECTION — plain-data inputs, INDEPENDENT-truth assertions (no DOM, no impl-derived expectations) ──
  const proj = await page.evaluate(async () => {
    const WP = await import('/engine/workpiece.js');
    const { projectWorkpiece, deriveLegacyFeatures, legacyPocketInset, featureType, featureSize } = WP;

    const boss    = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'boss',     show: true,  datum: 'nnp', pin: 'origin' });
    const box     = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'box',      show: true,  datum: 'nnp', pin: 'origin' });
    const cyl     = projectWorkpiece({ x: 150, y: 76, z: 76, shape: 'cylinder', show: false, datum: 'ccp', pin: 'g54', diameter: 60 });
    const pocket  = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket',   show: true,  datum: 'nnp', pin: 'origin' });
    const pocketS = projectWorkpiece({ x: 20,  y: 20, z: 10, shape: 'pocket',   show: true,  datum: 'nnp', pin: 'origin' });

    // declared features WIN over synthesized legacy (even for a legacy 'pocket' shape)
    const declared = [{ id: 'p1', shape: 'rect', side: 'inside', pos: { x: 30, y: 30 }, size: { x: 12, y: 8 }, depth: 5 }];
    const withDeclared = projectWorkpiece({ x: 100, y: 80, z: 20, shape: 'pocket', features: declared });

    return {
      boss, box, cyl, pocket, pocketS,
      insets: { a: legacyPocketInset(100, 80), b: legacyPocketInset(20, 20), c: legacyPocketInset(200, 200), d: legacyPocketInset(10, 4) },
      types: {
        rectOut:  featureType({ shape: 'rect',  side: 'outside' }),
        rectIn:   featureType({ shape: 'rect',  side: 'inside'  }),
        roundIn:  featureType({ shape: 'round', side: 'inside'  }),
        roundOut: featureType({ shape: 'round', side: 'outside' }),
      },
      sizeInside:  featureSize(boss,  { side: 'inside',  size: { x: 7, y: 3 } }),
      sizeOutside: featureSize(cyl,   { side: 'outside' }),
      derivedLen:  deriveLegacyFeatures({ x: 100, y: 80, z: 20, shape: 'boss' }).length,   // boss → NO synthesized feature
      withDeclared,
    };
  });

  // outer projection: shape maps boss|box|pocket→'rect', cylinder→'round'; dims/datum/pin/show ride verbatim; diameter→d
  expect(proj.boss.outer, 'boss → rect outer, flat dims verbatim').toEqual({ shape: 'rect', x: 100, y: 80, z: 20, d: undefined, datum: 'nnp', pin: 'origin', show: true });
  expect(proj.boss.features, 'boss → NO interior feature (probes the outline)').toEqual([]);
  expect(proj.box.outer.shape, "stray 'box' also → rect").toBe('rect');
  expect(proj.cyl.outer.shape, 'cylinder → round').toBe('round');
  expect(proj.cyl.outer.d, 'cylinder OD → outer.d').toBe(60);
  expect(proj.cyl.outer.show, 'show rides verbatim').toBe(false);
  expect(proj.cyl.features, 'cylinder → NO synthesized interior feature').toEqual([]);

  // THE byte-identical proof: the legacy pocket cavity EQUALS the hardcoded 25% inset. INDEPENDENT truth:
  // 100×80 → w=max(8, 0.25·min(100,80))=max(8,20)=20 → cavity centred {50,40}, size {100-40, 80-40}={60,40}, depth=z.
  expect(proj.pocket.features, 'legacy pocket 100×80 → the EXACT 25% cavity (independent truth)').toEqual([
    { id: 'legacy', shape: 'rect', side: 'inside', pos: { x: 50, y: 40 }, size: { x: 60, y: 40 }, depth: 20 },
  ]);
  // 20×20 → 0.25·20=5, floored to max(8,5)=8 → cavity {10,10}, size {20-16,20-16}={4,4}. Proves the max(8,…) floor.
  expect(proj.pocketS.features, 'legacy pocket 20×20 → the max(8,…) floor cavity (independent truth)').toEqual([
    { id: 'legacy', shape: 'rect', side: 'inside', pos: { x: 10, y: 10 }, size: { x: 4, y: 4 }, depth: 10 },
  ]);
  // the inset formula pinned vs independent literals across sizes
  expect(proj.insets, 'legacyPocketInset == max(8, 0.25·min(x,y)) across sizes').toEqual({ a: 20, b: 8, c: 50, d: 8 });

  // declared features WIN over legacy synthesis
  expect(proj.withDeclared.features, 'a declared features[] wins over the legacy pocket synthesis').toEqual([
    { id: 'p1', shape: 'rect', side: 'inside', pos: { x: 30, y: 30 }, size: { x: 12, y: 8 }, depth: 5 },
  ]);

  // featureType DERIVED from shape×side (F1); featureSize = the side toggle (F3)
  expect(proj.types).toEqual({ rectOut: 'boss', rectIn: 'pocket', roundIn: 'bore', roundOut: 'round-boss' });
  expect(proj.sizeInside, 'inside → the feature carries its own size').toEqual({ x: 7, y: 3 });
  expect(proj.sizeOutside, 'outside → inherits the outer block (shared)').toEqual({ x: 150, y: 76, d: 60 });
  expect(proj.derivedLen, 'boss/box/cylinder synthesize NO feature').toBe(0);

  // ── (2)+(3) THE LIVE SEAM: additive key declared, readers unchanged, save→load idempotent ──
  const live = await page.evaluate(async () => {
    const SP = await import('/ui/settingsPanel.js');
    const WP = await import('/engine/workpiece.js');
    const KEY = 'ddcs_studio_settings';
    const snapshot = localStorage.getItem(KEY);   // restore at the end so other tests are unaffected
    try {
      const defFeatures = SP.SETTINGS_DEFAULTS.stock.features;

      // readers-unchanged: the flat stock still exposes x/y/z/shape (a proxy for the ~36 flat readers)
      const before = SP.getSettings().stock;
      const flatSeen = { x: before.x, y: before.y, z: before.z, shape: before.shape };

      // save: write an additive features[] via applySettings (the merge/persist path)
      const feats = [{ id: 'f1', shape: 'rect', side: 'inside', pos: { x: 10, y: 10 }, size: { x: 5, y: 5 }, depth: 3 }];
      SP.applySettings({ stock: { features: feats } });

      const afterMem  = SP.getSettings().stock;                       // in-memory read-back
      const afterDisk = JSON.parse(localStorage.getItem(KEY)).stock;  // persisted (save→load round-trip)
      const liveWp    = WP.projectWorkpiece({ ...SP.getSettings().stock, shape: 'pocket' });   // a 'pocket' OUTER surfaces the DECLARED inside feature (a boss filters it — t367); the DATA round-trip is asserted via mem/disk

      // a partial stock write must PRESERVE features (the {...D,...S,...incoming} merge keeps unrelated keys)
      SP.applySettings({ stock: { shape: 'boss' } });
      const afterPartial = SP.getSettings().stock.features;

      return {
        defFeatures, flatSeen,
        memFeatures: afterMem.features, diskFeatures: afterDisk.features,
        liveFeatures: liveWp.features, liveOuter: liveWp.outer,
        afterPartial,
        // the flat dims survived every write (readers still see them)
        flatStillThere: { x: afterMem.x, y: afterMem.y, z: afterMem.z, shape: afterMem.shape },
      };
    } finally {
      // restore the persisted blob; each spec reloads the page (fresh settings import), so in-memory state doesn't leak
      if (snapshot != null) localStorage.setItem(KEY, snapshot); else localStorage.removeItem(KEY);
    }
  });

  expect(live.defFeatures, 'the additive key is DECLARED in the stock default (empty)').toEqual([]);
  expect(live.flatSeen, 'flat readers see x/y/z/shape unchanged (default)').toEqual({ x: 100, y: 80, z: 20, shape: 'boss' });
  const feats = [{ id: 'f1', shape: 'rect', side: 'inside', pos: { x: 10, y: 10 }, size: { x: 5, y: 5 }, depth: 3 }];
  expect(live.memFeatures, 'applySettings persists features[] in memory').toEqual(feats);
  expect(live.diskFeatures, 'features[] round-trips to localStorage (save→load idempotent)').toEqual(feats);
  expect(live.liveFeatures, 'the live getWorkpiece() surfaces the DECLARED feature (not legacy)').toEqual(feats);
  expect(live.afterPartial, 'a partial stock write PRESERVES features (merge keeps unrelated keys)').toEqual(feats);
  expect(live.flatStillThere, 'the flat dims survive writes — readers unchanged').toEqual({ x: 100, y: 80, z: 20, shape: 'boss' });
});
