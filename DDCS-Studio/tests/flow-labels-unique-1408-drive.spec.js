import { test, expect } from '@playwright/test';

/**
 * t1408 — EVERY `N` IN A PROGRAM IS UNIQUE, AND THE PROOF IS THAT BOTH OPS RUN.
 *
 * TIER MIGRATION (batch 12): the pure "THE DIRECT BODY IS UNMOVED" test moved to
 * tests/node/flow-labels-unique-1408.test.mjs — see that file's own header for why. Every test below calls a
 * real app-boot global (`window.openWiz`/`insertWiz`/`updateWiz`/`ddcsSerializeWithMarkers`/etc, published
 * only by the real app.js boot sequence) and stays here.
 *
 * ── THE DEFECT, MEASURED IN RELEASED CODE ─────────────────────────────────────────────────────────────────────────
 * `surfaceraster` wrote its flow labels as literals — 91/92 for the refusal, 13-18 / 21-22 / 31 / 41-42 / 51-52 for
 * the walks and descents. Safe for exactly one such body per program; a program can hold two. A DRILL op beside a
 * SURFACING op (both shipped, both parametric for weeks, no pocket involved) emitted `N91`/`N92` TWICE — `holecycle`
 * takes 91/92 from the emitter's counter and this body wrote its own — and the SECOND body was then skipped whole.
 * Per-op time before the fix: drill 3.9s, surfacing **0**.
 *
 * ── WHY IT SURFACED HERE AND NOT AT t1381 ─────────────────────────────────────────────────────────────────────────
 * t1379 measured this EXACT failure one atom earlier (two hole ops; every hole after the first silently undrilled)
 * and t1381 built the answer: an atom DECLARES the labels it needs, the emitter assigns them uniquely per program.
 * `holecycle` declared. `surfaceraster` never did — and nothing exercised two of its bodies in one program until the
 * pocket's rect clearing re-pointed through it (t1406), which is how a defect that was always there became ordinary.
 *
 * ── WHAT THIS FILE ASSERTS, and why the last one matters most ─────────────────────────────────────────────────────
 * Not "the labels look unique" — that would test the fix against itself. It asserts that BOTH OPS EXECUTE, measured
 * as per-op time through the app's own estimator, which is exactly the user-facing surface that went to zero.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const PAIRS = [
    { name: 'drill + surfacing — the pair that was broken in RELEASED code', ops: ['drill', 'surfacing'] },
    { name: 'surfacing + pocket — the pair the re-point made ordinary', ops: ['surfacing', 'pocket'] },
    { name: 'pocket + pocket — two bodies of the SAME atom', ops: ['pocket', 'pocket'] },
    { name: 'pocket + surfacing + drill — three label-bearing bodies', ops: ['pocket', 'surfacing', 'drill'] },
];

for (const cfg of PAIRS) {
    test(`EVERY OP RUNS — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async (types) => {
            // t1928 — a bar-gesture Insert REPLACES the program (t1916/t1918/t1920's own ruling), so N sequential
            // inserts can no longer produce an N-op program to test. Built via the SAME production import path a
            // real user gets from a multi-op .nc file: insert each op alone, export its own marked text, concatenate,
            // reimport — importMarkedNc's own groupConsecutiveOps wraps them into ONE multi_step op's own steps
            // (matching multi-op-import-1916.spec.js's own proven pattern), which is what this file's own claim —
            // "every op RUNS" — must now mean for a program to hold more than one operation at all.
            const parts = [];
            for (const t of types) {
                window.ddcsLoadBlockStack([]);
                window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
                parts.push(window.ddcsSerializeWithMarkers());
            }
            const progMod = await import('/blocks/programModel.js');
            const imported = progMod.importMarkedNc(parts.join('\n'));
            window.ddcsLoadBlockStack(imported);
            const { estimateProgram, secondsForLines } = await import('/engine/timeEstimate.js');
            const nc = window.ddcsGetBlockGcode();
            const est = estimateProgram(nc, { rapidRate: 6000 });
            const ops = progMod.flattenOps(window.ddcsGetBlockProgram() || []);
            const counts = {};
            for (const m of nc.matchAll(/(?:^|\s)N(\d+)\b/gm)) counts[m[1]] = (counts[m[1]] || 0) + 1;
            return {
                per: ops.map((op) => ({ t: op.opType, sec: secondsForLines(est.perLine, window.ddcsLinesForOp(op.id) || []) })),
                dupes: Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => 'N' + k),
                labels: Object.keys(counts).map(Number).sort((a, b) => a - b),
            };
        }, cfg.ops);

        // NO DUPLICATE LABEL — the mechanical claim…
        expect(r.dupes, `no label is written twice (labels: ${JSON.stringify(r.labels)})`).toEqual([]);
        // …AND THE ONE THAT MATTERS: every op actually executes. A skipped body reports zero seconds.
        expect(r.per.length, 'every op committed').toBe(cfg.ops.length);
        for (const o of r.per) expect(o.sec, `the ${o.t} op EXECUTES (a body skipped by a mis-bound GOTO reports 0)`).toBeGreaterThan(0);
    });
}

/**
 * MULTI-DIGIT LABELS ARE DEMONSTRATED, NOT ASSUMED. Three bodies push the counter past 99, and the question "does the
 * controller accept N100" is not one to answer by reasoning. The DDCS community corpus writes `N100`, `N101`, `N1000`
 * and `GOTO990`-`GOTO999`; the engine's own matcher is `GOTO\s*(\d+)`, width-agnostic. So this is inside demonstrated
 * form — recorded here because a number that grows past a boundary is exactly the kind of thing nobody re-checks.
 */
test('THE LABELS STAY INSIDE DEMONSTRATED FORM — plain integers, and the program still traces', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        // t1928 — see the "EVERY OP RUNS" tests above: build the 4-op program via the real import path, not
        // sequential inserts (which now replace, not accumulate).
        const parts = [];
        for (const t of ['pocket', 'surfacing', 'pocket', 'drill']) {
            window.ddcsLoadBlockStack([]);
            window.openWiz(t, undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
            parts.push(window.ddcsSerializeWithMarkers());
        }
        const progMod = await import('/blocks/programModel.js');
        window.ddcsLoadBlockStack(progMod.importMarkedNc(parts.join('\n')));
        const { traceToolpath } = await import('/engine/trace.js');
        const nc = window.ddcsGetBlockGcode();
        const labels = [...new Set([...nc.matchAll(/(?:^|\s)N(\d+)\b/gm)].map((m) => Number(m[1])))];
        const gotos = [...new Set([...nc.matchAll(/GOTO\s*(\d+)/g)].map((m) => Number(m[1])))];
        const t = traceToolpath(nc);
        return { labels: labels.sort((a, b) => a - b), unmatched: gotos.filter((g) => !labels.includes(g)), cuts: (t.segments || []).filter((s) => !s.rapid).length, capped: !!(t.stats && t.stats.capped) };
    });
    expect(r.labels.every((n) => Number.isInteger(n) && n > 0 && n < 10000), `plain integer labels: ${JSON.stringify(r.labels)}`).toBe(true);
    expect(r.unmatched, 'every GOTO has a label to land on').toEqual([]);
    expect(r.cuts, 'and the four-op program still cuts').toBeGreaterThan(100);
    expect(r.capped, 'without truncating the trace').toBe(false);
});
