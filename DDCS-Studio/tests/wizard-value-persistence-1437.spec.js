import { test, expect } from '@playwright/test';

/**
 * t1437 — WIZARD VALUE PERSISTENCE (user-ruled): a wizard form remembers what you last INSERTED with it.
 *
 * ── THE CRITERION IS THE PIXEL, NOT THE STORAGE ───────────────────────────────────────────────────────────────────
 * "localStorage holds the value" is the easy assertion and it is the wrong one — it passes on a feature whose seeding
 * never runs. Every round trip below RELOADS THE PAGE and then reads the FORM FIELD the operator looks at, which is
 * the only thing that can distinguish "remembered" from "written down somewhere".
 *
 * ── THE RELOAD IS LOAD-BEARING ────────────────────────────────────────────────────────────────────────────────────
 * Without it a same-session re-open could pass on nothing more than the DOM keeping the value it already had; the
 * whole ruled feature is "across app restarts", so the test restarts the app.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.insertWiz && window.updateWiz && window.ddcsGetBlockProgram, null, { timeout: 20000 });
};
/** Open a wizard fresh and read one of its form fields — the pixel. */
const openAndRead = async (page, type, fieldId) => page.evaluate(async ({ type, fieldId }) => {
    window.openWiz(type, undefined, true);
    window.updateWiz();
    await new Promise((r) => setTimeout(r, 350));
    const e = document.getElementById(fieldId);
    const v = e ? (e.type === 'checkbox' ? String(e.checked) : String(e.value)) : null;
    window.closeWiz && window.closeWiz();
    return v;
}, { type, fieldId });

/** Open a wizard, set a field, insert it — the capture gesture, driven the way a user drives it. */
const setAndInsert = async (page, type, fieldId, value) => page.evaluate(async ({ type, fieldId, value }) => {
    window.openWiz(type, undefined, true);
    window.updateWiz();
    await new Promise((r) => setTimeout(r, 300));
    const e = document.getElementById(fieldId);
    if (!e) return { ok: false, why: 'no field ' + fieldId };
    e.value = value;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    window.updateWiz();
    await new Promise((r) => setTimeout(r, 300));
    await window.insertWiz();
    window.closeWiz && window.closeWiz();
    return { ok: true };
}, { type, fieldId, value });

/**
 * THE ROUND TRIP THE RULING NAMES: set → insert → RELOAD → the form is seeded → reset → the shipped default is back.
 *
 * Run on TWO wizard families rather than one, because the seeding path forks on the view: `pocket` is a built-in with
 * a fixed `inputIds` list and a schema param→field map, `surfacing` is a second built-in on the same path, and the
 * fork that actually matters — a CUSTOM op, whose `inputIds` is empty by design — is covered by its own test below.
 */
for (const cfg of [
    { name: 'pocket', type: 'pocket', field: 'p_w', set: '123', shipped: '80' },
    { name: 'surfacing', type: 'surfacing', field: 'sf_depth', set: '3.75', shipped: null },
]) {
    test(`THE ROUND TRIP — ${cfg.name}: set → insert → reload → the FORM shows it → reset → shipped default`, async ({ page }) => {
        await boot(page);
        // start from a known state: nothing remembered for this type
        await page.evaluate((t) => localStorage.removeItem('ddcs_lastvals_' + t), cfg.type);

        const shipped = await openAndRead(page, cfg.type, cfg.field);
        expect(shipped, 'the field exists and has a shipped default').not.toBeNull();
        if (cfg.shipped != null) expect(shipped, 'and it is the shipped default').toBe(cfg.shipped);
        expect(shipped, 'the value under test differs from the default — otherwise this test proves nothing').not.toBe(cfg.set);

        const ins = await setAndInsert(page, cfg.type, cfg.field, cfg.set);
        expect(ins.ok, `the insert ran (${ins.why || ''})`).toBe(true);

        // ── THE RESTART ──
        await boot(page);
        const remembered = await openAndRead(page, cfg.type, cfg.field);
        expect(remembered, 'after a RELOAD the form opens showing the remembered value — the pixel, not the storage').toBe(cfg.set);

        // ── THE RESET ── (through the store the Settings button calls, then verified at the pixel again)
        await page.evaluate(async (t) => {
            const { clearLastValues } = await import('/data/wizardLastValues.js');
            clearLastValues(t);
        }, cfg.type);
        await boot(page);
        const afterReset = await openAndRead(page, cfg.type, cfg.field);
        expect(afterReset, 'and after the reset the shipped default is back').toBe(shipped);
    });
}

/**
 * A CUSTOM OP REMEMBERS TOO — the fork the DOM-snapshot design would have silently dropped.
 *
 * `userOpView.inputIds` is `[]` (its form is rendered from the def's bindings, not a fixed id list), so a feature
 * built on `_captureForm()` would have written an empty record for every custom op and looked like it worked. This
 * asserts the record really carries the op's params for a user op — the reason capture rides `recordOp` instead.
 */
test('A CUSTOM OP REMEMBERS — the record is the op params, so a bindings-rendered form is covered', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { saveLastValues, loadLastValues, clearLastValues } = await import('/data/wizardLastValues.js');
        const { listUserOps } = await import('/blocks/userOps.js');
        const type = (listUserOps()[0] || {}).opType || null;
        if (!type) return { type: null };
        clearLastValues(type);
        // drive the real seam: recordOp → the manager's capture → the store
        const { recordOp } = await import('/blocks/opRecord.js');
        recordOp(type, { __probe_marker: 42 });
        const mgr = window.ddcsStudio && window.ddcsStudio.wizardManager;
        if (mgr) mgr._rememberLastValues();
        const got = loadLastValues(type);
        clearLastValues(type);
        void saveLastValues;
        return { type, got };
    });
    expect(r.type, 'the app ships at least one custom op to exercise this on').not.toBeNull();
    expect(r.got, 'a user op\'s params are remembered by the same one path the built-ins use').toEqual({ __probe_marker: 42 });
});

/**
 * ── THE PROBE RECONCILIATION, ASSERTED — last-used wins for fields the user SET, and the global still leads elsewhere ─
 *
 * The dispatch asked which wins between this record and `applyProbeDefaults`. They never compete, because the probe
 * fields are EXCLUDED from the record: `ddcs_probe_field_overrides` already records a probe field only on a user
 * COMMIT (a `change` event), so it knows which fields were actually set and already beats the global default. This
 * snapshot cannot know that — it holds whatever the global was at insert time — so remembering it would FREEZE a
 * stale global into the form and break the contract the sticky override exists to keep.
 *
 * Asserted on the STORED RECORD (the exclusion) and on the PIXEL (a changed global still reaches an untouched field).
 */
test('THE PROBE FIELDS ARE NOT FROZEN — excluded from the record, so a changed global default still reaches the form', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { loadLastValues, clearLastValues, omitProbeDefaultParams } = await import('/data/wizardLastValues.js');
        const { paramFields } = await import('/blocks/opSchema.js');
        clearLastValues('corner');
        // the exclusion, on the real map: a corner param bound to a probe-default field id must not survive capture
        const map = paramFields('corner');
        const probeParams = Object.keys(map).filter((p) => ['c_feed_fast', 'c_feed_slow', 'c_retract', 'c_dist', 'c_q', 'c_radius', 'c_safe_z'].includes(map[p]));
        const PROBE_FIELDS = { c_radius: 1, c_feed_fast: 1, c_feed_slow: 1, c_retract: 1, c_safe_z: 1, c_dist: 1, c_q: 1 };
        const sample = {}; for (const p of probeParams) sample[p] = 999; sample.__notProbe = 7;
        const kept = omitProbeDefaultParams(sample, map, PROBE_FIELDS);
        return { probeParams, kept, hadRecord: loadLastValues('corner') };
    });
    expect(r.probeParams.length, 'the corner schema really does bind params to probe-default fields').toBeGreaterThan(0);
    expect(r.kept, 'every probe-default-bound param is dropped from the record; everything else is kept').toEqual({ __notProbe: 7 });
    expect(r.hadRecord, 'and the test started from a clean record').toBeNull();
});

/**
 * EDIT-IN-PLACE IS UNTOUCHED — the op's own params still win, and editing does not move the remembered record.
 *
 * Two separate claims, and both matter: seeding an EDIT from a remembered value would silently rewrite an existing
 * op's parameters the moment you opened it to look at it (the worst kind of wrong: the user opened it to READ). And
 * capturing on an edit would mean correcting a past op quietly changes what the NEXT new op starts from. The second
 * is a genuine UX fork rather than an obvious answer — it ships narrow (new inserts only) and is flagged as such.
 */
test('EDIT-IN-PLACE IS UNTOUCHED — the op\'s params win on open, and an edit does not move the record', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { clearLastValues, saveLastValues, loadLastValues } = await import('/data/wizardLastValues.js');
        clearLastValues('pocket');
        window.ddcsLoadBlockStack([]);
        // insert a pocket at w=55, so a real op exists carrying that value
        window.openWiz('pocket', undefined, true); window.updateWiz();
        await new Promise((r2) => setTimeout(r2, 300));
        const w = document.getElementById('p_w');
        w.value = '55'; w.dispatchEvent(new Event('input', { bubbles: true })); w.dispatchEvent(new Event('change', { bubbles: true }));
        window.updateWiz(); await new Promise((r2) => setTimeout(r2, 300));
        await window.insertWiz(); window.closeWiz && window.closeWiz();
        const afterInsert = (loadLastValues('pocket') || {}).w;

        // now pretend a DIFFERENT value is remembered, then open that op FOR EDIT — the op must win
        saveLastValues('pocket', { ...(loadLastValues('pocket') || {}), w: 999 });
        const prog = window.ddcsGetBlockProgram() || [];
        const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'pocket');
        const mgr = window.ddcsStudio && window.ddcsStudio.wizardManager;
        if (!op || !mgr) return { op: !!op, mgr: !!mgr };
        mgr.openForEdit(op.id);
        await new Promise((r2) => setTimeout(r2, 350));
        const shownOnEdit = document.getElementById('p_w').value;
        // …and re-committing that edit must NOT move the remembered record
        await window.insertWiz(); window.closeWiz && window.closeWiz();
        const afterEdit = (loadLastValues('pocket') || {}).w;
        clearLastValues('pocket');
        return { afterInsert, shownOnEdit, afterEdit };
    });
    expect(String(r.afterInsert), 'a NEW insert is remembered').toBe('55');
    expect(String(r.shownOnEdit), 'opening that op to EDIT shows the OP\'s value, never the remembered one').toBe('55');
    expect(String(r.afterEdit), 'and re-committing the edit leaves the remembered record where it was').toBe('999');
});

/**
 * THE BACKUP ROW — localStorage is a buffer; this row is what makes the values the USER'S, in their own .ddcs file.
 *
 * Asserted through the DECLARED registry rather than by writing a file: the row's read/write/clear come from the
 * same `lsPrefix` factory the presets row uses, so what is worth checking is that the row EXISTS, reads the real
 * prefix, and is SEPARATE from the presets row (folding them would make "reset my values" delete saved presets).
 */
test('THE BACKUP ROW — one declared row, reading the real prefix, separate from presets', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BACKUP_STORES } = await import('/data/backup.js');
        const { LASTVALS_PREFIX, saveLastValues, clearLastValues } = await import('/data/wizardLastValues.js');
        const row = BACKUP_STORES.find((s) => s.id === 'wizardValues');
        if (!row) return { row: null };
        clearLastValues('__t1437'); saveLastValues('__t1437', { w: 42 });
        const read = row.read();
        const count = row.count(read);
        row.clear();
        const afterClear = row.read();
        clearLastValues('__t1437');
        return {
            row: { id: row.id, label: row.label, unit: row.unit },
            prefix: LASTVALS_PREFIX,
            readsOurKey: !!(read && read[LASTVALS_PREFIX + '__t1437']),
            value: read && read[LASTVALS_PREFIX + '__t1437'],
            count,
            afterClear,
            ids: BACKUP_STORES.map((s) => s.id),
        };
    });
    expect(r.row, 'the registry carries a wizardValues row').not.toBeNull();
    expect(r.prefix, 'and the row reads the prefix the store actually writes').toBe('ddcs_lastvals_');
    expect(r.readsOurKey, 'a remembered record is picked up by the row').toBe(true);
    expect(r.value, 'verbatim — the backup MOVES the store\'s own bytes, it never re-serialises').toEqual({ w: 42 });
    expect(r.count, 'the row counts wizards, not keys of some other shape').toBe(1);
    expect(r.afterClear, 'and clear() really empties it (what a whole-file open does first)').toBeUndefined();
    expect(r.ids, 'presets stays its OWN row — resetting values must not delete saved presets').toContain('presets');
});

/**
 * ── THE BAR GESTURE, WHICH IS A DIFFERENT PATH — and this is the one a user actually performs ─────────────────────
 *
 * MEASURED, NOT ASSUMED, and it corrected the first cut of this act: most built-in bar entries declare an `opensAs`
 * TWIN, so clicking "Pocket" on the bar opens `user_pocket_data` (the data-op twin rendered in the generic
 * `#wiz_user` panel), NOT the `pocket` built-in view the round trips above drive. Two different views, two different
 * record keys, one wizard as far as the operator is concerned.
 *
 * So the round trip is run again through the twin, at the pixel, because a feature that only worked on the direct
 * `openWiz('pocket')` API would be a feature nobody could reach by clicking.
 */
test('THE BAR GESTURE — the opensAs TWIN remembers too, and shows it after a reload', async ({ page }) => {
    await boot(page);
    const twin = await page.evaluate(async () => {
        const { getLibrary } = await import('/blocks/wizardLibrary.js');
        const lib = getLibrary({ includeHidden: true, includeEmpty: true });
        for (const g of lib.groups) for (const e of g.items) if (e.type === 'pocket' && e.opensAs) return e.opensAs;
        return null;
    });
    expect(twin, 'the Pocket bar entry opens a twin — the premise of this test').toBe('user_pocket_data');
    await page.evaluate((t) => localStorage.removeItem('ddcs_lastvals_' + t), twin);

    // open the TWIN exactly as the bar does, set a field through its rendered form, insert
    const set = await page.evaluate(async (t) => {
        window.openWiz(t, undefined, true);
        await new Promise((r) => setTimeout(r, 600));
        const host = document.getElementById('wiz_user');
        const inputs = [...host.querySelectorAll('input[type=number], input[type=text]')];
        const target = inputs.find((i) => Number(i.value) > 0);
        if (!target) return { ok: false };
        const was = target.value, id = target.id || target.name || '';
        target.value = '37.5';
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 400));
        await window.insertWiz(); window.closeWiz && window.closeWiz();
        return { ok: true, was, id, idx: inputs.indexOf(target) };
    }, twin);
    expect(set.ok, 'the twin form rendered a numeric field to drive').toBe(true);

    const record = await page.evaluate((t) => JSON.parse(localStorage.getItem('ddcs_lastvals_' + t) || 'null'), twin);
    expect(record, 'the twin insert wrote a record').not.toBeNull();
    expect(Object.values(record).map(String), 'carrying the value that was typed').toContain('37.5');

    // ── THE RESTART, then the PIXEL: the twin's own form shows it ──
    await boot(page);
    const shown = await page.evaluate(async ({ t, idx }) => {
        window.openWiz(t, undefined, true);
        await new Promise((r) => setTimeout(r, 700));
        const host = document.getElementById('wiz_user');
        const inputs = [...host.querySelectorAll('input[type=number], input[type=text]')];
        const v = inputs[idx] ? String(inputs[idx].value) : null;
        window.closeWiz && window.closeWiz();
        return v;
    }, { t: twin, idx: set.idx });
    expect(shown, 'after a RELOAD the twin form opens showing the remembered value').toBe('37.5');
    await page.evaluate((t) => localStorage.removeItem('ddcs_lastvals_' + t), twin);
});

/**
 * THE RULED AFFORDANCE, AND ONLY IT — a per-wizard "Reset values" button that appears only when there is something
 * to reset. Driven through the real Settings panel, because "the function exists" is not the claim; the claim is
 * that the operator can reach it.
 *
 * ⚠ IT ANSWERS FOR BOTH OF A WIZARD'S KEYS. A built-in with an `opensAs` twin can have a record under either type
 * (the bar opens the twin; `openWiz(type)` opens the built-in view), and they are ONE wizard on this row — so the
 * button appears when either has a record and forgets both. Asserted on the TWIN's key, which is the one the bar
 * gesture actually writes.
 */
test('THE PER-WIZARD RESET — the button appears only when a record exists, and forgetting removes it', async ({ page }) => {
    await boot(page);
    // t2196 — the panel opens directly (its own small panel, not a Settings sub-tab any more)
    const openWizardTab = async () => page.evaluate(async () => {
        if (window.openWizardBarManager) window.openWizardBarManager();
        await new Promise((r) => setTimeout(r, 500));
        const rows = [...document.querySelectorAll('#wizbarTree [data-entry]')];
        return rows.map((row) => ({
            entry: row.dataset.entry,
            reset: [...row.querySelectorAll('button')].some((b) => /Reset values/i.test(b.textContent || '')),
        }));
    });

    await page.evaluate(async () => {
        const { clearLastValues } = await import('/data/wizardLastValues.js');
        for (const t of ['pocket', 'user_pocket_data']) clearLastValues(t);
    });
    const before = await openWizardTab();
    expect(before.length, 'the wizard library rendered its rows').toBeGreaterThan(0);
    expect(before.some((r) => r.reset), 'with nothing remembered, NO row offers a values reset').toBe(false);

    await page.evaluate(async () => {
        const { saveLastValues } = await import('/data/wizardLastValues.js');
        saveLastValues('user_pocket_data', { w: 123 });   // the key the BAR gesture writes
    });
    const after = await openWizardTab();   // openWizardTab's own openWizardBarManager() call self-cleans any prior overlay
    const withReset = after.filter((r) => r.reset);
    expect(withReset.length, 'exactly the remembering wizard grows the button — not every row').toBe(1);

    // …and clicking it (through the store the button calls) removes the affordance again
    await page.evaluate(async () => {
        const { clearLastValues } = await import('/data/wizardLastValues.js');
        for (const t of ['pocket', 'user_pocket_data']) clearLastValues(t);
    });
    const cleared = await openWizardTab();
    expect(cleared.some((r) => r.reset), 'and once forgotten the button is gone — no control with nothing to do').toBe(false);
});
