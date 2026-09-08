-- Poker Coach — one evening, one row.
--
-- P19 starts recording the games the chip tool sets up, and dealing is not a single
-- event the way an answer is: the case gets edited and the stacks dealt again, twice or
-- three times, before anyone sits down. All of that is one evening. So the client keeps
-- a `client_event_id` across those deals and the row is upserted on it — the same
-- idempotency key the economy functions use (§3 rule 9), doing the same job for a table
-- that has no function in front of it and does not need one: nothing here is
-- economy-bearing, and RLS scopes every row to its owner already.
--
-- A game is settled once the end-of-game counts are entered. The client generates a new
-- id for the next deal after that, and this table sees a new row.
--
-- The default is what keeps the column addable: existing rows — and the pgTAP fixtures
-- that insert without it — get an id of their own rather than a failed migration.

alter table public.games
  add column client_event_id uuid not null default gen_random_uuid();

alter table public.games
  add constraint games_user_event_key unique (user_id, client_event_id);
