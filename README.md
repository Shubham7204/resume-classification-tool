# RecruiterOS

A hiring workspace for campus drives and careers-page applicants. Each role gets a screening rubric drafted from its job description; TypeSafe Jev answers every check for every resume, and the app turns those answers into an explainable fit score. A person makes every hiring decision.

Built with Next.js 16, Neon Postgres and Neon Object Storage.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm db:migrate              # creates the tables
pnpm dev                     # http://localhost:3000
```

The live data (roles, students, scores) lives in Postgres and the resume PDFs in object storage, so a deployment shows whatever is already in the database. The demo sample files (`samples/`) are kept out of the repository; with them present locally, `pnpm db:seed` loads the demo (one campus drive with 41 students and an SDE-2 careers role with 20 applicants) into an empty database. It drives the real app in Chrome, so it needs Playwright's Chrome (`npx playwright install chrome`).

## Deploy on Vercel

1. Push this repository to GitHub and import it in Vercel. The framework preset is detected as Next.js; no build settings need changing.
2. Under **Settings → Environment Variables**, add every variable from `.env.example` for Production (and Preview if you use it).
3. Run `pnpm db:migrate` once against the production database (from your machine, with `.env.local` pointing at it).
4. Deploy. `/api/health` reports whether the database and storage are reachable.

## Environment variables

| Variable | Used for |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon Postgres |
| `NEON_BRANCH` | Branch name; resetting all data is refused on `production` |
| `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Neon Object Storage for resume and JD PDFs |
| `TYPESAFE_API_KEY` | TypeSafe Jev scoring |
| `GROQ_API_KEY`, `OLLAMA_API_KEY` | Reading resumes, drafting rubrics, talent search (Groq first, Ollama Cloud as fallback) |

## Project layout

- `app/`: pages (`/hr` workspace, `/careers` public page) and API routes
- `lib/`: client store, eligibility rules, Jev scoring (`lib/jev.ts`), server helpers in `lib/server/`
- `db/migrations/`: SQL migrations
- `scripts/`: migrations, demo seeding, re-reading stored resumes
