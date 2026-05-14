/* public/sw.js — StudyBuddy Service Worker
 * Place this file at: public/sw.js
 * It will be served from the root as /sw.js
 */

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? "📚 Study Alarm", {
      body: data.body ?? "Time for your daily tasks!",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "study-alarm",
      requireInteraction: true,
      actions: [
        { action: "open", title: "Open App" },
        { action: "dismiss", title: "Dismiss" },
      ],
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "open" || !e.action) {
    e.waitUntil(self.clients.openWindow(e.notification.data?.url ?? "/"));
  }
});