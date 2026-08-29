# Phase 0 — setup, step by step

The console work that has to exist before any prompt in [accounts-plan.md](accounts-plan.md)
can run. Claude Code cannot click through these, so this is yours. Budget about two hours,
most of it waiting for DNS.

Work in order — step 1 decides values that steps 4, 5 and 6 depend on.

**Nothing here goes in the repo.** Database passwords, keystore passwords, API keys and the
Supabase service key belong in your password manager. The only secrets that reach a file are
in `.env` and `.env.admin`, both gitignored by P1.

---

## Before you start

| Need | Why | Check |
| --- | --- | --- |
| Node 20.19.4+ | React Native 0.86 | `node --version` |
| Android Studio | Android builds, and `keytool` for the SHA-1 | — |
| A Mac with Xcode | iOS builds. Windows cannot build iOS | — |
| Apple Developer Program | Sign in with Apple needs a paid membership (€99/yr) | — |
| `pokercoach.app` DNS access | The reset emails send from it | — |

If the Apple membership or the Mac aren't ready, do everything except step 5 and run
P1–P9 on Android. Only P10 is blocked.

---

## 1 · Choose the bundle identifiers

Do this first and do not change it afterwards. Google and Apple both key their OAuth clients to
these strings, and changing one means redoing both consoles.

Recommended: **`app.pokercoach.mobile`** for iOS and Android alike.

Rules worth knowing: Android package segments cannot contain hyphens and cannot start with a
digit, so `poker-coach` is not valid. Reverse-domain form is the convention.

In `app.json`, **add one key to each platform block** and leave every other key exactly as it is:

- inside `"ios"` — `"bundleIdentifier": "app.pokercoach.mobile"`
- inside `"android"` — `"package": "app.pokercoach.mobile"`

Do not replace the blocks wholesale. `"android"` already carries `adaptiveIcon` with four icon
paths and `predictiveBackGestureEnabled`, and `"ios"` carries `supportsTablet`; all of it stays.

---

## 2 · Supabase project

**2.1** At [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.

- Name: `poker-coach`
- Database password: generate a strong one, save it in your password manager. You will not be
  shown it again, and you need it for direct database connections.
- Region: **Central EU (Frankfurt)** `eu-central-1` — the closest Supabase region to Barcelona.
  Take Paris `eu-west-3` instead if it's offered; either keeps user data in the EU.

Provisioning takes a couple of minutes.

**2.2** Copy the API credentials from **Project Settings → API Keys**:

- **Project URL** — `https://<ref>.supabase.co`
- **anon** key (newer projects call this **publishable**) — safe to ship in the app
- **service_role** key (newer: **secret**) — never goes in the app. You need it in step 2.4
  for the content-sync script only.

**2.3** Create `.env` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

**2.4** Create `.env.admin`, which only `npm run sync:content` ever reads:

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

Both files are added to `.gitignore` by P1. If you create them before running P1, add the two
lines to `.gitignore` yourself first — the current file only ignores `.env*.local`.

**2.5** Link the CLI. The project ref is the subdomain of your project URL.

```bash
npx supabase login
```

```bash
npx supabase init
```

```bash
npx supabase link --project-ref <ref>
```

---

## 3 · Supabase auth settings

All under **Authentication** in the dashboard.

**3.1 · Sign In / Providers → Email**

- Enable email provider
- **Confirm email: ON.** The app still lets people in — P7 shows a banner instead of a wall —
  but the address gets proven before it can ever receive a password reset.
- Minimum password length: **10**. The sign-up screen in P7 states this requirement up front,
  so the two must agree.
- **Leaked password protection: ON** if your plan offers it. It checks new passwords against
  HaveIBeenPwned. If the toggle isn't there, skip it and note it as a launch item.

**3.2 · URL Configuration**

Add to **Redirect URLs**:

```
pokercoach://auth-callback
```

That scheme is already set in `app.json`, and it is where the password-reset and confirmation
links land. Without it Supabase refuses the redirect and every reset link dead-ends.

Site URL can stay as your marketing site, or the same `pokercoach://auth-callback` for now.

**3.3 · Rate limits**

The defaults are sensible. Look at them so you know what they are — the email-sending limit is
the one that bites during testing, and it applies per hour.

---

## 4 · Google Cloud — three OAuth clients

**4.1** At [console.cloud.google.com](https://console.cloud.google.com) create a project,
`Poker Coach`.

**4.2** Configure the consent screen (recent consoles call this **Google Auth Platform →
Branding** and **Audience**):

- User type: **External**
- App name, user support email, developer contact
- Scopes: the defaults `email`, `profile`, `openid` are all this needs

> **While the app is in Testing, only accounts on the test-user list can sign in.** Add your own
> Google account under **Audience → Test users** now, or you will hit "access blocked" on your
> first real attempt and lose an hour to it. Publishing is only needed before real users arrive.

**4.3** **Credentials → Create credentials → OAuth client ID**, three times:

| Type | What it needs | What you get |
| --- | --- | --- |
| **Web application** | Authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` | Client ID **+ secret** |
| **iOS** | Bundle ID `app.pokercoach.mobile` | Client ID |
| **Android** | Package `app.pokercoach.mobile` + SHA-1 fingerprint | Client ID |

The Web client is the odd one: the app never opens a browser, but its ID is what
`@react-native-google-signin/google-signin` takes as `webClientId`, and it is what the ID token
is issued for. The Android client is never referenced in code — it just has to exist, correctly
fingerprinted, or Google refuses to sign you in on Android.

**4.4 · The Android SHA-1, on Windows**

**Not** from `~/.android/debug.keystore`. That file is created by the Android SDK on your first
build, so on a machine that has never built an Android app it does not exist — and Expo would not
use it anyway. The generated `android/app/build.gradle` signs debug builds with
`storeFile file('debug.keystore')`, resolved relative to `android/app/`, and the Expo bare
template ships that keystore.

So generate the native project first (step 1 must be done, since prebuild reads the package name
out of `app.json`):

```bash
npx expo prebuild --platform android
```

Then read the fingerprint off the keystore that will actually sign your builds. `keytool` ships
with Android Studio's bundled JDK. Run this from the project root:

```powershell
$env:JAVA_TOOL_OPTIONS = "-Duser.language=en -Duser.country=US"; & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "android\app\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

Copy the `SHA1:` line into the Android OAuth client. Sanity-check the owner line reads
`CN=Android Debug` — that confirms you are looking at the template's debug key and not something
else.

> The `JAVA_TOOL_OPTIONS` prefix is not optional on a Spanish-locale Windows install. The JDK's
> Spanish resource bundle has a malformed format string in the certificate printer, so `-list -v`
> dies with `MissingFormatArgumentException: Format specifier '%2$s'` partway through the output.
> Forcing the English locale avoids that code path. Passing `-J-Duser.language=en` as an argument
> instead does *not* work — PowerShell mangles the token before `keytool` sees it.

Two things to know:

- Because that keystore comes from the template, this fingerprint is **shared by every Expo
  developer** and is stable across prebuilds. That is fine for a debug key and fine for Google
  sign-in in development. It is never acceptable for a release build.
- Before release you generate your own upload keystore, and **its** SHA-1 has to be added to the
  same Android client. Keep that file and its password in your password manager; losing it means
  you cannot ship an update to an already-published app.

`/android` is gitignored and regenerated by every prebuild, so never hand-edit anything inside
it — native configuration belongs in `app.json` plugins.

**4.5** Back in Supabase → **Authentication → Sign In / Providers → Google**:

- Enable it
- **Client ID** and **Client Secret**: the **Web** client's
- In the field for additional authorized client IDs (comma-separated), list **all three** —
  web, iOS and Android. Supabase validates the `aud` of the incoming ID token against this
  list, and which client issues the token varies by platform.

---

## 5 · Apple — one App ID

Simpler than it looks, because the app uses the **native** flow.

**5.1** At [developer.apple.com](https://developer.apple.com/account) →
**Certificates, Identifiers & Profiles → Identifiers → +**

- **App IDs** → **App**
- Description: `Poker Coach`
- Bundle ID: **Explicit**, `app.pokercoach.mobile`
- Capabilities: tick **Sign in with Apple**
- Register

**5.2** Supabase → **Authentication → Sign In / Providers → Apple**:

- Enable it
- **Client IDs**: `app.pokercoach.mobile`
- Leave **Secret Key**, Services ID and Team ID **empty**

That is genuinely all. A Services ID and a `.p8` signing key belong to the web/OAuth redirect
flow, which this app does not use. You would only need them later to revoke Apple tokens on
account deletion — worth revisiting at P20, not now.

---

## 6 · Resend and pokercoach.app

**6.1** Sign up at [resend.com](https://resend.com) → **Domains → Add Domain** →
`pokercoach.app`. Choose the **EU (Ireland)** sending region so mail stays in the EU.

**6.2** Resend then shows the exact DNS records for your domain. Copy them verbatim — the DKIM
value is generated per domain, so it cannot be written down here in advance. They take this
shape:

| Type | Name | Value |
| --- | --- | --- |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com`, priority 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | the long DKIM public key |

Add them at your registrar. **If the registrar appends the domain automatically, enter `send`
and `resend._domainkey`, not the full hostname** — `send.pokercoach.app.pokercoach.app` is the
classic hour-long mistake here.

Worth adding too, though Resend does not require it:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@pokercoach.app` |

**6.3** Hit **Verify**. Usually minutes; allow up to an hour.

**6.4** **API Keys → Create API Key**, sending permission. It is shown once — save it.

**6.5** Supabase → **Project Settings → Authentication → SMTP Settings** → enable custom SMTP:

| Field | Value |
| --- | --- |
| Sender email | `no-reply@pokercoach.app` |
| Sender name | `Poker Coach` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

Port 465 is implicit TLS; 587 works too, with STARTTLS.

**6.6** Prove it works before you rely on it: sign up a throwaway user from the Supabase
dashboard (**Authentication → Users → Add user**, with "send confirmation email" ticked) and
confirm the mail arrives from your domain and not from spam. Delete the user afterwards.

---

## 7 · Before you start P1

- [ ] `app.json` carries the bundle identifier on both platforms
- [ ] `.env` has the project URL and anon key; `.env.admin` has the service key; both are
      gitignored
- [ ] `npx supabase link` succeeded
- [ ] Email provider on, confirm-email on, minimum length 10
- [ ] `pokercoach://auth-callback` is in the redirect allowlist
- [ ] Three Google client IDs exist, all three are listed in Supabase, and your own Google
      account is a test user
- [ ] Apple App ID registered with Sign in with Apple, bundle id in Supabase's Client IDs
- [ ] `pokercoach.app` verified in Resend, SMTP configured, and a test email actually arrived

With that in place, paste P1 from [accounts-plan.md](accounts-plan.md) into Claude Code.

---

## If something goes wrong

| Symptom | Cause, nearly always |
| --- | --- |
| Google: "access blocked", "app not verified" | Your account isn't on the consent screen's test-user list |
| Google on Android: `DEVELOPER_ERROR` | SHA-1 mismatch — the keystore signing the build isn't the one registered |
| Google: token rejected by Supabase | The issuing client ID isn't in Supabase's authorized client IDs list |
| Apple: sign-in sheet appears, Supabase rejects | Bundle id missing from the Apple provider's Client IDs |
| Reset link opens the browser and dead-ends | `pokercoach://auth-callback` missing from the redirect allowlist |
| Emails not arriving | DNS not verified, or the record names got the domain appended twice |
