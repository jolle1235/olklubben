# Feedback

`/feedback` is app-wide (not per club): every logged-in user can report a bug 🐞 or suggest an idea 💡,
see all reports and give 👍. The list filters on type, status and "Mine rapporter" and sorts by votes
or newest, all in the URL. A report's page shows the description, votes, and for its author "Ret" and
"Slet rapport" while it is "Ny". App-admins (`APP_ADMIN_EMAILS`) also see "Teknisk info" and set
status and an answer.

## Sub-features

- `feedback-list` the list with filters "Type", "Status", "Vis", "Sortér".
- `feedback-report` a report's page, votes ("👍 Jeg har også det problem" / "Fjern min 👍").
- `feedback-new` "Ny rapport" with "Findes den allerede?" suggestions.
- `feedback-admin` status, answer, duplicates (app-admins only).

## How to get to it (user POV)

- Profil → "Feedback (fejl og ønsker)".
- "Feedback" under "Logget ind som …" on onboarding, the club picker and invitations.
- "Rapportér denne fejl" on error pages.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`: Kaptajnen is the instance's app-admin
  (`APP_ADMIN_EMAILS=jesper@example.com`). Open reports: `FEEDBACK.calendarBug` (bug, Ny, by Mads)
  and `FEEDBACK.darkTheme` (wish, Planlagt).

- **List.** `app.goto("/feedback")`. h1 "Feedback"; `getByRole("list", { name: "Rapporter" })` contains
  `getByRole("link", { name: /Mørkt tema/ })`.
- **Report.** Open "Kalenderen viser forkert dato på mobil": h1 with that title,
  `getByRole("region", { name: /^Teknisk info/ })`, `getByLabel("Status", { exact: true })` has the
  value `NEW`.
- **Vote.** `getByRole("region", { name: "Stemmer" }).getByRole("button")` toggles the user's 👍; the
  count changes (recorded 2026-11-14: Anders removed his, "3 stemmer" → "2 stemmer").
- **Proof.** `app.shot("feedback")`.

## Gotchas

- Kaptajnen and Anders have already voted on the calendar bug, and Mads wrote it (his own report
  counts as his vote). The vote button removes a vote for all three seed users. To add a vote, use a
  new user.
- Default filter is "Åbne": the done and duplicate reports only show under "Lukkede" or "Alle".
- Only app-admins see "Teknisk info"; Mads and Anders don't.
- At most 10 reports per user per day.
