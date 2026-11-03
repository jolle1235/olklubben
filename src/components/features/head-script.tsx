"use client";

/**
 * A constant inline script in the root layout's <head> that runs before the
 * first paint: the per-device settings on <html> (the colour theme, §13.2,
 * and the song reader, D-124). `code` must be a constant string.
 *
 * In the server HTML it is a normal inline script, so the browser runs it
 * while parsing <head>. React never runs a script it creates itself, and it
 * warns when it does (the client render of a 404 rebuilds the document,
 * F-071). On the client the element is therefore a data block
 * (type="text/plain"): hydration keeps the server's element as it is
 * (suppressHydrationWarning covers the type attribute only), and a client
 * render creates an inert element without the warning.
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
