import { test, expect } from '@playwright/test';

/**
 * t1512 — THE CAM LIFT, BUILT. A slot wider than its tool packs a CAM slot whose clearing IS the parametric raster
 * atom, so the t1444 width gate lifts for it.
 *
 * The domain is the one t1510 MEASURED and t1511 RULED: a bearing of 0 packs; every other bearing keeps the literal
 * centreline body and an honest refusal, because the atom would silently drop the angle. ⚠ AND THE ARM CONTAINS NO
 * BEARING CHECK — eligibility asks the atom's own envelope, so when C5 (the live-frame rotation) lands, angled slots
 * begin packing with nothing in the generator changed. PROOF 6 is what holds that structural condition in place.
 */

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** A slot op's params, at the wizard's own defaults unless overridden. */
const OP = { ax: 0, ay: 0, bx: 60, by: 0, width: 12, toolDia: 6, stepoverPct: 40, depth: 4, stepdown: 1.5,
             entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };

/**
 * ── PROOF 1 — THE INDIRECTION CHAIN (t1410): the packed macro's phases are the WIZARD-PATH atom's, at the same values.
 *
 * The claim the whole act rests on is that this is a DELEGATION, not a second slot emitter. So the packed body is
 * compared against the atom emitted DIRECTLY from the wizard's own `slotRasterParams`, with the packed body's registers
 * substituted by the values its read-lines seed them from. Move for move, or it is not a delegation.
 */
test('PROOF 1 — the packed body IS the wizard-path atom, move for move (the indirection chain)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        // the PACKED arm, built the way the pack builds it: the frame declared BAKED at the op's real endpoints
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        decl.entry = { exposed: false, value: op.entry };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        // …and the WIZARD path's atom at the identical values
        const want = surfaceRasterLines(slotRasterParams(slotLeafParams(op)));
        /**
         * Substitute each live register by the value its own read-line seeds it from.
         * ⚠ THE LOOKAHEAD IS LOAD-BEARING — the first cut of this harness used a plain string replace and turned the
         * atom's OWN `#47`/`#46`/`#40` into `47`/`46`/`40` by matching the `#4` prefix, then reported a mismatch that
         * was entirely the harness's. A register name ends where the digits end.
         */
        const seed = {};
        for (const f of g.fields) if (f.var) seed[f.var] = String(op[f.key] != null ? op[f.key] : f.def);
        const sub = (s) => Object.keys(seed).reduce((t, k) => t.replace(new RegExp(k + '(?![0-9])', 'g'), seed[k]), s);
        // the MOTION only: `G0 `/`G1 ` moves, which also excludes the packed arm's own spindle `G04` dwell
        const cut = (ls) => ls.filter((l) => /^\s*G[01] /.test(l)).map((l) => l.trim().replace(/\s+\(.*$/, ''));
        const got = cut(g.body.split('\n').map(sub));
        const exp = cut(want);
        const diff = exp.findIndex((l, i) => l !== got[i]);
        /**
         * ⚠ THE MOVES ALONE ARE NOT THE PROOF, and the first version of this test stopped there and would have passed
         * on a body whose GEOMETRY was wrong. In a parametric walk the moves are written in the atom's own registers
         * (`X[0 + #40] Y#47`) — identical on both sides by construction — while every dimension lives in the HEADER
         * assignments that seed those registers. So the header is compared too, and NUMERICALLY, because the packed
         * side is an expression (`#41=[#1 - 2 * [#2/2]]`) where the baked side is a folded number (`#41=6`): the same
         * quantity, and there is no text form in which they agree.
         */
        const evalRhs = (rhs, env) => {
            // DDCS → JS: `[…]` are the grouping brackets and `FIX[…]` is a truncation. NB the FIX rewrite must NOT add
            // a paren of its own — `[` becomes `(` a moment later, and doing both leaves the expression unbalanced.
            const js = rhs.replace(/\(.*$/, '').replace(/;.*$/, '')
                .replace(/FIX\s*\[/g, 'Math.trunc[').replace(/\[/g, '(').replace(/\]/g, ')')
                .replace(/#(\d+)/g, (m, n) => (env['#' + n] === undefined ? 'NaN' : '(' + env['#' + n] + ')'));
            try { return Function('Math', 'return ' + js)(Math); } catch (e) { return NaN; }
        };
        const header = (lines, seedEnv) => {
            const env = { ...seedEnv }, out = [];
            for (const l of lines) {
                const m = String(l).match(/^\s*(#\d+)\s*=\s*(.+)$/);
                if (!m) continue;
                const v = evalRhs(m[2], env);
                env[m[1]] = v; out.push([m[1], v]);
            }
            return out;
        };
        // the packed arm's header starts from its READ lines (`#1=#2600`), so the #2600 mirrors are seeded with the
        // values the pendant would hold — i.e. the operator's own numbers, which is the whole point of the arm
        const mirrors = {};
        for (const f of g.fields) if (f.idx != null) mirrors['#' + (f.idx + 1500)] = Number(op[f.key] != null ? op[f.key] : f.def);
        const hGot = header(g.body.split('\n'), mirrors);
        const hExp = header(want, {});
        const pick = (h) => h.filter(([k]) => ['#40', '#41', '#42', '#43', '#44', '#45'].includes(k));
        const a = pick(hGot), b = pick(hExp);
        const hDiff = b.findIndex(([k, v], i) => !a[i] || a[i][0] !== k || !(Math.abs(a[i][1] - v) < 1e-9));
        return { n: exp.length, gotN: got.length, equal: exp.length === got.length && diff < 0, diff, e: exp[diff], g: got[diff],
                 hn: b.length, hEqual: b.length > 0 && hDiff < 0, hDiff, hA: a[hDiff], hB: b[hDiff], a, b };
    }, OP);
    expect(r.n, 'the wizard-path atom really emits a walk to compare against').toBeGreaterThan(5);
    expect(r.equal, `the packed macro's motion IS the atom's (${r.n} vs ${r.gotN} moves; first difference at ${r.diff}: "${r.e}" vs "${r.g}")`).toBe(true);
    // …and the GEOMETRY that motion runs on agrees numerically: the walked spans, the depth, the bite, the stepover, the row count
    expect(r.hn, 'the atom really declares its geometry in the header').toBe(6);
    expect(r.hEqual, `the packed header computes the SAME geometry (${JSON.stringify(r.hB)} vs ${JSON.stringify(r.hA)}) — packed ${JSON.stringify(r.a)} / baked ${JSON.stringify(r.b)}`).toBe(true);
});

/**
 * ── PROOF 2 — NO KNOB DARK, proved by REACHABILITY rather than by a text diff ──────────────────────────────────────
 *
 * The law is the project's: a control that does not reach the machine is worse than no control.
 *
 * ⚠ THE FIRST VERSION OF THIS PROOF USED THE WRONG INSTRUMENT, and the wrong instrument reported five knobs dark that
 * are not. It substituted a dialled value into the body and diffed the `G` lines — but a PARAMETRIC macro is precisely
 * one whose knobs do NOT appear in its moves: `width` reaches the motion by seeding `#41`, which sets the row count
 * `#45`, which bounds the loop the moves sit in. Diffing the moves measures the wrong thing by construction, and on a
 * parametric body it will keep saying "dark" no matter how live the knob is.
 *
 * So this walks the DATAFLOW instead: seed the reachable set with every register the motion lines read (plus the loop
 * bounds and guards that decide whether they run), then close it backwards over the body's own assignments. A knob is
 * live iff its register is in that closure — which is exactly "the value reaches the machine", stated so a parametric
 * body can satisfy it.
 */
test('PROOF 2 — no knob dark: every live field REACHES the motion, every baked row says why', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        decl.entry = { exposed: false, value: op.entry };
        const g = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl);
        const lines = g.body.split('\n');
        const regs = (s) => (String(s).match(/#\d+/g) || []);
        // the SEED: everything the motion reads, plus the loop bounds / guards that decide whether the motion runs,
        // plus the spindle word (rpm reaches the machine through `M3 S[…]`, not through a coordinate)
        const seed = new Set();
        for (const l of lines) {
            if (/^\s*(G[01]\s|WHILE|IF|M3)/.test(l)) regs(l.replace(/\(.*$/, '')).forEach((x) => seed.add(x));
        }
        // …closed BACKWARDS over the body's own assignments: `#N=<expr>` pulls every register in <expr> in with it
        const assigns = [];
        for (const l of lines) { const m = l.match(/^\s*(#\d+)\s*=\s*(.*)$/); if (m) assigns.push([m[1], m[2].replace(/\(.*$/, '').replace(/;.*$/, '')]); }
        let grew = true;
        while (grew) {
            grew = false;
            for (const [lhs, rhs] of assigns) if (seed.has(lhs)) for (const x of regs(rhs)) if (!seed.has(x)) { seed.add(x); grew = true; }
        }
        const live = g.fields.filter((f) => f.var);
        return {
            reach: live.filter((f) => seed.has(f.var)).map((f) => f.key),
            dark: live.filter((f) => !seed.has(f.var)).map((f) => f.key),
            liveKeys: live.map((f) => f.key),
            bakedRows: g.fields.filter((f) => f.bakeOnly).map((f) => ({ key: f.key, exposable: f.exposable, why: f._exposeTip || '' })),
            // …and the endpoints are LITERALS in the body, which is the other half of the claim
            frameLiteral: /A \(0, 0\) -> B \(60, 0\) is BAKED/.test(g.body),
        };
    }, OP);
    // the four this act adds are LIVE #2600 knobs
    for (const k of ['width', 'toolDia', 'stepoverPct', 'plunge']) {
        expect(r.liveKeys, `${k} is a live #2600 knob on the packed arm`).toContain(k);
    }
    // …and NOT ONE of them is dark: every live register reaches the motion through the body's own dataflow
    expect(r.dark, `no live knob is DARK — these never reach the motion: ${r.dark.join(', ')}`).toEqual([]);
    expect(r.reach.length, 'and the closure really resolved the whole live set').toBe(r.liveKeys.length);
    // the baked rows are GREYED WITH A REASON, never hidden (postGating's rule)
    expect(r.bakedRows.map((b) => b.key).sort(), 'the four endpoints + the ramp angle are declared bake-only rows').toEqual(['ax', 'ay', 'bx', 'by', 'rampAngle'].sort());
    for (const b of r.bakedRows) {
        expect(b.exposable, `${b.key} is not exposable`).toBe(false);
        expect(b.why.length, `${b.key} SAYS why on the greyed control`).toBeGreaterThan(40);
    }
    expect(r.bakedRows.find((b) => b.key === 'ax').why, 'and the endpoints name the trig gate').toMatch(/ATAN|SQRT/);
    expect(r.bakedRows.find((b) => b.key === 'ax').why, '…and the exit').toMatch(/Slot wizard/);
    expect(r.frameLiteral, 'the frame really is a build-time literal in the macro head, stated for the reader').toBe(true);
});

/**
 * ── PROOF 3 — THE FORMAT CHANGE, BOTH HALVES. What JOINS the #2600 layout and what LEAVES it, measured on the layout.
 */
test('PROOF 3 — the #2600 layout gains four knobs and loses the endpoints', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        const layout = (arm, d) => slotFromOp('slot', arm, new Set(), 0, d).fields.filter((f) => f.idx != null).map((f) => f.key);
        return { atom: layout(SLOT_ARM.atom, decl), lit: layout(SLOT_ARM.centreline, undefined) };
    }, OP);
    // JOINED
    for (const k of ['width', 'toolDia', 'stepoverPct', 'plunge']) {
        expect(r.atom, `${k} JOINS the live layout`).toContain(k);
        expect(r.lit, `…and was not in the literal one`).not.toContain(k);
    }
    // LEFT — and this is the half the scout's correction was about: a layout that added knobs and left these lying
    // would ship the silent-substitution defect the whole arc exists to prevent.
    for (const k of ['ax', 'ay', 'bx', 'by']) {
        expect(r.atom, `${k} LEAVES the live layout (baked with the bearing and length it derives)`).not.toContain(k);
        expect(r.lit, '…where the literal arm still exposes it').toContain(k);
    }
});

/**
 * ── PROOF 4 — THE BANDS, and the collision guard at a HIGH varOffset ──────────────────────────────────────────────
 */
test('PROOF 4 — the slot band is the UNION, and no field var can land inside it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { bandsFor, fieldVarCollisions } = await import('/data/camScratch.js');
        const { RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        // the allocator must never PRODUCE a colliding var, on either arm, at any offset — including HIGH ones where
        // the cursor sits inside the union and only the skip pushes it clear
        let bad = null;
        for (let off = 0; off <= 80; off++) {
            for (const arm of [SLOT_ARM.centreline, SLOT_ARM.atom]) {
                const g = slotFromOp('slot', arm, new Set(), off, arm === SLOT_ARM.atom ? decl : undefined);
                const cols = fieldVarCollisions(g.fields.filter((f) => f.var).map((f) => ({ ...f, _op: 0 })), [{ type: 'slot' }]);
                if (cols.length) bad = { off, arm, cols };
            }
        }
        // a HAND-PLACED var inside each band must be FLAGGED (the guard is live, not vacuous) — incl. the probe-temp overlap
        const flagged = (n) => fieldVarCollisions([{ var: '#' + n, key: 'width', label: 'Slot width', _op: 0 }], [{ type: 'slot' }]).length > 0;
        const atHigh = slotFromOp('slot', SLOT_ARM.atom, new Set(), 33, decl).fields.filter((f) => f.var).map((f) => f.var);
        return { bands: bandsFor('slot'), raster: RASTER_SCRATCH, bad,
                 flags: [34, 40, 49, 50, 54, 62, 64].map(flagged), clear: [33, 65].map(flagged), atHigh };
    }, OP);
    expect(r.bad, `the allocator never self-collides over varOffset 0..80 on either arm (${JSON.stringify(r.bad)})`).toBe(null);
    expect(r.flags.every(Boolean), 'the guard FLAGS a var in every band member — including the #50-#54 the literal body writes').toBe(true);
    expect(r.clear, 'and is clear immediately below and above the union (#33 / #65)').toEqual([false, false]);
    // at a HIGH varOffset the union is what pushes the vars clear, which is the case the scout said to assert
    expect(r.atHigh.every((v) => Number(v.slice(1)) > 54), `at varOffset 33 every var clears the union: ${r.atHigh.join(' ')}`).toBe(true);
});

/**
 * ── PROOF 5 — THE REFUSALS, in the table's words. Angled, helix, zero-band, and an EXPOSED endpoint.
 */
test('PROOF 5 — every refusal is in its own words, and an exposed endpoint emits NO motion', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { camTypeOf, slotPackArm } = await import('/data/opCamMap.js');
        const { slotFromOp, SLOT_ARM, SLOT_FRAME_EXPOSED_REFUSAL } = await import('/data/opToSlot.js');
        const at = (over) => { const p = { ...op, ...over }; return { gate: camTypeOf({ opType: 'slot', params: p }), arm: slotPackArm(p) }; };
        // a caller that exposed an endpoint: decl carries entries but not the frame
        const exposed = slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, { entry: { exposed: false, value: 'plunge' } });
        return {
            straight: at({}), angled: at({ bx: 0, by: 60 }), diagonal: at({ bx: 42.43, by: 42.43 }),
            helix: at({ entry: 'helix' }), zeroBand: at({ width: 6 }), ramp: at({ entry: 'ramp' }),
            exposedBody: exposed.body, refusal: SLOT_FRAME_EXPOSED_REFUSAL,
        };
    }, OP);
    // what PACKS
    expect(r.straight.gate.camType, 'a wide bearing-0 slot packs').toBe('slot');
    expect(r.straight.arm, '…on the ATOM arm').toBe('atom');
    expect(r.ramp.arm, 'and a RAMP entry packs the atom too (C4 made the ramp pendant-true)').toBe('atom');
    // what REFUSES, each in its own words
    expect(r.angled.gate.unsupported, 'a +Y wide slot is refused').toBeTruthy();
    expect(r.angled.gate.unsupported, '…naming the bearing that cannot be applied').toMatch(/bearing/);
    expect(r.angled.gate.unsupported, '…the pending capability').toMatch(/C5/);
    expect(r.angled.gate.unsupported, '…and the exit').toMatch(/Slot wizard/);
    expect(r.diagonal.gate.unsupported, 'a 45° wide slot likewise').toBeTruthy();
    expect(r.helix.gate.unsupported, 'a wide HELIX slot is refused in the helix gap\'s own words').toMatch(/ENTRY END|entry end/);
    // the zero band is not a refusal at all — it is the LITERAL arm, where one centreline pass is the right program
    expect(r.zeroBand.gate.camType, 'the zero band packs, on the literal arm').toBe('slot');
    expect(r.zeroBand.arm, '…the centreline one').toBe('');
    // an exposed endpoint REFUSES rather than emitting a slot that cuts the old angle through the new point
    expect(r.exposedBody, 'the refusal is the declared sentence, not an invented one').toContain(r.refusal);
    expect(r.exposedBody.split('\n').filter((l) => /^\s*G[01] /.test(l)), 'and it emits NO motion whatsoever').toEqual([]);
    expect(r.exposedBody, '…while setting the error register and halting').toMatch(/#1505=1/);
});

/**
 * ── PROOF 6 — THE STRUCTURAL CONDITION (t1511): the arm holds NO bearing check of its own ──────────────────────────
 *
 * The ruling's condition is that eligibility asks the ENVELOPE, so that C5 lifts the angled case with the generator
 * untouched. That is a claim about the SOURCE, so it is asserted against the source: no bearing arithmetic in the
 * pack's decision path, and the refusal's words are the ATOM's, reached through the declared predicate.
 */
test('PROOF 6 — eligibility asks the envelope; no bearing check lives in the CAM layer', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const camMap = await (await fetch('/data/opCamMap.js')).text();
        const toSlot = await (await fetch('/data/opToSlot.js')).text();
        const { slotPackGap, slotPackArm, SLOT_ARM_SEED } = await import('/data/opCamMap.js');
        const { surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const angled = { ax: 0, ay: 0, bx: 0, by: 60, width: 12, toolDia: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge' };
        // a bearing COMPARISON or a bearing FUNCTION CALL in either CAM-layer file would be the hand-rolled check
        const bearingCheck = /bearing\s*[=!<>]=|slotBearingDeg|Math\.atan2/;
        return {
            camMapHasCheck: bearingCheck.test(camMap), toSlotHasCheck: bearingCheck.test(toSlot),
            // the gap the pack reports is verbatim the ATOM's own sentence for the shape the pack will emit
            packGap: slotPackGap(angled),
            atomGap: surfaceRasterGap(slotRasterParams({ x0: 0, y0: 0, x1: 0, y1: 60, width: 12, tool: 6, depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge' }, SLOT_CAM_PACK_REGS)),
            // the per-arm re-hydration seeds round-trip through the SAME resolver the pack uses
            roundTrip: Object.keys(SLOT_ARM_SEED).map((a) => [a, slotPackArm(SLOT_ARM_SEED[a])]),
        };
    });
    expect(r.camMapHasCheck, 'opCamMap holds no bearing comparison of its own').toBe(false);
    expect(r.toSlotHasCheck, 'and neither does the generator').toBe(false);
    expect(r.packGap, 'the pack\'s refusal IS the atom\'s sentence, not a restatement of it').toBe(r.atomGap);
    expect(r.packGap, '…and that sentence is the live-frame bearing refusal').toMatch(/bearing of 90/);
    // the manifest's per-arm seeds must resolve back to their own arm, or a saved slot re-hydrates on the wrong body
    expect(r.roundTrip, 'each declared arm seed resolves to that arm').toEqual([['atom', 'atom'], ['centreline', '']]);
});

/**
 * ── PROOF 7 — @work IS OMITTED, HONESTLY, and the wizard path still carries it ─────────────────────────────────────
 *
 * t1383's rule is never to declare wrong. The packed body's execution size cannot be known at build time (the area and
 * the stepover are pendant knobs), and the atom already drops its own `@work` marker on live geometry — so this asserts
 * the packed macro carries none while the fully-baked wizard body does, i.e. the honesty is the atom's and it survived
 * the delegation rather than being re-implemented here.
 */
test('PROOF 7 — the packed macro declares no @work, and the baked wizard body still does', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (op) => {
        const { slotFromOp, SLOT_ARM } = await import('/data/opToSlot.js');
        const { slotRasterParams, SLOT_CAM_PACK_REGS } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const { slotLeafParams } = await import('/wizards/slotWizard.js');
        const decl = {};
        for (const k of ['ax', 'ay', 'bx', 'by', 'rampAngle']) decl[k] = { exposed: false, value: op[k] };
        const leaf = slotLeafParams(op);
        return {
            packed: slotFromOp('slot', SLOT_ARM.atom, new Set(), 0, decl).body,
            baked: surfaceRasterLines(slotRasterParams(leaf)).join('\n'),
            stepsBaked: surfaceRasterWorkSteps(slotRasterParams(leaf)),
            stepsLive: surfaceRasterWorkSteps(slotRasterParams(leaf, SLOT_CAM_PACK_REGS)),
        };
    }, OP);
    expect(r.stepsBaked, 'the fully-baked config CAN declare its work').not.toBe(null);
    expect(r.stepsLive, '…and the live one cannot, so the atom returns null').toBe(null);
    expect(/@work/.test(r.baked), 'so the wizard-path body carries a @work marker').toBe(true);
    expect(/@work/.test(r.packed), '…and the packed macro carries none — never declare wrong (t1383)').toBe(false);
});

/**
 * ── PROOF 8 — THE WIZARD PATH IS UNTOUCHED. `slotRasterParams` with no register map is byte-identical.
 *
 * The second rendering was added to the FORWARD function rather than copied into the CAM layer, which is only safe if
 * the no-regs path is provably the old one. Swept over widths, tools, angles, entries and depths.
 */
test('PROOF 8 — the no-regs frame is byte-identical, swept', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        // the arithmetic the second rendering replaced, written out here as the INDEPENDENT truth
        const want = (p) => {
            const tool = Math.max(0.1, Number(p.tool)), width = Number(p.width);
            const rad = Math.atan2(p.y1 - p.y0, p.x1 - p.x0);
            return { x: p.x0 + (width / 2) * Math.sin(rad), y: p.y0 - (width / 2) * Math.cos(rad), h: width, insetAcross: tool / 2 };
        };
        let n = 0, bad = [];
        for (const width of [8, 12, 16, 20]) for (const tool of [4, 6, 8]) for (const deg of [0, 30, 45, 90, -30, 137.5, 180]) {
            for (const entry of ['plunge', 'ramp']) for (const depth of [2, 4, 5.5]) {
                const rr = deg * Math.PI / 180;
                const p = { x0: 3, y0: 7, x1: 3 + 60 * Math.cos(rr), y1: 7 + 60 * Math.sin(rr), width, tool,
                            stepoverPct: 40, depth, stepdown: 1.5, entry, rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };
                const got = slotRasterParams(p), w = want(p);
                n++;
                if (!(Object.is(got.x, w.x) && Object.is(got.y, w.y) && Object.is(got.h, w.h) && Object.is(got.insetAcross, w.insetAcross))) {
                    bad.push({ width, tool, deg, entry, depth, got: [got.x, got.y], w: [w.x, w.y] });
                }
                // and the emitted body must still build for every one of them
                if (typeof surfaceRasterLines(got).join !== 'function') bad.push({ width, tool, deg, entry, depth, emit: 'threw' });
            }
        }
        return { n, bad: bad.slice(0, 4), count: bad.length };
    });
    expect(r.n, 'the sweep is real').toBeGreaterThan(400);
    expect(r.count, `every no-regs frame is BIT-identical to the arithmetic it replaced (${JSON.stringify(r.bad)})`).toBe(0);
});
