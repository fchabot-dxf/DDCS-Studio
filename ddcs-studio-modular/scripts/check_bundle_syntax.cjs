const fs = require('fs');
const path = require('path');
const child = require('child_process');

const out = path.join(__dirname, '..', 'output', 'ddcs-studio-standalone.html');
if (!fs.existsSync(out)) {
    console.error('Bundle file not found:', out);
    process.exit(2);
}
const txt = fs.readFileSync(out, 'utf8');
// extract the big inline script that begins with // --- themes.js ---
const m = txt.match(/<script>\s*\/\/ --- themes\.js ---[\s\S]*?<\/script>/);
if (!m) {
    console.error('Could not find bundle <script> block');
    process.exit(3);
}
const script = m[0].replace(/^<script>\s*/, '').replace(/<\/script>$/, '');
const tmp = path.join(__dirname, 'tmp_bundle_check.js');
fs.writeFileSync(tmp, script, 'utf8');
console.log('Wrote temp bundle to', tmp);

// Run node --check
try {
    const outp = child.execFileSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    console.log('Syntax check passed');
    console.log(outp);
} catch (err) {
    if (err.stdout) console.log('stdout:\n', err.stdout);
    if (err.stderr) console.log('stderr:\n', err.stderr);
    process.exit(1);
}