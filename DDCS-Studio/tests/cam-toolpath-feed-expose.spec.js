import { test, expect } from '@playwright/test';

// t1091 — FEED is now a value param on the toolpath kernels (line/drill/bore): it appears ONLY as a bare `F${feed}`
// interpolation, so num→val lets a #var ride through, and it becomes an exposable pendant knob on the UNIVERSAL arm.
// depth/peck/coords stay geometry (they drive JS loops / are pre-rounded); clearance stays geometry (a shiftZ'd Z word);
// progstart.rpm stays geometry (headerBlock tests rpm>0 to gate M3 → a #var drops the spindle-on).

test('t1091 — a custom op built from line/drill/bore exposes FEED on the universal arm, reading it from #2600', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { userOpFromStack } = await import('/blocks/userOps.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');

        const out = {};
        for (const kernel of ['line', 'drill', 'bore']) {
            const stack = [{ type: 'user_root', params: {}, children: [{ type: kernel, params: { ...({ line: { x0: 0, y0: 0, x1: 40, y1: 0, depth: 3, stepdown: 1, feed: 800, clearance: 5 }, drill: { x: 0, y: 0, depth: 6, peck: 2, feed: 250, clearance: 5 }, bore: { x: 0, y: 0, holeDia: 12, toolDia: 6, depth: 5, pitch: 0.5, feed: 300, clearance: 5 } }[kernel]) } }] }];
            const bindings = [
                { param: 'kfeed', blockIndex: 1, key: 'feed', type: 'number', default: 300, label: 'Feed', units: 'mm/min' },
                { param: 'kdepth', blockIndex: 1, key: 'depth', type: 'number', default: 5, label: 'Depth' },
                { param: 'kclear', blockIndex: 1, key: 'clearance', type: 'number', default: 5, label: 'Clearance' },
            ];
            const def = userOpFromStack('u_' + kernel, 'U ' + kernel, stack, bindings);
            const cls = classifyExposable(def);
            // expose feed → the slot mints a #var for it and the body reads it from the mirror
            const slot = stackToSlot(def, { kfeed: { exposed: true }, kdepth: { exposed: false, value: 5 }, kclear: { exposed: false, value: 5 } }, new Set(), 0);
            const feedField = (slot.fields || []).find((f) => f.key === 'kfeed');
            out[kernel] = {
                feedExposable: !!(cls.kfeed && cls.kfeed.exposable), feedRole: cls.kfeed && cls.kfeed.role,
                depthExposable: !!(cls.kdepth && cls.kdepth.exposable), depthRole: cls.kdepth && cls.kdepth.role,
                clearExposable: !!(cls.kclear && cls.kclear.exposable), clearRole: cls.kclear && cls.kclear.role,
                feedVar: feedField && feedField.var,
                bodyReadsFeed: !!(feedField && slot.body.includes(`${feedField.var}=#${feedField.idx + 1500}`)),
                bodyHasFvar: !!(feedField && new RegExp(`F\\${feedField.var}\\b`).test(slot.body)),
                bodyNoNaN: !/NaN/.test(slot.body),
            };
        }
        return out;
    });
    for (const k of ['line', 'drill', 'bore']) {
        const g = r[k];
        expect(g.feedExposable, `${k}.feed is now EXPOSABLE`).toBe(true);
        expect(g.feedRole, `${k}.feed role is value`).toBe('value');
        expect(g.depthExposable, `${k}.depth stays bake-only (loop bound / geometry)`).toBe(false);
        expect(g.clearExposable, `${k}.clearance stays bake-only (gated — a shiftZ'd Z word)`).toBe(false);
        expect(g.feedVar, `${k}: feed got a local #var`).toBeTruthy();
        expect(g.bodyReadsFeed, `${k}: the body reads feed from its #2600 mirror`).toBe(true);
        expect(g.bodyHasFvar, `${k}: the emitted F word rides the feed #var`).toBe(true);
        expect(g.bodyNoNaN, `${k}: no NaN leaked into the emit`).toBe(true);
    }
});

test('t1091 — a NUMERIC feed is byte-identical (the goldens do not move) and progstart.rpm still gates M3', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const emit1 = (type, params) => emitMapped([{ type: 'user_root', params: {}, children: [{ type, params }] }], activeDialectOpts()).text;
        // a numeric feed emits exactly the literal (val of an integer == the integer)
        const drillNum = emit1('drill', { x: 0, y: 0, depth: 4, peck: 2, feed: 321, clearance: 5 });
        // a #var feed rides through
        const drillVar = emit1('drill', { x: 0, y: 0, depth: 4, peck: 2, feed: '#2604', clearance: 5 });
        // progstart with a #var rpm — the M3 must be GONE (num-gated), proving it correctly stays geometry
        const progNum = emit1('progstart', { rpm: 9000, dir: 'cw', spinUp: 0, clearance: 5 });
        const progVar = emit1('progstart', { rpm: '#2600', dir: 'cw', spinUp: 0, clearance: 5 });
        return {
            drillNumHasLiteral: /F321\b/.test(drillNum), drillNumNoVar: !/#/.test(drillNum),
            drillVarRides: /F#2604\b/.test(drillVar), drillVarNoNaN: !/NaN/.test(drillVar),
            progNumHasM3: /M3 S9000/.test(progNum), progVarDropsM3: !/M3/.test(progVar),
        };
    });
    expect(r.drillNumHasLiteral, 'a numeric feed emits the literal F word (byte-identical)').toBe(true);
    expect(r.drillNumNoVar, 'and introduces no #var').toBe(true);
    expect(r.drillVarRides, 'a #var feed rides through to F#2604').toBe(true);
    expect(r.drillVarNoNaN, 'with no NaN').toBe(true);
    // the gate evidence, permanent: progstart.rpm is NOT pure interpolation
    expect(r.progNumHasM3, 'a numeric rpm emits M3').toBe(true);
    expect(r.progVarDropsM3, 'a #var rpm DROPS M3 (num-gated) — proof rpm must stay geometry').toBe(true);
});
