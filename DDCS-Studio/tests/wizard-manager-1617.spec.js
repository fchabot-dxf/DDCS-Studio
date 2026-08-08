import { test, expect } from '@playwright/test';

/**
 * t1617 — THE WIZARD MANAGER: the workspace-manager idiom over the wizard registry.
 *
 * The ruled shape: ONE modal owning wizard LIFECYCLE — custom wizards listed (name · forkedFrom provenance · date)
 * with Rename / Duplicate / Delete; built-ins read-only with FORK as their one action; Import/Export `.wiz` via the
 * SAME two shelves the workspace manager proved (granted local folder + the Drive app folder). The duality is ruled:
 * the workspace EMBEDS, the library SHELVES, crossing is an EXPLICIT COPY — no references, no auto-sync, ever.
 *
 * THE TEST THAT MATTERS is the full round trip THROUGH FILES, at the t1593 parity standard: fork a built-in from the
 * manager → rename it → export it → delete it from the workspace → import it back → the def returns IDENTICAL and it
 * EMITS byte-for-byte at off-default values. Anything the crossing quietly drops shows up there and nowhere else.
 *
 * Anti-drift: every assertion reads the REGISTRY (userOps) or the FILE (the fake folder / the fake Drive's writes),
 * never a copy the UI happens to display — and the displayed row is then compared against those same reads.
 */
test.use({ viewport: { width: 1280, height: 900 } });

// the fake Drive route handler evaluates into the page; drop routes before a test ends (the t1257 lesson)
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });

/** A fake granted library folder — the library-sources-1247 rig, verbatim: real files in a Map. */
async function grantLibrary(page, seed = {}) {
    await page.evaluate((files) => {
        const map = window.__lib = new Map(Object.entries(files));
        const fileHandle = (n) => ({
            kind: 'file', name: n,
            getFile: async () => new File([map.get(n)], n),
            createWritable: async () => ({ write: async (t) => map.set(n, t), close: async () => {} }),
            queryPermission: async () => 'granted',
        });
        window.showDirectoryPicker = async () => ({
            kind: 'directory', name: 'DDCS Library',
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            async *entries() { for (const n of [...map.keys()]) yield [n, fileHandle(n)]; },
            getFileHandle: async (n, opts) => {
                if (!map.has(n)) {
                    if (!opts || !opts.create) throw new Error('not found');
                    map.set(n, '');
                }
                return fileHandle(n);
            },
            removeEntry: async (n) => { if (!map.delete(n)) throw new Error('not found'); },
        });
    }, seed);
}

/** The workspace-cloud-tab-1233 fake Drive, trimmed to what the wizard shelf touches. */
const WIZ_FILE = (opType, label) => ({ kind: 'ddcs.wizard', v: 1, op: {
    opType, label, template: [{ type: 'move_rapid', params: { x: 3 } }],
    bindings: [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 3 }], group: 'custom',
} });
async function fakeDrive(page, files) {
    await page.evaluate((seed) => { window.__drive = { files: JSON.parse(JSON.stringify(seed)), writes: [] }; }, files);
    await page.route('https://www.googleapis.com/**', async (route) => {
        const url = route.request().url();
        const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        const state = await page.evaluate(() => window.__drive);
        const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
        if (/in parents/.test(q)) {
            if (/name=/.test(q)) return json({ files: [] });          // the upload's overwrite check
            return json({ files: Object.entries(state.files).map(([id, f]) => ({ id, name: f.name, mimeType: 'application/json', modifiedTime: '2026-08-01T10:00:00.000Z' })) });
        }
        if (/google-apps\.folder/.test(q)) return json({ files: [{ id: 'root-folder' }] });
        if (/\/drive\/v3\/files\/root-folder\?fields=id,trashed/.test(url)) return json({ id: 'root-folder', trashed: false });
        const media = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
        if (media) return json(state.files[media[1]] ? state.files[media[1]].body : {});
        if (/\/upload\/drive\/v3\/files/.test(url)) {
            await page.evaluate((b) => window.__drive.writes.push(b), route.request().postData() || '');
            return json({ id: 'new-file' });
        }
        if (/\/drive\/v3\/about/.test(url)) return json({ user: { displayName: 'Maker', emailAddress: 'maker@example.com' } });
        return json({});
    });
}

const boot = async (page, { signedIn = false } = {}) => {
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => window.openWizardManager && window.ddcsEditWizardDef, null, { timeout: 60000 });
    await page.evaluate((yes) => {
        if (yes) { localStorage.setItem('ddcs_cloud_token', 'tok'); localStorage.setItem('ddcs_cloud_provider', 'google'); localStorage.setItem('ddcs_cloud_email', 'maker@example.com'); }
        localStorage.removeItem('ddcs_gdrive_folder');
    }, signedIn);
};

/** Answer the top in-app dialog: optionally type into its prompt input, then Enter (ok/input holds focus). */
async function answerDialog(page, text) {
    const dlg = page.locator('.app-dialog').last();
    await dlg.waitFor({ state: 'visible', timeout: 8000 });
    if (text != null) await dlg.locator('input').fill(text);
    await page.keyboard.press('Enter');
}

/** Emit the op's program at OFF-DEFAULT numeric values (the t1593 standard: at defaults a dropped value and a kept
 *  one look exactly alike). Same params in → the G-code out; the caller compares the strings byte for byte. */
const emitOffDefaults = (page, opType) => page.evaluate(async (t) => {
    const U = await import('/blocks/userOps.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const d = U.getUserDef(t);
    const P = { ...U.defaultParams(d) };
    let off = 0;
    for (const b of (d.bindings || [])) {
        if (b.type === 'number' || b.type === 'int') { P[b.param] = Number(b.default || 0) + 7; off++; }
    }
    return { gcode: emitProgram(U.instantiate(d, P)), off };
}, opType);

const storedDef = (page, opType) => page.evaluate(async (t) => {
    const U = await import('/blocks/userOps.js');
    return JSON.parse(JSON.stringify(U.listUserOps().find((d) => d.opType === t) || null));
}, opType);

test('THE ROUND TRIP THROUGH FILES: fork a built-in → rename → export → delete → import back → emit byte-identical', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await grantLibrary(page);
    await page.evaluate(() => window.openWizardManager());

    // ── FORK, the real gesture: the Corner built-in row's one action ────────────────────────────────────────────
    const cornerRow = page.locator('#wizmBuiltins .wizm-row').filter({ hasText: 'Corner' }).first();
    await cornerRow.locator('[data-wizm="fork"]').click();
    await answerDialog(page, 'RT Fork');
    await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().some((d) => d.opType === 'user_rt_fork');
    }, null, { timeout: 15000 });

    // the row reads the REGISTRY: provenance from forkedFrom, the date from the def's own savedAt stamp
    const forkDef = await storedDef(page, 'user_rt_fork');
    expect(forkDef.forkedFrom, 'the fork records its source').toBe('user_corner_data');
    expect(forkDef.savedAt, 'creating stamps savedAt on the def').toBeTruthy();
    expect(Array.isArray(forkDef.bindingSpecs) && forkDef.bindingSpecs.length,
        'corner is a bindingSpecs def and the fork INHERITS the specs (t1593)').toBeTruthy();
    const row = page.locator('#wizmMine .wizm-row[data-row="user_rt_fork"]');
    await expect(row.locator('.wizm-prov'), 'provenance names the BUILT-IN, not the twin opType').toHaveText('fork of Corner');
    await expect(row.locator('.wizm-when'), 'the date column is the def savedAt, nothing else').toHaveText(String(forkDef.savedAt).slice(0, 10));

    const before = await emitOffDefaults(page, 'user_rt_fork');
    expect(before.off, 'the parity claim moves real knobs off their defaults').toBeGreaterThanOrEqual(10);

    // ── RENAME ──────────────────────────────────────────────────────────────────────────────────────────────────
    await row.locator('[data-wizm="rename"]').click();
    await answerDialog(page, 'RT Renamed');
    await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        return (U.listUserOps().find((d) => d.opType === 'user_rt_fork') || {}).label === 'RT Renamed';
    }, null, { timeout: 8000 });

    // ── EXPORT to the granted folder (the local shelf is the active tab) ────────────────────────────────────────
    await page.locator('#wizmMine .wizm-row[data-row="user_rt_fork"] [data-wizm="export"]').click();
    await page.waitForFunction(() => window.__lib && window.__lib.has('RT Renamed.wiz'), null, { timeout: 8000 });
    await answerDialog(page);   // the "saved to your library folder" notice
    const fileOp = JSON.parse(await page.evaluate(() => window.__lib.get('RT Renamed.wiz'))).op;
    expect(fileOp.opType, 'the file carries the op under its own identity').toBe('user_rt_fork');
    expect(fileOp.forkedFrom, 'provenance rides the file (it re-attaches hooks on the other side)').toBe('user_corner_data');
    expect(fileOp.savedAt, 'the save stamp rides too, so the round trip returns the def identical').toBeTruthy();
    const beforeDef = await storedDef(page, 'user_rt_fork');

    // ── DELETE from the workspace (the embedded copy dies; the shelf file stays) ───────────────────────────────
    await page.locator('#wizmMine .wizm-row[data-row="user_rt_fork"] [data-wizm="del"]').click();
    await answerDialog(page);
    await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        return !U.listUserOps().some((d) => d.opType === 'user_rt_fork');
    }, null, { timeout: 8000 });
    expect(await page.evaluate(() => window.__lib.has('RT Renamed.wiz')), 'the exported file is untouched by the delete').toBe(true);

    // ── IMPORT it back from the shelf card ─────────────────────────────────────────────────────────────────────
    const card = page.locator('#wizmShelf .lsh-card').filter({ hasText: 'RT Renamed' });
    await expect(card, 'the shelf lists the exported wizard').toBeVisible({ timeout: 8000 });
    await card.click();
    await answerDialog(page);   // "…is in this workspace now"
    await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().some((d) => d.opType === 'user_rt_fork');
    }, null, { timeout: 8000 });

    // ── THE HARSH PART (the library-sources standard, now through the manager's own gestures) ─────────────────
    const afterDef = await storedDef(page, 'user_rt_fork');
    expect(afterDef, 'the def came back IDENTICAL — every field the crossing must carry, it carries').toEqual(beforeDef);
    const after = await emitOffDefaults(page, 'user_rt_fork');
    expect(after.gcode, `EMIT is byte-identical at ${before.off} off-default values`).toBe(before.gcode);

    await page.locator('#wizmOverlay .wsm-modal').screenshot({ path: 'verification/t1617-manager-roundtrip.png' });
});

test('BUILT-INS ARE READ-ONLY — Fork is the one action; a custom row carries the full lifecycle', async ({ page }) => {
    await boot(page);
    // a custom op exists so the two halves can be compared side by side
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('mgr_demo', 'Mgr Demo', [
            { type: 'move_rapid', params: { x: 12, y: 0, z: 5 } },
        ], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 12 }]));
    });
    await page.evaluate(() => window.openWizardManager());

    const builtins = page.locator('#wizmBuiltins .wizm-row');
    expect(await builtins.count(), 'every shipped built-in is listed').toBeGreaterThanOrEqual(20);
    // read-only means the mutating actions DO NOT EXIST in that section — absence, not disabling (t1615's lesson)
    for (const act of ['rename', 'dup', 'del', 'export']) {
        await expect(page.locator(`#wizmBuiltins [data-wizm="${act}"]`), `no “${act}” on any built-in row`).toHaveCount(0);
    }
    expect(await page.locator('#wizmBuiltins [data-wizm="fork"]').count(), 'and every one of them offers Fork').toBe(await builtins.count());
    await expect(page.locator('#wizmBuiltins [data-wizm="fork"][disabled]'),
        'every built-in has a data twin today, so no Fork is dead (pins the all-twins state)').toHaveCount(0);

    const mine = page.locator('#wizmMine .wizm-row[data-row="user_mgr_demo"]');
    for (const act of ['rename', 'dup', 'export', 'del']) {
        await expect(mine.locator(`[data-wizm="${act}"]`), `the custom row offers ${act}`).toHaveCount(1);
    }
    await expect(mine.locator('.wizm-prov'), 'no forkedFrom → authored here').toHaveText('yours');
    await page.locator('#wizmOverlay .wsm-modal').screenshot({ path: 'verification/t1617-readonly-builtins.png' });
});

test('DUPLICATE is a copy under a new identity, provenance kept verbatim', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWizardManager());
    const cornerRow = page.locator('#wizmBuiltins .wizm-row').filter({ hasText: 'Corner' }).first();
    await cornerRow.locator('[data-wizm="fork"]').click();
    await answerDialog(page, 'Dup Base');
    await page.locator('#wizmMine .wizm-row[data-row="user_dup_base"] [data-wizm="dup"]').click();
    await answerDialog(page, 'Dup Copy');
    await page.waitForFunction(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().some((d) => d.opType === 'user_dup_copy');
    }, null, { timeout: 8000 });
    const r = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const a = U.listUserOps().find((d) => d.opType === 'user_dup_base');
        const b = U.listUserOps().find((d) => d.opType === 'user_dup_copy');
        return {
            sameTemplate: JSON.stringify(a.template) === JSON.stringify(b.template),
            sameBindings: JSON.stringify(a.bindings) === JSON.stringify(b.bindings),
            aFrom: a.forkedFrom, bFrom: b.forkedFrom, bV: b.defV,
        };
    });
    expect(r.sameTemplate && r.sameBindings, 'the copy is the def, whole').toBe(true);
    expect(r.bFrom, 'a copy of a fork is still a fork of the SAME source — the one-step hook lookup survives').toBe(r.aFrom);
    expect(r.bV, 'and it starts fresh at v1').toBe(1);
});

test('THE DRIVE SHELF: lists only .wiz in the app folder, EXPORT uploads there, a row imports as a copy', async ({ page }) => {
    await boot(page, { signedIn: true });
    await fakeDrive(page, {
        'w1': { name: 'Shared Lander.wiz', body: WIZ_FILE('user_shared_lander', 'Shared Lander') },
        'w2': { name: 'Other.wizard', body: WIZ_FILE('user_other_share', 'Other Share') },
        'ws': { name: 'a-workspace.ddcs', body: { kind: 'ddcs.backup' } },
    });
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('cloudy', 'Cloudy', [
            { type: 'move_rapid', params: { x: 1 } },
        ], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 1 }]));
    });
    await page.evaluate(() => window.openWizardManager({ place: 'cloud' }));

    // LIST — the two wizard files, the workspace file filtered out, the account named
    const rows = page.locator('#wizmShelf .wsm-fp-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Shared Lander.wiz' })).toHaveCount(1);
    await expect(page.locator('#wizmShelf'), 'a .ddcs is not a wizard and does not show here').not.toContainText('a-workspace');
    await expect(page.locator('#wizmShelf .wsm-cloudbar')).toContainText('maker@example.com');

    // EXPORT — the active tab is where the copy goes (the workspace manager's own rule)
    await page.locator('#wizmMine .wizm-row[data-row="user_cloudy"] [data-wizm="export"]').click();
    await page.waitForFunction(() => window.__drive.writes.length === 1, null, { timeout: 8000 });
    await answerDialog(page);   // "saved to your Drive app folder"
    const upload = await page.evaluate(() => window.__drive.writes[0]);
    expect(upload, 'the upload is the wizard file, name and all').toContain('Cloudy.wiz');
    expect(upload).toContain('ddcs.wizard');
    expect(upload).toContain('user_cloudy');

    // IMPORT — a click on a row copies it into the workspace through the ONE import path
    await rows.filter({ hasText: 'Shared Lander.wiz' }).locator('.wsm-fp-open').click();
    await answerDialog(page);   // "…is in this workspace now"
    const live = await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().some((d) => d.opType === 'user_shared_lander');
    });
    expect(live, 'the Drive row landed in the registry — an explicit copy, no reference').toBe(true);
    await page.locator('#wizmOverlay .wsm-modal').screenshot({ path: 'verification/t1617-drive-shelf.png' });
});

// The two tests below were ADDED AFTER this turn's counted full-suite run (the t1613 precedent: the addition is
// reported, and the file re-ran green in full afterwards) — they close the round-trip's two stated gaps.
test('IMPORT COLLISION is an explicit-copy question — Replace overwrites, Cancel leaves the embedded one', async ({ page }) => {
    await boot(page);
    await grantLibrary(page, { 'Collide.wiz': JSON.stringify(WIZ_FILE('user_collide', 'Collide v2')) });
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('collide', 'Collide v1', [
            { type: 'move_rapid', params: { x: 9 } },
        ], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 9 }]));
    });
    await page.evaluate(() => window.openWizardManager());
    await page.click('#wizmShelf [data-lsh="pick"]');   // the shelf's own first-use folder door
    const card = page.locator('#wizmShelf .lsh-card').filter({ hasText: 'Collide' });
    await expect(card).toBeVisible({ timeout: 8000 });

    // CANCEL: Escape the Replace confirm → the embedded def is untouched
    await card.click();
    await page.locator('.app-dialog').waitFor({ state: 'visible', timeout: 8000 });
    await page.keyboard.press('Escape');
    const labelOf = () => page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        return U.listUserOps().find((d) => d.opType === 'user_collide').label;
    });
    expect(await labelOf(), 'Cancel leaves the workspace copy exactly as it was').toBe('Collide v1');

    // REPLACE: accept → the file's copy overwrites, through the ONE import path
    await card.click();
    await answerDialog(page);          // the Replace confirm (ok holds focus)
    await answerDialog(page);          // "…is in this workspace now"
    expect(await labelOf(), 'Replace is the file copy, whole — an explicit copy, never a merge').toBe('Collide v2');
});

test('“ALSO IN LIBRARY” is a shown content match — never a reference: divergence puts the chip out', async ({ page }) => {
    await boot(page);
    await grantLibrary(page);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        U.createUserOp(U.userOpFromStack('chippy', 'Chippy', [
            { type: 'move_rapid', params: { x: 2 } },
        ], [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 2 }]));
    });
    await page.evaluate(() => window.openWizardManager());
    await page.click('#wizmShelf [data-lsh="pick"]');
    const chip = page.locator('#wizmMine .wizm-row[data-row="user_chippy"] .wizm-inlib');
    await expect(chip, 'no shelf copy yet → no chip').toBeHidden();
    await page.locator('#wizmMine .wizm-row[data-row="user_chippy"] [data-wizm="export"]').click();
    await page.waitForFunction(() => window.__lib && window.__lib.has('Chippy.wiz'), null, { timeout: 8000 });
    await answerDialog(page);   // the export notice
    await expect(chip, 'exported → the chip lights (a content-identical copy is on the shelf)').toBeVisible({ timeout: 8000 });
    // rename the workspace copy → the contents diverge → the chip goes OUT: a match, not a link, nothing synced
    await page.locator('#wizmMine .wizm-row[data-row="user_chippy"] [data-wizm="rename"]').click();
    await answerDialog(page, 'Chippy 2');
    await expect(page.locator('#wizmMine .wizm-row[data-row="user_chippy"] .wizm-inlib'),
        'diverged → no chip: shown by CONTENT, never acted on, never synced').toBeHidden({ timeout: 8000 });
});

test('ENTRY POINTS: the header row beside the workspace manager, and the save dialog’s earned link', async ({ page }) => {
    await boot(page);
    // (a) the quick menu — the workspace manager's sibling
    await page.click('#hdrPostBtn');
    const item = page.locator('#hdrPostMenu [data-act="wizards"]');
    await expect(item, 'the Wizards… row sits in the same menu as Save/Open').toBeVisible();
    await item.click();
    await expect(page.locator('#wizmOverlay'), 'and it opens the manager').toBeVisible();
    await page.keyboard.press('Escape');

    // (b) the save dialog's wording earns a door to the manager
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsEditWizardDef('user_pause_confirm'));
    await page.waitForFunction(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return !!(op && (op.children || []).length) && window.__blkws.getAllBlocks().length > 0;
    }, null, { timeout: 60000 });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    const dlg = page.locator('.blk-dev-savedlg');
    await dlg.waitFor({ state: 'visible', timeout: 30000 });
    const link = dlg.locator('.blk-dev-managewiz');
    await expect(link, 'the wording carries the Manage wizards… door').toBeVisible();
    await link.click();
    await expect(page.locator('.blk-dev-savedlg'), 'the link abandons the save (the stack is untouched)').toHaveCount(0);
    await expect(page.locator('#wizmOverlay'), 'and lands in the manager').toBeVisible();
});
