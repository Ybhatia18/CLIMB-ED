# BetaVision API

FastAPI backend: email/password + Google auth, and the personalization
profile fields from the spec (§3.4 — height, ape index, weight, dominant
hand, current grade, injuries/weaknesses). PostgreSQL via SQLAlchemy +
Alembic. The CV/ML pipeline (hold detection, difficulty model, beta
optimizer) isn't built yet — this is accounts only.

## Local development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then fill in JWT_SECRET, GOOGLE_CLIENT_ID

docker compose up -d   # starts local Postgres on :5432
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

Without Docker, `DATABASE_URL` can point at SQLite instead
(`sqlite:///./betavision.db`) for quick local testing — just don't use that
in production.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Email + password signup |
| POST | `/auth/login` | — | Email + password login |
| POST | `/auth/google` | — | Exchange a Google ID token for a session |
| GET | `/auth/me` | Bearer | Current user |
| GET | `/users/me` | Bearer | Current user's profile |
| PATCH | `/users/me` | Bearer | Update personalization fields |
| GET | `/health` | — | Liveness check |

Auth is a JWT bearer token returned from signup/login/google, expiring after
`JWT_EXPIRE_MINUTES`. This API does not set cookies itself — the Next.js
frontend's `/api/auth/*` routes proxy to this service and hold the session
in a first-party httpOnly cookie, which avoids cross-origin cookie issues
between the Vercel frontend and this backend's own domain.

## Database migrations

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Deploying (Railway / Fly.io)

1. Provision a PostgreSQL instance (Railway's Postgres plugin, or `fly
   postgres create`) and set `DATABASE_URL` on the service to its
   `postgresql+psycopg://...` connection string.
2. Set `JWT_SECRET` (long random value), `GOOGLE_CLIENT_ID`, and
   `FRONTEND_ORIGINS` (your Vercel deployment URL(s), comma-separated) as
   env vars.
3. The included `Procfile` runs `alembic upgrade head` before starting
   `uvicorn`, so migrations apply automatically on deploy.
