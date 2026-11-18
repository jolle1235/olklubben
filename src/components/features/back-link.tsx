import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** "← Alle steder" above a detail page's title: back to its list. */
export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-1 -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-primary-ink underline-offset-4 pressable-dim hover:underline",
        className,
      )}
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
