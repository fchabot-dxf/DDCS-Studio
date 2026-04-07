from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

html_path = Path(__file__).resolve().parents[0] / '..' / 'ddcs-studio-standalone.html'
html_path = html_path.resolve()
if not html_path.exists():
    print('ERROR: standalone HTML not found at', html_path)
    sys.exit(2)

url = 'file://' + str(html_path)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(url, wait_until='load')

    pos = page.evaluate("getComputedStyle(document.getElementById('controller-dock')).position")
    h_before = page.evaluate("parseInt(getComputedStyle(document.getElementById('controller-dock')).height)")
    editor_h_before = page.evaluate("document.getElementById('editor').clientHeight")

    page.click('#controller-dock .header-handle')
    page.wait_for_timeout(400)

    h_after = page.evaluate("parseInt(getComputedStyle(document.getElementById('controller-dock')).height)")
    editor_h_after = page.evaluate("document.getElementById('editor').clientHeight")

    # inline style checks for transform/bottom should be empty when using CSS height animation
    dock_inline_transform = page.evaluate("document.getElementById('controller-dock').style.transform || ''")
    dock_inline_bottom = page.evaluate("document.getElementById('controller-dock').style.bottom || ''")

    print('dock.position =', pos)
    print('dock.height before =', h_before)
    print('dock.height after  =', h_after)
    print('editor.height before =', editor_h_before)
    print('editor.height after  =', editor_h_after)
    print('dock.inline.transform =', repr(dock_inline_transform))
    print('dock.inline.bottom =', repr(dock_inline_bottom))

    ok = True
    if pos == 'fixed':
        print('FAIL: controller-dock is fixed')
        ok = False
    if h_after <= h_before:
        print('FAIL: dock did not increase height on expand')
        ok = False
    if editor_h_after >= editor_h_before:
        print('FAIL: editor height did not shrink after dock expand')
        ok = False
    if dock_inline_transform != '':
        print('FAIL: controller-dock has inline style.transform set (expected none)')
        ok = False
    if dock_inline_bottom != '':
        print('FAIL: controller-dock has inline style.bottom set (expected none)')
        ok = False

    browser.close()

    if not ok:
        sys.exit(1)
    else:
        print('PASS: layout behaves as expected')
        sys.exit(0)
