# Environments and deployment

Where each piece of Poker Coach runs, and how to get a staging tier that behaves like production.

## 1. Three artifacts, three destinations

| What | Where it deploys | Notes |
| --- | --- | --- |
| **The site** — landing, privacy policy, terms | **Vercel** | The only piece Vercel hosts |
| **The app** — the Expo binary | **TestFlight** (iOS) and **Play Console internal testing** (Android) | A native binary. There is no URL, and Vercel cannot host it |
| **The backend** — Postgres, auth, RPCs | **Supabase** | One project per environment |

This is the part worth being clear about before spending money on Vercel plans: you cannot
"deploy the app to staging" as a website. The app is a binary that testers install. What Vercel
gives you is a staging *site*, and what makes staging meaningful for the product is the
**Supabase project behind it**.

> The app *can* be exported to web (`expo export -p web`), but not usefully today: after P1 the
> session lives in `expo-secure-store`, which has no web implementation, and P9/P10 use
> native-only Google and Apple sign-in. A web build would render and then fail at sign-in.

## 2. The three tiers

| | App | Backend | Site |
| --- | --- | --- | --- |
| **Local** | dev build + Metro | `npx supabase start` (local Docker) | `npm run dev` in `site/` |
| **Staging** | TestFlight internal / Play internal track | Supabase project `poker-coach-staging` | `staging.pokercoach.app` |
| **Production** | App Store / Play production | Supabase project `poker-coach` | `pokercoach.app` |

## 3. Vercel — the site

### Project settings

Assuming a small Astro site in a `site/` subfolder of this repo. If you'd rather use Next.js,
only the framework preset and output directory change.

| Setting | Value |
| --- | --- |
| Framework Preset | Astro |
| Root Directory | `site/` |
| Build Command | `npm run build` (framework default) |
| Output Directory | `dist` (framework default) |
| Install Command | `npm install` |
| Node version | 22.x |

Setting **Root Directory** to `site/` is what stops Vercel trying to make sense of the Expo
project at the repo root. Also enable **Settings → Git → Ignored Build Step** so a commit that
only touches `src/` or `supabase/` doesn't trigger a site rebuild.

### Adding the staging environment

**On Pro** — a real Custom Environment, included at no extra cost (1 per project):

1. **Settings → Environments → Create Environment**
2. Name it `staging`
3. **Branch Tracking**: `staging`
4. **Attach a Domain**: `staging.pokercoach.app`
5. **Import variables** from Production, then override the Supabase ones

From the CLI:

```bash
vercel deploy --target=staging
```

```bash
vercel pull --environment=staging
```

```bash
vercel env add EXPO_PUBLIC_SUPABASE_URL staging
```

**On Hobby** — custom environments aren't available, so use a branch-tracked preview instead:

1. Create a long-lived `staging` branch
2. **Settings → Domains** → add `staging.pokercoach.app` → assign it to the `staging` branch
3. Scope environment variables to **Preview**, restricted to the `staging` branch

The catch on Hobby: the only protection method is **Vercel Authentication**, which limits access
to members of your Vercel account. Fine while it's just you; the moment a non-technical tester
needs to look at staging, they can't. Password Protection is Enterprise, or a $150/month add-on
on Pro — not worth it here. The practical answer on Hobby is to leave staging reachable and rely
on the `noindex` header Vercel sets on preview deployments automatically.

> **First-deploy quirk**: the very first deployment of a new Vercel project is *always* a
> production deployment, whatever branch it comes from. Preview rules only apply afterwards.

### Branch model

```
main       → production   → pokercoach.app
staging    → staging      → staging.pokercoach.app
feature/*  → preview      → ephemeral per-PR URL
```

This lines up with the PR review agent already in `.github/`.

### DNS — the thing that breaks email

`pokercoach.app` carries the Resend `MX` and `TXT` records from Phase 0. **Do not let Vercel take
over the nameservers** unless you re-create all three Resend records on the Vercel side first —
otherwise password reset email stops working silently, and you find out when a real user needs it.

Keep DNS where it is and add only the records Vercel asks for:

| Record | Name | Points to |
| --- | --- | --- |
| A | `@` | `76.76.21.21` (Vercel gives you the current value) |
| CNAME | `staging` | `cname.vercel-dns.com` |

Verify afterwards that the Resend records still resolve.

## 4. Supabase — the second project

The part people skip and regret.

Create `poker-coach-staging` in the same region. The free tier covers two active projects, which
is exactly staging plus production — confirm against current limits before relying on it.

**Migrations always land on staging first:**

```bash
npx supabase link --project-ref <staging-ref>
```

```bash
npx supabase db push
```

Verify, then repeat against the production ref. The migration files in `supabase/migrations/` are
the single source of truth — never hand-edit SQL in a dashboard, or the two environments diverge
in ways no test will catch.

**Re-run the content sync against whichever project you just migrated:**

```bash
npm run sync:content
```

`content_questions` is per-project. The hash test in `course.test.ts` guards the *app* against a
stale answer key, not the *database* — so a staging project with an unsynced mirror will mark
correct answers wrong, and it will look like a bug in the drill. `scripts/use-local-supabase.ts`
already establishes the switching pattern; extend it rather than keeping two `.env.admin` files
you have to remember to swap.

## 5. The app — one binary, or two?

This is the real decision, and it costs more than it looks.

**Two binaries** (staging and production installed side by side on one phone) means replacing
`app.json` with `app.config.ts` keyed on `process.env.APP_VARIANT`, and a distinct bundle
identifier per variant — `app.pokercoach.mobile.staging`. But a new bundle id needs **its own
Google iOS and Android OAuth clients, its own Apple App ID, and its own entries in the staging
Supabase project's provider Client IDs.** That is Phase 0 section 4 and 5 done a second time,
plus a second SHA-1 registration.

**One binary** pointed at different backends by a build-time variable is far less setup:

```
EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
```

change per build, everything else stays. You keep one set of OAuth clients, one App ID, one
bundle identifier. What you lose is having both versions on the same device at once.

**Recommended: one binary until you have external testers.** Switch to two variants when someone
other than you needs a stable production build on the same phone as a test build — not before.

## 6. What "as it would be on production" actually requires

Staging is only useful if these match:

- **The same migrations, in the same order.** Push to staging, verify, push to prod.
- **The same content mirror.** `npm run sync:content` after every migration on both.
- **The same auth providers enabled**, with the staging redirect allowlist carrying the same
  `pokercoach://auth-callback` entry.
- **A separate email sender.** Point staging's Supabase SMTP at a subdomain
  (`stage.pokercoach.app`, verified separately in Resend) so a test password reset can never
  reach a real user, and so a staging mistake can't damage the production domain's reputation.

These may differ without invalidating the test: data volume, rate limits, and the Google consent
screen staying in Testing mode with a test-user list.

## 7. Order to set this up

1. Create the `poker-coach-staging` Supabase project, push the migrations, run the content sync
2. Point your local `.env` at staging and keep developing against it
3. Build the site in `site/`, deploy to Vercel, connect `pokercoach.app`
4. Add the `staging` branch and `staging.pokercoach.app`
5. Leave TestFlight and Play internal testing until there is something worth installing —
   realistically after P14, when hearts and progress are real
