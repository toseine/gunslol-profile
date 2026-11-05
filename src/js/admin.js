import { apiUrl, isConfigured } from "./api-config.js";

const $ = id => document.getElementById(id);
const form = $("settings-form");
const fields = ["name", "bio", "location", "avatarUrl", "defaultTheme", "videoUrl", "musicUrl", "hackerVideoUrl", "hackerMusicUrl", "rainVideoUrl", "rainMusicUrl", "animeVideoUrl", "animeMusicUrl", "carVideoUrl", "carMusicUrl", "snowEnabled", "discordUsername", "robloxUrl", "githubUrl", "youtubeUrl", "tiktokUrl", "telegramUrl", "animateEntrance", "animateText", "animatedBackground", "profileFloat", "hoverTilt", "cursorStyle", "enterText", "accentColor", "textColor", "backgroundColor", "socialIconColor", "fontStyle", "nameEffect", "socialStyle", "socialIconSet", "profileGradient", "monochromeIcons", "showViews", "showThemes", "showVolume"];
const toggleFields = new Set(["snowEnabled", "animateEntrance", "animateText", "animatedBackground", "profileFloat", "hoverTilt", "profileGradient", "monochromeIcons", "showViews", "showThemes", "showVolume"]);
const fieldDefaults = { defaultTheme: "home", cursorStyle: "orb", enterText: "Click to enter", accentColor: "#b99af7", textColor: "#ffffff", backgroundColor: "#090b10", socialIconColor: "#ffffff", fontStyle: "serif", nameEffect: "none", socialStyle: "glass", socialIconSet: "brand" };
const styleDefaults = { profileOpacity: 100, profileBlur: 0, avatarRadius: 28, cardWidth: 760, avatarSize: 174, nameSize: 59, bioSize: 19, socialSize: 42 };
const defaultLayout = {
  desktop: { profile: { x: 50, y: 50 }, social: { x: 50, y: 68 }, views: { x: 6, y: 94 }, themes: { x: 96, y: 50 }, audio: { x: 8, y: 6 } },
  mobile: { profile: { x: 50, y: 47 }, social: { x: 50, y: 65 }, views: { x: 11, y: 94 }, themes: { x: 94, y: 49 }, audio: { x: 15, y: 5 } }
};
let layout = structuredClone(defaultLayout);
let layoutDevice = "desktop";
const cropDefaults = { backgroundStart: 0, backgroundEnd: 0, backgroundZoom: 1, backgroundX: 50, backgroundY: 50 };
const backgroundFields = { home: "video-url", hacker: "hacker-video", rain: "rain-video", anime: "anime-video", car: "car-video" };
const musicFields = { home: ["music-url", "music"], hacker: ["hacker-music", "hackerMusic"], rain: ["rain-music", "rainMusic"], anime: ["anime-music", "animeMusic"], car: ["car-music", "carMusic"] };
const musicTrimKeys = Object.values(musicFields).flatMap(([, prefix]) => [`${prefix}Start`, `${prefix}End`]);
const badgeChoices = { owner: "Owner", verified: "Verified", developer: "Developer", partner: "Partner", supporter: "Supporter", premium: "Premium", og: "OG", donor: "Donor", booster: "Booster", bughunter: "Bug Hunter" };
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
const requestedProfile = new URLSearchParams(location.search).get("profile") || "main";
let activeProfile = /^[a-z0-9][a-z0-9-]{2,31}$/.test(requestedProfile) || requestedProfile === "main" ? requestedProfile : "main";
let dirty = false;
let presets = [];
let activePresetId = null;

function message(id, text, kind = "") {
  const el = $(id);
  el.textContent = text;
  el.dataset.kind = kind;
}

function showEditor(enabled) {
  $("login-panel").hidden = enabled;
  $("editor-panel").hidden = !enabled;
}

function formatMusicTime(seconds) {
  const whole = Math.floor(Number(seconds) || 0);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function showMusicRanges(data, label = "Saved clip") {
  for (const [, [fieldId, prefix]] of Object.entries(musicFields)) {
    const status = $(fieldId).closest(".theme-fields").querySelector(".music-trim small");
    const start = Number(data[`${prefix}Start`]) || 0;
    const end = Number(data[`${prefix}End`]) || 0;
    status.textContent = end
      ? `${label}: ${formatMusicTime(start)}–${formatMusicTime(end)} (${formatMusicTime(end - start)} long).`
      : start ? `${label}: from ${formatMusicTime(start)} to the end of the track.` : `${label}: full track.`;
  }
}

function fillForm(data = {}, clipLabel = "Saved clip") {
  for (const key of fields) {
    const el = form.elements.namedItem(key);
    if (toggleFields.has(key)) el.checked = data[key] ?? !["snowEnabled", "profileGradient"].includes(key);
    else el.value = typeof data[key] === "string" ? data[key] : (fieldDefaults[key] ?? "");
  }
  for (const [key, fallback] of Object.entries(cropDefaults)) {
    form.elements.namedItem(key).value = typeof data[key] === "number" ? data[key] : fallback;
  }
  for (const key of musicTrimKeys) form.elements.namedItem(key).value = typeof data[key] === "number" ? data[key] : 0;
  for (const badge of Object.keys(badgeChoices)) $(`badge-${badge}`).checked = Array.isArray(data.badges) && data.badges.includes(badge);
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
  showSelectedTheme();
  showMusicRanges(data, clipLabel);
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
  for (const key of musicTrimKeys) data[key] = Number(form.elements.namedItem(key).value);
  data.badges = Object.keys(badgeChoices).filter(badge => $(`badge-${badge}`).checked);
  for (const key of Object.keys(styleDefaults)) data[key] = Number(form.elements.namedItem(key).value);
  data.showThemes = false;
  return data;
}

function validUrl(value) {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function showSelectedTheme() {
  const selected = $("default-theme").value;
  document.querySelectorAll(".theme-fields").forEach((section, index) => {
    section.hidden = ["home", "hacker", "rain", "anime", "car"][index] !== selected;
  });
}
$("default-theme").addEventListener("change", () => { showSelectedTheme(); updatePreview(); });

const sectionCopy = {
  profile: ["Profile", "Edit your identity and avatar. Changes appear on the live page when saved."],
  badges: ["Badges", "Choose decorative badges for your profile. Save to publish your selection."],
  media: ["Media & music", "Edit the one theme visitors see, then trim and preview its music."],
  socials: ["Social links", "Add the links visitors can open and a Discord username they can copy."],
  appearance: ["Appearance", "Tune colors, icons, typography and what visitors can see."],
  animations: ["Animations", "Switch individual movement effects on or off."],
  layout: ["Layout", "Drag profile elements into place for desktop and phone separately."],
  presets: ["Presets", "Save this design and activate another one whenever you want."]
};
for (const button of document.querySelectorAll(".nav-button")) button.addEventListener("click", () => {
  const target = button.dataset.target;
  document.querySelectorAll(".nav-button").forEach(item => item.classList.toggle("active", item === button));
  document.querySelectorAll("[data-section]").forEach(section => { section.hidden = section.dataset.section !== target; });
  $("editor-title").textContent = sectionCopy[target][0];
  $("section-description").textContent = sectionCopy[target][1];
  document.querySelector(".editor-heading").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("edit-icon-style").addEventListener("click", () => document.querySelector('.nav-button[data-target="appearance"]').click());
$("open-badges").addEventListener("click", () => document.querySelector('.nav-button[data-target="badges"]').click());
for (const button of document.querySelectorAll("[data-social-focus]")) button.addEventListener("click", () => {
  $(button.dataset.socialFocus).focus();
});

let failedAvatarUrl = "";
function updateMiniPreview() {
  $("nav-display-name").textContent = $("profile-name").value || "Your profile";
  $("mini-name").textContent = $("profile-name").value || "Your name";
  $("mini-bio").textContent = $("profile-bio").value || "Your space on the web";
  const miniBadges = $("mini-badges");
  miniBadges.replaceChildren();
  for (const badge of Object.keys(badgeChoices).filter(badge => $(`badge-${badge}`).checked)) {
    const icon = document.createElement("img");
    icon.src = `./assets/badge-${badge}.svg`;
    icon.alt = badgeChoices[badge];
    miniBadges.append(icon);
  }
  const miniSocials = document.querySelector(".mini-socials");
  miniSocials.dataset.iconSet = $("social-icon-set").value;
  miniSocials.replaceChildren();
  for (const [name, id] of [["discord", "discord-username"], ["roblox", "roblox-url"], ["github", "github-url"], ["youtube", "youtube-url"], ["tiktok", "tiktok-url"], ["telegram", "telegram-url"]]) {
    const value = $(id).value.trim();
    if (!value || (name !== "discord" && !validUrl(value))) continue;
    const icon = document.createElement("span");
    icon.className = `mini-social-icon icon-${name}`;
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", name);
    miniSocials.append(icon);
  }
  const avatar = $("avatar-url").value.trim();
  const avatarSource = avatar && validUrl(avatar) && avatar !== failedAvatarUrl ? avatar : "./assets/avatar.svg";
  if ($("mini-avatar").getAttribute("src") !== avatarSource) $("mini-avatar").src = avatarSource;
  const stage = $("mini-stage");
  stage.style.setProperty("--mini-bg", $("background-color").value);
  stage.style.setProperty("--mini-accent", $("accent-color").value);
  stage.style.setProperty("--mini-text", $("text-color").value);
  stage.style.setProperty("--mini-opacity", String(Number($("profile-opacity").value) / 100));
  stage.style.setProperty("--mini-blur", `${$("profile-blur").value}px`);
  stage.classList.toggle("gradient-card", $("profile-gradient").checked);
  stage.classList.toggle("monochrome-icons", $("monochrome-icons").checked);
  stage.style.setProperty("--mini-radius", `${$("avatar-radius").value}px`);
  $("mini-card").style.width = `${Math.min(93, Number($("card-width").value) / 760 * 93)}%`;
  $("mini-avatar").style.width = `${Math.round(Number($("avatar-size").value) / 174 * 58)}px`;
  $("mini-avatar").style.height = $("mini-avatar").style.width;
  $("mini-name").style.fontSize = `${Math.round(Number($("name-size").value) / 59 * 25)}px`;
  $("mini-bio").style.fontSize = `${Math.round(Number($("bio-size").value) / 19 * 11)}px`;
  miniSocials.style.setProperty("--mini-social-size", `${Math.round(Number($("social-size").value) / 42 * 18)}px`);
  miniSocials.style.setProperty("--mini-icon-color", $("social-icon-color").value);
  $("mini-name").style.fontFamily = { serif: "Georgia, serif", sans: "Arial, sans-serif", mono: "monospace" }[$("font-style").value];
  $("opacity-value").textContent = `${$("profile-opacity").value}%`;
  $("blur-value").textContent = `${$("profile-blur").value}px`;
  $("radius-value").textContent = `${$("avatar-radius").value}px`;
  for (const key of ["card-width", "avatar-size", "name-size", "bio-size", "social-size"]) $(`${key}-value`).textContent = `${$(key).value}px`;
}
$("mini-avatar").addEventListener("error", event => {
  const source = event.target.getAttribute("src");
  if (source !== "./assets/avatar.svg") {
    failedAvatarUrl = source;
    event.target.src = "./assets/avatar.svg";
  }
});
for (const key of ["profile-name", "profile-bio", "avatar-url", "accent-color", "text-color", "background-color", "social-icon-color", "social-icon-set", "font-style", "profile-opacity", "profile-blur", "avatar-radius", "card-width", "avatar-size", "name-size", "bio-size", "social-size"]) $(key).addEventListener("input", updateMiniPreview);
for (const key of ["profile-gradient", "monochrome-icons"]) $(key).addEventListener("change", updateMiniPreview);
for (const badge of Object.keys(badgeChoices)) $(`badge-${badge}`).addEventListener("change", updateMiniPreview);
for (const id of ["discord-username", "roblox-url", "github-url", "youtube-url", "tiktok-url", "telegram-url"]) $(id).addEventListener("input", updateMiniPreview);

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
  block.addEventListener("pointerdown", event => { if (event.target.closest(".layout-edit")) return; block.setPointerCapture(event.pointerId); move(event); });
  block.addEventListener("pointermove", event => { if (block.hasPointerCapture(event.pointerId)) move(event); });
  block.addEventListener("click", event => {
    if (!event.target.closest(".layout-edit")) return;
    const section = { profile: "profile", social: "socials", views: "appearance", audio: "media" }[block.dataset.item];
    document.querySelector(`.nav-button[data-target="${section}"]`).click();
    if (block.dataset.item === "views") $("show-views").focus({ preventScroll: true });
  });
  block.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      block.querySelector(".layout-edit").click();
      return;
    }
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
  const url = new URL(`${apiUrl}${path}`);
  if (["/settings", "/presets", "/views", "/socket"].includes(url.pathname) || url.pathname.startsWith("/presets/")) url.searchParams.set("profile", activeProfile);
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
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
    if (file && (kind === "background" || kind === "music")) previewFiles.set(fieldId, { url: URL.createObjectURL(file), type: file.type });
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

for (const [theme, [fieldId, prefix]] of Object.entries(musicFields)) {
  const section = $(fieldId).closest(".theme-fields");
  const box = document.createElement("div");
  box.className = "music-trim";
  box.innerHTML = `<h4>Trim music for ${theme}</h4><p>Choose a segment to play on the profile. The original file stays unchanged.</p><div class="trim-numbers"><div><label for="${prefix}-start">Start at (seconds)</label><input id="${prefix}-start" name="${prefix}Start" type="number" min="0" max="3600" step="0.1" value="0"></div><div><label for="${prefix}-end">Stop at (seconds from track start; 0 = full track)</label><input id="${prefix}-end" name="${prefix}End" type="number" min="0" max="3600" step="0.1" value="0"></div></div><audio controls preload="none"></audio><div class="trim-actions"><button type="button" class="quiet-button" data-action="mark-start">Set start at playhead</button><button type="button" class="quiet-button" data-action="mark-end">Set end at playhead</button><button type="button" class="quiet-button" data-action="preview">Preview clip</button><button type="button" class="quiet-button" data-action="stop">Stop</button></div><small role="status"></small>`;
  section.append(box);
  const audio = box.querySelector("audio");
  const status = box.querySelector("small");
  const startInput = form.elements.namedItem(`${prefix}Start`);
  const endInput = form.elements.namedItem(`${prefix}End`);
  for (const input of [startInput, endInput]) input.addEventListener("input", () => {
    status.textContent = "Clip range changed. Click Save changes to publish it.";
  });
  let previewing = false;
  box.querySelector('[data-action="preview"]').addEventListener("click", async () => {
    const source = previewFiles.get(fieldId)?.url || $(fieldId).value.trim();
    const start = Number(startInput.value) || 0;
    const end = Number(endInput.value) || 0;
    if (!source) { status.textContent = "Add or upload music first."; return; }
    if (end && end <= start) { status.textContent = "End must be after start."; return; }
    if (audio.dataset.source !== source) { audio.src = source; audio.dataset.source = source; }
    try {
      if (audio.readyState < 1) await new Promise((resolve, reject) => {
        audio.addEventListener("loadedmetadata", resolve, { once: true });
        audio.addEventListener("error", reject, { once: true });
        audio.load();
      });
      if (Number.isFinite(audio.duration) && start >= audio.duration) { status.textContent = "Start is beyond the track length."; return; }
      audio.currentTime = start;
      previewing = true;
      await audio.play();
      status.textContent = "Playing selected segment.";
    } catch { previewing = false; status.textContent = "This URL is not a playable audio file."; }
  });
  box.querySelector('[data-action="stop"]').addEventListener("click", () => { previewing = false; audio.pause(); status.textContent = "Preview stopped."; });
  for (const [action, input] of [["mark-start", startInput], ["mark-end", endInput]]) {
    box.querySelector(`[data-action="${action}"]`).addEventListener("click", () => {
      if (audio.readyState < 1) { status.textContent = "Play or seek the track first."; return; }
      previewing = false;
      input.value = String(Math.round(audio.currentTime * 10) / 10);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = `${action === "mark-start" ? "Start" : "End"} set to ${input.value}s.`;
    });
  }
  audio.addEventListener("timeupdate", () => {
    if (!previewing) return;
    const start = Number(startInput.value) || 0;
    const end = Number(endInput.value) || 0;
    if (end > start && audio.currentTime >= end) audio.currentTime = start;
  });
  audio.addEventListener("ended", () => { previewing = false; status.textContent = "Preview finished."; });
}

function updateProfileLink() {
  const publicUrl = new URL('./index.html', location.href);
  const adminUrl = new URL('./admin.html', location.href);
  if (activeProfile !== 'main') {
    publicUrl.searchParams.set('profile', activeProfile);
    adminUrl.searchParams.set('profile', activeProfile);
  }
  $('profile-public-link').href = publicUrl.href;
  history.replaceState(null, '', adminUrl);
  $('delete-profile').disabled = activeProfile === 'main';
}

async function loadProfiles() {
  const { profiles } = await api('/profiles');
  const select = $('profile-select');
  select.replaceChildren(...profiles.map(item => new Option(item.name, item.slug)));
  if (!profiles.some(item => item.slug === activeProfile)) activeProfile = 'main';
  select.value = activeProfile;
  updateProfileLink();
}

$('profile-select').addEventListener('change', async event => {
  const next = event.target.value;
  if (next === activeProfile) return;
  if (dirty && !confirm('Discard unsaved changes and switch profiles?')) {
    event.target.value = activeProfile;
    return;
  }
  activeProfile = next;
  updateProfileLink();
  message('profile-status', 'Switching profile…');
  if (await openEditor()) message('profile-status', `Managing ${$('profile-select').selectedOptions[0]?.textContent || activeProfile}.`, 'success');
});

$('new-profile').addEventListener('click', () => {
  $('new-profile-form').reset();
  $('new-profile-slug').dataset.edited = 'false';
  message('create-profile-status', '');
  $('new-profile-dialog').showModal();
  $('new-profile-name').focus();
});
$('cancel-new-profile').addEventListener('click', () => $('new-profile-dialog').close());
$('new-profile-name').addEventListener('input', () => {
  const slug = $('new-profile-slug');
  if (slug.dataset.edited === 'true') return;
  slug.value = $('new-profile-name').value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
});
$('new-profile-slug').addEventListener('input', () => { $('new-profile-slug').dataset.edited = 'true'; });
$('new-profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (dirty && !confirm('Discard unsaved changes and create a new profile?')) return;
  const name = $('new-profile-name').value.trim();
  const slug = $('new-profile-slug').value.trim().toLowerCase();
  try {
    const result = await api('/profiles', { method: 'POST', body: JSON.stringify({ name, slug }) });
    activeProfile = result.created;
    $('new-profile-dialog').close();
    if (await openEditor()) message('profile-status', `Created ${name}. Share its public link with visitors.`, 'success');
  } catch (error) { message('create-profile-status', error.message, 'error'); }
});
$('delete-profile').addEventListener('click', async () => {
  if (activeProfile === 'main') return;
  const name = $('profile-select').selectedOptions[0]?.textContent || activeProfile;
  if (!confirm(`Delete “${name}” and its settings, presets and views permanently?`)) return;
  try {
    await api(`/profiles/${activeProfile}`, { method: 'DELETE' });
    activeProfile = 'main';
    if (await openEditor()) message('profile-status', `Deleted ${name}.`, 'success');
  } catch (error) { message('profile-status', `Could not delete profile: ${error.message}`, 'error'); }
});

async function openEditor() {
  try {
    await loadProfiles();
    const settings = await api("/settings");
    fillForm(settings);
    showEditor(true);
    message("editor-status", "Settings are up to date.");
    await loadPresets();
    return true;
  } catch (error) {
    message("login-status", `Could not load settings: ${error.message}`, "error");
    message("profile-status", `Could not load profile: ${error.message}`, "error");
    return false;
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

form.addEventListener("input", event => {
  if (event.target.id?.startsWith("preset-")) return;
  dirty = true;
  message("editor-status", "You have unsaved changes.");
});

function settingsError(data) {
  const urls = fields.filter(key => key.endsWith("Url"));
  if (urls.some(key => !validUrl(data[key]))) return "URLs must start with https:// or http://.";
  if (data.backgroundEnd && data.backgroundEnd <= data.backgroundStart) return "Video end must be after video start.";
  for (const [, prefix] of Object.values(musicFields)) {
    if (data[`${prefix}End`] && data[`${prefix}End`] <= data[`${prefix}Start`]) return "Music end must be after music start.";
  }
  return "";
}

function renderPresetList(selectedId = $("preset-list").value) {
  const list = $("preset-list");
  list.replaceChildren(new Option("Choose a preset", ""));
  for (const preset of presets) list.add(new Option(`${preset.name}${preset.id === activePresetId ? " · active" : ""}`, preset.id));
  list.value = presets.some(item => item.id === selectedId) ? selectedId : (activePresetId || "");
}

async function loadPresets() {
  const profile = activeProfile;
  try {
    const data = await api("/presets");
    if (profile !== activeProfile) return;
    presets = data.presets || [];
    activePresetId = data.activePresetId;
    renderPresetList();
  } catch (error) { message("preset-status", `Could not load presets: ${error.message}`, "error"); }
}

$("preset-list").addEventListener("change", () => {
  const selected = presets.find(item => item.id === $("preset-list").value);
  $("preset-name").value = selected?.name || "";
  message("preset-status", selected ? `${selected.name}${selected.id === activePresetId ? " is live." : " is saved."}` : "");
});

$("preset-save").addEventListener("click", async () => {
  const name = $("preset-name").value.trim();
  if (!name) { message("preset-status", "Enter a preset name first.", "error"); return; }
  const settings = readForm();
  const error = settingsError(settings);
  if (error) { message("preset-status", error, "error"); return; }
  try {
    const data = await api("/presets", { method: "POST", body: JSON.stringify({ name, settings }) });
    presets = data.presets;
    activePresetId = data.activePresetId;
    renderPresetList(presets.find(item => item.name.toLowerCase() === name.toLowerCase())?.id);
    message("preset-status", `Preset “${name}” saved. Activate it to show it publicly.`, "success");
  } catch (error) { message("preset-status", `Could not save preset: ${error.message}`, "error"); }
});

$("preset-load").addEventListener("click", () => {
  const selected = presets.find(item => item.id === $("preset-list").value);
  if (!selected) { message("preset-status", "Choose a preset first.", "error"); return; }
  fillForm(selected.settings, "Preset clip");
  dirty = true;
  message("editor-status", "Preset loaded. Save changes to make these edits live.");
  message("preset-status", `Loaded “${selected.name}” into the editor.`);
});

$("preset-activate").addEventListener("click", async () => {
  const id = $("preset-list").value;
  if (!id) { message("preset-status", "Choose a preset first.", "error"); return; }
  try {
    const data = await api(`/presets/${id}/activate`, { method: "POST" });
    activePresetId = data.activePresetId;
    fillForm(data.settings);
    renderPresetList(id);
    message("preset-status", "Preset activated. Visitors see it now.", "success");
    message("editor-status", "Active preset is up to date.", "success");
  } catch (error) { message("preset-status", `Could not activate preset: ${error.message}`, "error"); }
});

$("preset-delete").addEventListener("click", async () => {
  const id = $("preset-list").value;
  if (!id) { message("preset-status", "Choose a preset first.", "error"); return; }
  try {
    const data = await api(`/presets/${id}`, { method: "DELETE" });
    presets = data.presets;
    activePresetId = data.activePresetId;
    renderPresetList("");
    $("preset-name").value = "";
    message("preset-status", "Preset deleted. The current live profile stays as it is.", "success");
  } catch (error) { message("preset-status", `Could not delete preset: ${error.message}`, "error"); }
});

async function saveChanges() {
  if (!token) return false;
  const data = readForm();
  const error = settingsError(data);
  if (error) { message("editor-status", error, "error"); return false; }
  $("save-button").disabled = true;
  message("editor-status", "Saving…");
  try {
    const saved = await api("/settings", { method: "PUT", body: JSON.stringify(data) });
    fillForm(saved);
    activePresetId = null;
    renderPresetList();
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
