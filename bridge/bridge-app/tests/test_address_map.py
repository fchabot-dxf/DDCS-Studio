"""
THE ONE macro#<->param# OFFSET, pinned (t2073, stage 2).

t2067 shipped because the `-500` that turns a macro number into a `setting` file index was written
TWICE and independently: `_var_value` did `n - 500`, while `_map_geometry_to_profile` hardcoded the
param base `305`. One was wrong, the other right, and nothing forced them to agree. Stage 2 collapses
the offset into ONE declared map (`Ops.PARAM_FILE_OFFSET`) and DERIVES the geometry mapper's WCS base
from the macro base through it (`_WCS_BASE = _WCS_MACRO_BASE - offset`), so the two can no longer drift.

This test pins that single source: the derivation, and that the raw var-read resolves the WCS macro
base to the exact param index the geometry mapper reads. The JS half of the seam (dialect.vars.wcsBase
== the macro base) is pinned on the JS side in stage 3's cross-language test.

Run standalone:  python bridge/bridge-app/tests/test_address_map.py
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


def test_wcs_param_base_is_derived_from_the_macro_base_via_the_one_offset():
    off = Ops.PARAM_FILE_OFFSET["setting"]
    assert off == 500, off
    # the geometry mapper's constants are DERIVED, not independent hardcodes — this is the drift the map removes
    assert Ops._WCS_BASE == Ops._WCS_MACRO_BASE - off, (Ops._WCS_BASE, Ops._WCS_MACRO_BASE, off)      # 305 == 805-500
    assert Ops._ACTIVE_WCS == Ops._ACTIVE_WCS_MACRO - off, (Ops._ACTIVE_WCS, Ops._ACTIVE_WCS_MACRO)   # 78 == 578-500
    # the values the bench dump grounded (guards against someone "fixing" the derivation to the wrong number)
    assert Ops._WCS_BASE == 305 and Ops._ACTIVE_WCS == 78, (Ops._WCS_BASE, Ops._ACTIVE_WCS)


def test_var_read_resolves_the_WCS_macro_base_to_the_geometry_mapper_index():
    """The raw var-read of macro #805 must hit the SAME param slot the geometry mapper reads (_WCS_BASE).
    This is the exact seam t2067 broke — asserted through the real _var_value, not by re-deriving the offset."""
    ops = _ops()
    setting = [0.0] * 1000
    setting[Ops._WCS_BASE] = 50.13          # put the G54-X where the geometry mapper reads it (param #305)
    files = {"setting": setting, "default_setting": [0.0] * 1000, "uservar": None, "camsetting": None}
    got = ops._var_value(Ops._WCS_MACRO_BASE, files)   # read it BY MACRO NUMBER (#805)
    assert got["available"] and abs(got["value"] - 50.13) < 1e-9, got
    assert got["source"] == "setting", got
    # active WCS macro #578 must resolve to param #78 the same way
    setting[Ops._ACTIVE_WCS] = 2.0
    a = ops._var_value(Ops._ACTIVE_WCS_MACRO, files)
    assert a["available"] and a["value"] == 2.0, a


def test_all_three_files_use_the_declared_offsets_not_inline_literals():
    ops = _ops()
    off = Ops.PARAM_FILE_OFFSET
    assert off == {"uservar": 100, "setting": 500, "camsetting": 1000}, off
    uservar = [0.0] * 500
    uservar[150 - off["uservar"]] = 7.0     # macro #150 -> uservar[50]
    camsetting = [0.0] * 500
    camsetting[1200 - off["camsetting"]] = 3.0   # macro #1200 -> camsetting[200]
    files = {"uservar": uservar, "camsetting": camsetting, "setting": None, "default_setting": None}
    assert ops._var_value(150, files)["value"] == 7.0, ops._var_value(150, files)
    assert ops._var_value(1200, files)["value"] == 3.0, ops._var_value(1200, files)


if __name__ == "__main__":
    test_wcs_param_base_is_derived_from_the_macro_base_via_the_one_offset()
    test_var_read_resolves_the_WCS_macro_base_to_the_geometry_mapper_index()
    test_all_three_files_use_the_declared_offsets_not_inline_literals()
    print("PASS -- the -500/-1000/-100 offset is ONE declared map (Ops.PARAM_FILE_OFFSET); _WCS_BASE (#305) is "
          "DERIVED from the macro base (#805) through it, and the raw var-read resolves #805 to that same slot. "
          "The var-read and the geometry mapper can no longer use different offsets.")
