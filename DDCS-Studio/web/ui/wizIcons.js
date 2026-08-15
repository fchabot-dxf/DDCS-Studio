// ui/wizIcons.js — the shared wizbar icon registry. ONE source for the line-art SVG icons + the `ic:<id>`
// resolution, consumed by BOTH the bar (commandDeck.wizItemIcon) and the Settings → Wizards icon picker
// (wizardManagerPanel). A user can re-icon ANY wizard (built-in or custom) with an emoji OR one of the built-in
// line-art glyphs referenced as `ic:<id>`. An explicit iconOverride wins over the built-in default.
// (Curating a NEW, larger glyph set + folding in the header icons is the follow-up — ROADMAP MID "curated
// line-art SVG icon library".)

// Inline-SVG item icons — 24×24 stroke grid, rendered ~14px inline before the label, keyed by built-in op-id.
// Library entries that use an SVG carry icon:'' — this map is their source.
export const WIZ_ITEM_SVG = {
    rotary_center: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="4" y="8" width="13" height="8" rx="2" stroke="#64748b"/><ellipse cx="17" cy="12" rx="2" ry="4" stroke="#64748b"/><line x1="1.5" y1="12" x2="22.5" y2="12" stroke="#e11d48" stroke-dasharray="3 2"/></svg>`,
    drill:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><ellipse cx="12" cy="12" rx="9" ry="5.5" stroke="#94a3b8" stroke-width="2.5"/><ellipse cx="12" cy="12" rx="6.5" ry="3.6" fill="#1e293b" stroke="none"/></svg>`,
    bore:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><ellipse cx="12" cy="12" rx="9" ry="5.5" stroke="#94a3b8" stroke-width="2.5"/><ellipse cx="12" cy="12" rx="6.5" ry="3.6" stroke="#94a3b8" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#1e293b" stroke="none"/></svg>`,
    pocket:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="5" width="18" height="14" rx="1.5" stroke="#94a3b8" stroke-width="2.5"/><rect x="7" y="9" width="10" height="6" rx="1" fill="#1e293b" stroke="none"/></svg>`,
    contour:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="6" y="8" width="12" height="8" rx="1" fill="#1e293b" stroke="none"/><rect x="3" y="5" width="18" height="14" rx="1.5" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="3 2"/></svg>`,
    slot:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="9" width="18" height="6" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="7" y1="12" x2="17" y2="12" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/></svg>`,
    surfacing: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="4" width="18" height="16" rx="1.5" stroke="#94a3b8" stroke-width="2.5"/><path d="M5 8h14M5 12h14M5 16h14" stroke="#1e293b" stroke-width="1.5"/></svg>`,
    text:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px;margin-right:3px;"><path d="M5 6h14M12 6v13" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"/></svg>`,

    // Lathe family (t1911) — every icon shares ONE constant: the stock bar on its spinning axis (a red dashed
    // centreline, the same convention `rotary_center` above already uses for "this rotates"), so a machinist
    // reads "lathe op" before reading which one. Each op then differs by what the CUT does to the bar, not by
    // tool angle (facing/parting/OD-turn would be indistinguishable if drawn as just an angled tool meeting a
    // bar). Steel `#94a3b8` = stock, dark `#1e293b` fill = removed material (matches the mill set's own cut
    // convention above), amber `#f59e0b` = cutting tool, red `#e11d48` = axis + probe ball (ties to HEADER_ICONS
    // .probe's own ruby-ball convention). Keyed by the registered user-op id (`entryIconHtml` reads
    // `ICON_REGISTRY[entry.id]` directly — no wizardLibrary.js change needed).
    // t1918 — RECOARSENED: the user found the first pass too small at its actual 14px render size (measured, not
    // guessed — a 4-unit-tall bar is ~2.3px; a 1.1-stroke dashed line at ~1px is nearly invisible). Re-derived the
    // whole family from `rotary_center`'s OWN proven weight (rect height 8, dash "3 2" at the inherited
    // stroke-width 2) rather than inventing a new scale — bar height doubled to 8, its own stroke to 2.5 (matches
    // `drill`/`bore` above), the centreline to stroke-width 2 with the same "3 2" dash, every cut-mark/probe-ball
    // enlarged to match. Fewer, heavier marks — no attempt to preserve fine detail (the polygon's own facets, the
    // old probe ball) that couldn't survive the render size in the first place.
    user_lathe_facing:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="20" height="8" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/><rect x="16.5" y="6.5" width="4.5" height="11" fill="#1e293b"/></svg>`,
    user_lathe_odturn:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="11" height="8" rx="2" stroke="#94a3b8" stroke-width="2.5"/><rect x="12" y="10" width="10" height="4" rx="1.5" stroke="#94a3b8" stroke-width="2.2"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/></svg>`,
    user_lathe_parting:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="20" height="8" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/><rect x="10" y="6" width="3.5" height="12" fill="#1e293b"/></svg>`,
    user_lathe_centerdrill: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="20" height="8" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/><path d="M22 7v10l-6-5z" fill="#1e293b"/></svg>`,
    user_lathe_polygon:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="10" height="8" rx="2" stroke="#94a3b8" stroke-width="2.5"/><polygon points="15,7 20,7 22.5,12 20,17 15,17 12.5,12" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/></svg>`,
    user_lathe_faceprobe:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="20" height="8" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/><line x1="23.5" y1="3.5" x2="19.5" y2="7.5" stroke="#64748b" stroke-width="2.2"/><circle cx="19" cy="8" r="2.6" fill="#e11d48" stroke="none"/></svg>`,
    user_lathe_odprobe:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="2" y="8" width="20" height="8" rx="3" stroke="#94a3b8" stroke-width="2.5"/><line x1="0.5" y1="12" x2="23.5" y2="12" stroke="#e11d48" stroke-width="2" stroke-dasharray="3 2"/><line x1="12" y1="1.5" x2="12" y2="6.5" stroke="#64748b" stroke-width="2.2"/><circle cx="12" cy="7" r="2.6" fill="#e11d48" stroke="none"/></svg>`,
};

// The pickable line-art set: `ic:<id>` resolves here. v1 = the built-in icons themselves (the curated set).
export const ICON_REGISTRY = WIZ_ITEM_SVG;

// Resolve an icon VALUE (emoji or `ic:<id>`) to bar-ready markup: emoji → "<emoji> " (trailing space, as the bar
// has always rendered); `ic:<id>` → the registry SVG; empty/unknown → ''.
export function resolveIcon(value) {
    if (!value) return '';
    if (value.startsWith('ic:')) return ICON_REGISTRY[value.slice(3)] || '';
    return `${value} `;
}

// The icon an ENTRY should render: an explicit user override wins (emoji or ic:<id>); else the built-in default
// line-art (by id); else the entry's default emoji (the ✦ user-op marker, etc.). Used by the bar AND the picker's
// current-icon button — so they always agree on what "the current icon" is.
export function entryIconHtml(entry) {
    if (entry.iconOverride) return resolveIcon(entry.iconOverride);
    if (ICON_REGISTRY[entry.id]) return ICON_REGISTRY[entry.id];
    return entry.icon ? `${entry.icon} ` : '';
}
