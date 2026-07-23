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
    pocket: [...MILL_OWN, ...KIT_RASTER],
    cpocket: [...MILL_OWN, ...KIT_RASTER],   // circlePocketSlot writes #20-#22 then ringClear's #27/#28/#29/#33
    corner: [...KIT_WCS, ...PROBE_SIGNS, ...PROBE_RCOMP],
    edge: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    zprobe: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    inside: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    boss: [...PROBE_TEMPS, ...KIT_WCS, ...PROBE_SIGNS],
    align: [...PROBE_TEMPS, ...ALIGN_SPAN, ...PROBE_SIGNS],
    drill: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT],
    bore: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT],
    slot: [...OPTOSLOT_CUT, ...OPTOSLOT_PAT],
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
 */
export function fieldVarCollisions(fields, ops) {
    const typeOf = (i) => { const o = (ops || [])[i]; return o && (o.type || o.camType); };
    const out = [];
    for (const f of (fields || [])) {
        const n = Number(String(f && f.var || '').replace('#', ''));
        if (!Number.isFinite(n)) continue;
        const own = typeOf(f._op);                 // the part this field belongs to — the only one that can clobber it
        if (!own || !inBands(n, bandsFor(own))) continue;
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
    const lines = cols.map((c) => `• #${c.varNum} — "${c.field}"${c.ownerOp ? ` (op ${c.ownerOp})` : ''} is overwritten by the ${c.clashType} generator's own working variables`);
    return [
        `This slot cannot be built: ${cols.length} form value${cols.length === 1 ? '' : 's'} would be overwritten by a generator's working variables.`,
        ...lines,
        '',
        'Composing these ops pushes the form values into the range the generator uses for its own maths, so the machine would run with the wrong numbers (e.g. spindle speed forced to 0).',
        'Build them as separate slots for now.',
    ].join('\n');
}
