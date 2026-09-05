/**
 * wizards/dialects/emitLintRules.js — t2645 (BACKLOG #71/#72 adjacent) — THE DECLARED RULE TABLE for the emit
 * lint (tests/node/emit-lint-2645.test.mjs). DATA, not code: every rule below is a plain object a registry-
 * driven guard reads generically — adding a controller-specific hazard means adding a row here, never editing
 * the guard. Each rule carries its own PROVENANCE (the exact FINDINGS.md section or verify file it came from)
 * so a reader can check the claim without trusting this file blind.
 *
 * ⛔ NEVER CARRY A FINDING FROM ONE CONTROLLER TO THE OTHER (bridge/controllers/README.md rule 1). A rule's
 * `dialects` list is exactly the set of dialect ids (wizards/dialects/index.js's own DIALECTS keys) the
 * evidence actually covers — no rule here defaults to "probably the same on every DDCS dialect." Where a
 * controller has NO evidence (grbl/grblHAL/centroid/rs274ngc/ddcs-v3-dm500 for everything below), it simply
 * has no matching rule — silence, not an assumed pass or an assumed fail.
 *
 * SEVERITY, and why each rule sits where it does:
 *   'error' — zero legitimate use case ever (a forbidden token/range with no wizard reason to touch it). The
 *             guard's own MAIN sweep test asserts these are EMPTY today and stays a real gate against a future
 *             regression — "so a wizard authored next month is covered without anyone remembering to add it."
 *   'warn'  — a real, sometimes-legitimate hit (e.g. a WCS-writing probe wizard genuinely writes the WCS
 *             table on purpose). The guard COLLECTS and REPORTS these; it does not fail the suite on them —
 *             per t2645's own dispatch: "expect judgment calls, handle them as data."
 *   'info'  — not even a red flag, a VISIBILITY nudge (e.g. the #100-#499 persistent-scratch band may be
 *             intentional — config headers persist on purpose). "The lint's job is to make the choice
 *             VISIBLE, not to ban it."
 *
 * ⚠ KNOWN LIMITATION, named rather than silently missed (t2645): the variable-range scanner matches only a
 * LITERAL assignment, `#123 = …`. It CANNOT see an INDIRECT write — `#[#70] = …`, `#[#70+15] = …` — the exact
 * form corner/edge/middle's own WCS writes use on the Expert (wizards/dialects/ddcs-expert-m350.js's own
 * `wcsWriteIndirect`). Confirmed live: those three ops' own WCS-table writes produced ZERO hits in the first
 * real sweep, while homing's own LITERAL `#[1515+N]`-style writes (computed to a literal number before emit,
 * not left as an indirect expression) were caught correctly. This is the "nearest honest approximation"
 * t2645's own dispatch asked for when a lint cannot fully resolve read vs write — stated here, not hidden:
 * a rule in this table can MISS a real hazard hidden behind indirect addressing. Extending the scanner to
 * evaluate `#[expr]` symbolically is real future work, not attempted this turn.
 */

// ── TOKEN RULES — a forbidden/suspect construct anywhere in the emitted CODE (comments already stripped by
// the guard before matching) ──────────────────────────────────────────────────────────────────────────────
export const TOKEN_RULES = [
    {
        id: 'no-power-operator',
        sev: 'error',
        dialects: ['ddcs-expert-m350'],
        pattern: /\*\*|\^/,
        message: 'no power operator exists on this controller — both `^` and `**` raise a syntax error; rewrite exponentiation as repeated multiplication',
        provenance: 'bridge/controllers/expert-m350/FINDINGS.md "THE OPERATOR / FUNCTION SET, SETTLED" [CONFIRMED on machine 2026-09-05, camera-verified] — both forms photographed as syntax error!; the false all-clear on `**` (a canary that fired too early) is its own entry in the same file, "THE LATCH IS NOT INSTANTANEOUS"',
    },
    {
        id: 'no-mod-operator',
        sev: 'error',
        dialects: ['ddcs-expert-m350'],
        pattern: /\bMOD\b/,
        message: 'MOD is a syntax error on this controller',
        provenance: 'bridge/controllers/expert-m350/FINDINGS.md "WHY SOME INJECTED WRITES DON\'T TAKE" [CONFIRMED, photographed] — `#916 = [7 MOD 3]` photographed as `syntax error!:L1[#916 = [7 MOD 3]]`',
    },
    {
        id: 'trig-args-degrees-expert',
        sev: 'info',
        dialects: ['ddcs-expert-m350'],
        pattern: /\b(SIN|COS|TAN|ASIN|ACOS|ATAN|SQRT)\s*\[/,
        message: 'trig/SQRT arguments are in DEGREES on this controller, not radians — verify nothing upstream converted this expression to radians before it reached this call',
        provenance: 'bridge/controllers/expert-m350/FINDINGS.md "THE TRIG GAP IS CLOSED" [CONFIRMED on machine 2026-09-05, fw 2026-08-03-00, over Modbus] — COS[90]≈0, SIN[90]=1 ⇒ degrees; SQRT[16]=4 confirmed working (was previously merely unobservable, not untested)',
    },
    {
        id: 'trig-args-degrees-v41-atan',
        sev: 'info',
        dialects: ['ddcs-v41'],
        // scoped to ATAN only — the ONE trig function this controller has direct evidence for. COS/SIN/SQRT
        // are UNTESTED on V4.1 (no rule either way — silence, per this file's own header discipline).
        pattern: /\bATAN\s*\[/,
        message: 'ATAN arguments are in DEGREES on this controller (confirmed via the comma form) — verify nothing upstream converted this expression to radians. Other trig functions are UNTESTED on this controller; this rule does not cover them.',
        provenance: 'bridge/controllers/v4.1/FINDINGS.md — `ATAN[a, b]` comma form [CONFIRMED]: `ATAN[1, 1] * 100` → `4500` (45°), `ATAN[1, 2] * 100` → `2656.505` (26.565°), argument order confirmed',
    },
];

// ── VARIABLE-RANGE RULES — flags a WRITE (`#N = …`, N on the assignment LHS) into a named range. A bare READ
// of the same number is NOT flagged — per t2645's own dispatch: "a #1500+ READ may be legitimate... it is
// WRITES that destroy," and this guard can tell read from write in emitted text (LHS-of-`=` vs any other
// appearance), so it rules on that distinction rather than punting to "flag every occurrence."
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const VARIABLE_RANGE_RULES = {
    'ddcs-expert-m350': [
        // the exact trap that was actually hit (context/DDCS-VARIABLES.md's own header incident, 2026-09-05):
        // #915-#918 used as scratch for hours; they are H16-H19. 'error' — no wizard has a legitimate reason
        // to hand-write a raw tool-length-offset register; the tool table has its own dedicated write path.
        { lo: 900, hi: 919, label: 'H01-H20 tool length offsets', sev: 'error' },
        { lo: 920, hi: 939, label: 'D01-D20 cutter comp offsets', sev: 'error' },
        // 'warn', not 'error' — CORRECTED live while building this guard (t2645): the first pass assumed no
        // wizard has a legitimate reason to touch soft limits, and the very first sweep refuted it —
        // homingData.js:50 writes #655 ON PURPOSE, documented on its own field: "Re-enable #655 (soft limits)
        // after homing." A homing cycle disables soft limits before the machine has a zero and re-enables them
        // once homed; that is not a hazard, it is homing's whole job. Exactly the "confirm premise before
        // calling it a hazard" lesson this same session already paid for once (t2641 Part B).
        { lo: 655, hi: 670, label: 'software limits', sev: 'warn' },
        { lo: 622, hi: 626, label: 'home / machine zero', sev: 'error' },
        { lo: 735, hi: 739, label: 'home / machine zero', sev: 'error' },
        { lo: 766, hi: 767, label: 'serial baud / comm mode — breaking these loses the Modbus link', sev: 'error' },
        { lo: 779, hi: 779, label: 'serial parity — breaking this loses the Modbus link', sev: 'error' },
        { lo: 796, hi: 797, label: 'serial stop bits / Modbus mode — breaking these loses the Modbus link', sev: 'error' },
        // WCS is a REAL, common wizard purpose (corner/edge/middle/alignment/homing all write it on purpose)
        // — 'warn', collected and reported, never a hard failure.
        { lo: 800, hi: 844, label: 'WCS table G54-G59/G52', sev: 'warn' },
        { lo: 575, hi: 577, label: 'probe input port / level', sev: 'warn' },
        { lo: 500, hi: 1499, label: 'Pr0-Pr999 (real machine parameter)', sev: 'warn' },
        { lo: 2500, hi: 2999, label: 'Pr1000-Pr1499 (real machine parameter)', sev: 'warn' },
    ],
    'ddcs-v41': [
        // ⛔⛔ THE TRAP context/DDCS-VARIABLES.md names explicitly: #1500+ on V4.1 is NOT the M350's "system
        // globals" — it is the WCS AND TOOL TABLE. Carrying the M350's #1500+ = "system globals, lower risk"
        // read across to V4.1 would be exactly the cross-controller mistake rule 1 exists to prevent.
        { lo: 1554, hi: 1557, label: 'tool offsets X/Y/Z/A', sev: 'error' },
        { lo: 1560, hi: 1576, label: 'H1-H16 tool length', sev: 'error' },
        { lo: 1577, hi: 1593, label: 'D1-D16 diameter comp', sev: 'error' },
        { lo: 1512, hi: 1551, label: 'WCS table G54-G59/G52', sev: 'warn' },   // same real-wizard-purpose reasoning as the M350 WCS row above
        { lo: 500, hi: 1499, label: 'SYSTEM PARAMETER AREA (param page)', sev: 'warn' },
    ],
};

// ── SCRATCH-PERSISTENCE VISIBILITY — 'info' on BOTH controllers: #100-#499 PERSISTS through power-off on
// both (context/DDCS-VARIABLES.md "THE WHOLE RULE, IN ONE LINE" + the V4.1/M350 divergence table's own
// #100-#499 row). Persistence may be INTENDED (a config header a wizard wants to survive a reboot) — this is
// a visibility nudge, never a failure, per the dispatch's explicit "flag it, do not fail it."
export const PERSISTENT_SCRATCH_RANGE = { lo: 100, hi: 499, label: 'persists through power-off on both controllers', sev: 'info' };
export const PERSISTENT_SCRATCH_DIALECTS = ['ddcs-expert-m350', 'ddcs-v41'];

// ── THE SCANNER — one function, reused by the guard AND its own non-vacuity self-test, so "does the rule
// table actually catch anything" is never re-implemented ad hoc at the call site. Pure (text, dialectId) in,
// a flat hit list out — no DOM, no emit, no dialect object required (matches the browser-free node tier this
// guard runs in).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// A DDCS comment is `(…)` (non-nesting) or `;` to end of line — the SAME shape
// bridge/controllers/expert-m350/tools/ddcs_lint.py's own scan_comments() encodes for the real controller
// parser. Blanks out comment spans (kept as spaces, so column positions do not shift) so a rule never fires
// on a word that only appears inside an annotation.
function stripComments(line) {
    let out = '', depth = 0;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (depth === 0 && ch === ';') break;
        if (ch === '(') { depth++; out += ' '; continue; }
        if (ch === ')') { if (depth > 0) depth--; out += ' '; continue; }
        out += depth > 0 ? ' ' : ch;
    }
    return out;
}

const ASSIGN = /#(\d+)\s*=/;

/** The most SPECIFIC (narrowest) range a number falls into, from a dialect's own range list — so a write to
 *  #915 (inside BOTH the 900-919 H-offset row and the wider 500-1499 Pr row) reports once, as the row that
 *  actually names it, not twice. */
function narrowestRange(ranges, n) {
    let best = null;
    for (const r of ranges) {
        if (n < r.lo || n > r.hi) continue;
        if (!best || (r.hi - r.lo) < (best.hi - best.lo)) best = r;
    }
    return best;
}

/** Every lint hit for one emitted program against one dialect's own rules. */
export function scanEmitForLintHits(text, dialectId) {
    const hits = [];
    const lines = String(text || '').split(/\r?\n/);
    lines.forEach((raw, idx) => {
        const lineNo = idx + 1;
        const code = stripComments(raw);
        for (const rule of TOKEN_RULES) {
            if (!rule.dialects.includes(dialectId)) continue;
            const m = rule.pattern.exec(code);
            if (m) hits.push({ ruleId: rule.id, sev: rule.sev, lineNo, match: m[0], message: rule.message, provenance: rule.provenance });
        }
        const am = ASSIGN.exec(code);
        if (am) {
            const n = Number(am[1]);
            const ranges = VARIABLE_RANGE_RULES[dialectId] || [];
            const r = narrowestRange(ranges, n);
            if (r) {
                hits.push({ ruleId: `var-range:${r.label}`, sev: r.sev, lineNo, match: `#${n}`, message: `write to #${n} — ${r.label}`, provenance: 'context/DDCS-VARIABLES.md' });
            } else if (PERSISTENT_SCRATCH_DIALECTS.includes(dialectId) && n >= PERSISTENT_SCRATCH_RANGE.lo && n <= PERSISTENT_SCRATCH_RANGE.hi) {
                hits.push({ ruleId: 'var-range:persistent-scratch', sev: PERSISTENT_SCRATCH_RANGE.sev, lineNo, match: `#${n}`, message: `write to #${n} — ${PERSISTENT_SCRATCH_RANGE.label}`, provenance: 'context/DDCS-VARIABLES.md "THE WHOLE RULE, IN ONE LINE"' });
            }
        }
    });
    return hits;
}
