import { test, expect } from '@playwright/test';

/**
 * HOMING MACHINE-FRAME LAYOUT on a FRESH open (t578, increments 2-4) — zero interaction (no updateWiz, no drag):
 *   (3) ON-OPEN ROUTE CONNECTIVITY — the route seeds at the Start and reaches its declared HOME edges the moment the wizard
 *       opens, using the SAME seeding path as a drag (the reported 'on open it's not connecting the start and probe, only
 *       after first drag' = the machine-frame intent used to land AFTER the layout overlay read the trace).
 *   (4) STOCK RIDES ITS WCS — the stock renders inside the FIXED envelope AT its work origin (was dropped for homing); its
 *       machine position tracks the workOrigin (proven by a 2-value delta), so the envelope stays put and the stock moves.
 *   (2) GRID FRAMES THE ENVELOPE — the grid fits the envelope + a small margin exactly (not sprawling the whole pane).
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function openHoming(page, wo) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate((wo) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: wo, wcs: { active: 1, table: [{ x: wo.x, y: wo.y, z: wo.z - 10 }] } };
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: true, x: 100, y: 80, z: 25, datum: 'nnp', pin: 'G54' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;   // no autoplay: a pure static ON-OPEN render, zero interaction
    }, wo);
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.waitForTimeout(600);   // NO updateWiz, NO drag — the FRESH open must already connect
}

async function readLayout(page) {
    return page.evaluate(() => {
        // t2601 — homing_data now migrates onto the declared uiChildren tree, whose viz containers carry a
        // `_tree`-suffixed id (formWidgets.js's own `nsId(...)`), not the classic shell's fixed ids this used
        // to hardcode; `.wiz-viz3d` is queried directly (a stable class regardless of render path), and the
        // 2D svg is picked by id-substring, narrowed to the one instance actually carrying grid content (several
        // container instances — classic/tree/mini-preview — can coexist, only one populated).
        const host = document.querySelector('.wiz-viz3d');
        const panel = host && host.__panel;
        const segs = panel ? panel.getSegments() : [];
        const ps = panel ? panel.getPassStarts()[0] : null;
        const first = segs[0] || null;
        const ext = (a) => a.length ? { min: Math.min(...a), max: Math.max(...a) } : null;
        const svgHost = document.querySelector('[id*="userVizContainer"]:has(.fc-grid-major, .fc-grid-minor)') || document.querySelector('[id*="userVizContainer"]');
        const svg = svgHost && svgHost.querySelector('svg');
        const bb = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
        const env = bb(svg && svg.querySelector('[fill*="rgba(90,140,190"]'));
        const stk = bb(svg && svg.querySelector('.fc-stock'));
        let gminx = 1e9, gminy = 1e9, gmaxx = -1e9, gmaxy = -1e9;
        (svg ? svg.querySelectorAll('.fc-grid-major, .fc-grid-minor') : []).forEach((l) => { const r = l.getBoundingClientRect(); gminx = Math.min(gminx, r.x); gminy = Math.min(gminy, r.y); gmaxx = Math.max(gmaxx, r.right); gmaxy = Math.max(gmaxy, r.bottom); });
        return {
            segN: segs.length, start: ps, firstSeg: first ? { x: first.x1, y: first.y1, z: first.z1 } : null,
            x: ext(segs.flatMap((g) => [g.x1, g.x2])), y: ext(segs.flatMap((g) => [g.y1, g.y2])), z: ext(segs.flatMap((g) => [g.z1, g.z2])),
            env, stk, grid: (gmaxx > gminx) ? { x: gminx, y: gminy, r: gmaxx, b: gmaxy } : null,
            paneW: svg ? svg.getBoundingClientRect().width : 0,
        };
    });
}

// The stock's datum (min-XY) corner in MACHINE coords, from the envelope rect mapping (screen Y flipped: bottom = machine 0).
function stockDatumMachine(L) {
    return { x: (L.stk.x - L.env.x) / L.env.w * 600, y: (L.env.b - L.stk.b) / L.env.h * 400 };
}

test('(3) ON-OPEN: the route connects Start → seeks (home edges) with ZERO interaction (no drag, no updateWiz)', async ({ page }) => {
    await openHoming(page, { x: 50, y: 30, z: 0 });
    const R = await readLayout(page);
    expect(R.segN, 'the homing route traced on open').toBeGreaterThan(0);
    const gap = Math.hypot(R.firstSeg.x - R.start.x, R.firstSeg.y - R.start.y, R.firstSeg.z - R.start.z);
    expect(gap, 'the route emanates FROM the Start on open (connected, not origin)').toBeLessThan(0.1);
    expect(Math.abs(R.x.min - 0), 'X seek reaches the −X home (0)').toBeLessThan(0.1);
    expect(Math.abs(R.y.min - 0), 'Y seek reaches the −Y home (0)').toBeLessThan(0.1);
    expect(Math.abs(R.z.max - 0), 'Z seek reaches the top home (0)').toBeLessThan(0.1);
});

test('(4) STOCK rides its WCS inside the fixed envelope — its machine position tracks the workOrigin', async ({ page }) => {
    await openHoming(page, { x: 50, y: 30, z: 0 });
    const A = await readLayout(page);
    expect(A.stk, 'the stock renders in the machine-frame layout (was dropped for homing)').not.toBeNull();
    expect(A.env, 'the envelope renders').not.toBeNull();
    const dA = stockDatumMachine(A);
    expect(Math.abs(dA.x - 50), 'the stock datum corner sits at workOrigin.x (WCS)').toBeLessThan(4);
    expect(Math.abs(dA.y - 30), 'the stock datum corner sits at workOrigin.y (WCS)').toBeLessThan(4);
    await openHoming(page, { x: 150, y: 90, z: 0 });
    const B = await readLayout(page);
    const dB = stockDatumMachine(B);
    expect(Math.hypot(B.env.x - A.env.x, B.env.y - A.env.y), 'the envelope stays FIXED across workOrigins').toBeLessThan(2);
    expect(Math.abs((dB.x - dA.x) - 100), 'the stock rode +100 in X with the workOrigin').toBeLessThan(4);
    expect(Math.abs((dB.y - dA.y) - 60), 'the stock rode +60 in Y with the workOrigin').toBeLessThan(4);
});

test('(2) GRID frames the envelope + a small margin (not the whole pane)', async ({ page }) => {
    await openHoming(page, { x: 50, y: 30, z: 0 });
    const L = await readLayout(page);
    expect(L.grid, 'the grid drew').not.toBeNull();
    const mL = L.env.x - L.grid.x, mR = L.grid.r - L.env.r, mT = L.env.y - L.grid.y, mB = L.grid.b - L.env.b;
    for (const [side, m] of [['left', mL], ['right', mR], ['top', mT], ['bottom', mB]]) {
        expect(m, `grid margin ${side} is positive (frames the envelope)`).toBeGreaterThan(1);
        expect(m, `grid margin ${side} is SMALL (≤12% of the envelope span, not sprawling)`).toBeLessThan(L.env.w * 0.12);
    }
    expect(L.grid.r - L.grid.x, 'the grid is narrower than the full pane (bounded to the envelope)').toBeLessThan(L.paneW * 0.95);
});

// t586 PREVIEW-PARITY E2c — the layout stock now reads part-zero from THE ONE frame source (sceneFrame.partZeroShift), so it
// coincides with the 3D stock. BEHAVIOR FIX vs t578's local wcsOffsetXY (which used the ACTIVE WCS): a stock pinned to a
// NON-active WCS follows its PIN like the 3D. Here G54 is active but the stock is pinned to G55 → the stock must sit at G55.
test('(4b) E2c: the layout stock follows its PIN (not the active WCS) — coincides with the 3D partZeroShift', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(() => {
        const s = window.ddcsGetSettings();
        // G54 (active) = {50,30}; G55 = {200,150}. The stock is pinned to G55 — so it must ride G55, NOT the active G54.
        s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: { x: 50, y: 30, z: 0 }, wcs: { active: 1, table: [{ x: 50, y: 30, z: -10 }, { x: 200, y: 150, z: -10 }] } };
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: true, x: 100, y: 80, z: 25, datum: 'nnp', pin: 'G55' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    });
    await page.evaluate(() => window.openWiz('user_homing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.waitForTimeout(600);
    const L = await readLayout(page);
    const d = stockDatumMachine(L);
    // the 3D's source of truth for the same op — the parity target
    const pz = await page.evaluate(async () => {
        const { partZeroShift } = await import('/viz/sceneFrame.js');
        const s = window.ddcsGetSettings();
        return partZeroShift(s.machine, s.stock, null);
    });
    expect(L.stk, 'the stock renders').not.toBeNull();
    expect(Math.abs(d.x - 200), 'the stock datum follows the G55 PIN x (200), not the active G54 (50)').toBeLessThan(5);
    expect(Math.abs(d.y - 150), 'the stock datum follows the G55 PIN y (150), not the active G54 (30)').toBeLessThan(5);
    // and it COINCIDES with the 3D's declared frame source (partZeroShift) — one source, no drift
    expect(Math.abs(d.x - pz.x) + Math.abs(d.y - pz.y), 'the layout stock corner == the 3D partZeroShift (one frame source)').toBeLessThan(5);
});
