import { test, expect } from '@playwright/test';
import { getBlkFormHost } from './support/blkFormHost.js';
import { waitReady } from './_boot.js';

/**
 * t1599 — A DEFINE CUSTOM WIZARD BLOCK ON THE CANVAS MEANS THE WIZARD VIEW TAB HAS CONTENT.
 *
 * t1734 — RETIRED THE FACE, KEPT THE FACT. The Blocks right column used to wear one of two faces (the Generator
 * Modal, class `.wizard-view`, or Preview + projected G-code) chosen FOR the user by a predicate. GAMEPLAN STEP 3
 * deleted that predicate's PANE-VISIBILITY role along with the Projected G-code pane: Wizard View and 3D are now
 * two ALWAYS-PRESENT tabs, clicked, never guessed. What survives — unchanged — is the underlying fact this spec
 * traces: whether the Wizard View tab's CONTENT is the wizard's form, an empty/mid-edit message, or truly nothing.
 * `renderLiveForm`'s `show` predicate (deriveLiveWizard's authoredHere/customizing/hasTree/def) is exactly as it
 * was; only `setRightFace` — the part that used to also hide/show the whole pane and rewrite the drawer title — is
 * gone. This file is repointed accordingly: `face()` (below) now reads `#blk-form`'s CONTENT only, never the DOM
 * class/title that no longer exists.
 *
 * ── THE FINDING THAT SHAPED THE UNDERLYING FACT (still true, still why the code looks the way it does) ───────────
 * `deriveAuthoredDef` did not throw, and the `userRoot` lookup did not take a wrong branch. It only ever searched
 * the stack's TOP LEVEL — and on the Customize route the wizard root sits INSIDE an `op` container, so it was never
 * found at all. The face then rested entirely on a second term, `editingWizardType()`, which `editWizardDef`
 * DELIBERATELY clears for the fork-only twins (surfacing / slot / drill / bore). Corner survived on that accident;
 * surfacing had none of the three terms and showed nothing.
 *
 *   route                              hasTree   editing   old face   content today
 *   Customize corner (bindingSpecs)    false     set       wizard     form
 *   Customize surfacing (fork-only)    false     null      PREVIEW    form     ← the reported gap
 *   hand-built + panel + param_group   true      null      wizard     form
 *   bare Define Custom Wizard          false     null      PREVIEW    form     ← mid-edit
 *   plain program, no wizard block     false     null      Preview    empty    ← the reverse must hold
 *   PLACED data-op twin in a program   false     null      Preview    form     ← t1740 FOLLOW-UP, was empty
 *
 * ⚠ THE OBVIOUS FIX WAS WRONG FOR THE REASON BELOW — BUT "empty" TURNED OUT TO BE THE WRONG CALL TOO (t1740
 * FOLLOW-UP). "A Define Custom Wizard block anywhere in the stack means content" is what the original ruling
 * sounded like, and it was rejected first: every data-op twin's INSTANTIATED body is `[user_root{…}]`, so a naive
 * "user_root anywhere" predicate would have conjured a form for ANY placed twin, stealing the sim tab's relevance
 * from an ordinary program. The fix that shipped instead asked a DECLARED fact (devMode.authoringWizardType()) and,
 * for anything NOT reached by that fact, showed nothing — which is where this row's "empty" came from. That part
 * was too strong: the user's own report (t1740, verbatim: "i use the built in, press insert, then press blocks
 * tab") showed a placed Corner op — genuinely in the program, genuinely on the canvas — rendering ZERO fields, and
 * named why it matters: "im asking about built in... because to me it would make concrete the idea that they are
 * each merely a view of the data" — an empty pane for a built-in doesn't just look broken, it contradicts wizards-
 * as-data for that op. The actual bug was narrower than "no declared fact covers this": `deriveLiveWizard`'s
 * `opBlock` scan (blocksApp.js) checked `b.params.opType` for a placed op's type — but a REAL placed op carries its
 * type on the TOP-LEVEL `b.opType` field (opBuilders.js's own shape), never nested under `params` (params holds
 * VALUE fields). The check never matched anything; fixed to also check `b.opType`, plus a live-value overlay
 * (opBlock.params, read straight off the stack itself — no side-channel) so the form shows what THIS op actually
 * holds, not the registry's bare defaults. `authoringWizardType()`/Customize is UNCHANGED and still the route for
 * "is a wizard being AUTHORED" — this is a separate, additional fact: "is a wizard's DATA sitting on the canvas,
 * placed or authored," which is what the Wizard View tab was always meant to answer.
 */

const boot = async (page) => {
    await page.goto('/', { timeout: 60000 });
    // t2351 — the file's own long-documented "generic boot-timeout" flake, root-caused: this wait used to check
    // only `ddcsGetBlockProgram && ddcsEditWizardDef`, never `showApp` — genuinely independent globals, set by
    // unrelated modules with no ordering relationship at all (`window.showApp` — gatewayStatus.js's own
    // top-level assignment; `window.ddcsGetBlockProgram` — programModel.js's own top-level assignment;
    // `window.ddcsEditWizardDef` — app.js's OWN ASYNC `import('./blocks/devMode.js').then(...)` chain). Under
    // normal load they happen to already all be set by the time any one of them resolves — a coincidence, not a
    // guarantee — so checking 2 of the 3 this function actually depends on silently worked. Under the heavy CPU
    // contention of a full parallel suite run, that coincidental ordering can break: `showApp` isn't set yet
    // when the line below runs, `window.showApp && window.showApp('blocks')` — its own existing guard — silently
    // no-ops (no error, nothing to catch), and the app is left on the plain editor view forever. The NEXT wait
    // (for `window.__blkws`) then blocks for the test's full timeout, because the one call that would have
    // produced it never ran. CONFIRMED, not inferred: captured the exact failing page's own snapshot from a real
    // full-suite run — the editor toolbar, not the Blocks tab, still showing after the timeout fired.
    // THE FIX uses the project's own ALREADY-DECLARED answer to exactly this class (t1279, index.html's own
    // "ONE DECLARED SIGNAL" comment, fixing the identical shape once before for a different flake): wait for
    // `document.documentElement.dataset.ddcsReady === '1'`, set ONLY once every deferred dynamic import
    // (including gatewayStatus.js's own `window.showApp` assignment) has actually landed — not a hand-picked
    // subset of the globals a test happens to know it needs, which is exactly the kind of list that goes stale
    // the moment a test needs one more thing than it originally checked for.
    await waitReady(page, () => document.documentElement.dataset.ddcsReady === '1');
    // t1734 — the Blocks tab must actually be OPEN for face()/settle() to read anything: ddcsEditWizardDef opens it
    // as a side effect (so the CUSTOMIZE test below always worked), but ddcsLoadBlockStack alone does not — the
    // other three tests here only ever call that, and window.__blkws stayed undefined until this was added (a
    // pre-existing gap in boot(), unrelated to the tab restructure — found while verifying the repoint below).
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await waitReady(page, () => !!window.__blkws);
};
const settle = async (page) => {
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last) return;
        last = n;
        await page.waitForTimeout(250);
    }
};
// t1766 — `ddcsLoadBlockStack([])`'s effect on `ddcsGetBlockProgram()` is NOT guaranteed to have landed by the
// time the call returns: blocksApp's renderFromModel queues a microtask that reads the Blockly workspace BACK
// into the model (to sync ids after a rebuild), and under back-to-back setStack calls — exactly this loop's own
// shape — a still-pending echo from an earlier call can briefly (or, under load, not-so-briefly) leave the model
// non-empty. Calling `ddcsEditWizardDef` while that's true makes it see a NON-empty program and show its own
// `confirmDestructiveLoad` dialog (a custom `.app-dialog`, not a native one — `page.on('dialog')` cannot see it),
// which nothing here ever clicks — the test then hangs for its full timeout instead of failing informatively.
// Poll for the clear to actually land (bounded, with a clear message) rather than assume it's instant — this is
// what actually broke `wizard-face-1599`'s CUSTOMIZE loop, not a wizard rendering zero fields.
const waitForEmpty = async (page) => {
    for (let i = 0; i < 120; i++) {
        // Check BOTH the model (ddcsGetBlockProgram) AND the Blockly workspace itself (__blkws) — a queued
        // reproject echo can still overwrite the model with a read of a workspace that hasn't finished actually
        // clearing yet (Blockly's own block disposal can lag ws.clear() under load), so the model briefly (or,
        // under load, not so briefly) reads empty while the WORKSPACE still isn't. Require both.
        const state = await page.evaluate(() => ({
            model: (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram() || []).length,
            ws: window.__blkws ? window.__blkws.getAllBlocks().length : -1,
        }));
        if (state.model === 0 && state.ws === 0) return;
        await page.waitForTimeout(250);
    }
    throw new Error('ddcsLoadBlockStack([]) never reflected in both the model and the Blockly workspace after 30s — the reproject echo race (t1766) did not resolve.');
};
// t1766 — even after waitForEmpty confirms BOTH signals clear, `ddcsEditWizardDef` can still — rarely, and only
// under sustained load — race its OWN internal `confirmDestructiveLoad` check against a not-yet-landed echo and
// show its `.app-dialog` confirm ("Opening X in Blocks replaces the program..."). That is a REAL, custom HTML
// dialog, not a native one — `page.on('dialog')` cannot see or dismiss it, so the call just never resolves. A
// real user would simply click "Open (replace)"; do the same here rather than assume the race is fully closed.
const dismissDestructiveLoadIfShown = (page) => {
    (async () => {
        try {
            for (let i = 0; i < 60; i++) {
                const clicked = await page.evaluate(() => {
                    const d = document.querySelector('.app-dialog');
                    const btn = d && Array.from(d.querySelectorAll('button')).find((b) => /open \(replace\)/i.test(b.textContent || ''));
                    if (btn) { btn.click(); return true; }
                    return false;
                });
                if (clicked) return;
                await page.waitForTimeout(100);
            }
        } catch (_) { /* the test moved on (page/context closed, or the loop iteration ended) — nothing to clean up */ }
    })();   // fire-and-forget: races alongside the ddcsEditWizardDef call, no-ops if the dialog never appears
};
/** What the Wizard View tab's CONTENT is — read off whichever host is actually visible (t1734: neither a DOM
 *  class nor a title exists any more; the tab itself is always present regardless of this). t1752 — "which host
 *  is showing" is answered by the SHARED getBlkFormHost (tests/support/blkFormHost.js), its actual source spliced
 *  into the evaluated string (Playwright's own idiom for reusing a browser-side helper) rather than a second
 *  hand-copy of the same visibility check — the next host move is one edit there, not N here. */
const face = async (page) => page.evaluate(`(() => {
    const host = (${getBlkFormHost.toString()})();
    return {
        formText: (host && host.textContent || '').trim(),
        fields: host ? host.querySelectorAll('[data-param]').length : -1,
    };
})()`);

test('CUSTOMIZE renders the wizard\'s form — for a fork-only twin too, which is the one that was broken', async ({ page }) => {
    test.setTimeout(300_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    for (const opType of ['user_surfacing_data', 'user_slot_data', 'user_drill_data', 'user_bore_data', 'user_corner_data']) {
        await page.evaluate(() => window.ddcsLoadBlockStack([]));
        await waitForEmpty(page);
        dismissDestructiveLoadIfShown(page);
        await page.evaluate((t) => window.ddcsEditWizardDef(t), opType);
        await settle(page);
        const f = await face(page);
        // The four fork-only twins are the ones `editWizardDef` clears the editing context for — they had NONE of
        // the three old terms true. Corner rides along to prove the fix did not trade one route for another.
        expect(f.fields, `${opType}: customizing a wizard renders its bound fields`).toBeGreaterThan(0);
    }
});

test('a plain program leaves the Wizard View tab empty — the reverse still holds', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([
        { type: 'progstart', params: { rpm: 12000, clearance: 5 } },
        { type: 'move', params: { x: 10, y: 20, z: 3 } },
        { type: 'progend', params: { retractZ: 20 } },
    ]));
    await settle(page);
    const f = await face(page);
    expect(f.fields, 'no wizard block → no fields conjured').toBe(0);
    // …and it does not leave a message telling the reader to add a block while the program is right there.
    expect(f.formText, 'the form host is truly empty, not carrying stale advice').toBe('');
});

test('a PLACED data-op twin in a program renders its LIVE form — t1740 FOLLOW-UP, was the empty-pane bug', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    // t1740 FOLLOW-UP — see the file header for the full history. This used to assert the OPPOSITE (empty), on
    // the reasoning "a placed op is a program, not an authoring session." The user's own report overturned that:
    // opening a built-in and inserting it is the ORDINARY way most people put an op on the canvas, and they
    // expect the Wizard View tab to show THAT op — proving wizards-as-data ("they are each merely a view of the
    // data"), not just serving the Customize/authoring routes. A non-default dist (912, not the registry's own
    // default of 500) is baked into the placed op's OWN params here specifically so a stale-default render would
    // be VISIBLY wrong, not accidentally right — the empty-pane bug's actual fix is a live-value overlay, not
    // just "stop being empty."
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const OB = await import('/blocks/opBuilders.js');
        const def = U.getUserDef('user_corner_data');
        const params = { ...U.defaultParams(def), dist: 912 };
        window.ddcsLoadBlockStack([OB.makeOp('user_corner_data', params, U.instantiate(def, params))]);
    });
    await settle(page);
    const placed = await page.evaluate(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return { hasOp: !!op, opType: op && op.opType };
    });
    expect(placed.opType, 'the program really does hold a placed data-op twin').toBe('user_corner_data');
    const f = await face(page);
    expect(f.fields, 'a PLACED twin IS the wizard\'s data — the pane must show it, not stay empty').toBeGreaterThan(0);
    // t1748 — Corner is sectioned (hasTree), so it renders through createUserOpView('blk') now, not #blk-form.
    const distField = await page.evaluate(() => {
        const inp = document.querySelector('#blk_wiz_user_form [data-param="dist"]');
        return inp && inp.value;
    });
    expect(Number(distField), 'the LIVE value (912), not the registry default (500)').toBe(912);
});

test('MID-EDIT — a half-built wizard\'s tab SAYS WHAT IS MISSING, never a blank form', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);

    // (1) a bare Define Custom Wizard: nothing in either mouth
    await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'user_root', params: {}, uiChildren: [], children: [] }]));
    await settle(page);
    let f = await face(page);
    expect(f.formText, 'a bare Define Custom Wizard names what is missing, rather than showing an empty form').toMatch(/empty/i);
    expect(f.formText, 'naming the mouth to drop blocks into').toMatch(/Presentation/i);
    expect(f.fields, 'no form fields are drawn — there are none to draw').toBe(0);

    // (2) a Presentation mouth that HAS content but declares no layout and binds no field — an EMPTY Parameter
    //     Group is the shape you get halfway through adding one. A different absence, so a different sentence.
    await page.evaluate(() => window.ddcsLoadBlockStack([{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'param_group', params: { group: 'Settings' }, children: [] }],
        children: [{ type: 'move', params: { x: 0, y: 0, z: 5 } }],
    }]));
    await settle(page);
    f = await face(page);
    expect(f.formText, 'the message distinguishes "no fields yet" from "empty"').toMatch(/no fields yet/i);
    expect(f.formText, 'and names what adds one').toMatch(/Form field/i);

    // (3) …and once the Presentation mouth declares a LAYOUT, the tab stops apologising and renders it. This is the
    //     boundary between the two messages above and the real thing, asserted so a future empty-state cannot creep
    //     forward and start covering a wizard that has something to show.
    await page.evaluate(() => window.ddcsLoadBlockStack([{
        type: 'user_root', params: {},
        uiChildren: [{ type: 'panel', params: { panel: 'form3d' } }],
        children: [{ type: 'move', params: { x: 0, y: 0, z: 5 } }],
    }]));
    await settle(page);
    f = await face(page);
    expect(f.formText, 'a declared layout RENDERS — no empty-state message').not.toMatch(/empty|no fields yet/i);
});
