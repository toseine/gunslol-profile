import { DurableObject } from "cloudflare:workers";

const defaults = {
  name: "Your name",
  bio: "Your space on the web.",
  avatarUrl: "",
  defaultTheme: "home",
  videoUrl: "",
  musicUrl: "",
  musicStart: 0,
  musicEnd: 0,
  hackerVideoUrl: "",
  hackerMusicUrl: "",
  hackerMusicStart: 0,
  hackerMusicEnd: 0,
  rainVideoUrl: "",
  rainMusicUrl: "",
  rainMusicStart: 0,
  rainMusicEnd: 0,
  animeVideoUrl: "",
  animeMusicUrl: "",
  animeMusicStart: 0,
  animeMusicEnd: 0,
  carVideoUrl: "",
  carMusicUrl: "",
  carMusicStart: 0,
  carMusicEnd: 0,
  backgroundStart: 0,
  backgroundEnd: 0,
  backgroundZoom: 1,
  backgroundX: 50,
  backgroundY: 50,
  animateEntrance: true,
  animateText: true,
  animatedBackground: true,
  profileFloat: true,
  hoverTilt: true,
  cursorStyle: "orb",
  enterText: "Click to enter",
  accentColor: "#b99af7",
  textColor: "#ffffff",
  backgroundColor: "#090b10",
  socialIconColor: "#ffffff",
  fontStyle: "serif",
  nameEffect: "none",
  socialStyle: "glass",
  socialIconSet: "brand",
  profileOpacity: 100,
  profileBlur: 0,
  avatarRadius: 28,
  cardWidth: 760,
  avatarSize: 174,
  nameSize: 59,
  bioSize: 19,
  socialSize: 42,
  showViews: true,
  showThemes: true,
  showVolume: true,
  layout: {
    desktop: { profile: { x: 50, y: 50 }, social: { x: 50, y: 68 }, views: { x: 6, y: 94 }, themes: { x: 96, y: 50 }, audio: { x: 8, y: 6 } },
    mobile: { profile: { x: 50, y: 47 }, social: { x: 50, y: 65 }, views: { x: 11, y: 94 }, themes: { x: 94, y: 49 }, audio: { x: 15, y: 5 } }
  },
  snowEnabled: false,
  discordUsername: "",
  discordUrl: "",
  robloxUrl: "",
  githubUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  telegramUrl: "",
  badges: []
};
const encoder = new TextEncoder();
const MEDIA_CHUNK_CHARS = 4 * 128 * 1024;
const MEDIA_CHUNK_BYTES = MEDIA_CHUNK_CHARS / 4 * 3;

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

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit"
  }).format(new Date());
}

async function monthlyVisitorKey(month, ip, secret) {
  const signature = await crypto.subtle.sign(
    "HMAC", await hmacKey(secret), encoder.encode(`${month}:${ip}`)
  );
  return `views:${month}:ip:${base64url(new Uint8Array(signature))}`;
}

function cleanSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result = {};
  for (const [key, max] of Object.entries({ name: 50, bio: 140, avatarUrl: 2000, videoUrl: 2000, musicUrl: 2000, hackerVideoUrl: 2000, hackerMusicUrl: 2000, rainVideoUrl: 2000, rainMusicUrl: 2000, animeVideoUrl: 2000, animeMusicUrl: 2000, carVideoUrl: 2000, carMusicUrl: 2000, discordUrl: 2000, githubUrl: 2000, youtubeUrl: 2000, tiktokUrl: 2000 })) {
    if (typeof input[key] !== "string" || input[key].length > max) return null;
    result[key] = input[key].trim();
  }
  if (!result.name || typeof input.snowEnabled !== "boolean") return null;
  if (input.discordUsername != null && (typeof input.discordUsername !== "string" || input.discordUsername.length > 64)) return null;
  result.discordUsername = (input.discordUsername || "").trim().replace(/^@/, "");
  if (input.robloxUrl != null && (typeof input.robloxUrl !== "string" || input.robloxUrl.length > 2000)) return null;
  result.robloxUrl = (input.robloxUrl || "").trim();
  if (input.telegramUrl != null && (typeof input.telegramUrl !== "string" || input.telegramUrl.length > 2000)) return null;
  result.telegramUrl = (input.telegramUrl || "").trim();
  const allowedBadges = ["owner", "verified", "developer", "partner", "supporter"];
  const badges = input.badges ?? [];
  if (!Array.isArray(badges) || badges.length > allowedBadges.length || new Set(badges).size !== badges.length || badges.some(badge => !allowedBadges.includes(badge))) return null;
  result.badges = badges;
  result.snowEnabled = input.snowEnabled;
  for (const [key, min, max, fallback] of [
    ["backgroundStart", 0, 3600, 0], ["backgroundEnd", 0, 3600, 0],
    ["backgroundZoom", 1, 3, 1], ["backgroundX", 0, 100, 50],
    ["backgroundY", 0, 100, 50]
  ]) {
    const value = input[key] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
    result[key] = value;
  }
  if (result.backgroundEnd && result.backgroundEnd <= result.backgroundStart) return null;
  for (const theme of ["", "hacker", "rain", "anime", "car"]) {
    const prefix = theme ? `${theme}Music` : "music";
    const start = input[`${prefix}Start`] ?? 0;
    const end = input[`${prefix}End`] ?? 0;
    if (![start, end].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 3600)) return null;
    if (end && end <= start) return null;
    result[`${prefix}Start`] = start;
    result[`${prefix}End`] = end;
  }
  for (const key of ["animateEntrance", "animateText", "animatedBackground", "profileFloat", "hoverTilt"]) {
    if (input[key] != null && typeof input[key] !== "boolean") return null;
    result[key] = input[key] ?? defaults[key];
  }
  if (input.cursorStyle != null && !["orb", "dot", "crosshair", "system"].includes(input.cursorStyle)) return null;
  result.cursorStyle = input.cursorStyle || "orb";
  if (input.enterText != null && (typeof input.enterText !== "string" || input.enterText.length > 60)) return null;
  result.enterText = (input.enterText || defaults.enterText).trim();
  for (const key of ["accentColor", "textColor", "backgroundColor", "socialIconColor"]) {
    const value = input[key] ?? defaults[key];
    if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return null;
    result[key] = value;
  }
  for (const [key, choices] of Object.entries({ fontStyle: ["serif", "sans", "mono"], nameEffect: ["none", "glow", "gradient"], socialStyle: ["glass", "solid", "outline"], socialIconSet: ["brand", "minimal"] })) {
    const value = input[key] ?? defaults[key];
    if (!choices.includes(value)) return null;
    result[key] = value;
  }
  for (const [key, min, max] of [["profileOpacity", 20, 100], ["profileBlur", 0, 24], ["avatarRadius", 0, 87], ["cardWidth", 300, 900], ["avatarSize", 60, 220], ["nameSize", 22, 80], ["bioSize", 11, 30], ["socialSize", 28, 72]]) {
    const value = input[key] ?? defaults[key];
    if (!Number.isInteger(value) || value < min || value > max) return null;
    result[key] = value;
  }
  for (const key of ["showViews", "showThemes", "showVolume"]) {
    if (input[key] != null && typeof input[key] !== "boolean") return null;
    result[key] = input[key] ?? true;
  }
  result.showThemes = false;
  result.layout = { desktop: {}, mobile: {} };
  for (const device of ["desktop", "mobile"]) {
    for (const item of ["profile", "social", "views", "themes", "audio"]) {
      const position = input.layout?.[device]?.[item] ?? defaults.layout[device][item];
      if (!position || typeof position.x !== "number" || typeof position.y !== "number" || !Number.isFinite(position.x) || !Number.isFinite(position.y) || position.x < 0 || position.x > 100 || position.y < 0 || position.y > 100) return null;
      result.layout[device][item] = { x: position.x, y: position.y };
    }
  }
  if (!["home", "hacker", "rain", "anime", "car"].includes(input.defaultTheme)) return null;
  result.defaultTheme = input.defaultTheme;
  for (const key of ["avatarUrl", "videoUrl", "musicUrl", "hackerVideoUrl", "hackerMusicUrl", "rainVideoUrl", "rainMusicUrl", "animeVideoUrl", "animeMusicUrl", "carVideoUrl", "carMusicUrl", "discordUrl", "robloxUrl", "githubUrl", "youtubeUrl", "tiktokUrl", "telegramUrl"]) {
    if (!result[key]) continue;
    try {
      if (!["https:", "http:"].includes(new URL(result[key]).protocol)) return null;
    } catch { return null; }
  }
  return result;
}

export class ProfileStore extends DurableObject {
  broadcastSettings(data) {
    const update = JSON.stringify({ type: "settings", data });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(update); } catch { /* Disconnected client. */ }
    }
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/upload" && request.method === "POST") {
      const filename = request.headers.get("X-Media-Id");
      const mime = request.headers.get("Content-Type")?.split(";")[0]?.toLowerCase();
      const size = Number(request.headers.get("X-File-Size"));
      if (!/^[0-9a-f-]{36}\.(gif|png|jpg|webp|mp4|webm|mp3|ogg|wav)$/.test(filename || "") || !Number.isSafeInteger(size) || size < 1 || size > 15 * 1024 * 1024) return json({ error: "Invalid media" }, 400);
      const content = await request.text();
      if (content.length < 4 || content.length > Math.ceil(size / 3) * 4 + 4) return json({ error: "Invalid upload size" }, 400);
      const chunks = [];
      let decodedSize = 0;
      try {
        for (let offset = 0; offset < content.length; offset += MEDIA_CHUNK_CHARS) {
          const binary = atob(content.slice(offset, offset + MEDIA_CHUNK_CHARS));
          const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
          decodedSize += bytes.byteLength;
          chunks.push(bytes);
        }
      } catch { return json({ error: "Invalid file data" }, 400); }
      if (decodedSize !== size) return json({ error: "Invalid upload size" }, 400);
      await this.ctx.storage.transaction(async transaction => {
        for (let index = 0; index < chunks.length; index++) await transaction.put(`media:${filename}:${index}`, chunks[index]);
        await transaction.put(`media:${filename}:meta`, { mime, size, chunks: chunks.length });
      });
      return json({ url: `${new URL(request.url).origin}/media/${filename}` }, 201);
    }
    const mediaMatch = path.match(/^\/media\/([0-9a-f-]{36}\.(?:gif|png|jpg|webp|mp4|webm|mp3|ogg|wav))$/);
    if (mediaMatch && (request.method === "GET" || request.method === "HEAD")) {
      const filename = mediaMatch[1];
      const meta = await this.ctx.storage.get(`media:${filename}:meta`);
      if (!meta) return json({ error: "Media not found" }, 404);
      const range = request.headers.get("Range");
      let start = 0, end = meta.size - 1;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${meta.size}` } });
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= meta.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${meta.size}` } });
      }
      const headers = {
        "Content-Type": meta.mime,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin"
      };
      if (range) headers["Content-Range"] = `bytes ${start}-${end}/${meta.size}`;
      if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
      let chunkIndex = Math.floor(start / MEDIA_CHUNK_BYTES);
      let position = start;
      const stream = new ReadableStream({
        pull: async controller => {
          if (position > end) { controller.close(); return; }
          const stored = await this.ctx.storage.get(`media:${filename}:${chunkIndex}`);
          if (!stored) { controller.error(new Error("Missing media chunk")); return; }
          const bytes = stored instanceof Uint8Array ? stored : new Uint8Array(stored);
          const offset = position - chunkIndex * MEDIA_CHUNK_BYTES;
          const part = bytes.subarray(offset, Math.min(bytes.length, offset + end - position + 1));
          controller.enqueue(part);
          position += part.length;
          chunkIndex++;
        }
      });
      return new Response(stream, { status: range ? 206 : 200, headers });
    }
    if (path === "/socket" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "settings", data: (await this.ctx.storage.get("settings")) || defaults }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (path === "/settings" && request.method === "GET") {
      return json((await this.ctx.storage.get("settings")) || defaults);
    }

    if (path === "/views" && request.method === "GET") {
      const month = currentMonth();
      return json({ month, count: (await this.ctx.storage.get(`views:${month}:count`)) || 0 });
    }
    if (path === "/views" && request.method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP");
      if (!ip || !this.env.ADMIN_PASSWORD) return json({ error: "View counter unavailable" }, 503);
      const month = currentMonth();
      const visitorKey = await monthlyVisitorKey(month, ip, this.env.ADMIN_PASSWORD);
      const countKey = `views:${month}:count`;
      const count = await this.ctx.storage.transaction(async transaction => {
        const current = (await transaction.get(countKey)) || 0;
        if (await transaction.get(visitorKey)) return current;
        await transaction.put(visitorKey, true);
        await transaction.put(countKey, current + 1);
        return current + 1;
      });
      return json({ month, count });
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

    if (path === "/presets" || /^\/presets\/[0-9a-f-]{36}(?:\/activate)?$/.test(path)) {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!(await validToken(token, this.env.ADMIN_PASSWORD))) return json({ error: "Unauthorized" }, 401);
      const presets = (await this.ctx.storage.get("presets")) || [];
      if (path === "/presets" && request.method === "GET") return json({ presets, activePresetId: (await this.ctx.storage.get("activePresetId")) || null });
      if (path === "/presets" && request.method === "POST") {
        let input;
        try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const name = typeof input.name === "string" ? input.name.trim() : "";
        const settings = cleanSettings(input.settings);
        if (!name || name.length > 40 || !settings) return json({ error: "Invalid preset" }, 400);
        const existing = presets.find(item => item.name.toLowerCase() === name.toLowerCase());
        if (!existing && presets.length >= 20) return json({ error: "Maximum 20 presets" }, 400);
        const preset = { id: existing?.id || crypto.randomUUID(), name, settings, updatedAt: Date.now() };
        const next = existing ? presets.map(item => item.id === existing.id ? preset : item) : [...presets, preset];
        await this.ctx.storage.put("presets", next);
        return json({ presets: next, activePresetId: (await this.ctx.storage.get("activePresetId")) || null }, existing ? 200 : 201);
      }
      const id = path.split("/")[2];
      const selected = presets.find(item => item.id === id);
      if (!selected) return json({ error: "Preset not found" }, 404);
      if (path.endsWith("/activate") && request.method === "POST") {
        await this.ctx.storage.put("settings", selected.settings);
        await this.ctx.storage.put("activePresetId", id);
        this.broadcastSettings(selected.settings);
        return json({ settings: selected.settings, activePresetId: id });
      }
      if (request.method === "DELETE" && path === `/presets/${id}`) {
        await this.ctx.storage.put("presets", presets.filter(item => item.id !== id));
        if ((await this.ctx.storage.get("activePresetId")) === id) await this.ctx.storage.delete("activePresetId");
        return json({ presets: presets.filter(item => item.id !== id), activePresetId: (await this.ctx.storage.get("activePresetId")) || null });
      }
      return json({ error: "Not found" }, 404);
    }

    if (path === "/settings" && request.method === "PUT") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!(await validToken(token, this.env.ADMIN_PASSWORD))) return json({ error: "Unauthorized" }, 401);
      let input;
      try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const data = cleanSettings(input);
      if (!data) return json({ error: "Invalid settings" }, 400);
      await this.ctx.storage.put("settings", data);
      await this.ctx.storage.delete("activePresetId");
      this.broadcastSettings(data);
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Media-Kind, X-File-Size",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (path === "/upload" && request.method === "POST") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!(await validToken(token, env.ADMIN_PASSWORD))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      const kind = request.headers.get("X-Media-Kind");
      const mime = request.headers.get("Content-Type")?.split(";")[0]?.toLowerCase();
      const formats = {
        avatar: { "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" },
        background: { "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm" },
        music: { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/webm": "webm" }
      };
      const extension = formats[kind]?.[mime];
      const size = Number(request.headers.get("X-File-Size"));
      const limit = kind === "avatar" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
      if (!extension || !Number.isSafeInteger(size) || size < 1 || size > limit) {
        return new Response(JSON.stringify({ error: `Unsupported file or too large (avatar 5 MB, other media 15 MB)` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!env.GITHUB_UPLOAD_TOKEN) {
        const filename = `${crypto.randomUUID()}.${extension}`;
        const headers = new Headers(request.headers);
        headers.set("X-Media-Id", filename);
        const stored = await env.PROFILE.get(env.PROFILE.idFromName("main")).fetch(new Request(request.url, { method: "POST", headers, body: request.body }));
        const responseHeaders = new Headers(stored.headers);
        for (const [key, value] of Object.entries(cors)) responseHeaders.set(key, value);
        return new Response(stored.body, { status: stored.status, headers: responseHeaders });
      }
      const content = await request.text();
      if (content.length < 4 || content.length > Math.ceil(size / 3) * 4 + 4) {
        return new Response(JSON.stringify({ error: "Invalid upload size" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const filename = `${crypto.randomUUID()}.${extension}`;
      const github = await fetch(`https://api.github.com/repos/toseine/gunslol-profile/contents/media/${filename}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_UPLOAD_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "gunslol-profile-media-upload"
        },
        body: JSON.stringify({ message: `Upload profile ${kind} ${filename}`, content, branch: "main" })
      });
      if (!github.ok) {
        const error = github.status === 401 || github.status === 403
          ? "GitHub token needs access to this repository with Contents: Read and write"
          : `GitHub rejected the upload (HTTP ${github.status})`;
        return new Response(JSON.stringify({ error }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ url: `https://toseine.github.io/gunslol-profile/media/${filename}` }), { status: 201, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (!["/settings", "/views", "/login", "/session", "/socket", "/presets"].includes(path) && !/^\/presets\/[0-9a-f-]{36}(?:\/activate)?$/.test(path) && !/^\/media\/[0-9a-f-]{36}\.(gif|png|jpg|webp|mp4|webm|mp3|ogg|wav)$/.test(path)) return json({ error: "Not found" }, 404);
    const stub = env.PROFILE.get(env.PROFILE.idFromName("main"));
    const response = await stub.fetch(request);
    if (response.status === 101) return response;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    if (!path.startsWith("/media/")) headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }
};
