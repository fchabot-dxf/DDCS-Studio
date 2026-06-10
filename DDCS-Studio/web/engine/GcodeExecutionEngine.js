/**
 * A lightweight Studio execution engine for DDCS macro simulation.
 *
 * This engine walks G-code program text line by line, evaluates conditions,
 * updates motion state, and emits line-change callbacks for editor highlighting.
 * It also integrates with the browser-only virtual I/O layer for MSETDATA
 * handshake simulation and probe collision detection.
 */

import { resetVirtualIO, setVirtualOutput, getVirtualInput, triggerProbeCollision, resolveVirtualPin } from './virtualIO.js';
import { tokenizeWords } from './core/tokenizer.js';
import { evalExpr, validateExpression } from './core/expression.js';
import { evaluateCondition, validateCondition } from './core/condition.js';
import { loadProgram as loadProgramText } from './core/program.js';

export class GcodeExecutionEngine {
    constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, stock = null, syntaxValidator = null, createVarStore = null } = {}) {
        this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
        // Variable-store seam: anything Map-like with get(num)/set(num, val).
        // Default is an in-memory Map (pure simulation). A DDCS PC-bridge can
        // inject a store that proxies system variables (#880, #1920-1929, ...)
        // to a real controller while keeping user vars local.
        this.createVarStore = typeof createVarStore === 'function' ? createVarStore : () => new Map();
        this.onLineChange = onLineChange;
        this.onStatus = onStatus;
        this.onFinish = onFinish;
        this.onPositionChange = onPositionChange;
        this.stock = stock || null;
        this.syntaxValidator = typeof syntaxValidator === 'function' ? syntaxValidator : null;
        this.resetState();
    }

    verifySyntax(text) {
        if (this.syntaxValidator) {
            return this.syntaxValidator(text);
        }
        return GcodeExecutionEngine.defaultSyntaxVerify(text);
    }

    static defaultSyntaxVerify(text) {
        const errors = [];
        const lines = String(text || '').split(/\r?\n/);

        const reportError = (lineIndex, message) => {
            errors.push({ lineIndex, line: lines[lineIndex], message });
        };

        lines.forEach((raw, lineIndex) => {
            const trimmedRaw = raw.trim();
            const stripped = raw.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ').trim();
            if (!stripped) return;

            const ifMatch = stripped.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
            if (ifMatch) {
                const condition = ifMatch[1].trim();
                if (!condition) {
                    reportError(lineIndex, 'Empty IF condition');
                } else if (!validateCondition(condition)) {
                    reportError(lineIndex, 'Invalid IF condition syntax');
                }
                return;
            }

            const gotoMatch = stripped.match(/^GOTO\s*(\d+)$/i);
            if (gotoMatch) {
                return;
            }

            if (/^(M30|M02|M2|M99)\b/i.test(stripped)) {
                return;
            }

            if (/^#/.test(stripped)) {
                const assignMatch = stripped.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
                if (!assignMatch) {
                    reportError(lineIndex, 'Invalid macro assignment');
                    return;
                }
                const lhs = assignMatch[1].trim();
                const rhs = assignMatch[2].trim();
                const indexExpr = lhs.startsWith('[') ? lhs.slice(1, -1) : lhs;
                if (!validateExpression(indexExpr)) {
                    reportError(lineIndex, 'Invalid assignment target');
                }
                if (!validateExpression(rhs)) {
                    reportError(lineIndex, 'Invalid assignment expression');
                }
                return;
            }

            const words = tokenizeWords(stripped);
            if (words.length === 0) {
                reportError(lineIndex, 'Unrecognizable G-code line');
                return;
            }

            for (const word of words) {
                if (word.letter === 'G') {
                    const value = Number.parseFloat(word.value);
                    if (!Number.isFinite(value)) {
                        reportError(lineIndex, `Invalid G-code word value: ${word.value}`);
                    }
                } else if (word.letter !== 'N') {
                    if (!validateExpression(word.value)) {
                        reportError(lineIndex, `Invalid expression for ${word.letter}`);
                    }
                }
            }
        });

        return { valid: errors.length === 0, errors };
    }

    resetState() {
        resetVirtualIO();
        this.vars = this.createVarStore();
        this.pos = { x: 0, y: 0, z: 0 };
        this.absolute = true;
        this.unitScale = 1;
        this.motion = 0;
        this.feedVal = 0;
        this.plane = 17;
        this.program = [];
        this.labels = new Map();
        this.ip = 0;
        this.currentLineIndex = null;
        this.running = false;
        this.timer = null;
        this.stats = {
            feed: 0,
            rapid: 0,
            probe: 0,
            skipped: 0,
            steps: 0,
        };
        this.totalLines = 0;
        this._started = false;
    }

    loadProgram(text) {
        const { program, labels, totalLines } = loadProgramText(text, { keepEmpty: true });
        this.program = program;
        this.labels = labels;
        this.totalLines = totalLines;
    }

    run(text) {
        this.stop();
        this.resetState();
        this.loadProgram(text);

        if (this.program.length === 0) {
            this._setStatus('No program loaded', false);
            this._finish();
            return;
        }

        this.running = true;
        this._setStatus('Starting execution', true);
        this._scheduleTick();
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.running = false;
        this._setStatus('Execution stopped', false);
    }

    _scheduleTick() {
        if (!this.running) return;
        // Per-step delay (set by _tick / _executeStep) so playback respects feedrates; else stepDelay.
        this.timer = setTimeout(() => this._tick(), this._nextDelayMs != null ? this._nextDelayMs : this.stepDelay);
    }

    _tick() {
        if (!this.running) return;
        this._nextDelayMs = 8;   // default: non-motion lines tick fast; motion / input-wait set their own pace
        if (this.ip >= this.program.length) {
            this._finish();
            return;
        }

        const step = this.program[this.ip];
        this._setCurrentLine(step.lineIndex);
        const done = this._executeStep(step);
        if (done) {
            this._finish();
            return;
        }

        if (this.running) {
            this._scheduleTick();
        }
    }

    _setCurrentLine(lineIndex) {
        if (this.currentLineIndex !== lineIndex) {
            this.currentLineIndex = lineIndex;
            if (typeof this.onLineChange === 'function') {
                this.onLineChange({ lineIndex, ip: this.ip, raw: this.program[this.ip].raw });
            }
        }
        this._setStatus(`Running line ${lineIndex + 1}/${this.totalLines}`, true);
    }

    _setStatus(message, running = this.running) {
        if (typeof this.onStatus === 'function') {
            this.onStatus({ message, running, stats: { ...this.stats } });
        }
    }

    _finish() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this._setStatus('Execution complete', false);
        if (typeof this.onFinish === 'function') {
            this.onFinish({ stats: { ...this.stats } });
        }
    }

    _executeStep(step) {
        const line = step.stripped;
        this.stats.steps += 1;

        if (!line) {
            this.ip += 1;
            return false;
        }

        if (/^\s*[();]/.test(step.raw.trim())) {
            this.ip += 1;
            return false;
        }

        const ifMatch = line.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
        if (ifMatch) {
            const conditionText = ifMatch[1].trim().replace(/^\[|\]$/g, '');
            const targetLabel = Number.parseInt(ifMatch[2], 10);
            if (this._evaluateCondition(conditionText) && this.labels.has(targetLabel)) {
                this.ip = this.labels.get(targetLabel);
                return false;
            }
            this.ip += 1;
            return false;
        }

        const gotoMatch = line.match(/^GOTO\s*(\d+)$/i);
        if (gotoMatch) {
            const targetLabel = Number.parseInt(gotoMatch[1], 10);
            if (this.labels.has(targetLabel)) {
                this.ip = this.labels.get(targetLabel);
                return false;
            }
            this.ip += 1;
            return false;
        }

        if (/^(M30|M02|M2|M99)\b/i.test(line)) {
            return true;
        }

        if (this._handleModbus(line)) {
            this.ip += 1;
            return false;
        }

        if (/^#/.test(line)) {
            this._handleAssignment(line);
            this.ip += 1;
            return false;
        }

        const words = tokenizeWords(line);
        if (words.length === 0) {
            this.ip += 1;
            return false;
        }

        if (words.every((w) => w.letter === 'N')) {
            this.ip += 1;
            return false;
        }

        const wm = {};
        const gcodes = [];
        const mcodes = [];
        for (const word of words) {
            if (word.letter === 'G') {
                const value = Number.parseFloat(word.value);
                if (Number.isFinite(value)) gcodes.push(value);
            } else if (word.letter === 'M') {
                const value = Number.parseFloat(word.value);
                if (Number.isFinite(value)) mcodes.push(value);
            } else if (word.letter !== 'N') {
                wm[word.letter] = this._evaluateExpression(word.value);
            }
        }

        // --- Custom I/O M-Codes ---
        let waiting = false;
        for (const m of mcodes) {
            if (m === 6) {
                // Tool change: M6 Tn sets the active tool number (#1300), so tool-length
                // and offset macros that read #1300 / #[1430+T-1] simulate correctly.
                if (wm.T != null && Number.isFinite(wm.T)) {
                    this.vars.set(1300, Math.round(wm.T));
                    this._setStatus(`M6 → active tool #1300 = ${Math.round(wm.T)}`, true);
                }
            } else if (m === 10 || m === 11) {
                // Output control
                if (wm.P != null) {
                    const pinName = resolveVirtualPin(wm.P, 'OUT');
                    setVirtualOutput(pinName, m === 10);
                    this._setStatus(`M${m} → ${pinName} = ${m === 10 ? 'ON' : 'OFF'}`, true);
                }
            } else if (m === 31 || m === 33) {
                // Input polling
                if (wm.P != null) {
                    const pinName = resolveVirtualPin(wm.P, 'IN');
                    const targetState = m === 31; // M31 = wait for ON, M33 = wait for OFF
                    const currentState = getVirtualInput(pinName);
                    
                    if (currentState !== targetState) {
                        this._setStatus(`M${m} waiting for ${pinName} to be ${targetState ? 'ON' : 'OFF'}...`, true);
                        waiting = true;
                    } else {
                        this._setStatus(`M${m} ${pinName} is ${targetState ? 'ON' : 'OFF'} (cleared)`, true);
                    }
                }
            }
        }
        
        // If we're waiting on an input, do NOT advance IP and return immediately to pause execution
        if (waiting) {
            this._nextDelayMs = 50;   // poll the input gently instead of spinning at the fast-step rate
            return false;
        }

        for (const g of gcodes) {
            if (g === 20) this.unitScale = 25.4;
            else if (g === 21) this.unitScale = 1;
            else if (g === 90) this.absolute = true;
            else if (g === 91) this.absolute = false;
            else if (g === 17) this.plane = 17;
            else if (g === 18) this.plane = 18;
            else if (g === 19) this.plane = 19;
            else if ([0, 1, 2, 3].includes(g)) this.motion = g;
        }

        if (wm.F != null && Number.isFinite(wm.F)) {
            this.feedVal = wm.F;
        }

        const hasAxis = wm.X != null || wm.Y != null || wm.Z != null;
        const hasArcArg = wm.I != null || wm.J != null || wm.K != null || wm.R != null;
        if (!hasAxis && !hasArcArg) {
            this.ip += 1;
            return false;
        }

        if (gcodes.includes(53)) {
            this.stats.skipped += 1;
            this.ip += 1;
            return false;
        }

        const target = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
        let bad = false;
        const setAxis = (key, field) => {
            if (wm[key] == null) return;
            const value = wm[key];
            if (!Number.isFinite(value)) {
                bad = true;
                return;
            }
            target[field] = this.absolute ? value * this.unitScale : this.pos[field] + value * this.unitScale;
        };
        setAxis('X', 'x');
        setAxis('Y', 'y');
        setAxis('Z', 'z');

        if (bad) {
            this.stats.skipped += 1;
            this.ip += 1;
            return false;
        }

        const isProbe = gcodes.includes(31);
        const effMotion = isProbe ? 1 : this.motion;

        if (effMotion === 0 || effMotion === 1) {
            if (isProbe) {
                this.stats.probe += 1;

                // DDCS G31 semantics: per-axis status vars #1920(X) #1921(Y) #1922(Z).
                // 1 = probe started, no trigger yet. Stays 1 on a miss (full travel,
                // no alarm) - it is the macro's job to check !=2 and branch.
                const PROBE_STATUS_VAR = { x: 1920, y: 1921, z: 1922 };
                const scannedAxes = [];
                if (wm.X != null) scannedAxes.push('x');
                if (wm.Y != null) scannedAxes.push('y');
                if (wm.Z != null) scannedAxes.push('z');
                for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 1);

                // Determine collision target based on P argument
                const probePort = wm.P;
                const probes = typeof window !== 'undefined' && window.ddcsGetSettings ? window.ddcsGetSettings().probes : null;
                
                let boxMin = null;
                let boxMax = null;

                if (probes && probePort === probes.setterPin) {
                    boxMin = { x: probes.setterX - probes.setterW/2, y: probes.setterY - probes.setterH/2, z: probes.setterZ - 0.01 }; // Thin plate at Z
                    boxMax = { x: probes.setterX + probes.setterW/2, y: probes.setterY + probes.setterH/2, z: probes.setterZ + 0.01 };
                } else if (this.stock && (this.stock.x > 0 || this.stock.y > 0 || this.stock.z > 0)) {
                    boxMin = { x: 0, y: 0, z: -this.stock.z };
                    boxMax = { x: this.stock.x, y: this.stock.y, z: 0 };
                }

                if (boxMin && boxMax) {
                    const start = this.pos;
                    const dir = { x: target.x - start.x, y: target.y - start.y, z: target.z - start.z };
                    let tmin = 0.0;
                    let tmax = 1.0;
                    let hit = true;

                    for (const axis of ['x', 'y', 'z']) {
                        if (Math.abs(dir[axis]) < 1e-8) {
                            if (start[axis] < boxMin[axis] || start[axis] > boxMax[axis]) hit = false;
                        } else {
                            const invD = 1.0 / dir[axis];
                            let t0 = (boxMin[axis] - start[axis]) * invD;
                            let t1 = (boxMax[axis] - start[axis]) * invD;
                            if (invD < 0) { const temp = t0; t0 = t1; t1 = temp; }
                            tmin = Math.max(tmin, t0);
                            tmax = Math.min(tmax, t1);
                            if (tmax < tmin) hit = false;
                        }
                    }

                    if (hit && tmin >= 0 && tmin <= 1) {
                        // Clamp target to exact intersection surface
                        target.x = start.x + dir.x * tmin;
                        target.y = start.y + dir.y * tmin;
                        target.z = start.z + dir.z * tmin;
                        triggerProbeCollision();

                        // DDCS: 2 = detected the signal; #1925-1927 = trigger
                        // position in machine coordinates.
                        for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
                        this.vars.set(1925, target.x);
                        this.vars.set(1926, target.y);
                        this.vars.set(1927, target.z);
                    }
                }
            } else if (effMotion === 0) {
                this.stats.feed += 1;
            }
            // Pace the next tick by this move's duration so playback respects feedrates: rapids fast,
            // cuts at feed, probes slow. Clamped so tiny moves still tick and long moves don't stall.
            {
                const d = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
                const rate = (effMotion === 0 && !isProbe) ? 6000 : (this.feedVal > 0 ? this.feedVal : 600);
                const realMs = rate > 0 ? (d / rate) * 60000 : 0;
                this._nextDelayMs = Math.max(12, Math.min(1500, realMs * 0.15));
            }
            this.pos = target;
            if (typeof this.onPositionChange === 'function') {
                this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
            }
        } else {
            this.stats.skipped += 1;
        }

        this.ip += 1;
        return false;
    }

    // MSETDATA / MGETDATA — the real DDCS Expert Modbus channel (controllers/expert-m350/FINDINGS.md):
    // a 6-arg register transfer [X1 startVar, X2 slave#, X3 regAddr, X4 byteLen, X5 funcCode, X6 excVar].
    // MSETDATA pushes vars #X1..#(X1+X4-1) to the slave (one decimal byte each); MGETDATA pulls them back.
    // There is no real Modbus slave in the browser sim, so we TRACE the transfer (it is NOT a digital-output
    // command — that was the old, wrong interpretation) and set the exception var to 0 (OK).
    _handleModbus(line) {
        const m = line.match(/\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]/i);
        if (!m) return false;
        const op = m[1].toUpperCase();
        const args = m[2].split(',').map((a) => a.trim()).filter((a) => a !== '');
        if (args.length !== 6) {
            this._setStatus(`${op} needs 6 args [X1..X6], got ${args.length}`, true);
            return true;
        }

        const [startVar, slave, reg, byteLen, fn, excVar] = args.map((a) => this._evaluateExpression(a));
        if (op === 'MSETDATA') {
            const bytes = [];
            if (Number.isFinite(startVar) && Number.isFinite(byteLen)) {
                for (let i = 0; i < byteLen; i++) bytes.push(this.vars.get(Math.round(startVar + i)) ?? 0);
            }
            if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);   // push: no slave error in sim
            this._setStatus(`MSETDATA push -> slave ${slave} reg ${reg} fn ${fn}: [${bytes.join(',')}]`, true);
        } else {
            // MGETDATA: nothing answers in the sim (live, this BLOCKS/wedges if the slave is silent - FINDINGS).
            if (Number.isFinite(excVar)) this.vars.set(Math.round(excVar), 0);
            this._setStatus(`MGETDATA pull <- slave ${slave} reg ${reg} fn ${fn} (no slave in sim; vars unchanged)`, true);
        }
        return true;
    }

    _handleAssignment(line) {
        const assignMatch = line.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
        if (!assignMatch) return;

        const lhs = assignMatch[1].trim();
        const rhs = assignMatch[2].trim();
        let idx = null;
        if (lhs.startsWith('[') && lhs.endsWith(']')) {
            idx = this._evaluateExpression(lhs.slice(1, -1));
        } else {
            idx = Number.parseInt(lhs, 10);
        }

        const value = this._evaluateExpression(rhs);
        if (idx != null && Number.isFinite(idx) && value != null) {
            this.vars.set(Math.round(idx), value);
        }
    }

    _evaluateCondition(expression) {
        // DDCS-emulator behavior: unset variables read as 0
        return evaluateCondition(expression, this.vars, { unsetValue: 0 });
    }

    _evaluateExpression(str) {
        // DDCS-emulator behavior: unset variables read as 0
        return evalExpr(str, this.vars, { unsetValue: 0 });
    }
}
