# Overblik (club home)

The club's home page `/c/<clubId>`: the next tasting large ("om 3 dage", "I morgen!", "I aften! 🍻",
"I gang nu"), a card per poll ("Du mangler at stemme", "Du har stemt ✓", ties, "🎉 Afgjort"), then
"Kommende arrangementer" and "Tidligere ølsmagninger" (the three newest, with beer count and best
beer). A club with one member sees "Inviter dine ølbrødre" first.

## Sub-features

- `overview-next` the hero card "Næste ølsmagning" with countdown and shortcuts.
- `overview-polls` one card per open, tied or recently decided poll.
- `overview-upcoming` "Kommende arrangementer".
- `overview-history` "Tidligere ølsmagninger".

## How to get to it (user POV)

- Log in: Kaptajnen and Anders land here.
- "Overblik" in the main navigation (sidebar on desktop, bottom nav on mobile).
- The club switcher ("<club>. Skift klub") → pick a club.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`, seed untouched: in Drengene & Bajere, Ølsmagning #13 is in 3 days,
  poll "Ølsmagning #14" is open and Kaptajnen has not voted.

- **Open.** ``app.goto(`/c/${CLUBS.drengene.id}`)``.
- **Next tasting.** `getByRole("region", { name: "Næste ølsmagning" })` contains
  `getByRole("heading", { name: "Ølsmagning #13" })`.
- **Poll card.** `getByRole("region", { name: "Afstemning: Ølsmagning #14" })` contains
  "Du mangler at stemme". As Mads or Anders (who voted) it says "Du har stemt ✓".
- **History.** `getByRole("region", { name: "Tidligere ølsmagninger" })` is visible.
- **Proof.** `app.shot("overview")`; desktop and `viewport: "mobile"` both.

## Gotchas

- The h1 "Overblik" is visually hidden (the next event comes first, SPEC §3.2).
- The decided poll "Ølsmagning #13" also has a card ("🎉 Afgjort") for 3 days after it was seeded.
- The open poll's deadline is fixed when the instance seeds it (10 days ahead), so it stays open for
  the instance's lifetime.
- Opening a club's Overblik makes it the user's last active club.
