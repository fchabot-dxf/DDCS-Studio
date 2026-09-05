# CHANNELS — the vendor, and the community

⚠ **The owner talks to people this project depends on, and neither seat sees those conversations.** What is
here came from the owner directly. ⛔ **Do not infer anything else about these relationships** — invent one
detail and it will be repeated back to a real person.

---

## ⭐ THE VENDOR — the one who makes the controller

| | |
|---|---|
| **who** | **Q.G. Zhang** |
| **how** | **Facebook Messenger**, direct — not a ticket system, not a forum |
| **register** | *(owner's spelling: **"foinnc"** — recorded as said, exact company name UNCONFIRMED)* |

⭐ **They answer, they are friendly, and they act on what the owner asks.** They called this project *"great
work"* unprompted. ⇒ **This is a real channel, not a support queue** — a question the machine cannot answer
can sometimes just be asked.

### ⭐⭐ OPEN, AND CLOSE TO DUE: the G-code line-number register

**2026-08-20, the owner asked** whether any register exposes the current G-code line or file progress. Their
own framing of the problem, worth keeping because it is exact:

> *"Today the only way I have is injecting MSETDATA checkpoints into the program, which costs a stop at every
> one. Position + state get me 'where the tool is' but not 'how far through the file', since the same XY
> recurs."*

**The vendor replied the same evening:**

> *"Currently, there is **no register** that exposes the current G-code line number or file progress. However,
> I'm **planning to allocate an address** for this register once I get back from my business trip — roughly in
> about **a week**. I'll keep you posted."*

```
asked      2026-08-20
promised   "about a week"                     ⇒  ~2026-08-27
⚠ UPDATE  2026-08-26 — the vendor says he is looking at it NOW.
           ⇒ realistically ANOTHER WEEK TO A MONTH. The original date is dead; do not plan against it.
trigger    ⭐ INBOUND — "I'll keep you posted". Nothing to poll. The owner will know first.
```

⚠ **Does the slip reopen the workaround hunt? No — but the margin is thinner.** The hunt was closed because
reverse-engineering SMB files for progress competes with a first-class register arriving in days. **At a month
that reasoning still holds** (the RE work is longer than a month and would be thrown away), but it no longer
holds by a wide margin. ⇒ If this slips again, revisit rather than assume.

⇒ ⛔ **The progress-tracking workaround hunt is CLOSED, deliberately.** Reverse-engineering SMB files for
progress (`.break*`, `processing`) competes with a first-class register arriving in days. ⚠ Fairy's open
*"do the SYSDISK files update DURING a run?"* is the tail of that hunt — worth knowing, no longer worth
building on.

⭐ **And the vendor confirmed a negative**, which is worth as much as the promise: **no such register exists
today.** That retires every hypothesis that assumed one was hiding somewhere.

### ⚠ Also from the vendor, unrelated and NOT acted on
Firmware **2026-08-03-00** exists and touches the Modbus memory map. ⛔ **Not flashed** — and per Fairy's own
sequencing, the **reboot to apply `#279` must come BEFORE any flash**, or a working Modbus cannot be
attributed to either one.

---

## THE COMMUNITY — the other DDCS users

⚠ **Thin, and knowingly so.** Two facts only:

- The **`ddcs-expert` skill is built from a community corpus** — real user macros and dumps, not vendor docs.
- **Lathe support came from a community request**, and shipped.

⛔ **GAPS the owner should fill when convenient** — left as questions rather than guesses:

```
where does the community actually live?   forum · Facebook group · Discord · elsewhere
how does a request reach the owner?
is anything outstanding right now?
are there users whose reports carry extra weight — e.g. a V4.1 or V3 owner?
```

⭐ That last one matters: **V4.1 + V3 users outnumber Expert users**, so a report from one is an escalation —
and it is now reproducible at the dev seat's own bench V4.1 rather than needing the studio.

## ⭐⭐ THE VENDOR DEVELOPS IN THE OPEN ON GITHUB — CHECK IT FIRST `[found 2026-09-05]`

⛔ **`ddcnc.com` is NOT the channel to watch.** Its newest published DDCS-Expert firmware is **2025-06-19**,
older than the build on the Expert. The live channel is:

| repo | what | last seen |
|---|---|---|
| ⭐ **github.com/foinnc/M350** | firmware + a `Docs/` tree of ~40 folders | updated 2026-09-02 |
| **github.com/foinnc/M350-LiveG** | the official PC tool — reference impl for register `3000` | updated 2026-09-02 |
| github.com/foinnc/M3X-M350-IoT-Bridge | the M3X IoT box | 2026-08-21 |

⭐ **A question this project logged as "only the vendor can answer" was answered there without us noticing:**
the official slave register map (`M3xx_Modbus_Address_Map_V1_0.xlsx`, committed 2026-09-02). Cached at
`bridge/controllers/expert-m350/assets/vendor-spec/`. It refuted three findings on arrival.

⇒ **Watch these repos.** Anything cached in this repo is a snapshot; check the upstream commit date before
trusting a Modbus fact. ⚠ `ddcnc.com`'s TLS cert is expired — fetchers refuse it, `curl -k` works.

## ⭐ QUESTIONS FOR THE VENDOR (foinnc) — drafted 2026-09-05, NOT YET SENT
Machine: **DDCS Expert M350 V1.1, firmware `2026-09-02-00`**, RS232 port 2, 115200 8N1, slave 1, FTDI cable.
⚠ Every claim below is measured on that machine, with the pendant photographed. Send via a GitHub issue on
**foinnc/M350** or **foinnc/M350-LiveG** — he is active there (both repos updated 2026-09-02).

### ⛔ Q1 — **WITHDRAWN 2026-09-05. DO NOT SEND.** This was OUR bug, not the firmware's.
⭐ **Cause: we appended a trailing `
` to the payload.** `M350-LiveG` sends none. Without it, every
"undeliverable" line executes 5/5. Kept below only as the record of what was measured and eliminated.

#### ~~some exact payloads to register `3000` are NEVER acknowledged~~
Writing `#916 = [3+3]` (FC16, reg 3000, ASCII, byte-swapped per pair, as `M350_LiveG` does) is **never
acknowledged** — 0 of 5, every time, no reply at all. The controller never receives it, so nothing executes
and no error appears on the screen. But **any byte-level variation of the same expression works**:

| payload | delivered |
|---|---|
| `#916 = [3+3]` | ⛔ **0/5** |
| `#917 = [3+3]` | ✅ 5/5 |
| `#916 =[3+3]` | ✅ 5/5 |
| `#916 = [3+3] ` *(one trailing space)* | ✅ 5/5 |
| `#916 = [3+3]` **padded to 64 bytes** | ✅ 5/5 |

Other members of the same class: `[4+4]`, `[0+7]`, `[7+0]`, `[8+1]`, `[4*4]`, `[4/4]`, `[3/3]`, `[0/7]`.
There is also a **background loss of ~15%** on all other payloads, which retrying clears.

**Already ruled out here:** the trailing `\n` (LiveG omits it — no change), `serial.flush()` (LiveG calls it
— no change), the FTDI latency timer (16 → 1 ms — no change), three CRC-value hypotheses (each refuted by
prediction on untried expressions), and lowering the baud (**19200 made it ~6× worse**; we note LiveG's own
dropdown offers only 9600/38400/115200).

⇒ **Is there a minimum or required payload length for register `3000`?** Padding to 64 bytes fixes every
known case, which is the only lever we have found. **Is short-payload behaviour defined?**

### Q2 — register `3000` is absent from `M3xx_Modbus_Address_Map_V1_0.xlsx`
The new map covers `6500`–`16998`. Is a specification for the `3000` dispatch buffer available — required
length, alignment, terminator, and the buffer's consume/clear semantics?

### Q3 — the `0x90` BUSY exception
`M350_LiveG` treats `res[1] == 0x90` as "busy". **When does the controller return it, and what is the
recommended retry interval?** We have never observed it — our failures are silence, not an exception.

### Q4 — confirm register `10002` (motion state)
`M350_LiveG` polls `0x2712` and treats `0` as idle. **Are the non-zero values enumerated anywhere?** We
would like to use it as a live progress signal, not just a done/not-done flag.

### ⭐ Q5 — FEATURE REQUEST: a way to clear an error over Modbus
A syntax error in an injected line halts the G-code interpreter. After that, FC16 writes to `3000` are still
**acknowledged** but nothing executes (measured: 9/10 acked, 0/10 executed). Per
`#2037_Button simulation macro variable_M350.pdf`, a virtual key press must be *"placed in the executable
code"* — so `#2037 = 65863` (Reset) cannot help, because the interpreter is exactly what is halted.
⇒ **An operator must physically press Reset**, which blocks any unattended or remote use of register `3000`.
**Could a register be defined that clears the error/alarm state directly?**
