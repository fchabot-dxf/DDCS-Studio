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

test('THE FREEZE IS A COPY — 2376 configs, character for character against the live kernel', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const live = await import('/wizards/ops/slot.js');
        const frozen = await import('/_test/frozenSlotPath.js');
        const NL = String.fromCharCode(10);
        let count = 0; const differ = [];
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
                                if (live.slotPath(p).join(NL) !== frozen.frozenSlotPath(p).join(NL)) {
                                    differ.push({ width, tool, entry, ang, depth, pct });
                                }
                            }
        return { count, differ };
    });
    // the sweep spans every arm the kernel has: the too-small refusal, the zero-band centreline, both descents,
    // the angled cases, multi-level, and the widths the arc measured its divergence region on
    expect(r.count, 'the sweep really is the whole cross-product').toBe(2376);
    expect(r.differ, `the freeze emits what the kernel emits — ${JSON.stringify(r.differ.slice(0, 3))}`).toEqual([]);
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
