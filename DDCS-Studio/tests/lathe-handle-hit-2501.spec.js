import { test, expect } from '@playwright/test';

/**
 * tests/lathe-handle-hit-2501.spec.js — BACKLOG #66's own permanent guard.
 *
 * t2499/t2501 found `parting`'s own `partPos` handle 100% dead to every drag, in every direction, always —
 * FOUR turns and roughly a dozen refuted hypotheses after it was first reported (t2471). The root, once found,
 * was not in `partPos`'s own declaration at all: `partFloor`'s own click-to-edit LABEL — a completely separate,
 * independently-correct handle's own text glyph — happened to render (and, critically, HIT-TEST) directly on
 * top of `partPos`'s circle, because `featureCanvas.js` interleaved each handle's shape and label in
 * declaration order, so a LATER handle's label could paint over an EARLIER handle's own circle. Every existing
 * check in the app answered a different question: `dragHandleRenderTruth` (L1/L4, this arc's own gate) asks
 * "does a real drag TRACK the pointer" — it drives `page.mouse` at the handle's own reported screen position,
 * which is exactly where the OCCLUDING element also sits, so it silently drove the label instead and reported
 * "zero movement" without ever naming why. `affordancePresence`/`affordanceReachability` (L2/L3) ask "does the
 * affordance EXIST" and "is it inside the viewport" — `partPos` passes both; it was always present and always
 * on-screen, just not the TOPMOST thing at its own coordinates.
 *
 * THIS IS THE MISSING QUESTION, a genuinely new one: not "does it exist" (L2), not "can it be reached inside
 * the viewport" (L3), but **can it be HIT** — is the declared handle actually the element a real pointer click
 * at its own centre would land on, or does something else (most plausibly, but not necessarily, a neighbouring
 * handle's own label) intercept it first. `document.elementFromPoint()` answers this directly, using nothing
 * but a standard DOM API already available everywhere — no new primitive module, no new abstraction: this file
 * IS the check, per the dispatch's own explicit instruction not to build a fourth `tests/support/` primitive
 * for a property this cheap to state directly.
 *
 * SCOPE: the ten handles BACKLOG #61 / L5 ported onto `canvasWidgets.js` (facing/centerDrill/faceProbe/
 * odProbe/odTurn/parting's three/polygon's two) — the exact family this bug was found in, and the one this
 * fix (`featureCanvas.js`'s own handle/label paint-order change) protects. A wider sweep across every op in
 * the app (pocket/drill/text/…) is a legitimate future extension, not attempted here — this guard exists to
 * make sure the SPECIFIC regression this turn fixed can never silently return, not to audit hit-testing
 * app-wide.
 *
 * NON-VACUOUS, confirmed not assumed: run against the code as it stood immediately BEFORE this turn's own
 * `featureCanvas.js` fix (a temporary `git checkout HEAD --` revert, restored after), this exact test FAILED
 * on `partPos` — `elementFromPoint` resolved to `partFloor`'s own `<text class="fc-handle-label">` — and
 * PASSED on the other nine, unchanged. See WORK-LOG t2501 for the full before/after run.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function bootOp(page, optype) {
    await page.goto('/?debug=feat');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.evaluate(async (ot) => {
        const { _framed, makeOp } = await import('/blocks/opBuilders.js');
        const framed = _framed(ot, {});
        const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
        const op = makeOp(ot, {}, bare);
        const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
        window.ddcsLoadBlockStack(stack);
    }, optype);
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
    await page.waitForTimeout(400);
}

// t2493 — `width:15` is BACKLOG #66's own confirmed-dead boundary (dead through 15mm, alive at 20mm, per
// t2479's own width-threshold sweep) — pinned here rather than left at whatever `parting`'s own defaults
// happen to be, so this guard exercises the EXACT geometry the bug lived in, not a width where the two
// handles' own labels happened to already be clear of each other by coincidence.
const CASES = [
    { op: 'user_lathe_facing', hid: 'faceLine' },
    { op: 'user_lathe_centerdrill', hid: 'drillDepth' },
    { op: 'user_lathe_faceprobe', hid: 'probeFace' },
    { op: 'user_lathe_odprobe', hid: 'probeOD' },
    { op: 'user_lathe_odturn', hid: 'shoulder' },
    { op: 'user_lathe_parting', hid: 'partPos', params: { width: 15 } },
    { op: 'user_lathe_parting', hid: 'partWidth', params: { width: 15 } },
    { op: 'user_lathe_parting', hid: 'partFloor', params: { width: 15 } },
    { op: 'user_lathe_polygon', hid: 'polyDepth' },
    { op: 'user_lathe_polygon', hid: 'polyFlats' },
];

for (const { op, hid, params } of CASES) {
    test(`handle HIT-test: ${op} / ${hid} — elementFromPoint at its own rendered centre resolves to ITSELF`, async ({ page }) => {
        await bootOp(page, op);
        if (params) {
            // re-boot with the pinned params for the parting family, so the width-dependent geometry is exact
            await page.evaluate(async ([ot, p]) => {
                const { _framed, makeOp } = await import('/blocks/opBuilders.js');
                const framed = _framed(ot, p);
                const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
                const built = makeOp(ot, p, bare);
                const stack = [framed.find((b) => b && b.type === 'progstart'), built, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
                window.ddcsLoadBlockStack(stack);
            }, [op, params]);
            await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
            await page.waitForTimeout(400);
        }
        const el = page.locator(`.fc-handle[data-hid="${hid}"]`);
        await el.waitFor({ state: 'visible', timeout: 5000 });
        const box = await el.boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const found = await page.evaluate(([px, py]) => {
            const e = document.elementFromPoint(px, py);
            return e ? { tag: e.tagName, cls: e.getAttribute('class'), dataHid: e.getAttribute('data-hid') } : null;
        }, [x, y]);
        expect(found && found.dataHid, `elementFromPoint(${x.toFixed(0)},${y.toFixed(0)}) for "${hid}" resolved to ` +
            `${JSON.stringify(found)} instead of its own handle — something else (a neighbour's own label, ` +
            `most plausibly) is sitting on top of it and would intercept a real pointer click there`).toBe(hid);
    });
}
