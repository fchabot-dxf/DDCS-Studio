import { test, expect } from '@playwright/test';

/**
 * t2365 — OPTION C: FORK-TO-CUSTOM, the arc's payoff. `scratchpad/t2365-fork-to-custom.md`'s own explicit CUT:
 * built-ins stay pristine and read-only (`wizards_as_data_transition_plan.md:193-203`) — this never edits a
 * built-in in place. What travels is the SOURCE's own declared form: Save Custom Wizard on a wizard whose form
 * is a declared `uiChildren` tree (drill, t2299; pocket, t2301) now produces a fork that opens INDISTINGUISHABLE
 * from the source (plan:191) — every field, its label/section grouping, its help — not a generic dropdown-picked
 * layout.
 *
 * THE ROOT DEFECT (found this turn, not assumed): `forkInheritance` (userOps.js, t1593) compares the SOURCE
 * def's own `template` (a def is a standalone builder — progstart/progend live LITERALLY inside its
 * `user_root.children`) against the LIVE PLACED op's `.children` (opBuilders.js's `_framed` lifts progstart/
 * progend OUT to top-level PROGRAM siblings the moment an op is placed, everywhere in this app) — a structural
 * mismatch neither side had ever been asked to bridge before. Any op whose bindings are blockIndex-based (not
 * bindingSpecs-driven — drill and pocket both are) had EVERY SINGLE BINDING silently fail to inherit the
 * moment that binding's own blockIndex pointed anywhere past progstart's position in the flatten (drill's own
 * `rpm`, bound to progstart directly, guaranteed this for the WHOLE stack) — the fork registered with a fully
 * structured, completely EMPTY form. Fixed by `reattachFraming` (devMode.js): splice the candidate's own live
 * progstart/progend back into `user_root.children` at the SAME relative position the source's own template has
 * them, before comparing — not a new mechanism, a missing step in an existing one.
 *
 * TWO ENTRY POINTS, ONE FIXED, ONE PRE-EXISTING GAP FOUND (established, not assumed — see BACKLOG item 3):
 *   INSERT-then-SAVE   place the wizard on the canvas as a real op, then "Save Custom Wizard" from Blocks —
 *                      the gesture this turn's own spec literally verifies. Fixed by this turn for a plain
 *                      (unguarded) wizard — drill, proven below. A GUARDED wizard (pocket, whose form forks
 *                      between structural arms) hits a SEPARATE, PRE-EXISTING refusal here — proven below to
 *                      predate this turn (A/B against bare HEAD hits the identical error) — t1593's own
 *                      "structural fork arms" guard (userOps.js), which exists specifically to catch a guard's
 *                      arms being lost on the Blockly canvas round-trip. It REFUSES LOUDLY with a clear message
 *                      ("re-open the wizard in Blocks and save again") rather than silently registering a
 *                      shorter, wrong program — the "never crash, never a silent empty form" floor BACKLOG item
 *                      3 asks for, even though it is not yet the lossless "indistinguishable" outcome.
 *   CUSTOMIZE          `ddcsEditWizardDef` — loads the wizard's OWN template straight into Blocks (not a placed
 *                      op's lifted shape), the gesture `fork-parity-1593.spec.js` already proves losslessly for
 *                      ALL 32 registered twins, guards included ("the refused set is EMPTY"). Re-confirmed below
 *                      for pocket specifically as this turn's own SECOND wizard (BACKLOG item 4's own
 *                      requirement — proving the mechanism isn't drill-shaped), since it is the gesture that
 *                      actually reaches a guarded wizard's own declared form today.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function boot(page) {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
}

async function insertViaBar(page, { group, optype, label }) {
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: group }).click();
    await page.locator(`.dock-header .toolbar-dropdown-content button[data-optype="${optype}"]`, { hasText: label }).click();
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
}

async function saveAsFork(page, name) {
    await page.click('[data-app="blocks"]');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0);
    // full-suite-observed flake: under heavy parallel load, ddcsGetBlockProgram() can report content before
    // devMode.js's own ddcsSaveAsWizard global finishes attaching — wait for it explicitly, not just a timeout.
    await page.waitForFunction(() => typeof window.ddcsSaveAsWizard === 'function', null, { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { state: 'visible', timeout: 5000 });
    await page.fill('.blk-dev-opname', name);
    await page.click('.blk-dev-save');
    await page.waitForSelector('.blk-dev-savedlg', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(300);
}

/** Open a wizard (built-in or a fork, by opType via wizardManager) and read its own live form shape. */
async function openAndReadForm(page, opener) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await opener();
    await page.waitForTimeout(400);
    return page.evaluate(() => {
        const root = document.querySelector('#wiz_user');
        if (!root) return { found: false };
        const fields = [...root.querySelectorAll('[data-param]')].map((el) => el.dataset.param);
        const sectionTitles = [...root.querySelectorAll('.form-sec-title, .section-label')]
            .filter((el) => el.offsetParent !== null)
            .map((el) => el.textContent);
        const labels = [...root.querySelectorAll('[data-param]')].map((el) => {
            const row = el.closest('.form-row') || el.parentElement;
            const lbl = row && row.querySelector('label, .field-label');
            return lbl ? lbl.textContent.trim() : null;
        }).filter(Boolean);
        return { found: true, fieldCount: fields.length, fields, sectionTitles, labels };
    });
}

test('fork-to-custom (Drill, INSERT-then-SAVE): the fork opens indistinguishable from the source, an edit sticks, the source stays untouched', async ({ page }) => {
    const src = { group: 'Mill', optype: 'drill', label: 'Drill', regOpType: 'user_drill_data', changeParam: 'depth', changeVal: '17.25' };
    await boot(page);
    await insertViaBar(page, src);
    const forkName = `My ${src.label} Fork`;
    await saveAsFork(page, forkName);

    const forkOpType = await page.evaluate(async (label) => {
        const { listUserOps } = await import('/blocks/userOps.js');
        const d = listUserOps().find((x) => x.label === label);
        return d && d.opType;
    }, forkName);
    expect(forkOpType, 'the fork registered').toBeTruthy();

    // 3/4 — open the fork; it must look like the source (same fields, same sections, same labels).
    const forkForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), forkOpType));
    const srcForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), src.regOpType));

    expect(forkForm.found, 'the fork rendered a form pane at all').toBe(true);
    expect(forkForm.fieldCount, `${src.label}'s fork has real fields, not an empty structured shell`).toBeGreaterThan(20);
    expect(forkForm.fields, 'same fields, same order, as the untouched source').toEqual(srcForm.fields);
    expect(forkForm.sectionTitles, 'same section grouping as the source').toEqual(srcForm.sectionTitles);
    expect(forkForm.labels, 'same field labels as the source').toEqual(srcForm.labels);

    await page.screenshot({ path: `test-results/t2365-${src.optype}-fork.png` });

    // 5 — change something in the fork's OWN live form, insert it (the same commit path the wizard's own
    // Insert button uses), and confirm the edited value reached the model — the same write→read round trip
    // drill-form-reproduction-2299.spec.js's own third test proves for the source, now proven for the fork.
    // Canvas cleared first so Insert commits directly (no non-empty-canvas Add/Replace confirm to fight).
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForTimeout(200);
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), forkOpType);
    await page.waitForTimeout(400);
    await page.evaluate((p) => {
        const el = document.querySelector(`#wiz_user [data-param="${p.param}"]`);
        el.value = p.val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { param: src.changeParam, val: src.changeVal });
    await page.waitForTimeout(200);
    await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
    await page.waitForTimeout(300);
    const committed = await page.evaluate((opType) => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.opType === opType);
        return op ? op.params : null;
    }, forkOpType);
    expect(committed, 'the fork committed into the program').toBeTruthy();
    expect(String(committed[src.changeParam]), "the fork's edit reached the committed op").toBe(src.changeVal);

    // 6 — the REAL source's own registered def is untouched by editing/committing the fork's copy (they are
    // two independent opTypes from the moment the fork registers — verified, not just assumed by construction).
    const srcAfter = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), src.regOpType));
    expect(srcAfter.fields, 'the real source still has its own untouched fields').toEqual(srcForm.fields);
    const srcParamValue = await page.evaluate((param) => {
        const el = document.querySelector(`#wiz_user [data-param="${param}"]`);
        return el ? el.value : null;
    }, src.changeParam);
    expect(srcParamValue, "the source's own default did not follow the fork's edit").not.toBe(src.changeVal);

    await page.screenshot({ path: `test-results/t2365-${src.optype}-source-untouched.png` });
});

test('fork-to-custom (Pocket, CUSTOMIZE): the SECOND wizard — proves the mechanism, not drill-shaped special-casing', async ({ page }) => {
    test.setTimeout(90000);
    await boot(page);
    // t2351 — the app's own declared "everything is wired" signal: ddcsStudio+ddcsGetBlockProgram (boot()'s own
    // wait) can resolve true before the Blocks tab's OWN Blockly workspace (__blkws) has mounted.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 30000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_pocket_data'));
    await page.waitForFunction(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return !!(op && (op.children || []).length) && window.__blkws.getAllBlocks().length > 0;
    }, null, { timeout: 60000 });
    // wait for the canvas to settle (a guarded wizard renders hundreds of blocks — fork-parity-1593's own pattern)
    let last = -1;
    for (let i = 0; i < 80; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last && n > 0) break;
        last = n;
        await page.waitForTimeout(250);
    }

    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { state: 'visible', timeout: 5000 });
    await page.fill('.blk-dev-opname', 'My Pocket Fork');
    await page.click('.blk-dev-save');
    await page.waitForSelector('.blk-dev-savedlg', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(300);

    const forkOpType = await page.evaluate(async () => {
        const { listUserOps } = await import('/blocks/userOps.js');
        const d = listUserOps().find((x) => x.label === 'My Pocket Fork');
        return d && d.opType;
    });
    expect(forkOpType, 'the fork registered').toBeTruthy();

    const forkForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), forkOpType));
    const srcForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), 'user_pocket_data'));

    expect(forkForm.found, 'the fork rendered a form pane at all').toBe(true);
    expect(forkForm.fieldCount, "Pocket's fork has real fields, not an empty structured shell").toBeGreaterThan(15);
    expect(forkForm.fields, 'same fields, same order, as the untouched source').toEqual(srcForm.fields);
    expect(forkForm.sectionTitles, 'same section grouping as the source').toEqual(srcForm.sectionTitles);

    await page.screenshot({ path: 'test-results/t2365-pocket-customize-fork.png' });
});

test('KNOWN GAP, established not assumed: Pocket via INSERT-then-SAVE hits a pre-existing, unrelated guard-arm refusal — loud, never silent', async ({ page }) => {
    // No blanket dialog auto-accept here (unlike boot()) — this test needs to READ the one refusal alert's own
    // message, and a page can have only one consumer per dialog.
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetBlockProgram);
    await insertViaBar(page, { group: 'Mill', optype: 'pocket', label: 'Pocket' });
    await page.click('[data-app="blocks"]');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0);
    await page.waitForTimeout(400);

    let dialogMsg = '';
    page.once('dialog', (d) => { dialogMsg = d.message(); d.accept(); });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { state: 'visible', timeout: 5000 });
    await page.fill('.blk-dev-opname', 'Pocket Gap Probe');
    await page.click('.blk-dev-save');
    await page.waitForTimeout(500);

    // t1593's own "structural fork arms" guard (userOps.js) refuses the save with a clear, actionable message —
    // never a silently-registered, wrong-program copy. Pre-existing: an A/B against bare HEAD (this turn's own
    // devMode.js/userOps.js changes stashed) hit the byte-identical refusal, so this is not something t2365
    // introduced — it is the honest "which wizards fall back" answer BACKLOG item 3 asks this turn to report.
    expect(dialogMsg, 'refused loudly, naming the reason and the fix').toMatch(/structural fork arms|building only one arm|only one arm/i);
    const registered = await page.evaluate(async () => {
        const { listUserOps } = await import('/blocks/userOps.js');
        return !!listUserOps().find((d) => d.label === 'Pocket Gap Probe');
    });
    expect(registered, 'never a silent, wrong-program registration').toBe(false);
});
