"""Shared constants and profile normalisation (the contract with the Node API)."""
import numpy as np

TRAITS = ["sleep", "clean", "guests", "noise"]
LABELS = {"sleep": "Sleep schedule", "clean": "Cleanliness", "guests": "Guests", "noise": "Noise level"}
FLAGS = ["smoke", "pets", "wfh", "veg"]
TAGS = ["Smoker", "Night owl", "Early bird", "Neat freak", "Easy-going", "Social host",
        "Quiet type", "Pet lover", "Student", "Remote worker", "Foodie", "Vegetarian"]
DEFAULT = {"sleep": 3, "clean": 3, "guests": 3, "noise": 3, "smoke": 0, "pets": 0, "wfh": 0, "veg": 0,
           "nosmoke": 0, "nopets": 0, "furn": 0, "min": 0, "max": 0, "beds": 1, "type": "room",
           "role": "seeker", "city": "", "stay": "6", "bio": "", "area": "", "anchor": "", "profession": ""}
NUMERIC = TRAITS + FLAGS + ["nosmoke", "nopets", "furn", "min", "max", "beds"]


def num(v, d):
    try:
        x = float(v)
        return x if np.isfinite(x) else d
    except (TypeError, ValueError):
        return d


def norm(u):
    """Return a clean profile dict with safe defaults, numeric types and a normalised importance dict."""
    n = dict(DEFAULT)
    n.update({k: u[k] for k in DEFAULT if u.get(k) is not None})
    for k in NUMERIC:
        n[k] = num(n[k], DEFAULT[k])
    w = u.get("w") or {}
    n["w"] = {k: num(w.get(k), 3) for k in TRAITS}
    n["bio"] = str(n["bio"] or "")[:1000]
    n["city"] = str(n["city"]).strip().lower()
    n["area"], n["anchor"], n["profession"] = str(n["area"] or ""), str(n["anchor"] or ""), str(n["profession"] or "")[:40]
    n["stay"] = num(n["stay"], 6)
    n["type"], n["role"] = str(n["type"]), str(n["role"])
    n["id"] = u.get("id")
    return n


def block_reason(me, o):
    if (me["nosmoke"] and o["smoke"]) or (o["nosmoke"] and me["smoke"]):
        return "smoking dealbreaker"
    if (me["nopets"] and o["pets"]) or (o["nopets"] and me["pets"]):
        return "pets dealbreaker"
    return None
