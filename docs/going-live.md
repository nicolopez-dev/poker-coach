# Going live

From where the app is today to a Play Store listing real people can install, in the order the
steps actually depend on each other. Android is the spine here; iOS differences are called out
where they matter.

[`phase-0-setup.md`](phase-0-setup.md) is the account-by-account setup that came before the
code, and [`environments.md`](environments.md) is where staging and production are meant to
sit. This is the release. It stands on its own — where those two matter, what matters is
repeated here rather than pointed at.

## What ships, and in what order

Three separate artifacts, and only one of them is the app:

| | Where | Gates the next step? |
| --- | --- | --- |
| **Legal pages** — privacy policy, terms, account-deletion page | any static host | Yes — the consent screen and the Play listing both need the URLs |
| **The backend** — Postgres, auth, the seven RPCs | Supabase project | Yes — the build inlines its URL at compile time |
| **The binary** — one `.aab` | Play Console | Last |

Build them in that order. A binary compiled against the wrong Supabase URL is dead on the phone,
and `EXPO_PUBLIC_*` is inlined at build time, so you cannot fix it after the fact.

---

## Stage 0 · What blocks a release today

These are code and policy items, not deployment. None of them are optional, and all of them are
cheaper to fix before the store review than after.

**0.1 · Account deletion and export — done in the app.** P20 landed: the sheet is on the You
screen ([`src/screens/DeleteAccountSheet.tsx`](../src/screens/DeleteAccountSheet.tsx)), "Export
my data" sits beside it, and `supabase/tests/account.test.sql` proves both halves — the export
carries all seven user-owned tables and every column of them, and a delete empties all seven
while leaving the player in the next seat untouched. That satisfies Apple 5.1.1(v) and GDPR
Articles 15 and 20. What is still owed is Google Play's *other* half: a **public deletion URL**,
which is now written and waiting to be served — see 0.2.

**0.2 · The legal pages are written but not served.** [`site/`](../site) holds four static HTML
files — privacy, terms, the public deletion page Play wants, and a front page so the domain is
not a 404. They are served at the extensionless paths
[`src/components/LegalLinks.tsx`](../src/components/LegalLinks.tsx) already compiles into the
app, and they load nothing from anywhere, so the pages themselves collect nothing. Two steps,
neither of them writing — the first is done:

1. **Fill the placeholders — done.** NiLo S.L., Camí de la Reineta 11, 08017 Barcelona, Spain;
   `contact@pokercoach.app`; data in the European Union (`eu-central-1`); minimum age 18; Spanish
   law; fourteen days to answer an emailed deletion request. All eighteen spans are filled and
   `grep -o 'class="todo"' site/*.html | wc -l` returns 0. [`site/README.md`](../site/README.md)
   is the map of which page carries which. The factual sections were written from the schema and
   `get_export()`; the legal framing has not been near a lawyer, and should be.
2. **Deploy it — the DNS half is already done.** `pokercoach.app` is on Vercel's nameservers and
   the apex `A` records point at Vercel, but no project is attached: the apex answers **404 over
   HTTP and has no TLS certificate at all**. So what is left is attaching this repo with **Root
   Directory `site/`** and no build step, not a DNS change. Whatever the host, turn on clean URLs
   — [`site/vercel.json`](../site/vercel.json) does it for Vercel — or the app's own legal links
   404.

> **The nameserver move already happened, and the mail survived it.** This section used to warn
> against handing Vercel the nameservers while `pokercoach.app` carried the Resend records from
> [`phase-0-setup.md`](phase-0-setup.md) §6. It was done anyway and the records came through:
> `send.pokercoach.app` `MX` → `feedback-smtp.eu-west-1.amazonses.com`, the `send` SPF `TXT`, and
> the `resend._domainkey` DKIM key all still resolve, so password-reset mail is intact. Verified
> 20 September 2026 — re-check with `nslookup -type=MX send.pokercoach.app` after any future
> change to the zone, because nothing else will tell you it broke.
>
> **The zone still needs one more record, and nothing on the page will tell you.** The privacy
> policy, the terms and the deletion page now all give `contact@pokercoach.app`, and
> `pokercoach.app` has no apex `MX` — the only one is on `send`, and that is Amazon SES bounce
> feedback for Resend's *outbound* mail. **Mail to that address bounces today.** It is where the
> pages send people for access and erasure requests, complaints, and reporting an account made by
> a child, and it is the deletion route Play checks for, so **add an apex `MX`** pointing at a
> mail host or a forwarder before publishing. It does not disturb the `send.` records. Confirm
> with `nslookup -type=MX pokercoach.app` — an unfilled placeholder shows up as an orange box on
> the page, but a bouncing contact address looks exactly like a working one.

**0.3 · No upload keystore exists yet — and the file that looks like the problem is not one.**
`android/` is generated here, not committed: [`.gitignore`](../.gitignore) ignores `/android` and
`/ios`, and `git ls-files android/` returns nothing at all. `app.json` is where native config
lives and `expo run:android` prebuilds from it. So `android/app/build.gradle` — whose `release`
block points at `signingConfigs.debug`, the Expo template default — is a local build artifact.
Prebuild rewrites it, and, for the same reason §3.2 gives about `.env`, **EAS uploads from git**,
so it never reaches a cloud build in the first place. Editing that line changes nothing, and
committing `android/` to make it stick would trade generated native projects for ones you
maintain by hand. Leave it alone.

What that default actually governs is a single thing: `npx expo run:android --variant release` on
this machine. That is fine for sideloading and cannot produce a Play upload either way.

The real item is that no upload key exists. EAS generates one on the first Android build, or on
demand:

```bash
npx eas-cli@latest credentials -p android
```

Both routes need an Expo account, and neither is set up: `eas` is not installed here and
`~/.expo/state.json` carries no session. So this is a login away, not a change away — which puts
0.3 with the credential items rather than the code ones. Once the key exists, never lose it: it
is how Play knows a future update is from you, and it is one half of the fingerprint pair in
Stage 2.

**0.4 · Decide the content rating honestly.** This is a poker app. The IARC questionnaire every
store runs asks about simulated gambling, and a card game dealing chips is going to touch it even
with no real money, no wagering and no purchasable currency. Answer as the app behaves; a rating
that does not match the content is a removal, not a warning. Expect something above "Everyone".

**0.5 · iOS only — Sign in with Apple.** App Store guideline 4.8 requires it whenever you offer a
third-party sign-in, and Google sign-in is wired. P10 is not built, so **iOS cannot ship until it
is**. Android has no equivalent requirement; this does not block Play.

---

## Stage 1 · The production backend

**1.1 · Decide one project or two.** A second project — `poker-coach-staging` beside
`poker-coach` — earns its keep the moment anyone but you installs a build: you need somewhere to
push a migration that is not the database holding real streaks. If it is still only you, one
project is defensible; the discipline below is what makes it survivable either way. Keep the app
as one binary pointed at different backends by `EXPO_PUBLIC_SUPABASE_URL` rather than two
variants, until an external tester needs both installed on one phone — a second bundle
identifier means a second set of Google OAuth clients, a second Apple App ID and a second SHA-1
registration, which is all of [`phase-0-setup.md`](phase-0-setup.md) §4 and §5 done again.

**1.2 · Push the schema.** Staging first, verify, then production:

```bash
npx supabase link --project-ref <ref>
```

```bash
npx supabase db push
```

The files in `supabase/migrations/` are the single source of truth. Never hand-edit SQL in the
dashboard — the two environments diverge in ways no test catches.

**1.3 · Sync the answer key, per project.**

```bash
npm run sync:content
```

`content_questions` is per-database and `submit_answer` grades against it. A production project
with an unsynced mirror marks every correct answer wrong, and it presents as a bug in the drill
rather than as a missing deploy step.

**1.4 · Auth settings in the dashboard.** `supabase/config.toml` configures the *local* stack and
reaches nothing hosted. Per [`phase-0-setup.md`](phase-0-setup.md) §3: email provider on, **Confirm
email ON**, minimum password length **10** (the sign-up screen promises exactly that),
**leaked-password protection ON** (`src/auth/errors.ts` reads the `pwned` reason), and
`pokercoach://auth-callback` in the redirect allowlist — without it every confirmation and reset
link dead-ends.

**1.5 · Custom SMTP is mandatory.** Supabase's built-in sender is roughly two emails an hour and
documented as testing-only. With Confirm email ON, that *is* your signup path, so it is the first
thing that breaks with real users. Resend and a verified domain, wired into Project Settings →
Authentication → SMTP: [`phase-0-setup.md`](phase-0-setup.md) §6. Send yourself a real
confirmation and a real reset before you believe it.

**1.6 · Prove the security rules rather than assuming them.**

```bash
npx supabase test db
```

`rls.test.sql` proves user A cannot read or write user B's rows and that neither can write their
own hearts, answers or completions; `economy.test.sql`, `side_bet.test.sql` and
`double_xp.test.sql` prove the economy against the SQL itself; `account.test.sql` proves the
export carries everything and the delete leaves nothing. Same migrations, so a pass locally is a
real signal about the **policies**. Then run Supabase's **Security Advisor** in the dashboard and
clear what it flags.

> **It is not a signal about grants, and that gap has already bitten once.** The local Supabase
> image hands `service_role` blanket table privileges through default privileges; the hosted
> project does not. Locally that role reads `content_questions`, `player_state`, `answers` and
> `lesson_completions` alike — on the hosted project it was denied all four, which is why
> `sync-content.ts` could not seed the answer key until `20260923120000_service_role_answer_key_grant.sql`
> granted it explicitly. A full `db reset` and 135 passing tests said nothing about it, because
> the permission model they run against is not the one the app ships on.
>
> So for anything involving a `grant`, `revoke` or a role, prove it against the hosted project
> rather than the local stack. The cheapest check is a request with the key the caller will
> really use — a 403 carrying `42501` names the table and the missing privilege in its own hint.

**1.7 · Confirm the anon key is the anon key.** P21's instruction, and it is a good one: grep the
*built* bundle for `service_role` / `sb_secret` rather than trusting that `.env.admin` never
leaked into it.

**1.8 · Get off the free tier before real users arrive.** Free projects pause after about a week
of inactivity, and a paused project means the app throws on launch for everyone at once —
exactly the failure mode of an app with sporadic early testers. Paid tiers also carry the daily
backups you will want the first time a migration goes wrong. Check current limits and pricing
rather than trusting this paragraph.

---

## Stage 2 · Identity — the step that breaks in production

The Google button works in your sideloaded APK and fails for every Play user with
`DEVELOPER_ERROR`. This is the reason, and it catches nearly everyone once.

**Play App Signing re-signs your app.** You upload an `.aab` signed with your *upload* key; Google
strips that and re-signs the delivered artifact with its own *app-signing* key. Google Sign-In
matches by package name **and the certificate on the installed app** — which is Play's, not yours.

So, in Google Cloud → Credentials → the Android OAuth client for `app.pokercoach.mobile`,
register **both** SHA-1 fingerprints:

| Fingerprint | Where to find it | Covers |
| --- | --- | --- |
| **App signing key** | Play Console → Test and release → Setup → App signing | Everyone who installs from Play |
| **Upload key** (EAS keystore) | `npx eas-cli credentials` | Builds you install directly |

Keep the debug fingerprint (`5E:8F:16:06:…:F6:25`) registered too while you are still sideloading
debug builds. There is no cost to extra fingerprints and a very annoying cost to a missing one.

**Publish the OAuth consent screen.** In Testing mode it admits only accounts on its test-user
list, caps at 100 of them, and expires refresh tokens after seven days. With only the `email` and
`profile` scopes this app requests, no verification review is triggered; asking for anything more
would change that.

> **This step is blocked until the site is actually served, not merely written.** Publishing asks
> for a homepage and a privacy policy URL, and Google checks that they resolve. As of
> 23 September 2026 `pokercoach.app` answers **404 over HTTP with no TLS certificate** — the
> domain points at Vercel but no project is attached to it (§0.2). The pages are finished and
> their placeholders are filled; they are simply not being served. Attach the project with Root
> Directory `site/` first, confirm with `curl -s -o /dev/null -w "%{http_code}" https://pokercoach.app/privacy`,
> and only then publish the consent screen.

**Finally**, confirm the Google provider in Supabase → Authentication → Providers holds the **web**
client id *and its secret* — that is the audience `src/auth/google.ts` sends and the one Supabase
verifies against.

---

## Stage 3 · Build and submit

**3.1 · Point the build at production.** `.env.local` overrides `.env`, and it currently holds
`http://127.0.0.1:54321`:

```bash
npm run env:hosted
```

**3.2 · Set the build's environment.** [`eas.json`](../eas.json) is in the repo with three
profiles — `development` (a dev client), `preview` (an installable `.apk`) and `production` (the
`.aab` Play takes). What it deliberately does **not** carry is the `EXPO_PUBLIC_*` values.

That gap has to be closed before the first cloud build or the app throws on launch:
[`src/auth/supabase.ts`](../src/auth/supabase.ts) raises when the URL is missing, and `.env` is
gitignored while EAS uploads from git, so nothing reaches the build by itself.

**Done, as of 20 September 2026.** All four — `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — are set on `production` and `preview` at project scope,
`plaintext` visibility. `development` is deliberately empty: a dev client loads its bundle from
Metro, so it reads the `.env` on the machine running it. Read them back with
`eas env:list --environment production`, and add or change one with:

```bash
npx eas-cli@latest env:set --scope project --environment production --name NAME --value VALUE --visibility plaintext
```

`env:create` is deprecated in eas-cli 24; `env:set` creates or updates.

> **Take these from `.env`, never from `.env.local`.** `.env.local` is what
> `npm run env:local` points at the local Supabase stack — `http://127.0.0.1:54321` and the
> local JWT anon key. Pushing those would produce a binary that talks to a laptop, and it would
> build, install and launch before failing on every request.

They could live in a profile's `env` block instead — the anon key and the client ids are public
by design, and RLS is what protects the data — but this repository is public, and EAS
environment variables are the better home anyway once staging and production differ in more than
one value.

Two things about versions. `appVersionSource` is `local`, so `app.json` stays the single place
native config lives, exactly as it is for everything else here — `android.versionCode` is in it
and `autoIncrement` raises that number, which you then commit. And Play refuses a second upload
at the same `versionCode`, which is what makes `autoIncrement` load-bearing rather than
convenient. Bump `version` by hand for anything a human should notice.

**3.3 · Build and submit.**

```bash
npx eas-cli@latest build -p android --profile production
```

```bash
npx eas-cli@latest submit -p android --latest
```

**3.4 · Fill in the Play Console.** The parts that hold up a review:

- **Package name `app.pokercoach.mobile`** — permanent once uploaded, and the Google and Apple
  credentials are tied to it. This is `accounts-plan.md` §9's warning about load-bearing bundle
  identifiers.
- **Data safety form** — declare what you collect (email, name, in-app progress) and that it is
  transmitted and stored. It must match reality; a mismatch is a compliance removal.
- **Account deletion URL** — a public page explaining what deletion removes, alongside the in-app
  path from Stage 0.
- **Privacy policy URL** — same page as the consent screen uses.
- **Content rating questionnaire** — Stage 0.4.
- **Target API level** — Expo SDK 57 already targets a current one; confirm it against Play's
  requirement for new apps at the time you submit, since it rises every year.
- **Closed testing before production.** Personal (non-organisation) developer accounts must run a
  closed test — the requirement has been twelve testers opted in for fourteen continuous days —
  before the production track opens. Check the current rule in the Console before planning around
  it; it has changed before and the numbers in this sentence may already be stale. Organisation
  accounts are exempt.

Go internal testing → closed testing → production, in that order. The internal track installs in
minutes and is where you find the things that only break in a signed release build — starting
with the Google button, which is the whole point of Stage 2.

---

## Stage 4 · After the first release

**Roll out in stages.** Play's staged rollout at 10% for a day or two is free insurance for the
one bug that only appears on hardware you do not own.

**You have no over-the-air escape hatch.** `expo-updates` is not installed, so every fix — even a
one-line copy change — is a new build and a new review. Adding EAS Update before you need it is
worth more than adding it during an incident.

**You have no crash reporting.** Nothing tells you an install is crashing on launch except a
review. Sentry or an equivalent belongs in the first update.

**Keep the deploy discipline.** Migrations land on staging, get verified, then land on production.
`npm run sync:content` runs against whichever project you just migrated, every time. `npm test`
and `npm run typecheck` before any build — the content-hash test is what keeps the app's optimistic
answer and the server's verdict agreeing.

---

## The short version

**✓** marks what had landed as of 23 September 2026. The order matters in one place especially:
step 4 cannot be finished before step 1, because publishing the consent screen needs a privacy
policy URL that resolves.

1. **✓** `site/`'s placeholders are filled and an upload keystore exists — still to do: **attach
   the Vercel project** with Root Directory `site/`, and add an **apex `MX`**, or the app's legal
   links 404 and `contact@pokercoach.app` bounces
2. **✓** the production project has the schema and all 720 answers — still to do: **auth settings
   and custom SMTP**, both dashboard-only
3. Prove RLS (`npx supabase test db` — passing), clear the **Security Advisor**, leave the free
   tier before real users arrive
4. Register **both** SHA-1s with the Android OAuth client, publish the consent screen — **after
   step 1**; the upload key's fingerprint exists now, Play's does not until the first upload
5. **✓** the four `EXPO_PUBLIC_*` values are on EAS — still to do: `npm run env:hosted`, build the
   `.aab`, submit
6. Fill the Play Console forms honestly — data safety, content rating (**18**, matching what the
   published pages already promise), deletion URL
7. Internal → closed → production, staged rollout
