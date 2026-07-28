import { test, expect } from '@playwright/test';

/**
 * t1309 — THE SAVE NAMES THE PROGRAMS IT WROTE.
 *
 * The user's arc: "i would like to see what saved in a label" → the stores got names, then counts qualified them, and
 * a save that changed ONE of three programs still said "Saved programs". The volume is IDB and therefore invisible to
 * the synchronous per-store delta, so the one thing it could never say was WHICH.
 *
 * The item grain is declared on the store itself (a content hash per entry, so no writer has to remember to bump a
 * counter), and every honesty case t1287 ruled stays exactly as it was: no baseline is not "nothing changed".
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Put three programs in the volume and take the baseline, as opening a workspace does. */
const seedThree = (page) => page.evaluate(async () => {
    const P = await import('/ui/projects/projectStore.js');
    const B = await import('/data/backup.js');
    await P.clearAllEntries();
    await P.saveProject('bracket.nc', { code: 'G0 X0', n: 1 });
    await P.saveProject('flange.nc', { code: 'G0 X1', n: 2 });
    await P.saveProject('spacer.nc', { code: 'G0 X2', n: 3 });
    await B.markItemsSavedToFile();
});

const delta = (page) => page.evaluate(async () => {
    const B = await import('/data/backup.js');
    const d = await B.changedItemsSince('projects');
    return { ...d, label: B.changeLabel({ label: 'Saved programs', unit: 'programs', unitOne: 'program', count: d.items.length, items: d.items }) };
});

test('EDIT ONE OF THREE — the save names exactly that one', async ({ page }) => {
    await boot(page);
    await seedThree(page);
    await page.evaluate(async () => {
        const P = await import('/ui/projects/projectStore.js');
        await P.saveProject('flange.nc', { code: 'G0 X1 Y5', n: 2 });   // …the one edit
    });
    const d = await delta(page);
    expect(d.known, 'there is a baseline, so we can name them').toBe(true);
    expect(d.items.map((i) => i.name), 'exactly the edited one').toEqual(['flange.nc']);
    expect(d.items[0].how).toBe('edited');
    expect(d.label, 'and it reads as a program, named').toBe('1 program (flange.nc)');
});

test('DELETE ONE — it says removed, because a deletion that saves silently is the old silence back', async ({ page }) => {
    await boot(page);
    await seedThree(page);
    await page.evaluate(async () => { const P = await import('/ui/projects/projectStore.js'); await P.remove('spacer.nc'); });
    const d = await delta(page);
    expect(d.items).toEqual([{ name: 'spacer.nc', how: 'removed' }]);
    expect(d.label).toBe('1 program (spacer.nc removed)');
});

test('RENAME ONE — the same content under a new name is a RENAME, not an add and a delete', async ({ page }) => {
    await boot(page);
    await seedThree(page);
    await page.evaluate(async () => { const P = await import('/ui/projects/projectStore.js'); await P.rename('bracket.nc', 'bracket-v2.nc'); });
    const d = await delta(page);
    expect(d.items, 'one fact, not two').toEqual([{ name: 'bracket-v2.nc', how: 'renamed' }]);
    expect(d.label).toBe('1 program (bracket-v2.nc renamed)');
});

test('NOTHING CHANGED — the answer is still "nothing", and no program is named', async ({ page }) => {
    await boot(page);
    await seedThree(page);
    const d = await delta(page);
    expect(d.known, 'the baseline is there').toBe(true);
    expect(d.items, 'and it says so by naming nothing').toEqual([]);
});

test('NO BASELINE IS NOT "NOTHING CHANGED" — the t1287 honesty case, unchanged', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const P = await import('/ui/projects/projectStore.js');
        await P.clearAllEntries();
        await P.saveProject('fresh.nc', { code: 'G0' });
        localStorage.removeItem('ddcs_file_item_marks');      // never saved to a file
    });
    const d = await delta(page);
    expect(d.known, 'we cannot say which programs changed, and we do not pretend to').toBe(false);
    expect(d.items).toEqual([]);
    // …and the store-level summary keeps its own honesty: no baseline at all is null, not an empty list
    const rows = await page.evaluate(async () => {
        const B = await import('/data/backup.js');
        localStorage.removeItem('ddcs_file_store_marks');
        return await B.changedSince();
    });
    expect(rows, 'null: the parts cannot be named before the first save').toBeNull();
});

test('THE LABEL CAPS AT THREE NAMES — a phone has to be able to read it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const B = await import('/data/backup.js');
        const mk = (n) => Array.from({ length: n }, (_, i) => ({ name: `program-with-a-long-name-${i + 1}.nc`, how: 'edited' }));
        return {
            three: B.changeLabel({ unit: 'programs', unitOne: 'program', items: mk(3) }),
            five: B.changeLabel({ unit: 'programs', unitOne: 'program', items: mk(5) }),
            other: B.changeLabel({ label: 'Settings + tool table', unit: 'tools', count: 4 }),
        };
    });
    expect(r.three, 'three fit').toMatch(/^3 programs \(program-with-a-long-name-1\.nc, .*-3\.nc\)$/);
    expect(r.five, 'beyond that it counts the rest').toMatch(/\+2 more\)$/);
    expect(r.five.split(',').length, 'three names and the tail — never five').toBe(4);
    expect(r.other, 'and a store with no item grain keeps the count that qualifies it').toBe('Settings + tool table (4 tools)');
});

test('THE POPUP NAMES THEM, and stays readable at 390px with long names', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.evaluate(() => {
        window.ddcsAnnounceSaved({
            ok: true, name: 'shop.ddcs',
            changed: [
                { id: 'settings', label: 'Settings + tool table', unit: 'tools', count: 4 },
                { id: 'projects', label: 'Saved programs', unit: 'programs', unitOne: 'program', count: 5,
                  items: [{ name: 'long-bracket-revision-two.nc', how: 'edited' }, { name: 'flange-outer-face.nc', how: 'edited' },
                          { name: 'spacer.nc', how: 'renamed' }, { name: 'old-fixture.nc', how: 'removed' }, { name: 'new.nc', how: 'added' }] },
            ],
        });
    });
    const r = await page.evaluate(() => {
        const ov = document.getElementById('fileSaveSaid');
        const box = ov && ov.querySelector('div');
        return { text: ov ? ov.textContent : '', w: box ? Math.round(box.getBoundingClientRect().width) : 0,
                 overflow: document.documentElement.scrollWidth > 390 };
    });
    expect(r.text, 'the programs are named').toContain('long-bracket-revision-two.nc');
    expect(r.text, 'with the tail counted, not listed').toContain('+2 more');
    expect(r.text, 'and the other store keeps its qualifying count').toContain('Settings + tool table (4 tools)');
    expect(r.w, 'the popup fits the phone').toBeLessThanOrEqual(390);
    expect(r.overflow, 'and nothing pushes the page sideways').toBe(false);
});

/** Answer the first-save ask (the one-name rule): type a name, then confirm — the folder half aborts in headless. */
async function answerSaveAsk(page, name = 'shop') {
    await page.waitForSelector('#wssAsk', { timeout: 8000 });
    await page.fill('#wssName', name);
    await page.locator('#wssAsk [data-wss="save"]').click();
    await page.waitForFunction(() => { const b = document.querySelector('#wssAsk [data-wss="save"]'); return !b || !/Choose/i.test(b.textContent); }, null, { timeout: 8000 });
    if (await page.locator('#wssAsk').count()) await page.locator('#wssAsk [data-wss="save"]').click();
}

test('THE REAL FLOW — three programs, edit one, press save: the popup names exactly that one', async ({ page }) => {
    await page.addInitScript(() => {
        // a real save through the real path: the picker hands back a handle that captures the bytes
        window.__written = [];
        window.showSaveFilePicker = async () => ({
            name: 'shop.ddcs',
            createWritable: async () => ({ write: async (t) => { window.__written.push(t); }, close: async () => {} }),
            queryPermission: async () => 'granted', requestPermission: async () => 'granted',
        });
    });
    await boot(page);
    await seedThree(page);
    // …the operator opens one program, changes it, and saves the workspace
    await page.evaluate(async () => {
        const P = await import('/ui/projects/projectStore.js');
        await P.saveProject('flange.nc', { code: 'G0 X1 Y5 (faced)', n: 2 });
    });
    // the first save asks for a name (the one-name rule) — answer it the way the persistence spec does
    const saving = page.evaluate(async () => {
        const r = await window.ddcsSaveWorkspace();
        window.ddcsAnnounceSaved(r);
        return { ok: r.ok, changed: r.changed };
    });
    await answerSaveAsk(page);
    const res = await saving;
    expect(res.ok, 'the save went through the real path').toBe(true);
    const programs = (res.changed || []).find((c) => c.id === 'projects');
    expect(programs, 'the summary carries a programs row').toBeTruthy();
    expect(programs.items.map((i) => i.name), 'naming exactly the one that changed').toEqual(['flange.nc']);
    const said = await page.evaluate(() => (document.getElementById('fileSaveSaid') || {}).textContent || '');
    expect(said, 'and the popup says so').toContain('flange.nc');
    expect(said, 'without naming the two that did not change').not.toContain('bracket.nc');
    expect(await page.evaluate(() => window.__written.length), 'one file written').toBe(1);
    // …AND THE BASELINE MOVED: saving again with no further edit says nothing about programs
    await page.evaluate(() => document.getElementById('fileSaveSaid')?.remove());
    const again = await page.evaluate(async () => {
        const r = await window.ddcsSaveWorkspace();   // …the handle is remembered now, so this one is silent and direct
        return (r.changed || []).some((c) => c.id === 'projects');
    });
    expect(again, 'a second save does not re-report what the first one wrote').toBe(false);
});
