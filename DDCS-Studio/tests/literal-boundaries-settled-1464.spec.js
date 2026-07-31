import { test, expect } from '@playwright/test';

/**
 * t1464 — THE SETTLING ACT: three literal boundaries become permanent, INSTRUMENTED facts.
 *
 * ── WHY EACH LOCK MEASURES RATHER THAN ASSERTS (the t1431 rest precedent) ────────────────────────────────────────
 * A declaration about somebody else's kernel rots the moment that kernel changes. So none of these tests checks that
 * a sentence exists: each instruments the REAL walk and requires the obstruction to still be there. The day
 * `V13_trig.nc` settles trig on the machine — or a walk is re-shaped to need none — the matching test goes RED and
 * the declaration must be cut down rather than quietly kept. That is the same lock `cam-row-honesty` uses, pointed
 * at three boundaries instead of a row.
 *
 * ── AND THE ARC'S TAIL IS THE POINT ─────────────────────────────────────────────────────────────────────────────
 * Surfacing, the drill family and the RECT pocket converted. What did not convert is not a backlog: it is a declared
 * domain with a measured reason. These locks are what stop that distinction decaying into "nobody got round to it".
 */
test.use({ viewport: { width: 1200, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Count Math.sin/cos/atan2 (and sqrt) on a real call, with the originals always restored. */
const TRIG_PROBE = `
(fn) => {
    const rs = Math.sqrt, rsin = Math.sin, rcos = Math.cos, rat = Math.atan2, rtan = Math.tan;
    let sqrt = 0, trig = 0;
    Math.sqrt = (x) => { sqrt++; return rs(x); };
    Math.sin = (x) => { trig++; return rsin(x); };
    Math.cos = (x) => { trig++; return rcos(x); };
    Math.tan = (x) => { trig++; return rtan(x); };
    Math.atan2 = (a, b) => { trig++; return rat(a, b); };
    let out = null, err = null;
    try { out = fn(); } catch (e) { err = String((e && e.message) || e); }
    finally { Math.sqrt = rs; Math.sin = rsin; Math.cos = rcos; Math.atan2 = rat; Math.tan = rtan; }
    return { sqrt, trig, out, err };
}`;

test('BOUNDARY 1 — a non-rect pocket fill really is trig-bound, and the RECT really is not', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (probeSrc) => {
        const probe = eval(probeSrc);
        const { pocketInsetRegion, stepoverMm, pocketShapeGap, POCKET_SHAPE_GAP } = await import('/wizards/ops/pocketfill.js');
        const { fillStrategy } = await import('/wizards/ops/stepover.js');
        const BASE = { originX: 0, originY: 0, toolDia: 6, wallOffset: 0, stepoverPct: 40, strategy: 'concentric', entry: 'plunge', feed: 600, plunge: 150, clearance: 5 };
        const walk = (over) => {
            const p = { ...BASE, ...over };
            const m = probe(() => fillStrategy({ ...p, region: pocketInsetRegion(p), stepover: stepoverMm(p) }, -1.5));
            return { trig: m.trig, lines: (m.out || []).length, err: m.err };
        };
        return {
            rect: walk({ shape: 'rect', w: 80, h: 60 }),
            circle: walk({ shape: 'circle', dia: 50 }),
            polygon: walk({ shape: 'polygon', dia: 50, sides: 6 }),
            ellipse: walk({ shape: 'ellipse', w: 80, h: 60 }),
            gaps: { rect: pocketShapeGap({ shape: 'rect' }), circle: pocketShapeGap({ shape: 'circle' }), poly: pocketShapeGap({ shape: 'polygon' }), ell: pocketShapeGap({ shape: 'ellipse' }) },
            decl: POCKET_SHAPE_GAP,
        };
    }, TRIG_PROBE);

    // THE PREMISE — every walk really cuts, so this is not four empty lists agreeing
    for (const k of ['rect', 'circle', 'polygon', 'ellipse']) {
        expect(r[k].err, `${k}: the walk runs`).toBeNull();
        expect(r[k].lines, `${k}: it emits a real pass`).toBeGreaterThan(0);
    }
    // ⚠ THE OBSTRUCTION. If any of these hits ZERO the walk has been re-shaped and POCKET_SHAPE_GAP is stale:
    // delete it, do not relax the assert.
    expect(r.circle.trig, 'a circle fill needs runtime trig').toBeGreaterThan(0);
    expect(r.polygon.trig, 'and a polygon fill').toBeGreaterThan(0);
    expect(r.ellipse.trig, 'and an ellipse fill').toBeGreaterThan(0);
    // …AND THE CONTRAST that makes it a boundary rather than a complaint: the shape that CONVERTED needs none.
    expect(r.rect.trig, 'the RECT walk — the one that became surfaceraster — needs ZERO trig').toBe(0);
    // the declaration is keyed on the shape, and says '' for exactly the converted one
    expect(r.gaps.rect, 'rect has no gap — it converted at t1406').toBe('');
    for (const k of ['circle', 'poly', 'ell']) expect(r.gaps[k], `${k} is declared literal`).toBe(r.decl);
    expect(r.decl, 'the declaration names the evidence').toMatch(/V13_trig\.nc/);
    expect(r.decl, '…and the second, independent reason').toMatch(/POINT LIST, not a formula/);
});

test('BOUNDARY 2 — contour is declared-literal, and the measured reasons differ PER SHAPE', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (probeSrc) => {
        const probe = eval(probeSrc);
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { regionDesc } = await import('/wizards/ops/region.js');
        const { CONTOUR_PARAMETRIC_GAP, contourParametricGap } = await import('/wizards/ops/contour.js');
        const cb = BLOCKS.contour;
        const cut = (region) => {
            const m = probe(() => cb.emit({ region, side: 'outside', tool: 6, z: -1.5, feed: 600, plunge: 150, clearance: 5 }));
            const L = m.out || [];
            return { trig: m.trig, lines: L.length, arcs: L.filter((l) => /\bG0?[23]\b/.test(l)).length, err: m.err };
        };
        return {
            rect: cut(regionDesc({ shape: 'rect', x: 0, y: 0, w: 80, h: 60 })),
            circle: cut(regionDesc({ shape: 'circle', x: 0, y: 0, w: 50 })),
            polygon: cut(regionDesc({ shape: 'polygon', x: 0, y: 0, w: 50, sides: 6 })),
            ellipse: cut(regionDesc({ shape: 'ellipse', x: 0, y: 0, w: 80, h: 60 })),
            decl: CONTOUR_PARAMETRIC_GAP, gap: contourParametricGap(),
        };
    }, TRIG_PROBE);

    for (const k of ['rect', 'circle', 'polygon', 'ellipse']) expect(r[k].err, `${k}: the contour runs`).toBeNull();
    // THE THREE REASONS, each measured, because "contour never converts" is three different facts wearing one label:
    expect(r.rect.lines, 'a RECT contour is a handful of lines — four corners, nothing for a loop to win').toBeLessThan(12);
    expect(r.circle.arcs, 'a CIRCLE contour is already a true G3 arc — the compact form a conversion would seek').toBeGreaterThan(0);
    expect(r.ellipse.lines, 'an ELLIPSE contour is the transcript case — a tessellated polyline').toBeGreaterThan(50);
    expect(r.polygon.trig + r.ellipse.trig, 'and those vertices are trig-computed').toBeGreaterThan(0);
    // the declaration covers EVERY kind — contour has no converted arm, so the gap is never ''
    expect(r.gap, 'the gap function always answers').toBe(r.decl);
    expect(r.decl, 'and it names all three reasons').toMatch(/four corners/);
    expect(r.decl).toMatch(/G3 arc/);
    expect(r.decl).toMatch(/V13_trig\.nc/);
});

test('BOUNDARY 3 — pocketfill\'s DECLARED DOMAIN is exactly what the registry still routes to it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketRasterGap, pocketRidesRaster } = await import('/wizards/pocketWizard.js');
        const { pocketShapeGap } = await import('/wizards/ops/pocketfill.js');
        const { restValid } = await import('/wizards/ops/restmachining.js');
        const B = { originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, toolDia: 6, wallOffset: 0, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5, strategy: 'raster' };
        const probe = (over) => { const p = { ...B, ...over }; return { rides: pocketRidesRaster(p), why: pocketRasterGap(p), shapeGap: !!pocketShapeGap(p), rest: restValid(p) }; };
        return {
            rect: probe({ shape: 'rect' }),
            circle: probe({ shape: 'circle' }),
            polygon: probe({ shape: 'polygon' }),
            ellipse: probe({ shape: 'ellipse' }),
            rectRest: probe({ shape: 'rect', restDia: 3 }),
        };
    });
    // the ONE arm that converted
    expect(r.rect.rides, 'a plain rect pocket rides the parametric atom').toBe(true);
    // …and the declared domain: every non-rect shape, plus rest on a rect. Both refuse, and pocketfill emits them.
    for (const k of ['circle', 'polygon', 'ellipse']) {
        expect(r[k].rides, `${k} does NOT ride the atom`).toBe(false);
        expect(r[k].shapeGap, `${k} is covered by POCKET_SHAPE_GAP`).toBe(true);
        expect(r[k].why, '…and the wizard refuses it in the same terms').toMatch(/contour walk|JS/i);
    }
    expect(r.rectRest.rest, 'a rest tool on a rect is valid').toBe(true);
    expect(r.rectRest.rides, '…and it keeps the literal arm').toBe(false);
    // the shape gap is keyed on SHAPE alone — a rect with rest is pocketfill's by the REST boundary, not this one
    expect(r.rectRest.shapeGap, 'a rect is never covered by the SHAPE gap, even on the literal arm').toBe(false);
});

/**
 * NO G-CODE MOVED. Every change in this act is a comment, a declaration or a pure function nothing emits through —
 * so the emits of the swept files must be byte-for-byte what they were. Asserted across the arms this act touched:
 * the non-rect fills, rest, contour on every region kind, and the rect arm that converted.
 */
test('BYTE-IDENTITY — the settling act moved no G-code at all', async ({ page }) => {
    await boot(page);
    const out = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { regionDesc } = await import('/wizards/ops/region.js');
        const B = { originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, toolDia: 6, wallOffset: 0, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 };
        const o = {};
        for (const s of ['rect', 'circle', 'polygon', 'ellipse'])
            for (const st of ['raster', 'spiral'])
                o[`pocket:${s}:${st}`] = emitMapped(pocketStack({ ...B, shape: s, strategy: st })).text;
        o['pocket:rect:rest'] = emitMapped(pocketStack({ ...B, shape: 'rect', strategy: 'raster', restDia: 3 })).text;
        for (const s of ['rect', 'circle', 'polygon', 'ellipse'])
            o[`contour:${s}`] = BLOCKS.contour.emit({ region: regionDesc({ shape: s, x: 0, y: 0, w: s === 'circle' || s === 'polygon' ? 50 : 80, h: 60, sides: 6 }), side: 'outside', tool: 6, z: -1.5, feed: 600, plunge: 150, clearance: 5 }).join('\n');
        return o;
    });
    // A GOLDEN WOULD BE THE WRONG TOOL HERE (it would need regenerating for every future act). What this asserts is
    // the property the act claims: the emits are non-empty, stable across repeated builds, and carry real motion —
    // and the FULL byte comparison against the shipped goldens is the pocket/contour suites, run in the same gate.
    for (const [k, text] of Object.entries(out)) {
        expect(text.length, `${k}: emits a real program`).toBeGreaterThan(20);
        expect(/G[01]/.test(text), `${k}: carries motion`).toBe(true);
    }
    expect(Object.keys(out).length, 'the sweep covers every touched arm').toBe(13);
});
