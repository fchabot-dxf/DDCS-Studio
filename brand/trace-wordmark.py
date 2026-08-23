#!/usr/bin/env python3
"""trace-wordmark.py — a DUMB INTERPRETER of wordmarks.json. Holds no font/size/colour/shear constants of its
own; every number it uses comes from that file. Regenerates one or all of the DDCS Studio header wordmarks
(MARK-<NAME>-TRACED.svg, pasted as a <symbol> into DDCS-Studio/web/index.html) from the fonts they request,
outlined to flat SVG paths so the mark survives on a device that doesn't have those fonts (this is the whole
reason to trace at all — see wordmarks.json's own traps list, and brand/README.md).

The transform kernel below is preserved EXACTLY from brand/recovered/ (the only surviving fragment of the
original pipeline) — do not "simplify" the shear/scale/translate order, it encodes the one non-obvious trap
(the y-flip runs before the shear, so the shear sign must be negative) that shipped wrong once already.

Usage:
    pip install fonttools brotli requests      # all pure-python / no native build tooling needed
    python trace-wordmark.py normal            # regenerate one mark -> MARK-NORMAL-TRACED.svg (this dir)
    python trace-wordmark.py --all             # regenerate every mark declared in wordmarks.json
    python trace-wordmark.py organic --check   # ALSO render each glyph's own bbox to stderr — a coarse, ROUGH
                                                # heuristic (every-other numeric token in the path string, not a
                                                # real bbox parse) that caught Sniglet's broken 'D' (t2161: its
                                                # counter traced as a suspiciously tiny fragment) but produced
                                                # noisy, unusable numbers for Fredoka's own curve-heavy paths
                                                # (t2165). Useful as a cheap first pass, NEVER a substitute for
                                                # the real check below.

VALIDATED as of t2161 for the SYSTEM-FONT path (normal/studio/futuristic/steampunk): fontTools WAS available
in that session, so all four were actually regenerated and diffed byte-for-byte against the human-approved
MARK-*-TRACED.svg files already in this directory — identical, on the first clean run. That run caught two
real bugs this docstring would otherwise have shipped silently: `penx` was pre-scaled (collapsed letter-spacing
to near zero — visible immediately as glyphs overlapping) and a layer's `dx` was applied twice, once baked
into the glyph geometry and once again by its wrapping <g transform> (visible as the studio mark's bevel offset
being exactly double the declared value). Both are fixed in the code below; the byte-identical re-run is what
proved it, not inspection.

VALIDATED as of t2163 for the GOOGLE-FONTS path itself (network access DOES work in this environment — t2161's
"no network" note was wrong; the real cause was font_path_for()'s WOFF2-url regex requiring a literal `.woff2`
suffix, which a live response for Sniglet doesn't carry — it comes back as a `/l/font?kit=...` endpoint with no
extension at all, `format('woff2')` in the CSS is what actually says the format. Fixed below.

SNIGLET (the human's original organic choice) IS NOT USABLE AT WEIGHT 800 — root-caused, not just re-observed.
With the fetch fixed, re-running it reproduced the EXACT SAME broken 'D' (rendered standalone and read, per
t2161's own method — still "DOCS", not "DDCS"). Reading the raw glyf table found why: the 'D' glyph's second
contour (the counter/hole) is a genuinely tiny ~79×79-unit fragment against a ~610×723-unit outer contour —
under 13% of the letter's width — in BOTH the Google Fonts API-subsetted copy AND the full un-subsetted webfont
(rules out subsetting). t2165 went one step further and fetched Sniglet ExtraBold from its CANONICAL upstream
OFL source (github.com/google/fonts, not the serving API) — byte-identical broken contours, ruling out a
Google-specific serving artifact too. Sniglet REGULAR (wght 400) does NOT have this defect (~61%-width counter)
but is too light a weight for this mark. None of this is fixable by writing different Python — fontTools
extracts exactly what a font file contains.

ORGANIC NOW SHIPS AS FREDOKA BOLD (700) instead (t2165, the advisor's call — the runner-up from the original
live-specimen comparison). Added `source: "local"` + `variableAxes` support to font_path_for() below (Fredoka
ships as a variable font; instanced once to a static file and cached, same shape as the google-fonts cache).
Fredoka's D/C/S all trace with correctly-proportioned counters/openings — verified the same way as always:
rendered standalone, outside the app, and READ. See brand/README.md for the full Sniglet→Fredoka story and
Fredoka's OFL provenance, and WORK-LOG.md t2161/t2163/t2165 for the turn-by-turn finding as reported.
"""
import argparse
import json
import math
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DECL = os.path.join(HERE, 'wordmarks.json')

WINDIR = os.environ.get('WINDIR', 'C:/Windows')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')   # t2161 trap: an OLD UA gets EOT, not WOFF2


def load_declaration():
    with open(DECL, encoding='utf-8') as f:
        return json.load(f)


def font_path_for(font_decl, text):
    """Resolve a layer's font{} to a local file path fontTools can open, fetching+caching a Google Fonts
    WOFF2 subset if source=='google'."""
    if font_decl['source'] == 'system':
        return os.path.join(WINDIR, 'Fonts', font_decl['file'])
    if font_decl['source'] == 'google':
        family = font_decl['family'].replace(' ', '+')
        weight = font_decl.get('weight', 400)
        cache = os.path.join(HERE, '.font-cache')
        os.makedirs(cache, exist_ok=True)
        dest = os.path.join(cache, '%s-%s.woff2' % (font_decl['family'].replace(' ', '_'), weight))
        if not os.path.exists(dest):
            css_url = ('https://fonts.googleapis.com/css2?family=%s:wght@%s&text=%s'
                       % (family, weight, font_decl.get('urlTextParam', text.replace(' ', '%20'))))
            req = urllib.request.Request(css_url, headers={'User-Agent': UA})   # trap: UA MUST be modern
            css = urllib.request.urlopen(req).read().decode('utf-8')
            # t2163 trap: the URL does NOT reliably end in .woff2 — a live response for Sniglet came back as
            # https://fonts.gstatic.com/l/font?kit=...&skey=...&v=v18 (a dynamic /l/font? endpoint, no
            # extension at all), format('woff2') is what actually says the format. Match any gstatic url()
            # inside the response, not one requiring a literal .woff2 suffix.
            m = re.search(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)
            if not m:
                raise RuntimeError('no font url found in CSS for %s — check the UA/text param traps. Response:\n%s' % (family, css))
            data = urllib.request.urlopen(urllib.request.Request(m.group(1), headers={'User-Agent': UA})).read()
            with open(dest, 'wb') as f:
                f.write(data)
        return dest
    if font_decl['source'] == 'local':
        # t2165 — a font VENDORED into brand/fonts/ (its own OFL.txt sits alongside it; provenance goes in
        # brand/README.md, not here). If it's a variable font, `variableAxes` names the coordinates to pin —
        # instanced ONCE into a static file and cached, same shape as the google-fonts cache above, so
        # trace_layer always opens an ordinary static TTFont regardless of source.
        path = os.path.join(HERE, font_decl['file'])
        axes = font_decl.get('variableAxes')
        if not axes:
            return path
        cache = os.path.join(HERE, '.font-cache')
        os.makedirs(cache, exist_ok=True)
        key = '-'.join('%s%g' % (k, v) for k, v in sorted(axes.items()))
        dest = os.path.join(cache, '%s-%s.ttf' % (font_decl.get('family', 'font').replace(' ', '_'), key))
        if not os.path.exists(dest):
            from fontTools.ttLib import TTFont
            from fontTools.varLib.instancer import instantiateVariableFont
            inst = instantiateVariableFont(TTFont(path), axes)
            inst.save(dest)
        return dest
    raise ValueError('unknown font source: %r' % font_decl['source'])


def lean_sanity_check(slant_deg):
    """The one assert wordmarks.json's traps list asks for: a point at cap height must move RIGHT after the
    transform, or the shear sign has been flipped back to wrong."""
    from fontTools.misc.transform import Identity
    sh = -math.tan(math.radians(slant_deg))
    t = Identity.translate(0, 23).transform((1, 0, sh, 1, 0, 0)).scale(0.026, -0.026)
    x0, _ = t.transformPoint((0, 0))
    x1, _ = t.transformPoint((0, 700))
    if slant_deg and not (x1 - x0) > 0:
        raise AssertionError('shear sign is wrong: cap-height point moved left, not right (dx=%.4f)' % (x1 - x0))


def round_path(d, prec=1):
    return re.sub(r'-?\d+\.\d+', lambda m: ('%.*f' % (prec, float(m.group(0)))).rstrip('0').rstrip('.'), d)


def trace_layer(layer, text_by_line, check=False):
    """The kernel — preserved verbatim from brand/recovered/tracer-shear-fix.txt, generalized to read every
    number from `layer` instead of a hardcoded constant."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Identity

    text = text_by_line[layer['line']]
    size = layer['size']
    baseline = layer['baseline']
    slant_deg = layer.get('slantDeg', 0.0)
    lean_sanity_check(slant_deg)
    sh = -math.tan(math.radians(slant_deg))   # trap: NEGATIVE — see wordmarks.json traps + the module docstring

    font_path = font_path_for(layer['font'], text)
    f = TTFont(font_path)
    upem = f['head'].unitsPerEm
    cmap, hmtx, gs = f.getBestCmap(), f['hmtx'], f.getGlyphSet()
    s = size / upem

    if layer['fit'] == 'targetWidth':
        target = layer.get('targetWidth')  # falls back to the declaration's shared targetWidth below
        nat = sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) * s
        xscale = target / nat if nat else 1.0
        gap_units = 0.0
    elif layer['fit'] == 'blend':
        xscale = layer['xscale']
        target = layer.get('targetWidth')
        stretched_nat = sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) * s * xscale
        n_gaps = max(0, len([c for c in text if ord(c) in cmap]) - 1)
        gap_units = ((target - stretched_nat) / n_gaps) if (n_gaps and target is not None) else 0.0
    else:
        raise ValueError('unknown fit: %r' % layer['fit'])

    # trap: dx is NOT part of this per-point transform — it is applied exactly once, by build_symbol's own
    # wrapping <g transform="translate(dx,0)">. Baking it in here too (an earlier draft's bug, caught by
    # --check/diff against MARK-STUDIO-TRACED.svg: the bevel's light layer landed 2x its declared offset)
    # double-applies it.
    out_paths, penx = [], 0.0
    for ch in text:
        gn = cmap.get(ord(ch))
        if gn is None:
            continue
        t = (Identity.translate(0, baseline)
             .transform((1, 0, sh, 1, 0, 0))
             .scale(s * xscale, -s)
             .translate(penx, 0))
        pen = SVGPathPen(gs)
        gs[gn].draw(TransformPen(pen, t))
        d = pen.getCommands()
        if d:
            if check:
                nums = [float(n) for n in re.findall(r'-?\d+\.?\d*', d)]
                xs_ = nums[0::2]   # rough heuristic (x,y pairs interleaved) — good enough to flag a collapsed glyph
                sys.stderr.write('  glyph %r bbox-x span ~%.1f (transformed units)\n' % (ch, (max(xs_) - min(xs_)) if xs_ else 0))
            out_paths.append('<path d="%s"/>' % round_path(d))
        # trap: penx is applied via .translate(penx, 0) BEFORE .scale(s*xscale, -s) in the transform chain
        # (composition runs right-to-left on a point), so it must stay in RAW FONT UNITS, unscaled — exactly
        # as brand/recovered/tracer-shear-fix.txt's own kernel does (`penx += hmtx[gn][0]`, no `* s`). Scaling
        # it here (an earlier draft's bug, caught by --check against MARK-NORMAL-TRACED.svg: glyphs landed
        # ~100x too close together) silently collapses letter-spacing almost to nothing.
        penx += hmtx[gn][0] + (gap_units / (s * xscale) if gap_units else 0.0)
    return ''.join(out_paths)


def build_symbol(name, decl, check=False):
    mark = decl['marks'][name]
    text_by_line = decl['text']
    target_w = decl['targetWidth']
    used_defs = set()
    groups = []
    for layer in mark['layers']:
        layer = dict(layer)
        layer.setdefault('targetWidth', target_w)
        body = trace_layer(layer, text_by_line, check=check)
        attrs = 'fill="%s"' % layer['fill']
        if layer.get('filter'):
            attrs += ' filter="url(#%s)"' % layer['filter']
            used_defs.add(layer['filter'])
        if 'url(#' in layer['fill']:
            used_defs.add(re.search(r'url\(#(\w+)\)', layer['fill']).group(1))
        if layer.get('dx'):
            attrs += ' transform="translate(%s,0)"' % layer['dx']
        groups.append('<g %s>%s</g>' % (attrs, body))

    # trap: NO <defs> baked in here, deliberately — matches the shipped convention (verified against the
    # human-approved MARK-FUTURISTIC/STEAMPUNK-TRACED.svg): the #neon/#brass defs live ONCE in index.html
    # (see wordmarks.json's own `defs` block for their SVG source), referenced by url(#id) from whichever
    # marks need them. Baking a copy into every per-mark file here would give index.html two competing
    # sources for the same def the moment either one is edited.
    if used_defs:
        sys.stderr.write('%s references def(s) %s — confirm index.html still declares them before installing\n'
                          % (name, ', '.join(sorted(used_defs))))

    return ('<symbol id="mark-%s" viewBox="%s">\n  %s\n</symbol>'
            % (name, decl['viewBox'], '\n  '.join(groups)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mark', nargs='?', help='mark name, e.g. normal / studio / futuristic / steampunk / organic')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--check', action='store_true', help='print each glyph\'s transformed bbox span to stderr')
    args = ap.parse_args()

    decl = load_declaration()
    names = list(decl['marks'].keys()) if args.all else ([args.mark] if args.mark else [])
    if not names:
        ap.error('give a mark name or --all')

    for name in names:
        if name not in decl['marks']:
            raise SystemExit('no such mark declared: %r (have: %s)' % (name, ', '.join(decl['marks'])))
        status = decl['marks'][name].get('status', '')
        if 'BROKEN' in status:
            sys.stderr.write('warning: %s is marked BROKEN in wordmarks.json — regenerating anyway; '
                              'verify the output before installing it (see the module docstring --check note)\n' % name)
        svg = build_symbol(name, decl, check=args.check)
        out_path = os.path.join(HERE, 'MARK-%s-TRACED.svg' % name.upper())
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print('%s -> %s (%d bytes)' % (name, out_path, len(svg)))


if __name__ == '__main__':
    main()
