/**
 * A lightweight Studio execution engine for DDCS macro simulation.
 *
 * This engine walks G-code program text line by line, evaluates conditions,
 * updates motion state, and emits line-change callbacks for editor highlighting.
 * It also integrates with the browser-only virtual I/O layer for MSETDATA
 * handshake simulation and probe collision detection.
 */

import { resetVirtualIO, setVirtualOutput, getVirtualInput, injectVirtualInput, triggerProbeCollision, resolveVirtualPin } from './virtualIO.js';
import { tokenizeWords } from './core/tokenizer.js';
import { evalExpr, validateExpression } from './core/expression.js';
import { evaluateCondition, validateCondition } from './core/condition.js';
import { loadProgram as loadProgramText, stripLine } from './core/program.js';
import { arcPoints } from './core/arc.js';

export class GcodeExecutionEngine {
    constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, onWait = null, stock = null, stockOffset = null, syntaxValidator = null, createVarStore = null, autoAnswer = true, autoAnswerMs = 800, simSpeed = 1, rapidRate = 6000 } = {}) {
        this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
        // Time-true playback: moves take distance/feedrate (rapids at rapidRate),
        // divided by simSpeed (1 = real time). Slow probes crawl, rapids zip.
        this.simSpeed = Number.isFinite(simSpeed) && simSpeed > 0 ? simSpeed : 1;
        this.rapidRate = Number.isFinite(rapidRate) && rapidRate > 0 ? rapidRate : 6000;
        // Variable-store seam: anything Map-like with get(num)/set(num, val).
        // Default is an in-memory Map (pure simulation). A DDCS PC-bridge can
        // inject a store that proxies system variables (#880, #1920-1929, ...)
        // to a real controller while keeping user vars local.
        this.createVarStore = typeof createVarStore === 'function' ? createVarStore : () => new Map();
        this.onLineChange = onLineChange;
        this.onStatus = onStatus;
        this.onFinish = onFinish;
        this.onPositionChange = onPositionChange;
        // onWait({ pin, pinName, target }) when execution parks on an M31/M33 input
        // wait; onWait(null) once it clears — lets the UI pulse the waited sensor.
        this.onWait = onWait;
        this.stock = stock || null;
        // Operator start in STOCK coords — where the tool is positioned before an (incremental) probe macro
        // runs. The probe-vs-stock collision test adds this so probes touch the real surface; the recorded
        // route stays origin-relative (the viz offsets it by the start marker). Default = origin.
        this._stockOffset = stockOffset || { x: 0, y: 0, z: 0 };
        this.syntaxValidator = typeof syntaxValidator === 'function' ? syntaxValidator : null;
        // Auto-answer: a virtual sensor satisfies any M31/M33 wait after autoAnswerMs,
        // even for pins the truth table doesn't know — so any user's macro completes
        // hands-free. Turn off to hand-drive sensors and exercise failure branches.
        this.autoAnswer = autoAnswer !== false;
        this.autoAnswerMs = Number.isFinite(autoAnswerMs) ? autoAnswerMs : 800;
        this._autoTimers = new Map();   // pinName -> timeout id
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
            const stripped = stripLine(raw);
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
        this._clearAutoTimers();
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
        this.paused = false;
        this._waitPin = null;
        this._move = null;     // in-flight timed move (interpolated at the programmed feedrate)
        this._probeArmed = false;   // DM500 move-until-input: M101 arms, the next G01 is a probe, M102 disarms
        this._traceSink = null;   // when non-null (trace()), moves snap + push a segment here instead of animating
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

    /**
     * Synchronous "trace" pass — run the whole program to completion (probes auto-detect, input waits
     * auto-clear, no delays) and return the EXACT path the engine takes: { segments, bounds, stats }.
     * The preview's drawn route comes from this, so it can never disagree with the played tool — both go
     * through _executeStep with the same vars + control flow. Arcs are linearized; loops that never resolve
     * are bounded by a step cap (stats.capped). Leaves the engine reset (ready for a subsequent run()).
     */
    trace(text) {
        this.stop();
        this.resetState();
        this.loadProgram(text);
        // A trace only draws the route — suppress the UI callbacks so it doesn't move the tool dot,
        // highlight lines, or spam the status bar.
        const cb = { line: this.onLineChange, pos: this.onPositionChange, status: this.onStatus, wait: this.onWait };
        this.onLineChange = null; this.onPositionChange = null; this.onStatus = null; this.onWait = null;
        const sink = [];
        this._traceSink = sink;
        this.running = true;
        const cap = Math.max(this.program.length * 50, 5000);   // bound a loop that never resolves
        let guard = 0;
        try {
            while (this.ip >= 0 && this.ip < this.program.length && guard++ < cap) {
                const done = this._executeStep(this.program[this.ip]);
                if (done) break;
            }
        } finally {
            this.running = false;
            this._traceSink = null;
            this.onLineChange = cb.line; this.onPositionChange = cb.pos; this.onStatus = cb.status; this.onWait = cb.wait;
        }
        return this._buildTraceResult(sink, guard >= cap);
    }

    _buildTraceResult(segments, capped) {
        const b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
        let feed = 0, rapid = 0, probe = 0;
        for (const s of segments) {
            b.minX = Math.min(b.minX, s.x1, s.x2); b.maxX = Math.max(b.maxX, s.x1, s.x2);
            b.minY = Math.min(b.minY, s.y1, s.y2); b.maxY = Math.max(b.maxY, s.y1, s.y2);
            b.minZ = Math.min(b.minZ, s.z1, s.z2); b.maxZ = Math.max(b.maxZ, s.z1, s.z2);
            if (s.probe) probe += 1; else if (s.rapid) rapid += 1; else feed += 1;
        }
        return {
            segments,
            bounds: segments.length ? b : null,
            stats: { feed, rapid, probe, retract: 0, passes: 1, skipped: this.stats.skipped, drawable: segments.length > 0, capped: !!capped },
        };
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this._clearAutoTimers();
        this.running = false;
        this.paused = false;
        this._move = null;
        this._setWaitPin(null);
        this._setStatus('Execution stopped', false);
    }

    // Execute exactly one step. Starts (paused) from the top if no run is in
    // progress; pauses a continuous run in place otherwise. A move in flight
    // completes instantly — one step = one whole line.
    step(text) {
        if (!this.running) {
            this.resetState();
            this.loadProgram(text);
            if (this.program.length === 0) {
                this._setStatus('No program loaded', false);
                this._finish();
                return;
            }
            this.running = true;
        }
        this.paused = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this._move) {
            this._finishMove();
            return;
        }
        this._tick();
    }

    // Resume continuous execution after a pause/step.
    resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        if (this._move) this._move.last = null;   // don't count the paused wall-time as travel
        this._setStatus('Resuming execution', true);
        this._scheduleTick();
    }

    pause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this._move) this._move.last = null;
        this._setStatus('Paused', true);
    }

    _scheduleTick() {
        if (!this.running || this.paused) return;
        // Per-step delay (set by _tick / _executeStep) so playback respects feedrates; else stepDelay.
        this.timer = setTimeout(() => this._tick(), this._nextDelayMs != null ? this._nextDelayMs : this.stepDelay);
    }

    _tick() {
        if (!this.running) return;
        this._nextDelayMs = 8;   // default: non-motion lines tick fast; motion / input-wait set their own pace
        if (this._move) {
            // A timed move is in flight — advance it instead of executing the next line
            this._advanceMove();
            if (this.running && !this.paused) this._scheduleTick();
            return;
        }
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

        if (this.running && !this.paused) {
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
        this.paused = false;
        this._move = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this._clearAutoTimers();
        this._setWaitPin(null);
        this._setStatus('Execution complete', false);
        if (typeof this.onFinish === 'function') {
            this.onFinish({ stats: { ...this.stats } });
        }
    }

    // Advance the in-flight timed move by the wall-clock elapsed since the last tick,
    // scaled by simSpeed (changing speed mid-move takes effect immediately).
    _advanceMove() {
        const mv = this._move;
        if (!mv) return;
        const now = Date.now();
        const dt = mv.last == null ? 0 : Math.min(250, now - mv.last);
        mv.last = now;
        mv.elapsed += dt * (this.simSpeed > 0 ? this.simSpeed : 1);
        const t = mv.durMs > 0 ? Math.min(1, mv.elapsed / mv.durMs) : 1;
        if (t >= 1) {
            this._finishMove();
            return;
        }
        if (typeof this.onPositionChange === 'function') {
            this.onPositionChange({
                x: mv.from.x + (mv.to.x - mv.from.x) * t,
                y: mv.from.y + (mv.to.y - mv.from.y) * t,
                z: mv.from.z + (mv.to.z - mv.from.z) * t,
            });
        }
        this._nextDelayMs = 16;   // ~60 fps while travelling
    }

    // Land the in-flight move: snap to the target, fire any deferred probe touch.
    _finishMove() {
        const mv = this._move;
        if (!mv) return;
        this._move = null;
        this.pos = { ...mv.to };
        if (typeof this.onPositionChange === 'function') {
            this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
        }
        if (mv.touchName) this._touchPulse(mv.touchName);
    }

    // Pulse a probe input ON briefly so the I/O panel shows the touch.
    _touchPulse(pinName) {
        injectVirtualInput(pinName, true);
        setTimeout(() => injectVirtualInput(pinName, false), 400);
    }

    // Slab ray/segment-vs-AABB. Returns the entry/exit params along A→B (0..1 spans the move).
    // Identical to gcodeViz3d._boxRange so the engine's probe collision matches what the 3D view draws.
    _rayBox(A, B, min, max) {
        const d = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
        let tEnter = -Infinity, tExit = Infinity;
        for (const ax of ['x', 'y', 'z']) {
            if (Math.abs(d[ax]) < 1e-9) {
                if (A[ax] < min[ax] - 1e-6 || A[ax] > max[ax] + 1e-6) return { hit: false };
            } else {
                let t1 = (min[ax] - A[ax]) / d[ax], t2 = (max[ax] - A[ax]) / d[ax];
                if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
                if (t1 > tEnter) tEnter = t1;
                if (t2 < tExit) tExit = t2;
            }
        }
        return { hit: tEnter <= tExit, tEnter, tExit };
    }

    // Track the input pin execution is parked on (null = not waiting) and notify the UI.
    _setWaitPin(wait) {
        const prev = this._waitPin;
        if (!prev && !wait) return;
        if (prev && wait && prev.pinName === wait.pinName && prev.target === wait.target) return;
        this._waitPin = wait;
        if (typeof this.onWait === 'function') this.onWait(wait);
    }

    // Virtual sensor: answer a waited input after autoAnswerMs unless something else
    // (the truth table, or a manual click) already satisfied it. One timer per pin.
    _scheduleAutoAnswer(pinName, targetState) {
        if (this._autoTimers.has(pinName)) return;
        const id = setTimeout(() => {
            this._autoTimers.delete(pinName);
            if (!this.running) return;
            if (getVirtualInput(pinName) === targetState) return;   // already satisfied
            injectVirtualInput(pinName, targetState);
            this._setStatus(`${pinName} auto-answered (virtual sensor)`, true);
        }, this.autoAnswerMs);
        this._autoTimers.set(pinName, id);
    }

    _clearAutoTimers() {
        if (!this._autoTimers) return;
        for (const id of this._autoTimers.values()) clearTimeout(id);
        this._autoTimers.clear();
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

        // --- I/O + ATC M-codes (DDCS dialect) ---
        // Park on an input until it reaches `target`. pin = numeric port (null for the
        // DDCS ATC sensors, whose ports are controller params, not program words).
        const waitForInput = (m, pin, pinName, target) => {
            if (getVirtualInput(pinName) === target) {
                this._setStatus(`M${m} ${pinName} is ${target ? 'ON' : 'OFF'} (cleared)`, true);
                return false;
            }
            if (this._traceSink) {                            // trace: a virtual sensor satisfies the wait at once
                injectVirtualInput(pinName, target);
                return false;
            }
            this._setStatus(`M${m} waiting for ${pinName} to be ${target ? 'ON' : 'OFF'}...`, true);
            this._setWaitPin({ pin, pinName, target });
            if (this.autoAnswer) this._scheduleAutoAnswer(pinName, target);
            return true;
        };
        // DDCS ATC sensor waits: M-code -> [semantic pin, wanted state]
        const ATC_WAITS = {
            300: ['IN_SPINDLE_STOPPED', true],   // M300 wait spindle stopped
            302: ['IN_TOOL_LOCKED', true],       // M302 wait tool locked
            303: ['IN_TOOL_OPEN', true],         // M303 wait tool open (collet released)
            304: ['IN_TOOL_CLOSED', true],       // M304 wait tool closed
        };

        let waiting = false;
        for (const m of mcodes) {
            if (m === 6) {
                // Tool change request: M6 Tn stores the target tool in #1504 (real DDCS
                // semantics — T.nc performs the change) and, for simple sims, also makes
                // it the active tool #1300 so offset macros keep working.
                if (wm.T != null && Number.isFinite(wm.T)) {
                    this.vars.set(1504, Math.round(wm.T));
                    this.vars.set(1300, Math.round(wm.T));
                    this._setStatus(`M6 → target tool #1504 = ${Math.round(wm.T)}`, true);
                }
            } else if (m === 3 || m === 4) {
                setVirtualOutput('OUT_SPINDLE', true);    // spindle-stopped sensor drops
            } else if (m === 5) {
                setVirtualOutput('OUT_SPINDLE', false);   // spin-down → stopped sensor confirms
            } else if (m === 154 || m === 155) {
                // Drawbar: M154 release / M155 lock (output port = controller param #1250)
                setVirtualOutput('OUT_TOOL_RELEASE', m === 154);
                this._setStatus(`M${m} → drawbar ${m === 154 ? 'RELEASE' : 'LOCK'}`, true);
            } else if (m === 305 || m === 306) {
                setVirtualOutput('OUT_DUST_COVER', m === 305);
                this._setStatus(`M${m} → dust cover ${m === 305 ? 'OPEN' : 'CLOSE'}`, true);
            } else if (ATC_WAITS[m]) {
                const [pinName, target] = ATC_WAITS[m];
                if (waitForInput(m, null, pinName, target)) waiting = true;
            } else if (m === 10 || m === 11) {
                // Generic output control by port (NOTE: on real DDCS Expert, M10/M11 is the
                // LUBRICATION output — param #1233. Kept as a generic out for sim experiments.)
                if (wm.P != null) {
                    const pinName = resolveVirtualPin(wm.P, 'OUT');
                    setVirtualOutput(pinName, m === 10);
                    this._setStatus(`M${m} → ${pinName} = ${m === 10 ? 'ON' : 'OFF'}`, true);
                }
            } else if (m === 31 || m === 33) {
                // Input polling by port: M31 = wait for ON, M33 = wait for OFF
                if (wm.P != null) {
                    if (waitForInput(m, wm.P, resolveVirtualPin(wm.P, 'IN'), m === 31)) waiting = true;
                }
            } else if (m === 101 || m === 102) {
                // DM500 move-until-input probe cycle (bridge/controllers/dm500/install/probe.nc): M101 arms
                // probe-input monitoring, the following G01 feeds until the input triggers (the move stops at
                // the touch), M102 disarms. The next motion line is treated as a probe so it clamps to the
                // stock surface like a G31 (DM500 has no G31). No status var on this controller — motion just halts.
                this._probeArmed = (m === 101);
            }
        }

        // If we're waiting on an input, do NOT advance IP and return immediately to pause execution
        if (waiting) {
            this._nextDelayMs = 50;   // poll the input gently instead of spinning at the fast-step rate
            return false;
        }
        this._setWaitPin(null);   // this line is past any input wait

        // G4 dwell — DDCS unit is ms (dispatcher capture: G04 P500). Paced by simSpeed.
        if (gcodes.includes(4) && wm.P != null && Number.isFinite(wm.P) && wm.P > 0) {
            const ms = wm.P / (this.simSpeed > 0 ? this.simSpeed : 1);
            this._nextDelayMs = Math.max(8, Math.min(10000, ms));
            this._setStatus(`G4 dwell ${wm.P} ms`, true);
            this.ip += 1;
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

        const isProbe = gcodes.includes(31) || this._probeArmed;   // G31, or a G01 inside a DM500 M101/M102 cycle
        const effMotion = isProbe ? 1 : this.motion;

        if (effMotion === 0 || effMotion === 1) {
            let touchName = null;   // probe input to flip when the tool reaches the contact point
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
                let cavMin = null, cavMax = null;   // pocket only: the inset hole, whose walls are valid collisions too

                if (probes && probePort === probes.setterPin) {
                    boxMin = { x: probes.setterX - probes.setterW/2, y: probes.setterY - probes.setterH/2, z: probes.setterZ - 0.01 }; // Thin plate at Z
                    boxMax = { x: probes.setterX + probes.setterW/2, y: probes.setterY + probes.setterH/2, z: probes.setterZ + 0.01 };
                } else if (this.stock && (this.stock.x > 0 || this.stock.y > 0 || this.stock.z > 0)) {
                    boxMin = { x: 0, y: 0, z: -this.stock.z };
                    boxMax = { x: this.stock.x, y: this.stock.y, z: 0 };
                    if (this.stock.shape === 'pocket') {   // a hole in the block — same inset the 3D view renders (gcodeViz3d _rebuild)
                        const w = Math.max(8, Math.min(this.stock.x, this.stock.y) * 0.25);
                        cavMin = { x: w, y: w, z: -this.stock.z };
                        cavMax = { x: this.stock.x - w, y: this.stock.y - w, z: 0 };
                    }
                }

                // Probe-vs-stock geometry runs in STOCK space: the tool's real position is the operator start
                // (_stockOffset) + the local pos. The recorded route stays origin-relative (the viz offsets it
                // by the start marker), so dir is the same in both frames — only the start point shifts.
                const O = this._stockOffset || { x: 0, y: 0, z: 0 };
                if (boxMin && boxMax) {
                    // Geometry-based collision — a probe stops at the FIRST surface it hits, with no
                    // internal/external special-casing (mirrors gcodeViz3d._rebuild). Same frame as the route:
                    // STOCK space (operator start + local pos); the recorded target stays origin-relative.
                    const aStart = { x: O.x + this.pos.x, y: O.y + this.pos.y, z: O.z + this.pos.z };
                    const bEnd = { x: O.x + target.x, y: O.y + target.y, z: O.z + target.z };
                    const dir = { x: target.x - this.pos.x, y: target.y - this.pos.y, z: target.z - this.pos.z };
                    let tt = null;
                    const consider = (t) => { if (t != null && t > 1e-6 && t <= 1 && (tt == null || t < tt)) tt = t; };
                    const ro = this._rayBox(aStart, bEnd, boxMin, boxMax);
                    if (ro.hit) {
                        if (ro.tEnter > 1e-6) consider(ro.tEnter);                       // enter the block from outside (edge/corner/boss)
                        else if (ro.tExit > 1e-6 && ro.tExit <= 1) consider(ro.tExit);   // started on/inside a SOLID block → far face (keeps "first probe moves")
                    }
                    if (cavMin && cavMax) {
                        const rc = this._rayBox(aStart, bEnd, cavMin, cavMax);
                        if (rc.hit && rc.tEnter <= 1e-6 && rc.tExit > 1e-6) consider(rc.tExit);   // probing from inside the hole → stop at its wall (always closer than the outer face)
                    }
                    if (tt != null) {
                        // Clamp the recorded target to the contact surface (in LOCAL coords).
                        target.x = this.pos.x + dir.x * tt;
                        target.y = this.pos.y + dir.y * tt;
                        target.z = this.pos.z + dir.z * tt;
                        triggerProbeCollision();

                        // Flip the actual probe input pin so the I/O panel shows the touch:
                        // the G31 P pin if given, else the configured 3D-probe pin. Fired when
                        // the (feedrate-paced) move reaches the contact point.
                        const touchPin = Number.isFinite(probePort) ? probePort : (probes ? probes.probePin : null);
                        if (touchPin != null && Number.isFinite(touchPin)) {
                            touchName = resolveVirtualPin(touchPin, 'IN');
                        }

                        // DDCS: 2 = detected the signal; #1925-1927 = trigger position in machine coords
                        // (stock space = operator start + local target).
                        for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
                        this.vars.set(1925, O.x + target.x);
                        this.vars.set(1926, O.y + target.y);
                        this.vars.set(1927, O.z + target.z);
                    }
                }
                if (this._traceSink) {
                    // Trace/preview: a virtual probe always "detects" at its landing point, so macros take
                    // their success branch and probe loops (IF #1920+ax!=2 GOTO …) terminate instead of
                    // running to the step cap. Same hands-free contract as autoAnswer for M31/M33 waits.
                    for (const a of scannedAxes) this.vars.set(PROBE_STATUS_VAR[a], 2);
                    this.vars.set(1925, O.x + target.x);
                    this.vars.set(1926, O.y + target.y);
                    this.vars.set(1927, O.z + target.z);
                }
            } else if (effMotion === 0) {
                this.stats.feed += 1;
            }
            const rapid = effMotion === 0 && !isProbe;
            // Trace: snap to the target and record the segment (no animation). The drawn route IS the path
            // the engine takes, so it can never disagree with the played tool (same _executeStep, same vars).
            if (this._traceSink) {
                this._traceSink.push({
                    x1: this.pos.x, y1: this.pos.y, z1: this.pos.z,
                    x2: target.x, y2: target.y, z2: target.z,
                    rapid, probe: isProbe, type: isProbe ? 'probe' : (rapid ? 'rapid' : 'feed'), feed: this.feedVal,
                });
                this.pos = target;
                this.ip += 1;
                return false;
            }
            // Time-true playback: the move takes distance/rate (rapids at rapidRate, cuts and
            // probes at the programmed F), scaled by simSpeed. Long moves animate as an
            // in-flight interpolated move; sub-frame ones just jump.
            {
                const d = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
                const rate = rapid ? this.rapidRate : (this.feedVal > 0 ? this.feedVal : 600);
                const realMs = rate > 0 ? (d / rate) * 60000 : 0;
                const speed = this.simSpeed > 0 ? this.simSpeed : 1;
                if (realMs / speed > 50) {
                    this._move = { from: { ...this.pos }, to: target, durMs: realMs, elapsed: 0, last: null, touchName };
                    const kind = isProbe ? 'G31 probe' : rapid ? 'G0 rapid' : 'G1 feed';
                    this._setStatus(`${kind} ${d.toFixed(1)} mm at F${rate} — ${(realMs / 1000).toFixed(1)} s${speed !== 1 ? ` @ ${speed}×` : ''}`, true);
                    this._nextDelayMs = 16;
                    this.ip += 1;
                    return false;   // ticks now advance the move; next line runs when it lands
                }
                this._nextDelayMs = Math.max(12, realMs / speed);
                if (touchName) this._touchPulse(touchName);
            }
            this.pos = target;
            if (typeof this.onPositionChange === 'function') {
                this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
            }
        } else if (this._traceSink) {
            // Arc (G2/G3) in a trace: linearize into chord segments so the drawn route shows the curve.
            // (Real-time play still steps line-by-line and skips arcs — a separate, pre-existing gap.)
            const off = { I: wm.I, J: wm.J, K: wm.K, R: wm.R };
            const anyNull = ['I', 'J', 'K', 'R'].some((k) => wm[k] != null && !Number.isFinite(wm[k]));
            if (anyNull) {
                this.stats.skipped += 1;
            } else {
                const pts = arcPoints(this.pos, target, off, effMotion, this.plane, this.unitScale);
                let prev = this.pos;
                for (let i = 1; i < pts.length; i++) {
                    this._traceSink.push({
                        x1: prev.x, y1: prev.y, z1: prev.z, x2: pts[i].x, y2: pts[i].y, z2: pts[i].z,
                        rapid: false, probe: false, type: 'feed', feed: this.feedVal,
                    });
                    prev = pts[i];
                }
                this.pos = target;
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
