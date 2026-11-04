import { apiUrl, isConfigured } from "./api-config.js";

const $ = id => document.getElementById(id);
const video = $("background-video");
const music = $("music");
const musicToggle = $("music-toggle");
const status = $("status");
$("profile-picture").addEventListener("error", () => {
  $("profile-picture").hidden = true;
  $("avatar-letter").hidden = false;
});
let currentMusicUrl = "";
let musicWanted = true;
let settings = {};
let activeTheme = "";
let lastDefaultTheme = "";
const themes = ["home", "hacker", "rain", "anime", "car"];
const mediaKeys = {
  home: ["videoUrl", "musicUrl"],
  hacker: ["hackerVideoUrl", "hackerMusicUrl"],
  rain: ["rainVideoUrl", "rainMusicUrl"],
  anime: ["animeVideoUrl", "animeMusicUrl"],
  car: ["carVideoUrl", "carMusicUrl"]
};

function safeUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim(), location.href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function setSocial(id, value) {
  const link = $(id);
  const url = safeUrl(value);
  link.hidden = !url;
  if (url) link.href = url;
  else link.removeAttribute("href");
}

function setVideo(value) {
  const url = safeUrl(value);
  if (video.dataset.url === url) return;
  video.dataset.url = url;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = !url;
  if (url) {
    video.src = url;
    video.play().catch(() => {});
  }
}

function syncMusicButton() {
  const playing = !music.paused && !!currentMusicUrl;
  musicToggle.hidden = !currentMusicUrl;
  musicToggle.setAttribute("aria-pressed", String(playing));
  $("music-label").textContent = playing ? "Wycisz muzykę" : "Włącz muzykę";
}

async function setMusic(value) {
  const url = safeUrl(value);
  if (url === currentMusicUrl) return;
  currentMusicUrl = url;
  music.pause();
  music.removeAttribute("src");
  music.load();
  if (url) {
    music.src = url;
    if (musicWanted) {
      try { await music.play(); } catch { /* Autoplay może wymagać gestu użytkownika. */ }
    }
  }
  syncMusicButton();
}

musicToggle.addEventListener("click", async () => {
  if (music.paused) {
    musicWanted = true;
    try { await music.play(); } catch { /* Niedostępny plik lub ograniczenie przeglądarki. */ }
  } else {
    musicWanted = false;
    music.pause();
  }
  syncMusicButton();
});
music.addEventListener("play", syncMusicButton);
music.addEventListener("pause", syncMusicButton);
music.volume = 0.3;
$("volume-slider").addEventListener("input", event => { music.volume = Number(event.target.value); });
$("transparency-slider").addEventListener("input", event => {
  document.documentElement.style.setProperty("--card-alpha", event.target.value);
});

function setTheme(theme) {
  activeTheme = themes.includes(theme) ? theme : "home";
  document.body.classList.remove(...themes.map(name => `${name}-theme`));
  document.body.classList.add(`${activeTheme}-theme`);
  for (const button of document.querySelectorAll(".theme-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.theme === activeTheme));
  }
  const [videoKey, musicKey] = mediaKeys[activeTheme];
  setVideo(settings[videoKey]);
  setMusic(settings[musicKey]);
}
document.querySelectorAll(".theme-button").forEach(button => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});

// Przy niektórych ustawieniach przeglądarki autoplay ruszy dopiero po pierwszym geście.
document.addEventListener("pointerdown", () => {
  if (musicWanted && currentMusicUrl && music.paused) music.play().catch(() => {});
}, { once: true });

const canvas = $("snow-canvas");
const ctx = canvas.getContext("2d");
let snowEnabled = false;
let flakes = [];
let animationFrame = 0;

function resizeSnow() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  flakes = Array.from({ length: Math.min(110, Math.floor(innerWidth / 12)) }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.9 + 0.7,
    speed: Math.random() * 1.2 + 0.35,
    drift: Math.random() * 0.8 - 0.4
  }));
}
addEventListener("resize", () => { if (snowEnabled) resizeSnow(); });

function drawSnow() {
  if (!snowEnabled) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = "rgba(218, 235, 255, .72)";
  for (const flake of flakes) {
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
    ctx.fill();
    flake.y += flake.speed;
    flake.x += flake.drift;
    if (flake.y > innerHeight + 4) { flake.y = -4; flake.x = Math.random() * innerWidth; }
    if (flake.x < -4) flake.x = innerWidth + 4;
    if (flake.x > innerWidth + 4) flake.x = -4;
  }
  animationFrame = requestAnimationFrame(drawSnow);
}

function setSnow(enabled) {
  if (snowEnabled === enabled) return;
  snowEnabled = enabled;
  canvas.hidden = !enabled;
  if (enabled) { resizeSnow(); drawSnow(); }
  else { cancelAnimationFrame(animationFrame); ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

const cursor = $("cursor");
if (matchMedia("(pointer: fine)").matches) {
  document.addEventListener("pointermove", event => {
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    cursor.classList.add("visible");
  });
  document.addEventListener("pointerout", event => {
    if (!event.relatedTarget) cursor.classList.remove("visible");
  });
  document.querySelectorAll("a, button").forEach(el => {
    el.addEventListener("pointerenter", () => cursor.classList.add("hover"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("hover"));
  });
}

function render(data) {
  settings = data || {};
  const name = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "Twój nick";
  $("profile-name").textContent = name;
  $("avatar-letter").textContent = [...name][0]?.toUpperCase() || "N";
  const avatar = $("profile-picture");
  const avatarUrl = safeUrl(data?.avatarUrl);
  avatar.hidden = !avatarUrl;
  $("avatar-letter").hidden = !!avatarUrl;
  if (avatarUrl) avatar.src = avatarUrl;
  else avatar.removeAttribute("src");
  $("profile-bio").textContent = typeof data?.bio === "string" ? data.bio : "Twoja przestrzeń w sieci.";
  document.title = `${name} · profil`;
  const nextDefault = themes.includes(data?.defaultTheme) ? data.defaultTheme : "home";
  if (!activeTheme || nextDefault !== lastDefaultTheme) activeTheme = nextDefault;
  lastDefaultTheme = nextDefault;
  setTheme(activeTheme);
  setSnow(data?.snowEnabled === true);
  setSocial("discord-link", data?.discordUrl);
  setSocial("github-link", data?.githubUrl);
  setSocial("youtube-link", data?.youtubeUrl);
  setSocial("tiktok-link", data?.tiktokUrl);
  status.textContent = data ? "" : "Profil czeka na pierwszą konfigurację w panelu admina.";
}

async function loadSettings() {
  try {
    const response = await fetch(`${apiUrl}/settings`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    status.textContent = "Nie udało się pobrać profilu. Ponawiam połączenie…";
    console.error("Odczyt profilu:", error);
  }
}

let retryDelay = 1000;
function connectLive() {
  const socketUrl = `${apiUrl.replace(/^http/, "ws")}/socket`;
  let socket;
  try { socket = new WebSocket(socketUrl); }
  catch { setTimeout(connectLive, retryDelay); return; }
  socket.addEventListener("open", () => { retryDelay = 1000; });
  socket.addEventListener("message", event => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "settings") render(message.data);
    } catch (error) { console.error("Nieprawidłowe dane profilu:", error); }
  });
  socket.addEventListener("close", () => {
    setTimeout(() => { loadSettings(); connectLive(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  });
  socket.addEventListener("error", () => socket.close());
}

if (!isConfigured) status.textContent = "Uzupełnij adres Workera w src/js/api-config.js.";
else { loadSettings(); connectLive(); }
