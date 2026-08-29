# Real users — implementation plan

Turning Poker Coach from a single-session prototype into a multi-user app: accounts, profiles,
server-held course history, streak and hearts.

This document is the spec for that work. The prompts in
[§8](#8-the-prompts-in-dependency-order) are written to be pasted into Claude Code one at a time,
in order. Each one names the files it touches and the acceptance criteria it has to meet.

---

## 1. Decisions

| Question | Decision |
| --- | --- |
| Backend | **Supabase** — Postgres + Row Level Security, Auth, custom SMTP |
| Platforms | **iOS + Android**, custom dev builds, local toolchains |
| Sign-in methods | Email/password, **Google**, **Apple** (App Store guideline 4.8) |
| Email verification | Sent at sign-up, **soft gate** — a banner nags, lessons still play |
| Transactional email | Resend on **pokercoach.app**, wired into Supabase SMTP |
| Profile | Display name + **avatar picked from a built-in set** (no uploads) |
| Heart cost | **One per wrong answer.** At zero the drill ends, the lesson is *not* completed |
| Heart regen | **One every 4 hours whenever below max**, from the last heart lost |
| Streak | **One lesson per local day**, device timezone offset sent to the server. A missed day ends it |
| History kept | **Every completion and every answer given** |
| Offline | **Play offline, queue writes**, server reconciles on reconnect |
| Chip counter | **Case syncs, and real games are recorded** — "Your games" becomes real |
| Guest mode | **None** — login gates the app, as it does today |

## 2. What the app looks like after this

```
App.tsx
  └── AuthProvider          session, restored from SecureStore on cold start
        └── StoreProvider   the existing reducer, now hydrated from the server
              ├── AuthStack     Login · Sign up · Forgot · Reset · Profile setup
              └── Root          the four tabs, unchanged
```

Three layers, and the boundary between them is the point:

- **`src/auth/`** — session only. Knows about Supabase, knows nothing about lessons.
- **`src/server/`** — the typed RPC client and the offline outbox. The *only* module that talks
  to the database. Screens never import `supabase` directly.
- **`src/state/store.tsx`** — unchanged in shape. It keeps holding the same fields (`hearts`,
  `streak`, `xp`, `completedLessons`); they are simply filled from the server now instead of
  from constants, and mutations round-trip through `src/server/`.

That last point is what keeps this from becoming a rewrite. `useProgress()`, `courseProgress()`,
`DrillOverlay` and the Path all keep working against the same shapes.

## 3. Security rules, non-negotiable

These are the things that, if got wrong, make the rest pointless.

1. **RLS on every table, default deny.** No table ships without `enable row level security` and
   an explicit policy. A missing policy means no access, which is the correct failure mode.
2. **The service-role key never enters the app.** It exists in the Supabase dashboard and in the
   local `.env.admin` used by the content-sync script, and nowhere else. The anon key *is* public
   by design — it is safe only because RLS is doing the work.
3. **Hearts, streak, XP and completions are not client-writable.** Those tables get a `SELECT`
   policy and nothing more. Every mutation goes through a `SECURITY DEFINER` function that
   recomputes from `now()`. A modified client cannot `UPDATE player_state SET hearts = 5`,
   because there is no policy that would let it.
4. **Every `SECURITY DEFINER` function sets `search_path = ''`** and schema-qualifies every
   reference. Without it, a definer function is a privilege-escalation hole.
5. **The answer key lives on the server.** `content_questions` mirrors the correct option id of
   every question, generated from `course.ts`, so `submit_answer` decides right or wrong. The
   client never gets to assert "I was correct". See the note in §5 about how this coexists with
   the "content lives in `course.ts` and nowhere else" rule.
6. **The session is stored in the Keychain / Keystore**, via `expo-secure-store`, not
   AsyncStorage. SecureStore caps values at 2048 bytes and a Supabase session can exceed that,
   so the storage adapter chunks. This is the single easiest thing to get subtly wrong.
7. **Password reset never reveals whether an address exists.** Same copy, same timing, whether
   or not the account is real.
8. **Time comes from the server.** The client displays a countdown against a server-time offset
   captured at hydration, never against `Date.now()` alone. Changing the phone clock does
   nothing to hearts.
9. **Every write is idempotent**, keyed on a client-generated `client_event_id` with a unique
   index. A flaky connection replaying the outbox must not double-spend a heart or
   double-count a lesson.
10. **Account deletion is a first-class feature.** Apple 5.1.1(v) requires it, and so does GDPR.

## 4. Data model

```
auth.users                     (Supabase-managed)
  │
  ├─ profiles                  1:1  display_name, avatar_id
  ├─ player_state              1:1  hearts, hearts_settled_at, streak_count,
  │                                 streak_day, longest_streak, tz_offset_min
  ├─ answers                   1:N  lesson_id, question_index, chosen_option_id,
  │                                 is_correct, occurred_at, client_event_id
  ├─ lesson_completions        1:N  lesson_id, chapter_id, correct_count,
  │                                 question_count, occurred_at, client_event_id
  ├─ chip_cases                1:1  colors jsonb, players, buy_in, auto_values
  └─ games                     1:N  played_at, players, buy_in, dealt_stack, deal jsonb
        └─ game_seats          1:N  seat_index, name, end_points, balance_points

content_questions              (generated) chapter_id, lesson_id, question_index,
                                           correct_option_id, option_ids[]
```

Everything cascades on `auth.users` delete.

**XP and accuracy are derived, never stored.** XP is
`count(*) filter (where is_correct) * XP_PER_ANSWER` over `answers`; accuracy is correct over
total; the week chart is answers grouped by local day; mastery is completions per chapter. One
table of answers gives the whole You screen — and a derived number can never drift from
the history that produced it. A few hundred rows per user is nothing for Postgres.

## 5. The answer key, and the `course.ts` rule

`CLAUDE.md` says content lives in `src/content/course.ts` and nothing else holds course data.
That rule exists so there is one place to author a lesson. `content_questions` does not break it,
because it is **generated, never authored**:

- `scripts/sync-content.ts` reads `COURSE`, extracts `(chapter_id, lesson_id, question_index,
  correct_option_id, option_ids)` and upserts them with the service-role key.
- `src/content/course.test.ts` gains a case asserting the checked-in manifest hash matches the
  course, so the build fails if a lesson is edited and the mirror is not re-synced.
- The table has no write policy for anyone. Users can read it; only the admin script writes.

`CLAUDE.md` gets one line added saying so. Without this, XP and accuracy are whatever a patched
APK says they are.

## 6. Hearts and streak, specified

Both live in SQL as the authority, and are mirrored as pure functions in `src/lib/hearts.ts` for
optimistic UI and offline play. Both sides get tests. The duplication is deliberate and is called
out in the prompts, so the two never drift silently.

### Hearts

```
MAX_HEARTS      = 5
REGEN_INTERVAL  = 4 hours

settle(hearts, settled_at, now) -> (hearts', settled_at')
    if hearts >= MAX:  return (MAX, now)              # the clock idles at full
    granted  = floor((now - settled_at) / REGEN)
    hearts'  = min(MAX, hearts + granted)
    settled_at' = hearts' >= MAX
                    ? now                             # clock stops
                    : settled_at + granted * REGEN    # keep the remainder

spend(state, now)
    (h, t) = settle(state, now)
    if h == 0:  reject OUT_OF_HEARTS
    return (h - 1, h == MAX ? now : t)

next_heart_at(state, now)
    (h, t) = settle(state, now)
    return h >= MAX ? null : t + REGEN
```

Carrying the remainder in `settled_at` is the part that matters: a player who loses a heart
three hours into a regen must not lose those three hours.

### Streak

The client sends `occurred_at` and `tz_offset_min`; **it never sends a date**. The server clamps
`occurred_at` to `[now() - 7 days, now()]`, clamps the offset to ±840 minutes, and derives
`local_date` itself. So the worst a patched client can do is backdate an event by a week — which
can only fail to advance a streak, never extend one.

```
on complete_lesson(occurred_at, tz_offset_min)
    d = (clamp(occurred_at) + clamp(tz_offset_min))::date
    if streak_day is null        -> streak_count = 1
    elif d == streak_day         -> unchanged
    elif d == streak_day + 1     -> streak_count += 1
    elif d >  streak_day + 1     -> streak_count = 1
    elif d <  streak_day         -> unchanged        # a late offline event
    streak_day = greatest(streak_day, d)
```

### Losing a streak

`complete_lesson` only runs when a lesson is finished, so nothing in the rules above can end a
streak on its own — a player who stops for a week would still see 7 in the header. The streak is
therefore **stored as of `streak_day`, and read live**:

```
live_streak(streak_count, streak_day, today_local)
    if streak_day is null:              return 0
    if today_local - streak_day <= 1:   return streak_count   # today or yesterday
    return 0                                                  # lapsed
```

Yesterday still counts as alive. A player who did their lesson yesterday has until their local
midnight to keep the run, and the app must not tell them it is gone while they can still save it.
That gives three display states, and `get_state()` returns what each needs:

| State | When | What the app shows |
| --- | --- | --- |
| **Alive** | `streak_day == today` | The count, in the gold reward treatment |
| **At risk** | `streak_day == today - 1` | The count, plus the time left until local midnight |
| **Lapsed** | older, or never | Zero, in the plain muted treatment |

- `get_state()` returns `streak_count` already resolved through `live_streak`, plus
  `streak_at_risk` and `streak_expires_at` (the caller's next local midnight, as a timestamptz).
  The stored column is never zeroed on read — a lapse is *derived*, so there is no cron job, no
  write on read, and no way for the stored and displayed values to disagree.
- `player_state.longest_streak` records the best run, updated in `complete_lesson` as
  `greatest(longest_streak, streak_count)`. Losing a thirty-day streak should not erase the fact
  that it happened.
- **At risk is not an error state.** Red is reserved for the chip action, hearts, the "Playing"
  badge and chip focus rings, so the at-risk treatment is the gold hairline going hollow and a
  muted countdown — never a red pill.
- The live value goes stale if the app sits open across local midnight, so it is recomputed on
  hydrate and on every foreground.

### Zero hearts

`submit_answer` rejects with `OUT_OF_HEARTS` when the settled count is zero. The drill overlay
closes to an out-of-hearts screen showing the countdown to the next heart; the lesson is not
written to `lesson_completions`, so the Path is unchanged and the lesson can be replayed from
the start once a heart returns. `startLesson` refuses to open with zero hearts and the Path rows
render locked.

## 7. Phase 0 — setup you do by hand

Claude Code cannot click through these consoles. Do them first; several prompts are blocked
until they exist. **[phase-0-setup.md](phase-0-setup.md) is the step-by-step runbook** — this is
the summary of it.

- [ ] **Supabase project**, region `eu-central-1` (Frankfurt). Note the project URL and anon key.
- [ ] **Supabase CLI** linked locally: `npx supabase login`, `npx supabase link --project-ref …`.
- [ ] **Auth settings**: minimum password length 10, leaked-password protection on, email
      confirmation on. Redirect allowlist: `pokercoach://auth-callback`.
- [ ] **Google Cloud** project → OAuth consent screen → three clients: a **Web** client, an
      **iOS** client (bundle id), and an **Android** client (package name + the SHA-1 of your
      debug and release keystores). All three ids go in Supabase's Google provider
      **Client IDs** field; the *Web* one is also what the app passes as `webClientId`.
- [ ] **Apple Developer** (paid membership): an App ID with the Sign in with Apple capability.
      For the *native* flow that is all — Supabase needs only the bundle id in its Apple
      provider's **Client IDs** field. A Services ID and a `.p8` signing key belong to the
      web/OAuth flow and are not needed here.
- [ ] **Resend** account, `pokercoach.app` verified with SPF and DKIM records, then Supabase →
      Project Settings → Auth → SMTP pointed at it. Sender something like
      `no-reply@pokercoach.app`.
- [ ] **Bundle identifiers** chosen and set in `app.json` — e.g. `app.pokercoach.mobile` for
      both platforms. Google and Apple configs are keyed to these; changing them later means
      redoing both consoles.

## 8. The prompts, in dependency order

Five phases. Phase 1 is invisible to the user and everything else depends on it; do not start
phase 2 until `npm run typecheck` and `npm test` are green.

```
P1 ── P2 ── P3 ── P4
 │      │     └───────────────── P13
 └─ P5 ─┬─ P6 ── P7 ── P8
        ├─ P9 ── P10
        └─ P11
P3+P5 ── P12 ── P13 ── P14 ── P15 ── P16 ── P17
P12 ───── P18 ── P19
everything ── P20 ── P21
```

---

### Phase 1 — foundations

#### P1 · Supabase client, secure session storage, environment

> Wire this Expo app to Supabase, with the session stored securely. No UI changes.
>
> - Install with `npx expo install` so SDK 57 versions match: `@supabase/supabase-js`,
>   `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-crypto`,
>   `expo-linking`, `react-native-url-polyfill`. Add `expo-secure-store` to the `plugins`
>   array in `app.json`.
> - Add `src/auth/secureStorage.ts`: a Supabase-compatible storage adapter over
>   `expo-secure-store`. SecureStore rejects values over 2048 bytes, so chunk: store
>   `<key>.n` with the chunk count and `<key>.0…n-1` with the parts, and remove stale chunks
>   on write and on `removeItem`. Unit-test the chunking round-trip in
>   `src/auth/secureStorage.test.ts` against a fake SecureStore, including a value that
>   spans four chunks and a rewrite that shrinks the chunk count.
> - Add `src/auth/supabase.ts` exporting a single client, created with
>   `{ auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true,
>   detectSessionInUrl: false, flowType: 'pkce' } }`. Import `react-native-url-polyfill/auto`
>   at the top. Wire `AppState` so `startAutoRefresh` runs while active and `stopAutoRefresh`
>   when backgrounded.
> - Read config from `process.env.EXPO_PUBLIC_SUPABASE_URL` and
>   `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Throw a clear error at module load if either is missing —
>   a silent undefined here surfaces as an unexplained 401 much later. Add `.env.example`
>   with both keys blank and add `.env` and `.env.admin` to `.gitignore` (it currently only
>   ignores `.env*.local`).
> - Move `MAX_HEARTS` out of `src/state/store.tsx` into a new `src/lib/hearts.ts` and update
>   the `src/components/ui.tsx` import — a UI primitive importing from the store is a cycle
>   waiting to happen.
>
> `npm run typecheck` and `npm test` must pass.

#### P2 · Schema and RLS

*Depends on P1 and Phase 0.*

> Create the database schema for Poker Coach as a Supabase migration. Add the Supabase CLI as a
> dev dependency and put migrations in `supabase/migrations/`. Read `docs/accounts-plan.md`
> §4 for the model and §3 for the rules.
>
> Tables: `profiles`, `player_state`, `answers`, `lesson_completions`, `content_questions`,
> `chip_cases`, `games`, `game_seats`. Every user-owned table has `user_id uuid not null
> references auth.users(id) on delete cascade`.
>
> - `profiles`: `display_name text` (2–24 chars, checked), `avatar_id text`, timestamps.
> - `player_state`: `hearts int not null default 5 check (hearts between 0 and 5)`,
>   `hearts_settled_at timestamptz not null default now()`, `streak_count int not null
>   default 0`, `streak_day date`, `longest_streak int not null default 0`,
>   `tz_offset_min int not null default 0`.
> - `answers`: `lesson_id text`, `question_index int`, `chosen_option_id text`,
>   `is_correct boolean`, `occurred_at timestamptz`, `client_event_id uuid`. Unique index on
>   `(user_id, client_event_id)`. Index on `(user_id, occurred_at desc)`.
> - `lesson_completions`: `lesson_id text`, `chapter_id text`, `correct_count int`,
>   `question_count int`, `occurred_at timestamptz`, `client_event_id uuid`. Unique on
>   `(user_id, client_event_id)` and on `(user_id, lesson_id)` — a lesson completes once.
> - `content_questions`: `chapter_id text`, `lesson_id text`, `question_index int`,
>   `correct_option_id text`, `option_ids text[]`, primary key `(lesson_id, question_index)`.
>   Not user-owned.
> - A trigger on `auth.users` insert that creates the matching `profiles` and `player_state`
>   rows, so no code path can leave a user without state.
>
> RLS on every table, default deny:
> - `profiles`: select and update own row. The update policy must not let a user change
>   anything but `display_name` and `avatar_id` — enforce with a trigger that rejects changes
>   to other columns rather than trusting a column list.
> - `player_state`, `answers`, `lesson_completions`: **select own rows only. No insert, update
>   or delete policy at all** — these change only through the functions in P3.
> - `content_questions`: select to `authenticated`, no write policy.
> - `chip_cases`, `games`, `game_seats`: full CRUD scoped to `auth.uid() = user_id`;
>   `game_seats` scopes through its parent game.
>
> Add `supabase/tests/rls.test.sql` (pgTAP) proving, for two seeded users, that A cannot read
> B's rows in every user-owned table and that a direct `update player_state set hearts = 5`
> as an authenticated user fails. Document `npx supabase db reset` and `npx supabase test db`
> in the README's script table.

#### P3 · The server-authoritative functions

*Depends on P2.*

> Implement the hearts, streak and progress logic as Postgres functions in a new migration.
> `docs/accounts-plan.md` §6 specifies the algorithms exactly — follow the pseudocode,
> including carrying the regen remainder in `hearts_settled_at`.
>
> Every function: `security definer`, `set search_path = ''`, every reference schema-qualified,
> `revoke execute on function … from public` then `grant execute … to authenticated`.
>
> - `public.settle_hearts(hearts int, settled_at timestamptz, at timestamptz)` — pure, returns
>   `(hearts int, settled_at timestamptz)`.
> - `public.live_streak(streak_count int, streak_day date, today_local date)` — pure, returns
>   the streak as it stands today: the stored count if `streak_day` is today or yesterday,
>   otherwise zero. §6 "Losing a streak" has the rule.
> - `public.get_state()` — settles the caller's hearts, persists the settlement, and returns
>   json: `hearts`, `next_heart_at`, `streak_count` (already resolved through `live_streak`),
>   `streak_at_risk`, `streak_expires_at`, `longest_streak`, `xp`, `accuracy`,
>   `completed_lesson_ids`, `server_now`. It must never zero the stored `streak_count` — a
>   lapse is derived, not written.
> - `public.submit_answer(p_lesson_id text, p_question_index int, p_chosen_option_id text,
>   p_occurred_at timestamptz, p_tz_offset_min int, p_client_event_id uuid)` — clamps
>   `occurred_at` to `[now() - 7 days, now()]` and the offset to ±840; looks the correct option
>   up in `content_questions` and **decides correctness itself**; raises `OUT_OF_HEARTS` if the
>   settled count is zero; spends a heart on a wrong answer; inserts the answer row
>   `on conflict (user_id, client_event_id) do nothing` and returns the stored row's outcome so
>   a replay is a no-op. Returns `is_correct`, `hearts`, `next_heart_at`.
> - `public.complete_lesson(p_lesson_id text, p_chapter_id text, p_occurred_at timestamptz,
>   p_tz_offset_min int, p_client_event_id uuid)` — rejects if the caller has no answer rows
>   for that lesson, or if the lesson is already completed; applies the streak rule from §6;
>   returns the new state.
> - `public.set_profile(p_display_name text, p_avatar_id text)`.
> - `public.delete_account()` — deletes the caller from `auth.users`, cascading everything.
>
> Mirror `settle`, `spend` and `next_heart_at` as pure TypeScript in `src/lib/hearts.ts` for
> optimistic UI and offline play, with `src/lib/hearts.test.ts` covering: regen across the
> 4-hour boundary, the remainder surviving a spend, the clock idling at full, spending from
> full starting the clock at that instant, and never exceeding `MAX_HEARTS`.
>
> Mirror `live_streak` the same way in `src/lib/streak.ts`, with `src/lib/streak.test.ts`
> covering: a lesson today, a lesson yesterday (still alive, at risk), two days ago (lapsed),
> a null `streak_day`, and the local-midnight boundary either side.
>
> Add `supabase/tests/economy.test.sql` (pgTAP) asserting the same cases against the SQL, plus
> a replayed `client_event_id` spending only one heart, and a wrong answer at zero hearts
> raising rather than going negative. **The TypeScript and the SQL must agree case for case —
> list the shared cases in a comment at the top of both files.**

#### P4 · The answer-key mirror

*Depends on P2 and P3.*

> Generate `content_questions` from `src/content/course.ts` so the server owns the answer key.
> Read `docs/accounts-plan.md` §5 first — this is the one place course data lives outside
> `course.ts`, and it must be generated, never authored.
>
> - `scripts/sync-content.ts`: walks `COURSE`, emits one row per drill question
>   (`chapter_id`, `lesson_id`, `question_index`, `correct_option_id`, `option_ids`), and
>   upserts them with the service-role key read from `.env.admin`. It must delete rows for
>   questions that no longer exist. Skip `table` lessons — the union has two members and this
>   script must stay total over both. Add `npm run sync:content`.
> - Write a stable manifest hash of the extracted rows to `src/content/content-hash.json`, and
>   add a case to `src/content/course.test.ts` that recomputes it and fails if it differs.
>   The message should say to run `npm run sync:content`.
> - Add a line to `CLAUDE.md` under "Content" recording that `content_questions` is a generated
>   mirror of the answer key, that it is never hand-edited, and that editing a question means
>   re-running the sync.

---

### Phase 2 — authentication

#### P5 · Session layer

*Depends on P1.*

> Add the auth session layer. Still no new screens — this prompt makes `authed` real.
>
> - `src/auth/AuthProvider.tsx`: holds `session`, `user`, `status`
>   (`'loading' | 'signedOut' | 'signedIn'`) and `emailVerified`. Restores the session on
>   mount via `getSession()`, then subscribes to `onAuthStateChange`. Exposes
>   `signInWithPassword`, `signUp`, `signOut`, `sendPasswordReset`, `updatePassword`,
>   `resendVerification`.
> - `src/auth/errors.ts`: maps Supabase `AuthError` codes to copy in the app's voice —
>   `invalid_credentials` becomes "That email and password don't match." and so on. **Never
>   distinguish a wrong password from an unknown address**, and never surface a raw Supabase
>   string to the user. Unit-test the mapping, including an unknown code falling back to a
>   generic message.
> - `App.tsx`: wrap `StoreProvider` in `AuthProvider`. While `status === 'loading'` render the
>   existing blank felt view rather than flashing the login screen — a cold start with a valid
>   session must not show it at all. Replace the store's `authed` flag and its `signIn` /
>   `signOut` actions with the provider's state; `signOut` calls `supabase.auth.signOut()` and
>   clears the store back to its initial values.
> - Delete `email` and `pass` from the store — form state belongs to the form.

#### P6 · Login screen, wired

*Depends on P5.*

> Make `src/screens/LoginScreen.tsx` really sign in. Keep the layout, the aces, the type scale
> and the copy exactly as they are — this is wiring, not redesign. Compare against
> `docs/design-handoff/screens/01-login.png`.
>
> - Local form state, trimmed and lowercased email, client-side check for a plausible address
>   and a non-empty password before hitting the network.
> - A submitting state on the `RewardButton` (disabled, label to "Dealing…"), and an error
>   line under the fields using `colors.red` at the 11px muted scale. Errors clear on edit.
> - Keep the `Rise` entrance and `KeyboardAvoidingView`. `returnKeyType` and `onSubmitEditing`
>   should move email → password → submit.
> - "Create an account" and "Forgot password?" become real navigation. Add a
>   `screen: 'login' | 'signUp' | 'forgot' | 'reset' | 'profileSetup'` field to the auth
>   provider so `App.tsx` picks which of the auth screens renders — no navigation library,
>   matching the conditional-render pattern the app already uses.

#### P7 · Sign-up and the verification banner

*Depends on P6.*

> Add `src/screens/SignUpScreen.tsx` and the unverified-email banner.
>
> - Fields: email, password, confirm password. Show password requirements up front rather than
>   as an error after the fact — minimum 10 characters, matching the Supabase project setting.
>   A strength hint is fine; a hard rule beyond length is not.
> - On success Supabase returns a session (confirmation is a soft gate), so route straight to
>   the profile-setup screen from P11. If the address is already registered, Supabase returns
>   a fake user rather than an error to avoid enumeration — detect the
>   `identities: []` shape and show the same neutral "Check your inbox" state you'd show for a
>   real sign-up. Do not tell the caller the address exists.
> - `src/components/VerifyBanner.tsx`: a thin surface-coloured strip under the header, shown
>   when `session.user.email_confirmed_at` is null and the user signed up with a password.
>   Copy in the app's voice, a "Resend" action with a 60-second cooldown, and dismissible for
>   the session. Not shown for Google or Apple users. Render it in `App.tsx` below `Header`.
> - Reuse the login screen's input styles — lift them into `src/components/ui.tsx` as an
>   `AuthField` primitive and have both screens use it.

#### P8 · Forgot password and reset

*Depends on P7.*

> Add password reset, end to end.
>
> - `src/screens/ForgotScreen.tsx`: one email field. Always shows the same confirmation —
>   "If that address has an account, a link is on its way." — whether or not it does. Call
>   `resetPasswordForEmail(email, { redirectTo: 'pokercoach://auth-callback' })`.
> - Deep links: add `src/auth/deepLinks.ts` using `expo-linking` to handle both the cold-start
>   URL (`Linking.getInitialURL`) and the warm one (the `url` event). A recovery link must put
>   the app on the reset screen; a confirmation link should refresh the session so the banner
>   disappears. `pokercoach` is already the scheme in `app.json`.
> - `src/screens/ResetScreen.tsx`: new password plus confirm, calling `updateUser`. On success,
>   sign out every other session (`signOut({ scope: 'others' })`) — a reset exists because the
>   old password may be compromised, so the other devices must not stay signed in. Then route
>   to the app.
> - An expired or already-used link must land on a clear "This link has expired" state with a
>   path back to the forgot screen, not a blank one.
>
> Verify on a device: request a reset, open the emailed link, land on the reset screen, set a
> new password, and confirm the old one no longer works.

#### P9 · Google sign-in

*Depends on P5 and Phase 0's Google clients.*

> Wire native Google sign-in. Use the **ID-token flow**, not the browser redirect — it is both
> nicer and more secure on native.
>
> - `npx expo install @react-native-google-signin/google-signin`, add it to `app.json`
>   `plugins` with the iOS URL scheme, and set the `webClientId` (the *Web* OAuth client, not
>   the platform ones) plus `iosClientId` from `EXPO_PUBLIC_` env vars.
> - `src/auth/google.ts`: `GoogleSignin.configure`, `hasPlayServices`, `signIn`, then
>   `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. Handle
>   `SIGN_IN_CANCELLED` as a silent no-op — a cancelled sign-in is not an error and must not
>   show an error line.
> - Wire the existing "Continue with Google" `Pressable` in `LoginScreen`, with a pressed and
>   a busy state. Keep the button exactly as designed: white `colors.cardFace`, the `GoogleIcon`,
>   14px bold `colors.cardInk`.
> - A Google account whose email matches an existing password account links to the same user
>   only if the address is verified on both sides — confirm the Supabase project's linking
>   setting matches that and note the chosen behaviour in the README.
>
> This needs a custom dev build (`npx expo prebuild` then a local run); it cannot be verified in
> Expo Go. Test on a device before moving on.

#### P10 · Apple sign-in

*Depends on P9 (for the shared button row) and Phase 0's Apple config.*

> Add Sign in with Apple, iOS only, required by App Store guideline 4.8.
>
> - `npx expo install expo-apple-authentication`, add the plugin and set
>   `ios.usesAppleSignIn: true` in `app.json`.
> - `src/auth/apple.ts`: request `FULL_NAME` and `EMAIL` scopes, then
>   `signInWithIdToken({ provider: 'apple', token: credential.identityToken })`.
> - **Apple returns the display name exactly once, on first authorisation, and never again.**
>   Capture it there and pass it as the default into profile setup. Missing this is the classic
>   Apple sign-in bug and it is unrecoverable per account.
> - Apple's private relay addresses (`@privaterelay.appleid.com`) must be treated as valid and
>   never shown as a "confirm your email" prompt.
> - Render `<AppleAuthentication.AppleAuthenticationButton>` with the black style and the
>   pill radius, above the Google button, gated on `Platform.OS === 'ios'` and
>   `isAvailableAsync()`. Rebalance the divider and footer spacing so the three-button stack
>   still matches the handoff's rhythm — screenshot it against
>   `docs/design-handoff/screens/01-login.png` and note the deviation in the README.

#### P11 · Profile setup

*Depends on P5 and P3's `set_profile`.*

> Add the profile step: display name and an avatar from a built-in set. No uploads.
>
> - `src/data/avatars.ts`: twelve to sixteen avatars, each `{ id, glyph, fill, ink }`, drawn
>   from the existing palette — the four suits across `greenDeep`, `reward`, `surface` and
>   `rewardAlt` grounds. Ids are stable strings; the rendering lives in
>   `src/components/Avatar.tsx`, which takes an `avatar_id` and a size and falls back to
>   initials from `shortName()` in `src/lib/names.ts` when the id is unknown.
> - `src/screens/ProfileSetupScreen.tsx`: name field (2–24 characters, the same cap as
>   `NAME_MAX_LENGTH`), a grid of avatars following the `SwatchPicker` interaction pattern, and
>   a `RewardButton` to finish. Shown once after sign-up, and reachable again from the You
>   screen as "Edit profile".
> - Replace `PROFILE` in `src/data/profile.ts` with the real profile on the You screen: the
>   `Avatar`, the display name, and a subtitle built from real numbers (`Unit N · {streak}-day
>   streak`) rather than the sample "Level 4 · Friday-night regular".
> - Both writes go through the `set_profile` RPC, never a direct table update.

---

### Phase 3 — progress, hearts and streak

#### P12 · Hydrate the store from the server

*Depends on P3 and P5.*

> Replace the store's sample values with real server state. This is the load-bearing prompt of
> the whole plan — keep the store's shape identical so `useProgress`, `courseProgress`, the
> Path, the Home CTA and the mastery bars keep working untouched.
>
> - `src/server/client.ts`: typed wrappers over the RPCs from P3 (`getState`, `submitAnswer`,
>   `completeLesson`, `setProfile`, `deleteAccount`). Generate the database types with
>   `npx supabase gen types typescript` into `src/server/database.types.ts` and add
>   `npm run gen:types`. Screens must never import `supabase` directly — only `src/server/`.
> - `src/server/useHydrate.ts`: on sign-in, call `get_state()` and dispatch a `hydrate` action
>   filling `hearts`, `streak`, `xp` and `completedLessons`. Store the
>   `server_now - Date.now()` delta as `clockOffset` in the store; every countdown in the app
>   uses it, and nothing uses raw device time.
> - Store changes: add `hydrated: boolean`, `nextHeartAt: string | null`, `clockOffset: number`,
>   `syncing: boolean`, `syncError: string | null`. Delete the sample seeds — `hearts: 4`,
>   `xp: 1240`, `streak: 7` all start empty and arrive from the server.
> - Until `hydrated`, the tab screens render their existing layout with skeleton values rather
>   than zeroes, so a slow network doesn't flash "0 day streak" at a user with a 40-day one.
> - Cache the last hydrated state in AsyncStorage keyed by user id, and hydrate from it
>   immediately on cold start before the network answers. This cache is display-only and is
>   always overwritten by the server's answer.

#### P13 · Answers and completions through the server

*Depends on P12 and P4.*

> Route the drill through the server so hearts and history are real.
>
> - `src/state/store.tsx` `pick`: still updates the UI immediately (the answer feedback must
>   not wait on a network round trip), but now fires `submitAnswer` with a
>   `client_event_id` from `Crypto.randomUUID()`, `occurred_at`, and the device's
>   `tz_offset_min`. The server's verdict is authoritative: if it disagrees with the optimistic
>   one, adopt the server's `hearts` and `next_heart_at`. Correctness itself comes from the
>   local course for rendering, and from the server for the record.
> - `nextQuestion` on the last question calls `completeLesson` before setting `drillDone`, and
>   only adds to `completedLessons` once the server confirms. A rejected completion shows the
>   reason on the done card rather than silently not saving.
> - `OUT_OF_HEARTS` from `submitAnswer` ends the drill immediately: do not mark the lesson
>   complete, do not advance, hand off to the out-of-hearts screen from P14.
> - XP stops being incremented locally — it is derived server-side and arrives with the state.
>   `gained` stays local for the "+N XP" on the done card.
> - Add `src/state/store.test.ts` covering the reducer against a faked server: a correct
>   answer, a wrong answer spending a heart, a server verdict overriding an optimistic one,
>   and a duplicate `client_event_id` not double-spending.

#### P14 · Out of hearts, and blocking lessons

*Depends on P13.*

> Make running out of hearts mean something.
>
> - `src/screens/OutOfHeartsScreen.tsx`: an overlay in the drill's own visual language — felt
>   ground, a large `♥` in `colors.red`, the count, and a live countdown to the next heart
>   computed from `nextHeartAt` and the store's `clockOffset`. Copy in the app's voice
>   ("You're out. The next one lands in 3:41.") and one way out, back to Home.
> - `HeartsPill` in `src/components/ui.tsx` gains an optional countdown for when hearts are
>   below max, shown in the header at the 9px uppercase muted scale.
> - `startLesson` and `startNextLesson` refuse to open a lesson at zero hearts and show the
>   out-of-hearts screen instead. On the Path, rows render locked with the existing locked
>   treatment while hearts are zero — do not invent a new state; reuse `ChapterState`'s
>   `'locked'` rendering and keep the badge copy accurate.
> - The Home "Deal me in" CTA loses its `glow` at zero hearts and reads "Out of hearts".
> - The countdown must tick without re-rendering the whole tree — a small `useCountdown` hook
>   with its own interval, cleared on unmount.
>
> Verify the whole loop on a device: answer wrong five times, watch the drill end, see the
> Path lock, and confirm the countdown survives a background/foreground cycle and a cold
> start.

#### P15 · Losing a streak

*Depends on P13.*

> Make the streak end when a day is missed. Right now nothing can end one: `complete_lesson`
> only runs when a lesson is finished, so a player who stops for a week still sees their old
> count. Read `docs/accounts-plan.md` §6 "Losing a streak" — the rule and the three display
> states are specified there.
>
> - The server work landed in P3 (`live_streak`, and `get_state()` returning `streak_count`
>   already resolved, plus `streak_at_risk`, `streak_expires_at` and `longest_streak`). This
>   prompt is the client half. If `get_state()` does not yet return those fields, add them.
> - `src/state/store.tsx`: hold `streakAtRisk`, `streakExpiresAt` and `longestStreak` beside
>   the existing `streak`. Recompute the live value with `src/lib/streak.ts` on hydrate and on
>   every `AppState` change to `active` — a phone left open across local midnight must not go
>   on showing yesterday's streak as safe.
> - `StreakPill` in `src/components/ui.tsx` gains the three states from §6. **Alive** is
>   today's gold `GoldFrame` treatment, unchanged. **At risk** keeps the count but drops the
>   gold fill for the hollow hairline, with the time left until midnight at the 9px uppercase
>   muted scale. **Lapsed** shows `0` in the plain muted pill with no frame at all. At risk is
>   not an error — do not reach for `colors.red`, which belongs to the chip action, hearts,
>   the "Playing" badge and the chip tool's focus rings.
> - A streak that has just ended is acknowledged once, not nagged: when the app hydrates and
>   finds a stored `streak_count > 0` resolving live to zero, show a single dismissible card on
>   Home — the number that ended, the longest run, and the CTA back into a lesson. Record the
>   acknowledgement in AsyncStorage keyed by user id and `streak_day` so it appears once per
>   lapse, and never for a player who has never had a streak.
> - The Home hero ("Today's hand") reads the at-risk state: with the streak alive but nothing
>   done today, the copy says how long is left rather than showing the generic daily goal.
> - `YouScreen`'s "Day streak" stat shows the live count, and gains the longest run underneath
>   it at the existing micro scale.
>
> Add cases to `src/state/store.test.ts`: hydrating with a lapsed streak shows zero without
> writing anything, hydrating at risk sets the flag, and a foreground crossing local midnight
> moves alive → at risk → lapsed.

#### P16 · Offline outbox

*Depends on P15.*

> Make lessons playable without a connection.
>
> - `src/server/outbox.ts`: an AsyncStorage-backed queue of pending mutations, each
>   `{ client_event_id, kind, payload, occurred_at }`. Enqueue on every `submitAnswer` and
>   `completeLesson`; flush in `occurred_at` order on reconnect, on app foreground, and after
>   a successful hydrate. Because every RPC is idempotent on `client_event_id`, a flush that
>   half-fails is safe to retry whole.
> - Hearts spend optimistically offline using the pure functions in `src/lib/hearts.ts`. On
>   flush, the server's returned state wins outright — if the server says the player was out of
>   hearts partway through the queue, later events are rejected and the client adopts the
>   corrected state. Show that honestly ("Some progress couldn't be saved") rather than
>   pretending it synced.
> - Cap the queue (say 500 events) and drop the oldest with a logged warning rather than
>   growing without bound.
> - A small offline indicator in the header — reuse the pill shape, no new visual language.
> - Test `outbox.ts` in isolation: ordering, idempotent replay, partial failure, cap
>   behaviour, and a queue surviving a cold start.

#### P17 · Real statistics

*Depends on P16.*

> Replace the last of the sample data on Home and You with real numbers.
>
> - Extend `get_state()` (a new migration) or add a `get_stats()` RPC returning: accuracy over
>   all answers, answers per local day for the last seven days, per-chapter completion counts,
>   and total lessons completed.
> - `src/screens/YouScreen.tsx`: `HOME_STATS`-style hardcoded 78% accuracy and
>   `PROFILE.gamesTotal` become real. Mastery bars already derive from `useProgress` — leave
>   them.
> - `src/screens/HomeScreen.tsx`: the `WEEK` chart becomes the real seven days, scaled so the
>   tallest bar is 74pt as the handoff specifies, with an empty-week state that doesn't look
>   broken. `DAILY_GOAL` becomes lessons completed today against a goal of three.
> - `COACH_NOTE` has no data behind it — leave it as authored copy and mark it clearly in
>   `src/data/profile.ts` as the one remaining sample value, or drop the card. Do not invent a
>   fake insight from real data.
> - Delete everything from `src/data/profile.ts` that is now dead.

---

### Phase 4 — the chip counter

#### P18 · Sync the chip case

*Depends on P12.*

> Persist the chip case per user.
>
> - `src/server/chipCase.ts`: load on hydrate, save debounced (about 800ms) after any change to
>   colours, players, buy-in or auto-values. `chip_cases` is plain RLS-protected CRUD — no RPC
>   needed, since nothing here is economy-bearing.
> - A new user gets `DEFAULT_COLORS` from `src/data/chipCase.ts` written on first save, not on
>   sign-up — an untouched case should not create a row.
> - The save must not fight the user: debounce, last-write-wins, and never block the UI or
>   invalidate a deal. Failures are silent apart from a single retry.

#### P19 · Record real games

*Depends on P18.*

> Make "Your games" real, replacing the `GAMES` sample array.
>
> - Dealing the stacks writes a `games` row (`played_at`, `players`, `buy_in`, `dealt_stack`,
>   and the `DealResult` as jsonb) with a `client_event_id`. Editing the case and dealing again
>   updates the same row until the game is settled, so one evening is one row.
> - Entering end-of-game counts on the Balance screen writes `game_seats` — one row per seat
>   with the name, `end_points` and the computed `balance_points`. The maths stays in
>   `src/lib/balance.ts`; the server stores the result, it does not recompute it.
> - `src/screens/YouScreen.tsx` reads the last three games from the server, keeping the exact
>   row design — date, detail line, signed net in units, "Reuse". The detail line is built from
>   the stored values (`6 players · 20 units in · 1,900 pts dealt`). `Reuse` loads players and
>   buy-in back into the chip tool as it does now.
> - `gamesTotal` becomes a real count. An account with no games shows an empty state rather
>   than an empty panel.
> - Update the README: "Setting up a game does not append to Your games" comes out of the
>   "What isn't built yet" list.

---

### Phase 5 — hardening and release readiness

#### P20 · Account deletion, export and legal

*Depends on everything above.*

> Add the account controls that Apple and GDPR both require.
>
> - A "Delete account" action on the You screen under "Log out", in the same restrained
>   treatment — no red button. A confirmation sheet that requires typing DELETE, states plainly
>   what is lost (progress, streak, games) and that it cannot be undone, then calls the
>   `delete_account` RPC and signs out. Apple 5.1.1(v) requires this to be reachable in-app,
>   not via a support email.
> - "Export my data": a `get_export()` RPC returning the caller's profile, answers,
>   completions and games as json, saved with `expo-file-system` and offered through
>   `expo-sharing`.
> - Privacy policy and terms links on the login screen and in You, pointing at
>   `pokercoach.app`. Both stores reject without a reachable privacy policy URL.
> - Confirm every `on delete cascade` actually fires — add a pgTAP case that deletes a user and
>   asserts zero rows remain in all seven user-owned tables.

#### P21 · Security review and documentation

*Depends on P20.*

> Final pass before this is real.
>
> - Run `/security-review` over the whole diff of this work.
> - Audit against `docs/accounts-plan.md` §3, one rule at a time, and write the findings into
>   the PR description. Specifically confirm: no table lacks RLS; no `SECURITY DEFINER`
>   function lacks `set search_path = ''`; the service key appears nowhere in the app source
>   or in git history; `player_state`, `answers` and `lesson_completions` have no write policy;
>   the reset flow cannot enumerate addresses.
> - Check Supabase's auth rate limits are on, and that the anon key in the bundle is the anon
>   key and not the service key — grep the built bundle, don't assume.
> - Update `README.md`: the stack section gains Supabase; "What isn't built yet" loses the
>   sign-up, reset, OAuth, persistence and games lines; add a "Running the backend" section
>   covering `.env`, `npx supabase db reset`, `npm run sync:content` and the dev-build
>   requirement for Google and Apple sign-in.
> - Update `CLAUDE.md`: the three-layer boundary from §2 (screens never import `supabase`), the
>   rule that hearts, streak and XP are server-derived and must not be written client-side, and
>   the `content_questions` note from P4 if it is not already there.
> - Update `docs/authoring-lessons.md`: adding or editing a question now means re-running
>   `npm run sync:content`, and the content-hash test that enforces it.

## 9. Things that will bite

- **SecureStore's 2048-byte cap.** Sessions with a long Google ID token exceed it. If P1's
  chunking is wrong, sign-in works and then silently fails to survive a cold start — the worst
  kind of bug to find late. Test it with a deliberately oversized value.
- **Apple's one-shot name.** The display name comes back on the first authorisation only. Lose
  it and it is gone for that account, permanently.
- **The `/ios` and `/android` folders are gitignored**, so the native config lives in `app.json`
  plugins and nowhere else. Anything configured by hand in a generated folder is erased by the
  next `prebuild`.
- **Two implementations of the heart clock**, in SQL and in TypeScript. P3 requires the shared
  case list in both test files; keep it, or they drift within a month.
- **Optimistic answers versus the server's verdict.** They agree as long as the content mirror
  is in sync. P4's hash test is what keeps that true — do not skip it because it is annoying.
- **Bundle identifiers are load-bearing.** Google and Apple keys are tied to them. Choose them
  in Phase 0 and do not change them afterwards.
- **Streak timezones.** A user flying Madrid → Mexico City gets a longer local day. The ±840
  clamp bounds the abuse; it does not eliminate a generous edge case, which is the right
  trade for a learning app.
