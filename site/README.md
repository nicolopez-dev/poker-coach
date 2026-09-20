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

## Fill these in before publishing

Every placeholder renders as a loud orange dashed box, so an unfilled one is obvious on the page
rather than something a reviewer discovers. Search the directory for `class="todo"`.

| Placeholder | Where, and how many |
| --- | --- |
| `[LEGAL ENTITY NAME]` | index ×1, privacy ×1, terms ×2 |
| `[POSTAL ADDRESS]` | privacy ×1, terms ×1 |
| `[CONTACT EMAIL]` | privacy ×3, terms ×1, delete-account ×1 |
| `[COUNTRY]` | privacy ×1 |
| `[REGION]` — where the Supabase project actually is | privacy ×2 |
| `[MINIMUM AGE]` — must match the store age rating | privacy ×1, terms ×1 |
| `[JURISDICTION]` | terms ×1 |
| `[N]` — days to answer an emailed deletion request | delete-account ×1 |

Fifteen in total. `grep -c 'class="todo"' *.html` counts what is left.

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
