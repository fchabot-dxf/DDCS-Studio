import { test, expect } from './support/harness.mjs';

// Universal CAM U0 — stackToSlot turns a user-op block stack into a CAM slot by injecting a LOCAL #var at each EXPOSED
// socket (val() rides it through to F#/Z#), prepending canonical readLines, and baking the rest as literals. Proven on a
// minimal custom op = a Feed atom + a Move cut, exposing FEED + a single-plunge Z, baking X/Y + the cut feed.
test('U0 stackToSlot: exposed params → #var + readLine (F#/Z#), baked params → literals; slotMacro renders', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { userOpFromStack } = await import('/blocks/userOps.js');
    const { stackToSlot } = await import('/data/stackToSlot.js');
    const slotPack = await import('/data/slotPack.js');

    // the target op: a base Feed atom + a Move cut (flatten: 0 user_root · 1 param_group · 2 feed · 3 move)
    const stack = [{
      type: 'user_root', params: {},
      uiChildren: [{ type: 'param_group', params: { group: 'Plunge' }, children: [] }],
      children: [
        { type: 'feed', params: { rate: 200 } },
        { type: 'move', params: { mode: 'cut', x: 10, y: 20, z: -3, feed: 500 } },
      ],
    }];
    const bindings = [
      { param: 'feed', blockIndex: 2, key: 'rate', type: 'number', default: 200, label: 'Feed', units: 'mm/min' },
      { param: 'z', blockIndex: 3, key: 'z', type: 'number', default: -3, label: 'Plunge Z', units: 'mm' },
      { param: 'x', blockIndex: 3, key: 'x', type: 'number', default: 10, label: 'X' },
      { param: 'y', blockIndex: 3, key: 'y', type: 'number', default: 20, label: 'Y' },
      { param: 'movefeed', blockIndex: 3, key: 'feed', type: 'number', default: 500, label: 'Cut feed' },
    ];
    const def = userOpFromStack('u0_plunge', 'U0 Plunge', stack, bindings);

    // Case A — expose FEED + Z; bake X/Y + the cut feed
    const A = stackToSlot(def, { feed: { exposed: true }, z: { exposed: true }, x: { exposed: false, value: 10 }, y: { exposed: false, value: 20 }, movefeed: { exposed: false, value: 500 } });
    // Case B — bake EVERYTHING (a fully-frozen slot)
    const B = stackToSlot(def, { feed: { exposed: false, value: 250 }, z: { exposed: false, value: -3 }, x: { exposed: false, value: 10 }, y: { exposed: false, value: 20 }, movefeed: { exposed: false, value: 500 } });

    const feedF = A.fields[0], zF = A.fields[1];
    return {
      A: { name: A.name, nfields: A.fields.length, feed: feedF, z: zF, body: A.body,
        mirrorFeed: slotPack.mirrorVar(feedF.idx), macro: slotPack.slotMacro({ slot: 22, name: A.name, fields: A.fields, body: A.body }) },
      B: { nfields: B.fields.length, body: B.body },
    };
  });

  // EXPOSED (Case A): 2 fields, allocated in the #11xx pool, each with a LOCAL #var + #2600 mirror
  expect(r.A.nfields, 'FEED + Z exposed → 2 fields').toBe(2);
  expect(r.A.feed, 'feed field: pool param + local #var').toMatchObject({ key: 'feed', idx: 1100, var: '#1', label: 'Feed', units: 'mm/min' });
  expect(r.A.z).toMatchObject({ key: 'z', idx: 1101, var: '#2', label: 'Plunge Z' });
  expect(r.A.mirrorFeed, 'feed #1100 mirrors #2600').toBe(2600);
  // the emit: the exposed #vars ride through val() verbatim; the baked params are literals
  expect(r.A.body, 'exposed feed → F#1 (rides val)').toContain('F#1');
  expect(r.A.body, 'exposed plunge Z → Z#2 (rides val)').toContain('Z#2');
  expect(r.A.body, 'baked X → literal').toContain('X10');
  expect(r.A.body, 'baked Y → literal').toContain('Y20');
  expect(r.A.body, 'baked cut feed → literal').toContain('F500');
  // PREPENDED canonical readLines: the LOCAL #var reads its #2600 mirror (Refresh-fields parity)
  expect(r.A.body, 'feed readLine reads #2600 into #1').toMatch(/#1=#2600\s+;Feed/);
  expect(r.A.body, 'Z readLine reads #2601 into #2').toMatch(/#2=#2601\s+;Plunge Z/);
  // the #2600 chain: the pendant's #2600 → #1 (readLine) → F#1 (the emitted feed word) — so the seed controls the feed
  expect(r.A.body).toMatch(/#1=#2600[\s\S]*F#1/);
  // slotMacro renders the slot (the reads + the cut move)
  expect(r.A.macro, 'slotMacro renders').toContain('G1 X10 Y20 Z#2 F500');
  expect(r.A.macro).toContain('#1=#2600');

  // BAKED (Case B): 0 fields, the body is all literals (no #var, no mirror read)
  expect(r.B.nfields, 'all-baked → 0 fields').toBe(0);
  expect(r.B.body, 'baked feed → F250 literal').toContain('F250');
  expect(r.B.body, 'baked Z → Z-3 literal').toContain('Z-3');
  expect(r.B.body, 'all-baked body has NO #var / no #2600 mirror').not.toMatch(/#/);
});
