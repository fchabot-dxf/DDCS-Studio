/**
 * data/releaseNotes.js — the ONE declared source for "what's new," read by TWO views with DIFFERENT budgets
 * and DIFFERENT fallback behaviour (t2075, human-ruled through three rounds of amendment): the pre-update
 * banner (ui/updateCheck.js showBanner) and the post-update welcome modal (ui/updateCheck.js
 * checkWelcomeNotice). One stack, many views — the pattern this project already runs on elsewhere
 * (wizards-as-data, the ops IR) applied to release notes instead of building two parallel note systems.
 *
 * WHY THIS EXISTS RATHER THAN DERIVING BOTH FROM COMMIT SUBJECTS: the banner's notes (still capped at 3,
 * t2068) can be a cleaned-up commit title — "wire the master-side poller" reads fine as a terse pre-update
 * teaser. The welcome modal's job is different: read AFTER updating, when the user is already in and paying
 * attention, it can and should say the HOW ("turn this on in Setup → Beacons"). No transformation of a commit
 * subject produces that; it needs an authored source, so it is one.
 *
 * SCHEMA — keyed by the EXACT version string the .ver chip carries (bakedVersion()'s output, e.g. "10.20" or
 * "2026.08.17.11" — whatever format is live when a release is cut; match it exactly, no "v" prefix):
 *   RELEASE_NOTES[version] = [ { short: "...", full: "..." }, ... ]
 *     short — ≤ ~60 chars, the banner's pre-update teaser line (one bullet in "What's new ▾").
 *     full  — a real sentence or two INCLUDING how to use it where relevant; the welcome modal renders one
 *             panel per entry, in array order.
 *
 * A RELEASE THAT FORGETS TO WRITE NOTES HERE is NOT an error, but the TWO surfaces degrade DIFFERENTLY —
 * this asymmetry is deliberate, not an oversight:
 *   - the BANNER (pre-update, re-openable — filler there is cheap) falls back to derived commit-subject
 *     titles (userFacingNotes() in ui/updateCheck.js) when a version has no entry here.
 *   - the WELCOME MODAL (shown exactly once, gone forever after dismissal — filler there spends the one
 *     shot the user is paying attention) NEVER falls back to derived titles. A version with no entry here
 *     still gets the modal — its core job, confirming the update landed, does not depend on notes existing
 *     — but as a single bare "Updated to vX" panel with no body text at all, never a derived-title guess.
 *
 * WHO WRITES THIS: a human, at release-cutting time — this is the "add a real step to every release" the
 * ruling named plainly; not derived, not generated, not this file's job to keep populated automatically.
 */
export const RELEASE_NOTES = {
  "2026.08.19.7": [
    { short: "Send now works on a phone or a PC with no gateway",
      full: "The Send button did nothing at all on a device that isn't wired to the machine — no error, no "
        + "message, just silence. It was being switched off because no gateway answered, which stopped being "
        + "the right rule once a signed-in device can send through your Google Drive. It now reads \"Send via "
        + "Drive\" and tells you the machine picks the job up within about 15 seconds." },
  ],
  "2026.08.19.6": [
    { short: "Google sign-in now fixes itself on existing installs",
      full: "The previous release fixed sign-in for NEW installs only — a machine that had already run the "
        + "app kept the broken credential and still failed with \"this app's request is invalid\". It now "
        + "repairs itself on start. Just update and sign in; nothing to edit." },
    { short: "Send a job from a browser, with no gateway on that PC",
      full: "A PC or phone that isn't wired to the controller can now send too: the job goes into your Google "
        + "Drive and the machine's gateway picks it up within about 15 seconds. It sends as deliver-only "
        + "(no live progress bar) — progress needs the cable between the controller and its own gateway." },
  ],
  "2026.08.19.5": [
    { short: "Google sign-in works now",
      full: "Signing in to Google failed on every machine with \"this app's request is invalid\". The app was "
        + "shipping the wrong kind of Google credential — one that can't be used by a desktop app. Click the "
        + "avatar in the top-right and sign in; there is nothing to configure." },
    { short: "A failed sign-in now tells you why",
      full: "It used to say only \"Sign-in failed\". It now shows Google's own reason, so a problem can be "
        + "acted on instead of guessed at." },
  ],
  "2026.08.19.4": [
    { short: "The editor's buttons are one tidy row up top",
      full: "The buttons that used to float over the bottom-left corner of the editor — Make, Transform, undo, "
        + "redo — now sit in a single row along the top of the editor, together with Copy and Clear. Make and "
        + "Transform show just their icon now; hover any button to see what it does. If the pre-flight envelope "
        + "warning is long it will overlap them, on purpose: a safety message should never hide behind a button." },
    { short: "Load, Insert and Export moved to the ▾ menu",
      full: "They have left the editor's corner and now live in the ▾ quick menu beside the logo, with Save and "
        + "Open — the things you reach for when starting a program or finishing one. Clear stays down by the "
        + "editor, where the program it clears is." },
    { short: "The ; comment button is gone",
      full: "Commenting out selected lines is still there — press Ctrl+/ or use the right-click menu. The button "
        + "was one more glyph in a crowded corner for something two other doors already did." },
  ],
  "2026.08.19.3": [
    { short: "One sign-in, in the header, with your photo",
      full: "Signing in used to be in two different places that disagreed with each other about whether you "
        + "were connected. There is now ONE account button in the top-right of the header: a plain avatar you "
        + "click to sign in, which becomes your Google profile picture once you have. Click it any time for "
        + "your account details or to sign out. Signing in does not switch anything on by itself — saving "
        + "projects and sending jobs through Drive stay their own settings." },
    { short: "Undo and redo finally have keyboard shortcuts",
      full: "Program undo/redo had no shortcut at all — the two header buttons were the only way to reach it. "
        + "They now respond to Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y to redo, and the buttons themselves moved "
        + "down beside the editor. Typing in a text box is untouched: Ctrl+Z there still undoes your typing, "
        + "not your program." },
    { short: "A tidier editor and header",
      full: "The indent and outdent buttons are gone from the editor's corner — Tab and Shift+Tab already did "
        + "the same thing. The old Transfer button, which had been hidden for a long time and was replaced by "
        + "the Gateway tab's own Send, is removed too." },
  ],
  "2026.08.19.2": [
    { short: "Send jobs through your own Google Drive",
      full: "You can now send a program to your machine from anywhere, over the internet, using YOUR "
        + "Google Drive — no IP addresses, no port forwarding, no account of ours. Turn it on in "
        + "Gateway → Setup → Cloud storage: click Connect Google Drive, then tick \"Send jobs through my "
        + "Google Drive\" and restart. Do it on both PCs with the SAME Google account — the one you send "
        + "from writes the job, the one wired to the controller picks it up within about 15 seconds. "
        + "Live progress still runs on the serial cable, never on this." },
    { short: "Job history says how far a stopped run got",
      full: "A run that stopped early used to say only \"stalled\". It now says how far it actually got "
        + "— \"signal lost at 12/40\", or \"no signal after delivery\" when the job was delivered but "
        + "never started. It still never guesses WHY it stopped: an operator abort, a lost cable and a "
        + "genuine hang look identical from here, so naming one would be a lie." },
    { short: "DM500 dumps now read real machine settings",
      full: "Importing a DM500 (V3) controller dump used to show every value as \"N/A\" — its settings "
        + "file is stored in a different format than the Expert and V4.1, and that format had never been "
        + "decoded. It has been now, so a DM500 dump reads its real envelope, homing and speeds like the "
        + "other controllers." },
  ],
  "2026.08.19.1": [
    { short: "The command deck now works on a phone",
      full: "Opening the deck on a narrow screen used to hide its entire keypad — all 22 keys were "
        + "clipped away with no way to scroll to them. The pane scrolls properly now, and the ENTER key "
        + "and the Variables tab are no longer sliced off the right edge." },
    { short: "Your typing cursor matches your theme",
      full: "Studio, Futuristic and Organic each declared their own caret colour, and none of them had "
        + "ever actually appeared — every theme showed a plain white cursor. They paint now, and "
        + "Studio gets a block cursor while Futuristic gets an underscore." },
    { short: "Form fields are themed everywhere",
      full: "In four of the five themes the boxes inside a wizard were raw browser defaults — white "
        + "rectangles on a dark panel. They now follow the theme, and keyboard focus finally shows a "
        + "visible ring on inputs and buttons." },
  ],
  "2026.08.18.1": [
    { short: "One-click update no longer hangs",
      full: "The in-place update used to stick on “Updated — restarting…” forever. "
        + "It now relaunches properly, and if anything does go wrong it tells you the real reason instead "
        + "of a frozen screen. ⚠ Updating INTO this version from an older one may still appear to "
        + "hang — that is the old bug having one last go. If it does: close DDCS Studio and open it "
        + "again. The update is already installed and you will come back on the new version." },
    { short: "You now get told when an update lands",
      full: "After updating, a short panel tells you which version you are on and what changed — one "
        + "page per item, and “Skip all” closes it. It appears only when the version actually "
        + "changes, never on an ordinary launch." },
    { short: "Machine values read correctly again",
      full: "Pulling settings from the controller was reading the wrong slot, so a taught work offset "
        + "could come back as 000. Fixed, and the same address is now defined in one place instead of "
        + "four, so it cannot drift apart again." },
  ],
};
