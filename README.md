# Treffectivour

Track **effective hours** and **gross hours** from attendance screenshots or manual punch entry. Built for teams with flexible required hours (half-day leave, special events like Onam).

## Features

- **Screenshot OCR** — Upload an attendance popup screenshot; IN/OUT times are extracted automatically
- **Manual entry** — Interactive time picker with IN/OUT, half-day leave (4h), and custom required hours
- **Missing OUT** — Open sessions count to the current time
- **Today dashboard** — Live progress ring, punch log, goal notification + success tone at required hours
- **Weekly & monthly** — Aggregated stats and charts
- **Special days** — Admin can set dates with reduced required hours (e.g. 3h for Onam)
- **Multi-user** — Each user sees their own data; admin sees everyone
- **Docker** — Run locally or as a container with persistent SQLite storage

## Quick start (local)

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### WSL (Windows)

Do **not** share `node_modules` between Windows and WSL. Install and run in one place only:

```bash
cd /mnt/d/PROJECTS/Treffectivour
rm -rf node_modules .next
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### Demo accounts

| Role  | Email                         | Password  |
|-------|-------------------------------|-----------|
| User  | user@treffectivour.local      | user123   |
| Admin | admin@treffectivour.local     | admin123  |

## Docker

```bash
docker compose up --build
```

Seed the database once after first run:

```bash
docker compose exec treffectivour npx tsx prisma/seed.ts
```

## How hours are calculated

- **Effective hours** — Sum of each IN→OUT pair. If OUT is missing, counts to now.
- **Gross hours** — First IN to last OUT (or now if still clocked in).
- **Required hours** — Default 8h; half-day leave 4h; special days set by admin (e.g. 3h).

## Environment

| Variable                 | Default   | Description              |
|--------------------------|-----------|--------------------------|
| `DATABASE_URL`           | SQLite    | Database connection      |
| `JWT_SECRET`             | —         | Session signing secret   |
| `DEFAULT_REQUIRED_HOURS` | 8         | Full day target          |
| `HALF_DAY_REQUIRED_HOURS`| 4         | Half-day leave target    |

## Tech stack

Next.js 15 · React 19 · Prisma · SQLite · Tesseract.js · Tailwind CSS · Recharts
