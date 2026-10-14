import Link from "next/link";
import { pollHref } from "@/lib/routes";

export type EventPollNoteProps = {
  clubId: string;
  pollId: string;
};

/**
 * "Valgt ved afstemning 🗳" on an event a poll created (SPEC §9.2, §9.7.7,
 * D-137): a small link back to the poll, so everyone can see how the date and
 * the place were chosen. The event is an ordinary event otherwise.
 */
export function EventPollNote({ clubId, pollId }: EventPollNoteProps) {
  return (
    <p className="text-[0.95rem]">
      <Link
        href={pollHref(clubId, pollId)}
        className="inline-flex min-h-11 items-center font-semibold text-harbor underline decoration-2 underline-offset-4 hover:decoration-amber"
      >
        Valgt ved afstemning 🗳
      </Link>
    </p>
  );
}
