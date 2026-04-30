// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const originHost = env.ORIGIN_HOST || "bimsignbank-strapi.onrender.com";

    // Parse incoming URL
    const url = new URL(request.url);

    // Detect cache bypass flag
    const bypassCache = url.searchParams.get("cf_bypass") === "1";

    // (Optional) Strip cf_bypass before forwarding to Strapi
    if (bypassCache) {
      url.searchParams.delete("cf_bypass");
    }

    // Route to Render origin
    url.hostname = originHost;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // ok for public read-only API
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Forward headers
    const fwdHeaders = new Headers(request.headers);
    fwdHeaders.delete("host");
    fwdHeaders.delete("origin");

    const init = {
      method: request.method,
      headers: fwdHeaders,
    };

    // Only enable Cloudflare edge caching when NOT bypassing
    if (request.method === "GET" && !bypassCache) {
      init.cf = {
        cacheEverything: true,
        cacheTtl: 7200, // 2 hours
      };
    }

    const originResponse = await fetch(url.toString(), init);
    const respHeaders = new Headers(originResponse.headers);

    // Add CORS
    for (const [k, v] of Object.entries(corsHeaders)) {
      respHeaders.set(k, v);
    }

    // Control downstream caching behaviour
    if (request.method === "GET") {
      if (bypassCache) {
        // For tests: disable any caching for this response
        respHeaders.set("Cache-Control", "no-store, max-age=0");
      } else {
        respHeaders.set("Cache-Control", "public, max-age=7200");
      }
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      headers: respHeaders,
    });
  },
};
