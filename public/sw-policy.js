/* Nakhla agent app: caching policy shared by the service worker and its tests. */
(function (root) {
  var VERSION = "nakhla-m-v1";
  var SHELL = ["/m/dashboard", "/m/leads", "/m/listings", "/m/deals", "/m/commissions", "/m/notifications", "/m/offline", "/manifest.webmanifest", "/pwa/icon/192"];
  var LIMITS = { pages: 40, data: 30, static: 200 };

  /** Strategy for a request: what the worker does with it. */
  function classify(method, url) {
    var u = new URL(url);
    if (method !== "GET") return u.pathname === "/api/m/actions" ? "outbox" : "network";
    if (u.pathname.indexOf("/_next/static/") === 0 || u.pathname.indexOf("/pwa/icon/") === 0) return "cache-first";
    if (u.pathname === "/api/m/snapshot") return "network-first-data";
    if (u.pathname === "/m" || u.pathname.indexOf("/m/") === 0) return "network-first-page";
    return "network";
  }

  /** Oldest entries beyond the limit, for trimming a cache. */
  function overflow(keys, limit) {
    return keys.length > limit ? keys.slice(0, keys.length - limit) : [];
  }

  /** The notification a push payload produces. */
  function notification(payload) {
    var p = payload || {};
    return { title: p.title || "Nakhla", options: { body: p.body || "", tag: p.tag || p.category || "nakhla", data: { href: p.href || "/m/notifications" }, icon: "/pwa/icon/192", badge: "/pwa/icon/192", renotify: Boolean(p.tag) } };
  }

  var api = { VERSION: VERSION, SHELL: SHELL, LIMITS: LIMITS, classify: classify, overflow: overflow, notification: notification };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NakhlaSW = api;
})(typeof self !== "undefined" ? self : globalThis);
