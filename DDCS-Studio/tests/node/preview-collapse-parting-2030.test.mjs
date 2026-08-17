import { test, expect } from './support/harness.mjs';
import { partProfileSpec } from '../../web/viz/latheProfileCanvas.js';
import { partBladeZ, partFloorRadius } from '../../web/wizards/lathe/parting.js';

/**
 * t2030 — THE LAST TIER-1 COLLAPSE, lathe_parting's kerf-offset formula (PREVIEW-AS-DATA.md Tier-1 #8, the
 * one t2016/t2028 both parked for its genuine field rename). `partProfileSpec` (`latheProfileCanvas.js`) used
 * to re-derive `zFace - width` and the floor radius by hand — the SAME two facts `partBladeZ`/`partFloorRadius`
 * (`wizards/lathe/parting.js`) are declared for, explicitly "so the emit and the tests cannot disagree" (that
 * file's own words) — a 3rd independent copy the canvas never called into.
 *
 * THE RENAME, resolved (not a new adapter — the twin's own field already IS the bridge): `zFace`/`width` need
 * no adapter (twin and wizard already agree on those names). The twin collapses the wizard's two mutually-
 * exclusive fields (`targetDiameter` for groove, `spigotDiameter` for part) into ONE bound `#var` socket,
 * `floorDiameter` — passed to `partFloorRadius` under BOTH wizard names at once; the function's own `kind`
 * dispatch picks the right one, so this is exact, not a guess.
 *
 * NOT byte-identical, reported plainly rather than smoothed over (two real, deliberate changes):
 * 1. A REAL BUG FIX: the old hand-typed floorR was hardcoded to 0 for every part-off, so a declared spigot
 *    (floorDiameter > 0 while parting) never appeared in the drawing — partFloorRadius handles both kinds
 *    correctly by construction, so this collapse both dedupes AND fixes a real, previously-invisible mismatch.
 * 2. A tiny (≤0.001mm) rounding change: partBladeZ/partFloorRadius apply round3 (3dp), the same rounding the
 *    REAL EMIT already uses; the old canvas code rounded nothing, so the preview now matches the emit's own
 *    precision exactly instead of a sub-micron away from it.
 */

const BAR = { diameter: 20 };
const kerfRect = (part) => partProfileSpec(BAR, part).items.find((i) => i.cls === 'fc-feature-pocket');

test('the drawn kerf is partBladeZ/partFloorRadius\'s OWN output — not a hand re-derivation', () => {
    const CASES = [
        { kind: 'groove', zFace: -10, width: 3, floorDiameter: 12 },
        { kind: 'groove', zFace: -7.25, width: 3.4, floorDiameter: 8.567 },
        { kind: 'part', zFace: -10, width: 3, floorDiameter: 0 },
        { kind: 'part', zFace: -12.5, width: 2.5, floorDiameter: 6 },
    ];
    for (const p of CASES) {
        const rect = kerfRect(p);
        const wantZ = partBladeZ(p);   // zFace/width need no adapter
        const wantR = partFloorRadius({ kind: p.kind, targetDiameter: p.floorDiameter, spigotDiameter: p.floorDiameter });
        expect(rect.x, `zBlade for ${JSON.stringify(p)}`).toBe(wantZ);
        expect(rect.y, `floorR for ${JSON.stringify(p)}`).toBe(wantR);
    }
});

test('THE BUG FIX: a part-off with a declared spigot now draws the floor where it really stops, not always at 0', () => {
    const noSpigot = kerfRect({ kind: 'part', zFace: -10, width: 3, floorDiameter: 0 });
    const withSpigot = kerfRect({ kind: 'part', zFace: -10, width: 3, floorDiameter: 6 });
    expect(noSpigot.y, 'the default (run through) still draws at the centreline').toBe(0);
    expect(withSpigot.y, 'a declared 6mm spigot draws at its OWN radius (3), not 0').toBe(3);
    expect(withSpigot.h, 'and the removed-material rectangle is correspondingly shorter').toBeLessThan(noSpigot.h);
});

test('groove floor radius now carries the SAME 3-decimal rounding the real emit already applies', () => {
    const rect = kerfRect({ kind: 'groove', zFace: -7.25, width: 3.4, floorDiameter: 8.567 });
    // radiusOf(8.567) is exactly 4.2835 — the emit's own partFloorRadius rounds to 4.284; the OLD canvas code
    // never rounded at all, so it would have drawn 4.2835 (a real, if tiny, mismatch against what got cut).
    expect(rect.y).toBe(4.284);
    expect(rect.y).not.toBe(4.2835);
});
