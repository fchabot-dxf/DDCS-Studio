# HANDOFF ← FAIRY (returning work to the RENDERRANCHY seat)

**The return channel.** `HANDOFF-TO-FAIRY.md` sends work to the gateway machine; this is how it comes back.

⚠ **Why a file and not a message:** the two machines share a repo but **not** a loop. `.handoff/` and its
epoch are per-machine, so there is no turn marker connecting them and no notification when one side finishes.
**The branch is the only channel.** A finding that exists only in Fairy's session transcript does not exist.

---

## 0. ⛔ GIT DISCIPLINE — two machines, one repo

- **`git pull --rebase` before you commit.** RENDERRANCHY commits frequently, sometimes several times an
  hour, and it releases from `main`.
- ⛔ **Never force-push.** A second agent also works in this repo. A force-push over someone's work is the one
  mistake here that cannot be undone by pulling.
- ⛔ **No `git stash`.** The stash stack is GLOBAL and shared — there are already orphaned entries on it from
  two different seats. Use `git checkout <ref> -- <paths>` or a scratch clone to compare against another
  revision.
- **Stay in your own files.** Gateway work lives under `bridge/`. If a change genuinely needs an app-side
  file (`DDCS-Studio/web/…`), say so in §2 below rather than making it — the RENDERRANCHY seat is usually mid-turn on
  those and a surprise edit lands as a conflict in someone's release.

---

## 1. ⭐ WHAT RENDERRANCHY IS ACTUALLY WAITING FOR

⭐⭐ **ANSWERED 2026-08-25 — see [`controllers/COMMENT-CHARACTERS.md`](controllers/COMMENT-CHARACTERS.md).** Derived from the vendor corpora with provenance kept separate, method stated so the vetting is checkable, and the per-dialect question answered honestly (Expert `[CONFIRMED]`; V4.1 and DM500 too thin, `[HYPOTHESIS]`; grbl not answerable from dumps).
⭐ **The headline is that the governing constraint is NESTING, not the character set** — zero nested comments in 2,248 vendor comments across three DDCS controllers and 4,656 LinuxCNC comments; every nesting instance in this repo is in a file we wrote. That half already shipped at `917f8856`, so the replacement setting is a smaller feature than it was scoped as.

~~**This one is BLOCKING**~~ — the original ask, kept for the record:

> **The safe comment-character list, derived from the real dumps.** RENDERRANCHY is adding a setting that replaces an
> illegal character in a G-code comment, with a user-chosen replacement. The candidate list must come from
> characters that DEMONSTRABLY appear inside comments in working factory programs — not from reasoning, and not
> from the advisor, who explicitly ruled himself out as a source.
>
> - `(` and `)` are structurally illegal (they delimit). `%` and `/` are risky at line start. That is the
>   extent of what was known without the machine.
> - ⚠ Square brackets are POOR candidates and this is already established: DDCS uses `[ ]` for EXPRESSIONS and
>   nests them (`#70=[805+[#72*5]]`), so a note reading `see fixture [B]` would look like a computed address to
>   whoever is reading the file at the controller. Legal but misleading is its own kind of unsafe.
> - **Report the list WITH its evidence** — which characters, seen where, in which dumps. A vetted list whose
>   vetting nobody can check is a longer guess.
> - ⚠ **And say whether it differs per dialect.** Expert, V4.1, V3/DM500, centroid and grbl are not one machine,
>   and grbl ignores parenthesised comments entirely.

**Also useful, not blocking:** whether the bracket-for-expressions / parens-for-comments split holds on the
other controllers, and anything the real machine says that contradicts a RENDERRANCHY assumption. **The standing
rule is that the dumps outrank the wizard code**, because code encodes what somebody believed and dumps encode
what the machine accepted.

---

## 2. WHAT TO WRITE WHEN HANDING BACK

Keep it short. Four headings, and the third is the one that gets skipped and shouldn't be:

1. **BUILT** — what shipped, with commit hashes. Anything that changes the gateway's behaviour toward a client
   belongs here, because RENDERRANCHY renders that behaviour.
2. **MEASURED** — facts established from the real hardware, with how they were established. These are worth
   more than the builds: the RENDERRANCHY seat cannot produce them at all.
3. ⚠ **WHAT I GOT WRONG, OR COULD NOT VERIFY** — premises that turned out false, and anything left unproven and
   named as such. On RENDERRANCHY this section has repeatedly been the most valuable part of a hand-back;
   four advisor premises were wrong in one session and every one was caught this way.
4. **STILL OPEN** — with a runnable check where possible, so the next reader can decide it in one command
   instead of re-deriving it.

⛔ **Do not report a green test as proof for anything hardware-shaped.** This project has twice closed a bug by
adding a regression test that passed while the owner was still looking at the defect. On Fairy that risk is
worse, not better: a test that passes on a bench is not a test that passes on a machine with a tool in the
spindle.

---

## 3. IF YOU CHANGED SOMETHING RENDERRANCHY RENDERS

The client draws the gateway's state — status, transport, job list, the disk index. If any of those payloads
change shape:

- **Say the OLD shape and the NEW one.** The client has to keep reading a gateway that has not been updated
  yet, and both ends ship independently.
- ⚠ **The heartbeat already carries `backend`**, and the client is supposed to use it to say *which road* a
  gateway is on. If you change what that field can contain, the client's wording depends on it.
- ⚠ **A job's origin is being added to `<job_id>.map.json`** per TRANSPORT.md §4. If the client should read it,
  say so — otherwise it will not know it exists.

---

# ⭐ HAND-BACK FROM FAIRY — 2026-08-25

Written to §2's four headings. Everything below was read off the **real Expert**, powered and idle, with the
owner at the pendant. **Read-only throughout: no writes to the controller, no G-code run, no axis moved.**

## 1. BUILT
Nothing. This was a probing session by the owner's own direction (*"dev work dont need to be you, i just want
you to do controller talking tests and probing"*). No gateway behaviour changed, so **nothing RENDERRANCHY
renders has moved** — §3 does not apply.

Documents added: `controllers/COMMENT-CHARACTERS.md`, `FAIRY-MEMORY-DUMP.md`,
`controllers/expert-m350/bench/sysdisk-baseline-2026-08-25.json`, and §8–§11 of the Expert `FINDINGS.md`.

## 2. MEASURED

**a. The blocking comment-character question is answered** → `controllers/COMMENT-CHARACTERS.md`.
The governing constraint is **NESTING, not the character set**: zero nested comments in 2,248 vendor comments
across three DDCS controllers and 4,656 LinuxCNC comments; every nesting instance in this repo is in a file we
wrote. That half already shipped at `917f8856`. Safe replacements, ranked by vendor evidence: `-` `.` `:` `=`
`!` `,`. ⛔ Not `[` `]` or `#` — attested but they read as expressions and variables at the controller.
⚠ `%` is context-dependent: it is a **live printf specifier inside a `#1505=` message** (36 of 335 vendor
uses) and a literal everywhere else. Per-dialect: Expert `[CONFIRMED]`, V4.1/DM500 too thin `[HYPOTHESIS]`,
grbl not answerable from dumps.

**b. ⭐⭐ The address systems unify — `macro #N → setting[N−500] → eng entry #(N−500)`.**
Three live anchors: `#578`→`setting[78]`= *"Current coordinate"*; `#805`→`setting[305]`= the panel's G54 X;
`#1430`→`setting[930]`= *"T01 Z offset"*. **`eng` is the 1:1 name table for `setting`**, so any slot can be
NAMED rather than guessed — that is the declared address map the t2073 arc set out to build, already shipped
by the vendor. ⇒ Worth reading before any further address work.

**c. The WCS table is panel-verified on all six systems.** `_WCS_BASE = 305` is **correct**. `coordinate` rows
1–6 = G54–G59 exactly, row 7 = the pendant's trailing "Offset" column, row 0 is not displayed at all.

**d. ⚠⚠ The active tool's Z offset is applied while the panel shows `G49`/`H00`.** Measured: `setting[930]`
(T01 Z offset, written by the probe) = `−68.336`, mirrored live at `setting[342]` and stacked on the WCS.
Tool-length compensation reads as CANCELLED and it is in force anyway ⇒ **on this controller the probe-set
tool Z offset is not the G43/G49 mechanism; it is unconditional.** Modal state says nothing about it.

**e. The V4.1 SMB progress route does NOT transfer to the Expert.** No `.file` at all; `.break0` **and**
`.break1` with a different layout. The break record decodes as a modal G-code snapshot
(G17/G90/G94/G21/G40/G49/G99/G54) + feed + spindle + positions + three undecoded counters + the source text.

**g. ⭐ THE PENDANT'S PARAMETER SCREEN IS NOW MAPPED** →
[`controllers/expert-m350/PARAM-PAGE-MAP.md`](controllers/expert-m350/PARAM-PAGE-MAP.md). `eng`'s `-m` tag is
the Param List section id; the map lists all 13 sections with every parameter, unit and edit permission, and
7 of the 13 are confirmed against photographs rather than inferred. ⛔ Sections gather **scattered** number
ranges (Backlash holds `#190-200` *and* `#400-415`), so a parameter cannot be found by its number — which is
exactly why this took a bench session to notice. ⚠ Regenerate per controller: the V4.1's `eng` is a different
vocabulary entirely.

**f. ⚠ `SYSDISK/cmdstr` holds a plain-text shell command** — currently `find . -type f | grep ".*\pos$" |
xargs rm -f`. ⛔ Never write to it.

## 3. ⚠ WHAT I GOT WRONG, OR COULD NOT VERIFY

**⛔ I claimed a WCS off-by-one bug, and the machine refuted it.** From a file comparison I inferred that
`coordinate` row 0 was G54 and that `_WCS_BASE = 305` therefore read the wrong system — the same shape as the
owner's t2067 *"it pulled the wrong coord"*. One look at the pendant killed it: G54 **is** row 1. §5 of
`FINDINGS.md` is marked REFUTED rather than deleted, so the bad inference stays visible beside the correction.
⇒ **The lesson is the one this project keeps paying for: an address changed on inference is how t2067 happened
in the first place.** I published the hypothesis without flagging loudly enough that it was one.

**Could not verify:** whether the `.break*` counters are line numbers or byte offsets — both records are stale
historical breaks, so there is nothing to check them against. And **whether any SYSDISK file updates DURING a
run** — the load-bearing question for progress tracking. That needs a program running with a person at the
machine; baseline hashes are committed for the before/after.

**Not attempted:** the Modbus `0x00`. `#279` reads `2` in the file but the controller has not been rebooted
since, and a serial-parameter change needs a restart to take effect.

## 4. STILL OPEN — and ⭐ THE ONE THAT IS RENDERRANCHY'S

⭐⭐ **THE APP QUESTION, and it is yours, not mine: does Studio's pull compute an absolute Z from the WCS row
alone?** If it does, it is **wrong by the active tool's Z offset** — `68.336 mm` on this machine right now —
and the wrong number looks entirely plausible. On a controller where **G54 Z0 = the spoilboard is SACRED**,
that is the class of defect that ends with a tool through the table.

The runnable check, so it costs one command rather than a re-derivation:
```
grep -rn "_WCS_BASE\|805\b" bridge/bridge-app/fairy/ops.py
# then: does any Z path add the active tool offset from setting[930 + tool - 1] (macro #1430+)?
# the active tool number and the live copy at setting[342] are both readable from the same file.
```
⛔ **Do NOT change `_WCS_BASE`** — it is panel-verified correct on all six systems. The suspected gap is the
**missing tool-offset term**, not the WCS base.

Also open, lower priority: whether row 8 / the tool offset is nonzero on the V4.1 or DM500 at all; whether a
FLAT comment has any character restriction beyond not nesting (the dumps say no, but that is absence of
evidence); and the three promotions from `MEMORY-CROSS-SEAT-ANALYSIS.md` §6.
