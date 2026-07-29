import { test, expect } from '@playwright/test';

/**
 * t1353 — THE TRANSFORM REFUSE-GUARD, landed BEFORE the switch makes parametric bodies reachable rather than after.
 *
 * Every whole-program transform works by finding a number after an axis letter and writing a different number back.
 * That is exact on coordinates that ARE numbers and the wrong tool entirely on `X[0 + #40]` / `Y#47`. t1351 measured
 * all three failure modes on the parametric surfacing body:
 *   translate — rewrites the X, leaves the register Y: a HALF-SHIFTED move, so the raster shears.
 *   rotate    — couples the axes, so it APPENDS the word it cannot replace: an uncommanded `Y0` on a cutting line.
 *   mirror    — matches nothing: a two-sided setup cuts the FIRST side again on an already-flipped part.
 *
 * So they refuse, with the reason on the refusal. The interesting half of this spec is the SECOND half: a guard that
 * refuses the innocent is not a safety feature, it is a broken app.
 */
const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('the three transforms REFUSE parametric motion — all-or-nothing, with a reason that names the register', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { rotateProgram, mirrorProgram, translateProgram, parametricMotion } = await import('/data/rotateProgram.js');
        const NL = String.fromCharCode(10);
        const prog = ['G90', 'G0 X0 Y#47', 'G1 X[0 + #40] F900', 'G1 X0 F900', 'M30'].join(NL);
        const t = translateProgram(prog, 50, 25, 0), ro = rotateProgram(prog, 30, 0, 0), mi = mirrorProgram(prog, 'Y', 200, 150, 25);
        return {
            hit: parametricMotion(prog),
            t: { text: t.text, refused: t.refused || '', moved: t.moved },
            ro: { text: ro.text, refused: ro.refused || '', rotated: ro.rotated },
            mi: { text: mi.text, refused: mi.refused || '', mirrored: mi.mirrored },
            prog,
        };
    });
    // The predicate names WHICH line and WHY, in a reader's words.
    expect(r.hit, 'the predicate finds it').toBeTruthy();
    expect(r.hit.why, 'and says what is wrong with it').toMatch(/macro register/);
    for (const [name, res] of [['translate', r.t], ['rotate', r.ro], ['mirror', r.mi]]) {
        expect(res.refused, `${name} refuses with a reason`).toMatch(new RegExp(`${name} refused:`));
        // ALL-OR-NOTHING is the property that matters. A partially-transformed program is worse than an
        // untransformed one, because it looks like it worked.
        expect(res.text, `${name} returns the program completely untouched`).toBe(r.prog);
    }
    expect(r.t.moved, 'translate moved nothing').toBe(0);
    expect(r.ro.rotated, 'rotate rotated nothing').toBe(0);
    expect(r.mi.mirrored, 'mirror mirrored nothing').toBe(0);
});

test('a purely NUMERIC program still transforms exactly as before — the guard is not a blanket off-switch', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { rotateProgram, mirrorProgram, translateProgram } = await import('/data/rotateProgram.js');
        const NL = String.fromCharCode(10);
        const prog = ['G90', 'G0 X10 Y20', 'G1 X30 Y20 F500', 'G1 X30 Y40', 'M30'].join(NL);
        return {
            t: translateProgram(prog, 5, 5, 0), ro: rotateProgram(prog, 90, 0, 0), mi: mirrorProgram(prog, 'Y', 100, 100, 10),
        };
    });
    expect(r.t.refused, 'a numeric program is not refused').toBeFalsy();
    expect(r.t.moved, 'and really is translated').toBeGreaterThan(0);
    expect(r.t.text, 'by the right amount').toContain('X15 Y25');
    expect(r.ro.rotated, 'rotation still applies').toBeGreaterThan(0);
    expect(r.mi.mirrored, 'and so does the mirror').toBeGreaterThan(0);
});

/**
 * THE EXEMPTION THAT MAKES THE GUARD USABLE. Measured across the registered ops: 24 of 54 emit a register axis word,
 * and every one of them is the probe idiom `G31 X#8 F#3` sitting inside a G91 region. Every transform already returns
 * G91 and G53 lines untouched, so those registers were never at risk of a half-rewrite — and a predicate blind to the
 * modal state would have refused every probing program in the app, including the very alignment rotation that exists
 * to rotate one. This is the assert that stops the guard being widened into a blanket refusal later.
 */
test('G91 and G53 registers are EXEMPT — no probing program is refused', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { parametricMotion, rotateProgram } = await import('/data/rotateProgram.js');
        const ob = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        const probes = ['corner', 'edge', 'middle', 'alignment'];
        const perOp = probes.map((op) => {
            const txt = String(emitProgram(ob.builderOf(op)({})));
            const hit = parametricMotion(txt);
            const ro = rotateProgram(txt, 15, 0, 0);
            return { op, refused: !!hit, why: hit ? hit.line.trim().slice(0, 60) : '', g31: (txt.match(/\bG31\b/g) || []).length, roRefused: ro.refused || '', rotates: ro.rotated };
        });
        return {
            perOp,
            // the exemptions in isolation, so the reason is legible without a whole program
            g91: parametricMotion(['G90', 'G91', 'G31 X#8 F#3', 'G90'].join(NL)),
            g53: parametricMotion(['G90', 'G53 Z#101', 'M30'].join(NL)),
            // …and the guard still fires on the SAME register once the program is back in absolute
            backToAbs: parametricMotion(['G90', 'G91', 'G31 X#8', 'G90', 'G0 X#8 Y0'].join(NL)),
        };
    });
    for (const o of r.perOp) {
        expect(o.g31, `${o.op} really does emit probe moves (the exemption is not vacuous)`).toBeGreaterThan(0);
        expect(o.refused, `${o.op} is NOT refused — its registers are all inside G91: ${o.why}`).toBe(false);
        // …and the rotation ARRIVES rather than being turned away at the door. What it then finds to rotate is the
        // op's own business: a probe routine is G91 + G53 throughout, so a legitimate zero here means "nothing
        // absolute to rotate", not "refused". The distinction is the whole point, so both are asserted separately.
        expect(o.roRefused, `${o.op}: the rotation is not refused`).toBe('');
        expect(typeof o.rotates, `${o.op}: it ran and reported a count`).toBe('number');
    }
    expect(r.g91, 'a register inside G91 is exempt — every transform leaves G91 alone').toBe(null);
    expect(r.g53, 'and so is the G53 machine-frame retract in the standard program tail').toBe(null);
    expect(r.backToAbs, 'but the SAME register in an absolute region is caught').toBeTruthy();
    expect(r.backToAbs.why, 'and named').toMatch(/macro register/);
});
