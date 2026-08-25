/**
 * wizards/ops/codePreview.js — the CODE PREVIEW GUI block (t2263, wizards-as-data E2 measurement).
 *
 * Declares a custom wizard's live G-code preview panel right in the stack — the twin of every hand-written
 * built-in's own hardcoded `<div class="preview-block">` (index.html, 15 occurrences). Surveyed first, not
 * assumed identical: label is "CODE PREVIEW" everywhere except atc_table's own "APPLY MACRO"; the compliant-
 * tag varies too ("(DDCS M350 COMPLIANT)" / "(RUN ON CONTROLLER)" / "(VERIFY ON YOUR MACHINE)" / absent
 * entirely for the generic user-op shell and Communication's own) — real variation, so both are declared
 * fields, not hardcoded here. See formWidgets.js's own 'code_preview' traverse() branch for the render side.
 *
 * A near-namesake, `code_preview_panel` (title/maxHeight, no compliant-tag), was drafted and deleted in the
 * SAME commit that introduced renderUiTree (0bd8b38c) — pruned as unused scaffolding, never once consumed by
 * a real declaration. This is a fresh design informed by the actual 15-block survey above, not a revival of
 * that draft; the field shape genuinely differs (compliant-tag wasn't in it at all).
 *
 * Emits NOTHING — metadata only, read at render time to build the preview chrome; the actual G-code TEXT is
 * written into it live by the SAME mechanism (userOpView.js's update()) that already populates every other
 * twin's code-preview `<pre>`, not by this block.
 */
export const codePreviewBlock = {
    type: 'code_preview', label: 'code preview', category: 'Wizard Previews', kind: 'code_preview',
    defaults: { label: 'CODE PREVIEW', tag: '' },
    fields: ['label', 'tag'],
    emit: () => [],   // metadata only — produces no G-code
};
