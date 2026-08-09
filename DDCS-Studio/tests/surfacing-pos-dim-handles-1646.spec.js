import { test, expect } from '@playwright/test';

/**
 * t1646 — SURFACING'S POS/DIM GUI, FULL FUNCTIONS. User-ruled: no clamp, no greying — every field stays live and
 * editable; the on-open auto-fill-to-stock stays. t1642 never actually drove the declared canvas handles
 * (`surfacingView.js:59-62` — a `point` handle for pos, a `rect` handle for the faced area) — it drove the fields
 * directly and clicked the stock-attach marker, a DIFFERENT widget. Whether the pos/dim handles genuinely drag and
 * reach the emit was UNVERIFIED, and "surfacing start position needs developed" plausibly means exactly this.
 *
 * MEASURED with a REAL mouse drag (`page.mouse.down/move/up` on the actual SVG `.fc-handle` element, not a field
 * write) — both handles ALREADY WORK: the pos handle moves `sf_originX`/`sf_originY` only and reaches the emit; the
 * rect handle resizes `sf_w`/`sf_h` only (at the default near-corner anchor) and reaches the emit; dragging one
 * never touches the other's field ([[handles-are-independent]]). Verified at BOTH the on-open default (area ==
 * full stock — deliberately kept, per the user's ruling) and a shrunk area. No code defect found in the drag→
 * field→emit chain — this spec PINS that fact so it is never re-investigated from scratch.
 *
 * A measurement note baked into the assertions: `traceToolpath(...).bounds.minX/minY` always includes the tool's
 * assumed START position (0,0) as a zero-length leading segment, regardless of where the raster actually sits — so
 * `minX`/`minY` are NOT a reliable "where does the raster start" signal (they read ~0 even when the raster is far
 * from the origin). `maxX`/`maxY` are unpolluted (the raster is the only thing reaching them) and are what
 * `placement-rollout.spec.js`/`placement-anchor-1642.spec.js` already use for exactly this reason — followed here.
 * Y (row count) is additionally QUANTIZED by the stepover — the last row lands at a stepover-multiple offset, not
 * exactly at H — so a resize's Y-extent shift is checked within a stepover-sized tolerance, not bit-exact (X, a
 * continuous row-length sweep, is checked exactly).
 *
 * WHAT WAS NOT FOUND WORKING, reported not built (a real gap, but a separately-scoped feature, not a bug fix):
 * `user_surfacing_data`'s generic bindings-driven form renders `originX`/`originY`/`w`/`h` as PLAIN NUMBER INPUTS —
 * no 2D canvas, no draggable handle (checked specifically for the SAME `data-hid="origin"`/`"size"` ids the wizard
 * uses — absent). DATA parity is confirmed (a plain field write to the twin's originX correctly shifts its own
 * emitted bounds, measured below) — only GUI parity is missing. Giving the twin a draggable canvas would mean
 * declaring `group`/`role`/`anchor` on its binding specs (the composable-GUI-PILOT-2 mechanism `deriveBindings.js`
 * already supports for a HAND-WRITTEN spec, not just blocks-authored ones — the one existing user is
 * `cornerData.js`, but for RELATIVE reposition deltas, not an absolute point+rect — a materially different,
 * undesigned case). Building that is a real feature with real design questions (what anchor kind for an absolute
 * drag point; whether `layoutSpecFromOp` even supports a bare rect+point today), not a small addition — flagged
 * for a ruling rather than built unilaterally.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const setStock = (page) => page.evaluate(() => { const s = window.ddcsGetSettings(); s.stock = Object.assign(s.stock || {}, { x: 200, y: 150, z: 20, show: true, datum: 'nnp' }); });
const open = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await setStock(page);
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
    await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
    await page.waitForTimeout(300);
};
const fields = (page) => page.evaluate(() => ({
    w: Number(document.getElementById('sf_w').value), h: Number(document.getElementById('sf_h').value),
    ox: Number(document.getElementById('sf_originX').value), oy: Number(document.getElementById('sf_originY').value),
}));
const handleCenter = (page, hid) => page.evaluate((id) => {
    const el = document.querySelector(`#surfacingLayoutCanvas svg [data-hid="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, hid);
const drag = async (page, from, dx, dy) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(250);
};
// maxX/maxY only — see the file docstring: minX/minY always include the polluting (0,0) start-position segment.
const emitMax = (page) => page.evaluate(async () => {
    const { traceToolpath } = await import('/engine/trace.js');
    const b = traceToolpath(document.getElementById('wiz_surfacing_code').textContent).bounds;
    return { maxX: b.maxX, maxY: b.maxY };
});

test('the POS handle: a real drag moves ONLY originX/originY, reaches the emit — verified at the on-open default (full-stock) AND a shrunk area', async ({ page }) => {
    await open(page);

    // CASE A — the on-open default, area == full stock (the user-ruled auto-fill stays; the first gesture a user makes).
    const before0 = await fields(page);
    const mBefore0 = await emitMax(page);
    const origin0 = await handleCenter(page, 'origin');
    expect(origin0, 'the pos handle is drawn and hit-testable at the default state').toBeTruthy();
    await drag(page, origin0, 15, 0);   // horizontal-only screen drag → isolate the X shift
    const after0 = await fields(page);
    expect(after0.w, 'W untouched by a pos drag').toBe(before0.w);
    expect(after0.h, 'H untouched by a pos drag').toBe(before0.h);
    const dOx0 = after0.ox - before0.ox;
    expect(Math.abs(dOx0), 'originX genuinely moved').toBeGreaterThan(1);
    const mAfter0 = await emitMax(page);
    // assert-the-value: the emit's maxX shifts by EXACTLY the delta the field itself reports (two independent
    // reads — the DOM field and the traced emit — must agree, not just "something changed").
    expect(mAfter0.maxX - mBefore0.maxX, 'the emit maxX shift matches the field delta').toBeCloseTo(dOx0, 2);

    // CASE B — shrink the area (away from the full-stock identity t1642 pinned) and drag again, this time diagonally.
    await page.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('sf_w', 80); set('sf_h', 60); set('sf_originX', 20); set('sf_originY', 20);
    });
    await page.waitForTimeout(250);
    const before1 = await fields(page);
    const mBefore1 = await emitMax(page);
    const origin1 = await handleCenter(page, 'origin');
    await drag(page, origin1, 25, -10);
    const after1 = await fields(page);
    expect(after1.w, 'W still untouched').toBe(before1.w);
    expect(after1.h, 'H still untouched').toBe(before1.h);
    const dOx1 = after1.ox - before1.ox, dOy1 = after1.oy - before1.oy;
    expect(Math.abs(dOx1), 'originX moved').toBeGreaterThan(1);
    expect(Math.abs(dOy1), 'originY moved too (a diagonal drag)').toBeGreaterThan(1);
    const mAfter1 = await emitMax(page);
    expect(mAfter1.maxX - mBefore1.maxX, 'the emit maxX shift matches the field delta').toBeCloseTo(dOx1, 2);
    expect(mAfter1.maxY - mBefore1.maxY, 'the emit maxY shift matches the field delta (continuous — the raster edge, not a row count)').toBeCloseTo(dOy1, 2);
});

test('the RECT (size) handle: a real drag resizes ONLY W/H at the default anchor, reaches the emit, independent of the pos handle', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('sf_w', 80); set('sf_h', 60); set('sf_originX', 20); set('sf_originY', 20); set('sf_toolDia', 12); set('sf_stepoverPct', 60);
    });
    await page.waitForTimeout(250);
    const before = await fields(page);
    const mBefore = await emitMax(page);
    const size = await handleCenter(page, 'size');
    expect(size, 'the size handle is drawn and hit-testable').toBeTruthy();
    await drag(page, size, 40, -20);   // screen-right + screen-up → grow both W and H
    const after = await fields(page);
    expect(after.ox, 'origin untouched by a size drag at the default (near-corner) anchor').toBe(before.ox);
    expect(after.oy, 'origin untouched by a size drag at the default (near-corner) anchor').toBe(before.oy);
    const dW = after.w - before.w, dH = after.h - before.h;
    expect(dW, 'W genuinely grew').toBeGreaterThan(1);
    expect(dH, 'H genuinely grew').toBeGreaterThan(1);
    const mAfter = await emitMax(page);
    // X: a row is a continuous sweep to the declared W — the shift is exact.
    expect(mAfter.maxX - mBefore.maxX, 'the emit maxX shift matches the W field delta exactly').toBeCloseTo(dW, 2);
    // Y: the number of ROWS is stepover-quantized (12mm tool x 60% = 7.2mm steps) — the last row lands within one
    // stepover of the declared H, not bit-exact. A real, non-trivial shift in the RIGHT direction, tolerant on magnitude.
    const stepover = 12 * 0.60;
    expect(mAfter.maxY - mBefore.maxY, 'the emit maxY grew (same direction as H)').toBeGreaterThan(0);
    expect(Math.abs((mAfter.maxY - mBefore.maxY) - dH), `the maxY shift is within one stepover (${stepover}mm) of the H field delta — row-count quantization, not a defect`).toBeLessThan(stepover + 0.5);
});

test('the TWIN (user_surfacing_data): DATA parity confirmed — a field write to originX reaches its own emit — but it has NO draggable 2D canvas (a real gap, reported not built)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await setStock(page);
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible' });
    await page.waitForTimeout(300);

    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const setP = (param, v) => { const e = document.querySelector(`#wiz_user_form [data-param="${param}"]`); if (!e) return false; e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; };
        const getCode = () => (document.getElementById('wiz_user_code') || {}).textContent || '';
        const originXTag = document.querySelector('#wiz_user_form [data-param="originX"]');
        // Specifically the SAME handle ids the wizard's own canvas uses — not just "any [data-hid]" (generic
        // sim-start markers exist for many twins and would be an unrelated false positive).
        const hasPosSizeHandles = !!document.querySelector('svg [data-hid="origin"]') || !!document.querySelector('svg [data-hid="size"]');
        setP('w', 80); setP('h', 60); setP('originX', 0); setP('originY', 0);
        const before = traceToolpath(getCode()).bounds;
        setP('originX', 40);
        const after = traceToolpath(getCode()).bounds;
        return { fieldTag: originXTag && originXTag.tagName, hasPosSizeHandles, before, after };
    });
    expect(r.fieldTag, 'originX renders as a plain input in the twin\'s generic form').toBe('INPUT');
    expect(r.hasPosSizeHandles, 'no draggable pos/size canvas handle exists for the twin today').toBe(false);
    expect(r.after.maxX - r.before.maxX, 'DATA parity: the plain field write still reaches the twin\'s own emit correctly').toBeCloseTo(40, 2);
});
