import { test, expect } from '@playwright/test';

/**
 * t929 B2b-2c — CORNER's wall1→wall2 traverse now reads the declared CLEARANCE MODE (clearLiftNodes), so the built-in
 * cornerStack honours Max / Hop / Plane. The STANDING SPLIT: only WALL1 (the between-walls retreat, followed by the
 * repoTraverse) reads the mode; WALL2 (the final retract) + the error handler stay Max (always max caution). safeZ (#19)
 * is the PLUNGE/approach and is UNCHANGED. Max is BYTE-IDENTICAL to today (clearLiftNodes('max') === safeRetractNode).
 * (This is the EMIT foundation; the corner data-op FORM to SELECT the mode is a separate follow-up — see WORK-LOG.)
 */
const em = async (page, params, dialectId) => page.evaluate(async ({ p, d }) => {
  const { cornerStack } = await import('/wizards/cornerWizard.js');
  const { emitMapped } = await import('/blocks/blockEmitter.js');
  const { getDialect } = await import('/wizards/dialects/index.js');
  return emitMapped(cornerStack(p), { dialect: getDialect(d) }).text;
}, { p: params, d: dialectId });

test('corner honours the clearance mode on the wall1 traverse; wall2 + error stay Max; per-post; Max byte-identical', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  // MAX byte-identical: clearMode omitted (default max) === clearMode:'max' === today's emit
  const bare = await em(page, {}, 'ddcs-expert-m350');
  const max = await em(page, { clearMode: 'max' }, 'ddcs-expert-m350');
  expect(max, 'clearMode:max is byte-identical to the default (no relative Z lift introduced)').toBe(bare);
  expect(bare, 'Max: no hop cap').not.toMatch(/#43=\[#95/);
  expect(bare, 'Max: no clearance-hop block').not.toMatch(/Clearance hop - capped/);

  // HOP: WALL1 gets the capped hop (exactly one), wall2 + error stay the #520 margin
  const hop = await em(page, { clearMode: 'hop', hopDist: 15 }, 'ddcs-expert-m350');
  expect(hop, 'Expert hop: the wall1 retreat is the capped hop').toMatch(/#43=\[#95\+15\]/);
  expect((hop.match(/Clearance hop - capped/g) || []).length, 'exactly ONE hop block (wall1 only — wall2 is the final Max retract)').toBe(1);
  expect(hop, 'the wall2 final + error handler retreats stay the #520 machine margin').toMatch(/#42=#520/);
  // the honest return is preserved (the traverse still returns to the saved probe Z)
  expect(hop, 'the wall1 traverse still returns to the saved probe Z').toMatch(/G53 Z#95 \( @returnProbeZ \)/);

  // PLANE: WALL1 gets the absolute work-Z lift; wall2 + error stay Max
  const plane = await em(page, { clearMode: 'plane', planeZ: 13 }, 'ddcs-expert-m350');
  expect(plane, 'Expert plane: the wall1 retreat is the absolute work-Z lift').toMatch(/G0 Z13\b/);
  expect(plane, 'Plane: NOT the hop cap').not.toMatch(/#43=\[#95/);
  expect(plane, 'the wall2 final + error handler stay the #520 margin').toMatch(/#42=#520/);

  // PER-POST fold of the wall1 hop cap: Expert #520/#42, V4.1 #190/#191, none throws
  const v41 = await em(page, { clearMode: 'hop', hopDist: 15 }, 'ddcs-v41');
  expect(v41, 'V4.1: the wall1 hop caps against the baked #190 margin via #191').toMatch(/#191=\[#95\+15\]/);
  const dm500 = await em(page, { clearMode: 'hop', hopDist: 15 }, 'ddcs-v3-dm500');
  expect(typeof dm500, 'DM500 hop emits without throwing (work-frame degrade)').toBe('string');
});
