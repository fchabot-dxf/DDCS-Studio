import { test, expect } from '@playwright/test';

/**
 * t1353 — THE STOCK-PARKING LEAK (user report, held in the mailbox since t1321): a LATHE bar turning up in a MILL
 * workspace, AFTER the per-kind parking shipped.
 *
 * Two hypotheses were on the table. This spec is written to tell them apart on a CLEAN state, because that is the
 * only evidence that distinguishes them:
 *   A — pre-fix damage preserved in the user's stored state (a bar already sitting in the mill slot from before
 *       stockByKind existed). Would need a one-time heal, and would NOT reproduce here.
 *   B — a real path gap that still creates the damage today. Reproduces from clean.
 *
 * THE PATH: opening a .ddcs restores `settings` FIRST (which carries `stock` + `stockByKind`) and the `machine` row
 * SECOND. The machine row calls setMachine, which fires ddcs:machine-changed, which runs applyStockForKind — and that
 * parks "what we are leaving" into the OUTGOING kind's slot. On a restore, "what we are leaving" is not the old
 * workspace's stock at all: settings were already replaced, so it is the INCOMING FILE'S stock. Opening a lathe file
 * from a mill session therefore files the file's own bar under `mill`.
 *
 * The page reload at the end of the open does not save it: applyStockForKind persists through ddcsSaveSettings before
 * the reload, so the poisoned slot is in localStorage by then and survives.
 */
const MILL_BOX = { x: 120, y: 90, z: 25, shape: 'boss', datum: 'nnp', pin: 'origin', show: true };
const LATHE_BAR = { shape: 'cylinder', axis: 'z', origin: 'finished-face', diameter: 33, z: 70, show: true };
const isBar = (st) => !!(st && st.shape === 'cylinder' && st.axis === 'z' && st.origin === 'finished-face');

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('opening a LATHE workspace from a MILL session keeps the file’s bar and leaves the mill slot alone', async ({ page }) => {
    await boot(page);
    // ── a clean MILL session with a mill box on the bed ──
    await page.evaluate(async ({ MILL_BOX }) => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        setMachine({ kind: 'mill', name: 'Bench', controllerId: '' }, false);
        const s0 = window.ddcsGetSettings();
        s0.stock = { ...MILL_BOX };
        delete s0.stockByKind;
        window.ddcsSaveSettings();
    }, { MILL_BOX });

    // ── open a LATHE .ddcs: its settings carry the bar, its machine row says lathe ──
    await page.evaluate(async ({ LATHE_BAR }) => {
        const { restoreBackup } = await import('/data/backup.js');
        const { getMachine } = await import('/data/workspaceMachine.js');
        window.__ddcsNoReload = true;   // the reload is performed by the test below, so we can read the result
        const file = {
            stores: {
                settings: { ...window.ddcsGetSettings(), stock: { ...LATHE_BAR } },
                machine: { ...getMachine(), kind: 'lathe', name: 'Turner' },
            },
        };
        await restoreBackup(file);
    }, { LATHE_BAR });

    // THE REAL OPEN FLOW RELOADS (workspaceManager: restoreBackup → location.reload). That matters: settings live in
    // an IN-MEMORY object, and the restore writes localStorage — so what the app actually runs on is whatever survived
    // to the reload. Testing without it measures a state the user never sees.
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.waitForTimeout(400);

    const r = await page.evaluate(async () => {
        const { getMachine } = await import('/data/workspaceMachine.js');
        const s = window.ddcsGetSettings();
        return { kind: getMachine().kind, stock: s.stock, slots: s.stockByKind || {} };
    });

    console.log('AFTER OPEN → kind=' + r.kind + ' stock=' + JSON.stringify(r.stock) + ' slots=' + JSON.stringify(r.slots));
    expect(r.kind, 'the workspace really did become a lathe').toBe('lathe');
    // (1) THE FILE'S OWN BAR SURVIVES THE OPEN. The t1313 rule: a declared bar is never silently retyped — and an
    // open that replaced it with the default bar would be doing exactly that, quietly, to every lathe workspace.
    expect(isBar(r.stock), 'the opened workspace shows a bar').toBe(true);
    expect(r.stock.diameter, 'and it is the FILE’S bar, not the default one').toBe(LATHE_BAR.diameter);
    // (2) THE SYMPTOM, as the user would meet it: switch to a mill afterwards and find a bar on the bed.
    expect(isBar(r.slots.mill), `the MILL slot must not hold a bar — got ${JSON.stringify(r.slots.mill)}`).toBe(false);
});

test('a REAL kind switch still parks and restores — the fix must not disable the feature it protects', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ MILL_BOX, LATHE_BAR }) => {
        const { setMachine } = await import('/data/workspaceMachine.js');
        window.__ddcsNoReload = true;

        setMachine({ kind: 'mill', name: 'Bench', controllerId: '' }, false);
        const s = window.ddcsGetSettings();
        s.stock = { ...MILL_BOX };
        delete s.stockByKind;
        window.ddcsSaveSettings();

        // the user flips the Kind dropdown: mill → lathe
        setMachine({ kind: 'lathe' }, false);
        await new Promise((res) => setTimeout(res, 60));
        const afterToLathe = { ...window.ddcsGetSettings().stock };
        const slotsA = { ...(window.ddcsGetSettings().stockByKind || {}) };

        // …declares a bar, then flips back to mill
        const s2 = window.ddcsGetSettings();
        s2.stock = { ...LATHE_BAR };
        window.ddcsSaveSettings();
        setMachine({ kind: 'mill' }, false);
        await new Promise((res) => setTimeout(res, 60));
        const afterToMill = { ...window.ddcsGetSettings().stock };
        const slotsB = { ...(window.ddcsGetSettings().stockByKind || {}) };

        // …and back to the lathe once more: the bar must come back exactly as declared
        setMachine({ kind: 'lathe' }, false);
        await new Promise((res) => setTimeout(res, 60));
        const backToLathe = { ...window.ddcsGetSettings().stock };
        return { afterToLathe, slotsA, afterToMill, slotsB, backToLathe };
    }, { MILL_BOX, LATHE_BAR });

    // leaving the mill PARKS the box …
    expect(r.slotsA.mill && r.slotsA.mill.x, 'the mill box is parked on the way out').toBe(MILL_BOX.x);
    // …coming back to the mill RESTORES it …
    expect(r.afterToMill.x, 'and the mill gets its own box back').toBe(MILL_BOX.x);
    expect(isBar(r.afterToMill), 'not a bar').toBe(false);
    // …and the declared bar survives the round trip, which is the t1313 rule.
    expect(isBar(r.backToLathe), 'the lathe gets its bar back').toBe(true);
    expect(r.backToLathe.diameter, 'the very bar that was declared, unretyped').toBe(LATHE_BAR.diameter);
});
