import { test, expect } from './support/harness.mjs';
import { tapDataDef, TAP_DEFAULTS } from '../../web/blocks/dataOps/tapData.js';
import { textDataDef, TEXT_DEFAULTS } from '../../web/blocks/dataOps/textData.js';
import { depthLevels } from '../../web/wizards/clearing.js';

/**
 * t2044 — TIER 3 #22 SETTLED AS LIVE, and fixed: `tap_data`/`text_data` both use panel 'form3d+2d'
 * (confirmed by reading their own stack declarations), so userOpView.js's `renderZRulerBeside` runs
 * for both on every render — but neither declared `def.zRuler`, so the strip's own `spec` came back
 * null and it stayed hidden, unlike pocket/slot/contour/surfacing/drill/bore which all declare it.
 * A genuine, silent gap: the depth ruler simply never appeared for these two ops.
 *
 * Fixed by declaring `def.zRuler`, matching the two existing shapes exactly: tap (a single threading
 * pass, no stepdown) gets drill/bore's `depthOnly` form; text (depth + stepdown, like pocket) gets the
 * full stepped form. These tests reproduce `renderZRulerBeside`'s own spec-building logic (userOpView.js
 * ~line 300-307) against the real declared params, proving a real ruler spec with real pass ticks now
 * comes out the other end — not just a null-shaped declaration that LOOKS wired but never activates.
 */

function specFor(z, params) {
    if (!z) return null;
    const depth = Math.max(0, Number(params[z.depthParam]) || 0);
    if (depth <= 0) return null;
    if (z.depthOnly) return { depth, passes: [depth] };
    const stepdown = Math.max(0.05, Number(params[z.stepParam]) || 0);
    return { depth, stepdown, passes: depthLevels(depth, stepdown) };
}

test('tap_data declares zRuler (depth-only, no stepdown -- a single threading pass)', () => {
    const def = tapDataDef();
    expect(def.zRuler, 'tap declares a zRuler hook').toBeTruthy();
    expect(def.zRuler.depthOnly).toBe(true);
    expect(def.zRuler.depthParam).toBe('depth');
    const spec = specFor(def.zRuler, TAP_DEFAULTS);
    expect(spec, 'a real depth produces a real ruler spec, not a null one').toBeTruthy();
    expect(spec.passes).toEqual([TAP_DEFAULTS.depth]);
});

test('text_data declares zRuler (depth + stepdown, matching pocket/slot/contour/surfacing)', () => {
    const def = textDataDef();
    expect(def.zRuler, 'text declares a zRuler hook').toBeTruthy();
    expect(def.zRuler.depthParam).toBe('depth');
    expect(def.zRuler.stepParam).toBe('stepdown');
    const spec = specFor(def.zRuler, TEXT_DEFAULTS);
    expect(spec, 'a real depth+stepdown produces a real ruler spec with pass ticks').toBeTruthy();
    expect(spec.passes.length).toBeGreaterThan(0);
    expect(spec.passes[spec.passes.length - 1]).toBeCloseTo(TEXT_DEFAULTS.depth, 6);
});
