import { test, expect } from '@playwright/test';

/**
 * t913 B2b-1 — THE CLEARANCE-MODE EMIT FOUNDATION (Hop + Plane; no form; default max byte-identical).
 *
 * Asserts the RESULT per post (assert-the-value): with the trans-axis traverse's clearance MODE set explicitly,
 *   HOP  — Expert emits the CAPPED lift: #43=[#95+hop], read the #520 margin, keep #43 if below the margin else clamp
 *          to it (min(saved+hop, margin) via IF/GOTO — no native min); the return is the honest G53 Z#95.
 *          No-real-flow posts (grbl 'none' / rs274 O-word / centroid) DEGRADE to a plain relative hop + the honest note.
 *   PLANE — UNIVERSAL: a work-frame absolute lift (G90 / G0 Z<planeZ> / G91) + the honest G53 Z#95 return, on every post.
 *   LABELS — several hops in one program get DISTINCT guard/cap labels (the uniquifier), so no N<label> collides.
 *   MAX (default) — byte-identical (covered by the untouched goldens cluster; Hop/Plane appear ONLY when the mode is set).
 */

const MIDDLE_AUTO = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto' };
const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc', 'centroid'];
const DEGRADE = ['grbl', 'rs274ngc', 'centroid'];   // no real flow-skip → plain relative hop + honest note

// the trans-axis traverse SLICE (Diag primary .. the REPOSITION marker) — comments are post-agnostic
function transSlice(txt) {
  const L = String(txt).split('\n');
  const a = L.findIndex((l) => l.includes('Diag primary'));
  const b = L.findIndex((l) => l.includes('auto-traverse to the perpendicular'));
  return (a >= 0 && b >= 0) ? L.slice(a, b + 1).join('\n') : null;
}

test('B2b-1 hop/plane emit per post: Expert capped, degrade posts relative+note, plane universal, labels unique', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async ({ MIDDLE_AUTO, POSTS }) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { safeTraverseStack } = await import('/wizards/ops/probeSurface.js');
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const emitAll = (params) => {
      const out = {};
      for (const id of POSTS) { try { out[id] = emitMapped(middleStack(params), { dialect: getDialect(id) }).text; } catch (e) { out[id] = 'THREW: ' + e; } }
      return out;
    };
    // label-uniquifier probe: a synthetic stack with TWO hop traverses → the guard/cap labels must all differ.
    const twoHops = [
      newBlock('safetraverse'), newBlock('safetraverse'),
    ];
    twoHops[0].params = { to: 'a', shape: 'diagonal' };
    twoHops[1].params = { to: 'b', shape: 'diagonal' };
    twoHops[0].children = safeTraverseStack({ mode: 'center', axis: 'X', second: 'Y', dir1Plus: true, dir2Plus: false, diagPrimary: '#53', diagTravel: '#21', wall2Var: '#52', radiusVar: '#6', lift: true, clearMode: 'hop', hopDist: 15, drop: true, returnZ: '#95', comment: 'REPOSITION: hop A' });
    twoHops[1].children = safeTraverseStack({ mode: 'center', axis: 'X', second: 'Y', dir1Plus: true, dir2Plus: false, diagPrimary: '#53', diagTravel: '#21', wall2Var: '#52', radiusVar: '#6', lift: true, clearMode: 'hop', hopDist: 20, drop: true, returnZ: '#95', comment: 'REPOSITION: hop B' });
    const twoHopExpert = emitMapped(twoHops, { dialect: getDialect('ddcs-expert-m350') }).text;

    return {
      hop: emitAll({ ...MIDDLE_AUTO, clearMode: 'hop', hopDist: 15 }),
      plane: emitAll({ ...MIDDLE_AUTO, clearMode: 'plane', planeZ: 12, probeZ: true, wcs: 'active' }),   // t961 — Plane needs the guarantee (Active WCS + Z-first) or the safety backstop folds it to Hop
      twoHopExpert,
    };
  }, { MIDDLE_AUTO, POSTS });

  expect(errs, 'no pageerrors').toEqual([]);

  // ── HOP — Expert CAPPED (the min(saved+hop, margin) algebra via IF/GOTO) ────────────────────────────────────
  const he = transSlice(r.hop['ddcs-expert-m350']);
  expect(he, 'Expert hop slice present').toBeTruthy();
  expect(he, 'saves the probe Z first').toMatch(/#95=#882 \( @saveProbeZ \)/);
  expect(he, 'proposed hop target = saved + hopDist').toMatch(/#43=\[#95\+15\]/);
  expect(he, 'reads the #520 margin (read-only)').toMatch(/#42=#520/);
  expect(he, 'guard: keep the controller margin if set').toMatch(/IF #42<0 GOTO\d+/);
  expect(he, 'cap: keep the hop when it is BELOW the margin').toMatch(/IF #43<#42 GOTO\d+/);
  expect(he, 'else CLAMP the hop to the margin').toMatch(/#43=#42 \( cap the hop at the safe machine margin \)/);
  expect(he, 'lifts to the capped target via G53').toMatch(/G53 Z#43/);
  expect(he, 'returns to the saved probe Z (honest)').toMatch(/G53 Z#95 \( @returnProbeZ \)/);
  // order: proposed → read margin → guard → cap-compare → clamp → G53 (the min structure)
  const iProp = he.indexOf('#43=[#95+15]'), iCap = he.indexOf('IF #43<#42'), iClamp = he.indexOf('#43=#42 '), iLift = he.indexOf('G53 Z#43');
  expect(iProp, 'proposed before the cap compare').toBeLessThan(iCap);
  expect(iCap, 'cap compare before the clamp').toBeLessThan(iClamp);
  expect(iClamp, 'clamp before the G53 lift').toBeLessThan(iLift);

  // ── HOP — V4.1 (the user's LIVE bench) is CAPPED too, via its BAKED #190 margin idiom (NOT Expert's #520 read) ──
  // V4.1 has every cap primitive confirmed live (ifGoto, G0 G53, label). An uncapped hop here = the Z-limit crash class.
  const hv = transSlice(r.hop['ddcs-v41']);
  expect(hv, 'V4.1 hop: bakes the margin into #190 (V4.1 idiom — no #520 register)').toMatch(/#190=-5 \( safe-Z margin - machine frame \)/);
  expect(hv, 'V4.1 hop: proposed target in #191 (V4.1-native free var)').toMatch(/#191=\[#95\+15\]/);
  expect(hv, 'V4.1 hop: cap keeps the hop when BELOW the margin (no space before GOTO)').toMatch(/IF #191<#190GOTO\d+/);
  expect(hv, 'V4.1 hop: clamps to the margin').toMatch(/#191=#190 \( cap the hop at the safe machine margin \)/);
  expect(hv, 'V4.1 hop: lifts to the capped target via G0 G53').toMatch(/G0 G53 Z#191/);
  expect(hv, 'V4.1 hop: does NOT use Expert #42/#43 (firmware-unsafe on V4.1)').not.toMatch(/#4[23]=/);
  const j1 = hv.indexOf('#191=[#95+15]'), j2 = hv.indexOf('IF #191<#190'), j3 = hv.indexOf('#191=#190 '), j4 = hv.indexOf('G0 G53 Z#191');
  expect(j1, 'V4.1: proposed before cap').toBeLessThan(j2);
  expect(j2, 'V4.1: cap before clamp').toBeLessThan(j3);
  expect(j3, 'V4.1: clamp before lift').toBeLessThan(j4);

  // ── HOP — degrade posts: plain relative hop + the honest uncapped note, no cap regs ─────────────────────────
  for (const id of DEGRADE) {
    const s = transSlice(r.hop[id]);
    expect(r.hop[id], `hop does not throw on ${id}`).not.toMatch(/^THREW:/);
    expect(s, `${id}: honest uncapped note`).toMatch(/\( Clearance hop 15mm - uncapped on this controller \)/);
    expect(s, `${id}: plain relative hop`).toMatch(/G0 Z15/);
    expect(s, `${id}: NO #43 cap scratch (no flow to cap)`).not.toMatch(/#43=/);
  }

  // ── PLANE — the absolute work-Z LIFT is universal (a literal G0 Z, no register) on EVERY post ───────────────
  for (const id of POSTS) {
    const s = transSlice(r.plane[id]);
    expect(r.plane[id], `plane does not throw on ${id}`).not.toMatch(/^THREW:/);
    expect(s, `${id}: work-frame absolute plane lift G0 Z12`).toMatch(/G0 Z12/);
    // the plane is G90-absolute then G91-restored (mode-explicit) — universal
    expect(s, `${id}: G90 wraps the absolute plane move`).toMatch(/G90[\s\S]*G0 Z12[\s\S]*G91/);
  }
  // the honest SAVE/RETURN pairing rides the EXISTING per-post returnZ machinery (B2a-verified) — it needs a machine-Z read,
  // present on Expert (#882). Posts whose readMachine is [] (grbl vars:false, centroid TO-CONFIRM) omit the save, the same
  // pre-existing degrade as max. B2b-1's NEW emit is the universal plane LIFT above; assert the pairing on Expert (reference).
  const pe = transSlice(r.plane['ddcs-expert-m350']);
  expect(pe, 'Expert plane: saves the probe Z before the lift').toMatch(/#95=#882 \( @saveProbeZ \)/);
  expect(pe, 'Expert plane: honest G53 return to the saved Z').toMatch(/G53 Z#95 \( @returnProbeZ \)/);

  // ── LABELS — two hops in one program → distinct guard/cap labels (no N<label> collision) ────────────────────
  const nLabels = (r.twoHopExpert.match(/^N\d+$/gm) || []);
  const uniq = new Set(nLabels);
  expect(nLabels.length, 'two hops emit 4 N-labels (2 guard + 2 cap)').toBeGreaterThanOrEqual(4);
  expect(uniq.size, 'every N-label is DISTINCT (the uniquifier)').toBe(nLabels.length);
});

test('B2b-1 round-trip: the clearance mode param survives .nc export → reimport (byte-identical emit)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const PM = await import('/blocks/programModel.js');
    const OB = await import('/blocks/opBuilders.js');
    const EM = await import('/blocks/blockEmitter.js');
    const P = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto', clearMode: 'hop', hopDist: 15 };
    const op = OB.makeOp('middle', P, OB._builderAtoms('middle', P));
    window.ddcsLoadBlockStack([op]);
    const nc = PM.serializeWithMarkers();                 // .nc export (with the middle op marker)
    const back = PM.importMarkedNc(nc);                   // reimport → builderOf('middle')(params) regenerates
    const findOp = (bs) => { for (const b of (bs || [])) { if (b && b.type === 'op') return b; } return null; };
    const backOp = findOp(back);
    return {
      markerHasHop: /"clearMode":"hop"/.test(nc),
      backClearMode: backOp && backOp.params && backOp.params.clearMode,
      emitByteIdentical: EM.emitMapped([op]).text === EM.emitMapped(back).text,
      emitHasCap: /#43=\[#95\+15\]/.test(EM.emitMapped(back).text),
    };
  });
  expect(r.markerHasHop, 'the .nc marker carries clearMode:hop').toBe(true);
  expect(r.backClearMode, 'reimport restores clearMode=hop').toBe('hop');
  expect(r.emitByteIdentical, 'the reimported op re-emits byte-identical (hop mode round-trips)').toBe(true);
  expect(r.emitHasCap, 'the reimported hop still emits the capped lift (#43=[#95+15])').toBe(true);
});
