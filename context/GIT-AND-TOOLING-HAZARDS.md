# GIT & TOOLING HAZARDS — environment traps that have already cost real time

⭐ **This file exists for the same reason `RUNNING-THE-LOOP.md` does**: these were written to a LOCAL
memory first, invisible to the other seat and to the same role on another machine. Anything about how
a SHELL COMMAND, TEST RUNNER, or GIT OPERATION behaves in THIS repo belongs here — not a fact about one
machine's own ports/paths (that stays local), and not about loop mechanics (see `RUNNING-THE-LOOP.md`).

Migrated 2026-09-02 (t2519) from 86 local `feedback`-type memories; full triage record in `WORK-LOG.md`'s
own t2519 entry.

---

## 1. A backslash escape inside a Bash-heredoc Python write arrives with one backslash consumed

Writing a file via `python - <<'PYEOF'` in the Bash tool — even with the heredoc quoted, which should pass
content through literally — loses a level of backslash escaping somewhere between the tool call and Python.
A two-backslash escape (`\\n`, meant as the 2-char text `\n`) arrives as one backslash (`\n`), which Python
then interprets as an actual newline; `\\0` similarly becomes a real NUL byte. Hit twice in one day: a `NUL`
byte landed in `BACKLOG.md` itself (making `git` treat the whole file as binary), and a `\n` inside a JS
string literal in a published artifact became a literal newline, unterminating the string and killing every
script on the page — which looked like a layout bug, not a syntax one, until traced.

**Use the Write/Edit tools for any content containing escapes** — they never pass through a shell, which is
the actual fix, not a workaround. If a Python patch is genuinely needed, avoid escapes entirely (`chr(10)`,
`String.fromCharCode(10)`, or array `.join()` instead of embedded newlines). Neither failure errored at write
time — verify with `open(p,'rb').read().count(b'\x00')` (must be 0) and, for any HTML with inline JS,
`node --check` on the extracted script before publishing; a JS syntax error there kills the whole page, far
from the file that caused it.

## 2. `rm -rf` on a directory containing a Windows junction deletes the TARGET's contents

Git Bash's `rm -rf` follows a junction (`mklink /J`) and deletes what it points at, not the link itself. A
worktree cleanup that junctioned `node_modules` to the real one wiped the real `node_modules` from ~1500
entries to 0 — every node test then failed with `ERR_MODULE_NOT_FOUND`, which reads exactly like a code
regression in a release window. The tell that it's environmental, not a regression: EVERY node test fails
identically, breadth no source diff can produce. To avoid it: remove the junction FIRST with a tool that
unlinks rather than recurses (`cmd /c rmdir <link>`, no `/s`), then delete the parent — or skip the junction
and just run `npm ci` in the worktree. Recovery is `npm ci` (a build artifact, nothing lost).

## 3. A NEW `web/` file 404s until the mem-server is killed — and an EDITED file serves stale silently

`tests/support/mem-server.cjs` preloads `web/` into memory with ONE `fs` walk at startup and never re-reads
disk. A file created after the server booted 404s loudly (`Failed to fetch dynamically imported module`); a
file EDITED after boot is served from the stale preloaded copy with no error at all — the old logic just runs,
and a test asserting the new behavior looks like it did nothing. `node -e "createServer()..."` only tests
whether the port is free, it does not free it. After editing ANY `web/` file, kill the holder on port 3211
before running specs:
```
PID=$(netstat -ano | grep ":3211" | grep LISTEN | awk '{print $NF}' | head -1); taskkill //PID $PID //F
```
This also applies to a long-lived verification server the advisor keeps up for its own two-method checks —
restart it immediately before running any advisor check against a worker's fresh commit, and prove freshness
by fetching a changed file and grepping for the new symbol rather than assuming. The one edit that needs no
restart is a TEST file (`tests/*.spec.js`) — Playwright reads those from disk directly.

## 4. VS Code's Live Preview caches ES modules independently of any browser

The owner sometimes views the app in VS Code's Live Preview rather than a real browser tab. It's an embedded
webview with its own module cache, its own origin, and its own reload semantics — a browser hard-reload does
not apply to it, and it can serve a MIX of current and stale modules, producing symptoms no code change
explains ("it worked fine just before," no deploy in between). Once cost a full investigative act (7
independent reproductions across wizards/widths/themes, all green) before the actual cause surfaced. The cheap
discriminator, asked BEFORE dispatching an investigation: **"does it look right in a real browser window?"**
Browser-fine → Live Preview is the variable, drop it. Browser-broken → a real bug that survives a clean
environment. Don't over-apply this either — a genuinely unreproducible symptom can still be a real bug (a
cross-op state latch that only appears in a multi-op program a fresh boot can't produce); "cannot reproduce"
is a prompt to ask what differs about the environment, not proof of a phantom.

## 5. Testing a focus-dependent bug with `.value=` + one `dispatchEvent` can never catch it

`inp.value = 'query'; inp.dispatchEvent(new Event('input'))` fires the handler exactly once with the whole
string already in place — it never routes through the browser's own per-keystroke focus delivery, so a bug
where focus silently moves away mid-typing (each subsequent real keystroke landing somewhere else) is
structurally invisible to this pattern no matter how many assertions surround it. A production bug shaped
exactly this way (a find-bar's own auto-jump-to-first-match calling `.focus()` on the EDITOR on every
keystroke, routing typed characters into the user's live G-code program) survived three separate turns of
find-bar verification, all using the synthetic pattern, and was only caught when a real user typed on a real
keyboard. For any control where focus identity matters during interaction, use `page.keyboard.type(text,
{delay})` for the typing step — real sequential keydown/keyup delivered to whatever element currently holds
`document.activeElement` is the only thing that can catch a focus-theft-mid-typing bug. Pair it with an
explicit `document.activeElement` check at each step and a byte-identical before/after check on whatever the
stray keystrokes could have corrupted — that byte-identical check is the real acceptance test, not just
"does the right text end up in the search box."

## 6. Merging a light module into a heavy one: extract pure functions into their OWN new module first

ES module imports execute a file's entire top-level code, not just the functions actually used. If a
lightweight, node-testable module (only pure helpers, no DOM) gets folded into a heavier one that pulls in
browser-only dependencies (canvas/viz modules, `dialog.js`, DOM APIs), importing the pure functions from the
merged file breaks any node-tier test importing them — `ReferenceError: window is not defined`, thrown
immediately on import, well before the actual function under test ever runs. Before merging a light file's
logic into a heavier one: check whether the light file has its own node-tier test importing it directly, and
whether the heavy file imports anything DOM/browser-only. If both are true, extract the pure functions into
their OWN new small module (named for what they do, not which UI feature calls them) that only the light
dependencies need — both the surviving UI file and the node test import from that new module.

## 7. NEVER pass `--reporter` to `npx playwright test` in this repo — it replaces the config's reporters wholesale

`playwright.config.js` runs `progressReporter.mjs` + a `json` reporter (`test-results/summary.json`) by
design — built specifically to replace the noisy default `list` reporter for a 25-50 minute full suite (`list`
buffers ~530KB of stdout, discarded once the tool call ends, with no progress signal until the whole run
completes). A `--reporter=list` CLI flag silently defeats both: it doesn't add to the configured array, it
REPLACES it, going straight back to the buffered-until-completion output the project moved away from, and
`test-results/progress.md` never updates. Run `npx playwright test` (with `-g`/file filters as needed) with NO
`--reporter` flag; read results from `test-results/summary.json` or `test-results/progress.md`, never parsed
stdout. If a run is already in flight with the flag baked in, let it finish rather than killing it.

## 8. Never let the merge-gate suite and a worker's own suite run concurrently — it manufactures mass fake reds

Two Playwright suites running on one machine each spawn their own worker pool, and the resulting contention
produces mass timeout failures that look exactly like product regressions — 149 "failed" on a commit that,
run alone, was 2360/0. The signature: reds spread across dozens of unrelated spec families, inflated total
runtime, the app boots at the right version, and every failed spec passes cleanly in isolation. Sequence
gating strictly: read pass-back → review the diff → run the gate → read the verdict → only then dispatch the
next act if it runs specs. A SMALLER, more deceptive version of the same hazard comes from ANY concurrent load
on the same machine, not just a second Playwright run (a busy Python process, a driven poller script) — that
version produces 2-3 non-repeating timeouts that read exactly like ordinary flakes. The tell distinguishing
this from a real regression is NON-OVERLAP: two runs of the same gate, 30 minutes apart, failing DIFFERENT
tests with zero overlap, all `TimeoutError` rather than assertion failures, all passing in isolation — a real
regression fails the SAME test every time. When the release gate must be trustworthy, run it while the other
seat is genuinely idle; a "0 unexpected" only means something on a quiet machine.

## 9. Before trusting any merge-then-gate sequence, confirm HEAD actually IS the tip you gated

A piped state-changing git command inside a chain loses its own failure signal — `git merge --ff-only X |
tail -1 && npx playwright test …` ran the suite on the PREVIOUS release after the merge was silently REFUSED
(a prior gate run had dirtied `verification/*.png`, which the incoming commit also touched), because the pipe
made the `&&` chain see `tail`'s exit 0 instead of the merge's real failure — producing a "green" that verified
nothing. Never pipe a state-changing git command inside a gating chain; run it bare and read its own output.
After any merge-then-gate sequence, assert `git log -1` shows the tip actually under review before trusting
the verdict. Before merging in a verification worktree, `git checkout -- DDCS-Studio/verification/` — the
suite's own screenshot specs re-render those PNGs nondeterministically on every run, and an incoming release
regularly touches the same files. And: "Everything up-to-date" on a deploy step that should have moved a ref
is a signal to stop and verify, never to read as success.

## 10. A hardcoded prefix/offset constant silently desyncs when the structure it counts changes elsewhere

Removing one wrapper node from a `uiChildren` array broke a twin's registration entirely (11 cascading test
failures) because a SEPARATE constant elsewhere in the same file — `WRAP_PREFIX_COUNT`, a hand-counted number
of wrapper nodes added to every binding's `blockIndex` to compute its real position in the flattened template
— still assumed the OLD wrapper count. The removal never touched that constant; every binding silently pointed
one slot too late. Most of this project's ops resolve bindings by macro-var IDENTITY (robust to this kind of
shift automatically); a handful of older, index-based ops (still `grep`-able as `WRAP_PREFIX_COUNT` in
`atcWarmupData.js`/`contourData.js`/`tapData.js`/`textData.js` as of this writing) predate that system and are
exactly where this bites. Before removing or adding any node from a `uiChildren`/template wrapper shape, grep
the file (and sibling files using the same pattern) for `blockIndex`/`WRAP_PREFIX_COUNT`/any literal number
that might encode "how many wrapper nodes precede the real content." Registration-time validation usually
throws rather than silently mis-wiring on a real drift — treat that throw as a real signal, not collateral
noise from an unrelated change.

## 11. A themed CSS custom-property's DEFAULT must be declared at `:root`, never on the consuming selector

In this project's per-theme CSS token system, a token's default value has to live at `:root` (or another
low-specificity shared block) — never directly on the selector that CONSUMES it via `var()`. If the consuming
selector also declares the property's own "default" (specificity higher than a plain `:root` rule), that
declaration beats a per-theme override sitting in a lower-specificity `[data-theme="x"]` block, and the
override silently never applies — no error, `getComputedStyle` just keeps returning the consumer's own
hardcoded value forever. This reproduced a bug an existing precedent in the same file had already solved,
because the new code copied the SHAPE of the working pattern without copying WHERE its default actually lived.
When adding any new themed token: declare the token and its default at the lowest-specificity shared block,
have every theme's own block override that SAME property, and have the actual consuming selector only ever
read via `var()`, never redeclare the token itself. If a theme override doesn't seem to be applying, measure
the actual computed style live rather than assuming the CSS is correct because it "should" win.

## 12. A custom property declared as `--x: var(--y)` freezes `--y`'s value AT THE DECLARING SELECTOR

When one CSS custom property's own default is itself another custom property (e.g. `--token: var(--bg);`
declared at `:root`), that `var(--bg)` reference resolves ONCE, at the element where `--token` is declared —
it does not re-evaluate live at every element that later inherits `--token`. If `--bg` is later overridden
per-theme on a descendant selector, that override can never reach back and change the already-frozen inherited
value of `--token` — every theme ends up rendering the identical frozen value from wherever `--bg` first
resolved at the original declaration, usually an unrelated "neutral fallback" literal. This looked identical
to an EARLIER working pattern in the same codebase, and only differed because nothing outside that earlier
pattern's own narrow scope ever consumed the frozen token — so its wrong value was never actually exposed
anywhere visible. If a token's default should mean "whatever some OTHER theme-adaptive token currently
resolves to, unless explicitly overridden": do not declare `--token: var(--other-token);` at `:root` at all.
Instead declare no default for `--token` (or only a genuinely inert literal like `transparent`, which needs no
resolution and carries no freezing risk), and put the fallback on the CONSUMING rule instead —
`background: var(--token, var(--other-token));`. A `var()` fallback (the second argument) IS re-evaluated live
at the element that reads it, which is the actual "resolves per-theme automatically" behavior this needs.
Verify by measuring computed style across every theme that's supposed to differ — not by assuming correctness
because the CSS mirrors an earlier pattern that happened to work for unrelated reasons.

## 13. `npx playwright test` with no `cd` in the same command can silently fetch a SECOND Playwright version

Playwright lives in `DDCS-Studio/node_modules`, not the repo root. The Bash tool's cwd persists across calls,
so a `cd <repo root> && git …` (routine for a commit) leaves the shell there — a LATER `npx playwright test …`
with no `cd` of its own then runs from the repo root, where there's no local install, so `npx` silently fetches
a DIFFERENT version. The result is a collection-time error that points at an unrelated line:

```
Error: Playwright Test did not expect test.use() to be called here.
"You have two different versions of @playwright/test" … "No tests found."
```

The file is fine (`npx playwright test --list` still collects it) — this is not a code-structure problem. Tell:
`ls node_modules/@playwright` fails from the current cwd. Fix: put `cd DDCS-Studio` in the SAME command as
every `npx playwright` call, never rely on a prior `cd` still being in effect. ⚠ **It can MASK a real failure**
— if a full-suite run reported a spec as genuinely `failed` and a targeted re-run throws this instead, the
failure is real; fix the cwd and re-run, don't conclude "spurious."

A second, rarer cause with the SAME symptom (cwd already correct, after rapidly rewriting a spec file with
several Write/Edit passes in quick succession): a stale transform cache. Fix — delete
`"$TEMP/playwright-transform-cache"` (NOT `node_modules/.cache`, clearing that does nothing), then run the
explicit file path (a bare substring filter collects flakier than an exact path).

## 14. `bridge/bridge-app/**` print()/log output must stay pure ASCII — a non-ASCII character kills the whole gateway thread

The gateway's Python console is cp1252, not UTF-8. An uncaught `UnicodeEncodeError` from a `print()`/log call
inside `run_loop` crashes the entire background thread silently — no traceback surfaces where anyone is
watching, the gateway just stops responding. Keep every string destined for that console pure ASCII (no
em-dashes, no curly quotes, no Unicode arrows) — write the plain-ASCII equivalent instead.

⚠ **The same class of bug, from the OTHER direction (2026-09-02):** round-tripping a UTF-8 file THROUGH
PowerShell 5.1's `Get-Content` then `Set-Content` to patch a typo re-encodes it — em-dashes decode as cp1252
and a BOM gets added, silently corrupting the file. This is exactly how a release commit message got mangled
in git history (permanent once pushed — rule 2 forbids force-pushing a shared branch). **Never round-trip a
UTF-8 text file through PowerShell to fix a small mistake in it — rewrite the file whole with the Write tool
instead.** The two hazards share one root cause: this machine's default console/PowerShell encoding is cp1252,
not UTF-8, and anything that reads-then-writes text through it without an explicit `-Encoding utf8` silently
re-encodes.

## 15. A live Cloudflare Pages deploy can report the new `version.json` while the PAGE still runs cached ES modules

`ddcs-studio.pages.dev` serves `web/` raw with no build step and auto-deploys on push to `main` via
Cloudflare's own GitHub integration — invisible to `gh run list` (it isn't a GitHub Actions run). A deploy can
land and `version.json` can report the new version while the browser still executes a cached, OLDER copy of an
ES module — so "the fix didn't work" reports from a live-site check can be a caching artifact, not a real
regression. Verify a suspected live-site issue by fetching and grepping the SERVED file directly
(`curl https://ddcs-studio.pages.dev/path/to/file.js | grep …`) before trusting either a user's report or your
own browser — and if a deploy is genuinely stuck, an EMPTY commit does not unstick it; push a real content
change.

## 16. A companion tool exists for turning any website into a captioned tour video — `APPS/tourvid`

Lives **outside** this repo at `C:\Users\danse\APPS\tourvid` (its own `package.json` + Playwright + ffmpeg), so
it never touches the DDCS git tree. `record-segments.js <tour>` (preferred) records each section as its own
clip then crossfade-stitches them — no live-navigation stalls, and a crossfade can carry meaning. Needs the
full `Gyan.FFmpeg` (the Playwright-bundled build lacks h264/mp4/drawtext). First tour spec:
`ddcs-studio.tour.js`. Re-shoot with one command rather than re-editing when the (fast-moving) site changes.
