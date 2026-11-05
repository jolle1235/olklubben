"use client";

/**
 * An inline script for the root layout's <head>, run before the first paint.
 * Import `code` in a client component: passed from a Server Component it would
 * also travel in every page's RSC payload.
 *
 * On the client it is an inert type="text/plain": React warns when it creates a
 * <script> (a 404's client render rebuilds the document, F-071). Hydration keeps
 * the server's runnable element; suppressHydrationWarning covers the type.
 */
export function HeadScript({ code }: { code: string }) {
  const isServer = typeof window === "undefined";
  return (
    <script
      type={isServer ? undefined : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}
