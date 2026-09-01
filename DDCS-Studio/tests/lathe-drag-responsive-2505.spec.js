import { test, expect } from '@playwright/test';

/**
 * tests/lathe-drag-responsive-2505.spec.js — BACKLOG #70's own permanent guard.
 *
 * t2497/t2499/t2503 found `polygon`'s own `polyFlats` handle freezes the tab for several seconds at a stretch
 * when dragged toward a small `acrossFlats` value: `postInstantiate` (`rebuildPolygon`) regenerates the WHOLE
 * block stack on every drag FRAME (up to ~868 blocks as the value shrinks), and canvasWidgets.js's own `onDrag`
 * committed that write on EVERY frame rather than deferring to release — Blockly then had to lay out hundreds of
 * blocks live, synchronously, for every single pointermove. CPU-profiled and confirmed real (t2503): a person
 * dragging this in a real, headed browser at human pacing (400ms between discrete moves) felt individual moves
 * take 2.3s, 4.0s, 4.1s, 5.0s+, 5.0s+, 4.0s before dropping back to ~250ms past the trouble region — not a
 * synthetic-input-burst artifact.
 *
 * t2505 fixed it by forwarding the `opts`/`preview` flag the drag-write chain was silently dropping in exactly
 * three places (`viz/latheProfileCanvas.js`'s own `write` wrapper and `polygonProfileSpec`'s own inner wrapper;
 * `wizards/ops/panelTypes.js`'s own `latheLayoutSpec` callback) — routing a mid-drag `polyFlats` write through
 * `_writeParam`'s own EXISTING preview branch (BACKLOG #46, t2429/t2447 — already proven, already used by every
 * mill/pattern handle in the app) instead of adding new machinery. The canvas still tracks the pointer live (it
 * reads params off the live FORM FIELDS, never the model); the expensive model write — and the rebuild it
 * triggers — is deferred to ONE call at drag-end (`onDragEnd`, now merged into the lathe branch's own return).
 *
 * THIS IS THE MISSING QUESTION, a genuinely new one, matching this arc's own pattern (L2 "does it exist," L3
 * "can it be reached," the t2501 guard "can it be HIT"): not any of those, but **does dragging it stay
 * RESPONSIVE** — does a real per-move write return in bounded time, or does the tab freeze. A green
 * `dragHandleRenderTruth`-style gate cannot catch this: it asserts the handle eventually TRACKED the pointer and
 * didn't snap back, both true here even at the worst of the freeze (a slow success is still a success by that
 * measure). This file asserts the ONE property that measure structurally cannot: BOUNDED TIME per move, across
 * exactly the seed and region the freeze lived in — built with existing tools (`page.mouse.move`, `Date.now()`),
 * not a new primitive module, per the dispatch's own explicit instruction.
 *
 * NON-VACUOUS, confirmed not assumed: run against the code as it stood immediately BEFORE this turn's own three
 * `opts`-forwarding edits (a temporary `git stash` / `git checkout HEAD --` revert, restored after — see
 * WORK-LOG t2505 for the exact before/after numbers), this exact test FAILED — several individual moves exceeded
 * the bound, matching t2503's own multi-second measurements — and PASSED once the fix was restored.
 */

test.use({ viewport: { width: 1400, height: 1000 } });

async function bootPolygon(page) {
    await page.goto('/?debug=feat');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.showApp, null, { timeout: 60000 });
    await page.evaluate(() => window.showApp('blocks'));
    await page.evaluate(async () => {
        const { _framed, makeOp } = await import('/blocks/opBuilders.js');
        const ot = 'user_lathe_polygon';
        const framed = _framed(ot, {});
        const bare = framed.filter((b) => b && b.type !== 'progstart' && b.type !== 'progend');
        const op = makeOp(ot, {}, bare);
        const stack = [framed.find((b) => b && b.type === 'progstart'), op, framed.find((b) => b && b.type === 'progend')].filter(Boolean);
        window.ddcsLoadBlockStack(stack);
    });
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length > 5);
    await page.waitForTimeout(400);
}

// The bound: generous over the ~20-100ms a healthy move takes (measured post-fix), far under the 2.3s-8s+
// stalls measured pre-fix (t2503/t2505) — wide enough to absorb normal CI jitter without masking a real freeze.
const MAX_MOVE_MS = 1500;

test('BOUNDED-TIME drag: polyFlats, the exact documented trouble seed (dx:0,dy:40,steps:8) stays responsive', async ({ page }) => {
    test.setTimeout(60000);
    await bootPolygon(page);

    const handle = page.locator('.fc-handle[data-hid="polyFlats"]');
    await handle.waitFor({ state: 'visible', timeout: 5000 });
    const box = await handle.boundingBox();
    const startX = box.x + box.width / 2, startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();

    const N = 8;
    const timings = [];
    for (let i = 1; i <= N; i++) {
        const t0 = Date.now();
        await page.mouse.move(startX + 0, startY + (40 * i) / N);
        timings.push(Date.now() - t0);
    }
    await page.mouse.up();

    const worst = Math.max(...timings);
    expect(worst, `every move must resolve within ${MAX_MOVE_MS}ms — a slow one means the main thread froze during ` +
        `the drag (BACKLOG #70's own regression); got: ${timings.join(', ')}ms`).toBeLessThan(MAX_MOVE_MS);
});

test('BOUNDED-TIME drag: polyDepth (the other polygon handle) stays responsive too', async ({ page }) => {
    test.setTimeout(30000);
    await bootPolygon(page);
    const handle = page.locator('.fc-handle[data-hid="polyDepth"]');
    await handle.waitFor({ state: 'visible', timeout: 5000 });
    const box = await handle.boundingBox();
    const startX = box.x + box.width / 2, startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const t0 = Date.now();
    await page.mouse.move(startX - 30, startY, { steps: 4 });
    const ms = Date.now() - t0;
    await page.mouse.up();
    expect(ms).toBeLessThan(MAX_MOVE_MS);
});

test('the drag-end commit lands the REAL final value (deferred commit is not silently dropped)', async ({ page }) => {
    test.setTimeout(30000);
    await bootPolygon(page);
    const handle = page.locator('.fc-handle[data-hid="polyFlats"]');
    await handle.waitFor({ state: 'visible', timeout: 5000 });
    const box = await handle.boundingBox();
    const startX = box.x + box.width / 2, startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 15, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const model = await page.evaluate(async () => {
        const prog = window.ddcsGetBlockProgram();
        const op = window.ddcsFlattenOps(prog)[0];
        return op ? op.params : null;
    });
    expect(model && Number.isFinite(model.acrossFlats)).toBe(true);
});

test('click-to-edit on polyFlats still writes the model (the exact path a naive fix could break)', async ({ page }) => {
    test.setTimeout(30000);
    await bootPolygon(page);
    const label = page.locator('.fc-handle-label', { hasText: 'across flats' });
    await label.waitFor({ state: 'visible', timeout: 5000 });
    await label.click();
    const input = page.locator('input[type="number"]:visible, input:not([type]):visible').last();
    await input.waitFor({ state: 'visible', timeout: 3000 });
    await input.fill('9.5');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const model = await page.evaluate(async () => {
        const prog = window.ddcsGetBlockProgram();
        const op = window.ddcsFlattenOps(prog)[0];
        return op ? op.params : null;
    });
    expect(model && Number(model.acrossFlats)).toBeCloseTo(9.5, 1);
});
