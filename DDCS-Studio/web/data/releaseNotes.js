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
