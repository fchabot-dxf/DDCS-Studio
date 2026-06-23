/**
 * wizards/dialects/grblhal.js — grblHAL (RS274NGC family).
 *
 * grblHAL copied LinuxCNC's RS274NGC: identical probe params (#5061), G38.2, G10 L20, and O-word flow — so its
 * EMIT FORMS *are* the rs274ngc dialect (re-exported here, not duplicated). grblHAL splits from LinuxCNC on a
 * CAPABILITY, not syntax: grblHAL's O-word flow (o<n> if/while) runs only for macros stored on SD/littlefs — it
 * is NOT available while STREAMING G-code over serial (the usual sender mode). LinuxCNC has no such limit. So
 * flow-heavy macros (probe/ATC) must be SAVED to the controller's SD card on grblHAL, not streamed.
 * `caps.flowStreamable = false` flags this so the app can warn / gate accordingly.
 */
import { dialect as rs274ngc } from './rs274ngc.js';

export const dialect = {
    ...rs274ngc,   // identical RS274NGC emit forms + recognize() + vars (grblHAL = LinuxCNC for codegen)
    id: 'grblhal', name: 'grblHAL',
    caps: { ...rs274ngc.caps, flowStreamable: false },   // O-word flow only from SD/littlefs, not while streaming
    notes: 'grblHAL — RS274NGC emit forms shared with LinuxCNC (re-exports rs274ngc.js): same #5061 probe params, '
        + 'G38.2, G10 L20, O-word flow. The ONE difference is a capability, not syntax: grblHAL O-word flow runs '
        + 'only for macros on SD/littlefs, NOT while streaming over serial — so probe/ATC (flow-heavy) macros must '
        + 'be saved to the SD card. caps.flowStreamable=false. Verified vs grblHAL-core-src (shared with rs274ngc).',
};
