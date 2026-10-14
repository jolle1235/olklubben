import { BanIcon } from "lucide-react";

import { getDisplayName } from "@/lib/format/display-name";
import type { PollView } from "@/server/polls/queries";

import { cancelledLabel } from "./decision-labels";

export type CancelledPollBannerProps = {
  /** A CANCELLED poll. */
  view: PollView;
  now: Date;
};

/**
 * "Afstemningen er annulleret" (SPEC §9.7.4): a muted banner above the
 * frozen results – who cancelled it and when, and that no event was created.
 */
export function CancelledPollBanner({ view, now }: CancelledPollBannerProps) {
  return (
    <section
      aria-labelledby="poll-cancelled-heading"
      className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-slate/50 bg-cream-deep/70 px-5 py-4"
    >
      <BanIcon aria-hidden className="mt-1 size-5 shrink-0 text-slate" />
      <div className="grid min-w-0 grid-cols-1 gap-1">
        <h2 id="poll-cancelled-heading" className="text-xl leading-tight font-bold text-ink">
          Afstemningen er annulleret
        </h2>
        <p className="text-[1.05rem] break-words text-slate">
          {view.cancelledAt
            ? cancelledLabel(getDisplayName(view.cancelledBy), view.cancelledAt, now)
            : "Der blev ikke oprettet et event."}
        </p>
      </div>
    </section>
  );
}
