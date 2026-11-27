"""Training pipeline:  generate/load data -> user-disjoint split -> features -> fit models -> evaluate -> save.

    python -m pipeline.train                                  # synthetic bootstrap
    python -m pipeline.train --real data/interactions.json    # blend in real accept/decline outcomes

Evaluation protocol (no leakage): users are split 70/10/20. The compatibility model is fitted on pairs whose two users are both in
the 70% part; the re-ranker is fitted on candidate lists of the 10% part; every reported number comes from the 20% test users,
who never appear in any training pair. Tag and embedding models used for the evaluation features are fitted on the 80% only.
"""
import argparse, datetime, json, os, time
import joblib, numpy as np, pandas as pd, sklearn
from sklearn.ensemble import HistGradientBoostingClassifier as HGB
from sklearn.metrics import accuracy_score, brier_score_loss, f1_score, roc_auc_score
from . import extract as extractmod, moderation, rent as rentmod, replies, synth, tagmodel
from .collab import Collab
from .embed import BioEmbedder, has_text
from .features import FEATURES, NUMT, baseline_score, pair_row, tag_frame
from .personas import Personas
from .ranker import Ranker, logit, ndcg_at_k, stack_matrix
from .schema import block_reason, norm

MODELS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
KW = dict(max_depth=6, learning_rate=0.08, max_iter=300, l2_regularization=1.0, early_stopping=True)


class World:
    """Synthetic users and labelled pairs, user-disjoint partitions and the evaluation-stage features."""


def fit_engine(us):
    F = tag_frame(us); Y = tagmodel.multihot([u["_tags"] for u in us])
    return tagmodel.TagEngine(tagmodel.build().fit(F, Y), tagmodel.build_struct().fit(F[NUMT], Y), Y.mean(axis=0))


def fit_embedder(us, seed):
    return BioEmbedder().fit([u["bio"] for u in us] + synth.make_extraction(3000, seed + 9)[0])


def make_bs(users, E):
    ht = np.array([has_text(u["bio"]) for u in users])
    return lambda i, j: float(E[i] @ E[j]) if ht[i] and ht[j] else float("nan")


def pair_frame(users, pairs, tags, bs):
    return pd.DataFrame([pair_row(users[i], users[j], tags[i], tags[j], bs(i, j)) for i, j in pairs])[FEATURES]


def build_world(n_users=1500, n_pairs=60000, seed=7):
    W = World(); W.seed = seed
    W.users, W.pairs, W.y, W.ds = synth.make_dataset(n_users, n_pairs, seed, with_meta=True)
    rng = np.random.default_rng(seed + 100); perm = rng.permutation(n_users); a, b = int(0.7 * n_users), int(0.8 * n_users)
    W.part = np.empty(n_users, dtype=int); W.part[perm[:a]], W.part[perm[a:b]], W.part[perm[b:]] = 0, 1, 2
    fit_users = [W.users[i] for i in range(n_users) if W.part[i] < 2]                      # test users are invisible to every evaluation-stage model
    W.engine = fit_engine(fit_users); W.tags = W.engine.all(W.users)
    W.emb = fit_embedder(fit_users, seed); W.E = W.emb.transform([u["bio"] for u in W.users]); W.bs = make_bs(W.users, W.E)
    W.X = pair_frame(W.users, W.pairs, W.tags, W.bs); W.base = np.array([baseline_score(W.users[i], W.users[j]) for i, j in W.pairs])
    pi, pj = np.array([p[0] for p in W.pairs]), np.array([p[1] for p in W.pairs])
    both = lambda k: np.where((W.part[pi] == k) & (W.part[pj] == k))[0]
    W.itr, W.iva, W.ite = both(0), both(1), both(2)
    return W


def load_real(path, engine, emb):
    """Rows exported by server/scripts/export-interactions.js: {me, other, label}; `me` is the person who decided."""
    X, y = [], []
    for d in json.load(open(path, encoding="utf-8")):
        me, o = norm(d["me"]), norm(d["other"]); tm, to = engine.all([me, o]); E = emb.transform([me["bio"], o["bio"]])
        X.append(pair_row(me, o, tm, to, float(E[0] @ E[1]) if has_text(me["bio"]) and has_text(o["bio"]) else float("nan"))); y.append(int(d["label"]))
    return (pd.DataFrame(X)[FEATURES], np.array(y)) if X else (None, np.array([]))


# ---------------- ranking experiment: candidate lists; relevance = probability that BOTH people would say yes (what a match means in the product) ----------------
def make_lists(W, ids, m=30, seed=0):
    rng = np.random.default_rng(seed); ids = list(ids); by_city = {}
    for i in ids: by_city.setdefault(W.users[i]["city"], []).append(i)
    out = []
    for u in ids:
        same = [c for c in by_city[W.users[u]["city"]] if c != u]; other = [c for c in ids if W.users[c]["city"] != W.users[u]["city"]]
        k1 = min(len(same), int(m * 0.7)); cands = [int(c) for c in rng.choice(same, k1, replace=False)] if k1 else []
        k2 = min(len(other), m - len(cands)); cands += [int(c) for c in rng.choice(other, k2, replace=False)] if k2 else []
        cands = [c for c in cands if not block_reason(W.users[u], W.users[c])]
        if len(cands) < 5: continue
        p = np.array([synth.p_true(W.users[u], W.users[c], W.ds["b"]) * synth.p_true(W.users[c], W.users[u], W.ds["b"]) for c in cands])
        out.append((u, np.array(cands), p, (rng.random(len(p)) < p).astype(int)))
    return out


def list_scores(W, gbm, lst):
    res = []
    for u, cands, p, y in lst:
        Xf = pair_frame(W.users, [(u, c) for c in cands], W.tags, W.bs); Xr = pair_frame(W.users, [(c, u) for c in cands], W.tags, W.bs)
        lp, lq = logit(gbm.predict_proba(Xf)[:, 1]), logit(gbm.predict_proba(Xr)[:, 1]); base = np.array([baseline_score(W.users[u], W.users[c]) for c in cands])
        res.append({"lp": lp, "lq": lq, "base": base, "F": stack_matrix(lp, lq, base, Xf)})
    return res


def rank_experiment(W, gbm):
    ids = lambda k: [i for i in range(len(W.users)) if W.part[i] == k]
    L1, L2 = make_lists(W, ids(1), seed=W.seed + 1), make_lists(W, ids(2), seed=W.seed + 2)
    S1 = list_scores(W, gbm, L1); ranker = Ranker().fit([(s["F"], l[3]) for s, l in zip(S1, L1)])        # learned on part-1 users only
    nd = {k: [] for k in ("rule", "forward", "mutual", "ltr")}
    for s, l in zip(list_scores(W, gbm, L2), L2):                                                       # scored on part-2 users only
        for k, sc in (("rule", s["base"]), ("forward", s["lp"]), ("mutual", (s["lp"] + s["lq"]) / 2), ("ltr", ranker.score(s["F"]))): nd[k].append(ndcg_at_k(l[2], sc))
    ndcg = {k: round(float(np.mean(v)), 4) for k, v in nd.items()}
    return ranker, {"ndcg5": ndcg, "choice": "ltr" if ndcg["ltr"] >= ndcg["mutual"] + 0.003 else "mutual", "test_users": len(L2), "list_size": 30}


def tag_metrics(W):
    te = [W.users[i] for i in range(len(W.users)) if W.part[i] == 2]
    Y = tagmodel.multihot([u["_tags"] for u in te]); P = (W.engine.text.predict_proba(tag_frame(te)) >= 0.5).astype(int)
    out = {"micro_f1": round(float(f1_score(Y, P, average="micro")), 4), "macro_f1": round(float(f1_score(Y, P, average="macro", zero_division=0)), 4)}
    def prec(top, truth):
        shown = sum(len(t) for t in top); hit = sum(len([x for x in t if x in tr]) for t, tr in zip(top, truth))
        return round(hit / max(shown, 1), 3), round(float(np.mean([len(t) > 0 for t in top])), 3), round(shown / len(top), 2)
    out["top_precision"], out["top_coverage"], out["avg_tags_shown"] = prec(W.engine.top(te, 2), [set(u["_tags"]) for u in te])
    out["nodesc_precision"], out["nodesc_coverage"], _ = prec(W.engine.top([{**u, "bio": ""} for u in te], 2), [set(synth.true_tags(u)) for u in te])   # structural truth only
    return out


def run(models_dir=MODELS, n_users=1500, n_pairs=60000, seed=7, real=None, events=None, quiet=False):
    log = (lambda *a: None) if quiet else print
    t0 = time.time(); os.makedirs(models_dir, exist_ok=True)
    log(f"[1/5] generating {n_users} profiles and {n_pairs} labelled pairs, splitting users 70/10/20")
    W = build_world(n_users, n_pairs, seed); users, pairs, y = W.users, W.pairs, W.y

    log("[2/5] fitting text models: description reader, safety, rent price check, reply intents")
    xt, Yx = synth.make_extraction(4000, seed + 1); cut = int(len(xt) * 0.8)
    pr = extractmod.Extractor().fit(xt[:cut], {k: v[:cut] for k, v in Yx.items()}).predict_all(xt[cut:])
    acc = lambda ks: round(float(np.mean([(pr[k] == Yx[k][cut:]).mean() for k in ks])), 4)
    ex_metrics = {"level_acc": acc(["sleep", "clean", "guests", "noise"]), "importance_acc": acc(["w_sleep", "w_clean", "w_guests", "w_noise"]),
                  "flag_f1": round(float(np.mean([f1_score(Yx[k][cut:], pr[k]) for k in extractmod.FLAG_KEYS])), 4), "profession_acc": acc(["profession"])}
    ex = extractmod.Extractor().fit(xt, Yx)
    mt, my = moderation.make_moderation(4000, seed + 2); c2 = int(len(mt) * 0.8)
    mod_acc = float((moderation.Moderator().fit(mt[:c2], my[:c2]).predict_all(mt[c2:]) == my[c2:]).mean()); mod = moderation.Moderator().fit(mt, my)
    rdf = rentmod.make_rent(6000, seed + 3); r2 = int(len(rdf) * 0.8)
    rent_metrics = rentmod.RentModel().fit(rdf.iloc[:r2]).evaluate(rdf.iloc[r2:]); rent = rentmod.RentModel().fit(rdf)
    it, iy = replies.make_intents(3000, seed + 4); c3 = int(len(it) * 0.8)
    intent_acc = float((replies.IntentModel().fit(it[:c3], iy[:c3]).predict_all(it[c3:]) == iy[c3:]).mean()); intent = replies.IntentModel().fit(it, iy)

    log("[3/5] compatibility model on user-disjoint pairs, plus the leaky split for comparison, plus ranking experiment")
    kw = dict(KW, random_state=seed)
    gbm_a = HGB(**kw).fit(W.X.iloc[W.itr], y[W.itr]); p = gbm_a.predict_proba(W.X.iloc[W.ite])[:, 1]; yt = y[W.ite]
    rs = np.random.default_rng(seed).permutation(len(y)); cutp = int(0.8 * len(rs))                    # the old protocol: random pairs, users shared between train and test
    leaky = roc_auc_score(y[rs[cutp:]], HGB(**kw).fit(W.X.iloc[rs[:cutp]], y[rs[:cutp]]).predict_proba(W.X.iloc[rs[cutp:]])[:, 1])
    metrics = {"auc": round(float(roc_auc_score(yt, p)), 4), "accuracy": round(float(accuracy_score(yt, p >= 0.5)), 4), "brier": round(float(brier_score_loss(yt, p)), 4),
               "baseline_auc": round(float(roc_auc_score(yt, W.base[W.ite])), 4), "auc_leaky_split": round(float(leaky), 4), "positive_rate": round(float(y.mean()), 3),
               "train_pairs": int(len(W.itr)), "test_pairs": int(len(W.ite)), "split": "user-disjoint (70/10/20)"}
    ranker, rank_metrics = rank_experiment(W, gbm_a); tag_m = tag_metrics(W)

    log("[4/5] final fit on all users and pairs, personas, collaborative filtering")
    engine = fit_engine(users); emb = fit_embedder(users, seed); E = emb.transform([u["bio"] for u in users]); tags = engine.all(users)
    X = pair_frame(users, pairs, tags, make_bs(users, E))
    Xr, yr = load_real(real, engine, emb) if real and os.path.exists(real) else (None, np.array([])); n_real = len(yr)
    if n_real:
        log(f"      blending {n_real} real interactions (5x weight)")
        clf = HGB(**kw).fit(pd.concat([X, Xr]), np.concatenate([y, yr]), sample_weight=np.concatenate([np.ones(len(y)), np.full(n_real, 5.0)]))
    else:
        clf = HGB(**kw).fit(X, y)
    personas = Personas().fit(users)
    ev = json.load(open(events)) if events and os.path.exists(events) else []; collab = Collab().fit(ev)

    log("[5/5] saving artifacts")
    now = datetime.datetime.now(datetime.timezone.utc)
    meta = {"version": now.strftime("%Y%m%d%H%M%S"), "trained_at": now.isoformat(), "model": "HistGradientBoosting", "sklearn": sklearn.__version__, "features": FEATURES,
            "n_profiles": n_users, "n_pairs": n_pairs, "n_real": n_real, "n_events": len(ev), "collab_active": collab.ok, "seed": seed,
            "personas": personas.names, "metrics": {"compat": metrics, "ranking": rank_metrics, "tags": tag_m, "extract": ex_metrics, "moderation": {"accuracy": round(mod_acc, 4)},
                                                    "rent": rent_metrics, "replies": {"accuracy": round(intent_acc, 4)}}}
    for name, obj in (("compat", clf), ("tags", engine), ("extract", ex), ("moderation", mod), ("rent", rent), ("replies", intent), ("embed", emb), ("personas", personas), ("ranker", ranker), ("collab", collab)):
        joblib.dump(obj, os.path.join(models_dir, name + ".joblib"))
    json.dump(meta, open(os.path.join(models_dir, "meta.json"), "w"), indent=2)
    nd = rank_metrics["ndcg5"]
    log(f"done in {time.time() - t0:.1f}s | AUC {metrics['auc']} on unseen users (leaky split said {metrics['auc_leaky_split']}, rule baseline {metrics['baseline_auc']}) | NDCG@5 rule {nd['rule']} mutual {nd['mutual']} ltr {nd['ltr']} -> {rank_metrics['choice']}"
        f" | tags {tag_m['top_precision']} precision, {tag_m['avg_tags_shown']} shown | extractor {ex_metrics['level_acc']} | safety {mod_acc:.3f} | rent MAPE {rent_metrics['mape']} | replies {intent_acc:.3f}")
    return meta


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=1500); ap.add_argument("--pairs", type=int, default=60000); ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--real", default=None); ap.add_argument("--events", default=None)
    a = ap.parse_args(); run(n_users=a.users, n_pairs=a.pairs, seed=a.seed, real=a.real, events=a.events)
