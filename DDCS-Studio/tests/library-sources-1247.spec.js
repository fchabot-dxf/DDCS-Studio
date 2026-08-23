import { test, expect } from '@playwright/test';

/**
 * t1247 — THE LIBRARY: `.wiz` and `.cam` as SHARED SOURCE.
 *
 * The ruled model: a shared file carries the thing's SOURCE, never its baked output. A `.wiz` is an op's def
 * (template + bindings + declared sim intent), so it imports LIVE and editable — it lands on the bar and opens in
 * Blocks exactly like an op you authored. A `.cam` is a slot's declared `ops` — the buildSlotFromOps INPUT — so an
 * imported recipe rebuilds through the ordinary build path instead of pasting someone else's macro text.
 *
 * Both live in ONE granted library folder, a second directory handle beside the workspaces one.
 *
 * THE TEST THAT MATTERS is the round trip, and it is deliberately harsh: export → WIPE the thing out of the app →
 * import from the file → the def/ops must come back IDENTICAL and the op must still EMIT byte-identically. Anything
 * the file quietly fails to carry shows up there and nowhere else — which is exactly how the missing `group` and
 * `defV` were found while writing it.
 */
test.use({ viewport: { width: 1280, height: 900 } });

/** A fake granted library folder: real files in a Map, so export really writes and the listing really reads. */
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

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.openSettings, null, { timeout: 15000 });
};

/** Author a small user op so there is something real to export. */
const seedOp = (page, opType = 'lib_demo', label = 'Lib Demo') => page.evaluate(async ([t, l]) => {
    const uo = await import('/blocks/userOps.js');
    const def = uo.userOpFromStack(t, l, [
        { type: 'move_rapid', params: { x: 12, y: 0, z: 5 } },
        { type: 'move_line', params: { x: 12, y: 34, z: -2, f: 300 } },
    ], [
        { param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 12 },
        { param: 'depth', label: 'Depth', type: 'number', blockIndex: 1, key: 'z', dflt: -2 },
    ], null, null, 'Probing');
    uo.createUserOp(def);
    return def.opType;
}, [opType, label]);

test('THE .wiz ROUND TRIP: export → wipe the op → import → the def is identical and it emits byte-identically', async ({ page }) => {
    await boot(page);
    await grantLibrary(page);
    const opType = await seedOp(page);

    const r = await page.evaluate(async (t) => {
        const uo = await import('/blocks/userOps.js');
        const wl = await import('/blocks/wizardLibrary.js');
        const lf = await import('/data/libraryFolder.js');

        const before = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitBefore = JSON.stringify(uo.instantiate(before, uo.defaultParams(before)));

        // EXPORT — into the granted folder, as the app does it
        const text = wl.exportWizard(t);
        const w = await lf.writeLibraryFile('Lib Demo', 'wiz', text);

        // WIPE — the op is gone from the registry and from persistence
        uo.deleteUserOp(t);
        const goneAfterDelete = !uo.listUserOps().some((d) => d.opType === t);

        // IMPORT — read it back out of the folder and install it live
        const listed = await lf.listLibrary(['wiz']);
        const entry = listed.find((e) => e.name === w.name);
        const def = wl.importWizard(entry.text);

        const after = JSON.parse(JSON.stringify(uo.listUserOps().find((d) => d.opType === t)));
        const emitAfter = JSON.stringify(uo.instantiate(after, uo.defaultParams(after)));
        return {
            wrote: w, goneAfterDelete, listedNames: listed.map((e) => e.name),
            before, after, emitBefore, emitAfter,
            liveBuilder: !!def && uo.listUserOps().some((d) => d.opType === t),
        };
    }, opType);

    expect(r.wrote.ok, 'the export wrote into the folder').toBe(true);
    expect(r.wrote.name, 'ONE-NAME: the file is named after the wizard').toBe('Lib Demo.wiz');
    expect(r.goneAfterDelete, 'the op really was wiped before the import').toBe(true);
    expect(r.listedNames, 'and the folder lists it').toContain('Lib Demo.wiz');
    expect(r.liveBuilder, 'the import installed it live').toBe(true);
    // the harsh part
    expect(r.after, 'the def came back IDENTICAL — every field the file must carry, it carries').toEqual(r.before);
    expect(r.emitAfter, 'and it emits byte-identically').toBe(r.emitBefore);
});

test('a .wiz carries what cannot be re-derived, and NOT what can', async ({ page }) => {
    await boot(page);
    const opType = await seedOp(page, 'lib_fields', 'Field Carrier');
    const r = await page.evaluate(async (t) => {
        const uo = await import('/blocks/userOps.js');
        const wl = await import('/blocks/wizardLibrary.js');
        const stored = uo.listUserOps().find((d) => d.opType === t);
        const file = JSON.parse(wl.exportWizard(t));
        return { storedKeys: Object.keys(stored).sort(), fileKeys: Object.keys(file.op).sort(), group: file.op.group, defV: file.op.defV };
    }, opType);
    // AUTHORED, so the file must carry them: group is the bar dropdown, defV the version the staleness rule reads
    expect(r.fileKeys, 'the bar dropdown rides along').toContain('group');
    expect(r.group).toBe('Probing');
    expect(r.fileKeys, 'and the author version stamp').toContain('defV');
    expect(r.defV).toBe(1);
    // DERIVED by registerUserOp on import, so storing it would be a second copy free to disagree with the template
    expect(r.fileKeys, 'layout is re-derived from the template, not stored').not.toContain('layout');
    expect(r.storedKeys, 'it does exist on the live def — it is derived, not absent').toContain('layout');
});

test('THE .cam ROUND TRIP: a recipe is the OPS, and importing rebuilds the slot rather than pasting a macro', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const cr = await import('/data/camRecipe.js');
        const slot = {
            slot: 22, name: 'Two-hole plate',
            ops: [
                { type: 'drill', variant: 'peck', values: { depth: { expose: true, dflt: -5 } } },
                { type: 'bore', variant: 'helical', values: { dia: { expose: false, dflt: 12 } } },
            ],
            // the BAKED half — regenerated on every build, and deliberately NOT shareable
            body: 'G0 X0\nG1 Z-5 F100\nM30', fields: [{ idx: 1101 }, { idx: 1102 }],
        };
        const text = cr.camToFile(slot);
        const parsed = JSON.parse(text);
        const back = cr.camFromFile(text);
        return {
            fileKeys: Object.keys(parsed).sort(),
            opsIdentical: JSON.stringify(back.ops) === JSON.stringify(slot.ops),
            name: back.name,
            summary: cr.camSummary(back),
            handBuilt: cr.camToFile({ name: 'legacy', ops: [] }),
        };
    });
    expect(r.fileKeys, 'the file is kind/v/name/ops — the SOURCE, nothing else').toEqual(['kind', 'name', 'ops', 'v']);
    expect(r.fileKeys, 'no baked body rides along').not.toContain('body');
    expect(r.fileKeys, 'nor the allocated form params, which the rebuild re-allocates in the receiving pack').not.toContain('fields');
    expect(r.opsIdentical, 'the ops round-trip identically').toBe(true);
    expect(r.name).toBe('Two-hole plate');
    expect(r.summary).toMatch(/2 operations — drill, bore/);
    expect(r.handBuilt, 'a hand-built slot has NO source to share, and says so by refusing rather than shipping its bake').toBeNull();
});

test('the folder REFUSES a bad file by name — never a flat “invalid file”', async ({ page }) => {
    await boot(page);
    await grantLibrary(page, {
        'not-json.wiz': 'this is not json at all',
        'empty.wiz': '   ',
        'actually-a-cam.wiz': JSON.stringify({ kind: 'ddcs.cam', v: 1, name: 'x', ops: [{ type: 'drill' }] }),
        'stranger.wiz': JSON.stringify({ kind: 'something.else', v: 1 }),
    });
    const errs = await page.evaluate(async () => {
        const lf = await import('/data/libraryFolder.js');
        await lf.ensureLibraryFolder();
        const list = await lf.listLibrary(['wiz']);
        return Object.fromEntries(list.map((e) => [e.name, e.error]));
    });
    expect(errs['not-json.wiz'], 'says WHICH check failed').toMatch(/not valid JSON/);
    expect(errs['empty.wiz']).toMatch(/is empty/);
    expect(errs['actually-a-cam.wiz'], 'names the shape it actually recognised, and the fix').toMatch(/is a CAM recipe \(\.cam\) named \.wiz — rename it/);
    expect(errs['stranger.wiz']).toMatch(/carries no “ddcs.wizard” marker/);
});

test('LISTING AND IMPORTING WRITE NOTHING — only an explicit export touches the folder', async ({ page }) => {
    await boot(page);
    await grantLibrary(page, { 'Shared.wiz': JSON.stringify({ kind: 'ddcs.wizard', v: 1, op: {
        opType: 'user_shared_demo', label: 'Shared Demo', template: [{ type: 'move_rapid', params: { x: 1 } }],
        bindings: [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 1 }], group: 'Probing',
    } }) });
    const r = await page.evaluate(async () => {
        const lf = await import('/data/libraryFolder.js');
        const wl = await import('/blocks/wizardLibrary.js');
        await lf.ensureLibraryFolder();
        const snapshot = () => JSON.stringify([...window.__lib.entries()].sort());
        const before = snapshot();
        const list = await lf.listLibrary(['wiz']);          // LIST
        const afterList = snapshot();
        wl.importWizard(list[0].text);                        // IMPORT
        const afterImport = snapshot();
        return { before, afterList, afterImport, imported: list[0].stem, files: [...window.__lib.keys()] };
    });
    expect(r.afterList, 'listing the folder changed nothing on disk').toBe(r.before);
    expect(r.afterImport, 'and neither did importing').toBe(r.before);
    expect(r.files, 'no stray file appeared').toEqual(['Shared.wiz']);
});

test('NO FOLDER = FAILS CLOSED: the shelf says what it is for and offers one button, and never downloads instead', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { window.showDirectoryPicker = async () => { throw new Error('user declined'); }; });
    const r = await page.evaluate(async () => {
        const lf = await import('/data/libraryFolder.js');
        const list = await lf.listLibrary(['wiz']);
        const got = await lf.ensureLibraryFolder();
        const w = await lf.writeLibraryFile('X', 'wiz', '{}');
        return { listed: list.length, got, write: w };
    });
    expect(r.listed, 'nothing to list without a folder').toBe(0);
    expect(r.got, 'a declined picker yields no folder').toBeNull();
    expect(r.write.ok, 'and the write does not happen').toBe(false);
    expect(r.write.aborted, 'it aborts rather than silently downloading — a download is a one-way door').toBe(true);
});

test('the .wiz shelf is ON THE WIZARD SURFACE, and an imported op lands on the bar', async ({ page }) => {
    await boot(page);
    await grantLibrary(page, { 'Bar Lander.wiz': JSON.stringify({ kind: 'ddcs.wizard', v: 1, op: {
        opType: 'user_bar_lander', label: 'Bar Lander', template: [{ type: 'move_rapid', params: { x: 3 } }],
        bindings: [{ param: 'x', label: 'X', type: 'number', blockIndex: 0, key: 'x', dflt: 3 }], group: 'Probing',
    } }) });
    // t2196 — the tree (and its shelf section) opens in its own small panel now, not a Settings sub-tab
    await page.evaluate(() => window.openWizardBarManager());
    await page.waitForSelector('#wiz_library_shelf', { timeout: 8000 });
    // pick the folder (the shelf's own first-use door), then the card appears
    await page.click('#wiz_library_shelf [data-lsh="pick"]');
    const card = page.locator('#wiz_library_shelf .lsh-card').filter({ hasText: 'Bar Lander' });
    await expect(card, 'the folder’s .wiz shows as a card').toBeVisible({ timeout: 8000 });
    await card.click();
    await expect(page.locator('.app-dialog, .dlg-box').first()).toBeVisible({ timeout: 6000 });
    await page.keyboard.press('Enter');
    const live = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        return uo.listUserOps().some((d) => d.opType === 'user_bar_lander');
    });
    expect(live, 'clicking the card registered the op live — no download, no restart').toBe(true);
});

test('THE .cam ROUND TRIP THROUGH THE REAL SURFACE: export a slot → delete it → import → it REBUILDS byte-identically', async ({ page }) => {
    // The format-level test above proves what the file carries; this one proves the claim that actually matters —
    // that a recipe rebuilds the same macro on the other side. It drives the CAM builder itself: the export button on
    // the slot card, the slot deleted from the pack, the shelf card clicked to import.
    await boot(page);
    await grantLibrary(page);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        const mv = { type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } };
        U.createUserOp(U.userOpFromStack('recipe_op', 'Recipe Op', [mv], U.extractParamBlocks([mv])));
        localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 'pack', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Shared Recipe', ops: [{ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_recipe_op', defV: 1 }] },
        ] }));
    });
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp);
    await page.evaluate(() => window.showApp('macros'));
    await page.evaluate(() => document.querySelector('#macros-app .settings-sidebar .settings-tab[data-target="macros_panel_cam"]').click());
    await page.waitForSelector('#cam_slots .cam-slot', { timeout: 10000 });

    // BUILD it through the surface: Duplicate runs buildSlotFromOps on the clone, so the pack now holds a slot whose
    // body was generated by the app's own build path — the only honest thing to compare a rebuild against.
    await page.click('#cam_slots .cam-slot [data-act="dupslot"]');
    await page.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('ddcs_campack')); return p.slots.length === 2 && p.slots[1].body; }, null, { timeout: 8000 });
    const before = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('ddcs_campack')).slots[1];
        return { ops: s.ops, body: s.body, name: s.name };
    });
    expect(before.body, 'the slot built a real macro body').toBeTruthy();

    // EXPORT from that slot's card
    await page.click('#cam_slots .cam-slot:nth-of-type(2) [data-act="expcam"]');
    await page.waitForFunction(() => window.__lib && [...window.__lib.keys()].some((k) => k.endsWith('.cam')), null, { timeout: 8000 });
    const written = await page.evaluate(() => [...window.__lib.keys()]);
    const camName = written.find((n) => n.endsWith('.cam'));
    expect(camName, 'ONE-NAME again: the recipe is named after the slot').toBe(before.name + '.cam');
    const fileText = await page.evaluate((n) => window.__lib.get(n), camName);
    expect(fileText, 'the file carries the ops').toContain('"ops"');
    expect(fileText, 'and NOT the baked body').not.toContain('"body"');
    await page.keyboard.press('Enter');   // dismiss the "saved to your library folder" notice
    await expect(page.locator('.app-dialog')).toHaveCount(0, { timeout: 6000 });

    // DELETE both slots — the pack no longer holds the recipe in any form
    await page.evaluate(() => { document.querySelectorAll('#cam_slots .cam-slot [data-act="dels"]').forEach(() => document.querySelector('#cam_slots .cam-slot [data-act="dels"]').click()); });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ddcs_campack')).slots.length === 0, null, { timeout: 8000 });

    // IMPORT from the shelf card
    const card = page.locator('#cam_library_shelf .lsh-card').first();
    await expect(card, 'the recipe is on the shelf').toBeVisible({ timeout: 8000 });
    const cardText = await card.innerText();
    await page.click('#cam_library_shelf .lsh-card');   // re-resolved at click time: the shelf re-renders on its own
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ddcs_campack')).slots.length === 1, null, { timeout: 8000 })
        .catch(async () => { throw new Error(`import did not add a slot. card="${cardText}"`); });
    await page.keyboard.press('Enter');   // dismiss the "it is now camN" notice

    const after = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('ddcs_campack')).slots[0];
        return { ops: s.ops, body: s.body, name: s.name };
    });
    expect(after.ops, 'the declared ops came back IDENTICAL').toEqual(before.ops);
    // one-name: buildSlotFromOps names a slot after the ops it generated, so the import restores the recipe's own
    // name (as Duplicate does) — otherwise "X.cam" arrives as a slot called something else and the file stops naming it
    expect(after.name, 'and the name the file is named after').toBe(before.name);
    expect(after.body, 'and rebuilding them produced the same macro, byte for byte').toBe(before.body);
});
