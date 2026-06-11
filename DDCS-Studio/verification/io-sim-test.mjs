// Quick engine-level check of the I/O simulation layer (no browser needed).
// 1) auto-answer ON  : an ATC-style "fire output, wait for sensor" macro completes hands-free
// 2) auto-answer OFF : the engine parks on the M31 wait, then a manual (panel-style) input
//    injection with the RESOLVED pin name unblocks it — the pin-name fix under test.
import { GcodeExecutionEngine } from '../web/engine/GcodeExecutionEngine.js';
import { injectVirtualInput, resolveVirtualPin } from '../web/engine/virtualIO.js';

const PROGRAM = [
    'M10 P4              ( fire unclamp solenoid — output ON )',
    'N10 M31 P6          ( wait for drawbar-open sensor )',
    'G0 Z50              ( proceed once confirmed )',
    'M30',
].join('\n');

// Unmapped pin: no truth-table rule can answer IN12 — only auto-answer or a manual click.
const PROGRAM_UNMAPPED = [
    'N10 M31 P12         ( wait for a sensor the truth table does not know )',
    'G0 Z50',
    'M30',
].join('\n');

function runCase({ autoAnswer, manualAfterMs, program = PROGRAM, manualPin = 6 }) {
    return new Promise((resolve, reject) => {
        const statuses = [];
        let guard = null;
        const eng = new GcodeExecutionEngine({
            stepDelay: 10,
            autoAnswer,
            autoAnswerMs: 300,
            onStatus: ({ message }) => statuses.push(message),
            onWait: (w) => { if (w) statuses.push(`WAIT pin=${w.pin} ${w.pinName} target=${w.target}`); },
            onFinish: () => { clearTimeout(guard); resolve(statuses); },
        });
        eng.run(program);
        if (manualAfterMs != null) {
            setTimeout(() => injectVirtualInput(resolveVirtualPin(manualPin, 'IN'), true), manualAfterMs);
        }
        guard = setTimeout(() => { eng.stop(); reject(new Error('TIMEOUT — wait never satisfied. Log:\n' + statuses.join('\n'))); }, 5000);
    });
}

const auto = await runCase({ autoAnswer: true });
if (!auto.some((s) => s.includes('WAIT pin=6'))) throw new Error('case1: never parked on the M31 wait');
console.log('case1 OK — auto: parked on IN6 wait, then completed.',
    auto.some((s) => s.includes('auto-answered')) ? '(auto-answer fired)' : '(truth table answered first)');

const manual = await runCase({ autoAnswer: false, manualAfterMs: 600, program: PROGRAM_UNMAPPED, manualPin: 12 });
if (!manual.some((s) => s.includes('WAIT pin=12'))) throw new Error('case2: never parked on the M31 wait');
if (manual.some((s) => s.includes('auto-answered'))) throw new Error('case2: auto-answer fired despite being OFF');
console.log('case2 OK — manual: parked on unmapped IN12 until a panel-style injection unblocked it.');

// 2b) auto-answer also covers unmapped pins (any user pinout completes hands-free)
const autoUnmapped = await runCase({ autoAnswer: true, program: PROGRAM_UNMAPPED });
if (!autoUnmapped.some((s) => s.includes('auto-answered'))) throw new Error('case2b: auto-answer did not cover the unmapped pin');
console.log('case2b OK — auto-answer satisfied an unmapped pin (IN12).');

// 3) step mode: one tick at a time, engine stays paused between steps
const eng3 = new GcodeExecutionEngine({ stepDelay: 10, autoAnswer: true });
eng3.step(PROGRAM);
if (!eng3.running || !eng3.paused) throw new Error('case3: step() should leave engine running+paused');
const ipAfter1 = eng3.ip;
eng3.step(PROGRAM);
if (eng3.ip === ipAfter1 && !eng3._waitPin) throw new Error('case3: second step did not advance');
eng3.stop();
console.log('case3 OK — step mode pauses between lines.');

// 4) feedrate pacing: G1 X10 F600 = 1 s of real cutting time; simSpeed divides it
async function timedRun(simSpeed) {
    const t0 = Date.now();
    await new Promise((resolve, reject) => {
        let guard = null;
        const eng = new GcodeExecutionEngine({
            stepDelay: 10, autoAnswer: true, simSpeed,
            onFinish: () => { clearTimeout(guard); resolve(); },
        });
        eng.run('G1 X10 F600\nM30');
        guard = setTimeout(() => { eng.stop(); reject(new Error('case4 timeout')); }, 8000);
    });
    return Date.now() - t0;
}
const tFast = await timedRun(10);
const tReal = await timedRun(1);
if (!(tReal > 700 && tReal < 2500)) throw new Error(`case4: 1x took ${tReal}ms, expected ~1000`);
if (!(tFast < 500)) throw new Error(`case4: 10x took ${tFast}ms, expected ~100`);
console.log(`case4 OK — feedrate pacing: 10mm at F600 took ${tReal}ms @1x, ${tFast}ms @10x.`);
console.log('ALL PASS');
