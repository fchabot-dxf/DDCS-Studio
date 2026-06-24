/**
 * ui/blockEditNotice.js — at Insert, if the op being re-inserted was hand-edited in the Blocks view, ask whether
 * to KEEP those edits, REPLACE them with the form version, or CANCEL back to the form. App-wide safety net so a
 * form-driven rebuild never silently clobbers block-only params / interleaved messages.
 * Returns a Promise<'merge' | 'replace' | 'cancel'>.
 */
const esc = (s) => String(s).replace(/[<>&]/g, '');

export function showBlockEditNotice(label) {
    return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.className = 'block-edit-notice';
        ov.style.cssText = 'position:fixed; inset:0; z-index:10090; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center;';
        const btn = (c, text, primary, tip) => `<button type="button" data-c="${c}" title="${tip || ''}" style="padding:6px 14px; font-size:12px; border-radius:5px; cursor:pointer; border:1px solid ${primary ? 'var(--accent,#2d7ff9)' : 'var(--border,rgba(255,255,255,.2))'}; background:${primary ? 'var(--accent,#2d7ff9)' : 'transparent'}; color:${primary ? '#fff' : 'var(--text-main,#cfd6df)'};">${text}</button>`;
        ov.innerHTML = `<div style="width:min(400px,92vw); background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; padding:16px 18px; box-shadow:0 14px 40px rgba(0,0,0,.6);">
            <h2 style="margin:0 0 6px; font-size:15px;">"${esc(label)}" was edited in Blocks</h2>
            <p style="margin:0 0 14px; font-size:12px; color:var(--text-dim,#8a93a0); opacity:.95;">This op was edited in Blocks (custom params, interleaved comments). <b style="color:var(--text-main,#e6ecf2);">Keep both</b> merges those edits with your form changes; <b style="color:var(--text-main,#e6ecf2);">Replace with form</b> drops them for the form version.</p>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
                ${btn('cancel', 'Cancel', false, 'Go back to the form — nothing is inserted.')}${btn('replace', 'Replace with form', false, 'Rebuild this op from the form, discarding the Blocks-only edits.')}${btn('merge', 'Keep both', true, "Some edits made in Blocks can't be represented in the form, so merging keeps them alongside your form changes instead of losing them.")}
            </div></div>`;
        document.body.appendChild(ov);
        const done = (c) => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(c); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done('cancel'); } };
        document.addEventListener('keydown', onKey, true);
        ov.addEventListener('click', (e) => {
            if (e.target === ov) return done('cancel');
            const c = e.target.getAttribute && e.target.getAttribute('data-c');
            if (c) done(c);
        });
    });
}
