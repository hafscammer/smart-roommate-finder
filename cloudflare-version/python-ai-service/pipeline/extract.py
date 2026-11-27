"""Description -> lifestyle extractor, sentence by sentence.

A TF-IDF (words + characters) logistic-regression model per target reads each sentence: level (1/3/5) and importance
(1/3/5) for 4 traits, plus 6 binary habit/dealbreaker flags. Per-sentence reading keeps cues like "it's a must"
attached to the right trait; the strongest sentence per trait wins when the description is combined."""
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_union
from .schema import TRAITS

FLAG_KEYS = ["smoke", "pets", "wfh", "veg", "nosmoke", "nopets"]
SPLIT = re.compile(r"(?<=[.!?;])\s+|\n+")


def _vec():
    return make_union(TfidfVectorizer(ngram_range=(1, 3), min_df=2, sublinear_tf=True, max_features=25000),
                      TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=3, sublinear_tf=True, max_features=25000))


class Extractor:
    def fit(self, texts, Y):
        self.vec = _vec(); X = self.vec.fit_transform(texts)
        self.models = {k: LogisticRegression(C=10, max_iter=2000).fit(X, y) for k, y in Y.items()}
        return self

    def predict_all(self, texts):
        X = self.vec.transform(texts)
        return {k: m.predict(X) for k, m in self.models.items()}

    def extract(self, text):
        sents = [s.strip() for s in SPLIT.split(str(text)) if len(s.strip()) > 2] or [""]
        X = self.vec.transform(sents)
        proba = {k: m.predict_proba(X) for k, m in self.models.items()}
        traits, imp, flags = {}, {}, {}
        for k in TRAITS:
            P = proba[k]; cls = list(self.models[k].classes_)
            lo, hi = P[:, cls.index(1)], P[:, cls.index(5)]
            conf = np.maximum(lo, hi); i = int(conf.argmax())          # the sentence that speaks most clearly about this trait
            if conf[i] >= 0.5:
                traits[k] = 1 if lo[i] >= hi[i] else 5
                Pw = proba["w_" + k][i]; imp[k] = int(self.models["w_" + k].classes_[int(Pw.argmax())])
            else:
                traits[k], imp[k] = 3, 3
        for f in FLAG_KEYS:
            flags[f] = int(proba[f][:, 1].max() >= 0.5)
        Pj, cj = proba["profession"], list(self.models["profession"].classes_)
        jobs = sorted(((float(Pj[:, j].max()), c) for j, c in enumerate(cj) if c != "none" and Pj[:, j].max() >= 0.5), reverse=True)
        return traits, imp, flags, [str(c) for _, c in jobs]
