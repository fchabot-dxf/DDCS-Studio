import { test, expect } from '@playwright/test';

/**
 * t1570 — THE NO-VANISH INVARIANT: every non-hidden block in the registry is reachable in the palette.
 *
 * The failure mode this guards is the t1562 shape one layer up: regroup the palette by a field, and every block
 * that LACKS the field silently disappears — still in `BLOCKS`, still emittable, draggable from nowhere. It is
 * invisible precisely because a missing block renders as nothing at all.
 *
 * `buildToolbox` used to end at `CATEGORIES.filter((c) => byCat[c])`, which iterates the declared category LIST:
 * any def whose `category` was not in that list was dropped on the floor. Nothing triggered it at the time this
 * was written (133 visible → 133 reachable), which is exactly why it would have gone unnoticed the first time a
 * regroup landed — the bug ships with the reorganisation, not before it.
 *
 * ASSERTS THE SET, NOT THE COUNT (the dispatch's wording, and it matters: a count survives a swap of one block
 * for another). And the third case below is the durable half — it uses a SYNTHETIC def with a category no one has
 * declared, so it keeps failing for a FUTURE block added without a listed category, not merely for today's set.
 */
test('every non-hidden block is reachable in the palette — by SET, and for future blocks too', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const OPS = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');

        const reachableOf = (tb) => {
            const out = new Set();
            (function walk(node) {
                if (!node) return;
                if (Array.isArray(node)) return node.forEach(walk);
                if (node.kind === 'block' && node.type) out.add(node.type);
                if (node.contents) walk(node.contents);
            })(tb.contents);
            return out;
        };

        const visible = OPS.PALETTE.filter((d) => !d.hidden).map((d) => d.type);
        const reachable = reachableOf(BR.buildToolbox([]));

        // A block that DECLARES a category nobody listed — the future-proofing case. Pushed onto the live PALETTE
        // array, then removed, so it never leaks into another assertion in this page session.
        const SYNTH = { type: '__synthetic_unlisted__', label: 'synthetic', category: '__not_a_declared_category__', kind: 'leaf', defaults: {}, fields: [], emit: () => [] };
        OPS.PALETTE.push(SYNTH);
        let synthReachable = false, synthGroup = null;
        try {
            const tb2 = BR.buildToolbox([]);
            synthReachable = reachableOf(tb2).has(SYNTH.type);
            (function find(node, parent) {
                if (!node) return;
                if (Array.isArray(node)) return node.forEach((n) => find(n, parent));
                if (node.kind === 'block' && node.type === SYNTH.type) synthGroup = parent;
                if (node.contents) find(node.contents, node.name || parent);
            })(tb2.contents, null);
        } finally {
            OPS.PALETTE.splice(OPS.PALETTE.indexOf(SYNTH), 1);
        }

        return {
            visible: visible.sort(),
            reachable: [...reachable].sort(),
            missing: visible.filter((t) => !reachable.has(t)),
            extra: [...reachable].filter((t) => !visible.includes(t)),
            hidden: OPS.PALETTE.filter((d) => d.hidden).map((d) => d.type),
            hiddenLeaked: OPS.PALETTE.filter((d) => d.hidden).map((d) => d.type).filter((t) => reachable.has(t)),
            synthReachable,
            synthGroup,
            uncategorised: BR.UNCATEGORISED,
        };
    });

    // ① THE SET, both directions — nothing vanished, and nothing appeared that should not have.
    expect(r.missing, 'every non-hidden block must be reachable in the palette — if this fails, a regroup dropped blocks').toEqual([]);
    expect(r.extra, 'and the palette must not offer a block the registry does not expose').toEqual([]);
    expect(r.reachable, 'the reachable SET is exactly the visible set (asserted as a set, not a count)').toEqual(r.visible);

    // ② `hidden` still means hidden — the catch-all must not resurrect a deliberately-hidden atom.
    expect(r.hiddenLeaked, 'a hidden def stays out of the toolbox').toEqual([]);

    // ③ THE DURABLE HALF — a block whose category nobody declared still lands somewhere VISIBLE.
    expect(r.synthReachable, 'a block with an UNLISTED category must never be filtered out for lacking the field').toBe(true);
    expect(r.synthGroup, 'and it lands in the declared catch-all group, where it is obviously wrong to a human').toBe(r.uncategorised);
});
