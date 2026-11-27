"""Flask inference service.  Run:  python app.py   (default http://127.0.0.1:8000)"""
import json, os, threading
import sklearn
from flask import Flask, jsonify, request
from pipeline import train
from pipeline.predict import Predictor


def create_app(pred=None):
    app = Flask(__name__)
    pred = pred or Predictor()
    state = {"training": False, "last": None}

    def body():
        d = request.get_json(silent=True)
        if not isinstance(d, dict): raise ValueError("JSON object expected")
        return d

    @app.errorhandler(ValueError)
    def bad(e): return jsonify(error=str(e)), 400

    @app.get("/health")
    def health():
        return jsonify(ok=True, engine="python", label=pred.label, model=pred.meta["model"], version=pred.meta["version"],
                       trained_at=pred.meta["trained_at"], training=state["training"], last_retrain=state["last"], metrics=pred.meta["metrics"], n_real=pred.meta.get("n_real", 0), n_profiles=pred.meta.get("n_profiles", 0), n_pairs=pred.meta.get("n_pairs", 0), n_events=pred.meta.get("n_events", 0), collab_active=pred.meta.get("collab_active", False), sklearn=sklearn.__version__)

    @app.post("/analyze")
    def analyze():
        d = body(); me, cands = d.get("me"), d.get("candidates")
        if not isinstance(me, dict) or not isinstance(cands, list) or len(cands) > 500: raise ValueError("me (object) and candidates (list, max 500) required")
        cands = [c for c in cands if isinstance(c, dict)]
        matches, tags = pred.score(me, cands)
        return jsonify(results=[{"id": c.get("id"), "tags": t, "match": m, "persona": m.get("persona", "")} for c, t, m in zip(cands, tags, matches)])

    @app.post("/extract")
    def extract():
        bio = body().get("bio")
        if not isinstance(bio, str): raise ValueError("bio (string) required")
        return jsonify(pred.extract(bio))

    @app.post("/similar")
    def similar():
        d = body(); target, pool = d.get("target"), d.get("pool")
        if not isinstance(target, dict) or not isinstance(pool, list) or len(pool) > 500: raise ValueError("target (object) and pool (list, max 500) required")
        return jsonify(results=pred.similar(target, [p for p in pool if isinstance(p, dict)], int(d.get("k") or 6)))

    @app.post("/moderate")
    def moderate():
        text = body().get("text")
        if not isinstance(text, str): raise ValueError("text (string) required")
        return jsonify(pred.moderate(text))

    @app.post("/rent")
    def rent():
        d = body()
        return jsonify(pred.rent(d.get("city"), d.get("type"), d.get("beds"), d.get("furn"), d.get("area")))

    @app.post("/suggest")
    def suggest():
        d = body(); text = d.get("text")
        if not isinstance(text, str): raise ValueError("text (string) required")
        return jsonify(pred.suggest(text, d.get("me") if isinstance(d.get("me"), dict) else {}))

    @app.post("/retrain")
    def retrain():
        tok = os.environ.get("AI_ADMIN_TOKEN")
        if not tok or request.headers.get("X-Admin-Token") != tok: return jsonify(error="forbidden"), 403
        if state["training"]: return jsonify(error="training already running"), 409
        d = body(); rows, events = d.get("interactions"), d.get("events") or []
        if not isinstance(rows, list) or not isinstance(events, list): raise ValueError("interactions (list) and events (list) required")
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "interactions.json")
        os.makedirs(os.path.dirname(path), exist_ok=True); json.dump(rows, open(path, "w", encoding="utf-8"))
        epath = os.path.join(os.path.dirname(path), "events.json"); json.dump([e for e in events if isinstance(e, dict) and "user" in e and "item" in e], open(epath, "w", encoding="utf-8"))

        def job():
            try:
                meta = train.run(pred.dir, real=path, events=epath, quiet=True, **pred.train_kw); pred.reload()
                state["last"] = {"ok": True, "version": meta["version"], "n_real": meta["n_real"]}
            except Exception as e:
                state["last"] = {"ok": False, "error": str(e)}
            finally:
                state["training"] = False
        state["training"] = True; threading.Thread(target=job, daemon=True).start()
        return jsonify(started=True, rows=len(rows)), 202

    @app.post("/tags")
    def tags():
        users = body().get("users")
        if not isinstance(users, list) or len(users) > 500: raise ValueError("users (list, max 500) required")
        users = [u for u in users if isinstance(u, dict)]
        return jsonify(tags=pred.top_tags(users), all=pred.tags(users))

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("AI_PORT", 8000)))
