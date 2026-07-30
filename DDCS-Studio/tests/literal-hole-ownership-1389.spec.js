import { test, expect } from '@playwright/test';

/**
 * t1389 → t1391 — THE OWNERSHIP TEST, AND THE EXTRACTION THAT ANSWERED IT.
 *
 * ── WHAT THIS SPEC WAS FOR (t1389) ────────────────────────────────────────────────────────────────────────────────
 * Ruling 3 required the ownership test be re-run AT the deletion rather than inherited from t1385's both-paths guard.
 * That instruction earned its keep: the two literal atoms were NOT both pure leaves. `bore` was reachable by nothing,
 * but POCKET OWNED `drill` — `pocketWizard.js` built one for the TOO-SMALL fallback (a pocket narrower than its tool
 * becomes a single plunge) and `pocketData.js` bound four params to it by type. So the deletion did not happen, and this
 * spec recorded the blocker as an executable guard instead of a note.
 *
 * WHY t1385's GUARD MISSED IT, which is the lesson worth keeping: that guard walked every registered builder called with
 * DEFAULT params, and pocket's drill child exists only on the too-small ARM. A guard that samples one point of the
 * parameter space cannot answer a question about the whole space, and "no builder reaches it" read as a complete answer
 * while being a sampled one.
 *
 * ── WHAT IT ASSERTS NOW (t1391) ───────────────────────────────────────────────────────────────────────────────────
 * The tenant has MOVED OUT: the fallback re-points through `holecycle` with `pattern:'single', cycle:'peck'` (ruled — not
 * a second single-hole emitter beside the family the arc unified). So every assertion FLIPS to the mirror claim: pocket
 * owns nothing, across the same parameter space that caught the dependency in the first place. The space is still swept
 * rather than sampled, because that is the property that made this spec worth writing.
 */
test.use({ viewport: { width: 1200, height: 800 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE TENANT MOVED OUT — pocket carries NO literal hole, across its whole parameter space', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const scan = (p, opts) => { try { const t = flat(pocketStack(p, opts)); return { literal: t.filter((x) => x === 'drill' || x === 'bore'), hole: t.filter((x) => x === 'holecycle') }; } catch (e) { return { err: String(e).slice(0, 60) }; } };
        const BIG = { toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 };
        return {
            rect: scan({ ...BIG, shape: 'rect', w: 80, h: 60 }),
            circle: scan({ ...BIG, shape: 'circle', dia: 50 }),
            polygon: scan({ ...BIG, shape: 'polygon', dia: 50, sides: 6 }),
            // THE ARM THAT CAUGHT IT — both shapes, the ones defaults never reach.
            tinyCircle: scan({ ...BIG, shape: 'circle', dia: 4, depth: 3, stepdown: 1 }),
            tinyRect: scan({ ...BIG, shape: 'rect', w: 4, h: 4, depth: 3, stepdown: 1 }),
            // …and the GUARDED SUPERSET, which carries every arm at once (what the data twin prunes over).
            superset: scan({ ...BIG, shape: 'rect', w: 80, h: 60 }, { superset: true }),
        };
    });
    for (const [name, v] of Object.entries(r)) {
        expect(v.err, `${name}: built without throwing`).toBeUndefined();
        expect(v.literal, `${name}: carries NO literal drill/bore leaf any more`).toEqual([]);
    }
    // …and the too-small arms + the superset really do still carry a HOLE — otherwise "no literal" would be satisfied by
    // having quietly lost the plunge altogether, which is the failure mode this pairing exists to exclude.
    expect(r.tinyCircle.hole, 'the too-small circle still plunges — through the parametric family now').toEqual(['holecycle']);
    expect(r.tinyRect.hole, 'and the too-small rect').toEqual(['holecycle']);
    expect(r.superset.hole, 'and the guarded superset carries the arm').toEqual(['holecycle']);
    // The normal arms never had a hole and still do not.
    expect(r.rect.hole, 'a normal rect pocket has no hole at all').toEqual([]);
    expect(r.circle.hole, 'nor a normal circle pocket').toEqual([]);
});

/**
 * THE RUNTIME SIDE, flipped too — the fallback now emits the PARAMETRIC body, not the literal peck ladder.
 * (This test previously proved the opposite, which is what established the dependency as real rather than structural.)
 */
test('THE TENANT MOVED OUT — the fallback emits the PARAMETRIC body, not the literal ladder', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const tiny = emitMapped(pocketStack({ shape: 'circle', dia: 4, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 })).text;
        const big = emitMapped(pocketStack({ shape: 'circle', dia: 50, toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 })).text;
        return {
            tinyBakedZ: (tiny.match(/^G1 Z-?[\d.]+ F/gm) || []).length,   // the literal ladder's baked steps
            tinyHasLoop: /WHILE \[#8\d/.test(tiny),                        // the parametric body's signature
            tinyHasLiveSeed: /^#81=3/m.test(tiny),
            tinyDeclaresWork: /@work \d+/.test(tiny),
            bigHasZ: /G1 Z/.test(big),
        };
    });
    expect(r.tinyBakedZ, 'no BAKED Z ladder any more — that was the literal kernel').toBe(0);
    expect(r.tinyHasLoop, 'the fallback runs the parametric loop').toBe(true);
    expect(r.tinyHasLiveSeed, 'seeding the depth into the live register').toBe(true);
    expect(r.tinyDeclaresWork, 'and it declares its expected work, like every other holecycle program').toBe(true);
    expect(r.bigHasZ, 'while a normal pocket still cuts (the comparison has a working sibling)').toBe(true);
});

/**
 * AND THE PAIR IS NOW UNBLOCKED — nothing reaches either literal atom, from any builder or any registered user op.
 * This is the precondition act 2 needs, asserted BEFORE the deletion rather than assumed by it.
 */
test('THE PAIR IS UNBLOCKED — nothing reaches drill or bore from any builder or user op', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BUILDERS, builderOf } = await import('/blocks/opBuilders.js');
        const uo = await import('/blocks/userOps.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const reach = [];
        for (const [op, build] of Object.entries(BUILDERS)) {
            try { const t = flat(build({})); if (t.includes('drill') || t.includes('bore')) reach.push('BUILDERS:' + op); } catch (_) { /* needs params */ }
        }
        for (const def of uo.listUserOps()) {
            try { const t = flat(builderOf(def.opType)(uo.defaultParams(def))); if (t.includes('drill') || t.includes('bore')) reach.push('userOp:' + def.opType); } catch (_) { /* needs params */ }
        }
        return { reach, boreRegistered: !!BLOCKS.bore, drillRegistered: !!BLOCKS.drill };
    });
    expect(r.reach, 'no builder and no registered user op reaches either literal atom').toEqual([]);
    // Still registered at the END of act 1 — the deletion is act 2's own reviewed commit, and these two lines are what
    // flip there. Asserted rather than left implicit so the two acts stay distinguishable in the history.
    expect(r.drillRegistered, 'drill is still registered — act 1 extracted the tenant, act 2 does the deletion').toBe(true);
    expect(r.boreRegistered, 'and so is bore').toBe(true);
});
