# t2128 — advisor review of 8a23f4d7 (themed sound suite)

Cold review, 5 dimensions, findings batch-verified adversarially. **36 raised, 36 survived.**

⚠ **Both blockers land on the configuration a RELEASE CREATES** — pushing to main deploys
ddcs-studio.pages.dev, and that hosted topology is where the sound switch stops reaching the gateway. The
test gate could not have caught either one, because neither exists until the app is deployed.

⛔ NOTHING HERE HAS BEEN ACTED ON. Findings only.

**Release verdict — commit `8a23f4d7` (themed sound suite)**

## 1. HOLD

Not a rewrite — two small fixes, then ship. Both blockers land on the exact configuration that a release *creates*: pushing to main deploys `ddcs-studio.pages.dev`, and that is the topology where the sound switch stops reaching the gateway.

## 2. Blocks release

**a. `DDCS-Studio/web/blocks/blocksApp.js:202` — the master switch does not silence the Blocks tab.**
`sounds:false` becomes `Options.hasSounds`, whose only consumer in the vendored bundle is `b.hasSounds && xj(b.pathToMedia, a)` — the *sample* preload. `playErrorBeep()` → `beep(260)` synthesizes an oscillator at gain 0.5 and is gated solely by `AudioManager.muted`, which nothing in the repo ever sets (`setMuted` appears once in 767 KB: its own definition). Repro: Sound OFF → Blocks tab → press Delete on a non-deletable node, or arrow past the end of a stack → 260 Hz sine at roughly 2× our earcons' 0.22. SOUND-PLAN.md §5b names `playErrorBeep(260)` explicitly; §7 DoD #1 is unmet; `blocksApp.js:196-201` and the commit message both state the opposite. Fix: `ws.getAudioManager().setMuted(true)` after inject, kept in sync with the toggle.

**b. `DDCS-Studio/web/ui/sound.js:307` — the sync POST ignores the gateway base.**
Bare `fetch('/api/config', …)` instead of the declared seam (`shared/js/client.js:11-21` `resolveBase()` → `setConfig`). On the hosted deploy the gateway is auto-adopted at `127.0.0.1:8765` (`ui/gateway/service.js` `adoptLocal`; `server.py:74` allowlists that exact origin so its `X-DDCS-Local` preflight is granted). Jobs route correctly through `makeClient()`; the sound prefs go to pages.dev and the mill PC keeps chiming. Compounded by (b′) `sound.js:313`, which then reports **"Gateway picked this up at HH:MM"** for a POST that never arrived. Caveat worth stating plainly: `settingsPanel.js:1711` already ships this same hardcoded shape, so the *pattern* is pre-existing — but this is the one feature whose contract (§5c, "or you ship a switch that lies on one machine") depends on it.

Fixing (b) is routing through `client.setConfig`; (b′) is `if (!r.ok)`.

## 3. Should fix

- `web/ui/sound.js:313` — `_lastSync.ok` never inspects `r.ok`; a non-JSON body collapses to `{}` → success. `server.py:277`'s 403 (`{"error": …}`, no `ok` key) also reads as picked up, while `st.error` is non-empty and never rendered.
- `web/ui/sound.js:299` — pushed only from two `change` handlers (`settingsPanel.js:1830`, `:3369`). Never at boot, on `replaceSettings()`, or on gateway adoption; the gateway's own `sound_enabled`/`sound_off` are returned by `ops.py:1125` and read nowhere. Divergence self-heals only if the user toggles twice.
- `web/ui/settingsPanel.js:210` + `:416` — `sound: { ...SETTINGS_DEFAULTS.sound, …}` copies the off-list **by reference**; `:1827` mutates it in place. Every existing user on first upgrade takes this path, and `replaceSettings()` (`:1017`, reached from `data/profileStore.js:92`) leaks the exception into workspaces that never set it. Python guards the identical hazard at `config.py:103`.
- `web/viz/gcodeViz3d.js:995` — the new glow passes `lastSeg.bx/by/bz` (part-frame) to `_glowAt` (`:2876`), which does `scene.add` + `position.copy` and wants **world**; the only other caller converts first. Off by `min(0,m.z) − stockFloorZ` ≈ 120 mm even with no pinned stock, correct only in the per-op view. Same class of bug `_probeDiscBurst` (`:3031`) already documents fixing.
- `bridge/bridge-app/fairy/ops.py:1202` — persists the raw body; `POST {"sound_off": 5}` returns ok, reloads as an int, and `bridge.py:146` raises `TypeError` swallowed by `poller.py:52-57` → **no job sound ever again**, silently. Not reachable through the shipped UI (CSRF-guarded, Studio always sends an array), but `tests/test_sound_toggle_2125.py:147` asserts the in-memory field and passes green against a corrupted file, contradicting its own docstring.
- `bridge/bridge-app/tests/test_sound_toggle_2125.py:86` — greps `inspect.getsource(run_loop)`. Empirically: inverting the guard's polarity **and** deleting the master mute each leave 12/12 green, because the asserted literals survive in the comment. `_on_sound` is a closure no test constructs. ~10 lines (a Poller with an injected `on_sound` + fake chime) closes it.
- `DDCS-Studio/tests/sound-toggle-2125.spec.js:135` — delete `!masterOn() || ` from `sound.js:261` and the entire suite stays green; the feature's central claim has zero coverage. (The test itself is honest — it asserts "never throws" and does that — the gap is that nothing else exists.)
- `DDCS-Studio/tests/sound-toggle-2125.spec.js:115` — preview test's sole assertion is `threw === null`; gating `previewSfx` would kill the ▶ button for every silenced sound and still pass.
- `DDCS-Studio/tests/sound-toggle-2125.spec.js:118` — the `enable_chime` spec passes at the parent commit and on full revert (`git grep enable_chime 8a23f4d7^ -- DDCS-Studio/web` → no hits, ever). It also greps the wrong three modules: `web/ui/gateway/views/admin.js` is where such a checkbox would live (it renders `enable_slave`) and isn't in the list. Only `test_enable_chime_is_fully_retired` really guards the ⛔ ruling.
- `DDCS-Studio/tests/node/sound-event-axes-2125.test.mjs:76` — the "every action resolves" guard loops a frozen 7-name literal (also `:57`, `:68`) instead of `Object.keys(ACTION)`, and misses `'error'`, added by this commit. A one-letter typo in a new ACTION entry renders a row + preview button and is silent, green everywhere.

## 4. Worth noting

- `bridge/bridge-app/fairy/bridge.py:143` — `_SOUND_ACTION_FOR` hand-codes Studio's ACTION names; renaming a key in `sound.js:189` desyncs the gateway with nothing asserting agreement. (Narrower than first reported: `chime.py`'s `_FILES` duplication is pre-existing and plan-sanctioned.)
- `web/ui/sound.js:175/176/181` — `ui.click`, `ui.toggle`, `file.saved` have no `sfx()` call site (8 exist repo-wide) yet render a toggle + preview. Polish: wire them or drop the rows; the keys are lifted verbatim from §3b, so the code matches the plan as written.
- `web/ui/sound.js:186-194` — §3b's `where: 'client'|'gateway'` never landed; the split survives as prose. Nothing breaks today, but it's the declaration the plan says the split should live in.
- `web/ui/sound.js:249` — `synth:'swoosh'` matched by `===` in the renderer; `const SYNTH = { swoosh: playSwoosh }` restores the one-line-in-ACTION rule.
- `web/ui/sound.js:199` — `voice:'click'` hardcoded above the `EVENT` lookup; the app's most-used sound's numbers sit outside the table and shadow any row added to it.
- `web/ui/sound.js:282` — `previewSfx` bypasses the 60 ms coalesce and `MAX_CONCURRENT` on the one button built for repeat clicking (the steampunk bell rings ~2.2 s).
- `web/ui/settingsPanel.js:1796` — prefix grouping yields six headings, four with a single row; `'error'` has no dot, so its label equals its own heading.
- `bridge/bridge-app/fairy/config.py:119` — no `enable_chime` read-forward: a deliberately muted gateway starts chiming again, and the retired key persists in `config.json` beside the new one (the exact two-switches shape the plan removes). `--no-chime` is now a `SystemExit 2`.
- `web/blocks/blockly/tokenGuard.js:110` — three Blockly feedback sounds removed, one `sfx('error')` added; `blocks.connected`/`blocks.deleted` are one row + one call each.
- `web/viz/gcodeViz3d.js:990` — the glow's own comment ("this branch runs exactly once") is wrong: the timeout reloops the animation, so it repeats forever like the `_beep` it replaces — and `_beep` was already dead code, so this is a net-new affordance, ~120-unit sprite against §5b's "quiet".
- `tools/bundle_standalone.py:16` — stale docstring, ~726 KB of orphaned base64 WAVs, and a new top-level `ctx` collision with `gatewayPanel.js:28`; `sound.js:143` has no `__ASSETS_BIN` fallback so the three job previews are silent in the single-file build. The tool is already broken at the parent commit (pre-existing `r3` collision) — this adds to it rather than causing it.
- `tests/node/sound-event-axes-2125.test.mjs:46` and `:36` — THEME checked only for "five distinct bases", none of §4's actual pitches; intervals and tempo/length unasserted (fail could be stretched to 3 s, `in` retuned to a third, all green).
- `tests/sound-toggle-2125.spec.js:157` — the client/gateway split is in the title, asserted nowhere.
- `tests/sound-toggle-2125.spec.js:166` — WAV reachability proven only against the dev mem-server, in the commit that removed the standalone build's audio-path patch.
- `tests/editor-copy-feedback-2125.spec.js:23` — click + a separate `evaluate` round trip races `headerPost.js:346`'s 600 ms class removal; under `workers:6` this can red a correct build. Candidate for the 6th failure not covered by the documented 5-test baseline — worth attributing before release either way.

## 5. Checked clean

- The ⛔ ruling itself: `enable_chime` and `--no-chime` are genuinely retired, `config.py`/`ops.py` now mirror `sound_enabled`/`sound_off` as one live pair, and `test_enable_chime_is_fully_retired` **does** fail on revert.
- Python per-instance off-list: `config.py:103` `field(default_factory=list)` + its test — correct, and the model the JS side should copy.
- The Sound tab renders itself from `ACTION` per §5c; no hand-written row list.
- §7 DoD #4's three named facts (counts 2/4/7, `fail.oct === -1`, tritone in `fail.steps`) are asserted at `sound-event-axes-2125.test.mjs:18-20, 27, 33`, and all nine node tests pass.
- Blockly's *sample* side is correctly silenced by `hasSounds` — the defect is only the synthesized beep.
- `settings-ia-regroup-1245.spec.js` 4→5 is a legitimate strengthening (exact ordered `toEqual` gained `set_tab_sound`), not a weakened assertion; `editor-copy-feedback-2125.spec.js` does fail on revert.
- `job.sent` swoosh and the three job WAVs resolve in the served build; the `previewSfx`-ungated-by-design behaviour matches §5c's ⭐ rule.