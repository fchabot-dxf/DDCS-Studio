/**
 * wizards/threads.js — the DECLARED thread preset table + the pitch-locked tapping feed.
 *
 * Each preset carries the mm LEAD (`pitch`) — for imperial that is 25.4/TPI, baked in so the feed derivation is uniform.
 * The floating-holder tapping feed is pitch-locked to the spindle: F (mm/min) = RPM × pitch(mm). (Metric: F = RPM × pitch.
 * Imperial in mm-mode: F = RPM ÷ TPI × 25.4 = RPM × (25.4/TPI) = RPM × pitch.) One formula, both unit systems.
 */

/** [{ name, system: 'metric'|'imperial', dia (mm major), pitch (mm lead), tpi? }]. Custom = the user types a pitch. */
export const THREAD_PRESETS = [
    // ── metric COARSE ──
    { name: 'M3 × 0.5', system: 'metric', dia: 3, pitch: 0.5 },
    { name: 'M4 × 0.7', system: 'metric', dia: 4, pitch: 0.7 },
    { name: 'M5 × 0.8', system: 'metric', dia: 5, pitch: 0.8 },
    { name: 'M6 × 1.0', system: 'metric', dia: 6, pitch: 1.0 },
    { name: 'M8 × 1.25', system: 'metric', dia: 8, pitch: 1.25 },
    { name: 'M10 × 1.5', system: 'metric', dia: 10, pitch: 1.5 },
    { name: 'M12 × 1.75', system: 'metric', dia: 12, pitch: 1.75 },
    { name: 'M16 × 2.0', system: 'metric', dia: 16, pitch: 2.0 },
    // ── metric FINE ──
    { name: 'M8 × 1.0 (fine)', system: 'metric', dia: 8, pitch: 1.0 },
    { name: 'M10 × 1.25 (fine)', system: 'metric', dia: 10, pitch: 1.25 },
    { name: 'M12 × 1.5 (fine)', system: 'metric', dia: 12, pitch: 1.5 },
    // ── imperial UNC ──
    { name: '#10-24 UNC', system: 'imperial', dia: 4.83, tpi: 24, pitch: 25.4 / 24 },
    { name: '1/4-20 UNC', system: 'imperial', dia: 6.35, tpi: 20, pitch: 25.4 / 20 },
    { name: '5/16-18 UNC', system: 'imperial', dia: 7.94, tpi: 18, pitch: 25.4 / 18 },
    { name: '3/8-16 UNC', system: 'imperial', dia: 9.53, tpi: 16, pitch: 25.4 / 16 },
    { name: '1/2-13 UNC', system: 'imperial', dia: 12.7, tpi: 13, pitch: 25.4 / 13 },
    // ── imperial UNF ──
    { name: '1/4-28 UNF', system: 'imperial', dia: 6.35, tpi: 28, pitch: 25.4 / 28 },
    { name: '3/8-24 UNF', system: 'imperial', dia: 9.53, tpi: 24, pitch: 25.4 / 24 },
];

/** Look up a preset by name; null for 'Custom' / unknown (the wizard then uses the typed pitch). */
export function threadPreset(name) {
    return THREAD_PRESETS.find((t) => t.name === name) || null;
}

/** The pitch-locked tapping feed (mm/min), rounded to 0.001: F = RPM × pitch(mm). */
export function tapFeed(rpm, pitch) {
    const f = (Number(rpm) || 0) * (Number(pitch) || 0);
    return Math.round(f * 1000) / 1000;
}
