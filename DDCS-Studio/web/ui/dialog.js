/**
 * ui/dialog.js — ONE in-app dialog helper (t684 d): promise-based, theme-aware replacements for the browser's blocking
 * window.confirm / window.prompt / window.alert. Generalises the blockEditNotice overlay pattern (a fixed backdrop + a
 * themed panel, Enter=submit, Esc/backdrop=cancel). A grep-guard (tests/dialog-grep-guard.spec.js) forbids bare
 * window.confirm/prompt/alert anywhere in web/ui + web/wizards, so every ask flows through here — legible on every skin.
 *
 *   dlgConfirm(message, opts?) → Promise<boolean>          // OK/Cancel; Enter=OK, Esc/backdrop=Cancel
 *   dlgPrompt(message, default?, opts?) → Promise<string|null>   // OK returns the (trimmed-optional) text; Cancel/Esc → null
 *   dlgNotice(message, opts?) → Promise<void>              // a single dismiss button (alert); Enter/Esc/backdrop dismiss
 *
 * opts: { title, okLabel, cancelLabel, danger (red primary for destructive), placeholder, multiline (prompt→textarea) }.
 */

let _openCount = 0;

function openDialog(kind, message, opts = {}) {
    return new Promise((resolve) => {
        const isPrompt = kind === 'prompt', isNotice = kind === 'notice';
        const okLabel = opts.okLabel || (isNotice ? 'OK' : isPrompt ? 'OK' : 'OK');
        const cancelLabel = opts.cancelLabel || 'Cancel';
        const primaryVar = opts.danger ? 'var(--danger,#d64550)' : 'var(--accent,#2d7ff9)';

        const ov = document.createElement('div');
        ov.className = 'app-dialog';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.style.cssText = 'position:fixed; inset:0; z-index:10095; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px;';

        const panel = document.createElement('div');
        panel.style.cssText = 'width:min(440px,94vw); max-height:88vh; overflow:auto; background:var(--panel,#161b22); color:var(--text-main,#e6ecf2); border:1px solid var(--border,#2a313b); border-radius:10px; padding:16px 18px; box-shadow:0 14px 40px rgba(0,0,0,.6);';

        if (opts.title) {
            const h = document.createElement('h2');
            h.style.cssText = 'margin:0 0 8px; font-size:15px;';
            h.textContent = opts.title;
            panel.appendChild(h);
        }
        const msg = document.createElement('div');
        msg.style.cssText = 'margin:0 0 14px; font-size:13px; line-height:1.5; color:var(--text-main,#e6ecf2); white-space:pre-wrap; word-break:break-word;';
        msg.textContent = String(message == null ? '' : message);   // textContent → safe + preserves \n (pre-wrap)
        panel.appendChild(msg);

        let input = null;
        if (isPrompt) {
            input = document.createElement(opts.multiline ? 'textarea' : 'input');
            if (!opts.multiline) input.type = 'text';
            input.value = opts.defaultValue != null ? String(opts.defaultValue) : (opts.default != null ? String(opts.default) : '');
            if (opts.placeholder) input.placeholder = opts.placeholder;
            input.style.cssText = 'width:100%; box-sizing:border-box; margin:0 0 14px; padding:7px 9px; font-size:13px; border-radius:6px; border:1px solid var(--border,#2a313b); background:var(--bg,#0b0f14); color:var(--text-main,#e6ecf2);' + (opts.multiline ? ' min-height:80px; resize:vertical; font-family:ui-monospace,Menlo,Consolas,monospace;' : '');
            panel.appendChild(input);
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';
        const mkBtn = (text, primary) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.style.cssText = `padding:6px 14px; font-size:12px; border-radius:5px; cursor:pointer; border:1px solid ${primary ? primaryVar : 'var(--border,rgba(255,255,255,.2))'}; background:${primary ? primaryVar : 'transparent'}; color:${primary ? '#fff' : 'var(--text-main,#cfd6df)'};`;
            return b;
        };
        const cancelBtn = isNotice ? null : mkBtn(cancelLabel, false);
        const okBtn = mkBtn(okLabel, true);
        if (cancelBtn) row.appendChild(cancelBtn);
        row.appendChild(okBtn);
        panel.appendChild(row);
        ov.appendChild(panel);
        document.body.appendChild(ov);
        _openCount++;

        const cancelVal = isPrompt ? null : (isNotice ? undefined : false);
        const okVal = isPrompt ? '' : (isNotice ? undefined : true);
        let closed = false;
        const done = (val) => {
            if (closed) return; closed = true;
            _openCount = Math.max(0, _openCount - 1);
            ov.remove();
            document.removeEventListener('keydown', onKey, true);
            resolve(val);
        };
        const submit = () => done(isPrompt ? (input ? input.value : '') : okVal);
        const cancel = () => done(cancelVal);
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
            else if (e.key === 'Enter' && (!opts.multiline || e.ctrlKey || e.metaKey)) {   // Enter submits (Ctrl/Cmd-Enter for a multiline prompt)
                if (document.activeElement === cancelBtn) return;   // Enter on a focused Cancel cancels
                e.preventDefault(); submit();
            }
        };
        document.addEventListener('keydown', onKey, true);
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) cancel(); });   // backdrop click cancels/dismisses
        okBtn.addEventListener('click', submit);
        if (cancelBtn) cancelBtn.addEventListener('click', cancel);

        (input || okBtn).focus();
        if (input && input.select) input.select();
    });
}

/** In-app confirm — resolves true (OK) / false (Cancel/Esc/backdrop). */
export function dlgConfirm(message, opts = {}) { return openDialog('confirm', message, opts); }
/** In-app prompt — resolves the entered string (OK) / null (Cancel/Esc/backdrop). */
export function dlgPrompt(message, defaultValue = '', opts = {}) { return openDialog('prompt', message, { ...opts, defaultValue }); }
/** In-app notice (alert) — resolves when dismissed. */
export function dlgNotice(message, opts = {}) { return openDialog('notice', message, opts); }
/** How many dialogs are open (tests / focus management). */
export function dialogsOpen() { return _openCount; }
