/**
 * Danish texts for the club page's member menu, "Steder" row and Farezone
 * (SPEC §7.4, §7.5, §9.8, §13.5; D-102, D-103). Pure and client-safe, so the
 * server page and the client dialogs build the same sentences.
 */

import { formatDanishList } from "@/lib/format/list";

const numberFormat = new Intl.NumberFormat("da-DK");

function count(value: number, singular: string, plural: string): string {
  return `${numberFormat.format(value)} ${value === 1 ? singular : plural}`;
}

/**
 * The Danish genitive of a name: "Mads'" (ends in s, x or z), "Jespers",
 * "R2-D2's" (does not end in a letter).
 */
export function genitive(name: string): string {
  const trimmed = name.trim();
  if (/[sxz]$/i.test(trimmed)) return `${trimmed}'`;
  if (/\p{L}$/u.test(trimmed)) return `${trimmed}s`;
  return `${trimmed}'s`;
}

/** "Ingen steder endnu", "1 sted", "5 steder" (the club page's "Steder" row). */
export function placeCountLabel(places: number): string {
  return places === 0 ? "Ingen steder endnu" : count(places, "sted", "steder");
}

export type ClubContentCounts = {
  events: number;
  beers: number;
  ratings: number;
  places: number;
};

/**
 * What "Slet klubben" deletes (§7.5, D-103): "Alt i klubben bliver slettet
 * permanent: 14 events, 37 øl med 102 ratings og 5 steder. Medlemmernes konti
 * bliver ikke slettet." Empty kinds are left out.
 */
export function deleteClubSummary({ events, beers, ratings, places }: ClubContentCounts): string {
  const parts: string[] = [];
  if (events > 0) parts.push(count(events, "event", "events"));
  if (beers > 0) {
    const beerPart = count(beers, "øl", "øl");
    parts.push(ratings > 0 ? `${beerPart} med ${count(ratings, "rating", "ratings")}` : beerPart);
  }
  if (places > 0) parts.push(count(places, "sted", "steder"));
  const what = parts.length > 0 ? `: ${formatDanishList(parts)}.` : ".";
  return `Alt i klubben bliver slettet permanent${what} Medlemmernes konti bliver ikke slettet.`;
}

export type MemberActionCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  /** The toast after it worked. */
  done: string;
};

/** "Gør til admin" (a default confirmation, §15.1). */
export function promoteCopy(name: string): MemberActionCopy {
  return {
    title: `Gør ${name} til admin?`,
    description:
      "Admins kan fjerne medlemmer, give andre admin-rollen, lave en ny invitationskode og slette klubben.",
    confirmLabel: "Gør til admin",
    done: `${name} er nu admin`,
  };
}

/** "Fjern admin-rollen" / "Fjern min admin-rolle". */
export function demoteCopy(name: string, isSelf: boolean): MemberActionCopy {
  if (isSelf) {
    return {
      title: "Fjern din admin-rolle?",
      description:
        "Du bliver almindeligt medlem og kan ikke længere styre medlemmer, invitationen eller klubbens info.",
      confirmLabel: "Fjern min admin-rolle",
      done: "Du er ikke længere admin",
    };
  }
  return {
    title: `Fjern ${genitive(name)} admin-rolle?`,
    description: `${name} bliver almindeligt medlem af klubben.`,
    confirmLabel: "Fjern admin-rollen",
    done: `${name} er ikke længere admin`,
  };
}

/** "Fjern fra klubben" (destructive, §7.4). */
export function removeCopy(name: string, clubName: string): MemberActionCopy {
  return {
    title: `Fjern ${name} fra klubben?`,
    description:
      `${name} mister adgangen til ${clubName} med det samme. ` +
      `${genitive(name)} øl, ratings og tidligere events bliver i klubben. ` +
      `${name} fjernes som ejer af sine steder og som vært for kommende events.`,
    confirmLabel: "Fjern fra klubben",
    done: `${name} er fjernet fra klubben`,
  };
}
