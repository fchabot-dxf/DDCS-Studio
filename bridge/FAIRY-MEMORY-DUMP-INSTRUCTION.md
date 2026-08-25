# INSTRUCTION → FAIRY: dump your memory store for cross-seat analysis

**Why this exists.** Both seats have accumulated project memories independently. The Studio side has **165**
files. Fairy has its own set, and the two have never been compared. They will overlap, and — the reason this
matters — **they may CONTRADICT each other.**

⭐ **The contradictions are the point.** Every other divergence this project has met was eventually caught by
something: a failing test, a Blockly exception, a rendered screenshot, a grep. **Two Claudes believing
different things about the same project is caught by nothing.** There is no compiler for a memory, no suite,
no "it still parses" tell. A stale memory is more dangerous than no memory, precisely because memories exist to
be trusted without re-derivation.

---

## WHAT TO PRODUCE

One file: **`bridge/FAIRY-MEMORY-DUMP.md`**, committed and pushed to the branch. It travels with the repo;
nothing else does.

For **every** file in your project memory directory, in this shape, one after another:

```
### <the name: slug>
type: <user | feedback | project | reference>
description: <the description line, VERBATIM>

<the full body, unedited>

---
```

⚠ **Include the `description` verbatim, not a summary.** Descriptions are what recall matches against, so a
fact that exists but is described badly behaves exactly like a fact that is missing. That failure happened on
the Studio side today: `CNC-FAIRY` was correctly recorded as the gateway machine, and the word "fairy" appeared
nowhere in its description — so when the owner said "handoff to fairy" it was not recalled, and the whole thing
was misread as a handoff to a code seat. **The description is not decoration; it is the index.**

⚠ **Do not tidy, merge, correct or drop anything on the way out.** A memory you believe is wrong is *evidence*
— it may be right and mine may be wrong, and either way the disagreement is what we are looking for. Dump it
as it stands.

⚠ **Also state the total count** at the top, so a truncated dump is obvious rather than silent.

---

## ⛔ BEFORE COMMITTING — check for things that should not be in a repo

Memories can accumulate machine paths, account identifiers, tokens and local details. **Read the dump before
you push it.** If something should not be public, replace the value with `[REDACTED — <what it was>]` and say
so at the top of the file rather than deleting the entry — a redacted memory still tells the analysis that the
fact exists.

⚠ Particularly: anything under `secrets/`, `client_secret_*.json`, Drive account details, and absolute paths
that reveal more than a project layout.

---

## WHAT THE ANALYSIS WILL LOOK FOR

Written down so you can flag anything you already suspect while dumping:

1. ⭐⭐ **CONTRADICTIONS** — the same fact, two different answers. The highest-value output by a distance, and
   the only category that is actively dangerous today.
2. **UNIQUE TO FAIRY** — facts the Studio side does not have. Expect the hardware knowledge to live here:
   what the real controller accepts, what the dumps say, what the gateway actually does in the shop. That
   knowledge cannot be produced on a machine with no controller attached, so it is likely the most valuable
   thing in your store.
3. **UNIQUE TO STUDIO** — the reverse, for the return trip.
4. **OVERLAP** — the same fact in both. Candidates to move into the repo once, so neither seat owns it.
5. **STALE** — anything contradicted by the code as it stands now. On the Studio side, 8 of 18 backlog entries
   were stale in a single evening; there is no reason to assume memories rot more slowly.

⭐ **The intended outcome** is a split, not a merge: **project facts** (conventions, architecture rulings,
traps, ground truth) belong in the REPO where every seat reads the same copy; **seat preferences** (how a
particular person likes a particular Claude to work) stay local, because they are about the human rather than
the project.

---

## ⚠ ONE THING NOT TO ASSUME

Do not assume the Studio side's version wins on any given disagreement. It has more memories, which is not the
same as better ones — and on anything the real machine can answer, **Fairy is the authority and Studio is
guessing.** This project's own standing rule is that the dumps outrank the code; the same logic applies to the
two memory stores.
