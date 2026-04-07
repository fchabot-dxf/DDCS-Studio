// Auto-increment patch version in package.json and update index.html version string
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const htmlPath = path.join(__dirname, '..', 'src', 'index.html');

// Read and bump version in package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const versionParts = pkg.version.split('.').map(Number);
versionParts[2] += 1; // bump patch
const newVersion = versionParts.join('.');
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Update version in index.html (title and header)
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/(DDCS Studio V)([\d.]+)( - Modular)/, `$1${newVersion}$3`);
html = html.replace(/(DDCS STUDIO V)([\d.]+)/, `$1${newVersion}`);
fs.writeFileSync(htmlPath, html);

console.log(`Version bumped to ${newVersion}`);
