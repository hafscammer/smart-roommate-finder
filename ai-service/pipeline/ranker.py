"""Learning to rank. The pointwise model answers 'will this pair work?'; ranking needs 'who should come first?'.
This re-ranker learns, from lists where some candidates turned out good and others bad, how to combine the pointwise
model's two-way scores with the rule formula, distance and description similarity (pairwise logistic loss, RankNet style)."""
import numpy as np
from sklearn.linear_model import LogisticRegression


def logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def stack_matrix(lp, lq, base, X):
    ck, ak, bs = X["commute_km"].to_numpy(float), X["area_km"].to_numpy(float), X["bio_sim"].to_numpy(float)
    return np.column_stack([lp, lq, base, ~(np.isnan(ck) & np.isnan(ak)), np.nan_to_num(np.minimum(ck, 15) / 15), np.nan_to_num(np.minimum(ak, 15) / 15), np.nan_to_num(bs), ~np.isnan(bs)]).astype(float)


def ndcg_at_k(rel, score, k=5):
    order = np.argsort(-score)[:k]; disc = 1 / np.log2(np.arange(2, len(order) + 2))
    ideal = np.sort(rel)[::-1][:k]
    return float((rel[order] * disc).sum() / max((ideal * disc[: len(ideal)]).sum(), 1e-9))


class Ranker:
    def fit(self, lists, seed=0, per_list=120):
        rng = np.random.default_rng(seed); allF = np.vstack([F for F, _ in lists])
        self.mu, self.sd = allF.mean(0), allF.std(0) + 1e-9; D, T = [], []
        for F, y in lists:
            Z = (F - self.mu) / self.sd; pos, neg = np.where(y == 1)[0], np.where(y == 0)[0]
            if not len(pos) or not len(neg): continue
            for _ in range(per_list):
                a, b = rng.choice(pos), rng.choice(neg); D += [Z[a] - Z[b], Z[b] - Z[a]]; T += [1, 0]
        self.w = LogisticRegression(C=1.0, fit_intercept=False, max_iter=1000).fit(np.array(D), np.array(T)).coef_[0]
        return self

    def score(self, F):
        return ((F - self.mu) / self.sd) @ self.w
