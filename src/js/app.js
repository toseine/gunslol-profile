import { apiUrl, isConfigured } from './api-config.js';

const $ = id => document.getElementById(id);
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
  for (const [social, field] of [['discord', 'discordUrl'], ['github', 'githubUrl'], ['youtube', 'youtubeUrl'], ['tiktok', 'tiktokUrl']]) {
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
async function updateViews() {
  const firstViewThisSession = !sessionStorage.getItem('profile_view_counted');
  try {
    const response = await fetch(`${apiUrl}/views`, { method: firstViewThisSession ? 'POST' : 'GET', cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { count } = await response.json();
    if (firstViewThisSession) sessionStorage.setItem('profile_view_counted', '1');
    $('visitor-count').textContent = Number(count).toLocaleString('en-US');
  } catch (error) {
    $('visitor-count').textContent = '—';
    console.error('View count failed:', error);
  }
}
if (isConfigured) { loadSettings(); connectLive(); updateViews(); }
else $('api-status').textContent = 'Set the API URL in src/js/api-config.js.';
