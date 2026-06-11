# Deployment Guide

This project is a good fit for Vercel plus Supabase Cloud.

- Vercel hosts the Next.js app, pages, middleware, and API routes.
- Supabase Cloud hosts Postgres, Auth, Row Level Security, and Realtime.
- Vercel Cron calls protected admin routes for scheduled data sync and scoring recalculation.
- This is suitable for a hobby project with dozens of users and a few GB of data.
- You do not need Docker hosting, Kubernetes, a custom server, Redis, or queues right now.

## Architecture

```txt
Browser
  -> Vercel Next.js app
      -> Supabase Auth session cookies
      -> Supabase anon key for normal user reads/writes
      -> Supabase service role key for server-only admin routes
  -> Supabase Realtime websocket for draft updates

Vercel Cron
  -> /api/admin/sync-world-cup
  -> /api/admin/recalculate-scores
  -> protected by CRON_SECRET

Supabase Cloud
  -> Postgres schema from supabase/migrations
  -> Auth magic links
  -> RLS policies
  -> Realtime publication for drafts and draft_picks
```

## Environment Variables

Set these locally in `.env.local` and in Vercel Project Settings.

### Browser-safe

These are exposed to the browser by design:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Server-only secrets

Never prefix these with `NEXT_PUBLIC_`.

```bash
APP_URL=https://your-vercel-domain.vercel.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=use-a-long-random-string
API_FOOTBALL_KEY=optional-api-football-key
```

### Server configuration

```bash
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_LEAGUE_ID=1
API_FOOTBALL_SEASON=2026
API_FOOTBALL_DAILY_BUDGET=90
API_FOOTBALL_MIN_INTERVAL_MS=1500
OPENFOOTBALL_WORLD_CUP_URL=https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup.txt
```

Important:

- Never commit `.env.local`.
- Never put `SUPABASE_SERVICE_ROLE_KEY` in client components.
- In production, `APP_URL` must be your Vercel URL or custom domain with `https://`.
- `CRON_SECRET` should be a long random value with no spaces or newlines.
- Do not point production Vercel env vars at `127.0.0.1` Supabase URLs.

## Local Checks

From the project root:

```powershell
npm install
npm run typecheck
npm run build
```

For local Supabase:

```powershell
& "$env:APPDATA\npm\supabase.cmd" start
& "$env:APPDATA\npm\supabase.cmd" db reset
```

`supabase db reset` is for local development only. Do not casually run destructive reset commands against production.

## Supabase Cloud Setup

1. Create a Supabase account at `https://supabase.com`.
2. Create a new project.
3. Save the database password somewhere safe.
4. In Supabase Dashboard, copy:
   - Project URL
   - anon public key
   - service_role key
5. Put those values into Vercel environment variables.

## Apply Migrations To Supabase Cloud

Install and log in to the Supabase CLI if needed:

```powershell
& "$env:APPDATA\npm\supabase.cmd" login
```

Link this repo to the production project:

```powershell
& "$env:APPDATA\npm\supabase.cmd" link --project-ref your-project-ref
```

Push migrations:

```powershell
& "$env:APPDATA\npm\supabase.cmd" db push
```

Then verify in Supabase Dashboard that tables exist, especially:

- `profiles`
- `leagues`
- `league_members`
- `drafts`
- `draft_picks`
- `national_teams`
- `players`
- `matches`
- `league_score_events`
- `league_score_runs`

## Seed Or Load World Cup Data

Optional seed file:

```powershell
& "$env:APPDATA\npm\supabase.cmd" db seed --file supabase/seed/seed.sql
```

Preferred production baseline sync after Vercel is live:

```powershell
$headers = @{
  Authorization = "Bearer your-cron-secret"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-vercel-domain.vercel.app/api/admin/sync-world-cup" `
  -Headers $headers `
  -Body '{"mode":"baseline"}'
```

## Supabase Auth Settings

In Supabase Dashboard, open Authentication settings.

Set Site URL:

```txt
https://your-vercel-domain.vercel.app
```

Add Redirect URLs:

```txt
http://localhost:3000/**
http://localhost:3000/auth/callback
https://your-vercel-domain.vercel.app/**
https://your-vercel-domain.vercel.app/auth/callback
https://your-future-custom-domain.com/**
https://your-future-custom-domain.com/auth/callback
```

The app uses magic link auth. Magic links return to:

```txt
/auth/callback
```

The app also supports manual email/password account creation and login through Supabase Auth.

For small testing groups where you do not want confirmation emails:

1. In Supabase Dashboard, open Authentication.
2. Open the Email provider settings.
3. Keep the Email provider enabled.
4. Turn off the setting named `Confirm email` or similar.
5. Save the provider settings.

With email confirmation disabled, new password signup users receive an active session immediately and are redirected into the app without a confirmation email. Magic link login still requires email delivery because the email link is the login credential.

For a wider production launch, consider re-enabling email confirmation or configuring custom SMTP so Supabase email limits do not block onboarding.

If login emails arrive but the link fails, the usual cause is missing Supabase redirect URLs.

If magic links point to `http://localhost:3000/?code=...` in production:

1. In Vercel, set `APP_URL=https://your-vercel-domain.vercel.app`.
2. In Supabase Auth settings, set Site URL to the same Vercel URL.
3. In Supabase Auth Redirect URLs, add `https://your-vercel-domain.vercel.app/auth/callback`.
4. Redeploy or restart the Vercel deployment after changing env vars.
5. Send a new magic link. Old emails keep the old/bad URL.

## Vercel Deployment

1. Create a Vercel account at `https://vercel.com`.
2. Push this repo to GitHub or GitLab.
3. In Vercel, choose Add New Project.
4. Import the repo.
5. Use the Next.js framework preset.
6. Add all production environment variables.
7. Deploy.
8. Open the deployment URL and test login.

Vercel automatically redeploys when you push to the connected branch.

## Vercel Cron

`vercel.json` registers:

```txt
/api/admin/sync-world-cup?mode=results  daily at 08:00 UTC
/api/admin/recalculate-scores           daily at 08:15 UTC
```

Vercel Hobby only supports cron schedules that run once per day. Keep these daily schedules while the app is on Hobby. If you upgrade Vercel later, you can increase the frequency during the tournament.

Both routes require:

```txt
Authorization: Bearer $CRON_SECRET
```

When `CRON_SECRET` is set in Vercel, Vercel Cron sends that bearer header automatically.

Manual local test:

```powershell
$headers = @{
  Authorization = "Bearer $env:CRON_SECRET"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/admin/sync-world-cup" `
  -Headers $headers `
  -Body '{"mode":"results"}'

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/admin/sync-world-cup" `
  -Headers $headers `
  -Body '{"mode":"baseline"}'

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/admin/recalculate-scores" `
  -Headers $headers `
  -Body '{}'
```

Hosted test:

```powershell
$headers = @{
  Authorization = "Bearer your-production-cron-secret"
  "Content-Type" = "application/json"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-vercel-domain.vercel.app/api/admin/sync-world-cup" `
  -Headers $headers `
  -Body '{"mode":"results"}'

Invoke-RestMethod `
  -Method Post `
  -Uri "https://your-vercel-domain.vercel.app/api/admin/recalculate-scores" `
  -Headers $headers `
  -Body '{}'
```

If either hosted request returns `401`, the bearer token does not match the deployed `CRON_SECRET`.

## Production Migration Safety

Use:

```powershell
& "$env:APPDATA\npm\supabase.cmd" db push
```

Avoid production resets. Before risky schema changes:

1. Back up data from Supabase Dashboard.
2. Read the migration.
3. Apply to a staging project first if you have one.
4. Apply production migration.
5. Verify tables and app behavior.

If a migration fails:

1. Stop.
2. Read the exact error.
3. Do not run reset.
4. Fix the migration or repair migration history only after understanding the state.

## Deployment Checklist

Local:

- `npm install`
- `npm run typecheck`
- `npm run build`
- `supabase start`
- `supabase db reset`
- Login works locally
- League page works locally
- Draft room works locally
- Data sync route works locally
- Scoring recalculation route works locally

Supabase Cloud:

- Project created
- Project URL copied
- anon key copied
- service role key copied
- Migrations applied
- Auth Site URL configured
- Redirect URLs configured
- Email provider enabled
- `Confirm email` disabled if test users should log in without confirmation emails
- Realtime enabled for `drafts` and `draft_picks`
- Baseline World Cup data loaded

Vercel:

- Repo connected
- Env vars added
- `APP_URL` points at the deployed Vercel/custom domain
- First deploy succeeded
- App loads
- Magic link login works
- Email/password signup and login work
- League page works
- Draft room updates live
- Scoring/settings pages work
- Cron routes are registered
- Admin routes reject missing or wrong `CRON_SECRET`

## Troubleshooting

Missing environment variables:

- Vercel build or runtime logs will mention missing Supabase env vars.
- Check Vercel Project Settings, not `.env.local`.

Build works locally but fails on Vercel:

- Confirm all files are committed.
- Run `npm run build` locally before pushing.
- Check that the Vercel project uses the repo root.

Supabase auth redirect not working:

- Add the Vercel domain to Supabase Auth Redirect URLs.
- Include both local and production callback patterns.
- Make sure Vercel has `APP_URL` set to the production URL.

API route returns 401:

- Check `CRON_SECRET`.
- For manual tests, send `Authorization: Bearer your-secret`.

Database tables missing in production:

- Run `supabase db push`.
- Confirm you linked the correct Supabase project ref.

Production app points at local Supabase:

- `NEXT_PUBLIC_SUPABASE_URL` must be `https://...supabase.co`, not `http://127.0.0.1:54321`.
- `APP_URL` must be `https://your-vercel-domain.vercel.app`, not `http://localhost:3000`.

Service role key exposed:

- The service role key must only be `SUPABASE_SERVICE_ROLE_KEY`.
- Never use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Never import `createSupabaseAdminClient` in client components.

CORS or email link mistakes:

- For this app, most issues are Supabase Auth URL settings, not browser CORS.
- Recheck Site URL and Redirect URLs first.
