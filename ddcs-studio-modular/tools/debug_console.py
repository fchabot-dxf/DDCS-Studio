from playwright.sync_api import sync_playwright
from pathlib import Path
import sys

html_path = Path(__file__).resolve().parents[1] / 'output' / 'ddcs-studio-standalone.html'
if not html_path.exists():
    print('standalone not found at', html_path)
    sys.exit(2)
url = 'file://' + str(html_path)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    def on_console(msg):
        loc = msg.location
        print('CONSOLE:', msg.type, msg.text, 'Location:', loc)
    page.on('console', on_console)

    def on_page_error(err):
        print('PAGE ERROR:', repr(err))
        try:
            import traceback
            traceback.print_exc()
        except Exception:
            pass
    page.on('pageerror', on_page_error)

    page.goto(url, wait_until='load')
    # do smoke-like interactions to trigger behaviors and capture any errors
    try:
        # click the style/scale buttons
        page.click('#styleBtn')
        page.click('#scaleBtn')
    except Exception as e:
        print('Click error:', e)

    try:
        # toggle the dock
        if page.query_selector('#controller-dock .header-handle'):
            page.click('#controller-dock .header-handle')
            page.wait_for_timeout(200)
            page.click('#controller-dock .header-handle')
    except Exception as e:
        print('Dock toggle error:', e)

    try:
        # ensure varList has items and dispatch a wheel event
        if page.query_selector('#varList'):
            page.evaluate("(function(){const list=document.getElementById('varList'); for(let i=0;i<10;i++){const d=document.createElement('div'); d.className='var-item'; d.innerText='Item '+i; list.appendChild(d);} })();")
            page.evaluate("document.getElementById('varList').dispatchEvent(new WheelEvent('wheel', {deltaY:120, bubbles:true, cancelable:true}))")
    except Exception as e:
        print('VarList wheel error:', e)

    try:
        # open corner wizard which calls drawCornerViz
        page.evaluate("window.openCornerWiz && window.openCornerWiz()")
        page.wait_for_timeout(100)
    except Exception as e:
        print('Wizard open error:', e)

    # give it a short while to surface any errors
    page.wait_for_timeout(1500)
    print('Done')
    browser.close()