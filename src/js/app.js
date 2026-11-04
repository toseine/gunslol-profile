import { apiUrl, isConfigured } from './api-config.js';

const $ = id => document.getElementById(id);
const avatarImage = document.querySelector('.profile-picture');
const avatarFallback = avatarImage.getAttribute('src');
let failedAvatarUrl = '';
avatarImage.addEventListener('error', () => {
  if (avatarImage.getAttribute('src') !== avatarFallback) {
    failedAvatarUrl = avatarImage.getAttribute('src');
    avatarImage.src = avatarFallback;
  }
});
const themes = ['home', 'hacker', 'rain', 'anime', 'car'];
const media = {
  home: ['videoUrl', 'musicUrl', 'background-music'],
  hacker: ['hackerVideoUrl', 'hackerMusicUrl', 'hacker-music'],
  rain: ['rainVideoUrl', 'rainMusicUrl', 'rain-music'],
  anime: ['animeVideoUrl', 'animeMusicUrl', 'anime-music'],
  car: ['carVideoUrl', 'carMusicUrl', 'car-music']
};
let activeTheme = 'home';
let previousDefault = '';
const layoutDefaults = {
  desktop: { profile: { x: 50, y: 50 }, social: { x: 50, y: 68 }, views: { x: 6, y: 94 }, themes: { x: 96, y: 50 }, audio: { x: 8, y: 6 } },
  mobile: { profile: { x: 50, y: 47 }, social: { x: 50, y: 65 }, views: { x: 11, y: 94 }, themes: { x: 94, y: 49 }, audio: { x: 15, y: 5 } }
};
const musicTrim = {
  'background-music': ['musicStart', 'musicEnd'],
  'hacker-music': ['hackerMusicStart', 'hackerMusicEnd'],
  'rain-music': ['rainMusicStart', 'rainMusicEnd'],
  'anime-music': ['animeMusicStart', 'animeMusicEnd'],
  'car-music': ['carMusicStart', 'carMusicEnd']
};
function audioBounds(audio) {
  const [startKey, endKey] = musicTrim[audio.id];
  const settings = window.profileSettings || {};
  const duration = Number.isFinite(audio.duration) ? audio.duration : Infinity;
  const requestedStart = Number(settings[startKey]) || 0;
  const start = requestedStart < duration ? Math.max(0, requestedStart) : 0;
  const requestedEnd = Number(settings[endKey]) || 0;
  const end = requestedEnd > start ? Math.min(requestedEnd, duration) : duration;
  return { start, end };
}
function keepAudioInClip(audio) {
  if (!audio.src || audio.readyState < 1) return;
  const { start, end } = audioBounds(audio);
  if (audio.currentTime < start - 0.25 || (Number.isFinite(end) && audio.currentTime >= end)) {
    try { audio.currentTime = start; } catch { /* Non-seekable media. */ }
  }
}
for (const audioId of Object.keys(musicTrim)) {
  const audio = document.getElementById(audioId);
  for (const event of ['loadedmetadata', 'play', 'timeupdate']) audio.addEventListener(event, () => keepAudioInClip(audio));
}
const positionElements = {
  profile: $('profile-block'), social: document.querySelector('.social-links'),
  views: document.querySelector('.visitor-counter'), themes: document.querySelector('.controls'),
  audio: document.querySelector('.top-controls')
};
const positionWrappers = {};
for (const [key, element] of Object.entries(positionElements)) {
  const wrapper = document.createElement('div');
  wrapper.className = `position-wrapper position-${key}`;
  document.body.append(wrapper);
  wrapper.append(element);
  positionWrappers[key] = wrapper;
}

function applyLayout(data) {
  const device = matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';
  for (const [key, wrapper] of Object.entries(positionWrappers)) {
    const position = data.layout?.[device]?.[key] || layoutDefaults[device][key];
    wrapper.style.left = `${position.x}%`;
    wrapper.style.top = `${position.y}%`;
  }
}
addEventListener('resize', () => { if (window.profileSettings) applyLayout(window.profileSettings); });
applyLayout({});

function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function updateMusicToggle() {
  const audio = $(media[activeTheme][2]);
  $('music-toggle').hidden = !audio.src || !audio.paused;
}

function render(data) {
  window.profileSettings = data;
  document.title = `${data.name || 'Profile'} · profile`;
  window.dispatchEvent(new CustomEvent('profile:settings', { detail: data }));
  const avatarUrl = safeUrl(data.avatarUrl);
  const avatarSource = avatarUrl && avatarUrl !== failedAvatarUrl ? avatarUrl : avatarFallback;
  if (avatarImage.getAttribute('src') !== avatarSource) avatarImage.src = avatarSource;
  const discordName = typeof data.discordUsername === 'string' ? data.discordUsername.trim().replace(/^@/, '') : '';
  $('discord-link').hidden = !discordName;
  $('discord-link').dataset.username = discordName;
  $('discord-tooltip').textContent = discordName ? `Copy @${discordName}` : 'Copy Discord username';
  const badgeLabels = { owner: "Owner", verified: "Verified", developer: "Developer", partner: "Partner", supporter: "Supporter" };
  const badgeContainer = $('profile-badges');
  badgeContainer.replaceChildren();
  for (const badge of Array.isArray(data.badges) ? data.badges : []) {
    if (!Object.hasOwn(badgeLabels, badge)) continue;
    const chip = document.createElement('span');
    chip.className = `profile-badge badge-${badge}`;
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', badgeLabels[badge]);
    chip.dataset.label = badgeLabels[badge];
    const icon = document.createElement('img');
    icon.src = `./assets/badge-${badge}.svg`;
    icon.alt = '';
    chip.append(icon);
    badgeContainer.append(chip);
  }
  badgeContainer.hidden = !badgeContainer.childElementCount;
  for (const [social, field] of [['github', 'githubUrl'], ['youtube', 'youtubeUrl'], ['tiktok', 'tiktokUrl'], ['telegram', 'telegramUrl']]) {
    const link = $(`${social}-link`);
    const url = safeUrl(data[field]);
    link.hidden = !url;
    if (url) link.href = url;
    else link.removeAttribute('href');
  }
  for (const [, audioField, audioId] of Object.values(media)) {
    const audio = $(audioId);
    const url = safeUrl(data[audioField]);
    if (audio.dataset.url !== url) {
      audio.dataset.url = url;
      audio.pause();
      if (url) audio.src = url;
      else audio.removeAttribute('src');
    }
  }
  const nextDefault = themes.includes(data.defaultTheme) ? data.defaultTheme : 'home';
  if (!previousDefault || previousDefault !== nextDefault) activeTheme = nextDefault;
  previousDefault = nextDefault;
  window.applyTheme?.(activeTheme);
  applyBackgroundCrop(data);
  applyLayout(data);
  document.body.classList.toggle('no-ambience', data.animatedBackground === false);
  document.body.classList.toggle('no-avatar-motion', data.profileFloat === false);
  document.body.classList.toggle('system-cursor', data.cursorStyle === 'system');
  document.body.dataset.cursor = ['orb', 'dot', 'crosshair', 'system'].includes(data.cursorStyle) ? data.cursorStyle : 'orb';
  document.body.dataset.fontStyle = ['serif', 'sans', 'mono'].includes(data.fontStyle) ? data.fontStyle : 'serif';
  document.body.dataset.nameEffect = ['none', 'glow', 'gradient'].includes(data.nameEffect) ? data.nameEffect : 'none';
  document.body.dataset.socialStyle = ['glass', 'solid', 'outline'].includes(data.socialStyle) ? data.socialStyle : 'glass';
  for (const [key, fallback] of [['accentColor', '#b99af7'], ['textColor', '#ffffff'], ['backgroundColor', '#090b10'], ['socialIconColor', '#ffffff']]) {
    document.body.style.setProperty(`--${key}`, /^#[0-9a-f]{6}$/i.test(data[key]) ? data[key] : fallback);
  }
  document.body.style.setProperty('--profileOpacity', String((Number.isFinite(Number(data.profileOpacity)) ? Number(data.profileOpacity) : 100) / 100));
  document.body.style.setProperty('--profileBlur', `${Number(data.profileBlur) || 0}px`);
  document.body.style.setProperty('--avatarRadius', `${Number.isFinite(Number(data.avatarRadius)) ? Number(data.avatarRadius) : 28}px`);
  for (const [key, fallback] of [['cardWidth', 760], ['avatarSize', 174], ['nameSize', 59], ['bioSize', 19], ['socialSize', 42]]) {
    document.body.style.setProperty(`--${key}`, `${Number.isFinite(Number(data[key])) ? Number(data[key]) : fallback}px`);
  }
  for (const [key, visible] of [['views', data.showViews !== false], ['themes', false], ['audio', data.showVolume !== false]]) positionWrappers[key].hidden = !visible;
  setSnow(data.snowEnabled === true);
  $('api-status').textContent = '';
  updateMusicToggle();
}

for (const theme of themes) {
  const button = $(`${theme}-theme`);
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', `${theme} theme`);
  button.addEventListener('click', () => { activeTheme = theme; setTimeout(updateMusicToggle, 100); });
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); button.click(); }
  });
}
$('music-toggle').addEventListener('click', async () => {
  try { await $(media[activeTheme][2]).play(); } catch { /* Blokada autoodtwarzania. */ }
  updateMusicToggle();
});
for (const [, , audioId] of Object.values(media)) {
  $(audioId).addEventListener('play', updateMusicToggle);
  $(audioId).addEventListener('pause', updateMusicToggle);
}

const canvas = $('snow-canvas');
const ctx = canvas.getContext('2d');
let snowEnabled = false;
let flakes = [];
let frame = 0;
function resizeSnow() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  flakes = Array.from({ length: Math.min(110, Math.floor(innerWidth / 12)) }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 1.9 + 0.7, speed: Math.random() * 1.2 + 0.35,
    drift: Math.random() * 0.8 - 0.4
  }));
}
function drawSnow() {
  if (!snowEnabled) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = 'rgba(218, 235, 255, .72)';
  for (const flake of flakes) {
    ctx.beginPath(); ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2); ctx.fill();
    flake.y += flake.speed; flake.x += flake.drift;
    if (flake.y > innerHeight + 4) { flake.y = -4; flake.x = Math.random() * innerWidth; }
  }
  frame = requestAnimationFrame(drawSnow);
}
function setSnow(enabled) {
  if (enabled === snowEnabled) return;
  snowEnabled = enabled;
  canvas.hidden = !enabled;
  if (enabled) { resizeSnow(); drawSnow(); }
  else { cancelAnimationFrame(frame); ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
addEventListener('resize', () => { if (snowEnabled) resizeSnow(); });

async function loadSettings() {
  try {
    const response = await fetch(`${apiUrl}/settings`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    $('api-status').textContent = 'Connecting to profile…';
    console.error('Profile load failed:', error);
  }
}
let retryDelay = 1000;
function connectLive() {
  const socket = new WebSocket(`${apiUrl.replace(/^http/, 'ws')}/socket`);
  socket.addEventListener('open', () => { retryDelay = 1000; });
  socket.addEventListener('message', event => {
    try { const message = JSON.parse(event.data); if (message.type === 'settings') render(message.data); }
    catch (error) { console.error('Invalid profile update:', error); }
  });
  socket.addEventListener('close', () => {
    setTimeout(() => { loadSettings(); connectLive(); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  });
  socket.addEventListener('error', () => socket.close());
}

let discordTipTimer;
$('discord-link').addEventListener('click', async event => {
  event.preventDefault();
  const username = $('discord-link').dataset.username;
  if (!username) return;
  try {
    await navigator.clipboard.writeText(username);
    $('discord-tooltip').textContent = `Copied @${username}`;
    $('discord-link').classList.add('copied');
    clearTimeout(discordTipTimer);
    discordTipTimer = setTimeout(() => {
      $('discord-tooltip').textContent = `Copy @${username}`;
      $('discord-link').classList.remove('copied');
    }, 2400);
  } catch {
    $('discord-tooltip').textContent = `@${username}`;
    $('discord-link').classList.add('copied');
  }
});

const background = $('background');
function backgroundStart() {
  const requested = Number(window.profileSettings?.backgroundStart) || 0;
  return requested > 0 && requested < background.duration ? requested : 0;
}
function applyBackgroundCrop(data) {
  const zoom = Number(data.backgroundZoom) || 1;
  const x = Number.isFinite(Number(data.backgroundX)) ? Number(data.backgroundX) : 50;
  const y = Number.isFinite(Number(data.backgroundY)) ? Number(data.backgroundY) : 50;
  background.style.transform = `scale(${zoom})`;
  background.style.transformOrigin = `${x}% ${y}%`;
  background.style.objectPosition = `${x}% ${y}%`;
  background.style.backgroundPosition = `${x}% ${y}%`;
}
background.addEventListener('loadedmetadata', () => {
  background.currentTime = backgroundStart();
});
background.addEventListener('timeupdate', () => {
  const start = backgroundStart();
  const end = Number(window.profileSettings?.backgroundEnd) || 0;
  if (end > start && background.currentTime >= Math.min(end, background.duration) - 0.05) background.currentTime = start;
});
background.addEventListener('ended', () => {
  background.currentTime = backgroundStart();
  background.play().catch(() => {});
});
async function updateViews() {
  try {
    const response = await fetch(`${apiUrl}/views`, { method: 'POST', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { count } = await response.json();
    $('visitor-count').textContent = Number(count).toLocaleString('en-US');
  } catch (error) {
    $('visitor-count').textContent = '—';
    console.error('View count failed:', error);
  }
}
if (isConfigured) { loadSettings(); connectLive(); updateViews(); }
else $('api-status').textContent = 'Set the API URL in src/js/api-config.js.';
