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
    errors = []

    def on_console(msg):
        console_msgs.append({'type': msg.type, 'text': msg.text})
    page.on('console', on_console)

    def on_error(err):
        errors.append(str(err))
    page.on('pageerror', on_error)

    page.goto(url, wait_until='load')
    # wait a moment for on-load logs
    page.wait_for_timeout(500)

    # capture relevant console lines
    for c in console_msgs[:30]:
        print(c)
    for e in errors[:20]:
        print('PAGEERROR:', e)

    # also check that body has data-scale attribute
    scale = page.evaluate("document.body.getAttribute('data-scale')")
    print('body data-scale:', scale)

    # click scale button once and capture value
    try:
        page.click('#scaleBtn')
        page.wait_for_timeout(200)
        print('after click data-scale:', page.evaluate("document.body.getAttribute('data-scale')"))
    except Exception as e:
        print('click error:', str(e))

    browser.close()

    if any('GET http' in c['text'] and 'scaleManager.js' in c['text'] for c in console_msgs):
        sys.exit(1)
    if any('Uncaught TypeError' in c['text'] for c in console_msgs):
        sys.exit(1)
    sys.exit(0)
