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
        const { pocketStack, pocketTooSmall, pocketRidesRaster, pocketToolRefuses } = await import('/wizards/pocketWizard.js');
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
        let refusedSeen = 0, refusalMissing = 0, refusalHadMotion = 0; const refusedKeys = [];   // t1444 — the ruled exemption, counted
        let firstGolden = null, firstGate = null, hasFillLeaf = false, hasWallLeaf = false;
        const workOnlyKeys = [], workDeltas = [], markerCases = [];   // t1528 — cases differing ONLY in the @work token, and by how much
        for (const shape of SHAPES) for (const strategy of STRAT) for (const sz of Object.keys(SIZES)) for (let si = 0; si < SCALARS.length; si++) {
            const p = { shape, strategy, ...SIZES[sz], ...SCALARS[si] };
            const key = `${shape}|${strategy}|${sz}|${si}`;
            cases++;
            if (golden[key] && /@work \d+/.test(golden[key].emit || '')) markerCases.push(key);   // t1528 — the movable population
            const concreteStack = pocketStack(p, { superset: false });
            const concrete = emitMapped(concreteStack).text;
            if (JSON.stringify(concreteStack).includes('"type":"pocketfill"')) hasFillLeaf = true;
            if (JSON.stringify(concreteStack).includes('"type":"pocketwall"')) hasWallLeaf = true;
            // (1) FLATTEN byte-identity — concrete (flat leaves) == the pre-E0 golden (stepover+contour region socket)
            //
            // t1444 — THE REFUSING CASES ARE EXEMPTED BY NAME, AND THE GOLDEN IS NOT REGENERATED. The user's ruling
            // deliberately changed what a pocket STRICTLY SMALLER than its tool emits (a confident centre plunge that
            // made an oversize hole → a refusal with no motion), so those entries cannot match a capture taken before
            // the ruling. Re-capturing the golden would have been the easy move and it would have destroyed the very
            // thing the golden is for: a frozen reference that gets refreshed whenever it disagrees proves nothing.
            // So each refusing case asserts the NEW contract instead, the exempt set is counted, and every entry
            // outside it still faces the untouched golden — which is what makes "only the ruled cases moved" a
            // measurement rather than a claim.
            if (pocketToolRefuses(p)) {
                refusedSeen++;
                if (!/#1505=1/.test(concrete)) refusalMissing++;                    // it must actually refuse…
                if (/G1 [XY]/.test(concrete)) refusalHadMotion++;                   // …and cut NOTHING
                if (!refusedKeys.includes(key)) refusedKeys.push(key);
            }
            /**
             * ── t1528 — THE @work TOKEN MOVED, AND THE GOLDEN IS STILL NOT REGENERATED ───────────────────────────
             *
             * `surfaceRasterWorkSteps` was under-declaring an insetted body by four executed statements (t1404's two
             * span guards plus the GOTO/label pair that carries the good path past their refusal) — the TRUNCATING
             * direction. A pocket's clearing IS that atom with the tool radius as its inset, so closing it moves the
             * declared-work token in this sweep's header comment. Nothing else about the emit changed: not a
             * coordinate, not a register, not a line count.
             *
             * The easy move would be to re-capture the golden, and the paragraph above says why that is the wrong
             * one. The move that keeps the golden's value is to say EXACTLY what may differ: a case is allowed to
             * differ ONLY in the `@work` number and ONLY upward by the declared machinery — everything else still
             * faces the untouched pre-E0 capture. That is strictly stronger than a regenerated fixture, which would
             * silently accept any future change to those same lines.
             */
            else if (golden[key] && concrete !== golden[key].emit) {
                const A = concrete.split('\n'), B = golden[key].emit.split('\n');
                const strip = (s) => String(s).replace(/@work \d+/, '@work N');
                const onlyWork = A.length === B.length
                    && A.every((l, i) => l === B[i] || (/@work \d+/.test(l) && /@work \d+/.test(B[i]) && strip(l) === strip(B[i])));
                if (onlyWork) {
                    workOnlyKeys.push(key);
                    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) {
                        const now = Number((A[i].match(/@work (\d+)/) || [])[1]), was = Number((B[i].match(/@work (\d+)/) || [])[1]);
                        workDeltas.push(now - was);
                    }
                } else { goldenDiffs++; if (!firstGolden) firstGolden = { key, a: concrete.slice(0, 1400), b: golden[key].emit.slice(0, 1400) }; }
            }
            // (2) E0 GATE — prune(superset) == concrete
            const sup = pocketStack(p, { superset: true });
            supGuardMax = Math.max(supGuardMax, (JSON.stringify(sup).match(/"type":"guard"/g) || []).length);
            // t1406 — EVERY derived guard key is injected EXPLICITLY, including the ones whose absence used to give the
            // right answer by accident. `_rest` was never passed and read as undefined, which happened to falsify its
            // `is:true` guard; `_para` has BOTH polarities in the superset, so an undefined value would falsify both and
            // prune the clearing away entirely. Stating them is what makes this gate a test of prune rather than of luck.
            // t1444 — `_refuse` joins them, and it is the third instance of the very hazard the note above describes:
            // the refusal fork carries BOTH polarities, so leaving it undefined prunes the ENTIRE body away. Added in
            // the act that adds the fork, because a guard key invented without its canonical value is a silent hole.
            pruneGuards(sup, { ...p, _refuse: pocketToolRefuses(p), _tooSmall: pocketTooSmall(p), _rest: false, _para: pocketRidesRaster(p) });
            if (JSON.stringify(sup).includes('"type":"guard"')) leftoverGuards++;
            const pruned = emitMapped(sup).text;
            if (pruned !== concrete) { gateDiffs++; if (!firstGate) firstGate = { key, a: pruned.slice(0, 1400), b: concrete.slice(0, 1400) }; }
            if (pocketTooSmall(p)) tooSmallSeen++;
            if (strategy === 'raster' && !pocketTooSmall(p)) wallSeen++;
        }
        return { goldenDiffs, gateDiffs, leftoverGuards, supGuardMax, tooSmallSeen, wallSeen, cases, firstGolden, firstGate, hasFillLeaf, hasWallLeaf, refusedSeen, refusalMissing, refusalHadMotion, refusedKeys, workOnlyKeys, workDeltas, markerCases };
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
    // ── t1444 — THE RULED EXEMPTION, MEASURED IN BOTH DIRECTIONS ──────────────────────────────────────────────────
    console.log('POCKET E0 t1444 refusals: ' + r.refusedSeen + ' :: ' + JSON.stringify(r.refusedKeys));
    expect(r.refusedSeen, 'the sweep really does contain pockets smaller than their tool (the `tiny` sizes)').toBeGreaterThan(0);
    expect(r.refusalMissing, 'every one of them EMITS the refusal').toBe(0);
    expect(r.refusalHadMotion, '…and none of them cuts anything — the whole point of the ruling').toBe(0);
    // and the exemption cannot creep: only `tiny` pockets are small enough to refuse, so a NORMAL one appearing here
    // would mean the boundary had moved, which is exactly the drift a named exemption exists to catch.
    expect(r.refusedKeys.filter((k) => !k.includes('|tiny|')), 'ONLY the tiny pockets are exempt — nothing else moved').toEqual([]);
    expect(r.wallSeen, 'the sweep exercises the raster wall arm').toBeGreaterThan(0);
    expect(r.supGuardMax, 'the superset carries guards (tooSmall×2 + strategy×2 = 4)').toBeGreaterThanOrEqual(4);
    expect(r.leftoverGuards, 'prune leaves ZERO guard blocks (fully collapsed to the concrete shape)').toBe(0);
    expect(r.goldenDiffs, 'FLATTEN byte-identity: every NON-exempt case still matches the untouched pre-E0 golden (byte-diff ZERO)').toBe(0);
    // ── t1528 — THE @work MOVE, MEASURED IN BOTH DIRECTIONS (see the note at the comparison) ─────────────────────
    console.log('POCKET E0 t1528 @work-only moves: ' + r.workOnlyKeys.length + ' :: ' + JSON.stringify(r.workDeltas));
    expect(r.workOnlyKeys.length, 'the closed under-declaration really does move this sweep — an inset is what a pocket IS').toBe(14);
    expect([...new Set(r.workDeltas)], 'and every one moves by EXACTLY the inset machinery, upward — a declaration that was 4 short').toEqual([4]);
    /**
     * ⚠ AND THE SCOPE IS ASSERTED AGAINST THE **GOLDEN ITSELF**, not against an arm name. My first cut claimed "only
     * the spiral arm moves" — inferred from the first few keys printed rather than from the set, and 9 of the 14 are
     * not spiral. The rule that actually governs is mechanical and checkable: a case can only move if its captured
     * emit CARRIES an @work token at all (a body with a live area/inset omits the marker, so it has nothing to
     * move), and it must move if it also declares a non-zero inset. Stated that way it needs no knowledge of which
     * wizard arm reaches the atom, which is what made the first version wrong.
     */
    expect(r.workOnlyKeys.filter((k) => !/@work \d+/.test((GOLDEN[k] || {}).emit || '')),
        'every moved case had an @work token to move — nothing moved that declares no work').toEqual([]);
    expect(r.markerCases.filter((k) => !r.workOnlyKeys.includes(k)).length,
        'and the ones that did NOT move are exactly the insetless bodies — the term belongs to the INSET, not a blanket').toBe(r.markerCases.length - 14);
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
