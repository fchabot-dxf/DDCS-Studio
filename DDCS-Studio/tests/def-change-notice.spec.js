import { test, expect } from '@playwright/test';

/**
 * DEF-CHANGE → REBUILD NOTICE, N1+N2 (t287). A DECLARED per-def version stamp (`defV`) rides the @DDCS marker.
 * On import, a marker whose stamped defV is BEHIND the current registered def → the op was built with an older
 * wizard version and importMarkedNc regenerated it from the CURRENT builder (forward-only). staleMarkedOps detects
 * this by a LOOKUP (not a body diff) → a transparency notice. Same-version → nothing; legacy no-defV → v0.
 */
test.use({ viewport: { width: 1200, height: 900 } });

test('N1+N2: version stamp + import staleness detect (lookup) + forward-only rebuild + legacy v0', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const PM = await import('/blocks/programModel.js');
    const { markerLine } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    localStorage.removeItem('ddcs_user_ops');

    // a PLAIN user op with a real builder (a move whose Z is the 'depth' param) → defV defaults to 1
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('vtest', 'VTest', template, bindings));
    const v1 = U.defVOf('user_vtest');                 // should be 1 (fresh def stamp)

    // a v1-stamped marked .nc — the body after the marker is DELIBERATELY BOGUS (an old def's stale emit)
    const fileV1 = markerLine('user_vtest', { depth: -5 }, v1) + '\nG0 X999 Y999   ; stale body from an old def\n';
    const staleSame = PM.staleMarkedOps(fileV1);        // v1 vs current v1 → NOT stale

    // BUMP the def to v2 (author-declared → respected, not auto-inc'd)
    const def2 = U.listUserOps().find((d) => d.opType === 'user_vtest'); def2.defV = 2; U.updateUserOp(def2);
    const v2 = U.defVOf('user_vtest');
    const staleBumped = PM.staleMarkedOps(fileV1);       // marker v1 < current v2 → STALE
    const summary = PM.defChangeSummary(staleBumped);

    // FORWARD-ONLY: importMarkedNc rebuilds from the CURRENT builder; the bogus file body is discarded
    const stack = PM.importMarkedNc(fileV1);
    const rebuilt = emitMapped(stack).text;

    // LEGACY: a marker stamped with NO defV → treated as v0
    const legacyFile = markerLine('user_vtest', { depth: -5 }, 0);
    const staleLegacy = PM.staleMarkedOps(legacyFile);

    // an UNVERSIONED op (built-in with no user-def) never flags
    const builtinMarker = markerLine('drill', { holeDia: 6 }, 0);
    const staleBuiltin = PM.staleMarkedOps(builtinMarker);

    return { v1, v2, staleSame, staleBumped, summary, rebuiltHasBogus: /X999/.test(rebuilt), rebuiltLen: rebuilt.trim().length, staleLegacy, staleBuiltin };
  });

  // N1 — the stamp
  expect(r.v1, 'a fresh user def stamps at v1').toBe(1);
  expect(r.v2, 'an author-declared bump is respected (not auto-inc past it)').toBe(2);

  // N2 — same version → NO notice
  expect(r.staleSame, 'v1 marker vs current v1 → not stale').toEqual([]);

  // N2 — bumped def → the notice names the op + the RIGHT version jump
  expect(r.staleBumped.length).toBe(1);
  expect(r.staleBumped[0]).toMatchObject({ opType: 'user_vtest', label: 'VTest', fromV: 1, toV: 2 });
  expect(r.summary, 'the transparency message names the op + versions').toContain('VTest v1→v2');

  // forward-only — the current builder produced the region; the file's stale body was discarded
  expect(r.rebuiltHasBogus, 'the bogus old-def body did NOT survive (rebuilt from the current builder)').toBe(false);
  expect(r.rebuiltLen, 'the region was genuinely rebuilt (non-empty)').toBeGreaterThan(0);

  // legacy no-defV → v0, flagged once, no crash
  expect(r.staleLegacy.length).toBe(1);
  expect(r.staleLegacy[0]).toMatchObject({ opType: 'user_vtest', fromV: 0, toV: 2 });

  // an unversioned/built-in op never flags (defVOf 0)
  expect(r.staleBuiltin, 'a built-in (no user def) is unversioned → never stale').toEqual([]);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('a dev-save re-author (undeclared defV) AUTO-INCREMENTS; a declared seed defV is respected', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: -3 } }];
    U.createUserOp(U.userOpFromStack('inc', 'Inc', template, []));   // v1
    const start = U.defVOf('user_inc');

    // a dev-save re-author produces a def with NO defV (userOpFromStack sets none) → updateUserOp bumps it
    U.updateUserOp(U.userOpFromStack('inc', 'Inc', template, []));
    const afterReauthor = U.defVOf('user_inc');

    // a DECLARED defV (a code seed / author-maintained) is respected as-is (no auto-inc past it)
    const d = U.listUserOps().find((x) => x.opType === 'user_inc'); d.defV = 7; U.updateUserOp(d);
    const afterDeclared = U.defVOf('user_inc');
    // and re-applying the SAME declared def again does not drift it (no boot-bump)
    const d2 = U.listUserOps().find((x) => x.opType === 'user_inc'); U.updateUserOp(d2);
    const afterReapply = U.defVOf('user_inc');

    return { start, afterReauthor, afterDeclared, afterReapply };
  });

  expect(r.start).toBe(1);
  expect(r.afterReauthor, 'an undeclared re-author auto-increments (instances now stale)').toBe(2);
  expect(r.afterDeclared, 'an author-declared defV is respected').toBe(7);
  expect(r.afterReapply, 'a declared def re-applied does not drift (no boot-bump)').toBe(7);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
