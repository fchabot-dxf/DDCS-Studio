/**
 * ui/bundleStandalone.js — client-side port of tools/bundle_standalone.py.
 *
 * Builds the single-file offline Studio FROM THE RUNNING APP (no server, works on the deployed web where
 * `web/` is served raw and `output/` is unreachable). It re-implements the Python bundler's textual transforms:
 *   - fetch index.html
 *   - crawl the JS module graph from the real entry points (app.js + index.html's dynamic import()s),
 *     following BOTH static `import … from '…'` and dynamic `import('…')` specifiers so lazily-loaded
 *     modules (gatewayPanel, default_vars_*, etc.) are included — the Python globs every .js to the same end.
 *   - topo-sort by STATIC import deps (dynamic imports are lazy, not load-order deps), strip import/export,
 *     concatenate into one inline <script>, re-export named/default symbols onto window.
 *   - inline styles.css (with url() asset substitution), assets as data URLs (window.__ASSETS / __ASSETS_BIN),
 *     three.min.js inline, patch sound.js + the default_vars.js dynamic import, escape </script>.
 *   - download the assembled HTML as a Blob.
 *
 * Kept deliberately close to bundle_standalone.py so the result actually runs offline.
 */

// Entry points = the modules index.html loads at startup (static `import app.js` + the inline dynamic imports).
const ENTRY_MODULES = [
    'app.js',
    'blocks/programModel.js',
    'ui/bridgeTransfer.js',
    'ui/gatewayStatus.js',
    'ui/updateCheck.js',
    'ui/headerPost.js',
    'ui/postGating.js',
    'ui/macroBar.js',
    'ui/editorOpHover.js',
    'ui/editorAutocomplete.js',
    'ui/probeInputSelect.js',
];

const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    ico: 'image/x-icon', webp: 'image/webp', wav: 'audio/wav', mp3: 'audio/mpeg',
    ogg: 'audio/ogg', ttf: 'font/truetype', woff: 'font/woff', woff2: 'font/woff2',
};

// Assets the Python recursively inlines from web/assets. Listed explicitly because a browser can't glob the FS.
const ASSET_FILES = [
    'svg/favicon.svg', 'svg/alignViz.svg', 'svg/cornerViz.svg', 'svg/edgeViz.svg',
    'svg/middleViz.svg', 'svg/tileset.svg', 'svg/tileset diff.svg',
    'png/ddcsscreenblur.png', 'png/ddcsscreensharp.png',
    'audio/421337__jaszunio15__click_100.wav',
    'font/Pixelated Arial Regular 11 Regular.ttf',
];

// Resolve a relative import specifier ('./x.js', '../y/z.js') against a module path (rel to web/) → rel path.
function resolveRel(fromRel, spec) {
    const baseParts = fromRel.split('/').slice(0, -1);   // drop the filename
    const specParts = spec.split('/');
    for (const part of specParts) {
        if (part === '.' || part === '') continue;
        if (part === '..') baseParts.pop();
        else baseParts.push(part);
    }
    let out = baseParts.join('/');
    if (!/\.js$/.test(out)) out += '.js';
    return out;
}

// Pull every local import specifier (static `import … from '…'` AND dynamic `import('…')`) from a module body.
const STATIC_IMPORT_RE = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const STATIC_ONLY_RE = /from\s+['"]([^'"]+)['"]/g;  // for topo deps (load order) — static imports only

function specifiers(text, re) {
    const out = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
}

// ---------------------------------------------------------------------------------------------------------
// Module transform. Unlike bundle_standalone.py — which concatenates every module into ONE shared <script>
// scope (where top-level `const`s like `AX`/`el` collide → "Identifier already declared", so that bundle does
// not actually boot) — we wrap each module in its OWN function scope and rewire ESM via a runtime registry:
//   window.__DDCS_MODS['rel/path.js'] = { exportName: value, default: value }
// A module reads its imported bindings from its sources' registry entries and writes its own exports back.
// Load order is the topo sort, so a module's static deps are populated before it runs. This is the change
// that makes the offline file genuinely RUN.
// ---------------------------------------------------------------------------------------------------------

const REG = 'window.__DDCS_MODS';

// Parse a single `import …` statement → { source, bindings:[{local, imported|'*'|'default'}], sideEffect }.
function parseImport(stmt) {
    const fromM = stmt.match(/from\s+['"]([^'"]+)['"]/);
    if (!fromM) {
        // side-effect import:  import './x.js';
        const se = stmt.match(/import\s+['"]([^'"]+)['"]/);
        return se ? { source: se[1], bindings: [], sideEffect: true } : null;
    }
    const source = fromM[1];
    const clause = stmt.slice(stmt.indexOf('import') + 6, stmt.lastIndexOf('from')).trim();
    const bindings = [];
    // default import (leading bareword before any { or *)
    const defM = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defM) bindings.push({ local: defM[1], imported: 'default' });
    // namespace import  * as ns
    const nsM = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (nsM) bindings.push({ local: nsM[1], imported: '*' });
    // named imports  { a, b as c }
    const braceM = clause.match(/\{([^}]*)\}/);
    if (braceM) {
        braceM[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((tok) => {
            const asM = tok.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
            if (asM) bindings.push({ local: asM[2], imported: asM[1] });
            else bindings.push({ local: tok, imported: tok });
        });
    }
    return { source, bindings, sideEffect: false };
}

// Pull whole `import …;` statements (handles multi-line braces) and return [{raw, parsed}].
function extractImports(txt) {
    const out = [];
    const re = /^\s*import\b[\s\S]*?(?:from\s+['"][^'"]+['"]|['"][^'"]+['"])\s*;?/gm;
    let m;
    while ((m = re.exec(txt)) !== null) {
        const parsed = parseImport(m[0]);
        if (parsed) out.push({ raw: m[0], parsed });
    }
    return out;
}

// `export [async] function|class|const|let|var NAME` — ANCHORED to line start so the word `export` inside a
// comment/string (e.g. "// …in the export") is never treated as a keyword (that bug eats the next statement).
const EXPORT_NAMED_RE = /^[ \t]*export[ \t]+(?:async[ \t]+)?(class|function|const|let|var)[ \t]+(\w+)/gm;
const EXPORT_DEFAULT_NAME_RE = /^[ \t]*export[ \t]+default[ \t]+([A-Za-z_$][\w$]*)[ \t]*;/m;

// Find the end of an expression starting at `from` — the first `;` at depth 0 (braces/brackets/parens
// balanced, strings/template-literals skipped). Used for `export default <expr>;` over multiple lines.
function exprEnd(s, from) {
    let depth = 0, i = from, q = null;
    while (i < s.length) {
        const c = s[i];
        if (q) {
            if (c === '\\') { i += 2; continue; }
            if (c === q) q = null;
        } else if (c === '"' || c === "'" || c === '`') { q = c; }
        else if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (c === ';' && depth === 0) return i + 1;
        i++;
    }
    return s.length;
}

// Transform one module into a self-contained IIFE that wires imports/exports through the registry.
// `rel` is this module's path; `resolveSpec` maps a local specifier to a registry key (or null if external).
function transformModule(rel, jsText, resolveSpec) {
    let txt = jsText.replace(/^\s*#!.*\n/gm, '');

    // collect + strip import statements; build the rebind prologue
    const imports = extractImports(txt);
    for (const { raw } of imports) txt = txt.replace(raw, '');
    const prologue = [];
    for (const { parsed } of imports) {
        if (parsed.sideEffect) continue;                  // side-effect: the dep already ran (topo order)
        const key = resolveSpec(parsed.source);
        if (!key) continue;                                // external/bare import (e.g. a CDN lib) — leave alone
        const ns = `${REG}[${JSON.stringify(key)}]`;
        for (const b of parsed.bindings) {
            if (b.imported === '*') prologue.push(`const ${b.local} = ${ns} || {};`);
            else prologue.push(`const ${b.local} = (${ns} || {})[${JSON.stringify(b.imported)}];`);
        }
    }

    // Re-exports first (they carry a `from`): copy the source module's namespace into ours at the epilogue.
    const reexportStar = [];   // resolved source keys to spread
    const reexportNamed = [];  // { src, names: [...] }
    txt = txt.replace(/^[ \t]*export[ \t]*\{([^}]+)\}[ \t]*from[ \t]+['"]([^'"]+)['"][ \t]*;?/gm, (full, list, src) => {
        const key = resolveSpec(src);
        if (key) reexportNamed.push({ key, names: list.split(',').map((s) => s.trim()).filter(Boolean).map((t) => t.split(/\s+as\s+/).pop().trim()) });
        return '';
    });
    txt = txt.replace(/^[ \t]*export[ \t]+\*[ \t]+from[ \t]+['"]([^'"]+)['"][ \t]*;?/gm, (full, src) => {
        const key = resolveSpec(src);
        if (key) reexportStar.push(key);
        return '';
    });

    // collect named exports (incl. `export async function`), then strip the leading `export` keyword
    const named = [];
    let m;
    EXPORT_NAMED_RE.lastIndex = 0;
    while ((m = EXPORT_NAMED_RE.exec(txt)) !== null) named.push(m[2]);
    txt = txt.replace(/^([ \t]*)export[ \t]+(async[ \t]+function|class|function|const|let|var)/gm, '$1$2');

    // `export { a, b };` lists (no `from`) — capture the names (so importers resolve them), then drop the line
    txt = txt.replace(/^[ \t]*export[ \t]*\{([^}]+)\}[ \t]*;?/gm, (full, list) => {
        list.split(',').map((s) => s.trim()).filter(Boolean).forEach((tok) => {
            const nm = tok.split(/\s+as\s+/).pop().trim();   // exported name
            if (nm) named.push(nm);
        });
        return '';
    });

    // default export: a bare name, or a (possibly multi-line) expression — match braces balanced.
    let defaultName = null;
    const dn = txt.match(EXPORT_DEFAULT_NAME_RE);
    if (dn) { defaultName = dn[1]; txt = txt.replace(EXPORT_DEFAULT_NAME_RE, defaultName + ';'); }
    else {
        const dexp = /^[ \t]*export[ \t]+default[ \t]+/m.exec(txt);
        if (dexp) {
            const di = dexp.index + dexp[0].indexOf('export');   // start of the `export` keyword on its line
            const after = dexp.index + dexp[0].length;
            const end = exprEnd(txt, after);   // index just past the expression's terminating ;
            const expr = txt.slice(after, end).replace(/;\s*$/, '').trim();
            defaultName = '__default_export';
            txt = txt.slice(0, di) + `const ${defaultName} = ${expr};` + txt.slice(end);
        }
    }

    // export epilogue: register on the module's own namespace, and (last-wins) on window for inline scripts
    const selfNs = `${REG}[${JSON.stringify(rel)}]`;
    const epilogue = [`${selfNs} = ${selfNs} || {};`];
    for (const n of named) { epilogue.push(`${selfNs}[${JSON.stringify(n)}] = ${n};`); epilogue.push(`window[${JSON.stringify(n)}] = ${n};`); }
    if (defaultName) { epilogue.push(`${selfNs}["default"] = ${defaultName};`); epilogue.push(`window[${JSON.stringify(defaultName)}] = ${defaultName};`); }
    // re-exports: spread the source module's namespace (default is not re-exported by `*`)
    for (const { key, names } of reexportNamed) for (const n of names) epilogue.push(`${selfNs}[${JSON.stringify(n)}] = (${REG}[${JSON.stringify(key)}] || {})[${JSON.stringify(n)}];`);
    for (const key of reexportStar) epilogue.push(`Object.keys(${REG}[${JSON.stringify(key)}] || {}).forEach(function(k){ if (k !== "default") ${selfNs}[k] = ${REG}[${JSON.stringify(key)}][k]; });`);

    const body = `// --- ${rel} ---\n(function(){\n${prologue.join('\n')}\n${txt}\n${epilogue.join('\n')}\n})();`;
    return body;
}

// Crawl the module graph from the entries; returns { modules: Map<rel, text>, deps: Map<rel, Set<rel>> }.
async function crawlModules(fetchText) {
    const modules = new Map();   // rel → source text
    const deps = new Map();      // rel → Set of static-import rel deps (for topo sort)
    const queue = [...ENTRY_MODULES];

    while (queue.length) {
        const rel = queue.shift();
        if (modules.has(rel)) continue;
        let text;
        try {
            text = await fetchText(rel);
        } catch (_) {
            continue;   // a stale/dynamic specifier that doesn't resolve — skip (matches "best effort" glob)
        }
        modules.set(rel, text);

        // Follow BOTH import forms so lazily-loaded modules are bundled too.
        const local = (spec) => spec.startsWith('.');
        const statics = specifiers(text, STATIC_IMPORT_RE).filter(local).map((s) => resolveRel(rel, s));
        const dynamics = specifiers(text, DYNAMIC_IMPORT_RE).filter(local).map((s) => resolveRel(rel, s));
        deps.set(rel, new Set(statics));
        for (const d of [...statics, ...dynamics]) if (!modules.has(d)) queue.push(d);
    }
    return { modules, deps };
}

// DFS topo sort on static deps (same algorithm as the Python).
function topoSort(modules, deps) {
    const visited = new Map();
    const out = [];
    const dfs = (n) => {
        if (visited.get(n)) return;
        visited.set(n, 1);
        for (const d of deps.get(n) || []) if (modules.has(d)) dfs(d);
        visited.set(n, 2);
        out.push(n);
    };
    for (const n of deps.keys()) dfs(n);
    return out;
}

function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

/**
 * Build the standalone HTML string from the running app. `base` lets callers/tests point at a different root
 * (defaults to the document's directory so it works on the hosted site and on file://).
 */
export async function buildStandaloneHtml(base) {
    const root = base != null ? base : new URL('.', document.baseURI).href;
    const fetchText = async (rel) => {
        const res = await fetch(new URL(rel, root).href);
        if (!res.ok) throw new Error(`fetch ${rel}: ${res.status}`);
        return res.text();
    };

    let html = await fetchText('index.html');

    // --- assets: SVG text + binary data URIs, dual-keyed ('subdir/name.ext' and bare 'name.ext') ---
    const assetsMap = {};
    for (const rel of ASSET_FILES) {
        const ext = rel.split('.').pop().toLowerCase();
        const bare = rel.split('/').pop();
        try {
            if (ext === 'svg') {
                const txt = await fetchText('assets/' + rel);
                assetsMap[rel] = txt; assetsMap[bare] = txt;
            } else if (MIME[ext]) {
                const res = await fetch(new URL('assets/' + rel, root).href);
                if (!res.ok) continue;
                const uri = await blobToDataUri(await res.blob());
                assetsMap[rel] = uri; assetsMap[bare] = uri;
            }
        } catch (_) { /* skip an unreadable asset */ }
    }
    const resolveAsset = (p) => {
        const name = p.replace(/^[./]*assets\//, '');
        return assetsMap[name] || assetsMap[name.split('/').pop()];
    };

    // --- inline styles.css with url() substitution ---
    try {
        let css = await fetchText('styles.css');
        css = css.replace(
            /url\((['"]?)([^)'"]+\.(?:png|jpg|jpeg|gif|ico|webp|ttf|woff2?|svg))\1\)/g,
            (full, q, p) => { const d = resolveAsset(p); return d ? `url(${q}${d}${q})` : full; }
        );
        html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>/* inlined styles.css */\n${css}\n</style>`);
    } catch (_) { /* no styles.css */ }

    // --- favicon href ---
    html = html.replace(/href="([^"]*assets\/[^"]+\.svg)"/g, (full, p) => {
        const d = resolveAsset(p);
        if (!d) return full;
        if (d.startsWith('data:')) return full.replace(p, d);
        return full.replace(p, 'data:image/svg+xml,' + encodeURIComponent(d));
    });

    // --- inline three.min.js (loaded via a plain <script src> tag, not the module graph) ---
    try {
        let three = await fetchText('assets/vendor/three.min.js');
        if (three.includes('</script>')) three = three.replace(/<\/script>/g, '<\\/script>');
        html = html.replace(
            /<script[^>]*src=["'][^"']*assets\/vendor\/three\.min\.js["'][^>]*><\/script>/,
            `<script>/* inlined three.min.js */\n${three}\n</script>`
        );
    } catch (_) { /* leave the external ref if three isn't reachable */ }

    // --- window.__ASSETS (svg) + window.__ASSETS_BIN (data URIs) for JS fetch fallbacks ---
    const svgAssets = {}, binAssets = {};
    for (const [k, v] of Object.entries(assetsMap)) (v.startsWith('data:') ? binAssets : svgAssets)[k] = v;
    let assetsJs = 'window.__ASSETS = ' + JSON.stringify(svgAssets) + ';\n'
        + 'window.__ASSETS_BIN = ' + JSON.stringify(binAssets) + ';\n';
    if (assetsJs.includes('</script>')) assetsJs = assetsJs.replace(/<\/script>/g, '<\\/script>');
    html = html.replace('</head>', `<script>${assetsJs}</script>\n</head>`);

    // --- bundle JS modules ---
    const { modules, deps } = await crawlModules(fetchText);
    const ordered = topoSort(modules, deps);
    const has = (rel) => modules.has(rel);

    // Rewrite local dynamic `import('./x.js')` → the bundled module's registry namespace (Promise-wrapped),
    // so lazy features work on file:// (real import() can't fetch a sibling .js there). Bare/external imports
    // and unbundled targets are left untouched.
    const rewriteDynImports = (text, ownRel) => text.replace(
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        (full, spec) => {
            if (!spec.startsWith('.')) return full;
            const key = resolveRel(ownRel, spec);
            return has(key) ? `Promise.resolve(${REG}[${JSON.stringify(key)}])` : full;
        }
    );

    const resolveSpec = (ownRel) => (spec) => {
        if (!spec.startsWith('.')) return null;
        const key = resolveRel(ownRel, spec);
        return has(key) ? key : null;
    };

    const parts = [];
    for (const rel of ordered) {
        let body = transformModule(rel, modules.get(rel), resolveSpec(rel));
        body = rewriteDynImports(body, rel);
        parts.push(body);
    }
    let inner = `${REG} = ${REG} || {};\n` + parts.join('\n\n')
        + '\n// initialize app (if it attaches to window)\n'
        + 'if (typeof window.ddcsStudio === "undefined" && typeof window.DDCSStudio !== "undefined") { window.ddcsStudio = new window.DDCSStudio(); }';

    // sound.js: hardcoded audio URL → __ASSETS_BIN fallback
    inner = inner.replace(
        "const audioUrl = 'assets/audio/421337__jaszunio15__click_100.wav';",
        "const audioUrl = (window.__ASSETS_BIN && (window.__ASSETS_BIN['audio/421337__jaszunio15__click_100.wav'] || window.__ASSETS_BIN['421337__jaszunio15__click_100.wav'])) || 'assets/audio/421337__jaszunio15__click_100.wav';"
    );

    if (inner.includes('</script>')) inner = inner.replace(/<\/script>/g, '<\\/script>');
    const bundleScript = `<script>\n${inner}\n</script>`;

    // The index.html module <script> statically imports app.js then dynamic-imports the rest — all already in
    // the bundle. Replace the whole block with a tiny shim: the bundle ran on its own, just call the inits.
    const inlineShim = '<script>\n'
        + '(function(){ var M = window.__DDCS_MODS || {};\n'
        + '  function call(rel, fn){ try { var m = M[rel]; if (m && typeof m[fn] === "function") m[fn](); } catch (e) { console.error(rel + "." + fn + " failed", e); } }\n'
        + '  call("blocks/programModel.js", "initProgramModel");\n'
        + '  call("ui/bridgeTransfer.js", "initBridgeTransfer");\n'
        + '  call("ui/gatewayStatus.js", "initGatewayStatus");\n'
        + '  call("ui/updateCheck.js", "initUpdateCheck");\n'
        + '  call("ui/headerPost.js", "initHeaderPost");\n'
        + '  call("ui/postGating.js", "initPostGating");\n'
        + '  call("ui/macroBar.js", "initMacroBar");\n'
        + '  call("ui/editorOpHover.js", "initEditorOpHover");\n'
        + '  call("ui/editorAutocomplete.js", "initEditorAutocomplete");\n'
        + '  call("ui/probeInputSelect.js", "initProbeInputSelects");\n'
        + '})();\n</script>';
    html = html.replace(/<script[^>]*type=['"]module['"][^>]*>[\s\S]*?<\/script>/i, () => bundleScript + '\n' + inlineShim);

    // build timestamp (diagnostics / freshness)
    html = html.replace('<head>', `<head><!-- BUNDLE_BUILT: ${new Date().toISOString()} -->`);

    return html;
}

// Trigger the download from the running app.
export async function downloadStandalone() {
    const html = await buildStandaloneHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddcs-studio-standalone.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
