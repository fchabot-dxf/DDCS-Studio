# ADVISOR TRANSFER — for the fresh advisor on a new workstation

Written 2026-08-08 by the outgoing advisor. You are taking over the ADVISOR role of the two-session
advisor/worker loop on DDCS Studio. Read this, then `~/.claude/skills/advisor/SKILL.md`, then take the
wheel. Delete this file once you are oriented (it is a snapshot, not a living doc — WORK-LOG and
NEXT-SESSION are the living record).

## 1 · Bootstrap on this machine

- The loop's state (`HANDOFF.md`, `.handoff/`, the epoch file) is **per-machine and untracked** — it did
  NOT travel. Run `python ~/.claude/skills/multi-agent-handoff/handoff.py init` from the repo root,
  register with `proc_health.py register --role advisor`, and treat turn numbering as restarted.
- **SEAT EPOCH** (in both skills since 2026-08-08): each time the human starts a FRESH worker session,
  bump the integer in `.handoff/epoch` (create at 1) and carry "epoch N" in that first pass note. Stale
  worker seats stand down mechanically. Same-seat re-passes: no bump. This exists because leftover
  worker sessions raced the live seat three times in one day.
- Waiters: `handoff.py wait --role advisor` as a background task, ONE armed at a time — check before
  arming another. Passes are your LAST action of a turn; `amend` (not re-pass) once the worker is past
  settle. No backticks in `--note` (the shell eats words).

## 2 · Where the project stands

**Main = V2026.08.08.4** (five releases in two days). Shipped, in order: the silent-substitution defect
family closed end-to-end and HARDWARE-CONFIRMED (emit-verbatim; the V4.1 rejects malformed input at its
own line; execution is PARTIAL — lines before a fault DO run, which is why the pre-flight badge and the
ask-first send gate are load-bearing) · fork parity (all 32 twins fork byte-identically; guards render;
`forkInheritance` fails closed) · the Wizard-View face + param_group rows, live both ways · THE TRAIN
(string-enum codec, Surfacing Z-mode consumed from the twin's declaration, SHARED_LABELS, the passes
stepper + `derived`/`writes` sockets on formfield) · the Save dialog reads the stack's declarations ·
the WIZARD MANAGER (fork/rename/duplicate/delete, `.wizard` export/import via granted-FSA + Drive
shelves) · palette by role + the geras dark-path elbow fix · Open-as-modal (real chrome, one derivation,
persists nothing) · the four SHAPE PRIMITIVES (rect/circle/line/hole, expression-capable fields) ·
COMPARISON PREDICATES (the evaluator's declared scope is now COMPLETE: params, arithmetic,
min/max/abs/round/ceil, ternary, six comparators yielding 1/0 as values; guards own control flow).

**The branch** `wizards-as-data-blocks` is the working line; release = push `HEAD:main` + the bump
ritual (below). At transfer, the branch may carry t1630 (comparisons, commit 79d1bbb0) and t1632's
result unreleased — check `git log origin/main..HEAD`.

**IN FLIGHT at transfer: t1632** — the named-tail triage (the 5 deterministic emit-shaped reds:
cam-slot-edit-s3:65, drill-as-data:13, drill-bindings-1385:116/:180, roundtrip-1319:96; classification
standard = t1587's stale-spec vs real-break, with the anti-"fix a spec into agreeing with broken
behaviour" rule). It was running on the OLD workstation. If its commits + WORK-LOG entry are present:
review from the git diff and continue. If not: its work stayed on the old machine — re-dispatch the same
task from WORK-LOG's account, or wait for the old machine to push.

## 3 · The queue (dispatch one act per turn, review each from the DIFF)

1. Whatever t1632 leaves: real breaks it reported get rulings/acts.
2. Corner's 3 `simstart` placeholders (separate unwired type in renderUiTree, correctly refused today).
3. Materialize derived rows on the tree face (passes has no param_field row; lands via the orphan net).
4. Shape-field typo lint hook (t1566's lint discipline reaching shapes — today a typo skips silently).
5. The drawer tree-face 2D pane (no renderLayout2D caller — shapes show in the modal, not the drawer).
6. WM + Wizard-Manager Escape quirk pair · `flattenBlocks` transient `_group` side-effect (app-wide,
   named) · groupBox's dead mouths field · Drive trash/sign-in/no-FSA fallback (manager's not-covered).
7. Defects queue: preflight-badge-838:124 ("green program sends") FAILS ON MAIN — production, undiagnosed
   · enum/bool/string emit sweep (fork parity sweeps numerics only) · controller tokens through
   Set/bounds (w = #500 should emit X#500 — a never-worked workflow) · ifgoto lhs/rhs unlinted (needs a
   declared "expression-bearing but string-defaulted" discriminator) · an IF's CHILDREN are never linted
   (walk skips cond) · hidden-atoms P2.5 decision (clearlift/safehop/safetraverse pinned undraggable —
   Corner/Middle not hand-rebuildable) · waitForFunction(options-as-arg) grep · CAM pendant labels via
   camField.

**Await the HUMAN (do not act without them):** the elbow/bevel tradeoff verdict (screenshots sent —
alternative = renderer-constants subclass) · widening SHARED_LABELS to toolDia/stepoverPct · the
Corner-wall UX verdict (1852 blocks, ~7.7s Customize — collapse/group/accept) · bench probes: S6h
(literal /0, on the V4.1 share, would give the gate's deliberate /0-pass its hardware) and the Expert
V17a/b/c set (the Expert is documented whole-file-parse, so it may NOT execute partially — tunes the
send gate's severity). Bench mechanics: files → `\\10.0.0.50\cncdisk`; results read over SMB at
`\\10.0.0.50\sysdisk\uservar` (slot×8 bytes, float64 LE — #190=offset 720); evidence photos live beside
the probes in `bridge/controllers/v4.1/verify/`.

## 4 · How to read a gate (the part that keeps you honest)

- `cd DDCS-Studio && npx playwright test` (full, ~18 min) — verdict from
  `test-results/.last-run.json` (`status` + failedTests count), NEVER a piped exit code and never the
  tail. **Copy `.last-run.json` aside immediately** — isolated runs overwrite it (lost a baseline twice
  that way).
- **The ID diff is the signal, not the total.** Standing floor ~20 ±3. Churn members (all repeatedly
  proven isolate-green): middle-superset:35, import-safety-1219 (:47/:62), op-params-complete:65:3,
  wizard-face-1599, blocks-rotary-rig:14, open-as-modal (modal-boot class), homing pairs, blocks-live-form.
  The 1 node red (surfacing-as-data) is a standing member, HEAD-reproduced. A mass-red with few timeouts
  = suite self-contention: sample isolated, report both numbers.
- **Serialize suites**: never run your gate while the worker runs specs. Two concurrent Playwright runs
  manufacture mass reds.
- Release ritual: gate → isolate any new IDs → `git push origin HEAD:main` → `cd DDCS-Studio && node
  scripts/bump-version.cjs` (writes THREE files) → commit + push → `gh run list` to see CI actually run.
  Restore `DDCS-Studio/verification/` PNGs before pushing (suite runs regenerate them; that dirt is not
  intent). Also push the branch itself so other machines can pull.

## 5 · The review standards that made this week work

1. Review from the git diff, never the summary; run the relevant check yourself.
2. Demand "what this verification does NOT cover" every act — those gaps became half the queue.
3. Two specs per feature: "is it right" AND "does it run" — the first cannot see the second's failure.
4. Run it, don't read it. Messages/comments rot with behaviour; DELETE a message with nothing true left.
5. Named goldens; non-vacuity proven per claim (the scratch-worktree rig on port 3213 is the mechanism);
   anti-drift = specs read expectations from the imported declaration, never a copy.
6. Declare-or-hand-roll gate before every dispatch; the declaration is the fix more often than the patch.
7. Stop-at-a-gate is a valid act result. Workers who report their own wrong turns are the trustworthy ones.
8. ONE task per turn. Poll amendments at part boundaries. Release at verified milestones — proactively.

## 6 · The human's standing context

Visual thinker — lead with a diagram/screenshot for anything spatial or forked. Surface genuine forks
with a recommendation instead of deciding UI questions unilaterally (no-unasked-affordances). Their
verify gate: defect reports are collected input; no "pass" until their explicit go. They run three
workstations through git (hence this file). Current mandate: keep looping the wizards-as-data queue —
the RULED feature set is complete; what remains is polish + the defect tail + anything new they rule.
