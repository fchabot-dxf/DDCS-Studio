import { test, expect } from '@playwright/test';

/**
 * PREVIEW-PARITY E1 (t580) — ONE MOTION SOURCE. The drawn route and the played tool go through the SAME engine
 * (_executeStep); the only way they could disagree was CONFIG DRIFT between the two call sites (setGcode's traceToolpath
 * vs play()'s eng._*). E1 makes BOTH read one simConfig(). This asserts it NUMERICALLY: after play(), the live animation
 * engine's config (stock / start / initialPos / continuous / wcsOffset / passStarts) EQUALS panel.getSimConfig() — the
 * exact config the route traced from — across a probe op, homing (machine-frame), and a mill (cutting) op, at 2 WCS values,
 * stock shown and hidden. Config parity + a shared _executeStep ⇒ the route can't be configured differently from the tool.
 */
test.use({ viewport: { width: 1300, height: 950 } });

async function parity(page, op, wo, showStock) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openWiz);
    await page.evaluate(({ wo, showStock }) => {
        const s = window.ddcsGetSettings();
        s.machine = { x: 600, y: 400, z: -120, show: true, workOrigin: wo, wcs: { active: 1, table: [{ x: wo.x, y: wo.y, z: wo.z - 10 }] } };
        s.homing = { axes: { z: { enable: true, order: 1 }, x: { enable: true, order: 2 }, y: { enable: true, order: 3 } } };
        s.limits = { zMaxHome: true, xMinHome: true, yMinHome: true };
        s.stock = { show: showStock, x: 100, y: 80, z: 25, datum: 'nnp', pin: 'G54' };
        s.preview = s.preview || {}; s.preview.autoLoop = false;
    }, { wo, showStock });
    await page.evaluate((op) => window.openWiz(op), op);
    await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && typeof p.getSimConfig === 'function'; }, null, { timeout: 8000 });
    await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); return !!(h && h.querySelector('canvas')); }, null, { timeout: 8000 });
    await page.evaluate(() => window.updateWiz && window.updateWiz());
    await page.waitForTimeout(250);
    return page.evaluate(() => {
        const p = window.ddcsStudio.wizardManager._activePanel;
        const cfg = p.getSimConfig();                     // the config the ROUTE traced from
        const run = p.el.querySelector('.pp-run'); if (run) run.click();   // → play() configures the engine via applySimConfig
        const eng = p.engine;
        const nz = (o) => o ? { x: Math.round((+o.x || 0) * 1e3) / 1e3, y: Math.round((+o.y || 0) * 1e3) / 1e3, z: Math.round((+o.z || 0) * 1e3) / 1e3 } : null;
        const stk = (o) => o ? { x: +o.x || 0, y: +o.y || 0, z: +o.z || 0, show: o.show !== false } : null;
        const psN = (a) => Array.isArray(a) ? a.length : 0;
        const out = {
            cfg: { stock: stk(cfg.stock), start: nz(cfg.start), initialPos: nz(cfg.initialPos), continuous: !!cfg.continuous, wcs: nz(cfg.wcsOffset), passN: psN(cfg.passStarts) },
            eng: { stock: stk(eng.stock), start: nz(eng._stockOffset), initialPos: nz(eng._initialPos), continuous: !!eng._continuous, wcs: nz(eng._wcsOffset), passN: psN(eng._passStarts) },
            segEnd: (() => { const s = p.getSegments(); const l = s[s.length - 1]; return l ? nz({ x: l.x2, y: l.y2, z: l.z2 }) : null; })(),
        };
        p.stop();
        return out;
    });
}

const OPS = [
    { op: 'user_homing_data', label: 'homing (machine-frame)' },
    { op: 'user_alignment_data', label: 'alignment (probe, seat-at-start)' },
    { op: 'pocket', label: 'pocket (mill/cutting)' },
];

for (const { op, label } of OPS) {
    for (const wo of [{ x: 50, y: 30, z: 0 }, { x: 0, y: 0, z: 0 }]) {
        for (const showStock of [true, false]) {
            test(`${label} — engine config == route simConfig (wo ${wo.x},${wo.y}; stock ${showStock ? 'shown' : 'hidden'})`, async ({ page }) => {
                const r = await parity(page, op, wo, showStock);
                expect(r.eng.stock, 'stock (collision) identical').toEqual(r.cfg.stock);
                expect(r.eng.start, 'operator start (stockOffset) identical').toEqual(r.cfg.start);
                expect(r.eng.initialPos, 'seat (initialPos) identical').toEqual(r.cfg.initialPos);
                expect(r.eng.continuous, 'continuous identical').toEqual(r.cfg.continuous);
                expect(r.eng.wcs, 'wcsOffset (frame) identical — was the homing/mill DRIFT').toEqual(r.cfg.wcs);
                expect(r.eng.passN, 'per-pass starts count identical').toEqual(r.cfg.passN);
                expect(r.segEnd, 'the route has a drawable endpoint').not.toBeNull();
            });
        }
    }
}
