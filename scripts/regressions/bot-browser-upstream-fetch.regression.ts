import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { botBrowserDatacatRoutes } from "../../packages/server/src/routes/bot-browser-datacat.routes.js";
import { botBrowserJannyRoutes } from "../../packages/server/src/routes/bot-browser-janny.routes.js";

// DataCat and JannyAI catalog requests go through the outbound URL guard: an upstream redirect cannot send
// the server into this machine or the local network, and an oversized reply is cut off at the size cap.

const internalHits: string[] = [];
const internal = createServer((request, response) => {
  internalHits.push(request.url ?? "");
  response.writeHead(200, { "content-type": "application/json" }).end('{"success":true,"sessionToken":"internal"}');
});
await new Promise<void>((resolve) => internal.listen(0, "127.0.0.1", resolve));
const internalUrl = `http://127.0.0.1:${(internal.address() as AddressInfo).port}/internal`;

// Catalog hosts are fixtures. A request that does not ask for manual redirects follows them, as fetch does by default.
const originalFetch = globalThis.fetch;
let jannyMode: "redirect" | "dynamic" | "blocked" = "redirect";
let jannyToken = "a".repeat(64);
let scrapeAttempts = 0;
const searchAuthorizations: Array<string | null> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1") return originalFetch(input, init);
  if (url.hostname === "search.jannyai.com") {
    searchAuthorizations.push(new Headers(init?.headers).get("authorization"));
    return Response.json({ results: [{ hits: [{ id: "fixture-character" }] }] });
  }
  if (jannyMode !== "redirect") {
    if (url.hostname === "jannyai.com" && url.pathname === "/characters/search") {
      scrapeAttempts++;
      if (jannyMode === "dynamic") return new Response('<script src="/_astro/client-config.fixture.js"></script>');
    }
    if (
      jannyMode === "dynamic" &&
      url.hostname === "jannyai.com" &&
      url.pathname === "/_astro/client-config.fixture.js"
    ) {
      return new Response(JSON.stringify(jannyToken));
    }
    return new Response(null, { status: 403 });
  }
  if (url.pathname === "/api/liberator/identify") {
    return Response.json({ success: true, sessionToken: "fixture-session" });
  }
  if (url.pathname.endsWith("/huge")) return Response.json({ pad: "x".repeat(11 * 1024 * 1024) });
  if (init?.redirect !== "manual") return originalFetch(internalUrl);
  return new Response(null, { status: 307, headers: { location: internalUrl } });
}) as typeof fetch;
const originalLookup = dns.lookup;
(dns as { lookup: unknown }).lookup = async () => [{ address: "93.184.216.34", family: 4 }];

const app = Fastify();
await app.register(botBrowserDatacatRoutes);
await app.register(botBrowserJannyRoutes);

try {
  for (const url of ["/datacat/fresh", "/datacat/character/huge", "/janny/search?q=clockwork"]) {
    const response = await app.inject({ method: "GET", url });
    assert.notEqual(response.statusCode, 200, `${url} must not return a redirected or oversized upstream reply`);
  }

  // Reject unsafe redirects and never send a search request without a dynamic token.
  const token = await app.inject({ method: "GET", url: "/janny/token?force=1" });
  assert.equal(token.statusCode, 502);
  assert.match(token.json<{ error: string }>().error, /could not obtain.*JannyAI search token/i);
  assert.deepEqual(searchAuthorizations, []);
  assert.deepEqual(internalHits, [], "no catalog redirect reaches a loopback service");

  jannyMode = "dynamic";
  const first = await Promise.all([app.inject("/janny/token"), app.inject("/janny/token")]);
  assert.deepEqual(
    first.map((response) => response.json()),
    [{ token: jannyToken }, { token: jannyToken }],
  );
  assert.equal(scrapeAttempts, 1);
  const search = await app.inject("/janny/search?q=clockwork");
  assert.equal(search.statusCode, 200);
  assert.equal(search.json().results[0].hits[0].id, "fixture-character");
  assert.deepEqual(searchAuthorizations, [`Bearer ${jannyToken}`]);
  assert.equal(scrapeAttempts, 1, "search reuses the cached dynamic token");

  jannyToken = "b".repeat(64);
  const refreshed = await app.inject("/janny/token?force=1");
  assert.deepEqual(refreshed.json(), { token: jannyToken });
  assert.equal(scrapeAttempts, 2);

  jannyMode = "blocked";
  const failedRefresh = await app.inject("/janny/token?force=1");
  assert.equal(failedRefresh.statusCode, 502);
  assert.equal((await app.inject("/janny/search?q=clockwork")).statusCode, 502);
  assert.equal(searchAuthorizations.length, 1, "failed refresh never sends an old or unknown token");

  jannyMode = "dynamic";
  assert.deepEqual((await app.inject("/janny/token")).json(), { token: jannyToken });
  assert.equal((await app.inject("/janny/search?q=clockwork")).statusCode, 200);
  assert.deepEqual(searchAuthorizations.at(-1), `Bearer ${jannyToken}`);
} finally {
  globalThis.fetch = originalFetch;
  (dns as { lookup: unknown }).lookup = originalLookup;
  await app.close();
  await new Promise((resolve) => internal.close(resolve));
}

console.log("Card Browser upstream fetch regression passed");
