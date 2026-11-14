# Klubbens side and members

`/c/<clubId>/club` shows the club's name, description and member count, "Medlemmer" with roles
("Kaptajnen (Jesper Thomsen) (dig) Admin"), a link to "Steder", the invitation code and link with
"Kopiér link", "Del" and (admins) "Generér ny kode", and "Farezone" (leave the club; admins can delete
it). Admins have a "Handlinger for <name>" menu per member: make admin, remove admin, reset link,
remove from the club.

## Sub-features

- `club-members` the member list with roles and "Medlem siden".
- `club-invite` code, link, copy, share, new code.
- `club-member-actions` the admin menu per member.
- `club-edit` "Rediger klubinfo" (name, description).
- `club-leave-delete` "Forlad klubben" (not the last admin) and delete by typing the club's name.

## How to get to it (user POV)

- The club switcher's club page, or "Inviter" in the top bar on mobile.
- Profil → "Klubbens side".

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })` (admin of Drengene & Bajere). Three members; code `BAJER234`.

- **Members.** ``app.goto(`/c/${CLUBS.drengene.id}/club`)``. h1 "Drengene & Bajere";
  `getByRole("region", { name: "Medlemmer" }).getByRole("listitem")` has 3 items, the first contains
  "Kaptajnen (Jesper Thomsen) (dig)".
- **Invite link.** `getByLabel("Invitationslink")` has the value `<url>/join/BAJER234`.
- **Member menu.** `getByRole("button", { name: "Handlinger for Mads" })` opens the admin menu.
- **Proof.** `app.shot("club")`.

## Gotchas

- Mads and Anders are plain members here: no member menus, no "Generér ny kode". Mads is admin of
  Torsdagsklubben.
- "Generér ny kode" revokes `BAJER234` for the rest of the instance; join checks that rely on it
  then fail. Use a fresh instance.
- The last admin can't leave; removing a member also removes their place ownerships and upcoming
  host roles.
- Deleting the club needs the name typed exactly in the confirm dialog.
