"""Gazetteer shared with the Node API (../shared/places.json) and great-circle distances."""
import json, math, os

_P = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "shared", "places.json")
PLACES = {p["id"]: p for p in json.load(open(_P, encoding="utf-8"))["places"]}
BY_CITY = {}
for _p in PLACES.values():
    BY_CITY.setdefault(_p["city"], []).append(_p)


def km(a, b):
    pa, pb = PLACES.get(a), PLACES.get(b)
    if not pa or not pb:
        return float("nan")
    f1, f2 = math.radians(pa["lat"]), math.radians(pb["lat"])
    h = math.sin((f2 - f1) / 2) ** 2 + math.cos(f1) * math.cos(f2) * math.sin(math.radians(pb["lng"] - pa["lng"]) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))
