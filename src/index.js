export default {
  async fetch(request, env, ctx) {
    const originHost = env.ORIGIN_HOST || "bimsignbank-strapi.onrender.com";
    const url = new URL(request.url);
    url.hostname = originHost;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Cache only safe GETs
    if (request.method === "GET") {
      const cache = caches.default;
      const cacheKey = new Request(request.url, request);

      // Try cache first
      let cached = await cache.match(cacheKey);
      if (cached) {
        const hitHeaders = new Headers(cached.headers);
        hitHeaders.set("X-Worker-Cache", "HIT");
        return new Response(cached.body, {
          status: cached.status,
          headers: hitHeaders,
        });
      }

      // Not in cache → forward to origin
      const fwdHeaders = new Headers(request.headers);
      fwdHeaders.delete("host");

      const init = {
        method: "GET",
        headers: fwdHeaders,
      };

      const originResp = await fetch(url.toString(), init);

      const respHeaders = new Headers(originResp.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        respHeaders.set(k, v);
      }
      respHeaders.set("Cache-Control", "public, max-age=7200");

      const responseToCache = new Response(originResp.body, {
        status: originResp.status,
        headers: respHeaders,
      });

      ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

      const missHeaders = new Headers(responseToCache.headers);
      missHeaders.set("X-Worker-Cache", "MISS");

      return new Response(responseToCache.body, {
        status: responseToCache.status,
        headers: missHeaders,
      });
    }

    // Non-GET → just proxy
    const fwdHeaders = new Headers(request.headers);
    fwdHeaders.delete("host");

    const init = {
      method: request.method,
      headers: fwdHeaders,
    };

    const originResponse = await fetch(url.toString(), init);
    const respHeaders = new Headers(originResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: respHeaders,
    });
  },
};