"""Leakage-free evaluation and written report:   python -m pipeline.evaluate
Writes reports/evaluation.json, reports/ML_REPORT.md and reports/figures/*.png. Everything is measured on test users that never appear
in any training pair (see train.py). Re-run it after changing the data or the models."""
import json, os, time
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier as HGB, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from . import rules, train
from .features import FEATURES
from .ranker import ndcg_at_k  # noqa: F401  (documented dependency of the ranking numbers)
from .schema import TRAITS

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "reports")
GROUPS = {"AI-tag overlap": ["tag_jaccard"], "Description similarity (LSA)": ["bio_sim"], "Commute and distance": ["area_km", "commute_km", "commute_km_rev"],
          "Importance-weighted gaps": [f"{p}_{k}" for p in ("wd", "wo") for k in TRAITS], "Signed gaps (asymmetry)": [f"s_{k}" for k in TRAITS],
          "Property fit": ["same_type", "beds_diff", "furn_match", "stay_diff"], "Budget": ["bud_ratio", "bud_gap"]}


def auc(y, p):
    return float(roc_auc_score(y, p))


def ece(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1); idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1); tot = 0.0; rows = []
    for b in range(bins):
        m = idx == b
        if m.sum(): tot += m.sum() / len(p) * abs(p[m].mean() - y[m].mean()); rows.append((float(p[m].mean()), float(y[m].mean()), int(m.sum())))
    return float(tot), rows


def wild_test():
    from .predict import Predictor
    pred = Predictor(); data = json.load(open(os.path.join(HERE, "tests", "wild_descriptions.json"), encoding="utf-8")); res = {k: [0, 0] for k in ("ML + rules (product)", "ML only", "Rules only")}
    for d in data:
        text = d["text"]; ml_t, _, ml_f, ml_j = pred.extractor.extract(text); rl_t, _, rl_f = rules.extract_rules(text); rl_j = rules.extract_jobs(text); full = pred.extract(text)
        systems = {"ML + rules (product)": (full["traits"], full["flags"], full["profession"]), "ML only": (ml_t, ml_f, ml_j[0] if ml_j else ""), "Rules only": (rl_t, rl_f, rl_j[0] if rl_j else "")}
        for name, (tr, fl, job) in systems.items():
            for k, v in d.items():
                if k == "text": continue
                got = job if k == "profession" else tr[k] if k in tr else fl[k]
                res[name][1] += 1; res[name][0] += int(got == v)
    return {k: {"accuracy": round(a / max(n, 1), 3), "labels": n} for k, (a, n) in res.items()}, len(data)


def run(n_users=1500, n_pairs=60000, seed=7, out=OUT):
    t0 = time.time(); os.makedirs(os.path.join(out, "figures"), exist_ok=True)
    W = train.build_world(n_users, n_pairs, seed); X, y = W.X, W.y; Xtr, ytr, Xte, yte = X.iloc[W.itr], y[W.itr], X.iloc[W.ite], y[W.ite]; R = {}
    R["setup"] = {"users": n_users, "pairs": n_pairs, "train_pairs": int(len(W.itr)), "validation_pairs": int(len(W.iva)), "test_pairs": int(len(W.ite)), "positive_rate": round(float(y.mean()), 3), "seed": seed}

    # ---- model comparison (all on unseen users) ----
    kw0 = dict(l2_regularization=1.0, early_stopping=True, random_state=seed)
    lr = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=2000)).fit(Xtr, ytr)
    rf = RandomForestClassifier(n_estimators=300, min_samples_leaf=5, n_jobs=-1, random_state=seed).fit(Xtr, ytr)
    grid = [dict(max_depth=d, learning_rate=l, max_iter=n) for d in (4, 6, 8) for l, n in ((0.05, 400), (0.1, 200))]
    val = lambda g: auc(y[W.iva], HGB(**{**kw0, **g}).fit(Xtr, ytr).predict_proba(X.iloc[W.iva])[:, 1])
    best = max(grid, key=val); gbm = HGB(**{**kw0, **best}).fit(Xtr, ytr)
    P = {"Rule formula (original)": W.base[W.ite], "Logistic regression": lr.predict_proba(Xte)[:, 1], "Random forest": rf.predict_proba(Xte)[:, 1], "Gradient boosting (tuned)": gbm.predict_proba(Xte)[:, 1]}
    R["models"] = {k: round(auc(yte, v), 4) for k, v in P.items()}; R["best_params"] = best
    rng = np.random.default_rng(seed); deltas = []
    for _ in range(500):
        i = rng.integers(0, len(yte), len(yte))
        if len(set(yte[i])) == 2: deltas.append(auc(yte[i], P["Gradient boosting (tuned)"][i]) - auc(yte[i], P["Rule formula (original)"][i]))
    R["delta_vs_rule_ci95"] = [round(float(np.percentile(deltas, 2.5)), 4), round(float(np.percentile(deltas, 97.5)), 4)]

    # ---- repeated user-disjoint splits (stability) ----
    pi, pj = np.array([p[0] for p in W.pairs]), np.array([p[1] for p in W.pairs]); aucs = []
    for r in range(5):
        fold = np.random.default_rng(seed + 50 + r).integers(0, 5, n_users); te = np.where((fold[pi] == 0) & (fold[pj] == 0))[0]; tr = np.where((fold[pi] != 0) & (fold[pj] != 0))[0]
        aucs.append(auc(y[te], HGB(**{**kw0, **best}).fit(X.iloc[tr], y[tr]).predict_proba(X.iloc[te])[:, 1]))
    R["repeated_user_splits_auc"] = {"mean": round(float(np.mean(aucs)), 4), "std": round(float(np.std(aucs)), 4)}

    # ---- ablations, calibration, learning curve, importance, fairness ----
    R["ablation"] = {}
    for name, cols in GROUPS.items():
        keep = [c for c in FEATURES if c not in cols]; a = auc(yte, HGB(**{**kw0, **best}).fit(Xtr[keep], ytr).predict_proba(Xte[keep])[:, 1]); R["ablation"][name] = {"auc": round(a, 4), "delta": round(a - R["models"]["Gradient boosting (tuned)"], 4)}
    e, rel = ece(yte, P["Gradient boosting (tuned)"]); R["calibration"] = {"ece": round(e, 4), "bins": rel}
    R["learning_curve"] = {}
    for f in (0.1, 0.25, 0.5, 1.0):
        idx = np.random.default_rng(seed).choice(len(ytr), int(len(ytr) * f), replace=False); R["learning_curve"][str(f)] = round(auc(yte, HGB(**{**kw0, **best}).fit(Xtr.iloc[idx], ytr[idx]).predict_proba(Xte)[:, 1]), 4)
    pim = permutation_importance(gbm, Xte, yte, scoring="roc_auc", n_repeats=3, random_state=seed); order = np.argsort(-pim.importances_mean)[:12]
    R["importance"] = [[FEATURES[i], round(float(pim.importances_mean[i]), 4)] for i in order]
    cities = np.array([W.users[W.pairs[k][0]]["city"] for k in W.ite]); roles = np.array([W.users[W.pairs[k][0]]["role"] for k in W.ite]); pg = P["Gradient boosting (tuned)"]; R["fairness"] = {}
    for label, arr in (("city", cities), ("role", roles)):
        for v in sorted(set(arr)):
            m = arr == v
            if m.sum() >= 80 and len(set(yte[m])) == 2: R["fairness"][f"{label}={v}"] = {"n": int(m.sum()), "auc": round(auc(yte[m], pg[m]), 3), "calibration_gap": round(float(pg[m].mean() - yte[m].mean()), 3)}

    # ---- ranking, tags and text models ----
    _, rank = train.rank_experiment(W, gbm); R["ranking"] = rank; R["tags"] = train.tag_metrics(W); R["wild_extraction"], R["wild_n"] = wild_test()
    json.dump(R, open(os.path.join(out, "evaluation.json"), "w"), indent=2); figures(R, P, yte, out); open(os.path.join(out, "ML_REPORT.md"), "w", encoding="utf-8").write(report(R))
    print(f"evaluation finished in {time.time() - t0:.0f}s -> {out}"); return R


def figures(R, P, yte, out):
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    except Exception:
        return
    f = lambda n: os.path.join(out, "figures", n); g = "#0b6e5f"
    plt.figure(figsize=(5, 4))
    for k, v in P.items(): fp, tp, _ = roc_curve(yte, v); plt.plot(fp, tp, label=f"{k} ({R['models'][k]:.3f})")
    plt.plot([0, 1], [0, 1], "k:", lw=1); plt.xlabel("False positive rate"); plt.ylabel("True positive rate"); plt.title("ROC on unseen users"); plt.legend(fontsize=7); plt.tight_layout(); plt.savefig(f("roc.png"), dpi=130); plt.close()
    b = R["calibration"]["bins"]; plt.figure(figsize=(4.5, 4)); plt.plot([0, 1], [0, 1], "k:"); plt.plot([x[0] for x in b], [x[1] for x in b], "o-", color=g); plt.xlabel("Predicted probability"); plt.ylabel("Observed rate")
    plt.title(f"Calibration (ECE {R['calibration']['ece']:.3f})"); plt.tight_layout(); plt.savefig(f("calibration.png"), dpi=130); plt.close()
    plt.figure(figsize=(4.5, 3.5)); plt.plot([float(k) for k in R["learning_curve"]], list(R["learning_curve"].values()), "o-", color=g); plt.xlabel("Share of training pairs"); plt.ylabel("Test AUC"); plt.title("Learning curve"); plt.tight_layout(); plt.savefig(f("learning_curve.png"), dpi=130); plt.close()
    plt.figure(figsize=(6, 4)); n = R["importance"][::-1]; plt.barh([x[0] for x in n], [x[1] for x in n], color=g); plt.xlabel("AUC drop when shuffled"); plt.title("Permutation importance"); plt.tight_layout(); plt.savefig(f("importance.png"), dpi=130); plt.close()
    plt.figure(figsize=(6, 3.5)); a = R["ablation"]; plt.barh(list(a), [v["delta"] for v in a.values()], color="#c2410c"); plt.xlabel("Change in AUC when removed"); plt.title("Ablation"); plt.tight_layout(); plt.savefig(f("ablation.png"), dpi=130); plt.close()
    plt.figure(figsize=(5, 3.5)); nd = R["ranking"]["ndcg5"]; plt.bar(list(nd), list(nd.values()), color=g); plt.ylim(min(nd.values()) - 0.05, 1.0); plt.ylabel("NDCG@5"); plt.title("Ranking quality"); plt.tight_layout(); plt.savefig(f("ranking.png"), dpi=130); plt.close()


def report(R):
    s, m, rk, tg = R["setup"], R["models"], R["ranking"], R["tags"]; weak = ", ".join(k for k, v in R["ablation"].items() if v["delta"] > -0.002) or "none"; best = max(m, key=m.get); table = lambda rows, head: "\n".join(["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(str(c) for c in r) + " |" for r in rows])
    return f"""# RoomieMatch machine learning report

Generated by `python -m pipeline.evaluate` in under a few minutes. All numbers are measured on **test users who appear in no training pair**.

## 1. Problem and data
RoomieMatch ranks potential roommates and explains why. Real interaction data does not exist yet, so the models bootstrap from a **synthetic world**: {s['users']} users drawn from lifestyle archetypes with templated descriptions, and {s['pairs']} labelled pairs whose outcome comes from a hidden, non-linear preference function plus noise ({s['positive_rate']:.0%} positive). The hidden function was written by the project author, so these results show that the pipeline recovers structure that exists in the data. They do **not** show accuracy on real people. The retraining loop (`npm run ai:retrain`) and the validation plan in section 9 address this.

## 2. Evaluation protocol (leakage control)
Users are split 70% / 10% / 20%. The compatibility model trains only on pairs where both users are in the 70% part ({s['train_pairs']} pairs); {s['validation_pairs']} pairs from the 10% part tune hyperparameters; the final {s['test_pairs']} test pairs involve only the 20% of users who were never seen. The tag and description-embedding models used for the evaluation features are fitted on the 80% only. A random pair split (the original protocol, where the same users sit on both sides) is reported by `train.py` as `auc_leaky_split` for comparison; in this synthetic world it barely inflates the score, but on real data, where users repeat and behave consistently, it would.

## 3. Compatibility: models compared
{table([[k, v] for k, v in m.items()], ["Model", "AUC (unseen users)"])}

Best: **{best}**. Improvement over the original hand-written formula: bootstrap 95% interval for the AUC difference is {R['delta_vs_rule_ci95'][0]} to {R['delta_vs_rule_ci95'][1]}. Five repeated user-disjoint splits give AUC {R['repeated_user_splits_auc']['mean']} ± {R['repeated_user_splits_auc']['std']}. Tuned parameters: `{R['best_params']}`.

![ROC](figures/roc.png)

## 4. Ablation: what each feature group contributes
{table([[k, v['auc'], v['delta']] for k, v in R['ablation'].items()], ["Removed group", "AUC", "Change"])}

Groups whose removal changes AUC by less than 0.002, or improves it, are not earning their place here: {weak}. That is a finding, not a bug: either the hidden preference function does not use them much, or other features already carry the same information.

![Ablation](figures/ablation.png)

## 5. Calibration and data efficiency
Expected calibration error: **{R['calibration']['ece']}**. The product shows a softened score (probability passed through a temperature), so users see 0 to 100 values without extreme 0 and 99. The learning curve shows how much data the model needs:

{table([[k, v] for k, v in R['learning_curve'].items()], ["Share of training pairs", "AUC"])}

![Calibration](figures/calibration.png) ![Learning curve](figures/learning_curve.png)

## 6. What the model relies on (permutation importance)
{table(R['importance'], ["Feature", "AUC drop when shuffled"])}

![Importance](figures/importance.png)

## 7. Fairness slices
Slices by the city and the role of the person being served (groups with at least 80 test pairs). Large AUC or calibration gaps would signal that the model serves some groups worse.

{table([[k, v['n'], v['auc'], v['calibration_gap']] for k, v in R['fairness'].items()], ["Slice", "Pairs", "AUC", "Mean predicted minus observed"])}

## 8. Ranking, tags and text models
**Ranking.** The product orders people, so the main metric is NDCG@5 over candidate lists ({rk['test_users']} test users, {rk['list_size']} candidates each, relevance = the true probability that both people would say yes). Rule formula {rk['ndcg5']['rule']}; one-way model {rk['ndcg5']['forward']}; two-way (mutual) score {rk['ndcg5']['mutual']}; learning-to-rank re-ranker {rk['ndcg5']['ltr']}. In this run the re-ranker would be **{'chosen' if rk['choice'] == 'ltr' else 'not chosen'}**; the product makes the same decision at training time and records it in `models/meta.json`. One-way scores ignore the other person's view, so they lose to the two-way scores when a match needs both sides to agree.

![Ranking](figures/ranking.png)

**Tags (1 to 2 per profile).** Candidates are ranked by probability times informativeness. Precision is measured against the synthetic ground truth, so it is optimistic. With a description: precision {tg['top_precision']}, {tg['avg_tags_shown']} tags shown on average, coverage {tg['top_coverage']}. Without a description only a structured-answers model may add one confident tag: precision {tg['nodesc_precision']}, coverage {tg['nodesc_coverage']} (the rest are left untagged on purpose).

**Description reader on unseen wording.** The reader trains on templated sentences, so its near-perfect template score is optimistic. As an honest check, {R['wild_n']} freely written descriptions (`tests/wild_descriptions.json`, not used for training) give:

{table([[k, v['accuracy'], v['labels']] for k, v in R['wild_extraction'].items()], ["System", "Accuracy", "Labels checked"])}

## 9. Limitations and next steps
- **Synthetic labels.** Replace them with real outcomes: the in-app accept/decline loop, a short survey where classmates rate hypothetical roommate pairs, and a public pairing dataset such as the Speed Dating Experiment (8,378 dates with mutual decisions) to validate the two-way modelling idea, remembering that it is romantic rather than roommate matching.
- **Templated text.** Section 8 shows the gap on freely written descriptions; collect real descriptions and label a few hundred.
- **Commute coordinates** in `shared/places.json` are approximate demo values.
- The hidden preference function favours the features it was built from, so ablations on real data may look different.
"""


if __name__ == "__main__":
    run()
