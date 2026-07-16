import { test, expect } from '@playwright/test';

/**
 * t909 B2 — THE CLEARANCE-MODE UNIFICATION (B2a: mechanism + unification, Max default).
 *
 * The user: "not the same in both" + "i thought we added a safe-z height mechanism". Three traverse mechanisms had
 * DIVERGED — corner's wall1->wall2 lifts to the #520 MACHINE MARGIN, middle's trans-axis hopped +#18 RELATIVE, the park
 * used safeZframe — and byte-identity FROZE the divergence. B2a declares ONE clearance MODE (safeZframe.clearTraverseParams,
 * `max` default) and points middle's trans-axis traverse at it, so it clears to the SAME #520 margin as corner, with the
 * honest t897 save/return pairing (never lift-to-margin + a relative drop = an arbitrary Z).
 *
 * This asserts the RESULT vs an independent truth (assert-the-value, not golden==golden):
 *   (1) UNIFICATION — middle's trans-axis traverse now saves the probe Z, lifts to the #520 margin, and returns to it;
 *       the old relative +#18/-#18 hop is GONE from that traverse.
 *   (2) INVARIANT — corner's wall-traverse and middle's trans-traverse run the SAME clearance choreography for Max
 *       (SAVE -> MARGIN-READ -> MARGIN-LIFT -> RETURN) — the "same in both" the user wants.
 *   (3) PAIRING — the trans-traverse's @saveProbeZ pairs 1:1 with @returnProbeZ (net-zero by construction).
 *   (4) PER POST — the margin lift FOLDS per post (Expert #520/#42 read-only guard; V4.1/DM500/grbl/rs274 differ, none THREW).
 *   The STANDING SPLIT holds: the mode governs the PLANNED traverse; the miss-path error handler stays the machine margin.
 */

const MIDDLE_AUTO = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto' };
const POSTS = ['ddcs-expert-m350', 'ddcs-v41', 'ddcs-v3-dm500', 'grbl', 'rs274ngc'];

// The ordered clearance choreography of a traverse block (label numbers normalised so N91/N92 don't matter).
function clearanceOps(txt) {
  const ops = [];
  for (const ln of String(txt).split('\n')) {
    if (ln.includes('@saveProbeZ')) ops.push('SAVE');
    else if (/#42=#520\b/.test(ln)) ops.push('MARGIN-READ');
    else if (/G53 Z#42\b/.test(ln)) ops.push('MARGIN-LIFT');
    else if (ln.includes('@returnProbeZ')) ops.push('RETURN');
  }
  return ops;
}

test('B2a clearance unification: middle trans-axis == corner wall-traverse (Max margin), pairing net-zero, folds per post', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async ({ MIDDLE_AUTO, POSTS }) => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    // Expert (default) full emits
    const middle = emitMapped(middleStack(MIDDLE_AUTO)).text;
    const corner = emitMapped(cornerStack({})).text;
    // per-post middle trans-traverse SLICE (Diag-primary .. the REPOSITION marker) — comments are post-agnostic
    const perPost = {};
    for (const id of POSTS) {
      try {
        const txt = emitMapped(middleStack(MIDDLE_AUTO), { dialect: getDialect(id) }).text;
        const L = txt.split('\n');
        const a = L.findIndex((l) => l.includes('Diag primary'));
        const b = L.findIndex((l) => l.includes('auto-traverse to the perpendicular'));
        perPost[id] = (a >= 0 && b >= 0) ? L.slice(a, b + 1).join('\n') : ('NO-SLICE: ' + txt.slice(0, 200));
      } catch (e) { perPost[id] = 'THREW: ' + e; }
    }
    return { middle, corner, perPost };
  }, { MIDDLE_AUTO, POSTS });

  expect(errs, 'no pageerrors').toEqual([]);

  // ── (1) UNIFICATION — the Expert middle trans-traverse slice ────────────────────────────────────────────────
  const mL = r.middle.split('\n');
  const da = mL.findIndex((l) => l.includes('Diag primary'));
  const db = mL.findIndex((l) => l.includes('auto-traverse to the perpendicular'));
  expect(da, 'the trans-axis traverse is present (Diag primary marker)').toBeGreaterThan(-1);
  const transSlice = mL.slice(da, db + 1).join('\n');
  expect(transSlice, 'the trans-traverse SAVES the probe Z').toMatch(/#95=#882 \( @saveProbeZ \)/);
  expect(transSlice, 'the trans-traverse LIFTS to the #520 machine margin (read-only guard)').toMatch(/#42=#520/);
  expect(transSlice, 'the trans-traverse lifts via G53 to the margin').toMatch(/G53 Z#42/);
  expect(transSlice, 'the trans-traverse RETURNS to the saved probe Z').toMatch(/G53 Z#95 \( @returnProbeZ \)/);
  // the OLD relative hop is GONE from the trans-traverse (it was `G0 Z#18` before the diagonal + `G0 Z[0-#18]` after)
  expect(transSlice, 'the old relative +#18 lift is gone from the trans-traverse').not.toMatch(/G0 Z#18\b/);
  expect(transSlice, 'the old relative -#18 drop is gone from the trans-traverse').not.toMatch(/G0 Z\[0-#18\]/);
  // the XY re-centre itself is UNCHANGED (only the Z-clearance changed) — the primary re-centre move survives in both
  // the default dogleg (secondary #21 out first, then this) and the diagonal (this + Y#21 on one line)
  expect(transSlice, 'the XY primary re-centre is unchanged').toMatch(/G0 X\[#22-#52-#10-#6\]/);

  // ── (2) INVARIANT — same clearance choreography as corner's wall-traverse ───────────────────────────────────
  const MAX_SIG = ['SAVE', 'MARGIN-READ', 'MARGIN-LIFT', 'RETURN'];
  expect(clearanceOps(transSlice), 'middle trans-traverse runs the Max clearance choreography').toEqual(MAX_SIG);
  // corner's FIRST save->return wall-traverse block
  const cL = r.corner.split('\n');
  const cs = cL.findIndex((l) => l.includes('@saveProbeZ'));
  const cr = cL.findIndex((l, i) => i > cs && l.includes('@returnProbeZ'));
  expect(cs, 'corner has a machine-margin wall-traverse (save)').toBeGreaterThan(-1);
  expect(cr, 'corner has the paired return').toBeGreaterThan(cs);
  const cornerBlock = cL.slice(cs, cr + 1).join('\n');
  expect(clearanceOps(cornerBlock), 'corner wall-traverse runs the SAME Max clearance choreography as middle').toEqual(MAX_SIG);

  // ── (3) PAIRING — net-zero by construction (one save, one return in the trans-traverse) ─────────────────────
  const saves = (transSlice.match(/@saveProbeZ/g) || []).length;
  const returns = (transSlice.match(/@returnProbeZ/g) || []).length;
  expect(saves, 'exactly one save in the trans-traverse').toBe(1);
  expect(returns, 'exactly one return — pairs 1:1 with the save (returns to the probe Z)').toBe(saves);

  // ── (4) PER POST — the margin lift FOLDS (Expert precise; the rest differ, none THREW) ──────────────────────
  for (const id of POSTS) {
    expect(r.perPost[id], `middle trans-traverse emits without throwing on ${id}`).not.toMatch(/^THREW:/);
    expect(r.perPost[id], `middle trans-traverse slice is real on ${id}`).not.toMatch(/^NO-SLICE:/);
  }
  // Expert — the read-only #520 guard + G53 margin + the honest return (the exact register truth)
  expect(r.perPost['ddcs-expert-m350'], 'Expert: read-only #520 margin guard').toMatch(/#42=#520/);
  expect(r.perPost['ddcs-expert-m350'], 'Expert: honest return marker').toMatch(/@returnProbeZ/);
  // V4.1 / DM500 fold DIFFERENTLY from Expert (no #520 read-only guard) — proves the emit maps per post, not baked
  expect(r.perPost['ddcs-v41'], 'V4.1 folds differently from Expert (no #520 read-only guard)').not.toMatch(/#42=#520/);
  expect(r.perPost['ddcs-v3-dm500'], 'DM500 folds differently from Expert (no #520 read-only guard)').not.toMatch(/#42=#520/);
});
