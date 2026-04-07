const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'output');
const INDEX_PATH = path.join(ROOT, 'index.html');
const OUT_PATH = path.join(OUT_DIR, 'sketch-studio-standalone.html');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Regex helpers
const RE_IMPORT = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"];?/g;
const RE_EXPORT_NAMED = /export\s+(class|function|const|let|var)\s+(\w+)/g;
const RE_EXPORT_LIST = /export\s*\{([^}]+)\};?/g;
const RE_EXPORT_DEFAULT = /export\s+default\s+(\w+)/g;
const RE_EXPORT_STAR = /export\s+\*\s+from\s+['"]([^'"]+)['"];?/g;

function readFile(p) {
    return fs.readFileSync(p, 'utf8');
}

// Recursively find all JS files in src
function findJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const stat = fs.statSync(path.join(dir, file));
        if (stat.isDirectory()) {
            findJsFiles(path.join(dir, file), fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(path.join(dir, file));
        }
    }
    return fileList;
}

// Parse imports to build dependency graph
function getDependencies(filePath, content) {
    const deps = [];
    let match;
    // Reset regex state
    RE_IMPORT.lastIndex = 0;
    RE_EXPORT_STAR.lastIndex = 0;

    while ((match = RE_IMPORT.exec(content)) !== null) {
        if (match[1].startsWith('.')) {
            deps.push(path.resolve(path.dirname(filePath), match[1]));
        }
    }
    while ((match = RE_EXPORT_STAR.exec(content)) !== null) {
        if (match[1].startsWith('.')) {
            deps.push(path.resolve(path.dirname(filePath), match[1]));
        }
    }
    return deps;
}

// Topological sort
function sortFiles(files) {
    const visited = new Set();
    const sorted = [];
    const fileMap = new Map(files.map(f => [f, readFile(f)]));

    function visit(f) {
        if (visited.has(f)) return;
        visited.add(f);

        const content = fileMap.get(f);
        if (!content) return; // File might not exist or be outside src

        const deps = getDependencies(f, content);
        for (const dep of deps) {
            // Try exact match or .js extension
            let resolved = dep;
            if (!fs.existsSync(resolved) && fs.existsSync(resolved + '.js')) {
                resolved += '.js';
            }
            
            // Only visit if it's in our source list (avoids circular logic with external/node_modules)
            if (files.includes(resolved)) {
                visit(resolved);
            }
        }
        sorted.push(f);
    }

    for (const f of files) {
        visit(f);
    }
    return sorted;
}

function transformModule(content, filePath) {
    let code = content;
    const exports = [];

    // 1. Collect exported names
    let match;
    while ((match = RE_EXPORT_NAMED.exec(code)) !== null) {
        exports.push(match[2]);
    }
    while ((match = RE_EXPORT_LIST.exec(code)) !== null) {
        const names = match[1].split(',').map(s => s.trim().split(' as ')[0]);
        exports.push(...names);
    }
    while ((match = RE_EXPORT_DEFAULT.exec(code)) !== null) {
        exports.push(match[1]);
    }

    // 2. Strip import/export statements
    code = code.replace(RE_IMPORT, ''); // Remove imports
    code = code.replace(RE_EXPORT_STAR, ''); // Remove re-exports
    code = code.replace(RE_EXPORT_NAMED, '$1 $2'); // "export const x" -> "const x"
    code = code.replace(RE_EXPORT_LIST, ''); // Remove "export { ... }"
    code = code.replace(RE_EXPORT_DEFAULT, '$1'); // "export default x" -> "x"

    // 3. Wrap in block to avoid variable collisions (const/let), expose exports to window
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const exportAssignments = exports.map(name => `window.${name} = ${name};`).join('\n');
    
    return `
    /* --- MODULE: ${relPath} --- */
    {
        ${code}
        ${exportAssignments}
    }
    `;
}

async function build() {
    console.log('Building standalone HTML...');
    
    if (!fs.existsSync(INDEX_PATH)) {
        console.error('Error: index.html not found at', INDEX_PATH);
        process.exit(1);
    }

    let html = readFile(INDEX_PATH);

    // 1. Inline CSS
    html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)">/g, (match, href) => {
        const cssPath = path.resolve(ROOT, href);
        if (fs.existsSync(cssPath)) {
            console.log(`Inlining CSS: ${href}`);
            return `<style>\n/* ${href} */\n${readFile(cssPath)}\n</style>`;
        }
        return match;
    });

    // 2. Bundle JS
    // Find entry point from index.html (e.g., src/main.js)
    const scriptMatch = html.match(/<script\s+type="module"\s+src="([^"]+)">/);
    if (scriptMatch) {
        const entryRel = scriptMatch[1];
        const entryPath = path.resolve(ROOT, entryRel);
        console.log(`Entry point detected: ${entryRel}`);

        const srcDir = path.join(ROOT, 'src');
        const allJsFiles = findJsFiles(srcDir);
        
        // Ensure entry is in the list
        if (!allJsFiles.includes(entryPath)) allJsFiles.push(entryPath);

        // Sort by dependency
        const sortedFiles = sortFiles(allJsFiles);
        console.log(`Bundling ${sortedFiles.length} files...`);

        let bundleJs = '';
        for (const file of sortedFiles) {
            bundleJs += transformModule(readFile(file), file);
        }

        // Replace the module script tag with the bundle
        html = html.replace(
            /<script\s+type="module"\s+src="[^"]+"><\/script>/, 
            `<script>\n${bundleJs}\n</script>`
        );
    } else {
        console.warn('No <script type="module"> found in index.html');
    }

    // 3. Inline Remote Scripts (Optional, similar to original standalone-build.js)
    // Simple regex to find remote scripts and fetch them could be added here if needed.
    // For now, we preserve them as CDN links (Tailwind, etc.) which is usually fine for "standalone" 
    // unless strictly offline.

    // 4. Write Output
    fs.writeFileSync(OUT_PATH, html);
    console.log(`\nSuccess! Standalone file created at:\n${OUT_PATH}`);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});