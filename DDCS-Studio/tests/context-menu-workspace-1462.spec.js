import { test, expect } from '@playwright/test';
import fs from 'fs';

/**
 * t1462 — SURFACE 5 OF THE CONTEXT-MENU PASS: the WORKSPACE ROWS. Open + Delete, and rename ABSENT BY RULING.
 *
 * ── THE RULING, AND WHY THE ABSENCE IS LOCKED RATHER THAN JUST DOCUMENTED ────────────────────────────────────────
 * t1223's ONE-NAME RULE: *"the name input is GONE. The workspace's name IS its filename IS what every surface
 * shows… Renaming is Save As."* So there is no rename action to shortcut, and `Save As` is a HEADER action on the
 * OPEN workspace — on another card it would mean "open that one first", which the Open entry already is.
 *
 * A queued feature WILL rename the FILE itself (which preserves one-name: the single name simply changes), and it
 * lives in another lane. The day it lands, this menu must grow the entry — so the absence is not merely described,
 * it is INSTRUMENTED: the last test below reads the shipping module and requires that no rename capability exists.
 * It flips RED the moment one does. **A menu that quietly lacks an action the app has grown is the same defect as
 * one that offers an action it lacks**, and only a lock catches the first kind.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * Open the shipping workspace manager, then render rows into its own `#wsmCards` in the SHAPE the module emits.
 *
 * ⚠ WHY THE ROWS ARE BUILT HERE, AND HOW THAT STAYS HONEST. The real list comes from a File System Access directory
 * handle, which a headless browser cannot be granted — so `renderPlace` can never run in a test. Building the rows
 * here would normally be testing my own markup against my own handler, so the shape is PINNED SEPARATELY: the test
 * below reads the shipped renderer and requires it to emit `.wsm-fp-row` + `[data-wsm-open]` + `[data-wsm-del]`.
 * If the renderer's shape ever moves, that assert fails rather than these quietly passing against a fiction.
 */
const ROW = (i, name) => `<div class="wsm-fp-row">`
    + `<button type="button" class="wsm-fp-open" data-wsm-open="${i}" title="Open ${name}"><span class="wsm-c-name">${name}</span></button>`
    + `<button type="button" class="wsm-fp-del" data-wsm-del="${i}" title="Delete ${name}.ddcs permanently">del</button>`
    + `</div>`;

const openManagerWithCards = async (page) => page.evaluate(async (rows) => {
    const WM = await import('/ui/workspaceManager.js');
    await WM.openWorkspaceManager();
    await new Promise((r) => setTimeout(r, 300));
    const ov = document.getElementById('wsmOverlay');
    const host = document.getElementById('wsmCards');
    if (!ov || !host) return { err: 'workspace manager did not mount' };
    ov.__cards = [
        { name: 'Alpha', envelope: '300x200', dialect: 'DDCS Expert', handle: null },
        { name: 'Beta', envelope: '300x200', dialect: 'DDCS Expert', handle: null },
    ];
    ov.__dir = { name: 'TestFolder' };
    host.innerHTML = rows;
    return { seeded: true };
}, ROW(0, 'Alpha') + ROW(1, 'Beta'));

test('THE ROW SHAPE THIS SPEC DRIVES IS THE ONE THE MODULE EMITS', async () => {
    const src = fs.readFileSync('web/ui/workspaceManager.js', 'utf8');
    // pins the fiction above to the real renderer — if the row markup moves, this fails instead of the DOM tests
    // passing against a shape the app no longer produces.
    expect(src, 'the renderer emits .wsm-fp-row').toMatch(/class="wsm-fp-row/);
    expect(src, '…with a per-card open action').toMatch(/data-wsm-open="\$\{i\}"/);
    expect(src, '…and a per-card delete action').toMatch(/data-wsm-del="\$\{i\}"/);
});

/**
 * ⚠ THE MENU MUST OUTRANK THE MODALS IT OPENS INSIDE — a REAL defect this surface found.
 *
 * `.op-ctx-menu` was `z-index: 1000`, under EVERY overlay in the app (`.wsm-overlay` is 13200), so a context menu
 * on any modal surface rendered BEHIND it: in the DOM, invisible on screen, un-clickable. It went unnoticed while
 * the menu served only the editor and the bar — neither is a modal — and the first real-mouse test inside a modal
 * caught it immediately, because the click meant for an entry landed on the overlay instead.
 *
 * The ordering is asserted BOTH ways: above the modal so the menu is usable, and BELOW `.app-dialog` so a confirm
 * raised FROM an entry still covers the menu — which is exactly what the delete flow depends on.
 */
test('THE MENU OUTRANKS THE MODAL, and the app dialog outranks the menu', async ({ page }) => {
    await boot(page);
    const z = await page.evaluate(() => {
        const probe = (cls) => {
            const el = document.createElement('div'); el.className = cls; document.body.appendChild(el);
            const v = parseInt(getComputedStyle(el).zIndex, 10); el.remove(); return v;
        };
        return { menu: probe('op-ctx-menu'), modal: probe('wsm-overlay') };
    });
    // the dialog sets its z-index INLINE (ui/dialog.js), so it is read from the source rather than probed — a bare
    // `.app-dialog` div has no computed z-index at all, which is how a first cut of this test read NaN.
    const dlgZ = Number((fs.readFileSync('web/ui/dialog.js', 'utf8').match(/z-index:\s*(\d+)/) || [])[1]);
    expect(dlgZ, 'the app dialog declares a z-index').toBeGreaterThan(0);
    expect(z.menu, `the menu (${z.menu}) must sit ABOVE the workspace modal (${z.modal})`).toBeGreaterThan(z.modal);
    expect(z.menu, `…and STRICTLY below the app dialog (${dlgZ}), so a confirm it raises always covers it`).toBeLessThan(dlgZ);
});

test('THE RULING IS CITED IN THE SOURCE — rename is absent because t1223 says so', async () => {
    const src = fs.readFileSync('web/ui/workspaceManager.js', 'utf8');
    // The reason lives beside the code, so the next reader does not rediscover the conflict from scratch.
    expect(src, 'the menu names the ruling it obeys').toMatch(/ONE-NAME RULE/);
    expect(src, 'and quotes what it means').toMatch(/Renaming is Save As/);
    expect(src, '…and records that Open-then-Save-As was rejected, not overlooked').toMatch(/Open wearing a second label/);
});

/**
 * ⚠ THE ABSENCE LOCK. This is the test that must go RED the day the queued file-rename lands, so the menu cannot
 * lag the feature. It reads the SHIPPING module rather than a list of names I typed: any rename door — a
 * `data-wsm-ren*` action, a `renameWorkspace` function, or a File System Access `move()` — trips it.
 *
 * When it goes red: ADD the entry to the workspace-row menu and update this test. Do not relax the matcher.
 */
test('THE ABSENCE IS LOCKED — the day a real rename capability exists, this goes RED', async () => {
    const src = fs.readFileSync('web/ui/workspaceManager.js', 'utf8');
    const save = fs.readFileSync('web/ui/workspaceSave.js', 'utf8');
    const both = src + '\n' + save;
    // a per-card rename ACTION (the markup shape the other row actions use)
    expect(both.match(/data-wsm-ren/g), 'no per-card rename action exists yet').toBeNull();
    // a rename FUNCTION by any of the obvious names
    expect(both.match(/function\s+renameWorkspace|renameWorkspaceFile\s*\(/g), 'no rename function exists yet').toBeNull();
    // the File System Access rename primitive — what the queued feature will almost certainly use
    expect(both.match(/\.move\s*\(/g), 'no handle.move() rename exists yet').toBeNull();
});

test('THE MENU — Open + Delete on a row, and NO rename entry', async ({ page }, testInfo) => {
    await boot(page);
    const seeded = await openManagerWithCards(page);
    expect(seeded.err, 'the workspace manager mounted').toBeUndefined();
    const row = page.locator('#wsmCards .wsm-fp-row').first();
    await expect(row, 'a row is rendered to right-click').toBeVisible();
    const box = await row.boundingBox();
    await page.mouse.click(box.x + 40, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    const items = await page.evaluate(() => {
        const m = document.querySelector('.op-ctx-menu');
        return (!m || m.hidden) ? null : [...m.querySelectorAll('.op-ctx-item')].map((b) => b.textContent);
    });
    expect(items, 'right-clicking a workspace row opens the app menu').toBeTruthy();
    const all = items.join(' | ');
    expect(all, 'Open, naming the workspace').toMatch(/Open/);
    expect(all, 'and Delete').toMatch(/Delete/);
    // the ruled absence, at the surface
    expect(all, 'NO rename entry — t1223 stands until the file-rename feature lands').not.toMatch(/Rename/i);
    expect(items.length, 'two entries, no more').toBe(2);
    await page.screenshot({ path: 'test-results/t1462-shots/workspace-row-menu.png' });
    await testInfo.attach('t1462-workspace-row-menu', { path: 'test-results/t1462-shots/workspace-row-menu.png', contentType: 'image/png' });
});

test('THE ENTRIES DRIVE THE ROW\'S OWN BUTTONS — not a second implementation', async ({ page }) => {
    await boot(page);
    const seeded = await openManagerWithCards(page);
    expect(seeded.err, 'the workspace manager mounted').toBeUndefined();
    const row = page.locator('#wsmCards .wsm-fp-row').first();
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    await page.mouse.click(box.x + 40, box.y + box.height / 2, { button: 'right' });
    await page.waitForTimeout(200);
    const at = await page.evaluate(() => {
        const it = [...document.querySelectorAll('.op-ctx-menu .op-ctx-item')].find((b) => /Delete/.test(b.textContent));
        if (!it) return null;
        const r = it.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    expect(at, 'the Delete entry is on screen').toBeTruthy();
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(400);
    /**
     * THE OUTCOME, not an instrumented click. Picking Delete must land in the app's REAL delete path — which means
     * its own confirm, the one that names the file and states that deletion is permanent and skips the Recycle Bin.
     * Asserting that is stronger than asserting a button received a click: it proves the menu inherited the guard,
     * which is the entire reason the entry dispatches the row's button instead of re-implementing the delete.
     */
    const dlg = await page.evaluate(() => {
        const d = document.querySelector('.app-dialog');
        return d ? d.textContent : null;
    });
    expect(dlg, 'the app\'s own delete confirm opened').toBeTruthy();
    expect(dlg, '…naming the file').toMatch(/Alpha/);
    expect(dlg, '…and keeping its permanence warning, inherited rather than re-written').toMatch(/PERMANENTLY|Recycle Bin/i);
});
