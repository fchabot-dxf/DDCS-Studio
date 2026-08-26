# CLAUDE.md

**Read [`AGENTS.md`](AGENTS.md) first.** It is the canonical entry point for this repo.

Critical reminder, repeated here because it is the easiest mistake to make:

> This repo covers **two different controllers** — the **DDCS V4.1** (bench sandbox @ `10.0.0.50`)
> and the **DDCS Expert / M350** (the real target). **They behave differently.** Never apply a
> finding from one to the other without checking [`controllers/README.md`](controllers/README.md).

Record new findings under the correct controller's `FINDINGS.md` with a confidence tag
(`[CONFIRMED]` / `[TO TEST]` / `[HYPOTHESIS]`).

For DDCS G-code / macro questions, consult the installed **`ddcs-expert`** skill (reference only).


---

## ⭐ THE SEATS AND WHERE THEY ARE — read this before writing "the other machine"

Recorded 2026-08-25 in the owner's own words, after this was got wrong four times in one evening.

| seat | where | on the controller? | role |
|---|---|---|---|
| **FAIRY** / CNC Fairy | **the studio** | **YES** | the controller-connected PC. runs the **gateway**. the only seat with real hardware. **You are here.** |
| **ASUS TUF** | **the studio** | no | a laptop. same WiFi, metres from Fairy. |
| **RENDERRANCHY** | **home** | no | the desk PC. **~90% of dev happens here.** The other Claude seat. |

⇒ **TWO LOCATIONS**, not one: the studio (Fairy + the TUF) and the owner's home (RenderRanchy). Anything
that assumes the two seats share a LAN is wrong — see [`TRANSPORT.md`](TRANSPORT.md).

### ⛔ "STUDIO" — the word carries two meanings, and never a third

```
"the studio"    the PLACE — the owner's ARTIST STUDIO, where the CNC is
"DDCS Studio"   the APP
```

**Both are the owner's.** Context disambiguates them and that is fine. ⛔ **Never use it for a machine or a
seat** — that third meaning was invented on RENDERRANCHY on 2026-08-25 and written into six committed
documents before the owner caught it. If a document here says "the Studio seat", it means RENDERRANCHY and it
is a leftover.

⭐ **Why it happened, because it generalises:** RENDERRANCHY's own name was recorded in **no memory anywhere**,
so with no name for the machine in use, one got borrowed from the product. **A missing fact does not present
as a gap — it presents as an invention.** It never felt like a thing unknown; it felt like writing. ⚠ That is
the blind spot in [`../MEMORY-PROTOCOL.md`](../MEMORY-PROTOCOL.md) §6: the domain check catches *"I would be
guessing about the machine"*, and does **not** catch *"I have no name for this, so I will invent one."*

⚠ **And the word was already here.** `shop-two-pc-network` read *"STUDIO — the two are METRES APART"* — the
owner's vocabulary, sitting in a memory, read as a formatting heading instead of as a name. **A fact can be
present, correct, and still not land** if it is not read as the thing it is. Its "two PCs" means **two at the
studio**, not two in total.

## ⭐ HANDOFF FROM THE RENDERRANCHY SEAT — 2026-08-25

FOUR documents landed on the branch from RENDERRANCHY (the desk machine). They do not announce themselves, so they
are listed here, in the file this seat loads automatically:

| file | what it is |
|---|---|
| [`HANDOFF-TO-FAIRY.md`](HANDOFF-TO-FAIRY.md) | **Start here.** Orientation: what only this machine can do, the machine-switch mechanics, and the live-CNC safety rule that outranks every task. |
| [`TRANSPORT.md`](TRANSPORT.md) | The spec. Fully ruled — five open questions went to the owner and all five came back answered. **Not built.** |
| [`FAIRY-MEMORY-DUMP-INSTRUCTION.md`](FAIRY-MEMORY-DUMP-INSTRUCTION.md) | Dump this seat's memory store so the two can be compared. **Contradictions between the seats are the point** — nothing else detects them. |
| [`HANDOFF-FROM-FAIRY.md`](HANDOFF-FROM-FAIRY.md) | The return channel, and the git discipline for two machines on one repo. |

⏸ **FAIRY SESSION PAUSED 2026-08-25 — start at [`HANDOFF-FROM-FAIRY.md`](HANDOFF-FROM-FAIRY.md) → the
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
