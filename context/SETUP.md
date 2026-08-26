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

- **DDCS Expert / M350** — the real machine. Motors, tools, a table. ⛔ **`G54 Z0` = the spoilboard is SACRED.**
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
