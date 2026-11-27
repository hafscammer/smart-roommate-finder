"""Fair-rent price check: quantile gradient boosting (15% / 50% / 85%) on city, property type, bedrooms, furnishing and area.
Trained on a synthetic market; replace with scraped or partner listing data when available."""
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from .places import BY_CITY

BASE = {"faisalabad": 170, "lahore": 230, "islamabad": 300, "london": 1000, "toronto": 1050}
TYPE_F = {"room": 1.0, "studio": 1.5, "flat": 2.0, "house": 2.8}
QS = (0.15, 0.5, 0.85)


def area_premium(aid):
    return 1.0 if not aid else 0.9 + ((sum(ord(c) for c in aid) * 37) % 100) / 100 * 0.35


def make_rent(n=6000, seed=5):
    rng = np.random.default_rng(seed); rows = []
    for _ in range(n):
        city = str(rng.choice(list(BASE))); typ = str(rng.choice(list(TYPE_F), p=[.4, .15, .3, .15])); beds = int(rng.choice([1, 2, 3, 4], p=[.4, .3, .2, .1])); furn = int(rng.random() < 0.5)
        areas = [p["id"] for p in BY_CITY.get(city, []) if p["kind"] == "area"]; area = str(rng.choice(areas)) if areas and rng.random() < 0.8 else ""
        price = BASE[city] * TYPE_F[typ] * (1 + 0.3 * (beds - 1) if typ in ("flat", "house") else 1) * (1.12 if furn else 1) * area_premium(area) * float(rng.lognormal(0, 0.12))
        rows.append({"city": city, "type": typ, "beds": beds, "furn": furn, "area": area, "price": price})
    return pd.DataFrame(rows)


class RentModel:
    CAT, NUM = ["city", "type", "area"], ["beds", "furn"]

    def _pipe(self, q):
        pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore", sparse_output=False), self.CAT), ("n", "passthrough", self.NUM)])
        return Pipeline([("pre", pre), ("m", HistGradientBoostingRegressor(loss="quantile", quantile=q, max_depth=5, max_iter=200, learning_rate=0.1, random_state=1))])

    def fit(self, df):
        X = df[self.CAT + self.NUM]; self.models = {q: self._pipe(q).fit(X, df["price"]) for q in QS}; self.cities = set(df["city"]); return self

    def evaluate(self, df):
        X, y = df[self.CAT + self.NUM], df["price"].to_numpy(); lo, mid, hi = (self.models[q].predict(X) for q in QS)
        return {"mape": round(float(np.mean(np.abs(mid - y) / y)), 4), "band_coverage": round(float(np.mean((y >= lo) & (y <= hi))), 3)}

    def predict(self, city, type_, beds, furn, area):
        row = pd.DataFrame([{"city": str(city or "").strip().lower(), "type": type_ if type_ in TYPE_F else "room", "beds": max(1, min(int(beds or 1), 6)), "furn": int(bool(furn)), "area": area or ""}])
        lo, mid, hi = sorted(float(self.models[q].predict(row)[0]) for q in QS); r5 = lambda v: int(round(v / 5) * 5)
        return {"low": r5(lo), "mid": r5(mid), "high": r5(hi), "known_city": row["city"][0] in self.cities}
