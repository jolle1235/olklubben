import Link from "next/link";
import { CopyIcon, MessageSquareReplyIcon, MonitorSmartphoneIcon } from "lucide-react";

import { formatDate, toDateKey } from "@/lib/format/date";
import { feedbackHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { FEEDBACK_TYPE_ICONS, FEEDBACK_TYPE_LABELS } from "@/server/domain/feedback/status";
import type { FeedbackDetail, FeedbackTechnicalInfo } from "@/server/feedback/queries";

import { formatViewportWidth } from "./feedback-labels";
import { FeedbackStatusBadge } from "./feedback-status-badge";

/**
 * The read-only parts of a report's page (SPEC §9.9 "Detaljeside"). User
 * text is always rendered as plain text with its line breaks (no HTML, no
 * markdown, §9.9 "Misbrug og grænser") and wraps at any width (F-047).
 */

/** Type, status, "<author> · <date>" and, for a bug, "Side: /calendar". */
export function FeedbackMeta({ feedback }: { feedback: FeedbackDetail }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <span aria-hidden>{FEEDBACK_TYPE_ICONS[feedback.type]}</span>
          {FEEDBACK_TYPE_LABELS[feedback.type]}
        </span>
        <FeedbackStatusBadge status={feedback.status} />
      </p>
      <p className="text-body-sm break-words hyphens-auto text-muted-foreground">
        {feedback.authorName} ·{" "}
        <time dateTime={toDateKey(feedback.createdAt)}>{formatDate(feedback.createdAt)}</time>
      </p>
      {feedback.type === "BUG" && feedback.pagePath ? (
        <p className="text-body-sm text-muted-foreground">
          Side: <code className="font-mono break-all text-foreground">{feedback.pagePath}</code>
        </p>
      ) : null}
    </div>
  );
}

/** A report's description or the app-admin's answer: plain text, line breaks kept. */
export function FeedbackText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("text-lead break-words whitespace-pre-wrap text-foreground", className)}>
      {text}
    </p>
  );
}

/** "Svar fra app-admin" (§9.9): shown to everyone. */
export function FeedbackAdminResponse({ text }: { text: string }) {
  return (
    <section
      aria-labelledby="feedback-response-heading"
      className="grid grid-cols-1 gap-2 rounded-xl border border-info-border bg-info-subtle px-4 py-4 sm:px-5"
    >
      <h2
        id="feedback-response-heading"
        className="flex items-center gap-2 text-title-sm-tight text-info-ink"
      >
        <MessageSquareReplyIcon aria-hidden className="size-5 shrink-0" />
        Svar fra app-admin
      </h2>
      <FeedbackText text={text} />
    </section>
  );
}

/** "Dublet af «titel»" with a link, or a note that the original is gone (E28). */
export function FeedbackDuplicateNote({ original }: { original: FeedbackDetail["duplicateOf"] }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-foreground">
      <CopyIcon aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
      {original ? (
        <span className="min-w-0 break-words hyphens-auto">
          Dublet af{" "}
          <Link
            href={feedbackHref(original.id)}
            className="font-semibold text-primary-ink underline decoration-2 underline-offset-4 pressable-dim hover:decoration-highlight"
          >
            «{original.title}»
          </Link>
        </span>
      ) : (
        <span className="min-w-0">Dublet (den originale rapport er slettet)</span>
      )}
    </p>
  );
}

/** "Teknisk info (kun synlig for dig)": app-admins only (§9.9, D-145). */
export function FeedbackTechInfo({ info }: { info: FeedbackTechnicalInfo }) {
  const width = formatViewportWidth(info.viewportWidth);
  const empty = info.userAgent === null && width === null;
  return (
    <section
      aria-labelledby="feedback-tech-heading"
      className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-4 sm:px-5"
    >
      <h2
        id="feedback-tech-heading"
        className="flex items-center gap-2 text-title-sm-tight text-primary-ink"
      >
        <MonitorSmartphoneIcon aria-hidden className="size-5 shrink-0" />
        Teknisk info (kun synlig for dig)
      </h2>
      {empty ? (
        <p className="text-muted-foreground">Ingen teknisk info</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
          {info.userAgent ? (
            <>
              <dt className="font-semibold text-foreground">Browser/enhed</dt>
              <dd className="font-mono text-label-lg break-all text-muted-foreground">
                {info.userAgent}
              </dd>
            </>
          ) : null}
          {width ? (
            <>
              <dt className="font-semibold text-foreground">Skærmbredde</dt>
              <dd className="text-muted-foreground">{width}</dd>
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}
