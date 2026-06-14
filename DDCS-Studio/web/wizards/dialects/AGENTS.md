# Dialect fill-in — agent index

Three parallel agents fill the per-profile dialect bindings ("register the words per profile"). Each brief is
**self-contained** — launch one fresh session per brief. They **do not conflict**: each writes only its own NEW
dialect file(s); the anchor + SCHEMA are read-only to everyone.

| Brief | Profile(s) | Writes (new files only) |
| --- | --- | --- |
| `AGENT-1-ddcs-v41.md` | DDCS V4.1 | `ddcs-v41.js` |
| `AGENT-2-ddcs-v3-dm500.md` | DDCS V3 / DM500 | `ddcs-v3-dm500.js` |
| `AGENT-3-centroid-rs274ngc.md` | Centroid + RS274NGC (grbl HAL / LinuxCNC) | `centroid.js`, `rs274ngc.js` |

**Shared, read-only for all:** `SCHEMA.md` (the contract) · `ddcs-expert-m350.js` (verified anchor — mirror its shape).
**Deferred:** Mach3 / Mach4 — scripting dialects (logic in VBScript/Lua), separate script-emitter strategy, later.

**After they finish** (main session): review + Node-test each module → add `index.js` (registry by profile id) →
wire the atoms to call `dialect.<primitive>()` instead of the hardcoded Expert forms (via `controllerProfiles.js`).
