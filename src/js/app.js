import { apiUrl, isConfigured } from './api-config.js';

const $ = id => document.getElementById(id);
document.querySelector('.profile-picture').addEventListener('error', event => {
  event.target.src = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2246%22%20fill%3D%22%23101126%22%20stroke%3D%22%237afcff%22%20stroke-width%3D%225%22%2F%3E%3Ctext%20x%3D%2250%22%20y%3D%2261%22%20text-anchor%3D%22middle%22%20fill%3D%22%237afcff%22%20font-family%3D%22Arial%22%20font-size%3D%2236%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';
}, { once: true });
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
  document.querySelector('.profile-picture').src = safeUrl(data.avatarUrl) || 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%3E%3Cstop%20stop-color%3D%22%237afcff%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%239b5cff%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2246%22%20fill%3D%22%23101126%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%225%22%2F%3E%3Ctext%20x%3D%2250%22%20y%3D%2259%22%20text-anchor%3D%22middle%22%20fill%3D%22%237afcff%22%20font-family%3D%22Arial%2Csans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22bold%22%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E';
  const discordName = typeof data.discordUsername === 'string' ? data.discordUsername.trim().replace(/^@/, '') : '';
  $('discord-link').hidden = !discordName;
  $('discord-link').dataset.username = discordName;
  $('discord-tooltip').textContent = discordName ? `Copy @${discordName}` : 'Copy Discord username';
  for (const [social, field] of [['github', 'githubUrl'], ['youtube', 'youtubeUrl'], ['tiktok', 'tiktokUrl']]) {
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
  for (const [key, fallback] of [['accentColor', '#b99af7'], ['textColor', '#ffffff'], ['backgroundColor', '#090b10']]) {
    document.body.style.setProperty(`--${key}`, /^#[0-9a-f]{6}$/i.test(data[key]) ? data[key] : fallback);
  }
  document.body.style.setProperty('--profileOpacity', String((Number(data.profileOpacity) || 100) / 100));
  document.body.style.setProperty('--profileBlur', `${Number(data.profileBlur) || 0}px`);
  document.body.style.setProperty('--avatarRadius', `${Number.isFinite(Number(data.avatarRadius)) ? Number(data.avatarRadius) : 28}px`);
  for (const [key, visible] of [['views', data.showViews !== false], ['themes', data.showThemes !== false], ['audio', data.showVolume !== false]]) positionWrappers[key].hidden = !visible;
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
  const start = Number(window.profileSettings?.backgroundStart) || 0;
  if (start > 0 && start < background.duration) background.currentTime = start;
});
background.addEventListener('timeupdate', () => {
  const start = Number(window.profileSettings?.backgroundStart) || 0;
  const end = Number(window.profileSettings?.backgroundEnd) || 0;
  if (end > start && background.currentTime >= end) background.currentTime = start;
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
