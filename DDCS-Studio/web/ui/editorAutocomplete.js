/**
 * ui/editorAutocomplete.js — Studio text-editor autocomplete.
 *
 * A phone-autocorrect-style floating bar at the caret with CONTEXT-AWARE completions (G/M codes, axis words);
 * click to insert. Context: an empty line → common starters; mid-word "G"/"M" → matching codes; once the line
 * has a motion word → axis letters. Gated by Settings → Editor (compose.autocomplete). Monospace caret math.
 */
const S = (text, hint) => ({ text, hint: hint || text });
const GCODES = ['G0 rapid','G1 feed','G2 arc CW','G3 arc CCW','G4 dwell','G17 XY plane','G18 XZ plane','G19 YZ plane','G20 inch','G21 mm','G28 home','G31 probe','G53 machine','G54 WCS1','G55 WCS2','G90 absolute','G91 incremental','G92 set pos','G94 feed/min','G95 feed/rev'].map((s) => S(s.split(' ')[0], s.split(' ').slice(1).join(' ')));
const MCODES = ['M0 stop','M1 opt stop','M3 spindle CW','M4 spindle CCW','M5 spindle off','M7 mist','M8 flood','M9 coolant off','M30 end','M98 call sub','M99 return'].map((s) => S(s.split(' ')[0], s.split(' ').slice(1).join(' ')));
const AXES = [S('X', 'x'), S('Y', 'y'), S('Z', 'z'), S('A', 'rotary'), S('F', 'feed'), S('S', 'rpm'), S('P', 'param')];

/** Context-aware completions for the word at `pos` in `text`. Returns { token, hits }. */
export function suggestionsFor(text, pos) {
    const before = text.slice(0, pos);
    const line = before.slice(before.lastIndexOf('\n') + 1);
    const m = line.match(/[A-Za-z][A-Za-z0-9.]*$/);   // the word being typed
    const token = m ? m[0] : '';
    const tk = token.toUpperCase();
    const hasMotion = /\bG0*[0-3]\b/.test(line);
    let pool;
    if (tk.startsWith('M')) pool = MCODES;
    else if (tk.startsWith('G')) pool = GCODES;
    else if (/^[XYZAFSP]/.test(tk)) pool = AXES;
    else if (tk === '') pool = hasMotion ? AXES : [S('G0', 'rapid'), S('G1', 'feed'), S('M3', 'spindle'), S('G90', 'absolute'), S('X', 'x'), S('Z', 'z')];
    else pool = [...GCODES, ...MCODES, ...AXES];
    const hits = pool.filter((s) => s.text.toUpperCase().startsWith(tk)).slice(0, 7);
    if (hits.length === 1 && hits[0].text.toUpperCase() === tk) return { token, hits: [] };   // already complete
    return { token, hits };
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
        const before = editor.value.slice(0, editor.selectionStart);
        const li = (before.match(/\n/g) || []).length;
        const col = before.length - (before.lastIndexOf('\n') + 1);
        const r = editor.getBoundingClientRect();
        return { x: r.left + padL + col * charW - editor.scrollLeft, y: r.top + padT + (li + 1) * lineH - editor.scrollTop };
    };

    const accept = (text) => {
        const pos = editor.selectionStart, start = pos - curToken.length;
        const ins = text + (/^[GM]/i.test(text) ? ' ' : '');   // codes get a trailing space; axis letters don't (value follows)
        editor.value = editor.value.slice(0, start) + ins + editor.value.slice(pos);
        const caret = start + ins.length;
        editor.setSelectionRange(caret, caret);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.focus(); hide();
    };

    const show = () => {
        if (!enabled() || document.activeElement !== editor) return hide();
        const { token, hits } = suggestionsFor(editor.value, editor.selectionStart);
        if (!hits.length) return hide();
        curToken = token;
        bar.innerHTML = hits.map((s, i) =>
            `<button class="ac-item" data-i="${i}" type="button"><b>${s.text}</b>${s.hint && s.hint.toUpperCase() !== s.text.toUpperCase() ? `<small>${s.hint}</small>` : ''}</button>`).join('');
        const { x, y } = caretXY();
        bar.style.left = Math.max(4, Math.min(x, window.innerWidth - 240)) + 'px';
        bar.style.top = (y + 3) + 'px';
        bar.hidden = false;
        [...bar.querySelectorAll('.ac-item')].forEach((b, i) => b.addEventListener('mousedown', (e) => { e.preventDefault(); accept(hits[i].text); }));
    };

    editor.addEventListener('input', show);
    editor.addEventListener('click', show);
    editor.addEventListener('keyup', (e) => { if (/^(Arrow|Home|End)/.test(e.key)) show(); });
    editor.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bar.hidden) { e.stopPropagation(); hide(); } });
    editor.addEventListener('blur', () => setTimeout(hide, 150));   // let a chip mousedown land first
    editor.addEventListener('scroll', hide);
    window.addEventListener('ddcs:settings-changed', () => { if (!enabled()) hide(); });
}
