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
    '2026.08.22.2': [
        { short: 'Sound was silent on iOS and unreliable on Android — both fixed (mobile hotfix)',
          full: 'The themed sound suite shipped in the last release did not actually play on a phone: on '
              + 'Android it was a race (the app started playing before the browser had finished waking up '
              + 'audio, so the sound landed too late to be heard); on iOS it was silent outright, because '
              + 'Safari requires a sound to be started directly inside your very first tap before it will '
              + 'allow any sound at all. Both are fixed. ⚠ The Android fix is confirmed on a real device; '
              + 'the iOS fix is written exactly to Apple\'s documented requirement but has not yet been '
              + 'confirmed on a real iPhone — if sound is still silent for you on iOS, please say so.' },
    ],
    '2026.08.22.1': [
        { short: 'A themed sound suite, with one switch for everything',
          full: 'UI clicks, wizard open/close/insert, and Blocks-canvas errors now have themed sound — each of '
              + 'the five visual themes has its own voice (5 themes x 4 events). Job-arrived / delivered / failed '
              + 'keep the same learned door-chime / cash-register / buzzer sounds as before, unthemed, and now '
              + 'play on the gateway (the machine) only, not the browser; a new synthesized swoosh marks the '
              + 'moment a job leaves your browser instead. One master mute, plus a per-sound off-list if you only '
              + 'want to silence one thing — both in Settings > Look and feel > Sound, and both travel with your '
              + 'workspace file and reach the gateway too, so the switch never lies on one machine.' },
        { short: 'Organic theme retired its coral accents for a green-and-brown "grove" look',
          full: 'The organic theme\'s palette was originally anatomical (coral/bone tones) while its icon and '
              + 'motion were always meant to read as botanical. It now matches: green above (the header/topbar '
              + 'band), brown grounds below, amber for anything interactive — sap and bark, not coral.' },
        { short: 'The loading screen no longer flashes the wrong theme on startup',
          full: 'Every non-default theme used to show a brief flash of the default look before switching over on '
              + 'every single load. Your saved theme now applies before the very first pixel paints, and the '
              + 'loading card shows your theme\'s own logo mark instead of hard-to-read placeholder text.' },
        { short: 'The editor\'s Copy button now actually shows it worked',
          full: 'Clicking Copy already copied the program to your clipboard, but the "copied!" flash that was '
              + 'supposed to confirm it never actually appeared — a leftover styling mismatch. Fixed; the button '
              + 'now visibly confirms the copy.' },
    ],
    '2026.08.21.1': [
        { short: 'Rigid tapping now actually synchronizes the spindle (a real safety fix)',
          full: 'Rigid (G84-style) tapping was missing the controller vendor\'s spindle-sync sequence — on a '
              + 'servo spindle it could feed the tap to full depth with the spindle not actually turning. It now '
              + 'emits the correct switch-to-servo / sync / tap / switch-back sequence, and only when Settings > '
              + 'Machine > Spindle attests you actually have a rigid-tap-capable servo spindle with its mode-switch '
              + 'port wired — otherwise it safely falls back to the standard floating-holder cycle instead. '
              + 'Verified by automated test and independent review.' },
        { short: 'Drill/peck/dwell cycles now set an explicit retract plane',
          full: 'Canned drilling cycles used to retract to whatever plane the previous operation happened to '
              + 'leave live — between holes that could mean clearing a clamp, or driving through it. They now '
              + 'explicitly retract to the safe initial plane every time. Verified by automated test.' },
        { short: 'CAM pack export now matches the vendor\'s real file layout',
          full: 'The CAM-menu pack builder was writing files at a name and location the controller\'s own '
              + 'dispatcher does not look for. It now matches the vendor\'s documented layout, confirmed against '
              + 'a real controller\'s own settings file. ⚠ Documentation-conformant, but NOT yet verified end to '
              + 'end on real hardware — no Studio-built CAM pack has been loaded onto a machine yet. Treat this '
              + 'as unproven until someone confirms it on a real controller.' },
    ],
    '2026.08.20.1': [
        { short: 'Sending through your Google Drive actually works now',
          full: 'The app was hard-wired to the local gateway: choosing Google Drive in Setup saved correctly, '
              + 'then the restart it asked you to do put it straight back to local. So Drive was never really '
              + 'reachable from the installed app. It is now - pick it in Setup > Cloud storage, connect your '
              + 'account, and restart once.' },
        { short: 'Send is blocked unless the machine can actually take it',
          full: 'Studio now checks two things before letting you send: that a gateway is running, and that the '
              + 'CNC is powered on. Both are shown above the Send button with a coloured dot each. Previously a '
              + 'job sent to a switched-off machine was accepted and then quietly destroyed on delivery - it is '
              + 'now refused up front, while you are still standing there and can do something about it.' },
        { short: 'A chime when a job arrives, lands, or fails',
          full: 'The gateway PC plays a sound at the machine: a shop-door chime when a job arrives, a cash-register '
              + 'ding when it reaches the controller, and a buzzer if it fails. Three different sounds on purpose - '
              + 'you can tell them apart across a shop without looking. Turn it off in Setup if you would rather not.' },
        { short: 'A job for the wrong controller is refused, wherever you send from',
          full: 'Sending a program to a controller it was not written for was already blocked when Studio could see '
              + 'your gateway directly. That check could not run when sending through Drive from a phone - the exact '
              + 'case where you are furthest from the machine. It now runs on both paths, using the same comparison.' },
        { short: 'Phone fixes: the trash button and the header at 390px',
          full: 'On a phone the editor toolbar trash had shrunk below a usable tap size, and the top header ran '
              + 'slightly wider than the screen. Both fixed, and the header now tells the console when it runs out '
              + 'of room to shrink instead of silently giving up.' },
    ],
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
