-- ──────────────────────────────────────────────────── the answer key's one writer

-- `scripts/sync-content.ts` is the only thing that writes public.content_questions
-- (docs/accounts-plan.md §5 — the mirror is generated, never authored), and it connects
-- with the service-role key from .env.admin. Against the hosted project that call fails
-- with 42501, "permission denied for table content_questions", before it seeds a row.
--
-- 20260830120000_schema_and_rls.sql sets table grants explicitly rather than leaning on
-- Supabase's auto-expose default, which is the right instinct — but it names only anon
-- and authenticated. Unlike function EXECUTE, which Postgres grants to PUBLIC at
-- creation time, a new table's privileges go to no one, so service_role was left with
-- nothing to revoke and nothing to use.
--
-- An unseeded mirror is the failure CLAUDE.md describes from the other side: with
-- content_questions empty, submit_answer has nothing to mark against, so answers are
-- refused and report "not saved", hearts are never spent server-side, and the next
-- get_state() replaces the zero on screen with the untouched five.
--
-- Four privileges on one table: select to read the mirror back, insert and update for
-- the upsert, delete for questions no lesson asks any more. RLS is untouched — this is
-- a table privilege, not a policy — and the app never authenticates as service_role,
-- because that key stays in .env.admin and never reaches the client (§3 rule 2).

grant select, insert, update, delete on public.content_questions to service_role;
