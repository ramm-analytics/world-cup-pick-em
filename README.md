# World Cup Pick'em

A clean MVP full-stack fantasy pick'em application for the 2026 FIFA World Cup. Managers create or join leagues, run a snake draft for national teams and individual players, and track rosters and standings.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-compatible components
- Supabase Postgres, Auth, RLS, and Realtime
- Vercel-ready deployment

## Project Structure

```txt
app/                         Next.js routes and API handlers
  api/draft/pick/route.ts     Server-side draft pick endpoint
  api/draft/start/route.ts    Starts a pending draft
  api/leagues/                Create/join league endpoints
  leagues/[leagueId]/         League dashboard and draft room
components/                  Reusable UI, league, and draft components
lib/                         API helpers, Supabase clients, draft logic
types/                       Typesafe database model contracts
supabase/
  migrations/                 Postgres schema
  seed/                       Example World Cup pool data
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Start Supabase locally:

```bash
supabase start
supabase db reset
```

4. Put the generated Supabase URL, anon key, and service role key into `.env.local`.

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Without Supabase env vars, the app runs in demo mode with seeded in-memory data so the UI can be reviewed immediately.

## Supabase Setup

Migrations live in `supabase/migrations`. The initial schema creates:

- `profiles`
- `leagues`
- `league_members`
- `national_teams`
- `players`
- `drafts`
- `draft_picks`
- `matches`
- `player_match_stats`
- `league_standings` view

The auth MVP migration adds `profiles.username` and tightens profile RLS so authenticated users can only read, insert, or update their own profile row. Realtime is enabled for `drafts` and `draft_picks`. The browser draft room subscribes to those tables so other managers see picks and clock changes quickly.

Run migrations locally with the Supabase CLI:

```bash
supabase start
supabase db reset
```

For an already-running local database, use:

```bash
supabase migration up
```

For hosted Supabase:

```bash
supabase link --project-ref your-project-ref
supabase db push
supabase db seed --file supabase/seed/seed.sql
```

## Draft Architecture

The draft MVP uses a small shared core:

- `lib/draft/order.ts` builds the snake draft order from `league_members.draft_position`.
- `app/api/draft/pick/route.ts` validates a pick, checks the current turn, inserts into `draft_picks`, then advances `drafts.current_pick_number`.
- Unique database constraints prevent a team, player, or pick number from being drafted twice in the same draft.
- `components/draft/draft-room.tsx` renders the board and subscribes to Supabase Realtime for live updates.

Draft order rotates automatically by reversing member order on even rounds:

```txt
Round 1: 1, 2, 3, 4
Round 2: 4, 3, 2, 1
Round 3: 1, 2, 3, 4
```

## Scoring

Scoring rules are stored on each league as JSON:

```json
{
  "team_win": 3,
  "team_draw": 1,
  "team_goal": 1,
  "player_goal": 4,
  "player_assist": 3,
  "clean_sheet": 2
}
```

The `league_standings` view reads drafted rosters, match results, player stats, and league scoring rules. When match and player-stat rows change, standings are recalculated by Postgres on read.

## Deployment

1. Create a Supabase project and run the migration.
2. Add these Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy to Vercel:

```bash
vercel
```

## MVP Gaps To Expand Later

- League creation/join server actions
- Draft start/admin controls
- Pick timers with auto-pick
- Official match data ingestion
- Rich player stat categories
