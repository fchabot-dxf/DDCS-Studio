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
    page = browser.new_page(viewport={'width': 360, 'height': 800})
    page.goto(url, wait_until='load')

    header = page.query_selector('#controller-dock .header-controls')
    if not header:
        print('FAIL: header-controls not found')
        sys.exit(1)

    metrics = page.evaluate("(function(){const el=document.querySelector('#controller-dock .header-controls'); if(!el) return {}; return {clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, offsetWidth: el.offsetWidth};})()")
    print('header metrics:', metrics)

    if metrics.get('scrollWidth',0) > metrics.get('clientWidth',0):
        print('PASS: header overflows horizontally at narrow width -> horizontal scroll enabled')
        browser.close()
        sys.exit(0)
    else:
        print('FAIL: header did not overflow at narrow width (scrollWidth <= clientWidth)')
        browser.close()
        sys.exit(1)
