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

- **No write operations to a live controller when the owner is not at it.** ⚠ And *"the owner is not at it"* is
  exactly the thing that **cannot be inferred** from which seat is talking — they are on a phone, in every
  conversation at once. **Ask.**
- **Read-only is always safe**: file reads over SMB, `eng`/`setting` decoding, ping.
- ⚠ A **motion-free macro that reports a value** is the right instrument for an offset question — not the
  pendant screen, whose dialog covers the Z row for exactly the window in which a modal offset is live.

## DEPLOYMENT & ANALYTICS — where the web app actually runs, and how usage is measured

- **`ddcs-studio.pages.dev`** serves `web/` raw, no build step, and auto-deploys on every push to `main` via
  Cloudflare's own GitHub integration — this is **invisible to `gh run list`** (it's not a GitHub Actions run),
  so don't look there to confirm a deploy landed. See `context/GIT-AND-TOOLING-HAZARDS.md` §15 for the live-site
  caching gotcha this creates.
- **Anonymous usage analytics** runs through a **standalone Cloudflare Worker**
  (`ddcs-analytics.dansemur.workers.dev`), separate from the Pages deployment above, writing to Analytics
  Engine. Both the web app and the desktop exe send beacons; a dev/own-traffic IP is tagged so the owner's own
  usage doesn't pollute the real numbers.
