from playwright.sync_api import sync_playwright
import sys

url = 'http://127.0.0.1:3000/'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    console = []
    requests = []

    def on_console(msg):
        console.append({'type': msg.type, 'text': msg.text})
    page.on('console', on_console)

    def on_request(req):
        requests.append({'url': req.url, 'method': req.method})
    page.on('request', on_request)

    def on_response(resp):
        try:
            if resp.status >= 400:
                requests.append({'url': resp.url, 'status': resp.status})
        except Exception:
            pass
    page.on('response', on_response)

    try:
        page.goto(url, wait_until='load', timeout=15000)
    except Exception as e:
        print('NAV_ERROR', e)

    # Wait a bit for module imports and console logs
    page.wait_for_timeout(800)

    print('--- CONSOLE ---')
    for c in console[:50]:
        print(c)

    print('\n--- 404 / ERR RESPONSES ---')
    for r in requests:
        if 'status' in r and r['status'] >= 400:
            print(r)

    # Check if app attached to window
    attached = page.evaluate("typeof window.ddcsStudio !== 'undefined'")
    print('\napp attached:', attached)

    browser.close()

    # return nonzero if errors or app not attached
    hasError = any('error' in c['type'].lower() or 'uncaught' in c['text'].lower() for c in console)
    if not attached or hasError:
        sys.exit(1)
    sys.exit(0)
