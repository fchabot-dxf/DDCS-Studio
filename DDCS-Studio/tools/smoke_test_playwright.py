from playwright.sync_api import sync_playwright
import sys
import os
from pathlib import Path

OUT = {
    'file_exists': False,
    'console': [],
    'errors': [],
    'elements': {},
    'screenshot': None,
}

# Preferred runtime path: explicit URL via env var (e.g. http://localhost:3000)
smoke_url = os.environ.get('DDCS_SMOKE_URL', '').strip()
if smoke_url:
    OUT['file_exists'] = True
    url = smoke_url
else:
    # Try primary expected location (output bundle), then project root, then legacy nested layout
    html_path = Path(__file__).resolve().parents[1] / 'output' / 'ddcs-studio-standalone.html'
    if not html_path.exists():
        html_path = Path(__file__).resolve().parents[1] / 'ddcs-studio-standalone.html'
    # Fallback for legacy nested layout: tools/ lives next to ddcs-studio-modular/ddcs-studio-modular
    if not html_path.exists():
        html_path = Path(__file__).resolve().parents[1] / 'ddcs-studio-modular' / 'ddcs-studio-standalone.html'
    if not html_path.exists():
        print('ERROR: standalone HTML not found at', html_path)
        sys.exit(2)
    OUT['file_exists'] = True
    url = 'file://' + str(html_path)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    def on_console(msg):
        OUT['console'].append({'type': msg.type, 'text': msg.text})
    page.on('console', on_console)

    def on_page_error(err):
        # capture full representation so stack traces aren't lost when converted to string
        try:
            OUT['errors'].append({'text': str(err), 'repr': repr(err)})
        except Exception:
            OUT['errors'].append(str(err))
    page.on('pageerror', on_page_error)

    page.goto(url, wait_until='load')

    # Basic checks
    OUT['elements']['status'] = page.query_selector('#status') is not None
    OUT['elements']['editor'] = page.query_selector('#editor') is not None
    OUT['elements']['styleBtn'] = page.query_selector('#styleBtn') is not None
    OUT['elements']['csvInput'] = page.query_selector('#csvInput') is not None
    OUT['elements']['cornerVizContainer'] = page.query_selector('#cornerVizContainer') is not None
    OUT['elements']['deckPanel'] = page.query_selector('#deck-panel') is not None
    OUT['elements']['controllerDock'] = page.query_selector('#controller-dock') is not None

    # New toolbar / ticker checks
    OUT['elements']['toolbarLeft'] = page.query_selector('.secondary-toolbar .toolbar-left') is not None
    OUT['elements']['toolbarRight'] = page.query_selector('.secondary-toolbar .toolbar-right') is not None
    OUT['elements']['varList'] = page.query_selector('#varList') is not None

    # Header handle (toggle) checks
    OUT['elements']['headerHandle'] = page.query_selector('#controller-dock .header-handle') is not None
    try:
        if OUT['elements']['headerHandle']:
            OUT['elements']['headerHandleChevron'] = page.evaluate("document.querySelector('#controller-dock .header-handle .chevron') !== null")
            OUT['elements']['headerHandleAria'] = page.get_attribute('#controller-dock .header-handle', 'aria-expanded')

            # measure position and heights before click
            OUT['elements']['dockPositionBefore'] = page.evaluate("getComputedStyle(document.getElementById('controller-dock')).position")
            OUT['elements']['dockHeightBefore'] = page.evaluate("parseInt(getComputedStyle(document.getElementById('controller-dock')).height)")
            OUT['elements']['editorHeightBefore'] = page.evaluate("document.getElementById('editor').clientHeight")

            # click the handle and assert class toggles
            page.click('#controller-dock .header-handle')
            page.wait_for_timeout(200)
            OUT['elements']['dockIsExpandedAfterClick'] = page.evaluate("document.getElementById('controller-dock').classList.contains('is-expanded')")
            OUT['elements']['headerHandleAriaAfterClick'] = page.get_attribute('#controller-dock .header-handle', 'aria-expanded')

            # assert no inline transform/bottom were written to the dock element
            OUT['elements']['dockInlineTransformAfterClick'] = page.evaluate("(function(){const el=document.getElementById('controller-dock'); return el ? (el.style.transform || '') : '';})()")
            OUT['elements']['dockInlineBottomAfterClick'] = page.evaluate("(function(){const el=document.getElementById('controller-dock'); return el ? (el.style.bottom || '') : '';})()")
            OUT['elements']['dockHasInlineTransformAfterClick'] = (OUT['elements']['dockInlineTransformAfterClick'] != '')
            OUT['elements']['dockHasInlineBottomAfterClick'] = (OUT['elements']['dockInlineBottomAfterClick'] != '')

            # measure heights after expand
            OUT['elements']['dockHeightAfter'] = page.evaluate("parseInt(getComputedStyle(document.getElementById('controller-dock')).height)")
            OUT['elements']['editorHeightAfter'] = page.evaluate("document.getElementById('editor').clientHeight")

            # click again to toggle back
            page.click('#controller-dock .header-handle')
            page.wait_for_timeout(200)
            OUT['elements']['dockIsExpandedAfterSecondClick'] = page.evaluate("document.getElementById('controller-dock').classList.contains('is-expanded')")
            OUT['elements']['headerHandleAriaAfterSecondClick'] = page.get_attribute('#controller-dock .header-handle', 'aria-expanded')
            # assert no inline transform/bottom persist after second toggle
            OUT['elements']['dockInlineTransformAfterSecondClick'] = page.evaluate("(function(){const el=document.getElementById('controller-dock'); return el ? (el.style.transform || '') : '';})()")
            OUT['elements']['dockInlineBottomAfterSecondClick'] = page.evaluate("(function(){const el=document.getElementById('controller-dock'); return el ? (el.style.bottom || '') : '';})()")
            OUT['elements']['dockHasInlineTransformAfterSecondClick'] = (OUT['elements']['dockInlineTransformAfterSecondClick'] != '')
            OUT['elements']['dockHasInlineBottomAfterSecondClick'] = (OUT['elements']['dockInlineBottomAfterSecondClick'] != '')
    except Exception as e:
        OUT['errors'].append('header-handle test error: ' + str(e))

    # Try wheel event to ensure horizontal scrolling works (if varList exists)
    try:
        if OUT['elements']['varList']:
            # ensure there is overflow to test scrolling
            page.evaluate("""
                (function(){
                    const list = document.getElementById('varList');
                    // add dummy items until it's scrollable
                    for(let i=0;i<10;i++){
                        const d=document.createElement('div'); d.className='var-item'; d.innerText='Item '+i; list.appendChild(d);
                    }
                })();
            """)
            before = page.evaluate("document.getElementById('varList').scrollLeft")
            metrics = page.evaluate("(function(){const el=document.getElementById('varList'); const toolbar = document.querySelector('.secondary-toolbar'); return {scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, display: window.getComputedStyle(el).display, toolbarInnerHTMLLen: toolbar ? toolbar.outerHTML.length : 0};})()")
            OUT['elements']['varListMetrics'] = metrics
            page.evaluate("document.getElementById('varList').dispatchEvent(new WheelEvent('wheel', {deltaY:120, bubbles:true, cancelable:true}))")
            after = page.evaluate("document.getElementById('varList').scrollLeft")
            OUT['elements']['varListScrolled'] = (after != before)
            OUT['elements']['varListScrollLeftBefore'] = before
            OUT['elements']['varListScrollLeftAfter'] = after
        else:
            OUT['elements']['varListScrolled'] = False
    except Exception as e:
        OUT['errors'].append('wheel test error: ' + str(e))
        OUT['elements']['varListScrolled'] = False

    # Click a couple of buttons to see if handlers are wired
    try:
        page.click('#styleBtn')
        page.click('#scaleBtn')
    except Exception as e:
        OUT['errors'].append('click error: ' + str(e))

    # New checks: Editor keys row and macro grid area
    OUT['elements']['editorKeysRow'] = page.query_selector('.editor-keys-row') is not None
    # macro-grid-area may be appended directly or exist inside #deck-panel; check both
    OUT['elements']['macroGridArea'] = (page.query_selector('.macro-grid-area') is not None) or (page.query_selector('#deck-panel .deck-group') is not None)

    # Editor keys functionality: BACK, SPACE, ENTER
    try:
        if OUT['elements']['editorKeysRow'] and OUT['elements']['editor']:
            # ensure dock is expanded so keys are visible (dock body hidden when collapsed)
            page.click('#controller-dock .header-handle')
            try:
                page.wait_for_selector('.editor-keys-row', timeout=2000)
            except Exception:
                # fallback small wait
                page.wait_for_timeout(250)
            # set known initial value and place cursor at end
            page.evaluate("(()=>{const e=document.getElementById('editor'); e.value='abc'; e.selectionStart=e.selectionEnd=e.value.length;})()")
            # click back (first button) and verify delete
            page.click('.editor-keys-row .toolbar-btn:nth-child(1)')
            after_back = page.evaluate("document.getElementById('editor').value")
            OUT['elements']['editorBackWorked'] = (after_back == 'ab')
            # click space (second button) and verify trailing space
            page.click('.editor-keys-row .toolbar-btn:nth-child(2)')
            after_space = page.evaluate("document.getElementById('editor').value")
            OUT['elements']['editorSpaceWorked'] = after_space.endswith(' ')
            # click enter (third button) and verify newline appended
            page.click('.editor-keys-row .toolbar-btn:nth-child(3)')
            after_enter = page.evaluate("document.getElementById('editor').value")
            OUT['elements']['editorEnterWorked'] = after_enter.endswith('\n')
        else:
            OUT['elements']['editorBackWorked'] = False
            OUT['elements']['editorSpaceWorked'] = False
            OUT['elements']['editorEnterWorked'] = False
    except Exception as e:
        OUT['errors'].append('editor-keys test error: ' + str(e))
        OUT['elements']['editorBackWorked'] = False
        OUT['elements']['editorSpaceWorked'] = False
        OUT['elements']['editorEnterWorked'] = False

    # Open corner wizard and check preview text updates
    try:
        page.evaluate("window.openCornerWiz && window.openCornerWiz()")
        # wait for wizard to show
        page.wait_for_selector('#wiz_corner', timeout=2000)
        # run drawCornerViz
        page.evaluate("window.drawCornerViz && window.drawCornerViz()")
    except Exception as e:
        OUT['errors'].append('wizard error: ' + str(e))

    # Open alignment wizard and verify a probe element is created
    try:
        page.evaluate("window.openAlignmentWiz && window.openAlignmentWiz()")
        page.wait_for_selector('#wiz_alignment', timeout=2000)
        page.evaluate("window.drawAlignmentViz && window.drawAlignmentViz()")
        OUT['elements']['alignmentProbe'] = page.query_selector('[id^="alignment_"]') is not None
    except Exception as e:
        OUT['errors'].append('alignment wizard error: ' + str(e))

    # capture screenshot
    ss_path = Path(__file__).resolve().parents[1] / 'output' / 'smoke_screenshot.png'
    ss_path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ss_path), full_page=True)
    OUT['screenshot'] = str(ss_path)

    browser.close()

print('# SMOKE TEST RESULT')
print('file_exists:', OUT['file_exists'])
print('elements:', OUT['elements'])
print('console messages (first 15):')
for c in OUT['console'][:15]:
    print('  -', c)
print('page errors (first 10):')
for e in OUT['errors'][:10]:
    print('  -', e)
print('screenshot:', OUT['screenshot'])

if OUT['errors']:
    sys.exit(1)
else:
    sys.exit(0)
