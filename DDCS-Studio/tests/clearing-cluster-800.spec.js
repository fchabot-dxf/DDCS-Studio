import { test, expect } from '@playwright/test';

/**
 * t800 BATCH 4 — the FORM-HONESTY campaign closer.
 *
 * P6 THE CLEARING CLUSTER: strategy → direction → stepover land TOGETHER, right after shape/size, before feeds. `direction`
 * is surfaced in the form for the first time — a real pocketfill atom field (the builder used to hardcode 'bothways'). It is
 * labelled + gated per what the KERNEL (stepover.js fillStrategy) actually does: bothways = boustrophedon zig-zag; oneway =
 * climb (lift + rapid back each pass); otherway = conventional. Only the raster/scanline path reads it — concentric rings on
 * a circle/rect IGNORE it — so the field is gated `when strategy is raster` (honest: no inert control on the spiral default).
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

test('P6.2 direction is HONORED end-to-end (raster oneway ≠ bothways) + byte-identical to pocketStack + concentric ignores it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const build = builderOf('user_pocket_data');
    const em = (p) => emitMapped(build(p)).text;
    const base = { shape: 'rect', w: 80, h: 60 };
    const rasterZig = em({ ...base, strategy: 'raster', direction: 'bothways' });
    const rasterOne = em({ ...base, strategy: 'raster', direction: 'oneway' });
    const rasterOther = em({ ...base, strategy: 'raster', direction: 'otherway' });
    const spiralZig = em({ ...base, strategy: 'spiral', direction: 'bothways' });
    const spiralOne = em({ ...base, strategy: 'spiral', direction: 'oneway' });
    // byte-identity for the NEW param: the twin must agree with the independent built-in pocketStack when direction is set
    const twinOne = em({ ...base, strategy: 'raster', direction: 'oneway' });
    const biOne = emitMapped(pocketStack({ ...base, strategy: 'raster', direction: 'oneway' })).text;
    return {
      rasterHonored: rasterOne !== rasterZig,        // the kernel scanline path DOES read direction
      otherwayDistinct: rasterOther !== rasterOne && rasterOther !== rasterZig,
      spiralIgnores: spiralOne === spiralZig,        // concentric rect ignores it → the gate hiding it on spiral is honest
      byteIdentical: twinOne === biOne,              // twin(oneway) == pocketStack(oneway)
      oneHasLift: (rasterOne.match(/G0 Z/g) || []).length > (rasterZig.match(/G0 Z/g) || []).length,   // oneway lifts+returns between passes
    };
  });
  expect(r.rasterHonored, 'raster + oneway emits DIFFERENT G-code than bothways (direction reaches the kernel)').toBe(true);
  expect(r.otherwayDistinct, 'otherway (conventional) is distinct from oneway and bothways').toBe(true);
  expect(r.oneHasLift, 'one-way lifts + rapids back between passes (more G0 Z retracts than zig-zag)').toBe(true);
  expect(r.spiralIgnores, 'spiral (concentric) rect IGNORES direction — the kernel truth the honest gate reflects').toBe(true);
  expect(r.byteIdentical, 'the twin honoring direction stays byte-identical to the built-in pocketStack').toBe(true);
});

test('P6.3 direction round-trips through params + the block stack (the pocketfill atom carries it)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { flattenBlocks } = await import('/blocks/userOps.js');
    const build = builderOf('user_pocket_data');
    const stack = build({ shape: 'rect', w: 80, h: 60, strategy: 'raster', direction: 'oneway' });
    const fill = flattenBlocks(stack).find((b) => b && b.type === 'pocketfill');
    const { fieldKind, fieldOptions } = await import('/blocks/blockly/bridge.js');
    // the Blockly bridge renders pocketfill.direction as a populated dropdown (valid-by-construction round-trip)
    const opts = fieldOptions({ type: 'pocketfill' }, 'direction');
    return { fillDir: fill && fill.params && fill.params.direction, kind: fieldKind({ type: 'pocketfill' }, 'direction'), opts };
  });
  expect(r.fillDir, 'the pocketfill atom in the built stack carries direction=oneway (params + Blocks round-trip)').toBe('oneway');
  expect(r.kind, 'the Blockly bridge renders direction as a dropdown field').toBe('dropdown');
  expect(r.opts, 'the direction dropdown offers the three honest kernel values').toEqual(['bothways', 'oneway', 'otherway']);
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
