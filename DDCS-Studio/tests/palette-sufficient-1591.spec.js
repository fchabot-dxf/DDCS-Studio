import { test, expect } from '@playwright/test';

/**
 * t1591 — THE SUFFICIENCY INVARIANT: every block type any registered wizard USES is reachable in the palette.
 *
 * `palette-no-block-vanishes-1570` asserts the reachable SET does not CHANGE — that a regroup cannot silently drop a
 * block out of the toolbox. This asserts something the SET invariant does not imply: that the set is SUFFICIENT.
 * Both could hold with the palette perfectly stable and still missing a block every wizard depends on, because 1570
 * compares the palette against the palette's own registry (`PALETTE`), never against what the wizards actually use.
 *
 * WHY IT MATTERS, concretely: a fork is programmatic, so it can copy a block the palette cannot offer. A REBUILD —
 * a human opening the palette and reassembling a wizard by hand — cannot. Sufficiency is what makes "the shipped
 * ops are a forkable default library" true for a person rather than only for code, which is the north star's whole
 * claim. A block that is emittable, present in stacks, and draggable from nowhere breaks that silently: the wizard
 * still works, and the user simply cannot rebuild it.
 *
 * DATA-DRIVEN over `SEED_BUILDERS` (the same registry the app boot-seeds from, read for opType strings only), never
 * a hand-typed list of block types — a parallel list here would drift the moment a wizard gained an atom, and would
 * then pass while the library was incomplete.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('every block type used by a registered wizard is reachable in the palette (sufficiency, not just stability)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram, undefined, { timeout: 20_000 });

    const r = await page.evaluate(async () => {
        const A = await import('/app.js');
        const U = await import('/blocks/userOps.js');
        const OPS = await import('/wizards/ops/index.js');
        const BR = await import('/blocks/blockly/bridge.js');

        const reachable = new Set();
        (function walk(node) {
            if (!node) return;
            if (Array.isArray(node)) return node.forEach(walk);
            if (node.kind === 'block' && node.type) reachable.add(node.type);
            if (node.contents) walk(node.contents);
        })(BR.buildToolbox([]).contents);

        // STRUCTURAL, never draggable by anyone: Blockly's own shadow primitives (they arrive inside a socket) and
        // the `op` container itself (a bridge-level wrapper — `makeOpDef('op','op')` — minted by PLACING a wizard,
        // not by dragging one). Declared here rather than silently skipped, so the exclusion is auditable.
        const STRUCTURAL = new Set(['math_number', 'text', 'logic_boolean', 'op']);
        // A def that DECLARES `hidden` is deliberately out of the palette. That is a real rebuild gap when a shipped
        // wizard depends on it, but it is an OWNED one — so it is pinned below rather than reported as a surprise.
        const hidden = new Set(OPS.PALETTE.filter((d) => d.hidden).map((d) => d.type));

        const perWizard = [];
        const loadBearingHidden = new Map();
        for (const fn of A.SEED_BUILDERS) {
            const opType = fn().opType;
            const def = U.listUserOps().find((d) => d.opType === opType);
            if (!def) { perWizard.push({ opType, error: 'not found in the boot-seeded registry' }); continue; }
            const used = new Set();
            for (const b of U.flattenBlocks(def.template || [])) if (b && b.type) used.add(b.type);
            const missing = [...used].filter((t) => !reachable.has(t) && !STRUCTURAL.has(t));
            for (const t of missing.filter((x) => hidden.has(x))) loadBearingHidden.set(t, [...(loadBearingHidden.get(t) || []), opType]);
            perWizard.push({ opType, used: used.size, unreachable: missing.filter((t) => !hidden.has(t)) });
        }
        return {
            perWizard,
            reachableCount: reachable.size,
            paletteCount: OPS.PALETTE.filter((d) => !d.hidden).length,
            loadBearingHidden: [...loadBearingHidden.entries()].map(([t, ops]) => `${t} (${ops.length}: ${ops.join(', ')})`).sort(),
        };
    });

    const problems = r.perWizard.filter((w) => w.error);
    expect(problems, 'every twin in the registry must actually be boot-seeded').toEqual([]);
    expect(r.perWizard.length, 'the full registry, not a subset').toBe(32);

    // ① THE TRIPWIRE — a wizard must never depend on a block that is unreachable for NO DECLARED REASON. This is the
    // t1570 shape one layer up: emittable, present in stacks, draggable from nowhere, and nobody chose it.
    const withUnreachable = r.perWizard.filter((w) => w.unreachable.length > 0);
    expect(withUnreachable, 'every block a shipped wizard is built from must be draggable out of the palette (or declare `hidden`) — if this fails, that wizard can be forked programmatically but NOT rebuilt by a human, and the "forkable default library" claim is false for exactly those blocks').toEqual([]);

    // ② PIN THE OWNED GAP. These three are `hidden: true` BY CHOICE and with recorded reasoning — safetraverse's is
    // explicitly temporary ("HIDDEN from the DRAGGABLE palette until P2.5 makes it standalone-functional; a childless
    // drop is inert, no broken affordance ships"). But choosing to hide a block that three shipped wizards are BUILT
    // FROM does mean corner/middle are not human-rebuildable today. That is a real, owned limit on the north star's
    // "forkable default library", so it is pinned as an exact set: when P2.5 lands, or a FOURTH load-bearing block
    // gets hidden, this fails and a decision is visibly owed instead of the gap quietly growing.
    expect(r.loadBearingHidden, 'the hidden-but-load-bearing set is exactly these three — a change here is a decision about whether shipped wizards can be rebuilt by hand, and should be made deliberately').toEqual([
        'clearlift (1: user_corner_data)',
        'safehop (1: user_middle_data)',
        'safetraverse (2: user_corner_data, user_middle_data)',
    ]);
});
