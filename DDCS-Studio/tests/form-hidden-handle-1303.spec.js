import { test, expect } from '@playwright/test';

/**
 * t1303 — A HIDDEN ROW IS STILL A SETTABLE PARAM, and the corner pilot's drag handles are the proof.
 *
 * WHAT HAPPENED. t1239 declared corner's derived mirror rows `formHidden` — correctly: they are dragged, not typed.
 * But `formHidden` made the form skip the field ENTIRELY, and the 2D canvas decides whether a param is settable by
 * looking for its rendered `[data-param]` field, then WRITES through that same field. So hiding the row took the
 * handle with it: the op whose whole point is that you drag the marker instead of typing the number lost the marker,
 * and lost the number too. The pilot's canvas offered nothing draggable for four turns.
 *
 * WHY NOBODY SAW IT. The specs that cover it passed inside a full run and failed alone — they were inheriting state
 * from whatever ran before. That is the lie this file exists to prevent: every test below declares its own state.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const freshCorner = async (page) => {
    await page.addInitScript(() => {
        try { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_machine'); localStorage.removeItem('ddcs_panes'); } catch (_) {}
    });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsRefreshWizardBar && window.ddcsGetBlockProgram, null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'mill' }, false);
        // the boot seed already registers the corner twin; re-register only if this build did not, so the spec works
        // whether or not the seed ran — declaring the state it needs rather than assuming either shape.
        const U = await import('/blocks/userOps.js');
        const CD = await import('/blocks/dataOps/cornerData.js');
        if (!U.listUserOps().some((d) => d.opType === CD.CORNER_DATA_OPTYPE)) U.createUserOp(CD.cornerDataDef());
        window.ddcsRefreshWizardBar();
    });
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForTimeout(2000);
};

test('THE CORNER PILOT HAS ITS DRAG HANDLE — the reposition marker the whole op is steered by', async ({ page }) => {
    await freshCorner(page);
    const r = await page.evaluate(() => {
        const c = document.getElementById('userVizContainer');
        return {
            move: c.querySelectorAll('.fc-handle-move').length,        // the AUTO reposition square (wall 2)
            sim: c.querySelectorAll('.fc-handle-sim').length,          // the operator START circle (pass 0)
            hids: [...c.querySelectorAll('[data-hid]')].map((e) => e.getAttribute('data-hid')),
        };
    });
    expect(r.move, 'the wall-2 reposition handle is drawn').toBeGreaterThan(0);
    expect(r.sim, 'and so is the operator start').toBeGreaterThan(0);
});

test('A FORMHIDDEN ROW IS PRESENT AND INVISIBLE — the honest property, both halves of it', async ({ page }) => {
    await freshCorner(page);
    const r = await page.evaluate(() => ['cross1_x', 'cross1_y'].map((p) => {
        const el = document.querySelector(`#wiz_user_form [data-param="${p}"]`);
        const row = el && el.closest('[data-form-hidden]');
        return { p, present: !!el, visible: !!(el && el.offsetParent), marked: !!row, value: el ? el.value : null };
    }));
    for (const f of r) {
        expect(f.present, `${f.p}: the field exists, so the canvas can find and write it`).toBe(true);
        expect(f.visible, `${f.p}: and the user never sees it — the canvas is its editor`).toBe(false);
        expect(f.marked, `${f.p}: marked as declared-out-of-the-form`).toBe(true);
        // …and it is a real field with a value slot. It starts EMPTY here on purpose: this socket's baked default is an
        // EXPRESSION (#15), which a number input cannot show — the drag test below is what proves the round trip.
        expect(f.value, `${f.p}: a real field, not a marker`).not.toBeNull();
    }
});

test('AND DRAGGING IT WRITES THE PARAM — a handle that moves pixels and not the program is the failure this guards', async ({ page }) => {
    await freshCorner(page);
    const before = await page.evaluate(() => {
        const el = document.querySelector('#wiz_user_form [data-param="cross1_x"]');
        return el ? el.value : null;
    });
    // drag the reposition square a real distance across the canvas
    const box = await page.evaluate(() => {
        const h = document.querySelector('#userVizContainer .fc-handle-move');
        const b = h.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 10, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => {
        const el = document.querySelector('#wiz_user_form [data-param="cross1_x"]');
        return el ? el.value : null;
    });
    expect(after, 'the hidden field took the drag').not.toBe(before);
    expect(Number.isFinite(Number(after)), 'as a number the emit can use').toBe(true);
});

test('THE HEADER CHEVRON KEEPS A REAL TOUCH TARGET — its neighbour cannot stand on it', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('ddcs_machine'); } catch (_) {} });
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });   // t1307 — the DECLARED boot signal (t1279): `window.ddcsStudio` exists long before the deferred wiring puts handlers on the header/menu controls this spec clicks
    for (const W of [1366, 390]) {
        await page.setViewportSize({ width: W, height: 844 });
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => {
            const btn = document.getElementById('hdrPostBtn');
            const b = btn.getBoundingClientRect();
            const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
            const on = (x, y) => { const e = document.elementFromPoint(x, y); return e === btn || (e && btn.contains(e)); };
            let hw = 0; for (let d = 0; d <= 30; d++) { if (on(cx - d, cy) && on(cx + d, cy)) hw = d; else break; }
            // …and WHO is standing at the edge of the target, so a failure names the culprit instead of a number
            const at = (x) => { const e = document.elementFromPoint(x, cy); return e ? (e.id || String(e.className) || e.tagName) : 'none'; };
            return { hit: hw * 2, rightEdge: at(cx + 22), leftEdge: at(cx - 22) };
        });
        // The expander is absolute and costs no layout width, which is exactly why a later neighbour could be placed
        // ON it without anything looking wrong: the t1223 save chip took its right half and left 34px (desktop) / 22px
        // (phone). Two controls cannot both own the same pixels — the gap has to be real.
        expect(r.hit, `a 44px target at ${W}px wide (the right edge belongs to ${r.rightEdge})`).toBeGreaterThanOrEqual(44);
        expect(r.rightEdge, `and it is the chevron's own expander out there at ${W}px, not a neighbour`).toBe('hdrPostBtn');
    }
});
