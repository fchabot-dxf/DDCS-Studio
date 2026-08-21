/**
 * ui/editorAutocomplete.js — Studio text-editor authoring help: a single floating box at the caret that works in
 * TWO modes, distinguished by colour:
 *   • COMPLETE (blue)  — you're mid-word (e.g. "G1"): finish the half-typed G/M code or axis word.
 *   • NEXT WORD (green) — you're at a space / line start: predict the next word from the previous one.
 * The next-word prediction uses the SHARED bigram engine (blocks/bigram.js) — the same engine that drives the
 * Blocks suggestions — learning from what you actually type. Click a chip to insert. Gated by Settings → Editor
 * (compose.autocomplete). Monospace caret math.
 */
import { makeBigram } from '../blocks/bigram.js';

const S = (text, hint) => ({ text, hint: hint || text });
// ⭐ t2117 — G20/G21 are NOT unit modals on DDCS: the G/M list is explicit ("G20 | XYZAB F | Moving axes in the
// inch system. Works like G1."), so "G20 X1 Y1 F300" actually MOVES to X25.4 Y25.4 — same shape as G1, just in
// inches. Studio's own emit already never produces either (data/latheTools.js: "NEVER G20/G21") — this hint text
// was the only place still implying the Fanuc-style unit-modal reading.
const GCODES = ['G0 rapid','G1 feed','G2 arc CW','G3 arc CCW','G4 dwell','G17 XY plane','G18 XZ plane','G19 YZ plane','G20 MOVE (inch, not a modal!)','G21 MOVE (mm, not a modal!)','G28 home','G31 probe','G53 machine','G54 WCS1','G55 WCS2','G90 absolute','G91 incremental','G92 set pos','G94 feed/min','G95 feed/rev'].map((s) => S(s.split(' ')[0], s.split(' ').slice(1).join(' ')));
const MCODES = ['M0 stop','M1 opt stop','M3 spindle CW','M4 spindle CCW','M5 spindle off','M7 mist','M8 flood','M9 coolant off','M30 end','M98 call sub','M99 return'].map((s) => S(s.split(' ')[0], s.split(' ').slice(1).join(' ')));
const AXES = [S('X', 'x'), S('Y', 'y'), S('Z', 'z'), S('A', 'rotary'), S('F', 'feed'), S('S', 'rpm'), S('P', 'param'), S('I', 'arc x'), S('J', 'arc y')];
const HINT = {}; [...GCODES, ...MCODES, ...AXES].forEach((s) => { HINT[s.text.toUpperCase()] = s.hint; });

// Next-word seed (curated, grounded in the DDCS macros + standard g-code): "what word usually follows X".
const GWORD_SEED = {
    G0: ['X', 'Y', 'Z', 'F'], G1: ['X', 'Y', 'Z', 'F'],
    G2: ['X', 'Y', 'I', 'J', 'F'], G3: ['X', 'Y', 'I', 'J', 'F'],
    G90: ['G0', 'G1', 'X', 'Z'], G91: ['G31', 'G0', 'G1', 'Z'],   // G91 → G31 (the DDCS probe idiom)
    G31: ['Z', 'X', 'Y', 'F'], G53: ['Z', 'X', 'Y'],
    G54: ['G0', 'M3', 'X'], G55: ['G0', 'M3'], G92: ['X', 'Y', 'Z'],
    X: ['Y', 'Z', 'F'], Y: ['Z', 'F', 'X'], Z: ['F', 'X', 'Y'], A: ['F', 'Z'],
    I: ['J', 'K'], J: ['I', 'K'], F: ['X', 'Y', 'Z'], S: ['M3', 'M4'], P: ['G0', 'G1'],
    M3: ['S', 'G0', 'G1'], M4: ['S', 'G0'], M5: ['M30', 'M9', 'G0'],
    M8: ['G0', 'G1'], M9: ['M5', 'M30'], M6: ['M3', 'S'], T: ['M6'],
    M0: ['G0', 'M3'], M1: ['G0'], G4: ['G0', 'M5'],
};
const wordModel = makeBigram({ seed: GWORD_SEED, storageKey: 'ddcs_gcode_bigrams' });

// Normalise a token to its bigram key: G/M codes keep the number (G01→G1, M03→M3); axis/param words → the letter.
const keyOf = (tok) => {
    const u = tok.toUpperCase();
    const gm = u.match(/^([GM])0*(\d+)/);
    return gm ? gm[1] + gm[2] : u[0];
};

/** Context-aware suggestions for the caret at `pos` in `text`. Returns { token, hits, mode } where mode is
 *  'complete' (finishing the current word) or 'next' (predicting the next word at a boundary). */
export function suggestionsFor(text, pos) {
    const before = text.slice(0, pos);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    const token = (line.match(/[A-Za-z][A-Za-z0-9.]*$/) || [''])[0];
    if (token) {
        const tk = token.toUpperCase();
        let pool;
        if (tk.startsWith('M')) pool = MCODES;
        else if (tk.startsWith('G')) pool = GCODES;
        else if (/^[XYZAFSPIJK]/.test(tk)) pool = AXES;
        else pool = [...GCODES, ...MCODES, ...AXES];
        const hits = pool.filter((s) => s.text.toUpperCase().startsWith(tk)).slice(0, 7);
        if (hits.length === 1 && hits[0].text.toUpperCase() === tk) return { token, hits: [], mode: 'complete' };   // already complete
        return { token, hits, mode: 'complete' };
    }
    // boundary → predict the next word from the previous token on this line (bigram); fall back to line openers
    const prev = (line.match(/([A-Za-z][A-Za-z0-9.+-]*)\s+$/) || [])[1];
    const words = prev ? wordModel.suggestNext(keyOf(prev), 7) : ['G1', 'G0', 'M3', 'G54', 'M30'];
    return { token: '', hits: words.map((w) => S(w, HINT[w.toUpperCase()] || '')), mode: 'next' };
}

export function initEditorAutocomplete() {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const bar = document.createElement('div');
    bar.className = 'ac-bar'; bar.hidden = true;
    document.body.appendChild(bar);

    const cs = getComputedStyle(editor);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
    const charW = ctx.measureText('0').width || 8.4;
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
    const padL = parseFloat(cs.paddingLeft) || 0, padT = parseFloat(cs.paddingTop) || 0;

    const enabled = () => { try { return window.ddcsGetSettings().compose.autocomplete !== false; } catch (_) { return true; } };
    const hide = () => { bar.hidden = true; };
    let curToken = '';

    const caretXY = () => {
        const b = editor.value.slice(0, editor.selectionStart);
        const li = (b.match(/\n/g) || []).length;
        const col = b.length - (b.lastIndexOf('\n') + 1);
        const r = editor.getBoundingClientRect();
        return { x: r.left + padL + col * charW - editor.scrollLeft, y: r.top + padT + (li + 1) * lineH - editor.scrollTop };
    };

    const accept = (text) => {
        const pos = editor.selectionStart, start = pos - curToken.length;
        const ins = text + (/^[GM]/i.test(text) ? ' ' : '');   // codes get a trailing space; axis letters don't (a value follows)
        editor.value = editor.value.slice(0, start) + ins + editor.value.slice(pos);
        const caret = start + ins.length;
        editor.setSelectionRange(caret, caret);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.focus(); hide();
    };

    const show = () => {
        if (!enabled() || document.activeElement !== editor) return hide();
        const { token, hits, mode } = suggestionsFor(editor.value, editor.selectionStart);
        if (!hits.length) return hide();
        curToken = token;
        bar.className = mode === 'next' ? 'ac-bar ac-next' : 'ac-bar';
        bar.innerHTML = (mode === 'next' ? '<span class="ac-tag">next</span>' : '')
            + hits.map((s, i) => `<button class="ac-item" data-i="${i}" type="button"><b>${s.text}</b>${s.hint && s.hint.toUpperCase() !== s.text.toUpperCase() ? `<small>${s.hint}</small>` : ''}</button>`).join('');
        const { x, y } = caretXY();
        bar.style.left = Math.max(4, Math.min(x, window.innerWidth - 260)) + 'px';
        bar.style.top = (y + 3) + 'px';
        bar.hidden = false;
        [...bar.querySelectorAll('.ac-item')].forEach((b, i) => b.addEventListener('mousedown', (e) => { e.preventDefault(); accept(hits[i].text); }));
    };

    // Learn the user's g-code word order (debounced; comments/inline-comments stripped). Powers the next-word mode.
    let recTimer = 0;
    const learnFrom = () => {
        const body = editor.value.replace(/\([^)]*\)/g, ' ').replace(/;.*$/gm, ' ');
        wordModel.record((body.toUpperCase().match(/[A-Z][-+0-9.]*/g) || []).map(keyOf));
    };

    editor.addEventListener('input', () => { show(); clearTimeout(recTimer); recTimer = setTimeout(learnFrom, 800); });
    editor.addEventListener('click', show);
    editor.addEventListener('keyup', (e) => { if (/^(Arrow|Home|End)/.test(e.key)) show(); });
    editor.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bar.hidden) { e.stopPropagation(); hide(); } });
    editor.addEventListener('blur', () => setTimeout(hide, 150));   // let a chip mousedown land first
    editor.addEventListener('scroll', hide);
    window.addEventListener('ddcs:settings-changed', () => { if (!enabled()) hide(); });
}
