import { test, expect } from '@playwright/test';

/**
 * t1301 — THE 3D PANE TELLS THE TRUTH ABOUT A LATHE. Four faults with one root between them: everything that placed a
 * lathe bar in space assumed a MILL's frame, where a stock's datum is the corner of a box. A bar's datum is its
 * CENTRELINE, and every consumer that did not know it was wrong by exactly one radius — the probe start, the
 * collision the stroke stops against, and the camera that frames it.
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

/** Open a wizard and read what its 3D pane actually drew. */
const openAndRead = async (page, opType) => {
    await page.evaluate((o) => window.openWiz(o), opType);
    await page.waitForTimeout(2200);
    return page.evaluate(() => {
        const v = window.__ddcsLastViz;
        const span = (name, k) => {
            const g = v.lineGroups && v.lineGroups[name];
            if (!g || !g.geometry) return null;
            const a = g.geometry.attributes.position.array;
            let lo = Infinity, hi = -Infinity;
            for (let i = k; i < a.length; i += 3) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
            return a.length ? { lo: +lo.toFixed(2), hi: +hi.toFixed(2) } : null;
        };
        const dro = {};
        document.querySelectorAll('tr[data-ax]').forEach((r) => { dro[r.dataset.ax] = parseFloat(r.children[1].textContent); });
        return {
            tool: v._simTool, starts: v.starts, dro,
            stock: v._stock && { d: v._stock.diameter, datum: v._stock.datum, axis: v._stock.axis },
            fastX: span('probe', 0), fastZ: span('probe', 2), slowX: span('probeSlow', 0), slowZ: span('probeSlow', 2),
        };
    });
};

test('THE OD PROBE STARTS OUTSIDE THE BAR AND STOPS ON IT — nothing crosses the centreline', async ({ page }) => {
    await boot(page);
    const r = await openAndRead(page, 'user_lathe_odprobe');
    // The op's sim bar is Ø20 → radius 10; the declared start stands 4 outside it, on the round at Z−8.
    expect(r.stock.datum, 'the bar declares its CENTRELINE as its datum').toBe('ccp');
    expect(r.starts[0].z, 'back along the round, clear of the chuck — where the prompt asks them to jog').toBe(-8);
    // …drawn in the scene, where the bar's surface is at 10 and its axis at 0
    expect(r.fastX.hi, 'the stroke begins 4 outside the bar').toBeCloseTo(14, 1);
    expect(r.fastX.lo, 'and stops one stylus radius off the surface — where a real machine stops').toBeCloseTo(12, 1);
    expect(r.fastX.lo, 'so it never reaches the surface, let alone the centreline').toBeGreaterThan(10);
    expect(r.slowX.lo, 'the slow touch stops in the same place').toBeGreaterThan(10);
    expect(r.fastZ.lo, 'and it travels in X alone — Z does not move').toBeCloseTo(r.fastZ.hi, 3);
});

test('THE FACE PROBE STOPS ON THE END OF THE BAR — the cylinder has end faces now', async ({ page }) => {
    await boot(page);
    const r = await openAndRead(page, 'user_lathe_faceprobe');
    expect(r.fastZ.hi, 'it begins ahead of the raw end').toBeCloseTo(6, 1);
    // The bar's raw end sits at Z+1 (the default allowance); the stylus centre stops a radius (2) short of it.
    expect(r.fastZ.lo, 'and stops a stylus radius off the face').toBeCloseTo(2, 1);
    expect(r.fastZ.lo, 'never running on into the bar').toBeGreaterThan(0);
    expect(r.fastX.lo, 'touching the FACE, so it stays inside the bar radius').toBeCloseTo(r.fastX.hi, 3);
    expect(Math.abs(r.fastX.lo), 'and inside it').toBeLessThan(10);
});

test('THE STYLUS IS THE ONE THE FORM DECLARES, scaled to the bar — not a mill spindle', async ({ page }) => {
    await boot(page);
    const r = await openAndRead(page, 'user_lathe_odprobe');
    expect(r.tool.type).toBe('probe');
    expect(r.tool.probeAxis, 'it stands off in X — it comes down onto the round').toBe('x');
    // THE BALL IS THE DECLARED STYLUS: radius 2 in the form → a Ø4 ball, the same one the emit compensates by.
    expect(r.tool.probeDims.ballDia, 'the ball is the radius the emit compensates by, doubled').toBe(4);
    // …and the body is the size of the WORK, not of a spindle (the mill default body is Ø30 on a 40 stylus)
    expect(r.tool.probeDims.bodyDia, 'a body the bar can stand beside').toBeLessThanOrEqual(12);
    expect(r.tool.dia, 'and a shank narrower than the bar').toBeLessThan(20);
    // THE READOUT SPEAKS THE WORK FRAME. The stylus lives between the start (radius 14 → Ø28) and its stop on the
    // surface (radius 12 → Ø24), so the reading sits in that band wherever the animation happens to be. Quoted in the
    // STOCK-CORNER frame it would read a whole radius more — Ø44 — which is the number this assert exists to exclude.
    expect(r.dro.x, 'the DRO quotes the diameter at the centreline, not the stock corner').toBeGreaterThan(20);
    expect(r.dro.x).toBeLessThan(29);
    expect(r.dro.y, 'and Y is zero — the stylus is on the centreline plane').toBeCloseTo(0, 3);
});

test('A CHANGED STYLUS RADIUS CHANGES THE BALL — the picture follows the number', async ({ page }) => {
    await boot(page);
    await page.evaluate((o) => window.openWiz(o), 'user_lathe_odprobe');
    await page.waitForTimeout(1800);
    const before = await page.evaluate(() => window.__ddcsLastViz._simTool.probeDims.ballDia);
    await page.evaluate(() => {
        const f = [...document.querySelectorAll('#wiz_user_form input')].find((i) => /stylus/i.test((i.closest('.wiz-row') || i.parentElement || {}).textContent || ''));
        if (f) { f.value = '0.5'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.__ddcsLastViz._simTool.probeDims.ballDia);
    expect(before, 'the default 2mm stylus is a Ø4 ball').toBe(4);
    expect(after, 'and a 0.5mm one is a Ø1 ball — the render reads the form, not a preference').toBe(1);
});

test('THE MAIN PREVIEW FRAMES THE BAR AND ITS CHUCK, centred on the centreline', async ({ page }) => {
    await boot(page);
    await page.click('#view-toggle');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        const sh = v.partFrame ? v.partFrame.shift : { x: 0, y: 0, z: 0 };
        return { target: { x: +v.target.x.toFixed(2), y: +v.target.y.toFixed(2), z: +v.target.z.toFixed(2) },
                 radius: v.radius, chuck: v._latheChuckSpan, stock: { z: v._stock.z, x: v._stock.x }, shift: { z: +sh.z.toFixed(2) } };
    });
    // THE CAMERA LOOKS AT THE CENTRELINE. It targeted (x/2, y/2) — the corner-datum assumption — so the bar sat half a
    // diameter off centre and ran out of the pane.
    expect(r.target.x, 'the camera looks down the axis, not a radius off it').toBeCloseTo(0, 2);
    expect(r.target.y).toBeCloseTo(0, 2);
    // …AND THE CHUCK IS IN THE PICTURE: the framed Z reaches past the bar's grip end into what holds it.
    expect(r.chuck, 'the chuck reach is measured, not guessed').not.toBeNull();
    expect(r.chuck.z0, 'it sits at the grip end, beyond the bar').toBeLessThan(-r.stock.z + 5);
    // the framing radius covers the whole of it with margin, so nothing is cut off
    const span = Math.max(r.stock.x, (r.stock.z + Math.abs(r.chuck.z0 + r.stock.z)));
    expect(r.radius, 'and the camera stands far enough back for all of it').toBeGreaterThan(span * 0.9);
});

test('A MILL SCENE FRAMES EXACTLY AS BEFORE — the datum-derived span is the same span for a box', async ({ page }) => {
    await boot(page, 'mill');
    await page.click('#view-toggle');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
        const v = window.__ddcsLastViz, s = v._stock;
        return { target: { x: +v.target.x.toFixed(2), y: +v.target.y.toFixed(2) }, stock: { x: s.x, y: s.y, datum: s.datum }, chuck: v._latheChuckSpan };
    });
    // a mill box declares the min-corner datum, so its span is 0..x — and the camera still centres on x/2
    expect(r.target.x, 'the mill box is framed on its middle, as it always was').toBeCloseTo(r.stock.x / 2, 1);
    expect(r.target.y).toBeCloseTo(r.stock.y / 2, 1);
    expect(r.chuck, 'and there is no chuck to join the fit').toBeFalsy();
});

test('ALL SEVEN LATHE OPS ARE FRAME-GATED ON A MILL, each with its own reason', async ({ page }) => {
    await boot(page, 'mill');
    const r = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const ops = ['lathe_facing', 'lathe_odturn', 'lathe_parting', 'lathe_centerdrill', 'lathe_polygon', 'lathe_faceprobe', 'lathe_odprobe'];
        const out = {};
        ops.forEach((o) => { out[o] = G.frameWhy('user_' + o); });
        return { out, mill: { pocket: G.frameWhy('pocket'), edge: G.frameWhy('user_edge_data'), drill: G.frameWhy('drill') } };
    });
    const sentences = Object.values(r.out);
    expect(sentences.filter(Boolean).length, 'all seven say something').toBe(7);
    expect(new Set(sentences).size, 'and no two ops share a sentence — the hazards are not the same one seven times').toBe(7);
    // each names what that op actually assumes
    expect(r.out.lathe_facing).toMatch(/centreline/);
    expect(r.out.lathe_odturn, 'the one whose failure is silent says what it looks like').toMatch(/half what you typed/);
    expect(r.out.lathe_parting).toMatch(/part a bar off|X0/);
    expect(r.out.lathe_centerdrill, 'and points at the mill op that does the job').toMatch(/Drill op/);
    expect(r.out.lathe_polygon).toMatch(/CHUCK ANGLE/);
    // THE MILL SIDE IS UNTOUCHED, as always
    expect(r.mill.pocket, 'a mill op is never frame-gated').toBe('');
    expect(r.mill.edge).toBe('');
    expect(r.mill.drill).toBe('');
});

test('AND THE GATE IS REVERSIBLE — nothing is greyed on the machine it was written for', async ({ page }) => {
    await boot(page, 'lathe');
    const onLathe = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        return ['lathe_facing', 'lathe_odturn', 'lathe_parting', 'lathe_centerdrill', 'lathe_faceprobe', 'lathe_odprobe']
            .map((o) => G.frameWhy('user_' + o));
    });
    expect(onLathe.every((s) => s === ''), 'a lathe workspace greys none of them').toBe(true);
    // …and the ops stay on the bar either way: greyed, never hidden (the standing rule)
    await boot(page, 'mill');
    const stillListed = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        return uo.listUserOps().filter((d) => /^user_lathe_/.test(d.opType)).length;
    });
    expect(stillListed, 'all seven are still registered on a mill — greyed, not hidden').toBe(7);
});

test('THE GREYING REACHES THE ACTUAL MENU — the declaration had no attribute to land on', async ({ page }) => {
    // This is the one that matters: `frameWhy` and `missingAxesFor` were right and UNREACHABLE, because the wizard
    // bar's buttons carried no `data-optype` for applyAxisGating to find. Every op the app had declared impossible on
    // this machine still looked, and clicked, exactly like the rest.
    await boot(page, 'mill');
    await page.waitForTimeout(500);
    const onMill = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.dock-header button')].find((x) => /^\s*Lathe/i.test(x.textContent || ''));
        if (b) b.click();
        return [...document.querySelectorAll('[data-optype]')].filter((e) => /^user_lathe_/.test(e.dataset.optype))
            .map((e) => ({ op: e.dataset.optype, gated: e.classList.contains('axis-gated'), disabled: e.getAttribute('aria-disabled'), why: e.title }));
    });
    expect(onMill.length, 'all seven are on the bar').toBe(7);
    expect(onMill.every((e) => e.gated), 'and every one of them is greyed').toBe(true);
    expect(onMill.every((e) => e.disabled === 'true')).toBe(true);
    expect(onMill.every((e) => e.why && e.why.length > 30), 'each with the sentence for its own hazard').toBe(true);
    // POLYGON'S REASON IS THE FRAME, not the missing A axis: on a mill, declaring a driven chuck would not make it
    // possible, so sending the operator to Settings to do that would be a wrong answer politely delivered.
    const poly = onMill.find((e) => /polygon/.test(e.op));
    expect(poly.why, 'the deeper fact answers first').toMatch(/CHUCK ANGLE|does not turn|neither/);
    // REVERSIBLE: back on a lathe they are plain again, and the mill's own ops were never touched
    await boot(page, 'lathe');
    await page.waitForTimeout(700);
    const onLathe = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.dock-header button')].find((x) => /^\s*Lathe/i.test(x.textContent || ''));
        if (b) b.click();
        const lathe = [...document.querySelectorAll('[data-optype]')].filter((e) => /^user_lathe_/.test(e.dataset.optype));
        const mill = [...document.querySelectorAll('[data-optype]')].filter((e) => /pocket|contour|surfacing/.test(e.dataset.optype));
        return { gatedLathe: lathe.filter((e) => e.classList.contains('axis-gated')).length, n: lathe.length,
                 gatedMill: mill.filter((e) => e.classList.contains('axis-gated')).length, millN: mill.length };
    });
    expect(onLathe.n, 'still all seven').toBe(7);
    expect(onLathe.gatedLathe, 'none greyed on the machine they were written for').toBe(0);
    // …and the mill ops ARE greyed here, by the axis rule that has always said so (they need a Y)
    expect(onLathe.gatedMill, 'while the mill ops grey on a lathe, which is the rule that already existed').toBe(onLathe.millN);
});
