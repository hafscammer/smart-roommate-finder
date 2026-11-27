"""Roommate personas: unsupervised clustering (k-means) of lifestyle and habit profiles. Each cluster is named after what
makes it different from the average. A persona is only shown when a profile sits clearly inside one cluster."""
import numpy as np
from sklearn.cluster import KMeans
from .schema import TRAITS

DESC = {"sleep": ("Early bird", "Night owl"), "clean": ("Relaxed", "Tidy"), "guests": ("Private", "Social"), "noise": ("Quiet", "Lively")}
HABITS = (("smoke", "Smoker"), ("pets", "Pet owner"), ("wfh", "Home worker"), ("veg", "Vegetarian"))


def vec(u):
    return np.array([u[k] / 5 for k in TRAITS] + [min(1.0, u[k]) for k, _ in HABITS], dtype=float)


class Personas:
    def fit(self, users, k=6, seed=0):
        X = np.array([vec(u) for u in users]); self.mean = X.mean(axis=0)
        self.km = KMeans(n_clusters=k, n_init=10, random_state=seed).fit(X)
        self.names = [self._name(c) for c in self.km.cluster_centers_]
        return self

    def _name(self, c):
        dev = c - self.mean
        scored = [(abs(dev[i]), DESC[k][1] if dev[i] > 0 else DESC[k][0]) for i, k in enumerate(TRAITS)]
        scored += [(dev[4 + j], name) for j, (_, name) in enumerate(HABITS) if dev[4 + j] > 0]
        top = [n for s, n in sorted(scored, reverse=True)[:2] if s >= 0.1]
        return " · ".join(top) if top else "Balanced"

    def assign(self, u):
        d = self.km.transform(vec(u).reshape(1, -1))[0]; order = np.argsort(d); i, j = int(order[0]), int(order[1])
        margin = (d[j] - d[i]) / (d[j] + 1e-9)
        return {"id": i, "name": self.names[i], "confidence": round(float(margin), 3), "show": bool(margin >= 0.2 and self.names[i] != "Balanced")}
