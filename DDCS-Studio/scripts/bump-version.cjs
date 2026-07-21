// Bump the app version. SINGLE SOURCE OF TRUTH = the `.ver` chip in web/index.html
// (`<span class="ver">V<x.y[.z]>`) — that's exactly what desktop-release.yml reads to cut a release and
// what the in-app update banner (ui/updateCheck.js) compares. We bump the chip's last segment, then sync
// the window <title> and package.json so everything agrees.
//
// (The old script was out of sync: it bumped package.json's own 9.x scheme + a `DDCS STUDIO V…` header
// string that no longer exists, and never touched the chip the release actually reads.)
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'web', 'index.html');
const pkgPath = path.join(__dirname, '..', 'package.json');

let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/class="ver">V([0-9][0-9.]*)</);
if (!m) {
    console.error('bump-version: no `<span class="ver">V…</span>` chip found in web/index.html — aborting.');
    process.exit(1);
}
// t785 (user): DATE-BASED versions — V<YYYY>.<MM>.<DD>.<n>, n = the release counter within the day (resets daily).
// Dot-only so the existing segment-wise numeric compare (updateCheck.parseV) needs NO change, and every date version
// sorts after the legacy 10.x line (2026 > 10). The analytics decimal-sort scramble (10.169 < 10.97) dies with the scheme.
const now = new Date();
const Y = now.getFullYear(), M = String(now.getMonth() + 1).padStart(2, '0'), D = String(now.getDate()).padStart(2, '0');
const prev = m[1].split('.');
const sameDay = prev.length === 4 && prev[0] === String(Y) && prev[1] === M && prev[2] === D;
const n = sameDay ? (parseInt(prev[3], 10) || 0) + 1 : 1;
const v = `${Y}.${M}.${D}.${n}`;

html = html.replace(/(class="ver">V)[0-9][0-9.]*(<)/, `$1${v}$2`);                          // the chip (release + update-banner source of truth)
html = html.replace(/(<title>DDCS Studio V)[0-9][0-9.]*(<\/title>)/, `$1${v}$2`); // the window title
fs.writeFileSync(htmlPath, html);

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = `${Y}.${parseInt(M, 10)}.${parseInt(D, 10)}`;   // package.json stays 3-part (date only; the daily counter lives in the chip)
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// The DECLARED live-version artifact for the web version-nudge (ui/updateCheck.js): a small, cache-bustable JSON
// source the deployed app fetches to detect a stale cached bundle — NOT the index.html chip regexed out of HTML.
const verJsonPath = path.join(__dirname, '..', 'web', 'version.json');
fs.writeFileSync(verJsonPath, JSON.stringify({ v }) + '\n');

console.log(`Version bumped to V${v}  (chip + title + version.json synced; package.json -> ${pkg.version})`);
