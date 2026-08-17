# Project 1 — Remote access: use Studio from the desk PC

**Where:** CNC-FAIRY (the exe) + ASUS TUF (a browser). Both at the studio.
**Time:** ~10 min · **Risk:** none · **Prereq:** [PREFLIGHT](../BENCH-CHECKLIST.md#preflight--do-this-once-before-any-project-5-min-no-risk)

## Why this matters

You work at the desk; the controller hangs off the shop PC. This settles whether the desk browser can reach
the gateway at all — and if it can, everything after this gets more comfortable.

⚠ **The advisor got this wrong twice and corrected it:** the browser route is **NOT blocked**. Mixed
content (`https://` page → `http://` LAN address) only affects the **Cloudflare-hosted** page. A page served
by the **gateway itself** is plain `http` on both halves — same origin, nothing blocked, **no admin rights
involved**. It ships **off by default**, which is why it looked impossible.

## Tasks

- [ ] On **CNC-FAIRY**, run the Studio exe → **Gateway ▸ Setup**.
- [ ] Tick **"Allow other devices on my network (serve Studio on the LAN)"** (`admin.js:240`).
      This sets the bind address to `0.0.0.0`.
- [ ] **Restart the exe** — the bind address is only read at startup.
- [ ] Setup now prints a **LAN URL**. Write it down. ⚠ The exe takes the first free port of
      **8765–8769**, so do **not** assume 8765.
- [ ] From **ASUS TUF**, PowerShell:
      `curl.exe http://<fairy-ip>:<port>/api/descriptor`
- [ ] From **ASUS TUF**, browser: open `http://<fairy-ip>:<port>/`

## PASS

JSON comes back from `/api/descriptor`, **and** Studio loads in the browser on ASUS TUF.

## If it times out

Almost certainly **WiFi client isolation** — the studio WiFi is not administered by the user, and many
unadministered networks drop device-to-device traffic. **Record it as such; it is not a bug in Studio.**

Fallback, in order of cost: a **direct Ethernet cable** between the two PCs (they are metres apart) ·
running Studio on CNC-FAIRY itself · the cloud path.

## RESULTS

| item | value |
|---|---|
| LAN URL (incl. port) | |
| `/api/descriptor` from ASUS | ☐ JSON ☐ timeout ☐ other: |
| Studio loads in ASUS browser | ☐ yes ☐ no |
| client isolation suspected? | ☐ yes ☐ no |

**Notes (raw errors verbatim):**
