# MycoFarm: Mushroom Farm Management System (prototype)

A working full-stack prototype: **React + Vite + TypeScript + Tailwind v4 + shadcn/ui** frontend, **Flask** REST API, **MongoDB**.
Every screen reads and writes real API endpoints. Dashboard numbers come from MongoDB aggregations, not hardcoded values.

## Getting started

The app has three parts, each running in its own terminal:

| Part | Folder | URL |
|---|---|---|
| MongoDB database | (system service) | `mongodb://localhost:27017` |
| Flask API | `backend/` | http://127.0.0.1:5050 |
| React web app | `frontend/` | http://localhost:5173 (open this one in the browser) |

### 0. Prerequisites (check once)

```bash
python3 --version     # 3.11 or newer
node --version        # v20 or newer
npm --version
mongod --version      # MongoDB 6 or newer
```

#### Installing MongoDB + MongoDB Compass

You need two things:

- **MongoDB Community Server**: the database itself. The app cannot run without it.
- **MongoDB Compass**: a desktop app to *view and browse* the data. It does not replace the server.

**macOS (Homebrew)**

```bash
brew tap mongodb/brew
brew install mongodb-community          # the database server
brew install --cask mongodb-compass     # the Compass desktop app
```

**Windows**

1. Download **MongoDB Community Server** (MSI) from https://www.mongodb.com/try/download/community.
2. Run the installer, choose **Complete**, and keep **"Install MongoD as a Service"** ticked so the database starts
   automatically with Windows.
3. Keep **"Install MongoDB Compass"** ticked in the same installer (or download Compass separately from
   https://www.mongodb.com/try/download/compass).

#### Viewing the data in Compass

1. Open **MongoDB Compass**.
2. Paste the connection string `mongodb://localhost:27017` and click **Connect**.
3. Open the **`mycofarm`** database (it appears after running `seed.py` or using the app) to browse collections such as
   `users`, `farms`, `production_batches`, `harvests` and `sales`.

> Avoid editing or deleting documents in Compass while the app is running unless you know what you are changing: the
> app relies on links between collections (e.g. a sale points to its customer and stock lots).

### 1. First-time installation (run once)

All commands start from the project root (the folder containing `backend/` and `frontend/`).

**Step 1: Start MongoDB**

```bash
brew services start mongodb-community      # macOS / Homebrew
```

On **Windows** the MongoDB service starts automatically. If it isn't running, start it from an Administrator terminal
with `net start MongoDB`.

To confirm it's running, open **MongoDB Compass** and connect to `mongodb://localhost:27017`. If it connects, the
database is up.

**Step 2: Set up the API**

**2a. Go to the backend folder and create the virtual environment** (only once):

```bash
cd backend
python3 -m venv .venv
```

**2b. Activate the virtual environment:**

```bash
# macOS / Linux
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (Command Prompt)
.venv\Scripts\activate.bat
```

When it's active, your prompt starts with **`(.venv)`**. All the next backend commands must be run in this activated
terminal.

> On Windows, if PowerShell refuses to run the activate script, run this once and try again:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**2c. With the environment activated, install the packages and create the config:**

```bash
pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
```

Open `backend/.env` and set at least:

```ini
JWT_SECRET_KEY=<a long random string>
SUPERADMIN_NAME=Your Name
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=<at least 8 characters>
```

To generate a random secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**2d. Still in the activated environment, load the demo data and start the API:**

```bash
python seed.py    # creates the super admin + demo organizations, farms, batches, sales…
python run.py     # API now running on http://127.0.0.1:5050 — keep this terminal open
```

**Step 3: Set up the web app** (in a **new terminal**)

```bash
cd frontend
npm install                 # install JavaScript packages
npm run dev                 # web app now running on http://localhost:5173 — keep this terminal open
```

**Step 4: Open http://localhost:5173.** Click **Demo accounts** (bottom-right of the sign-in page) to log in as any role,
or sign in as the super admin with the email and password from `backend/.env`.

### 2. Running the project again (every time after)

No reinstalling is needed. Start the three parts again.

**Terminal 1: database** (skip if it already runs as a service, which is the default on Windows)

```bash
brew services start mongodb-community      # macOS
```

**Terminal 2: API.** First activate the environment:

```bash
cd backend
source .venv/bin/activate          # Windows PowerShell: .venv\Scripts\Activate.ps1
```

Then, with `(.venv)` showing in the prompt, start the API:

```bash
python run.py
```

**Terminal 3: web app** (no environment needed)

```bash
cd frontend
npm run dev
```

Then open http://localhost:5173. Your data is kept between runs. **Do not run `seed.py` again unless you want to reset it.**

To stop everything, press `Ctrl + C` in the API and web-app terminals. Type `deactivate` to leave the Python
environment. Then optionally:

```bash
brew services stop mongodb-community       # macOS  (Windows, as Administrator: net stop MongoDB)
```

### 3. Useful commands

Backend commands below assume you are in `backend/` **with the environment activated** (`source .venv/bin/activate`,
or `.venv\Scripts\Activate.ps1` on Windows).

| Task | Command (run inside the folder shown) |
|---|---|
| Reset the database to fresh demo data (**deletes all data**) | `backend/` (activated): `python seed.py` |
| Install new Python packages after pulling changes | `backend/` (activated): `pip install -r requirements.txt` |
| Install new JS packages after pulling changes | `frontend/`: `npm install` |
| Type-check and build the frontend for production | `frontend/`: `npm run build` (output in `frontend/dist/`) |
| Preview the production build | `frontend/`: `npm run preview` |
| Check the API is up | `curl http://127.0.0.1:5050/api/v1/health` |
| Run the API on another port | `backend/` (activated): `PORT=5051 python run.py`. Windows: `$env:PORT=5051; python run.py`. Also update the proxy in `frontend/vite.config.ts`. |

### 4. Troubleshooting

| Problem | Fix |
|---|---|
| `ServerSelectionTimeoutError` / API won't start | MongoDB isn't running. Start it (step 1), then check that Compass can connect to `mongodb://localhost:27017`. |
| Compass connects but there is no `mycofarm` database | In `backend/` with the environment activated, run `python seed.py` (or register an account in the app), then click refresh in Compass. |
| `ModuleNotFoundError: No module named 'flask'` | The environment isn't activated. Run `source .venv/bin/activate` (Windows: `.venv\Scripts\Activate.ps1`) in `backend/` and try again. |
| `python: command not found` (macOS/Linux) before activating | Use `python3` to create the environment; after activation, `python` works. |
| `Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD…` when seeding | Fill those values in `backend/.env`. |
| Login page shows "Network Error" / data doesn't load | The API isn't running on port 5050. Start it in its own terminal. |
| `Address already in use` | Another process uses the port. Stop it, or change `PORT` (API) / `npm run dev -- --port 5174` (web app). |
| Logged out unexpectedly after reseeding | Seeding replaces all users. Sign in again. |

### Accounts

**Super admin** is created from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `backend/.env`: by `seed.py`, and on API
startup if that account doesn't exist yet. An existing account is never overwritten.

**Demo accounts** (password = `DEMO_PASSWORD`, default `password123`) are seeded when running `seed.py`. On the sign-in page,
the **Demo accounts** button (bottom-right) opens a drawer, and picking a role fills in the form. The list comes from
`GET /api/v1/public/demo-accounts`, which returns nothing when `DEMO_MODE=false`. The super admin is never listed there.

| Organization (tenant) | Role | Email | Farms |
|---|---|---|---|
| Imigina Mushrooms Ltd | Farm Owner | owner@mycofarm.rw | Musanze Highland, Kigali Urban |
| Imigina Mushrooms Ltd | Farm Manager | manager@mycofarm.rw | Musanze Highland |
| Imigina Mushrooms Ltd | Farm Worker | worker@mycofarm.rw | Musanze Highland |
| Imigina Mushrooms Ltd | Sales Manager | sales@mycofarm.rw | both |
| Huye Fresh Fungi | Farm Owner | owner@huyefungi.rw | Huye Fresh Fungi Farm |
| Huye Fresh Fungi | Farm Worker | worker@huyefungi.rw | Huye Fresh Fungi Farm |

## Multi-tenancy

Each **organization** is an isolated tenant. Self-registration creates a new organization owned by the new user, with
four starter varieties and no customers or other data. The **super admin** manages the platform from *Organizations*:
create a tenant together with its owner, suspend it (all its users are blocked immediately, existing tokens included)
or reactivate it.

- **Org-level data** (`farms`, `customers`, `varieties`, `users`) carries `org_id` and is filtered by the caller's organization.
  `org_id` is always taken from the session, never from the request body.
- **Farm-level data** (rooms, batches, observations, harvests, stock, sales, expenses, employees, tasks, notifications) is
  filtered by the user's `farm_ids`, which can only contain farms of their own organization.
- **References are checked**: a batch can't use another tenant's variety, a sale can't use another tenant's customer
  or variety, and tasks/employees/expenses can only reference rooms, staff and batches on the same farm.
- **Uniqueness is per tenant** (e.g. two organizations can both have a farm coded `F01`).
- **Super admin** sees all tenants. Choosing a farm in the top bar narrows every page to that farm's organization, and
  org-level records the super admin creates (customers, varieties) go to that organization.


### Try the core workflow
1. **Worker**: open a *Fruiting* batch → *Record harvest* (or record an observation with contamination to trigger an alert).
2. **Manager**: *Harvests → Pending approval → Approve*. A fresh-stock lot is created and the batch yield updates.
3. **Sales manager**: *Sales Orders → New order*. Stock is deducted FIFO from the oldest unexpired lots, and overselling is rejected.
   Record payments, dispatch/deliver, print the invoice, or cancel/return (stock goes back).
4. **Owner**: watch the dashboard KPIs, charts, notifications and *Reports* (CSV export, print to PDF) update.

## Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection |
| `MONGO_DB` | `mycofarm` | Database name |
| `JWT_SECRET_KEY` | (none, set it) | Signs access/refresh tokens |
| `JWT_ACCESS_MINUTES` | `30` | Access token lifetime |
| `JWT_REFRESH_DAYS` | `14` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `SUPERADMIN_NAME` / `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | (none) | Platform super admin bootstrap (password ≥ 8 chars) |
| `DEMO_MODE` | `false` | Expose demo accounts to the login drawer. Turn off in real deployments |
| `DEMO_PASSWORD` | `password123` | Password given to seeded demo users |
| `PORT` / `FLASK_DEBUG` | `5050` / `1` | Dev server |

Frontend: optional `VITE_API_URL` (defaults to `/api/v1` through the Vite proxy).

## Architecture

```
backend/app/
  __init__.py            app factory, JWT + error handlers, blueprint registration
  config.py, extensions.py
  permissions/rbac.py    @roles_required, farm_scope() (farm-level data isolation; X-Farm-Id header narrows scope)
  schemas/models.py      pydantic request validation
  utils/crud.py          generic paginated CRUD factory (search, sort, filters, soft delete, audit)
  routes/                auth, users, farms (+rooms, varieties, employees, tasks), production, harvests,
                         inventory, sales (+customers, expenses), dashboard, misc (reports, notifications, public)
  db/indexes.py          indexes + unique constraints, created on startup
  db/defaults.py         starter varieties + create_organization() for new tenants
  seed.py                realistic demo data: 2 organizations, 3 farms, ~23 batches, ~40 harvests, ~110 sales…
frontend/src/
  lib/api.ts             axios + auto refresh-token rotation
  stores/                zustand: auth/session + selected farm, theme
  hooks/useApi.ts        TanStack Query list/get/mutate helpers
  components/shared/     DataTable, FormDialog (RHF + zod, config-driven), ResourcePage, KpiCard, StatusBadge…
  components/charts/     Recharts wrappers
  features/<module>/     landing, auth, dashboard, farms, production, harvests, inventory, sales, finance, team, reports…
```

**Tenant isolation** is enforced in `permissions/rbac.py` (`org_scope`, `farm_scope`, `assert_same_org/farm`) and applied
by the CRUD factory (`scope_kind="farm" | "org" | "farms"`, `refs={...}`).

**Consistency without transactions** (works on a standalone `mongod`): harvest approval is a guarded
`find_one_and_update({status: "pending"})`, so it can't be approved twice. Sales deduct each stock lot with a conditional
`$inc` (`available_kg >= qty`) and release everything already taken if any line is short. Cancels/returns are guarded by status.

**Security**: Werkzeug password hashing, JWT access + refresh tokens with rotation (refresh tokens are single-use, kept in a
blocklist with TTL), logout revocation, backend role checks on every write, farm-scoped queries on every read, pydantic validation,
audit log on create/update/delete/approve/payment.

## API (all under `/api/v1`, JSON envelope `{success, data, meta?, message?}`)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/register · login · refresh · logout · forgot-password · reset-password · verify-email`, `GET/PUT auth/me` |
| Users | `GET/POST users`, `PUT/DELETE users/{id}` |
| Farms | `GET/POST farms`, `GET/PUT/DELETE farms/{id}` (same pattern for `rooms`, `varieties`, `employees`, `tasks`, `customers`, `expenses`, `inventory/items`) |
| Production | `GET/POST production/batches`, `GET/PUT/DELETE production/batches/{id}`, `PATCH …/{id}/stage`, `GET …/{id}/history`, `POST …/{id}/observations`, `GET production/observations` |
| Harvests | `GET/POST harvests`, `PATCH harvests/{id}/approve` (`action: approve/reject`), `DELETE harvests/{id}`, `GET harvests/reports` |
| Inventory | `GET inventory/stock`, `GET inventory/stock/summary`, `GET/POST inventory/transactions`, `GET inventory/low-stock` |
| Sales | `GET/POST sales`, `GET sales/{id}`, `PATCH sales/{id}/status`, `POST sales/{id}/payments`, `GET customers/{id}/history` |
| Organizations (super admin) | `GET/POST organizations`, `PATCH organizations/{id}` (`name`, `status: active/suspended`) |
| Dashboard | `GET dashboard/overview · production · harvest · sales` |
| Reports | `GET reports/{production,harvest,sales,financial,inventory}?from=&to=` |
| Notifications | `GET notifications`, `PATCH notifications/{id}/read`, `POST notifications/read-all` |
| Public | `GET public/stats`, `GET public/demo-accounts`, `POST public/contact`, `GET health` |

List endpoints accept `page`, `limit`, `q`, `sort`, `order` plus module filters (e.g. `stage`, `status`, `farm_id`).

## Prototype limitations (next steps)
- No email delivery: forgot-password and verify-email return the token in the response, and the UI shows a dev link.
- Exports are CSV (opens in Excel) plus browser print-to-PDF. Native XLSX/PDF generation is not implemented.
- Observation photo uploads, rate limiting, and automated test suites are not implemented yet.
- Currency is RWF (`frontend/src/lib/format.ts`).

## Photo credits (Wikimedia Commons)
USDA (public domain); Arne Müseler, *Fungiculture Cameron Highlands* (CC BY-SA 3.0 DE);
Shreevaishnavi96, *Pleurotus mushroom* (CC BY-SA 4.0); Resimke, *Oyster mushroom ready to harvest* (CC BY-SA 4.0).
