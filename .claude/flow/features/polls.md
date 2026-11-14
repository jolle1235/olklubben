# Afstemninger (polls)

A poll `/c/<clubId>/polls/<pollId>` lets members tick every date that suits them (or "Ingen af
datoerne passer mig") and one place. The counts change as you tick ("Ikke gemt endnu"), and "Gem min
stemme" saves ("Skål! Din stemme er gemt ✓"). Votes are open: everyone sees who voted for what and who
is missing ("2 af 3 har stemt · Mangler: dig"). At the deadline, when everyone has voted, or on
"Afslut afstemning nu", the winner becomes an event; a tie waits for the creator or an admin
("Vælg vinder og opret event").

## Sub-features

- `poll-vote` tick dates and a place, save, change the vote until the deadline.
- `poll-close` "Afslut afstemning nu" (creator or admin), or the last vote closes it.
- `poll-tie` a tie: the creator or an admin picks the winner; others see who will pick.
- `poll-create` "Planlæg ølsmagning" (`/c/<clubId>/polls/new`): dates, one start time, places, deadline.
- `poll-edit-cancel` "Rediger" and "Annullér afstemning".

## How to get to it (user POV)

- Overblik → the poll card → "Stem nu" (or "Vælg vinder" for a tie).
- Kalender → a dashed "Mulig dato".
- "Planlæg ølsmagning" from Overblik or Kalender for a new one.

## Driving it with the verify driver

Preconditions:

- `POLLS.open` in Drengene & Bajere: Mads and Anders voted, Kaptajnen has not. Voting as Kaptajnen
  makes everyone voted and closes the poll (into an event, or a tie; see "Closes").
- `POLLS.tie` in Torsdagsklubben: tie on the place; Mads (admin) can pick, Kaptajnen (member) cannot.

- **Open.** `openApp(id, { as: "jesper" })`, ``app.goto(`/c/${CLUBS.drengene.id}/polls/${POLLS.open.id}`)``.
  h1 "Ølsmagning #14", `getByText("2 af 3 har stemt")`, `getByRole("button", { name: "Gem min stemme" })`.
- **Vote.** Wait for the h1 first. Tick a date: `getByRole("checkbox", { name: /5\. december kl\. 18:30$/ })`
  (names are lowercase, "lørdag 5. december kl. 18:30", dates relative to the seed day); pick a place:
  `getByRole("radio", { name: "Hos Mads", exact: true }).check()`; `getByText("Ikke gemt endnu")`
  appears; choose "Gem min stemme".
- **Closes.** Kaptajnen is the last voter, so saving closes the poll. With the second date (which Mads
  also ticked) there is a winner and the event is created: `app.sql("SELECT status FROM polls WHERE id = $1", [POLLS.open.id])` is `CLOSED` (close reason `ALL_VOTED`) and `SELECT title FROM events WHERE poll_id = $1` returns the new event
  (proven 2026-11-14, `.flow/setup-verify/poll-check.mts`). Ticking only the first date makes the dates tie 1–1–1, and the status becomes
  `AWAITING_DECISION` (seen 2026-11-14). Poll for the status; the close happens after the save.
- **Tie.** `openApp(id, { as: "mads" })`, ``app.goto(`/c/${CLUBS.torsdag.id}/polls/${POLLS.tie.id}`)``:
  `getByRole("button", { name: "Vælg vinder og opret event" })`. As Kaptajnen the page says that Mads
  or an admin picks.
- **Proof.** `app.shot("poll")` before and after saving.

## Gotchas

- The poll page streams: right after `goto` the main area says "Henter afstemningen …". Wait for
  `getByRole("heading", { level: 1 })` before touching the form.
- The visible card text ("Lørdag 28/11 · 18:30", counts, voters) is not the accessible name; the
  checkbox is named "lørdag 28. november kl. 18:30" and the radio just the place name.
- Dates move with the seed day; match by role and a regex on the day and time, not a fixed date.
- The page refreshes itself every 30 seconds while the poll is open; a long drive can see a re-render.
- Saving Kaptajnen's vote on `POLLS.open` closes the poll (everyone has voted). To test changing a
  vote, vote as Mads or Anders instead.
- `/api/cron/close-polls` needs `Authorization: Bearer <cronSecret>` from the instance's
  `state.json`.
