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

/**
 * t1313 — THIS SPEC DECLARES THE BAR IT TESTS. The stock modal made the WORKSPACE record the one bar in the chuck,
 * so an op's own `barDiameter` default no longer outranks it (that default WAS the parallel store the redesign
 * removed). Every hand-derived truth below is against a Ø20 bar, so the workspace is told to hold one — which is
 * what a turner would have done before running any of this.
 */
const setBar = (page, diameter = 20, stickOut = 60) => page.evaluate(async ({ d, so }) => {
    // built straight from the declared bar shape — NOT through latheSimStock, which now (correctly) prefers the
    // workspace bar and would therefore hand back the one already there instead of the one being asked for
    const { barStock } = await import('/data/stockShape.js');
    window.ddcsGetSettings().stock = barStock({ diameter: d, stickOut: so, allowance: 1 }, window.ddcsGetSettings().stock);
    try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
}, { d: diameter, so: stickOut });

const boot = async (page, kind = 'lathe') => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async (k) => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: k, chuck: 'axis' }, false);
    }, kind);
    if (kind === 'lathe') await setBar(page);   // t1313 — a LATHE workspace holds the Ø20 bar these truths are derived against; a mill keeps its block
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
        // t1313 — THE PREMISE CHANGED BY RULING, and the new one is the point of the stock redesign: the bar in the
        // chuck is a fact about the SETUP, so every op draws the WORKSPACE's bar. Each op still carries its own
        // default for a workspace that declares none — asserted separately below, where that state is set up.
        expect(stock.diameter, `${t} draws the bar the WORKSPACE declares — one record, every pane`).toBe(20);
        expect(stock.x, `${t} cross-section is the diameter (a radius here would draw a bar half size)`).toBe(stock.diameter);
        expect(stock.z, `${t} draws its full length — stick-out plus the raw end`).toBeGreaterThan(50);
    }
});

test('…AND ITS OWN DEFAULT STILL STANDS when the workspace declares no bar', async ({ page }) => {
    // t1313 — the fallback half of the same rule. A workspace holding a mill's BOX has not said what is in the
    // chuck, so an op falls back to the bar it declares rather than drawing nothing (or a box).
    await boot(page);
    const r = await page.evaluate(async (types) => {
        const O = await import('/viz/opSimStarts.js');
        const uo = await import('/blocks/userOps.js');
        window.ddcsGetSettings().stock = { x: 100, y: 80, z: 20, shape: 'boss', datum: 'nnp', show: true };   // no bar declared
        try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
        const out = {};
        for (const t of types) {
            const def = uo.listUserOps().find((d) => d.opType === t);
            const fn = O.getUserSimStock(t);
            const params = uo.defaultParams(def);
            out[t] = { d: fn(params, window.ddcsGetSettings().stock).diameter, own: Number(params.barDiameter) || (t.indexOf('polygon') >= 0 ? 25 : 20) };
        }
        return out;
    }, OPS);
    for (const t of OPS) expect(r[t].d, `${t} falls back to the bar IT declares`).toBe(r[t].own);
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
        const { barStock } = await import('/data/stockShape.js');
        for (const t of types) {
            const def = uo.listUserOps().find((d) => d.opType === t);
            const params = uo.defaultParams(def);
            // t1313 — DECLARE THE BAR THIS OP IS BEING RUN AGAINST. The scene follows the WORKSPACE bar now, while the
            // emit is still sized from the op's own default (polygon's across-flats is drawn for a Ø25 bar) — so the
            // two only agree when the workspace holds the bar the program was written for, which is what a turner
            // would have. Whether the emit should follow the workspace bar too is a G-code change, and is FLAGGED.
            const own = Number(params.barDiameter) || (t.indexOf('polygon') >= 0 ? 25 : 20);
            window.ddcsGetSettings().stock = barStock({ diameter: own, stickOut: Number(params.stickOut) || 60, allowance: 1 }, window.ddcsGetSettings().stock);
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

// ── t1293 — ONE BAR, ON THE CENTRELINE ──────────────────────────────────────────────────────────────────────────

/**
 * A user orbited the scene and saw bars floating beside the origin. They were not extra bars: they were THE bar and
 * its chuck, in the wrong place. The box path pivots the part group on the stock CENTRE and compensates each mesh by
 * −C; a turned bar is authored on the axis already, and the profile carve rebuilds its mesh at the origin — dropping
 * a compensation the group was still applying. Everything ended up half a bar off in X and Y.
 *
 * A bar on centres has no datum corner: X is a radius FROM the axis and Z runs ALONG it. So its group sits at zero
 * and its children speak absolute coordinates — the same numbers the carve, the emit and the 2D all use.
 */
test('ONE BAR, ON THE AXIS — and the only other cylinder in the scene is the chuck', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.openWiz('user_lathe_odturn'));
    // de-sleep (Phase 2 browser-tier wait audit) — openWiz()/update()/preview3D() are synchronous all the way to the scene existing (traced
    // through wizardManager.js/userOpView.js/createPreviewPanel.js — no async gap there), but the lathe's own
    // END-STATE CARVE (createPreviewPanel.js's scheduleEndStateCarve, ~line 320-340) is DELIBERATELY DEFERRED
    // one requestAnimationFrame "so it never blocks setGcode/a drag/a wizard open" — and it is what rebuilds
    // the bar's own mesh (a lathe "always carves its profile", the comment there says), which this test reads
    // (v.stockMesh). A double-rAF flush is the real condition ("has the scheduled carve frame run"), not a
    // guessed duration — resolves as soon as that one frame passes instead of always waiting 1800ms for it.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const r = await page.evaluate(() => {
        const v = window.__ddcsActiveViz;
        if (!v || !v.scene) return null;
        const vis = (o) => { let q = o; while (q) { if (!q.visible) return false; q = q.parent; } return true; };
        const bars = [];
        v.scene.traverse((o) => {
            const t = o.geometry && o.geometry.type;
            if (!t || !/Cylinder|Lathe/.test(t) || !vis(o)) return;
            const p = new v.THREE.Vector3(); o.getWorldPosition(p);
            const r0 = o.geometry.parameters ? o.geometry.parameters.radiusTop : null;
            bars.push({ t, x: +p.x.toFixed(2), y: +p.y.toFixed(2),
                        stock: o === v.stockMesh, chuck: !!(v._latheChuck && v._latheChuck.children.includes(o)),
                        r: r0 });
        });
        return { bars, pg: v._partGroup ? [v._partGroup.position.x, v._partGroup.position.y] : null };
    });
    expect(r, 'the lathe scene exists to be counted').not.toBeNull();
    // EXACTLY ONE BAR, and it is the stock mesh
    const stock = r.bars.filter((b) => b.stock);
    expect(stock.length, 'exactly one visible bar').toBe(1);
    // …ON THE AXIS. This is the number that was wrong: 10, 10 — half the bar, in both transverse axes.
    expect(Math.abs(stock[0].x), 'the bar is on the centreline in X').toBeLessThan(0.01);
    expect(Math.abs(stock[0].y), 'and in Y').toBeLessThan(0.01);
    expect(r.pg, 'its group sits at zero — a bar has no datum corner to be placed by').toEqual([0, 0]);
    // EVERY OTHER visible cylinder belongs to the chuck. Nothing else may be drawing a bar.
    const strays = r.bars.filter((b) => !b.stock && !b.chuck && (b.r == null || b.r > 1));
    expect(strays, 'no second bar: every other cylinder in the scene is chuck').toEqual([]);
    // …and the chuck is on the axis too, since it grips the thing that is
    for (const c of r.bars.filter((b) => b.chuck)) {
        expect(Math.abs(c.x), 'the chuck is on the axis in X').toBeLessThan(0.01);
        expect(Math.abs(c.y), 'and in Y').toBeLessThan(0.01);
    }
});
