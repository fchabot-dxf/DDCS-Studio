# SETUP — the two places, and what is wired to what

⚠ **TWO LOCATIONS, not one.** A great deal of design has quietly assumed one site. It is not one site, and
the two have different networks, different hardware, and different rules.

```
   THE STUDIO  (the owner's ARTIST STUDIO)          HOME
   ──────────────────────────────────────           ──────────────────────────────
   DDCS Expert / M350  ── wired ──  FAIRY           RANCHY ── LAN ── bench V4.1
       real machine: motors,        (gateway)       (dev seat)      10.0.0.50, SMB
       tools, a table                                               ⭐ MOTORLESS
                                                                    mostly on 24/7
   ASUS TUF  (laptop, same WiFi, metres away,
              no controller)
```

## THE STUDIO

- **The machine: an ULTIMATE BEE** (the owner's words) driven by a **DDCS Expert / M350**. Motors, tools,
  a table. ⛔ **`G54 Z0` = the spoilboard is SACRED.**
- ⭐⭐ **IT WORKS, AND IT IS IN PRODUCTION.** Owner, 2026-08-26: *"the expert and ultimate bee are mostly
  working, ive been able to run parts and 2 sided jobs for a while."*

  ⇒ **This is not a bench rig — real parts come off it.** Two consequences worth holding:

  1. ⛔ **Anything touching EMIT is production-risk.** A wrong line does not fail a test, it ruins stock or
     drives a tool into the table. Weigh emit changes accordingly.
  2. ⭐ **A large, systematic error is ALREADY REFUTED by the parts.** Months of successful cuts are
     evidence, and stronger than most tests. When a written claim says something big is silently wrong
     — a WCS off by 68 mm, say — **the missing symptom is data**: either the path is not hit, or the
     analysis is incomplete. Ask which before escalating it.

  ⚠ **Two-sided work is done in FUSION**, not Studio — CAM territory, deliberately deprioritised.
- **Fairy** is wired to it and runs the **gateway**: SMB `\192.168.0.99\`, Modbus on **COM6** *(on-site only)*.
- **ASUS TUF** — a laptop on the same WiFi, metres from Fairy. Not on the controller.
- ⚠ **The WiFi is not the owner's to administer**, and the phone↔PC path has failed there before. ⛔ **This is
  an ATYPICAL site — do not design the product around it.** Browser route when it works: `http://<gateway>:8765`.

## HOME

- **Ranchy** — the dev seat. ~90% of development happens here.
- **bench DDCS V4.1** — `10.0.0.50` over SMB, **motorless**, mostly left on 24/7. ⭐ A real controller that
  cannot crash. See [`SEATS.md`](SEATS.md) for what that makes testable.

## ⛔ SAFETY, AND IT OUTRANKS EVERY TASK

- **No write operations to a live controller when the owner is not at it.**
- ⭐⭐ **AND THE OWNER RULED HOW TO KNOW, 2026-08-26:** *"if im asking to read or write to the ddcs its because
  it on and im here, otherwise i shut it down, except the bench machine."*
  ⇒ **On the Expert, REACHABLE MEANS PRESENT.** They power it down when they leave, so the machine answering
  a ping IS the presence signal. ⛔ **Stop asking "are you at it?" every time** — that was the old rule and it
  taxes every single request for a fact the machine already carries.
  ⚠ **The old caution still holds for the OTHER direction**: presence cannot be inferred from *which seat is
  talking*. They are on a phone, in every conversation at once. It is the **controller being on** that says
  they are there — not the fact that Fairy is the one being addressed.
  ⚠ **This is a discipline, not a physical interlock.** If it were ever left on unattended, the inference
  breaks — so it is worth re-confirming after any long gap, not before every command.
- ⭐ **The bench V4.1 is exempt entirely** — it is MOTORLESS and left on 24/7 ([`SEATS.md`](SEATS.md)). Nothing
  there can crash, so presence is not a question at all.
- **Read-only is always safe**: file reads over SMB, `eng`/`setting` decoding, ping.
- ⚠ A **motion-free macro that reports a value** is the right instrument for an offset question — not the
  pendant screen, whose dialog covers the Z row for exactly the window in which a modal offset is live.
