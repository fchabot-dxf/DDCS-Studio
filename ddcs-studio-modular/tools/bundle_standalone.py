"""Bundle DDCS Studio into a single self-contained HTML file

Usage:
    python tools/bundle_standalone.py --src ./ddcs-studio-modular --out ddcs-studio-standalone.html

What it does:
 - Reads index.html
 - Inlines styles.css (with asset URL substitution)
 - Recursively inlines ALL assets:
     SVG  -> text in window.__ASSETS (keyed by 'subdir/name.svg' and bare 'name.svg')
     PNG/JPG/GIF/ICO/WEBP -> base64 data URI in window.__ASSETS_BIN
     WAV/MP3/OGG          -> base64 data URI in window.__ASSETS_BIN
     TTF/WOFF/WOFF2       -> base64 data URI in window.__ASSETS_BIN
 - Reads all JS modules and concatenates them in dependency order
 - Removes ES module "import"/"export" statements and preserves exported symbols as globals
 - Patches sound.js audio URL to use window.__ASSETS_BIN data URI
 - Writes a single HTML file ready to be attached to email and opened offline

Note: This is a simple bundler intended for small projects. It performs textual transforms, not full parsing.
"""
import argparse
import os
import re
from pathlib import Path

IMPORT_RE = re.compile(r"^\s*import\s+[^;]+;?\s*(?://[^\n]*)?\s*$", flags=re.MULTILINE)
EXPORT_NAMED_RE = re.compile(r"export\s+(class|function|const|let|var)\s+(\w+)")
EXPORT_DEFAULT_RE = re.compile(r"export\s+default\s+(\w+)")
EXPORT_DEFAULT_EXPR_RE = re.compile(r"export\s+default\s+(.+?);", flags=re.S)


def read_text(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def find_js_files(src_dir):
    p = Path(src_dir)
    # include JS files recursively, but ignore virtualenv, node_modules and CLI/tooling folders
    exclude_dirs = {'scripts', 'legacy', 'tools', 'tests', 'verification'}
    files = [f for f in p.rglob('*.js') if ('.venv' not in f.parts and 'node_modules' not in f.parts and f.name != Path(__file__).name and not any(part in exclude_dirs for part in f.parts))]
    # filter out files that are CLI utilities (start with a shebang) and any explicitly non-app modules
    safe_files = []
    for f in files:
        txt = read_text(f).lstrip()
        if txt.startswith('#!'):
            # skip CLI scripts like import_vars.js
            continue
        # also skip known non-app scripts that shouldn't be bundled
        if f.name in ('import_vars.js',):
            continue
        safe_files.append(f)
    return safe_files


def parse_imports(js_text, file_path, src_dir):
    # find import specifiers and resolve relative local imports to file paths
    matches = re.findall(r"import\s+.*from\s+['\"](.+)['\"]", js_text)
    resolved = []
    for imp in matches:
        # ignore bare imports (external libs)
        if not imp.startswith('.'):
            continue
        try:
            resolved_path = (file_path.parent / imp).resolve()
            # if it has no extension, try .js
            if not resolved_path.exists():
                if (resolved_path.with_suffix('.js')).exists():
                    resolved_path = resolved_path.with_suffix('.js')
            # only include files inside src_dir
            src_root = Path(src_dir).resolve()
            try:
                rel = resolved_path.relative_to(src_root)
            except Exception:
                continue
            resolved.append(str(rel).replace('\\','/'))
        except Exception:
            continue
    return resolved


def topo_sort(files, src_dir):
    # files: list of Path
    # use relative path from src_dir as unique key
    src_root = Path(src_dir).resolve()
    name_map = {str(f.resolve().relative_to(src_root)).replace('\\','/'): f for f in files}
    deps = {k: set() for k in name_map}
    for rel, f in name_map.items():
        txt = read_text(f)
        imps = parse_imports(txt, f, src_dir)
        for imp in imps:
            # imp is a relative path under src_dir like 'wizards/cornerWizard.js'
            if imp in name_map:
                deps[rel].add(imp)
    # simple DFS topo
    visited = {}
    out = []

    def dfs(n):
        state = visited.get(n, 0)
        if state == 1:
            return
        if state == 2:
            return
        visited[n] = 1
        for d in deps.get(n, ()):
            dfs(d)
        visited[n] = 2
        out.append(n)

    for fn in list(deps.keys()):
        dfs(fn)
    # map back to Path in order
    return [name_map[n] for n in out]


def transform_module(js_text):
    # remove import lines
    txt = IMPORT_RE.sub('', js_text)
    # strip any leading shebang lines (e.g., "#!/usr/bin/env node") which
    # would otherwise produce a syntax error when concatenated into a browser script
    txt = re.sub(r"^\s*#!.*\n", '', txt, flags=re.MULTILINE)
    # collect exported named symbols
    named = EXPORT_NAMED_RE.findall(txt)
    named_symbols = [m[1] for m in named]
    # remove 'export ' from named exports
    txt = re.sub(r"export\s+(class|function|const|let|var)", r"\1", txt)

    # remove any export-list or re-export statements like 'export { a, b }' or 'export * from "..."'
    txt = re.sub(r"export\s*\{[^}]+\}\s*;?", "", txt)
    txt = re.sub(r"export\s+\*\s+from\s+['\"][^'\"]+['\"]\s*;?", "", txt)

    # handle 'export default X;'
    default_match = EXPORT_DEFAULT_RE.search(txt)
    default_name = None
    if default_match:
        default_name = default_match.group(1)
        txt = EXPORT_DEFAULT_RE.sub(default_name, txt)
    else:
        # handle inline default expressions (export default {...}) - give it a unique name
        m = EXPORT_DEFAULT_EXPR_RE.search(txt)
        if m:
            expr = m.group(1).rstrip(';').strip()
            default_name = '__default_export'
            txt = EXPORT_DEFAULT_EXPR_RE.sub(f'const {default_name} = {expr};', txt)

    # return transformed text and lists of exported names
    exports = named_symbols[:]
    if default_name:
        exports.append(default_name)
    return txt, exports


def generate_bundle(src_dir, index_html_text):
    import json, base64, urllib.parse

    MIME = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp',
        '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
        '.ttf': 'font/truetype', '.woff': 'font/woff', '.woff2': 'font/woff2',
    }

    # Recursively inline all assets:
    #   SVG  -> text, keyed by 'subdir/name.svg' AND bare 'name.svg'
    #   PNG/WAV/TTF etc -> base64 data URI, same dual keys
    assets_dir = Path(src_dir) / 'assets'
    assets_map = {}

    if assets_dir.exists():
        for f in assets_dir.rglob('*'):
            if not f.is_file():
                continue
            ext = f.suffix.lower()
            rel = str(f.relative_to(assets_dir)).replace('\\', '/')
            if ext == '.svg':
                content = read_text(f)
                assets_map[rel] = content
                assets_map[f.name] = content
            elif ext in MIME:
                try:
                    with open(f, 'rb') as fh:
                        b64 = base64.b64encode(fh.read()).decode('ascii')
                    data_uri = f'data:{MIME[ext]};base64,{b64}'
                    assets_map[rel] = data_uri
                    assets_map[f.name] = data_uri
                except (PermissionError, OSError) as e:
                    print(f'  skipping {rel}: {e}')

    # Helper: resolve an asset path reference to its inlined value
    def resolve_asset(path):
        name = re.sub(r'^[./]*assets/', '', path)
        return assets_map.get(name) or assets_map.get(Path(name).name)

    # Inline styles.css and patch any asset URL references inside it
    css_path = Path(src_dir) / 'styles.css'
    if css_path.exists():
        css_txt = read_text(css_path)
        def replace_css_url(m):
            q, p = m.group(1) or '', m.group(2)
            data = resolve_asset(p)
            return f'url({q}{data}{q})' if data else m.group(0)
        css_txt = re.sub(
            r"url\((['\"]?)([^)'\"]+\.(?:png|jpg|jpeg|gif|ico|webp|ttf|woff2?|svg))\1\)",
            replace_css_url, css_txt
        )
        index_html_text = index_html_text.replace(
            '<link rel="stylesheet" href="styles.css">',
            f'<style>/* inlined styles.css */\n{css_txt}\n</style>'
        )

    # Patch <link rel="icon" href="...svg"> favicon
    def replace_href_asset(m):
        full, path = m.group(0), m.group(1)
        data = resolve_asset(path)
        if not data:
            return full
        if data.startswith('data:'):
            return full.replace(path, data)
        return full.replace(path, 'data:image/svg+xml,' + urllib.parse.quote(data))
    index_html_text = re.sub(r'href="([^"]*assets/[^"]+\.svg)"', replace_href_asset, index_html_text)

    # Build window.__ASSETS (SVG text) and window.__ASSETS_BIN (data URIs) for JS fetch() fallbacks
    svg_assets = {k: v for k, v in assets_map.items() if not v.startswith('data:')}
    bin_assets = {k: v for k, v in assets_map.items() if v.startswith('data:')}
    assets_js  = 'window.__ASSETS = '     + json.dumps(svg_assets) + ';\n'
    assets_js += 'window.__ASSETS_BIN = ' + json.dumps(bin_assets) + ';\n'
    if '</script>' in assets_js:
        assets_js = assets_js.replace('</script>', '<\\/script>')
    index_html_text = index_html_text.replace('</head>', f'<script>{assets_js}</script>\n</head>')

    # bundle JS modules
    js_files = find_js_files(src_dir)
    ordered = topo_sort(js_files, src_dir)
    # debug: list ordered files
    print('ordered files:')
    for f in ordered:
        print(' -', f)

    bundle_parts = []
    exported_all = []
    for f in ordered:
        txt = read_text(f)
        # debug: print first line preview to assert we are reading the expected file
        first_line = txt.splitlines()[0] if txt.splitlines() else ''
        print('  file preview:', f, first_line[:120])
        transformed, exports = transform_module(txt)
        # debug: dump transformed text for commandDeck.js to inspect any accidental edits
        if f.name == 'commandDeck.js':
            with open(Path(src_dir) / 'scripts' / 'tmp_commandDeck_transformed.js', 'w', encoding='utf-8') as _f:
                _f.write(transformed)
        bundle_parts.append(f"// --- {f.name} ---\n{transformed}\n")
        exported_all.extend(exports)

    # add assignments to window for each exported symbol
    assignments = '\n'.join([f'window["{name}"] = {name};' for name in exported_all if name])
    inner = '\n'.join(bundle_parts) + '\n' + assignments + '\n// initialize app (if it attaches to window)\nif (typeof window.ddcsStudio === "undefined" && typeof DDCSStudio !== "undefined") { window.ddcsStudio = new DDCSStudio(); }'

    # patch sound.js: replace hardcoded audio URL with __ASSETS_BIN fallback (must be before bundle_script is built)
    inner = inner.replace(
        "const audioUrl = 'assets/audio/421337__jaszunio15__click_100.wav';",
        "const audioUrl = (window.__ASSETS_BIN && (window.__ASSETS_BIN['audio/421337__jaszunio15__click_100.wav'] || window.__ASSETS_BIN['421337__jaszunio15__click_100.wav'])) || 'assets/audio/421337__jaszunio15__click_100.wav';"
    )

    # escape any closing script tags that might appear inside the generated JS
    # (e.g., from embedded strings) so the script tag isn't closed early.
    if '</script>' in inner:
        inner = inner.replace('</script>', '<\\/script>')
    bundle_script = f'<script>\n{inner}\n</script>'

    # find and replace the module import block (any <script type="module">...)
    # replace module <script> block and report how many replacements were made
    # Use a function replacer to avoid backreference escape issues
    new_html, repl_count = re.subn(r"(?is)<script[^>]*type=['\"]module['\"][^>]*>.*?</script>", lambda m: bundle_script, index_html_text)
    print('module <script> replacements:', repl_count)
    index_html_text = new_html

    # replace dynamic import of default_vars.js with an inline window-based fallback so the
    # standalone bundle does not attempt to fetch the module via import() (which fails on file://)
    index_html_text = re.sub(r"import\('\./default_vars\.js'\)\.then\(mod\s*=>\s*\{[\s\S]*?\}\)\.catch\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\);",
                             "(function(){ const _mod = (typeof window !== 'undefined' && window.DEFAULT_VAR_CSV) ? { DEFAULT_VAR_CSV: window.DEFAULT_VAR_CSV } : null; if (_mod && _mod.DEFAULT_VAR_CSV) { try { this.loadFromCSV(_mod.DEFAULT_VAR_CSV); console.debug('Loaded default variables from default_vars.js (inline)'); } catch (err) { console.warn('Failed to load default vars from module:', err); } } }).call(this);",
                             index_html_text, flags=re.M)

    # insert build timestamp comment to aid diagnostics and freshness checks
    try:
        import datetime
        now = datetime.datetime.utcnow().isoformat()
        index_html_text = index_html_text.replace('<head>', f'<head><!-- BUNDLE_BUILT: {now} -->', 1)
    except Exception:
        pass

    return index_html_text


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--src', default='.', help='source folder containing index.html')
    p.add_argument('--out', default='ddcs-studio-standalone.html', help='output filename')
    args = p.parse_args()

    src_dir = args.src
    index_path = Path(src_dir) / 'index.html'
    if not index_path.exists():
        print('index.html not found in', src_dir)
        return

    index_text = read_text(index_path)
    out_text = generate_bundle(src_dir, index_text)

    out_path = Path(src_dir) / args.out
    out_path.write_text(out_text, encoding='utf-8')
    print('Wrote', out_path)


if __name__ == '__main__':
    main()
