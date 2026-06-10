"""
DDCS Studio - G-code Config Generator
Playwright browser automation against ddcs-studio-standalone.html

Usage:
    pip install playwright
    playwright install chromium
    python generate_all_configs.py --html ddcs-studio-standalone.html
    python generate_all_configs.py --html ddcs-studio-standalone.html --wizard middle
    python generate_all_configs.py --html ddcs-studio-standalone.html --wizard corner --wcs G54
    python generate_all_configs.py --html ddcs-studio-standalone.html --wizard alignment

Output: <html-dir>/output/<wizard>/<config-key>.nc  (overwrites existing files)
"""

import argparse
import itertools
from pathlib import Path
from playwright.sync_api import sync_playwright

WCS_OPTIONS        = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59']
DIR_OPTIONS        = ['pos', 'neg']
AXIS_OPTIONS       = ['X', 'Y']
CORNER_OPTIONS     = ['FL', 'FR', 'BL', 'BR']
SEQ_OPTIONS        = ['YX', 'XY']
FEATURE_OPTIONS    = ['pocket', 'boss']
COMM_TYPE_OPTIONS  = ['popup', 'status', 'input', 'beep', 'dwell']
POPUP_MODE_OPTIONS = ['0', '1']
WCS_SYS_OPTIONS    = ['0', '54', '55', '56', '57', '58', '59']
BOOL_OPTIONS       = [False, True]
SLAVE_OPTIONS      = ['3', '4']

WCS_AXIS_COMBOS = [c for c in itertools.product(BOOL_OPTIONS, repeat=4) if any(c)]

OUTPUT_ROOT = Path('.')  # overridden in main()

def patch_html(html_path):
    content = html_path.read_text(encoding='utf-8')
    first = content.index('class VarListPanel')
    try:
        second = content.index('class VarListPanel', first + 1)
    except ValueError:
        return html_path
    patched = content[:second] + 'class VarListPanel2' + content[second + len('class VarListPanel'):]
    patched = patched.replace('window["VarListPanel"] = VarListPanel;', 'window["VarListPanel2"] = VarListPanel2;', 2)
    out = html_path.parent / (html_path.stem + '-patched.html')
    out.write_text(patched, encoding='utf-8')
    print(f'Patched HTML: {out.name}')
    return out

def slugify(*parts):
    return '__'.join(str(p).replace(' ', '_').replace('/', '_') for p in parts)

def write_nc(wizard, filename, content):
    out_dir = OUTPUT_ROOT / wizard
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / filename).write_text(content, encoding='utf-8')

def set_select(page, selector, value):
    page.select_option(selector, value)

def set_checkbox(page, selector, checked):
    el = page.locator(selector)
    if el.is_checked() != checked:
        el.click()

def get_code(page, code_id):
    return page.locator(f'#{code_id}').inner_text()

def wait_update(page, ms=150):
    page.wait_for_timeout(ms)

def open_wizard(page, wiz_type):
    page.evaluate(f"window.openWiz('{wiz_type}')")
    page.wait_for_selector(f'#wiz_{wiz_type}', state='visible')
    wait_update(page, 300)

def close_wizard(page):
    page.evaluate("window.closeWiz()")
    wait_update(page, 100)

def generate_middle(page, filter_wcs=None):
    wcs_list = [w for w in WCS_OPTIONS if filter_wcs is None or w == filter_wcs]
    count = 0
    open_wizard(page, 'middle')
    for feature, axis, dir1, wcs in itertools.product(FEATURE_OPTIONS, AXIS_OPTIONS, DIR_OPTIONS, wcs_list):
        set_select(page, '#m_type', feature)
        set_select(page, '#m_axis', axis)
        set_select(page, '#m_dir',  dir1)
        set_checkbox(page, '#m_both', False)
        set_select(page, '#m_wcs',  wcs)
        wait_update(page)
        write_nc('middle', slugify('middle', feature, axis, dir1, wcs, 'single') + '.nc', get_code(page, 'wiz_middle_code'))
        count += 1
        if feature == 'pocket':
            dir2 = 'neg' if dir1 == 'pos' else 'pos'
            set_checkbox(page, '#m_both', True)
            wait_update(page)
            set_select(page, '#m_dir2', dir2)
            wait_update(page)
            write_nc('middle', slugify('middle', feature, axis, dir1, dir2, wcs, 'findBoth') + '.nc', get_code(page, 'wiz_middle_code'))
            count += 1
            set_checkbox(page, '#m_both', False)
            wait_update(page, 50)
    close_wizard(page)
    print(f'[middle] {count} files written')

def generate_corner(page, filter_wcs=None):
    wcs_list = [w for w in WCS_OPTIONS if filter_wcs is None or w == filter_wcs]
    count = 0
    open_wizard(page, 'corner')
    for corner, seq, probe_z, wcs in itertools.product(CORNER_OPTIONS, SEQ_OPTIONS, BOOL_OPTIONS, wcs_list):
        set_select(page, '#c_corner',    corner)
        set_select(page, '#c_probe_seq', seq)
        set_checkbox(page, '#c_probe_z', probe_z)
        set_select(page, '#c_wcs',       wcs)
        wait_update(page)
        write_nc('corner', slugify('corner', corner, seq, 'withZ' if probe_z else 'noZ', wcs) + '.nc', get_code(page, 'wiz_corner_code'))
        count += 1
    close_wizard(page)
    print(f'[corner] {count} files written')

def generate_edge(page, filter_wcs=None):
    wcs_list = [w for w in WCS_OPTIONS if filter_wcs is None or w == filter_wcs]
    count = 0
    open_wizard(page, 'edge')
    for axis, dir_, wcs in itertools.product(AXIS_OPTIONS, DIR_OPTIONS, wcs_list):
        set_select(page, '#p_axis', axis)
        set_select(page, '#p_dir',  dir_)
        set_select(page, '#p_wcs',  wcs)
        wait_update(page)
        write_nc('edge', slugify('edge', axis, dir_, wcs) + '.nc', get_code(page, 'wiz_edge_code'))
        count += 1
    close_wizard(page)
    print(f'[edge] {count} files written')

def generate_wcs(page, filter_wcs=None):
    count = 0
    open_wizard(page, 'wcs')
    for sys, (ax, ay, az, aa) in itertools.product(WCS_SYS_OPTIONS, WCS_AXIS_COMBOS):
        axis_label = ('X' if ax else '') + ('Y' if ay else '') + ('Z' if az else '') + ('A' if aa else '')
        sys_label  = 'active' if sys == '0' else f'G{sys}'
        set_select(page, '#w_sys', sys)
        set_checkbox(page, '#w_x', ax)
        set_checkbox(page, '#w_y', ay)
        set_checkbox(page, '#w_z', az)
        set_checkbox(page, '#w_a', aa)
        set_checkbox(page, '#w_sync', False)
        wait_update(page)
        write_nc('wcs', slugify('wcs', sys_label, axis_label, 'noSync') + '.nc', get_code(page, 'wiz_wcs_code'))
        count += 1
        set_checkbox(page, '#w_sync', True)
        wait_update(page, 50)
        for slave in SLAVE_OPTIONS:
            set_select(page, '#w_slave', slave)
            wait_update(page)
            write_nc('wcs', slugify('wcs', sys_label, axis_label, f'syncSlave{slave}') + '.nc', get_code(page, 'wiz_wcs_code'))
            count += 1
        set_checkbox(page, '#w_sync', False)
    close_wizard(page)
    print(f'[wcs] {count} files written')

def generate_comm(page, filter_wcs=None):
    count = 0
    open_wizard(page, 'comm')
    for comm_type in COMM_TYPE_OPTIONS:
        set_select(page, '#c_type', comm_type)
        wait_update(page)
        if comm_type == 'popup':
            for mode in POPUP_MODE_OPTIONS:
                set_select(page, '#c_popup_mode', mode)
                wait_update(page)
                write_nc('comm', slugify('comm', comm_type, f'mode{mode}') + '.nc', get_code(page, 'wiz_comm_code'))
                count += 1
        else:
            write_nc('comm', slugify('comm', comm_type) + '.nc', get_code(page, 'wiz_comm_code'))
            count += 1
    close_wizard(page)
    print(f'[comm] {count} files written')


def generate_alignment(page, filter_wcs=None):
    """Generate files for the alignment wizard.

    Single-axis only: checkAxis (X or Y) x probeDir (pos or neg).
    Numeric fields (tolerance, safeZ, feeds, port) left at UI defaults.
    """
    count = 0
    open_wizard(page, 'alignment')
    for checkAxis, probeDir in itertools.product(AXIS_OPTIONS, DIR_OPTIONS):
        set_select(page, '#al_check_axis', checkAxis)
        set_select(page, '#al_probe_dir',  probeDir)
        wait_update(page)
        filename = slugify('alignment', checkAxis, probeDir) + '.nc'
        write_nc('alignment', filename, get_code(page, 'wiz_alignment_code'))
        count += 1
    close_wizard(page)
    print(f'[alignment] {count} files written')

WIZARDS = {
    'middle':    generate_middle,
    'corner':    generate_corner,
    'edge':      generate_edge,
    'wcs':       generate_wcs,
    'comm':      generate_comm,
    'alignment': generate_alignment,
}

def main():
    global OUTPUT_ROOT

    parser = argparse.ArgumentParser()
    parser.add_argument('--html',   required=True, help='Path to ddcs-studio-standalone.html')
    parser.add_argument('--wizard', default=None,  help='Only one wizard: middle|corner|edge|wcs|comm')
    parser.add_argument('--wcs',    default=None,  help='Filter to one WCS e.g. G54')
    parser.add_argument('--out',    default=None,  help='Output directory (default: <html-dir>/output)')
    args = parser.parse_args()

    html_path = Path(args.html).resolve()
    if not html_path.exists():
        print(f'ERROR: file not found: {html_path}')
        return

    # Output goes next to the HTML file unless --out is specified
    OUTPUT_ROOT = Path(args.out).resolve() if args.out else html_path.parent / 'output'
    print(f'Output dir: {OUTPUT_ROOT}')

    html_path = patch_html(html_path)
    url = html_path.as_uri()
    print(f'Opening: {url}')

    to_run = {args.wizard: WIZARDS[args.wizard]} if args.wizard else WIZARDS

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page    = browser.new_page()
        page.goto(url)
        page.wait_for_load_state('networkidle')
        wait_update(page, 500)

        for name, fn in to_run.items():
            print(f'\nGenerating {name}...')
            try:
                fn(page, filter_wcs=args.wcs)
            except Exception as e:
                print(f'  ERROR in {name}: {e}')

        browser.close()

    print(f'\nDone. Files written to {OUTPUT_ROOT}')

if __name__ == '__main__':
    main()
