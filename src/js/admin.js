import { apiUrl, isConfigured } from "./api-config.js";

const $ = id => document.getElementById(id);
const form = $("settings-form");
const fields = ["name", "bio", "avatarUrl", "defaultTheme", "videoUrl", "musicUrl", "hackerVideoUrl", "hackerMusicUrl", "rainVideoUrl", "rainMusicUrl", "animeVideoUrl", "animeMusicUrl", "carVideoUrl", "carMusicUrl", "snowEnabled", "discordUsername", "githubUrl", "youtubeUrl", "tiktokUrl", "animateEntrance", "animateText", "animatedBackground", "profileFloat", "hoverTilt", "cursorStyle", "enterText", "accentColor", "textColor", "backgroundColor", "fontStyle", "nameEffect", "socialStyle", "showViews", "showThemes", "showVolume"];
const toggleFields = new Set(["snowEnabled", "animateEntrance", "animateText", "animatedBackground", "profileFloat", "hoverTilt", "showViews", "showThemes", "showVolume"]);
const fieldDefaults = { defaultTheme: "home", cursorStyle: "orb", enterText: "Click to enter", accentColor: "#b99af7", textColor: "#ffffff", backgroundColor: "#090b10", fontStyle: "serif", nameEffect: "none", socialStyle: "glass" };
const styleDefaults = { profileOpacity: 100, profileBlur: 0, avatarRadius: 28 };
const defaultLayout = {
  desktop: { profile: { x: 50, y: 50 }, social: { x: 50, y: 68 }, views: { x: 6, y: 94 }, themes: { x: 96, y: 50 }, audio: { x: 8, y: 6 } },
  mobile: { profile: { x: 50, y: 47 }, social: { x: 50, y: 65 }, views: { x: 11, y: 94 }, themes: { x: 94, y: 49 }, audio: { x: 15, y: 5 } }
};
let layout = structuredClone(defaultLayout);
let layoutDevice = "desktop";
const cropDefaults = { backgroundStart: 0, backgroundEnd: 0, backgroundZoom: 1, backgroundX: 50, backgroundY: 50 };
const backgroundFields = { home: "video-url", hacker: "hacker-video", rain: "rain-video", anime: "anime-video", car: "car-video" };
const uploadFields = [
  ["avatar-url", "avatar", "image/gif,image/png,image/jpeg,image/webp"],
  ["video-url", "background", "image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm"],
  ["hacker-video", "background", "image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm"],
  ["rain-video", "background", "image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm"],
  ["anime-video", "background", "image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm"],
  ["car-video", "background", "image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm"],
  ["music-url", "music", "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"],
  ["hacker-music", "music", "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"],
  ["rain-music", "music", "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"],
  ["anime-music", "music", "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"],
  ["car-music", "music", "audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm"]
];
const tokenKey = "profile_admin_session";
let token = sessionStorage.getItem(tokenKey) || "";
let dirty = false;

function message(id, text, kind = "") {
  const el = $(id);
  el.textContent = text;
  el.dataset.kind = kind;
}

function showEditor(enabled) {
  $("login-panel").hidden = enabled;
  $("editor-panel").hidden = !enabled;
}

function fillForm(data = {}) {
  for (const key of fields) {
    const el = form.elements.namedItem(key);
    if (toggleFields.has(key)) el.checked = data[key] ?? (key !== "snowEnabled");
    else el.value = typeof data[key] === "string" ? data[key] : (fieldDefaults[key] ?? "");
  }
  for (const [key, fallback] of Object.entries(cropDefaults)) {
    form.elements.namedItem(key).value = typeof data[key] === "number" ? data[key] : fallback;
  }
  for (const [key, fallback] of Object.entries(styleDefaults)) form.elements.namedItem(key).value = typeof data[key] === "number" ? data[key] : fallback;
  if (!data.name) form.elements.namedItem("name").value = "Your name";
  layout = structuredClone(defaultLayout);
  for (const device of ["desktop", "mobile"]) for (const item of Object.keys(defaultLayout[device])) {
    const position = data.layout?.[device]?.[item];
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) layout[device][item] = { x: position.x, y: position.y };
  }
  updateLayoutPreview();
  updatePreview();
  updateMiniPreview();
  dirty = false;
}

function readForm() {
  const data = {};
  for (const key of fields) {
    const el = form.elements.namedItem(key);
    data[key] = toggleFields.has(key) ? el.checked : el.value.trim();
  }
  data.layout = structuredClone(layout);
  data.discordUrl = "";
  for (const key of Object.keys(cropDefaults)) data[key] = Number(form.elements.namedItem(key).value);
  for (const key of Object.keys(styleDefaults)) data[key] = Number(form.elements.namedItem(key).value);
  return data;
}

function validUrl(value) {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
}

const sectionCopy = {
  profile: ["Profile", "Edit your identity and avatar. Changes appear on the live page when saved."],
  media: ["Media & themes", "Choose backgrounds and music for each theme, then adjust the crop and loop."],
  socials: ["Social links", "Add the links visitors can open and a Discord username they can copy."],
  appearance: ["Appearance", "Tune colors, typography, motion and what visitors can see."],
  layout: ["Layout", "Drag profile elements into place for desktop and phone separately."]
};
for (const button of document.querySelectorAll(".nav-button")) button.addEventListener("click", () => {
  const target = button.dataset.target;
  document.querySelectorAll(".nav-button").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll("[data-section]").forEach(section => { section.hidden = section.dataset.section !== target; });
  $("editor-title").textContent = sectionCopy[target][0];
  $("section-description").textContent = sectionCopy[target][1];
  document.querySelector(".editor-heading").scrollIntoView({ behavior: "smooth", block: "start" });
});

let failedAvatarUrl = "";
function updateMiniPreview() {
  $("nav-display-name").textContent = $("profile-name").value || "Your profile";
  $("mini-name").textContent = $("profile-name").value || "Your name";
  $("mini-bio").textContent = $("profile-bio").value || "Your space on the web";
  const avatar = $("avatar-url").value.trim();
  const avatarSource = avatar && validUrl(avatar) && avatar !== failedAvatarUrl ? avatar : "./assets/avatar.svg";
  if ($("mini-avatar").getAttribute("src") !== avatarSource) $("mini-avatar").src = avatarSource;
  const stage = $("mini-stage");
  stage.style.setProperty("--mini-bg", $("background-color").value);
  stage.style.setProperty("--mini-accent", $("accent-color").value);
  stage.style.setProperty("--mini-text", $("text-color").value);
  stage.style.setProperty("--mini-opacity", String(Number($("profile-opacity").value) / 100));
  stage.style.setProperty("--mini-blur", `${$("profile-blur").value}px`);
  stage.style.setProperty("--mini-radius", `${$("avatar-radius").value}px`);
  $("mini-name").style.fontFamily = { serif: "Georgia, serif", sans: "Arial, sans-serif", mono: "monospace" }[$("font-style").value];
  $("opacity-value").textContent = `${$("profile-opacity").value}%`;
  $("blur-value").textContent = `${$("profile-blur").value}px`;
  $("radius-value").textContent = `${$("avatar-radius").value}px`;
}
$("mini-avatar").addEventListener("error", event => {
  const source = event.target.getAttribute("src");
  if (source !== "./assets/avatar.svg") {
    failedAvatarUrl = source;
    event.target.src = "./assets/avatar.svg";
  }
});
for (const key of ["profile-name", "profile-bio", "avatar-url", "accent-color", "text-color", "background-color", "font-style", "profile-opacity", "profile-blur", "avatar-radius"]) $(key).addEventListener("input", updateMiniPreview);

function updateLayoutPreview() {
  const canvas = $("layout-canvas");
  canvas.dataset.device = layoutDevice;
  $("layout-desktop").classList.toggle("selected", layoutDevice === "desktop");
  $("layout-mobile").classList.toggle("selected", layoutDevice === "mobile");
  $("layout-name").textContent = $("profile-name").value || "Your name";
  $("layout-bio").textContent = $("profile-bio").value || "Your space on the web";
  for (const block of canvas.querySelectorAll("[data-item]")) {
    const position = layout[layoutDevice][block.dataset.item];
    block.style.left = `${position.x}%`;
    block.style.top = `${position.y}%`;
  }
}

for (const device of ["desktop", "mobile"]) $( `layout-${device}` ).addEventListener("click", () => {
  layoutDevice = device;
  updateLayoutPreview();
});
$("layout-reset").addEventListener("click", () => {
  layout[layoutDevice] = structuredClone(defaultLayout[layoutDevice]);
  updateLayoutPreview();
  dirty = true;
  message("editor-status", "You have unsaved changes.");
});
for (const id of ["profile-name", "profile-bio"]) $(id).addEventListener("input", updateLayoutPreview);
for (const block of $("layout-canvas").querySelectorAll("[data-item]")) {
  const move = event => {
    const rect = $("layout-canvas").getBoundingClientRect();
    layout[layoutDevice][block.dataset.item] = {
      x: Math.max(3, Math.min(97, Math.round((event.clientX - rect.left) / rect.width * 100))),
      y: Math.max(3, Math.min(97, Math.round((event.clientY - rect.top) / rect.height * 100)))
    };
    updateLayoutPreview();
    dirty = true;
    message("editor-status", "You have unsaved changes.");
  };
  block.addEventListener("pointerdown", event => { block.setPointerCapture(event.pointerId); move(event); });
  block.addEventListener("pointermove", event => { if (block.hasPointerCapture(event.pointerId)) move(event); });
  block.addEventListener("keydown", event => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const position = layout[layoutDevice][block.dataset.item];
    const step = event.shiftKey ? 10 : 2;
    position.x = Math.max(3, Math.min(97, position.x + direction[0] * step));
    position.y = Math.max(3, Math.min(97, position.y + direction[1] * step));
    updateLayoutPreview();
    dirty = true;
    message("editor-status", "You have unsaved changes.");
  });
}

async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers, cache: "no-store" });
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json()).error || ""; } catch {}
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

const previewFiles = new Map();
const previewVideo = $("background-preview-video");
const previewImage = $("background-preview-image");
let previewSource = "";

function updatePreview() {
  const theme = form.elements.namedItem("defaultTheme").value || "home";
  const fieldId = backgroundFields[theme];
  const pending = previewFiles.get(fieldId);
  const url = pending?.url || $(fieldId).value.trim();
  const image = pending ? pending.type.startsWith("image/") : /\.(gif|png|jpe?g|webp)(?:[?#]|$)/i.test(url);
  const zoom = Number($("background-zoom").value);
  const x = Number($("background-x").value);
  const y = Number($("background-y").value);
  $("zoom-value").textContent = `${zoom.toFixed(2)}×`;
  $("x-value").textContent = `${x}%`;
  $("y-value").textContent = `${y}%`;
  for (const media of [previewVideo, previewImage]) {
    media.style.transform = `scale(${zoom})`;
    media.style.transformOrigin = `${x}% ${y}%`;
    media.style.objectPosition = `${x}% ${y}%`;
  }
  $("background-preview-empty").hidden = !!url;
  previewImage.hidden = !url || !image;
  previewVideo.hidden = !url || image;
  if (previewSource === `${url}:${image}`) return;
  previewSource = `${url}:${image}`;
  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewImage.removeAttribute("src");
  if (url && image) previewImage.src = url;
  if (url && !image) { previewVideo.src = url; previewVideo.play().catch(() => {}); }
}

previewVideo.addEventListener("loadedmetadata", () => {
  const start = Number($("background-start").value) || 0;
  if (start > 0 && start < previewVideo.duration) previewVideo.currentTime = start;
});
previewVideo.addEventListener("timeupdate", () => {
  const start = Number($("background-start").value) || 0;
  const end = Number($("background-end").value) || 0;
  if (end > start && previewVideo.currentTime >= end) previewVideo.currentTime = start;
});
for (const id of [...Object.values(backgroundFields), "default-theme", "background-start", "background-end", "background-zoom", "background-x", "background-y"]) {
  $(id).addEventListener("input", updatePreview);
}

for (const [fieldId, kind, accept] of uploadFields) {
  const field = $(fieldId);
  const row = document.createElement("div");
  row.className = "upload-control";
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = accept;
  picker.setAttribute("aria-label", `Choose ${kind} file`);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quiet-button";
  button.textContent = "Upload file";
  button.disabled = true;
  const status = document.createElement("small");
  status.setAttribute("role", "status");
  row.append(picker, button, status);
  field.insertAdjacentElement("afterend", row);
  picker.addEventListener("change", () => {
    const old = previewFiles.get(fieldId);
    if (old) URL.revokeObjectURL(old.url);
    const file = picker.files?.[0];
    button.disabled = !file;
    status.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "";
    if (file && kind === "background") previewFiles.set(fieldId, { url: URL.createObjectURL(file), type: file.type });
    else previewFiles.delete(fieldId);
    updatePreview();
  });
  button.addEventListener("click", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (!token) { status.textContent = "Sign in first."; return; }
    const limit = kind === "avatar" ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
    if (!accept.split(",").includes(file.type) || file.size < 1 || file.size > limit) {
      status.textContent = `Unsupported file or too large (maximum ${kind === "avatar" ? 5 : 15} MB).`;
      return;
    }
    button.disabled = true;
    status.textContent = "Uploading…";
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read this file"));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`${apiUrl}/upload`, {
        method: "POST", cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "X-Media-Kind": kind, "X-File-Size": String(file.size) },
        body: base64
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      field.value = result.url;
      dirty = true;
      status.textContent = result.url.includes("workers.dev/media/") ? "Uploaded to Cloudflare and ready now." : "Uploaded to GitHub. Publishing may take about a minute.";
      message("editor-status", "Media uploaded. Saving its URL…");
      if (!await saveChanges()) throw new Error("File uploaded, but its URL was not saved. Click Save changes.");
    } catch (error) {
      status.textContent = `Upload failed: ${error.message}`;
    } finally { button.disabled = false; }
  });
}

async function openEditor() {
  try {
    const settings = await api("/settings");
    fillForm(settings);
    showEditor(true);
    message("editor-status", "Settings are up to date.");
  } catch (error) {
    message("login-status", `Could not load settings: ${error.message}`, "error");
  }
}

if (!isConfigured) {
  message("login-status", "Set the API URL in src/js/api-config.js first.", "error");
  $("login-button").disabled = true;
} else if (token) {
  api("/session").then(openEditor).catch(() => {
    token = "";
    sessionStorage.removeItem(tokenKey);
    showEditor(false);
  });
}

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isConfigured) return;
  const password = $("password").value;
  $("password").value = "";
  $("login-button").disabled = true;
  message("login-status", "Checking access…");
  try {
    const result = await api("/login", { method: "POST", body: JSON.stringify({ password }) });
    token = result.token;
    sessionStorage.setItem(tokenKey, token);
    message("login-status", "");
    await openEditor();
  } catch (error) {
    message("login-status", error.message === "Invalid credentials" ? "Incorrect password." : `Sign in failed: ${error.message}`, "error");
  } finally { $("login-button").disabled = false; }
});

$("logout-button").addEventListener("click", () => {
  token = "";
  sessionStorage.removeItem(tokenKey);
  dirty = false;
  showEditor(false);
});

form.addEventListener("input", () => {
  dirty = true;
  message("editor-status", "You have unsaved changes.");
});

async function saveChanges() {
  if (!token) return false;
  const data = readForm();
  const urls = fields.filter(key => key.endsWith("Url"));
  if (urls.some(key => !validUrl(data[key]))) {
    message("editor-status", "URLs must start with https:// or http://.", "error");
    return false;
  }
  if (data.backgroundEnd && data.backgroundEnd <= data.backgroundStart) {
    message("editor-status", "Video end must be after video start.", "error");
    return false;
  }
  $("save-button").disabled = true;
  message("editor-status", "Saving…");
  try {
    await api("/settings", { method: "PUT", body: JSON.stringify(data) });
    dirty = false;
    message("editor-status", "Saved. The profile page will update automatically.", "success");
    return true;
  } catch (error) {
    if (error.message === "Unauthorized") {
      token = "";
      sessionStorage.removeItem(tokenKey);
      showEditor(false);
      message("login-status", "Session expired. Please sign in again.", "error");
    } else message("editor-status", `Could not save: ${error.message}`, "error");
    return false;
  } finally { $("save-button").disabled = false; }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  await saveChanges();
});
