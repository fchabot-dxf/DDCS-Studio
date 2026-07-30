import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * POCKET PORT E0 — the pocketStack SUPERSET is the GATE + the flatten (region-pill→flat) is byte-identical.
 *
 * TWO assertions across the full strategy × tooSmall × 4-shapes × scalar sweep (96 cases):
 *  (1) FLATTEN byte-identity: the new concrete pocketStack (riding the FLAT pocketfill/pocketwall leaves) == the
 *      GOLDEN SNAPSHOT of the pre-E0 pocketStack (the stepover+contour region-socket path — the independent truth,
 *      captured in tests/fixtures/pocket-golden.json). Proves the flat leaves emit byte-for-byte the shared atoms.
 *  (2) E0 GATE: prune(pocketStack(S, superset:true)) == concrete pocketStack(S, superset:false). The superset carries
 *      BOTH forks guarded — strategy (real param) + tooSmall (the GEOMETRY-DERIVED `_tooSmall` key, injected via
 *      pocketTooSmall) — and pruneGuards must collapse to the concrete shape byte-for-byte. If it does not, E0 STOPS
 *      here (this gate precedes E1/the twin + bindings).
 *
 * ── t1391 — THE GOLDEN MOVED, DELIBERATELY, FOR THE 40 TOO-SMALL CASES ONLY ──────────────────────────────────────
 * A golden that is re-recorded whenever it goes red is not a golden. This one was regenerated because the emit it
 * snapshots CHANGED BY RULING: pocket's too-small fallback (a pocket narrower than its tool → a single plunge) was the
 * last consumer of the literal `drill` kernel, and the ruling re-pointed it through `holecycle` so that atom could
 * retire. The literal ladder — baked `G1 Z-1.5 / Z-3 / Z-4` with `prev>0` re-entry rapids — becomes the parametric body:
 * `#81=4` / `#82=1.5` seeded live, the same three cut depths reached by a macro loop, plus the unconditional R-plane
 * rapid that is the drill family's declared ledger exception 1.
 *
 * THE SCOPE WAS MEASURED BEFORE THE REGENERATION AND RE-CHECKED AT THE WRITE, not asserted afterwards:
 *   40 entries changed — EVERY ONE of them a `|tiny|` (too-small) key
 *   56 entries byte-for-byte untouched — NONE of them too-small
 * The regeneration copied each unchanged entry object verbatim and replaced only `emit` on the 40, with a hard check
 * that no non-`|tiny|` key could be written. So this file still holds the pre-E0 independent truth for every normal
 * pocket; only the arm the ruling moved has moved.
 *
 * ── t1406 — THE GOLDEN MOVED AGAIN, FOR 14 RECT ENTRIES, BY THE SAME DISCIPLINE ──────────────────────────────────
 * A rect pocket's CLEARING now rides `surfaceraster` (the parametric atom surfacing already emits through), and the
 * wall finish moved to after every fill level — both by ruling. So those emits changed, and the golden had to follow.
 *
 * THE SCOPE GUARD WAS THE PREDICATE ITSELF, not a key pattern, and that distinction caught something: my first cut
 * allowed `rect|*|normal|*` — 12 keys — and the regeneration REFUSED two more, `rect|spiral|tiny|3` and
 * `rect|raster|tiny|3`. They looked out of scope because they are the "tiny" size; they are not, because that scalar
 * sets `wallOffset: 1.5`, which shrinks the inset to 1.5mm and leaves a 4mm pocket with 1mm of real walk. They are
 * rect pockets that genuinely now ride the atom. A key-name pattern encoded my ASSUMPTION about which cases were
 * too-small; asking `pocketRidesRaster` asked the product. 14 changed, 0 refused — and the remaining 82 entries still
 * hold the pre-E0 independent truth, untouched by this act.
 *
 * ── t1433 — THE GOLDEN MOVED A THIRD TIME, FOR SEVEN RASTER ENTRIES, BY THE SAME DISCIPLINE ──────────────────────
 * A rect pocket's WALL FINISH now rides `wallfinish` — a runtime ring loop in a place of its own — where it was
 * `stepdown{ pocketwall }`, a JS transcript of the same ring at every level. Only the RASTER arm has a wall at all,
 * so the scope is `rect × raster × pocketRidesRaster`.
 *
 * THE SCOPE AND THE ACTUAL DIFF AGREED EXACTLY, and that agreement is the check rather than a formality: 7 keys in
 * scope, 7 keys changed, ZERO changed outside the scope and ZERO in scope that did NOT change. A key changing outside
 * the predicate would mean something moved that this act did not intend; a key inside it that did NOT change would
 * mean the predicate is wider than the re-point. Both were measured before the file was written, and the regeneration
 * refused to write unless the out-of-scope set was empty. The other 89 entries are byte-untouched — and the file's own
 * indent-1/CRLF format was preserved, so the diff is seven lines rather than a reformat hiding seven lines.
 */
const GOLDEN = JSON.parse(fs.readFileSync('tests/fixtures/pocket-golden.json', 'utf8'));

test('E0 GATE + FLATTEN: concrete == golden AND prune(superset) == concrete, byte-identical across the 96-combo sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async (golden) => {
        const { pocketStack, pocketTooSmall, pocketRidesRaster } = await import('/wizards/pocketWizard.js');
        const { pruneGuards } = await import('/blocks/whenGuard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');

        // reconstruct the sweep IDENTICALLY to the golden capture (same keys/params)
        const SHAPES = ['rect', 'circle', 'polygon', 'ellipse'], STRAT = ['spiral', 'raster'];
        const SIZES = { normal: { w: 80, h: 60, dia: 50 }, tiny: { w: 4, h: 4, dia: 4 } };
        const SCALARS = [
            {}, { toolDia: 10, stepoverPct: 55 }, { depth: 9, stepdown: 2 }, { wallOffset: 1.5 },
            { originX: 12, oy: -8, feed: 800, plunge: 120, clearance: 3 }, { wcs: 'G55', sides: 5 },
        ];
        let goldenDiffs = 0, gateDiffs = 0, leftoverGuards = 0, supGuardMax = 0, tooSmallSeen = 0, wallSeen = 0, cases = 0;
        let firstGolden = null, firstGate = null, hasFillLeaf = false, hasWallLeaf = false;
        for (const shape of SHAPES) for (const strategy of STRAT) for (const sz of Object.keys(SIZES)) for (let si = 0; si < SCALARS.length; si++) {
            const p = { shape, strategy, ...SIZES[sz], ...SCALARS[si] };
            const key = `${shape}|${strategy}|${sz}|${si}`;
            cases++;
            const concreteStack = pocketStack(p, { superset: false });
            const concrete = emitMapped(concreteStack).text;
            if (JSON.stringify(concreteStack).includes('"type":"pocketfill"')) hasFillLeaf = true;
            if (JSON.stringify(concreteStack).includes('"type":"pocketwall"')) hasWallLeaf = true;
            // (1) FLATTEN byte-identity — concrete (flat leaves) == the pre-E0 golden (stepover+contour region socket)
            if (golden[key] && concrete !== golden[key].emit) { goldenDiffs++; if (!firstGolden) firstGolden = { key, a: concrete.slice(0, 1400), b: golden[key].emit.slice(0, 1400) }; }
            // (2) E0 GATE — prune(superset) == concrete
            const sup = pocketStack(p, { superset: true });
            supGuardMax = Math.max(supGuardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            // t1406 — EVERY derived guard key is injected EXPLICITLY, including the ones whose absence used to give the
            // right answer by accident. `_rest` was never passed and read as undefined, which happened to falsify its
            // `is:true` guard; `_para` has BOTH polarities in the superset, so an undefined value would falsify both and
            // prune the clearing away entirely. Stating them is what makes this gate a test of prune rather than of luck.
            pruneGuards(sup, { ...p, _tooSmall: pocketTooSmall(p), _rest: false, _para: pocketRidesRaster(p) });
            if (JSON.stringify(sup).includes('"type":"guard"')) leftoverGuards++;
            const pruned = emitMapped(sup).text;
            if (pruned !== concrete) { gateDiffs++; if (!firstGate) firstGate = { key, a: pruned.slice(0, 1400), b: concrete.slice(0, 1400) }; }
            if (pocketTooSmall(p)) tooSmallSeen++;
            if (strategy === 'raster' && !pocketTooSmall(p)) wallSeen++;
        }
        return { goldenDiffs, gateDiffs, leftoverGuards, supGuardMax, tooSmallSeen, wallSeen, cases, firstGolden, firstGate, hasFillLeaf, hasWallLeaf };
    }, GOLDEN);

    console.log('POCKET E0: ' + JSON.stringify({ cases: r.cases, goldenDiffs: r.goldenDiffs, gateDiffs: r.gateDiffs, leftoverGuards: r.leftoverGuards, supGuardMax: r.supGuardMax, tooSmallSeen: r.tooSmallSeen, wallSeen: r.wallSeen }));
    if (r.firstGolden) console.log('FLATTEN DIFF @ ' + r.firstGolden.key + '\n--- NEW (flat leaves) ---\n' + r.firstGolden.a + '\n--- GOLDEN (stepover+contour) ---\n' + r.firstGolden.b);
    if (r.firstGate) console.log('GATE DIFF @ ' + r.firstGate.key + '\n--- PRUNED SUPERSET ---\n' + r.firstGate.a + '\n--- CONCRETE ---\n' + r.firstGate.b);

    expect(r.cases, 'the sweep is 4 shapes × 2 strategy × 2 size × 6 scalar = 96').toBe(96);
    expect(r.hasFillLeaf, 'the concrete rides the FLAT pocketfill leaf (region-pill→flat reframe)').toBe(true);
    // t1433 — the flat `pocketwall` leaf is still REACHED, on every raster arm the parametric wall is refused on
    // (circle / polygon / ellipse). The claim narrowed with the re-point rather than being deleted, because the leaf
    // it names is still shipping and this sweep is still the thing that exercises it.
    expect(r.hasWallLeaf, 'a REFUSED raster arm still rides the FLAT pocketwall leaf').toBe(true);
    expect(r.tooSmallSeen, 'the sweep exercises the tooSmall drill arm').toBeGreaterThan(0);
    expect(r.wallSeen, 'the sweep exercises the raster wall arm').toBeGreaterThan(0);
    expect(r.supGuardMax, 'the superset carries guards (tooSmall×2 + strategy×2 = 4)').toBeGreaterThanOrEqual(4);
    expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    expect(r.goldenDiffs, 'FLATTEN byte-identity: the flat pocketfill/pocketwall leaves == the pre-E0 stepover+contour golden (byte-diff ZERO)').toBe(0);
    expect(r.gateDiffs, 'E0 GATE: prune(superset) is BYTE-IDENTICAL to concrete pocketStack for ALL 96 combos (byte-diff ZERO)').toBe(0);
});

test('E0 self-consistency: superset:false IS the default concrete path (byte-identical)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const P = { shape: 'rect', strategy: 'raster', w: 80, h: 60 };
        return { dflt: emitMapped(pocketStack(P)).text, sup0: emitMapped(pocketStack(P, { superset: false })).text };
    });
    expect(r.sup0, 'superset:false === the default concrete path').toBe(r.dflt);
});
