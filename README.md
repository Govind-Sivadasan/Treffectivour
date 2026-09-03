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

### Accounts

| Role  | Email                         | Password   |
|-------|-------------------------------|------------|
| Admin | admin@treffectivour.local     | admin123   |

Team users (password = `<username>123`, except niyas → `niyas123`):

| Name       | Email                              | Password      |
|------------|------------------------------------|---------------|
| Adarsh     | adarsh.vasudevan@trenser.com       | adarsh123     |
| Akash      | akash.udayan@trenser.com           | akash123      |
| Aparna     | aparna.shaji@trenser.com           | aparna123     |
| Ashik      | ashik.narayanankutty@trenser.com   | ashik123      |
| Basil      | basil.baby@trenser.com             | basil123      |
| Govind     | govind.sivadasan@trenser.com       | govind123     |
| Jobin      | jobin.edison@trenser.com           | jobin123      |
| Krishnendu | krishnendu.gopi@trenser.com        | krishnendu123 |
| Manoj      | manoj.p@trenser.com                | manoj123      |
| Niyas      | niyasudheen.moithu@trenser.com     | niyas123      |
| Sarath     | sarath.krishna@trenser.com         | sarath123     |

## Docker

```bash
docker compose up --build
```

Uses a **local volume** at `/data` — data persists across container restarts.

## Deploy on Render (free tier)

Render’s free web tier has **no persistent disk**. SQLite stored inside the container is wiped on sleep, restart, or redeploy. Use **Turso** (free cloud SQLite) instead.

### One-time Turso setup

```bash
# Install: https://docs.turso.tech/cli
turso auth login
turso db create treffectivour
turso db show treffectivour --url          # copy libsql:// URL
turso db tokens create treffectivour       # copy token

# Push schema + seed to Turso
DATABASE_URL="libsql://YOUR-DB.turso.io" TURSO_AUTH_TOKEN="YOUR-TOKEN" npm run db:setup:turso
```

### Render environment variables

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `libsql://YOUR-DB.turso.io` |
| `TURSO_AUTH_TOKEN` | token from Turso |
| `JWT_SECRET` | long random string |
| `COOKIE_SECURE` | `true` |

Deploy with Docker (or connect repo using included `render.yaml`). Do **not** attach a paid disk — Turso holds the data.

Local Docker without Turso still uses `/data` volume as before.

## How hours are calculated

- **Effective hours** — Sum of each IN→OUT pair. If OUT is missing, counts to now.
- **Gross hours** — First IN to last OUT (or now if still clocked in).
- **Required hours** — Default 8h; half-day leave 4h; special days set by admin (e.g. 3h).

## Environment

| Variable                 | Default   | Description              |
|--------------------------|-----------|--------------------------|
| `DATABASE_URL`           | SQLite    | Local `file:./dev.db` or Turso `libsql://...` |
| `TURSO_AUTH_TOKEN`       | —         | Required with Turso URLs |
| `JWT_SECRET`             | —         | Session signing secret   |
| `DEFAULT_REQUIRED_HOURS` | 8         | Full day target          |
| `HALF_DAY_REQUIRED_HOURS`| 4         | Half-day leave target    |

## Tech stack

Next.js 15 · React 19 · Prisma · SQLite · Tesseract.js · Tailwind CSS · Recharts
