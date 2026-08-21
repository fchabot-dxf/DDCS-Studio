# BOOT-SPLASH-PLAN — apply the theme before first paint, then show the logo

**For the SECOND worker seat.** Paired with [`ORGANIC-TREE-PLAN.md`](ORGANIC-TREE-PLAN.md) — do that one too;
they are the same arc and they touch the same two files.

---

## SCOPE — two files, and only two

Both tasks live entirely in **`DDCS-Studio/web/styles.css`** and **`DDCS-Studio/web/index.html`**.

- ⛔ **Stage by explicit path. NEVER `git add -A` or `git add .`** — concurrent staging has twice swallowed
  the other seat's uncommitted work in this repo, and the advisor may be committing docs alongside you.
- ⚠ An EMPTY commit means the other seat already took your changes. Do not "fix" it by staging more.
- ⛔ Do not run the release/version bump. That is the advisor's.
- ⚠ **wizards-as-data is queued next and touches `blocks/dataOps/` + `wizards/`.** Nothing in this plan
  should reach those directories; if you find yourself editing one, stop and say so.

---

## TASK 1 — apply the saved theme BEFORE first paint

### The bug, and why the obvious fix is wrong
`index.html:18` is literally `<body data-theme="studio">` — **hardcoded in the markup**. Every script in
`<head>` is `defer`, so nothing runs before first paint, and `themes.js:40` only *rewrites* that attribute
later from JS after reading `localStorage`.

⇒ **Two consequences.** The boot splash always renders as studio and cannot follow the real theme. And every
user whose saved theme is not studio gets a **studio flash on every single load**.

⚠ The tempting fix — "make the splash theme-independent" — is wrong. It treats the symptom. The theme *can*
be applied before paint; it just isn't.

### The fix — three lines, inside `<body>`
Add a **tiny inline script as the FIRST CHILD of `<body>`**, immediately after the `<body>` tag at
`index.html:18` and **before** the boot-loader div at `:19`. It reads `localStorage` key **`ddcs_theme`** and
sets `document.body.dataset.theme`.

- ⛔ **It MUST be inline and MUST NOT be `defer` or external.** Blocking execution during parse is the entire
  mechanism — it then runs before the loader div is parsed, so nothing ever paints under the wrong theme.
- ⚠ **Wrap in try/catch.** `localStorage` throws in private mode and on `file://` — `themes.js:13` already
  guards it exactly this way; follow that precedent.
- ⭐ **VALIDATE the value** against the five known theme names (`studio`, `futuristic`, `organic`,
  `steampunk`, `normal`) before applying. A stale or garbage entry must not set an unknown `data-theme` and
  leave the app completely unstyled — a worse failure than the flash it fixes.
- **KEEP `data-theme="studio"` in the markup.** It is now correctly the FIRST-RUN FALLBACK.

---

## TASK 2 — the splash shows the LOGO, not the text

Now that the theme applies before paint, the splash can be themed. Put the themed logo in the boot card,
**keep the spinner**, and **drop the "Loading DDCS Studio..." string** — the logo says WHO, the spinner says
WORKING, and saying it twice is what made the text both redundant and (see Task 3) unreadable.
⚠ **Keep the `aria-label`** already on each `<svg>` so the identity survives for a screen reader.

### ⛔ THREE TRAPS — each produces a confusing failure, not an obvious one

**1. The show/hide selectors are ASYMMETRIC.**
`styles.css:294` hides via `.app-header .logo { display: none }` — **scoped to the header** — while
`:295-300` shows via `[data-theme=X] .logo-X { display: block }`, which is **global**. Put
`class="logo logo-studio"` in the splash (outside `.app-header`) and the hide never applies while the show
does ⇒ **all five wordmarks stack on top of each other.** Either unscope the base hide or give the splash its
own. ⛔ Do not "fix" it by hardcoding a single mark — the splash must follow the theme like the header does.

**2. Parse order.** The `<svg width="0" height="0">` symbol defs are at `index.html` ~line 27, **below** the
loader at `:19`. A `<use>` referencing a symbol declared later can flash empty on first paint — the exact
moment this element exists for. **Move the defs block above the loader.** Pure reorder, no logic change.

**3. The mark fills are tuned to the HEADER, not the card.** Studio's is `#f0eee8` over `#55514a`, normal's
is `#C7A900`. The header is `--band-bg`/`--hdr-bg`; the splash card is `--modal-face`, which is `--panel`.
**Not the same surface.** Look at all five on the card — especially **organic**, whose `--panel` changes under
`ORGANIC-TREE-PLAN.md` in this same batch, and **studio**, whose engraved two-layer mark depends on contrast
against a mid grey. ⚠ **If one does not read, say so — do not silently recolour a mark.** Those fills are
deliberate per-theme design.

---

## TASK 3 — the hardcoded ink (do this regardless)

`styles.css:6194-6200`: `.ddcs-busy-card` takes `background: var(--modal-face)` (themed), but
`.ddcs-busy-text` hardcodes `color: #dbe8f5` (near-white) and `.ddcs-busy-spin` hardcodes its ring as
`rgba(255,255,255,.18)`. On any light-surfaced theme that is **white on white** — only the blue arc of the
spinner survives, which is exactly what a phone screenshot showed.

⭐ **The fix is the house pattern, not an invention:** every other modal pairs those tokens — see
`styles.css:2009`, literally `background: var(--modal-face); color: var(--text);`. Give the text
`color: var(--text)` with `#dbe8f5` as fallback, and derive the ring from the same ink.
⚠ **That class has OTHER users beyond the splash** — this fix matters even after Task 2 removes the splash's
own text.

---

## Done when

1. A non-studio theme survives a reload with **no studio flash**.
2. The splash shows the correct themed logo, spinner intact, no text, `aria-label` preserved.
3. All five themes checked **on the card**, and any mark that does not read is REPORTED, not recoloured.
4. `ORGANIC-TREE-PLAN.md` applied (the same two files).
5. `cd DDCS-Studio && npm test` — ⚠ check the **FAILED COUNT**, not just the tail; "N passed" can hide
   "N failed". The current known-stable baseline is 5 pre-existing failures; anything beyond that is yours
   until proven otherwise by an isolated re-run.
6. Screenshots: a wizard and the Blocks tab **in organic**, plus the boot splash. The human judges these in
   the real app, not from a description.
