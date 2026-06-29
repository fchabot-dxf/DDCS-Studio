import { test, expect } from '@playwright/test';

/**
 * B1 — `def.sim.starts` declarative path (Option A: structured anchor+offset ROWS). A CUSTOM op declares its per-pass
 * sim-starts as DATA; `makeProvider(rows)` interprets them into the per-pass starts the registry serves, the SAME seam
 * (setUserSimStarts) the wizards/built-ins use. Locks: (a) PROOF-OF-SUFFICIENCY — a built-in's pattern expressed as rows
 * matches its own inferStarts; (b) every anchor / plane / @token / the conditional pass-count; (c) a DECLARED def.sim.starts
 * flows through opSimStarts (the userOps wiring + the registry seam). Built-ins keep their fns — the spec serves custom ops.
 */
test.use({ viewport: { width: 1024, height: 768 } });

const round = (a) => a.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) }));

test('(a) PROOF-OF-SUFFICIENCY: a built-in pattern as def.sim.starts rows == its own inferStarts', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { makeProvider, opSimStarts } = await import('/viz/opSimStarts.js');

    // MIDDLE boss-both (auto): two wall-edge passes, the 2nd gated on twoAxis — exercises edge + @dir + @outset + probe + when
    const stockM = { x: 100, y: 80, z: 20 };
    const pM = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', dist: 100 };
    const middleRows = [
      { anchor: 'edge', axis: 'X', side: '@dir1', out: '@outset', plane: 'probe' },
      { anchor: 'edge', axis: 'Y', side: '@dir2', out: '@outset', plane: 'probe', when: { param: 'twoAxis', is: true } },
    ];
    const middleGot = makeProvider(middleRows)(pM, stockM);
    const middleWant = opSimStarts('middle', pM, stockM);

    // ALIGNMENT (fence along X): two fraction passes near the +Y edge — exercises frac + top
    const stockA = { x: 150, y: 100, z: 25 };
    const pA = { checkAxis: 'X' };
    const alignRows = [
      { anchor: 'frac', fx: 0.3, fy: 0.85, plane: 'top' },
      { anchor: 'frac', fx: 0.7, fy: 0.85, plane: 'top' },
    ];
    const alignGot = makeProvider(alignRows)(pA, stockA);
    const alignWant = opSimStarts('alignment', pA, stockA);
    return { middleGot, middleWant, alignGot, alignWant };
  });
  expect(round(r.middleGot), 'middle boss-both AS ROWS matches its built-in inferStarts').toEqual(round(r.middleWant));
  expect(round(r.alignGot), 'alignment AS ROWS matches its built-in inferStarts').toEqual(round(r.alignWant));
});

test('(b) every anchor / plane / @token / when-gate interprets correctly', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { makeProvider } = await import('/viz/opSimStarts.js');
    const stock = { x: 100, y: 80, z: 20 };   // cx=50 cy=40 · probeZ=-5 top=5 · outset(dist100)=15 · R=min(80,20)/2=10
    const p = { dir1: 'pos', dir2: 'neg', dist: 100 };
    const one = (row, params) => makeProvider([row])(params || p, stock)[0];
    const gateRows = [{ anchor: 'centre', plane: 'probe' }, { anchor: 'centre', plane: 'top', when: { param: 'twoAxis', is: true } }];
    return {
      centre: one({ anchor: 'centre', plane: 'probe' }),
      edgeXmin: one({ anchor: 'edge', axis: 'X', side: 'min', out: 10, plane: 'top' }),
      edgeXmax: one({ anchor: 'edge', axis: 'X', side: 'max', out: 10, plane: 'top' }),
      edgeYtok: one({ anchor: 'edge', axis: 'Y', side: '@dir2', out: '@outset', plane: 'probe' }),  // @dir2=neg → max side
      frac: one({ anchor: 'frac', fx: 0.25, fy: 0.5, plane: 'top' }),
      radialPlus: one({ anchor: 'radial', axis: 'Y', sign: '+', r: 10, plane: '@flank' }),
      radialTok: one({ anchor: 'radial', axis: 'X', sign: '-', r: '@R', plane: 0 }),
      planeNum: one({ anchor: 'centre', plane: -7 }),
      twoOn: makeProvider(gateRows)({ twoAxis: true }, stock).length,
      twoOff: makeProvider(gateRows)({ twoAxis: false }, stock).length,
    };
  });
  const eq = (g, x, y, z) => { expect(Math.round(g.x)).toBe(x); expect(Math.round(g.y)).toBe(y); expect(Math.round(g.z)).toBe(z); };
  eq(r.centre, 50, 40, -5);
  eq(r.edgeXmin, -10, 40, 5);             // min side → -out
  eq(r.edgeXmax, 110, 40, 5);             // max side → sx+out
  eq(r.edgeYtok, 50, 95, -5);             // @dir2=neg → max → sy + @outset(15); plane=probe → -5
  eq(r.frac, 25, 40, 5);                  // sx*0.25, sy*0.5, top
  eq(r.radialPlus, 50, 50, -10);          // cy + r(10); plane @flank = -R(10)
  eq(r.radialTok, 40, 40, 0);             // cx - @R(10); plane number 0
  eq(r.planeNum, 50, 40, -7);             // plane = a literal number
  expect(r.twoOn, 'when twoAxis is true → both rows').toBe(2);
  expect(r.twoOff, 'when twoAxis is false → the gated row drops (the conditional pass count)').toBe(1);
});

test('(c) a DECLARED def.sim.starts flows through opSimStarts — the userOps wiring + the registry seam', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const { opSimStarts, setUserSimStarts, makeProvider } = await import('/viz/opSimStarts.js');
    const stock = { x: 100, y: 80, z: 20 };

    // direct seam: a rows-built provider registered via setUserSimStarts is what opSimStarts serves
    setUserSimStarts('user_seam', makeProvider([{ anchor: 'edge', axis: 'X', side: 'min', out: 12, plane: 'probe' }]));
    const seamX = opSimStarts('user_seam', {}, stock)[0].x;

    // full userOps path: createUserOp carrying def.sim.starts → registered provider → opSimStarts
    const rows = [
      { anchor: 'centre', plane: 'probe' },
      { anchor: 'edge', axis: 'Y', side: 'max', out: 8, plane: 'top', when: { param: 'twoAxis', is: true } },
    ];
    U.createUserOp(U.userOpFromStack('starts_decl', 'Starts',
      [{ type: 'move', params: { mode: 'rapid', x: 5 } }], [], 'form3d', { starts: rows }));
    const declOff = opSimStarts('user_starts_decl', { twoAxis: false }, stock);
    const declOn = opSimStarts('user_starts_decl', { twoAxis: true }, stock);
    U.deleteUserOp('user_starts_decl');
    const afterDel = opSimStarts('user_starts_decl', { twoAxis: true }, stock);

    setUserSimStarts('user_seam', null);
    localStorage.removeItem('ddcs_user_ops');
    return { seamX, declOffLen: declOff.length, declOnLen: declOn.length, declOffZ: declOff[0].z, afterDel };
  });
  expect(Math.round(r.seamX), 'the registered rows-provider is what opSimStarts serves').toBe(-12);
  expect(r.declOffLen, 'def.sim.starts registered via createUserOp → 1 pass when the gate is off').toBe(1);
  expect(r.declOnLen, 'the gated 2nd pass appears when twoAxis is true').toBe(2);
  expect(Math.round(r.declOffZ), 'pass-1 plane=probe → -5').toBe(-5);
  expect(r.afterDel, 'delete clears the declared provider → null (no built-in for a user op)').toBeNull();
});
