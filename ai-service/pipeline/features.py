"""Feature engineering: pair features for compatibility, text+numeric frame for tagging."""
import numpy as np
import pandas as pd
from .places import km
from .schema import TRAITS, norm

NUMT = ["sleep", "clean", "guests", "noise", "smoke", "pets", "wfh", "veg"]


def tag_frame(users):
    return pd.DataFrame({"bio": [u["bio"] for u in users],
                         **{k: [u[k] / 5 if k in TRAITS else u[k] for u in users] for k in NUMT}})


def jaccard(a, b):
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if (a | b) else 0.0


def pair_row(me, o, tm=(), to=(), bs=float("nan")):
    """Directional features describing how `o` looks from the point of view of `me`."""
    r = {}
    for k in TRAITS:
        d = abs(me[k] - o[k]) / 4
        r["d_" + k] = d                                   # distance
        r["s_" + k] = (o[k] - me[k]) / 4                  # signed gap (captures asymmetry)
        r["wd_" + k] = me["w"][k] / 5 * d                 # distance weighted by my importance
        r["wo_" + k] = o["w"][k] / 5 * d                  # distance weighted by their importance
    ov = min(me["max"], o["max"]) - max(me["min"], o["min"])
    span = max(1.0, min(me["max"] - me["min"], o["max"] - o["min"]))
    r["bud_ratio"] = float(np.clip(ov / span, -1, 1))
    r["bud_gap"] = float(min(1.0, max(0.0, -ov) / max(me["max"], 1.0)))
    r["same_city"] = 0.5 if (not me["city"] or not o["city"]) else float(me["city"] == o["city"])
    r["same_type"] = float(me["type"] == o["type"])
    r["beds_diff"] = min(3, abs(me["beds"] - o["beds"])) / 3
    r["furn_match"] = float(me["furn"] == o["furn"])
    r["stay_diff"] = min(9, abs(me["stay"] - o["stay"])) / 9
    r["complement"] = float(me["role"] != o["role"])
    r["both_smoke"] = float(me["smoke"] >= 1 and o["smoke"] >= 1)
    r["both_pets"] = float(me["pets"] >= 1 and o["pets"] >= 1)
    r["both_wfh"] = float(me["wfh"] >= 1 and o["wfh"] >= 1)
    r["veg_match"] = float(me["veg"] == o["veg"])
    r["area_km"] = km(me["area"], o["area"])                  # NaN when a place is not set (the model handles missing values)
    r["commute_km"] = km(me["anchor"], o["area"])             # my campus/workplace -> their home
    r["commute_km_rev"] = km(o["anchor"], me["area"])         # their campus/workplace -> my home
    r["bio_sim"] = bs                                         # cosine of the two descriptions in LSA space (NaN if either has no description)
    r["tag_jaccard"] = jaccard(tm, to)                    # overlap of AI tags (tag model feeds compat model)
    return r


FEATURES = list(pair_row(norm({}), norm({})).keys())

# "If this factor were perfect" values, used for counterfactual explanations
GROUPS = {
    "Sleep schedule": {"d_sleep": 0, "s_sleep": 0, "wd_sleep": 0, "wo_sleep": 0},
    "Cleanliness": {"d_clean": 0, "s_clean": 0, "wd_clean": 0, "wo_clean": 0},
    "Guests": {"d_guests": 0, "s_guests": 0, "wd_guests": 0, "wo_guests": 0},
    "Noise level": {"d_noise": 0, "s_noise": 0, "wd_noise": 0, "wo_noise": 0},
    "Budget": {"bud_ratio": 1, "bud_gap": 0},
    "Location": {"same_city": 1},
    "Commute": {"area_km": 0, "commute_km": 0, "commute_km_rev": 0},
    "Property": {"same_type": 1, "beds_diff": 0, "furn_match": 1, "stay_diff": 0},
}


def baseline_score(me, o):
    """The original hand-written weighted-similarity formula, kept as the benchmark to beat."""
    n = d = 0.0
    for k in TRAITS:
        w = me["w"][k]
        n += w * (1 - abs(me[k] - o[k]) / 4)
        d += w
    ov = min(me["max"], o["max"]) - max(me["min"], o["min"])
    bs = 1.0 if ov >= 0 else max(0.0, 1 + ov / max(me["max"], 1))
    cs = 1.0 if me["city"] == o["city"] else 0.2
    ps = (1.0 if me["type"] == o["type"] else 0.3) * 0.6 + (1.0 if me["beds"] == o["beds"] else 0.4) * 0.4
    return (n + 3 * bs + 3 * cs + 2 * ps) / (d + 8)
