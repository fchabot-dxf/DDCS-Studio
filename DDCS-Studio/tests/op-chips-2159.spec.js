import { test, expect } from '@playwright/test';

/**
 * t2159 ("t-opchips") — THE PERSISTENT OP-CHIP ROW. Formal coverage of the spec's VERIFY list, narrowed by
 * Amendment 1 (reordering was retracted before implementation — no reorder assertions here; the retired items
 * were the only ones this file does NOT carry). Covers: N ops → N chips in program order, icon-only; a user
 * iconOverride reaches the chip with zero extra code (RULING 3); hover highlights that op's lines; click opens
 * that op's wizard; right-click AND long-press open the IDENTICAL menu (RULING 4, one handler); a 20-op program
 * keeps the strip one row tall and scrolls sideways, not wrapping (RULING 2); a light sweep across phone/desktop
 * widths and the 5 themes.
 *
 * mkOp below is the same hand-built op-record shape `traverse-clarity-893.spec.js` already proved
 * `ddcsLoadBlockStack` renders straight into rendered chips (no real wizard insert needed) — fast and reliable
 * for a chip-row-focused suite that isn't testing wizard authoring itself.
 */
const mkOp = (id, opType, label, x = 10, y = 10) => ({
    type: 'op', id, opType, label,
    params: { depth: 5, shape: 'rect', w: 20, h: 20 },
    children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x, y, z: -5, feed: 200 } }],
});

test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram, null, { timeout: 15000 });
});

test('N ops render as N icon-only chips, in program order', async ({ page }) => {
    const ids = ['a1', 'a2', 'a3', 'a4'];
    await page.evaluate((ids) => {
        window.ddcsLoadBlockStack([
            { type: 'op', id: ids[0], opType: 'pocket', label: 'One', params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: 'm1', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] },
            { type: 'op', id: ids[1], opType: 'drill', label: 'Two', params: { depth: 5 }, children: [{ type: 'move', id: 'm2', params: { mode: 'cut', x: 20, y: 20, z: -5, feed: 200 } }] },
            { type: 'op', id: ids[2], opType: 'surfacing', label: 'Three', params: { depth: 1 }, children: [{ type: 'move', id: 'm3', params: { mode: 'cut', x: 30, y: 30, z: -5, feed: 200 } }] },
            { type: 'op', id: ids[3], opType: 'bore', label: 'Four', params: { depth: 5 }, children: [{ type: 'move', id: 'm4', params: { mode: 'cut', x: 40, y: 40, z: -5, feed: 200 } }] },
        ]);
    }, ids);
    await page.waitForFunction((n) => document.querySelectorAll('.op-chip-row .op-chip').length === n, ids.length, { timeout: 8000 });
    const chips = await page.evaluate(() => Array.from(document.querySelectorAll('.op-chip-row .op-chip')).map((b) => ({
        opId: b.dataset.opId, text: (b.textContent || '').trim(), tag: b.tagName, hasTitle: !!b.title,
    })));
    expect(chips.map((c) => c.opId), 'chip order matches program order').toEqual(ids);
    for (const c of chips) {
        expect(c.tag, 'each chip is a real <button>').toBe('BUTTON');
        expect(c.text, `chip ${c.opId} carries no visible label text — icon only`).toBe('');
        expect(c.hasTitle, `chip ${c.opId} still carries its label in the tooltip`).toBe(true);
    }
});

test("a user iconOverride reaches the chip with zero extra code (RULING 3)", async ({ page }) => {
    await page.evaluate(async () => {
        const L = await import('/blocks/wizardLibrary.js');
        L.setEntryOverride('pocket', { icon: '🚀' });
        window.ddcsLoadBlockStack([{ type: 'op', id: 'ov1', opType: 'pocket', label: 'Overridden', params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: 'ovm', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] }]);
    });
    await page.waitForFunction(() => document.querySelector('.op-chip[data-op-id="ov1"]'), null, { timeout: 8000 });
    const html = await page.evaluate(() => document.querySelector('.op-chip[data-op-id="ov1"]').innerHTML);
    expect(html, 'the overridden icon rendered with NO code beyond the declared override').toContain('🚀');
    await page.evaluate(async () => { const L = await import('/blocks/wizardLibrary.js'); L.clearEntryOverride('pocket'); });
});

test('hovering a chip highlights ONLY that op\'s lines', async ({ page }) => {
    await page.evaluate(() => {
        window.ddcsLoadBlockStack([mkOpInline('h1', 'pocket'), mkOpInline('h2', 'drill')]);
        function mkOpInline(id, opType) { return { type: 'op', id, opType, label: id, params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] }; }
    });
    await page.waitForFunction(() => document.querySelectorAll('.op-chip-row .op-chip').length === 2, null, { timeout: 8000 });
    const linesForH2 = await page.evaluate(() => window.ddcsLinesForOp('h2') || []);
    expect(linesForH2.length, 'the second op owns at least one line').toBeGreaterThan(0);
    await page.hover('.op-chip[data-op-id="h2"]');
    await page.waitForTimeout(150);
    const state = await page.evaluate((lines) => {
        const hi = new Set(Array.from(document.querySelectorAll('#editor-highlight .g-line.op-hover')).map((s) => Number(s.dataset.lineIndex)));
        return { hiCount: hi.size, matchesOwnLines: lines.every((l) => hi.has(l)), extra: [...hi].filter((l) => !lines.includes(l)) };
    }, linesForH2);
    expect(state.matchesOwnLines, 'every one of h2\'s own lines is highlighted').toBe(true);
    expect(state.extra, 'no OTHER op\'s lines get highlighted').toEqual([]);
    // mouseleave clears it
    await page.hover('body');
    await page.waitForTimeout(120);
    const cleared = await page.evaluate(() => document.querySelectorAll('#editor-highlight .g-line.op-hover').length);
    expect(cleared, 'leaving the chip clears the highlight').toBe(0);
});

test('clicking a chip opens THAT op for editing', async ({ page }) => {
    await page.evaluate(() => {
        window.ddcsLoadBlockStack([
            { type: 'op', id: 'c1', opType: 'pocket', label: 'C1', params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: 'c1m', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] },
            { type: 'op', id: 'c2', opType: 'drill', label: 'C2', params: { depth: 5 }, children: [{ type: 'move', id: 'c2m', params: { mode: 'cut', x: 20, y: 20, z: -5, feed: 200 } }] },
        ]);
    });
    await page.waitForFunction(() => document.querySelectorAll('.op-chip-row .op-chip').length === 2, null, { timeout: 8000 });
    await page.evaluate(() => { window.__edited = []; const o = window.ddcsEditOp; window.ddcsEditOp = (id) => { window.__edited.push(id); return o && o(id); }; });
    await page.click('.op-chip[data-op-id="c2"]');
    await page.waitForTimeout(120);
    const edited = await page.evaluate(() => window.__edited);
    expect(edited, 'clicking c2\'s chip edits c2, not c1').toEqual(['c2']);
});

test('right-click AND long-press open the IDENTICAL op menu (RULING 4, one handler)', async ({ page }) => {
    await page.evaluate(() => {
        window.ddcsLoadBlockStack([{ type: 'op', id: 'm1', opType: 'pocket', label: 'Menu op', params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: 'm1m', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] }]);
    });
    await page.waitForFunction(() => document.querySelector('.op-chip[data-op-id="m1"]'), null, { timeout: 8000 });

    // right-click
    await page.click('.op-chip[data-op-id="m1"]', { button: 'right' });
    await page.waitForTimeout(120);
    const viaRightClick = await page.evaluate(() => Array.from(document.querySelectorAll('.op-ctx-menu .op-ctx-item')).map((b) => b.textContent));
    expect(viaRightClick.length, 'right-click opened a real menu with entries').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);

    // long-press — synthesize real Touch/TouchEvent objects (CDP dispatchTouchEvent doesn't reliably fire real
    // DOM touch listeners in this harness — proven during this same turn's building of touch-reachability-750).
    const viaLongPress = await page.evaluate(async () => {
        const chip = document.querySelector('.op-chip[data-op-id="m1"]');
        const r = chip.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const touch = new Touch({ identifier: 1, target: chip, clientX: cx, clientY: cy });
        chip.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
        await new Promise((res) => setTimeout(res, 650));   // LONG_PRESS_MS (500) + margin
        chip.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] }));
        await new Promise((res) => setTimeout(res, 100));
        return Array.from(document.querySelectorAll('.op-ctx-menu .op-ctx-item')).map((b) => b.textContent);
    });
    expect(viaLongPress, 'long-press opens the SAME menu items as right-click — one handler, no touch branch').toEqual(viaRightClick);
});

test('a 20-op program keeps the strip ONE ROW TALL and scrolls sideways (RULING 2)', async ({ page }) => {
    const ids = Array.from({ length: 20 }, (_, i) => 'r' + i);
    await page.evaluate((ids) => {
        window.ddcsLoadBlockStack(ids.map((id, i) => ({
            type: 'op', id, opType: i % 2 ? 'drill' : 'pocket', label: id,
            params: { depth: 5, shape: 'rect', w: 20, h: 20 },
            children: [{ type: 'move', id: id + 'm', params: { mode: 'cut', x: i * 5, y: i * 5, z: -5, feed: 200 } }],
        })));
    }, ids);
    await page.waitForFunction((n) => document.querySelectorAll('.op-chip-row .op-chip').length === n, ids.length, { timeout: 8000 });
    const geo = await page.evaluate(() => {
        const row = document.querySelector('.op-chip-row');
        const cs = getComputedStyle(row);
        return { scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, offsetHeight: row.offsetHeight, wraps: cs.flexWrap };
    });
    expect(geo.wraps, 'the row never wraps to a second line').toBe('nowrap');
    expect(geo.scrollWidth, '20 chips overflow the visible width (there is something to scroll)').toBeGreaterThan(geo.clientWidth);
    // a single chip is 26px + border; a genuinely one-row-tall strip should stay well under 2x that even with overflow
    expect(geo.offsetHeight, 'the row itself stays one chip tall, not stacked').toBeLessThan(60);
});

test('chip row renders across phone width, desktop width, and all 5 themes (screenshot sweep)', async ({ page }, testInfo) => {
    await page.evaluate(() => {
        window.ddcsLoadBlockStack([
            { type: 'op', id: 'th1', opType: 'pocket', label: 'Theme A', params: { depth: 5, shape: 'rect', w: 20, h: 20 }, children: [{ type: 'move', id: 'th1m', params: { mode: 'cut', x: 10, y: 10, z: -5, feed: 200 } }] },
            { type: 'op', id: 'th2', opType: 'drill', label: 'Theme B', params: { depth: 5 }, children: [{ type: 'move', id: 'th2m', params: { mode: 'cut', x: 20, y: 20, z: -5, feed: 200 } }] },
        ]);
    });
    await page.waitForFunction(() => document.querySelectorAll('.op-chip-row .op-chip').length === 2, null, { timeout: 8000 });
    const THEMES = ['studio', 'normal', 'steampunk', 'futuristic', 'organic'];
    for (const width of [390, 1400]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of THEMES) {
            await page.evaluate((t) => document.body.setAttribute('data-theme', t), theme);
            await page.waitForTimeout(60);
            const vis = await page.evaluate(() => {
                const row = document.querySelector('.op-chip-row');
                return row && !row.hidden && row.offsetParent !== null && row.children.length === 2;
            });
            expect(vis, `the chip row renders 2 chips at ${width}px in theme "${theme}"`).toBe(true);
        }
    }
    await page.evaluate((t) => document.body.setAttribute('data-theme', t), 'normal');
    await page.locator('.editor-strip').screenshot({ path: testInfo.outputPath('op-chips-strip.png') });
});
