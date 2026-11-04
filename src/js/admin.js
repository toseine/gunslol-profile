import { apiUrl, isConfigured } from "./api-config.js";

const $ = id => document.getElementById(id);
const form = $("settings-form");
const fields = ["name", "bio", "videoUrl", "musicUrl", "snowEnabled", "discordUrl", "githubUrl", "youtubeUrl"];
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
    if (key === "snowEnabled") el.checked = data[key] === true;
    else el.value = typeof data[key] === "string" ? data[key] : "";
  }
  if (!data.name) form.elements.namedItem("name").value = "Twój nick";
  dirty = false;
}

function readForm() {
  const data = {};
  for (const key of fields) {
    const el = form.elements.namedItem(key);
    data[key] = key === "snowEnabled" ? el.checked : el.value.trim();
  }
  return data;
}

function validUrl(value) {
  if (!value) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
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

async function openEditor() {
  try {
    const settings = await api("/settings");
    fillForm(settings);
    showEditor(true);
    message("editor-status", "Dane są aktualne.");
  } catch (error) {
    message("login-status", `Nie udało się pobrać ustawień: ${error.message}`, "error");
  }
}

if (!isConfigured) {
  message("login-status", "Najpierw uzupełnij src/js/api-config.js.", "error");
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
  message("login-status", "Sprawdzanie dostępu…");
  try {
    const result = await api("/login", { method: "POST", body: JSON.stringify({ password }) });
    token = result.token;
    sessionStorage.setItem(tokenKey, token);
    message("login-status", "");
    await openEditor();
  } catch (error) {
    message("login-status", error.message === "Invalid credentials" ? "Nieprawidłowe hasło." : `Logowanie nie powiodło się: ${error.message}`, "error");
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
  message("editor-status", "Masz niezapisane zmiany.");
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!token) return;
  const data = readForm();
  const urls = ["videoUrl", "musicUrl", "discordUrl", "githubUrl", "youtubeUrl"];
  if (urls.some(key => !validUrl(data[key]))) {
    message("editor-status", "Adresy muszą zaczynać się od https:// lub http://.", "error");
    return;
  }
  $("save-button").disabled = true;
  message("editor-status", "Zapisywanie…");
  try {
    await api("/settings", { method: "PUT", body: JSON.stringify(data) });
    dirty = false;
    message("editor-status", "Zapisano. Strona główna zaktualizuje się automatycznie.", "success");
  } catch (error) {
    if (error.message === "Unauthorized") {
      token = "";
      sessionStorage.removeItem(tokenKey);
      showEditor(false);
      message("login-status", "Sesja wygasła. Zaloguj się ponownie.", "error");
    } else message("editor-status", `Nie udało się zapisać: ${error.message}`, "error");
  } finally { $("save-button").disabled = false; }
});
