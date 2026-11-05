import { apiUrl, isConfigured } from './api-config.js';
import { socialIcons } from './social-icons.js';

const profileSlug = new URLSearchParams(location.search).get('profile') || 'main';
const profileQuery = `?profile=${encodeURIComponent(profileSlug)}`;

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
let widgetSignature = '';
let clockTimer;
function widgetCard(icon, label, value) {
  const card = document.createElement('div'); card.className = 'profile-widget';
  const symbol = document.createElement('span'); symbol.className = 'widget-icon'; symbol.textContent = icon;
  const copy = document.createElement('span');
  const heading = document.createElement('small'); heading.textContent = label;
  const detail = document.createElement('strong'); detail.textContent = value;
  copy.append(heading, detail); card.append(symbol, copy);
  return detail;
}
async function renderWidgets(data) {
  const key = JSON.stringify([data.clockEnabled, data.clockTimezone, data.weatherEnabled, data.weatherCity, data.discordPresenceEnabled, data.discordPresenceId, Math.floor(Date.now() / 300000)]);
  if (key === widgetSignature) return;
  widgetSignature = key;
  clearInterval(clockTimer);
  const root = $('profile-widgets'); root.replaceChildren();
  if (data.clockEnabled) {
    const detail = widgetCard('◷', 'LOCAL TIME', '—'); root.append(detail.parentElement.parentElement);
    const updateClock = () => { try { detail.textContent = new Intl.DateTimeFormat('en', { timeZone: data.clockTimezone || 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); } catch { detail.textContent = 'Invalid timezone'; } };
    updateClock(); clockTimer = setInterval(updateClock, 30000);
  }
  root.hidden = !root.childElementCount && !(data.weatherEnabled && data.weatherCity) && !(data.discordPresenceEnabled && /^\d{17,20}$/.test(data.discordPresenceId || ''));
  if (data.weatherEnabled && data.weatherCity) {
    const detail = widgetCard('☁', data.weatherCity.toUpperCase(), 'Loading…'); root.append(detail.parentElement.parentElement);
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.weatherCity)}&count=1&language=en&format=json`).then(r => r.json());
      if (!geo.results?.length) throw new Error('City not found');
      const { latitude, longitude } = geo.results[0];
      const weather = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`).then(r => r.json());
      if (widgetSignature === key) detail.textContent = `${Math.round(weather.current.temperature_2m)}°C`;
    } catch { if (widgetSignature === key) detail.textContent = 'Unavailable'; }
  }
  if (data.discordPresenceEnabled && /^\d{17,20}$/.test(data.discordPresenceId || '')) {
    const detail = widgetCard('◉', 'DISCORD', 'Loading…'); root.append(detail.parentElement.parentElement);
    try {
      const presence = await fetch(`https://api.lanyard.rest/v1/users/${data.discordPresenceId}`).then(r => r.json());
      if (widgetSignature === key) detail.textContent = presence.success ? (presence.data.discord_status || 'offline') : 'Unavailable';
    } catch { if (widgetSignature === key) detail.textContent = 'Unavailable'; }
  }
  if (widgetSignature === key) {
    root.hidden = !root.childElementCount;
    document.body.classList.toggle('has-profile-extras', root.childElementCount > 0 || !$('custom-links').hidden);
  }
}
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
  avatarImage.closest('.profile-container').hidden = data.avatarHidden === true;
  const banner = $('profile-banner');
  const bannerUrl = safeUrl(data.bannerUrl);
  banner.replaceChildren();
  banner.hidden = !bannerUrl;
  if (bannerUrl) { const image = document.createElement('img'); image.src = bannerUrl; image.alt = ''; banner.append(image); }
  const cursor = document.querySelector('.custom-cursor');
  cursor.replaceChildren();
  const cursorUrl = safeUrl(data.cursorUrl);
  if (cursorUrl) { const image = document.createElement('img'); image.src = cursorUrl; image.alt = ''; cursor.append(image); }
  document.body.classList.toggle('image-cursor', !!cursorUrl && data.cursorStyle !== 'system');
  if (data.entryEnabled === false) { $('start-screen').classList.add('hidden'); $('profile-block').classList.remove('hidden'); }
  const discordName = typeof data.discordUsername === 'string' ? data.discordUsername.trim().replace(/^@/, '') : '';
  $('discord-link').hidden = !discordName;
  $('discord-link').dataset.username = discordName;
  $('discord-tooltip').textContent = discordName ? `Copy @${discordName}` : 'Copy Discord username';
  const badgeLabels = { owner: "Owner", verified: "Verified", developer: "Developer", partner: "Partner", supporter: "Supporter", premium: "Premium", og: "OG", donor: "Donor", booster: "Booster", bughunter: "Bug Hunter", helper: "Helper", gifter: "Gifter", imagehost: "Image Host", domainlegend: "Domain Legend" };
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
  for (const badge of Array.isArray(data.customBadges) ? data.customBadges : []) {
    const url = safeUrl(badge.imageUrl);
    if (!url || !badge.label) continue;
    const chip = document.createElement('span');
    chip.className = 'profile-badge custom-profile-badge';
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', badge.label);
    chip.dataset.label = badge.label;
    if (/^#[0-9a-f]{6}$/i.test(badge.color)) chip.style.setProperty('--customBadgeColor', badge.color);
    const icon = document.createElement('img');
    icon.src = url;
    icon.alt = '';
    chip.append(icon);
    badgeContainer.append(chip);
  }
  badgeContainer.hidden = !badgeContainer.childElementCount;
  document.body.dataset.badgePlacement = data.badgePlacement === 'inline' ? 'inline' : 'below';
  const location = $('profile-location');
  location.textContent = typeof data.location === 'string' ? data.location.trim() : '';
  location.hidden = !location.textContent;
  const occupation = $('profile-occupation');
  occupation.textContent = typeof data.occupation === 'string' ? data.occupation.trim() : '';
  occupation.hidden = !occupation.textContent;
  for (const [social, field] of [['roblox', 'robloxUrl'], ['github', 'githubUrl'], ['youtube', 'youtubeUrl'], ['tiktok', 'tiktokUrl'], ['telegram', 'telegramUrl']]) {
    const link = $(`${social}-link`);
    const url = safeUrl(data[field]);
    link.hidden = !url;
    if (url) link.href = url;
    else link.removeAttribute('href');
  }
  const socials = document.querySelector('.social-links');
  for (const id of Array.isArray(data.socialOrder) ? data.socialOrder : ['discord', 'roblox', 'github', 'youtube', 'tiktok', 'telegram']) {
    const link = $(`${id}-link`);
    if (link) socials.append(link);
  }
  socials.querySelectorAll('[data-extra-social]').forEach(link => link.remove());
  for (const social of Array.isArray(data.extraSocials) ? data.extraSocials : []) {
    const url = safeUrl(social.url);
    if (!url) continue;
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.dataset.extraSocial = '';
    const label = social.label || social.platform || 'Social link'; link.setAttribute('aria-label', label); link.title = label;
    const iconUrl = safeUrl(social.iconUrl);
    if (iconUrl) { const image = document.createElement('img'); image.src = iconUrl; image.alt = ''; image.className = 'extra-social-icon'; link.append(image); }
    else if (Object.hasOwn(socialIcons, social.platform === 'x' ? 'twitter' : social.platform)) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', socialIcons[social.platform === 'x' ? 'twitter' : social.platform]); svg.append(path); link.append(svg); }
    else { const letter = document.createElement('strong'); letter.textContent = label[0]?.toUpperCase() || '?'; link.append(letter); }
    socials.append(link);
  }
  const customLinks = $('custom-links'); customLinks.replaceChildren();
  for (const item of Array.isArray(data.customLinks) ? data.customLinks : []) {
    const url = safeUrl(item.url); if (!url || !item.title) continue;
    const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'custom-link';
    const iconUrl = safeUrl(item.iconUrl); if (iconUrl) { const image = document.createElement('img'); image.src = iconUrl; image.alt = ''; link.append(image); }
    const title = document.createElement('span'); title.textContent = item.title; link.append(title);
    const arrow = document.createElement('span'); arrow.textContent = '↗'; link.append(arrow); customLinks.append(link);
  }
  customLinks.hidden = !customLinks.childElementCount;
  document.body.classList.toggle('has-custom-links', customLinks.childElementCount > 0);
  renderWidgets(data);
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
  document.body.dataset.socialIconSet = data.socialIconSet === 'minimal' ? 'minimal' : 'brand';
  document.body.dataset.cardStyle = ['floating', 'glass', 'solid', 'outline'].includes(data.cardStyle) ? data.cardStyle : 'glass';
  document.body.classList.toggle('profile-gradient', data.profileGradient === true);
  document.body.dataset.profileAlignment = data.profileAlignment === 'center' ? 'center' : 'left';
  document.body.classList.toggle('monochrome-icons', data.monochromeIcons !== false);
  for (const [key, fallback] of [['accentColor', '#b99af7'], ['textColor', '#ffffff'], ['backgroundColor', '#090b10'], ['socialIconColor', '#ffffff'], ['borderColor', '#b99af7'], ['badgeColor', '#b99af7'], ['linkHoverColor', '#b99af7'], ['gradientPrimary', '#b99af7'], ['gradientSecondary', '#090b10']]) {
    document.body.style.setProperty(`--${key}`, /^#[0-9a-f]{6}$/i.test(data[key]) ? data[key] : fallback);
  }
  document.body.style.setProperty('--borderOpacity', `${Number.isFinite(Number(data.borderOpacity)) ? Number(data.borderOpacity) : 100}%`);
  document.body.style.setProperty('--profileOpacity', String((Number.isFinite(Number(data.profileOpacity)) ? Number(data.profileOpacity) : 100) / 100));
  document.body.style.setProperty('--profileBlur', `${Number(data.profileBlur) || 0}px`);
  document.body.style.setProperty('--avatarRadius', `${Number.isFinite(Number(data.avatarRadius)) ? Number(data.avatarRadius) : 28}px`);
  for (const [key, fallback] of [['cardWidth', 760], ['avatarSize', 174], ['nameSize', 59], ['bioSize', 19], ['socialSize', 42], ['borderWidth', 1], ['cardRadius', 22], ['cardPadding', 26], ['cardGlow', 18], ['badgeSize', 30], ['socialGap', 10]]) {
    document.body.style.setProperty(`--${key}`, `${Number.isFinite(Number(data[key])) ? Number(data[key]) : fallback}px`);
  }
  const brightness = Number.isFinite(Number(data.backgroundBrightness)) ? Number(data.backgroundBrightness) : 42;
  const blur = Number.isFinite(Number(data.backgroundBlur)) ? Number(data.backgroundBlur) : 3;
  $('background').style.filter = `brightness(${brightness}%) blur(${blur}px)`;
  for (const [key, visible] of [['views', data.showViews !== false], ['themes', false], ['audio', data.showVolume !== false]]) positionWrappers[key].hidden = !visible;
  $('share-profile').hidden = data.showShare === false;
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const showMore = data.showMoreSection === true || projects.length > 0;
  document.body.classList.toggle('has-more-section', showMore);
  $('more-section').hidden = !showMore;
  $('scroll-more').hidden = !showMore;
  if (!showMore && scrollY) scrollTo(0, 0);
  $('scroll-more').firstElementChild.textContent = data.scrollLabel || 'Explore more';
  $('more-eyebrow').textContent = data.moreEyebrow || 'BEYOND THE PROFILE';
  $('more-title').textContent = data.moreTitle || 'A little more about me';
  $('more-text').textContent = data.moreText || '';
  $('more-section').dataset.style = ['glass', 'solid', 'outline'].includes(data.moreStyle) ? data.moreStyle : 'glass';
  const moreUrl = safeUrl(data.moreLinkUrl);
  $('more-link').hidden = !moreUrl || !data.moreLinkLabel;
  if (moreUrl) $('more-link').href = moreUrl;
  else $('more-link').removeAttribute('href');
  $('more-link').textContent = data.moreLinkLabel || '';
  const projectGrid = $('project-grid');
  projectGrid.replaceChildren();
  for (const project of projects) {
    if (!project.title) continue;
    const url = safeUrl(project.url);
    const card = document.createElement(url ? 'a' : 'article');
    card.className = 'project-card';
    if (url) { card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer'; }
    const imageUrl = safeUrl(project.imageUrl);
    if (imageUrl) { const image = document.createElement('img'); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; card.append(image); }
    const copy = document.createElement('span');
    copy.className = 'project-copy';
    const title = document.createElement('strong'); title.textContent = project.title;
    const description = document.createElement('small'); description.textContent = project.description || '';
    copy.append(title, description);
    card.append(copy);
    if (url) { const arrow = document.createElement('span'); arrow.className = 'project-arrow'; arrow.textContent = '↗'; card.append(arrow); }
    projectGrid.append(card);
  }
  projectGrid.hidden = !projectGrid.childElementCount;
  const nextParticles = ['snow', 'rain', 'stars'].includes(data.particleStyle) ? data.particleStyle : 'snow';
  if (particleStyle !== nextParticles) { particleStyle = nextParticles; if (snowEnabled) resizeSnow(); }
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
let particleStyle = 'snow';
let flakes = [];
let frame = 0;
function resizeSnow() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  flakes = Array.from({ length: Math.min(particleStyle === 'rain' ? 155 : 110, Math.floor(innerWidth / (particleStyle === 'rain' ? 8 : 12))) }, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    r: Math.random() * 1.9 + 0.7, speed: particleStyle === 'rain' ? Math.random() * 5 + 8 : Math.random() * 1.2 + 0.35,
    drift: Math.random() * 0.8 - 0.4, phase: Math.random() * Math.PI * 2
  }));
}
function drawSnow() {
  if (!snowEnabled) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = particleStyle === 'rain' ? 'rgba(174, 197, 242, .34)' : 'rgba(218, 235, 255, .72)';
  ctx.strokeStyle = 'rgba(174, 197, 242, .34)';
  ctx.lineWidth = 1;
  for (const flake of flakes) {
    ctx.beginPath();
    if (particleStyle === 'rain') { ctx.moveTo(flake.x, flake.y); ctx.lineTo(flake.x - 3, flake.y + 16); ctx.stroke(); }
    else {
      ctx.globalAlpha = particleStyle === 'stars' ? .45 + .45 * Math.sin(performance.now() / 850 + flake.phase) : 1;
      ctx.arc(flake.x, flake.y, particleStyle === 'stars' ? Math.max(.7, flake.r * .75) : flake.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (particleStyle !== 'stars') { flake.y += flake.speed; flake.x += flake.drift; }
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
    const response = await fetch(`${apiUrl}/settings${profileQuery}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    $('api-status').textContent = error.message === 'HTTP 404' ? 'Profile not found.' : 'Connecting to profile…';
    console.error('Profile load failed:', error);
  }
}
let retryDelay = 1000;
function connectLive() {
  const socket = new WebSocket(`${apiUrl.replace(/^http/, 'ws')}/socket${profileQuery}`);
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

$('share-profile').addEventListener('click', async () => {
  const button = $('share-profile');
  try {
    if (navigator.share) await navigator.share({ title: document.title, url: location.href });
    else {
      await navigator.clipboard.writeText(location.href);
      button.querySelector('span').textContent = 'Copied';
      setTimeout(() => { button.querySelector('span').textContent = 'Share'; }, 2200);
    }
  } catch { /* Visitor cancelled sharing or clipboard access was unavailable. */ }
});

$('scroll-more').addEventListener('click', () => $('more-section').scrollIntoView({ behavior: 'smooth' }));
$('back-to-top').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
addEventListener('scroll', () => document.body.classList.toggle('scrolled-more', scrollY > innerHeight * .3), { passive: true });

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
    const response = await fetch(`${apiUrl}/views${profileQuery}`, { method: 'POST', cache: 'no-store' });
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
