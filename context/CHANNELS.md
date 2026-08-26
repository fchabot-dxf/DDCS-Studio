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
promised   "about a week"  ⇒  ~2026-08-27
trigger    ⭐ INBOUND — "I'll keep you posted". Nothing to poll. The owner will know first.
```

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
