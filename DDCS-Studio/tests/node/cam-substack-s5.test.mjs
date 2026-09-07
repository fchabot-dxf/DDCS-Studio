import { test, expect } from './support/harness.mjs';

// t1077 S5 — the CORRECTNESS punch-list.
// (4) defV STALENESS: the opunit stamps the twin's def version at fork time. If the user later EDITS that wizard def, the
// stamp goes behind — and deriveStandardParams would read the opunit's (older-shape) children through the CURRENT def's
// FROZEN bindings, silently reading the wrong sockets. It must degrade LOUDLY instead, never be silently wrong.
//
// (1) ERROR-PATH FALL-THROUGH (safety): composeParts strips every NON-terminal part's terminal M30 so the SUCCESS path
// flows into the next part — but each generator's error handler only set #1505 and fell through to that same stripped
// end, so a failed probe / tripped guard ran straight into the NEXT part's motion. Each error branch must now HALT.
//
// TIER MIGRATION WORK PACKAGE 4 — moved browser→node: both tests below are plain page.evaluate calls that import app
// modules, call fork/compose functions, and assert on plain returned data — no DOM read, no click, no screenshot. The
// STALE-sub-unit test reads the REAL surfacing twin via getUserDef/defVOf; the node tier's page.goto stub never runs
// app.js's seedDefaultPortedUserOps(), so surfacing is registered explicitly first via createUserOp (not a bare
// registerUserOp — wrapRecognizedForFork's defV stamp is read via defVOf, which reads the PERSISTED store, guarded by
// an existence check since node persists module state across tests in one process). The file's remaining test — (2),
// the duplicate-param-key CAM modal check — drives the real CAM authoring modal (window.ddcsOpenCamAuthoring,
// page.waitForSelector, real DOM queries) and depends on a registered op reachable through window.ddcsGetBlockProgram
// — a genuine app+DOM dependency, not a candidate for this tier. Split into tests/cam-substack-s5-drive.spec.js.

test('S5(4) — a STALE sub-unit (defV behind the current def) UNROLLS and says so; a current one stays LIVE', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { wrapRecognizedForFork } = await import('/blocks/devMode.js');
    const { getUserDef, defVOf, createUserOp, listUserOps } = await import('/blocks/userOps.js');
    const { subStackToSlot } = await import('/data/subStackToSlot.js');
    const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
    // node tier: page.goto doesn't run app.js's seedDefaultPortedUserOps(); createUserOp (not registerUserOp) so
    // defVOf resolves the twin's version the same way wrapRecognizedForFork expects
    if (!listUserOps().some((d) => d.opType === 'user_surfacing_data')) createUserOp(surfacingDataDef());
    const OPT = 'user_surfacing_data';
    const cur = defVOf(OPT);
    const mk = (stampV) => {
      const w = wrapRecognizedForFork(getUserDef(OPT));
      const root = w.template.find((b) => b.type === 'user_root');
      root.children[0].params.defV = stampV;           // the stamp recorded at fork time
      return subStackToSlot({ opType: 'user_stale_probe', template: w.template, bindings: [] });
    };
    const stale = mk(Math.max(0, cur - 1));              // forked against an OLDER def version
    const fresh = mk(cur);                               // forked against the CURRENT def version
    const LIVE = /WHILE #\d+ LT #\d+ DO2/;
    return {
      cur,
      staleName: stale.name, staleBody: stale.body, staleLive: LIVE.test(stale.body || ''),
      freshName: fresh.name, freshLive: LIVE.test(fresh.body || ''),
    };
  });
  expect(r.cur, 'the surfacing twin is versioned').toBeGreaterThan(0);
  // STALE → degraded, and it SAYS so (visible in the part header + the slot name + the macro itself)
  expect(r.staleName, 'the stale part names the version jump and the degradation').toMatch(/def v\d+→v\d+ — unrolled, no longer live/);
  expect(r.staleBody, 'the macro carries a STALE SUB-UNIT explanation').toMatch(/STALE SUB-UNIT/);
  expect(r.staleBody, 'and tells the user how to restore it').toMatch(/re-fork/i);
  expect(r.staleLive, 'a stale sub-unit is NOT silently re-derived as a live generator loop').toBe(false);
  // CURRENT → untouched: no false degradation
  expect(r.freshName, 'a current sub-unit is NOT flagged').not.toMatch(/unrolled, no longer live/);
  expect(r.freshLive, 'a current sub-unit stays a LIVE generator loop').toBe(true);
});

// (1) ERROR-PATH FALL-THROUGH (safety): composeParts strips every NON-terminal part's terminal M30 so the SUCCESS path
// flows into the next part — but each generator's error handler only set #1505 and fell through to that same stripped
// end, so a failed probe / tripped guard ran straight into the NEXT part's motion. Each error branch must now HALT.
test('S5(1) SAFETY — an ERRORING non-terminal composed part HALTS; the SUCCESS path still flows on into the next part', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerSlot } = await import('/data/probeToSlot.js');
    const { surfacingSlot } = await import('/data/millToSlot.js');
    const { slotFromOp } = await import('/data/opToSlot.js');
    const { composeParts, slotMacro } = await import('/data/slotPack.js');
    const used = new Set();
    const p1 = cornerSlot(used, 0);                       // part 1 — NON-terminal (its terminal M30 gets stripped)
    (p1.fields || []).forEach((f) => used.add(f.idx));
    const p2 = surfacingSlot(used, (p1.fields || []).length);
    const body = composeParts([p1.body, p2.body]);
    const lines = body.split('\n').map((s) => s.trim()).filter(Boolean);
    const errAt = lines.findIndex((l) => /;ERROR: probe did not trigger/.test(l));
    const n2At = lines.findIndex((l, i) => i > errAt && /^N2$/.test(l));
    // a FRAGMENT-tailed slot (drill has no M30 of its own) must still get the wrapper's terminator — the hasEnd tail-check
    const fragUsed = new Set();
    const f1 = cornerSlot(fragUsed, 0);
    (f1.fields || []).forEach((f) => fragUsed.add(f.idx));
    const f2 = slotFromOp('drill', 'circle', fragUsed, (f1.fields || []).length);
    const fragMacro = slotMacro({ slot: 22, name: 'frag', fields: [...(f1.fields || []), ...(f2.fields || [])], body: composeParts([f1.body, f2.body]) });
    return {
      errAt, afterErr: lines[errAt + 1] || '', n2At, afterN2: lines[n2At + 1] || '',
      lastLine: lines[lines.length - 1] || '',
      haltCount: lines.filter((l) => /^M30\b/.test(l)).length,
      fragTail: fragMacro.trim().split('\n').slice(-1)[0].trim(),
      fragHasM99: /\bM99\b/.test(fragMacro),
    };
  });
  // the ERROR branch halts right where it sets the fault — it can no longer reach the next part
  expect(r.errAt, 'the first part carries its error handler').toBeGreaterThan(0);
  expect(r.afterErr, 'the error branch HALTS immediately after flagging the fault').toMatch(/^M30\b/);
  // the SUCCESS convergence label is still NOT terminated — success must flow on into part 2
  expect(r.n2At, 'the success convergence label follows the error branch').toBeGreaterThan(r.errAt);
  expect(r.afterN2, 'the SUCCESS path is NOT halted — it flows into the next part').not.toMatch(/^M30\b/);
  expect(r.afterN2, 'and there IS a next part after it').not.toBe('');
  // the composed program still ends with exactly one terminal end
  expect(r.lastLine, 'the composed program ends with a terminator').toMatch(/^M30\b/);
  // a fragment-tailed composition still terminates (the slotMacro hasEnd TAIL check, not a body-wide scan)
  expect(r.fragHasM99, 'a slot whose LAST part is a fragment still gets the wrapper terminator').toBe(true);
  expect(r.fragTail, 'and it is the final line').toMatch(/^M99\b/);
});
