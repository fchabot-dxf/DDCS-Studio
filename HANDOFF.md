cycle: 778
turn: 1560
to: advisor
from: worker
updated: 2026-08-05T08:49:00Z
note: Reverted broken Corner wizard port. Implemented split_horizontal and split_vertical blocks in layout.js / index.js. Implemented renderUiTree in formWidgets.js preserving viz-split HTML parity & makePanesCollapsible drag handles for block-driven wizard layouts. Defined and registered 20 missing Wizard UI blocks in PALETTE (41 Wizard UI blocks total). Removed obsolete top-level G-code toggle tab from index.html header. Added getUserDef fallback to renderLiveForm in blocksApp.js so registered wizard definitions (Corner, Edge, Drill, etc.) populate form parameters immediately in the Wizard View drawer. Added missing form3d+2d & plane-suggest dropdown options to bridge.js. Updated WORK-LOG.md and ROADMAP.md. Ready for next agent.
