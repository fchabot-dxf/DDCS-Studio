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
const parts = m[1].split('.').map(Number);
parts[parts.length - 1] += 1;        // bump the last segment, e.g. V10.23 -> V10.24
const v = parts.join('.');

html = html.replace(/(class="ver">V)[0-9][0-9.]*(<)/, `$1${v}$2`);                          // the chip (release + update-banner source of truth)
html = html.replace(/(<title>DDCS Studio V)[0-9][0-9.]*( - Modular<\/title>)/, `$1${v}$2`); // the window title
fs.writeFileSync(htmlPath, html);

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = parts.length >= 3 ? v : v + '.0';   // package.json wants 3-part semver
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Version bumped to V${v}  (chip + title synced; package.json -> ${pkg.version})`);
