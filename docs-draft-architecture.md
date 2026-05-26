# Drafting Architecture

This MVP keeps the draft model intentionally small:

1. League members receive a fixed `draft_position`.
2. A league owns one row in `drafts`.
3. Every successful pick inserts one row in `draft_picks`.
4. The API increments `drafts.current_pick_number`.
5. The client subscribes to `drafts` and `draft_picks` through Supabase Realtime.

## Pick Flow

```mermaid
sequenceDiagram
  participant Client as Draft Room
  participant API as Next.js API
  participant DB as Supabase Postgres

  Client->>API: POST /api/draft/pick
  API->>DB: Read draft and members
  API->>API: Compute current snake turn
  API->>DB: Insert draft_picks row
  DB-->>API: Unique constraints validate availability
  API->>DB: Advance current_pick_number
  DB-->>Client: Realtime draft_picks event
```

## Why This Shape

- The database owns uniqueness for drafted teams, drafted players, and pick numbers.
- The app owns turn calculation because it is deterministic and easy to test.
- Realtime is table-based, so no custom websocket server is required for Vercel.
- The server route uses the Supabase service role because draft picks are league mutations that need consistent validation.
