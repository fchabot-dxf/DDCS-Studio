import { test, expect } from '@playwright/test';

/**
 * t2365 — OPTION C: FORK-TO-CUSTOM, the arc's payoff. `scratchpad/t2365-fork-to-custom.md`'s own explicit CUT:
 * built-ins stay pristine and read-only (`wizards_as_data_transition_plan.md:193-203`) — this never edits a
 * built-in in place. What travels is the SOURCE's own declared form: Save Custom Wizard on a wizard whose form
 * is a declared `uiChildren` tree (drill, t2299; pocket, t2301) now produces a fork that opens INDISTINGUISHABLE
 * from the source (plan:191) — every field, its label/section grouping, its help — not a generic dropdown-picked
 * layout.
 *
 * THE ROOT DEFECT (t2365, unguarded wizards): `forkInheritance` (userOps.js, t1593) compares the SOURCE def's
 * own `template` (a def is a standalone builder — progstart/progend live LITERALLY inside its
 * `user_root.children`) against the LIVE PLACED op's `.children` (opBuilders.js's `_framed` lifts progstart/
 * progend OUT to top-level PROGRAM siblings the moment an op is placed, everywhere in this app) — a structural
 * mismatch. Fixed by `reattachFraming` (devMode.js): splice the candidate's own live progstart/progend back
 * into `user_root.children` at the source's own relative position, before comparing.
 *
 * THE DEEPER ROOT (t2367→t2369, GUARDED wizards): `reattachFraming` only repositions data that still exists —
 * a guarded wizard (pocket) placed via Insert has ALREADY lost the untaken structural-fork arm entirely before
 * any fork code runs. `instantiate()`'s own `pruneGuards` call (userOps.js) SPLICES the untaken arm's blocks
 * out of the clone at BUILD time — measured live at t2367: pocket's own `def.template` carries 77 blocks
 * across its structural fork arms, a placed pocket op carries 0. Structural, not a bug in compare/register —
 * `reattachFraming` has nothing left to reattach. Fixed at t2369: `prepareCandidate` (devMode.js), SCOPED to a
 * placed op whose `opType` has a registered def that is GENUINELY guarded (`armBlocks(srcDef.template) > 0`,
 * userOps.js) — sources the fork's BODY from a clone of `getUserDef(opType).template` (the def's own abstract,
 * UNPRUNED template — literally what CUSTOMIZE already reads, so both doors now converge on the same source of
 * shape) instead of the placed instance's pruned `.children` — then seeds each inherited binding's own
 * `.default` from the placed op's live `params` (one source for the SHAPE, one source for the VALUES). An
 * UNGUARDED registered def (drill, and every other twin without a structural fork) → the exact t2365
 * `reattachFraming` path, byte-for-byte unchanged — deliberately NOT widened to every registered def, since an
 * unguarded op's placed `.children` can carry something its def's own template does not (a GUI param block
 * dragged onto a value socket on the canvas after inserting, before saving); only a def that genuinely loses
 * data at LIFT gets the new sourcing.
 *
 * TWO ENTRY POINTS, BOTH LOSSLESS NOW:
 *   INSERT-then-SAVE   place the wizard on the canvas as a real op, then "Save Custom Wizard" from Blocks.
 *                      Lossless for BOTH an unguarded wizard (drill, 37/37 bindings, t2365) and a guarded one
 *                      (pocket, both structural-fork arms present as real editable fields, t2369) — proven
 *                      below for both.
 *   CUSTOMIZE          `ddcsEditWizardDef` — loads the wizard's OWN template straight into Blocks (not a placed
 *                      op's lifted shape); `fork-parity-1593.spec.js` proves this losslessly for ALL 32
 *                      registered twins, guards included ("the refused set is EMPTY") — untouched by t2369,
 *                      reconfirmed below to still hold.
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

test('fork-to-custom (Pocket, INSERT-then-SAVE): BACKLOG #39 closed — both structural-fork arms survive as real, editable fields, and a value set before forking seeds the fork\'s own default', async ({ page }) => {
    test.setTimeout(60000);
    const src = { group: 'Mill', optype: 'pocket', label: 'Pocket', regOpType: 'user_pocket_data' };
    await boot(page);
    await page.locator('.dock-header .toolbar-dropdown > button.wizard-btn', { hasText: src.group }).click();
    await page.locator(`.dock-header .toolbar-dropdown-content button[data-optype="${src.optype}"]`, { hasText: src.label }).click();
    await page.waitForTimeout(400);
    // set a distinctive VALUE before ever inserting — this is the params-seed half BACKLOG #39 asks for: a
    // fork's default must come from the placed op's own live params, never silently reset to the def's own.
    await page.evaluate(() => {
        const el = document.querySelector('[data-param="depth"]');
        el.value = '7.77';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    await page.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    const placedDepth = await page.evaluate(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return op && op.params && op.params.depth;
    });
    expect(String(placedDepth), 'the placed op really carries the pre-fork edit (the precondition, not the point)').toBe('7.77');

    const forkName = 'My Pocket Insert Fork';
    await saveAsFork(page, forkName);
    const forkOpType = await page.evaluate(async (label) => {
        const { listUserOps } = await import('/blocks/userOps.js');
        const d = listUserOps().find((x) => x.label === label);
        return d && d.opType;
    }, forkName);
    expect(forkOpType, 'BACKLOG #39: the fork registers at all — no guard-arm refusal any more').toBeTruthy();

    // THE SHAPE — same fields/sections as the untouched source (the def-template-sourcing branch converges
    // on the exact same body CUSTOMIZE reads).
    const forkForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), forkOpType));
    const srcForm = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), src.regOpType));
    expect(forkForm.found, 'the fork rendered a form pane at all').toBe(true);
    expect(forkForm.fieldCount, "Pocket's fork has real fields, not an empty structured shell").toBeGreaterThan(30);
    expect(forkForm.fields, 'same fields, same order, as the untouched source').toEqual(srcForm.fields);
    expect(forkForm.sectionTitles, 'same section grouping as the source').toEqual(srcForm.sectionTitles);

    // THE VALUES — the fork's own depth field opens pre-filled with the placed op's edit (7.77), not the
    // def's own POCKET_DEFAULTS.depth (4). Fields not wrappers: read the actual live input value.
    const forkDepth = await page.evaluate(() => {
        const el = document.querySelector('#wiz_user [data-param="depth"]');
        return el ? el.value : null;
    });
    expect(forkDepth, "the fork's own default carries the placed op's live edit, not the def's baked default").toBe('7.77');

    // BOTH STRUCTURAL-FORK ARMS ARE REAL, EDITABLE FIELDS — not just structurally present wrappers. Pocket's
    // OWN two structural forks (pocketData.js's own header comment) are `strategy` (raster/spiral) and the
    // geometry-derived `tooSmall`; `strategy` is the one a form field drives directly. `direction` exists only
    // in the raster arm (`when:{param:'strategy',is:'raster'}`, pocketData.js) — its presence AND a real,
    // settable value (not blank/disabled) is the proof this turn's own "prove the fields, not the wrappers"
    // t2367 lesson demands, not just a field COUNT that could still hide an empty/dead control.
    // Canvas cleared first so Insert (below) commits directly — the ORIGINAL placed pocket from the top of
    // this test is still on the canvas otherwise, and a non-empty-canvas Add/Replace/Cancel confirm (a DOM
    // modal, not a native dialog boot()'s auto-accept reaches) would hang the test, same fix t2365's own
    // drill test needed.
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.waitForTimeout(200);
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), forkOpType);
    await page.waitForTimeout(400);
    const strategySwitch = await page.evaluate(() => {
        const strategyEl = document.querySelector('#wiz_user [data-param="strategy"]');
        const before = strategyEl ? strategyEl.value : null;
        if (strategyEl) { strategyEl.value = 'raster'; strategyEl.dispatchEvent(new Event('input', { bubbles: true })); strategyEl.dispatchEvent(new Event('change', { bubbles: true })); }
        return { before, hasStrategyField: !!strategyEl };
    });
    expect(strategySwitch.hasStrategyField, "the fork's own strategy (structural-fork) field exists").toBe(true);
    await page.waitForTimeout(300);
    const raterArmField = await page.evaluate(() => {
        const el = document.querySelector('#wiz_user [data-param="direction"]');
        return el ? { present: true, disabled: el.disabled, options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.value) : null } : { present: false };
    });
    expect(raterArmField.present, "the RASTER arm's own field (direction) exists once strategy=raster — the arm's OWN blocks, not a dead wrapper").toBe(true);
    expect(raterArmField.disabled, "the raster arm's own field is a real, enabled control").toBe(false);
    if (raterArmField.options) expect(raterArmField.options.length, 'a real populated dropdown, not an empty one').toBeGreaterThan(1);

    // commit with strategy=raster and confirm it actually reached the model (the field is not merely visible —
    // it drives the real op, same as the depth round-trip above).
    await page.evaluate(async () => { await window.ddcsStudio.wizardManager.insert(); });
    await page.waitForTimeout(300);
    const committedStrategy = await page.evaluate((opType) => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.opType === opType);
        return op && op.params && op.params.strategy;
    }, forkOpType);
    expect(committedStrategy, "the fork's OTHER arm choice (raster) actually committed into the op").toBe('raster');

    // and the SOURCE's own REGISTERED DEF is untouched throughout — checked at the DATA level, not the DOM:
    // `wizardManager.js`'s own "last-used values" feature (t1437, `open()`'s own seed-on-fresh-open) is a real,
    // pre-existing, UNRELATED convenience — it deliberately re-shows whatever this test itself just placed with
    // depth=7.77 under `user_pocket_data` moments ago (a session memory keyed by opType, working exactly as
    // designed), so the FORM's displayed value is not the right thing to assert here. The actual claim under
    // test — forking never mutates the shared source def — is checked directly against the registry instead.
    const srcAfter = await openAndReadForm(page, () => page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), src.regOpType));
    expect(srcAfter.fields, "the real source's own fields are unaffected").toEqual(srcForm.fields);
    const srcDefCheck = await page.evaluate(async (opType) => {
        const { getUserDef } = await import('/blocks/userOps.js');
        const d = getUserDef(opType);
        const b = (d.bindings || []).find((x) => x.param === 'depth');
        return b ? b.default : null;
    }, src.regOpType);
    expect(srcDefCheck, "the source's own REGISTERED default did not follow the fork's params-seed").toBe(4);

    await page.screenshot({ path: 'test-results/t2369-pocket-insert-fork-raster-arm.png' });
});
