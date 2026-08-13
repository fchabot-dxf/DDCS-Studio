import { test, expect } from '@playwright/test';

/**
 * ── t1518 — THE FLAKE-HARDENER'S THREE PRODUCT SUSPECTS, MEASURED. ONE WAS REAL ────────────────────────────────────
 *
 * The t1494-era flake-hardening pass (merge 12e8f490) made the six-member ledger deterministic and deliberately did
 * NOT touch the product, but it left three suspects in a session note. Each was CONFIRMED BY MEASUREMENT before any
 * fix was written, because a ghost costs nothing and a speculative fix costs a divergence.
 *
 *   1 · editWizardDef's capped wait — REAL, and worse than noted. MEASURED by holding the Blocks app down and calling
 *       the real function: 5133ms, no stack loaded, and the surface left saying `✎ Editing: Measured skipme` with the
 *       edge-glow on over an EMPTY canvas, and nothing shown to the user. Not merely a silent skip — a silent skip
 *       that CLAIMS the opposite state, one Save away from writing an empty op over the wizard being edited.
 *   2 · renderLiveForm's microwindow — NOT REPRODUCED. See PROOF 3.
 *   3 · controllerSettled's 900ms — NOT REPRODUCED; already fixed at t1257 and gated by loading-feedback-1257.
 *
 * The fix class is the dispatch's: fail LOUD in the product, not wait longer. The 4s cap is unchanged — a slower
 * machine is not the failure mode being handled, an app that never mounts is.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const seedOp = (page, name) => page.evaluate(async (n) => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    U.createUserOp(U.userOpFromStack(n, 'Op ' + n, template, U.extractParamBlocks(template)));
    window.ddcsRefreshWizardBar();
}, name);

/** Hide the two globals the wait polls for, run `src`, restore them. The app that never mounts, in one gesture. */
const withBlocksDown = (page, src) => page.evaluate(async (code) => {
    const save = { load: window.ddcsLoadBlockStack, ws: window.__blkws };
    Object.defineProperty(window, 'ddcsLoadBlockStack', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(window, '__blkws', { value: undefined, configurable: true, writable: true });
    let out;
    // eslint-disable-next-line no-new-func
    try { out = await (new Function('save', 'return (' + code + ')(save)'))(save); }
    finally { window.ddcsLoadBlockStack = save.load; window.__blkws = save.ws; }
    return out;
}, src);

/**
 * ── PROOF 1 — THE REFUSAL IS LOUD, AND THE SURFACE STOPS LYING ────────────────────────────────────────────────────
 *
 * Two halves, and the second is the one that made this urgent. The alert is the surface this function ALREADY uses
 * for its other refusal ("That wizard is no longer in your library") — no new affordance. And the return lands BEFORE
 * the editing chrome, so a load that did not happen leaves no chip claiming it did.
 */
test('PROOF 1 — a Blocks app that never mounts REFUSES out loud, and claims no edit', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);
    await seedOp(page, 'loud');

    const r = await withBlocksDown(page, `async (save) => {
        const t0 = performance.now();
        await window.ddcsEditWizardDef('user_loud');
        const app = document.getElementById('blocks-app'), chip = document.querySelector('.blk-edit-chip');
        return { ms: Math.round(performance.now() - t0),
                 glow: !!(app && app.classList.contains('editing-wizard')),
                 chipShown: !!(chip && !chip.hidden), chipText: chip ? (chip.textContent || '') : '',
                 loaded: !!(save.ws && save.ws.getAllBlocks && save.ws.getAllBlocks(false).length) };
    }`);

    // ⚠ THE MEASURED BEFORE: 5133ms, glow TRUE, chip "✎ Editing: Measured skipme", loaded FALSE, and NO dialog.
    expect(dialogs.length, 'the user is TOLD — this was silent').toBe(1);
    expect(dialogs[0], '…that the Blocks editor is what did not arrive').toMatch(/Blocks editor did not finish loading/);
    expect(dialogs[0], '…how long it waited, so the number is not a mystery').toMatch(/4 seconds/);
    expect(dialogs[0], '…that nothing was lost').toMatch(/not changed/);
    expect(dialogs[0], '…and what to do next, because a refusal with no exit makes the operator guess (t1444)').toMatch(/try again/);
    // and the chrome does not claim an edit that did not happen
    expect(r.glow, 'no edge-glow — it read TRUE before this fix').toBe(false);
    expect(r.chipShown, 'no editing chip — it read "✎ Editing: …" over an EMPTY canvas before this fix').toBe(false);
    expect(r.chipText, '…and it names nothing').toBe('');
    expect(r.loaded, 'the stack really did not load — the premise of the whole refusal').toBe(false);
    // the cap is UNCHANGED: this is not a longer wait
    expect(r.ms, `the wait is still the 4s cap it always was, not longer (${r.ms}ms)`).toBeLessThan(6000);
    expect(r.ms, '…and it really did wait it out rather than failing early').toBeGreaterThan(3500);
});

/**
 * ── PROOF 2 — THE SIBLING REFUSES TOO, and it was the quieter failure ─────────────────────────────────────────────
 *
 * `editWizardDefs` (the multi-op concat) carried a byte-identical copy of the wait. It CLEARS the chrome rather than
 * setting it, so it never lied — it just did nothing at all, after the user had already accepted a destructive-load
 * prompt. One function serves both, because two identical copies of the wait already existed and patching each would
 * have made the fix the third.
 */
test('PROOF 2 — the multi-op re-author refuses on the same declaration', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDefs && window.ddcsRefreshWizardBar);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        for (const n of ['multia', 'multib']) {
            const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
            U.createUserOp(U.userOpFromStack(n, 'Op ' + n, template, U.extractParamBlocks(template)));
        }
        window.ddcsRefreshWizardBar();
    });
    const r = await withBlocksDown(page, `async (save) => {
        await window.ddcsEditWizardDefs(['user_multia', 'user_multib']);
        return { loaded: !!(save.ws && save.ws.getAllBlocks && save.ws.getAllBlocks(false).length) };
    }`);
    expect(dialogs.length, 'the multi-op path speaks too — it used to return silently').toBe(1);
    expect(dialogs[0], '…naming what it could not open').toMatch(/2 ops/);
    expect(dialogs[0], '…for the same reason, from the same declaration').toMatch(/Blocks editor did not finish loading/);
    expect(r.loaded, 'and nothing loaded, which is why the message matters').toBe(false);
});

/**
 * ── PROOF 3 — THE HAPPY PATH IS UNTOUCHED, and suspect 2 does not reproduce ───────────────────────────────────────
 *
 * A refusal is only worth having if it does not fire on the working case. And this is where suspect 2 was measured:
 * sampling every 25ms for a second after the call, the four signals the ledger spec reads — the glow, the named chip,
 * the form pane and the bound field — were NEVER observed disagreeing. The flake that spec hardened was the CAPPED
 * WAIT expiring under load (its own comment says so), which is suspect 1 wearing a different hat. So there is no
 * separate race to close at the source; the fix above removes the condition its pre-warm was written for, and the
 * pre-warm stays as defence in depth rather than as the thing holding the spec up.
 */
test('PROOF 3 — a normal re-author still works, and its four signals settle together', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    await page.goto('/');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);
    await seedOp(page, 'happy');
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.ddcsLoadBlockStack && window.__blkws);

    const r = await page.evaluate(async () => {
        const snap = () => {
            const app = document.getElementById('blocks-app'), chip = document.querySelector('.blk-edit-chip');
            // t1744 ACT 1b-ii — 'happy' is a hand-built, non-sectioned op (seedOp's own template): the flat
            // branch, which now renders through createUserOpView('blk') into #blk_wiz_user_form, not #blk-form.
            const pane = document.getElementById('blk-formpane'), host = document.getElementById('blk_wiz_user_form');
            return `${+!!(app && app.classList.contains('editing-wizard'))}${+!!(chip && !chip.hidden && /Op happy/.test(chip.textContent || ''))}`
                 + `${+!!(pane && !pane.hidden)}${+!!(host && host.querySelector('[data-param="depth"]'))}`;
        };
        const t0 = performance.now();
        await window.ddcsEditWizardDef('user_happy');
        const atResolve = snap(), ms = Math.round(performance.now() - t0);
        const after = [];
        for (let i = 0; i < 20; i++) { await new Promise((q) => setTimeout(q, 25)); after.push(snap()); }
        return { atResolve, states: [...new Set(after)], ms,
                 loaded: !!(window.__blkws && window.__blkws.getAllBlocks(false).length) };
    });
    expect(dialogs, 'the working case refuses nothing').toEqual([]);
    expect(r.loaded, 'the stack loaded').toBe(true);
    expect(r.ms, 'and it did NOT wait out the cap — the app was already up').toBeLessThan(2000);
    // ⚠ SUSPECT 2, MEASURED: glow · named chip · form pane · bound field, all four consistent the moment the call
    // resolves, and for a second after. A microwindow would show up here as a state that is not "1111".
    expect(r.atResolve, 'all four signals are applied when editWizardDef resolves').toBe('1111');
    expect(r.states, '…and none of them flickers afterwards').toEqual(['1111']);
});
