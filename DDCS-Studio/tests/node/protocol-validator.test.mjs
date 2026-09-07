import { test, expect } from './support/harness.mjs';

/**
 * PROTOCOL VALIDATOR — the single guard that every op respects the format/parser contract. This is the safety
 * net for the wizard-binding rebuild: it fails the instant any op (built-in OR a future user-made one) drifts
 * from the protocol. Formalizes the scattered round-trip tests (atc-roundtrip, contour-wizard, …) in one place.
 *
 * For every op in BUILDERS it asserts:
 *   1. it has a SCHEMA entry (its vocabulary is declared in opSchema), and
 *   2. it has a form-field binding unless exempt (a `.field` on ≥1 SCHEMA param), and every binding landed on a
 *      real SCHEMA param (BIND_ORPHANS empty — the binding lives ON the schema, so the field map can't drift), and
 *   3. its declared params survive the marker round-trip  params → ( @DDCS:1 {…} ) → params  (canon bijective), and
 *   4. its canon names are unique (no two params collide on the same marker key — which would lose data).
 * (reconstruct-from-real-params is checked by the existing per-op specs.)
 */
test('protocol: every op has a dict entry, round-trips, and is canon-clean', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const report = await page.evaluate(async () => {
    const ops = await import('/blocks/opBuilders.js');
    const D = await import('/blocks/opSchema.js');
    const EXEMPT_BINDING = new Set(['drill', 'atc_length', 'homing']);   // drill: custom view.setForm; atc_length: settings-driven; homing: no form-field map
    const out = [];
    for (const opType of Object.keys(ops.BUILDERS)) {
      const r = { opType, errors: [] };
      const spec = D.SCHEMA[opType];
      if (!spec) { r.errors.push('no SCHEMA entry'); out.push(r); continue; }
      // form-field binding: the dict carries a `.field` on every form-bound param (fieldsOf derives the map).
      // Non-exempt ops must bind ≥1 param so the wizard can seed its form when editing the op. (A binding to a
      // non-existent param can't exist — it lands in BIND_ORPHANS, asserted empty below.)
      if (!Object.keys(D.paramFields(opType)).length && !EXEMPT_BINDING.has(opType)) r.errors.push('no form-field binding (SCHEMA .field)');

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
    return { out, orphans: D.BIND_ORPHANS };
  });
  const { out, orphans } = report;
  const failures = out.filter((r) => r.errors.length);
  if (failures.length) console.log('PROTOCOL FAILURES:\n' + failures.map((f) => `  ${f.opType}: ${f.errors.join('; ')}`).join('\n'));
  expect(orphans).toEqual([]);                           // every field binding landed on a real SCHEMA param (no stale binding)
  expect(out.length).toBeGreaterThan(15);               // sanity: the BUILDERS registry was actually read
  expect(failures).toEqual([]);
});
