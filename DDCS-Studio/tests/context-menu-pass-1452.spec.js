import { test, expect } from '@playwright/test';

/**
 * t1452 — THE CONTEXT-MENU PASS: the EDITOR surface, plus the mechanism every other surface will reuse.
 *
 * ── THE TWO HARD RULES, AND HOW THEY ARE ASSERTED ────────────────────────────────────────────────────────────────
 *   1. AN ENTRY ONLY SHORTCUTS AN ACTION THAT ALREADY EXISTS SOMEWHERE VISIBLE — never the only path. So the test
 *      does not just check the entries render: it checks each one has a VISIBLE BUTTON too. That rule is why
 *      comment/uncomment arrived as a FEATURE (button + Ctrl+/ + menu) rather than as a menu entry: it existed
 *      nowhere before, and a menu-only action is exactly what the rule forbids.
 *   2. LONG-PRESS = RIGHT-CLICK. The user tests on a phone, where there is no right button — so a menu without it is
 *      a menu that does not exist on the surface it is most needed. Driven here as real touch events.
 *
 * ── AND THE COMMENT MARK IS AN EVIDENCE DECISION, NOT A STYLE ONE ────────────────────────────────────────────────
 * G-code's usual comment is `( … )` and on THIS controller it cannot comment out an arbitrary line: DDCS refuses a
 * nested `( … ( … ) )`, and most emitted lines already carry a comment, so nesting is the COMMON case here, not a
 * corner. The mark is a leading `;` because 189 lines of the captured factory corpus start with one. The test below
 * asserts the consequence directly — commenting an already-commented line produces no nested parens.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const SEED = ['G90', 'G0 X0 Y0', 'G1 X10 F600', '', 'G0 Z5'].join('\n');

/** Seed, let the app settle (it re-projects real G-code — see the 1450 spec), then select whole lines [a, b]. */
const select = async (page, a, b) => {
    await page.evaluate((seed) => {
        const ed = document.getElementById('editor');
        ed.value = seed;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
    }, SEED);
    await page.waitForFunction(() => {
        const ed = document.getElementById('editor');
        if (!ed || !ed.value) return false;
        const now = Date.now();
        if (ed.dataset.t1452Val !== ed.value) { ed.dataset.t1452Val = ed.value; ed.dataset.t1452At = String(now); return false; }
        return now - Number(ed.dataset.t1452At || 0) > 400;
    }, null, { timeout: 15000 });
    return page.evaluate(({ a, b }) => {
        const ed = document.getElementById('editor');
        const L = ed.value.split(String.fromCharCode(10));
        const start = L.slice(0, a).reduce((n, l) => n + l.length + 1, 0);
        const end = L.slice(0, b + 1).reduce((n, l) => n + l.length + 1, 0) - 1;
        ed.focus();
        ed.setSelectionRange(start, end);
        return { before: ed.value, lines: L };
    }, { a, b });
};

const val = (page) => page.evaluate(() => document.getElementById('editor').value);

test('RULE 1 — every editor menu entry also has a VISIBLE button (the menu is never the only path)', async ({ page }) => {
    await boot(page);
    await select(page, 1, 2);
    const box = await page.locator('#editor').boundingBox();
    await page.mouse.click(box.x + 40, box.y + 60, { button: 'right' });
    const labels = await page.locator('.op-ctx-menu .op-ctx-item').allTextContents();
    expect(labels.length, 'the plain-text menu offers its entries').toBeGreaterThanOrEqual(3);
    // …and each of those actions is reachable WITHOUT the menu
    for (const id of ['editor-indent', 'editor-outdent', 'editor-comment'])
        await expect(page.locator('#' + id), `${id} is a visible door for its menu entry`).toBeVisible();
    expect(labels.join(' | ')).toMatch(/Indent/);
    expect(labels.join(' | ')).toMatch(/Outdent/);
    expect(labels.join(' | ')).toMatch(/Comment/);
});

test('RULE 2 — LONG-PRESS opens the same menu (there is no right button on a phone)', async ({ page }) => {
    await boot(page);
    await select(page, 1, 2);
    // real touch events, held past the platform long-press interval
    const r = await page.evaluate(async () => {
        const ed = document.getElementById('editor');
        const b = ed.getBoundingClientRect();
        const pt = { clientX: Math.round(b.left + 40), clientY: Math.round(b.top + 60) };
        const touch = (type, init) => ed.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, ...init }));
        const t = new Touch({ identifier: 1, target: ed, ...pt });
        touch('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t] });
        await new Promise((res) => setTimeout(res, 700));                       // > LONG_PRESS_MS
        touch('touchend', { touches: [], targetTouches: [], changedTouches: [t] });
        const m = document.querySelector('.op-ctx-menu');
        return { open: !!m && !m.hidden, items: m ? [...m.querySelectorAll('.op-ctx-item')].map((x) => x.textContent) : [] };
    });
    expect(r.open, 'a long press opens the context menu').toBe(true);
    expect(r.items.join(' | '), 'and it is the SAME menu, not a touch-only variant').toMatch(/Comment/);
});

test('A SCROLL IS NOT A PRESS — dragging past the slop cancels', async ({ page }) => {
    await boot(page);
    await select(page, 1, 2);
    const open = await page.evaluate(async () => {
        const ed = document.getElementById('editor');
        const b = ed.getBoundingClientRect();
        const mk = (x, y) => new Touch({ identifier: 1, target: ed, clientX: x, clientY: y });
        const x0 = Math.round(b.left + 40), y0 = Math.round(b.top + 60);
        let t = mk(x0, y0);
        ed.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
        await new Promise((res) => setTimeout(res, 120));
        t = mk(x0, y0 + 60);                                                     // a flick — well past the 10px slop
        ed.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
        await new Promise((res) => setTimeout(res, 700));
        const m = document.querySelector('.op-ctx-menu');
        return !!m && !m.hidden;
    });
    // Without this, flicking a list on a phone would fire menus — the slop is what makes long-press usable at all.
    expect(open, 'a scroll must NOT open the menu').toBe(false);
});

test('COMMENT / UNCOMMENT — real `;` bytes, a clean toggle, and blank lines left alone', async ({ page }) => {
    await boot(page);
    const s = await select(page, 1, 4);
    await page.click('#editor-comment');
    const on = await val(page);
    const L = on.split('\n'), B = s.before.split('\n');
    for (let i = 1; i <= 4; i++) {
        if (B[i].trim() === '') expect(L[i], `line ${i} is blank — a ";" there is noise the user must clean up`).toBe(B[i]);
        else expect(L[i], `line ${i} carries a REAL leading semicolon`).toBe(';' + B[i]);
    }
    expect(L[0], 'the unselected line is untouched').toBe(B[0]);
    await page.click('#editor-comment');
    expect(await val(page), 'toggling back restores the original bytes exactly').toBe(s.before);
});

test('THE MARK CANNOT NEST — commenting a line that already has a ( comment ) stays legal', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { commentBlock, COMMENT_MARK } = await import('/data/indentStyle.js');
        const NL = String.fromCharCode(10);
        const src = ['G90   ( absolute )', 'G0 X0 Y0   ( rapid )'].join(NL);
        const out = commentBlock(src, 0, src.length).text;
        // DDCS refuses a nested ( … ( … ) ): the count of '(' on any line must not exceed 1 after commenting
        const worstParens = Math.max(...out.split(NL).map((l) => (l.match(/\(/g) || []).length));
        return { out, worstParens, mark: COMMENT_MARK, back: commentBlock(out, 0, out.length).text };
    });
    expect(r.mark, 'the mark is the factory-demonstrated leading semicolon').toBe(';');
    expect(r.worstParens, 'no line gained a SECOND open-paren — a ( ) wrap would have, and DDCS refuses that').toBe(1);
    expect(r.out.split('\n').every((l) => l.startsWith(';')), 'every line is commented').toBe(true);
    expect(r.back, 'and uncommenting is exact, comments and all').toBe('G90   ( absolute )\nG0 X0 Y0   ( rapid )');
});

test('Ctrl+/ AND UNDO — the third door, and the edit is a normal undoable step', async ({ page }) => {
    await boot(page);
    const s = await select(page, 1, 2);
    await page.keyboard.press('Control+/');
    const on = await val(page);
    expect(on.split('\n')[1], 'Ctrl+/ runs the same one implementation').toBe(';' + s.lines[1]);
    await page.keyboard.press('Control+z');
    expect(await val(page), 'undo puts the bytes back').toBe(s.before);
});

test('THE MENU ENTRY ACTS — right-click → Comment, at the pixel', async ({ page }, testInfo) => {
    await boot(page);
    const s = await select(page, 1, 2);
    const pt = await page.evaluate(() => {
        const ed = document.getElementById('editor'), cs = getComputedStyle(ed), r = ed.getBoundingClientRect();
        const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.6);
        return { x: r.left + (parseFloat(cs.paddingLeft) || 0) + 20, y: r.top + (parseFloat(cs.paddingTop) || 0) - ed.scrollTop + lh * 1.5 };
    });
    await page.mouse.click(pt.x, pt.y, { button: 'right' });
    await expect(page.locator('.op-ctx-menu')).toBeVisible();
    await page.screenshot({ path: 'test-results/t1452-shots/editor-menu.png' });
    await testInfo.attach('t1452-editor-menu', { path: 'test-results/t1452-shots/editor-menu.png', contentType: 'image/png' });
    await page.locator('.op-ctx-menu .op-ctx-item', { hasText: 'Comment' }).click();
    const on = await val(page);
    expect(on.split('\n')[1], 'the menu entry commented the selected block').toBe(';' + s.lines[1]);
    await page.screenshot({ path: 'test-results/t1452-shots/editor-commented.png' });
    await testInfo.attach('t1452-editor-commented', { path: 'test-results/t1452-shots/editor-commented.png', contentType: 'image/png' });
});
