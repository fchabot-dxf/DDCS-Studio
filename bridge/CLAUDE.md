# CLAUDE.md

**Read the ROOT [`../AGENTS.md`](../AGENTS.md) first** — it is the canonical entry point for the repo, and
it is NOT auto-loaded. Then [`controllers/README.md`](controllers/README.md) for the two-controller rule and the
confidence tags, and [`../context/`](../context/) for where each seat is and the safety rules.

Critical reminder, repeated here because it is the easiest mistake to make:

> This repo covers **two different controllers** — the **DDCS V4.1** (bench sandbox @ `10.0.0.50`)
> and the **DDCS Expert / M350** (the real target). **They behave differently.** Never apply a
> finding from one to the other without checking [`controllers/README.md`](controllers/README.md).

Record new findings under the correct controller's `FINDINGS.md` with a confidence tag
(`[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]`).

For DDCS G-code / macro questions, consult the installed **`ddcs-expert`** skill (reference only).


---

## ⛔ WHERE THE SEATS ARE — NOT HERE

⭐ **[`../context/SEATS.md`](../context/SEATS.md)** — who reaches which controller, from where, and the
VS Code setup. **[`../context/SETUP.md`](../context/SETUP.md)** — the two places, what is wired to what,
⛔ the safety rules.

⚠ This file carried a copy of that table until 2026-08-25. Two copies of the same fact is what put the
reachability row somewhere nobody looked — one fact, one home.

## ⭐ THE CROSS-SEAT DOCS — now in [`../context/`](../context/)

FOUR documents landed on the branch from RENDERRANCHY (the desk machine). They do not announce themselves, so they
are listed here, in the file this seat loads automatically:

| file | what it is |
|---|---|
| [`HANDOFF-TO-FAIRY.md`](../context/HANDOFF-TO-FAIRY.md) | **Start here.** Orientation: what only this machine can do, the machine-switch mechanics, and the live-CNC safety rule that outranks every task. |
| [`TRANSPORT.md`](TRANSPORT.md) | The spec. Fully ruled — five open questions went to the owner and all five came back answered. **Not built.** |
| [`FAIRY-MEMORY-DUMP-INSTRUCTION.md`](../context/FAIRY-MEMORY-DUMP-INSTRUCTION.md) | Dump this seat's memory store so the two can be compared. **Contradictions between the seats are the point** — nothing else detects them. |
| [`HANDOFF-FROM-FAIRY.md`](../context/HANDOFF-FROM-FAIRY.md) | The return channel, and the git discipline for two machines on one repo. |

⏸ **FAIRY SESSION PAUSED 2026-08-25 — start at [`HANDOFF-FROM-FAIRY.md`](../context/HANDOFF-FROM-FAIRY.md) → the
PAUSE STATE block at the BOTTOM of that file.** It carries the machine's state (safe, nothing mid-test), the
single next action (reboot the controller, then re-probe Modbus), what the session settled, and two claims
that turned out wrong after they had already propagated.
⭐ The controller facts live in [`controllers/expert-m350/FINDINGS.md`](controllers/expert-m350/FINDINGS.md)
→ **the RESULTS block at the top**. The numbered sections below it are the investigation in the order it
happened, corrections included — provenance only, not needed to use the results.
⭐ To find any parameter on the pendant: [`controllers/expert-m350/PARAM-PAGE-MAP.md`](controllers/expert-m350/PARAM-PAGE-MAP.md).
⛔ Sections gather scattered number ranges, so never search by parameter number — and when asking a human to
change one, give **Param page → section → `#nnn` name**, never a bare number.

✅ ~~One RENDERRANCHY turn is BLOCKED on this seat: the safe comment-character list~~ — **DELIVERED**:
[`controllers/COMMENT-CHARACTERS.md`](controllers/COMMENT-CHARACTERS.md). The governing constraint turned out
to be **nesting, not the character set**, and that half already shipped at `917f8856`.

⭐ **And note where cross-seat facts should end up.** This file already names the right home —
`controllers/<name>/FINDINGS.md`, tagged `[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]`. That convention is
better than RENDERRANCHY's own memory store for anything hardware-shaped, because it lives in the repo, it
travels to every seat, and it records confidence rather than asserting flatly. **Prefer it over a memory for
any fact about a controller.**


### ⭐ MEMORY PROTOCOL — read before writing a memory

[`../MEMORY-PROTOCOL.md`](../MEMORY-PROTOCOL.md) is the cross-seat rule, worked out after comparing this
seat's store against RENDERRANCHY's. **Seven memories here beat 165 there on the facts that mattered**, and
the protocol is built from why.

Short version: **the MEMORY is the index (a pointer + a great description), the REPO is the content.** Write
the fact where every seat reads it — `controllers/<name>/FINDINGS.md` with a confidence tag for anything about
a machine — and keep a pointer in memory so recall still surfaces it. ⚠ **Write the description in the words
the OWNER says**, not the codebase's: a true memory with a bad description behaves exactly like no memory.
