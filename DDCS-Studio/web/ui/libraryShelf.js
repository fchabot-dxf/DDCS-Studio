/**
 * ui/libraryShelf.js — THE SHELF: one rendering of the library folder, used by both kinds (t1247).
 *
 * The wizard surface lists `.wiz` files and the CAM surface lists `.cam` files, and apart from what a card SAYS the
 * two are the same screen: pick the folder once, see what is in it, click a card to import, refuse a bad file by
 * name. Writing that twice would be two places to fix a wording, a permission edge or an empty state — so it is one
 * component the caller configures with what its kind's cards say and what a click should do.
 *
 * IT WRITES NOTHING. Rendering the shelf lists a folder and reads file headers; the only write in this module is the
 * user pressing Export, which the caller owns. Import hands the parsed object to the caller and stops there.
 */
import { listLibrary, ensureLibraryFolder, getLibraryFolder, deleteLibraryFile, LIBRARY_KINDS, hasFSA } from '../data/libraryFolder.js';
import { dlgConfirm, dlgNotice } from './dialog.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Render the shelf into `host`.
 * @param {HTMLElement} host
 * @param {object} opts
 * @param {'wiz'|'cam'} opts.kindKey     which files to list
 * @param {(entry) => string} opts.describe   the card's second line, from the parsed object
 * @param {(entry) => Promise<void>|void} opts.onImport  the user clicked a card
 * @param {string} [opts.emptyHint]      what to say when the folder holds none of this kind
 */
export async function renderLibraryShelf(host, opts) {
    if (!host) return;
    const { kindKey, describe, onImport, emptyHint = '' } = opts;
    const kind = LIBRARY_KINDS[kindKey];
    const rerender = () => renderLibraryShelf(host, opts);

    const dir = await getLibraryFolder();
    if (!dir) {
        // NOT an error state — nobody has picked a folder yet. Say what the folder is FOR, then one button.
        host.innerHTML = `<div class="lsh-empty">Keep shared ${esc(kind.what)}s in a folder of your own — pick it once, and every
            <code>${esc(kind.ext)}</code> in it shows up here to import with a click.
            ${hasFSA() ? '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" data-lsh="pick">📁 Choose library folder…</button></div>'
                       : '<div style="margin-top:10px" class="lsh-dim">This browser cannot grant a folder, so the library is unavailable here. The desktop app and Chrome/Edge can.</div>'}</div>`;
        const pick = host.querySelector('[data-lsh="pick"]');
        if (pick) pick.addEventListener('click', async () => { if (await ensureLibraryFolder()) rerender(); });
        return;
    }

    host.innerHTML = '<div class="lsh-dim">Reading the library folder…</div>';
    const entries = await listLibrary([kindKey]);
    const rows = entries.map((e, i) => {
        if (e.error) {
            // a named refusal, on the card itself — the file is right there, so say what is wrong with THAT file
            return `<div class="lsh-card is-bad" title="${esc(e.error)}"><div class="lsh-name">${esc(e.name)}</div>
                <div class="lsh-sub lsh-bad">${esc(e.error)}</div>
                <button type="button" class="lsh-del" data-lsh-del="${i}" title="Remove this file from the library folder">✕</button></div>`;
        }
        return `<div class="lsh-card" data-lsh-open="${i}" role="button" tabindex="0" title="Import “${esc(e.stem)}”">
            <div class="lsh-name">${esc(e.stem)}</div>
            <div class="lsh-sub">${esc(describe ? describe(e) : kind.what)}</div>
            <button type="button" class="lsh-del" data-lsh-del="${i}" title="Remove this file from the library folder">✕</button></div>`;
    }).join('');

    host.innerHTML = `<div class="lsh-head">
            <span class="lsh-dim">📁 ${esc(dir.name || 'library')}</span>
            <button type="button" class="wss-link" data-lsh="change">Change…</button>
            <span style="flex:1"></span>
            <button type="button" class="wss-link" data-lsh="refresh">Refresh</button>
        </div>
        ${entries.length ? `<div class="lsh-grid">${rows}</div>`
                         : `<div class="lsh-empty">No <code>${esc(kind.ext)}</code> files in this folder yet. ${esc(emptyHint)}</div>`}`;

    host.querySelector('[data-lsh="refresh"]').addEventListener('click', rerender);
    // The card/delete handler is DELEGATED on the host, which outlives every re-render — so it is bound ONCE. Binding
    // it per render stacked a listener each time the shelf redrew, and by the third redraw one click ran the import
    // three times. The current entries are read off the host instead of captured in the closure.
    host.__lshEntries = entries;
    host.querySelector('[data-lsh="change"]').addEventListener('click', async () => {
        const { forgetLibraryFolder } = await import('../data/libraryFolder.js');
        await forgetLibraryFolder();
        if (await ensureLibraryFolder()) rerender(); else rerender();
    });
    if (host.__lshBound) return;
    host.__lshBound = true;
    host.addEventListener('click', async (e) => {
        const rows = host.__lshEntries || [];
        const del = e.target.closest('[data-lsh-del]');
        if (del) {
            e.stopPropagation();
            const entry = rows[Number(del.dataset.lshDel)];
            if (await dlgConfirm(`Delete “${entry.name}” from library?\nThis removes the file from the folder — anything already imported stays.`, { danger: true, okLabel: 'Delete' })) {
                await deleteLibraryFile(entry.name);
                rerender();
            }
            return;
        }
        const card = e.target.closest('[data-lsh-open]');
        if (!card) return;
        const entry = rows[Number(card.dataset.lshOpen)];
        if (!entry || entry.error) return;
        try { await onImport(entry); }
        catch (err) { dlgNotice(`“${entry.name}” could not be imported: ${(err && err.message) || err}`); }
    });
}
