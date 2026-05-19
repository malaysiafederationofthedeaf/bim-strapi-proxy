export default {
  async fetch(request, env, ctx) {
    const originHost = env.ORIGIN_HOST || "bimsignbank-strapi.onrender.com";

    const url = new URL(request.url);
    url.hostname = originHost;

    const internalToken = env.RENDER_INTERNAL_TOKEN;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",           // ok for public read-only API
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Forward request, strip host/origin to avoid confusion upstream
    const fwdHeaders = new Headers(request.headers);
    fwdHeaders.delete("host");
    fwdHeaders.delete("origin");
    fwdHeaders.delete("X-Internal-Token");
    if(internalToken) {
      fwdHeaders.set("X-Internal-Token", internalToken);
    }

    const init = {
      method: request.method,
      headers: fwdHeaders,
    };

    // Enable edge caching for safe GET requests
    if (request.method === "GET") {
      init.cf = {
        cacheEverything: true,
        cacheTtl: 7200, // 2 hours
      };
    }

    const originResponse = await fetch(url.toString(), init);

    const respHeaders = new Headers(originResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }

    if (request.method === "GET") {
      // Make it explicitly cacheable
      respHeaders.set("Cache-Control", "public, max-age=7200");
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: respHeaders,
    });
  },
};