import { test, expect } from './support/harness.mjs';

/**
 * HOMING WIZARD OUTPUT = explicit G31 seek (t499). The human's want: "the wizard is for g31", "i dont like that the
 * homing param are in macro" (M98 P501 hides feed/dir/port inside the controller's O501). So the homing WIZARD now
 * emits G31 by DEFAULT — the seek params (feed, dir, port P#[1045+N*3], level L#[1047+N*3]) are VISIBLE in the emitted
 * G-code — and the seek runs TOWARD the home switch (machine-0), not the far end. `native` (M98 P501) stays a SEPARATE
 * setup option. Grounded vs O501 (slib-g.nc): seek dir/dist #[2+N]=20000*#[612+N]-10000 (line 184); the seek G31 P-word
 * = the limit port #[1045+N*3], L = active level #[1047+N*3] (line 190). VERIFY IN THE REAL APP (drive the wizard).
 *
 * t2695 — TIER MIGRATION BATCH 5: moved browser→node. The dispatch expected only ONE real-app test to stay ("the
 * rAF frame-sample test"), but reading found TWO ("REAL APP: the homing wizard code panel..." and "REAL APP: with
 * a STOCK SHOWN...") — both genuinely drive a real wizard + real DOM + (the second) an rAF `viz._animTool`
 * world-matrix frame-sampling loop. Moved the other two, which are pure: test 1 (`homingStack`/`emitMapped`, no
 * DOM) and the final clamp test (`GcodeExecutionEngine` with a stubbed settings function, no DOM). Both real-app
 * tests split into tests/homing-g31-output-drive.spec.js, left in the browser tier.
 */

// ── UNIT: the default output is G31 (not M98), seeking TOWARD home, with the params visible + grounded vs O501. ──
test('the homing wizard emits G31 by default (params visible), NOT M98 P501; seek is toward machine-0/home', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // DEFAULT config (method OMITTED → the wizard's default = seek). Z=-120 → home at the TOP (machine-0).
        const zEmit = emitMapped(homingStack({ axes: ['z'], config: { z: { enable: true, backoff: 5, seekPasses: 1 } }, machine: { z: -120 } })).text;
        // A POSITIVE envelope (X=+300) → home at the min (0) end → the seek runs NEGATIVE toward it.
        const xEmit = emitMapped(homingStack({ axes: ['x'], config: { x: { enable: true, backoff: 5, seekPasses: 1 } }, machine: { x: 300 } })).text;
        return { zEmit, xEmit };
    });
    // The wizard's output is G31 — NOT the M98 P501 native call that hides the params in the controller macro.
    expect(r.zEmit, 'default output is a G31 seek').toContain('G31');
    expect(r.zEmit, 'default output is NOT the native M98 P501 macro call').not.toContain('M98P501');
    // t536 — the SIMPLE readable shape: a G31 seek toward home over ~the travel span + margin (NOT ±10000), feed/port/level
    // visible. Z=-120 (no declared home) → home is the TOP (machine-0) → seek UP = POSITIVE; X=+300 → the min end → NEGATIVE.
    expect(r.zEmit, 'Z=-120 seeks UP toward machine-0/home (a POSITIVE, span-sized seek — not ±10000)').toMatch(/G31 Z\d+(\.\d+)? F600 P#1051 L#1053/);
    expect(r.xEmit, 'X=+300 seeks toward machine-0/home (a NEGATIVE seek)').toMatch(/G31 X-\d+(\.\d+)? F\d+ P#1045 L#1047/);
    expect(r.zEmit, 'the fast seek feed is a plain, visible value (not a #var)').toContain('F600');
    // the opaque O501 machinery is GONE — a human can read every line
    expect(r.zEmit, 'no 7-read debounce vote').not.toMatch(/debounce/i);
    expect(r.zEmit, 'no GOTO/label soup').not.toMatch(/GOTO4|N4[0-9]/);
    expect(r.zEmit, 'no ±10000 magic seek distance').not.toContain('10000');
    // the datum + homed flag are set at the resolved literal registers (Z → #882 coord, #1517 flag)
    expect(r.zEmit, 'sets the Z machine-coord datum').toContain('#882=0');
    expect(r.zEmit, 'sets the Z homed flag').toContain('#1517=1');
});

// A PLAYED G31 seek toward home, with NO stock (the homing context), stops AT the home switch = the machine envelope
// edge (machine-0), NOT running the full seek distance to the far corner (the "-20000 plunge" if executed). The engine
// clamps the seek to the envelope span (part = machine·unitScale − wcsOffset). NOTE: the sim visualizes homing via the
// clean simProxy; the FULL emitted macro (multi-pass debounce/re-seek) relies on controller registers the Studio sim
// doesn't seed, so this pins the CLAMP on a representative single seek line, not a full-macro replay.
const CLAMP_STUB = `window.ddcsGetSettings = () => ({ machine: { x: 600, y: -600, z: -120, softLimits: true }, homing: { axes: {} }, stock: { show: false } });`;
test('a PLAYED G31 seek toward home (no stock) clamps to the switch/machine-0, not the +10000 far end', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const z = await page.evaluate(async (stub) => {
        eval(stub);
        const { GcodeExecutionEngine } = await import('/engine/index.js');
        // Z=-120 → home is the TOP (machine-0). Seek UP (+10000, the wizard's reconciled direction) from mid-travel.
        const code = ['G90', 'G0 X0 Y0 Z-50', 'G91 G31 Z10000 F600 P1 L1 K0 Q0', 'M30'].join('\n');
        const eng = new GcodeExecutionEngine({ autoAnswer: true });   // no stock passed → this.stock=null → homing context
        eng.trace(code);
        return eng.pos.z;
    }, CLAMP_STUB);
    // The seek stops at the home switch = machine-0 (z=0), NOT at -50+10000 (unclamped) nor the -120 far end.
    expect(Math.abs(z) < 1, `the seek clamps to the home switch machine-0 (z=${z}), not the far corner`).toBe(true);
});
