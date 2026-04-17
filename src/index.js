export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    url.hostname = env.ORIGIN_HOST;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only cache safe GET requests
    if (request.method === "GET") {
      const cache = caches.default;
      const cacheKey = new Request(request.url, request);

      // Try cache first
      let cached = await cache.match(cacheKey);
      if (cached) {
        // You can add a custom header to confirm hits
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
        method: request.method,
        headers: fwdHeaders,
      };

      const originResp = await fetch(url.toString(), init);

      // Clone and add CORS / cache headers
      const respHeaders = new Headers(originResp.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        respHeaders.set(k, v);
      }
      respHeaders.set("Cache-Control", "public, max-age=7200");

      const responseToCache = new Response(originResp.body, {
        status: originResp.status,
        headers: respHeaders,
      });

      // Store in cache asynchronously
      ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

      return responseToCache;
    }

    // Non-GET → just proxy through
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