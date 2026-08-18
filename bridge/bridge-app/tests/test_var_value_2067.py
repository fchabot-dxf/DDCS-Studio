"""
THE SETTING FILE IS NOT THE MACRO ADDRESS SPACE (t2067).

A macro variable reads the persisted PARAM 500 below it: macro #805 = param #305 = setting[305], macro #578
(active WCS) = setting[78]. `_var_value` used to read setting[#var] (setting[805]) — a different, empty slot — so a
taught G54 came back "000" in the pull ("G54 shows 000 but I have one"). Bench ground truth from a live dump:
setting[305..307] = 50.13 / -665.704 / -47.283 (the real G54) while setting[805..807] = 0. This asserts the raw
var-read now returns the real offsets from the -500 slot, matching _map_geometry_to_profile's own base (#305).

Run standalone:  python bridge/bridge-app/tests/test_var_value_2067.py
(No pytest infra in this repo; plain asserts + a PASS print. Also importable as test_* for a future runner.)
"""
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))          # bridge-app (for `fairy`)
from fairy.backend.local_folder import LocalFolderBackend    # noqa: E402
from fairy.config import Config                               # noqa: E402
from fairy.ops import Ops                                     # noqa: E402


def _ops():
    tmp = tempfile.mkdtemp()
    return Ops(LocalFolderBackend(tmp), Config(local_root=tmp, expert_dest=r"\\bench\cncdisk"))


def _files():
    setting = [0.0] * 1000
    # the real G54 offsets live at PARAM index 305..307 (= macro #805..#807), NOT at index 805
    setting[305], setting[306], setting[307] = 50.13, -665.704, -47.283
    setting[78] = 2.0            # active WCS param #78 (= macro #578) → G55
    default_setting = [0.0] * 1000   # factory baseline all-zero → any non-zero is userSet
    uservar = [0.0] * 450
    uservar[50] = 7.0            # macro #150 → uservar[50]
    camsetting = [0.0] * 500
    camsetting[200] = 3.0        # macro #1200 → camsetting[200]
    return {"setting": setting, "default_setting": default_setting, "uservar": uservar, "camsetting": camsetting}


def test_wcs_macro_reads_the_param_500_below_not_the_same_index():
    ops, files = _ops(), _files()
    g54x = ops._var_value(805, files)
    assert g54x["available"] and abs(g54x["value"] - 50.13) < 1e-9, g54x       # setting[305], not setting[805]=0
    assert g54x["source"] == "setting" and g54x["userSet"] is True, g54x
    assert abs(ops._var_value(806, files)["value"] - (-665.704)) < 1e-9         # G54 Y
    assert abs(ops._var_value(807, files)["value"] - (-47.283)) < 1e-9          # G54 Z
    # the OLD bug: reading the same index would have returned setting[805] = 0
    assert ops._var_value(805, files)["value"] != 0.0, "the -500 slot must be read, not the empty same-index slot"


def test_active_wcs_reads_slot_78_not_578():
    ops, files = _ops(), _files()
    a = ops._var_value(578, files)
    assert a["available"] and a["value"] == 2.0, a     # setting[78] = 2 (G55), not setting[578] = 0


def test_uservar_and_camsetting_paths_unchanged():
    ops, files = _ops(), _files()
    u = ops._var_value(150, files)
    assert u["source"] == "uservar" and u["value"] == 7.0, u        # #150 → uservar[50], untouched
    c = ops._var_value(1200, files)
    assert c["source"] == "camsetting" and c["value"] == 3.0, c     # #1200 → camsetting[200], untouched


def test_locals_and_out_of_range_stay_unavailable():
    ops, files = _ops(), _files()
    assert ops._var_value(50, files)["available"] is False          # #0-99 local RAM
    assert ops._var_value(1600, files)["available"] is False        # #1500+ runtime, bench-map pending


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the raw var-read now maps macro #n -> setting[n-500] (the setting file is param-indexed, NOT the "
          "macro address space): #805 G54-X reads setting[305]=50.13 (was setting[805]=0 -> the '000' bug), #578 "
          "active-WCS reads setting[78]=2, and the uservar/camsetting/local paths are unchanged")
