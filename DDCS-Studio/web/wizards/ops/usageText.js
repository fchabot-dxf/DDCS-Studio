/**
 * wizards/ops/usageText.js — the USAGE TEXT GUI block (t2269, wizards-as-data E2 measurement).
 *
 * Declares a custom wizard's top-of-form instructional paragraph right in the stack — the twin of the
 * hand-written `<div class="wiz-usage">`/`<div class="settings-hint">` every mill op + Comm + WCS + all 6
 * ATC shells carry today (13 of 15 shells; surveyed first, t2267). See formWidgets.js's own 'usage_text'
 * traverse() branch for the render side and its own note on the two CSS classes' genuinely different
 * rendered result — not settled here, `style` is the declared escape hatch until a human rules on it.
 *
 * Emits NOTHING — metadata only, read at render time.
 */
export const usageTextBlock = {
    type: 'usage_text', label: 'usage text', category: 'Wizard Layout',
    defaults: { text: 'Describe what this op does and how to use it.', style: 'callout' },
    fields: ['text', 'style'],
    selects: { style: [['Callout (bordered)', 'callout'], ['Plain hint', 'plain']] },
    emit: () => [],   // metadata only — produces no G-code
};
