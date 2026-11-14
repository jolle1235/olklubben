# Login and logout

A logged-out visitor is sent to `/login`, logs in with email and password and lands where SPEC §10.1
says: their only club, their last active club, or the club picker `/clubs`. A deep link survives the
login (`?next=`). "Log ud" ends the session and returns to `/login`.

## Sub-features

- `login-redirect` sends a logged-out visitor from any page to `/login`, keeping the target in `?next=`.
- `login-password` logs in with email + password and lands per §10.1.
- `login-error` shows "Forkert email eller password." on a wrong password.
- `logout` logs out from the sidebar (desktop) or Profil (mobile).
- `forgot-password` "Glemt password?" sends a reset link to the instance's outbox (not mapped in
  detail yet).

## How to get to it (user POV)

- Open any URL logged out, e.g. `/` or `/c/<clubId>/beers`.
- On `/login`: fill "Email" and "Password", choose "Log ind".
- Desktop: "Log ud" at the bottom of the sidebar. Mobile: bottom nav "Profil" → "Log ud".

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: null })` (logged out).
- Anders (one club) for a deterministic landing page; Mads (two clubs, no last active club) for the
  club picker; Kaptajnen lands in his last active club (Drengene & Bajere unless something changed it).

- **Redirect.** `app.goto("/")`. The URL ends in `/login`.
- **Log in.** `page.getByLabel("Email").fill(USERS.anders.email)`,
  `page.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD)`,
  `page.getByRole("button", { name: "Log ind", exact: true }).click()`. The URL becomes
  `/c/<CLUBS.drengene.id>`, and `getByRole("heading", { level: 1, name: "Overblik" })` is attached
  (it is visually hidden).
- **Wrong password.** Same with a wrong password: `getByText("Forkert email eller password.")` is visible
  and the URL stays `/login`.
- **Deep link.** `app.goto("/clubs?fra=test")` logged out: the URL is `/login?next=%2Fclubs%3Ffra%3Dtest`;
  after logging in as Mads the page is `/clubs`.
- **Log out (desktop).** `page.getByRole("button", { name: "Log ud" })` in the sidebar. The URL ends in
  `/login`.
- **Proof.** `app.shot("login")` after landing; the session row exists:
  `app.sql("SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = $1", [email])`.

## Gotchas

- "Log ind" also matches "Log ind med Google" when Google is configured; always `exact: true`. The
  instance has no Google or Auth0, so those buttons are absent.
- The Overblik h1 is visually hidden: use `toBeAttached()`, not `toBeVisible()`.
- The Profil page has a second "Log ud" button on desktop; scope with `getByRole("main")`.
- `openApp(id, { as: "<user>" })` logs in through the API, not the form. Use `as: null` and the form
  when the login itself is under test.
