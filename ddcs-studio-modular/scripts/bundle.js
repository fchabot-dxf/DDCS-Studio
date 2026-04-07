const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple wrapper to run the Python bundler using whatever python launcher is available
const pythonCandidates = ['py', 'python', 'python3'];
let pythonCmd = null;
for (const c of pythonCandidates) {
    try {
        const res = spawnSync(c, ['--version'], { encoding: 'utf8' });
        if (res.status === 0) {
            pythonCmd = c;
            break;
        }
    } catch (e) {
        // ignore
    }
}
if (!pythonCmd) {
    console.error('No python launcher found. Install Python or ensure `py`/`python` is on PATH.');
    process.exit(2);
}

const repoRoot = path.resolve(__dirname, '..');
const bundlerPath = path.join(repoRoot, 'ddcs-studio-modular', 'tools', 'bundle_standalone.py');
if (!fs.existsSync(bundlerPath)) {
    console.error('Bundler script not found at', bundlerPath);
    process.exit(3);
}

const srcDir = 'ddcs-studio-modular';
const outPath = 'output/ddcs-studio-standalone.html';

console.log(`Running bundler: ${pythonCmd} ${bundlerPath} --src ${srcDir} --out ${outPath}`);
const r = spawnSync(pythonCmd, [bundlerPath, '--src', srcDir, '--out', outPath], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
