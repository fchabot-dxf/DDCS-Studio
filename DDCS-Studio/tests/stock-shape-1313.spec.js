import { test, expect } from '@playwright/test';

/**
 * t1313 — STOCK HAS A SHAPE, AND THE MODAL SAYS SO.
 *
 * The model already carried it (shape/axis/origin since t1281, and latheSimStock builds the bar); what was missing
 * was the face. Three things are being asserted here, and the middle one is the point of the turn:
 *   · the shape choice is IDENTITY — it decides what every other field means, so it leads
 *   · the lathe modal edits THE ONE BAR RECORD every wizard reads: change the diameter here and the main preview and
 *     the wizard panes follow, because there is no second store to drift
 *   · a mill's box is untouched, both ways
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind, machine) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async ({ k, m }) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: k, chuck: 'axis', ...(m || {}) }, false);
    }, { k: kind, m: machine });
};

const openStock = async (page) => { await page.evaluate(() => window.ddcsOpenStock()); await page.waitForTimeout(700); };
const vis = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); return !!(e && e.offsetParent); }, id);
const stock = (page) => page.evaluate(() => ({ ...window.ddcsGetSettings().stock }));

test('A LATHE WORKSPACE HOLDS A BAR — box greys with the reason, and the datum is stated rather than picked', async ({ page }) => {
    await boot(page, 'lathe');
    await openStock(page);
    const r = await page.evaluate(() => {
        const btn = (k) => document.querySelector(`#se_kind button[data-kind="${k}"]`);
        return {
            on: [...document.querySelectorAll('#se_kind button.on')].map((b) => b.dataset.kind),
            boxDisabled: btn('box').getAttribute('aria-disabled'), boxWhy: btn('box').title,
            why: document.getElementById('se_kind_why').textContent,
            datumFixed: (document.getElementById('se_datum_fixed') || {}).textContent || '',
            gated: document.getElementById('se_datum_pick').classList.contains('axis-gated'),
            featuresWhy: (document.getElementById('se_features_why') || {}).textContent || '',
        };
    });
    expect(r.on, 'cylinder, by declaration').toEqual(['cylinder']);
    expect(r.boxDisabled, 'and box is not a choice here').toBe('true');
    expect(r.boxWhy, 'with the reason under the cursor').toMatch(/BAR stock on the centreline/);
    expect(r.why, 'and beside the picker, where it is read without hovering').toMatch(/BAR stock/);
    // THE DATUM IS NOT A CHOICE: it is the lathe convention, so it is displayed, not offered
    expect(r.gated, 'the corner picker greys').toBe(true);
    expect(r.datumFixed, 'and the line says what the datum IS').toMatch(/centreline.*finished face/);
    expect(r.featuresWhy, 'features stay box-scoped, and say so').toMatch(/box stock only for now/);
    expect(await vis(page, 'se_bar_fields'), 'the bar fields are the ones on screen').toBe(true);
    expect(await vis(page, 'se_box_fields'), 'not the box ones').toBe(false);
});

test('THE MODAL EDITS THE ONE BAR RECORD — change the Ø and the main preview follows, to the pixel', async ({ page }) => {
    await boot(page, 'lathe');
    await openStock(page);
    await page.evaluate(() => {
        const d = document.getElementById('se_bar_dia');
        d.value = '40'; d.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const s = await stock(page);
    expect(s.diameter, 'the record the wizards read').toBe(40);
    expect(s.shape).toBe('cylinder'); expect(s.axis).toBe('z'); expect(s.origin).toBe('finished-face');
    expect(s.z, 'stick-out plus the raw end, through the same builder as latheSimStock').toBe(61);
    // …the MAIN PREVIEW, which is where the user lives: close the modal and look at the bar it draws
    await page.evaluate(() => document.getElementById('se_done').click());
    await page.click('#view-toggle');
    await page.waitForTimeout(1400);
    const drawn = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        // the lathe bar is a REVOLVED profile (a LatheGeometry), so its radius is read off the geometry itself
        const g = v.stockMesh && v.stockMesh.geometry;
        let radius = null;
        if (g) { g.computeBoundingBox(); radius = Math.max(Math.abs(g.boundingBox.min.x), Math.abs(g.boundingBox.max.x)); }
        return { d: v._stock.diameter, axis: v._stock.axis, radius };
    });
    expect(drawn.d, 'the preview holds the same bar').toBe(40);
    expect(drawn.radius, 'and the MESH is drawn at its radius — the chain reaches the pixel').toBeCloseTo(20, 3);
    // …and a WIZARD pane draws the same bar, because it asks the same record
    const wiz = await page.evaluate(async () => {
        // …asked the way the wizard view asks it: through the REGISTRY, since a stored def carries data, not functions
        const { getUserSimStock } = await import('/viz/opSimStarts.js');
        const uo = await import('/blocks/userOps.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
        const fn = getUserSimStock('user_lathe_odturn');
        const st = fn ? fn(uo.defaultParams(def), window.ddcsGetSettings().stock) : null;
        return st && st.diameter;
    });
    expect(wiz, 'the wizard pane too — one record, every consumer').toBe(40);
});

test('A MILL BOX IS UNTOUCHED — the fields, the datum picker, and the round facts absent', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    const before = await stock(page);
    const r = await page.evaluate(() => ({
        on: [...document.querySelectorAll('#se_kind button.on')].map((b) => b.dataset.kind),
        boxDisabled: document.querySelector('#se_kind button[data-kind="box"]').getAttribute('aria-disabled'),
        gated: document.getElementById('se_datum_pick').classList.contains('axis-gated'),
        x: document.getElementById('se_x').value, y: document.getElementById('se_y').value, z: document.getElementById('se_z').value,
    }));
    expect(r.on).toEqual(['box']);
    expect(r.boxDisabled, 'and on a mill it IS a choice').toBe('false');
    expect(r.gated, 'the corner picker is live — a box has corners').toBe(false);
    expect([r.x, r.y, r.z], 'the block dimensions, as they were').toEqual([String(before.x), String(before.y), String(before.z)]);
    expect(before.shape, 'a box variant').toMatch(/boss|pocket/);
    expect(before.diameter, 'and no round facts on it').toBeUndefined();
    expect(await vis(page, 'se_round_fields')).toBe(false);
    expect(await vis(page, 'se_bar_fields')).toBe(false);
});

test('A MILL ROUND BLANK — Ø and height, standing on the table, datum at the CENTRE of the top face', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => {
        const d = document.getElementById('se_rd_dia'), h = document.getElementById('se_rd_len');
        d.value = '60'; d.dispatchEvent(new Event('input', { bubbles: true }));
        h.value = '30'; h.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    const s = await stock(page);
    expect(s.shape).toBe('cylinder');
    expect(s.axis, 'standing on the table').toBe('z');
    expect(s.origin, 'and NOT a lathe bar — it has no finished face').toBeUndefined();
    expect([s.diameter, s.x, s.y, s.z]).toEqual([60, 60, 60, 30]);
    expect(s.datum, 'the centre of the top face — a round blank has no corner to measure from').toBe('ccp');
    const r = await page.evaluate(() => ({
        gated: document.getElementById('se_datum_pick').classList.contains('axis-gated'),
        why: (document.getElementById('se_datum_fixed') || {}).textContent || '',
        axisRow: !!(document.getElementById('se_rd_axis_row') || {}).offsetParent,
    }));
    expect(r.gated, 'so the corner picks grey').toBe(true);
    expect(r.why, 'with the reason said, not just the greying').toMatch(/no corner to pick/);
    expect(r.axisRow, 'and no axis choice on a machine that declares no rotary').toBe(false);
});

test('THE ALONG-THE-ROTARY CHOICE EXISTS ONLY WHERE A ROTARY IS DECLARED', async ({ page }) => {
    await boot(page, 'mill');
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        s.motors = { ...(s.motors || {}), a: { role: 'rotary', around: 'x' } };
        window.ddcsSaveSettings && window.ddcsSaveSettings();
    });
    await openStock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
        row: !!(document.getElementById('se_rd_axis_row') || {}).offsetParent,
        opts: [...document.querySelectorAll('#se_rd_axis option')].map((o) => o.value),
    }));
    expect(r.row, 'the declaration is what makes the choice real').toBe(true);
    expect(r.opts, 'standing on the table, or along the declared rotary').toEqual(['z', 'x']);
});

test('SWITCHING BACK TO BOX RESTORES A BOX — both ways, with no round facts left behind', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    const before = await stock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(300);
    expect((await stock(page)).shape).toBe('cylinder');
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="box"]').click());
    await page.waitForTimeout(300);
    const after = await stock(page);
    expect(after.shape, 'a box again').toBe(before.shape);
    expect([after.x, after.y, after.z], 'with the dimensions it had').toEqual([before.x, before.y, before.z]);
    expect(after.diameter, 'and the round facts cleared off it').toBeUndefined();
    expect(after.axis).toBeUndefined();
    expect(after.datum, 'its own datum back').toBe(before.datum);
});

test('DONE WITH NOTHING CHANGED IS A VALID CONFIRM — the standing stock-modal ruling', async ({ page }) => {
    await boot(page, 'lathe');
    const before = await stock(page);
    await openStock(page);
    await page.evaluate(() => document.getElementById('se_done').click());
    await page.waitForTimeout(400);
    const after = await stock(page);
    expect(after, 'the record is exactly what it was').toEqual(before);
    expect(await page.evaluate(() => !!document.querySelector('.stock-editor-pop')), 'and the modal closed').toBe(false);
});

test('THE SHAPE TRAVELS — a round blank survives the .ddcs round trip', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
        const B = await import('/data/backup.js');
        const before = { ...window.ddcsGetSettings().stock };
        const obj = await B.buildBackup();
        // …wipe it back to a box (and PERSIST the wipe — the live object is not re-read from storage), then restore
        window.ddcsGetSettings().stock = { x: 10, y: 10, z: 10, shape: 'boss', datum: 'nnp' };
        window.ddcsSaveSettings && window.ddcsSaveSettings();
        await B.restoreBackup(obj);
        // …read what a RELOAD would read: the persisted settings. (The live object is a cache; the file is the fact.)
        let persisted = null;
        try { persisted = (JSON.parse(localStorage.getItem('ddcs_studio_settings') || 'null') || {}).stock || null; } catch (_) {}
        return { before, inFile: (obj.stores.settings || {}).stock, persisted };
    });
    expect(r.inFile.shape, 'the shape is written into the file').toBe('cylinder');
    expect(r.inFile.diameter, 'with its diameter').toBe(r.before.diameter);
    expect(r.inFile.datum, 'and its datum').toBe('ccp');
    expect(r.persisted.shape, 'and restoring the file puts it back where a reload will find it').toBe('cylinder');
    expect(r.persisted.diameter).toBe(r.before.diameter);
});

test('THE ROUND BLANK RENDERS ROUND — a cylinder on the table, and the carve does not square it off', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => { const d = document.getElementById('se_rd_dia'); d.value = '60'; d.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('se_done').click());
    await page.click('#view-toggle');
    await page.waitForTimeout(1400);
    const r = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        v.setCarve(true);   // …material removal ON, which is what a mill program turns on
        const g = v.stockMesh && v.stockMesh.geometry;
        return { type: g && g.type, radius: g && g.parameters && g.parameters.radiusTop, carveMesh: !!v._carveMesh, visible: !!(v.stockMesh && v.stockMesh.visible) };
    });
    expect(r.type, 'the blank is a cylinder in the scene').toBe('CylinderGeometry');
    expect(r.radius, 'at its declared radius').toBeCloseTo(30, 3);
    // THE HEIGHTMAP IS A RECTANGULAR GRID: carving a round blank with it would replace the disc with a square slab —
    // a picture of a workpiece the machine does not have. It keeps its shape instead (the round carve is its own job).
    expect(r.carveMesh, 'no square slab replaces it').toBe(false);
    expect(r.visible, 'the round blank is what stays on screen').toBe(true);
});

test('A CYLINDER IS DIAMETER AND LENGTH ONLY — no W/D/H rows, in either workspace (t1313 amendment)', async ({ page }) => {
    // USER, live: a round workpiece has two sizes, not three. Any x/y/z a downstream consumer still reads off the
    // record is DERIVED (x = y = Ø, z = the length) — never typed, and never shown as something to type.
    for (const kind of ['lathe', 'mill']) {
        await boot(page, kind);
        await openStock(page);
        if (kind === 'mill') {
            await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
            await page.waitForTimeout(300);
        }
        const r = await page.evaluate(() => {
            const shown = (id) => { const e = document.getElementById(id); return !!(e && e.offsetParent); };
            return { x: shown('se_x'), y: shown('se_y'), z: shown('se_z'), box: shown('se_box_fields'),
                     fields: [...document.querySelectorAll('.stock-editor-pop input')].filter((i) => i.offsetParent).map((i) => i.id) };
        });
        expect(r.x, `${kind}: no W field on round stock`).toBe(false);
        expect(r.y, `${kind}: no D field`).toBe(false);
        expect(r.z, `${kind}: no H field`).toBe(false);
        expect(r.box, `${kind}: the box group is not on screen at all`).toBe(false);
        // …and what IS on screen is the two (or three, on a lathe) numbers a round workpiece actually has
        const want = kind === 'lathe' ? ['se_bar_dia', 'se_bar_out', 'se_bar_allow'] : ['se_rd_dia', 'se_rd_len'];
        expect(r.fields.filter((f) => /se_(x|y|z|bar_|rd_)/.test(f)), `${kind}: exactly the round fields`).toEqual(want);
    }
});

test('AND THE DERIVED TRIO TRACKS THE Ø — x = y = diameter, z = the length', async ({ page }) => {
    await boot(page, 'mill');
    await openStock(page);
    await page.evaluate(() => document.querySelector('#se_kind button[data-kind="cylinder"]').click());
    await page.waitForTimeout(300);
    const set = async (id, v) => { await page.evaluate(({ i, val }) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, { i: id, val: v }); await page.waitForTimeout(250); };
    await set('se_rd_dia', '52'); await set('se_rd_len', '18');
    let s = await stock(page);
    expect([s.x, s.y], 'the cross-section IS the diameter, both ways').toEqual([52, 52]);
    expect(s.z, 'and the axial dimension is the length').toBe(18);
    await set('se_rd_dia', '31');
    s = await stock(page);
    expect([s.diameter, s.x, s.y], 'a Ø edit moves the derived pair with it').toEqual([31, 31, 31]);
    expect(s.z, 'and leaves the length alone').toBe(18);
    // …the same rule on a lathe, where the length is the stick-out plus the raw end
    await boot(page, 'lathe');
    await openStock(page);
    await set('se_bar_dia', '28'); await set('se_bar_out', '70'); await set('se_bar_allow', '2');
    const b = await stock(page);
    expect([b.x, b.y], 'the bar cross-section is its diameter').toEqual([28, 28]);
    expect(b.z, 'and its length is what stands out plus the raw end').toBe(72);
});
