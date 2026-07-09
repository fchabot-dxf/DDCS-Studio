"""
PULL-FROM-CONTROLLER SETS THE MACHINE TRUTH (t594, increment 1) — unit-test the gateway geometry derivation
(Ops._map_geometry_to_profile) DIRECTLY against the real Expert-M350 capture. Asserts the exact values the advisor
hand-derived from the June capture, so a regression in the sentinel-aware envelope / home-edge / feed derivation is caught.

Run standalone:  python bridge/bridge-app/tests/test_pull_geometry.py
(No pytest infra in this repo; plain asserts + a PASS print. Also importable as test_* for a future runner.)
"""
import os
import struct
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))          # bridge-app (for `fairy`)
from fairy.ops import Ops                               # noqa: E402

# The real capture the advisor ground-truthed this session.
_CAPTURE = os.path.normpath(os.path.join(
    _HERE, "..", "..", "controllers", "expert-m350",
    "assets", "capture", "20260610T163337Z", "SYSDISK", "setting"))


def _geometry_from_capture():
    data = open(_CAPTURE, "rb").read()
    assert len(data) == 8000, "the Expert setting file is 1000 x LE f64 (8000 bytes); got %d" % len(data)
    params = list(struct.unpack("<1000d", data))        # index = param#
    prof = {}
    Ops(None, None)._map_geometry_to_profile(params, prof)
    return prof["geometry"]


def test_envelope_from_soft_limits():
    """X 756 (pos end real, neg sentinel), Y 776 (far -776, home end ~+5), Z NOT declared (both ends ±9999)."""
    g = _geometry_from_capture()
    assert g["travel"]["x"] == 756.0, g["travel"]
    assert g["travel"]["y"] == 776.0, g["travel"]         # |far reach| — NOT pos-neg (781)
    assert g["travel"]["z"] is None, g["travel"]          # sentinel both ends → the human fills it
    # the sign Studio scales the magnitude by: +X, -Y
    assert g["homeDir"]["x"] == 1 and g["homeDir"]["y"] == -1, g["homeDir"]


def test_home_edges_from_dir_and_soft_limits():
    """X min-home (#112=0, far +756), Y MAX-home (#113=1, far -776), Z max (dir #114=1; envelope undeclared). No conflicts."""
    g = _geometry_from_capture()
    assert g["homeEdge"] == {"x": "min", "y": "max", "z": "max"}, g["homeEdge"]
    assert g["homeEdgeConflict"] == {"x": False, "y": False, "z": False}, g["homeEdgeConflict"]


def test_homing_feeds():
    """Homing feed #107 = 2000, precision #118 = 150 → seed Studio's Homing Setup."""
    g = _geometry_from_capture()
    assert g["homingFeeds"]["speed"]["x"] == 2000.0, g["homingFeeds"]
    assert g["homingFeeds"]["precision"] == 150.0, g["homingFeeds"]


def test_conflict_is_flagged_when_dir_disagrees():
    """A synthetic axis where the homing-dir bit disagrees with the soft-limit far reach → conflict True, soft-limit wins."""
    params = [0.0] * 1000
    # X: soft limits neg=0/pos=+500 → far +500 → home MIN; but the dir bit says 1 (MAX) → conflict, prefer soft-limit (min).
    params[Ops._SOFT_NEG[0]] = 0.0
    params[Ops._SOFT_POS[0]] = 500.0
    params[Ops._HOMING_DIR[0]] = 1.0
    prof = {}
    Ops(None, None)._map_geometry_to_profile(params, prof)
    g = prof["geometry"]
    assert g["homeEdge"]["x"] == "min", g["homeEdge"]        # the soft-limit far reach WINS
    assert g["homeEdgeConflict"]["x"] is True, g["homeEdgeConflict"]


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS — gateway geometry derivation matches the real capture (X 756/min, Y 776/max, Z undeclared, feeds 2000/150)")
