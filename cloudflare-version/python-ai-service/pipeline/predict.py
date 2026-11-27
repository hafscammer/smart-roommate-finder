"""Inference: loads the saved artifacts (training automatically if they are missing or unreadable)."""
import json, os
import joblib, numpy as np, pandas as pd
from . import rules, train
from .embed import has_text
from .features import FEATURES, GROUPS, baseline_score, pair_row
from .ranker import logit as _logit, stack_matrix
from .schema import FLAGS, TRAITS, block_reason, norm


TEMP = 2.2   # display temperature: softens near-0/near-1 probabilities into a friendlier 0-100 score (ranking unchanged)


class Predictor:
    def __init__(self, models_dir=train.MODELS, **train_kw):
        self.dir, self.train_kw = models_dir, train_kw
        self.lock = __import__("threading").Lock()
        try:
            self._load()
        except Exception as e:                                # missing files or sklearn version mismatch
            print(f"[ai] no usable models ({type(e).__name__}); training now, this takes a few seconds...")
            train.run(self.dir, **train_kw); self._load()

    def _load(self):
        self.compat = joblib.load(os.path.join(self.dir, "compat.joblib"))
        self.tagm = joblib.load(os.path.join(self.dir, "tags.joblib"))
        self.extractor = joblib.load(os.path.join(self.dir, "extract.joblib"))
        self.mod = joblib.load(os.path.join(self.dir, "moderation.joblib"))
        self.rentm = joblib.load(os.path.join(self.dir, "rent.joblib"))
        self.intent = joblib.load(os.path.join(self.dir, "replies.joblib"))
        for name in ("embed", "personas", "ranker", "collab"): setattr(self, {"embed": "emb"}.get(name, name), joblib.load(os.path.join(self.dir, name + ".joblib")))
        self.meta = json.load(open(os.path.join(self.dir, "meta.json")))

    def reload(self):
        self._load()

    def moderate(self, text):
        return self.mod.moderate(text)

    def rent(self, city, type_="room", beds=1, furn=0, area=""):
        return self.rentm.predict(city, type_, beds, furn, area)

    def suggest(self, text, me=None):
        return self.intent.suggest(text, me or {})

    @property
    def label(self):
        return f"Python ML ({self.meta['model']}, AUC {self.meta['metrics']['compat']['auc']:.2f})"

    def tags(self, users):
        """Every tag the model believes in (internal: feeds the compatibility model)."""
        return self.tagm.all([norm(u) for u in users]) if users else []

    def top_tags(self, users):
        """The 1-2 tags worth showing: ranked by probability x informativeness; none when there is nothing confident to say."""
        return self.tagm.top([norm(u) for u in users]) if users else []

    def extract(self, text):
        """Read a free-text self-description and return lifestyle levels, importance, habit flags and AI tags."""
        text = str(text or "")[:1000]
        traits, imp, flags, jobs = self.extractor.extract(text)
        rt, ri, rf = rules.extract_rules(text)                 # keyword safety net: only fills what the model left neutral
        for k in traits:
            if traits[k] == 3 and rt[k] != 3: traits[k], imp[k] = rt[k], ri[k]
        for f in flags: flags[f] = int(flags[f] or rf[f])
        if flags["nosmoke"] and flags["smoke"] and not rf["smoke"]: flags["smoke"] = 0
        # Explicit occupation phrases are more reliable than a weak multiclass guess.
        # Do not publish weak occupation guesses from synthetic-trained text probabilities.
        # Explicit role phrases are required until a real, calibrated occupation dataset exists.
        evidence = rules.occupation_evidence(text)
        rule_jobs = [x["label"] for x in evidence]
        jobs = rule_jobs
        if "Medical student" in jobs: jobs = [j for j in jobs if j != "Student"]
        jobs = list(dict.fromkeys(jobs))[:2]
        return {"traits": traits, "importance": imp, "flags": flags, "profession": jobs[0] if jobs else "", "professions": jobs,
                "occupation_evidence": evidence, "occupation_confidence": evidence[0]["confidence"] if evidence else (0.55 if jobs else 0.0),
                "tags": self.top_tags([{**traits, **flags, "bio": text, "w": imp, "profession": jobs[0] if jobs else ""}])[0], "engine": "ml"}

    def score(self, me, others):
        """Return (matches, tags) per candidate. tags = the 1-2 display tags. match = {s (mutual), you, them, rank, persona, f, km...} or {s: 0, block}."""
        m = norm(me); O = [norm(o) for o in others]
        full = self.tags(O); tm = self.tags([m])[0]; top = self.top_tags(O)
        E = self.emb.transform([m["bio"]] + [o["bio"] for o in O]); ht = [has_text(m["bio"])] + [has_text(o["bio"]) for o in O]
        bs = lambda k: float(E[0] @ E[k + 1]) if ht[0] and ht[k + 1] else float("nan")
        def persona(o):
            p = self.personas.assign(o); return p["name"] if p["show"] else ""
        res = [None] * len(O); live = []
        for i, o in enumerate(O):
            b = block_reason(m, o)
            if b: res[i] = {"s": 0, "block": b, "rank": -99.0, "persona": persona(o)}
            else: live.append(i)
        if live:
            X = pd.DataFrame([pair_row(m, O[i], tm, full[i], bs(i)) for i in live])[FEATURES]
            R = pd.DataFrame([pair_row(O[i], m, full[i], tm, bs(i)) for i in live])[FEATURES]       # the same pair from THEIR point of view
            lp, lq = _logit(self.compat.predict_proba(X)[:, 1]), _logit(self.compat.predict_proba(R)[:, 1])
            base = np.array([baseline_score(m, O[i]) for i in live])
            rk = self.ranker.score(stack_matrix(lp, lq, base, X)) if self.meta["metrics"]["ranking"]["choice"] == "ltr" else (lp + lq) / 2
            gain = {}
            for g, vals in GROUPS.items():                    # counterfactual: how much better if this factor were perfect?
                Xc = X.copy()
                for c, v in vals.items(): Xc[c] = np.where(X[c].isna(), np.nan, v)
                gain[g] = _logit(self.compat.predict_proba(Xc)[:, 1]) - lp
            no_km = X[["area_km", "commute_km", "commute_km_rev"]].isna().all(axis=1).to_numpy()
            sg = lambda z: int(round(100 / (1 + np.exp(-z / TEMP))))
            for k, i in enumerate(live):
                f = sorted(([g, round(float(1 - min(1.0, max(0.0, gain[g][k]) / 3.0)), 3)] for g in GROUPS if not (g == "Commute" and no_km[k])), key=lambda x: -x[1])
                res[i] = {"s": sg((lp[k] + lq[k]) / 2), "you": sg(lp[k]), "them": sg(lq[k]), "rank": round(float(rk[k]), 4), "persona": persona(O[i]), "f": f, "engine": "ml",
                          "area_km": _num(X["area_km"].iat[k]), "commute_km": _num(X["commute_km"].iat[k]), "commute_km_rev": _num(X["commute_km_rev"].iat[k])}
        return res, top

    def similar(self, target, pool, k=6):
        """People like this person: lifestyle and habit similarity, description similarity (LSA), same persona, and 'liked by the same
        users' (collaborative filtering) once enough real usage data exists. Missing signals are left out, not guessed."""
        t = norm(target); P = [norm(p) for p in pool]
        if not P: return []
        E = self.emb.transform([t["bio"]] + [p["bio"] for p in P]); ht = [has_text(t["bio"])] + [has_text(p["bio"]) for p in P]; pt = self.personas.assign(t); out = []
        for n, p in enumerate(P):
            if p["id"] is not None and p["id"] == t["id"]: continue
            life = 1 - sum(abs(t[x] - p[x]) for x in TRAITS) / 16; parts = [(0.45, life), (0.15, float(np.mean([t[f] == p[f] for f in FLAGS])))]; why = []
            if life >= 0.8: why.append("similar lifestyle")
            if ht[0] and ht[n + 1]:
                bio = max(0.0, float(E[0] @ E[n + 1])); parts.append((0.25, bio))
                if bio >= 0.5: why.append("describe themselves alike")
            pp = self.personas.assign(p); same = bool(pt["show"] and pp["show"] and pp["id"] == pt["id"]); parts.append((0.1, float(same)))
            if same: why.append("same persona")
            cf = self.collab.sim(t["id"], p["id"]) if self.collab.ok else None
            if cf is not None:
                parts.append((0.25, max(0.0, cf)))
                if cf >= 0.5: why.append("liked by similar people")
            out.append({"id": p["id"], "score": round(sum(w * v for w, v in parts) / sum(w for w, _ in parts), 3), "why": why})
        return sorted(out, key=lambda r: -r["score"])[:k]


def _num(x):
    return None if x != x else round(float(x), 1)
