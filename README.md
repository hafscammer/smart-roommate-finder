# RoomieMatch: Smart Roommate Finder

A machine-learning roommate matching platform. Express API (JWT auth, WebSocket chat, MongoDB-ready), a **Python ML service** with seven models, and a responsive client.

## Run
```
# 1. AI service (first start trains all models, about 20 seconds)
pip install -r ai-service/requirements.txt
python ai-service/app.py                 # python3 on macOS/Linux, http://127.0.0.1:8000

# 2. Web app
npm install
npm start                                # http://localhost:3000
```
Demo login: `ayesha@demo.test` / `Demo1234!` (also hamza, sara, bilal... @demo.test). Without the Python service the app still works and falls back to rule-based scoring; the sidebar shows which engine is active.

Optional services (all off by default, see `.env.example`):
- **MongoDB**: `docker compose up -d mongo`, then `MONGO_URL=mongodb://127.0.0.1:27017 npm start`.
- **E-mail**: `SMTP_URL=smtp://user:pass@host:587` (uses `nodemailer`). Without it, verification and reset links are printed in the terminal and shown in the UI in dev mode.
- **Photo storage**: `S3_BUCKET=my-bucket S3_REGION=eu-west-1` (uses `@aws-sdk/client-s3`). Default is local disk.
- **Automatic retraining**: set the same `AI_ADMIN_TOKEN` for both processes and `AI_RETRAIN_HOURS=24`.

## Where machine learning is used
| Feature | Model | Where you see it |
|---|---|---|
| Compatibility | Gradient boosting on 37 pair features (trait gaps, importance, budget, property, **commute distance**, description similarity, tag overlap), scored in **both directions** | Match ring, "They fit you X% / you fit them Y%" |
| Ordering | Pointwise two-way score, with a pairwise **learning-to-rank** re-ranker used only if it beats it on held-out users | Order of the Discover list |
| Explanations | Counterfactual analysis of the model (what if this factor were perfect?) | Compare lifestyle tiles |
| Description reader | Word + character TF-IDF logistic-regression models, sentence-level trait inference, plus a high-precision occupation/entity recognizer with evidence spans and phrase-match strength | Wizard "What the AI understood": lifestyle, must-haves, habits, dealbreakers, occupations and the exact phrase that triggered an occupation |
| Tags (1 to 2 per profile) | Multi-label model ranked by probability x informativeness, boosted for must-haves. No description: one tag from a structured-answers model if confident, otherwise no tag | Tag chips |
| Description embeddings | TF-IDF + truncated SVD (LSA), 32 dimensions | "People like them", similarity feature |
| Personas | k-means clustering of lifestyle and habits, clusters named automatically | "Roommate persona" on profiles |
| Collaborative filtering | Item-to-item SVD on saves, requests, accepts and messages; switches on once enough real events exist | "Liked by similar people" in "People like them" |
| Safety | Classifier for toxic, scam and contact-detail messages and bios | Blocked or warned messages, rejected bios |
| Price check | Quantile gradient boosting (15/50/85%) | Wizard and profile "AI price check" |
| Reply intent model | Intent classifier + profile-aware response templates | API capability retained; chat UI auto-suggestions are disabled |
| Active learning | Explicit Good fit / Not for me labels plus real accept/decline outcomes retrain compatibility; one current label per user/candidate | Discover cards, `npm run ai:retrain`, `POST /api/admin/retrain` |
| Model observability | Live model version, training set counts, AUC, NDCG@5, tag F1, extraction score and synthetic-vs-real data warning | AI Lab in the main navigation |

### Evaluation (no data leakage)
Users are split 70/10/20 and every number comes from test users who appear in no training pair. `npm run ai:eval` regenerates `ai-service/reports/ML_REPORT.md` with figures: models compared (rule formula, logistic regression, random forest, tuned gradient boosting), bootstrap confidence interval, repeated user-disjoint splits, ablations, calibration, learning curve, permutation importance, fairness slices by city and role, ranking quality (NDCG@5), tag quality and a test of the description reader on freely written text.

### Honest numbers
Until real users exist the models bootstrap from synthetic data (archetype profiles, templated text, a hidden non-linear preference function with noise), so the results show the pipeline recovers structure that exists in the data, not accuracy on real people. On unseen synthetic users: compatibility AUC 0.946 versus 0.889 for the original formula; ranking NDCG@5 0.99 versus 0.85. The description reader scores near 1.0 on templated sentences but only 0.51 (ML alone), 0.77 (keyword rules alone) and 0.89 (both together, as shipped) on freely written descriptions. Commute coordinates in `shared/places.json` are approximate demo values. Replace synthetic data with real data as it arrives: that is what the retraining loop is for.

## Accounts and security
bcrypt passwords, JWT sessions (a password change invalidates old tokens), lockout after 5 failed logins, rate limits on login, sign-up, resend and reset, e-mail verification (unverified users can browse but not send requests or messages), password reset by single-use hashed tokens with expiry, no account enumeration on "forgot password", validated photo uploads, security headers.

## Interface upgrades
- Persistent light/night mode toggle in the sidebar (also available on the sign-in screen).
- AI Lab dashboard surfaces model health, evaluation metrics, training data counts and the limits of synthetic-only evaluation.
- Discover cards collect explicit preference feedback for the next supervised training run.
- Scrollbars are visually hidden while scrolling remains enabled for mouse, touch and keyboard.
- Chat header reports live transport/reconnecting state as text under the contact name; no online/offline action button.
- Automatic message replies and generated reply chips are disabled in the chat UI. Users compose and send every message themselves. The reply-intent model endpoint remains available for a future explicit opt-in feature.
- Occupation extraction now recognizes a broader set of roles and shows the matched text span plus a phrase-match strength score (not a calibrated probability). This is an explainable lexicon-assisted ML design, not a claim that synthetic training data guarantees real-world accuracy.

## Live chat
A dependency-free WebSocket server (`server/services/realtime.js`) pushes messages, typing indicators, read receipts ("Seen") and request updates. Clients get a one-time ticket from `POST /api/ws/ticket`. The client falls back to polling only while the socket is down. There is deliberately no online-status dot on avatars. The chat header shows the current connection transport state as small text; it is not a claim about whether the other person is online. Demo accounts do not auto-reply: all replies must be sent by a person.

## Structure
```
ai-service/                 Python ML service (Flask)
  app.py                    /health /analyze /tags /extract /moderate /rent /suggest /retrain
  pipeline/                 schema, places, features, synth, tagmodel, extract, rules, embed, personas, collab, ranker, moderation, rent, replies, train, predict, evaluate
  tests/                    23 unit tests (npm run ai:test) and wild_descriptions.json (free-text check)
  reports/                  ML_REPORT.md, evaluation.json and figures (npm run ai:eval)
shared/places.json          areas, campuses and workplaces used by both services
server/                     Express API
  db.js, store/mongo.js     JSON file or MongoDB persistence
  routes/                   auth, people, requests, messages, admin
  services/                 ai (ML client + fallbacks), realtime, mailer, photos, places, retrain, limiter
  tests/smoke.js            14 route tests with lightweight stand-ins (npm test)
client/                     index.html, css/styles.css, js/ (main, components, api, ws, crop)
```

## Tests
`npm run ai:test` discovers and runs both the ML pipeline tests and occupation-extraction regression tests. `npm test` runs the server smoke test; start the Python service first to exercise the ML paths, or leave it off to test the fallbacks. The smoke test uses stand-ins for express, bcrypt, jsonwebtoken, MongoDB and S3, so it does not prove those libraries behave identically; it does cover the application logic, the WebSocket server and the MongoDB write-behind adapter.

## Known limits
- The MongoDB adapter keeps the working set in memory and writes changes back (single server instance). Fine for a course project; move to per-query access for scale.
- Chat history, reports and moderation queues have no admin UI yet.
- The browser UI was not run in an automated browser test here.
- Real SMTP, a live MongoDB server and live S3 were not available while building, so those paths are covered only by stand-ins.

## Troubleshooting
- Sidebar says "Rule-based fallback": the Python service is not running on port 8000 (`AI_URL` / `AI_PORT`).
- "The RoomieMatch server did not answer": run `npm install`, `npm start`, open http://localhost:3000.
- Port 3000 in use: `PORT=3001 npm start` (PowerShell: `$env:PORT=3001; npm start`).
- Reset demo data: stop the server and delete `server/data/db.json`.

## Spiral model
1 prototype, 2 backend and auth, 3 profile builder and chat, 4 Python ML pipeline, 5 production hardening (verification and reset, MongoDB, WebSockets, S3), 6 ML everywhere (two-way scores, commute, safety, price, reply-intent model, retraining loop), 7 explainable occupation extraction, active preference learning and AI Lab observability.


## Active learning: teach RoomieMatch what a good match means

Every discovery card now has **Good fit** and **Not for me** feedback controls. These are explicit preference labels tied to the signed-in user and candidate; changing a choice updates the existing label rather than duplicating it. Feedback from real accounts (IDs 100+) is exported alongside genuine request accept/decline outcomes and included in the next supervised model-training run. Demo accounts are deliberately excluded so synthetic/demo behaviour cannot contaminate real-user labels. Feedback collection does not silently retrain on every click: use the admin retraining workflow or `npm run ai:retrain` after collecting enough labels. The retrained artifacts are then loaded by the inference service.

## ML pipeline at a glance

- **Text understanding:** sentence-level TF-IDF word + character features predict lifestyle traits, importance, habits and profession classes. Occupation display is conservative: an explicit self-role/degree phrase must be found; mentions about relatives, negations and aspirations are filtered, and the UI exposes the matched evidence instead of filling an unsupported guess. The phrase-match strength is an evidence indicator, not a calibrated probability.
- **Mutual compatibility:** a HistGradientBoosting model estimates both directional preferences; a learned ranker is selected only if it beats mutual scoring on held-out candidate lists.
- **Explainability:** counterfactual feature-group changes estimate which factors are holding a match back.
- **Unsupervised personas:** K-means groups lifestyle profiles and only displays a persona when cluster assignment is sufficiently distinct.
- **Collaborative signals:** saved profiles, requests, accepted connections and conversations provide implicit signals once enough real activity exists.
- **Active learning:** user-provided positive/negative profile feedback becomes supervised labels at the next training run.
- **Evaluation:** user-disjoint train/validation/test splits, calibration, ablation, fairness slices, ranking metrics and free-text stress tests are generated by `npm run ai:eval`.

Important: the bootstrap model is trained on synthetic profiles and labels. Its reported metrics are synthetic-benchmark results, not proof of real-world accuracy. Real preference feedback and external validation are needed before making strong claims about recommendation quality.
