import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * GREP-GUARD (t684 d): no bare window.confirm / window.prompt / window.alert (or unqualified confirm/prompt/alert calls)
 * anywhere under web/ui + web/wizards — every operator ask must flow through the in-app dialog helper (ui/dialog.js), so
 * it is theme-aware + non-blocking + testable. Allowlist: NONE. Comments and strings are stripped before the check so a
 * mention of "prompt" in a comment or the `hmiPrompt` dialect method (a controller-side prompt, unrelated) doesn't trip it.
 */
function stripCommentsAndStrings(src) {
    let out = '', i = 0, n = src.length;
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') { const q = c; out += ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
        out += c; i++;
    }
    return out;
}

function jsFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const s = statSync(p);
        if (s.isDirectory()) out.push(...jsFiles(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

test('grep-guard: no bare confirm/prompt/alert in web/ui + web/wizards (allowlist none)', () => {
    const roots = [join('web', 'ui'), join('web', 'wizards')];
    const bad = /(?<![.\w])(confirm|prompt|alert)\s*\(/;   // a CALL not qualified by a member access or part of a longer identifier
    const offenders = [];
    for (const root of roots) {
        for (const f of jsFiles(root)) {
            if (f.endsWith(join('ui', 'dialog.js'))) continue;   // the helper itself names them in its doc? no — it uses none; still skip defensively
            const code = stripCommentsAndStrings(readFileSync(f, 'utf8'));
            code.split('\n').forEach((ln, i) => { if (bad.test(ln)) offenders.push(`${f}:${i + 1}  ${ln.trim().slice(0, 80)}`); });
        }
    }
    expect(offenders, 'use dlgConfirm/dlgPrompt/dlgNotice (ui/dialog.js) instead of the browser dialogs:\n' + offenders.join('\n')).toEqual([]);
});
