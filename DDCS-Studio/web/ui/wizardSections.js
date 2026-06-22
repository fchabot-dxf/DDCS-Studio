/**
 * ui/wizardSections.js — frame a wizard form's fields per CATEGORY. The forms are a flat list of
 * `<span class="section-label">…</span>` headers followed by their `.grid-*` field groups; this wraps each header +
 * the siblings up to the next header in a `.wiz-section` div, so each category reads as a framed group (styled in
 * styles.css, theme-aware). Generic across every wizard — no per-form markup. Idempotent (dataset.framed guard);
 * IDs are preserved, so getElementById + show/hide of inner groups keep working.
 */
export function frameWizardSections(root) {
    if (!root) return;
    const containers = new Set();   // the parents that hold section-labels (.wiz-controls, or the body for 1-pane wizards)
    root.querySelectorAll('.section-label').forEach((lbl) => { if (lbl.parentElement) containers.add(lbl.parentElement); });
    containers.forEach((controls) => {
        if (controls.dataset.framed) return;
        controls.dataset.framed = '1';
        let section = null;
        [...controls.children].forEach((node) => {                     // static snapshot — safe while we move nodes
            if (node.classList && node.classList.contains('section-label')) {
                section = document.createElement('div');
                section.className = 'wiz-section';
                controls.insertBefore(section, node);                  // frame opens where the header was
                section.appendChild(node);
            } else if (section) {
                section.appendChild(node);                             // fields up to the next header join this frame
            }
            // nodes before the first section-label (e.g. .wiz-usage) stay where they are
        });
    });
}
