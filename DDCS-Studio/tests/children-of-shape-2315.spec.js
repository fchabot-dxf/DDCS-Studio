import { test, expect } from '@playwright/test';

/**
 * t2315 — closes the third dormant bug t2313 found: `flattenBlocks` (userOps.js) assumed a node's
 * `children`/`uiChildren` was always an ARRAY (`for (const b of (blocks || []))`), but the declared
 * vocabulary genuinely permits an OBJECT shape too — Blockly-round-tripped multi-mouth blocks (`split_
 * horizontal`/`split_vertical`'s own LEFT/RIGHT or TOP/BOTTOM keys, `tab_group`'s TABS, a single-mouth
 * container's DO) — and `for...of` on a plain object throws. `formWidgets.js`'s own `traverse` already
 * normalized this per node-type (independently, several times over); `userOpView.js`'s `hasTreeLayout` had
 * its own THIRD, independent variant; `flattenBlocks` had none. Declared ONCE now: `childrenOf` (userOps.js),
 * imported by both.
 *
 * The hazard: `flattenBlocks`'s output order determines `blockIndex`, which every twin's bindings depend on.
 * `childrenOf` is IDENTITY for array input (same reference, same order) — proven across all 32 shipped
 * twins' own `flattenBlocks(def.template)` output, byte-identical before/after (scratchpad script, not
 * kept). This file pins the underlying claim directly instead of only asserting it indirectly through the
 * existing per-twin wiring specs.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

test('childrenOf: array input passes through unchanged (identity — the byte-identical-order guarantee)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { childrenOf } = await import('/blocks/userOps.js');
        const arr = [{ type: 'a' }, { type: 'b' }];
        const out = childrenOf(arr);
        return { sameRef: out === arr, types: out.map((x) => x.type) };
    });
    expect(r.sameRef, 'the exact same array reference comes back — no copy, no reorder').toBe(true);
    expect(r.types).toEqual(['a', 'b']);
});

test('childrenOf: null/undefined/empty all normalize to []', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { childrenOf } = await import('/blocks/userOps.js');
        return { n: childrenOf(null), u: childrenOf(undefined), e: childrenOf([]) };
    });
    expect(r.n).toEqual([]);
    expect(r.u).toEqual([]);
    expect(r.e).toEqual([]);
});

test('childrenOf: an object shape (mouth-keyed) flattens every array-valued key, in key order', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { childrenOf } = await import('/blocks/userOps.js');
        const obj = { LEFT: [{ type: 'controls' }], RIGHT: [{ type: 'visual' }] };
        return childrenOf(obj).map((x) => x.type);
    });
    expect(r).toEqual(['controls', 'visual']);
});

test('flattenBlocks: no longer throws on a split_horizontal node\'s object-shaped children (the t2313 crash)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const tree = [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{ type: 'param_group', params: { group: 'X' }, children: [{ type: 'field_ref', params: { param: 'a' } }] }],
                RIGHT: [{ type: 'sim', params: {} }],
            },
        }];
        try {
            return { ok: true, types: flattenBlocks(tree).map((b) => b.type) };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });
    expect(r.ok, `flattenBlocks did not throw: ${r.error || ''}`).toBe(true);
    expect(r.types).toEqual(['split_horizontal', 'param_group', 'field_ref', 'sim']);
});

test('childrenOf reproduces hasTreeLayout\'s OLD inline formula exactly, across every shape it must handle', async ({ page }) => {
    // hasTreeLayout (userOpView.js) is module-private — not exported, and driving it end-to-end means either
    // exporting it (an API change this turn doesn't need) or rendering a real op with a split node through
    // the full UI (which t2313's own live gate-check already did, before drillData.js was reverted). Instead
    // of re-deriving that here, this proves the REFACTOR itself is behavior-preserving: childrenOf produces
    // EXACTLY what hasTreeLayout's own old inline ternary (`Array.isArray(nodes) ? nodes :
    // (typeof nodes === 'object' ? Object.values(nodes).flat() : [])`) would have, for every input shape that
    // formula was ever asked to handle — so replacing the inline formula with the shared call changes nothing
    // observable at that call site.
    await boot(page);
    const r = await page.evaluate(async () => {
        const { childrenOf } = await import('/blocks/userOps.js');
        const oldFormula = (nodes) => {
            if (!nodes) return [];
            return Array.isArray(nodes) ? nodes : (typeof nodes === 'object' ? Object.values(nodes).flat() : []);
        };
        const cases = [
            [{ type: 'a' }, { type: 'b' }],
            { LEFT: [{ type: 'c' }], RIGHT: [{ type: 'd' }] },
            null,
            undefined,
            [],
            {},
        ];
        return cases.map((c) => ({ old: oldFormula(c), now: childrenOf(c) }));
    });
    for (const { old, now } of r) expect(now).toEqual(old);
});
