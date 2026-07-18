/**
 * blocks/dataOps/spindleHead.js — the DECLARED "this cutting op inherits the machine Head spindle" patch (t945).
 *
 * A makeStart-framed cutting twin (surfacing / drill / pocket / contour / bore / slot) seeds its template with
 * <op>Stack(<DEFAULTS>) — and the defaults carry NO spindle, so makeStart bakes the framing progstart with rpm 0.
 * The data-op emits via instantiate() over that FROZEN template (rpm is not a bound socket), so the progstart stays
 * rpm 0 → NO M3 → a DEAD SPINDLE: the machine plunges and cuts with the spindle off. The bug is why the gate fired
 * (t943): makeStart is never re-run on data-op emit, so injecting a spindle at emit can't reach it.
 *
 * The live FORM path never had this bug — surfacingView / drillView / … inject `spindle: s.spindle` at generate, so
 * makeStart resolves the Head defaultRpm at INSERT. This patch restores the SAME insert-time semantics for the
 * data-op twin: a postInstantiate hook (runs at BUILD — the moment the form also resolves) that fills a BLANK
 * framing progstart's rpm / dir / spin-up from the live machine Head, exactly as makeStart({ spindle: Head }) would.
 * So the data-op's header becomes byte-identical to the form's for the same machine.
 *
 * OPT-IN per twin (the 6 cutting twins declare `def.postInstantiate = spindleHeadPatch`, or compose it) — tap + text
 * are untouched BY CONSTRUCTION: tap's cycle owns M3/M4/M5 (its progstart rpm 0 is deliberate, and it skips
 * makeStart), and text bakes its own engrave default (12000) on BOTH its form and its twin, so it stays consistent.
 * The `rpm > 0 wins` guard mirrors makeStart, so an op that DECLARES an explicit progstart rpm (a picked-tool speed)
 * is left as-is. ONE-SOURCE: the machine Head (settings.spindle) is read live every build, never frozen into the def.
 */
import { flattenBlocks } from '../userOps.js';
import { num } from '../../wizards/ops/util.js';

/** The live machine Head spindle (settings.spindle), or {} off-app / before settings load. */
function liveHead() {
    try { return (typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().spindle) || {}; }
    catch (_) { return {}; }
}

/** postInstantiate hook: fill a BLANK (rpm ≤ 0) framing progstart's rpm / dir / spin-up from the live machine Head,
 *  so a cutting op spins up (M3/M4 S<Head>) instead of cutting dead — the same resolution the form does at insert.
 *  Mutates the stack in place and returns it (the postInstantiate contract). A no-op when the Head has no defaultRpm
 *  (r ≤ 0 — no spindle line, like today) or when the progstart already carries an explicit rpm. */
export function spindleHeadPatch(stack) {
    const sp = liveHead();
    const rpm = num(sp.defaultRpm, 0);
    if (rpm > 0) {
        for (const b of flattenBlocks(stack)) {
            if (b && b.type === 'progstart' && b.params && num(b.params.rpm, 0) <= 0) {
                b.params.rpm = rpm;                       // the Head defaultRpm → M3/M4 S<rpm>
                if (sp.dir) b.params.dir = sp.dir;        // Head direction (M4 when ccw) — a wrong M3 would spin backwards
                b.params.spinUp = num(sp.spinUp, 0);      // the Head spin-up dwell (form-parity: makeStart bakes this too)
            }
        }
    }
    return stack;
}
