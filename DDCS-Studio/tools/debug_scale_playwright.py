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

    console_msgs = []
    def on_console(msg):
        console_msgs.append({'type': msg.type, 'text': msg.text})
    page.on('console', on_console)

    page.goto(url, wait_until='load')
    page.wait_for_timeout(200)

    # Click scale button 8 times
    for i in range(8):
        page.click('#scaleBtn')
        page.wait_for_timeout(120)

    # Print collected console messages
    for c in console_msgs:
        print(c)

    # print final state
    print('final data-scale:', page.evaluate("document.body.getAttribute('data-scale')"))
    print('final saved:', page.evaluate("localStorage.getItem('ddcs_scale_preference')"))

    browser.close()
    sys.exit(0)
