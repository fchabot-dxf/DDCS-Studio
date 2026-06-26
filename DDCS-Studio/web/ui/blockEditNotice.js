/**
 * ui/blockEditNotice.js — at Insert, if the op being re-inserted was hand-edited in the Blocks view, ask whether
 * to KEEP those edits, REPLACE them with the form version, or CANCEL back to the form. App-wide safety net so a
 * form-driven rebuild never silently clobbers block-only params / interleaved messages.
 * Returns a Promise<'merge' | 'replace' | 'cancel'>.
 */
const esc = (s) => String(s).replace(/[<>&]/g, '');

export function showBlockEditNotice(label, summary) {
    return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.className = 'block-edit-notice';
        ov.style.cssText = 'position:fixed; inset:0; z-index:10090; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center;';
        const btn = (c, text, primary, tip) => `<button type="button" data-c="${c}" title="${tip || ''}" style="padding:6px 14px; font-size:12px; border-radius:5px; cursor:pointer; border:1px solid ${primary ? 'var(--accent,#2d7ff9)' : 'var(--border,rgba(255,255,255,.2))'}; background:${primary ? 'var(--accent,#2d7ff9)' : 'transparent'}; color:${primary ? '#fff' : 'var(--text-main,#cfd6df)'};">${text}</button>`;
        // Informed diff (from opGlow.opEditSummary — MID #1's same live-vs-replayReconcile diff): SHOW the block-only
        // residue a form Replace would discard — injected lines (+) and value overrides (old → new) — so the choice
        // isn't blind. Omitted when there's nothing to show (or no summary passed → the old blind notice).
        const fmt = (s) => esc(String(s == null ? '' : s)).replace(/\s+/g, ' ').trim();
        const rows = [];
        ((summary && summary.injected) || []).forEach((ln) => { const t = fmt(ln); if (t) rows.push(`<div><span style="color:#7ee787;">+ </span>${t}</div>`); });
        ((summary && summary.overrides) || []).forEach((o) => { const f = fmt(o.from), t = fmt(o.to); if (f || t) rows.push(`<div><span style="color:#f85149; text-decoration:line-through; opacity:.85;">${f}</span> <span style="opacity:.5;">→</span> <span style="color:#7ee787;">${t}</span></div>`); });
        const diff = rows.length ? `<div style="margin:0 0 12px;">
            <div style="font-size:11px; color:var(--text-dim,#8a93a0); margin:0 0 5px;">Replace would discard these Blocks edits:</div>
            <div style="max-height:160px; overflow:auto; background:var(--bg,#0b0f14); border:1px solid var(--border,#2a313b); border-radius:6px; padding:7px 9px; font:11px/1.55 ui-monospace,Menlo,Consolas,monospace; white-space:pre-wrap; word-break:break-word;">${rows.join('')}</div>
        </div>` : '';
        ov.innerHTML = `<div style="width:min(${rows.length ? 480 : 400}px,92vw); background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; padding:16px 18px; box-shadow:0 14px 40px rgba(0,0,0,.6);">
            <h2 style="margin:0 0 6px; font-size:15px;">"${esc(label)}" was edited in Blocks</h2>
            <p style="margin:0 0 14px; font-size:12px; color:var(--text-dim,#8a93a0); opacity:.95;">This op was edited in Blocks (custom params, interleaved comments). <b style="color:var(--text-main,#e6ecf2);">Keep both</b> merges those edits with your form changes; <b style="color:var(--text-main,#e6ecf2);">Replace with form</b> drops them for the form version.</p>
            ${diff}<div style="display:flex; gap:8px; justify-content:flex-end;">
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
