from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

html_path = Path(__file__).resolve().parents[1] / 'output' / 'ddcs-studio-standalone.html'
if not html_path.exists():
    print('ERROR: output HTML not found at', html_path)
    sys.exit(2)

url = 'file://' + str(html_path)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(url, wait_until='load')
    page.wait_for_timeout(400)

    def q(expr):
        return page.evaluate(expr)

    elems = {
        'header_exists': q("!!document.querySelector('.app-header')"),
        'toolbar_exists': q("!!document.querySelector('.secondary-toolbar')"),
        'main_exists': q("!!document.querySelector('.main')"),
        'editor_exists': q("!!document.querySelector('#editor')"),
        'editor_visible': q("(function(){const e=document.getElementById('editor'); if(!e) return false; const cs=getComputedStyle(e); return cs.display!=='none' && cs.visibility!=='hidden' && e.clientHeight>0 && e.clientWidth>0; })()"),
        'wizard_display': q("(function(){const w=document.getElementById('wizard'); if(!w) return 'missing'; return getComputedStyle(w).display; })()"),
        'app_attached': q("typeof window.ddcsStudio !== 'undefined'"),
        'body_scale': q("document.body.getAttribute('data-scale')"),
        'secondary_toolbar_height': q("(function(){const el=document.querySelector('.secondary-toolbar .secondary-toolbar-row'); return el ? parseInt(getComputedStyle(el).height) : null; })()"),
        'editor_client_height': q("document.getElementById('editor') ? document.getElementById('editor').clientHeight : null"),
        'app_shell_transform': q("getComputedStyle(document.querySelector('.app-shell')).transform"),
        'overlay_active': q("document.querySelector('.overlay') ? document.querySelector('.overlay').classList.contains('active') : false"),
    }

    ss_path = Path(__file__).resolve().parents[1] / 'debug_ui.png'
    page.screenshot(path=str(ss_path), full_page=True)
    print('screenshot:', ss_path)
    for k,v in elems.items():
        print(k+':', v)

    browser.close()

    # exit non-zero if editor not visible or app not attached
    if not elems['app_attached'] or not elems['editor_visible']:
        sys.exit(1)
    sys.exit(0)
