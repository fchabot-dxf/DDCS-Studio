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
*(human, 2026-08-19, on the real exe — twice, second time with the specific symptom: "the buttons seem to
clutter to the left and have a big empty space on the right")*

**The measured symptom:** the bar is WIDER than its content and everything is left-packed, so the controls bunch
up on the left with dead space trailing off to the right. Two candidate causes, and they want checking before
either is "fixed": the container is being stretched (a `width`/`min-width` or a stretching flex parent) rather
than hugging its content, and/or there is no `justify-content`/`margin-left:auto` giving the ✕ its own corner.

**Compounding it, from the first report:** the version prints TWICE — in the label AND inside the primary
button, which carries the longer copy ("Update to v2026.08.19.2 and restart"). So the widest element is also
the most redundant one, and its width grows with the version string, meaning the layout reflows differently per
release and cannot be judged at one width. Dropping the version from the button ("Update and restart") both
shortens the row and removes the duplication.

⚠ Do not "fix" it by shrinking or demoting the primary action — t2066 deliberately made the in-place update
prominent over the dated manual Download, which users kept grabbing by mistake. It is a proportion problem, not
a priority one. ⚠ `update-check.spec.js` asserts button classes and the exact "Download manually" label, so a
copy change is a test change — read it first.

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
3. **A screenshot per note.** ⚠ **MY FIRST OBJECTION HERE WAS WRONG AND IS CORRECTED, so it does not get
   re-raised:** I argued images would go stale against a weekly-changing UI. The human's answer —
   *"of course they go stale, but that's why we release new updates"* — is right, and it dissolves the problem:
   **release notes are VERSIONED AND IMMUTABLE.** A picture in the V2026.08.19.4 notes documents what
   V2026.08.19.4 introduced; it is a historical record, not a live document, and it is CORRECT for it to keep
   showing that release's layout forever.

   That reframing also makes it cheap, via a fact about the surface: **the welcome modal only ever fires for the
   version just installed** (`checkWelcomeNotice` compares stored-vs-current at boot). So only the CURRENT
   release's images can ever render — historical ones are never displayed and must NOT be accumulated in the
   bundle. ⇒ **Ship images for the newest release only; drop the previous release's when cutting a new one.**
   The note TEXT stays for history (the banner still reads older entries); the images do not.

   Remaining real costs, neither fatal: (a) someone must capture + crop at release time — a per-release chore
   the ritual has to name, or it silently stops happening; (b) they must be BUNDLED, not fetched — the gateway is
   offline-first, so a CDN URL would break exactly the shop-with-no-internet user this is for. Budget a few tens
   of KB for ~3 cropped PNGs and keep them out of `--onefile` growth by replacing rather than appending.

Files: `web/data/releaseNotes.js` (the authored source), `web/ui/updateCheck.js` (`checkWelcomeNotice` renders
one panel per entry). ⚠ `update-check.spec.js` asserts the modal's panel-per-entry structure and the
no-notes fallback — read it before changing the schema.

---

## RECENTLY CLOSED  *(kept briefly so a re-report is recognised, not re-investigated)*

- ~~**Two Google Drive connect surfaces sharing one credential**~~ — closed by **t2077**: one account door in the
  header, both features (save projects / send jobs) hang off it.
- ~~**The editor's bottom-left button cluster is overgrown**~~ — closed by **t2078**: one flex toolbar row above
  the editor; indent/comment buttons retired to their keyboard shortcuts.

### 7. The lathe icon doesn't read as a lathe setup
*(human, 2026-08-19: "the lathe icon is not really looking like a lathe setup")*

⚠ **Establish WHICH icon before touching anything — there are two distinct families and they have different
histories:**
- **The lathe OP icons** (`ui/wizIcons.js`, `user_lathe_facing` / `odturn` / `parting` / `centerdrill` /
  `polygon`) — a deliberately-designed set (t1911) sharing one constant: a steel bar on a red dashed
  centreline, each op differing by what the CUT removes. ⚠ These were ALREADY revised once (t1918) after the
  human found the first pass too small at the real 14px render — the fix was heavier, fewer marks, re-derived
  from `rotary_center`'s proven weight. Do not quietly undo that.
- **The lathe MACHINE-KIND mark** — whatever represents "this workspace is a lathe" (the identity line renders
  `· Lathe` as TEXT today; `settingsPanel.js` has `latheEnvelopeSvg`). If the complaint is about the machine
  rather than the ops, this is the one, and it may not exist as an icon at all.

**Ask the human which, and get the specific "doesn't look like":** a lathe setup reads as chuck + bar +
tool-on-a-cross-slide; the current op family draws bar + centreline + cut only, with no chuck and no tool
post — which is a plausible reason it reads as "a rod" rather than "a lathe". ⚠ Whatever changes, it must
survive **14px** — that constraint is what t1918 was entirely about, and it is where the first attempt died.
