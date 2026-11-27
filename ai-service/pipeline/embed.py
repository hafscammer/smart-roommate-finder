"""Latent semantic analysis: TF-IDF followed by truncated SVD turns each description into a 32-number 'meaning vector'.
Descriptions that talk about similar things end up close together even when they share few exact words."""
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

MIN_CHARS = 8
has_text = lambda t: len(str(t or "").strip()) >= MIN_CHARS


class BioEmbedder:
    def fit(self, texts, dim=32):
        self.vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, max_features=20000)
        X = self.vec.fit_transform([str(t) for t in texts])
        self.svd = TruncatedSVD(n_components=min(dim, X.shape[1] - 1), random_state=0).fit(X)
        return self

    def transform(self, texts):
        if not len(texts): return np.zeros((0, self.svd.n_components))
        Z = self.svd.transform(self.vec.transform([str(t) for t in texts]))
        return Z / np.maximum(np.linalg.norm(Z, axis=1, keepdims=True), 1e-9)
