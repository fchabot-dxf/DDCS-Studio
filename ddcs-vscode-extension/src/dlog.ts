// dlog.ts — tiny debug logger that appends to _debug.log in the extension folder, so diagnostics from
// both the extension host AND the webview (forwarded via postMessage) land in one file the dev can read.
// Temporary debugging aid.
import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.join(__dirname, '..', '_debug.log');

export function dlogClear(): void {
    try { fs.writeFileSync(LOG_PATH, `=== DDCS debug log (cleared) ===\n`); } catch (_) { /* ignore */ }
}

export function dlog(msg: string): void {
    try { fs.appendFileSync(LOG_PATH, msg + '\n'); } catch (_) { /* ignore */ }
}
