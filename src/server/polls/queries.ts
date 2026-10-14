import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { compareByDisplayName, getDisplayName } from "@/lib/format/display-name";
import { isValidId } from "@/lib/ids";
import { db } from "@/server/db";
import { isUpcomingOrOngoing } from "@/server/domain/events/status";
import { comparePlacesByName } from "@/server/domain/places/name";
import type { BallotVotes } from "@/server/domain/polls/ballot";
import { votedMemberIds } from "@/server/domain/polls/lifecycle";
import {
  ACTIVE_POLL_STATUSES,
  pollShape,
  type PollCategory,
  type PollCloseReason,
  type PollOptionRef,
  type PollShape,
  type PollStatus,
} from "@/server/domain/polls/options";
import {
  displayWinners,
  tallyPoll,
  tiedCategories,
  type CategoryTally,
  type PollTally,
  type Resolutions,
} from "@/server/domain/polls/tally";
import { getSuggestedEventTitle } from "@/server/events/queries";
import { personSelect, type PersonRef } from "@/server/users/select";

/**
 * Read queries for polls (SPEC §9.7, §9.1, §9.3; D-014, D-137).
 *
 * Club isolation (§4.4): every query takes the clubId and filters by it, so a
 * poll of another club is simply "not found" / left out. The caller must
 * already have checked membership (requirePoll / requireClubPage).
 *
 * Counts, "har stemt", "alle har stemt" and the winner are COMPUTED here from
 * the ballots (§3.4, tallyPoll); only a manual tie choice is stored. Voting is
 * fully open (D-014): every member sees who voted for what.
 */

// ── The poll's guard reference ──────────────────────────────────────────────

export type PollRef = {
  id: string;
  title: string;
  status: PollStatus;
  createdById: string;
  deadline: Date;
};

/**
 * The poll's id, title, status, creator and deadline, or null (unknown,
 * malformed or another club's id). Cached per request for the guard layout,
 * generateMetadata and the page. May be stale after the page's lazy close in
 * the same request: only getPollView (uncached) decides what renders.
 */
export const getPollRef = cache(async (clubId: string, pollId: string): Promise<PollRef | null> => {
  if (!isValidId(pollId)) return null;
  return db.poll.findFirst({
    where: { id: pollId, clubId },
    select: { id: true, title: true, status: true, createdById: true, deadline: true },
  });
});

// ── The poll page ───────────────────────────────────────────────────────────

/** A person on the poll page. isMember is false for someone who has left (history, §7.4). */
export type PollPerson = PersonRef & { isMember: boolean; isViewer: boolean };

export type PollOptionView = {
  id: string;
  count: number;
  /** Who ticked it, by display name. Former members included (frozen history). */
  voters: PollPerson[];
  /** The unique top option of a votable category right now (no tie, count > 0). */
  isLeader: boolean;
  /** The decided option (AWAITING_DECISION: the decided category; CLOSED: both). Fixed options too. */
  isWinner: boolean;
  /** Among the options sharing the top count. While OPEN only when that count > 0. */
  isTied: boolean;
  /** In the viewer's stored ballot. */
  viewerTicked: boolean;
};

export type PollDateOptionView = PollOptionView & { startsAt: Date };

export type PollPlaceOptionView = PollOptionView & {
  place: {
    id: string;
    name: string;
    address: string | null;
    archived: boolean;
    /** By display name: they become the hosts (§9.7.7). */
    ownerIds: string[];
    ownerNames: string[];
  };
};

export type PollView = {
  id: string;
  clubId: string;
  title: string;
  theme: string | null;
  description: string | null;
  deadline: Date;
  status: PollStatus;
  closeReason: PollCloseReason | null;
  closedAt: Date | null;
  /** Only for closeReason MANUAL. */
  closedBy: PollPerson | null;
  cancelledAt: Date | null;
  cancelledBy: PollPerson | null;
  createdById: string;
  createdBy: PollPerson;
  createdAt: Date;
  /** "vote" or "fixed" per category (§9.7.1). */
  shape: PollShape;
  /** By startsAt. */
  dates: PollDateOptionView[];
  /** By place name (comparePlacesByName). */
  places: PollPlaceOptionView[];
  /** «Ingen af datoerne passer mig», by display name. */
  noDateWorksVoters: PollPerson[];
  /** The club's current members, by display name. */
  members: PollPerson[];
  /** Current members with a complete ballot. */
  votedMemberIds: string[];
  /** Current members without one ("Mangler: …"), by display name. */
  missingMembers: PollPerson[];
  /** Every ballot, former members' history included. */
  ballotCount: number;
  /** The viewer's stored ballot, or null. */
  myBallot: {
    noDateWorks: boolean;
    dateOptionIds: string[];
    placeOptionId: string | null;
    updatedAt: Date;
  } | null;
  tally: PollTally;
  /** Non-empty only while AWAITING_DECISION (DATE first). */
  tiedCategories: PollCategory[];
  /** displayWinners(tally, resolutions): the decided option per category, null while tied. */
  winners: Record<PollCategory, string | null>;
  /** The manual choices after a tie (D-008). */
  tieResolutions: {
    category: PollCategory;
    optionId: string;
    chosenBy: PollPerson;
    chosenAt: Date;
  }[];
  /** The event the poll created; null before the close, or after the event was deleted. */
  event: {
    id: string;
    title: string;
    startsAt: Date;
    placeName: string;
    hosts: PollPerson[];
  } | null;
};

const viewSelect = {
  id: true,
  clubId: true,
  title: true,
  theme: true,
  description: true,
  deadline: true,
  status: true,
  closeReason: true,
  closedAt: true,
  closedBy: { select: personSelect },
  cancelledAt: true,
  cancelledBy: { select: personSelect },
  createdById: true,
  createdBy: { select: personSelect },
  createdAt: true,
  options: {
    select: {
      id: true,
      category: true,
      startsAt: true,
      place: {
        select: {
          id: true,
          name: true,
          address: true,
          archivedAt: true,
          owners: { select: { user: { select: personSelect } } },
        },
      },
    },
  },
  ballots: {
    select: {
      userId: true,
      noDateWorks: true,
      updatedAt: true,
      user: { select: personSelect },
      votes: { select: { optionId: true, category: true } },
    },
  },
  tieResolutions: {
    select: {
      category: true,
      chosenOptionId: true,
      chosenAt: true,
      chosenBy: { select: personSelect },
    },
  },
  events: {
    select: {
      id: true,
      title: true,
      startsAt: true,
      place: { select: { name: true } },
      hosts: { select: { user: { select: personSelect } } },
    },
    take: 1,
  },
} satisfies Prisma.PollSelect;

function categoryOf(tally: PollTally, category: PollCategory): CategoryTally {
  return category === "DATE" ? tally.date : tally.place;
}

/** isLeader / isTied / count / voterIds of one option, from the tally. */
function optionFlags(
  tally: PollTally,
  category: PollCategory,
  optionId: string,
  status: PollStatus,
  winners: Record<PollCategory, string | null>,
) {
  const { outcome, options } = categoryOf(tally, category);
  const option = options.find((entry) => entry.optionId === optionId);
  const isTied =
    outcome.kind === "tie" &&
    outcome.optionIds.includes(optionId) &&
    (status !== "OPEN" || outcome.count > 0);
  return {
    count: option?.count ?? 0,
    voterIds: option?.voterIds ?? [],
    isLeader: outcome.kind === "winner" && outcome.optionId === optionId,
    isTied,
    isWinner:
      (status === "AWAITING_DECISION" || status === "CLOSED") && winners[category] === optionId,
  };
}

/**
 * Everything the poll page shows, or null for another club's (or an unknown)
 * poll. UNCACHED: the page calls it after its lazy close in the same request.
 */
export async function getPollView(
  clubId: string,
  pollId: string,
  viewerId: string,
): Promise<PollView | null> {
  if (!isValidId(pollId)) return null;
  const [row, memberships] = await Promise.all([
    db.poll.findFirst({ where: { id: pollId, clubId }, select: viewSelect }),
    db.membership.findMany({ where: { clubId }, select: { user: { select: personSelect } } }),
  ]);
  if (!row) return null;

  const memberIds = new Set(memberships.map((membership) => membership.user.id));
  const person = (user: PersonRef): PollPerson => ({
    ...user,
    isMember: memberIds.has(user.id),
    isViewer: user.id === viewerId,
  });

  const dateRows = row.options
    .filter((option) => option.category === "DATE" && option.startsAt)
    .sort(
      (a, b) =>
        (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
  const placeRows = row.options
    .flatMap((option) =>
      option.category === "PLACE" && option.place ? [{ id: option.id, place: option.place }] : [],
    )
    .sort((a, b) => comparePlacesByName(a.place, b.place));
  const refs: PollOptionRef[] = [
    ...dateRows.map((option) => ({ id: option.id, category: "DATE" as const })),
    ...placeRows.map((option) => ({ id: option.id, category: "PLACE" as const })),
  ];

  const ballots = [...row.ballots].sort((a, b) => compareByDisplayName(a.user, b.user));
  const people = new Map<string, PollPerson>(
    ballots.map((ballot) => [ballot.userId, person(ballot.user)]),
  );
  const ballotVotes: BallotVotes[] = ballots.map((ballot) => ({
    userId: ballot.userId,
    noDateWorks: ballot.noDateWorks,
    optionIds: ballot.votes.map((vote) => vote.optionId),
  }));
  const tally = tallyPoll(refs, ballotVotes);
  const resolutions: Resolutions = {};
  for (const resolution of row.tieResolutions) {
    resolutions[resolution.category] = resolution.chosenOptionId;
  }
  const winners = displayWinners(tally, resolutions);
  const voters = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const voter = people.get(id);
      return voter ? [voter] : [];
    });

  const mine = ballots.find((ballot) => ballot.userId === viewerId);
  const myTicks = new Set(mine?.votes.map((vote) => vote.optionId) ?? []);
  const view = (category: PollCategory, id: string): PollOptionView => {
    const flags = optionFlags(tally, category, id, row.status, winners);
    return {
      id,
      count: flags.count,
      voters: voters(flags.voterIds),
      isLeader: flags.isLeader,
      isWinner: flags.isWinner,
      isTied: flags.isTied,
      viewerTicked: myTicks.has(id),
    };
  };

  const members = memberships
    .map((membership) => person(membership.user))
    .sort(compareByDisplayName);
  const voted = votedMemberIds(memberIds, ballotVotes, refs);
  const event = row.events[0] ?? null;

  return {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    theme: row.theme,
    description: row.description,
    deadline: row.deadline,
    status: row.status,
    closeReason: row.closeReason,
    closedAt: row.closedAt,
    closedBy: row.closedBy ? person(row.closedBy) : null,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy ? person(row.cancelledBy) : null,
    createdById: row.createdById,
    createdBy: person(row.createdBy),
    createdAt: row.createdAt,
    shape: pollShape(refs),
    dates: dateRows.map((option) => ({
      ...view("DATE", option.id),
      startsAt: option.startsAt as Date,
    })),
    places: placeRows.map((option) => {
      const owners = option.place.owners.map((owner) => owner.user).sort(compareByDisplayName);
      return {
        ...view("PLACE", option.id),
        place: {
          id: option.place.id,
          name: option.place.name,
          address: option.place.address,
          archived: option.place.archivedAt !== null,
          ownerIds: owners.map((owner) => owner.id),
          ownerNames: owners.map((owner) => getDisplayName(owner)),
        },
      };
    }),
    noDateWorksVoters: voters(tally.noDateWorksVoterIds),
    members,
    votedMemberIds: members.filter((member) => voted.has(member.id)).map((member) => member.id),
    missingMembers: members.filter((member) => !voted.has(member.id)),
    ballotCount: tally.ballotCount,
    myBallot: mine
      ? {
          noDateWorks: mine.noDateWorks,
          dateOptionIds: dateRows.filter((o) => myTicks.has(o.id)).map((o) => o.id),
          placeOptionId: mine.votes.find((vote) => vote.category === "PLACE")?.optionId ?? null,
          updatedAt: mine.updatedAt,
        }
      : null,
    tally,
    tiedCategories: row.status === "AWAITING_DECISION" ? tiedCategories(tally) : [],
    winners,
    tieResolutions: row.tieResolutions.map((resolution) => ({
      category: resolution.category,
      optionId: resolution.chosenOptionId,
      chosenBy: person(resolution.chosenBy),
      chosenAt: resolution.chosenAt,
    })),
    event: event
      ? {
          id: event.id,
          title: event.title,
          startsAt: event.startsAt,
          placeName: event.place.name,
          hosts: event.hosts.map((host) => person(host.user)).sort(compareByDisplayName),
        }
      : null,
  };
}

// ── Overblik ────────────────────────────────────────────────────────────────

export type OverviewPollItem = {
  id: string;
  title: string;
  status: "OPEN" | "AWAITING_DECISION" | "CLOSED";
  deadline: Date;
  createdById: string;
  creatorName: string;
  creatorIsMember: boolean;
  /** The viewer has a complete ballot. */
  viewerHasVoted: boolean;
  /** Current members with a complete ballot / current members. */
  votedCount: number;
  memberCount: number;
  /** AWAITING_DECISION only. */
  tiedCategories: PollCategory[];
  /** "Fører lige nu" (OPEN only): the leading/fixed date and place; null on any tie. */
  leader: { startsAt: Date | null; placeName: string | null } | null;
  /** CLOSED: the event it created. */
  event: { id: string; startsAt: Date; placeName: string; hostNames: string[] } | null;
};

/** A CLOSED poll stays on Overblik this long after closedAt (while its event has not ended). */
export const OVERVIEW_CLOSED_POLL_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const overviewSelect = {
  id: true,
  title: true,
  status: true,
  deadline: true,
  closedAt: true,
  createdById: true,
  createdBy: { select: personSelect },
  options: {
    select: { id: true, category: true, startsAt: true, place: { select: { name: true } } },
  },
  ballots: {
    select: { userId: true, noDateWorks: true, votes: { select: { optionId: true } } },
  },
  events: {
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      place: { select: { name: true } },
      hosts: { select: { user: { select: personSelect } } },
    },
    take: 1,
  },
} satisfies Prisma.PollSelect;

function overviewRank(item: OverviewPollItem): number {
  if (item.status === "OPEN" && !item.viewerHasVoted) return 0;
  if (item.status === "AWAITING_DECISION") return 1;
  if (item.status === "OPEN") return 2;
  return 3;
}

/**
 * The poll cards of Overblik (D-137): OPEN and AWAITING_DECISION polls, plus
 * CLOSED ones from the last OVERVIEW_CLOSED_POLL_DAYS whose event has not
 * ended (a deleted event hides the card). Order: the viewer has not voted →
 * AWAITING_DECISION → OPEN → CLOSED; within a group by deadline.
 */
export async function listOverviewPolls(
  clubId: string,
  viewerId: string,
  now: Date,
): Promise<OverviewPollItem[]> {
  const [rows, memberships] = await Promise.all([
    db.poll.findMany({
      where: {
        clubId,
        OR: [
          { status: { in: [...ACTIVE_POLL_STATUSES] } },
          {
            status: "CLOSED",
            closedAt: { gte: new Date(now.getTime() - OVERVIEW_CLOSED_POLL_DAYS * DAY_MS) },
          },
        ],
      },
      select: overviewSelect,
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    }),
    db.membership.findMany({ where: { clubId }, select: { userId: true } }),
  ]);
  const memberIds = new Set(memberships.map((membership) => membership.userId));

  const items: OverviewPollItem[] = [];
  for (const row of rows) {
    const status = row.status;
    if (status === "CANCELLED") continue;
    const event = row.events[0] ?? null;
    if (status === "CLOSED" && (!event || !isUpcomingOrOngoing(event, now))) continue;

    const refs: PollOptionRef[] = row.options.map((option) => ({
      id: option.id,
      category: option.category,
    }));
    const ballots: BallotVotes[] = row.ballots.map((ballot) => ({
      userId: ballot.userId,
      noDateWorks: ballot.noDateWorks,
      optionIds: ballot.votes.map((vote) => vote.optionId),
    }));
    const voted = votedMemberIds(memberIds, ballots, refs);
    const tally = tallyPoll(refs, ballots);
    const tied = tiedCategories(tally);

    let leader: OverviewPollItem["leader"] = null;
    if (status === "OPEN" && tied.length === 0) {
      const winners = displayWinners(tally, {});
      const date = row.options.find((option) => option.id === winners.DATE);
      const place = row.options.find((option) => option.id === winners.PLACE);
      leader = { startsAt: date?.startsAt ?? null, placeName: place?.place?.name ?? null };
    }

    items.push({
      id: row.id,
      title: row.title,
      status,
      deadline: row.deadline,
      createdById: row.createdById,
      creatorName: getDisplayName(row.createdBy),
      creatorIsMember: memberIds.has(row.createdById),
      viewerHasVoted: voted.has(viewerId),
      votedCount: voted.size,
      memberCount: memberIds.size,
      tiedCategories: status === "AWAITING_DECISION" ? tied : [],
      leader,
      event:
        status === "CLOSED" && event
          ? {
              id: event.id,
              startsAt: event.startsAt,
              placeName: event.place.name,
              hostNames: event.hosts
                .map((host) => host.user)
                .sort(compareByDisplayName)
                .map((user) => getDisplayName(user)),
            }
          : null,
    });
  }
  // Stable: rows are already by deadline.
  return items.sort((a, b) => overviewRank(a) - overviewRank(b));
}

// ── Kalender ────────────────────────────────────────────────────────────────

export type CalendarPollOption = {
  optionId: string;
  pollId: string;
  pollTitle: string;
  startsAt: Date;
  deadline: Date;
  status: "OPEN" | "AWAITING_DECISION";
  /** The viewer ticked this date ("Du kan ✓"). */
  viewerTicked: boolean;
};

/**
 * The date options of the club's OPEN and AWAITING_DECISION polls with
 * from ≤ startsAt < to (to optional), oldest first: the calendar's dashed
 * "Mulig dato" (§9.3, D-137). CLOSED/CANCELLED polls' options disappear.
 */
export async function listPollDateOptions(
  clubId: string,
  viewerId: string,
  range: { from: Date; to?: Date },
): Promise<CalendarPollOption[]> {
  const rows = await db.pollOption.findMany({
    where: {
      clubId,
      category: "DATE",
      startsAt: { gte: range.from, ...(range.to ? { lt: range.to } : {}) },
      poll: { clubId, status: { in: [...ACTIVE_POLL_STATUSES] } },
    },
    select: {
      id: true,
      pollId: true,
      startsAt: true,
      poll: { select: { title: true, deadline: true, status: true } },
      votes: { where: { ballot: { userId: viewerId } }, select: { optionId: true }, take: 1 },
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  return rows.flatMap((row) =>
    row.startsAt && (row.poll.status === "OPEN" || row.poll.status === "AWAITING_DECISION")
      ? [
          {
            optionId: row.id,
            pollId: row.pollId,
            pollTitle: row.poll.title,
            startsAt: row.startsAt,
            deadline: row.poll.deadline,
            status: row.poll.status,
            viewerTicked: row.votes.length > 0,
          },
        ]
      : [],
  );
}

// ── The poll form ───────────────────────────────────────────────────────────

/**
 * "Ølsmagning #N" for a new poll: the same suggestion as a new event, which
 * counts events AND OPEN/AWAITING_DECISION polls (D-137).
 */
export async function getSuggestedPollTitle(clubId: string): Promise<string> {
  return getSuggestedEventTitle(clubId);
}

/** The latest events' start times (suggestPollDates finds the club's usual weekday). */
export async function listRecentEventStarts(clubId: string, limit = 12): Promise<Date[]> {
  const rows = await db.event.findMany({
    where: { clubId },
    select: { startsAt: true },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map((row) => row.startsAt);
}

/** How many polls the club has (any status): "Slet klubben" (D-103). */
export async function countClubPolls(clubId: string): Promise<number> {
  return db.poll.count({ where: { clubId } });
}
