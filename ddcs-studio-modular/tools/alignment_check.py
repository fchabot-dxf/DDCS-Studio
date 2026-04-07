from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000', wait_until='load')
    # give some time for modules to initialize
    page.wait_for_timeout(1200)
    has_open = page.evaluate("typeof window.openAlignmentWiz === 'function'")
    print('has open func', has_open)
    page.evaluate("window.openAlignmentWiz && window.openAlignmentWiz()")
    try:
        page.wait_for_selector('#wiz_alignment', timeout=2000)
        print('wizard shown')
    except Exception as e:
        print('alignment wizard did not show', e)
    page.evaluate("window.drawAlignmentViz && window.drawAlignmentViz()")
    svg_exists = page.query_selector('#alignmentVizContainer svg') is not None
    probes = page.evaluate("document.querySelectorAll('[id^=\\\"alignment_\\\"]').length")
    print('svg_exists', svg_exists, 'probe count', probes)
    browser.close()
