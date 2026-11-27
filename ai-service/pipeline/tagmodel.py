"""Multi-label tag classifier: TF-IDF on the bio + structured answers -> one logistic regression per tag."""
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from .schema import TAGS
from .features import tag_frame, NUMT


def build():
    pre = ColumnTransformer([("t", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True), "bio"), ("n", "passthrough", NUMT)])
    return Pipeline([("pre", pre), ("clf", OneVsRestClassifier(LogisticRegression(C=8, max_iter=2000)))])


def multihot(tag_lists):
    return np.array([[int(t in s) for t in TAGS] for s in tag_lists])


def predict_tags(model, users, thr=0.5):
    P = model.predict_proba(tag_frame(users))
    return [[t for t, p in zip(TAGS, row) if p >= thr] for row in P]


TAG_TRAIT = {"Night owl": "sleep", "Early bird": "sleep", "Neat freak": "clean", "Easy-going": "clean", "Social host": "guests", "Quiet type": "noise"}


def build_struct():
    return Pipeline([("clf", OneVsRestClassifier(LogisticRegression(C=8, max_iter=2000)))])


class TagEngine:
    """Shows at most k tags (default 2). Candidates are ranked by probability x informativeness (rare tags say more about a
    person) with a boost for must-haves. With a description, the text+habit model decides. Without one, only a model that sees the
    structured answers alone may add a single, confident tag; otherwise the profile is simply left untagged."""

    def __init__(self, text, struct, rates):
        self.text, self.struct, self.rates = text, struct, np.asarray(rates)

    def all(self, users, thr=0.5):
        return predict_tags(self.text, users, thr)

    def top(self, users, k=2):
        if not users: return []
        F = tag_frame(users); P = self.text.predict_proba(F); S = self.struct.predict_proba(F[NUMT]); info = -np.log(np.clip(self.rates, 1e-3, 0.999)); out = []
        for i, u in enumerate(users):
            has = len(str(u.get("bio") or "").strip()) >= 8
            probs, thr = (P[i], 0.6) if has else (S[i], 0.7)
            sal = probs * info
            for t, tr in TAG_TRAIT.items():
                if (u.get("w") or {}).get(tr, 3) >= 5: sal[TAGS.index(t)] *= 1.5       # a must-have is worth showing
            prof = str(u.get("profession") or "")
            picks = [TAGS[j] for j in np.argsort(-sal) if probs[j] >= thr and not (prof and TAGS[j] == "Student")]
            out.append(([prof] if prof else []) + picks if True else [])
            out[-1] = out[-1][: (k if has else 1)]
        return out
