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


# ── V4.1 (t650) — the SAME rig's June-10 capture, DERIVED BY NAME from the firmware `eng` dictionary (the amendment:
# declare-not-hardcode; controllers/README.md — never cross-apply the Expert indices). The eng gives a soft-limit neg/pos
# PAIR per axis (#235-237 / #240-242 = -3830/-3900/-800 · 0/0/0) → travel 3830/3900/800, home MAX; the home-dir bit
# confirms/conflicts (X's disagrees → flagged). Homing feeds ARE eng-named (search speed #204-207). Soft limits DISABLED (#234=0).
_V41_CAPTURE = os.path.normpath(os.path.join(_HERE, "..", "..", "controllers", "v4.1", "assets", "setting"))
_V41_ENG = os.path.normpath(os.path.join(_HERE, "..", "..", "controllers", "v4.1", "assets", "firmware",
                                         "ddcs v4.1", "ddcsv4(2025-04-04)", "ddcsv4(2025-04-04)", "ddcsv4", "eng"))


def _v41_prof_from_capture():
    data = open(_V41_CAPTURE, "rb").read()
    assert len(data) == 12000, "the V4.1 setting file is 1500 x LE f64 (12000 bytes); got %d" % len(data)
    params = list(struct.unpack("<1500d", data))
    eng_text = open(_V41_ENG, "rb").read().decode("utf-8", "replace")
    prof = {}
    Ops(None, None)._map_geometry_to_profile_v41(params, prof, eng_text)
    return prof


def test_v41_eng_parser_names_the_indices():
    """The declared eng parser resolves the geometry indices BY NAME (not hardcoded): the soft-limit X-- is #235, etc."""
    eng = Ops(None, None)._parse_eng(open(_V41_ENG, "rb").read().decode("utf-8", "replace"))
    assert "Soft-limited" in eng[235]["name"] and "X--" in eng[235]["name"], eng.get(235)
    assert eng[234]["enums"] == {0: "Disable", 1: "Enable"}, eng.get(234)   # #234 = Enable software limit
    gi = Ops(None, None)._v41_geo_indices(eng)
    assert gi["softNeg"] == {"x": 235, "y": 236, "z": 237}, gi["softNeg"]
    assert gi["softPos"] == {"x": 240, "y": 241, "z": 242}, gi["softPos"]
    assert gi["enable"] == 234 and gi["seek"] == {"x": 204, "y": 205, "z": 206}, gi


def test_v41_travel_signs_edges():
    """V4.1 travel/signs/edges from the eng-named soft-limit pair (the advisor's live-pull assertion): 3830/3900/800, home MAX."""
    g = _v41_prof_from_capture()["geometry"]
    assert g["travel"] == {"x": 3830.0, "y": 3900.0, "z": 800.0}, g["travel"]
    assert g["homeDir"] == {"x": -1, "y": -1, "z": -1}, g["homeDir"]
    assert g["homeEdge"] == {"x": "max", "y": "max", "z": "max"}, g["homeEdge"]
    assert g["softLimits"]["xMin"] == -3830.0 and g["softLimits"]["xMax"] == 0.0, g["softLimits"]
    # X's home-direction bit (#199 = Negative) DISAGREES with the soft-limit far end (max) → flagged; the soft-limit wins.
    assert g["homeEdgeConflict"]["x"] is True and g["homeEdgeConflict"]["y"] is False, g["homeEdgeConflict"]


def test_v41_feeds_grounded_and_enable():
    """Homing feeds ARE eng-grounded (search speed 5000/5000/1500). Soft limits DISABLED (#234=0) surfaced."""
    prof = _v41_prof_from_capture()
    g = prof["geometry"]
    assert g["homingFeeds"]["speed"] == {"x": 5000.0, "y": 5000.0, "z": 1500.0}, g["homingFeeds"]
    assert g["softLimitEnabled"] is False, g["softLimitEnabled"]              # #234 = 0 → honestly surfaced
    assert g["machZero"] is None, g
    assert prof["geometryRaw"]["indices"]["softNeg"] == {"x": 235, "y": 236, "z": 237}, prof["geometryRaw"]


# ── V4.1 WCS from the SYSDISK coord1 file (t654). Block index = the coord-system enum (block 1 = G54). The June backup
# has G54 = (-300.29, -116.06, 1547.27) at block 1; the exact values must land in the wcs payload at G54.
_V41_COORD1 = os.path.normpath(os.path.join(_HERE, "..", "..", "controllers", "v4.1", "assets", "system-backup", "current", "coord1"))


def test_v41_wcs_from_coord1_lands_at_g54():
    """The coord1 block 1 (= G54 per the enum + selcoord.rc) lands EXACTLY at wcs.table.g54; the empty systems are 0; the
    ext row (block 8) never leaks into G54..G59. Active = setting #16 (0=G53 → Studio default G54)."""
    coord1 = list(struct.unpack("<54d", open(_V41_COORD1, "rb").read()[:432]))
    params = list(struct.unpack("<1500d", open(_V41_CAPTURE, "rb").read()[:12000]))
    prof = {}
    Ops(None, None)._map_wcs_to_profile_v41(params, prof, coord1)
    w = prof["wcs"]
    assert w is not None, "coord1 present → wcs payload built"
    assert w["table"]["g54"] == [-300.29, -116.06, 1547.268], w["table"]["g54"]   # the EXACT June values, at G54
    assert w["table"]["g55"] == [0.0, 0.0, 0.0] and w["table"]["g59"] == [0.0, 0.0, 0.0], w["table"]
    # active: setting #16 = 0 (G53) → Studio's G54 default (1); workOrigin = the active row
    assert w["active"] == 1, w["active"]
    assert w["workOrigin"] == {"x": -300.29, "y": -116.06, "z": 1547.268}, w["workOrigin"]


def test_v41_wcs_none_when_coord1_unreadable():
    """No coord1 (unreachable / bench-declined) → wcs stays N/A (never guessed), same honest fallback as before."""
    prof = {}
    Ops(None, None)._map_wcs_to_profile_v41([0.0] * 1500, prof, None)
    assert "wcs" not in prof or prof["wcs"] is None, prof


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS — Expert (756/min · 776/max · feeds 2000/150) + V4.1 eng-by-name (travel 3830/3900/800 · home MAX · feeds 5000/5000/1500 · soft-limits DISABLED) + V4.1 WCS from coord1 (G54 = -300.29/-116.06/1547.27 at block 1)")
