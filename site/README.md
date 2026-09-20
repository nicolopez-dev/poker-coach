# site

The three pages both stores require before they will take a build, plus a front page so the
domain is not blank.

Four static HTML files and one stylesheet. No build step, no dependencies, no framework — and,
deliberately, **no external requests of any kind**: no web fonts, no scripts, no analytics. That
is partly speed and mostly honesty, because it is what lets [`privacy.html`](privacy.html) say
the page you are reading it on collects nothing.

| File | Served at | Why it exists |
| --- | --- | --- |
| `index.html` | `/` | So `pokercoach.app` is not a 404 |
| `privacy.html` | `/privacy` | Play, the App Store and the Google consent screen all refuse a build without one |
| `terms.html` | `/terms` | Linked beside the privacy policy from the app |
| `delete-account.html` | `/delete-account` | Google Play's data-deletion policy wants a **public URL** as well as the in-app path |

`/privacy` and `/terms` are the URLs already compiled into the app —
[`src/components/LegalLinks.tsx`](../src/components/LegalLinks.tsx) points the login screen and
the You tab at them. They are extensionless, which is what `cleanUrls` in
[`vercel.json`](vercel.json) is for. **On any other host, turn on the equivalent** (Netlify's
"Pretty URLs", Cloudflare Pages' automatic clean URLs, or a rewrite rule) — without it the app's
legal links 404 and a store reviewer is the one who finds out.

## The values on these pages

Eight values across eighteen spans, **all filled**. An unfilled one renders as a loud orange
dashed box, so it is obvious on the page rather than something a reviewer discovers;
`grep -o 'class="todo"' *.html | wc -l` returns 0 today and is what to re-run after any edit
(`grep -c` would count *lines*, and some lines carry two or three placeholders).

The table stays because it is the map of where each value appears, which is what you want the day
one of them changes.

| Value | Where, and how many | Now reads |
| --- | --- | --- |
| `[LEGAL ENTITY NAME]` | index ×1, privacy ×1, terms ×2 | NiLo S.L. |
| `[POSTAL ADDRESS]` | privacy ×1, terms ×1 | Camí de la Reineta 11, 08017 Barcelona |
| `[CONTACT EMAIL]` | privacy ×3, terms ×1, delete-account ×1 | contact@pokercoach.app — **does not receive yet**, see below |
| `[COUNTRY]` | privacy ×1 | Spain |
| `[REGION]` — where the Supabase project actually is | privacy ×2 | the European Union (`eu-central-1`) |
| `[MINIMUM AGE]` — must match the store age rating | privacy ×1, terms ×1 | 18 |
| `[JURISDICTION]` | terms ×1 | Spain |
| `[N]` — days to answer an emailed deletion request | delete-account ×1 | 14 |

> **`contact@pokercoach.app` is on the pages but does not receive mail.** As of 20 September 2026
> `pokercoach.app` has no apex `MX` — the only one on the domain is `send.pokercoach.app`, which
> is Amazon SES bounce feedback for Resend's *outbound* mail. Mail sent to `contact@` bounces.
> **Add an apex `MX`** pointing at a mail host or a forwarder before this site is published; doing
> so does not disturb the `send.` records. Check with `nslookup -type=MX pokercoach.app`.

That address is the one these pages hand people for access and erasure requests, rectification,
complaints, and reporting an account made by a child — the routes GDPR requires to stay open, and
the deletion path Google Play checks for. It is also the only failure here with nothing to show
for it: every other mistake on these pages appears as an orange box, while a bouncing contact
address looks exactly like a working one.

Two of the filled values are promises rather than facts, and both are now binding: **18** has to
match the age rating on the store listing, and **14 days** is shorter than the month GDPR allows.

> **These pages are a starting draft, not legal advice.** The factual parts — what is stored,
> which processors touch it, what deletion removes — were written from the actual schema and the
> `get_export()` function, and are accurate as of the date on each page. The legal framing around
> them has not been reviewed by a lawyer. If the app is going on a store in the EU or the UK, have
> someone qualified read it.

## Deploying

Any static host serves this directory as-is. On Vercel, set **Root Directory** to `site/` and
leave the framework preset as Other — there is nothing to build.

Before pointing DNS anywhere, read the warning in
[`docs/going-live.md`](../docs/going-live.md) §0.2: `pokercoach.app` carries the Resend `MX` and
`TXT` records, and letting a host take over the nameservers stops password-reset email silently.

## Keeping it true

The privacy policy enumerates what the app stores, table by table. That list is the same one
`get_export()` returns, and `supabase/tests/account.test.sql` (X2) fails the build when a column
is added to a user-owned table without being added to the export. It does **not** know about this
directory — so when X2 sends you to `get_export()`, come here too.

Two claims here have no test behind them at all, because they are about infrastructure rather
than schema. The policy says data is stored in **the European Union**, which is true of
`eu-central-1` and stops being true the day the project moves; and it gives an address for
data-protection requests, which is only an address for as long as something is reading that
mailbox. Nothing in CI will notice either one going stale.
