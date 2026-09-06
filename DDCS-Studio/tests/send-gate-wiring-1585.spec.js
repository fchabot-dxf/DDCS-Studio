import { test, expect } from '@playwright/test';
import { clickBtn as clickBtnImpl } from './support/gatewaySend.js';

/**
 * t1585 — THE GATE IS ACTUALLY WIRED: the real Send view, the real click, the real dialog.
 *
 * Its sibling spec proves the DETECTOR is right. This one exists because a perfect detector that never runs is
 * indistinguishable from a working feature in every test that only calls it directly — the failure this project
 * has a rule about. So this drives the app: load a program with a typo'd identifier, open Gateway → Send, click
 * "Use current Studio program", click Send, and read the dialog that appears.
 *
 * ⚠ TWO THINGS ARE LIFTED, NOT ONE. `send.js:222` disables the Send button when no machine is answering
 * ("staging stays usable; SENDING is what needs a machine"), which is a CONNECTION contract orthogonal to the
 * syntax gate under test and cannot be satisfied without hardware. The button's `disabled` flag is cleared and
 * nothing else about the click/handler/parser/dedupe/dialog chain is stubbed. If that lift is ever the reason
 * this passes, the assertions below would still fail — they read the dialog's TEXT, which only the gate can
 * produce.
 * t2225 — the SECOND lift, found the hard way: `send.js:117`'s `ctx.client.profile()` hits the REAL
 * `/api/profile` with no mock, and on a dev machine with a genuine local gateway auto-adopted, it answers with
 * a real V4.1 identity — mismatching this workspace's own default target (DDCS Expert M350) and raising a
 * COMPLETELY DIFFERENT dialog ("Wrong controller — send blocked") before the syntax gate this test is actually
 * about ever runs. `/api/profile` is now mocked to answer as the workspace's own controller, so this test's
 * result no longer depends on what happens to be running locally — the same discipline t2057 already used for
 * `/api/descriptor`/`/api/jobs`, applied to the ONE endpoint this file's own flow actually reaches.
 */
test.use({ viewport: { width: 1300, height: 850 } });

test('the real Send button raises the real gate dialog, naming the line', async ({ page }) => {
    // t2225 — see the file header: matches the workspace's own default controller so the mismatch gate
    // (an unrelated, real machine-identity check) never fires and masks the syntax gate under test.
    await page.route('**/api/profile', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'ddcs-expert-m350', name: 'DDCS Expert M350' }),
    }));
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack, undefined, { timeout: 30_000 });

    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { id: 'a', type: 'move', params: { mode: 'rapid', x: 10, y: 10, z: -5, feed: 500 } },
            { id: 'b', type: 'move', params: { mode: 'rapid', x: 'widht / 2', y: 20, z: -5, feed: 500 } },
        ]);
        await new Promise((r) => setTimeout(r, 700));
    });

    // t2225 — was a local closure (t2113 had edited its matcher to .startsWith(), which broke THIS file's
    // own 'Use current Studio program' call site against the real "⬆ Use current Studio program" button —
    // see support/gatewaySend.js for the full story). Now the one shared implementation.
    const clickBtn = (txt) => clickBtnImpl(page, txt);

    // t2145 — no longer a unique text match: the quick-menu identity line now also shows the PC role ("gateway"
    // / "client"), which matches this loose case-insensitive locator too. Target the real header tab directly.
    await page.locator('.tab[data-app="gateway"]').click();
    await page.waitForTimeout(600);
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(900);
    // t2113/t2225 — plain 'Send' text-matching can't tell the transport button from the L1 GATEWAY nav tab
    // (also literally "Send") — used to be disambiguated by a "Send (tracked)"/"Send (deliver-only)"
    // parenthetical only the transport button carried. t2649 (BACKLOG #78) removed the Beacons checkbox that
    // parenthetical named, so the button text is now bare "Send" too — IDENTICAL to the nav tab's text, a
    // text-only match can no longer disambiguate them at all. Target the submit button by its OWN class
    // instead (`button.primary`, the same selector preflight-badge-838's own Send-view test already uses),
    // never relying on label text for identity.
    // the CONNECTION contract only, never the gate under test (same lift clickBtnImpl always applied) —
    // force-enable the button (no real gateway answers in this test) before clicking it for real.
    expect(await page.evaluate(() => {
        const b = document.querySelector('#gateway-app button.primary');
        if (!b) return false;
        b.disabled = false;
        b.click();
        return true;
    }), 'and the send is attempted').toBe(true);
    await page.waitForTimeout(12_000);   // the mismatch probe must time out against a dead gateway first

    const dlg = await page.evaluate(() => [...document.querySelectorAll('dialog,.dlg,.modal,[role=dialog]')]
        .map((d) => (d.textContent || '')).join('\n'));

    expect(dlg, 'the gate raised its dialog — the chain from click to pixel').toContain('The controller cannot read this file');
    expect(dlg, 'ONE row for one bad line, not one per letter of the unreadable word').toContain('1 line the controller cannot read');
    expect(dlg, 'and it NAMES the line, the way the controller does').toContain('line 2: G0 Xwidht / 2');
    expect(dlg, 'stating the consequence that makes it worth stopping for — partial execution').toContain('cut for real');
    expect(dlg, 'and the machine stays the user\'s: it asks, it does not hard-block').toContain('Send anyway');
});
