import { test, expect } from '@playwright/test';

/**
 * t1281 — THE LATHE IS VISIBLE. One assert per op, so an empty scene can never pass again.
 *
 * THE BUG THIS GUARDS was not a wrong world, it was NO world: the 3D preview of a lathe op drew the MILL's — a
 * 100×80×20 box and a vertical endmill — because the bar had never been declared into the scene. Three omissions:
 * no `def.simStock` on any lathe twin (so `barToStock()` had no consumer), a cylinder whose axis was guessed from
 * the rotary MOTOR (absent on a lathe → drawn across the machine), and `panel: 'form2d'`, which means the wizard has
 * no 3D pane at all.
 *
 * WHAT THESE ASSERT, precisely: that each op declares a bar of the right size on the right axis at the right datum,
 * that its wizard has somewhere to draw it, and that the traced path lies ON that bar rather than beside it. The
 * SCREENSHOTS are the other half of the evidence — a scene graph can be right while nothing reaches the screen,
 * which is exactly how the canvas bugs of t1273 and t1277 survived their unit tests.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page, kind = 'lathe') => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: k, chuck: 'axis' }, false);
    }, kind);
};

const OPS = ['user_lathe_facing', 'user_lathe_odturn', 'user_lathe_parting', 'user_lathe_centerdrill', 'user_lathe_polygon'];

test('EVERY lathe op declares its BAR into the scene — size, axis and datum', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (types) => {
        const O = await import('/viz/opSimStarts.js');
        const uo = await import('/blocks/userOps.js');
        const out = {};
        for (const t of types) {
            const def = uo.listUserOps().find((d) => d.opType === t);
            const fn = O.getUserSimStock(t);
            const params = uo.defaultParams(def);
            out[t] = {
                panel: def && def.panel,
                stock: typeof fn === 'function' ? fn(params, window.ddcsGetSettings().stock) : null,
                barDiameter: Number(params.barDiameter) || (t.indexOf('polygon') >= 0 ? 25 : 20),
            };
        }
        return out;
    }, OPS);
    for (const t of OPS) {
        const { panel, stock } = r[t];
        // A 2D-only panel is why there was no 3D pane to be empty: the op had nowhere to draw a bar.
        expect(panel, `${t} declares a panel with a 3D pane`).toBe('form3d+2d');
        expect(stock, `${t} declares a sim stock at all — this is the omission that drew the mill's box`).not.toBeNull();
        expect(stock.shape, `${t} draws a bar, not a block`).toBe('cylinder');
        // THE AXIS IS DECLARED, not guessed from a rotary motor a lathe does not have
        expect(stock.axis, `${t} says which way the bar lies — along the bed`).toBe('z');
        expect(stock.origin, `${t} anchors it on the FINISHED FACE, so Z0 is where the frame says`).toBe('finished-face');
        // …and it is THIS OP'S bar: each declares its own default, and the scene must show that one
        expect(stock.diameter, `${t} draws the bar IT declares, not a generic one`).toBe(r[t].barDiameter);
        expect(stock.x, `${t} cross-section is the diameter (a radius here would draw a bar half size)`).toBe(stock.diameter);
        expect(stock.z, `${t} draws its full length — stick-out plus the raw end`).toBeGreaterThan(50);
    }
});

test('THE TRACED PATH lies ON the bar — inside its radius and along its length', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (types) => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const O = await import('/viz/opSimStarts.js');
        const out = {};
        for (const t of types) {
            const def = uo.listUserOps().find((d) => d.opType === t);
            const params = uo.defaultParams(def);
            const nc = String(emitProgram(builderOf(t)(params)));
            const segs = (traceToolpath(nc).segments || []);
            const stock = O.getUserSimStock(t)(params, window.ddcsGetSettings().stock);
            const r0 = stock.diameter / 2, z0 = stock.faceZ, z1 = z0 - stock.z;
            const cuts = segs.filter((s) => !s.rapid && !s.probe);
            out[t] = {
                segs: segs.length,
                cuts: cuts.length,
                // a cutting move is ON the bar when it is within its radius and inside its length
                onBar: cuts.filter((s) => Math.abs(s.x2) <= r0 + 0.001 && s.z2 <= z0 + 0.001 && s.z2 >= z1 - 0.001).length,
                maxX: Math.max(...cuts.map((s) => Math.abs(s.x2))),
                r0, z0, z1,
            };
        }
        return out;
    }, OPS);
    for (const t of OPS) {
        const o = r[t];
        // AN EMPTY SCENE IS THE FAILURE THIS CATCHES: no traced geometry at all
        expect(o.segs, `${t} traces a path at all`).toBeGreaterThan(4);
        expect(o.cuts, `${t} has cutting moves, not only rapids`).toBeGreaterThan(0);
        // …and it is drawn WHERE THE BAR IS, not beside it in some other frame
        expect(o.onBar, `${t}: every cutting move lands on the bar`).toBe(o.cuts);
        expect(o.maxX, `${t} never cuts outside the bar's radius`).toBeLessThanOrEqual(o.r0 + 0.001);
    }
});

test('THE POLYGON SWEEP draws too — A and X together, all of it on the bar', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_polygon');
        const nc = String(emitProgram(builderOf('user_lathe_polygon')(uo.defaultParams(def))));
        const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
        const xs = segs.map((s) => Math.abs(s.x2));
        return { n: segs.length, min: Math.min(...xs), max: Math.max(...xs),
                 aWords: (nc.match(/^G1 [^\n]*A-?[\d.]/gm) || []).length };
    });
    // the sweep is the op — if it does not trace, the picture is empty however good the geometry is
    expect(r.n, 'the sweep traces as many segments as it has A/X pairs').toBeGreaterThan(70);
    expect(r.aWords, 'and the program really does command the chuck').toBeGreaterThan(70);
    expect(r.max, 'nothing reaches outside the bar').toBeLessThanOrEqual(12.5);
    expect(r.min, 'and the flats come in to the apothem').toBeGreaterThan(0);
});

test('A MILL WORKSPACE IS UNTOUCHED — the lathe scene is a declaration, not a global mode', async ({ page }) => {
    await boot(page, 'mill');
    const r = await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        return { isLathe: !!(window.ddcsIsLathe && window.ddcsIsLathe()), kind: M.getMachine().kind,
                 stock: window.ddcsGetSettings().stock.shape };
    });
    expect(r.isLathe, 'a mill workspace does not claim to be a lathe').toBe(false);
    expect(r.kind).toBe('mill');
    // the global stock is still the mill's own — nothing about the lathe scene leaked into it
    expect(r.stock, 'the mill keeps its block stock').not.toBe('cylinder');
});
