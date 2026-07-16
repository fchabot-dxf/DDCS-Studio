/**
 * wizards/materials.js — the declared MATERIALS table + the classic feeds & speeds math (t867, backlog item 8).
 *
 * A DECLARED data module (the threads.js precedent): a flat array of honest starter rows + a lookup + a pure derive.
 * Each row carries a surface-speed range (m/min) and a chip-load-per-flute range (mm) that varies BY TOOL-DIA BAND
 * (small tools take a smaller chip). Ranges are HONEST, not fake precision — the helper suggests the midpoint and the
 * form shows the range + the working. User-extensible later (same shape). The suggestion is ADVISORY: the classic
 * formulas below, no invention — the user owns the final numbers ([[dont-declare-away-user-responsibility]]).
 *
 *   RPM  = surfaceSpeed(m/min) × 1000 / (π × dia_mm)          [rev/min], clamped to the declared spindle range
 *   feed = RPM × flutes × chipLoad(mm/flute)                  [mm/min]
 */

// Tool-diameter band EDGES (mm): a dia ≤ 3 → band 0, ≤ 6 → band 1, ≤ 12 → band 2, else band 3. chipLoad has one
// [min,max] entry per band (4 entries), so a 1mm engraver takes far less chip than a 12mm roughing endmill.
export const DIA_BANDS = [3, 6, 12];

/** [{ name, surfaceSpeed: [min,max] m/min, chipLoad: [[min,max]×4 by DIA_BANDS] mm/flute }]. Carbide-tooling hobby-CNC
 *  ranges — starting points, not gospel; the form shows the range and the user tunes. Custom = pick nothing (no change). */
export const MATERIALS = [
    // ── wood / sheet ──
    { name: 'Softwood', surfaceSpeed: [250, 600], chipLoad: [[0.05, 0.13], [0.10, 0.25], [0.18, 0.38], [0.25, 0.50]] },
    { name: 'Hardwood', surfaceSpeed: [180, 450], chipLoad: [[0.04, 0.10], [0.08, 0.20], [0.15, 0.30], [0.20, 0.40]] },
    { name: 'MDF',      surfaceSpeed: [200, 500], chipLoad: [[0.05, 0.13], [0.10, 0.25], [0.18, 0.35], [0.25, 0.45]] },
    // ── plastics ──
    { name: 'Acrylic',  surfaceSpeed: [150, 350], chipLoad: [[0.03, 0.08], [0.05, 0.13], [0.10, 0.20], [0.13, 0.25]] },
    { name: 'Plastic',  surfaceSpeed: [150, 400], chipLoad: [[0.03, 0.10], [0.05, 0.15], [0.10, 0.25], [0.15, 0.30]] },
    // ── metals ──
    { name: 'Aluminum', surfaceSpeed: [120, 300], chipLoad: [[0.010, 0.030], [0.025, 0.060], [0.050, 0.100], [0.080, 0.150]] },
    { name: 'Brass',    surfaceSpeed: [90, 250],  chipLoad: [[0.010, 0.025], [0.020, 0.050], [0.040, 0.090], [0.060, 0.130]] },
    { name: 'Steel',    surfaceSpeed: [25, 90],   chipLoad: [[0.005, 0.020], [0.013, 0.040], [0.025, 0.065], [0.040, 0.090]] },
];

/** Look up a material row by name; null for 'Custom'/unknown (the wizard then leaves the fields alone). */
export function material(name) {
    return MATERIALS.find((m) => m.name === name) || null;
}

/** The 0-based chip-load band index for a tool diameter (mm), via DIA_BANDS edges. */
export function chipBand(dia) {
    const d = Number(dia) || 0;
    for (let i = 0; i < DIA_BANDS.length; i++) { if (d <= DIA_BANDS[i]) return i; }
    return DIA_BANDS.length;   // largest band
}

const mid = (r) => (Number(r[0]) + Number(r[1])) / 2;

/**
 * The classic feeds & speeds suggestion (advisory). Returns null when it can't compute (no material / no diameter).
 * Uses the midpoint of the declared ranges; clamps RPM to the declared spindle range and REPORTS the clamp honestly.
 *   { rpm, feed, wantedRpm, clamped: null|'max'|'min', flutes, surfaceSpeed, chipLoad, ssRange, chipRange, spindle }
 * rpm/feed are integers (feeds & speeds precision is illusory below 1 rpm / 1 mm/min); feed always uses the CLAMPED rpm.
 */
export function suggestFeedsSpeeds({ materialName, dia, flutes, spindle } = {}) {
    const m = material(materialName);
    const d = Number(dia) || 0;
    if (!m || d <= 0) return null;
    const nFlutes = (Number(flutes) > 0) ? Number(flutes) : 2;   // blank/0 flutes → the default 2 (per the tool-table default)
    const ss = mid(m.surfaceSpeed);                               // m/min (midpoint)
    const band = chipBand(d);
    const chipRange = m.chipLoad[Math.min(band, m.chipLoad.length - 1)];
    const chip = mid(chipRange);                                  // mm/flute (midpoint)

    const wantedRpm = Math.round(ss * 1000 / (Math.PI * d));      // RPM = SS·1000 / (π·dia)
    const minR = Math.max(0, Number(spindle && spindle.minRpm) || 0);
    const maxR = Math.max(0, Number(spindle && spindle.maxRpm) || 0);
    let rpm = wantedRpm, clamped = null;
    if (maxR > 0 && wantedRpm > maxR) { rpm = maxR; clamped = 'max'; }
    else if (minR > 0 && wantedRpm < minR) { rpm = minR; clamped = 'min'; }

    const feed = Math.round(rpm * nFlutes * chip);               // feed = RPM · flutes · chipLoad
    return {
        rpm, feed, wantedRpm, clamped, flutes: nFlutes,
        surfaceSpeed: ss, chipLoad: chip, ssRange: m.surfaceSpeed.slice(), chipRange: chipRange.slice(),
        spindle: { minRpm: minR, maxRpm: maxR },
    };
}
