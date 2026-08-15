/**
 * data/camScratch.js — the DECLARED scratch bands each CAM generator writes, as inert DATA the build guard reads.
 *
 * WHY THIS EXISTS (t1081): a slot's FORM FIELDS get a LOCAL body var `f.var = '#' + (varOffset + i + 1)`. Unlike the
 * `#11xx` form param (`f.idx`, pooled through slotPack.nextParam against a `used` set) the LOCAL var has NO pool, NO
 * used-set and NO upper bound — `varOffset` is just a running sum of field counts across the composed parts. The
 * generators meanwhile HARD-CODE their scratch. Measured on the real emitted G-code:
 *   1 part  — SAFE (vars #1-#10 vs the mill scratch #20-#33: no overlap).
 *   2 parts — Surface + Pocket: part 2's `rpm` field IS `#20`, and the pocket then emits `#20=0   ;origin X`, so
 *             `M3 S[#20]` commands **S0** — a non-rotating tool driven through the toolpath.
 *   3 parts — part 3's vars #21-#30 sit fully inside #20-#33: TEN double-written vars; feed / plunge / clearance
 *             become the raster row-count, depth counter and row index. Crash class.
 *
 * SCOPE OF THIS MODULE (slice A): DECLARE + DETECT. It changes NO emitted G-code — it only lets the build REFUSE a
 * slot in which a part's OWN field vars land inside the scratch its OWN generator writes, so the silent S0 becomes a
 * visible, named refusal. (See fieldVarCollisions for why the rule is WITHIN-part: composed parts run sequentially,
 * so a cross-part overlap is harmless re-use of a volatile var, and treating it as a clash produced FALSE refusals.)
 * The collision-FREE allocation (slice B) renumbers local vars and is a separate, release-noted change.
 *
 * THE BANDS BELOW ARE DERIVED FROM THE CODE, NOT FROM THE PROSE HEADERS. Two of those headers were factually WRONG
 * (both corrected in this pass): camMacroKit claimed the raster band was #27-#32 when rasterClear writes #33 too, and
 * probeToSlot claimed it was "clear of drill/bore's #30-#54" while the probe slots write #50-#61. Anything added here
 * must be read off the real assignment targets.
 *
 * NOT COVERED HERE (slice C): the UNIVERSAL arm. `stackToSlot` emits through `emitMapped`, so wizard-op and dialect
 * scratch defaults (#5 #6 #9 #10 #17-#24 #42 #43 #50 #52 #53 #57 #95 #99, and #190/#191 on V4.1/DM500) land in the
 * same low band a universal op's field vars start in — that arm is already colliding at varOffset 0, and fixing it
 * needs those wizards/ops + dialect files to declare the scratch they inject.
 */

/**
 * t1429 — THE ATOM'S OWN BAND, READ FROM THE ATOM. `pocketSlot`'s clearing body is no longer hand-written: it is
 * `surfaceRasterLines`, emitted INSIDE the slot's program, so that atom's registers are now written DURING a pocket
 * part. A field var landing in them is the exact hazard this module exists for (a form value overwritten by the
 * generator's own maths, emitting clean G-code that cuts a different part), so the band has to be part of the pocket's
 * declaration — and it is IMPORTED rather than restated, because a copied band is a copy that drifts.
 *
 * The atom's dependency closure is three leaf modules (util, affineFrame, declaredWork — none of them import anything
 * from `data/`), so this costs the layer nothing. That is NOT true of `universalScratch`, whose aggregation this file's
 * header explains it cannot take; the distinction is a leaf constant against a module that reads the whole registry.
 */
import { RASTER_SCRATCH } from '../wizards/ops/surfaceraster.js';

// A band is an inclusive [lo, hi] pair of macro-variable NUMBERS (the `#` is implied).
// Citations are to the assignment that proves the number is written.
const MILL_OWN = [[20, 26]];        // millToSlot: #20/#21 origin, #22 tool radius, #23-#26 x0/x1/y0/y1 (pocket :74-82, cpocket :111-114, surfacing :142-149)
const KIT_RASTER = [[27, 33]];      // camMacroKit rasterClear: #27 rows, #28 z, #29 yy, #30 i, #31 dir, #32 xt, #33 ramp (:92-123) — ringClear reuses #27/#28/#29/#33 (:147-168)
const KIT_WCS = [[70, 71], [73, 73]];   // camMacroKit wcsBase #71/#70 (:46-48) + writeAxis #73 (:51-55)
const PROBE_TEMPS = [[50, 61]];     // probeToSlot probe results/temps: #50-#61 (probez :223, edge :261, inside :344-359, boss :427-443, align :501-527)
const PROBE_SIGNS = [[90, 97]];     // probeToSlot signs/targets #90-#97 (corner :102-104,:137-153; edge :270-277; inside :335-338; boss :417-420)
const PROBE_RCOMP = [[101, 102]];   // probeToSlot cornerSlot radius-comp temps #101/#102 (:104)
const ALIGN_SPAN = [[70, 72]];      // probeToSlot alignmentSlot re-purposes #70/#71 (A/B machine coords) + #72 (span) — a DIFFERENT meaning from wcsBase (:491,:493)
const OPTOSLOT_CUT = [[40, 41]];    // opToSlot cutLines: #40 cut radius, #41 helix depth (:78-86)
const OPTOSLOT_PAT = [[50, 54]];    // opToSlot pattern loops + the STANDALONE slot: #50-#54 (:56-58, :95-115)

/** camType → the scratch band(s) that generator writes. Keys are the CAM_GEN keys + the slotFromOp types. */
export const SCRATCH_BANDS = {
    surface: [...MILL_OWN, ...KIT_RASTER],
    // t1429 — the rect pocket writes its own #20-#26, the kit's #27-#33 (the wall pass's depth loop) AND the raster
    // atom's #34-#49/#62-#64, because its clearing body IS that atom now.
    pocket: [...MILL_OWN, ...KIT_RASTER, ...RASTER_SCRATCH],
    cpocket: [...MILL_OWN, ...KIT_RASTER],   // circlePocketSlot writes #20-#22 then ringClear's #27/#28/#29/#33
    corner: [...KIT_WCS, ...PROBE_SIGNS, ...PROBE_RCOMP],
    edge: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    zprobe: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    inside: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    boss: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    align: [...PROBE_TEMPS, ...ALIGN_SPAN, ...PROBE_SIGNS],
    drill: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT],
    bore: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT],
    /**
     * ⚠ t1512 — THE SLOT CARRIES **BOTH** BANDS ON ONE KEY, AND THAT MOVES THE LITERAL ARM'S VAR NUMBERS.
     *
     * `slotFromOp` has two arms now: the PACKED one whose clearing IS `surfaceRasterLines`, so the atom's
     * `RASTER_SCRATCH` (#34-#49, #62-#64) is written during a slot part exactly as it is during a pocket part; and the
     * LITERAL centreline body, which writes only `#50-#54` and never touches the atom's registers.
     *
     * `bandsFor` is keyed by camType ALONE, so one key must hold the UNION — which means the LITERAL arm's field vars
     * step over #34-#49 too, registers that arm never writes. That was the open question the t1510 pass flagged rather
     * than took, and the ruling (t1511) is the union: pre-release there is no migration to get wrong, the read-lines
     * that cite those numbers regenerate in the same pass as the numbers themselves so coherence holds, and a per-ARM
     * band key would be mechanism built to preserve numbers nothing depends on.
     *
     * ⚠ WHAT IT COSTS, MEASURED RATHER THAN ASSERTED — and it is NARROWER than "the literal arm's numbers move", which
     * is what the ruling was taken on and what I first wrote here. The local-var cursor starts at `varOffset + 1`, so a
     * SINGLE-PART slot (offset 0) mints #1-#9 and is **byte-identical** — the union is below nothing it uses. The
     * numbers only move for a COMPOSED slot whose cursor has already walked into the thirties: measured, the first
     * offset at which any var shifts is **25**, where the ninth field goes #34 → #55 (over the whole union in one step),
     * and from offset 33 the whole set sits at #55+. So the cost lands on multi-part packs only, and the literal arm's
     * SHAPE is untouched in every case — same moves, same loop, same order.
     *
     * THE OVERLAP THAT MATTERS: the atom's band ends at #49 and the probe temps start at #50, so the union abuts
     * `PROBE_TEMPS` without crossing it — and #62-#64 sits clear of everything. `fieldVarCollisions` is what proves a
     * composed slot never lands a form value inside this, and the guard is asserted at a HIGH varOffset (where the
     * cursor has walked past the low bands and the union is the only thing still pushing it up).
     */
    slot: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT, ...RASTER_SCRATCH],
};

/** The band(s) a camType owns, or [] when we have no declaration for it (universal / substack — slice C). */
export const bandsFor = (camType) => SCRATCH_BANDS[camType] || [];

const inBands = (n, bands) => (bands || []).some(([lo, hi]) => n >= lo && n <= hi);

// ── slice B: the collision-FREE local-var allocation ────────────────────────────────────────────────────────────────
/**
 * The next LOCAL body-var number at or after `from` that is NOT inside `avoid`. This is what makes the allocation
 * collision-free rather than merely collision-detected: a generator's field vars step OVER the band that same
 * generator writes, so a part can never overwrite its own operator values (slice A's guard stays as the backstop).
 */
export function nextLocalVar(from, avoid) {
    let n = Math.max(1, Math.trunc(from) || 1);
    while (inBands(n, avoid)) n++;
    return n;
}

/**
 * The highest local var a field list ACTUALLY minted (0 for none). The composer advances its cursor from THIS.
 *
 * This is what closes the BAKE GAP by construction: the old code minted from the SPEC index (`varOffset + i + 1`)
 * while callers advanced by `fields.length` (the EXPOSED count), so the moment a param was baked the two diverged and
 * the next part's vars overlapped the previous part's. Deriving the advance from what was minted means the mint and
 * the advance cannot disagree — there is no second counter to keep in step.
 */
export const maxLocalVar = (fields) => (fields || []).reduce((m, f) => {
    const n = Number(String((f && f.var) || '').replace('#', ''));
    return Number.isFinite(n) ? Math.max(m, n) : m;
}, 0);

/**
 * Every FIELD VAR that its OWN generator would overwrite. `fields` are the built slot's fields (each carrying `var`
 * like '#20' and `_op`, the index of its owning op); `ops` is the slot's op manifest. Returns
 * [{ varNum, field, ownerOp, ownerType, clashType }] — EMPTY means the slot is safe to build. Pure + read-only:
 * the caller decides what to do (the build refuses; validatePack errors).
 *
 * WHY WITHIN-PART, not cross-part (measured — an earlier draft over-approximated and produced FALSE refusals that
 * blocked a legitimate 3-op slot): the composed parts run SEQUENTIALLY, and each generator emits its own readLines at
 * the top of its OWN part (slotMacro only prepends reads when the body has none, which never happens for a generator
 * body). So part 1's scratch is already dead by the time part 2 reads its fields, and part 1's fields are dead before
 * part 2's scratch runs — a cross-part overlap is harmless re-use of a volatile var. The hazard is a part whose OWN
 * field var sits inside the band its OWN generator writes DURING that same part: e.g. pocket's `rpm` landing on #20,
 * which the pocket then sets to 0 as its origin X, so `M3 S[#20]` commands S0 mid-part. That is what this reports.
 *
 * `bandsOf` (t1085 slice C) — the camType→bands resolver, defaulting to this module's own generator declarations. The
 * UNIVERSAL arm's band is not a generator's; it is aggregated from the atoms + the active post by data/universalScratch.js,
 * which camScratch cannot import without giving up the leaf property the whole `data/` layer relies on. So the caller that
 * already has that module injects a resolver covering 'universal' — the guard then backstops every arm, not just the
 * hand-written generators. Passing nothing keeps the generator-only behaviour.
 */
export function fieldVarCollisions(fields, ops, bandsOf = bandsFor) {
    const typeOf = (i) => { const o = (ops || [])[i]; return o && (o.type || o.camType); };
    const out = [];
    for (const f of (fields || [])) {
        const n = Number(String(f && f.var || '').replace('#', ''));
        if (!Number.isFinite(n)) continue;
        const own = typeOf(f._op);                 // the part this field belongs to — the only one that can clobber it
        if (!own || !inBands(n, bandsOf(own) || [])) continue;
        out.push({
            varNum: n,
            field: f.label || f.key,
            ownerOp: (f._op != null ? f._op + 1 : null),
            ownerType: own,
            clashType: own,
        });
    }
    return out;
}

/** A human refusal message naming the colliding var, the field that owns it and the part that clobbers it. */
export function collisionMessage(cols) {
    if (!cols || !cols.length) return '';
    const lines = cols.map((c) => `• #${c.varNum} — "${c.field}"${c.ownerOp ? ` (operation ${c.ownerOp})` : ''} is overwritten by the ${c.clashType} generator's own working variables`);
    return [
        `This slot cannot be built: ${cols.length} form value${cols.length === 1 ? '' : 's'} would be overwritten by a generator's working variables.`,
        ...lines,
        '',
        'Composing these operations pushes the form values into the range the generator uses for its own maths, so the machine would run with the wrong numbers (e.g. spindle speed forced to 0).',
        'Build them as separate slots for now.',
    ].join('\n');
}
