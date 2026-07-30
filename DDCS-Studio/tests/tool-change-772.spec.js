import { test, expect } from '@playwright/test';

/**
 * t772 Phase 2 — the MACHINE-MODE tool-change EMIT ARMS. applyToolChanges scans the @TOOL markers per op, tracks the modal
 * loaded tool across the program, and injects the change arm ONLY on a DIFFERENCE (loaded starts null → op-1 always arms;
 * Studio never guesses physical state). Three modes: ATC → `T# M6` (the installed T.nc + the runtime #1300 no-op); MANUAL →
 * the confirmBlock prompt (dialect-aware: an HMI prompt, or `( Load … )` + M0 off-HMI); NONE → an honest comment. An op with
 * no declared tool is byte-identical (the goldens hold).
 */

// Build an N-op program (each op = the drill twin with the given toolNum) + emit under a mode + dialect.
const emitProgram = (page, tools, mode, dialectKey) => page.evaluate(async ({ tools, mode, dialectKey }) => {
  const s = window.ddcsGetSettings(); s.atc = s.atc || {};
  s.atc.tools = [{ num: 3, name: 'ball', type: 'ballnose', dia: 6 }, { num: 5, name: 'flat', type: 'endmill', dia: 8 }];
  s.toolChange = { mode };
  const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
  const { registerUserOp } = await import('/blocks/userOps.js');
  const { builderOf } = await import('/blocks/opBuilders.js');
  const { emitMapped } = await import('/blocks/blockEmitter.js');
  const { DIALECTS } = await import('/wizards/dialects/index.js');
  const def = drillDataDef(); registerUserOp(def);
  const build = builderOf(def.opType);
  const program = tools.flatMap((t) => build(t === null ? {} : { toolNum: t }));
  return emitMapped(program, dialectKey ? { dialect: DIALECTS[dialectKey] } : {}).text;
}, { tools, mode, dialectKey });

const count = (s, re) => (s.match(re) || []).length;

/**
 * ── THE ATC PROMPT'S SHAPE, not the register's NAME (t1387) ────────────────────────────────────────────────────────
 *
 * These tests used bare `/#1505/` as their proxy for "an HMI prompt is present". `#1505` is the DDCS Expert's OPERATOR
 * MESSAGE register — a shared resource, not a tool-change feature — and the drill family's parametric body now uses it
 * too, for its zero-bite refusal: `#1505=1   ;ERROR: peck must be greater than zero` (t1385, the switch). So the proxy
 * started matching a line that has nothing to do with tool changing.
 *
 * DIAGNOSED BEFORE NARROWING, because the alternative was a real product defect and the two look identical from the
 * assert. Emitted all three modes plus an op with NO tool declared at all:
 *     none          #1505=1   ;ERROR: peck …           ← the body's refusal, the ONLY hit. No prompt. CORRECT.
 *     manual        #1505=1(Load T3 - 6mm ballnose)    ← the real prompt
 *                   IF #1505==0 GOTO2                  ← its confirm read-back
 *                   #1505=1   ;ERROR: peck …           ← plus the same refusal
 *     atc           the refusal only (ATC arms with `T3 M6`, it does not prompt)
 *     no tool at all  the refusal only — which proves the line is the BODY's, independent of tool changing
 * So NONE mode emits no prompt and the ATC path is unchanged: an OVER-BROAD PROXY, not a product bug.
 *
 * The prompt's distinguishing SHAPE is a MESSAGE PAYLOAD in parentheses — `#1505=<n>(…)`. The refusal writes a bare
 * value with a `;` comment and can never match that. Narrowed to the shape, these asserts say what they always meant.
 *
 * ⚠ AND THE MANUAL-MODE ASSERT WAS THE MORE DANGEROUS OF THE TWO, though it was PASSING: it asserts the prompt IS
 * present, so once the refusal tail supplied a `#1505` it passed no matter what — it would have gone on passing if the
 * prompt were deleted outright. A test that fails for the wrong reason costs an hour; one that passes for the wrong
 * reason costs the feature. Narrowed in the same act, even though nothing was red.
 */
const HMI_PROMPT = /#1505=-?\d+\s*\(/;

test('a two-op SAME-tool program emits ONE arm (op-1) + zero for op-2; no @TOOL marker leaks', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const g = await emitProgram(page, [3, 3], 'atc', 'ddcs-expert-m350');
  expect(count(g, /T3 M6/g), 'exactly one tool change for two same-tool ops (op-1 arms, op-2 no-ops)').toBe(1);
  expect(count(g, /@TOOL/g), 'no marker leaks into the G-code').toBe(0);
});

test('DIFFERING tools emit a change per difference (T3 then T5)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const g = await emitProgram(page, [3, 5], 'atc', 'ddcs-expert-m350');
  expect(count(g, /T3 M6/g), 'op-1 changes to T3').toBe(1);
  expect(count(g, /T5 M6/g), 'op-2 changes to T5 (a difference)').toBe(1);
  expect(g.indexOf('T3 M6'), 'T3 arms before T5').toBeLessThan(g.indexOf('T5 M6'));
});

test('MANUAL mode emits the confirm prompt per post — Expert HMI prompt, V4.1 degrades to a message + M0', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const expert = await emitProgram(page, [3], 'manual', 'ddcs-expert-m350');
  const v41 = await emitProgram(page, [3], 'manual', 'ddcs-v41');
  expect(/Load T3/.test(expert), 'the operator instruction names the tool').toBe(true);
  expect(HMI_PROMPT.test(expert), 'Expert renders a scripted HMI prompt — by its PAYLOAD shape, not the register name').toBe(true);
  expect(/#1505=-?\d+\(Load T3/.test(expert), 'and the prompt carries the tool in its payload (so this cannot pass on an unrelated #1505)').toBe(true);
  expect(/T3 M6/.test(expert), 'manual mode does NOT call the ATC macro').toBe(false);
  expect(/Load T3/.test(v41), 'V4.1 still names the tool').toBe(true);
  expect(/\bM0\b/.test(v41), 'off-HMI it degrades to an M0 that BLOCKS until Cycle Start').toBe(true);
});

test('NONE mode emits an honest comment only — no macro, no prompt', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const g = await emitProgram(page, [3], 'none', 'ddcs-expert-m350');
  expect(/no changer configured/i.test(g), 'the honest no-changer note').toBe(true);
  expect(/load .*T3/i.test(g), 'it still tells the operator which tool').toBe(true);
  // SPLIT, because the two claims fail for different reasons and an `||` hides which one broke.
  expect(/T3 M6/.test(g), 'no ATC macro in NONE mode').toBe(false);
  expect(HMI_PROMPT.test(g), 'and no HMI prompt — matched by the prompt SHAPE, so the body\'s own #1505 refusal cannot trip it').toBe(false);
  // …and the register IS present, from the drill body's refusal tail. Asserted so this test records WHY the old bare
  // `/#1505/` proxy went red at t1385 — otherwise the next reader re-widens it and re-lives the diagnosis.
  expect(/#1505=1\s+;ERROR/.test(g), 'the #1505 that IS here is the parametric body\'s zero-bite refusal, not a prompt').toBe(true);
});

test('an op with NO declared tool is byte-identical (no arm, no marker) — the goldens hold', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const g = await emitProgram(page, [null], 'atc', 'ddcs-expert-m350');
  expect(/@TOOL|tool change|T\d+ M6/.test(g), 'no tool declared → no tool-change machinery').toBe(false);
});

test('the Settings tool-change MODE selector writes settings.toolChange.mode + the emit follows it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings && window.openSettings);
  const r = await page.evaluate(async () => {
    window.openSettings();   // builds the overlay → the mode selector + its listener
    const sel = document.getElementById('set_toolchange_mode');
    if (!sel) return { noSel: true };
    const opts = [...sel.options].map((o) => o.value);
    sel.value = 'none'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const stored = window.ddcsGetSettings().toolChange && window.ddcsGetSettings().toolChange.mode;
    if (window.closeSettings) window.closeSettings();
    window.ddcsGetSettings().atc = { tools: [{ num: 3, type: 'ballnose', dia: 6 }] };
    const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const def = drillDataDef(); registerUserOp(def);
    const g = emitMapped(builderOf(def.opType)({ toolNum: 3 })).text;
    return { noSel: false, opts, stored, noneArm: /no changer configured/i.test(g) };
  });
  expect(r.noSel, 'the mode selector is present in Settings').toBeFalsy();
  expect(r.opts, 'all three modes are offered').toEqual(['atc', 'manual', 'none']);
  expect(r.stored, 'the selector writes settings.toolChange.mode').toBe('none');
  expect(r.noneArm, 'the emit follows the declared mode (none → the honest comment)').toBe(true);
});

test('the sim PLAYS through an armed change (the arm does not break the trace)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const s = window.ddcsGetSettings(); s.atc = s.atc || {}; s.atc.tools = [{ num: 3, name: 'ball', type: 'ballnose', dia: 6 }]; s.toolChange = { mode: 'atc' };
    const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const Engine = (await import('/engine/GcodeExecutionEngine.js')).GcodeExecutionEngine;
    const def = drillDataDef(); registerUserOp(def);
    const prog = emitMapped(builderOf(def.opType)({ toolNum: 3 })).text;
    const t = new Engine().trace(prog);
    return { hasArm: /T3 M6/.test(prog), segs: (t.segments || []).length };
  });
  expect(r.hasArm, 'the program carries the change arm').toBe(true);
  expect(r.segs, 'the sim still traces the drilling motion (the T/M6 arm is a no-op for motion)').toBeGreaterThan(0);
});
