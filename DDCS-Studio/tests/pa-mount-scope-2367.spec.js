import { test, expect } from '@playwright/test';

/**
 * t2367 — BACKLOG #35's own closure: DORMANT, not a live bug ("nothing currently trips it") — index.html bakes
 * in one hidden `.pa-mount[data-prefix]` per classic wizard shell (drill/pocket/contour/slot/surfacing/text —
 * verified live below: `grep -c 'class="pa-mount"' index.html` = 6, each its OWN distinct prefix). The hazard
 * is `mountPathAnchor(prefix, root = document)` (`ui/pathAnchorField.js`) defaulting to an UNSCOPED, document-
 * wide lookup — the moment ANY code also creates a SECOND `.pa-mount` sharing one of those 6 prefixes (exactly
 * what `formWidgets.js`'s own declared `path_anchor` node render does — it makes a fresh mount for a wizard's
 * TWIN, reproducing the built-in's own prefix faithfully), an unscoped query can no longer tell them apart —
 * the same id-collision shape already fixed twice in this area (t2293, t2319). The 6 legacy static callers
 * (drillView.js etc.) all call it with no `root` and are OUT OF SCOPE here — they are shipped, working
 * classic-wizard code with no live symptom driving a touch (per "surgical changes" — the BACKLOG entry itself
 * calls its own fix sketch "not a prescription"). What IS in scope, and genuinely fixable as a self-contained
 * regression pin: the ONE path this arc's own declared forms reach — `formWidgets.js`'s scoped render already
 * passes its own container as `root` (t2293), so it's supposed to be immune. This test PROVES that live, under
 * the exact two-mounts-one-prefix collision the BACKLOG entry describes, rather than trusting the code shape.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('BACKLOG #35: the DOM precondition is real — six static-shell .pa-mount elements, always present, before anything opens', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    const r = await page.evaluate(() => ({
        total: document.querySelectorAll('.pa-mount').length,
        d_: document.querySelectorAll('.pa-mount[data-prefix="d_"]').length,
    }));
    // index.html bakes in one .pa-mount per classic wizard shell (surfacing/text/slot/pocket/contour/drill),
    // each with its OWN distinct prefix — unconditionally present, no wizard needs to have been opened. The
    // BACKLOG entry's own live measurement found 7 with one synthetic op ALSO open (6 static + 1 live); here,
    // with nothing open yet, it's exactly the 6 static ones.
    expect(r.total, 'the 6 classic-shell copies exist in the DOM from boot, not lazily created on open').toBe(6);
    expect(r.d_, "exactly drill's own static shell uses the 'd_' prefix — the collision needs a SECOND 'd_' mount to appear (test below)").toBe(1);
});

test('BACKLOG #35: a declared path_anchor node (formWidgets.js) mounts into its OWN scope, never colliding with the ever-present static shell sharing its prefix', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);

    // Open drill's own TWIN (user_drill_data) — a "user_"-prefixed op always renders through the GENERIC
    // declared-tree path (formWidgets.js), which is what a fork/CUSTOMIZE result looks like. Its own uiChildren
    // tree declares { type: 'path_anchor', params: { prefix: 'd_' } } (drillData.js), reproducing the built-in
    // faithfully — the SAME 'd_' prefix the always-present static drill shell (index.html) already carries.
    // formWidgets.js creates a BRAND-NEW .pa-mount for this render (not reusing the static one), so the moment
    // this twin opens, TWO elements share data-prefix="d_" — the real collision BACKLOG #35 names, achieved
    // without even needing to have opened the classic built-in drill wizard first.
    await page.evaluate(() => window.ddcsStudio.wizardManager.open('user_drill_data'));
    await page.waitForSelector('#wiz_user', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#wiz_user .pa-mount[data-prefix="d_"]'), null, { timeout: 8000 });

    const result = await page.evaluate(() => {
        const total = document.querySelectorAll('.pa-mount[data-prefix="d_"]').length;
        const ownMount = document.querySelector('#wiz_user .pa-mount[data-prefix="d_"]');
        const built = ownMount ? ownMount.dataset.built === '1' : false;
        // the picker itself must have real interactive content (two corner-grid pickers), not an empty mount —
        // the same "prove the fields, not the wrappers" discipline t2365's own KNOWN GAP investigation used.
        const pickerCount = ownMount ? ownMount.querySelectorAll('svg').length : 0;
        return { total, foundOwnMount: !!ownMount, built, pickerCount };
    });

    expect(result.total, 'two same-prefix mounts now coexist — the static shell plus this twin\'s own — the real collision, not contrived').toBe(2);
    expect(result.foundOwnMount, "the twin's OWN container holds its OWN mount — it was never in question that one exists somewhere; the point is THIS one").toBe(true);
    expect(result.built, "mountPathAnchor built (not skipped) into the twin's own scoped mount").toBe(true);
    expect(result.pickerCount, 'two real corner-grid pickers rendered into the twin\'s own mount, not an empty shell').toBe(2);

    // And the ever-present STATIC shell (index.html, outside #wiz_user) is UNTOUCHED — the scoped render never
    // reached it. If mountPathAnchor's own scoping ever regressed to the unscoped document-wide default, THIS
    // is the mount a document.querySelector('.pa-mount[data-prefix="d_"]') could wrongly hit first instead.
    const staticShellUntouched = await page.evaluate(() => {
        const staticMount = [...document.querySelectorAll('.pa-mount[data-prefix="d_"]')].find((m) => !m.closest('#wiz_user'));
        return staticMount ? { found: true, built: staticMount.dataset.built === '1', empty: staticMount.children.length === 0 } : { found: false };
    });
    expect(staticShellUntouched.found, "the static shell still exists — it wasn't removed, just correctly left alone").toBe(true);
    expect(staticShellUntouched.built, "the static shell's own dataset.built was never set by the twin's scoped render").toBe(false);
    expect(staticShellUntouched.empty, "the static shell stays empty — the twin's pickers rendered into ITS OWN mount, not this one").toBe(true);
});
