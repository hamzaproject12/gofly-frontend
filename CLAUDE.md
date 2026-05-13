# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GoFly is a full-stack OMRA (pilgrim travel) agency management platform. The repo contains two separate applications:
- **Frontend**: Next.js 14 (App Router) in the root directory
- **Backend**: Express.js + Prisma in the `backend/` directory

The UI is in French. The domain is pilgrim travel management: programs, reservations, hotels, payments, expenses, fixed charges, and document handling.

## Development Commands

### Frontend (root directory)
```bash
npm run dev        # Start Next.js dev server on port 3000
npm run build      # Production build
npm run lint       # ESLint
```

### Backend (`backend/` directory)
```bash
npm run dev        # ts-node-dev with --respawn (watches src/)
npm run build      # tsc + prisma generate
npm start          # prisma migrate deploy + node dist/server.js
npm run prisma:push    # Push schema changes to DB (dev only)
npm run prisma:seed    # Seed the database
```

### Running both concurrently
Start each in a separate terminal — there is no root-level script to run both.

## Architecture

### Frontend (`/app`, `/components`, `/hooks`, `/lib`)
- **Next.js App Router** with pages under `app/`: `programmes`, `reservations`, `paiements`, `depenses`, `hotels`, `charges-fixes`, `solde`, `admin`
- **API communication**: all calls go through `lib/api.ts` → `api.request()` / `api.url()`. This helper reads `NEXT_PUBLIC_API_URL` (default: Railway production URL), auto-injects the JWT from localStorage, and guards against accidentally calling the frontend itself.
- **Auth state**: `hooks/useAuth.ts` — reads token/user from localStorage; `middleware.ts` at root is a Next.js middleware for route protection (can be disabled via `NEXT_PUBLIC_DISABLE_AUTH_CHECK=true`).
- **Forms**: React Hook Form + Zod validation throughout.
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS. Dark mode via `next-themes`. Toasts via Sonner.

### Backend (`backend/src/`)
- **Entry point**: `backend/src/server.ts` — Express app, CORS config, all route mounts, cron job, static file serving.
- **Route → Controller → (Service)** pattern. Routes in `routes/`, controllers in `controllers/`, heavier logic in `services/`.
- **Auth**: JWT (`jsonwebtoken`). Tokens verified by `middleware/auth.ts` → `authenticateToken`. Passwords hashed with bcrypt (12 rounds). Roles: `ADMIN` | `AGENT`.
- **ORM**: Prisma 5 against PostgreSQL. Schema at `backend/prisma/schema.prisma`.
- **File storage**: local (`/uploads` served as static) or Cloudinary via `services/cloudinaryService.ts`. Upload endpoints: `/api/upload` (local, multer) and `/api/upload-cloudinary`.
- **Excel**: exceljs for import (`lib/excelParser.ts` on frontend) and export (`/api/export` on backend).
- **Cron**: `node-cron` runs `fixedChargeGenerator` every 1st of the month at 06:00 to auto-create monthly `FixedChargeOccurrence` records.

### Key Data Models (Prisma)
| Model | Purpose |
|---|---|
| `Agent` | User accounts; roles ADMIN / AGENT |
| `Program` | OMRA travel program with pricing, dates, deadlines |
| `Reservation` | Pilgrim booking; supports LIT (shared bed) and CHAMBRE_PRIVEE; family hierarchy via `parentId`/`groupId` |
| `Room` | Hotel room inventory per program; tracks remaining capacity |
| `Hotel` | Hotel catalog (Madina / Makkah) |
| `Payment` | Payment records linked to reservation and/or program |
| `Expense` | Expense entries, linked to program/reservation |
| `Fichier` | Documents (passport, visa, etc.) stored locally or on Cloudinary |
| `FixedCharge` / `FixedChargeOccurrence` | Recurring agency costs (rent, salaries) |
| `JournalSuppression` | Append-only audit log for deletions and deactivations |

### API Routes
```
/api/auth                 login, register, logout, profile
/api/admin                user management (ADMIN only)
/api/programs             CRUD + overview
/api/reservations         CRUD + bulk ops
/api/hotels               CRUD
/api/payments             CRUD
/api/expenses             CRUD
/api/balance              financial summary
/api/fixed-charges        recurring charges (ADMIN)
/api/export               Excel exports
/api/upload               local file upload
/api/upload-cloudinary    Cloudinary upload
/api/analytics            dashboard stats
/api/room-availability    room inventory queries
/api/journal-suppressions audit trail (ADMIN)
/health                   health check
```

## Environment Variables

### Frontend (`.env`)
```
NEXT_PUBLIC_API_URL=           # Backend URL (defaults to Railway prod URL)
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_APP_DESCRIPTION=
NEXT_PUBLIC_APP_LOGO=
NEXT_PUBLIC_CONTACT_EMAIL=
NEXT_PUBLIC_DISABLE_AUTH_CHECK=  # Set "true" to bypass Next.js middleware auth
```

### Backend (`backend/.env`)
```
DATABASE_URL=                  # PostgreSQL connection string
PORT=5000
JWT_SECRET=
JWT_EXPIRES_IN=
COOKIE_SECRET=
NODE_ENV=
FRONTEND_URL=                  # Comma-separated list of allowed CORS origins
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Deployment

- **Frontend**: Vercel (automatic from main branch)
- **Backend**: Railway — build command `npm run build`, start command `npm start` (runs migrations then launches server)

## Important Notes

- `next.config.mjs` has `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: true` — type errors won't block builds.
- The `@/*` path alias resolves to the repo root (not `src/`).
- The frontend language is French — keep all UI text in French.
- `JournalSuppression` is append-only; never delete from it.
- Room capacity (`nbrPlaceRestantes`) is updated automatically when reservations are created/cancelled — avoid bypassing that logic.
