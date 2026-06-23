// ui/suggestBar.js — a phone-style predictive suggestion row above the dock keyboard.
//
// DDCS-grammar-aware: reads the current editor line up to the cursor and suggests the likely next
// tokens, ranked. Responsive — shows as many chips as fit the width (most-relevant first), so narrow
// screens show the top few and wide screens show more. Tapping a chip inserts it (window.insert).
// Toggle persists in localStorage (the 💡 button, or a Settings checkbox later).

const SUG_KEY = 'ddcs_suggest_on';
export const suggestEnabled = () => { try { return localStorage.getItem(SUG_KEY) !== 'off'; } catch (e) { return true; } };
export const setSuggestEnabled = (on) => { try { localStorage.setItem(SUG_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ } };

// label = what's shown on the chip, insert = what gets inserted (codes carry a trailing space).
const T = (arr) => arr.map((x) => (typeof x === 'string' ? { label: x.trim() || x, insert: x } : x));

// The rule engine — current line (up to cursor) → ranked next-token suggestions.
export function suggestFor(lineBeforeCursor) {
    const raw = String(lineBeforeCursor || '');
    const code = raw.replace(/\([^)]*\)/g, '');                 // ignore comment text
    if (/(^|\n)[^\S\n]*$/.test(code)) return T(['G0 ', 'G1 ', 'G31 ', 'IF ', 'M3 ', '#', '(']);
    const cur = code.replace(/[\s\S]*\n/, '');                  // just the current line
    const words = cur.trim().split(/\s+/).filter(Boolean);
    const last = words[words.length - 1] || '';
    const isIf = words[0] === 'IF';
    const hasG31 = words.includes('G31');

    if (/^(G0|G1|G2|G3|G53)$/.test(last)) return T(['X', 'Y', 'Z', 'A', 'F']);
    if (last === 'G31') return T(['X', 'Y', 'Z', 'F', 'P', 'L', 'Q']);
    if (last === 'G4') return T(['P']);
    if (last === 'M') return T(['3', '5', '8', '9', '30']);
    if (last === '#') return T(['1505', '1925', '1920', '1922', '880', '882']);
    if (last === 'IF') return T(['#1920', '#1922', '#1505']);
    if (last === 'GOTO') return T(['1', '2', '3']);
    if (last === '=') return T(['1', '0', '#', '[']);
    if (isIf && /[!=<>]+\d*$/.test(last)) return T(['GOTO']);                 // after a comparison
    if (isIf && /^#?\d+$/.test(last)) return T(['!=', '==', '<', '>']);       // after a var/number in IF
    if ((hasG31 && /^[XYZFPLQ]$/.test(last)) || /^[XYZABF]$/.test(last)) return T(['#', '-']);
    if (/^[XYZA]-?\d*\.?\d*$/.test(last)) return T(['Y', 'Z', 'F', '#']);     // after an axis value
    return T(['G1 ', 'GOTO', 'IF ', '#', 'M5 ']);
}

export function initSuggestBar() {
    const row = document.createElement('div');
    row.className = 'ddcs-suggest-bar';
    row.style.cssText = 'display:flex; gap:6px; align-items:center; overflow:hidden; padding:4px 8px; min-height:30px; border-bottom:1px solid rgba(255,255,255,0.06);';
    const chips = document.createElement('div');
    chips.style.cssText = 'display:flex; gap:6px; flex:1 1 auto; overflow:hidden; flex-wrap:nowrap;';
    row.appendChild(chips);

    const lineBeforeCursor = () => {
        const ed = document.getElementById('editor');
        if (!ed) return '';
        const pos = Number.isInteger(ed.selectionStart) ? ed.selectionStart : ed.value.length;
        return ed.value.slice(0, pos);
    };

    function fit() {
        const max = chips.clientWidth;
        if (!max) return;
        let used = 0;
        Array.from(chips.children).forEach((b, i) => {
            b.style.display = '';
            used += b.offsetWidth + 6;
            if (i > 0 && used > max) b.style.display = 'none';     // always keep at least the top chip
        });
    }

    function render() {
        // Off => hide the whole bar so the keyboard reclaims the vertical space. Re-enable in Settings.
        if (!suggestEnabled()) { row.style.display = 'none'; return; }
        row.style.display = 'flex';
        chips.innerHTML = '';
        for (const s of suggestFor(lineBeforeCursor())) {
            const b = document.createElement('button');
            b.className = 'toolbar-btn ddcs-suggest-chip';
            b.style.cssText = 'padding:2px 10px; font-size:12px; white-space:nowrap; flex:0 0 auto;';
            b.textContent = s.label;
            b.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (window.insert) window.insert(s.insert);
                setTimeout(render, 0);
            }, { passive: false });
            chips.appendChild(b);
        }
        requestAnimationFrame(fit);
    }

    const ed = document.getElementById('editor');
    if (ed) ['input', 'keyup', 'click', 'focus'].forEach((ev) => ed.addEventListener(ev, render));
    window.addEventListener('ddcs:suggest-changed', render);   // the Settings toggle fires this
    if (window.ResizeObserver) new ResizeObserver(fit).observe(chips);
    window.addEventListener('resize', fit);
    render();
    return row;
}
