/**
 * A lightweight Studio execution engine for DDCS macro simulation.
 *
 * This engine walks G-code program text line by line, evaluates conditions,
 * updates motion state, and emits line-change callbacks for editor highlighting.
 * It also integrates with the browser-only virtual I/O layer for MSETDATA
 * handshake simulation and probe collision detection.
 */

import { resetVirtualIO, setVirtualOutput, getVirtualInput, injectVirtualInput, triggerProbeCollision, resolveVirtualPin, ioState, setLimitSwitches } from './virtualIO.js';
import { tokenizeWords } from './core/tokenizer.js';
import { evalExpr, validateExpression } from './core/expression.js';
import { evaluateCondition, validateCondition } from './core/condition.js';
import { loadProgram as loadProgramText, stripLine } from './core/program.js';
import { arcPoints } from './core/arc.js';
import { rayBox, rotaryAxisOf, stockProbeStop } from './probeGeometry.js';
import { axisHomeMotion, limitSwitchTrips, axisSpan } from './limitSwitches.js';   // H1 (t481) home-end; H3 (t485) — the live home/limit trip model; t499 — axisSpan for the homing-seek envelope clamp
import { passAnchorFor } from './passAnchor.js';   // t94/t107 — the probe-collision + DRO origin O is a pass's re-park draw-anchor (auto reposition): the RUNTIME END of the previous pass (t107 machine-faithful) via the published _passEnds, else the static previous START (t94)

// Machine-DRO register bases per dialect (X=base, Y=+1, Z=+2, A=+3): Expert #880, V4.1 #1500, DM500 #864, rs274 #5420.
// read-machine (RM) reads ITS dialect's base; the sim populates them ALL (cheap, dialect-agnostic) so RM returns the real
// tool coord for any dialect instead of an unset 0. (A live PC-bridge store proxies the real DRO → guarded off there.)
const DRO_BASES = [880, 1500, 864, 5420];

// The DDCS Expert M350 ATC dialect as ONE declarative table (M-code → {kind, pin, state}). GROUND TRUTH =
// bridge/controllers/expert-m350/DDCS-ATC-WORKFLOW.md §Sensors (M300 spindle-stopped · M301/M302 drawbar released/
// clamped · M303/M304 magazine open/closed · M305/M306 gripper open/closed) + §Outputs (M154/M155 drawbar release/lock
// · M162/M163 dust-cover open/close · M150/M151 gripper open/close). 'wait' parks until a virtualIO INPUT reaches
// `state`; 'output' drives a virtualIO OUTPUT to `state` (its truth-table handshake then flips the paired sensor).
// Every pin is a REAL virtualIO pin. This REPLACES the old split ATC_WAITS + the hand-rolled M154/155/M305/306 if-else,
// which had NO M301 (a silent no-op), mislabelled M303/304 as tool-open/closed, and drove M305/306 as a dust-cover
// OUTPUT (they are gripper WAITS). Drawbar out reuses the spindle-clamp pins (OUT_SPINDLE_UNCLAMP→IN_DRAWBAR_OPEN etc.).
export const ATC_DIALECT = {
    // OUTPUTS — drive a solenoid/valve; the virtualIO handshake confirms the paired sensor
    154: { kind: 'output', pin: 'OUT_SPINDLE_UNCLAMP', state: true, label: 'drawbar release' },   // → IN_DRAWBAR_OPEN (M301)
    155: { kind: 'output', pin: 'OUT_SPINDLE_CLAMP', state: true, label: 'drawbar lock' },         // → IN_DRAWBAR_CLOSED (M302)
    162: { kind: 'output', pin: 'OUT_DUST_COVER', state: true, label: 'dust cover open' },         // → IN_DUST_COVER_OPEN
    163: { kind: 'output', pin: 'OUT_DUST_COVER', state: false, label: 'dust cover close' },        // → IN_DUST_COVER_OPEN clears
    150: { kind: 'output', pin: 'OUT_GRIPPER_OPEN', state: true, label: 'gripper open' },          // → IN_GRIPPER_OPEN (M305)
    151: { kind: 'output', pin: 'OUT_GRIPPER_CLOSE', state: true, label: 'gripper close' },        // → IN_GRIPPER_CLOSED (M306)
    // FIXED-STATION PNEUMATICS (M350 firmware push, slib-m.nc O10102 + firmwareStack) — OPEN-LOOP outputs: the push is
    // timed by G04 dwells, NOT sensor waits, so these have NO paired sensor handshake (they set the output + fire
    // io_change, was a no-op). M19 spindle-orient is recognized here (was a no-op) so P-C.2b can animate the orient on
    // its io_change; not otherwise modelled. M158 (vacuum on) is M159's pair-half — grounded in the WORKFLOW doc but NOT
    // emitted by the current firmwareStack (completeness).
    19: { kind: 'output', pin: 'OUT_SPINDLE_ORIENT', state: true, label: 'spindle orient' },
    156: { kind: 'output', pin: 'OUT_LOCATING_PIN', state: true, label: 'locating pin open' },
    157: { kind: 'output', pin: 'OUT_LOCATING_PIN', state: false, label: 'locating pin close' },
    158: { kind: 'output', pin: 'OUT_VACUUM', state: true, label: 'vacuum on' },
    159: { kind: 'output', pin: 'OUT_VACUUM', state: false, label: 'vacuum off' },
    160: { kind: 'output', pin: 'OUT_PUSHER', state: true, label: 'pusher open' },
    161: { kind: 'output', pin: 'OUT_PUSHER', state: false, label: 'pusher close' },
    // WAITS — park until the sensor reaches `state`
    300: { kind: 'wait', pin: 'IN_SPINDLE_STOPPED', state: true, label: 'spindle stopped' },
    301: { kind: 'wait', pin: 'IN_DRAWBAR_OPEN', state: true, label: 'drawbar released' },
    302: { kind: 'wait', pin: 'IN_DRAWBAR_CLOSED', state: true, label: 'drawbar clamped' },
    303: { kind: 'wait', pin: 'IN_MAG_OPEN', state: true, label: 'magazine open' },
    304: { kind: 'wait', pin: 'IN_MAG_CLOSED', state: true, label: 'magazine closed' },
    305: { kind: 'wait', pin: 'IN_GRIPPER_OPEN', state: true, label: 'gripper open' },
    306: { kind: 'wait', pin: 'IN_GRIPPER_CLOSED', state: true, label: 'gripper closed' },
};

export class GcodeExecutionEngine {
    constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, onWait = null, stock = null, stockOffset = null, wcsOffset = null, g53ApproxZ = null, initialPos = null, continuous = false, syntaxValidator = null, createVarStore = null, autoAnswer = true, autoAnswerMs = 800, simSpeed = 1, rapidRate = 6000, wcsBase = null, wcsStride = 5 } = {}) {
        this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
        // t644 — probe-datum tracking (for the datum-correctness check): _datumOrigin[axis] = the MACHINE coord where work-0
        // lands after a WCS write. Set by G92 (any post) and by a write to the WCS-table register range (wcsBase/wcsStride,
        // the register-write posts like Expert). The touched face reads work-0 ⟺ _datumOrigin[axis] == the face's machine coord.
        this._wcsBase = Number.isFinite(wcsBase) ? wcsBase : null;
        this._wcsStride = Number.isFinite(wcsStride) && wcsStride > 0 ? wcsStride : 5;
        // Time-true playback: moves take distance/feedrate (rapids at rapidRate),
        // divided by simSpeed (1 = real time). Slow probes crawl, rapids zip.
        this.simSpeed = Number.isFinite(simSpeed) && simSpeed > 0 ? simSpeed : 1;
        this.rapidRate = Number.isFinite(rapidRate) && rapidRate > 0 ? rapidRate : 6000;
        // Variable-store seam: anything Map-like with get(num)/set(num, val).
        // Default is an in-memory Map (pure simulation). A DDCS PC-bridge can
        // inject a store that proxies system variables (#880, #1920-1929, ...)
        // to a real controller while keeping user vars local.
        this.createVarStore = typeof createVarStore === 'function' ? createVarStore : () => new Map();
        // Pure-sim (own Map) → we POPULATE the machine DRO each step so read-machine returns the real coord. An injected
        // (live PC-bridge) store already PROXIES the controller's real DRO → don't overwrite it (it'd write a read-only reg).
        this._populateDro = typeof createVarStore !== 'function';
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
        // t540 — the tool's INITIAL position (PART frame), where the sim STARTS before the first move. Default origin
        // (byte-identical to every existing sim). The homing preview seeds it from the draggable machine-frame Start so
        // the ABSOLUTE G53 homing route draws FROM the Start to the switch (dragging the Start re-traces the travel live).
        this._initialPos = (initialPos && Number.isFinite(+initialPos.x)) ? { x: +initialPos.x || 0, y: +initialPos.y || 0, z: +initialPos.z || 0 } : null;
        // t570 — CONTINUOUS trace: an op whose AUTO reposition is a real machine TRAVERSE (the tool moves itself A→B, e.g.
        // alignment's auto-traverse) is ONE continuous path from the initial seat — the per-pass origin RESET (which is for a
        // MANUAL re-park) would break the A→B continuity, stranding the 2nd pass at the local origin. Default off (byte-identical).
        this._continuous = !!continuous;
        // Per-pass operator starts (one per REPOSITION pass) in STOCK coords. After a reposition the operator re-parks
        // the probe at the NEXT start (②③④), so the probe-vs-stock collision must run from THAT pass's start, not the
        // pass-0 _stockOffset (① — else a boss-both's 2nd-axis probe fires from ① into open space and misses). Set
        // externally (trace.js / the live run); falls back to _stockOffset for pass 0 / single-pass (byte-identical).
        this._passStarts = null;
        // Work origin (active WCS) expressed in MACHINE coords — the machine coordinate of part-zero.
        // Lets G53 machine-frame moves draw in the part/WCS frame the rest of the route uses:
        // part = machine - wcsOffset. Default = origin, so when unknown (no dump/profile) G53 is unchanged.
        this._wcsOffset = wcsOffset || { x: 0, y: 0, z: 0 };
        this._g53ApproxZ = g53ApproxZ;   // t826 — undeclared placement: the work-frame Z to render machine-frame G53 Z retracts at (margin above the work origin); null = declared → the exact machine map
        this.syntaxValidator = typeof syntaxValidator === 'function' ? syntaxValidator : null;
        // Auto-answer: a virtual sensor satisfies any M31/M33 wait after autoAnswerMs,
        // even for pins the truth table doesn't know — so any user's macro completes
        // hands-free. Turn off to hand-drive sensors and exercise failure branches.
        this.autoAnswer = autoAnswer !== false;
        this.autoAnswerMs = Number.isFinite(autoAnswerMs) ? autoAnswerMs : 800;
        this._autoTimers = new Map();   // pinName -> timeout id
        // Generic live-input bridge (DDCS Expert I/O-automation dialect). The factory sensor-wait idiom polls
        // #[1520+N] (N = 0-based pin, so var 1520+N ↔ panel pin N+1). Mirror every virtual input into that var
        // window so a `WHILE [#[1520+N] != L]` poll actually sees the panel / auto-sensor / truth-table state —
        // symmetric with how outputs already drive the panel. One listener for the engine's lifetime.
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            this._onIoChange = (e) => this._mirrorInputVar(e && e.detail && e.detail.pin);
            window.addEventListener('io_change', this._onIoChange);
        }
        this.resetState();
    }

    /**
     * Mirror a virtual INPUT pin's state into the live-input var window #[1520+N] (N = 0-based, so panel pin
     * k → var 1519+k). Called on every io_change and when an input wait is first evaluated, so the Expert
     * `WHILE [#[1520+N] != L]` poll reads the same state the panel / auto-sensor / truth table expose.
     * `changedName` is the resolved pin name from io_change; null re-syncs every input pin (used at eval time).
     */
    _mirrorInputVar(changedName) {
        if (!this.vars) return;
        // Re-resolve all 1-based input pins (1..24) and copy the matching virtual-input state into its var.
        // Cheap, and robust to semantic-name remapping (resolveVirtualPin) — only ever touches the #1520 window.
        for (let k = 1; k <= 24; k++) {
            const name = resolveVirtualPin(k, 'IN');
            if (changedName != null && name !== changedName) continue;
            this.vars.set(1519 + k, getVirtualInput(name) ? 1 : 0);
        }
    }

    /** Detach the io_change listener. Call when discarding a transient engine (e.g. a one-shot trace) so the
     *  bridge listener doesn't leak across the many engines a live editor spins up. */
    dispose() {
        if (this._onIoChange && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('io_change', this._onIoChange);
            this._onIoChange = null;
        }
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

            const ifMatch = stripped.match(/^IF\s+(.+?)\s*GOTO\s*(\d+)$/i);
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

            const whileMatch = stripped.match(/^WHILE\s+(.+?)\s+DO\s*[123]\s*$/i);
            if (whileMatch) {
                if (!validateCondition(whileMatch[1].trim().replace(/^\[|\]$/g, ''))) {
                    reportError(lineIndex, 'Invalid WHILE condition syntax');
                }
                return;
            }

            if (/^END\s*[123]\s*$/i.test(stripped)) {
                return;
            }

            const ifThenMatch = stripped.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
            if (ifThenMatch) {
                if (!validateCondition(ifThenMatch[1].trim().replace(/^\[|\]$/g, ''))) {
                    reportError(lineIndex, 'Invalid IF condition syntax');
                }
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
        this._mirrorInputVar(null);   // seed the #[1520+N] input window from the (now-cleared) virtual inputs
        this.pos = this._initialPos ? { ...this._initialPos } : { x: 0, y: 0, z: 0 };   // t540 — homing seeds the Start here (see constructor)
        this.absolute = true;
        this.unitScale = 1;
        this.motion = 0;
        this.feedVal = 0;
        this.plane = 17;
        this.program = [];
        this.labels = new Map();
        this.subs = this.subs || new Map();   // t760 — O#### subprogram header → program index (built at load; kept across resetState)
        this._callStack = [];                 // t760 — M98 return addresses (M99 pops); empty ⇒ M99 is a program end
        this.ip = 0;
        this.currentLineIndex = null;
        this.running = false;
        this.paused = false;
        this._waitPin = null;
        this._move = null;     // in-flight timed move (interpolated at the programmed feedrate)
        this._probeArmed = false;   // DM500 move-until-input: M101 arms, the next G01 is a probe, M102 disarms
        this._datumOrigin = {};     // t644 — machine coord of work-0 per axis after a WCS write (G92 / register); the datum check
        this._traceSink = null;   // when non-null (trace()), moves snap + push a segment here instead of animating
        this._pass = 0;           // manual-REPOSITION pass index (mirrors gcodeParser): each reposition starts a new pass
        this._maxPass = 0;        // highest pass reached → stats.passes = _maxPass + 1
        this._passSources = ['auto'];   // per-pass reposition SOURCE: 'auto' (auto-traverse) / 'manual' (operator jog) → start-marker colour. Pass 0 = the start (auto/default).
        this._passEnds = [];      // t107 — per-pass RUNTIME world-END (O + local pos at the reposition, post probe+retract+lift): an anchorsAtPrev pass anchors its dog-leg/probe HERE (machine-faithful), published in the trace result so the preview markers relocate to the same point.
        this.timer = null;
        this.stats = {
            feed: 0,
            rapid: 0,
            probe: 0,
            skipped: 0,
            steps: 0,
            absolute: false,   // did the program ever establish an ABSOLUTE position (G90 move / G53)? → path is start-INDEPENDENT
            dwellMs: 0,        // t844 — TIME ESTIMATE: sum of G4 P dwell (ms); non-motion, so not in the segments — accumulated here
            toolChanges: 0,    // t844 — count of M6 tool changes (× a declared per-change allowance in the estimate)
        };
        this.totalLines = 0;
        this._started = false;
    }

    loadProgram(text) {
        const { program, labels, totalLines } = loadProgramText(text, { keepEmpty: true });
        this.program = program;
        this.labels = labels;
        this.totalLines = totalLines;
        this._matchLoops();
        this._matchSubs();
    }

    /**
     * t760 — index every `O####` subprogram HEADER (program index) so a general `M98 P####` can jump to it and `M99`
     * return (a call stack). ONLY subs defined in THIS program are indexed (the emitted digit-glyph library O600-609,
     * or a CAM slot's own subs) — firmware slib subs (P501/P502) are NOT here, so they still hit their special handlers.
     */
    _matchSubs() {
        this.subs = new Map();
        for (let i = 0; i < this.program.length; i++) {
            const line = this.program[i] && this.program[i].stripped;
            const m = line && line.match(/^O0*(\d+)\b/i);
            if (m) this.subs.set(Number(m[1]), i);
        }
    }

    /**
     * Pre-match `WHILE <cond> DOn` ↔ `ENDn` (n = 1|2|3, FANUC-style) by structural nesting, tagging each
     * step so the executor can jump in O(1): the WHILE gets `whileN`/`whileCond`/`loopEnd` (program index of
     * its END), the END gets `endN`/`loopStart` (index of its WHILE). DDCS macros loop with WHILE/END, which
     * the IF/GOTO core can't express — this is what lets a generated CAM slot macro run in the simulator.
     */
    _matchLoops() {
        const stacks = { 1: [], 2: [], 3: [] };
        for (let i = 0; i < this.program.length; i++) {
            const s = this.program[i];
            const line = s && s.stripped;
            if (!line) continue;
            const wm = line.match(/^WHILE\b\s*(.+?)\s*\bDO\s*([123])\b\s*$/i);
            if (wm) {
                s.whileN = Number(wm[2]);
                s.whileCond = wm[1].trim().replace(/^\[|\]$/g, '');
                stacks[s.whileN].push(i);
                continue;
            }
            const em = line.match(/^END\s*([123])\b\s*$/i);
            if (em) {
                s.endN = Number(em[1]);
                const open = stacks[s.endN].pop();
                if (open != null) { s.loopStart = open; this.program[open].loopEnd = i; }
            }
        }
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
        // t107 — the FINAL pass has no trailing reposition to record its end, so capture it here (O + local pos). Only
        // an anchorsAtPrev pass READS _passEnds (via passAnchorFor), so this is inert for every non-corner op; publishing
        // it lets the preview relocate the reposition-DESTINATION markers to the same runtime end the collision fired from.
        const oFin = passAnchorFor(this._passStarts, this._passEnds, this._pass) || this._stockOffset || { x: 0, y: 0, z: 0 };
        this._passEnds[this._pass] = { x: oFin.x + this.pos.x, y: oFin.y + this.pos.y, z: oFin.z + this.pos.z };
        return {
            segments,
            bounds: segments.length ? b : null,
            passEnds: this._passEnds.slice(0, this._maxPass + 1),   // t107 — per-pass runtime world-ENDs (machine-faithful re-park anchors); preview-only
            stats: { feed, rapid, probe, retract: 0, passes: this._maxPass + 1, passSources: this._passSources.slice(0, this._maxPass + 1), skipped: this.stats.skipped, drawable: segments.length > 0, capped: !!capped, absolute: this.stats.absolute, dwellMs: this.stats.dwellMs, toolChanges: this.stats.toolChanges },
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
            let p;
            if (mv.path) {   // arc: interpolate along the linearized polyline (~5° chords → ~constant speed)
                const segs = mv.path.length - 1, f = t * segs, i = Math.min(segs - 1, Math.floor(f)), u = f - i;
                const a = mv.path[i], b = mv.path[i + 1];
                p = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
            } else {
                p = { x: mv.from.x + (mv.to.x - mv.from.x) * t, y: mv.from.y + (mv.to.y - mv.from.y) * t, z: mv.from.z + (mv.to.z - mv.from.z) * t };
            }
            p.pass = this._pass;   // INC4: report the current REPOSITION pass so the live tool anchors to starts[_pass] (not always ①)
            p.g53 = !!mv.g53; p.probing = !!mv.probe;   // t780 (user) — the MOVE's frame semantics ride the event (G53 = a machine-coord move; probe = rewriting the WCS)
            this.onPositionChange(p);
            this._updateLimitSwitches(p);   // H3 (t485) — trip home/limit switches LIVE as the axis travels toward the edge
        }
        this._nextDelayMs = 16;   // ~60 fps while travelling
    }

    // Land the in-flight move: snap to the target, fire any deferred probe touch.
    // Populate the machine DRO registers (all dialect bases) with the tool's CURRENT machine position so read-machine (RM)
    // returns the real coord. Machine space = stock space = the current pass's operator start (O) + the local position —
    // the SAME frame the probe trigger uses (#1925 = O + target). A=0 (no rotary axis tracked). Guarded to pure-sim.
    _updateDro() {
        if (!this._populateDro) return;
        const O = passAnchorFor(this._passStarts, this._passEnds, this._pass) || this._stockOffset || { x: 0, y: 0, z: 0 };   // t94/t107 — same re-park anchor the collision uses (runtime END for an anchorsAtPrev pass), so the DRO frame matches #1925-1927
        const mx = (O.x || 0) + this.pos.x, my = (O.y || 0) + this.pos.y, mz = (O.z || 0) + this.pos.z;
        for (const base of DRO_BASES) {
            this.vars.set(base, mx); this.vars.set(base + 1, my); this.vars.set(base + 2, mz); this.vars.set(base + 3, 0);
        }
    }

    // H3 (t485) — drive the LIVE home/limit switch inputs from the tool's MACHINE position (mirrors triggerProbeCollision
    // flipping IN_PROBE_COLLISION when the tool reaches a surface). Called at every position-commit point so IN_LIMIT_* /
    // IN_HOME_* trip as the axis reaches the edge (respecting the switchType standoff) + release on the back-off. FRAME:
    // this.pos is PART-frame; machine = (part + wcsOffset) / unitScale — the inverse of the G53/homing map (line ~903).
    _updateLimitSwitches(pos = this.pos) {
        if (!pos) return;
        const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : null;
        if (!s || !s.machine) return;
        const wo = this._wcsOffset || {}, us = this.unitScale || 1;
        const mp = { x: (pos.x + (wo.x || 0)) / us, y: (pos.y + (wo.y || 0)) / us, z: (pos.z + (wo.z || 0)) / us };
        setLimitSwitches(limitSwitchTrips(mp, s.machine, s.limits || {}));
    }

    _finishMove() {
        const mv = this._move;
        if (!mv) return;
        this._move = null;
        this.pos = { ...mv.to };
        if (typeof this.onPositionChange === 'function') {
            this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z, pass: this._pass });   // INC4: per-pass anchor
        }
        this._updateLimitSwitches();   // H3 (t485) — the move LANDED: trip/release the home/limit switches at the final position
        if (mv.touchName) this._touchPulse(mv.touchName);
    }

    // Pulse a probe input ON briefly so the I/O panel shows the touch.
    _touchPulse(pinName) {
        injectVirtualInput(pinName, true);
        setTimeout(() => injectVirtualInput(pinName, false), 400);
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

    /**
     * Recognise a DDCS Expert live-input poll WHILE condition: `#[1520+N] <op> L` (N = 0-based pin literal,
     * L the wanted level). Returns { pin, pinName, want } where pin is the 1-based panel pin (N+1), pinName the
     * resolved virtual-input name, and want the boolean input level that makes the WHILE condition FALSE (i.e.
     * the level the loop is waiting for, so we can route it through the same wait/auto-answer path as M31).
     * Returns null if the condition isn't a bare #[1520+N] input poll (those keep the plain WHILE behaviour).
     */
    _inputPollWhile(cond) {
        if (!cond) return null;
        const m = String(cond).trim().match(/^#\[\s*1520\s*\+\s*(\d+)\s*\]\s*(==|!=|<=|>=|<|>|=)\s*(-?\d+)\s*$/);
        if (!m) return null;
        const n = Number(m[1]);                 // 0-based pin index
        if (!Number.isFinite(n) || n < 0 || n > 23) return null;
        const pin = n + 1;                       // 1-based panel pin
        const pinName = resolveVirtualPin(pin, 'IN');
        // The awaited level is whichever of 0/1 makes the loop EXIT (condition false). For the factory `!= L`
        // idiom this is simply L; computing it generally also covers `== L`, `< L`, etc.
        const op = m[2] === '=' ? '==' : m[2];
        const rhs = Number(m[3]);
        const cmp = (lhs) => {
            switch (op) {
                case '==': return lhs === rhs;
                case '!=': return lhs !== rhs;
                case '<=': return lhs <= rhs;
                case '>=': return lhs >= rhs;
                case '<': return lhs < rhs;
                case '>': return lhs > rhs;
                default: return false;
            }
        };
        // Want the input level for which the WHILE condition is FALSE (loop exits). If both or neither 0/1
        // satisfy that, this isn't a level-wait we can answer — fall back to plain WHILE.
        const want0 = !cmp(0), want1 = !cmp(1);
        if (want0 === want1) return null;
        return { pin, pinName, want: want1 };
    }

    _executeStep(step) {
        const line = step.stripped;
        this.stats.steps += 1;

        // Manual REPOSITION (uniform "REPOSITION:" comment the wizards emit): the operator re-parks the probe by
        // hand → start a new pass at the program origin, exactly as gcodeParser does, so each pass is start-anchored
        // and the preview gives it its own draggable start marker. Detected on the RAW line (it's a comment).
        if (/reposition:/i.test(step.raw) && !this._continuous) {
            // t107 machine-faithful — RECORD the finishing pass's RUNTIME world-END (its anchor O + local pos, so it
            // includes probe+retract+lift, collision-clamped) BEFORE the reset. The NEXT pass's dog-leg + probe fire
            // emanate from HERE when it's an anchorsAtPrev pass (passAnchorFor reads _passEnds), not from the static
            // previous START marker — so the route, the relocated marker, and #1925-1927 all land on where the tool
            // actually is. Preview/sim only (never emitted).
            const oEnd = passAnchorFor(this._passStarts, this._passEnds, this._pass) || this._stockOffset || { x: 0, y: 0, z: 0 };
            this._passEnds[this._pass] = { x: oEnd.x + this.pos.x, y: oEnd.y + this.pos.y, z: oEnd.z + this.pos.z };
            this._pass += 1;
            if (this._pass > this._maxPass) this._maxPass = this._pass;
            this._passSources[this._pass] = /auto-traverse/i.test(step.raw) ? 'auto' : 'manual';   // marker colour by source: auto-traverse vs operator jog
            this.pos = { x: 0, y: 0, z: 0 };
        }

        this._updateDro();   // machine DRO reflects the last completed move → read-machine (RM) reads the real coord this step

        if (!line) {
            this.ip += 1;
            return false;
        }

        if (/^\s*[();]/.test(step.raw.trim())) {
            this.ip += 1;
            return false;
        }

        // t760 — a bare `O####` subprogram HEADER is a label/no-op: the body follows and is reached only via M98.
        if (/^O\d+\b/i.test(line)) { this.ip += 1; return false; }

        // WHILE <cond> DOn — pre-matched to its ENDn at load. Enter the body if the condition holds,
        // otherwise jump past the matching END. (Unmatched WHILE: just enter, the cap guards runaways.)
        if (step.whileN != null) {
            // DDCS Expert I/O-automation: a `WHILE [#[1520+N] != L] DO1 / G04 P10 / END1` is the factory
            // sensor-wait idiom (slib O10300) — it spins until live input N reaches L. That loop never
            // resolves on its own (nothing in the body changes the input), so instead of letting it run to
            // the trace cap, PARK on it like an M31 wait: surface the awaited pin (panel banner + pulse),
            // auto-answer it (virtual sensor) when "Auto sensors" is on, and let a panel click / truth table
            // satisfy it. The WHILE-EXIT condition is `input N == L`, so we wait for the input to BECOME L.
            const poll = this._inputPollWhile(step.whileCond);
            if (poll && !this._evaluateCondition(step.whileCond)) {
                // Condition false ⇒ the loop would EXIT now ⇒ the input has reached the wanted level: fall through.
                this.ip = step.loopEnd != null ? step.loopEnd + 1 : this.ip + 1;
                this._setWaitPin(null);
                return false;
            }
            if (poll) {
                // Condition true ⇒ the loop would SPIN: the input is not yet at the wanted level → wait for it.
                if (this._traceSink) {                        // trace: a virtual sensor satisfies the wait at once
                    injectVirtualInput(poll.pinName, poll.want);
                    this.ip = step.loopEnd != null ? step.loopEnd + 1 : this.ip + 1;
                    return false;
                }
                this._setStatus(`WHILE waiting for ${poll.pinName} to be ${poll.want ? 'ON' : 'OFF'}...`, true);
                this._setWaitPin({ pin: poll.pin, pinName: poll.pinName, target: poll.want });
                if (this.autoAnswer) this._scheduleAutoAnswer(poll.pinName, poll.want);
                this._nextDelayMs = 50;   // poll gently instead of spinning at the fast-step rate
                return false;             // do NOT advance — re-test this same WHILE next tick
            }
            if (step.loopEnd != null && !this._evaluateCondition(step.whileCond)) this.ip = step.loopEnd + 1;
            else this.ip += 1;
            return false;
        }
        // ENDn — loop back to its WHILE to re-test the condition.
        if (step.endN != null) {
            this.ip = step.loopStart != null ? step.loopStart : this.ip + 1;
            return false;
        }

        // IF <cond> THEN <assignment|GOTO> — inline conditional (distinct from the IF…GOTO form below).
        const ifThen = line.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);
        if (ifThen) {
            if (this._evaluateCondition(ifThen[1].trim().replace(/^\[|\]$/g, ''))) {
                const stmt = ifThen[2].trim();
                const g = stmt.match(/^GOTO\s*(\d+)$/i);
                if (g && this.labels.has(Number.parseInt(g[1], 10))) { this.ip = this.labels.get(Number.parseInt(g[1], 10)); return false; }
                if (/^#/.test(stmt)) this._handleAssignment(stmt);
            }
            this.ip += 1;
            return false;
        }

        // `\s*GOTO` (t638): the space before GOTO is OPTIONAL — V4.1 emits its IF-GOTO with NO space (`IF #1500>=[…]GOTO1`,
        // probe-h.nc:7); the old `\s+GOTO` never matched it, so V4.1 branches (incl. the probe-miss check) silently no-op'd in the sim.
        const ifMatch = line.match(/^IF\s+(.+?)\s*GOTO\s*(\d+)$/i);
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

        // t760 — general M98 P#### subprogram CALL, but ONLY for subs DEFINED in this program (the digit-glyph library
        // O600-609, a CAM slot's subs). Firmware slib subs (P501 homing / P502 probe) aren't in `subs`, so they fall
        // through to their existing special handlers below. Push the return address, jump to the O#### header.
        const m98 = line.match(/^M98\s*P0*(\d+)/i);
        if (m98 && this.subs && this.subs.has(Number(m98[1]))) {
            this._callStack.push(this.ip + 1);
            this.ip = this.subs.get(Number(m98[1]));
            return false;
        }
        // t760 — M99 RETURNS from a subprogram call (pop the return address). With no call on the stack it is a program end.
        if (/^M99\b/i.test(line) && this._callStack && this._callStack.length) {
            this.ip = this._callStack.pop();
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
        let waiting = false;
        let homedMove = null;       // M98 P501 X<N> native home — { axis, machine } resolved below, applied after the wait guard
        let wasNativeHome = false;  // any M98 P501 home line — short-circuit so its X-word (axis index) is never read as a coord
        for (const m of mcodes) {
            if (m === 6) {
                this.stats.toolChanges += 1;   // t844 — time estimate: each M6 costs a declared tool-change allowance
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
            } else if (ATC_DIALECT[m]) {
                // DDCS ATC dialect (drawbar / dust cover / gripper outputs + sensor waits) — ONE declared table, ground-
                // truthed to WORKFLOW.md. 'wait' parks on a sensor; 'output' drives a solenoid (its handshake confirms it).
                const d = ATC_DIALECT[m];
                if (d.kind === 'wait') {
                    if (waitForInput(m, null, d.pin, d.state)) waiting = true;
                } else {
                    setVirtualOutput(d.pin, d.state);
                    this._setStatus(`M${m} → ${d.label} (${d.pin} ${d.state ? 'ON' : 'OFF'})`, true);
                }
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
            } else if (m >= 50 && m <= 91) {
                // DDCS Expert generic digital OUTPUT (I/O-automation dialect): M(50+2k) = output k+1 ON,
                // M(51+2k) = output k+1 OFF (k 0-based; slib O10050-O10091 write #1552+k). Light the panel
                // (and fire any truth-table handshake) AND mirror the bit into the firmware var #1551+k so a
                // later `IF #1551+k…` / `WHILE` branch can read its own output back.
                const k = (m - 50) >> 1;          // 0-based output index
                const on = (m - 50) % 2 === 0;
                const pinName = resolveVirtualPin(k + 1, 'OUT');   // panel output is 1-based (k+1)
                setVirtualOutput(pinName, on);
                this.vars.set(1551 + k, on ? 1 : 0);
                this._setStatus(`M${m} → ${pinName} = ${on ? 'ON' : 'OFF'}`, true);
            } else if (m === 101 || m === 102) {
                // DM500 move-until-input probe cycle (bridge/controllers/dm500/install/probe.nc): M101 arms
                // probe-input monitoring, the following G01 feeds until the input triggers (the move stops at
                // the touch), M102 disarms. The next motion line is treated as a probe so it clamps to the
                // stock surface like a G31 (DM500 has no G31). No status var on this controller — motion just halts.
                this._probeArmed = (m === 101);
            } else if (m === 98 && Math.round(wm.P) === 501 && wm.X != null && Number.isFinite(wm.X)) {
                // NATIVE HOMING — M98 P501 X<N> (N = axis index 0=X 1=Y 2=Z 3=A 4=B). The homingWizard emits this
                // for the `native` method; the real controller runs subprogram O501 (its switch/dir/speed config) and
                // sets the homed flag itself. The sim has no controller, so we MODEL the motion here (the ONLY homing
                // motion model left after t542 removed the preview proxy — this handler stays for native M98 played in the
                // editor): home end = SIGNED machine travel (settings.machine[ax]) + offset, then a short back-off toward centre,
                // and we set the homed flag #[1515+N] ourselves (sim-only state, like the probe-result vars). Scoped
                // to P501 only — M98 P503/other subs stay unhandled (follow-up). Here X is the axis INDEX, not a coord,
                // so this is short-circuited after the wait guard (the coordinate-move path never sees wm.X).
                const num = (v, d) => (v === '' || v == null || isNaN(Number(v))) ? d : Number(v);
                const N = Math.round(wm.X);
                const AX = ['x', 'y', 'z', 'a', 'b'][N];
                if (AX === 'x' || AX === 'y' || AX === 'z') {   // only the linear axes draw motion (A/B home is set-zero)
                    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : {};
                    const machine = s.machine || {};
                    const cfg = ((s.homing || {}).axes || {})[AX] || {};
                    const travel = AX === 'z' ? num(machine.z, -120) : num(machine[AX], 300);
                    // t504 — HOME is the DECLARED HOME SWITCH end (settings.limits.<edge>Home, read by axisHomeMotion), NOT
                    // machine-0. Z with zMaxHome homes to the TOP (hi) whether machine.z is + or − (the positive-Z plunge is
                    // gone; no declared home → sign-derived machine-0 fallback). H3 (t485) — carry BOTH the seek (the home
                    // switch edge) and the back-off rest spot so the motion passes THROUGH the switch (trip) then settles
                    // backed-off (release), like the real O501.
                    const { seek, back } = axisHomeMotion(travel, { offset: num(cfg.offset, 0), backoff: num(cfg.backoff, 5), axis: AX, limits: s.limits });
                    homedMove = { axis: AX, seek, back };
                }
                this.vars.set(1515 + N, 1);   // homed flag #[1515+N] — the controller sets it on real hardware
                this._setStatus(`M98 P501 — home ${(AX || N).toString().toUpperCase()} (axis ${N})`, true);
                wasNativeHome = true;
            }
        }

        // If we're waiting on an input, do NOT advance IP and return immediately to pause execution
        if (waiting) {
            this._nextDelayMs = 50;   // poll the input gently instead of spinning at the fast-step rate
            return false;
        }
        this._setWaitPin(null);   // this line is past any input wait

        // NATIVE HOMING motion (M98 P501 X<N>, resolved above) — rapid the homed axis to its home end (machine frame,
        // mapped to the part frame: part = machine - wcsOffset, the same map the G53 path uses) so the spindle visibly
        // homes. The homed flag is already set. This is its OWN motion (X here was the axis INDEX, not a coordinate),
        // so it must NOT fall through to the coordinate-move path — we apply it and advance IP here. An A/B set-zero
        // home has no motion (homedMove null) but still short-circuits so its X<N> word is never read as a coordinate.
        if (wasNativeHome && !homedMove) { this.ip += 1; return false; }
        if (homedMove) {
            // H3 (t485) — model the real O501 motion (a G53 seek/back): SEEK the home switch
            // (the machine-0 end) then BACK OFF into the travel, so the home switch TRIPS at the seek and RELEASES on
            // the back-off. Both points map machine → part frame (part = machine·unitScale − wcsOffset — the G53 map).
            const map = (mach) => mach * this.unitScale - (this._wcsOffset[homedMove.axis] || 0);
            const seekT = { ...this.pos }; seekT[homedMove.axis] = map(homedMove.seek);   // the home SWITCH (machine-0 end)
            const target = { ...this.pos }; target[homedMove.axis] = map(homedMove.back);  // the backed-off REST spot
            this.stats.absolute = true;   // a homed axis is a fixed machine position, not start-relative
            if (this._traceSink) {
                const seg = (from, to) => this._traceSink.push({
                    x1: from.x, y1: from.y, z1: from.z, x2: to.x, y2: to.y, z2: to.z,
                    rapid: true, probe: false, type: 'rapid', feed: this.feedVal, pass: this._pass, line: step.lineIndex,
                });
                seg({ ...this.pos }, seekT);
                this.pos = seekT; this._updateLimitSwitches();   // H3 — SEEK reached the switch → home switch TRIPS
                seg({ ...this.pos }, target);
                this.pos = target; this._updateLimitSwitches();  // H3 — BACK-OFF off the switch → RELEASES
                this.ip += 1;
                return false;
            }
            const d = Math.hypot(target.x - this.pos.x, target.y - this.pos.y, target.z - this.pos.z);
            const realMs = this.rapidRate > 0 ? (d / this.rapidRate) * 60000 : 0;
            const speed = this.simSpeed > 0 ? this.simSpeed : 1;
            if (realMs / speed > 50) {
                // Animate current → seek (TRIP) → back (RELEASE) as a polyline so the home switch flips LIVE mid-move.
                this._move = { from: { ...this.pos }, to: target, path: [{ ...this.pos }, seekT, target], durMs: realMs, elapsed: 0, last: null, touchName: null };
                this._setStatus(`Homing ${homedMove.axis.toUpperCase()} — G0 ${d.toFixed(1)} mm`, true);
                this._nextDelayMs = 16;
                this.ip += 1;
                return false;   // ticks now advance the move; next line runs when it lands
            }
            this._updateLimitSwitches(seekT);   // H3 — instant home: the axis passes THROUGH the switch (TRIP)…
            this.pos = target;
            if (typeof this.onPositionChange === 'function') this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
            this._updateLimitSwitches();        // …then settles backed-off (RELEASE)
            this.ip += 1;
            return false;
        }

        // G4 dwell — DDCS unit is ms (dispatcher capture: G04 P500). Paced by simSpeed.
        if (gcodes.includes(4) && wm.P != null && Number.isFinite(wm.P) && wm.P > 0) {
            this.stats.dwellMs += wm.P;   // t844 — time estimate: the REAL dwell ms (not simSpeed-scaled)
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

        // t644 — G92 sets the WORK offset so the CURRENT machine position reads the given work value; it does NOT move.
        // Record the datum origin (machine coord of work-0 per axis) so the probe-datum check can verify the touched face
        // reads work-0. (Without this, G92 fell into the move handler below and drew a spurious jump.)
        if (gcodes.includes(92)) {
            const O = passAnchorFor(this._passStarts, this._passEnds, this._pass) || this._stockOffset || { x: 0, y: 0, z: 0 };
            const cur = { x: (O.x || 0) + this.pos.x, y: (O.y || 0) + this.pos.y, z: (O.z || 0) + this.pos.z };
            for (const [k, f] of [['X', 'x'], ['Y', 'y'], ['Z', 'z']]) {
                if (wm[k] != null && Number.isFinite(wm[k])) this._datumOrigin[f] = cur[f] - wm[k] * this.unitScale;
            }
            this.ip += 1;
            return false;
        }

        const hasAxis = wm.X != null || wm.Y != null || wm.Z != null;
        const hasArcArg = wm.I != null || wm.J != null || wm.K != null || wm.R != null;
        if (!hasAxis && !hasArcArg) {
            this.ip += 1;
            return false;
        }

        // G53 = one-shot machine-coordinate move, always ABSOLUTE. It used to be SKIPPED (ATC park / tool-change
        // never drew), then traced as a plain absolute move — but that plotted MACHINE coords in the part/WCS
        // frame, so a `G53 Z-5` safe-Z retract drew below the part. Now we map machine -> part:
        // part = machine - wcsOffset (wcsOffset defaults to origin, so it's a no-op until a dump/profile sets it).
        const g53 = gcodes.includes(53);

        const target = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
        let bad = false;
        const setAxis = (key, field) => {
            if (wm[key] == null) return;
            const value = wm[key];
            if (!Number.isFinite(value)) {
                bad = true;
                return;
            }
            // t826 — UNDECLARED placement (no WCS row backs the work origin): a machine-frame G53 Z retract has no true
            // scene position, so instead of collapsing onto raw machine coords (a G53 Z-5 would draw BELOW a top-datum part),
            // render it as the DECLARED safe-Z margin above the work origin — the honest approximation the user ruled good for
            // probe previews (never machine 0). Declared placement (_g53ApproxZ null) keeps the exact machine->part map.
            target[field] = g53 ? ((field === 'z' && this._g53ApproxZ != null) ? this._g53ApproxZ : value * this.unitScale - (this._wcsOffset[field] || 0))
                          : this.absolute ? value * this.unitScale
                          : this.pos[field] + value * this.unitScale;
        };
        setAxis('X', 'x');
        setAxis('Y', 'y');
        setAxis('Z', 'z');

        if (bad) {
            this.stats.skipped += 1;
            this.ip += 1;
            return false;
        }

        // stats.absolute = "the PROGRAM's frame is fixed (G90 mill), so moving the operator start must NOT drag the path".
        // It is driven by the DIST MODE (G90), NOT by a G53: a mid-program G53 is a LOCAL machine-frame excursion (a safe-Z
        // retract between probe passes) inside an otherwise-incremental (G91) probe macro — it must NOT flip the whole program
        // absolute, or the NEXT probe pass re-anchors to machine 0 (the old g53-move-breaks-preview-start-anchor collapse, t826).
        // The G53 move still RENDERS in the machine frame via the wcsOffset map above; the preview models it as a local
        // excursion while each probe pass stays anchored to its own start (passAnchor.js). See gcodeViz3d _anchorToStart.
        // t856 — EXCLUDE the G53 line itself (`&& !g53`): the safe-Z retract now emits a MODE-EXPLICIT `G90 / G53 / G91`
        // wrap (so the controller can't move it incrementally). Under that wrap the G53 line runs with this.absolute=true,
        // so without this guard it would set stats.absolute inside a G91 macro — exactly the t826 re-anchor collapse. A G53
        // is a machine-frame excursion, never the signal that the PROGRAM is absolute; the surrounding real (non-G53) moves
        // are. This makes the wrap stats.absolute-NEUTRAL (positions were already identical — G53 is machine-absolute regardless).
        if (this.absolute && !g53) this.stats.absolute = true;

        const isProbe = gcodes.includes(31) || this._probeArmed;   // G31, or a G01 inside a DM500 M101/M102 cycle
        // G53 (machine-coord positioning, e.g. the end "safe Z" park) is a RAPID, not a cut — but on DDCS it's
        // written bare (`G53 Z#v`, no G0), so it would otherwise inherit a preceding G1 and draw as a slow feed
        // (e.g. a pocket's wall-finish leaves G1 active → the retract looked like a cut to the floor). Force rapid.
        const effMotion = isProbe ? 1 : (g53 ? 0 : this.motion);

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
                
                // Probe-vs-stock geometry runs in STOCK space: the tool's real position is the operator start
                // (_stockOffset) + the local pos. The recorded route stays origin-relative (the viz offsets it
                // by the start marker), so dir is the same in both frames — only the start point shifts.
                // Part 1: the probe fires from its CURRENT pass's start (②③④ after a reposition), not always pass-0's ①.
                // t94 — for an AUTO reposition pass, O is the RE-PARK draw-anchor (previous start), NOT its net-endpoint
                // marker: the dog-leg is incremental (in local pos), so O(re-park) + local(dog-leg incl. +cross) lands the
                // probe fire + #1925-1927 exactly on ② the marker. Net-endpoint O double-counts +cross (fires off-face).
                // t572 — when the tool is SEATED at an absolute initial position (seatStart/homing: `pos` already carries the
                // world position), the pass-anchor/_stockOffset must NOT be added again — else aStart double-counts (2×the seat)
                // and the probe-vs-stock ray misses the fence entirely (alignment's horizontal G31 never collided). O = 0 then,
                // so aStart = the tool's real world pos. (Homing seeks in the MACHINE frame → still miss the part-frame stock →
                // the seek clamp below handles them, unchanged.)
                const O = this._initialPos ? { x: 0, y: 0, z: 0 } : (passAnchorFor(this._passStarts, this._passEnds, this._pass) || this._stockOffset || { x: 0, y: 0, z: 0 });
                const aStart = { x: O.x + this.pos.x, y: O.y + this.pos.y, z: O.z + this.pos.z };
                const bEnd = { x: O.x + target.x, y: O.y + target.y, z: O.z + target.z };
                const dir = { x: target.x - this.pos.x, y: target.y - this.pos.y, z: target.z - this.pos.z };
                let tt = null;
                if (probes && probePort === probes.setterPin) {
                    // Tool-setter plate — a thin box at the configured setter XY/Z (not the stock).
                    const sMin = { x: probes.setterX - probes.setterW / 2, y: probes.setterY - probes.setterH / 2, z: probes.setterZ - 0.01 };
                    const sMax = { x: probes.setterX + probes.setterW / 2, y: probes.setterY + probes.setterH / 2, z: probes.setterZ + 0.01 };
                    const ro = rayBox(aStart, bEnd, sMin, sMax);
                    if (ro.hit) { if (ro.tEnter > 1e-6 && ro.tEnter <= 1) tt = ro.tEnter; else if (ro.tExit > 1e-6 && ro.tExit <= 1) tt = ro.tExit; }
                } else {
                    // Stock — boss (outer box), pocket (box + cavity wall) or cylinder (round OD). Shared with the
                    // 3D preview via probeGeometry, so the simulated touch matches what the viz draws.
                    const motors = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings().motors : null;
                    const tipR = (probes && Number.isFinite(probes.radius)) ? probes.radius : 0;   // DECLARED probe tip radius → collide the SURFACE
                    tt = stockProbeStop(aStart, bEnd, this.stock, rotaryAxisOf(motors), tipR);
                }

                // HOMING seek clamp (t499): a G31 with NO stock to trip on and NOT the setter is the homing wizard's
                // G31 switch-seek. The real controller stops it at the home/limit switch = the machine envelope EDGE;
                // the Studio sim has no stock geometry for it, so clamp the seek to the envelope span so it homes to the
                // switch (machine-0 end) instead of running the full ±10000 to the far corner (the "-20000 plunge" when
                // PLAYED). Machine frame: part = machine·unitScale − wcsOffset (the same G53 map used above). te>=0 so an
                // on-edge seek (already at the switch) clamps to a no-op, then the G01 back-off releases off it.
                // t540 — the clamp now applies even with a STOCK shown: it only kicks in when the STOCK-trip did NOT fire
                // (tt == null), so a real probe that touches the stock is unaffected (tt set → skipped), while a homing G31
                // that SEEKS PAST the stock to the switch stops at the envelope EDGE instead of overshooting the full seek
                // distance (the human's played-homing "tool ends at the top-backoff", stock shown). (Was gated on !this.stock.)
                // But it must fire ONLY for a HOME/LIMIT-switch seek (the homing G31's port = a limit register, e.g. #1051) —
                // NOT for a TOUCH-PROBE that legitimately MISSES the stock (a boss-both ①-miss runs the FULL seek → the macro's
                // error branch). So exclude the touch-probe pin + the setter pin: what's left is a home/limit seek (or an
                // unconfigured port → still clamp, matching the old no-stock homing default).
                const isTouchProbe = probes && (probePort === probes.setterPin || probePort === probes.probePin);
                if (tt == null && !isTouchProbe) {
                    const machine = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings().machine : null;
                    if (machine) {
                        let te = null;
                        for (const a of ['x', 'y', 'z']) {
                            const d = target[a] - this.pos[a];
                            if (Math.abs(d) < 1e-9) continue;                        // not moving on this axis
                            const { lo, hi } = axisSpan(Number(machine[a]) || 0);
                            const wo = this._wcsOffset[a] || 0;
                            const edge = (d > 0 ? hi : lo) * this.unitScale - wo;    // the envelope face the seek runs into
                            const t = (edge - this.pos[a]) / d;                      // fraction of the move that reaches it
                            if (t >= 0 && t <= 1 && (te == null || t < te)) te = t;  // first edge crossed
                        }
                        if (te != null) tt = te;
                    }
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
                    pass: this._pass,       // manual-REPOSITION pass → one draggable start marker per pass (see _ensureMarkers)
                    line: step.lineIndex,   // source line → lets the preview seek the tool to a clicked code line
                });
                this.pos = target;
                this._updateLimitSwitches();   // H3 (t485) — trace-mode linear commit: trip/release the limit switches (a non-homing run reaching a limit trips too)
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
                    this._move = { from: { ...this.pos }, to: target, durMs: realMs, elapsed: 0, last: null, touchName, g53, probe: isProbe };   // t780 (user) — the position event states its frame semantics
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
                // Sub-frame move (no in-flight _move): report the current REPOSITION pass so the live tool anchors to
                // starts[_pass] like the animated path (line ~481) + the landing (_finishMove). WITHOUT this, a short
                // 2nd-axis retract emits pass-less → setToolPosition defaults to starts[0]=① → the tool FLASHES off ②
                // at each probe contact (B-FLASH-2ND-AXIS). pass 0 ops are unaffected (default already 0).
                this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z, pass: this._pass });
            }
            this._updateLimitSwitches();   // H3 (t485) — sub-frame move landed: trip/release the limit switches (a non-homing run that hits a limit trips too)
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
                        pass: this._pass,
                        line: step.lineIndex,
                    });
                    prev = pts[i];
                }
                this.pos = target;
                this._updateLimitSwitches();   // H3 (t485) — arc trace commit: trip/release the limit switches
            }
        } else {
            // Arc (G2/G3) in real-time play: walk the linearized arc so the curve actually animates. Direction
            // is inherited from arcPoints (it sweeps per the motion code; a full circle start==end sweeps a ring).
            const off = { I: wm.I, J: wm.J, K: wm.K, R: wm.R };
            const anyNull = ['I', 'J', 'K', 'R'].some((k) => wm[k] != null && !Number.isFinite(wm[k]));
            const pts = anyNull ? null : arcPoints(this.pos, target, off, effMotion, this.plane, this.unitScale);
            if (!pts || pts.length < 3) {
                this.stats.skipped += 1;
            } else {
                let len = 0;
                for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
                const rate = this.feedVal > 0 ? this.feedVal : 600;
                const realMs = rate > 0 ? (len / rate) * 60000 : 0;
                const speed = this.simSpeed > 0 ? this.simSpeed : 1;
                if (realMs / speed > 50) {
                    this._move = { from: { ...pts[0] }, to: { ...pts[pts.length - 1] }, path: pts, durMs: realMs, elapsed: 0, last: null, touchName: null, g53: false, probe: false };
                    this._setStatus(`${effMotion === 2 ? 'G2 cw' : 'G3 ccw'} arc ${len.toFixed(1)} mm at F${rate} — ${(realMs / 1000).toFixed(1)} s${speed !== 1 ? ` @ ${speed}×` : ''}`, true);
                    this._nextDelayMs = 16;
                    this.ip += 1;
                    return false;   // ticks now advance along the arc; next line runs when it lands
                }
                this.pos = target;   // sub-frame arc: jump to the end
                if (typeof this.onPositionChange === 'function') this.onPositionChange({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
                this._updateLimitSwitches();   // H3 (t485) — arc landed: trip/release the limit switches
            }
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
            const i = Math.round(idx);
            this.vars.set(i, value);
            // t644 — a write to the active WCS-table register range (wcsBase + k*stride + axis, bounded to ≤9 WCS so it can't
            // catch unrelated high registers like #1505/#1925) sets the datum: on register-write posts (Expert #805+) that
            // register HOLDS the machine coord of work-0. G92 posts set _datumOrigin in the move dispatch instead.
            if (this._wcsBase != null && i >= this._wcsBase && i < this._wcsBase + 9 * this._wcsStride) {
                const ax = (i - this._wcsBase) % this._wcsStride;
                if (ax >= 0 && ax <= 3) this._datumOrigin[['x', 'y', 'z', 'a'][ax]] = value;
            }
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
