"""
THE GATEWAY AND THE BROWSER MUST AGREE ON EVERY CONTROLLER PROFILE ID (t2109).

THE DEFECT THIS CATCHES: ops.py's own _CONTROLLERS table published "ddcs-v4.1" (with a dot) as the V4.1's
profile id -- fourteen other files (controllerProfiles.js, the dialect module's own filename
web/wizards/dialects/ddcs-v41.js, dumpImport.js, portingArc.js, PORTING.md, golden snapshots, 8 specs) all
agree on "ddcs-v41" (no dot). One character, and it blocked EVERY send to a V4.1: compareController compares
descriptor().controller_profile_id against the workspace's controllerId, they differ, and t1229's hard block
fires on a perfectly correct setup with no override by design.

WHY NO TEST CAUGHT IT: gateway-mismatch-gate-1229.spec.js mocks profile as {id: 'ddcs-v41'} -- the BROWSER's
own spelling -- so it proved the gate works against a value the REAL gateway never actually produces. This
file closes that gap from the other side: it reads controllerProfiles.js LIVE (never a hardcoded copy of its
keys, which could drift the exact same way the id itself did) and asserts every id ops.py's own _CONTROLLERS
table publishes is a real key there. Covers EVERY family, not just Expert (which already agreed) -- a test
that only checked Expert would have passed while the V4.1 stayed broken.

Run standalone:  python bridge/bridge-app/tests/test_controller_id_agreement_2109.py
"""
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.ops import Ops   # noqa: E402

_PROFILES_JS = os.path.normpath(os.path.join(
    _HERE, "..", "..", "..", "DDCS-Studio", "web", "shared", "js", "profiles", "controllerProfiles.js"))


def _browser_profile_ids():
    """The REAL, live set of top-level keys in CONTROLLER_PROFILES -- read from the actual file, not a
    hardcoded copy of it (a copy is exactly the kind of second source that let the dot drift in unnoticed).
    Matches only 4-space-indented `'key': {` lines -- the object's own top-level entries; nested fields
    (probeVars/atc, indented deeper) don't match this exact shape."""
    with open(_PROFILES_JS, encoding="utf-8") as f:
        text = f.read()
    return set(re.findall(r"^ {4}'([\w.-]+)':\s*\{", text, re.MULTILINE))


def test_the_profiles_js_file_is_where_this_test_expects_it():
    """Sanity first: if the path is wrong, every assertion below would vacuously pass on an empty set."""
    assert os.path.isfile(_PROFILES_JS), _PROFILES_JS


def test_every_ops_py_controller_family_publishes_an_id_the_browser_actually_recognises():
    """⭐ THE test that would have caught it. Every family in _CONTROLLERS, not just one -- Expert already
    agreed (which is exactly how this could hide for as long as it did: SOME sends worked fine)."""
    browser_ids = _browser_profile_ids()
    assert browser_ids, "regex found zero keys — the file moved or its shape changed; fix the pattern, not this test"
    checked = []
    for family, profile in Ops._CONTROLLERS.items():
        pid = profile.get("id")
        checked.append((family, pid))
        assert pid in browser_ids, (
            f"ops.py's _CONTROLLERS[{family!r}] publishes id={pid!r}, which controllerProfiles.js does NOT "
            f"recognise (real keys there: {sorted(browser_ids)}) — this is exactly the 'ddcs-v4.1' vs "
            f"'ddcs-v41' defect: it silently hard-blocks every send from a correctly matched controller."
        )
    assert len(checked) >= 2, f"expected at least Expert + V4.1, only checked {checked}"


def test_the_v41_id_specifically_has_no_dot_the_exact_reported_defect():
    """Named directly, not just implied by the general loop above — the specific byte that broke a live
    bench test today, pinned so it can never silently regress back to the dotted spelling."""
    assert Ops._CONTROLLERS["v4.1"]["id"] == "ddcs-v41", Ops._CONTROLLERS["v4.1"]["id"]


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- every controller family ops.py publishes an id the browser's own controllerProfiles.js "
          "actually recognises, checked against the LIVE file, not a copy of its keys.")
