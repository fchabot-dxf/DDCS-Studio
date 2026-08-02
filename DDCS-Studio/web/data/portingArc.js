/**
 * data/portingArc.js — THE V4.1 PORTING ARC, DESIGNED AS DATA (t1530 scout — no product code).
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────────────────────
 * The standing plan opens the porting arc with "port the emit corpus to other controllers, DDCS V4.1 FIRST, with
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
    emitResidue: 'the emit path is genuinely dialect-routed. Expert-literal registers (#578/#805+/#1925/#880/#883) '
        + 'survive on ~33 non-comment lines across 16 files, and the sampled ones are NOT bypasses: they are '
        + 'Expert-specific SEMANTICS passed through to the dialect (#578 = the active-WCS selector value) or '
        + 'explicitly gated absences (#883, the dual-gantry slave DRO, which carries its own "no equivalent on this '
        + 'controller" comment). Named so a future act does not re-litigate them as debt',
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
        what: 'the dialect names its own three: readActiveWcs (TO CONFIRM) · hmiPrompt (MarcoDialog "*.rc", #1505 '
            + 'unconfirmed) · the #1300/#1330 ATC tables (vars.atc = null, "generic system parameter area" in the dump)',
        note: 'probe-float.nc/probe-fix.nc DO show `MarcoDialog "probe-float.rc"`, so the HMI MECHANISM is attested '
            + 'even though its scripting surface is not. That is a narrower unknown than "HMI unknown"',
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
        does: 'a declared table of (factory .nc file -> the dialect form it attests) plus a spec that reads the '
            + 'tracked macros at runtime and diffs them against what the V4.1 dialect emits. The settings door '
            + 'already does exactly this with setting/eng/coord1 — the mechanism is proven, only the macro half is missing',
        stays: 'every emit form, every wizard, every existing spec. This stage adds an assertion and changes NOTHING '
            + 'that runs — which is why it is first and why it is safe',
        bridge: 'ALREADY DEMONSTRATED at scout time, offline: Studio\'s V4.1 wcsZeroAtCurrent reproduces zeroxy.nc '
            + '(#1506=0/#1507=0) and zeroz.nc (#1508=0) byte-for-byte after comment/whitespace normalisation. The '
            + 'instrument is not speculative — it was run, and it works',
        gate: '', landed: '',
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
        gate: '⚠ A REAL QUESTION, NOT A FORMALITY: nobody has confirmed the V4.1 PARSER accepts the spaced form. '
            + 'The dialect header says CONFIRMED live, but the factory corpus only ever shows unspaced. If spacing '
            + 'is normalised away silently, the oracle would bless a form the controller may never have been shown. '
            + 'This is a live-roundtrip question (tier 4) or a human recollection — it is NOT settleable offline',
        landed: '',
    },
    {
        id: 'caps-completeness', order: 3, label: 'S3 — close the caps table so a new post cannot be silently undeclared',
        does: 'move the 3 caps that live OUTSIDE DEFAULT_CAPS into it (helicalArc, inputRead, atc), so every post '
            + 'gets an explicit declared default instead of undefined',
        stays: 'every current behaviour — see `latent`. This is a declaration completeness fix, not a bug fix',
        bridge: 'getCaps(id)[cap] is a boolean for all 7 posts x all 13 caps, and no post\'s effective behaviour moves',
        gate: '', landed: '',
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
        gate: '', landed: '',
    },
    {
        id: 'live-roundtrip', order: 5, label: 'S5 — close the loop on real silicon',
        does: 'emit -> SMB push -> Start -> uservar sentinel readback, as a per-target verify instrument',
        stays: 'everything. This tier only ever CONFIRMS what S1 already asserted offline',
        bridge: 'a Studio-emitted program reaches the sentinel on the bench unit and the checkpoints fire in order',
        gate: '⚠ HUMAN-PRESENCE GATED. Needs either a person at the bench to press Start, or the unbuilt External '
            + 'Start relay. Not schedulable by an agent, and it is LAST for exactly that reason: the four stages '
            + 'above must not be able to stall behind a machine visit (the C3-is-last discipline from the slot arc)',
        landed: '',
    },
];

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
};

/** The rulings that come back to the advisor rather than being decided in the build. */
export const PORTING_FORKS = [
    {
        id: 'arc-reframe', question: 'The arc was dispatched as a PORT; measurement says the port is done and the '
            + 'INSTRUMENT is what is missing. Does the arc reframe to "make the evidence executable"?',
        options: 'A: reframe (S1-S4 offline, S5 when a human is at the bench) · B: hold the original framing and '
            + 'find port work S1 has not surfaced · C: reframe AND widen S1 to all 7 posts at once',
        recommend: 'A — B re-does finished work, and C multiplies a mechanism that has never once been run',
    },
    {
        id: 'pilot-choice', question: 'WCS zero-at-current as pilot, against the standing corner-gated-pilot memory?',
        options: 'A: WCS zero (argued above) · B: corner, honouring the existing pilot discipline',
        recommend: 'A, with the tension named honestly: the corner-gated-pilot rule was written for the WIZARDS-AS-'
            + 'DATA port, which is COMPLETE. This is a different arc with a different bridge, and corner cannot be '
            + 'the pilot for an evidence instrument it has no evidence file for. Corner stays the pilot for op '
            + 'RICHNESS and should be S1\'s second subject',
    },
    {
        id: 'spacing', question: 'Does the V4.1 parser accept the SPACED form Studio emits? The factory corpus is '
            + 'uniformly unspaced. Offline-unsettleable',
        options: 'A: normalise spacing in the oracle and record it as an assumption · B: hold it as an S5 '
            + 'roundtrip question · C: human recollection from the 2026-06-13 session settles it now',
        recommend: 'A + B: normalise so S1 can land, and carry it as a named S5 row so the assumption is visible '
            + 'rather than dissolved into a regex',
    },
    {
        id: 'a-axis-wcs', question: 'PILOT_FIRST_FINDING — should WCS zero offer a 4th-axis zero?',
        options: 'A: out of scope, record and move on · B: a real gap for rotary users, backlog it',
        recommend: 'A for this arc (it is not a V4.1 question — both dialects behave identically), B as a separate item',
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

/** The one thing this arc does NOT touch, restated so it cannot be folded in by accident. */
export const PORTING_ARC_NOT_INCLUDED = {
    what: 'the grbl-class targets (grbl / grblHAL / rs274ngc / centroid / Mach3-4)',
    why: 'the standing plan puts them AFTER V4.1 and says they land by UNROLLING (no in-program flow on grbl: '
        + 'caps.vars=false, caps.flow=\'none\'). They also have no owned hardware and no factory corpus, so the '
        + 'evidence instrument this arc builds does not even apply to them yet. Collapsing the two kinds is what '
        + 'V41_EVIDENCE_TIERS exists to prevent',
};
