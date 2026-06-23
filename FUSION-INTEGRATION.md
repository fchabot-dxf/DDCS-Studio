# Fusion 360 Integration

I want to be able to open DDCS Studio directly from inside Fusion 360 — either via a Fusion add-in (extension) or from the CAM workspace. This document captures the intent and the two possible entry points.

## Goal

When a user is working in Fusion 360 — particularly in the CAM workspace after generating toolpaths — they should be able to launch or focus DDCS Studio without leaving Fusion. The bridge between the two tools should feel seamless: Fusion produces the G-code / CAM output, DDCS Studio consumes it.

## Entry Point 1: Fusion Add-in (Extension)

A Python-based Fusion 360 add-in (`ddcs_studio_addin/`) that:

- Adds a **DDCS Studio** button to the Fusion toolbar (CAM workspace, or a general Scripts & Add-Ins panel).
- On click: launches or focuses the DDCS Studio desktop app (or opens the web app in a browser/webview).
- Optionally passes the active document name or export path as a query parameter so Studio opens to the right context.

Implementation sketch:
```python
# commands/OpenStudio/entry.py
import subprocess, adsk.core

def execute(args):
    app = adsk.core.Application.get()
    # Launch the exe or open the hosted URL
    subprocess.Popen([r"C:\path\to\DDCS-Studio.exe"])
```

The add-in manifest (`ddcs_studio_addin.manifest`) declares the entry point and Fusion version compatibility.

## Entry Point 2: Fusion CAM Post-Process Hook

After running **Post Process** in the CAM workspace, Fusion can invoke an external program. We can ship a custom post that, after writing the `.nc` file, also:

1. Writes a small JSON sidecar (active WCS, stock dims, tool table).
2. Opens DDCS Studio (or sends a message to a running instance via the bridge HTTP API) with the exported file path.

This requires no add-in install — just deploying our custom post and pointing users at it.

## Entry Point 3: Fusion CAM custom command (preferred long-term)

A proper add-in that lives in the **CAM** workspace and adds a **Send to DDCS Studio** command to the Actions panel. On invoke:

1. Runs our custom post processor in-process (via Fusion's `CAMManager`).
2. Opens (or focuses) DDCS Studio and loads the exported file via the bridge gateway API (`POST /import`).

This is the cleanest UX — one click from toolpath to Studio.

## Open Questions

- Does the user run the **desktop exe** or the **web app** (localhost)? Integration differs.
- Should Fusion pass stock/WCS data or just the raw `.nc`?
- Minimum Fusion version to target (API version compatibility).
- Should the add-in live in this repo (`ddcs-vscode-extension/` sibling) or its own repo?

## References

- [Desktop packaging notes](docs/) — pywebview exe details
- [Gateway/bridge architecture](docs/) — the HTTP API the bridge exposes
- Fusion 360 API docs: `adsk.cam.CAMManager`, `adsk.core.Application`
