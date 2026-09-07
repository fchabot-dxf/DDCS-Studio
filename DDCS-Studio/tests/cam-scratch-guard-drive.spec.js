import { test, expect } from '@playwright/test';

const SCRATCH = 'scratchpad';

// t1081 slice A declared the generator scratch bands and made the build REFUSE a slot whose form values its own
// generator would clobber. t1083 slice B then made that collision IMPOSSIBLE by minting local vars around the band.
//
// Split from cam-scratch-guard.spec.js at the tier migration work package 4; its two sibling tests (the pure
// backstop-collision checks) moved to tests/node/cam-scratch-guard.test.mjs. This one stayed: it drives the real CAM
// authoring modal end-to-end (window.ddcsOpenCamAuthoring, page.click, page.waitForSelector, a real localStorage
// read-back of the built pack) — a genuine app+DOM dependency.

test.describe(() => {
    test.use({ viewport: { width: 1400, height: 1000 } });
    test('S5(3)B — the real 2-op mill build now SUCCEEDS (no refusal) and lands one composed slot', async ({ page }) => {
        await page.goto('http://localhost:3211');
        await page.waitForFunction(() => window.ddcsGetBlockProgram);
        await page.evaluate(async () => {
            const { getUserDef, defaultParams } = await import('/blocks/userOps.js');
            const dp = (t) => defaultParams(getUserDef(t));
            window.ddcsGetBlockProgram = () => ([
                { id: 's1', type: 'op', opType: 'user_surfacing_data', label: 'Surface', params: dp('user_surfacing_data') },
                { id: 'p1', type: 'op', opType: 'user_pocket_data', label: 'Pocket', params: dp('user_pocket_data') },
            ]);
            (await import('/ui/macrosApp.js')).initMacrosApp();
            window.ddcsOpenCamAuthoring();
        });
        await page.waitForSelector('.cam-auth-overlay .cbm-eb');
        await page.click('[data-act="cbm-build"]');
        // slice B: no refusal — we go straight to the destination prompt
        await page.waitForFunction(() => !document.querySelector('.cam-auth-overlay'));
        await page.screenshot({ path: `${SCRATCH}/cam-s5b-2op-built.png` });   // VIEWED (ACCEPT, gated to the advisor)
        const r = await page.evaluate(() => {
            const pack = JSON.parse(localStorage.getItem('ddcs_campack') || '{"slots":[]}');
            const s = pack.slots.slice(-1)[0] || {};
            const spindles = (s.body || '').match(/M3 S\[(#\d+)\]/g) || [];
            const assignsOf = (v) => ((s.body || '').match(new RegExp(`^\\s*\\${v}\\s*=`, 'gm')) || []).length;
            const vars = (s.fields || []).map((f) => f.var);
            return {
                slots: pack.slots.length, ops: (s.ops || []).length,
                collisions: (s.varCollisions || []).length,
                spindleAssigns: spindles.map((m) => assignsOf(m.match(/#\d+/)[0])),
                inMillBand: vars.filter((v) => { const n = +String(v).replace('#', ''); return n >= 20 && n <= 33; }),
            };
        });
        expect(r.slots, 'the slot WAS built (no refusal)').toBe(1);
        expect(r.ops, 'it composes both ops').toBe(2);
        expect(r.collisions, 'the backstop recorded NO collision').toBe(0);
        expect(r.inMillBand, 'no field var sits in the mill scratch band #20-#33').toEqual([]);
        expect(r.spindleAssigns.every((n) => n === 1), 'every spindle var is assigned exactly once (its own readLine)').toBe(true);
    });
});
