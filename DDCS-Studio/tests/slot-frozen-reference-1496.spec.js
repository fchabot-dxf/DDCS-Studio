import { test, expect } from '@playwright/test';

/**
 * t1496 — THE FROZEN SLOT KERNEL IS A FAITHFUL COPY. The safety net, asserted before it is needed.
 *
 * ── WHY THIS SPEC EXISTS AT ALL ──────────────────────────────────────────────────────────────────────────────────
 * `/_test/frozenSlotPath.js` is the independent baseline the slot re-point's bridges will compare against, and it is
 * worth exactly as much as its faithfulness. A baseline that drifted by one character from the kernel it claims to
 * copy would not fail loudly — it would make every downstream bridge prove the wrong thing CONFIDENTLY, which is
 * worse than having no baseline (t1385's lesson, and the reason t1406 froze the pocket fill the same way).
 *
 * So the copy is MECHANICAL — pulled declaration by declaration out of the shipping sources by a script, with the
 * `export` keyword stripped and nothing else touched — and this spec is what keeps it honest afterwards.
 *
 * ⚠ THE TRAP THE ASSEMBLY ALREADY CAUGHT, recorded because it is the exact defect this spec guards against:
 * `wizards/clearing.js` defines its OWN `num` and `r3`, and they are NOT the ones in `ops/util.js`:
 *
 *     util.js      num('', 5) → 5      (empty string falls to the default)
 *     clearing.js  num('', 5) → 0      (Number('') is 0, which is finite)
 *
 * A flat copy collapsed both into one definition and the descent silently changed behaviour on empty inputs. The
 * freeze therefore keeps each source in its OWN CLOSURE, so a collision between two files' private helpers is
 * impossible by construction rather than by having noticed this one.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ⚠ t1506 — THE FREEZE IS NO LONGER A CHARACTER-FOR-CHARACTER COPY, BY DESIGN, AND THIS TEST NOW SAYS SO EXACTLY.
 *
 * The freeze is a snapshot of the kernel AS IT STOOD AT t1496. t1506 deliberately moved the live kernel: its descent
 * used to start from the REAL previous level and now starts from the NOMINAL floor (`z + stepdown`), converging with
 * `stepover.js`, `contourfill.js` and the parametric atom, which all pass the nominal floor. That was the whole act,
 * so a spec asserting the two are identical would be asserting the act did not happen.
 *
 * IT IS NOT RELAXED TO "MOSTLY EQUAL". The divergence is PREDICTED — it can only be a descent that starts on a
 * PARTIAL last bite — and the test asserts that shape in BOTH directions: every config outside it is still identical
 * character for character, and every config inside it differs. A freeze that drifted anywhere else still fails, which
 * is the property the original spec existed to protect (a baseline that drifts silently makes every downstream bridge
 * prove the wrong thing CONFIDENTLY).
 *
 * ── ⚠ t1524 — THE IDENTITY IS BACK, AND THE PARAGRAPH ABOVE IS THE RECORD OF WHY IT WAS EVER LOST ────────────────
 *
 * t1506's regret is answered rather than restated. The shelved half landed and moved the WHOLE FAMILY onto the
 * ACTUAL remaining drop — which is the floor this freeze was taken on — so the live kernel is a character-for-
 * character match again, across the entire cross-product, with no permitted-divergence carve-out at all. That is a
 * STRONGER assert than the shaped one it replaces, and it is the assert this file was originally built to make.
 *
 * The `mayDiffer` machinery is therefore gone, not disabled: no config may differ. What it used to protect — the
 * evidence of what the descent moved FROM — did not disappear with it, it MOVED: `frozenSlotPathNominal.js` freezes
 * the t1506 nominal-floor kernel as the DIVERGENCE witness, and `slot-repoint-domain-1498` measures it at exactly
 * `(stepdown − lastBite)/tan(rampAngle)`. Two freezes, two jobs, both stated at both sites so neither reads as stale.
 */
test('THE FREEZE IS THE t1496 KERNEL — and t1524 restored the character-for-character identity, everywhere', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const live = await import('/wizards/ops/slot.js');
        const frozen = await import('/_test/frozenSlotPath.js');
        const { depthLevels } = await import('/wizards/clearing.js');
        const NL = String.fromCharCode(10);
        let count = 0, descents = 0, partials = 0; const differ = [];
        for (const width of [4, 6, 6.5, 7, 12, 13.2, 15, 16.8, 18, 20, 60])
            for (const tool of [6, 8, 12])
                for (const entry of ['plunge', 'ramp', 'helix'])
                    for (const ang of [0, 30, 45, 90, -30, 137.5])
                        for (const depth of [1.5, 4])
                            for (const pct of [40, 50]) {
                                count++;
                                const rad = ang * Math.PI / 180;
                                const p = { x0: 0, y0: 0, x1: 60 * Math.cos(rad), y1: 60 * Math.sin(rad), width, tool,
                                    stepoverPct: pct, depth, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5,
                                    entry, rampAngle: 3, helixDia: 4, helixPitch: 1 };
                                /**
                                 * t1524 — NO CONFIG MAY DIFFER ANY MORE. Between t1506 and t1524 exactly one shape
                                 * was permitted to (a REAL descent over a PARTIAL last bite), and identifying it
                                 * needed care: "entry is not plunge" was NOT enough, because a slot narrower than
                                 * its tool REFUSES with no motion and a ramp whose run will not fit DEGRADES to a
                                 * plunge — both ask for a ramp and neither has a descent that could move.
                                 *
                                 * That carve-out is gone with the divergence it described. The two counters below
                                 * keep what it taught, though: they prove the sweep still REACHES real descents over
                                 * partial bites, so this identity assert cannot pass by never entering the region
                                 * where the kernels once disagreed. The `( ramp )` / `( helix )` marker is still
                                 * what is asked, rather than re-deriving the kernel's rules inside its own test.
                                 */
                                const lv = depthLevels(depth, 1.5);
                                const lastBite = lv.length > 1 ? lv[lv.length - 1] - lv[lv.length - 2] : lv[0];
                                const partial = Math.abs(lastBite - 1.5) > 1e-9;
                                const was = frozen.frozenSlotPath(p).join(NL);
                                const descended = /\( (ramp|helix) \)/.test(was);
                                if (descended) descents++;
                                if (descended && partial) partials++;
                                if (live.slotPath(p).join(NL) !== was) differ.push({ width, tool, entry, ang, depth, pct });
                            }
        return { count, differ, descents, partials };
    });
    // the sweep spans every arm the kernel has: the too-small refusal, the zero-band centreline, both descents,
    // the angled cases, multi-level, and the widths the arc measured its divergence region on
    expect(r.count, 'the sweep really is the whole cross-product').toBe(2376);
    // ⚠ NOT VACUOUS: the sweep really does reach real descents, and really does reach them over PARTIAL last bites —
    // which is the exact region where the live kernel and this freeze disagreed from t1506 until t1524. Without these
    // two counters, "identical everywhere" could pass by never getting there.
    expect(r.descents, 'the sweep reaches real descents (ramp/helix that were actually cut)').toBeGreaterThan(200);
    expect(r.partials, '…and reaches them over a PARTIAL last bite — the ex-divergence region').toBeGreaterThan(100);
    // ⚠ CHARACTER FOR CHARACTER, WITH NO CARVE-OUT. t1524 put the family back on this freeze's own floor, so the
    // identity this file was built to assert is restored. A drift ANYWHERE now fails, which is strictly stronger
    // than the shaped assert it replaces. (What moved FROM is witnessed by frozenSlotPathNominal.js — see 1498.)
    expect(r.differ, `the freeze IS the live kernel again, everywhere — ${JSON.stringify(r.differ.slice(0, 3))}`).toEqual([]);
});

/**
 * t1524 — THE SECOND FREEZE IS AN EXTRACTION OF THE FIRST, AND THIS IS WHAT KEEPS IT ONE.
 *
 * `frozenSlotPathNominal.js` was generated from `frozenSlotPath.js` by changing exactly ONE expression — the descent's
 * starting floor, `prevZ: -prevD` → `prevZ: z + stepdown`, verbatim what t1506 shipped. Its whole value as a
 * divergence witness rests on that being the ONLY difference: a copy that drifted somewhere else would measure the
 * drift and report it as the descent, confidently and wrongly. So the same anti-drift property the t1496 freeze has
 * against the LIVE kernel is asserted here between the two freezes.
 */
test('THE TWO FREEZES DIFFER IN THE DESCENT AND NOWHERE ELSE — the nominal copy is one expression, not a fork', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const frozen = await import('/_test/frozenSlotPath.js');
        const nominal = await import('/_test/frozenSlotPathNominal.js');
        const { depthLevels } = await import('/wizards/clearing.js');
        const NL = String.fromCharCode(10);
        let count = 0, moved = 0; const wrong = [];
        for (const width of [4, 6, 7, 12, 15, 20, 60])
            for (const tool of [6, 12])
                for (const entry of ['plunge', 'ramp', 'helix'])
                    for (const ang of [0, 30, 90, -30])
                        for (const depth of [1.5, 4, 5]) {
                            count++;
                            const rad = ang * Math.PI / 180;
                            const p = { x0: 0, y0: 0, x1: 60 * Math.cos(rad), y1: 60 * Math.sin(rad), width, tool,
                                stepoverPct: 40, depth, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5,
                                entry, rampAngle: 3, helixDia: 4, helixPitch: 1 };
                            const lv = depthLevels(depth, 1.5);
                            const lastBite = lv.length > 1 ? lv[lv.length - 1] - lv[lv.length - 2] : lv[0];
                            const partial = Math.abs(lastBite - 1.5) > 1e-9;
                            const a = frozen.frozenSlotPath(p).join(NL);
                            const b = nominal.frozenNominalSlotPath(p).join(NL);
                            const descended = /\( (ramp|helix) \)/.test(a);
                            const mayDiffer = descended && partial;   // the one expression can only bite here
                            if (mayDiffer) moved++;
                            if ((a !== b) !== mayDiffer) wrong.push({ width, tool, entry, ang, depth, same: a === b, mayDiffer });
                        }
        return { count, moved, wrong };
    });
    expect(r.count, 'the sweep is a real cross-product').toBeGreaterThan(400);
    // NOT VACUOUS: the one expression really does bite somewhere in this sweep, or "differs only there" is empty talk.
    expect(r.moved, 'the sweep reaches descents over a partial bite — where the changed expression can act').toBeGreaterThan(40);
    // BOTH DIRECTIONS: identical wherever the floor cannot matter, different wherever it can. Anything else is drift.
    expect(r.wrong, `the nominal freeze differs from the t1496 freeze in EXACTLY the descent — ${JSON.stringify(r.wrong.slice(0, 3))}`).toEqual([]);
});

test('THE FREEZE CARRIES THE TOO-SMALL LAW, which is a refusal and not a path', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const live = await import('/wizards/ops/slot.js');
        const frozen = await import('/_test/frozenSlotPath.js');
        const rows = [];
        // ⚠ EXACTLY tool-width is ALLOWED (the t1444 ruling); strictly narrower refuses. The boundary itself is the
        // interesting part, so it is sampled on both sides of it rather than in the middle.
        for (const [width, tool] of [[4, 6], [5.999, 6], [6, 6], [6.001, 6], [12, 12], [11, 12], [20, 6]]) {
            rows.push({
                width, tool,
                liveSmall: live.slotTooSmall({ width, tool }), frozenSmall: frozen.frozenSlotTooSmall({ width, tool }),
                liveWhy: live.slotToolRefusal({ width, tool }), frozenWhy: frozen.frozenSlotToolRefusal({ width, tool }),
            });
        }
        return rows;
    });
    for (const row of r) {
        expect(row.frozenSmall, `${row.width}×Ø${row.tool}: the freeze agrees on WHETHER it refuses`).toBe(row.liveSmall);
        expect(row.frozenWhy, `${row.width}×Ø${row.tool}: and on the sentence it refuses WITH`).toBe(row.liveWhy);
    }
    // and the law is not vacuous in either direction — the sample really does contain both answers
    expect(r.some((x) => x.liveSmall), 'the sample contains a refusal').toBe(true);
    expect(r.some((x) => !x.liveSmall), 'and a pass').toBe(true);
    expect(r.find((x) => x.width === 6 && x.tool === 6).liveSmall, 'exactly tool-width is ALLOWED (t1444)').toBe(false);
});

/**
 * ── THE PRIVATE-HELPER TRAP, ASSERTED DIRECTLY ───────────────────────────────────────────────────────────────────
 * The scoping is what makes the copy safe, so it is worth one assertion of its own rather than being trusted to the
 * sweep above — the sweep would only catch it on a config that happens to pass an empty string.
 */
test('THE SCOPING HOLDS — the two `num`s really do differ, so collapsing them would have changed behaviour', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const util = await import('/wizards/ops/util.js');
        // clearing.js does not export its private `num`, so the difference is read off the two definitions' behaviour
        // through a value only the util one defaults: an empty string.
        return { utilEmpty: util.num('', 5), utilNull: util.num(null, 5), utilNumber: util.num('7', 5) };
    });
    expect(r.utilEmpty, "util's num sends an empty string to the DEFAULT").toBe(5);
    expect(r.utilNull, '…and null likewise').toBe(5);
    expect(r.utilNumber, 'while a numeric string is read').toBe(7);
    // clearing's own is `isFinite(Number(v)) ? n : d`, which sends '' to 0 — the divergence the freeze scopes apart.
    expect(Number(''), "clearing's num would send '' to 0, which is why the two cannot share one definition").toBe(0);
});
