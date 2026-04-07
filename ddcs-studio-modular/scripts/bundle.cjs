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
const bundlerPath = path.join(repoRoot, 'tools', 'bundle_standalone.py');
if (!fs.existsSync(bundlerPath)) {
    console.error('Bundler script not found at', bundlerPath);
    process.exit(3);
}

// Determine source directory (auto-detect & allow --src override)
function hasIndex(p) { try { return fs.existsSync(path.join(p, 'index.html')); } catch (e) { return false; } }
let srcDir = null;
// CLI override: node scripts/bundle.cjs --src <path>
const cliIdx = process.argv.indexOf('--src');
if (cliIdx !== -1 && process.argv.length > cliIdx + 1) {
    srcDir = process.argv[cliIdx + 1];
}
// Env override
if (!srcDir && process.env.BUNDLE_SRC) {
    srcDir = process.env.BUNDLE_SRC;
}
// If provided, resolve and validate
if (srcDir) {
    const candidate = path.isAbsolute(srcDir) ? srcDir : path.resolve(repoRoot, srcDir);
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
        srcDir = candidate;
    } else {
        console.warn(`Specified --src '${srcDir}' does not contain index.html; continuing auto-detect.`);
        srcDir = null;
    }
}
// Auto-detect: prefer repo root, then 'src', then 'ddcs-studio-modular', then first sensible subdir
if (!srcDir) {
    if (fs.existsSync(path.join(repoRoot, 'index.html'))) {
        srcDir = repoRoot;
    } else if (fs.existsSync(path.join(repoRoot, 'src', 'index.html'))) {
        srcDir = path.join(repoRoot, 'src');
    } else if (fs.existsSync(path.join(repoRoot, 'ddcs-studio-modular', 'index.html'))) {
        srcDir = path.join(repoRoot, 'ddcs-studio-modular');
    } else {
        const exclude = new Set(['.venv','venv','node_modules','scripts','tools','verification','tests','output','.git']);
        const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
        let found = null;
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (exclude.has(e.name)) continue;
            const p = path.join(repoRoot, e.name);
            if (fs.existsSync(path.join(p, 'index.html'))) {
                if (e.name === 'ddcs-studio-modular') { found = p; break; }
                if (!found) found = p;
            }
        }
        if (found) srcDir = found;
        else {
            console.warn('Could not auto-detect a directory containing index.html; defaulting to repo root.');
            srcDir = repoRoot;
        }
    }
}

// Ensure output is placed in the repository-level output directory (not inside src)
const outPath = path.join(repoRoot, 'output', 'ddcs-studio-standalone.html');
// Ensure output directory exists
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

console.log(`Running bundler: ${pythonCmd} ${bundlerPath} --src ${srcDir} --out ${outPath}`);
const r = spawnSync(pythonCmd, [bundlerPath, '--src', srcDir, '--out', outPath], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
