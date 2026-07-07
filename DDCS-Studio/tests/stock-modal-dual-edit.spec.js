import { test, expect } from '@playwright/test';

/**
 * DIRECT-EDIT CANVAS FIELDS (human t450) — double-click a stock-modal 2D handle → an inline DUAL number field (W/H for a
 * size handle, X/Y for the feature-offset handle) to TYPE the value instead of dragging. Enter/blur commits (updates the
 * model + re-renders 2D+3D), Esc cancels. VERIFY assert-the-value: the typed value lands in the stock/feature model.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openModalWithPocket(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsOpenStock && window.ddcsGetSettings);
    await page.evaluate(() => Object.assign(window.ddcsGetSettings().stock, {
        x: 120, y: 90, z: 20, datum: 'nnp', shape: 'pocket',
        features: [{ id: 'p', shape: 'rect', side: 'inside', pos: { x: 60, y: 45 }, size: { x: 40, y: 30 }, depth: 6 }],
    }));
    await page.evaluate(() => window.ddcsOpenStock());
    await page.waitForSelector('#se_canvas svg .fc-handle', { timeout: 8000 });
    await page.waitForTimeout(400);
}

// double-click the handle with the given data-hid, at its on-screen centre
async function dblclickHandle(page, hid) {
    return page.evaluate((id) => {
        const h = document.querySelector(`#se_canvas svg .fc-handle[data-hid="${id}"]`); if (!h) return false;
        const svg = h.closest('svg'); const r = h.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        svg.dispatchEvent(new MouseEvent('dblclick', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
        return true;
    }, hid);
}

async function typeDual(page, a, b, key) {
    return page.evaluate(({ a, b, key }) => {
        const box = document.querySelector('.fc-dim-edit-dual'); if (!box) return { ok: false };
        const inps = box.querySelectorAll('input');
        inps[0].value = String(a); inps[0].dispatchEvent(new Event('input', { bubbles: true }));
        inps[1].value = String(b); inps[1].dispatchEvent(new Event('input', { bubbles: true }));
        inps[1].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        return { ok: true, count: inps.length };
    }, { a, b, key });
}

test('double-click the OUTER-SIZE handle → dual W/H → type → stock resizes (Enter commits)', async ({ page }) => {
    await openModalWithPocket(page);
    expect(await dblclickHandle(page, 'outer_size'), 'the outer-size handle exists').toBe(true);
    await page.waitForSelector('.fc-dim-edit-dual', { timeout: 4000 });
    const dual = await typeDual(page, 50, 40, 'Enter');
    expect(dual.ok && dual.count === 2, 'a DUAL (2-input) field opened').toBe(true);
    await page.waitForTimeout(300);
    const stock = await page.evaluate(() => { const s = window.ddcsGetSettings().stock; return { x: s.x, y: s.y }; });
    expect(stock.x, 'typing W=50 set stock.x').toBe(50);
    expect(stock.y, 'typing H=40 set stock.y').toBe(40);
});

test('double-click the FEATURE-SIZE handle → dual W/H → type → feature.size updates', async ({ page }) => {
    await openModalWithPocket(page);
    // materialize the feature first (it may be derived) by dblclicking its size handle
    expect(await dblclickHandle(page, 'feat0_size'), 'the feature-size handle exists').toBe(true);
    await page.waitForSelector('.fc-dim-edit-dual', { timeout: 4000 });
    await typeDual(page, 24, 18, 'Enter');
    await page.waitForTimeout(300);
    const size = await page.evaluate(() => { const f = window.ddcsGetSettings().stock.features[0]; return f && f.size; });
    expect(size, 'the feature has a stored size').not.toBeNull();
    expect(size.x, 'typing W=24 set feature.size.x').toBe(24);
    expect(size.y, 'typing H=18 set feature.size.y').toBe(18);
});

test('double-click the FEATURE-OFFSET handle → dual X/Y → type → feature.pos moves; screenshot', async ({ page }) => {
    await openModalWithPocket(page);
    expect(await dblclickHandle(page, 'feat0_org'), 'the feature-offset handle exists').toBe(true);
    await page.waitForSelector('.fc-dim-edit-dual', { timeout: 4000 });
    await page.locator('.stock-editor-pop').screenshot({ path: 'scratchpad/dual_edit_field.png' });   // the dual editor OPEN on the handle
    await typeDual(page, 30, 20, 'Enter');
    await page.waitForTimeout(300);
    const pos = await page.evaluate(() => { const f = window.ddcsGetSettings().stock.features[0]; return f && f.pos; });
    // front-left datum (nnp) → datumXY = {0,0} → the typed offset IS the physical pos
    expect(pos.x, 'typing X=30 set feature.pos.x (offset + datum)').toBe(30);
    expect(pos.y, 'typing Y=20 set feature.pos.y').toBe(20);
});

test('Esc CANCELS the dual edit (no model change)', async ({ page }) => {
    await openModalWithPocket(page);
    const before = await page.evaluate(() => { const s = window.ddcsGetSettings().stock; return { x: s.x, y: s.y }; });
    await dblclickHandle(page, 'outer_size');
    await page.waitForSelector('.fc-dim-edit-dual', { timeout: 4000 });
    await typeDual(page, 55, 44, 'Escape');
    await page.waitForTimeout(200);
    const gone = await page.evaluate(() => !document.querySelector('.fc-dim-edit-dual'));
    const after = await page.evaluate(() => { const s = window.ddcsGetSettings().stock; return { x: s.x, y: s.y }; });
    expect(gone, 'Esc closed the dual editor').toBe(true);
    expect(after, 'Esc made NO model change').toEqual(before);
});
