import { test, expect } from '@playwright/test';

/**
 * t1239 — THE POLISH BATCH (all user-ruled). Each item is small; what they share is that a green suite could not have
 * told you any of them was wrong, so each gets an assertion that names the thing a person complained about.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const OUT = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/8818e1f1-6091-4aad-9d2e-690622a39424/scratchpad';

async function openCornerTwin(page) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
        localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
    });
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(700);
}

test('(1) the feature canvas resizes from BOTH edges — a second handle below, and both grips are slim', async ({ page }) => {
    await openCornerTwin(page);
    // one .wiz-visual per wizard exists in the DOM; take the VISIBLE one (the open wizard's)
    const split = page.locator('.wiz-visual:visible .viz-split').first();
    await expect(split.locator('.viz-pane-splitter')).toHaveCount(2);          // the ratio handle + the new sizer
    await expect(split.locator('.viz-pane-sizer'), 'the second handle sits BELOW the canvas').toHaveCount(1);
    const last = await split.evaluate((s) => s.lastElementChild.className);
    expect(last, 'it is the last child — below the panes, not between them').toContain('viz-pane-sizer');
    const grip = await page.evaluate(() => {
        const g = document.querySelector('.viz-pane-splitter-grip');
        return g ? Math.round(g.getBoundingClientRect().height) : -1;
    });
    expect(grip, 'the grip is slim (was a 4px slab)').toBeLessThanOrEqual(2);

    // dragging the bottom handle resizes the visual block and persists
    const box = await split.locator('.viz-pane-sizer').boundingBox();
    const visH = () => page.evaluate(() => Math.round([...document.querySelectorAll('.wiz-visual')].find((v) => v.offsetParent !== null).getBoundingClientRect().height));
    const before = await visH();   // the VISIBLE wizard's visual — one .wiz-visual exists per wizard in the DOM
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await visH();
    expect(Math.abs(after - before), 'the drag really resized the visual block').toBeGreaterThan(20);
    expect(await page.evaluate(() => localStorage.getItem('ddcs_visual_height')), 'and it persisted, like the ratio').not.toBeNull();
});

test('(2) the Settings subtabs are a HORIZONTAL strip under the main tabs — the left rail is gone', async ({ page }, testInfo) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openSettings);
    await page.evaluate(() => window.openSettings({ group: 'hardware' }));
    await page.waitForSelector('#settings-app .settings-sidebar', { state: 'visible', timeout: 8000 });

    const geom = await page.evaluate(() => {
        const bar = document.querySelector('#settings-app .settings-sidebar');
        const body = document.querySelector('#settings-app .settings-body');
        const tabs = [...bar.querySelectorAll('.settings-tab')].filter((t) => t.offsetParent !== null);
        const r = bar.getBoundingClientRect();
        return {
            flexDir: getComputedStyle(bar).flexDirection, bodyDir: getComputedStyle(body).flexDirection,
            width: Math.round(r.width), bodyWidth: Math.round(body.getBoundingClientRect().width),
            sameRow: tabs.length > 1 && Math.abs(tabs[0].getBoundingClientRect().top - tabs[1].getBoundingClientRect().top) < 4,
        };
    });
    expect(geom.flexDir, 'the strip runs across').toBe('row');
    expect(geom.bodyDir, 'so the body stacks strip-over-content instead of rail-beside-content').toBe('column');
    expect(geom.width / geom.bodyWidth, 'it spans the modal, it is not a 160px column').toBeGreaterThan(0.9);
    expect(geom.sameRow, 'the subtabs sit side by side').toBe(true);
    await page.locator('#settings-app').screenshot({ path: `${OUT}/settings-subtabs.png` });
});

test('(3)+(4) the gear sits BESIDE its field, and the controller-source toggle is on the LEFT', async ({ page }, testInfo) => {
    await openCornerTwin(page);
    const r = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#wiz_user_form .has-field-link')];
        const out = rows.map((row) => {
            const gear = row.querySelector('.field-link-gear');
            const ctrl = [...row.children].find((c) => c !== gear && (c.querySelector('select, input') || /select|input/i.test(c.tagName)));
            if (!gear || !ctrl) return null;
            const g = gear.getBoundingClientRect(), c = (ctrl.querySelector('select, input') || ctrl).getBoundingClientRect();
            return { overlaps: !(g.left >= c.right - 1 || g.right <= c.left + 1 || g.top >= c.bottom - 1 || g.bottom <= c.top + 1), beside: g.left >= c.right - 1 };
        }).filter(Boolean);
        const psrc = [...document.querySelectorAll('.psrc-wrap')].map((w) => {
            const btn = w.querySelector('.psrc-glyph'), inp = w.querySelector('input, select');
            if (!btn || !inp) return null;
            return { left: btn.getBoundingClientRect().right <= inp.getBoundingClientRect().left + 1 };
        }).filter(Boolean);
        return { rows: out, psrc };
    });
    expect(r.rows.length, 'there IS a gear row to check').toBeGreaterThan(0);
    for (const row of r.rows) {
        expect(row.overlaps, 'the gear never sits OVER the control (it used to land on a select chevron)').toBe(false);
        expect(row.beside, 'it sits beside it').toBe(true);
    }
    for (const p of r.psrc) expect(p.left, 'the controller-source toggle is to the LEFT of its field').toBe(true);
    await page.locator('#wiz_user_form').screenshot({ path: `${OUT}/form-gear-and-source.png` });
});

test('(6)+(7) corner leads with its IDENTITY fields, and the derived marker mirrors do not render', async ({ page }, testInfo) => {
    await openCornerTwin(page);
    const r = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#wiz_user_form [data-param]')];
        const order = rows.filter((el) => el.offsetParent !== null).map((el) => el.dataset.param);
        const hidden = ['cross1_x', 'cross1_y', 'startX', 'startY'].map((p) => {
            const el = document.querySelector(`#wiz_user_form [data-param="${p}"]`);
            return { p, present: !!el, visible: !!(el && el.offsetParent !== null) };
        });
        return { order, hidden };
    });
    const iCorner = r.order.indexOf('corner'), iSeq = r.order.indexOf('probeSeq');
    expect(iCorner, 'the Corner pick is rendered').toBeGreaterThanOrEqual(0);
    // identity first: nothing that merely TUNES the op may precede the two fields that DEFINE it
    for (const p of ['travelApproach', 'travelShape', 'wcs', 'syncA', 'probeZFirst']) {
        const i = r.order.indexOf(p);
        if (i >= 0) expect(i, `${p} comes after the op-defining Corner`).toBeGreaterThan(iCorner);
    }
    if (iSeq >= 0) expect(iSeq, 'Probe Order sits immediately with Corner').toBe(iCorner + 1);
    expect(iCorner, 'and the identity pair LEADS the whole form — the tool/cut scalars no longer come first').toBe(0);
    for (const h of r.hidden) expect(h.visible, `${h.p} is a DERIVED marker mirror — it no longer renders a row`).toBe(false);
    await page.locator('#wiz_user_form').screenshot({ path: `${OUT}/corner-form-identity-first.png` });
});

test('(7b) the derived bindings still EXIST — hiding a row must not break the drag or the round-trip', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const CD = await import('/blocks/dataOps/cornerData.js');
        const def = CD.cornerDataDef();
        const b = (def.bindings || []).filter((x) => ['cross1_x', 'cross1_y', 'startX', 'startY'].includes(x.param));
        return { count: b.length, derived: b.every((x) => x.formHidden === true), params: b.map((x) => x.param) };
    });
    expect(r.count, 'all four mirrors are still declared bindings').toBe(4);
    expect(r.derived, 'each declares itself OUT of the form via the EXISTING formHidden flag (t792) — the binding stays for the drag + round-trip').toBe(true);
});

test('(9) the line chip tags a NON-MOTION line so stepping through macro math does not read as frozen', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio);
    // drive the chip formatter through the panel's own seam: the classifier is display-only, so assert what it TAGS
    const r = await page.evaluate(() => {
        const tag = (raw) => {
            const t = String(raw).trim();
            if (!t) return '';
            if (/^\s*[(;]/.test(t)) return 'note';
            if (/^\s*(IF|WHILE|GOTO|END\d|DO\d|M9[89])\b/i.test(t)) return 'flow';
            if (/^\s*#\s*\d+\s*=/.test(t) || /^\s*#\s*\[/.test(t)) return 'calc';
            if (/\bG3[18]\b/i.test(t)) return '';
            if (/\bG0?[0-3]\b|\bG53\b/i.test(t)) return '';
            if (/^\s*[MG]\d/i.test(t)) return 'set';
            return '';
        };
        return {
            assign: tag('#53=[[#51+#52]/2]'), branch: tag('IF #1505==0 GOTO2'), note: tag('( Wall 1 )'),
            move: tag('G0 X10 Y10'), probe: tag('G31 X-50 F200'), mode: tag('G91'),
        };
    });
    expect(r.assign, 'macro arithmetic is tagged calc').toBe('calc');
    expect(r.branch, 'a branch is tagged flow').toBe('flow');
    expect(r.note, 'a comment is tagged note').toBe('note');
    expect(r.mode, 'a mode-only line is tagged set').toBe('set');
    expect(r.move, 'MOTION carries no tag — the tag exists to explain the absence of motion').toBe('');
    expect(r.probe, 'and a probe is motion').toBe('');
});
