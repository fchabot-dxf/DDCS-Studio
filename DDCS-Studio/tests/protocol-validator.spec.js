import { test, expect } from '@playwright/test';

/**
 * PROTOCOL VALIDATOR — the single guard that every op respects the format/parser contract. This is the safety
 * net for the wizard-binding rebuild: it fails the instant any op (built-in OR a future user-made one) drifts
 * from the protocol. Formalizes the scattered round-trip tests (atc-roundtrip, contour-wizard, …) in one place.
 *
 * For every op in BUILDERS it asserts:
 *   1. it has a DICT entry (its vocabulary is declared in opDictionary), and
 *   2. its declared params survive the marker round-trip  params → ( @DDCS:1 {…} ) → params  (canon bijective), and
 *   3. its canon names are unique (no two params collide on the same marker key — which would lose data).
 * (Form-field binding + reconstruct-from-real-params are checked by the existing per-op specs; this guard will
 *  extend to the binding as it folds into the dictionary.)
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
