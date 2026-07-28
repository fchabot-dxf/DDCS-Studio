import { test, expect } from '@playwright/test';

/**
 * t1283 (user ruling) — A WORKSPACE OPEN TAKES THE SCREEN CENTRE.
 *
 * The standing rule is no global overlay: one busy row does not mean a busy app, and an overlay that says otherwise
 * is a lie. A workspace open is the exception the user named, and the reason is what makes it not a lie — the open
 * ends in `location.reload()`, so the whole app IS going away. The centred glyph is both the honest signal and the
 * bridge over the gap until the new page paints. The row state stays as the double-click guard.
 */
test('the centred overlay exists, says what is opening, and library imports do NOT get one', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const B = await import('/ui/busyRow.js');
        const dismiss = B.busyOverlay('“Shop Bee”');
        const el = document.getElementById('ddcs-busy-overlay');
        const centred = el ? getComputedStyle(el) : null;
        const out = {
            present: !!el,
            text: el ? el.textContent.trim() : '',
            live: el ? el.getAttribute('aria-live') : null,
            fixed: centred ? centred.position : null,
            centres: centred ? (centred.display + '/' + centred.alignItems + '/' + centred.justifyContent) : null,
        };
        dismiss();
        out.dismissed = !document.getElementById('ddcs-busy-overlay');
        // the ROW state is untouched by all this — it is the double-click guard and it stays
        const row = document.createElement('div');
        document.body.appendChild(row);
        let calls = 0;
        await Promise.all([B.busyRow(row, async () => { calls++; }), B.busyRow(row, async () => { calls++; })]);
        out.guard = calls;
        row.remove();
        return out;
    });
    expect(r.present, 'the overlay is on screen').toBe(true);
    expect(r.text, 'and it names what is opening, in the user’s words').toMatch(/Opening “Shop Bee”/);
    expect(r.live, 'announced to a screen reader as status, not as an alert').toBe('polite');
    expect(r.fixed, 'it covers the app').toBe('fixed');
    expect(r.centres, 'and it is CENTRED — that is the whole point of the ruling').toBe('flex/center/center');
    expect(r.dismissed, 'the failure path can take it away — a named refusal is the feedback then').toBe(true);
    // …and the guard the overlay does NOT replace: a second click during an open is still not a second open
    expect(r.guard, 'the row state still swallows the second click').toBe(1);
});

test('the OPEN PATH raises it — and the library import path deliberately does not', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(async () => {
        const wm = await fetch('/ui/workspaceManager.js').then((x) => x.text());
        const lm = await fetch('/ui/libraryModal.js').then((x) => x.text()).catch(() => '');
        const ls = await fetch('/ui/libraryShelf.js').then((x) => x.text()).catch(() => '');
        return { wsHasOverlay: /busyOverlay\(/.test(wm), libHasOverlay: /busyOverlay\(/.test(lm + ls),
                 wsKeepsRow: /busyRow\(/.test(wm) };
    });
    expect(r.wsHasOverlay, 'a workspace open raises the centred glyph').toBe(true);
    expect(r.wsKeepsRow, 'and keeps the row state as the guard').toBe(true);
    // the distinction is not the length of the wait — it is whether the app survives it
    expect(r.libHasOverlay, 'a library import stays row-level: it finishes on this screen').toBe(false);
});
