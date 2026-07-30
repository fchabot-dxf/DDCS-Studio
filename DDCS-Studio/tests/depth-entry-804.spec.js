import { test, expect } from '@playwright/test';

/**
 * t804 — DEPTH ENTRY OPTIONS. A per-level descent choice on the pocket clearing: PLUNGE (default, byte-identical), RAMP
 * (a linear descent at ≤ rampAngle° toward the pocket centre; greys → plunge with a why when the pocket is too small),
 * HELIX (a descending helix from the existing helix atom; radius clamped to fit, pitch = mm/rev). One shared levelEntry
 * over the 5 clearing kernels; plunge stays the untouched inline path.
 */
const XYZ = (ln) => { const m = /X(-?[\d.]+)\s+Y(-?[\d.]+)(?:\s+Z(-?[\d.]+))?/.exec(ln); return m ? { x: +m[1], y: +m[2], z: m[3] != null ? +m[3] : null } : null; };
const Z = (ln) => { const m = /(?:^|\s)Z(-?[\d.]+)/.exec(ln); return m ? +m[1] : null; };

test('PLUNGE (default) is byte-identical — no entry moves (the goldens guard the full sweep)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const p = { shape: 'rect', w: 120, h: 100, depth: 6, stepdown: 2, toolDia: 6, strategy: 'raster' };
    const noEntry = emitMapped(pocketStack(p)).text;
    const plunge = emitMapped(pocketStack({ ...p, entry: 'plunge' })).text;
    return { same: noEntry === plunge, clean: !/\( ramp|\( helix/.test(plunge) };
  });
  expect(r.same, 'entry:plunge emits byte-identically to no entry field').toBe(true);
  expect(r.clean, 'plunge emits no ramp/helix moves').toBe(true);
});

/**
 * t1406 — READ FROM THE MOTION, NOT FROM THE TEXT. This counted lines carrying the `( ramp )` comment, three of them,
 * one per level. A rect pocket's clearing is a MACRO now: it emits ONE ramp line inside a loop the machine runs three
 * times, so the text count is 1 and the property — every level descends at ≤ the declared angle and reaches its cut Z —
 * is exactly as true as it ever was. Counting emitted lines was always a proxy for counting descents; the tracer counts
 * the descents themselves and gives the same answer on both arms.
 */
test('RAMP: every level descends at ≤ the declared angle and reaches the cut Z', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const angle = 5;
  const ramps = await page.evaluate(async (angle) => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const p = { shape: 'rect', w: 120, h: 100, depth: 6, stepdown: 2, toolDia: 6, strategy: 'raster', entry: 'ramp', rampAngle: angle, feed: 600, plunge: 150 };
    const nc = emitMapped(pocketStack(p)).text;
    // A RAMP is the only move that descends WHILE travelling in XY. A plunge has no XY extent; a cut at depth has no
    // Z extent. So this needs no comment to find it — which is the point.
    return (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
      .filter((s) => s.z1 - s.z2 > 1e-6 && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 1e-6)
      .map((s) => ({ dist: +Math.hypot(s.x2 - s.x1, s.y2 - s.y1).toFixed(4), drop: +(s.z1 - s.z2).toFixed(4), z: +s.z2.toFixed(3) }));
  }, angle);
  expect(ramps.length, 'a ramp per depth level (6/2 = 3)').toBe(3);
  const tanMax = Math.tan((angle + 0.01) * Math.PI / 180);
  for (const rmp of ramps) {
    expect(rmp.drop, 'the ramp descends into the level').toBeGreaterThan(0);
    expect(rmp.drop / rmp.dist, `ramp slope ${(rmp.drop / rmp.dist).toFixed(4)} ≤ tan(${angle}°)`).toBeLessThanOrEqual(tanMax);
  }
  // the ramps reach the three cut levels −2, −4, −6
  expect(ramps.map((r) => r.z).sort((a, b) => b - a)).toEqual([-2, -4, -6]);
});

test('HELIX: fits the pocket (radius+tool ≤ inradius) and descends at the declared pitch per rev', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const pitch = 1.5;
  const r = await page.evaluate(async (pitch) => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { pocketInsetRegion } = await import('/wizards/ops/pocketfill.js');
    const { regionInradius } = await import('/wizards/ops/contour.js');
    const p = { shape: 'circle', dia: 100, depth: 6, stepdown: 2, toolDia: 6, strategy: 'spiral', entry: 'helix', helixDia: 0, helixPitch: pitch, feed: 600, plunge: 150 };
    const lines = emitMapped(pocketStack(p)).text.split('\n');
    const inradius = regionInradius(pocketInsetRegion(p));
    return { lines, inradius, toolR: 3 };
  }, pitch);
  // gather the first helix block's descending G1 points (between a 'G0 Z' and the '( helix )' line)
  const li = r.lines.findIndex((l) => l.includes('( helix )'));
  expect(li, 'a helix block is emitted').toBeGreaterThan(0);
  const pts = [];
  for (let i = li - 1; i >= 0; i--) { const p = XYZ(r.lines[i]); if (r.lines[i].startsWith('G1') && p && p.z != null) pts.unshift({ ...p }); else if (r.lines[i].startsWith('G0 Z')) break; }
  expect(pts.length, 'the helix has many descending points').toBeGreaterThan(12);
  // the helix radius = max XY distance from the helix CENTROID (placement-invariant — the pocket is PlaceOnStock-shifted)
  const gx = pts.reduce((s, p) => s + p.x, 0) / pts.length, gy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const R = Math.max(...pts.map((p) => Math.hypot(p.x - gx, p.y - gy)));
  expect(R + r.toolR, `helix radius ${R.toFixed(2)} + tool ≤ pocket inradius ${r.inradius.toFixed(2)} (fits)`).toBeLessThanOrEqual(r.inradius + 0.05);
  // descent rate: over one revolution (24 seg) Z drops ~ pitch
  const perRev = pts[24] ? (pts[0].z - pts[24].z) : null;
  expect(perRev, `Z descends ≈ pitch (${pitch}) per revolution`).toBeGreaterThan(pitch - 0.3);
  expect(perRev).toBeLessThan(pitch + 0.3);
});

test('TWIN + FORM: user_pocket_data controls entry through the clearing-cluster binding (params + Blocks round-trip)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  const r = await page.evaluate(async () => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { flattenBlocks } = await import('/blocks/userOps.js');
    const { fieldOptions } = await import('/blocks/blockly/bridge.js');
    const build = builderOf('user_pocket_data');
    const base = { shape: 'rect', w: 120, h: 100, depth: 6, stepdown: 2, toolDia: 6, strategy: 'raster' };
    const plunge = emitMapped(build({ ...base })).text;
    const ramp = emitMapped(build({ ...base, entry: 'ramp', rampAngle: 5 })).text;
    const helix = emitMapped(build({ shape: 'circle', dia: 100, depth: 6, stepdown: 2, toolDia: 6, strategy: 'spiral', entry: 'helix', helixPitch: 1.5 })).text;
    // t1406 — WHICHEVER LEAF THE ARM BUILT. A rect pocket's clearing rides `surfaceraster` now; a circle's still rides
    // the literal `pocketfill`. The claim was never about a block TYPE — it is that the form's binding reaches the
    // clearing leaf's `entry` socket — so it is asked of the leaf that is actually there.
    const flat = flattenBlocks(build({ ...base, entry: 'ramp' }));
    const fill = flat.find((b) => b && (b.type === 'surfaceraster' || b.type === 'pocketfill'));
    return { plungeClean: !/\( ramp|\( helix/.test(plunge), rampHas: ramp.includes('( ramp )'), helixHas: helix.includes('( helix )'), fillType: fill && fill.type, fillEntry: fill && fill.params && fill.params.entry, opts: fieldOptions({ type: 'pocketfill' }, 'entry') };
  });
  expect(r.plungeClean, 'twin plunge (default): no entry moves — byte path unchanged').toBe(true);
  expect(r.rampHas, 'twin ramp: the form binding writes the clearing leaf\'s entry → ramp emits').toBe(true);
  expect(r.helixHas, 'twin helix: helix emits').toBe(true);
  expect(r.fillType, 'a rect pocket clears through the parametric atom (t1406)').toBe('surfaceraster');
  expect(r.fillEntry, 'and that leaf carries entry=ramp (params + Blocks round-trip)').toBe('ramp');
  expect(r.opts, 'the Blockly bridge renders entry as a 3-value dropdown').toEqual(['plunge', 'ramp', 'helix']);
});

test('GREYED RAMP: a pocket too small for the ramp degrades to PLUNGE with the why', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const p = { shape: 'circle', dia: 20, depth: 6, stepdown: 2, toolDia: 6, strategy: 'spiral', entry: 'ramp', rampAngle: 1, feed: 600, plunge: 150 };
    const txt = emitMapped(pocketStack(p)).text;
    const why = /\( ramp 1deg needs [\d.]+mm, first move [\d.]+mm -> plunge \)/.test(txt);
    // the why comment is immediately followed by a straight plunge (the honest degrade)
    const lines = txt.split('\n'); let degrades = 0;
    for (let i = 0; i < lines.length; i++) if (/-> plunge \)/.test(lines[i]) && /G1 Z-?[\d.]+ F/.test(lines[i + 2] || lines[i + 1] || '')) degrades++;
    return { why, degrades, noRamp: !txt.includes('( ramp )') };
  });
  expect(r.why, 'the greyed-ramp emits its WHY (angle, needed mm, first-move mm)').toBe(true);
  expect(r.noRamp, 'no ramp move survives — it fully degraded to plunge').toBe(true);
  expect(r.degrades, 'each level degrades to a straight plunge').toBeGreaterThan(0);
});
