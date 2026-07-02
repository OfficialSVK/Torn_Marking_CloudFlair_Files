/**
 * TORN WAR CLAIMER — Cloudflare Worker Relay
 * 
 * What this does in plain English:
 * TornPDA's app blocks requests to our Railway server.
 * This Worker acts as a "middleman" — PDA sends requests here,
 * and this Worker forwards them on to Railway and sends back the response.
 * Cloudflare's domain is trusted by PDA, so the block doesn't apply!
 * 
 * This uses the OLD "addEventListener" format which works with
 * Cloudflare's drag-and-drop uploader — no build tools needed.
 */

// ============================================================
// CHANGE THIS to your Railway URL
// ============================================================
const RAILWAY_URL = "https://tornenemymarking-production.up.railway.app";
// ============================================================

// This line tells Cloudflare to run our handleRequest function
// every time someone sends a request to our Worker URL
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {

  // Handle "preflight" requests — browsers send these first
  // to check if cross-origin requests are allowed
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(),
    });
  }

  try {
    // Take the path from the incoming URL (e.g. /claims/war_123)
    // and forward it to our Railway backend
    const url       = new URL(request.url);
    const targetUrl = RAILWAY_URL + url.pathname + url.search;

    // Copy the request but point it at Railway instead
    const forwardedRequest = new Request(targetUrl, {
      method:  request.method,
      headers: request.headers,
      // Only include a body for POST/DELETE — GET requests have no body
      body: (request.method !== "GET" && request.method !== "HEAD")
            ? await request.text()
            : undefined,
    });

    // Send the request to Railway and wait for the response
    const response = await fetch(forwardedRequest);
    const body     = await response.text();

    // Send Railway's response back to PDA, adding CORS headers
    // so PDA's WebView accepts it
    return new Response(body, {
      status:  response.status,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(),
      },
    });

  } catch (err) {
    // Something went wrong — return a helpful error message
    return new Response(
      JSON.stringify({ error: "Worker relay failed: " + err.message }),
      {
        status:  500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      }
    );
  }
}

// These headers tell browsers and WebViews that they're
// allowed to receive this response from our Worker
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };
}
