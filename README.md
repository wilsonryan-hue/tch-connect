# TCH Works door

Shop is https://wilsonryan-hue.github.io/

This repo is the TCH Works door and a small dashboard. Not Replit.

## Focus Points

The homepage shows a **Focus Points** list for Ryan, Kacey, Alex and Jim. Every hour a
GitHub Actions run scans each person's Outlook inbox (last 14 days) for the watch words in
`focus.config.json` — `urgent`, `deadline`, `new business`, `new work`, `trusty`, `quote` —
and publishes the matches as `focus.json` with the Pages deploy. Tick a point on the
dashboard to remove it; ticks are remembered in that browser.

`focus.json` is generated at deploy time and is never committed. The dashboard is public,
so only the subject line, sender name, date and matched words are published. Set
`includePreview` to `true` in `focus.config.json` if you also want the first line of the email.

### One-time setup

1. **App registration** (free, once). At https://entra.microsoft.com → *App registrations* →
   *New registration*: any name, supported account types **"Accounts in any organizational
   directory and personal Microsoft accounts"**, no redirect URI. Then under
   *Authentication* set **Allow public client flows: Yes**, and under *API permissions* add the
   delegated Microsoft Graph permissions `Mail.Read`, `User.Read`, `offline_access`.
   Copy the *Application (client) ID*.
2. **Repository secret** `FOCUS_CLIENT_ID` = that client id (GitHub → Settings → Secrets and
   variables → Actions).
3. **Connect each person.** On any machine with Node 20+:

   ```bash
   FOCUS_CLIENT_ID=<client id> npm run focus:auth
   ```

   Sign in as that person when prompted (works for outlook.com / live.com and work accounts).
   Paste the printed refresh token into the matching secret: `FOCUS_TOKEN_RYAN`,
   `FOCUS_TOKEN_KACEY`, `FOCUS_TOKEN_ALEX`, `FOCUS_TOKEN_JIM`. Repeat per person.
4. Run the **pages** workflow once from the Actions tab (or wait for the hourly run).

Refresh tokens expire after ~90 days without rotation. To keep sign-ins alive
indefinitely, add a fine-grained PAT with *Secrets: read and write* on this repo as
`FOCUS_ADMIN_TOKEN`; the workflow then stores the rotated token after every scan.

### Changing names or words

Edit `focus.config.json`. Adding a person means adding a `FOCUS_TOKEN_<NAME>` secret and
passing it through in `.github/workflows/pages.yml`.
