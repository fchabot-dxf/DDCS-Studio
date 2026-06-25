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
