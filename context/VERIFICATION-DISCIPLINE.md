# VERIFICATION DISCIPLINE — what "green" and "verified" actually have to mean here

⭐ **Same reason the other `context/` files exist**: written to a LOCAL memory first, invisible across
seats and machines. This file is specifically about the gap between a passing check and a fact being
TRUE — the recurring shape of failure in this project is a green test that asserts the wrong thing.

Migrated 2026-09-02 (t2519) from 86 local `feedback`-type memories; full triage record in `WORK-LOG.md`'s
own t2519 entry.

---

## 1. ⭐⭐ A green test can assert the wrong thing — verify the REAL symptom, not a proxy for it

The anchor rule everything else in this file specializes. Three real instances, same shape: a Playwright test
passed while the user's actual reported symptom was still broken, because the test asserted something ADJACENT
to the symptom rather than the symptom itself. (a) "I/O regression fixed" — the passing test checked view
restore after toggling I/O; the real symptom was a blank pane in one layout the test never exercised. (b) 3D
animation tests were all green — they asserted the animation METHOD fired, never that the result was VISIBLE
on screen (occlusion, off-frame, too faint, camera angle — none of that is headlessly assertable; only human
eyes or a screenshot diff can confirm a 3D-visual claim). (c) A canvas-drag handle "can't exit the stock" bug
was "fixed" by unclamping the underlying PARAM and asserting the param's new value — the param was never the
problem; the real walls were in the canvas interaction itself (a snap-to-corner rule, a frozen viewBox during
drag), invisible to a value-only assertion. **How to apply:** before claiming a user-reported bug is fixed,
reproduce the EXACT symptom (right viewport, real rendered output — not element visibility/display flags). If
a fix-test passes but the report says it's still broken, the test is checking the wrong property — re-derive
the real failure with a diagnostic that dumps real state/coordinates rather than guessing again. For any
3D/visual claim specifically: a method-fired assertion is necessary but never sufficient; require a human-eyes
check or a screenshot diff.

## 2. Assert the CORRECT VALUE, never merely that something changed

The specific, recurring shape a "verify the real symptom" test still gets wrong: checking that a change
HAPPENED (a literal exists, a marker is finite, a golden matches the code's own output) rather than that the
RESULT IS CORRECT. Caught three times in one port: a golden REWRITTEN to match a degenerate emit (so
"golden == output" passed while a reposition had collapsed to a no-op move); a sim-starts test asserting
markers are finite and distinct while one was mapped to the wrong probe pass entirely (rendered inside the
stock); a drag test asserting "some numeric literal replaced the expression" while the written value was an
absolute coordinate landed in an incremental (G91) socket — geometrically wrong, syntactically fine. A fourth
shape is subtler: a cross-view parity check (two independently-rendered panels agreeing with each other) can
pass even when BOTH are wrong, once the two panels share one underlying source — post-consolidation, they
agree BY CONSTRUCTION, so a value wrong in the shared source is wrong in both views and a cross-panel assert
can never catch it. **How to apply:** pin every test against an INDEPENDENT truth — a hand-verified golden,
the real engine's own math, a geometrically derived expected value — never against the code's own output or
another view fed by the same source. Drag to a KNOWN point and assert the socket equals the EXPECTED number;
use distinct/known inputs so a swap or an off-by-one is caught. "It changed," "it's finite," "it matches
itself" is not a pass.

## 3. A test that boots a DEFAULT machine config proves nothing about a user's real config

This project's Playwright specs boot with hardcoded default settings (e.g. homing tested at `machine.z =
-120`), and the agent cannot see a user's own saved localStorage/settings. Config-dependent logic (home
direction, envelope sign, WCS, units — anything that branches on a value the test fixes to one default) can be
green at the default while the user's OTHER value is exactly the bug; the default often happens to be the safe
case, which is precisely why the test stays green while nothing about the user's machine is exercised. Treat
"the test passed" as worthless for a symptom someone is actively watching happen — it tested a machine that
isn't theirs. For any config-dependent bug, verify across the AXIS of the config, not one default (both signs
of a value, asserting the SAME physical outcome either way — sign-agnostic-by-construction beats a green
default). The deeper fix is usually a missing DECLARATION rather than a better test: once a value that used to
be guessed from another signal (e.g. deriving home direction from a travel sign) is instead read from an
explicit declared source, the test's own default stops mattering at all.

## 4. Before escalating "X regressed" to a blocker, confirm X is actually required to keep working

A "regression" is only a blocker if the thing it broke is meant to keep working. Spent several messages
designing a protective revert for a wizard's own broken emit before the actual product direction turned out to
be REPLACE, not coexist — the built-in being "broken" was irrelevant the moment it was confirmed to be a
transitional path being retired, not an invariant. Before treating any "X regressed" as urgent: ask the one
premise question first — is X being kept, or replaced? If replaced, it's migration, not regression; focus on
the replacement's own correctness rather than a fix to protect what's being retired. Direction is a product
call, not something to assume. Still surface the finding, calibrated to the real premise, and hold it loosely
— if the premise gets challenged, question the assumption rather than defending the original frame. Separately:
a rewritten golden that blesses CHANGED output is still a real behavior change worth scrutinizing on its own
merits, even once it's confirmed not to be a regression — a green suite adapted to new output gives false calm
about whether the new output is actually right.

## 5. Before dispatching a "drop/remove/change X," pin exactly which artifact X names

A UI label is not the same fact as the underlying field's role. "Drop the reach [thing]" was read as "drop the
`dist` FORM FIELD" because the canvas happened to label that field "reach" — but the actual referent was a
separate visual ARROW meant to be replaced by a different handle; the field itself (labeled the same word) was
a needed safety value (max probe distance) that got made read-only by mistake and shipped that way. Before
dispatching any "drop/remove/change X": pin whether X is a visual/handle/arrow, an editable field, or both —
don't assume a shared label means the same artifact. If X could plausibly be a needed or safety value (a max
distance, a clearance, a search limit), confirm before removing it or changing its editability; a field's
removal or edit is destructive and deserves the same "confirm the target" care as an actual delete.

## 6. When dispatching a safety guard, specify the real HAZARD — not a convenient over-broad proxy

A guard's own spec was wrong in the same direction twice in one session, both times caught only by the
worker's own measurement, not by re-reading the spec. Once: a gate specified as "body deep-equals the fresh
instantiate" could NEVER fire (a live round-trip fills an absent socket with the block default; a fresh
instantiate carries an empty children array the live record omits) — it would have silently disabled the
whole feature it was meant to protect. Once: a scratch-var collision guard specified as "fail when a field var
lands in the union of every band in play" over-blocked a legitimate case, because the real hazard was WITHIN
one part only (a part's own field var colliding with its OWN generator's writes during that same part) —
cross-part overlap is harmless since parts run sequentially and each generator re-reads at its own start. An
over-approximating guard is not free — it silently disables a working feature, and "it's only a safety check"
is exactly the reasoning that hides that cost. When dispatching a guard: describe the failure MECHANISM and
its consequence, then explicitly ask the builder to measure the real boundary and narrow — "if my rule
over-fires, tell me it's wrong rather than implementing it as specified" — and verify the narrowed boundary
against the real artifact (the actual emitted output, not an assumption) before accepting it.

## 7. Every review looks at the WHOLE wizard surface like a user would, not just the dispatched acceptance criteria

Acceptance asserts and byte-identity proofs are not a review of the wizard. Every placement/shape dropdown on
several twins (drill/bore/pocket/surfacing) shipped completely EMPTY — zero options — through many "verified"
releases, because every review drove specific dispatched properties (a handle drags, an emit matches
byte-for-byte) and screenshotted only the 2D pane; nobody rendered the FORM and actually looked at it. This
class of breakage (empty selects, dead always-visible fields, unlabeled rows) is invisible to acceptance
asserts and blindingly obvious to one human glance. Every pass-back review includes a whole-surface eyeball of
each touched wizard — open it, screenshot form and panels, actually look at the images. Fix what that eyeball
finds autonomously rather than treating it as separately-scoped follow-up work.

## 8. Don't stack features on a core interaction path that has not been runtime-verified

Added a transport layer, a status bar, a whole tab system, and a linter to a new surface — each verified only
by the build succeeding (`tsc`/`esbuild` exit 0) — while the surface's own INSERT button was completely dead
the entire time (the handler it needed was simply never defined, so every click threw and did nothing). A
passing build only proves the code compiles and bundles, never that the core interaction works. For any
UI/interaction work that can't be runtime-verified directly (e.g. a host that can only really be exercised in
an environment the agent can't launch): verify the critical path FIRST — enumerate every inline handler the
markup calls and confirm each maps to something actually defined, trace the full action-to-effect chain
end to end, and get the core flow explicitly confirmed working before adding anything on top of it.

## 9. A controller register's NAME existing in a config dump does not mean it's actually usable as a macro source

Grepping the controller dumps for a plausible-sounding register name (a config parameter literally called
"Z-axis safe height") and confirming it exists is not the same fact as that register being real, consistent,
macro-usable data. A feature built on exactly that assumption turned out wrong on four separate counts once
actually checked against the macros themselves: the register was never macro-referenced at all (macros used a
different, local variable); it meant a DIFFERENT thing on a different controller profile; the emitted frame
the feature assumed was wrong; and the feature contradicted an already-settled, deliberate decision elsewhere
in the codebase. Before building any "source this field from the controller's own variable" feature: verify
USAGE by grepping the macro dumps for the register actually being referenced in a move or expression (a hit in
a config/eng file is not a hit in a macro), check per-profile consistency (the same numbered register can mean
different things across controller variants), and check whether an existing file has already made a deliberate
decision to keep the value on this app's own side.

## 10. A ported twin's own DEFAULTS must mirror the built-in's FORM default, not an internal fallback constant

When porting a built-in wizard to a parallel data-driven twin, the twin's own default-value table has to match
the value the built-in's FORM actually shows on open — not the unrelated internal `num(value, FALLBACK)`
fallback buried in the original builder function. A twin once opened with a probe distance of 20 (the
builder's own internal fallback) when the real built-in form opened with 100 — the twin's probe then fired
short of the wall and immediately retracted, reading as a totally different bug until the mismatched default
was found. If a default is ever intentionally changed, it has to move in every coupled place at once (the
builder's own fallback, the twin's default table, the form field, any read-fallback in a view) or byte-identity
between built-in and twin breaks silently the moment no scalar override is passed.

## 11. Every new op/atom gets wired into Blockly for a real round trip — never left one-editor-only

A new wizard op or primitive atom is not done when it works in one editor. It has to surface as a real block in
the canvas stack, emit correctly from that block, AND reverse-sync (an edit on the block flowing back into the
wizard form) — the wizard and the Blocks view are two windows on the SAME underlying atom stack, and a feature
that only works in one of them breaks that contract. Per new atom: define it and register it in the palette,
give it a real Blockly block shape (a C-block mouth or plain fields as appropriate), add it to the emit fold,
add whatever reconciler makes a block-side edit flow back into the form, and add a round-trip spec alongside
the existing ones that already prove this pattern.

## 12. Decomposing a wizard into block atoms is a judgment call the owner wants to weigh in on

How granular an operation's own atom decomposition should be (does depth-stepping live inside a fill atom or
as a separate wrapper; is a whole preset one composed atom or three) is a genuine design fork with real
tradeoffs (fewer/simpler blocks vs. more granular/composable/visible ones), not a mechanical extraction with
one obviously-right answer. When a decomposition has a real granularity fork, present the options with their
tradeoff and ask before building, rather than deciding silently.

## 13. New Blockly blocks: pick a coherent, category-consistent, legible color — and keep TYPE and SECTION separate

Each existing block category (Move, Toolpaths, Transforms, Spindle & Feed, Coordinates, Program, Probing,
Control, Math, Variables, Signals, Wizard-family categories, Mark Up) has its own established palette color; a
new block should fit that scheme deliberately, not use a Blockly default, and a new block FAMILY should share
one coherent color. Settled explicitly: the default scheme is ONE color per block, keyed to its TYPE/category
— a block's SECTION (which mouth it lives in — Presentation, Execution, a pendant-field mouth) is conveyed by
its CONTAINER, never a second color on the block itself. Whatever gets built for section/mouth visualization
must not muddy or override a block's own accurate type-color.

## 14. A defect where one NAME silently means two different things fails with no error — hunt one layer above the symptom

The tell is that nothing throws, nothing looks wrong at the point where the bug is finally noticed — two
different code paths (or two different people, two different turns) each use the same identifier believing it
means the one thing they intend, and the collision is invisible until the two meanings' consequences actually
diverge. When a defect has this shape, the fix is not at the symptom site — it's one layer up, at whichever
declaration lets the same name mean two things. And when the fix has two halves (rename one meaning, guard
the other), verify each half SEPARATELY — a test that only exercises the combined, post-fix state can pass
even if one half silently didn't take effect.

## 15. Expert-only test evidence is evidence about the MINORITY install base

V4.1/V3-DM500 machines likely outnumber Expert/M350 installs among actual users, yet every spec in this suite
boots the Expert profile by default (a config choice, not a market signal). So a green suite is direct evidence
about the Expert config specifically — extending that confidence to "the app works" without at least spot-
checking the V4.1 profile is extrapolating from the smaller population. A V4.1-only defect is an escalation,
not a footnote, precisely because it is more likely to be what most users actually hit.

## 16. A test that builds its state programmatically (`ddcsLoadBlockStack`, hand-JSON) can be green while the feature it claims to guard is entirely UNREACHABLE through the real UI

This is a more dangerous shape than rule 1's "a green test asserts the wrong property" — here the test is
asserting a TRUE property, correctly, about state that a real user's gesture never actually produces. A spec
claiming to guard a user-reachable feature is not evidence of that unless its own fixture drives the real path
in — `openWiz`/`insertWiz`/`showApp`/an actual mouse gesture — not just a pure function or emitter, which
programmatic state-construction IS legitimate evidence for. Before trusting a green spec as proof a feature
works for a real user, check which kind of evidence it actually is.

## 17. Migrating an op onto a NEW render path can silently drop a general, cross-op invariant that only the OLD
path ever provided — and a full-suite "0 failed" is not proof it didn't, because the invariant's own test can
sit unnoticed-red for turns if nobody is specifically watching its title

`wcsData.js`'s move onto `renderUiTree` (t2605) shipped with `group_box` defaulting its fold-chrome to
unconditionally ON — the classic `renderOpForm`'s own threshold rule ("a form sectionizes only past
`SECTION_THRESHOLD` rows AND ≥2 sections — a short form stays plain") had no equivalent in the new render path
at all. `form-section-collapse-820.spec.js` (a GENERAL invariant test, not this op's own row-diff/canvas-mount
pair) caught it immediately and failed, deterministically, for FOUR consecutive turns — but nobody was looking
at that specific title, so four straight "full suite, 0 failed"-style summaries reported past it (t2609/t2611
root-caused why: `retries:2` cannot mask a deterministic failure, so this was never about retries — the
reported number simply didn't reflect what the run produced). A per-op row-diff test structurally CANNOT catch
this class of gap: it only proves the migrated op's OWN fields land in the OWN declared tree, never that some
general, classic-renderer-only behavior (a threshold, an ordering rule, a fold-state default, a container-id
convention) survived the move onto the new path for every op it now also has to cover.
**How to apply, before calling ANY op's migration to `renderUiTree` verified:**
1. Run the FULL suite via `npm test` (the real gate — `scripts/test-all.cjs`, never a bare `npx playwright test
   --reporter=list`, which silently skips the unconditional JSON summary this whole rule depends on being
   trustworthy) and read the FAILED **titles**, not just the count — the count alone is what let this sit for
   four turns.
2. Separately, grep the op's own new ids/`opType`/container-id strings across the WHOLE `tests/` directory, not
   just its own dedicated spec files — a shared cross-op test (like `interpass-connector-1235.spec.js`, which
   bridges a classic op and a tree-mode one in one file) can reference the op by an id or opType that its own
   migration author never thought to search for, because it isn't the op's own test.
3. When a migration touches a NODE TYPE (`group_box`, `feature_canvas`, a new one entirely) rather than just an
   op's own bindings, ask explicitly: does the CLASSIC renderer do anything conditional/derived here (a
   threshold, a default sourced from total form shape, a cross-field rule) that this node type's own isolated,
   per-node logic has no way to see? If yes, that is exactly this class of gap — extract the decision as ONE
   shared, exported function both paths call (see `sectionizeFor` in `formWidgets.js`), never reimplement it
   locally for the new path — a second copy is how it drifts again.

## 18. ⭐ A grep-based census is a FLOOR, never a count — treat every number it produces as "at least N," and
never as the sole gate for a "verified clean" claim

Corner's own `_tree`-suffixed-id census (BACKLOG #71/#72's own migration arc) moved FOUR times across three
turns — 44 (t2597, a first order-of-magnitude estimate) → a recount → 130 files found (t2631) → and even that
130-file grep STILL missed 3 files entirely (t2631/t2635), because `openWizardViaBar`'s own short `optype:
'corner'` call form is a textually DIFFERENT surface than the `cornerData|user_corner_data|CORNER_DATA_OPTYPE`
pattern every earlier census searched for — no refinement of that SAME grep would ever have found them; only
running the actual `npm test` full suite did. That is not "the count changed because reality changed" — it is
"the count changed because the search was incomplete each time," and an instrument whose own error bars are
unknowable in advance cannot license a completeness claim, no matter how many times it is re-run.

**Why this is structural, not carelessness:** a grep pattern is a guess at every TEXTUAL surface form a
reference to something might take — a full import path, a short alias, an indirect reference through a shared
helper that itself takes an opType parameter, a runtime-constructed string. There is no way to enumerate that
set completely by inspection; only the interpreter itself actually exercises the real reference graph.
Contrast `twin-section-invariant-2381.spec.js`'s own census, which is NOT grep-based — it calls `listUserOps()`
and classifies each REGISTERED twin by its own live `hasTreeLayout()` state at test-run time. That is
trustworthy by construction: it asks the running system what is actually true, rather than guessing what text
might be present in a file. A grep census over source text and a runtime census over live state are not the
same INSTRUMENT wearing different clothes — one is a guess, the other a measurement.

**How to apply:** a grep census is a cheap way to shrink the search space and explain why the suite went red —
never the gate that proves something clean. Any claim of the shape "N files reference X, all N fixed, therefore
done" should instead read "N files matched this grep, all N fixed; the full suite is what says whether that was
actually all of them." Rule 17 above already says to grep as PART of verifying a migration (its own step 2) —
this rule is the refinement: that grep step narrows and explains, the full-suite run (step 1, read by FAILED
TITLE, not count) is what actually closes the claim. Prefer a RUNTIME census (queries live registered state,
like `twin-section-invariant-2381.spec.js`'s own `hasTreeLayout()` check) over a TEXT census wherever the two
are both available for the same question — the runtime one cannot have this specific blind spot.

## 19. ⭐ THE SCALING-BUDGET FAMILY — a fixed timing constant that was fine uncontended becomes a real,
reproducible flake under the full suite's actual worker contention; three members now, recognize the fourth
on sight

Three independent instances, same underlying shape: a test's own timing budget (a Playwright test timeout, a
settle sleep) was sized against how long its work takes ALONE, and the full suite's real parallel-worker
contention (not a hypothetical — the actual 4-worker run this repo gates on) can genuinely push real,
honestly-necessary work past that budget. None of these were logic bugs; all three were fixed by giving the
test more real room, not by making the work faster or "fixing a race" in the product.
1. **`form-kernel-720.spec.js`'s own (e) test (t2621)** — an open/close loop over all ~32 registered twins,
   inheriting Playwright's default 60s test timeout. Fine uncontended; timed out under real contention once
   the per-op work grew heavier. Fixed with `test.setTimeout(Math.max(90_000, ops.length * 6000))` — a
   budget SCALED to the actual loop size, not a bigger magic number guessed once.
2. **`field-help-798.spec.js` (t2625)**, the SAME class caught by a full-suite run surfacing a NEW failure a
   migration had introduced (see rule 17's own account) — an all-registered-op loop with no scaling budget at
   all, timing out at the identical ~14m mark across two full runs. Fixed with the identical
   `test.setTimeout(Math.max(90_000, ops.length * 6000))` pattern, not a novel one.
3. **`preview-mutation-manifest-2463.spec.js`'s `sf-pos-snapback` (t2667)** — no all-ops loop this time (no
   natural `ops.length` to scale against), but the SAME shape in a different dimension: each manifest entry
   does two full boot+drag cycles in one test, real work that occasionally exceeded the default 60s test
   timeout under genuine scheduling contention — caught only by re-running the FULL suite a second time after
   an earlier, real-but-insufficient fix (a settle-wait race in `dragHandleRenderTruth.js`) had already landed
   and passed in isolation. Fixed with a flat `test.setTimeout(120_000)` (no count to scale against, so a
   generous fixed ceiling instead).

**How to apply, once you recognize this shape (a test that is fine alone but flakes specifically under the
full suite, with a timeout or a just-short-of-threshold numeric miss as the symptom):**
1. **Don't accept "flake, re-ran clean" as the fix.** An isolated green after touching the test proves the
   change didn't break it standing alone — it does NOT prove the change addressed contention, which by
   definition only shows up under the full suite's real parallel load. Re-run the FULL suite (not just the
   one file) before calling a contention-class fix verified — instance 3 above was caught exactly this way:
   the first fix passed 9/9 in isolation and STILL failed on the next full run, with a different symptom.
2. **Size the budget to the real variable, when one exists** — `ops.length`/entry count/whatever the test's
   own work scales with — rather than a bigger constant picked once. When no such variable exists (a single
   test doing a fixed amount of real, interactive work, like instance 3), a generous FIXED ceiling
   (2-3x the default) is the right shape instead — there is nothing to scale against.
3. **Never shrink the work to fit the clock** — the fix is room, not speed. These are honest tests doing
   honest work; the failure is a mismatch between the budget and real contention, not the test being slow.
