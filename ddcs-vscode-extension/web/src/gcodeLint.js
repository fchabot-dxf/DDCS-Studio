// gcodeLint.js — controller-aware G-code linter for the DDCS extension (webview side).
//
// VERIFIED rules only. Each rule cites the ground truth it came from (the M350 dumps / the dialect
// definitions in DDCS-Studio/web/wizards/dialects), never a guess or a dialect comment — a linter that
// false-positives on valid G-code is worse than no linter. Keep every rule scoped to the post(s) it is
// verified for; other posts form their machine moves differently.
//
// lintGcode(text, post) -> [{ line, startCol, endCol, severity, message, code }]  (0-based line + column).
// The host (DdcsEditorProvider) turns these into vscode.Diagnostics in the Problems panel.

// Blank out ( … ) comments and ;-trailers (preserving columns) so rules never fire inside a comment.
function codeOf(line) {
    return line
        .replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length))
        .replace(/;.*$/, (m) => ' '.repeat(m.length));
}

// DDCS M350: a machine move is "G53 <axis>#var" — NO G0 prefix, and the ref MUST be a #var (a literal
// fails on this firmware). Ground truth: snippets.nc:4 ("#99=0" / "G53 Z#99", marked "DDCS Compliant")
// and dialects/ddcs-expert-m350.js `machineMove`. Scoped to the M350 post only — v41 uses "G0 G53" and
// dm500's G53 is config-#395-gated, so those need their own verified rules before being flagged.
function ruleM350G53(text, post) {
    if (!post || post.id !== 'ddcs-expert-m350') return [];
    const out = [];
    text.split(/\r?\n/).forEach((raw, i) => {
        const line = codeOf(raw);
        const g53 = /\bG53\b/i.exec(line);
        if (!g53) return;

        // No G0/G00 prefix on M350.
        if (/\bG0(?:0)?\b/i.test(line)) {
            out.push({
                line: i, startCol: g53.index, endCol: g53.index + 3, severity: 'warning',
                message: 'DDCS M350: G53 takes no G0 prefix — use a bare "G53 <axis>#var".',
                code: 'ddcs.g53-no-g0',
            });
        }

        // Every axis ref after G53 must be a #var, not a literal.
        const after = line.slice(g53.index + 3);
        const axisRe = /([XYZABC])\s*(#?[-+0-9.\[\]]+)/gi;
        let a;
        while ((a = axisRe.exec(after))) {
            if (!a[2].includes('#')) {
                const col = g53.index + 3 + a.index;
                const ax = a[1].toUpperCase();
                out.push({
                    line: i, startCol: col, endCol: col + a[0].length, severity: 'error',
                    message: `DDCS M350: G53 ${ax} needs a #var ref (e.g. "G53 ${ax}#99") — a literal fails on this firmware.`,
                    code: 'ddcs.g53-needs-var',
                });
            }
        }
    });
    return out;
}

const RULES = [ruleM350G53];

export function lintGcode(text, post) {
    if (!text) return [];
    return RULES.flatMap((rule) => {
        try { return rule(text, post) || []; } catch (_) { return []; }
    });
}
