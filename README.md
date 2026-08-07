# DDCS Studio — CNC Macro Studio

**Author, simulate, and verify CNC macros, probing routines, and CAM packs for [DDCS](https://www.ddcnc.com/) controllers on a real screen — then send them straight to the machine.**

> Live web app: **[ddcs-studio.pages.dev](https://ddcs-studio.pages.dev)** · Primary target: **DDCS Expert / M350** · License: MIT

---

> **Working in this repo — human or agent? Read [`AGENTS.md`](AGENTS.md) first.**

## Why this exists

A DDCS controller is a capable, standalone CNC brain — but authoring anything past basic motion means **hand-writing `#`-variable G-code in a plain text editor** (Notepad, on a PC): no undo, no picture of what it does, no simulation, and quirky flow control plus a half-there `G10` to work around. Then you USB it over and *find out whether it works by running it on real metal* — the controller yacc-errors to a screen your PC can't even read. The community's classic disaster is full-replacing the controller's `eng` menu file and bricking the CAM page.

DDCS Studio moves all of that to a real screen and closes the loop off the machine:

- **Simulate the whole cycle before the spindle turns** — toolpath, material removal, *and* the virtual-I/O handshakes for ATC / drawbar / spindle-clamp — so you catch crashes and logic bugs in software, not in aluminium.
- **Generate verified, dialect-correct G-code** from proven wizards; fork and expose just the 5% you want as knobs; bake the safety-critical branch/guard params so a shared slot can't be mis-driven.
- **Never destroy the controller's `eng`** — CAM packs allocate their `#`-params without collisions and *merge* into the existing menu instead of replacing it.
- **Own your work** — one-file `.ddcs` backups, controller profiles captured from a USB dump or a LAN pull, and a gateway that pushes jobs and reads back how far they ran.

In short: blind, single-shot, panel-bound editing becomes a **visual, versioned, verifiable, shareable** workflow that still emits *exactly* what the controller expects.

---

## The idea that makes it trustworthy — one stack, many views

Every operation is a **stack of small, dialect-aware atoms** (move, probe, set-output, wait-input, dwell, jump, …). The active controller's **dialect** turns each atom into that controller's exact G-code — a "wait for input" becomes a `WHILE [#[1520+N]…] DO1 … END1` poll on the Expert, or folds to an honest hint on a controller that can't do it.

```
 Wizard form ──► the ATOM STACK ──► dialect-aware emit ──► native G-code   (a write-once output)
 (or Blocks)   (the single source of truth)   (per controller)      │
                        │                                            ▼
                        ├──► Blockly view (Blocks tab)         Simulator (2D / 3D + virtual I/O)
                        └──► 2D feature canvas (drag-handles)
```

**G-code is a terminal output — nothing in the app reads it back.** The Blocks view, the 2D feature canvas, the wizard forms, and the simulator all read from the *same* atom stack, never from generated text. There is no step where the app re-parses its own output to draw a picture of it — so **the three views can't drift**, round-trips are lossless, and *what you simulate is exactly what runs*. Switching controllers re-emits the same atoms through a different dialect; nothing is lost.

This is also why you can **fork any built-in into your own wizard**: a wizard *is* a data definition (`def` = a stack + declared bindings), so "expose these values as knobs, name it, save" mints a reusable custom op — and it arrives on someone else's machine **live and editable**, not baked.

---

## The four tabs (+ Settings)

| Tab | What it is |
|---|---|
| **Studio** | The G-code editor + the operation wizards (Probe ▾ · Mill ▾ · ATC ▾ · WCS · Homing · **I/O ▾**) and the live 2D/3D simulation. The primary surface — fully usable **offline** as an authoring simulator. |
| **Blocks** | A Blockly view of the current program's atom stack — structural editing of the same operations, a learner rail (Atoms / Snippets / Complete Programs), and the "build your own wizard" flow. |
| **Macros** | Controller-side authoring: the **CAM Pack Builder**, **K-buttons** (K1–K16), custom **M-codes**, and the system hooks (`sysstart.nc` / `T.nc` / `error.nc` / `probe.nc`). |
| **Gateway** | The in-app face of the machine gateway: controller status, Send / Merge, job Tracking, the CNCDISK file browser, Jobs history, and a Console. |
| **Settings** | Controller profile & post, WCS table, variables, machine geometry / I/O map, network (share + LAN scan + phone-access URL/QR), cloud account, appearance & preview options. |

---

## Feature tour

### Operation wizards
Each wizard is a two-pane form (fill on the left, watch the toolpath build on the right):

- **Probing / setup** — **Corner** (part-corner XY origin, 4 corners, Z-first option), **Edge** (single-axis edge find), **Middle / Bore / Boss** (centre a bore/pocket or a boss), **Align** (two-point skew measure/correct), **WCS** (zero G54–G59), **Homing** (with a machine-frame preview).
- **Rotary / 4th-axis** — **Centreline** (round-bar A-axis centre), **Clock A0** (index a 4-jaw feature).
- **ATC / tooling** — **Tool Length**, **Tool Check** (breakage/drift), **Tool Change** (5 methods + magazine choreography), **Tool Table**, **ATC Test**.
- **Milling / drilling** — **Drill / Bore** (peck patterns: bolt-circle / grid / line / single; helical bore), **Pocket**, **Contour**, **Slot**, **Surfacing**, **Text / engrave** (stroke-font), **Tap** (floating + gated rigid).
- **Setup / logic** — **Comm / MDI**, **I/O Step** (set output / wait input / dwell by declared name or raw pin), **Pause / Confirm**, **Warm-up**.

A tool picker, catalog templates, and material-based feeds-&-speeds suggestions back the forms.

### Blocks & build-your-own wizards
The Blocks tab round-trips **program ⇄ blocks ⇄ projected G-code** over one live model. Pick numeric values to *expose as knobs*, name them, and **Save wizard** → a first-class custom op appears in your library and toolbar (build / validate / marker-round-trip / merge all work on it). Open any Studio op *as blocks* to inspect or edit its stack; a 16-category atom palette, a "make your own datum" region editor, coordinate/corner-grid pickers, live next-block suggestions, and lint round it out.

### CAM Pack Builder (the controller's CAM page, authored on a PC)
Build a distributable **DDCS Expert CAM-menu pack** — parameterized macro slots the operator drives from the controller's CAM page, each a **form + a macro** that reads the form live via `#2600+` mirrors:

- **＋ New CAM slot** composes a slot from an op in your program — seed an **Expose / Bake** field table (which params the operator fills vs. which you freeze), preview, Build.
- **8 premium shape generators** (pocket / circular-pocket / surfacing / corner / edge / slot / drill / bore + inside/boss probe) *plus a universal fallback* that turns **any** custom op into a CAM slot.
- **Probing → CAM slots**: self-positioning probe sequences with branch selectors the operator flips at the machine.
- **Icon Builder** — a layer-based composer (shapes / glyph library / text / imported BMP, with an auto-glyph per op type) that exports the exact factory 24-bit `camN.bmp`.
- **In-wizard simulation** of the slot's toolpath, auto shared-`#`-param allocation with collision flags, **Export pack (.zip)** (`macro_camN.nc` + `camN.bmp` + eng lines + install README), and **Merge eng** (append your pack into the controller's current `eng`, collisions flagged — never a full replace).

### K-buttons & controller files
Author each physical **K-key macro** (`key-N.nc`, K1–K16) — from the editor via **＋ Make ▾ → K-button**, or in the Macros panel. Author program-callable **custom M-codes** (`O100nn` ⇄ M`nn`), and edit the system hooks (`sysstart.nc` boot / `T.nc` tool-change / `error.nc` alarm / `probe.nc`). Load-from / Deploy-to the controller with a merge-vs-replace conflict resolver.

### Simulation
One preview component, mounted identically in the editor, Blocks, and every wizard — only the G-code differs:

- **3D toolpath + material-removal carving** that respects the tool's tip profile; a **2D top-down** view sharing the same trace.
- **Play / run / step / loop** execution engine with a time estimate, envelope check, limit switches, and gantry sync.
- **Virtual I/O** mocks the hardware handshakes so a full ATC/drawbar cycle animates with no controller attached.
- **Personalized machine frame** — renders against *your* real envelope and the op's rig (round-bar, 4-jaw, ATC magazine), so `G53` moves and WCS offsets look the way they will on the machine.
- **2D feature canvas** with draggable handles that drive op *parameters* (never freeform geometry), two-way bound to the form; a rich stock/workpiece modal; a virtual jog pendant + draggable start marker.

### Gateway & deploy
A small **local** server (runs on *your* PC) reaches the controller over its **CNCDISK share** (SMB) and Modbus. **Scan the LAN** to find controllers; see live read-only status (safe when you're away from the machine); **Send** the current program or a dropped `.nc` (with a pre-flight envelope check; the operator still presses Cycle Start); a shop-floor **job Tracker**, a file browser, a job queue/history, and a console. **Pull settings from the controller** (params/eng/coord → a review-and-Apply machine profile) either over the LAN or from a dropped USB dump folder. **LAN Access** hands you a URL + QR to open the desktop-served app on a phone/tablet.

### Controller profiles & dialects
A named **profile library** (create / switch / export / import; switching atomically swaps the live settings). Built-ins: **DDCS Expert M350**, **V4.1**, **V3 / DM500**, plus generic/port targets. The **post-processor** system re-emits the same stack into any controller's real G-code, and a header quick-picker switches posts live **with a capability lint** — fields a controller can't support are greyed with a tooltip, not silently mis-emitted.

### Persistence, workspace & sharing
DDCS Studio treats **localStorage as a temporary buffer** and a **file you own as the real save**:

- **Intentional Save (Ctrl+S)** writes the whole workspace to your own `.ddcs` file via the File System Access API (same on web and desktop); an **"unsaved to file"** header chip + exit warning keep you honest.
- The **`.ddcs` "save everything" workspace** bundles all user state — settings + tool table, profile library, custom wizards, CAM pack, wizard-bar layout, presets, variables, prefs, and your programs — via a declared registry, with a selective-restore preview and a safety auto-export before any restore.
- **Projects** live in a local IndexedDB volume (folders + `.mjson`), browseable like a disk; **The Library** is one door for Profiles · Projects · Wizards.
- **Granular sharing**: a single custom wizard exports as a portable **`.wizard`** file (it imports *live and editable*, carrying its panel + sim rig), and CAM packs share as a **`.zip`**.
- Optional **bring-your-own cloud** (Google Drive / Dropbox / OneDrive via browser-direct PKCE — no central server holds your data).

---

## FAQ

**If I remove a `form field param` block from a custom wizard's Parameter Group, does it delete the parameter from the program?**
No. Removing a field block from the `Parameter Group` strictly removes it from the user-facing form. The underlying execution blocks (e.g., `Surface Raster` or `Drill`) still preserve their value sockets (like `feed` or `depth`) and keep their baked defaults. If you need to edit a hidden parameter on a specific job, you can always insert your wizard and then click **Customize as blocks** to edit the raw execution blocks directly.

---

## Supported controllers

- **DDCS Expert / M350** — the primary, fully-verified target (its captured firmware dump is the reference for the whole dialect system).
- **DDCS V4.1** and **DDCS V3 / DM500** — supported posts with their own verified dialects.
- **Porting / research targets** — grbl & grblHAL, Mach3/Mach4, UCCNC, Centroid, LinuxCNC. Each has a dialect and real source/dump material under [`bridge/controllers/`](bridge/controllers/); coverage varies (see that folder's `FINDINGS.md`, with confidence tags).

Controller behaviour is verified against real dumps and bench tests, not assumed.

---

## Running it

**Hosted (nothing to install):** open **[ddcs-studio.pages.dev](https://ddcs-studio.pages.dev)**. Perfect for authoring + simulation; it can't reach a machine on your LAN (that needs the gateway/desktop app).

**Local dev server:**
```bash
cd DDCS-Studio
npm install        # optional — only for tests/tooling; the app runs as static ES modules (libs are vendored)
npm run start      # serves web/ on http://localhost:3000
```

**Desktop app (connects to your machine):** download `DDCS-Studio.exe` from [Releases](https://github.com/fchabot-dxf/DDCS-Studio/releases) — the **`latest`** pre-release is the rolling build of `main`; `vX.Y` tags are announced stable releases. It bundles the gateway (serves the app, talks to the controller over the LAN, shows an update banner on a new stable release). Build it yourself on Windows:
```powershell
pwsh ./build_fairy.ps1          # PyInstaller one-file build → DDCS-Studio.exe
```


> ⚠️ **Live-machine safety.** Generating and simulating is always safe and offline. *Running* drives real motion and outputs — verify in the simulator first, keep the operator at the machine, and treat anything that moves an axis or toggles an output as live. See [`docs/VERIFY-AT-MACHINE.md`](docs/VERIFY-AT-MACHINE.md).

---

## Repository layout

```
DDCS-Studio/            The app — a monorepo of three shells over one web core
  web/                  Static, dependency-free ES modules
    wizards/            Operation wizards + ops/ (the atom library) + dialects/ (per-controller emit)
    blocks/             Blockly view, the atom-stack model, custom-op registry, G-code⇄stack round-trip
    engine/             G-code execution engine + virtual I/O + stock removal (the simulator core)
    viz/                2D / 3D preview panels + the feature canvas
    ui/                 Tabs, wizards, settings, gateway, CAM builder, icon editor, workspace save, …
    data/               Controller variable tables, CAM mappers, backup registry, dialects
bridge/                 The machine gateway + controller research
  bridge-app/           The Python gateway (server, transfer over SMB, Modbus, OAuth)
  controllers/<id>/     Per-controller dialect notes, FINDINGS, and real firmware dumps (ground truth)
docs/                   Design notes, plans, and the at-machine verification checklist
fairy_gateway.py        Desktop / gateway entry point
build_fairy.ps1         Windows exe build (PyInstaller)
```

---

## Build & deploy

- **Web** — pushing to `main` auto-deploys `DDCS-Studio/web/` to **Cloudflare Pages** (served as-is; no build step).
- **Desktop** — every push to `main` touching shipping code builds the exe in CI and refreshes the rolling **`latest`** pre-release. Cutting a *stable* release is one step: `npm run bump-version`, then push — CI publishes `vX.Y` and the in-app update banner notifies users.

---

## Status

Under active development, purpose-built around the maintainer's machine (an Ultimate Bee with a DDCS Expert M350) — but the dialect system is general. Design notes, controller research, and plans live in [`docs/`](docs/) and [`bridge/controllers/`](bridge/controllers/).

## License

MIT.
