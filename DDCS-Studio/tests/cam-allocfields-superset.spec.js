import { test, expect } from '@playwright/test';

/**
 * CAM Builder S0 — allocFieldsWith is a STRICT SUPERSET of allocFields.
 * Equivalence (my own two-method check #2): allocFieldsWith(spec, used, off) with decl OMITTED and with an ALL-EXPOSED
 * decl is BYTE-IDENTICAL (JSON deep-equal) to allocFields(spec, used, off) — across several real-shaped specs, several
 * (used, varOffset) combos, and the pool-pressure (idx=null) path. The bake branch is exercised only for a
 * present-but-unexercised sanity (drops the field + literalizes v) — S0 rewires no caller.
 */
test('allocFieldsWith == allocFields when decl omitted / all-exposed (several specs, offsets, used-sets)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { allocFields, allocFieldsWith } = await import('/data/probeToSlot.js');

    // Real-shaped fixtures (the production specs' shape: key/label/units/def/min/max/type). Varied lengths.
    const CORNER = [
      { key: 'corner', label: 'Corner (1FL 2FR 3BL 4BR)', units: '', def: 1, min: 1, max: 4, type: 0 },
      { key: 'wcs', label: 'WCS', units: '', def: 0, min: 0, max: 6, type: 0 },
      { key: 'probeZ', label: 'Probe Z first', units: '', def: 0, min: 0, max: 1, type: 0 },
      { key: 'maxProbe', label: 'Max probe', units: 'mm', def: 100, min: 1, max: 9999, type: 1 },
      { key: 'retract', label: 'Retract', units: 'mm', def: 5, min: 0.1, max: 999, type: 1 },
      { key: 'fast', label: 'Fast feed', units: 'mm/min', def: 200, min: 1, max: 9999, type: 0 },
      { key: 'slow', label: 'Slow feed', units: 'mm/min', def: 50, min: 1, max: 9999, type: 0 },
    ];
    const POCKET = [
      { key: 'w', label: 'Width', units: 'mm', def: 80, min: 1, max: 9999, type: 1 },
      { key: 'h', label: 'Height', units: 'mm', def: 60, min: 1, max: 9999, type: 1 },
      { key: 'depth', label: 'Depth', units: 'mm', def: 4, min: 0.1, max: 999, type: 1 },
      { key: 'stepdown', label: 'Stepdown', units: 'mm', def: 1.5, min: 0.1, max: 999, type: 1 },
      { key: 'feed', label: 'Feed', units: 'mm/min', def: 2000, min: 1, max: 99999, type: 0 },
    ];
    const ONE = [{ key: 'only', label: 'Only', units: 'mm', def: 1, min: 0, max: 9, type: 1 }];
    const specs = { CORNER, POCKET, ONE };

    // several used-sets (empty, a few taken forcing nextParam to skip, near-exhaustion for the idx=null path) × offsets
    const usedSets = [ [], [1100, 1101, 1105], Array.from({ length: 400 }, (_, i) => 1100 + i) /* pool 1100-1499 full → idx null */ ];
    const offsets = [0, 10, 100];

    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const fails = [];
    let cases = 0;
    for (const [name, spec] of Object.entries(specs)) {
      for (const used of usedSets) {
        for (const off of offsets) {
          const base = allocFields(spec, new Set(used), off);
          const omitted = allocFieldsWith(spec, new Set(used), off, undefined);            // decl omitted
          const allExposed = allocFieldsWith(spec, new Set(used), off,
            Object.fromEntries(spec.map((s) => [s.key, { exposed: true }])));               // all-exposed decl
          cases++;
          if (!eq(base, omitted)) fails.push(`${name} off=${off} used=${used.length}: decl-omitted differs`);
          if (!eq(base, allExposed)) fails.push(`${name} off=${off} used=${used.length}: all-exposed differs`);
        }
      }
    }

    // present-but-unexercised bake sanity: baking 'fast' drops its field + literalizes v['fast'] (NOT byte-identical — expected)
    const baked = allocFieldsWith(CORNER, new Set(), 0, { fast: { exposed: false, value: 250 } });
    const bakeSanity = {
      noFastField: !baked.fields.some((f) => f.key === 'fast'),
      fastIsLiteral: baked.v.fast === '250',
      fieldCountDropsByOne: baked.fields.length === CORNER.length - 1,
      othersStillVars: baked.v.corner === '#1' && baked.v.slow === '#7',   // #-var stays positional (varOffset+i+1) by spec index
    };
    return { cases, fails, bakeSanity };
  });
  console.log('S0 SUPERSET: ' + JSON.stringify(r));
  expect(r.fails, 'allocFieldsWith deep-equals allocFields for every (spec,used,offset) when decl omitted or all-exposed').toEqual([]);
  expect(r.cases, 'ran the full matrix').toBeGreaterThanOrEqual(27);
  // the bake branch exists + behaves (present-but-unexercised by callers in S0)
  expect(r.bakeSanity.noFastField && r.bakeSanity.fastIsLiteral && r.bakeSanity.fieldCountDropsByOne && r.bakeSanity.othersStillVars,
    'baking a param drops its field + literalizes its v-entry (bake branch present)').toBe(true);
});
