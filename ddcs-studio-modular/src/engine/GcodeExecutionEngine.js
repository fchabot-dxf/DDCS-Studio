/**
 * A lightweight Studio execution engine for DDCS macro simulation.
 *
 * This engine walks G-code program text line by line, evaluates conditions,
 * updates motion state, and emits line-change callbacks for editor highlighting.
 * It also integrates with the browser-only virtual I/O layer for MSETDATA
 * handshake simulation and probe collision detection.
 */

import { resetVirtualIO, setVirtualOutput, triggerProbeCollision } from '../virtualIO.js';

const MSETDATA_OUTPUT_MAP = {
    // Placeholder mappings for common DDCS macro output codes.
    // Extend this map when controller-specific MSETDATA code values are known.
    120: 'OUT_SPINDLE_UNCLAMP',
    121: 'OUT_SPINDLE_CLAMP',
    130: 'OUT_CAROUSEL_ADVANCE',
    131: 'OUT_CAROUSEL_RETRACT',
    140: 'OUT_AIR_BLAST',
};

export class GcodeExecutionEngine {
    constructor({ stepDelay = 250, onLineChange = null, onStatus = null, onFinish = null, onPositionChange = null, stock = null, syntaxValidator = null } = {}) {
        this.stepDelay = Number.isFinite(stepDelay) ? stepDelay : 250;
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
                } else if (!GcodeExecutionEngine._validateConditionSyntax(condition)) {
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
                if (!GcodeExecutionEngine._validateExpressionSyntax(indexExpr)) {
                    reportError(lineIndex, 'Invalid assignment target');
                }
                if (!GcodeExecutionEngine._validateExpressionSyntax(rhs)) {
                    reportError(lineIndex, 'Invalid assignment expression');
                }
                return;
            }

            const words = GcodeExecutionEngine._tokenizeWords(stripped);
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
                    if (!GcodeExecutionEngine._validateExpressionSyntax(word.value)) {
                        reportError(lineIndex, `Invalid expression for ${word.letter}`);
                    }
                }
            }
        });

        return { valid: errors.length === 0, errors };
    }

    static _validateExpressionSyntax(expr) {
        if (expr == null) return false;
        const s = String(expr).trim();
        if (s === '') return false;

        const toks = [];
        let i = 0;
        const n = s.length;

        while (i < n) {
            const ch = s[i];
            if (ch === ' ' || ch === '\t') { i += 1; continue; }
            if ((ch >= '0' && ch <= '9') || ch === '.') {
                let num = '';
                while (i < n && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) { num += s[i]; i += 1; }
                if (num === '.' || num.length === 0) return false;
                toks.push(Number.parseFloat(num));
                continue;
            }
            if (ch === '#' || ch === '[' || ch === ']' || ch === '+' || ch === '-' || ch === '*' || ch === '/') {
                toks.push(ch);
                i += 1;
                continue;
            }
            return false;
        }

        let p = 0;
        const peek = () => toks[p];

        const parseExpr = () => {
            let value = parseTerm();
            while (value !== null && (peek() === '+' || peek() === '-')) {
                p += 1;
                const right = parseTerm();
                if (right === null) return null;
                value = 0;
            }
            return value;
        };

        const parseTerm = () => {
            let value = parseFactor();
            while (value !== null && (peek() === '*' || peek() === '/')) {
                p += 1;
                const right = parseFactor();
                if (right === null) return null;
                value = 0;
            }
            return value;
        };

        const parseFactor = () => {
            const token = peek();
            if (token === '+' || token === '-') {
                p += 1;
                return parseFactor();
            }
            if (token === '[') {
                p += 1;
                const inner = parseExpr();
                if (inner === null) return null;
                if (peek() !== ']') return null;
                p += 1;
                return 0;
            }
            if (token === '#') {
                p += 1;
                if (peek() === '[') {
                    p += 1;
                    const inner = parseExpr();
                    if (inner === null) return null;
                    if (peek() !== ']') return null;
                    p += 1;
                    return 0;
                }
                if (typeof peek() === 'number') {
                    p += 1;
                    return 0;
                }
                return null;
            }
            if (typeof token === 'number') {
                p += 1;
                return 0;
            }
            return null;
        };

        const result = parseExpr();
        return result !== null && p >= toks.length;
    }

    static _normalizeConditionExpression(expr) {
        if (expr == null) return '';
        return String(expr)
            .trim()
            .replace(/\bEQ\b/gi, '==')
            .replace(/\bNE\b/gi, '!=')
            .replace(/\bGT\b/gi, '>')
            .replace(/\bLT\b/gi, '<')
            .replace(/\bGE\b/gi, '>=')
            .replace(/\bLE\b/gi, '<=')
            .replace(/\b<>\b/g, '!=')
            .replace(/(?<![<>!=])=(?![<>!=])/g, '==');
    }

    static _validateConditionSyntax(expr) {
        if (expr == null) return false;
        const normalized = GcodeExecutionEngine._normalizeConditionExpression(expr);
        const match = normalized.match(/^(.*?)(==|!=|<=|>=|<|>)(.*)$/);
        if (!match) return false;
        return GcodeExecutionEngine._validateExpressionSyntax(match[1].trim()) && GcodeExecutionEngine._validateExpressionSyntax(match[3].trim());
    }

    static _tokenizeWords(line) {
        const words = [];
        let i = 0;
        const n = line.length;
        const isLetter = (c) => /[A-Za-z]/.test(c);

        while (i < n) {
            const ch = line[i];
            if (isLetter(ch)) {
                const letter = ch.toUpperCase();
                i += 1;
                let value = '';
                while (i < n && !isLetter(line[i])) {
                    value += line[i];
                    i += 1;
                }
                words.push({ letter, value: value.trim() });
            } else {
                i += 1;
            }
        }

        return words;
    }

    resetState() {
        resetVirtualIO();
        this.vars = new Map();
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
        const lines = String(text || '').split(/\r?\n/);
        this.totalLines = lines.length;
        this.program = [];
        this.labels = new Map();

        lines.forEach((raw, lineIndex) => {
            const stripped = raw.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ').trim();
            const tokens = this._tokenizeWords(stripped);
            const labelToken = tokens.find((t) => t.letter === 'N' && t.value != null);
            const label = labelToken ? Number.parseInt(labelToken.value, 10) : null;
            const step = { raw, stripped, tokens, label, lineIndex };
            if (label != null && Number.isFinite(label)) {
                this.labels.set(label, this.program.length);
            }
            this.program.push(step);
        });
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
        this.timer = setTimeout(() => this._tick(), this.stepDelay);
    }

    _tick() {
        if (!this.running) return;
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

        if (this._handleMSetData(line)) {
            this.ip += 1;
            return false;
        }

        if (/^#/.test(line)) {
            this._handleAssignment(line);
            this.ip += 1;
            return false;
        }

        const words = this._tokenizeWords(line);
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
        for (const word of words) {
            if (word.letter === 'G') {
                const value = Number.parseFloat(word.value);
                if (Number.isFinite(value)) gcodes.push(value);
            } else if (word.letter !== 'N') {
                wm[word.letter] = this._evaluateExpression(word.value);
            }
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
                        
                        this.vars.set(5061, target.x);
                        this.vars.set(5062, target.y);
                        this.vars.set(5063, target.z);
                    }
                }
            } else if (effMotion === 0) {
                this.stats.feed += 1;
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

    _handleMSetData(line) {
        const match = line.match(/\bMSETDATA\s*\[([^\]]+)\]/i);
        if (!match) return false;

        const args = match[1].split(',').map((value) => value.trim()).filter(Boolean);
        const code = args.length > 0 ? Number(args[0]) : null;
        const stateArg = args.length > 1 ? Number(args[1]) : 1;
        const state = stateArg !== 0;

        if (Number.isFinite(code) && MSETDATA_OUTPUT_MAP[code]) {
            const pin = MSETDATA_OUTPUT_MAP[code];
            setVirtualOutput(pin, state);
            this._setStatus(`MSETDATA ${code} → ${pin} = ${state ? 'ON' : 'OFF'}`, true);
        } else {
            this._setStatus(`MSETDATA ${args.join(',')} (no mapped output)`, true);
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
        const expr = GcodeExecutionEngine._normalizeConditionExpression(expression);
        const match = expr.match(/^(.*?)(==|!=|<=|>=|<|>)(.*)$/);
        if (!match) return false;

        const left = this._evaluateExpression(match[1].trim());
        const op = match[2];
        const right = this._evaluateExpression(match[3].trim());
        if (left == null || right == null) return false;

        switch (op) {
            case '==': return left === right;
            case '!=': return left !== right;
            case '<=': return left <= right;
            case '>=': return left >= right;
            case '<': return left < right;
            case '>': return left > right;
            default: return false;
        }
    }

    _tokenizeWords(line) {
        const words = [];
        let i = 0;
        const n = line.length;
        const isLetter = (c) => /[A-Za-z]/.test(c);

        while (i < n) {
            const ch = line[i];
            if (isLetter(ch)) {
                const letter = ch.toUpperCase();
                i += 1;
                let value = '';
                while (i < n && !isLetter(line[i])) {
                    value += line[i];
                    i += 1;
                }
                words.push({ letter, value: value.trim() });
            } else {
                i += 1;
            }
        }

        return words;
    }

    _evaluateExpression(str) {
        if (str == null) return null;
        const s = String(str).trim();
        if (s === '') return null;

        const toks = [];
        let i = 0;

        while (i < s.length) {
            const c = s[i];
            if (c === ' ' || c === '\t') { i += 1; continue; }
            if ((c >= '0' && c <= '9') || c === '.') {
                let num = '';
                while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
                    num += s[i];
                    i += 1;
                }
                toks.push(Number.parseFloat(num));
                continue;
            }
            if (c === '#' || c === '[' || c === ']' || c === '+' || c === '-' || c === '*' || c === '/') {
                toks.push(c);
                i += 1;
                continue;
            }
            return null;
        }

        let p = 0;
        const peek = () => toks[p];

        const parseExpr = () => {
            let value = parseTerm();
            while (value !== null && (peek() === '+' || peek() === '-')) {
                const op = toks[p++];
                const right = parseTerm();
                if (right === null) return null;
                value = op === '+' ? value + right : value - right;
            }
            return value;
        };

        const parseTerm = () => {
            let value = parseFactor();
            while (value !== null && (peek() === '*' || peek() === '/')) {
                const op = toks[p++];
                const right = parseFactor();
                if (right === null) return null;
                value = op === '*' ? value * right : (right !== 0 ? value / right : null);
            }
            return value;
        };

        const parseFactor = () => {
            const token = peek();
            if (token === '+') {
                p += 1;
                return parseFactor();
            }
            if (token === '-') {
                p += 1;
                const factor = parseFactor();
                return factor === null ? null : -factor;
            }
            if (token === '[') {
                p += 1;
                const inner = parseExpr();
                if (peek() === ']') p += 1;
                return inner;
            }
            if (token === '#') {
                p += 1;
                let idx = null;
                if (peek() === '[') {
                    p += 1;
                    idx = parseExpr();
                    if (peek() === ']') p += 1;
                } else if (typeof peek() === 'number') {
                    idx = toks[p++];
                } else {
                    return null;
                }
                if (idx == null || !Number.isFinite(idx)) return null;
                const value = this.vars.get(Math.round(idx));
                return value == null ? 0 : value;
            }
            if (typeof token === 'number') {
                p += 1;
                return token;
            }
            return null;
        };

        return parseExpr();
    }
}
