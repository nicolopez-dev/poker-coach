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
which rides along with 0.2 below.

**0.2 · The legal URLs resolve to nothing.** [`src/components/LegalLinks.tsx`](../src/components/LegalLinks.tsx)
already points at `https://pokercoach.app/privacy` from the login screen and from You, which is
the right shape — but no `site/` directory exists, so the links go nowhere. Both stores reject a
build whose privacy policy cannot be reached, and the Google consent screen cannot be published
without one. Three static pages settle it: privacy, terms, and the account-deletion page 0.1
still owes. Any static host will do.

> One trap if you put the site on Vercel and let it manage the domain: `pokercoach.app` carries
> the Resend `MX` and `TXT` records from [`phase-0-setup.md`](phase-0-setup.md) §6. **Do not hand
> Vercel the nameservers** without re-creating all three records on the other side first, or
> password-reset email stops arriving silently — and you find out when a real user needs it. Add
> only the `A` and `CNAME` records Vercel asks for, and check the Resend records still resolve
> afterwards.

**0.3 · The release build is signed with the debug keystore.**
[`android/app/build.gradle:115`](../android/app/build.gradle:115) points `release` at
`signingConfigs.debug`, which is fine for sideloading and fatal for Play — it rejects
debug-signed uploads outright. Let EAS manage a real upload keystore (Stage 3), and never lose
it: the upload key is how Play knows a future update is from you.

**0.4 · `node` is a dependency.** `package.json` carries `"node": "^26.8.1"` — an entire Node
distribution, almost certainly installed by a stray `npm i node`. Remove it before you build
anything you intend to ship:

```bash
npm uninstall node
```

**0.5 · Decide the content rating honestly.** This is a poker app. The IARC questionnaire every
store runs asks about simulated gambling, and a card game dealing chips is going to touch it even
with no real money, no wagering and no purchasable currency. Answer as the app behaves; a rating
that does not match the content is a removal, not a warning. Expect something above "Everyone".

**0.6 · iOS only — Sign in with Apple.** App Store guideline 4.8 requires it whenever you offer a
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
real signal about production. Then run Supabase's **Security Advisor** in the dashboard and clear
what it flags.

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
list, caps at 100 of them, and expires refresh tokens after seven days. Publishing needs the
privacy policy URL from Stage 0. With only the `email` and `profile` scopes this app requests,
no verification review is triggered; asking for anything more would change that.

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

**3.2 · Write `eas.json`.** `.env` is gitignored and EAS uploads from git, so the values have to
reach the build another way — either the profile's `env` block (they are public by design: the
anon key ships in the bundle and RLS is what protects the data) or EAS environment variables,
which is the better home once staging and production differ:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": { "production": {} }
}
```

`autoIncrement` matters: `versionCode` is `1` in the generated project, and Play refuses a second
upload at the same code. Bump `version` in `app.json` by hand for anything a human should notice.

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
- **Content rating questionnaire** — Stage 0.5.
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

1. Fix the remaining blockers: legal pages (carrying the deletion URL), release signing, `npm uninstall node`
2. Create or promote the production Supabase project — `db push`, `sync:content`, auth settings, SMTP
3. Prove RLS (`npx supabase test db`), clear the Security Advisor, leave the free tier
4. Register **both** SHA-1s with the Android OAuth client, publish the consent screen
5. `npm run env:hosted`, write `eas.json`, build the `.aab`, submit
6. Fill the Play Console forms honestly — data safety, content rating, deletion URL
7. Internal → closed → production, staged rollout
