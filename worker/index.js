/* global URL, Request, Response */
// Runs only when no static asset matches the request (assets are served first).
// The app lives under /app/ and has client-side routes: a deep link into it gets the app's
// index.html. Until 2026-11 the app was at the root: its old addresses go to their place under /app/.
// Everything else is a 404.
const OLD_APP_ROUTES = new Set([
  "goals",
  "metas",
  "library",
  "biblioteca",
  "review",
  "resumen",
  "overview",
  "settings",
  "ajustes",
  "start",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
      return env.ASSETS.fetch(new Request(new URL("/app/", url), request));
    }
    const first = url.pathname.split("/")[1];
    if (OLD_APP_ROUTES.has(first)) {
      return Response.redirect(new URL(`/app${url.pathname}${url.search}`, url), 302);
    }
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
