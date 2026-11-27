"""Item-to-item collaborative filtering from implicit feedback (saves, requests, accepts, messages): people who are liked by
the same users end up with similar factor vectors. Needs real usage data, so it stays off until enough events exist."""
import numpy as np
from scipy.sparse import coo_matrix
from sklearn.decomposition import TruncatedSVD


class Collab:
    def __init__(self):
        self.ok, self.vec = False, {}

    def fit(self, events, dim=16):
        self.ok, self.vec = False, {}
        users = sorted({e["user"] for e in events}); items = sorted({e["item"] for e in events})
        if len(events) < 30 or len(users) < 5 or len(items) < 5: return self
        ui, ii = {u: i for i, u in enumerate(users)}, {x: i for i, x in enumerate(items)}
        M = coo_matrix(([float(e.get("w", 1)) for e in events], ([ui[e["user"]] for e in events], [ii[e["item"]] for e in events])), shape=(len(users), len(items))).tocsr()
        svd = TruncatedSVD(n_components=min(dim, min(M.shape) - 1), random_state=0).fit(M)
        Z = svd.components_.T * svd.singular_values_            # weight by singular values so empty directions do not add noise
        Z = Z / np.maximum(np.linalg.norm(Z, axis=1, keepdims=True), 1e-9)
        self.vec = {x: Z[i] for x, i in ii.items()}; self.ok = True
        return self

    def sim(self, a, b):
        va, vb = self.vec.get(a), self.vec.get(b)
        return None if va is None or vb is None else float(va @ vb)
