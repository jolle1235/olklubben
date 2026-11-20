/**
 * Deletes every Cache Storage cache of this origin: the service worker's cached
 * Overblik, its last club and its JavaScript files (D-185). Called on "Log ud",
 * also when no worker controls the page. Best effort and client-only.
 */
export async function clearDeviceCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // Storage blocked (private mode): there is nothing cached either.
  }
}
