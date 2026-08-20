import { test, expect } from '@playwright/test';

/**
 * t1585 — THE GATE IS ACTUALLY WIRED: the real Send view, the real click, the real dialog.
 *
 * Its sibling spec proves the DETECTOR is right. This one exists because a perfect detector that never runs is
 * indistinguishable from a working feature in every test that only calls it directly — the failure this project
 * has a rule about. So this drives the app: load a program with a typo'd identifier, open Gateway → Send, click
 * "Use current Studio program", click Send, and read the dialog that appears.
 *
 * ⚠ ONE THING IS LIFTED, AND ONLY ONE. `send.js:222` disables the Send button when no machine is answering
 * ("staging stays usable; SENDING is what needs a machine"), which is a CONNECTION contract orthogonal to the
 * syntax gate under test and cannot be satisfied without hardware. The button's `disabled` flag is cleared and
 * nothing else is stubbed: the click, the handler, the parser, the dedupe and the dialog are all the real ones.
 * If that lift is ever the reason this passes, the assertions below would still fail — they read the dialog's
 * TEXT, which only the gate can produce.
 */
test.use({ viewport: { width: 1300, height: 850 } });

test('the real Send button raises the real gate dialog, naming the line', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsLoadBlockStack, undefined, { timeout: 30_000 });

    await page.evaluate(async () => {
        window.ddcsLoadBlockStack([
            { id: 'a', type: 'move', params: { mode: 'rapid', x: 10, y: 10, z: -5, feed: 500 } },
            { id: 'b', type: 'move', params: { mode: 'rapid', x: 'widht / 2', y: 20, z: -5, feed: 500 } },
        ]);
        await new Promise((r) => setTimeout(r, 700));
    });

    const clickBtn = (txt) => page.evaluate((t) => {
        const hit = [...document.querySelectorAll('button')]
            .filter((e) => (e.textContent || '').trim().startsWith(t))   // t2113: prefix, so the transport label may vary
            .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
        if (!hit) return false;
        hit.disabled = false;   // see the header: the CONNECTION contract only, never the gate
        hit.click();
        return true;
    }, txt);

    await page.getByText('GATEWAY', { exact: false }).first().click();
    await page.waitForTimeout(600);
    expect(await clickBtn('Send'), 'the Send view opens').toBe(true);
    await page.waitForTimeout(700);
    expect(await clickBtn('Use current Studio program'), 'the current program stages').toBe(true);
    await page.waitForTimeout(900);
    // t2113 - MATCH THE SEND BUTTON, NOT ONE OF ITS LABELS. This asked for the exact text 'Send (tracked)',
    // which silently assumed the beacons checkbox defaults to ON - and that now depends on the CONTROLLER:
    // a V4.1 has no Modbus, so beacons are gated off and the button reads 'Send (deliver-only)'. The test
    // began failing on a dev machine with a real V4.1 attached, because the app auto-adopts a local gateway
    // and the descriptor is real. ⭐ This test is about the GATE DIALOG, not about which transport label the
    // button happens to carry, so it should never have pinned the label.
    expect(await clickBtn('Send'), 'and the send is attempted').toBe(true);
    await page.waitForTimeout(12_000);   // the mismatch probe must time out against a dead gateway first

    const dlg = await page.evaluate(() => [...document.querySelectorAll('dialog,.dlg,.modal,[role=dialog]')]
        .map((d) => (d.textContent || '')).join('\n'));

    expect(dlg, 'the gate raised its dialog — the chain from click to pixel').toContain('The controller cannot read this file');
    expect(dlg, 'ONE row for one bad line, not one per letter of the unreadable word').toContain('1 line the controller cannot read');
    expect(dlg, 'and it NAMES the line, the way the controller does').toContain('line 2: G0 Xwidht / 2');
    expect(dlg, 'stating the consequence that makes it worth stopping for — partial execution').toContain('cut for real');
    expect(dlg, 'and the machine stays the user\'s: it asks, it does not hard-block').toContain('Send anyway');
});
