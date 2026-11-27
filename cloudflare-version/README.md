# RoomieMatch — Cloudflare conversion (v3.1.0-cf.1)

This is a separate Cloudflare Workers + D1 conversion. It does not modify the original Express/Python project. It incorporates the v3.1 AI Lab source plus the supplied `roomiematch-feedback-fix.zip` backend patch and `roomiematch-fix-only.zip` frontend patch.

## Implemented

- Static vanilla-JS frontend served through Workers Assets.
- D1-backed authentication, profiles, discovery/filtering, compatibility scoring, profile extraction/tags, rent estimates, feedback, saves, blocks and reports.
- D1-backed roommate requests and accepted-connection messaging.
- Durable Object WebSocket hub for message/request notifications, typing and read receipts; HTTP history remains authoritative.
- Places lookup and distance calculations.
- Profile photo validation; new photo data URLs are stored in the user's D1 `data_json` (300 KB limit). Existing `/photos/*` files are served from `public/photos`.
- Basic rule-based moderation and smart-reply suggestions.
- Honest AI status: this Worker does **not** load the Python scikit-learn `.joblib` models, run Python inference, or retrain models. Feedback is retained in D1 for later offline work.

## Deliberate limitations

- SMTP email is not configured. New signups are activated for this demo; email verification and reset-link endpoints explain that they are unavailable. Password recovery needs a separately configured email provider and secure token workflow.
- Admin retraining is intentionally disabled on Workers. Model training should run offline or on a separate compute service.
- This is a demo migration, not a security-reviewed production deployment. It includes D1-backed account/IP rate limits and account lockout, but add edge-level abuse controls, a proper email provider, privacy/data export/deletion, and operational monitoring before public use.
- Durable Objects and D1 have finite free quotas. Stay within Cloudflare's current free allowances; do not enable paid billing unless you explicitly choose to.

## Existing D1 database

`wrangler.jsonc` points to the already-created `roomiematch-db` database ID. The existing 8 users and historical requests/messages/feedback are intended to remain intact. The current D1 snapshot previously checked contained 8 users, 2 requests, 18 messages, 0 reports and 1 feedback record. Authentication supports the migrated PBKDF2-SHA256 hashes and legacy bcrypt hashes. **Do not run a DROP, reset, seed, or destructive migration.** `migrations/0001_schema.sql` is a reference schema for a fresh database only; it is not needed for the existing D1 instance if its tables already exist. The Worker creates the small `auth_limits` table on first authentication use if it is missing.

## Setup

1. Extract this folder to `D:\smart-roommate-finder\cloudflare-version` (or another path). Keep the original project folder unchanged.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Create `.dev.vars` in this folder with a strong `JWT_SECRET`. If continuing the existing local migration, copy the existing `.dev.vars` securely from the previous Cloudflare workspace rather than generating a different secret; never paste it into chat or commit it.
4. Check the D1 binding in `wrangler.jsonc`. It currently targets the existing database ID. Do not replace it with a new database.
5. Validate syntax:
   ```powershell
   npm run check
   ```
6. Start local Worker development:
   ```powershell
   npm run dev
   ```
   The D1 binding is configured with `remote: true`, so local Worker requests use the existing remote D1 database. Be careful: write requests can modify real D1 records. Use demo accounts and avoid destructive operations.
7. Only after the complete manual/API test plan passes, consider deployment. Deployment registers the Durable Object class migration and publishes the Worker. It does not require adding a payment card for the Free plan, but Cloudflare may change its product limits; stop if any billing/upgrade prompt appears.

## Secrets

Set the production Worker secret only after you decide to deploy:

```powershell
npx wrangler secret put JWT_SECRET
```

Paste the same strong secret used by the existing migration if preserving active tokens is required. Never place it in `wrangler.jsonc`, source files, Git, or this archive. Changing it invalidates all existing JWTs (users must log in again).

## API coverage

- `POST /api/auth/login`, `POST /api/auth/signup`, `GET /api/auth/me`
- `POST /api/auth/verify`, `/resend`, `/forgot`, `/reset` (email-dependent routes explicitly return unavailable status)
- `GET /api/people`, `PUT /api/people/me`, `POST /api/people/tags`, `/extract`, `/price`
- `GET /api/people/:id`, `GET /api/people/:id/similar`, `POST /api/people/:id/feedback|save|block|report`
- `GET|POST /api/requests`, `POST /api/requests/:id/respond`
- `GET /api/messages`, `GET /api/messages/unread`, `POST /api/messages/suggest`, `GET|POST /api/messages/:userId`
- `GET /api/places?city=...`, `GET /api/ai/status`, `POST /api/ws/ticket`, WebSocket `/ws`
- Admin retraining returns 501 by design on Workers.

## Notes about the source archives

- `roomiematch-v3.1-ai-lab.zip` supplied the complete v3.1 source baseline and model artifacts (model files are not deployed to Workers).
- `roomiematch-feedback-fix.zip` supplied the updated people route.
- `roomiematch-fix-only.zip` supplied the updated frontend `main.js`.

## GitHub deployment to the existing Worker

The deployment target is the existing `roomiematch-api` Worker at `https://roomiematch-api.wick28743.workers.dev/`. The previous `roomiematch-cloudflare` Worker is retained as a backup and is not targeted by this configuration.

Deployment is deliberately **manual only**. The GitHub Actions workflow does not deploy on pushes. After reviewing and merging this change, add a repository Actions secret named `CLOUDFLARE_API_TOKEN` with Cloudflare account permission to edit Workers Scripts and read D1 metadata. Then open **Actions → Deploy RoomieMatch to Cloudflare → Run workflow** when you explicitly want to deploy. No API token or JWT secret belongs in Git.

The Worker uses the existing D1 database ID configured above; do not create a replacement database or run destructive migrations. Before the first deployment to `roomiematch-api`, configure that Worker’s `JWT_SECRET` secret in Cloudflare using the same value as the currently working migration Worker if existing signed-in sessions must remain valid. Secrets are per-Worker and are not copied automatically. Do not paste secrets into GitHub files or chat. The first deployment also registers the `RoomHub` Durable Object class on the target Worker; it does not alter D1 user/profile/request/message rows.

The workflow runs dependency installation, syntax checks, and smoke tests before it invokes Wrangler. A failed check prevents deployment. If Cloudflare presents a billing or plan-upgrade prompt, stop rather than enabling paid services.
