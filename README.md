# HostelHub India

Mobile-first 3-tier web application for hostel operations, compliance, and role-based management.

## Tech Stack

- Tier 1 (Presentation): React + Tailwind CSS + PWA (Service Worker)
- Tier 2 (Application): FastAPI + JWT + RBAC + business modules
- Tier 3 (Data): PostgreSQL + SQLAlchemy ORM

## Project Structure

- frontend/: Mobile-first PWA with Super Admin Bento dashboard
- backend/: FastAPI backend and REST APIs
- backend/app/models/: SQLAlchemy ORM models

## Prerequisites

Install the following before setup:

- Node.js 20+ and npm
- Python 3.11+
- PostgreSQL 14+

Optional but recommended:

- Git
- pgAdmin or any PostgreSQL client

## 1) Database Setup (PostgreSQL)

Create a database named hostelhub.

Example using psql:

```sql
CREATE DATABASE hostelhub;
```

## 2) Backend Setup (FastAPI)

From project root:

```powershell
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

This project is configured to run without a virtual environment. Dependencies are installed into your active/system Python environment.

Update backend/.env values if needed:

- DATABASE_URL
- JWT_SECRET_KEY
- ACCESS_TOKEN_EXPIRE_MINUTES

Run backend server:

```powershell
uvicorn app.main:app --reload
```

Backend runs on:

- http://127.0.0.1:8000
- Swagger docs: http://127.0.0.1:8000/docs

## 3) Frontend Setup (React + Tailwind PWA)

Open a new terminal from project root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on:

- http://127.0.0.1:5173

## Default Seed Behavior

On backend startup, the app:

- Creates database tables if they do not exist
- Seeds feature toggles for mess, gate_access, and gst
- Seeds one Super Admin user if missing

## Feature Highlights

- Super Admin mobile dashboard with Bento layout and bottom nav
- 44x44 touch targets for mobile interaction
- Single-column mobile form patterns
- Shadcn-style switches for GST, Mess, Gate Access
- Network First cache strategy for resident directory endpoint
- JWT authentication and RBAC for Super Admin, Owner, Warden, Student
- GST logic: 12% when rent is above INR 1000/day, otherwise 0% for long-term residential use case

## API Modules

- Auth: /api/v1/auth
- Feature Control: /api/v1/features
- Residents: /api/v1/residents
- Business Modules (Mess, Gate, GST): /api/v1/modules

## Troubleshooting

- If imports are unresolved in editor, install dependencies in both backend and frontend.
- If database connection fails, verify PostgreSQL is running and DATABASE_URL is correct.
- If pip is missing, install it and rerun using `python -m pip ...` commands.

## Production Notes

- Replace default JWT secret with a strong value.
- Disable debug/reload and run behind a production ASGI server setup.
- Add database migrations (Alembic) before production deployment.
