import { DurableObject } from "cloudflare:workers";

const defaults = {
  name: "Twój nick",
  bio: "Twoja przestrzeń w sieci.",
  videoUrl: "",
  musicUrl: "",
  snowEnabled: false,
  discordUrl: "",
  githubUrl: "",
  youtubeUrl: ""
};
const encoder = new TextEncoder();

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function hmacKey(password) {
  return crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function issueToken(password) {
  const payload = base64url(encoder.encode(String(Date.now() + 12 * 60 * 60 * 1000)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(password), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

async function validToken(token, password) {
  if (!token || !password) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const expiry = Number(new TextDecoder().decode(decodeBase64url(parts[0])));
    if (!Number.isSafeInteger(expiry) || expiry < Date.now()) return false;
    return crypto.subtle.verify("HMAC", await hmacKey(password), decodeBase64url(parts[1]), encoder.encode(parts[0]));
  } catch { return false; }
}

async function sameSecret(a, b) {
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);
  const x = new Uint8Array(aHash);
  const y = new Uint8Array(bHash);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}

async function ipKey(ip) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
  return `attempt:${base64url(new Uint8Array(digest))}`;
}

function cleanSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result = {};
  for (const [key, max] of Object.entries({ name: 50, bio: 140, videoUrl: 2000, musicUrl: 2000, discordUrl: 2000, githubUrl: 2000, youtubeUrl: 2000 })) {
    if (typeof input[key] !== "string" || input[key].length > max) return null;
    result[key] = input[key].trim();
  }
  if (!result.name || typeof input.snowEnabled !== "boolean") return null;
  result.snowEnabled = input.snowEnabled;
  for (const key of ["videoUrl", "musicUrl", "discordUrl", "githubUrl", "youtubeUrl"]) {
    if (!result[key]) continue;
    try {
      if (!["https:", "http:"].includes(new URL(result[key]).protocol)) return null;
    } catch { return null; }
  }
  return result;
}

export class ProfileStore extends DurableObject {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/socket" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "settings", data: (await this.ctx.storage.get("settings")) || defaults }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (path === "/settings" && request.method === "GET") {
      return json((await this.ctx.storage.get("settings")) || defaults);
    }

    if (path === "/login" && request.method === "POST") {
      if (!this.env.ADMIN_PASSWORD || this.env.ADMIN_PASSWORD.length < 16) return json({ error: "Admin password is not configured" }, 503);
      const key = await ipKey(request.headers.get("CF-Connecting-IP") || "unknown");
      const now = Date.now();
      const attempt = (await this.ctx.storage.get(key)) || { count: 0, until: 0 };
      if (attempt.count >= 5 && attempt.until > now) return json({ error: "Too many attempts. Try again later." }, 429);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
      if (typeof body.password !== "string" || !(await sameSecret(body.password, this.env.ADMIN_PASSWORD))) {
        const count = attempt.until > now ? attempt.count + 1 : 1;
        await this.ctx.storage.put(key, { count, until: now + 15 * 60 * 1000 });
        return json({ error: "Invalid credentials" }, 401);
      }
      await this.ctx.storage.delete(key);
      return json({ token: await issueToken(this.env.ADMIN_PASSWORD) });
    }

    if (path === "/session" && request.method === "GET") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      return (await validToken(token, this.env.ADMIN_PASSWORD)) ? new Response(null, { status: 204 }) : json({ error: "Unauthorized" }, 401);
    }

    if (path === "/settings" && request.method === "PUT") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!(await validToken(token, this.env.ADMIN_PASSWORD))) return json({ error: "Unauthorized" }, 401);
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const data = cleanSettings(input);
      if (!data) return json({ error: "Invalid settings" }, 400);
      await this.ctx.storage.put("settings", data);
      const update = JSON.stringify({ type: "settings", data });
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(update); } catch { /* Usunięte połączenie. */ }
      }
      return json(data);
    }
    return json({ error: "Not found" }, 404);
  }

  webSocketMessage(socket, message) {
    if (message === "ping") socket.send("pong");
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGIN;
    if (origin && origin !== allowed) return json({ error: "Forbidden origin" }, 403);
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (!["/settings", "/login", "/session", "/socket"].includes(path)) return json({ error: "Not found" }, 404);
    const stub = env.PROFILE.get(env.PROFILE.idFromName("main"));
    const response = await stub.fetch(request);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }
};
