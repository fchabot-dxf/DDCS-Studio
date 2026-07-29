import { test, expect } from '@playwright/test';

/**
 * t1325 (2) — THE AUTHORED PROFILE.
 *
 * A lathe tool's shape is not its type name: two 93° holders grind differently and a parting blade gets re-sharpened.
 * So the silhouette is a plain polyline the user DRAGS into the shape of the tool actually clamped in their post —
 * on the same FeatureCanvas machinery every other handle in the app uses, because a handle is a second way to type a
 * number, never a second source of truth.
 *
 * STARTER, NOT TEMPLATE: each kind's shape is prefilled and then dragged; once dragged it is the user's, stored as
 * plain points and travelling in the .ddcs. Nothing re-derives it from the kind afterwards.
 *
 * AND THE HONESTY, asserted as text where it is consumed: THE CARVE STAYS POINT-INSERT. The profile is drawn; the
 * sim still removes material at the tip point, so a blade's kerf is not swept and a nose radius does not round the
 * simulated corner.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const wm = await import('/data/workspaceMachine.js');
        wm.setMachine({ ...wm.getMachine(), kind: 'lathe' });
        const S = window.ddcsGetSettings();
        S.atc = S.atc || {};
        S.atc.tools = [{ num: 1, name: '93 DCMT', kind: 'turning', leadAngle: 93, noseRadius: 0.4 }];
    });
};

test('EVERY KIND HAS A STARTER, tip at the origin — and it is a COPY, not the declaration', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const TP = await import('/viz/toolProfiles.js');
        const kinds = Object.keys(TP.STARTER_PROFILES);
        const a = TP.starterProfile('parting');
        a[0][0] = 999;   // mutate the returned copy…
        return { kinds, tips: kinds.map((k) => TP.starterProfile(k)[0]), sizes: kinds.map((k) => TP.starterProfile(k).length), afterMutation: TP.starterProfile('parting')[0] };
    });
    expect(r.kinds.sort(), 'a starter for each declared kind').toEqual(['centredrill', 'drill', 'parting', 'turning']);
    for (const tip of r.tips) expect(tip, 'every profile is stored TIP-RELATIVE — the tip is the origin').toEqual([0, 0]);
    for (const n of r.sizes) expect(n, 'and every one is a real polyline').toBeGreaterThanOrEqual(4);
    expect(r.afterMutation, 'the declaration cannot be mutated through the copy it hands out').toEqual([0, 0]);
});

test('AUTHORED WINS OVER STARTER — and the record says which one you are looking at', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { profileOf, starterProfile } = await import('/viz/toolProfiles.js');
        const fresh = profileOf({ kind: 'parting' }, 'parting');
        const ground = profileOf({ kind: 'parting', profile: [[0, 0], [0, 5], [2.4, 5], [2.4, 0]] }, 'parting');
        const junk = profileOf({ kind: 'parting', profile: [['x', null]] }, 'parting');
        return { fresh, ground, junk, starter: starterProfile('parting') };
    });
    expect(r.fresh.authored, 'a new tool is showing a STARTING POINT').toBe(false);
    expect(r.fresh.points, 'namely its kind’s').toEqual(r.starter);
    expect(r.ground.authored, 'a dragged one is the user’s own grind').toBe(true);
    expect(r.ground.points[2], 'kept exactly as stored — nothing re-derives it from the kind').toEqual([2.4, 5]);
    // a corrupt stored profile falls back rather than drawing garbage or throwing
    expect(r.junk.authored, 'unusable points are not an authored profile').toBe(false);
});

test('THE EDITOR IS THE APP’S OWN HANDLE MACHINERY — one handle per point, and a drag writes the shape', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { toolProfileSpec, starterProfile } = await import('/viz/toolProfiles.js');
        const pts = starterProfile('parting');
        let got = null;
        const spec = toolProfileSpec(pts, (next) => { got = next; });
        // the drag the user makes: grab point 2 and pull it
        spec.onDrag('pt2', { x: 4.5, y: 6.5 });
        const kinds = new Set(spec.items.map((i) => i.kind));
        return { handles: spec.handles.length, points: pts.length, ids: spec.handles.map((h) => h.id), tipLabel: spec.handles[0].label, got, kinds: [...kinds] };
    });
    expect(r.handles, 'one handle per point — no more, no fewer').toBe(r.points);
    expect(r.ids[0]).toBe('pt0');
    expect(r.tipLabel, 'the tip is named, because it is the origin everything else is measured from').toBe('tip');
    // ONLY DECLARED ITEM KINDS: FeatureCanvas draws circle/line/rect/hole. An invented kind would draw NOTHING, which
    // is the trap latheProfileCanvas already records — so the silhouette is a chain of lines.
    expect(r.kinds, `the spec uses only kinds the canvas knows: ${JSON.stringify(r.kinds)}`).toEqual(['line']);
    // AND THE DRAG WRITES THE WHOLE POLYLINE — the picture and the stored shape are one object
    expect(r.got, 'the drag produced a new polyline').not.toBeNull();
    expect(r.got[2], 'with the dragged point where it was dropped').toEqual([4.5, 6.5]);
    expect(r.got[0], 'and every other point untouched — handles are independent').toEqual([0, 0]);
});

test('DRAG IT IN THE REAL TABLE — the shape lands on the tool and survives a .ddcs round trip', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const SP = await import('/ui/settingsPanel.js');
        SP.openToolLibrary();
        await new Promise((res) => setTimeout(res, 600));
        // open the editor from the row's silhouette cell, the way a user clicks it
        document.querySelector('#toollib-rows .tl-prof').click();
        await new Promise((res) => setTimeout(res, 600));
        const opened = !!document.getElementById('toolprof-modal');
        const handles = document.querySelectorAll('#toolprof-canvas .fc-handle').length;
        // drag a point through the canvas's own spec (the same call the pointer handler makes)
        const fc = window.ddcsToolProfileCanvas;
        fc.spec.onDrag('pt3', { x: 5.5, y: 9.25 });
        await new Promise((res) => setTimeout(res, 250));
        const stored = window.ddcsGetSettings().atc.tools[0].profile;
        // …and the .ddcs FILE ITSELF: build the backup the way Save does, then wipe the profile and restore from it.
        // The tools ride the settings store the registry already carries, so this asserts the ground shape is
        // WORKSPACE data — not something that lives only in the browser that drew it.
        const backup = await import('/data/backup.js');
        const blob = await backup.buildBackup();
        const inBlob = JSON.parse(JSON.stringify(blob));
        // OVERWRITE THE STORE WITH A DIFFERENT SHAPE first, so the restore has something to actually undo — otherwise
        // the assert would pass on a restore that did nothing at all.
        const KEY = 'ddcs_studio_settings';
        const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
        cur.atc.tools[0].profile = [[1, 1], [2, 2]];
        localStorage.setItem(KEY, JSON.stringify(cur));
        const decoy = JSON.parse(localStorage.getItem(KEY)).atc.tools[0].profile;
        await backup.restoreBackup(inBlob);                     // …and bring the file back into the store
        const afterRestore = JSON.parse(localStorage.getItem(KEY) || '{}').atc.tools[0].profile;
        return { opened, handles, stored, decoy, afterRestore, blobHas: JSON.stringify(blob).indexOf('9.25') >= 0 };
    });
    // THE RELOAD IS THE POINT: settings are read from the store at BOOT, so a restore that only rewrote the store has
    // not proven anything until the app comes back up on it — which is exactly what a user does after opening a .ddcs.
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    r.restored = await page.evaluate(() => (((window.ddcsGetSettings().atc || {}).tools || [])[0] || {}).profile || null);
    expect(r.opened, 'the silhouette cell opens the editor').toBe(true);
    expect(r.handles, 'and the canvas really drew a handle per point').toBeGreaterThan(3);
    // THE DRAG IS STORED AS PLAIN POINTS on the tool record — data, not a shape object
    expect(Array.isArray(r.stored), `the profile landed on the tool: ${JSON.stringify(r.stored)}`).toBe(true);
    expect(r.stored[3], 'carrying the point that was dragged').toEqual([5.5, 9.25]);
    expect(r.stored.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')),
        'and every point is a plain [z,x] pair — JSON-safe, so it travels in the .ddcs unchanged').toBe(true);
    // THE ROUND TRIP, actually performed: the dragged point is IN the file, and it comes back out of it OVER a
    // different stored shape — so the restore is doing the work, not a store that happened to already agree.
    expect(r.blobHas, 'the dragged coordinate is in the .ddcs payload').toBe(true);
    expect(r.decoy, 'the store really did hold something else first').toEqual([[1, 1], [2, 2]]);
    expect(r.afterRestore, `the file put the ground profile back: ${JSON.stringify(r.afterRestore)}`).toEqual(r.stored);
    // …and it is the shape the app BOOTS on, which is what a user opening a .ddcs actually experiences
    expect(r.restored, `after a reload: ${JSON.stringify(r.restored)}`).toEqual(r.stored);
});

test('THE CARVE STAYS POINT-INSERT — said in the code, where the profile is consumed', async ({ page }) => {
    await boot(page);
    const src = await page.evaluate(async () => (await fetch('/viz/toolProfiles.js')).text());
    // v1 HONESTY, asserted as a real property of the source rather than left to a commit message: the module that
    // owns the profile must say that the sim does not sweep it. The round-blank carve set this precedent.
    expect(src, 'the module states the limit').toMatch(/CARVE STAYS\s*\n?\s*\*?\s*POINT-INSERT/i);
    expect(src, 'and says what that means in practice — the kerf is not swept').toMatch(/kerf is not yet cut to width/i);
    expect(src, 'and it repeats at the editor, where a user is looking at the shape').toMatch(/carve is still\s*\n?\s*\*?\s*point-insert/i);
});
