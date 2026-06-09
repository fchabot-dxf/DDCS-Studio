import { parseGcode } from '../gcodeParser.js';
import { resetVirtualIO } from '../virtualIO.js';

export function simulateGcode(text, options = {}) {
    const mode = (options.mode || 'virtual').toLowerCase();
    if (mode === 'preview') {
        return parseGcode(text);
    }
    return executeGcode(text);
}

export function executeGcode(text) {
    resetVirtualIO();

    const segments = [];
    const vars = new Map();
    let pos = { x: 0, y: 0, z: 0 };
    let motion = 0;
    let absolute = true;
    let unitScale = 1;
    let plane = 17;
    let feedVal = 0;
    let started = false;
    let pass = 0;

    const bounds = {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    };
    let feedCount = 0, rapidCount = 0, retractCount = 0, probeCount = 0, skipped = 0;

    const grow = (p) => {
        if (p.x < bounds.minX) bounds.minX = p.x;
        if (p.y < bounds.minY) bounds.minY = p.y;
        if (p.z < bounds.minZ) bounds.minZ = p.z;
        if (p.x > bounds.maxX) bounds.maxX = p.x;
        if (p.y > bounds.maxY) bounds.maxY = p.y;
        if (p.z > bounds.maxZ) bounds.maxZ = p.z;
    };

    const lines = String(text || '').split(/\r?\n/);
    const program = [];
    const labels = new Map();

    for (const rawLine of lines) {
        if (/reposition:/i.test(rawLine)) {
            program.push({ raw: rawLine, type: 'reposition' });
            continue;
        }
        const stripped = rawLine.replace(/\([^)]*\)/g, ' ').replace(/;.*$/, ' ').trim();
        if (!stripped) continue;
        const tokens = gpTokenizeWords(stripped);
        const labelToken = tokens.find((t) => t.letter === 'N' && t.value != null);
        const label = labelToken ? parseInt(labelToken.value, 10) : null;
        const programIndex = program.length;
        if (label != null && Number.isFinite(label)) {
            labels.set(label, programIndex);
        }
        program.push({ raw: stripped, tokens, label, original: rawLine });
    }

    let ip = 0;
    const maxSteps = Math.max(program.length * 10, 1000);
    while (ip < program.length && ip >= 0 && ip < maxSteps) {
        const step = program[ip];
        ip += 1;

        if (step.type === 'reposition') {
            pass += 1;
            pos = { x: 0, y: 0, z: 0 };
            continue;
        }

        const line = step.raw;
        if (!line) continue;

        // IF conditions and GOTO control flow
        const ifMatch = line.match(/^IF\s+(.+?)\s+GOTO\s*(\d+)$/i);
        if (ifMatch) {
            const conditionText = ifMatch[1].trim().replace(/^\[|\]$/g, '');
            const targetLabel = parseInt(ifMatch[2], 10);
            if (evaluateCondition(conditionText, vars)) {
                if (labels.has(targetLabel)) {
                    ip = labels.get(targetLabel);
                    continue;
                }
            }
            continue;
        }

        const gotoMatch = line.match(/^GOTO\s*(\d+)$/i);
        if (gotoMatch) {
            const targetLabel = parseInt(gotoMatch[1], 10);
            if (labels.has(targetLabel)) {
                ip = labels.get(targetLabel);
            }
            continue;
        }

        const stopMatch = line.match(/^M30|^M02|^M2|^M99/i);
        if (stopMatch) break;

        if (/^#/i.test(line)) {
            const assignMatch = line.match(/^#(\[.*?\]|\d+)\s*=\s*(.+)$/);
            if (assignMatch) {
                const lhs = assignMatch[1].trim();
                const rhs = assignMatch[2].trim();
                let idx = null;
                if (lhs.startsWith('[') && lhs.endsWith(']')) {
                    idx = gpEvalExpr(lhs.slice(1, -1), vars);
                } else {
                    idx = parseInt(lhs, 10);
                }
                const value = gpEvalExpr(rhs, vars);
                if (idx != null && Number.isFinite(idx) && value != null) {
                    vars.set(Math.round(idx), value);
                }
                continue;
            }
            skipped++;
            continue;
        }

        const words = gpTokenizeWords(line);
        if (words.length === 0) continue;

        // Label-only lines don't affect execution beyond the label map.
        if (words.every((w) => w.letter === 'N')) continue;

        const gcodes = [];
        const wm = {};
        for (const word of words) {
            if (word.letter === 'G') {
                const value = parseFloat(word.value);
                if (Number.isFinite(value)) gcodes.push(value);
            } else if (word.letter !== 'N') {
                wm[word.letter] = gpEvalExpr(word.value, vars);
            }
        }

        const isProbe = gcodes.includes(31);
        const isMachine = gcodes.includes(53);

        for (const g of gcodes) {
            if (g === 20) unitScale = 25.4;
            else if (g === 21) unitScale = 1;
            else if (g === 90) absolute = true;
            else if (g === 91) absolute = false;
            else if (g === 17) plane = 17;
            else if (g === 18) plane = 18;
            else if (g === 19) plane = 19;
            else if ([0, 1, 2, 3].includes(g)) motion = g;
        }

        if (wm.F != null) feedVal = wm.F;
        const hasAxis = wm.X != null || wm.Y != null || wm.Z != null;
        const hasArcArg = wm.I != null || wm.J != null || wm.K != null || wm.R != null;
        if (!hasAxis && !hasArcArg) continue;
        if (isMachine) { skipped++; continue; }

        const target = { x: pos.x, y: pos.y, z: pos.z };
        let bad = false;
        const setAxis = (key, field) => {
            if (wm[key] == null) return;
            const value = wm[key];
            if (value === null || value === undefined || !Number.isFinite(value)) { bad = true; return; }
            target[field] = absolute ? value * unitScale : pos[field] + value * unitScale;
        };
        setAxis('X', 'x'); setAxis('Y', 'y'); setAxis('Z', 'z');
        if (bad) { skipped++; continue; }

        const effMotion = isProbe ? 1 : motion;
        if (!started) { grow(pos); started = true; }

        if (effMotion === 0 || effMotion === 1) {
            const type = isProbe ? 'probe' : (effMotion === 0 ? 'rapid' : 'feed');
            segments.push({
                x1: pos.x, y1: pos.y, z1: pos.z,
                x2: target.x, y2: target.y, z2: target.z,
                rapid: effMotion === 0, probe: isProbe, type, pass, feed: feedVal,
            });
            if (isProbe) probeCount++;
            else if (effMotion === 0) rapidCount++;
            else feedCount++;
            grow(target);
            pos = target;
        } else {
            const anyArcNull = ['I', 'J', 'K', 'R'].some((k) => wm[k] != null && !Number.isFinite(wm[k]));
            if (hasArcArg && anyArcNull) { skipped++; continue; }
            // Arcs are not fully simulated yet.
            skipped++;
            continue;
        }
    }

    return {
        segments,
        bounds: started ? bounds : null,
        stats: {
            feed: feedCount,
            rapid: rapidCount,
            retract: retractCount,
            probe: probeCount,
            jog: 0,
            passes: pass + 1,
            skipped,
            drawable: segments.length > 0,
        },
    };
}

function evaluateCondition(text, vars) {
    const expr = text.trim();
    const match = expr.match(/^(.*?)(==|!=|<=|>=|<|>)(.*)$/);
    if (!match) return false;
    const left = gpEvalExpr(match[1].trim(), vars);
    const op = match[2];
    const right = gpEvalExpr(match[3].trim(), vars);
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

function gpTokenizeWords(line) {
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

function gpEvalExpr(str, vars) {
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
                num += s[i]; i += 1;
            }
            toks.push(parseFloat(num));
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

    function parseExpr() {
        let v = parseTerm();
        while (v !== null && (peek() === '+' || peek() === '-')) {
            const op = toks[p++];
            const r = parseTerm();
            if (r === null) return null;
            v = op === '+' ? v + r : v - r;
        }
        return v;
    }
    function parseTerm() {
        let v = parseFactor();
        while (v !== null && (peek() === '*' || peek() === '/')) {
            const op = toks[p++];
            const r = parseFactor();
            if (r === null) return null;
            v = op === '*' ? v * r : (r !== 0 ? v / r : null);
        }
        return v;
    }
    function parseFactor() {
        const t = peek();
        if (t === '+') { p += 1; return parseFactor(); }
        if (t === '-') { p += 1; const f = parseFactor(); return f === null ? null : -f; }
        if (t === '[') {
            p += 1;
            const v = parseExpr();
            if (peek() === ']') p += 1;
            return v;
        }
        if (t === '#') {
            p += 1;
            let idx;
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
            const v = vars.get(Math.round(idx));
            return v == null ? null : v;
        }
        if (typeof t === 'number') { p += 1; return t; }
        return null;
    }

    return parseExpr();
}
