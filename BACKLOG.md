# BACKLOG — small, self-contained things to pick up in downtime

**What this file is:** the SHORT LIST of known, scoped, nobody-is-blocked-on-it work. Created 2026-08-19 at
the human's request — *"it needs to be a list for stuff to do in the downtime"* — because backlog items were
being appended to `NEXT-SESSION.md`, a 6,600-line running handoff where a to-do list is unfindable.

**What goes here:** something noticed in passing, already diagnosed, and small enough to finish in one sitting.
**What does NOT:** an arc, a decision the human owes, or anything needing hardware. Those stay in
[`NEXT-SESSION.md`](NEXT-SESSION.md) (the live handoff) and [`ROADMAP.md`](ROADMAP.md) (the canonical backlog
of features).

**The rule that keeps this honest:** an item is DONE when it leaves this file, not when a commit mentions it.
Each entry names where the evidence is, so nobody re-derives it.

---

## OPEN

### 1. The avatar shows initials even when a photo exists
*(human, 2026-08-19: "the avatar icon, it is my initials when I'm connected, but can it actually be my avatar image?")*

`headerAccount.js` ALREADY renders `acct.picture` when present and only falls back to initials — and
`googleDrive.getUserInfo()` now requests `photoLink` (t2077). So the plumbing is there; the likely causes are
mechanical, in order of probability:
1. **The picture was never cached for an EXISTING sign-in.** `captureGoogleIdentity()` runs on CONNECT only, so
   anyone who connected before t2077 has `ddcs_cloud_name`/`_email` stored but no `ddcs_cloud_pic`. ⇒ **Re-fetch
   identity on boot when the account is connected but the picture is missing**, rather than making the user
   disconnect and reconnect.
2. `photoLink` came back empty — a Google account with no photo set. Initials are correct there.
3. The `<img>` 403'd and the `onerror` fallback fired (Google's photo CDN rejects some referrers; the tag
   already sends `referrerpolicy="no-referrer"`).
**Check which it is before changing anything:** read `localStorage.ddcs_cloud_pic` — empty means (1), a URL
means (2)/(3).

### 2. Move the theme selector out of the quick menu into Settings
*(human, 2026-08-19)* — `headerPost.js` `themeSection` renders a heading + five `.hq-theme-chip`s in a menu the
t851 "menu diet" cut to ~9 rows. A theme is chosen once; Settings is where appearance preferences live. ⚠ Leave
NOTHING behind (a "Theme…" row that opens Settings keeps the row it was meant to free). ⚠ Reuse
`setQuickTheme()` — do not re-implement switching — and keep the active-theme ring reflecting live `data-theme`.

### 3. Hide the console window when launching the exe
*(human, 2026-08-19)* — `build_fairy.ps1` passes neither `--windowed` nor `--console`, so PyInstaller defaults to
a console build and a black log window sits beside the app all session. ⛔ **Do not just add `--windowed`**: that
log is load-bearing (bound host/port, a FAILED serial probe, `[poller]` delivery/stall lines) and on a frozen
Windows build stdout then goes nowhere — a bare `print()` can even raise when `sys.stdout` is None. **Log to a
file first** (`~/.ddcs-bridge/gateway.log`, rotated) with a "show log" affordance in Setup, *then* hide the window.

### 4. The exe only checks for updates at boot
*(human, 2026-08-19)* — `initUpdateCheck()` is called once from `index.html` ("one check per launch"); a release
cut while Studio is open is invisible until restart. The WEB build already re-checks on `visibilitychange`
(`initWebVersionNudge`) — the exe, which cannot reload itself and most needs telling, has no equivalent. Reuse
that pattern, throttled (`_lastWebCheck` is the precedent). ⚠ Must not re-nag a version already dismissed —
`update-check.spec.js` asserts that.

### 5. The update banner is not well balanced
*(human, 2026-08-19, on the real exe)* — the version prints TWICE (label *and* inside the button, which carries
the longer copy); the primary button's width grows with the version string so the layout reflows unpredictably;
the ✕ floats at the end of a button row instead of sitting in a corner. ⚠ Do not "fix" it by shrinking the
primary action — t2066 deliberately made in-place update prominent over the dated manual Download. It is a
proportion problem, not a priority one. `update-check.spec.js` asserts button classes/labels.

### 6. The welcome / "What's new" panel: shorter, and link to the thing it describes
*(human, 2026-08-19: "the panel on boot can be a little bit less lines and perhaps a link on each panel to go to
the function associated with the note whenever possible… maybe it's nice to have a screenshot of the function or
the menu for each note.")*

Three separable asks, in increasing cost — the first is worth doing alone:
1. **Fewer lines.** `RELEASE_NOTES[v][].full` is currently a paragraph per entry (the t2075 schema deliberately
   allowed the modal to say the HOW). It has drifted long — the t2078 notes run 4-5 lines each. Tighten the
   authored copy; no code change.
2. **A link per panel to the feature.** ⚠ OPTIONAL BY THE HUMAN'S OWN WORDS — *"not an obligation… if it's
   convenient or easy"*. Cheap version: an optional `go` field on a note (`{ short, full, go }`) whose value is
   an existing global the app already exposes (`window.openSettings`, `showApp('gateway')`, the quick menu).
   ⛔ Do NOT invent a navigation layer for this; if a note's target has no existing door, it simply gets no link.
3. **A screenshot per note.** Most expensive and needs thought before any code: images have to be produced at
   release time, kept in sync with a UI that changes weekly (this session alone moved the account chip, the
   editor row and the file menu), and either bundled into the exe — which is size the gateway is deliberately
   slim about — or fetched, which breaks the offline-first rule. **Measure the cost before committing**: a stale
   screenshot is worse than none, because it teaches a layout that no longer exists.

Files: `web/data/releaseNotes.js` (the authored source), `web/ui/updateCheck.js` (`checkWelcomeNotice` renders
one panel per entry). ⚠ `update-check.spec.js` asserts the modal's panel-per-entry structure and the
no-notes fallback — read it before changing the schema.

---

## RECENTLY CLOSED  *(kept briefly so a re-report is recognised, not re-investigated)*

- ~~**Two Google Drive connect surfaces sharing one credential**~~ — closed by **t2077**: one account door in the
  header, both features (save projects / send jobs) hang off it.
- ~~**The editor's bottom-left button cluster is overgrown**~~ — closed by **t2078**: one flex toolbar row above
  the editor; indent/comment buttons retired to their keyboard shortcuts.
