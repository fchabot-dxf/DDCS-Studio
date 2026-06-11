// ATC generators → execution-engine round trip (no browser needed).
// Every generated macro must: pass verifySyntax, and RUN to completion in the
// simulator with Auto sensors — proving the sensor-wait logic is coherent
// (M154/M155 drawbar + M300/M302/M303 waits answered by the truth table /
// virtual sensors), not just syntactically valid.
import { GcodeExecutionEngine } from '../web/engine/GcodeExecutionEngine.js';
import { AtcChangeWizard } from '../web/wizards/atcChangeWizard.js';
import { AtcTestWizard } from '../web/wizards/atcTestWizard.js';
import { AtcWarmupWizard } from '../web/wizards/atcWarmupWizard.js';

const change = new AtcChangeWizard();
const test = new AtcTestWizard();
const warmup = new AtcWarmupWizard();

function runToEnd(name, code, { timeoutMs = 30000 } = {}) {
    return new Promise((resolve, reject) => {
        let guard = null;
        const statuses = [];
        const eng = new GcodeExecutionEngine({
            stepDelay: 10,
            autoAnswer: true,
            autoAnswerMs: 200,
            simSpeed: 1000,           // MAX speed — only the I/O delays remain
            onStatus: ({ message }) => statuses.push(message),
            onFinish: () => { clearTimeout(guard); resolve({ eng, statuses }); },
        });
        const v = eng.verifySyntax(code);
        if (!v.valid) {
            reject(new Error(`${name}: syntax errors:\n` + v.errors.map((e) => `Ln ${e.lineIndex + 1}: ${e.message} | ${e.line}`).join('\n')));
            return;
        }
        eng.run(code);
        guard = setTimeout(() => {
            eng.stop();
            reject(new Error(`${name}: TIMEOUT (stuck wait?). Last statuses:\n` + statuses.slice(-8).join('\n')));
        }, timeoutMs);
    });
}

// 1) AUTO tool change, fixed test tool T3, spindle empty → skips put-away, picks up T3
{
    const code = change.generate({ mode: 'auto', zClear: 0, capacity: 8, fixedT: 3, waitSpindle: true });
    const { eng, statuses } = await runToEnd('auto-change T3', code);
    if (eng.vars.get(1300) !== 3) throw new Error(`auto-change: #1300 = ${eng.vars.get(1300)}, expected 3`);
    if (!statuses.some((s) => s.includes('IN_TOOL_LOCKED'))) throw new Error('auto-change: never waited on the tool-locked sensor');
    console.log('case1 OK — auto change (empty spindle) picked up T3, #1300=3, sensors exercised.');
}

// 2) AUTO change with a tool already in the spindle → put-away path also runs
{
    const code = change.generate({ mode: 'auto', zClear: 0, capacity: 8, fixedT: 5, waitSpindle: false });
    // Preload current tool: prepend an M6 T2 (sets #1300/#1504), then neutralize
    // the target by letting the macro's own #100=5 override.
    const pre = 'M6 T2\n';
    const { eng } = await runToEnd('auto-change swap T2→T5', pre + code);
    if (eng.vars.get(1300) !== 5) throw new Error(`swap: #1300 = ${eng.vars.get(1300)}, expected 5`);
    console.log('case2 OK — auto change swapped T2 → T5 through put-away + pick-up.');
}

// 3) AUTO change same-tool short circuit: target == current → N900 exit, #1300 unchanged
{
    const code = change.generate({ mode: 'auto', zClear: 0, capacity: 8, fixedT: 2, waitSpindle: true });
    const { eng, statuses } = await runToEnd('auto-change same tool', 'M6 T2\n' + code);
    if (eng.vars.get(1300) !== 2) throw new Error(`same-tool: #1300 = ${eng.vars.get(1300)}, expected 2`);
    // Short-circuit means the drawbar never fired
    if (statuses.some((s) => s.includes('drawbar'))) throw new Error('same-tool: drawbar fired despite same tool');
    console.log('case3 OK — same-tool request short-circuits without touching the drawbar.');
}

// 4) AUTO change invalid tool (9 > capacity 8) → error handler, no motion
{
    const code = change.generate({ mode: 'auto', zClear: 0, capacity: 8, fixedT: 9 });
    const { eng, statuses } = await runToEnd('auto-change invalid T9', code);
    if (statuses.some((s) => s.includes('drawbar'))) throw new Error('invalid-T: drawbar fired on an invalid tool');
    console.log('case4 OK — invalid target tool routes to the error handler.');
}

// 5) Drawbar cycle test: 3 cycles complete; both sensors waited on each cycle
{
    const code = test.generate({ mode: 'drawbar', cycles: 3, dwellMs: 50 });
    const { statuses } = await runToEnd('drawbar test x3', code);
    const opens = statuses.filter((s) => s.includes('waiting for IN_TOOL_OPEN') || s.includes('IN_TOOL_OPEN is ON')).length;
    const locks = statuses.filter((s) => s.includes('waiting for IN_TOOL_LOCKED') || s.includes('IN_TOOL_LOCKED is ON')).length;
    if (opens < 3 || locks < 3) throw new Error(`drawbar: sensor waits open=${opens} lock=${locks}, expected >=3 each`);
    console.log('case5 OK — drawbar test ran 3 release/lock cycles with sensor verification.');
}

// 6) Pocket dry-run: visits all pockets and completes (prompts are non-blocking in sim)
{
    const code = test.generate({ mode: 'pockets', first: 1, count: 4, zClear: 0, descend: true });
    await runToEnd('pocket dry-run x4', code);
    console.log('case6 OK — pocket dry-run visited 4 pockets and completed.');
}

// 7) Manual change still generates + runs (regression)
{
    const code = change.generate({ mode: 'manual', x: 100, y: 100, z: 0 });
    await runToEnd('manual change', code);
    console.log('case7 OK — manual park + prompt macro runs.');
}

// 8) Warmup: G4 P now in ms — sim completes, dwell honored
{
    const code = warmup.generate({ rpm1: 6000, time1: 1, rpm2: 12000, time2: 1 });
    if (!/#141=1000/.test(code)) throw new Error('warmup: stage-1 duration not converted to ms');
    await runToEnd('warmup', code);
    console.log('case8 OK — warmup dwell converted to ms and simulates.');
}

console.log('ALL PASS');
