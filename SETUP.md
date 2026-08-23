# IUS AND SONS — Complete Setup Guide

## A. Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. NEW project: run `supabase-schema.sql` from top to bottom.
4. EXISTING project: run `supabase-migrate-safe.sql`.
5. Open **Project Settings → API**.
6. Copy:
   - Project URL
   - anon/public key
7. Open `config.js` and replace the two placeholders.

Example shape only:

```js
const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Do not paste the service-role/secret key.

## B. Authentication

Open **Authentication → Providers → Email**.

The code works whether email confirmation is enabled or disabled:

- Disabled: the account is created and the School ID can be displayed immediately.
- Enabled: the account is created, the registration information is stored in the user's metadata, and the confirmation link returns to the site. The school and admin profile are then created when a valid session is available.

## C. Redirect URLs

In **Authentication → URL Configuration**, add your published URL, for example:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/auth.html*`

Also set the Site URL to your GitHub Pages URL if required by your Supabase project.

## D. GitHub Pages

Upload the files directly into the repository root. The root must contain `index.html`.

Then:

1. GitHub repository → Settings.
2. Pages.
3. Deploy from branch.
4. Select `main` and `/ (root)`.
5. Save.
6. Wait for deployment.

## E. Test in this order

1. Open the GitHub Pages URL.
2. Click **Create School Account**.
3. Enter the school information.
4. Create the account.
5. If confirmation is enabled, confirm the email.
6. Save the displayed School ID.
7. Sign out if necessary.
8. Sign in with the School ID and password.
9. Confirm that the dashboard opens.

## F. If something fails

Open Chrome Developer Tools → Console and look for the first red error. The registration page now reports configuration/authentication errors directly instead of producing `supabaseClient is not defined`.
