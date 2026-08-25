# MEMORY PROTOCOL — for every Claude seat on this project

**Both seats read this.** Worked out with the owner 2026-08-25, after comparing the RENDERRANCHY store (165
memories) against Fairy's (7) and finding that **the seven won on the facts that mattered.**

⭐ **That result is the whole design.** 165 memories accumulated over ninety percent of the dev time did not
contain what seven written at the machine did — including a constraint the RENDERRANCHY seat then spent an evening
re-deriving, and a rule paid for by a tool broken against a table. **A small index with high hit-rate beats a
large one with poor addressing.**

---

## 1. THE MODEL

```
MEMORY = the INDEX     a pointer + a great description.
                       ⭐ ACTIVE: it surfaces on its own, unprompted, when relevant.
                       ⚠ per-machine, and it drifts.

REPO   = the CONTENT   the full fact. one home. versioned. travels to every seat.
                       ⚠ PASSIVE: only read if something points at it.
```

⛔ **Neither replaces the other.** A fact in the repo that nobody thinks to open is worse than a memory that
appears when needed — repo docs have **no delivery mechanism**, and recall IS the delivery mechanism. But a
fact that lives ONLY in a memory exists on one machine and is invisible to every other seat.

⇒ **Write the content in the repo. Keep a pointer in memory.** A pointer cannot drift, because it holds no
content to diverge.

---

## 2. WHERE A FACT GOES — the decision, at write time

Ask **one** question: *could another seat, on another machine, need this?*

| the fact | home | example |
|---|---|---|
| **About the machine / controller** | `bridge/controllers/<name>/FINDINGS.md`, tagged `[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]` | never `G53 G1` — it crashed a tool into the table |
| **About how to work on this project** | `ROADMAP.md` → *Conventions / traps* | a green test can assert the wrong thing |
| **About the code's architecture** | the doc that owns that area (`TABS.md`, `TRANSPORT.md`, the arc plan) | the node vocabulary has two homes |
| **About THIS machine only** | stays a memory, no promotion | this box serves on 3461; VS Code Live Preview caches modules |

⭐ **"How the owner likes to work" is NOT seat-local.** It is the same person on both machines, so it goes in
the repo. That was the mistake this protocol exists to correct.

⭐ **Prefer `FINDINGS.md` over a memory for anything about a controller** — it records **confidence**, which a
memory structurally cannot. A memory asserts; `[TO TEST]` admits.

---

## 3. ⚠⚠ HOW TO WRITE THE DESCRIPTION — the load-bearing part

**Recall matches on the description.** A perfectly true memory with a bad description behaves **exactly like no
memory at all**.

⇒ **Write it in the words the OWNER would say, not the words the codebase uses.**

**Proven twice in one session:**
- `CNC-FAIRY` was correctly recorded as the gateway machine. The word **"fairy"** — what the owner actually
  says — appeared nowhere in its description. When they said *"handoff to fairy"* it was not recalled, and the
  request was misread as a handoff to a code seat.
- The nested-parens constraint existed on the other seat and was not surfaced here, so an evening went into
  re-deriving it.

**Rules:**
- Include the owner's own vocabulary, including nicknames and shorthand.
- Include the words someone would type when *hunting* for it, not just when describing it.
- State the CONCLUSION, not the topic. *"never `G53 G1` — it crashed a tool"* beats *"notes on G53 usage"*.
- If a memory has ever failed to surface when it should have, **the description is the bug.** Fix it there.

---

## 4. ⛔ KEEP THE INDEX SMALL — accumulation is the failure mode

165 entries with poor addressing lost to 7 with good addressing. **More memories is not more knowledge.**

- **One fact per memory.** A memory covering three things is findable by none of them.
- **MERGE before you ADD.** Check for an existing memory on the subject first — extend it rather than creating
  a sibling that will drift from it.
- **When content is promoted to the repo, REPLACE the memory with a pointer.** Do not keep both copies.
- **Delete a memory that turns out wrong.** A stale memory is *more* dangerous than none, because memories
  exist to be trusted without re-derivation.

---

## 5. THE ROUTINE — do not fight the reflex

**Owner: *"claude cant help but write to its local memory."*** True. So:

1. **Write it locally, immediately.** Nothing is lost in the moment and the reflex is satisfied.
2. **Promote** if §2 says another seat could need it.
3. **Leave a pointer** with a description written per §3.

**The trigger is write time**, because that is when the judgement is easiest. ⚠ And because it will sometimes
be skipped, a **periodic cross-seat sweep is the backstop** — dump both stores and compare. The first one
(2026-08-25) is at `bridge/MEMORY-CROSS-SEAT-ANALYSIS.md` and found three absences, zero contradictions.

⭐ **The danger is ABSENCE more than DISAGREEMENT.** That sweep found no contradictions at all — what it found
was one seat not knowing what the other had paid to learn. Nothing detects that: no test, no exception, no
grep. It is the only defect class in this project with no automatic tell.
