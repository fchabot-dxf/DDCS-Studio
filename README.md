# DDCS Studio — CNC Macro Studio

**A modular G-code / macro generator, simulator, and machine gateway for [DDCS](https://www.ddcnc.com/) CNC controllers — author, simulate, and verify on your PC, then send straight to the machine.**

> Live web app: **[ddcs-studio.pages.dev](https://ddcs-studio.pages.dev)** · Primary target: **DDCS Expert M350** · License: MIT

DDCS controllers are capable but their on-machine workflow is cramped — tiny screen, hand-typed macros, edit-reboot-test iteration, and no simulation. DDCS Studio moves all of that to a real screen: a guided wizard for each operation, a full 2D/3D simulator that runs the *actual* generated G-code (probes, loops, I/O and all), a block-based view for editing the logic, and a gateway that pushes finished programs to the controller over your LAN.

---

## Highlights

- **Operation wizards** — probing (corner / edge / middle / circular / alignment / rotary), ATC (tool length / check / change / warm-up / test), milling (drill / pocket / slot / surfacing / engrave), WCS setup, comms, and digital I/O. Fill in a form on the left, watch the toolpath build on the right.
- **Real simulation, not a preview** — a G-code execution engine drives a 2D and 3D view from the exact program you'll run: it traces probe moves, evaluates `IF/GOTO` and `WHILE` loops, dwells, and a **virtual-I/O panel** so you can exercise sensor-wait branches by hand before touching metal.
- **Personalised machine frame** — the simulator renders in *your* machine's real coordinate frame (travels, work origin, limit polarity) decoded from the controller's own configuration dump, so `G53` moves and WCS offsets look the way they will on the machine.
- **Blocks view** — every wizard's output *is* a stack of dialect-aware atoms; the **Blocks** tab renders that stack as Blockly so you can read and edit the logic structurally, then round-trip it back to G-code.
- **Multi-controller dialects** — the same operation emits native G-code for whichever controller you've selected; fields a controller can't support are greyed (with a tooltip explaining why) rather than silently producing bad code.
- **Machine gateway** — a small local server connects to the controller's network share (and Modbus), can **scan the LAN** to find controllers, exposes live status, and uploads programs — so the cloud/PC *authors* and the gateway *controls*.
- **Bring-your-own cloud** — projects (and Drive sign-in) use your own Google Drive via a desktop OAuth flow; there's no central account or server holding your data.

---

## The four surfaces

The app is one page with four tabs:

| Tab | What it is |
|---|---|
| **Studio** | The G-code editor + the operation wizards (toolbar: Probe ▾ · ATC ▾ · Mill ▾ · WCS · Warm-up · **I/O ▾**) and the simulation preview. The primary surface. |
| **Blocks** | A Blockly view of the current program's atom stack — structural editing of the same operations. |
| **Gateway** | The in-app face of the machine gateway: controller status, send/merge, job tracking, file browser, console. |
| **Settings** | Machine profile (geometry, work origin, I/O map), controller post selection, network (controller share + LAN scan + LAN-access URL/QR), cloud account, and preview options. |

---

## Supported controllers

- **DDCS Expert / M350** — the primary, fully-verified target (its captured firmware dump is the reference for the whole dialect system).
- **DDCS V4.1** and **DDCS V3 / DM500** — supported posts with their own verified dialects.
- **Porting / research targets** — grbl & grblHAL, Mach3, Mach4, UCCNC, Centroid, LinuxCNC. Each has a dialect and real source/dump material under [`bridge/controllers/`](bridge/controllers/); coverage varies (see that folder's notes).

Each controller's behaviour is verified against real dumps and bench tests, not assumed — findings live in `bridge/controllers/<id>/FINDINGS.md` with confidence tags.

---

## How it works

```
 Wizard form ──► generate()  ═  a stack of ATOMS  ──► dialect-aware emit ──► native G-code
 (or Blocks)        (the single source of truth)        (per controller)         │
                            │                                                     ▼
                            └────────────► Blockly view (Blocks tab)        Simulator (2D/3D + virtual I/O)
                                                                                  │
                                                                                  ▼
                                                                          Gateway ──► controller (SMB / Modbus)
```

Every operation is a **stack of small atoms** (move, probe, set-output, wait-input, dwell, jump, …). Atoms are **dialect-aware**: the active controller's *dialect* turns each atom into that controller's exact G-code (e.g. a "wait for input" emits a `WHILE [#[1520+N]…] DO1 … END1` poll on the Expert, or folds to an honest hint on a controller that can't do it). The same atom stack feeds the editor, the Blocks view, and the simulator — so the three stay in sync and round-trip.

---

## Running it

**Hosted (nothing to install):** open **[ddcs-studio.pages.dev](https://ddcs-studio.pages.dev)**. Great for authoring + simulation; it can't reach a machine on your LAN (that needs the gateway/desktop app).

**Local dev server:**
```bash
cd DDCS-Studio
npm install        # optional — only for tests/tooling; the app runs as static ES modules (3rd-party libs are vendored)
npm run start      # serves web/ on http://localhost:3000
```

**Desktop app (connects to your machine):** download `DDCS-Studio.exe` from [Releases](https://github.com/fchabot-dxf/DDCS-Studio/releases) — the **`latest`** pre-release is the rolling build of `main`, and `vX.Y` tags are announced stable releases. It bundles the gateway, so it serves the app, can talk to the controller over the LAN, and shows an update banner when a newer stable release exists. To build it yourself (Windows):
```powershell
pwsh ./build_fairy.ps1          # PyInstaller one-file build → DDCS-Studio.exe
```

**The gateway** itself is the Python app under [`bridge/bridge-app/fairy/`](bridge/bridge-app/fairy/) (local HTTP server, controller transfer over SMB, Modbus, desktop OAuth); `fairy_gateway.py` is its entry point, and the desktop exe bundles it.

**VS Code extension:** an experimental third shell lives in [`ddcs-vscode-extension/`](ddcs-vscode-extension/) — the same web app hosted inside a VS Code webview talking to the gateway.

---

## Connecting to a machine

The gateway reaches the controller over its **CNCDISK network share** (SMB), e.g. `\\10.0.0.50\cncdisk`. In **Settings → Network → Machine Network** you can type the share, or **Scan the LAN** to discover controllers automatically; status (family / firmware) shows once connected. **LAN Access** there also gives you a URL + QR code to open the desktop-served app from a phone or tablet on the same wifi.

> ⚠️ **Live-machine safety.** Generating and simulating is always safe and offline. *Running* drives real motion and outputs — verify in the simulator first, keep the operator at the machine, and treat anything that moves an axis or toggles an output as live. See [`docs/VERIFY-AT-MACHINE.md`](docs/VERIFY-AT-MACHINE.md).

---

## Repository layout

```
DDCS-Studio/            The app (a monorepo of three shells over one web core)
  web/                  The web app — static, dependency-free ES modules
    wizards/            Operation wizards + ops/ (the atom library) + dialects/ (per-controller emit)
    blocks/             Blockly view, the atom-stack model, and G-code⇄stack round-trip
    engine/             G-code execution engine + virtual I/O (the simulator core)
    viz/                2D / 3D preview panels
    ui/                 Toolbar, settings, gateway tab, I/O panel, cloud account, …
    data/               Controller variable tables (default_vars_*.js)
  scripts/              bundle + version-bump tooling
  tools/                Standalone single-file bundler
bridge/                 The machine gateway + controller research
  bridge-app/fairy/     The Python gateway (server, ops, transfer, OAuth, Modbus)
  controllers/<id>/     Per-controller dialect notes, FINDINGS, and real firmware dumps (ground truth)
ddcs-vscode-extension/  Experimental VS Code webview shell
docs/                   Design notes, plans, and the at-machine verification checklist
fairy_gateway.py        Desktop/gateway entry point
build_fairy.ps1         Windows exe build (PyInstaller)
```

---

## Build & deploy

- **Web** — pushing to `main` auto-deploys `DDCS-Studio/web/` to **Cloudflare Pages** (served as-is; no build step).
- **Desktop** — every push to `main` that touches shipping code builds the exe in CI and refreshes the rolling **`latest`** pre-release. Cutting a *stable* release is one step: `npm run bump-version` (bumps the header version chip → syncs the title + `package.json`), then push — CI publishes `vX.Y` and the in-app update banner notifies users.

---

## Status & docs

DDCS Studio is under active development. Design notes, controller research, and plans live in [`docs/`](docs/) and [`bridge/controllers/`](bridge/controllers/). It's purpose-built around the maintainer's machine (an Ultimate Bee with a DDCS Expert M350) but the dialect system is general.

## License

MIT.
