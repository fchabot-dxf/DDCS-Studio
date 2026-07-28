import { test, expect } from '@playwright/test';

/**
 * t1299 — THE LATHE PROBE FAMILY. These two ops do not move metal, they write the DATUM every later program is
 * measured from: a turning op that is wrong cuts one part wrong, a probe that is wrong makes every part after it
 * wrong, silently. So the asserts here are about the number that gets written and the two rules that keep a stylus
 * (and an operator) intact.
 *
 * THE SEQUENCES ARE HAND-DERIVED IN THE COMMENTS, then checked against the emit — not read back out of it.
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

/** Emit an op THROUGH THE PATH THE APP RESOLVES — builderOf, so a twin's snapshot cannot hide behind a direct call. */
const emit = (page, opType, params) => page.evaluate(async ({ t, p }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const def = uo.listUserOps().find((d) => d.opType === t);
    return String(emitProgram(builderOf(t)({ ...uo.defaultParams(def), ...(p || {}) })));
}, { t: opType, p: params });

const rules = (page, nc) => page.evaluate(async (text) => {
    const L = await import('/wizards/lathe/latheProbe.js');
    return { spindle: L.spindleOffBeforeEveryProbe(text), wcs: L.wcsNeverReadForMotion(text) };
}, nc);

const codeOnly = (nc) => nc.split('\n').map((l) => l.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);

test('THE FACE PROBE emits the hand-derived touch sequence, and writes the Z datum through the shared seam', async ({ page }) => {
    await boot(page);
    const nc = await emit(page, 'user_lathe_faceprobe', {});
    const L = codeOnly(nc);
    // HAND-DERIVED, with the defaults (seek 15, retract 2, feeds 200/50, port 3, stylus r2, ahead 0):
    //   spindle OFF · operator confirm · G91 · guard · G31 Z−15 @200 · check · back off +2 · G31 Z−15 @50 · check
    //   · surface = trigger − stylus · back off +2 · G90 · datum = surface − ahead · write Z
    const want = [
        'M5', '#1505=1', 'IF #1505==0 GOTO2', 'G91',
        '#1907=0', '#1917=1',
        'G31 Z#7 F#3 P#5 L0 Q1', 'IF #1922!=2 GOTO1', 'G0 Z#10',
        'G31 Z#7 F#4 P#5 L0 Q1', 'IF #1922!=2 GOTO1',
        '#50=[#1927-#6]', 'G0 Z#10', 'G90',
        '#52=[#50-#53]', '#[#70+2]=#52',
    ];
    const from = L.indexOf('M5');
    expect(L.slice(from, from + want.length), 'the touch, in order, exactly as derived').toEqual(want);
    // …and the seek/retract signs are what the header made them: seek NEGATIVE (into the face), retract POSITIVE
    expect(L, 'the seek is the negative of the max distance').toContain('#7=[0-#1]');
    expect(L, 'and the retract is its positive').toContain('#10=#2');
});

test('THE OD PROBE lands the datum so the DRO reads the CALIPER diameter — the arithmetic, hand-derived', async ({ page }) => {
    await boot(page);
    const nc = await emit(page, 'user_lathe_odprobe', { caliperDiameter: 24.85, tipRadius: 3 });
    const L = codeOnly(nc);
    // HAND-DERIVED. Probing inward from +X the stylus centre stops one tip radius outside the surface, so
    //   surface  = trigger − tip                          (machine RADIUS)
    //   X origin = surface − caliper/2                    (so the surface reads the true radius → the DRO the Ø)
    // With a Ø24.85 bar and a 3mm stylus, a trigger at machine X 40 gives surface 37 and an origin at 37 − 12.425.
    expect(L, 'the surface is the trigger less the stylus radius').toContain('#50=[#1925-#6]');
    expect(L, 'and the origin is half the MEASURED DIAMETER below it').toContain('#52=[#50-[#51/2]]');
    expect(L, 'written into the X slot of the table').toContain('#[#70+0]=#52');
    // THE DIAMETER STAYS A DIAMETER until the controller halves it — the field, the var, and only then the /2.
    expect(L, 'the caliper measurement goes in as a diameter').toContain('#51=24.85');
    expect(L.join(' '), 'nothing halved it on the way in').not.toMatch(/#51=12\.425/);
    // the stylus radius is compensated ON THE RADIUS, so it moves the diameter by twice itself — which is why the
    // number typed is a diameter and the compensation is not.
    expect(L, 'the stylus radius is the one the header holds').toContain('#6=3');
});

test('IRON RULE 1 — the spindle is stopped before EVERY G31, and no parameter can un-say it', async ({ page }) => {
    await boot(page);
    for (const [op, params] of [['user_lathe_faceprobe', {}], ['user_lathe_odprobe', {}],
                                ['user_lathe_faceprobe', { ahead: 5, feedFast: 900, maxDist: 40 }],
                                ['user_lathe_odprobe', { caliperDiameter: 60, tipRadius: 0.5, port: 1 }]]) {
        const nc = await emit(page, op, params);
        const r = await rules(page, nc);
        expect(r.spindle.ok, `${op}: ${JSON.stringify(r.spindle.violations)}`).toBe(true);
        expect(nc.indexOf('M5'), `${op}: the stop is above the first G31`).toBeLessThan(nc.indexOf('G31'));
    }
    // AND THE CHECK ITSELF DISCRIMINATES — a program that spins up before a touch is caught, or the rule above is
    // proving nothing. (Structural: it walks the program the way the controller will.)
    const bad = await page.evaluate(async () => {
        const L = await import('/wizards/lathe/latheProbe.js');
        return {
            spinning: L.spindleOffBeforeEveryProbe('M5\nM3 S900\nG31 Z#7 F#3'),
            never: L.spindleOffBeforeEveryProbe('G0 Z5\nG31 Z#7 F#3'),
            restopped: L.spindleOffBeforeEveryProbe('M3 S900\nM5\nG31 Z#7 F#3'),
        };
    });
    expect(bad.spinning.ok, 'a spindle started above the touch is a violation').toBe(false);
    expect(bad.never.ok, 'and so is never stopping it at all').toBe(false);
    expect(bad.restopped.ok, 'stopping it again before the touch is fine').toBe(true);
});

test('IRON RULE 2 — the probe never READS the WCS, though writing it is the whole job', async ({ page }) => {
    await boot(page);
    for (const op of ['user_lathe_faceprobe', 'user_lathe_odprobe']) {
        const nc = await emit(page, op, {});
        const r = await rules(page, nc);
        expect(r.wcs.ok, `${op}: ${JSON.stringify(r.wcs.violations)}`).toBe(true);
        // NO ABSOLUTE POSITIONING AT ALL: the operator jogs, the probe goes incremental from there. An "approach the
        // face" rapid would have to be aimed with the datum this op exists to produce.
        const moves = codeOnly(nc).filter((l) => /^G0\b/.test(l));
        expect(moves.every((m) => /^G0 [XZ]#(9|10)$/.test(m)), `${op}: every rapid is a probe retract — ${moves}`).toBe(true);
    }
    // …and the checker is precise, not a blanket ban: it flags a datum READ, allows the op's own WRITE, and allows
    // the ADDRESS computation the shared write seam needs. An over-broad version would fail on the write itself.
    const c = await page.evaluate(async () => {
        const L = await import('/wizards/lathe/latheProbe.js');
        return {
            read: L.wcsNeverReadForMotion('#52=[#[#70+2]+1]'),
            move: L.wcsNeverReadForMotion('G0 Z#[#70+2]'),
            write: L.wcsNeverReadForMotion('#[#70+2]=#52'),
            addr: L.wcsNeverReadForMotion('#71=#578\n#70=[805+[#72*5]]'),
            fixture: L.wcsNeverReadForMotion('#52=#5223'),
        };
    });
    expect(c.read.ok, 'a datum feeding a computation is caught').toBe(false);
    expect(c.move.ok, 'a move aimed by a datum is caught').toBe(false);
    expect(c.fixture.ok, 'so is a direct fixture-offset read').toBe(false);
    expect(c.write.ok, 'the op writing its own result is NOT a violation').toBe(true);
    expect(c.addr.ok, 'nor is working out which row to write to').toBe(true);
});

test('THE TWINS REGENERATE THROUGH THE ONE BUILDER — a changed WCS reaches the base AND the write', async ({ page }) => {
    await boot(page);
    // The snapshot lesson, one turn old: a twin's template is built once at the defaults, so a BUILD-TIME branch
    // freezes into it. The WCS choice is exactly such a branch — it decides the base address and the write's target.
    const g55 = await emit(page, 'user_lathe_odprobe', { wcs: 'G55', caliperDiameter: 31.7 });
    const L = codeOnly(g55);
    expect(L, 'a fixed WCS uses its own literal base — no active-index read').toContain('#70=810');
    expect(L.join(' '), 'and nothing still reads the active WCS index').not.toMatch(/#578/);
    expect(g55, 'the write says which table it landed in').toMatch(/Set G55 X/);
    expect(L, 'the typed measurement came through the twin').toContain('#51=31.7');
    // …and back to the active WCS, both ways, because a twin that only changes one way is a twin that drifts
    const act = codeOnly(await emit(page, 'user_lathe_odprobe', { wcs: 'active' }));
    expect(act, 'the active WCS is read as an INDEX to find the row').toContain('#71=#578');
    // the face probe's own value-parameter, through the same path
    const ahead = codeOnly(await emit(page, 'user_lathe_faceprobe', { ahead: 2.5 }));
    expect(ahead, 'the touched face is declared 2.5 ahead of Z0').toContain('#53=2.5');
    expect(ahead, 'and the datum is that far behind it').toContain('#52=[#50-#53]');
});

test('THE PREVIEW IS TOLD THIS OP PRODUCES THE WCS — never rendered through the declared table', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const S = await import('/viz/opSimContext.js');
        return {
            face: S.opSimContext('user_lathe_faceprobe').probesForWcs,
            od: S.opSimContext('user_lathe_odprobe').probesForWcs,
            turning: S.opSimContext('user_lathe_facing').probesForWcs,
            program: S.programSimContext(['user_lathe_facing', 'user_lathe_odprobe']).probesForWcs,
        };
    });
    expect(r.face, 'the face probe declares it').toBe(true);
    expect(r.od, 'and the OD probe').toBe(true);
    expect(r.turning, 'a turning op does not — it is measured FROM the datum, it does not make one').toBe(false);
    expect(r.program, 'and one probe anywhere in a program is enough for the whole program').toBe(true);
});

test('GATING — greyed on a mill with the reason each op actually has, and clear again on a lathe', async ({ page }) => {
    await boot(page, 'mill');
    const onMill = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        return { od: G.frameWhy('user_lathe_odprobe'), face: G.frameWhy('user_lathe_faceprobe'), facing: G.frameWhy('user_lathe_facing') };
    });
    // THE HAZARDS ARE NOT THE SAME ONE TWICE, so neither are the sentences
    expect(onMill.od, 'the OD probe names the radius frame').toMatch(/radius from the centreline/);
    expect(onMill.od, 'and what going wrong looks like').toMatch(/half the bar out/);
    expect(onMill.face, 'the face probe points at the mill op that does its job').toMatch(/Edge probe/);
    // t1301 — THE RULING CHANGED, and so does this line: every lathe op is frame-gated now, because a turning
    // program on a mill is written in a frame that machine does not have. It cuts, so it is worse than the probe.
    expect(onMill.facing, 'and a turning op is frame-gated too, since t1301').toMatch(/centreline/);
    await boot(page, 'lathe');
    const onLathe = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        return { od: G.frameWhy('user_lathe_odprobe'), face: G.frameWhy('user_lathe_faceprobe') };
    });
    expect(onLathe.od, 'nothing to say on the machine it was written for').toBe('');
    expect(onLathe.face).toBe('');
});

test('THE HALF-PROFILE DRAWS THE TOUCH, and the handle writes the parameter the emit reads', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const C = await import('/viz/latheProfileCanvas.js');
        const face = C.faceProbeSpec({ diameter: 20, stickOut: 60, allowance: 1 }, { ahead: 3, tipRadius: 2 });
        const od = C.odProbeSpec({ diameter: 20, stickOut: 60, allowance: 1 }, { caliperDiameter: 24.85, tipRadius: 2 });
        const wrote = {};
        face.onDrag(C.FACE_PROBE_HANDLE_ID, { x: 4.25, y: 0 });                 // drag the touched face out
        const afterFace = { ...wrote };
        return {
            faceTouch: face.items.filter((i) => i.cls === 'fc-probe-touch').length,
            faceApproach: face.items.filter((i) => i.cls === 'fc-probe-approach').length,
            odSurfaceY: od.items.find((i) => i.kind === 'line' && i.y1 === i.y2 && i.y1 > 0).y1,
            faceHandle: face.handles[0], odHandle: od.handles[0],
            // the writes, captured through the same onDrag the panel calls
            faceWrite: await new Promise((res) => { const s = C.faceProbeSpec({ diameter: 20, stickOut: 60, allowance: 1 }, { ahead: 3 }, res); s.onDrag(C.FACE_PROBE_HANDLE_ID, { x: 4.25, y: 0 }); }),
            faceClamp: await new Promise((res) => { const s = C.faceProbeSpec({ diameter: 20, stickOut: 60, allowance: 1 }, { ahead: 3 }, res); s.onDrag(C.FACE_PROBE_HANDLE_ID, { x: -8, y: 0 }); }),
            odWrite: await new Promise((res) => { const s = C.odProbeSpec({ diameter: 20, stickOut: 60, allowance: 1 }, { caliperDiameter: 20 }, res); s.onDrag(C.OD_PROBE_HANDLE_ID, { x: -9, y: 15.5 }); }),
            unused: afterFace,
        };
    });
    // THE TOUCH IS DRAWN, in both pictures, with the direction it came from
    expect(r.faceTouch, 'the stylus ball sits on the face').toBe(1);
    expect(r.faceApproach, 'with the approach it came in on').toBe(1);
    expect(r.odSurfaceY, 'the OD picture draws the MEASURED radius — 24.85 across is 12.425 up').toBeCloseTo(12.425, 3);
    // THE HANDLES ARE TEAL — the declared convention for "this drives the emit"
    expect(r.faceHandle.teal).toBe(true); expect(r.odHandle.teal).toBe(true);
    expect(r.odHandle.value, 'and the OD handle carries the DIAMETER, not a radius').toBeCloseTo(24.85, 3);
    // …AND A DRAG WRITES THE PARAMETER, which is the whole point: a handle is a second way to type a number
    expect(r.faceWrite, 'dragging the face writes how far ahead of Z0 it is').toEqual({ ahead: 4.25 });
    expect(r.faceClamp, 'and it stops at Z0 — a face behind the datum is not a thing the probe can find').toEqual({ ahead: 0 });
    expect(r.odWrite.caliperDiameter, 'dragging the surface writes a DIAMETER — twice the radius grabbed').toBeCloseTo(31, 3);
});

test('THE .WIZ ROUND TRIP — both probes export and come back the same op', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        const out = {};
        for (const t of ['user_lathe_faceprobe', 'user_lathe_odprobe']) {
            const def = uo.listUserOps().find((d) => d.opType === t);
            const wiz = JSON.parse(JSON.stringify({
                opType: def.opType, label: def.label, template: def.template, bindings: def.bindings,
                panel: def.panel, group: def.group, layout: def.layout, sim: def.sim, simStock: undefined,
                latheTool: def.latheTool,
            }));
            out[t] = {
                bindings: (wiz.bindings || []).map((b) => b.param).sort(),
                layout: wiz.layout, latheTool: wiz.latheTool, panel: wiz.panel, group: wiz.group,
                sameTemplate: JSON.stringify(wiz.template) === JSON.stringify(def.template),
            };
        }
        return out;
    });
    for (const t of ['user_lathe_faceprobe', 'user_lathe_odprobe']) {
        expect(r[t].sameTemplate, `${t}: the template survives the trip`).toBe(true);
        expect(r[t].layout && r[t].layout.kind, `${t}: it still knows to draw a half-profile`).toBe('lathe_profile');
        expect(r[t].latheTool, `${t}: and what it puts against the work`).toBe('probe');
        expect(r[t].group).toBe('lathe');
        expect(r[t].bindings, `${t}: every field travels`).toContain('tipRadius');
        expect(r[t].bindings).toContain('wcs');
    }
    expect(r.user_lathe_faceprobe.bindings, 'the face probe carries its one identity field').toContain('ahead');
    expect(r.user_lathe_odprobe.bindings, 'and the OD probe carries the measurement').toContain('caliperDiameter');
});

test('THE SCENE, BOTH WAYS — a stylus against the bar on a lathe, and the mill probes untouched', async ({ page }) => {
    await boot(page, 'lathe');
    await page.evaluate(() => window.openWiz('user_lathe_odprobe'));
    await page.waitForTimeout(1800);
    const lathe = await page.evaluate(() => {
        const v = window.__ddcsLastViz;
        return {
            tool: v && v._simTool && v._simTool.type,
            ruby: !!(v && v._animParts && v._animParts.ruby),      // the touching ball, red, as on a mill probe
            stock: v && v._stock && { shape: v._stock.shape, axis: v._stock.axis },
            probeMoves: v && v._parsed && v._parsed.stats && v._parsed.stats.probe,
        };
    });
    expect(lathe.tool, 'a probe program shows a PROBE, not a turning insert').toBe('probe');
    expect(lathe.ruby, 'with the ruby ball that does the touching').toBe(true);
    expect(lathe.stock, 'against the bar, lying along the bed').toEqual({ shape: 'cylinder', axis: 'z' });
    // THE MILL PROBES ARE NOT TOUCHED: never frame-gated, and their own op still emits its own sequence.
    await boot(page, 'mill');
    const mill = await page.evaluate(async () => {
        const G = await import('/ui/axisGating.js');
        const uo = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const def = uo.listUserOps().find((d) => d.opType === 'user_edge_data');
        const nc = def ? String(emitProgram(builderOf('user_edge_data')({ ...uo.defaultParams(def) }))) : '';
        return {
            found: !!def, gatedOnMill: G.frameWhy('user_edge_data'), gatedOnLathe: G.frameWhy('edge'),
            hasProbe: /G31/.test(nc), hasWrite: /#\[#70/.test(nc), stopsSpindle: /\bM5\b/.test(nc),
        };
    });
    expect(mill.found, 'the mill edge twin is registered as it always was').toBe(true);
    expect(mill.gatedOnMill, 'a mill probe is never frame-gated').toBe('');
    expect(mill.gatedOnLathe).toBe('');
    expect(mill.hasProbe, 'and still probes').toBe(true);
    expect(mill.hasWrite, 'and still writes its datum through the same seam').toBe(true);
    // …and the lathe family's spindle rule is the LATHE FAMILY'S. A mill edge probe was not given one, because a
    // mill's spindle is not what makes this dangerous — a chuck spinning the WORK against the stylus is.
    expect(mill.stopsSpindle, 'the mill probe is exactly as it was').toBe(false);
});
