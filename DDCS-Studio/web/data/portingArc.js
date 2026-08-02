/**
 * data/portingArc.js — THE V4.1 PORTING ARC, DESIGNED AS DATA (t1530 scout, t1531 ruled, t1532 S1, t1534 S2-S4,
 * t1536 DM500 stage 1 measured, t1538 S5 bench kit delivered, t1542 S5 RUN on real silicon).
 *
 * ── STATUS ───────────────────────────────────────────────────────────────────────────────────────────────────────
 * All 5 forks in `PORTING_FORKS` are RULED (t1531) — read each `.ruling` field, not just `.recommend`. S1
 * (`corpus-oracle`) LANDED at t1532. S2/S3/S4 LANDED at t1534; S3's inputRead/atc fork RULED at t1535 — `false`
 * STANDS, ratified as the correct design. S5 RAN on real V4.1 hardware at t1542 (firmware 2025-04-04-012-NOR, no
 * motors) — see `V41_S5_RUN_RESULTS` for the full measured set and `PORTING_STAGES['live-roundtrip'].landed` for
 * the summary. HEADLINES: spacing CONFIRMED, SQRT HARDWARE-CONFIRMED (see also `trigEvidence.js`'s
 * `V41_TRIG_EVIDENCE`), `caps.flow:'goto'` CONFIRMED CORRECT (WHILE parses but never opens at top level — closes
 * the DM500 under-declaration theory too). ⚠⚠ THE URGENT ONE: `ddcs-v41.js`'s `ifGoto` CURRENTLY EMITS THE FORM
 * THAT FREEZES REAL HARDWARE (no space after IF) — a defect in ALREADY-SHIPPED emit, flagged not fixed here (an
 * emit change is its own act). Two open questions remain, named not concluded: arctangent under an untried name,
 * whether WHILE works inside an M98/macro-subprogram context. DM500 STAGE 1 (measurement only) landed at t1536:
 * `DM500_ORACLE_FINDINGS`. ⚠ NO VERDICT ON DM500 lives anywhere in this file — `POST_VERIFIED` is untouched
 * (still exactly `{expert-m350, v41}`), no cap value changed anywhere by this act. PORTING.md is the advisor's.
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────────────────────
 * The standing plan opened the porting arc with "port the emit corpus to other controllers, DDCS V4.1 FIRST, with
 * per-target VERIFY INSTRUMENTS". This file is the scout that act was dispatched as, in the `slotCapabilityArc`
 * shape: inert data the build acts read — what is already true, what is missing, the order, the gate on each step,
 * and what each stage is PROVED by. `tests/porting-arc-scout-1530.spec.js` asserts every factual claim below
 * against the real registry and the real corpus, so the design cannot rot between being written and being built.
 *
 * ── THE INVERSION, WHICH IS THE HEADLINE ────────────────────────────────────────────────────────────────────────
 * The arc was framed as a PORT. Measurement says the port is largely DONE and has been maintained continuously
 * through the whole parametric arc (the V4.1 dialect carries turn markers t477 · t638 · t644 · t822 · t915 · t1085
 * · t1472). V4.1 is one of exactly two posts in `POST_VERIFIED`. What is missing is not the emit — it is the
 * INSTRUMENT. The dialect's confirmations live in PROSE ("CONFIRMED against probe-fix.nc"), and prose does not go
 * red. 91 factory `.nc` macros are tracked in the repo and NOT ONE of them is read by any spec, for ANY target.
 *
 * So the arc's real content is: make the evidence EXECUTABLE. That is a different, smaller, and much safer act
 * than "port the corpus", and it is almost entirely offline.
 */

/**
 * ── WHAT IS ALREADY TRUE — measured at t1530, not assumed ────────────────────────────────────────────────────────
 * Every number here is asserted by the companion spec. They are recorded because the arc's whole shape follows
 * from them: an act planned as a port, against a target that is already ported, spends itself re-doing work.
 */
export const V41_PORT_STATE = {
    registered: 'ddcs-v41 is one of 7 posts in wizards/dialects/index.js, and one of exactly TWO in POST_VERIFIED '
        + '(hardware-verified) alongside ddcs-expert-m350',
    dialectSize: 'a full dialect module: every emit form Expert declares is either present or DELIBERATELY absent',
    specsTouching: 54,      // specs referencing the v41 dialect id
    trackedFiles: 209,      // git-tracked under bridge/controllers/v4.1
    trackedMacros: 91,      // ...of which are .nc factory macros
    expertTrackedFiles: 768, expertTrackedMacros: 333,
    emitResidue: 'the emit path is genuinely dialect-routed — now a CENSUS (V41_RESIDUE_CENSUS), not a sample. '
        + 'Zero actual bypasses found across all 33 lines',
};

/**
 * ── THE RESIDUE CENSUS (t1531 ruling, condition on arc-reframe) ────────────────────────────────────────────────────
 * The scout's "the port is done" rested on a SAMPLE (a handful of the Expert-literal lines, judged by eye). A
 * sample is prose too — the arc's own thesis, turned on its own premise. This is the CENSUS: all 33 non-comment
 * lines carrying an Expert-literal register (#578/#805+/#1925/#880/#883) across the 16 files that have any,
 * individually traced to the atom that actually consumes each one. `tests/v41-residue-census-1532.spec.js` re-runs
 * the same grep this table was built from and asserts the count and the file set — so "33, zero bypasses" is a
 * claim that goes red the day a new literal lands or an old one's consumer changes.
 *
 * EVERY line falls into one of six honest categories. NONE is "actual-bypass": a literal that reaches emit
 * unconditionally on a non-Expert dialect and produces wrong G-code. If the census had found one, it would BE port
 * work and land in this arc rather than being re-litigated later — per the ruling. It did not.
 */
export const V41_RESIDUE_CENSUS = {
    totalLines: 33, totalFiles: 16, actualBypasses: 0,
    countNote: 'category counts are per MATCHED LINE (the exact grep hit), not per register mentioned nearby — a '
        + 'table-definition line like `X: { status: \'#1920\', result: \'#1925\', ... }` matches the census pattern '
        + 'ONLY via its `#1925`, so it is counted once, under the category that literal\'s consumer earns. The '
        + '`.status` sub-field (#1920) never matched the pattern at all and is a separate, smaller finding — see '
        + '`V41_STATUS_FIELD_DEAD` — kept OUT of this count so 33 stays the real number the spec can pin',
    categories: {
        'passthrough-rawAxis': {
            count: 8, verdict: 'SAFE',
            what: 'a literal Expert probe-trigger register (#1925, always the X-axis slot of a per-axis table or a '
                + '`raw` default) declared as a FALLBACK, paired with a `rawAxis` param that — when set — asks '
                + '`dialect.probeTrigVar(axis)` at emit time and WINS. Traced through the full chain: radiuscomp.js '
                + '(the atom) <- probeSurface.js:70 (its only call site, forwards rawAxis) <- every one of its 7 '
                + 'callers (corner/edge/middle/rotaryCenter/latheProbe) passes rawAxis explicitly. On V4.1 this '
                + 'resolves to #1500+ax; the Expert literal is never reached',
            sites: ['cornerWizard.js:25(AX table, X-row .result)', 'edgeWizard.js:19(same)', 'middleWizard.js:29(same)',
                'probeBlocks.js:21(AXIS_VARS table, same)', 'ops/radiuscomp.js:17(defaults.raw)',
                'ops/radiuscomp.js:29(the fallback read `p.raw || \'#1925\'`)',
                'rotaryCenterWizard.js:81(TRIG table X entry)', 'lathe/latheProbe.js:53(.trigger, X entry)'],
        },
        'wcs-selector-passthrough': {
            count: 15, verdict: 'SAFE',
            what: 'the `wcsArgOf`/`wcsArg` idiom — `w === \'active\' ? \'#578\' : <numeric index>` — or the field '
                + 'DEFAULT it feeds (`wcs: \'#578\'`), passed into `dialect.setWorkOffset(wcsExpr, axis, value)` / '
                + '`wcswrite`. CONFIRMED by reading V4.1\'s own setWorkOffset (ddcs-v41.js:68): its `wcsExpr` '
                + 'PARAMETER IS NEVER READ IN THE FUNCTION BODY. Real Expert semantics, carried as an inert argument '
                + 'on every other dialect. wcsIndirect.js:50 confirmed the same for the wcswrite atom\'s non-Expert arm',
            sites: ['cornerWizard.js:156', 'edgeWizard.js:53', 'lathe/faceProbe.js:37', 'lathe/odProbe.js:38',
                'middleWizard.js:130', 'rotaryCenterWizard.js:48', 'rotaryClockWizard.js:47',
                'dataOps/rotaryCenterData.js:106', 'dataOps/rotaryClockData.js:104',
                'ops/setworkoffset.js:18,30,34,37(4 CODE lines)', 'ops/wcsIndirect.js:28,50(2 CODE lines)'],
        },
        'comment-only': {
            count: 5, verdict: 'N/A — no code literal, nothing to classify as safe or unsafe',
            what: 'the grep pattern hit a TRAILING comment on an otherwise unrelated code line (e.g. `return wcs;   '
                + '// already resolved (#578 / index / ...) → unchanged`), not a register in the executed expression. '
                + 'Counted honestly rather than silently dropped, since the census claims to cover every matched line',
            sites: ['cornerWizard.js:212', 'ops/radiuscomp.js:21', 'ops/setworkoffset.js:21',
                'ops/setworkoffset.js:35', 'ops/setworkoffset.js:36'],
        },
        'gated-absence': {
            count: 2, verdict: 'SAFE — explicit degrade',
            what: 'the #883 dual-gantry slave DRO has NO cross-post equivalent. wcsWriteBlock (wcsIndirect.js:47-48) '
                + 'falls to `offComment` (a plain comment) rather than a G92 guess when `dialect.wcsWriteIndirect` is '
                + 'absent — the exact call sites carry their own "no equivalent on this controller" comment',
            sites: ['cornerWizard.js:379', 'middleWizard.js:344'],
        },
        'dialect-routed-safe-default': {
            count: 1, verdict: 'SAFE',
            what: '`(d && d.vars && d.vars.dro) || 880` — reads the ACTIVE dialect\'s own declared `vars.dro` first; '
                + '880 is reached only if the dialect object itself were malformed (every registered dialect declares '
                + 'vars.dro). Dialect-routed, with an Expert-shaped value as the unreachable-in-practice floor',
            sites: ['atcChangeWizard.js:56'],
        },
        'dead-unreferenced-function': {
            count: 2, verdict: 'DEAD, not a bypass — the function itself is never imported',
            what: '`wcsBase()` in wizards/dialect.js (the #578/805+ arithmetic) is exported but grep-confirmed to have '
                + 'exactly ONE importer of that module (probeBlocks.js), which imports only `ifGoto` — never `wcsBase`. '
                + 'A same-named, unrelated `wcsBase()` in data/camMacroKit.js (CAM-slot machinery) is what every real '
                + 'caller actually uses. Two different functions sharing a name across two files — worth a rename to '
                + 'stop the collision reading as one function; not port work either way',
            sites: ['wizards/dialect.js:63', 'wizards/dialect.js:65'],
        },
    },
};

/**
 * A SEPARATE, SMALLER finding from the same read — the `.status` sub-field (#1920/#1921/#1922) in the per-axis
 * AX/AXIS_VARS tables. It never matched the census pattern (status registers aren't #1925/#578/etc), so it is
 * NOT one of the 33 lines and does not affect `actualBypasses`. Kept because it surfaced during the same
 * investigation and would otherwise be lost: the status-var check model these fields were built for was superseded
 * (probeSurface.js's own comment — a miss on V4.1/DM500 is caught by a pre-probe DRO compare, not a status var),
 * and `.status` was grep-confirmed unread in its own file's emit path everywhere it is declared. Dead, not wrong —
 * a cleanup candidate, not port work.
 */
export const V41_STATUS_FIELD_DEAD = {
    sites: ['cornerWizard.js:25', 'edgeWizard.js:19', 'middleWizard.js:29', 'probeBlocks.js:21'],
    verdict: 'declared, never read — a follow-up cleanup, not port work',
};

/**
 * ── THE EVIDENCE FLOOR — the `trigEvidence` tier precedent, applied to a controller instead of a function ────────
 *
 * The dispatch asked for V4.1's equivalent of the M350 dumps, or its absence NAMED LOUDLY. It is neither absent nor
 * merely equivalent: it is STRONGER than Expert's, because Expert's ground truth is a static dump while V4.1's
 * includes a LIVE BENCH UNIT with a proven readback channel. The catch is in `liveRoundtrip.blockedBy`.
 */
export const V41_EVIDENCE_TIERS = {
    factoryCorpus: {
        tier: 'factory-corpus', strength: 'strongest offline', automatable: 'NOW, zero hardware',
        what: '91 tracked .nc macros under bridge/controllers/v4.1 (system-backup/current = the live 2026-06-13 SMB '
            + 'capture of \\\\10.0.0.50\\SYSDISK; firmware/ = the shipped 2025-04-04 image)',
        settles: 'the emitted FORM of every idiom the factory itself demonstrates — probe move, probe read, machine '
            + 'move, WCS zero, IF/GOTO, dwell',
        wired: false,
        gap: 'ZERO specs read any FACTORY-SHIPPED .nc from this corpus as an oracle. (Two specs — trig-lift-plan-1466 '
            + '/ helical-arc-evidence-1472 — read .nc files, but only from expert-m350/verify/, Studio\'s OWN '
            + 'diagnostic macros pushed to hardware, a different corpus from the factory-shipped operational macros '
            + 'here.) This is the arc\'s primary gap and Stage 1 closes it',
    },
    settingsCorpus: {
        tier: 'settings-corpus', strength: 'strong offline', automatable: 'ALREADY WIRED',
        what: 'v4.1/assets/setting · .../ddcsv4/eng · system-backup/current/coord1',
        settles: 'the controller-import door (machine params, WCS table decode)',
        wired: true,
        note: 'the ONE place the corpus is already an oracle — tests/controller-import-one-door-1221.spec.js reads '
            + 'all three at runtime. It is the existence proof that Stage 1 is a known shape, not a new mechanism',
    },
    benchConfirmed: {
        tier: 'bench-confirmed', strength: 'behavioural, not formal', automatable: 'no — human-run, already done',
        what: 'bridge/controllers/v4.1/FINDINGS.md — a motorless spare V4.1 at 10.0.0.50, SMB read/write confirmed',
        settles: 'G04 P is MILLISECONDS [CONFIRMED] · uservar = 400 f64, slot = #var-100, #100-#499 · a running '
            + 'program flushes vars to uservar and they are readable over SMB even after an abnormal stop · '
            + 'error.nc does NOT fire on syntax errors or #3000 · #3000 is Expert-only · sysstart.nc is NOT V4.1',
    },
    liveRoundtrip: {
        tier: 'live-roundtrip', strength: 'STRONGEST — a real execution', automatable: 'MECHANISM PROVEN, not closed',
        what: 'emit -> push over SMB -> Start -> poll the uservar completion sentinel + numbered checkpoints. Proven '
            + 'in BOTH directions on the bench: a clean run reaches the sentinel (slot 103 = 9999), an errored run '
            + 'does not, and the highest checkpoint localises the death',
        settles: 'that emitted G-code actually RUNS on real V4.1 silicon — the thing no offline diff can settle',
        blockedBy: 'the one-time Start pulse. File-reload on re-Start is CONFIRMED (overwrite the selected file over '
            + 'SMB, press Start again, the controller re-reads from disk), so job-swap is solved — but the trigger '
            + 'is a physical External Start input that is [TO TEST] and unbuilt. Until then a HUMAN must press '
            + 'Start, which collides with the standing rule that a powered controller is READ-ONLY when the user is '
            + 'not at the machine. This tier is therefore NOT schedulable by an agent and must never be assumed',
    },
    unmapped: {
        tier: 'unmapped', strength: 'none — declared unknowns', automatable: 'no',
        what: 'the dialect names its own three — see V41_NAMED_UNKNOWNS for the full declared form (S4, t1534)',
    },
};

/**
 * ── S4 — THE NAMED UNKNOWNS (t1534) ─────────────────────────────────────────────────────────────────────────────
 * `readActiveWcs` / `hmiPrompt` / the ATC tables already fold to `[]` honestly today — this does not change that.
 * What changes: each is now a full declared row (the t1533 amendment's exact 5-field shape: what / todayBehaviour /
 * whyAbsent / liftNeeds / blocked), not three lines in a comment, so an operator reading the post's honesty surface
 * and a future act both find the SAME sentence. `tests/v41-caps-completeness-1534.spec.js` asserts each row
 * against the dialect's actual fold-to-[] behaviour, so a row cannot claim an unknown the code has since resolved.
 */
export const V41_NAMED_ABSENCES = {
    readActiveWcs: {
        what: 'reading which WCS is currently active on V4.1',
        todayBehaviour: 'folds to [] — an honest absence, not a guess. Any op needing "read active WCS" degrades to '
            + 'nothing rather than emitting a wrong read',
        whyAbsent: 'not a missing IMPLEMENTATION — a missing CONCEPT in V4.1\'s own firmware model. `vars.activeWcs: '
            + 'null` and `caps.wcsAuto/wcsFixed/wcsSync` are all false because V4.1 has no per-WCS-index register at '
            + 'all — it works ACTIVE-ONLY (#1506-1509 IS "the" work offset; there is no numbered G54..G59 table to '
            + 'have an active INDEX into)',
        liftNeeds: 'proof V4.1 has a per-WCS active-index register somewhere unexplored in its variable space',
        blocked: 'evidence-blocked — neither the tracked corpus nor FINDINGS.md\'s bench notes show such a register. '
            + 'Until found, there is nothing to read; this may simply not exist on this firmware',
    },
    hmiPrompt: {
        what: 'in-program, Studio-authored operator prompts (arbitrary blocking messages/confirmations)',
        todayBehaviour: 'folds to [] on V4.1 — and on DM500/grbl/rs274ngc/grblhal too; only Expert and centroid '
            + 'declare `hmi: true`',
        whyAbsent: 'THE MECHANISM IS ATTESTED, THE SURFACE IS NARROWER THAN IT LOOKS. probe-float.nc/probe-fix.nc/'
            + 'probe-vertex.nc all call `MarcoDialog "probe-float.rc"` — real, factory-proven. But reading the actual '
            + '.rc file (t1534 — probe-float.rc, tracked in the firmware corpus) shows it is COMPILED emWin '
            + 'GUI-Builder C SOURCE ("C-file generated by GUI_Builder for emWin version 5.12"), not a runtime-'
            + 'authorable payload. `MarcoDialog` can only INVOKE a pre-existing, pre-compiled dialog shipped with '
            + 'the firmware — it cannot construct one from a G-code-side string',
        liftNeeds: 'at most, Studio could emit `MarcoDialog "<existing-name>.rc"` to invoke ONE of the firmware\'s '
            + 'ALREADY-SHIPPED dialogs (if a generically-reusable one exists among them) — never an arbitrary '
            + 'operator message the way Expert\'s `hmi: true` implies. A full lift (custom prompt text) needs NEW '
            + 'FIRMWARE, outside Studio\'s reach as a G-code generator',
        blocked: 'evidence-blocked for anything beyond the capped case above — which of the firmware\'s existing '
            + '.rc dialogs, if any, is generic enough to reuse is unconfirmed',
    },
    atcTables: {
        what: 'tool-changer register addresses (tool-table offsets, tool-length compensation) on V4.1',
        todayBehaviour: '`vars.atc: null`, `caps.atc: false` — every ATC wizard degrades honestly on V4.1',
        whyAbsent: 'the #1300/#1330 range Expert uses for its ATC tables reads, in the V4.1 dump, as a generic '
            + '"system parameter area" — no ATC-specific structure visible at those addresses on THIS firmware image',
        liftNeeds: 'observing what registers a real V4.1 tool-change macro touches',
        blocked: 'evidence-blocked — the bench unit (FINDINGS.md) is motorless and toolless by design (the safe '
            + 'sandbox) and cannot demonstrate this. Needs either a V4.1 unit WITH an actual ATC attached, or a '
            + 'community-referenced macro from an owner who has one',
    },
};

/**
 * ⚠ THE INSTRUMENT GAP, STATED AS THE DEFECT CLASS IT IS.
 *
 * This is the same class the release-version desync and the stale verification PNG were: a claim that was TRUE when
 * written, with nothing in the suite that would notice it stopping being true. The V4.1 dialect says "CONFIRMED
 * against probe-float.nc" in a comment. If someone edits the probe form tomorrow, the comment still says CONFIRMED
 * and every one of the 54 v41 specs stays green, because they all compare Studio to Studio.
 */
export const V41_INSTRUMENT_GAP = {
    claim: 'the V4.1 dialect asserts live-confirmation against 9 named factory macros in prose',
    enforcement: 'none — 0 of the 91 tracked FACTORY-SHIPPED .nc files are read by any spec, for any target (the 2 '
        + 'specs that do read .nc read only Studio\'s own expert-m350/verify/ diagnostics, a different corpus)',
    consequence: 'the 54 v41 specs are all self-referential: they assert Studio against Studio. A dialect drift '
        + 'away from the factory form is invisible to the entire suite',
    whyItMatters: 'this is the only target family where a wrong emit reaches real silicon that moves an axis',
};

/**
 * ── THE SPACING DELTA (t1531 ruling 3: A+B) — a DECLARED row, not a regex nobody can find ─────────────────────────
 * The factory writes UNSPACED G-code; Studio emits SPACED (words.js's shared spacing policy, identical across every
 * post). The S1 oracle (below) NORMALISES this away so the FORM can be asserted without this open question blocking
 * it — but the normalisation is only honest if the thing it is hiding is written down where the next person looking
 * for "why does the oracle strip whitespace" finds it in one place, not buried in a comparison helper.
 */
export const V41_SPACING_DELTA = {
    id: 'v41-word-spacing',
    factory: 'UNSPACED — e.g. `G91G31Z-1000L#682Q1K0F#106` (probe-float.nc), `G0G53Z#102` (probe-fix.nc)',
    studio: 'SPACED — e.g. `G91 G31 Z-1000 L#682 Q1 K0 F#106`, `G0 G53 Z#102` (words.js\'s spacing policy, shared '
        + 'by every post, not a V4.1-specific choice)',
    oracleHandling: 'the S1 oracle strips all whitespace between tokens before comparing — STILL true after the '
        + 'answer below, because the factory corpus is unspaced regardless of whether spaced ALSO parses; '
        + 'normalisation is what makes the byte-for-byte comparison possible either way',
    status: 'ANSWERED (t1531 amendment, mid-flight) — V4.1 ACCEPTS SPACED G-code. Evidence tier: USER-ATTESTED (the '
        + 'operator who runs these controllers) — by the trigEvidence discipline, stronger than an assumption, '
        + 'weaker than a captured bench trace. NOT re-opened by a future act: Studio\'s spaced emit is CONFIRMED '
        + 'legal on V4.1, so no act in this arc needs to consider emitting unspaced for this target',
    settledBy: 'S5 (live-roundtrip) still gets this for FREE the day the live pulse happens (a spaced program either '
        + 'runs or it does not) — but it is a CONFIRMATION now, not a blocking question the arc waits on',
};

/**
 * ── S2 — THE NORMALISATION POLICY (t1534, t1533 amendment shape) ───────────────────────────────────────────────
 * The S1 oracle was already normalising (comment/blank-line stripping, then spacing) — but the LOGIC lived twice,
 * duplicated near-identically in two spec files, with no single place that said WHY each step is safe. An
 * undeclared normalisation is a comparison that can silently stop testing something, so this is the policy as
 * DATA — ONLY the normalisations `normaliseGcode()` (and therefore v41-corpus-oracle-1532.spec.js) actually
 * performs, verified against that function rather than invented. `tests/v41-caps-completeness-1534.spec.js`
 * asserts every entry here is one the oracle really applies, and that none has an empty `safeBecause`.
 */
export const V41_ORACLE_NORMALISATIONS = [
    {
        transform: 'strip-carriage-returns', why: 'the factory macros are CRLF, Studio emits LF — the comparison '
            + 'would fail on every line otherwise, for a reason unrelated to G-code content',
        safeBecause: 'a controller parses program TEXT; line-ending is a file-encoding artifact of whatever tool '
            + 'last wrote the file, not a token its G-code parser sees',
        evidenceTier: 'factory-corpus',   // every tracked V4.1 factory macro `file`-checks as CRLF (verified on zeroxy.nc, probe-fix.nc)
    },
    {
        transform: 'drop-blank-and-comment-lines', why: 'either side may add or omit a blank line or a `(`/`;` '
            + 'comment without changing what the controller executes — comparing them would fail the assertion for '
            + 'a reason that says nothing about correctness',
        safeBecause: 'G-code parsers ignore blank lines outright, and DDCS `(`/`;` comments carry no executable '
            + 'meaning by the language\'s own syntax — this is a property of the grammar, not a per-controller fact',
        evidenceTier: 'assumption',   // general G-code comment/blank-line convention — not specifically cited from a V4.1 manual section; named honestly rather than upgraded without a citation
    },
    {
        transform: 'collapse-whitespace', why: 'the factory writes every line unspaced; Studio emits spaced '
            + '(words.js\'s shared policy) — without this the oracle would fail on spacing alone, never reaching '
            + 'whether the WORDS and VALUES actually match',
        safeBecause: 'the user-attested fact that V4.1 accepts spaced G-code (V41_SPACING_DELTA) — proven in BOTH '
            + 'directions: the factory\'s unspaced form ran on real hardware to be captured, and Studio\'s spaced '
            + 'form has now been confirmed to run on real V4.1 hardware too. Two forms, both proven to execute',
        evidenceTier: 'user-attested',
    },
];

/**
 * What was CONSIDERED and REFUSED — not part of the required deliverable shape, kept alongside it so a future
 * reader finds the omission recorded as a decision, not rediscovers it as a gap. Both would be `evidenceTier:
 * assumption` if added, and t1533's own instruction is to name rather than silently add an unjustified one.
 */
export const V41_NORMALISATIONS_REFUSED = [
    {
        considered: 'case-folding — treating g31/G31 (and other lowercase G/M-words) as equivalent',
        why: 'NO EVIDENCE EITHER SIDE EVER VARIES: zero lowercase G/M-words across all 91 tracked V4.1 factory '
            + 'macros, and Studio never emits one (words.js has no case-folding at all). Normalising away a '
            + 'difference neither side has ever produced would bless an untested equivalence, not remove noise — '
            + 'exactly the actual-bypass shape this arc exists to avoid creating BY ACCIDENT, inside its own tool',
    },
    {
        considered: 'leading-zeros — treating Z-01000/Z-1000 as equivalent',
        why: 'NO EVIDENCE EITHER SIDE EVER VARIES: zero leading-zero numerics across the tracked corpus, and '
            + 'Studio never pads one (words.js has no padStart). Refused for the identical reason as case-folding, '
            + 'not merely because it happened not to be needed yet',
    },
];

/**
 * The ONE implementation of V41_ORACLE_NORMALISATIONS, in order. Both v41-corpus-oracle-1532.spec.js and
 * porting-arc-scout-1530.spec.js's PREMISE 5 import this rather than each declaring their own — the duplication
 * S2 was dispatched to close.
 */
export function normaliseGcode(text) {
    return text.replace(/\r/g, '').split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('(') && !l.startsWith(';'))
        .map((l) => l.replace(/\s+/g, ''))
        .join('\n');
}

/**
 * ── THE STAGES ──────────────────────────────────────────────────────────────────────────────────────────────────
 * Smallest independently-bridgeable steps first, each with a bridge that does not depend on the ones after it —
 * the SLOT_CAPABILITIES shape. `gate` is '' when nothing external blocks the step.
 *
 *   does     — what the stage builds
 *   stays    — what must NOT move (the larger half, and why each step is safe)
 *   bridge   — the equivalence the stage is PROVED by
 *   gate     — the external blocker, '' if none
 *   landed   — filled in by the build act; '' until then
 */
export const PORTING_STAGES = [
    {
        id: 'corpus-oracle', order: 1, label: 'S1 — make the factory corpus an ORACLE',
        does: 'a spec that reads the tracked factory macros at runtime and diffs them against what the V4.1 dialect '
            + 'emits — PLAIN readFileSync at the spec layer, the controller-import-one-door-1221 shape, not a new '
            + 'product-code registry (t1531 ruling: do not invent a second mechanism)',
        stays: 'every emit form, every wizard, every existing spec. This stage adds an assertion and changes NOTHING '
            + 'that runs — which is why it is first and why it is safe',
        bridge: 'DEMONSTRATED, not proposed: Studio\'s V4.1 wcsZeroAtCurrent reproduces zeroxy.nc/zeroz.nc byte-for-'
            + 'byte, and the WCS-selector passthrough is confirmed inert by construction, not by sampling',
        gate: '', landed: 't1532 — tests/v41-corpus-oracle-1532.spec.js. PILOT (WCS zero-at-current): zeroxy.nc + '
            + 'zeroz.nc byte-exact (normalised), zeroall.nc\'s 4th-axis gap asserted in BOTH directions. SECOND '
            + 'SUBJECT (corner, at reduced fidelity — named honestly): probeMove + probeTrigVar + machineMove '
            + 'byte-tested against probe-float.nc/probe-fix.nc; the WCS-write step is NOT byte-tested — corner '
            + 'writes its WCS offset from a RETRACTED position while probe-vertex.nc\'s G92 write fires AT the '
            + 'trigger point, so the two use different but equivalent formulas (Studio\'s position-independent '
            + '`[#dro-value]` vs the factory\'s precomputed sum) and are not expected to match byte-for-byte. '
            + 'Also landed: the residue census (V41_RESIDUE_CENSUS, 33 lines / 0 bypasses) and the spacing-delta '
            + 'row (V41_SPACING_DELTA) the oracle\'s normalisation implements',
    },
    {
        id: 'normalisation-policy', order: 2, label: 'S2 — declare what the differential is ALLOWED to normalise',
        does: 'an explicit, declared normalisation policy for the S1 diff — because the factory writes UNSPACED '
            + '(`G91G31Z-1000L#682Q1K0F#106`, `G0G53Z#102`) and Studio emits SPACED (`G31 Z-1000 L#682 Q1 K0 F#106`, '
            + '`G0 G53 Z#102`). Same words, same order, different lexis: words.js owns spacing, the dialect owns grammar',
        stays: 'words.js and its spacing policy. This stage does not change the emitted bytes — it decides what the '
            + 'ORACLE is entitled to ignore, and records why',
        bridge: 'the diff must pass on the 3 confirmed-identical forms (probe read, WCS zero, IF/GOTO) and must FAIL '
            + 'if a word is added, dropped, or reordered — proved by mutating each in the spec',
        gate: '', // CLOSED mid-flight (t1531 amendment): the user confirmed V4.1 accepts spaced G-code. See V41_SPACING_DELTA.
        landed: 't1534 — V41_ORACLE_NORMALISATIONS (the t1533 amendment\'s exact 4-field array shape: transform/why/'
            + 'safeBecause/evidenceTier) + V41_NORMALISATIONS_REFUSED (case-folding, leading-zeros — both unevidenced '
            + 'either direction in the tracked corpus, named rather than silently added or silently omitted). '
            + 'normaliseGcode() is now the ONE implementation, imported by both v41-corpus-oracle-1532 and '
            + 'porting-arc-scout-1530\'s PREMISE 5 — the duplicated inline copy that existed in each is gone',
    },
    {
        id: 'caps-completeness', order: 3, label: 'S3 — close the caps table so a new post cannot be silently undeclared',
        does: 'move the 3 caps that live OUTSIDE DEFAULT_CAPS into it (helicalArc, inputRead, atc), so every post '
            + 'gets an explicit declared default instead of undefined',
        stays: 'every current behaviour — see `latent`. This is a declaration completeness fix, not a bug fix',
        bridge: 'getCaps(id)[cap] is a boolean for all 7 posts x all 13 caps, and no post\'s effective behaviour moves',
        gate: '', landed: 't1534 — DEFAULT_CAPS in wizards/dialects/index.js gains inputRead/atc/helicalArc, all '
            + 'FALSE, flagged for ruling rather than silently resolved (a conflict between the t1533 amendment\'s '
            + 'literal instruction, inputRead:true/atc:true, and its own behaviour-neutrality acceptance test, '
            + 'which true would have failed — proved directly by tests/v41-caps-completeness-1534.spec.js\'s "had '
            + 'true been chosen" test). ⚠ RULED at t1535: FALSE STANDS — the advisor verified the counts '
            + 'independently and ratified false as the CORRECT DESIGN, not merely as what passes the test. '
            + 'Reasoning on record: DEFAULT_CAPS now holds two patterns — Expert-full-by-default for the original '
            + 'ten (Expert is the richest COMMON case, lesser posts opt OUT explicitly), safe-floor-by-default for '
            + 'a RARE/UNCERTAIN capability (an undeclared key means nobody has said, and nobody-has-said is not '
            + 'yes-it-has-it). No code change needed — the ruling ratifies what was already shipped',
        latent: '⚠ NOT A LIVE BUG, AND THE ARC SHOULD NOT PRETEND OTHERWISE. inputRead is declared by 1 post of 7 '
            + 'and atc by 3 of 7; the rest read back `undefined`. Every consumer truthy-tests (`!!caps.x`, '
            + '`d.caps && d.caps.inputRead`) and there is not one `=== false` comparison against a cap anywhere, so '
            + 'undefined behaves exactly as false TODAY. The cost is that postGating cannot distinguish "declared '
            + 'unsupported" from "never considered" — which is a declaration gap, and it bites the NEXT post, not this one',
    },
    {
        id: 'named-unknowns', order: 4, label: 'S4 — turn the dialect\'s 3 TO-CONFIRMs into declared rows',
        does: 'lift readActiveWcs / hmiPrompt / the ATC tables out of code comments into evidence rows carrying what '
            + 'would settle each, the trigEvidence `onYes`/`onNo` shape — so a machine visit has a WORK LIST',
        stays: 'the emit — all three already fold to [] honestly, which is the correct behaviour and stays correct',
        bridge: 'each row names the artefact that settles it; the spec asserts the row still matches the dialect\'s '
            + 'actual fold-to-[] behaviour, so a row cannot claim an unknown the code has since resolved',
        gate: '', landed: 't1534 — V41_NAMED_ABSENCES (the t1533 amendment\'s exact 5-field shape: what/'
            + 'todayBehaviour/whyAbsent/liftNeeds/blocked). The hmiPrompt row carries a real correction found while '
            + 'building it: probe-float.rc (tracked, read directly) is compiled emWin GUI-Builder C source, not a '
            + 'runtime-authorable payload — MarcoDialog can only invoke a PRE-EXISTING firmware dialog, never an '
            + 'arbitrary Studio-authored prompt. A narrower, capped lift than "confirm the syntax and ship it"',
    },
    {
        id: 'live-roundtrip', order: 5, label: 'S5 — close the loop on real silicon',
        does: 'emit -> SMB push -> Start -> uservar sentinel readback, as a per-target verify instrument',
        stays: 'everything. This tier only ever CONFIRMS what S1 already asserted offline',
        bridge: 'a Studio-emitted program reaches the sentinel on the bench unit and the checkpoints fire in order',
        gate: '⚠ HUMAN-PRESENCE GATED. Needs either a person at the bench to press Start, or the unbuilt External '
            + 'Start relay. Not schedulable by an agent, and it is LAST for exactly that reason: the four stages '
            + 'above must not be able to stall behind a machine visit (the C3-is-last discipline from the slot arc)',
        landed: 't1538 — THE GATE OPENED: the user has a V4.1 bench unit connected over SMB, no motors, nothing '
            + 'attached. bridge/controllers/v4.1/verify/ carries 6 no-motion probe macros (S5a-S5f) + README.md, '
            + 'mirroring expert-m350/verify/\'s exact shape (one risky form per file — a syntax error aborts the '
            + 'WHOLE file — self-closing single-line comments only, no nested parens or brackets, which every one '
            + 'of the 6 files got wrong on the FIRST draft and was caught by re-reading before commit, the same '
            + 'mistake Expert\'s own V13_trig.nc made and fixed at t1466). Register band: #190/#191 (ddcs-v41.js\'s '
            + 'own verified-free scratch), doubly grounded — outside the firmware\'s #0-148/#490-536 write range '
            + 'AND inside uservar\'s #100-499 SMB-readable range (FINDINGS.md). No on-screen popup mechanism is '
            + 'corpus-confirmed for V4.1 (grepped: zero -5000-style message sentinel anywhere in 91 tracked files) '
            + '— the README gives the uservar/SMB readback as the CONFIRMED path, the on-screen page as the '
            + 'expected-but-unconfirmed one. THE SIX PROBES, each argued from the corpus rather than assumed: (a) '
            + 'spaced multi-word parse — upgrades V41_SPACING_DELTA from user-attested to bench-confirmed-pending; '
            + '(b) an expression inside a coordinate word via G92, self-restoring by construction (reads the live '
            + 'work-Z, adds zero, writes it back — no second restore file needed); (c) IF/GOTO actually BRANCHES, '
            + 'not just parses — two separate exit paths so a wrong branch can\'t be masked by a shared fallthrough '
            + 'tail; (d) WHILE/DO/END — V4.1\'s OWN factory corpus (slib.nc, macroMillCylinder.nc, macroMillRect.nc) '
            + 'already uses this, so caps.flow:\'goto\' may be under-declaring, found by grepping rather than by '
            + 'assumption; (e)/(f) SQRT and ATAN alone, split per the one-risky-form-per-file rule, mirroring '
            + 'V13c/V13d exactly. THIS ACT SHIPS NO TIER OR CAP CHANGE — the bench results and the ruling on them '
            + 'are the advisor\'s, on whatever the operator reports back.'
            + '\n\n⚠ t1542 — RUN, ON REAL V4.1 SILICON (firmware 2025-04-04-012-NOR, no motors attached). See '
            + '`V41_S5_RUN_RESULTS` for the full measured set. Headline: caps.flow:\'goto\' CONFIRMED CORRECT for '
            + 'what Studio emits (user programs) — WHILE parses but never opens a loop at top level, closing the '
            + 'DM500 under-declaration theory this same finding had raised. Spacing CONFIRMED. SQRT '
            + 'HARDWARE-CONFIRMED. Two open questions remain, named not concluded: arctangent under an untried '
            + 'name (community asked), and whether WHILE works inside an M98/firmware-macro context specifically. '
            + '⚠⚠ THE MOST URGENT FINDING, NOT YET ACTIONED: ddcs-v41.js\'s ifGoto CURRENTLY EMITS THE UNSPACED '
            + 'FORM, and the unspaced form FREEZES REAL V4.1 HARDWARE — no error, no reset, power-cycle only. '
            + 'The spaced form works correctly. This is a defect in ALREADY-SHIPPED emit on the only other '
            + 'hardware-verified post besides Expert, not a new-capability question — flagged loudly, not fixed '
            + 'in this act (an emit change is its own act per the DM500 precedent at t1536)',
    },
];

/**
 * ── V41_S5_RUN_RESULTS (t1542) — THE FULL MEASURED SET FROM REAL V4.1 SILICON ──────────────────────────────────────
 * bench-kit results, firmware 2025-04-04-012-NOR, no motors/drives attached. The trig half (SQRT/ATAN) is ALSO
 * recorded in `data/trigEvidence.js`'s `V41_TRIG_EVIDENCE` (that file owns the trig-gate framing); this export is
 * the complete session, including the two findings that are not about trig at all.
 */
export const V41_S5_RUN_RESULTS = {
    firmware: '2025-04-04-012-NOR', bench: 'no motors, nothing attached', measuredAt: 't1542',
    results: [
        {
            id: 'spaced-parse', probe: 'S5a_spaced.nc', outcome: 'CONFIRMED',
            finding: 'spaced multi-word G-code PARSES. Studio\'s emit format is legal on this firmware. Upgrades '
                + 'V41_SPACING_DELTA from user-attested to BENCH-CONFIRMED',
        },
        {
            id: 'coordword-expr', probe: 'S5b_coordword.nc', outcome: 'ACCEPTED',
            finding: 'G92 Z[#1508+0] was accepted — the forum post lists it under "things that do work". The '
                + 'work-Z-unchanged self-check from the t1540 doc fix is what would confirm #1508 truly is work-Z; '
                + 'that specific confirmation is not separately itemised in the reported results',
        },
        {
            id: 'ifgoto-branches', probe: 'S5c_ifgoto.nc', outcome: 'CONFIRMED, WITH A SEVERE CAVEAT',
            finding: 'IF/GOTO WORKS and branches correctly — but ONLY WITH A SPACE AFTER "IF". "IF #191==0GOTO1" '
                + 'branches correctly; "IF#191==0GOTO1" (the form ddcs-v41.js\'s ifGoto CURRENTLY EMITS, and the '
                + 'form the original S5c_ifgoto.nc shipped with at t1538) FREEZES THE CONTROLLER — no error, no '
                + 'reset, power-cycle only. The advisor edited the tracked S5c_ifgoto.nc to the spaced form '
                + 'directly after this was found. THIS IS A DEFECT IN ALREADY-SHIPPED EMIT, not a new-capability '
                + 'question — see the urgent flag on PORTING_STAGES[\'live-roundtrip\'].landed',
        },
        {
            id: 'while-recognised-not-functional', probe: 'S5d_while.nc + S5h/S5j/S5l/S5m follow-ups',
            outcome: 'OPEN QUESTION, not a conclusion',
            finding: 'WHILE is RECOGNISED (the parser names it in its own error) but does NOT open a loop in a '
                + 'top-level user program: "The loop instruction WHILE is incomplete: L<n>[END1]" — the body runs '
                + 'ONCE then END1 reports nothing to close. Measured across FOUR variants (unspaced, space-after-'
                + 'WHILE, spaces-both-sides, and the factory\'s exact variable-vs-variable form) — all four fail '
                + 'identically. V4.1\'s OWN factory corpus (macroMillCylinder.nc) uses WHILE freely inside its own '
                + 'macros. UNTESTED EXPLANATION, named as a question not a fact: WHILE may only be valid inside an '
                + 'M98/firmware-macro subprogram context, not a plain top-level disk program',
            closes: 'the DM500 under-declaration theory (PORTING_FORKS did not carry this by name, but the S5d '
                + 'file\'s own comment raised it) — if WHILE cannot open at top level on V4.1\'s DDCS-family '
                + 'firmware either, DM500\'s caps.flow:\'goto\' likely is NOT under-declaring; both targets\' '
                + 'user-program flow model is probably genuinely goto-only, with WHILE reserved for firmware-owned '
                + 'macro contexts',
        },
        {
            id: 'increment-works', probe: 'S5i_increment.nc / S5k_incr_bare.nc', outcome: 'CONFIRMED',
            finding: 'the bare increment #a=#a+1 works, both bracketed and unbracketed forms. Ruled out as the '
                + 'cause of the WHILE finding above — the loop body\'s assignment executes correctly; the loop '
                + 'CONSTRUCT itself is what does not open at top level',
        },
        {
            id: 'sqrt-confirmed', probe: 'S5e_sqrt.nc', outcome: 'CONFIRMED',
            finding: 'SQRT[9]*100 returned exactly 300 — COMPUTED, not merely parsed. See trigEvidence.js '
                + 'V41_TRIG_EVIDENCE for the full framing',
        },
        {
            id: 'atan-absent-so-far', probe: 'S5f_atan.nc + S5g/S5_ATN/S5_ATAN2/S5_atan/S5_ACOS follow-ups',
            outcome: 'ABSENT-SO-FAR, not ABSENT',
            finding: 'six names tried (two-operand ATAN, single-operand ATAN, ATN, ATAN2, lowercase atan, ACOS as '
                + 'a control) — all REJECTED with Unrecognized-file-format naming the line. Every probe was '
                + 'structurally identical to the working SQRT line, so the FORM is proven correct and only the '
                + 'NAME or existence is at issue. A forum post is out to the community; COS/SIN remain untested. '
                + 'See trigEvidence.js V41_TRIG_EVIDENCE for the full framing',
        },
        {
            id: 'errors-name-the-line', probe: 'every probe that hit a syntax error', outcome: 'CONFIRMED, a controller fact',
            finding: 'every syntax-error outcome across the whole session named the specific line number — a '
                + 'genuinely good diagnostic surface on this target, worth recording independent of any single probe',
        },
        {
            id: 'machine-position-mirror', probe: 'observed during the session, not a dedicated file',
            outcome: 'CONFIRMED against the screen',
            finding: '#490/#491/#492 mirror the MACHINE coordinates — confirmed by comparing register reads '
                + 'against the controller screen\'s own Mach column. Not previously documented in ddcs-v41.js '
                + 'beyond the general "#490-536 is firmware-written" note',
        },
    ],
    openQuestions: [
        'arctangent under an untried name — community forum post is out, asking',
        'whether WHILE works inside an M98/firmware-macro subprogram context specifically (untested — the bench '
            + 'kit only probed top-level disk programs, by design, since a subprogram context needs more setup)',
    ],
    rulings: {
        capsFlowGoto: 'STAYS — CONFIRMED CORRECT for what Studio emits (user programs). No cap value changes',
        postVerified: 'UNCHANGED',
        dm500UnderDeclarationTheory: 'CLOSED by this evidence — see the while-recognised-not-functional result',
    },
};

/**
 * ── Q5 (t1529 AMENDMENT) — THE PARAMETRIC FLOOR PER CANDIDATE TARGET ───────────────────────────────────────────────
 * A cheap breadth pass, deliberately NOT V4.1-depth: one row per target, at whatever confidence the in-repo
 * evidence actually supports, tagged by tier. It exists because the ARC ORDER (which target after V4.1) is a
 * ruling this scout would otherwise make on an unstated assumption — that V3/DM500 is "close enough" to inherit
 * the parametric macros. Measured instead: it is CLOSE, not proven, and the gap is named rather than guessed shut.
 *
 * Columns = the parametric floor a raster/ramp/helix atom needs: in-program #variables, expressions inside a
 * coordinate word (`X[...]`), IF/GOTO or O-word flow, and trig (COS/SIN attested vs SQRT/ATAN — the exact split
 * `trigEvidence` already tracks for Expert, applied here to the OTHER targets for the first time).
 */
export const PARAMETRIC_FLOOR = [
    {
        target: 'ddcs-v41', evidenceTier: 'attested-dump',
        vars: true, exprInCoordWord: true, flow: 'goto (IF/GOTO+N, byte-identical shape to Expert)',
        trig: 'COS/SIN attested in 2 tracked factory macros (slib-g.nc); SQRT/ATAN used in ZERO tracked factory '
            + 'macros — community-referenced only (per dialect header + community/NOTES.md), same tier Expert\'s own '
            + 'SQRT/ATAN sit at in trigEvidence.js',
        freeRegisterBand: 'CONFIRMED narrow and specific: #190/#191 (missScratch + safeHop target), verified free by '
            + 'reading which bands the V4.1 firmware executable macros write (#0-148, #490-536)',
        verdict: 'PARAMETRIC — same verdict as Expert, same trig ceiling as Expert (COS/SIN yes, SQRT/ATAN unattested)',
    },
    {
        target: 'ddcs-v3-dm500', evidenceTier: 'attested-dump, THINNER than V4.1',
        vars: true, exprInCoordWord: 'UNMEASURED — not checked this pass',
        flow: 'goto (declared in the dialect module; only 18 tracked files total vs V4.1\'s 209, so the corpus '
            + 'backing that declaration is much thinner)',
        trig: 'COS/SIN found in 1 tracked factory macro (install/slib.nc — the same rotation-matrix idiom V4.1\'s '
            + 'slib-g.nc uses); SQRT/ATAN in ZERO tracked factory macros. The install/ tree (18 files: eng, setting, '
            + 'slib.nc, safez.nc, probe.nc, gotoz.nc, m30.nc...) reads as a PORT INSTALLER, not a full firmware/'
            + 'system-backup capture like V4.1 has — there is no dm500 equivalent of V4.1\'s system-backup/ SMB dump',
        freeRegisterBand: 'UNKNOWN — no bench unit, no live-var doc. dialect.js declares scratch [[17,17],[190,190]] '
            + 'but nothing in the tracked corpus confirms those are free rather than assumed-by-analogy-to-V4.1',
        verdict: 'LIKELY PARAMETRIC, UNMEASURED — the user\'s own question ("can V3 also use the parametric macros") '
            + 'has an honest answer of "probably, on the evidence so far, not proven". What would settle it: a real '
            + 'DM500 system-backup dump (the V4.1 SMB-capture recipe in FINDINGS.md is the recipe to repeat) or a '
            + 'community macro that demonstrates SQRT/ATAN/a free-register claim',
    },
    {
        target: 'grbl-class (grbl / grblHAL / rs274ngc / centroid)', evidenceTier: 'mixed, see per-post caps',
        vars: 'grbl: FALSE (caps.vars=false — no in-program #variables at all). grblHAL/rs274ngc/centroid: true',
        exprInCoordWord: 'not evaluated this pass',
        flow: 'grbl: none. grblHAL/rs274ngc: oword, and grblHAL is NOT flowStreamable (O-word flow is SD/littlefs-'
            + 'only — a real ceiling below Expert/V4.1, not just a different syntax). centroid: goto',
        trig: 'not evaluated this pass — moot for grbl (no vars to hold a result)',
        freeRegisterBand: 'not evaluated this pass',
        verdict: 'UNROLL, confirming the standing plan\'s existing classification rather than re-deriving it — grbl '
            + 'plain has no #variables at all (caps.vars=false is definitional, not a measurement gap), and even '
            + 'grblHAL\'s parametric flow cannot stream, which independently rules out the streamed-macro model this '
            + 'whole arc\'s parametric atoms assume',
    },
];

/**
 * ── THE PILOT ───────────────────────────────────────────────────────────────────────────────────────────────────
 * The corner-gated-pilot discipline: ONE op proven end-to-end before any fleet port. The nominee is argued from
 * the corpus, not from op importance.
 */
export const PORTING_PILOT = {
    nominee: 'WCS zero-at-current',
    why: [
        'IT IS THE ONLY OP WITH A BYTE-LEVEL FACTORY COUNTERPART ALREADY TRACKED. zeroxy.nc is literally two lines '
            + '(#1506=0 / #1507=0) and zeroz.nc is one (#1508=0). The oracle for this op is not a judgement call '
            + 'about equivalence — it is string equality against a file the controller shipped',
        'THE BRIDGE IS ALREADY GREEN, MEASURED AT SCOUT TIME. 2 of 3 factory zero macros match Studio\'s V4.1 emit '
            + 'exactly. A pilot whose instrument has already been run is a different risk from one that has not',
        'IT NEEDS NO MACHINE VISIT — it closes the instrument gap entirely offline, so the arc cannot stall',
        'IT EXERCISES THE CAPS HALF HARDEST. wcsAuto/wcsFixed/wcsSync are all TRUE on Expert and all FALSE on V4.1 '
            + '(no active-WCS var, no per-WCS index), so the same op proves the postGating path as well as the emit path',
        'ITS GOLDEN FIXTURE ALREADY EXISTS AND IS DIALECT-KEYED. tests/fixtures/wcs-golden.json has exactly one top '
            + 'key — "m350". Adding a "v41" key is the minimal natural extension of a shape already in the repo',
    ],
    rejected: {
        corner: 'the historical gated pilot and the richest op — but it has NO single factory counterpart to diff '
            + 'against, and its V4.1 path folds 5 forms and crosses wcsBase/probeGuard. Best SECOND, once S1 exists',
        edge: 'genuinely simple, and probe-float.nc/probe-fix.nc do attest its form — but the probe form is exactly '
            + 'where the S2 spacing question bites, so it inherits an unresolved gate. Best THIRD',
    },
};

/**
 * ⚠ WHAT THE PILOT DIFFERENTIAL FOUND ON ITS FIRST RUN — reported as what it IS, not inflated.
 *
 * zeroall.nc zeroes FOUR registers (#1506-#1509 = X/Y/Z/A). Studio's wcsZeroAtCurrent pushes X/Y/Z only — on BOTH
 * dialects, Expert and V4.1 alike. So this is a SCOPE difference, NOT a defect: Studio's WCS-zero op does not offer
 * a 4th-axis zero at all (the 4th axis appears only as the dual-gantry SLAVE, a different concept that writes the
 * slave DRO into the A offset). The instrument behaved correctly and the emit is not wrong.
 *
 * It is recorded because it is a fair PRODUCT question for a project that ships rotary ops: should a 4-axis machine
 * be able to zero A from the WCS wizard? That is a ruling, not a repair, and it belongs to the advisor.
 */
export const PILOT_FIRST_FINDING = {
    kind: 'scope-difference', isDefect: false,
    factory: 'zeroall.nc = #1506=0 #1507=0 #1508=0 #1509=0 (X/Y/Z/A)',
    studio: 'wcsZeroAtCurrent emits X/Y/Z only — identical limitation on ddcs-expert-m350 and ddcs-v41',
    question: 'should the WCS wizard offer a 4th-axis (A) zero on a rotary-equipped machine?',
    ruling: 't1531 (advisor) — RULED A+B: out of scope for THIS arc (confirmed not a V4.1-specific question — the '
        + 'gap is identical on Expert), AND a genuine BACKLOG item, declared here so a future act finds it rather '
        + 'than rediscovering it. Why real: a user running a 4th (rotary) axis has no WCS-wizard path to zero it — '
        + 'genuinely missing capability, not a curiosity. Scope for whoever picks it up: the WCS op\'s form would '
        + 'need an axisA checkbox alongside axisX/axisY/axisZ, and BOTH dialects\' wcsZeroAtCurrent already know '
        + 'how to emit it (#1509 / #86x-equivalent) — the gap is entirely in the FORM, not the emit',
};

/**
 * The forks parked for the advisor, and its t1531 rulings. Kept (not deleted) once ruled — the RECORD of a
 * decision is worth as much as the decision, especially where the advisor's own condition (arc-reframe) or
 * qualification (arc-order-after-v41's guard) shapes what the next act may assume.
 */
export const PORTING_FORKS = [
    {
        id: 'arc-reframe', question: 'The arc was dispatched as a PORT; measurement says the port is done and the '
            + 'INSTRUMENT is what is missing. Does the arc reframe to "make the evidence executable"?',
        options: 'A: reframe (S1-S4 offline, S5 when a human is at the bench) · B: hold the original framing and '
            + 'find port work S1 has not surfaced · C: reframe AND widen S1 to all 7 posts at once',
        recommend: 'A — B re-does finished work, and C multiplies a mechanism that has never once been run',
        ruling: 't1531 — A, RECORDED AS THE ARC\'S NEW NAME (owned by the advisor in ROADMAP/PORTING.md). ⚠ WITH A '
            + 'CONDITION: "the port is done" itself rested on a SAMPLE (~33 lines, judged by eye) — the arc\'s own '
            + 'thesis turned on its own premise. S1 must turn that into a CENSUS. Satisfied at t1532: '
            + 'V41_RESIDUE_CENSUS, all 33 lines classified, actualBypasses: 0',
    },
    {
        id: 'pilot-choice', question: 'WCS zero-at-current as pilot, against the standing corner-gated-pilot memory?',
        options: 'A: WCS zero (argued above) · B: corner, honouring the existing pilot discipline',
        recommend: 'A, with the tension named honestly: the corner-gated-pilot rule was written for the WIZARDS-AS-'
            + 'DATA port, which is COMPLETE. This is a different arc with a different bridge, and corner cannot be '
            + 'the pilot for an evidence instrument it has no evidence file for. Corner stays the pilot for op '
            + 'RICHNESS and should be S1\'s second subject',
        ruling: 't1531 — A, ratified explicitly: an evidence-instrument pilot must be an op that HAS evidence, and '
            + 'corner has no single-file factory counterpart. Corner is S1\'s SECOND subject, so op-richness still '
            + 'gets proven early. Landed at t1532: tests/v41-corpus-oracle-1532.spec.js',
    },
    {
        id: 'spacing', question: 'Does the V4.1 parser accept the SPACED form Studio emits? The factory corpus is '
            + 'uniformly unspaced. Offline-unsettleable',
        options: 'A: normalise spacing in the oracle and record it as an assumption · B: hold it as an S5 '
            + 'roundtrip question · C: human recollection from the 2026-06-13 session settles it now',
        recommend: 'A + B: normalise so S1 can land, and carry it as a named S5 row so the assumption is visible '
            + 'rather than dissolved into a regex',
        ruling: 't1531 — A+B, shape stated: the oracle compares NORMALISED (implemented, V41_SPACING_DELTA), the '
            + 'delta is a DECLARED named row (not a bare regex) carried into S5. ⚠ SUPERSEDED MID-FLIGHT (t1531 '
            + 'amendment, same turn): the advisor asked the user directly and got an answer — V4.1 ACCEPTS SPACED '
            + 'G-code, USER-ATTESTED tier. Option C effectively happened. C is no longer "unsettleable offline" — it '
            + 'landed. The oracle still normalises (the factory corpus stays unspaced regardless); the delta is now '
            + 'ANSWERED, not open. S5 keeps it as a free confirmation rather than a blocking question',
    },
    {
        id: 'a-axis-wcs', question: 'PILOT_FIRST_FINDING — should WCS zero offer a 4th-axis zero?',
        options: 'A: out of scope, record and move on · B: a real gap for rotary users, backlog it',
        recommend: 'A for this arc (it is not a V4.1 question — both dialects behave identically), B as a separate item',
        ruling: 't1531 — A for this arc AND B as a real backlog item, both at once. Declared on PILOT_FIRST_FINDING.ruling',
    },
    {
        id: 'arc-order-after-v41', question: 'PARAMETRIC_FLOOR (t1529 amendment) — V3/DM500 reads as LIKELY '
            + 'PARAMETRIC on the SAME evidence shape V4.1 was (COS/SIN attested, SQRT/ATAN not) but the corpus '
            + 'backing it is far thinner (18 tracked files vs V4.1\'s 209; an installer tree, not a firmware+SMB '
            + 'capture). Does DM500 follow V4.1 as stage 2 of the port arc, or does the arc pause to get a real dump first?',
        options: 'A: DM500 next, ACCEPTING the thinner evidence and applying the SAME S1-S4 offline stages to it '
            + '(the instrument itself would surface exactly where the analogy-to-V4.1 assumptions break) · '
            + 'B: pause DM500 and get an SMB dump first (repeat the V4.1 FINDINGS.md recipe against a DM500 unit, '
            + 'if one is reachable) before spending build time on it · C: skip DM500, go straight to grbl-class '
            + '(wrong — PARAMETRIC_FLOOR just showed DM500 is the closer target, not the farther one)',
        recommend: 'A — the S1 oracle mechanism this arc builds for V4.1 is exactly the tool that would turn "likely, '
            + 'unmeasured" into a measured verdict for DM500 at near-zero extra cost, so running it is more '
            + 'informative than waiting for a dump that may not come',
        ruling: 't1531 — A, DM500 follows V4.1 through the SAME S1-S4 stages. ⚠ WITH A GUARD: DM500\'s rows carry '
            + 'their evidence TIER on their face (already true — see PARAMETRIC_FLOOR), and DM500 does NOT enter '
            + 'POST_VERIFIED on offline agreement alone — that set is a promise to a user standing at a machine, and '
            + 'only hardware-grade evidence may extend it. DM500 STAGE 1 (measurement only) landed at t1536 — see '
            + 'DM500_ORACLE_FINDINGS. The guard held: no cap value changed, POST_VERIFIED untouched, no verdict '
            + 'declared. The advisor\'s own verdict on what the 8-file findings mean is still pending',
    },
];

/**
 * ── Q1: THE BRANCH PEEK — wizard-porting-work @76348158 ─────────────────────────────────────────────────────────
 * ⚠ THE NAME COLLIDES WITH THIS ARC AND MEANS SOMETHING ELSE. "wizard porting" there is the WIZARDS-AS-DATA port
 * (wizard -> {template,bindings} data twin), NOT porting to other controllers. It has no bearing on V4.1.
 */
export const V41_BRANCH_DISPOSITION = {
    tip: '76348158', dated: '2026-07-01', commits: 1, forkPoint: '9bc0a7c0', behindMain: 1261,
    contains: '89 files — the wizards-as-data conversion mid-flight, plus 6 design docs',
    superseded: 'CONCLUSIVELY, and asserted against the branch\'s OWN map rather than a sample: every one of the 11 '
        + 'wizards WIZARD-PORTING-MAP.md lists as "not ported" (pocket, contour, edge, middle, alignment, rotary '
        + 'clock, rotary center, ATC length/check/change/test) now has a data twin on main. cornerPort.js was '
        + 'superseded by cornerData.js. main carries 37 dataOps modules',
    uniqueContent: 'only the 6 design docs (WIZARD-PORTING-MAP · SPATIAL-MODEL-SPEC · TRAVEL-START-SPEC · '
        + 'TWO-WCS-DATUM-SPEC · HOMING-ATC-BACKLOG · MIDDLE-PROBE-BACKLOG) and 2 code files. The docs are turn-46-to-'
        + '148 designs whose conclusions now live as project memories (the TRAVEL-START flip became marker-derived '
        + 'traverse targets; TWO-WCS became the machine-frame sim spec + probes-never-read-wcs)',
    mineForDesign: 'homingOrderSvg.js + homingOrderField.js — an SVG/Blockly homing-ORDER picker. main solved order '
        + 'differently (a Homing Setup modal over settings-derived per-axis order), so the code is superseded, but a '
        + 'visual order picker is live UX worth a look under the prefer-GUI-over-fields principle',
    recommend: 'ARCHIVE-TAG (e.g. archive/wizard-porting-work-76348158), then delete the branch. Nothing to cherry-'
        + 'pick: it would drag 1261 commits of divergence to recover docs that are historically superseded. The tag '
        + 'keeps them reachable forever at zero cost',
    alsoNote: 'the branch carries committed .proc/turn.json + 6 .claude/worktrees/ entries — the split-brain '
        + 'artefacts the handoff protocol later learned to refuse. Another reason not to merge it anywhere',
};

/**
 * ── DM500 STAGE 1 — MEASUREMENT ONLY (t1536, advisor's ruling 5 with a guard) ───────────────────────────────────
 * The S1 oracle mechanism built for V4.1, run against the DM500 factory corpus — exactly the S1 approach applied
 * to a SECOND, much thinner target. THE CORPUS IS EXACTLY 8 FILES (bridge/controllers/dm500/install/) — compare:
 * V4.1 has 91, Expert has 335. The thinness is a FINDING, not an obstacle, per the arc's own framing.
 *
 * ⚠ NO VERDICT LIVES HERE. This measures and reports; it does NOT rule on DM500's evidence tier, does NOT touch
 * POST_VERIFIED, does NOT change any DM500 cap value, and does NOT declare the port verified or unverified — that
 * ruling belongs to the advisor once this reports back. `tests/dm500-corpus-oracle-1536.spec.js` re-runs every
 * claim below against the real corpus and the real dialect, using the SAME `normaliseGcode` S1 already built (no
 * second normaliser).
 */
export const DM500_ORACLE_FINDINGS = [
    {
        file: 'defprobe.nc',
        demonstrates: 'a multi-axis edge/plate-thickness probe: probeMove (M101/G91 G01/M102), IF/GOTO flow with '
            + 'LT comparisons, N-labels, bare GOTO, and MULTIPLE G92 work-offset writes',
        studioEmits: 'differs',
        detail: 'probeMove, ifGoto, goto, and label are ALL byte-exact after normalisation (verified directly: '
            + 'dialect.ifGoto(\'#2004\',\'<\',\'0\',1) produces the identical normalised text to the factory\'s '
            + '`IF #2004LT0 GOTO1`). But the G92 lines differ structurally: the factory writes a PRECOMPUTED SUM at '
            + 'the moment of contact (`G90 G92 Z#2003`, `G90 G92 X#2000/2+#2001`, plain arithmetic, no DRO '
            + 'reference), while Studio\'s setWorkOffset emits the POSITION-INDEPENDENT `[#dro-value]` form '
            + '(verified: `G90G92Z[#866-#2003]` vs the factory\'s `G90G92Z#2003`) — the exact same class of '
            + 'difference as the V4.1 corner-vs-probe-vertex finding at t1532, not a new problem',
        confidence: 'structural',
    },
    {
        file: 'gotoz.nc',
        demonstrates: 'a bare subroutine call, `M98 P100`, invoking O100 (defined in slib.nc: pick a per-tool-slot '
            + 'Z-clearance register via #516, then move there in the work frame)',
        studioEmits: 'no-equivalent',
        detail: 'Studio has NO primitive that emits a bare M98 subroutine call, on any dialect — confirmed by '
            + 'reading the full dialect module (no such method) and grepping wizards/ + blocks/ for M98 emission. '
            + 'Studio\'s own machineMove/safeRetract compute their target inline rather than delegating to '
            + 'firmware-resident O100 — a different, self-contained approach to the same GOAL (a safe Z move), '
            + 'not a gap in what Studio can DO',
        confidence: 'structural',
    },
    {
        file: 'm30.nc',
        demonstrates: 'nothing — the file is EMPTY (0 bytes), an unused override hook',
        studioEmits: 'no-equivalent',
        detail: 'Studio emits a literal `M30` for endProgram() on every dialect, matching the dialect module\'s own '
            + 'existing comment ("m30.nc empty -> controller default"). An empty file carries zero evidence either '
            + 'way about what the controller does when the hook IS populated — there is nothing here to byte-diff',
        confidence: 'unverifiable-from-corpus',
    },
    {
        file: 'null.nc',
        demonstrates: 'nothing — the file is EMPTY (0 bytes); purpose unconfirmed beyond "an unused hook"',
        studioEmits: 'no-equivalent',
        detail: 'no content, no idiom, nothing to compare Studio\'s emit against. Unlike m30.nc there is no existing '
            + 'dialect comment explaining its purpose — named as a genuine unknown rather than guessed',
        confidence: 'unverifiable-from-corpus',
    },
    {
        file: 'pause.nc',
        demonstrates: 'the PAUSE-button hook: one line, `G91G0Z#589` — an incremental rapid Z lift by a configured '
            + 'pause-height register',
        studioEmits: 'no-equivalent',
        detail: 'Studio has no op that emits a firmware pause-hook macro — Studio generates PROGRAM content the '
            + 'controller executes, it does not author firmware customization files like pause.nc. Matches the '
            + 'dialect\'s own existing hmiPrompt comment ("pause hook = a Z-lift only"), which already read this '
            + 'exact file when it was written',
        confidence: 'structural',
    },
    {
        file: 'probe.nc',
        demonstrates: 'the Z-touch auto-datum macro: G04 P0 dwell, M5 spindle-off, reading #864/#865/#866 into '
            + 'scratch vars, an IF/GOTO mode check, the M101/G91 G01/M102 probe move, then writing a #402/#403/#404 '
            + '"auto-datum" register triplet followed by a controlled-feed Z move',
        studioEmits: 'differs',
        detail: 'dwell(0), spindleOff(), readMachine (all 3 axes), the probe-move triplet, and the IF/GOTO form '
            + 'are ALL byte-exact after normalisation (verified directly against `#20=#864` / `IF#571EQ0GOTO1` / '
            + '`M101 G91G01Z-100F100 M102`). The #402/#403/#404 auto-datum-flag sequence and the trailing '
            + '`G91G01Z#575F#578` have NO Studio equivalent at all — Studio\'s setWorkOffset always emits a direct '
            + 'G92, never writes to this flag triplet. The dialect\'s own existing comment already scoped this out '
            + '("a DIFFERENT, probed flow... NOT part of this no-probe zero-at-current") — confirmed correct, not '
            + 'newly discovered',
        confidence: 'structural',
    },
    {
        file: 'safez.nc',
        demonstrates: 'a bare subroutine call, `M98 P101`, invoking O101 (slib.nc\'s "safez" sub — same per-tool-'
            + 'slot Z-clearance selection as O100/gotoz.nc, a near-identical twin)',
        studioEmits: 'no-equivalent',
        detail: 'identical finding to gotoz.nc — no M98 primitive anywhere in Studio; safeRetract computes its own '
            + 'target rather than calling this subroutine. The dialect\'s own comment already names M98 P101 as '
            + 'the dump\'s safe-Z form and flags direct G53 as "TO CONFIRM" rather than dump-grounded',
        confidence: 'structural',
    },
    {
        file: 'slib.nc',
        demonstrates: 'DM500\'s canned-cycle + subroutine library: fixed drill cycles (G81/G82/G83/G73 as O9081/'
            + 'O9082/O9083/O9073), bolt-hole/facing/pocket cycles (O9102/O9103/O9110/O9111/O9112), a machine-limit '
            + 'homing routine (G28 as O9028), AND — the structurally significant part — WHILE/DO/END loop flow, '
            + 'used throughout the drill cycles',
        studioEmits: 'no-equivalent',
        detail: 'Studio never emits an M98 call into any of these O-numbers (confirmed: wizards/ops/holecycle.js '
            + 'has zero references to M98, O9xxx, or dm500 — Studio\'s own drill/hole-cycle emit is a self-'
            + 'contained inline computation, entirely separate from this library). More significant than the '
            + 'unused canned cycles: the dialect DECLARES `caps.flow: \'goto\'` — it has no WHILE/DO/END construct '
            + 'at all, so Studio could not reproduce one of these cycles byte-for-byte even if it wanted to. This '
            + 'is a genuine capability ceiling, not merely an unused library — named here should a future act ever '
            + 'consider calling into DM500\'s own canned cycles rather than computing inline.'
            + '\n\n⚠ t1542 UPDATE — SIBLING HARDWARE EVIDENCE FROM V4.1, NOT DM500 ITSELF: the V4.1 bench kit '
            + 'measured that WHILE is recognised but does NOT open a loop in a top-level user program on that '
            + 'firmware (V41_S5_RUN_RESULTS), even though V4.1\'s OWN factory macros use WHILE freely — the exact '
            + 'same shape as this DM500 finding (factory slib.nc uses WHILE; caps.flow declares goto-only). This '
            + 'CLOSES the "caps.flow may be under-declaring" reading of this row for DM500 too: the likelier '
            + 'explanation, on a sibling DDCS-family firmware, is that WHILE is genuinely reserved for firmware-'
            + 'owned macro contexts on user disk programs, and `caps.flow: \'goto\'` is CORRECT, not a gap. Sibling '
            + 'evidence only — DM500 itself remains unmeasured on hardware; this is the same-family INFERENCE the '
            + 'advisor\'s t1542 ruling drew for V4.1\'s own caps.flow, extended here by analogy, not by new measurement',
        confidence: 'structural',
    },
];

/** The one thing this arc does NOT touch, restated so it cannot be folded in by accident. */
export const PORTING_ARC_NOT_INCLUDED = {
    what: 'the grbl-class targets (grbl / grblHAL / rs274ngc / centroid / Mach3-4)',
    why: 'the standing plan puts them AFTER V4.1 and says they land by UNROLLING (no in-program flow on grbl: '
        + 'caps.vars=false, caps.flow=\'none\'). They also have no owned hardware and no factory corpus, so the '
        + 'evidence instrument this arc builds does not even apply to them yet. Collapsing the two kinds is what '
        + 'V41_EVIDENCE_TIERS exists to prevent',
};
