/**
 * data/varMap.js — DDCS Expert macro VARIABLE MAP (the central registry of what each # range means, so the CAM
 * builder allocates persistent vars from a tracked pool and never clobbers one already in use).
 *
 * Macro var-space (CONFIRMED — bridge ops.py `_var_value` routing + expert-m350/FINDINGS.md):
 *
 *   #1   – #99    SCRATCH    volatile temp — reused freely within a macro, NOT tracked (community + our
 *                            generators use this). Re-assigned per macro; nothing persists here.
 *   #100 – #549   USERVAR    *** PERSISTENT user/macro vars (the `uservar` file, 450 slots). *** A macro that
 *                            needs to remember state (config flag, saved result, probe radius #110) stores it
 *                            here — so these MUST come from a tracked table, or two macros clobber each other.
 *   #550 – #999   SETTINGS   system params (WCS table base #805, geometry, soft limits…). Machine config —
 *                            only written on purpose (e.g. a WCS-set op), never as scratch.
 *   #1000– #1499  CAMSETTING ATC/CAM tables; the CAM FORM pool #1100–#1499 (persists as camsetting; mirror → +1500).
 *   #1500– #2599  SYSTEM     firmware: I/O, probe results (#1921/#1922/#1925-7), popups (#1503/#1505), input #2070.
 *   #2600– #2999  MIRROR     CAM form RUNTIME mirrors (populated from the form before the macro runs).
 *
 * Tracked pools (allocate from these, avoiding what's used): USERVAR #100-549 (persistent state) and FORM
 * #1100-1499 (form params, via slotPack). SCRATCH is untracked by design.
 *
 * ⚠ EXPERT/M350 ONLY. The CAM menu is an Expert firmware feature; the DDCS V4.1 differs (uservar #100–#499,
 *   1500-param setting schema, and likely no CAM page at all) — never apply this map to a V4.1. If we ever
 *   need a V4.1 variant, make these ranges dialect-keyed.
 */

export const RANGES = {
    scratch: { min: 1, max: 99 },
    uservar: { min: 100, max: 549 },
    settings: { min: 550, max: 999 },
    camsetting: { min: 1000, max: 1499 },
    system: { min: 1500, max: 2599 },
    mirror: { min: 2600, max: 2999 },
};
export const FORM = { min: 1100, max: 1499 };   // CAM form params (a sub-pool of camsetting)
export const WCS = { min: 805, max: 834 };       // G54..G59 offset table (base 805, stride 5)

/** RESERVED persistent uservar slots — a Studio meaning is pinned to the # so nothing else allocates it. Grounded CLEAN
 *  in the M350 dump (macro-free; a FINDINGS persistence test that touched a slot only PROVES it is a live persistent cell). */
export const RESERVED = {
    520: 'safe-Z margin (t822) — machine-frame retract height as a NEGATIVE machine Z (below home). sysstart.nc seeds it '
        + 'from settings.machine.safeZMargin; the error-handler retract reads G53 Z#520 with an inline unset-guard. '
        + 'Neighbours in use: park #470-471, tool-change #472-473, SN #490, tool-change working #500/#510 — #520 is clear.',
};

/** Which class a macro var # belongs to. */
export function classify(n) {
    n = Number(n);
    if (n >= WCS.min && n <= WCS.max) return 'wcs';
    for (const k of Object.keys(RANGES)) if (n >= RANGES[k].min && n <= RANGES[k].max) return k;
    return 'other';
}

/** Next free PERSISTENT USER var (#100–#549), avoiding a Set of used numbers. null if the pool is exhausted. */
export function nextUserVar(used) {
    for (let n = RANGES.uservar.min; n <= RANGES.uservar.max; n++) if (!used.has(n)) return n;
    return null;
}

/** Audit a macro body for variable WRITES that touch persistent ranges (so nothing is clobbered by accident).
 *  Returns { danger:[], notes:[] }: settings/WCS writes are flagged; persistent user-var writes are noted. */
export function auditMacroVars(body) {
    const writes = new Set();
    for (const m of String(body || '').matchAll(/#(\d+)\s*=(?!=)/g)) writes.add(Number(m[1]));   // `#N=` (not `==`)
    const danger = [], notes = [];
    [...writes].sort((a, b) => a - b).forEach((n) => {
        const k = classify(n);
        if (k === 'wcs') notes.push(`#${n} — WCS offset (sets a work origin; OK if intentional)`);
        else if (k === 'settings') danger.push(`#${n} — persistent machine setting (clobber risk if meant as scratch)`);
        else if (k === 'uservar') notes.push(`#${n} — persistent user var (allocate from the registry; don't reuse another macro's)`);
    });
    return { danger, notes };
}
