# CivicLens AI

A civic issue reporting and resolution platform. Residents photograph a problem, pin it on a map and track it to resolution. Staff moderate, triage, assign and close cases with photo evidence, and see analytics computed from the database.

> **Not a government system.** CivicLens is independent software. It has no integration with any city, 311 service or government platform, and a report filed here is not an official complaint. The sample data is fictional.

## What is implemented

| Area | What exists |
| --- | --- |
| Reporting | Photo upload (up to 4), location by map pin or browser geolocation, category, description, review step with consent |
| AI | PyTorch MobileNetV3 classifier (loads a checkpoint you train), image-statistics severity suggestion, perceptual-hash duplicate matching |
| Duplicates | PostGIS radius search (60 m, same category, active, last 120 days) plus photo similarity. Staff merge; nothing merges automatically |
| Map | Leaflet + OpenStreetMap tiles, server-side clustering in PostGIS that re-groups as you zoom |
| Residents | Account, "My reports", status timeline with public notes and resolution photos |
| Staff | Moderation queue (approve / reject with reason), triage (human severity, status, assignee), resolution evidence, merge duplicates |
| Admin | Role management, analytics (median days to resolve, open by severity, per-category, hotspots, AI agreement) |
| Safety | Human review before anything is public, EXIF/GPS stripped from every photo, reporter hidden from public views, flagging, rate limits, CSRF header, HTTP-only cookie sessions |
| Data | Alembic migration, CHECK constraints, GiST spatial index, seed script, 38 backend tests, 7 frontend tests |

## Honest limits (read before relying on it)

- **No trained model ships.** Without a checkpoint the app runs in **demo mode**: the category is whatever the resident chose, there is no confidence score, and the UI says "Demo mode". The training script exists (`backend/app/ai/train.py`) but you must supply labelled photos. Pipeline tests (`backend/tests/test_ai.py`) train a tiny synthetic model and only prove the code path, not accuracy.
- **Severity is a heuristic**, not a model. It is a suggestion; a person must confirm severity before triage.
- **Rate limiting is in-process.** Run one API instance, or replace it with a shared store (Redis) before scaling out.
- **S3 storage is implemented but untested.** Local disk storage is what the tests cover.
- **Docker files are untested.** `docker-compose.yml` and the Dockerfiles were written but not run in the build environment.
- **Vercel hosts only the Next.js frontend.** The API needs PostGIS and PyTorch, so it must run elsewhere (Render, Railway, Fly.io, a VM). Two Vercel behaviours are unverified here: proxying `/api/*` to an external backend through a rewrite, and Vercel's request body limit (about 4.5 MB). The browser shrinks photos to 1600 px before upload to stay under it.
- **Map tiles come from the public OpenStreetMap servers**, which have a usage policy; use a tile provider for real traffic.
- **No email or push notifications**, no password reset, no email verification.
- The browser journey was checked once with Playwright against a local stack; that script is not included in the repository.

## Layout

```
backend/    FastAPI, SQLAlchemy/GeoAlchemy2, Alembic, PyTorch, tests
frontend/   Next.js 15 (App Router), TypeScript, Tailwind, Leaflet
docker-compose.yml
```

## Prerequisites (Windows 11, PowerShell)

Install once:

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
winget install Git.Git
```

Restart PowerShell afterwards. Docker Desktop is used only to run PostgreSQL with PostGIS; if you already have PostGIS installed natively you can skip it and point `DATABASE_URL` at it.

## 1. Database

```powershell
docker run -d --name civiclens-db -p 5432:5432 `
  -e POSTGRES_USER=civiclens -e POSTGRES_PASSWORD=civiclens -e POSTGRES_DB=civiclens `
  postgis/postgis:16-3.4

# a separate database for the test suite
docker exec civiclens-db psql -U civiclens -c "CREATE DATABASE civiclens_test"
```

## 2. Backend

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt          # includes PyTorch; the first install is large
Copy-Item .env.example .env                   # edit if you changed the database credentials
alembic upgrade head                          # creates the PostGIS extension and all tables
python -m scripts.seed                        # optional: 36 fictional reports and 4 sample accounts
uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks the activation script: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Health check: <http://127.0.0.1:8000/api/health> reports `ai_mode` as `demo` or `model`. Interactive API docs: <http://127.0.0.1:8000/docs>.

Sample accounts created by the seed script (password `sample-password-123`, development only):
`admin@civiclens.example`, `staff@civiclens.example`, `staff2@civiclens.example`, `resident@civiclens.example`.

**Creating a real first admin** instead of using sample accounts: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters) in `backend/.env` before starting. The account is created on startup only if that email does not exist, and an existing account is never modified. Remove the password from `.env` afterwards.

## 3. Frontend

In a second PowerShell window:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local             # BACKEND_URL=http://127.0.0.1:8000
npm run dev
```

Open <http://localhost:3000>. The browser only talks to the Next.js origin; `/api/*` is rewritten to `BACKEND_URL`, so session cookies stay first-party.

## 4. Training a classifier (optional)

Arrange photos in folders named after the categories (`pothole`, `streetlight`, `overflowing_bin`, `water_leak`, `damaged_infrastructure`):

```powershell
cd backend
python -m app.ai.train --data .\data --epochs 8 --out .\models\civiclens.pt
```

Add `--pretrained` to start from ImageNet weights (needs internet access to `download.pytorch.org`; much better on small datasets). Read the printed validation accuracy before using the result. Then set `MODEL_PATH=.\models\civiclens.pt` in `backend/.env` and restart; `/api/health` should report `ai_mode: model`. Checkpoints load with `torch.load(weights_only=True)`, but only load files you trust.

## 5. Tests and quality checks

```powershell
# backend (needs the civiclens_test database from step 1)
cd backend
.\.venv\Scripts\Activate.ps1
$env:TEST_DATABASE_URL = "postgresql+psycopg://civiclens:civiclens@127.0.0.1:5432/civiclens_test"
pytest
ruff check .

# frontend
cd ..\frontend
npm run lint
npm run typecheck
npm test
npm run build
```

The backend tests run against a real PostGIS database, apply the Alembic migration, and truncate tables between tests. They never touch `DATABASE_URL`.

Known gap: `mypy app` is not clean. Most findings are SQLAlchemy typing noise and are not part of the quality gate.

## 6. Everything in Docker (untested)

```powershell
docker compose up --build
```

This starts PostGIS, the API (runs migrations on start) and the web app on <http://localhost:3000>. To load sample data: `docker compose exec backend python -m scripts.seed`.

## 7. Deployment

### API and database (first)

Host the API anywhere that runs a Python container and offers PostGIS (Render, Railway, Fly.io, Supabase or Neon for the database). Build from `backend/Dockerfile`, then set:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_URL` | `postgresql+psycopg://...` (the extension is created by the migration; the role needs permission to `CREATE EXTENSION postgis`, or enable it in the provider's console first) |
| `JWT_SECRET` | 32+ random characters. The API refuses to start with the development value |
| `COOKIE_SECURE` | `true` |
| `STORAGE_BACKEND` | `s3` with the `S3_*` values, or mount a persistent disk at `STORAGE_DIR` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin (optional) |

Generate a secret in PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

Do not run `scripts.seed` in production; it refuses unless `APP_ENV=development`.

### Frontend on Vercel

```powershell
npm install -g vercel
cd frontend
vercel login
vercel link
vercel env add BACKEND_URL production     # e.g. https://your-api.example.com  (no trailing slash)
vercel --prod
```

Or import the GitHub repository in the Vercel dashboard, set **Root Directory** to `frontend`, and add `BACKEND_URL`. Until `BACKEND_URL` points at a running API, the site loads but every data request shows "cannot reach the server".

## Security notes

- Secrets are read from the environment on the server only; nothing sensitive is bundled into client code.
- Passwords are hashed with scrypt. Sessions are HTTP-only, SameSite=Lax cookies. State-changing requests require the `X-Requested-With: civiclens` header.
- Uploads are decoded and re-encoded with Pillow (JPEG/PNG/WebP only), which removes EXIF and GPS metadata. Reporter identity and internal staff notes are never returned to public views. Private reports return 404 to anyone but the reporter and staff.
- Rate limits are configurable per bucket (`RATE_LIMIT_*_PER_MIN`).

## License

No license has been chosen. Add one before accepting contributions.
