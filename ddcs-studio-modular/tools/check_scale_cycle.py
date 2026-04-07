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
    page.wait_for_timeout(300)

    # Read current scales array from page
    try:
        scales = page.evaluate('window.scaleManager && window.scaleManager.scales ? window.scaleManager.scales : null')
    except Exception as e:
        print('ERROR reading scales:', e)
        scales = None

    print('scales:', scales)
    print('initial data-scale:', page.evaluate("document.body.getAttribute('data-scale')"))
    print('initial inline zoom:', page.evaluate("document.body.style.zoom"))
    print('initial saved:', page.evaluate("localStorage.getItem('ddcs_scale_preference')"))

    # Click through scales twice to exercise cycling forward
    for i in range((len(scales) if scales else 8) * 2):
        try:
            page.click('#scaleBtn')
            page.wait_for_timeout(150)
            ds = page.evaluate("document.body.getAttribute('data-scale')")
            inline = page.evaluate("document.body.style.zoom")
            saved = page.evaluate("localStorage.getItem('ddcs_scale_preference')")
            print(f'click {i+1}: data-scale={ds}, inlineZoom={inline}, saved={saved}')
        except Exception as e:
            print('click error:', e)

    # Test setting auto directly
    page.evaluate("window.scaleManager && window.scaleManager.applyScale('auto')")
    page.wait_for_timeout(150)
    print('after applyScale("auto"): data-scale=', page.evaluate("document.body.getAttribute('data-scale')"), 'inlineZoom=', page.evaluate("document.body.style.zoom"), 'saved=', page.evaluate("localStorage.getItem('ddcs_scale_preference')"))

    # Test setScaleFromValue to a non-existing numeric value -> should pick nearest
    page.evaluate("window.scaleManager && window.scaleManager.setScaleFromValue(237)")
    page.wait_for_timeout(150)
    print('after setScaleFromValue(237): data-scale=', page.evaluate("document.body.getAttribute('data-scale')"), 'inlineZoom=', page.evaluate("document.body.style.zoom"), 'saved=', page.evaluate("localStorage.getItem('ddcs_scale_preference')"))

    browser.close()
    sys.exit(0)
