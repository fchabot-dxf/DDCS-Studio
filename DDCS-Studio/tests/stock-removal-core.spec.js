import { test, expect } from '@playwright/test';
import { HeightmapCarve, CARVE_MAX_CELLS, CARVE_MAX_CELLS_LARGE } from '../web/engine/stockRemoval.js';

/**
 * MATERIAL REMOVAL E1 — the CarveMap core, headless (the ratified assert-the-VALUE bar). A heightmap carve: 'feed' (cut)
 * moves remove material to the flat-endmill tip Z; probe/rapid NEVER carve; the initial map pre-seeds declared recesses.
 */
const STOCK = { x: 100, y: 80, z: 20 };

test('DRILL end-state: a plunge drops the cells at the hole centre to the hole DEPTH (assert the map value)', () => {
    const m = new HeightmapCarve(STOCK, []);
    expect(m.heightAt(50, 40), 'seed: full stock (top = 0)').toBe(0);
    // a Ø6 drill at (50,40): rapid down to +5 (no carve), plunge feed +5 → −10, rapid retract (no carve)
    m.carveSegment({ x: 50, y: 40, z: 5 }, { x: 50, y: 40, z: 5 }, 3, 'rapid');
    m.carveSegment({ x: 50, y: 40, z: 5 }, { x: 50, y: 40, z: -10 }, 3, 'feed');
    m.carveSegment({ x: 50, y: 40, z: -10 }, { x: 50, y: 40, z: 5 }, 3, 'rapid');
    expect(m.heightAt(50, 40), 'the hole-centre cell dropped to the plunge depth −10').toBeCloseTo(-10, 3);
    expect(m.heightAt(50 + 2, 40), 'a cell within the Ø6 tool (r=3) is also cut').toBeCloseTo(-10, 3);
    expect(m.heightAt(10, 10), 'a cell far from the hole is untouched (full stock)').toBe(0);
    expect(m.heightAt(50 + 8, 40), 'a cell OUTSIDE the tool radius is untouched').toBe(0);
});

test('SURFACING: a lateral feed pass at −2 lowers the swept face cells uniformly to −2', () => {
    const m = new HeightmapCarve(STOCK, []);
    // a wide facing sweep along X at Y=40, z=−2, with a Ø10 tool (r=5)
    m.carveSegment({ x: 5, y: 40, z: -2 }, { x: 95, y: 40, z: -2 }, 5, 'feed');
    expect(m.heightAt(50, 40), 'the swept centre is lowered to the pass Z (−2)').toBeCloseTo(-2, 3);
    expect(m.heightAt(20, 40), 'another swept cell is also −2').toBeCloseTo(-2, 3);
    expect(m.heightAt(50, 40 + 4), 'a cell within the r=5 band is cut').toBeCloseTo(-2, 3);
    expect(m.heightAt(50, 40 + 12), 'a cell well outside the band is untouched').toBe(0);
});

test('PROBE + RAPID carve NOTHING — the map stays byte-equal to the seed (declared class, not inferred)', () => {
    const m = new HeightmapCarve(STOCK, []);
    // a probe touching down + a rapid plunge (both would look like a cut geometrically) — neither may remove material
    m.carveSegment({ x: 30, y: 30, z: 5 }, { x: 30, y: 30, z: -15 }, 3, 'probe');
    m.carveSegment({ x: 60, y: 50, z: 5 }, { x: 60, y: 50, z: -15 }, 3, 'rapid');
    expect(m.isPristine(), 'a PROBE / RAPID program leaves the map identical to its seed').toBe(true);
    expect(m.heightAt(30, 30), 'the probed cell is uncut').toBe(0);
});

test('PRE-SEED: the initial map pre-carves the DECLARED recesses (rect + round) to −depth', () => {
    const m = new HeightmapCarve(STOCK, [
        { shape: 'rect', side: 'inside', pos: { x: 25, y: 20 }, size: { x: 20, y: 16 }, depth: 8 },
        { shape: 'round', side: 'inside', pos: { x: 75, y: 60 }, size: { d: 20 }, depth: 5 },
    ]);
    expect(m.heightAt(25, 20), 'the rect pocket centre pre-seeds to −8').toBeCloseTo(-8, 3);
    expect(m.heightAt(75, 60), 'the round bore centre pre-seeds to −5').toBeCloseTo(-5, 3);
    expect(m.heightAt(75 + 6, 60), 'inside the round footprint (r=10) is −5').toBeCloseTo(-5, 3);
    expect(m.heightAt(50, 40), 'material away from any recess is full stock').toBe(0);
    expect(m.isPristine(), 'the pre-seed IS the seed (pristine baseline includes the recesses)').toBe(true);
});

test('ANTI-ALIAS (t676 amendment): a straight surfacing wall renders STRAIGHT — boundary cells are FRACTIONAL + consistent along X', () => {
    const m = new HeightmapCarve(STOCK, []);
    m.carveSegment({ x: 5, y: 40, z: -2 }, { x: 95, y: 40, z: -2 }, 5, 'feed');   // a straight pass along X at Y=40, r=5
    // (a) the boundary (near Y=35, the tool edge) must have a FRACTIONAL height — not a binary cliff (0 or −2)
    let sawFractional = false;
    for (let y = 33.5; y <= 36.5; y += 0.25) { const h = m.heightAt(50, y); if (h < -0.15 && h > -1.85) { sawFractional = true; break; } }
    expect(sawFractional, 'the wall has anti-aliased (partial-depth) cells, not a hard staircase').toBe(true);
    // (b) a STRAIGHT wall: the same cross-section at different X along the pass gives the SAME boundary height (not wavy)
    for (const yb of [35.0, 35.5, 45.0]) {
        const a = m.heightAt(20, yb), b = m.heightAt(50, yb), c = m.heightAt(78, yb);
        expect(Math.abs(a - b), `wall height at Y=${yb} is equal along X (20 vs 50) → straight`).toBeLessThan(0.02);
        expect(Math.abs(b - c), `wall height at Y=${yb} is equal along X (50 vs 78) → straight`).toBeLessThan(0.02);
    }
});

test('ANTI-ALIAS: a drilled hole reads ROUND — mirror-symmetric footprint with a fractional (anti-aliased) edge', () => {
    const m = new HeightmapCarve(STOCK, []);
    m.carveSegment({ x: 50, y: 40, z: 5 }, { x: 50, y: 40, z: -10 }, 3, 'feed');   // Ø6 plunge at (50,40)
    // inside the tool: full depth (flat circular floor)
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) expect(m.heightAt(50 + dx, 40 + dy), 'inside the tool → full depth −10').toBeCloseTo(-10, 2);
    // MIRROR symmetry: opposite points are EQUAL → no directional facet/bias (dx≠dy legitimately breaks 4-fold, not 2-fold).
    expect(m.heightAt(53, 40), 'X-mirror: the +x edge == the −x edge (round, not skewed)').toBeCloseTo(m.heightAt(47, 40), 3);
    expect(m.heightAt(50, 43), 'Y-mirror: the +y edge == the −y edge').toBeCloseTo(m.heightAt(50, 37), 3);
    // the edge is ANTI-ALIASED — a partial depth, not a hard 0/−10 cliff
    for (const [dx, dy] of [[3, 0], [0, 3]]) { const h = m.heightAt(50 + dx, 40 + dy); expect(h, 'edge is partially cut').toBeLessThan(-0.2); expect(h, 'edge not full depth').toBeGreaterThan(-9.8); }
});

test('BALL tip (t682): tip=flat is BYTE-IDENTICAL to the default carve; a ball tool carves a DIFFERENT (spherical) map', () => {
    const A = { x: 20, y: 40, z: -5 }, B = { x: 80, y: 40, z: -5 };
    const flat = new HeightmapCarve(STOCK, []); flat.carveSegment(A, B, 3, 'feed', 'flat');
    const dflt = new HeightmapCarve(STOCK, []); dflt.carveSegment(A, B, 3, 'feed');   // tip omitted → default flat
    let identical = true; for (let k = 0; k < flat.h.length; k++) if (flat.h[k] !== dflt.h[k]) identical = false;
    expect(identical, 'tip=flat == the pre-tip default carve (byte-identical map — flat behaviour unchanged)').toBe(true);
    const ball = new HeightmapCarve(STOCK, []); ball.carveSegment(A, B, 3, 'feed', 'ball');
    expect(flat.heightAt(50, 40), 'a FLAT groove floor is −5 across the width').toBeCloseTo(-5, 2);
    expect(ball.heightAt(50, 40), 'a BALL groove centre reaches −5 (the tip)').toBeCloseTo(-5, 1);
    expect(ball.heightAt(50, 42), 'a BALL groove 2mm off-axis is SHALLOWER than −5 (spherical rise)').toBeGreaterThan(-4.9);
    let differs = false; for (let k = 0; k < ball.h.length; k++) if (Math.abs(ball.h[k] - flat.h[k]) > 0.05) differs = true;
    expect(differs, 'the ball profile carves a different map than flat').toBe(true);
});

test('BALL scallops (t682): parallel ball passes leave periodic ridges ≈ r − √(r² − (stepover/2)²)', () => {
    const r = 3, stepover = 3;   // Ø6 ball, 3mm stepover
    const m = new HeightmapCarve(STOCK, []);
    for (const y of [37, 40, 43, 46]) m.carveSegment({ x: 20, y, z: -5 }, { x: 80, y, z: -5 }, r, 'feed', 'ball');   // parallel passes along X
    const centreZ = m.heightAt(50, 43);          // on a pass axis → deepest (~−5)
    const ridgeZ = m.heightAt(50, 41.5);         // between passes 40 & 43 (stepover/2 = 1.5 from each) → the scallop peak
    const ridge = ridgeZ - centreZ;
    const expected = r - Math.sqrt(r * r - (stepover / 2) * (stepover / 2));   // ≈ 0.40mm
    expect(centreZ, 'a ball pass centre reaches the tip depth −5').toBeCloseTo(-5, 1);
    expect(ridge, 'a SCALLOP ridge stands between the passes (material not fully cleared)').toBeGreaterThan(0.15);
    expect(Math.abs(ridge - expected), 'the scallop height matches r − √(r²−(s/2)²) at cell precision').toBeLessThan(0.12);
});

test('CRISP floor hc[] (t682): a pocket wall is a CLEAN single step (0 → −depth), no AA lip — feeds the vertical-wall mesh', () => {
    const m = new HeightmapCarve(STOCK, []);
    for (let y = 30; y <= 50; y += 1) m.carveSegment({ x: 20, y, z: -6 }, { x: 80, y, z: -6 }, 5, 'feed');   // a −6 pocket band
    const hcAt = (x, y) => m.hc[m.idx(Math.round(x / m.dx), Math.round(y / m.dy))];
    expect(hcAt(50, 40), 'pocket interior floor is crisp −6').toBeCloseTo(-6, 3);
    expect(hcAt(50, 22), 'outside the pocket is full stock (0)').toBe(0);
    // the CRISP layer has NO intermediate lip value along the wall — every cell is either 0 or −6 (unlike the AA h[])
    let clean = true; for (let y = 18; y <= 40; y += m.dy) { const v = hcAt(50, y); if (v < -0.05 && v > -5.95) clean = false; }
    expect(clean, 'hc has no mid-plateau (a single clean wall, so the mesh wall is one vertical face)').toBe(true);
    // the AA layer h[] DOES carry a lip (that is what made the smooth mesh ramp) — proves the two layers differ by design
    let hHasLip = false; for (let y = 18; y <= 40; y += m.dy) { const v = m.h[m.idx(Math.round(50 / m.dx), Math.round(y / m.dy))]; if (v < -0.05 && v > -5.95) hHasLip = true; }
    expect(hHasLip, 'the AA h[] keeps its fractional lip (smooth mesh); hc[] is the crisp one').toBe(true);
});

test('the ADAPTIVE CAP + min-cell clamp (A/t682): sheet stock → 512/axis; mid stock → 256; tiny → coarse; floor clamp', () => {
    const sheet = new HeightmapCarve({ x: 2000, y: 3000, z: 40 }, []);
    expect(sheet.nx, 'a sheet-scale stock (>500mm) caps at 512/axis (adaptive)').toBe(CARVE_MAX_CELLS_LARGE);
    expect(sheet.ny, 'Y also 512').toBe(CARVE_MAX_CELLS_LARGE);
    const mid = new HeightmapCarve({ x: 400, y: 300, z: 30 }, []);   // ≤ 500mm → the default 256 cap
    expect(mid.nx, 'a ≤500mm stock keeps the 256 cap').toBe(CARVE_MAX_CELLS);
    expect(sheet.dx, 'a 2000mm side at the 512 cap → ~3.9mm cells (≤ ~2mm on a ≤1m sheet, honest degrade)').toBeLessThan(4.5);
    const tiny = new HeightmapCarve({ x: 1, y: 1, z: 5 }, []);
    expect(tiny.dx, 'tiny stock stays ≥ ~0.2mm cells (never absurd-dense)').toBeGreaterThanOrEqual(0.2);
    // can't cut below the stock bottom (floor clamp)
    const m = new HeightmapCarve(STOCK, []);
    m.carveSegment({ x: 50, y: 40, z: 5 }, { x: 50, y: 40, z: -999 }, 3, 'feed');
    expect(m.heightAt(50, 40), 'a plunge past the bottom clamps to −Z (−20), not −999').toBeCloseTo(-20, 3);
});
