/**
 * Ølklubben's service worker (SPEC §13.6, D-185). Registered only in production builds
 * (src/components/features/pwa/service-worker.tsx).
 *
 * Opening the installed app shows the club's Overblik as it looked last time, straight from this
 * cache, while the fresh page is fetched in the background (stale-while-revalidate). When that
 * fetch is done, the page asks for it with router.refresh() (CachedPageRefresh).
 *
 *   /c/<clubId>      Overblik only, no query: from the cache, revalidated in the background;
 *                    from the network when not cached. No forms, no songbook, nothing else.
 *   /                to this device's last club (/__last-club) when its Overblik is cached;
 *                    otherwise the server routes as usual (§10.1).
 *   /_next/static/   cache-first (hashed, immutable): a cached page from an older deploy still
 *                    finds its own JavaScript.
 *
 * A visit to a page you land on after logging out, logging in, or leaving a club (not a Link
 * prefetch of it) clears the page cache, so the next open never shows another user's or a left
 * club's page.
 *
 * Kill switch (D-185): replace this file with one that deletes every cache and calls
 * self.registration.unregister() in "activate".
 */

const PAGES = "olk-pages-v1";
const STATIC = "olk-static-v1";
const LAST_CLUB = "/__last-club";
const STATIC_MAX_ENTRIES = 300;
// A static file cannot import src/lib: keep these in step with overviewHref (src/lib/routes.ts),
// the auth pages and PROTECTED_SECTIONS (src/lib/protected-paths.ts) when a route moves.
const OVERVIEW_PATH = /^\/c\/[^/]+$/;
const CLEARING_PATHS = new Set([
  "/login",
  "/signup",
  "/clubs",
  "/onboarding",
  "/api/auth/sign-out",
]);

/** Bumped on every clear: a revalidation that started before a clear must not store its page. */
let generation = 0;

/**
 * Whether the page of each Overblik navigation should refresh, until it asks (see "message"):
 * false when it came from the network, else the background revalidation's promise.
 */
const answers = new Map();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== PAGES && name !== STATIC) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Every mode (after router.refresh() an expired session redirects with an RSC fetch to /login),
  // but never a Link prefetch: a link to /onboarding on screen is not a visit.
  if (CLEARING_PATHS.has(url.pathname) && !request.headers.has("next-router-prefetch")) {
    event.waitUntil(clearPages());
    return;
  }
  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(fromStaticCache(event));
    return;
  }
  if (request.mode !== "navigate") return;

  if (url.pathname === "/") {
    event.respondWith(home(request));
  } else if (isCachedPage(url)) {
    event.respondWith(overview(event, url.pathname));
  }
});

/**
 * From CachedPageRefresh:
 *   { type: "last-club", path }     the club page being shown, for "/" next time; its Overblik is
 *                                   fetched in the background when not cached yet (after a login
 *                                   or a club switch, which arrive without a document load);
 *   { type: "revalidated?", url }   the URL the document loaded (path + query); answered on the
 *                                   given port with true when the page should router.refresh()
 *                                   (true when nothing is known, e.g. after a worker restart).
 */
self.addEventListener("message", (event) => {
  const { type, path, url } = event.data ?? {};
  const port = event.ports[0];
  if (type === "last-club") {
    event.waitUntil(rememberLastClub(path));
  } else if (type === "revalidated?" && port && typeof url === "string") {
    const loaded = new URL(url, self.location.origin);
    const answer = isCachedPage(loaded) ? (answers.get(loaded.pathname) ?? true) : false;
    answers.delete(loaded.pathname);
    event.waitUntil(Promise.resolve(answer).then((value) => port.postMessage(value)));
  }
});

async function home(request) {
  const pages = await caches.open(PAGES);
  const last = await pages.match(LAST_CLUB);
  const path = last ? await last.text() : null;
  if (path && (await pages.match(path, { ignoreVary: true }))) {
    return Response.redirect(path, 302);
  }
  // fetch(request) keeps redirect mode "manual": the server's 307 passes through.
  return fetch(request);
}

async function overview(event, path) {
  const pages = await caches.open(PAGES);
  const cached = await pages.match(path, { ignoreVary: true });
  if (cached) {
    const revalidation = revalidate(event.request, path);
    answers.set(path, revalidation);
    event.waitUntil(revalidation);
    return cached;
  }

  answers.set(path, false);
  const startedAt = generation;
  const response = await fetch(event.request);
  if (isStorable(response)) event.waitUntil(storePage(path, response.clone(), startedAt));
  return response;
}

/**
 * Resolves to true when the page should refresh: the fresh page is stored, or the cached one was
 * dropped. False when the server failed or could not be reached: the cached page stays, and a
 * refresh would only fail into a document load from this cache again, a reload loop (F-101).
 */
async function revalidate(request, path) {
  const startedAt = generation;
  let response;
  try {
    response = await fetch(request);
  } catch {
    return false;
  }
  if (isStorable(response)) {
    await storePage(path, response, startedAt);
    return true;
  }
  if (response.type === "opaqueredirect" || response.status === 404) {
    // Logged out or no longer a member: the page must not be shown again.
    await forgetPage(path);
    return true;
  }
  return false;
}

/** The one page served from the cache: Overblik, without a query. */
function isCachedPage(url) {
  return OVERVIEW_PATH.test(url.pathname) && url.search === "";
}

/** Only a complete page from our own server: no redirect, no error, HTML. */
function isStorable(response) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    (response.headers.get("content-type") ?? "").includes("text/html")
  );
}

async function storePage(path, response, startedAt) {
  if (generation !== startedAt) return;
  const pages = await caches.open(PAGES);
  if (generation !== startedAt) return;
  await pages.put(path, response);
}

/** home() only follows LAST_CLUB to a cached page, so an orphaned entry is harmless. */
async function forgetPage(path) {
  await (await caches.open(PAGES)).delete(path);
}

async function rememberLastClub(path) {
  if (typeof path !== "string" || !OVERVIEW_PATH.test(path)) return;
  // A document load of this page is in flight and stores it itself (checked before any await).
  const loading = answers.has(path);
  const startedAt = generation;
  const pages = await caches.open(PAGES);
  await pages.put(LAST_CLUB, new Response(path));
  if (!loading) await cacheIfMissing(pages, path, startedAt);
}

/** Fetches a page the cache lacks: after a login or a club switch, which load no document. */
async function cacheIfMissing(pages, path, startedAt) {
  if (await pages.match(path, { ignoreVary: true })) return;
  try {
    const response = await fetch(path, { headers: { accept: "text/html" } });
    if (isStorable(response)) await storePage(path, response, startedAt);
  } catch {
    // Offline: the next open fetches it.
  }
}

async function clearPages() {
  generation += 1;
  answers.clear();
  await caches.delete(PAGES);
}

async function fromStaticCache(event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (response.ok && response.type === "basic") {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cache)));
  }
  return response;
}

/** Keeps the newest STATIC_MAX_ENTRIES files (keys come back in insertion order). */
async function trim(cache) {
  const keys = await cache.keys();
  const oldest = keys.slice(0, Math.max(0, keys.length - STATIC_MAX_ENTRIES));
  await Promise.all(oldest.map((key) => cache.delete(key)));
}
