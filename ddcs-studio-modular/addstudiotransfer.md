# addstudiotransfer.md — send the current program to the CNC bridge

Add a **TRANSFER** button to the DDCS Studio header that pushes the current editor program to the
**DDCS Expert** through the existing **bridge gateway** (the `ddcs-pc-bridge` project), plus a
**CNC BRIDGE** config block in Settings. No SMB, no serial, no controller code lives here — Studio
just hands the bytes to the gateway with one HTTP POST; the gateway delivers them to the machine.

> Status: spec / not yet built. Scoped to **deliver-only** transfer (probe + macro `.nc` files).
> Tracking/beacons are explicitly **out of scope** (see §9).

---

## 1. Why this is a one-POST feature

The bridge gateway already exposes the exact operation we need, and the bridge protocol already names
**DDCS-Studio probe/util `.nc`** as its canonical *deliver-only* job type (a job with **no beacon map**:
the gateway copies it to the controller's CNCDISK, marks it `delivered`, done — no progress tracking).

So Studio does **not** build a transport. It becomes another *producer* for a gateway that already runs.
The whole integration is:

```
POST <gateway>/api/jobs    body: { "name": "corner_finder.nc", "nc": "<g-code text>" }
                           → { "jobId": "...", "name": "...", "tracked": false }
```

- Omit `map` ⇒ deliver-only (correct for every probe/macro Studio emits).
- The **same** contract is served by the gateway locally (`http://127.0.0.1:8765`) and by the cloud
  (`https://ddcs-bridge.pages.dev`, bearer-token). Studio only needs a **base URL** (+ token for cloud).
- Both gateway endpoints send `Access-Control-Allow-Origin: *`, so a browser `fetch()` works cross-origin.

Reference (bridge repo): `bridge-app/shared/PROTOCOL.md` §3 (job types), `bridge-app/fairy/server.py`
(local `POST /api/jobs`), `bridge-app/web/functions/api/[[path]].js` (cloud `POST /jobs`, bearer auth).

---

## 2. Reachability — the one decision that drives the config

The payload is identical everywhere; only the **base URL + token** differ by where Studio runs relative
to the gateway. This is what the Settings block configures:

| Studio runs on… | Gateway base URL | Token | Notes |
|---|---|---|---|
| **The same PC as the gateway** (CNC-FAIRY) | `http://127.0.0.1:8765` | — | gateway started with `--serve` |
| **Same LAN** as the gateway | `http://<gateway-ip>:8765` | — | gateway started with `--serve --host 0.0.0.0` |
| **Anywhere else** (the design PC) | `https://ddcs-bridge.pages.dev` | required | cloud; gateway polls R2 and delivers when awake |

There is no auto-discovery. The operator pastes one URL (+ token if cloud) into Settings, once.

---

## 3. UX

### Header button
A new **TRANSFER** button in `.hdr-controls`, immediately left of **DOWNLOAD** (its natural sibling — both
"emit the program", one to disk, one to the machine).

- Label `TRANSFER`, icon `📡` (or `➡`).
- Disabled/greyed with tooltip "Configure the gateway in Settings" when no base URL is set.
- On click → build the program → POST → transient feedback in the status bar (`#status`):
  - in-flight: `Sending corner_finder.nc → …`
  - ok: `Sent corner_finder.nc → Ultimate Bee · press Cycle Start` (machine name from the descriptor)
  - 401: `Transfer rejected — check the access token (Settings)`
  - network/др: `Gateway unreachable — is it running? (Settings)`

### Settings block
A new **CNC BRIDGE (transfer)** section in the Settings overlay with:
- **Gateway URL** (text) — e.g. `http://127.0.0.1:8765` or `https://ddcs-bridge.pages.dev`.
- **Access token** (password input) — blank for a local gateway.
- **Test connection** (button) — `GET <url>/api/descriptor`; shows the machine name + backend, or the error.

That's the whole surface. No machine picker (the gateway already knows which controller it serves), no
job options (deliver-only has none).

---

## 4. File-by-file changes

All paths under `src/`.

### 4.1 `bridgeTransfer.js` — NEW (the only real logic)
A small side-effect module (same shape as `settingsPanel.js` / `profileStore.js`: it self-registers a
`window.*` global). Responsibilities:

- `getBridgeConfig()` → read `window.ddcsGetSettings().bridge` → `{ url, token }`.
- `transfer()` (registered as `window.ddcsTransfer`):
  1. `code = document.getElementById('editor').value` — abort with a status message if empty.
  2. Derive `{ name, code }` via the shared program builder (see §4.5) so the file on the controller is
     byte-identical to what **Export** writes (same `(Title)` line, same sanitized `<name>.nc`).
  3. **Pre-flight verify** — block on lint errors so a parse-breaker / wedge-hazard never reaches the
     machine. Read the live editor result `window.ddcsLintResult()` (see
     [`addstudioverify.md`](addstudioverify.md)); if any `severity === 'error'`, set a status pointing at
     the VERIFY panel and **stop** (warnings do not block).
  4. If no `cfg.url` → status "Configure the gateway in Settings", optionally `openSettings()`. Stop.
  5. `POST cfg.url + '/api/jobs'`, `Content-Type: application/json`,
     `Authorization: Bearer <token>` only when a token is set, body `{ name, nc: code }` (no `map`).
  6. Map the response to a status message (§3). Disable the button while in-flight.
- `testConnection(url, token)` → `GET url + '/api/descriptor'` → return `{ ok, machine_name, backend }`
  or `{ ok:false, error }` for the Settings "Test connection" button.

Sketch (reference, not final):
```js
import { UIUtils } from './uiUtils.js';

const api = (cfg) => cfg.url.replace(/\/+$/, '');          // trim trailing slash
const authHeaders = (cfg) => cfg.token ? { Authorization: 'Bearer ' + cfg.token } : {};

function getBridgeConfig() {
    const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    return { url: '', token: '', ...(s.bridge || {}) };
}

function setStatus(msg) {                                   // reuse the existing status bar
    const bar = document.getElementById('status');
    if (bar) bar.textContent = msg;
}

export async function transfer() {
    const cfg = getBridgeConfig();
    const built = window.ddcsBuildProgram ? window.ddcsBuildProgram() : null;   // see §4.5
    if (!built || !built.code.trim()) return setStatus('Nothing to send — editor is empty.');

    const findings = window.ddcsLintResult ? window.ddcsLintResult() : [];      // see addstudioverify.md
    const errs = findings.filter(f => f.severity === 'error');
    if (errs.length) { setStatus(`⛔ ${errs.length} error(s) — fix in VERIFY before sending.`); window.ddcsShowVerify?.(); return; }

    if (!cfg.url) { setStatus('Set the gateway URL in Settings first.'); window.openSettings?.(); return; }

    setStatus(`Sending ${built.name} → …`);
    try {
        const r = await fetch(api(cfg) + '/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders(cfg) },
            body: JSON.stringify({ name: built.name, nc: built.code }),   // no map ⇒ deliver-only
        });
        if (r.status === 401) return setStatus('Transfer rejected — check the access token (Settings).');
        if (!r.ok) return setStatus(`Transfer failed — HTTP ${r.status}.`);
        const out = await r.json();
        setStatus(`Sent ${out.name} → press Cycle Start at the machine.`);
    } catch (e) {
        setStatus('Gateway unreachable — is it running? (Settings)');
    }
}

export async function testConnection(url, token) {
    try {
        const r = await fetch(url.replace(/\/+$/, '') + '/api/descriptor',
                              { headers: token ? { Authorization: 'Bearer ' + token } : {} });
        if (r.status === 401) return { ok: false, error: 'unauthorized (bad token)' };
        if (!r.ok) return { ok: false, error: 'HTTP ' + r.status };
        const d = await r.json();
        return { ok: true, machine_name: d.machine_name || d.controller_name || '(unnamed)', backend: d.backend };
    } catch (e) { return { ok: false, error: 'unreachable' }; }
}

window.ddcsTransfer = transfer;
window.ddcsTestBridge = testConnection;
```

### 4.2 `app.js` — register the module
Add a side-effect import next to the other self-registering modules (after the `profileStore.js` import,
~line 34):
```js
// CNC bridge transfer (header TRANSFER button → gateway POST /api/jobs)
import './bridgeTransfer.js';
```
No change to `setupGlobalFunctions()` is needed — the module registers `window.ddcsTransfer` itself,
matching how `settingsPanel.js` registers `window.openSettings`. (The bundler inlines by following
app.js's import graph, so this import is also what gets it into the standalone build — see §7.)

### 4.3 `index.html` — the header button
In `<div class="hdr-controls">` (currently Theme / Scale / Settings / Download, ~line 25), add before the
DOWNLOAD button:
```html
<button onclick="(window.ddcsTransfer && window.ddcsTransfer())" class="op-btn" id="transferBtn"
        title="Send the current program to the CNC bridge gateway">
    <span class="op-icon">📡</span><span class="op-label">TRANSFER</span>
</button>
```
(Inline `onclick` calling a `window.*` global — identical to every other header button.)

### 4.4 `settingsPanel.js` — config block + **persistence (the gotcha)**
Two parts.

**(a) Render** — add a section in `buildSettingsOverlay()`'s template (e.g. right after PROFILE):
```html
<div class="settings-section">
    <div class="settings-section-title">CNC BRIDGE (transfer)</div>
    <label class="settings-field">GATEWAY URL
        <input type="text" id="set_bridge_url" placeholder="http://127.0.0.1:8765  or  https://ddcs-bridge.pages.dev">
    </label>
    <label class="settings-field">ACCESS TOKEN
        <input type="password" id="set_bridge_token" placeholder="(blank for a local gateway)">
    </label>
    <div class="settings-row">
        <button class="toolbar-btn settings-io" id="set_bridge_test">🔌 Test connection</button>
        <span class="settings-hint" id="set_bridge_status"></span>
    </div>
    <div class="settings-hint">Where TRANSFER sends the program. Local gateway = no token; cloud = paste the access token.</div>
</div>
```
Wire it in `wireSettingsOverlay()`: in `fill()` set the two inputs from `_ddcsSettings.bridge`; in
`onInput()` write `s.bridge.url` / `s.bridge.token` back and `saveSettings()`; add a click handler on
`set_bridge_test` that calls `window.ddcsTestBridge(url, token)` and writes the result to
`set_bridge_status`.

**(b) Persistence — REQUIRED, easy to miss.** Today `loadSettings()` and `applySettings()` only preserve
`stock` and `machine`; any other key is dropped on reload. Extend all three spots:
```js
const SETTINGS_DEFAULTS = {
    stock:   { x: 100, y: 80, z: 20, shape: 'boss', show: true },
    machine: { x: 300, y: 300, z: 120, ox: 0, oy: 0, oz: 0, show: true },
    bridge:  { url: '', token: '' },                                  // NEW
};
```
- In `loadSettings()` add: `bridge: { ...SETTINGS_DEFAULTS.bridge, ...(p.bridge || {}) }`.
- In `applySettings()` add: `if (incoming.bridge) _ddcsSettings.bridge = { ...SETTINGS_DEFAULTS.bridge, ..._ddcsSettings.bridge, ...incoming.bridge };`

Without (b), the URL/token won't survive a page reload.

### 4.5 `editorManager.js` — share the name/title logic (small refactor)
So TRANSFER and EXPORT produce the *same* program + filename, split the front half of `downloadFile()`
into a reusable builder and have `downloadFile()` call it:
```js
buildProgram() {
    let code = this.editor.value || '';
    // ... existing title extraction + `(title)` prepend + filename sanitization from downloadFile() ...
    return { name: `${outName}.nc`, code };
}
downloadFile() {
    const { name, code } = this.buildProgram();
    UIUtils.downloadFile(name, code);
}
```
Expose it for the transfer module (in `app.js` `setupGlobalFunctions()`, alongside the others):
```js
window.ddcsBuildProgram = () => this.editorManager.buildProgram();
```
(If you'd rather not refactor now, `bridgeTransfer.js` can read `#editor` directly and do its own minimal
filename derivation — but then Export and Transfer can drift. The refactor is the surgical choice.)

---

## 5. Config schema (lives in `settings.bridge`)
```json
{ "bridge": { "url": "http://127.0.0.1:8765", "token": "" } }
```
Persisted in `localStorage['ddcs_studio_settings']` with the rest of Settings; redrawn on
`ddcs:settings-changed` like the other blocks.

---

## 6. Token vs profile export — DECIDED: URL in, token out
`profileStore.js` bundles **all** of `getSettings()` into the exported `ddcs-profile.json` (and, in the
.exe, auto-saves it on every settings change). Left as-is the **access token would ride along** — into a
shareable file and, in the .exe, into plaintext-at-rest.

**Decision:** keep `bridge.url` in the profile (portable, not secret); **never bundle `bridge.token`**
(a per-install credential). The token persists only in `localStorage['ddcs_studio_settings']` via the
normal Settings save — it survives restarts, it just never travels with the profile.

Implement in `buildProfile()` (`profileStore.js`) — **omit** the token key, don't blank it:
```js
export function buildProfile() {
    const db = getDB();
    const settings = getSettings();                       // live ref — must not mutate
    const { token, ...bridgeNoToken } = settings.bridge || {};   // drop token, keep url
    return {
        version: PROFILE_VERSION,
        settings: { ...settings, bridge: bridgeNoToken },
        userVars: db ? db.getAll().filter(v => !v.isSys) : [],
    };
}
```
Why **omit** rather than `token: ''`: on import, `applySettings()` merges `...incoming.bridge` over the
current settings (§4.4b). If the profile carried `token: ''` it would **wipe** a token already pasted on
that machine. Omitting the key leaves the local token untouched. This also means the .exe's
`autoSaveProfile()` no longer writes the token to disk — the plaintext-at-rest concern is gone too.

---

## 7. Build / bundle
`npm run build` (→ `scripts/bundle.cjs` → `tools/bundle_standalone.py`) inlines the app for the standalone
HTML / pywebview `.exe`. It follows `index.html` + the `app.js` import graph, so the new
`import './bridgeTransfer.js'` (§4.2) is picked up automatically — **no bundler change**. Verify the
standalone build after wiring (the `fetch` is cross-origin and works the same inlined).

> pywebview note: a `.exe` build runs from `file://`/the pywebview host, but TRANSFER still just does a
> cross-origin `fetch` to the gateway URL (CORS `*`), so no Python bridge is required. (If you ever want to
> avoid the browser network stack, `window.pywebview.api` already exists as an alt path — not needed now.)

---

## 8. Safety (inherited from the bridge — surface it in the UI)
- **Deliver ≠ run.** TRANSFER lands the file on the controller's disk; the operator still **selects it and
  presses Cycle Start** at the machine. There is no remote start. Say so in the success toast.
- Studio sends **deliver-only** jobs (no beacons), so nothing here can drive motion or tracking.
- The gateway enforces its own machine-identity check before delivery; Studio doesn't need to.

---

## 9. Out of scope (don't build these here)
- **Beacon instrumentation / progress tracking.** That's for long Fusion cuts and lives in the bridge's
  `web/` instrumenter. Probe/macro files are short and don't need it — deliver-only is the whole point.
- A queue/tracker UI inside Studio. Use the bridge **Console** (`ddcs-bridge.pages.dev` or the gateway's
  localhost) to watch the queue/history. Studio is fire-and-confirm.
- Auto-discovery of the gateway, multi-machine pickers, jog/live control.

---

## 10. Acceptance criteria
1. **Header:** a TRANSFER button sits left of DOWNLOAD; greyed with a tooltip until a gateway URL is set.
2. **Settings:** CNC BRIDGE block with URL + token + Test; values **survive a page reload** (persistence
   gotcha handled).
3. **Test connection:** with a gateway running, returns its machine name + backend; with a bad token on the
   cloud URL, reports unauthorized.
4. **Local happy path:** Studio + gateway (`--serve`) on one PC → generate a probe → TRANSFER → status shows
   success → the `.nc` appears in the gateway's CNCDISK listing (Console "Files"), same name as Export.
5. **Cloud happy path:** cloud URL + token → TRANSFER → job shows in the Console queue as deliver-only →
   gateway delivers on its next poll.
6. **Failure paths:** gateway down → "unreachable"; empty editor → "nothing to send"; no URL → nudge to
   Settings. None throw to the console.
7. **Parity:** the transferred file is byte-identical to what EXPORT downloads for the same editor content.
8. **Token hygiene:** an exported `ddcs-profile.json` contains `bridge.url` but **no** `bridge.token`;
   importing that profile on a machine that already has a token set leaves the existing token intact.
