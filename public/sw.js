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
 * Any request to a page you land on after logging out, logging in, or leaving a club clears the
 * page cache, so the next open never shows another user's or a left club's page.
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
 * How each Overblik navigation was answered, until the page asks (see "message"):
 * "network", or a promise that resolves to "fresh" when the background revalidation is done.
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

  // Every mode: after router.refresh() an expired session redirects with an RSC fetch to /login.
  if (CLEARING_PATHS.has(url.pathname)) {
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
 *   { type: "last-club", path }     the club page being shown, for "/" next time;
 *   { type: "revalidated?", url }   the URL the document loaded (path + query); answered on the
 *                                   given port with "network" (not served from the cache),
 *                                   "fresh" once the background fetch is stored, or "unknown"
 *                                   (e.g. the worker restarted): the page refreshes on both.
 */
self.addEventListener("message", (event) => {
  const { type, path, url } = event.data ?? {};
  const port = event.ports[0];
  if (type === "last-club") {
    event.waitUntil(rememberLastClub(path));
  } else if (type === "revalidated?" && port && typeof url === "string") {
    const loaded = new URL(url, self.location.origin);
    const answer = isCachedPage(loaded) ? (answers.get(loaded.pathname) ?? "unknown") : "network";
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
    answers.set(
      path,
      revalidation.then(() => "fresh"),
    );
    event.waitUntil(revalidation);
    return cached;
  }

  answers.set(path, "network");
  const startedAt = generation;
  const response = await fetch(event.request);
  if (isStorable(response)) event.waitUntil(storePage(path, response.clone(), startedAt));
  return response;
}

async function revalidate(request, path) {
  const startedAt = generation;
  let response;
  try {
    response = await fetch(request);
  } catch {
    return; // Offline: keep the cached page.
  }
  if (isStorable(response)) {
    await storePage(path, response, startedAt);
  } else if (response.type === "opaqueredirect" || response.status === 404) {
    // Logged out or no longer a member: the page must not be shown again.
    await forgetPage(path);
  }
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
  const pages = await caches.open(PAGES);
  await pages.put(LAST_CLUB, new Response(path));
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
