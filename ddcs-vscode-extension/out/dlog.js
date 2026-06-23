"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dlogClear = dlogClear;
exports.dlog = dlog;
// dlog.ts — tiny debug logger that appends to _debug.log in the extension folder, so diagnostics from
// both the extension host AND the webview (forwarded via postMessage) land in one file the dev can read.
// Temporary debugging aid.
const fs = require("fs");
const path = require("path");
const LOG_PATH = path.join(__dirname, '..', '_debug.log');
function dlogClear() {
    try {
        fs.writeFileSync(LOG_PATH, `=== DDCS debug log (cleared) ===\n`);
    }
    catch (_) { /* ignore */ }
}
function dlog(msg) {
    try {
        fs.appendFileSync(LOG_PATH, msg + '\n');
    }
    catch (_) { /* ignore */ }
}
//# sourceMappingURL=dlog.js.map