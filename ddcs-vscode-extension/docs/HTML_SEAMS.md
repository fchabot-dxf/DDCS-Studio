# `extension_index.html` — seams & the de-fork path

> Status: **managed fork.** `web/extension_index.html` is a fork of `DDCS-Studio/web/index.html`.
> This note records the seams cut into it so it can be de-forked later without breaking wizards.
> It is intentionally *not* yet generated — the extension path is still experimental, so the fork
> stays editable by hand until the approach settles.

## Why it's a fork (not a skeleton)

The early framing was "strip the 135 KB HTML to a skeleton." That's wrong: the file is mostly
**load-bearing**. The `#wizard` overlay holds all 38 wizard forms (hundreds of `d_*`, `p_*`, `atc_*`
inputs), their `#wiz_*_code` output blocks, and viz containers. The wizards in `dist/bundle.js`
read/write those IDs by hand. Stripping them would break every wizard.

So the file is a near-copy of Studio's `index.html` with a small extension-specific delta. That delta
is the only thing worth hand-maintaining; everything else is drift waiting to happen.

## The four seams

Search the file for `SEAM:` — each boundary is marked inline.

| Seam | Location | Owner | De-fork? |
|------|----------|-------|----------|
| **EXTENSION SHELL** | `<body>` → end of `.wrap` | extension | keep — extension's own chrome (wizard-bar, `#ws`, `#gw-status`) |
| **SHARED WIZARD BODY** | `#wizard` → `#global-tooltip` | forked from Studio | **yes — the drift surface** |
| **EXTENSION BOOTSTRAP** | (removed dead block) | extension | n/a — Studio's `./app.js` bootstrap was dead here; boot is `bundle.js` |
| **SHARED WIZARD VIZ** | inline SVG `<script>` | forked from Studio | **yes — same drift surface** |
| **EXTENSION ENTRYPOINT** | `dist/bundle.js` | extension | keep — esbuild of `web/src/extensionApp.js` |

Only the two **SHARED** seams drift. The shell and entrypoint are genuinely extension-owned.

## De-fork options (pick when the extension approach settles)

**A. Build-time generation (recommended end-state).**
Add a `build:html` step (alongside `build:web`) that reads canonical `DDCS-Studio/web/index.html`,
extracts the `#wizard…#global-tooltip` body + the SVG viz `<script>`, and splices them into a small
extension shell template (`extension_shell.html`, with a `<!--WIZARD_BODY-->` marker). Output
`extension_index.html` becomes generated + `.gitignore`d. Single source of truth → zero drift.
*Cost:* one more build script; the extract markers must be stable.

**B. Runtime splice in `DdcsEditorProvider`.**
The provider already reads `extension_index.html` and rewrites asset URLs. It could additionally read
Studio's `index.html`, extract the two shared regions, and inject them into the shell at load time.
No build step; de-forks immediately. *Cost:* fragile string surgery at runtime; breaks loudly if
Studio's markup boundaries move.

**C. Stay a managed fork (today).**
Keep the seams marked and re-sync by hand when a wizard changes. *Cost:* manual drift management —
fine while experimenting, not for ship.

When ready, **A** is the target. **B** is a reasonable stepping stone if a build step is unwanted.
Until then we're at **C**, with the seams making A/B mechanical to adopt.
