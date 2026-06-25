import { test, expect } from '@playwright/test';

/**
 * PROTOCOL VALIDATOR — the single guard that every op respects the format/parser contract. This is the safety
 * net for the wizard-binding rebuild: it fails the instant any op (built-in OR a future user-made one) drifts
 * from the protocol. Formalizes the scattered round-trip tests (atc-roundtrip, contour-wizard, …) in one place.
 *
 * For every op in BUILDERS it asserts:
 *   1. it has a DICT entry (its vocabulary is declared in opDictionary), and
 *   2. it has a form-field binding (PARAM_FIELDS) unless exempt, and every binding key is a DICT param
 *      (FIELDS ⊆ DICT — so the binding folds into the dictionary with no orphan keys), and
 *   3. its declared params survive the marker round-trip  params → ( @DDCS:1 {…} ) → params  (canon bijective), and
 *   4. its canon names are unique (no two params collide on the same marker key — which would lose data).
 * (reconstruct-from-real-params is checked by the existing per-op specs.)
 */
test('protocol: every op has a dict entry, round-trips, and is canon-clean', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const report = await page.evaluate(async () => {
    const ops = await import('/blocks/opStacks.js');
    const D = await import('/blocks/opDictionary.js');
    const wm = await import('/wizardManager.js');
    const FIELDS = wm.PARAM_FIELDS || {};
    const EXEMPT_BINDING = new Set(['drill', 'atc_length', 'homing']);   // drill: custom view.setForm; atc_length: settings-driven; homing: no form-field map
    const out = [];
    for (const opType of Object.keys(ops.BUILDERS)) {
      const r = { opType, errors: [] };
      const spec = D.DICT[opType];
      if (!spec) { r.errors.push('no DICT entry'); out.push(r); continue; }
      if (!FIELDS[opType] && !EXEMPT_BINDING.has(opType)) r.errors.push('no form-field binding (PARAM_FIELDS)');

      // FIELDS ⊆ DICT: every form-field binding key must be a declared DICT param. A stale FIELDS key seeds
      // nothing (op.params[key] is undefined) and never round-trips through the marker — this guards the
      // binding rebuild: the field map can fold into the dictionary with no orphan keys.
      const fmap = FIELDS[opType];
      if (fmap) for (const k in fmap) { if (!spec[k]) r.errors.push(`FIELDS key "${k}" not in DICT`); }

      // canon uniqueness (a collision would silently drop a param on round-trip)
      const seen = {};
      for (const k in spec) {
        const c = spec[k].canon || k;
        if (seen[c]) r.errors.push(`canon collision "${c}" (${seen[c]} & ${k})`);
        seen[c] = k;
      }

      // marker round-trip over all declared params (type-appropriate dummies)
      const params = {};
      for (const k in spec) {
        const t = spec[k].type;
        params[k] = t === 'number' ? 7 : t === 'bool' ? true : t === 'structured' ? { a: 1, b: [2, 3] } : 'val';
      }
      try {
        const parsed = D.parseMarker(D.markerLine(opType, params));
        if (!parsed) r.errors.push('marker did not parse');
        else if (parsed.opType !== opType) r.errors.push(`opType lost (${parsed.opType})`);
        else if (JSON.stringify(parsed.params) !== JSON.stringify(params)) r.errors.push('params not identical after round-trip');
      } catch (e) { r.errors.push('marker error: ' + (e.message || e)); }

      out.push(r);
    }
    return out;
  });
  const failures = report.filter((r) => r.errors.length);
  if (failures.length) console.log('PROTOCOL FAILURES:\n' + failures.map((f) => `  ${f.opType}: ${f.errors.join('; ')}`).join('\n'));
  expect(report.length).toBeGreaterThan(15);            // sanity: the BUILDERS registry was actually read
  expect(failures).toEqual([]);
});
