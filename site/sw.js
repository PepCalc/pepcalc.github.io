// Retires the service worker PepCalc registered when the app lived at the root of this origin
// (scope "/"). The app now lives at /app/ with its own worker. Browsers with the old worker
// fetch this file on their next update check; it takes over, deletes only the caches of the
// root scope, unregisters itself, and sends any open app window to /app/. It never touches
// IndexedDB, where the app's data lives, and it is the only script on this site: no page
// registers it. scripts/check-site.mjs holds it to that.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      // Workbox names its precache after the scope, so the app's cache under /app/ is kept.
      for (const key of await caches.keys()) {
        if (key.endsWith(scope)) await caches.delete(key)
      }
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        const hash = new URL(client.url).hash
        try {
          await client.navigate(new URL('app/' + hash, scope).href)
        } catch {
          // A window that can't be navigated loads the new app on its next visit.
        }
      }
    })(),
  )
})
