import io, re, colorsys

SRC = 'c:/Users/danse/APPS/ddcs-studio-project/DDCS-Studio/web/ui/headerPost.js'
SH  = 'C:/Users/danse/AppData/Local/Temp/claude/c--Users-danse-APPS-ddcs-studio-project/3de917c3-a420-4169-991d-72bbb9bda076/scratchpad/'

src = io.open(SRC, encoding='utf-8').read()
blk = src[src.index('const HQ_ICONS = {'):]; blk = blk[:blk.index('\n};')]
ICONS = {}
for m in re.finditer(r"(\w+):\s*\{\s*c:\s*'([^']+)',\s*d:\s*'(.*?)'\s*\}", blk, re.S):
    ICONS[m.group(1)] = {'c': m.group(2), 'd': m.group(3)}


# The inner details ship as OPEN polylines, so there is nothing to fill. Closing the two
# that already trace rectangles gives a genuine SECOND fill — a third colour — without
# redrawing the icon: same corners, same size, just closed.
ICONS['save']['d'] = ('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>'
                      '<path d="M17 21v-8H7v8z"/>'
                      '<path d="M7 3v5h8V3z"/>')
CLASSIC = {}
SHIPPED = {}
ICONS['export']['d'] = ICONS['save']['d']
ICONS['export']['c'] = ICONS['save']['c']

FAM = {'open':'#c8912f','save':'#3f83ad','author':'#8168ab','verify':'#4d8f57','help':'#b2566a','info':'#4b7ea8'}
GOLD, CYAN, ROSE, GREEN = '#c8912f', '#3f83ad', '#b2566a', '#4d8f57'

# key, label, family, body(fill), detail, DETAIL COLOUR chosen per icon
PLAN = [
    ('save',       'Save',              'save',   [0], [1, 2],             GOLD),
    ('export',     'Save as\u2026',     'save',   [0], [1, 2],             GOLD),
    ('open',       'Open',              'open',   [0], [],                 None),
    ('wizard',     'Wizards\u2026',     'author', [0], [2,3,4,5,6,7],      GOLD),
    ('settings',   'Settings\u2026',    'author', [1], [0],                CYAN),
    ('setupSheet', 'Setup sheet\u2026', 'author', [0], [2, 3],             CYAN),
    ('checklist',  'Setup checklist',   'verify', [1], [0],                GOLD),
    ('standalone', 'Get for desktop',   'verify', [0], [2, 3],             CYAN),
    ('website',    'Open the website',  'info',   [0], [1, 2],             GOLD),
    ('local',      'Local',             'save',   [0], [1],                GOLD),
    ('cloud',      'Cloud',             'info',   [0], [],                 None),
    ('clear',      'Clear',             'help',   [1], [2, 3],             GOLD),
]
ELEM = re.compile(r'<(path|polyline|line|circle|rect)\b[^>]*/>')



def mix(fg, bg, pct):
    """A SOLID colour, not opacity: pct% of fg over bg, resolved to one hex."""
    f = [int(fg[i:i+2], 16) for i in (1, 3, 5)]
    b = [int(bg[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(int(round(f[i]*pct + b[i]*(1-pct))) for i in range(3))

DK_PANEL, LT_PANEL = '#1c1f25', '#f2f4f7'

# CHOSEN fills — one declared solid per family. Not derived, not an opacity.
# fill 1 = the body.  fill 2 = any FURTHER closed shape — the third colour.
# OUTLINE dark, FILL light, FILL2 mid — one declared trio per family.
SOLID = {'#f59e0b':'#d99a2b','#0ea5e9':'#2f8fc4','#a855f7':'#8e63cf','#22c55e':'#3aa35f',
         '#3ddc84':'#3aa35f','#c084fc':'#8e63cf','#38bdf8':'#2f8fc4','#ef4444':'#c94a4a',
         '#14b8a6':'#2f9c95','#6366f1':'#5457c4','#94a3b8':'#7b8798'}
ACC1  = {'#f59e0b':'#fff4e0','#0ea5e9':'#eaf6fd','#a855f7':'#f3ecfd','#22c55e':'#e9f8ee',
         '#3ddc84':'#e9f8ee','#c084fc':'#f3ecfd','#38bdf8':'#eaf6fd','#ef4444':'#fdecec',
         '#14b8a6':'#e6f6f5','#6366f1':'#ecedfb','#94a3b8':'#f0f3f6'}
ACC2  = {'#f59e0b':'#9c6a12','#0ea5e9':'#0d4f6e','#a855f7':'#4c2f80','#22c55e':'#175f33',
         '#3ddc84':'#175f33','#c084fc':'#4c2f80','#38bdf8':'#0d4f6e','#ef4444':'#7a2020',
         '#14b8a6':'#12544f','#6366f1':'#2c2f7a','#94a3b8':'#414b57'}
OUTLINE = {'#f59e0b':'#6b4410','#0ea5e9':'#12556f','#a855f7':'#46296e','#22c55e':'#1c5233',
           '#3ddc84':'#1c5233','#c084fc':'#46296e','#38bdf8':'#12556f','#ef4444':'#6b1f1f',
           '#14b8a6':'#12524e','#6366f1':'#2a2c63','#94a3b8':'#39424e'}
FILL    = {'#f59e0b':'#f6dcae','#0ea5e9':'#aadcf3','#a855f7':'#dbc8f6','#22c55e':'#b8e8c7',
           '#3ddc84':'#b8e8c7','#c084fc':'#dbc8f6','#38bdf8':'#aadcf3','#ef4444':'#f6c2c2',
           '#14b8a6':'#b3e5e1','#6366f1':'#c8c9f2','#94a3b8':'#d7dde4'}
FILL2   = {'#f59e0b':'#aadcf3','#0ea5e9':'#f6dcae','#a855f7':'#f6dcae','#22c55e':'#f6dcae',
           '#3ddc84':'#f6dcae','#c084fc':'#aadcf3','#38bdf8':'#f6dcae','#ef4444':'#f6dcae',
           '#14b8a6':'#f6dcae','#6366f1':'#f6dcae','#94a3b8':'#aadcf3'}

ELEM = re.compile(r'<(path|polyline|line|circle|rect)\b[^>]*/>')



def mix(fg, bg, pct):
    """A SOLID colour, not opacity: pct% of fg over bg, resolved to one hex."""
    f = [int(fg[i:i+2], 16) for i in (1, 3, 5)]
    b = [int(bg[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(int(round(f[i]*pct + b[i]*(1-pct))) for i in range(3))

DK_PANEL, LT_PANEL = '#1c1f25', '#f2f4f7'

# CHOSEN fills — one declared solid per family. Not derived, not an opacity.
# fill 1 = the body.  fill 2 = any FURTHER closed shape — the third colour.
FILL2 = {'#f59e0b': '#c8912f', '#0ea5e9': '#2f7ea8', '#a855f7': '#7a5fb0',
         '#22c55e': '#3f8a55', '#3ddc84': '#3f8a55', '#c084fc': '#7a5fb0',
         '#38bdf8': '#2f7ea8', '#ef4444': '#a34848', '#14b8a6': '#2f8480',
         '#6366f1': '#5457a8', '#94a3b8': '#5c6775'}

FILLABLE = {'open','cloud'}   # human's circles: only the simple single-shape containers

def closed(el):
    """A fill only makes sense on a genuinely CLOSED shape."""
    if el.startswith('<rect') or el.startswith('<circle'):
        return True
    m = re.search(r'd="([^"]+)"', el)
    return bool(m) and m.group(1).rstrip().endswith(('z', 'Z'))

def shift(hx, dl, ds=0.0):
    r,g,b = (int(hx[i:i+2],16)/255 for i in (1,3,5))
    h,l,s = colorsys.rgb_to_hls(r,g,b)
    l = max(0.0,min(1.0,l+dl)); s = max(0.0,min(1.0,s+ds))
    r,g,b = colorsys.hls_to_rgb(h,l,s)
    return '#%02x%02x%02x' % (int(r*255),int(g*255),int(b*255))

def build(d, body, detail, outline, fill, det):
    els = [m.group(0) for m in ELEM.finditer(d)]
    under = ''.join(e[:-2]+' fill="%s" stroke="none"/>' % fill for i,e in enumerate(els) if i in body)
    over  = '<g stroke="%s" fill="none">%s</g>' % (outline, ''.join(els))
    top   = ('<g stroke="%s" fill="none" stroke-width="2.1">%s</g>'
             % (det, ''.join(els[i] for i in detail if i < len(els)))) if (detail and det) else ''
    return under + over + top

def svg(inner, size):
    return ('<svg viewBox="0 0 24 24" width="%d" height="%d" fill="none" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (size,size,inner))

def chip(cls, big, small, label):
    return '<div class="chip %s">%s<div class="row">%s<span>%s</span></div></div>' % (cls,big,small,label)

cells = []
for key,label,fam,body,detail,dcol in PLAN:
    ic = ICONS.get(key)
    if not ic: continue
    c = ic['c']                      # the SHIPPED colour, untouched
    shipped = ic['d']
    now  = '<g stroke="%s" fill="none">%s</g>' % (c, shipped)
    # A — shipped glyph, same colour, soft fill of itself
    a_els = [m.group(0) for m in ELEM.finditer(shipped)]
    def filled(els, panel):
        """A body gets fill + internal accents. Pure line-art stays exactly as it ships."""
        if key not in FILLABLE:
            return '<g stroke="%s" fill="none">%s</g>' % (c, ''.join(els))
        body_c = SOLID.get(c, c)
        a1, a2 = ACC1.get(c, '#ffffff'), ACC2.get(c, '#ffffff')
        out, inner = '', []
        first = True
        for e in els:
            if closed(e) and first:
                out += e[:-2] + ' fill="%s" stroke="none"/>' % body_c
                first = False
            else:
                inner.append(e)
        half = (len(inner) + 1) // 2
        for k, e in enumerate(inner):
            out += e[:-2] + ' stroke="%s" fill="none" stroke-width="1.9"/>' % (a1 if k < half else a2)
        return out

    a_dk, a_lt = filled(a_els, DK_PANEL), filled(a_els, LT_PANEL)
    # B — classic redraw where one exists, same treatment
    b_src = ic['d']
    b_els = [m.group(0) for m in ELEM.finditer(b_src)]

    cells.append(
        '<div class="cell"><div class="vars">'
        '<div class="var"><span class="tag">now</span>%s%s</div>'
        '<div class="var"><span class="tag on">+ soft fill</span>%s%s</div>'
        '</div><div class="meta"><b>%s</b><span class="fam">%s</span></div></div>' % (
            chip('dk', svg(now,38), svg(now,16), label), chip('lt', svg(now,38), svg(now,16), label),
            chip('dk', svg(a_dk,38), svg(a_dk,16), label), chip('lt', svg(a_lt,38), svg(a_lt,16), label),
            label, fam))

shell = io.open(SH+'icon-shell.html', encoding='utf-8').read()
io.open(SH+'icon-suite.html','w',encoding='utf-8').write(shell.replace('<!--CELLS-->','\n'.join(cells)))
print('rendered %d icons: now vs three-colour, dark + light' % len(cells))
