-- Poker Coach — a game remembers the case it was played with.
--
-- "Reuse" on the You screen sets the chip tool back up as it was for that evening, and
-- players and entry alone do not describe a setup: the colours, their counts, what each
-- chip was worth and whether those values were picked automatically are the rest of it.
-- All of that is stored here rather than derived, because the ladder and the defaults
-- can change and a record of a night that has already been played must not change with
-- them.
--
-- `deal` already holds the stacks that were dealt; this is the case they came out of.
-- Both are nullable for the rows written before this migration — a game recorded then
-- can still be read and reused for its players and entry, and simply has no case to
-- restore.

alter table public.games
  add column colors jsonb,
  add column auto_values boolean;
