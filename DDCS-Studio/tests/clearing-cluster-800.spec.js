import { test, expect } from '@playwright/test';

/**
 * t800 BATCH 4 — the FORM-HONESTY campaign closer.
 *
 * P6 THE CLEARING CLUSTER: strategy → direction → stepover land TOGETHER, right after shape/size, before feeds. `direction`
 * is surfaced in the form for the first time — a real atom field (the builder used to hardcode 'bothways'). It is labelled +
 * gated per what the emitting walk actually does: bothways = boustrophedon zig-zag; oneway = climb (lift + rapid back each
 * pass); otherway = conventional. Only the raster path reads it — concentric rings IGNORE it — so the field is gated
 * `when strategy is raster` (honest: no inert control on the spiral default).
 *
 * t1418 — WHICH ATOM CARRIES IT MOVED, AND THE SPEC FOLLOWED. In t800 the answer was always `pocketfill` (stepover.js's
 * `fillStrategy`, unrolled in JS). t1406 re-pointed the both-ways rect arm at the parametric `surfaceraster`, and t1418
 * taught that atom all three directions — so a rect/raster/oneway pocket now carries the word on the ATOM and builds no
 * `pocketfill` at all. P6.3 below reads whichever atom emits, on both arms; P6.2's criteria were already about the EMIT and
 * needed no change, only truthful comments.
 *
 * P7 SHADOW FORMS: the built-in wizard forms and the twin form are sibling .wiz-body panels; exactly one is shown, the rest
 * display:none + (now) inert. The guard asserts no hidden-but-interactable control ghosts behind an open twin.
 *
 * TAP P1-residue: tap still spilled its stock block onto the form (bore/contour/drill got formHidden in P1) — now formHidden
 * (the P1 assert extends: user_tap_data joined the stock-spill-792 twin sweep).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('P6.1 the pocket form reads shape → size → CLEARING(strategy/direction/stepover) → feeds', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_pocket_data'));
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="strategy"]'), null, { timeout: 8000 });
  const order = await page.evaluate(() => [...document.getElementById('wiz_user_form').querySelectorAll('[data-param]')].map((e) => e.dataset.param));
  const idx = (p) => order.indexOf(p);
  for (const p of ['shape', 'w', 'strategy', 'direction', 'stepoverPct', 'feed']) expect(idx(p), `${p} present in the form`).toBeGreaterThan(-1);
  expect(idx('shape'), 'shape before size').toBeLessThan(idx('w'));
  expect(idx('w'), 'size before the clearing cluster').toBeLessThan(idx('strategy'));
  expect(idx('strategy'), 'strategy LEADS the clearing cluster').toBeLessThan(idx('direction'));
  expect(idx('direction'), 'direction then stepover').toBeLessThan(idx('stepoverPct'));
  expect(idx('stepoverPct'), 'clearing before feeds').toBeLessThan(idx('feed'));
});

/**
 * P6.2 — t1418 SWEPT THIS FOR THE SAME PIN AND FOUND ONLY WORDS, NOT ASSERTS. Every expectation below still passes and
 * still means what it meant; what moved is WHO honours the word. On the rect/raster arm it is no longer
 * `stepover.js fillStrategy` unrolling passes in JS — it is the `surfaceraster` macro's own row walk, and
 * `spiralIgnores` is no longer "the kernel dispatches to concentricRect first" but the atom's declared axis set
 * (SURFACE_RASTER_AXES gives concentric no direction axis, for the same underlying reason on both sides). The
 * comments are corrected rather than left to mislead the next reader; the criteria are untouched, deliberately —
 * a passing assert is not an excuse to rewrite it, and these ones were already about the EMIT rather than the path.
 */
test('P6.2 direction is HONORED end-to-end (raster oneway ≠ bothways) + byte-identical to pocketStack + concentric ignores it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const build = builderOf('user_pocket_data');
    const em = (p) => emitMapped(build(p)).text;
    // t945 — the data-op inherits the machine Head at build (spindleHeadPatch); seed the same live Head so the reference
    // pocketStack (via makeStart) spins up identically → the M3 header is byte-matched (params.spindle is inert for the twin).
    const base = { shape: 'rect', w: 80, h: 60, spindle: (window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {} };
    const rasterZig = em({ ...base, strategy: 'raster', direction: 'bothways' });
    const rasterOne = em({ ...base, strategy: 'raster', direction: 'oneway' });
    const rasterOther = em({ ...base, strategy: 'raster', direction: 'otherway' });
    const spiralZig = em({ ...base, strategy: 'spiral', direction: 'bothways' });
    const spiralOne = em({ ...base, strategy: 'spiral', direction: 'oneway' });
    // byte-identity for the NEW param: the twin must agree with the independent built-in pocketStack when direction is set
    const twinOne = em({ ...base, strategy: 'raster', direction: 'oneway' });
    const biOne = emitMapped(pocketStack({ ...base, strategy: 'raster', direction: 'oneway' })).text;
    return {
      rasterHonored: rasterOne !== rasterZig,        // t1418: the surfaceraster row walk DOES read direction (was: the JS scanline path)
      otherwayDistinct: rasterOther !== rasterOne && rasterOther !== rasterZig,
      spiralIgnores: spiralOne === spiralZig,        // concentric rect ignores it on BOTH sides → the gate hiding it on spiral is honest
      byteIdentical: twinOne === biOne,              // twin(oneway) == pocketStack(oneway)
      oneHasLift: (rasterOne.match(/G0 Z/g) || []).length > (rasterZig.match(/G0 Z/g) || []).length,   // oneway lifts+returns between passes (now ONE retract line inside the macro's row loop, not one per unrolled pass)
    };
  });
  expect(r.rasterHonored, 'raster + oneway emits DIFFERENT G-code than bothways (direction reaches the walk that emits)').toBe(true);
  expect(r.otherwayDistinct, 'otherway (conventional) is distinct from oneway and bothways').toBe(true);
  expect(r.oneHasLift, 'one-way lifts + rapids back between passes (more G0 Z retracts than zig-zag)').toBe(true);
  expect(r.spiralIgnores, 'spiral (concentric) rect IGNORES direction — true of the rings on BOTH sides, which is why the atom declares concentric no direction axis at all').toBe(true);
  expect(r.byteIdentical, 'the twin honoring direction stays byte-identical to the built-in pocketStack').toBe(true);
});

/**
 * P6.3 — direction survives params → stack → Blocks, ON WHATEVER ATOM ACTUALLY EMITS.
 *
 * ── t1418 RESTATED THIS, AND THE RESTATEMENT IS THE POINT ─────────────────────────────────────────────────────────
 * It used to read the `pocketfill` leaf by name, which was the right reading for exactly as long as every rect pocket
 * cleared through that leaf. t1406 re-pointed the both-ways rect arm at `surfaceraster`, and t1418 taught that atom
 * all three directions — so the config this test builds (rect · raster · oneway) has NO `pocketfill` in it at all,
 * and the old assert read `undefined`. That is the act's own success surfacing as a red, which is what it is for.
 *
 * The PROPERTY was never about a block name: it is that a direction the operator picks survives the round-trip and
 * that the Blocks surface offers the three honest values rather than free text (a one-letter typo silently
 * mis-emitting is the hazard the enum registration closed). So it is asserted against the arm that EMITS — the atom
 * on the parametric arm, the literal leaf on an arm that still builds one — and BOTH are checked, so the day the
 * boundary moves again this test says which arm moved rather than reading `undefined`.
 */
test('P6.3 direction round-trips through params + the block stack (on whichever atom emits)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { flattenBlocks } = await import('/blocks/userOps.js');
    const { fieldKind, fieldOptions } = await import('/blocks/blockly/bridge.js');
    const build = builderOf('user_pocket_data');
    const dirOn = (over, type) => {
      const b = flattenBlocks(build({ shape: 'rect', w: 80, h: 60, strategy: 'raster', direction: 'oneway', ...over }))
        .find((x) => x && x.type === type);
      return b && b.params ? b.params.direction : undefined;
    };
    const types = (over) => flattenBlocks(build({ shape: 'rect', w: 80, h: 60, strategy: 'raster', direction: 'oneway', ...over })).map((b) => b.type);
    return {
      // THE PARAMETRIC ARM — t1418: the atom walks the direction, so the atom is where it must land.
      atomDir: dirOn({}, 'surfaceraster'),
      atomArmHasNoFill: !types({}).includes('pocketfill'),
      // A LITERAL ARM — a circle still clears through the JS contour walk, and its leaf still carries the word.
      fillDir: dirOn({ shape: 'circle', dia: 50 }, 'pocketfill'),
      // THE BLOCKS SURFACE — a populated dropdown on BOTH, so the round-trip is valid-by-construction either way.
      atomKind: fieldKind({ type: 'surfaceraster' }, 'direction'), atomOpts: fieldOptions({ type: 'surfaceraster' }, 'direction'),
      kind: fieldKind({ type: 'pocketfill' }, 'direction'), opts: fieldOptions({ type: 'pocketfill' }, 'direction'),
    };
  });
  expect(r.atomDir, 'the surfaceraster atom in the built stack carries direction=oneway (params + Blocks round-trip)').toBe('oneway');
  expect(r.atomArmHasNoFill, 'and that arm really has no pocketfill leaf — which is why reading one by name went undefined').toBe(true);
  expect(r.fillDir, 'an arm that STILL builds the literal leaf carries it there, unchanged').toBe('oneway');
  expect(r.atomKind, 'the Blockly bridge renders the ATOM\'s direction as a dropdown field').toBe('dropdown');
  expect(r.kind, 'and the literal leaf\'s too').toBe('dropdown');
  expect(r.atomOpts, 'the atom\'s direction dropdown offers the three honest values').toEqual(['bothways', 'oneway', 'otherway']);
  expect(r.opts, 'and so does the literal leaf\'s — one registration, both surfaces').toEqual(['bothways', 'oneway', 'otherway']);
});

test('P7 SHADOW FORMS: with a twin open, no hidden .wiz-body has an interactable control (and the twin form is not inert)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_middle_data'));
  await page.waitForFunction(() => { const u = document.getElementById('wiz_user'); return u && getComputedStyle(u).display !== 'none'; }, null, { timeout: 8000 });
  const r = await page.evaluate(() => {
    const shown = [], live = [];
    document.querySelectorAll('.wiz-body').forEach((p) => {
      const visible = getComputedStyle(p).display !== 'none';
      if (visible) { shown.push(p.id); return; }
      // hidden panel: every control must be non-interactable (offsetParent null under display:none, and the panel is inert)
      const anyLive = [...p.querySelectorAll('input,select,button,textarea')].some((c) => c.offsetParent !== null && !c.disabled && !p.inert);
      if (anyLive) live.push(p.id);
    });
    const u = document.getElementById('wiz_user');
    return { shown, live, frontInert: !!(u && u.inert) };
  });
  expect(r.shown, 'exactly one wizard panel is shown (the twin)').toEqual(['wiz_user']);
  expect(r.live, 'no hidden built-in form ghosts an interactable control behind the twin').toEqual([]);
  expect(r.frontInert, 'the fronting twin form is NOT inert').toBe(false);
});
// TAP P1-residue: the tap stock-spill assert lives in the canonical P1 guard (stock-spill-792.spec.js), which now sweeps user_tap_data.
