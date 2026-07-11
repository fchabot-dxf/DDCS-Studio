/**
 * tests/_appDialog.js — test helper for the in-app dialog (ui/dialog.js). The confirm/prompt/alert sweep (t684 d) replaced
 * the browser's native dialogs (which Playwright handled via page.on('dialog')) with an in-app `.app-dialog` overlay. This
 * installs a MutationObserver that auto-responds to any dialog that appears — the test equivalent of the old accept/dismiss.
 *
 *   await autoAppDialog(page, { accept: true })            // click OK on every dialog (the old d.accept())
 *   await autoAppDialog(page, { accept: false })           // click Cancel (confirm → false)
 *   await autoAppDialog(page, { accept: true, prompt: 'x' })// prompts get 'x' then OK
 *   await appDialogLog(page)                                // the messages of the dialogs that appeared (assert none / a specific one)
 */
export async function autoAppDialog(page, resp = {}) {
    await page.evaluate((r) => {
        window.__appDlgLog = [];
        if (window.__appDlgObs) window.__appDlgObs.disconnect();
        const act = () => {
            const d = document.querySelector('.app-dialog'); if (!d) return;
            window.__appDlgLog.push(d.textContent || '');
            const inp = d.querySelector('input, textarea');
            const btns = d.querySelectorAll('button');
            if (inp) { if (r.prompt != null) inp.value = r.prompt; btns[btns.length - 1].click(); }   // PROMPT → submit the value (OK)
            else { const btn = (r.accept === false && btns.length > 1) ? btns[0] : btns[btns.length - 1]; if (btn) btn.click(); }   // CONFIRM/NOTICE → accept (OK) / cancel (Cancel is first)
        };
        window.__appDlgObs = new MutationObserver(act);
        window.__appDlgObs.observe(document.body, { childList: true });
        act();   // handle one already open
    }, resp);
}

/** The recorded messages of the dialogs that appeared since autoAppDialog was installed. */
export function appDialogLog(page) { return page.evaluate(() => window.__appDlgLog || []); }
