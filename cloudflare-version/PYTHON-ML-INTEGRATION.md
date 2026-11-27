# RoomieMatch Python ML bridge

The Cloudflare Worker now calls the original Flask/scikit-learn service server-to-server. It keeps the JavaScript rules as a per-request fallback. The original trained `.joblib` models and evaluation reports are included under `python-ai-service/`.

## Deploy the Python service

Deploy `python-ai-service/` as a Docker web service on a host that supports persistent disk/storage. Set these environment variables on that host:

- `AI_SERVICE_TOKEN`: long random secret shared only with the Worker.
- `AI_ADMIN_TOKEN`: separate long random secret used to authorize retraining.
- `PORT`: supplied automatically by most container hosts; otherwise 8000.

The service listens on `0.0.0.0`. Its `/health` and all inference endpoints require `X-Service-Token`. Keep the model directory and `data/` writable and persistent if you intend to retrain; redeploys without persistent storage can lose updated artifacts. Use HTTPS.

## Configure Cloudflare Worker secrets

From `cloudflare-version/`, set secrets interactively (do not commit them):

```powershell
npx wrangler secret put AI_SERVICE_URL
npx wrangler secret put AI_SERVICE_TOKEN
npx wrangler secret put AI_ADMIN_TOKEN
```

For `AI_SERVICE_URL`, enter the HTTPS base URL of the deployed Python service, without a trailing slash. Enter the exact same `AI_SERVICE_TOKEN` value on the Python host and Worker. The existing `.dev.vars` remains local and is not replaced. For local `wrangler dev`, add `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` and `AI_ADMIN_TOKEN` to your existing `.dev.vars` yourself; do not replace the file or share its contents.

## Connected features

- Discover matching: original Python compatibility model, mutual scores, persona and learned tags via `/analyze`.
- Profile description extraction: `/extract`.
- Profile tags: `/tags`.
- Rent estimates: `/rent`.
- Profile-description moderation: `/moderate`.
- AI Lab status and benchmark metrics: `/health`.

If Python is missing, times out, rejects a response, or returns malformed data, the affected operation falls back to JavaScript rules. Responses include `engine: ml` or `engine: rules` where applicable.

## Retraining limitation

The Cloudflare `POST /api/admin/retrain` route exports eligible real-user request decisions, explicit feedback, saved profiles and message interactions from D1, then asks Python to retrain in the background. Demo users (IDs below 100) are excluded from supervised labels. The route requires an email listed in the Worker `ADMIN_EMAILS` variable and the Python `AI_ADMIN_TOKEN` secret configured both on the Python host and as a Worker secret. The service returns HTTP 202 when retraining starts; inspect `/api/ai/status` for `training` and `last_retrain`.

## Security and cost

The Python service is a separate hosted process and may incur hosting charges. Do not expose it without the service token. Do not put secrets in `wrangler.jsonc`, source control, or the ZIP. The D1 database and existing Cloudflare data are not migrated or reset by this integration.
