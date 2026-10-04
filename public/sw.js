/* Nakhla agent app service worker: offline pages and data, background sync of queued actions, push notifications. */
importScripts("/sw-policy.js");
var P = self.NakhlaSW;
var PAGES = P.VERSION + "-pages";
var DATA = P.VERSION + "-data";
var STATIC = P.VERSION + "-static";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(PAGES)
      .then(function (c) {
        return Promise.all(
          P.SHELL.map(function (u) {
            return c.add(new Request(u, { credentials: "include" })).catch(function () {});
          }),
        );
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k.indexOf(P.VERSION) !== 0;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

function trim(name, limit) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) {
      return Promise.all(
        P.overflow(keys, limit).map(function (k) {
          return c.delete(k);
        }),
      );
    });
  });
}

function networkFirst(request, cacheName, limit, fallback) {
  return fetch(request)
    .then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(cacheName).then(function (c) {
          c.put(request, copy).then(function () {
            trim(cacheName, limit);
          });
        });
      }
      return res;
    })
    .catch(function () {
      return caches.match(request).then(function (hit) {
        return hit || (fallback ? caches.match(fallback) : Response.error());
      });
    });
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    return (
      hit ||
      fetch(request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(STATIC).then(function (c) {
            c.put(request, copy);
          });
        }
        return res;
      })
    );
  });
}

/* Queued actions live in IndexedDB until the network returns. */
function db() {
  return new Promise(function (resolve, reject) {
    var r = indexedDB.open("nakhla-outbox", 1);
    r.onupgradeneeded = function () {
      r.result.createObjectStore("actions", { keyPath: "id", autoIncrement: true });
    };
    r.onsuccess = function () {
      resolve(r.result);
    };
    r.onerror = function () {
      reject(r.error);
    };
  });
}

function queue(body) {
  return db().then(function (d) {
    return new Promise(function (resolve) {
      var tx = d.transaction("actions", "readwrite");
      tx.objectStore("actions").add({ body: body, at: Date.now() });
      tx.oncomplete = resolve;
    });
  });
}

function flush() {
  return db().then(function (d) {
    return new Promise(function (resolve) {
      var tx = d.transaction("actions", "readonly");
      var req = tx.objectStore("actions").getAll();
      req.onsuccess = function () {
        resolve({ d: d, items: req.result || [] });
      };
    });
  }).then(function (ctx) {
    return ctx.items.reduce(function (p, item) {
      return p.then(function () {
        return fetch("/api/m/actions", { method: "POST", headers: { "content-type": "application/json" }, credentials: "include", body: item.body }).then(function (res) {
          if (res.ok || (res.status >= 400 && res.status < 500)) {
            var tx = ctx.d.transaction("actions", "readwrite");
            tx.objectStore("actions").delete(item.id);
          }
        });
      });
    }, Promise.resolve());
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var kind = P.classify(req.method, req.url);
  if (kind === "network") return;
  if (kind === "cache-first") return event.respondWith(cacheFirst(req));
  if (kind === "network-first-page") return event.respondWith(networkFirst(req, PAGES, P.LIMITS.pages, "/m/offline"));
  if (kind === "network-first-data") return event.respondWith(networkFirst(req, DATA, P.LIMITS.data));
  if (kind === "outbox") {
    event.respondWith(
      req
        .clone()
        .text()
        .then(function (body) {
          return fetch(req).catch(function () {
            return queue(body).then(function () {
              if (self.registration.sync) self.registration.sync.register("nakhla-outbox").catch(function () {});
              return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { "content-type": "application/json" } });
            });
          });
        }),
    );
  }
});

self.addEventListener("sync", function (event) {
  if (event.tag === "nakhla-outbox") event.waitUntil(flush());
});

self.addEventListener("message", function (event) {
  if (event.data === "flush") event.waitUntil(flush());
  if (event.data === "warm")
    event.waitUntil(
      caches.open(PAGES).then(function (c) {
        return Promise.all(
          P.SHELL.map(function (u) {
            return fetch(u, { credentials: "include" })
              .then(function (res) {
                if (res.ok) return c.put(u, res);
              })
              .catch(function () {});
          }),
        );
      }),
    );
});

self.addEventListener("push", function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Nakhla", body: event.data ? event.data.text() : "" };
  }
  var n = P.notification(payload);
  event.waitUntil(self.registration.showNotification(n.title, n.options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var href = (event.notification.data && event.notification.data.href) || "/m/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].url.indexOf(href) !== -1 && "focus" in list[i]) return list[i].focus();
      return self.clients.openWindow(href);
    }),
  );
});
