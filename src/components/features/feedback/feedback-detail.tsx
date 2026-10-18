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
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span aria-hidden>{FEEDBACK_TYPE_ICONS[feedback.type]}</span>
          {FEEDBACK_TYPE_LABELS[feedback.type]}
        </span>
        <FeedbackStatusBadge status={feedback.status} />
      </p>
      <p className="text-[0.95rem] break-words hyphens-auto text-muted-foreground">
        {feedback.authorName} ·{" "}
        <time dateTime={toDateKey(feedback.createdAt)}>{formatDate(feedback.createdAt)}</time>
      </p>
      {feedback.type === "BUG" && feedback.pagePath ? (
        <p className="text-[0.95rem] text-muted-foreground">
          Side: <code className="font-mono break-all text-ink">{feedback.pagePath}</code>
        </p>
      ) : null}
    </div>
  );
}

/** A report's description or the app-admin's answer: plain text, line breaks kept. */
export function FeedbackText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("text-[1.05rem] break-words whitespace-pre-wrap text-ink", className)}>
      {text}
    </p>
  );
}

/** "Svar fra app-admin" (§9.9): shown to everyone. */
export function FeedbackAdminResponse({ text }: { text: string }) {
  return (
    <section
      aria-labelledby="feedback-response-heading"
      className="grid grid-cols-1 gap-2 rounded-xl border border-harbor/30 bg-harbor-tint px-4 py-4 sm:px-5"
    >
      <h2
        id="feedback-response-heading"
        className="flex items-center gap-2 text-xl leading-tight text-harbor"
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
    <p className="flex items-start gap-2 rounded-xl border border-border bg-paper px-4 py-3 text-ink">
      <CopyIcon aria-hidden className="mt-1 size-4 shrink-0 text-slate" />
      {original ? (
        <span className="min-w-0 break-words hyphens-auto">
          Dublet af{" "}
          <Link
            href={feedbackHref(original.id)}
            className="font-semibold text-olive underline decoration-2 underline-offset-4 hover:decoration-amber"
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
      className="grid grid-cols-1 gap-3 rounded-xl border border-dashed border-input bg-paper px-4 py-4 sm:px-5"
    >
      <h2
        id="feedback-tech-heading"
        className="flex items-center gap-2 text-xl leading-tight text-olive"
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
              <dt className="font-semibold text-ink">Browser/enhed</dt>
              <dd className="font-mono text-[0.9rem] break-all text-slate">{info.userAgent}</dd>
            </>
          ) : null}
          {width ? (
            <>
              <dt className="font-semibold text-ink">Skærmbredde</dt>
              <dd className="text-slate">{width}</dd>
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}
