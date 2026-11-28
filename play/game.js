/* Bowski Flap, bowski.vercel.app/play/
   The gameplay is Ale's (bowski-flap.vercel.app): gravity, flap, fall cap, speed, pillar spacing,
   gap spread, scoring, the honeycomb pillars and the vector Bowski (kept as the fallback drawing).
   This port adds a fixed timestep, a world that fills any screen, the real Bowski sprite, coins,
   a sleepy start screen, sound toggle, full screen and the $BOWSKI site look. */
(() => {
'use strict';

const SCRIPT = document.currentScript;
const BASE = new URL('.', (SCRIPT && SCRIPT.src) || location.href);
const $ = (id) => document.getElementById(id);
const body = document.body, stage = $('stage'), cv = $('c'), probe = $('probe');
const g = cv.getContext('2d', { alpha: false });

// ---------- Ale's tuning, in his 360 x 640 world units ----------
const GRAV = 1500, FLAP = -430, MAXFALL = 720, SPEED = 150, SPACING = 210, PW = 64;
const BAND = 220;      // spread of gap heights, Ale's 90..310 range
const GROUND_H = 80;   // Ale's ground strip (640 - 560)
// Bowski's real body is taller than Ale's round lad. Hitbox: the egg plus the shorts, legs, arms and
// horns are free. The gap grows by exactly the extra hitbox height so the clearance stays Ale's 132
// units (his 160 gap minus his 28 unit forgiving circle).
const HIT = [{ x: 0, y: 0, r: 14 }, { x: 0.5, y: 26, r: 11 }];
const GAP = 132 + HIT[0].r + HIT[1].y + HIT[1].r; // 183
const STEP = 1 / 120;  // fixed physics step, same speed at 60, 90, 120 and 144 Hz
const COIN_R = 9, COIN_CHANCE = 0.6, MENU_S = 2;

// Sprite frame (241 x 440 reference, any file resolution works). Pivot is the centre of the egg.
const SPR = { w: 241, h: 440, ax: 115, ay: 134, k: 0.188, eyes: [[89.5, 76.2], [122.5, 75.6]] };
// body points (world units from the pivot) used for the ground and the resting pose
const PROBES = [[0, -20], [-14, 0], [14, 0], [-12, 57], [12, 57], [-18, 35], [22, -25]];

// ---------- storage, never trusted to exist ----------
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (_) { /* private mode */ } },
};
const BEST_KEY = 'bowskiFlapBest', SOUND_KEY = 'bowskiFlapSound';
let best = Math.max(0, parseInt(store.get(BEST_KEY), 10) || 0);
let soundOn = store.get(SOUND_KEY) === '1';

// ---------- state ----------
let state = 'menu'; // menu | ready | play | paused | dead
let t = 0, prevT = 0, scroll = 0, prevScroll = 0;
let score = 0, newBest = false, deadAt = 0, overAt = 0, overShown = false, overLive = false, wake = 0, flaps = 0;
const p = { y: 280, py: 280, vy: 0, rot: 0, prot: 0, sq: 0 };
let pipes = [], coins = [], parts = [], pops = [];
let flash = 0, scorePop = 0;

// ---------- layout ----------
let W = 360, H = 640, GROUND = 560, scale = 1, dpr = 1, cssW = 0, cssH = 0, safeTop = 0, px = 100;
const bandMid = () => GROUND / 2;
const playerX = () => Math.round(Math.min(Math.max(100, W * 0.28), 340));

function layout(force) {
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  let d = Math.min(window.devicePixelRatio || 1, 3);
  if (w * h * d * d > 5e6) d = Math.sqrt(5e6 / (w * h)); // cap the buffer on huge screens
  if (!force && w === cssW && h === cssH && Math.abs(d - dpr) < 1e-3) return false;
  const oldMid = bandMid();
  cssW = w; cssH = h; dpr = d;
  scale = Math.min(cssW / 360, cssH / 640); // world is at least Ale's 360 x 640, extra space just shows more
  W = cssW / scale; H = cssH / scale; GROUND = H - GROUND_H;
  cv.width = Math.max(1, Math.round(cssW * dpr));
  cv.height = Math.max(1, Math.round(cssH * dpr));
  safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  // keep Bowski where he was relative to the pipes, which hang off the band's middle
  const dy = bandMid() - oldMid; p.y += dy; p.py += dy;
  if (state === 'menu' || state === 'ready') px = playerX();
  const st = stage.style, mid = bandMid();
  st.setProperty('--gs', scale.toFixed(4));
  st.setProperty('--top', ((mid - 8 - SPR.ay * SPR.k * MENU_S) * scale).toFixed(1) + 'px');
  st.setProperty('--bot', ((mid + 8 + (SPR.h - SPR.ay) * SPR.k * MENU_S) * scale).toFixed(1) + 'px');
  st.setProperty('--rbot', ((mid + 10 + (SPR.h - SPR.ay) * SPR.k) * scale).toFixed(1) + 'px');
  bakeColumn(); bakeSprites(); buildScenery();
  return true;
}

// ---------- scenery ----------
let stars = [], clouds = [], hills = [], skyGrad = null, moonGlow = null, moonBody = null, moon = { x: 0, y: 0, r: 26 };
const rnd = (a, b) => a + Math.random() * (b - a);
function buildScenery() {
  const n = Math.min(170, Math.round(W * GROUND / 3400));
  stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * GROUND * 0.78, r: rnd(0.7, 1.8), ph: rnd(0, 6.3), sp: rnd(0.8, 2.6) }));
  clouds = Array.from({ length: Math.ceil(W / 75) + 1 }, (_, i) => ({ x: i * 75 + rnd(0, 40), y: rnd(40, Math.min(280, GROUND * 0.5)), s: rnd(0.6, 1.3) }));
  hills = Array.from({ length: Math.ceil(W / 70) + 2 }, (_, i) => ({ i, h: rnd(40, 90) }));
  skyGrad = g.createLinearGradient(0, 0, 0, GROUND);
  skyGrad.addColorStop(0, '#14001f'); skyGrad.addColorStop(0.5, '#2d0750');
  skyGrad.addColorStop(0.82, '#5c1478'); skyGrad.addColorStop(1, '#a0287f');
  moon.x = W - Math.max(64, Math.min(120, W * 0.18)); moon.y = Math.max(GROUND * 0.14, 64 / scale + 40);
  moonGlow = g.createRadialGradient(moon.x, moon.y, moon.r * 0.8, moon.x, moon.y, moon.r * 3);
  moonGlow.addColorStop(0, 'rgba(255,196,0,.28)'); moonGlow.addColorStop(1, 'rgba(255,196,0,0)');
  moonBody = g.createRadialGradient(moon.x - 8, moon.y - 8, 2, moon.x, moon.y, moon.r);
  moonBody.addColorStop(0, '#fffbe0'); moonBody.addColorStop(1, '#ffd34d');
}

// Ale's honeycomb pillar, baked once per resize at device resolution
let col = null;
function bakeColumn() {
  const f = scale * dpr, ch = GROUND + 30;
  col = col || document.createElement('canvas');
  col.width = Math.max(1, Math.ceil(PW * f)); col.height = Math.max(1, Math.ceil(ch * f));
  const c = col.getContext('2d');
  c.setTransform(f, 0, 0, f, 0, 0);
  const gr = c.createLinearGradient(0, 0, PW, 0);
  gr.addColorStop(0, '#ffe066'); gr.addColorStop(0.35, '#ffc400'); gr.addColorStop(1, '#d98e00');
  c.fillStyle = gr; c.fillRect(0, 0, PW, ch);
  c.strokeStyle = 'rgba(122,62,0,.36)'; c.lineWidth = 1.5; c.beginPath();
  for (let yy = 8, row = 0; yy < ch; yy += 18, row++) {
    const off = (row % 2) * 11;
    for (let xx = 6 + off; xx < PW - 6; xx += 22) hexPath(c, xx + 5, yy, 7);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,.26)'; c.fillRect(7, 0, 6, ch);
}
function hexPath(c, x, y, r) {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i + Math.PI / 6, X = x + r * Math.cos(a), Y = y + r * Math.sin(a);
    if (i) c.lineTo(X, Y); else c.moveTo(X, Y);
  }
  c.closePath();
}

// ---------- the Bowski sprite ----------
const img = new Image();
let imgReady = false;
img.decoding = 'async';
img.onload = () => { imgReady = true; bakeSprites(); };
img.onerror = () => { imgReady = false; };
img.src = new URL('assets/bowski.webp', BASE).href;

const cache = { awake: null, sleepy: null, menu: null };
function bakeSprites() {
  if (!imgReady || !cssW) return;
  cache.awake = bake(1, false); cache.sleepy = bake(1, true); cache.menu = bake(MENU_S, true);
}
function bake(s, sleepy) {
  const f = SPR.k * s * scale * dpr;
  const w = Math.max(1, Math.round(SPR.w * f)), h = Math.max(1, Math.round(SPR.h * f));
  let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
  while (sw > w * 2 && sh > h * 2) { // halve first for a clean downscale
    const tmp = document.createElement('canvas');
    tmp.width = Math.ceil(sw / 2); tmp.height = Math.ceil(sh / 2);
    const tc = tmp.getContext('2d'); tc.imageSmoothingQuality = 'high';
    tc.drawImage(src, 0, 0, tmp.width, tmp.height);
    src = tmp; sw = tmp.width; sh = tmp.height;
  }
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const c = out.getContext('2d'); c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, w, h);
  if (sleepy) { c.setTransform(w / SPR.w, 0, 0, h / SPR.h, 0, 0); lids(c); }
  return out;
}
// heavy eyelids, drawn over the sprite in its own 241 x 440 frame
function lids(c) {
  c.lineCap = 'round';
  for (const [ex, ey] of SPR.eyes) {
    const gr = c.createLinearGradient(0, ey - 5, 0, ey + 4);
    gr.addColorStop(0, '#d9ba8b'); gr.addColorStop(1, '#bf9d6a');
    c.fillStyle = gr; c.beginPath(); c.ellipse(ex, ey - 0.3, 7.8, 5.1, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(64,36,26,.92)'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(ex, ey + 0.2, 6.6, 2.8, 0, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
  }
}

function drawBowski(x, y, rot, s, sleepy, T) {
  const sqx = 1 - 0.07 * p.sq, sqy = 1 + 0.09 * p.sq;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * sqx, s * sqy);
  const k = SPR.k, dx = -SPR.ax * k, dy = -SPR.ay * k, dw = SPR.w * k, dh = SPR.h * k;
  let c = null;
  if (Math.abs(s - 1) < 1e-3) c = sleepy ? cache.sleepy : cache.awake;
  else if (Math.abs(s - MENU_S) < 1e-3 && sleepy) c = cache.menu;
  if (c) g.drawImage(c, dx, dy, dw, dh);
  else if (imgReady) { g.imageSmoothingQuality = 'high'; g.drawImage(img, dx, dy, dw, dh); }
  else aleBowski(T); // sprite still loading or blocked: Ale's own drawing
  g.restore();
}

// Ale's vector Bowski, unchanged apart from the wiring (pivot moved to the egg's centre)
function aleBowski(T) {
  g.translate(0, 2);
  const sw = Math.sin(T * 22);
  const skin = '#9cbc3a', dark = '#5f7a1c', line = '#3d4f12';
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = skin; g.lineWidth = 4.5;
  g.beginPath(); g.moveTo(-6, 16); g.lineTo(-7, 23); g.moveTo(6, 16); g.lineTo(7, 23); g.stroke();
  g.fillStyle = skin;
  for (const fx of [-7, 7]) { g.beginPath(); g.ellipse(fx, 24, 5, 2.6, 0, 0, 7); g.fill(); }
  g.fillStyle = '#efe6cf';
  for (const fx of [-11, -7, -3, 3, 7, 11]) { g.beginPath(); g.moveTo(fx - 1, 24); g.lineTo(fx + (fx < 0 ? -1 : 1), 27.5); g.lineTo(fx + 1.2, 24.5); g.fill(); }
  g.strokeStyle = dark; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-21, 4 + sw * 6, -19, 12 + sw * 7); g.stroke();
  g.fillStyle = '#b7a68a'; g.strokeStyle = '#6d5f48'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-10, -17); g.lineTo(-13, -25); g.lineTo(-5, -20); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(10, -17); g.lineTo(13, -25); g.lineTo(5, -20); g.closePath(); g.fill(); g.stroke();
  const eg = g.createRadialGradient(-5, -9, 3, 0, -2, 22);
  eg.addColorStop(0, '#b9d655'); eg.addColorStop(1, '#7f9e2a');
  g.fillStyle = eg; g.beginPath(); g.ellipse(0, -2, 15.5, 19.5, 0, 0, 7); g.fill();
  g.strokeStyle = line; g.lineWidth = 2.2; g.stroke();
  g.save(); g.beginPath(); g.ellipse(0, -2, 15.5, 19.5, 0, 0, 7); g.rect(-16, 10, 32, 8); g.clip();
  g.fillStyle = '#4a4d45'; g.fillRect(-17, 7, 34, 11);
  g.fillStyle = '#6e7166'; for (const [cx, cy, rx] of [[-9, 10, 4], [2, 13, 5], [10, 9, 3.5], [-3, 15, 3]]) { g.beginPath(); g.ellipse(cx, cy, rx, 2, 0.3, 0, 7); g.fill(); }
  g.fillStyle = '#2f312b'; for (const [cx, cy, rx] of [[-4, 9, 3], [7, 14, 3.5], [-11, 15, 2.5]]) { g.beginPath(); g.ellipse(cx, cy, rx, 1.6, -0.4, 0, 7); g.fill(); }
  g.restore();
  g.strokeStyle = '#25261f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-14, 7); g.quadraticCurveTo(0, 9, 14, 7); g.stroke();
  g.beginPath(); g.moveTo(0, 9); g.lineTo(0, 16); g.stroke();
  g.fillStyle = 'rgba(214,196,120,.45)'; g.beginPath(); g.ellipse(4, -7, 8.5, 9, 0, 0, 7); g.fill();
  for (const ex of [0, 8]) {
    g.fillStyle = '#f4d9d4'; g.beginPath(); g.ellipse(ex, -11, 3, 2.3, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a32'; g.beginPath(); g.arc(ex + 0.6, -11, 1.4, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(ex + 0.6, -11, 0.7, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(70,60,30,.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(4.5, -6.5, 2, 0.3, Math.PI - 0.3); g.stroke();
  g.fillStyle = '#c97d7d'; g.beginPath(); g.ellipse(4.5, -1.5, 4.5, 3.2, 0, 0, 7); g.fill();
  g.fillStyle = '#4a1f1f'; g.beginPath(); g.ellipse(4.5, -1, 3, 1.9, 0, 0, 7); g.fill();
  g.fillStyle = '#f2ead2'; g.fillRect(2.4, -3, 1.9, 2.2); g.fillRect(4.7, -3, 1.9, 2.2);
  g.strokeStyle = skin; g.lineWidth = 3.8;
  g.beginPath(); g.moveTo(13, -1); g.quadraticCurveTo(22, -4 - sw * 4, 21, -14 - sw * 4); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(21, -15 - sw * 4, 3, 0, 7); g.fill();
  g.lineWidth = 1.8; g.beginPath(); g.moveTo(21, -17 - sw * 4); g.lineTo(23, -21 - sw * 4); g.moveTo(19, -14 - sw * 4); g.lineTo(17, -12 - sw * 4); g.stroke();
}

// ---------- sound: tiny WebAudio blips, off until the player turns it on ----------
let ac = null;
function audioWake() {
  if (!soundOn) return;
  try {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
    if (ac && ac.state === 'suspended') ac.resume();
  } catch (_) { ac = null; }
}
function tone(f, d, type, vol, f2, at) {
  if (!soundOn || !ac || ac.state !== 'running') return;
  try {
    const t0 = ac.currentTime + (at || 0), o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    v.gain.setValueAtTime(vol, t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(v); v.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02);
  } catch (_) { /* audio is a nicety */ }
}
const sfx = {
  flap: () => tone(520, 0.07, 'triangle', 0.06, 700),   // Ale's 520 Hz triangle
  point: () => tone(880, 0.09, 'sine', 0.07),            // Ale's 880 Hz sine
  coin: () => { tone(1320, 0.06, 'square', 0.03); tone(1760, 0.11, 'square', 0.03, 0, 0.06); },
  hit: () => tone(150, 0.28, 'sawtooth', 0.06, 60),      // Ale's 150 Hz sawtooth
  ui: () => tone(660, 0.05, 'square', 0.04),             // Ale's menu blip
};

// ---------- game flow ----------
function resetRun() {
  score = 0; newBest = false; overShown = false; overLive = false; scorePop = 0; flash = 0;
  pipes = []; coins = []; parts = []; pops = [];
  px = playerX();
  p.y = p.py = bandMid(); p.vy = 0; p.rot = p.prot = 0; p.sq = 0;
}
function spawnPipes() {
  let last = pipes[pipes.length - 1];
  let x = last ? last.x + SPACING : scroll + px + 380; // Ale: first pillar 380 ahead of Bowski
  let lag = 0;
  while (x - scroll < W + SPACING) {
    const onScreen = x - scroll < W + 8; // only on wide screens: rise into place instead of popping in
    const q = { x, off: (Math.random() - 0.5) * BAND, passed: false, rise: onScreen ? -lag : 1 };
    if (onScreen) lag += 0.12;
    if (last && Math.random() < COIN_CHANCE) {
      coins.push({ x: last.x + PW / 2 + SPACING / 2, off: (last.off + q.off) / 2, got: false, rise: Math.min(last.rise, q.rise) });
    }
    pipes.push(q); last = q; x += SPACING;
  }
}
function startPlay(fromMenu) {
  if (fromMenu) { const y = p.y; resetRun(); p.y = p.py = y; wake = 1; } // wake up from where he was dozing
  state = 'play';
  spawnPipes();
  flap();
  ui();
}
function flap() {
  p.vy = FLAP; p.sq = 1; flaps++;
  for (let i = 0; i < 4; i++) parts.push({ x: px - 6 + rnd(-6, 6), y: p.y + 30, vx: rnd(-90, -40), vy: rnd(10, 60), life: 0.35, max: 0.35, r: rnd(2, 3.6), c: 'rgba(255,255,255,' });
  sfx.flap();
}
function addScore(n) { score += n; scorePop = 1; }
function goReady() { resetRun(); state = 'ready'; ui(); sfx.ui(); }
function pause() { if (state === 'play') { state = 'paused'; ui(); } }
function die() {
  state = 'dead'; deadAt = t; flash = 1; sfx.hit();
  for (let i = 0; i < 12; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(60, 190);
    parts.push({ x: px, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6, max: 0.6, r: rnd(2, 4), c: i % 2 ? 'rgba(255,43,214,' : 'rgba(182,255,0,' });
  }
  if (score > best) { best = score; newBest = true; store.set(BEST_KEY, best); }
  try { if (navigator.vibrate) navigator.vibrate(25); } catch (_) { /* not on iPhone */ }
  ui();
}
function showOver() {
  overShown = true; overAt = t;
  $('sc').textContent = score; $('bs').textContent = best;
  $('bestLabel').textContent = newBest ? 'new best!' : 'best';
  $('bestBox').classList.toggle('nb', newBest);
  $('msg').textContent = score >= 40 ? 'absolute legend' : score >= 20 ? 'sound work' : score >= 10 ? 'not bad lad' : 'unlucky bro';
  const text = `i got ${score} on bowski flap 🍐 $BOWSKI`;
  $('share').href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent('https://bowski.vercel.app/play/');
  ui();
}
function ui() {
  $('start').classList.toggle('on', state === 'menu');
  $('ready').classList.toggle('on', state === 'ready');
  $('paused').classList.toggle('on', state === 'paused');
  $('over').classList.toggle('on', state === 'dead' && overShown);
  if (!(state === 'dead' && overShown)) $('over').classList.remove('live');
  body.classList.toggle('playing', state === 'play' || (state === 'dead' && !overShown));
  $('bestStart').textContent = best;
}

// ---------- physics ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function circleRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}
function hitCircles() {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return HIT.map((h) => ({ x: px + h.x * c - h.y * s, y: p.y + h.x * s + h.y * c, r: h.r }));
}
function lowest(rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  let m = -1e9;
  for (const [x, y] of PROBES) m = Math.max(m, x * s + y * c);
  return m;
}
function update(dt) {
  prevT = t; prevScroll = scroll; p.py = p.y; p.prot = p.rot;
  t += dt;
  if (state === 'paused') return;
  if (state !== 'dead') scroll += SPEED * dt;
  if (flash > 0) flash = Math.max(0, flash - dt * 3);
  if (scorePop > 0) scorePop = Math.max(0, scorePop - dt * 6);
  if (p.sq > 0) p.sq = Math.max(0, p.sq - dt * 6);
  if (wake > 0) wake = Math.max(0, wake - dt * 4);
  for (const q of pipes) if (q.rise < 1) q.rise = Math.min(1, q.rise + dt / 0.45);
  for (const c of coins) if (c.rise < 1) c.rise = Math.min(1, c.rise + dt / 0.45);
  stepParts(dt);

  if (state === 'menu') { p.y = bandMid() + Math.sin(t * 2) * 8; p.rot = -0.06 + Math.sin(t * 1.3) * 0.05; p.vy = 0; return; }
  if (state === 'ready') { p.y = bandMid() + Math.sin(t * 3) * 10; p.rot = 0; p.vy = 0; return; }

  p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);
  p.y += p.vy * dt;

  if (state === 'dead') {
    p.rot += (1.35 - p.rot) * Math.min(1, dt * 6);
    const low = lowest(p.rot);
    if (p.y + low >= GROUND) { p.y = GROUND - low; p.vy = 0; }
    if (!overShown && t - deadAt > 0.65) showOver();
    if (overShown && !overLive && t - overAt > 0.45) { overLive = true; $('over').classList.add('live'); }
    return;
  }

  p.rot = clamp(p.vy / 600, -0.45, 1.3); // Ale's tilt

  for (const q of pipes) {
    if (!q.passed && q.x - scroll + PW < px) { q.passed = true; addScore(1); sfx.point(); }
  }
  while (pipes.length && pipes[0].x - scroll < -PW - 20) pipes.shift();
  spawnPipes();

  const hc = hitCircles(), mid = bandMid();
  for (const c of coins) {
    if (c.got || c.rise < 1) continue;
    const cx = c.x - scroll, cy = mid + c.off;
    for (const h of hc) {
      const rr = h.r + COIN_R + 4;
      if ((h.x - cx) * (h.x - cx) + (h.y - cy) * (h.y - cy) < rr * rr) {
        c.got = true; addScore(1); sfx.coin();
        pops.push({ x: cx, y: cy, life: 0.7 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          parts.push({ x: cx, y: cy, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 0.4, max: 0.4, r: 2.4, c: 'rgba(255,196,0,' });
        }
        break;
      }
    }
  }
  coins = coins.filter((c) => !c.got && c.x - scroll > -40);

  if (p.y + lowest(p.rot) >= GROUND || p.y - 20 < -40) return die();
  for (const q of pipes) {
    const x = q.x - scroll;
    if (q.rise < 1 || x > px + 60 || x + PW < px - 60) continue;
    const gc = mid + q.off, top = gc - GAP / 2, bot = gc + GAP / 2;
    for (const h of hc) {
      if (circleRect(h.x, h.y, h.r, x, -100, PW, top + 100) || circleRect(h.x, h.y, h.r, x, bot, PW, GROUND)) return die();
    }
  }
}
function stepParts(dt) {
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * dt; q.life -= dt; }
  if (parts.length) parts = parts.filter((q) => q.life > 0);
  for (const q of pops) { q.y -= 50 * dt; q.life -= dt; }
  if (pops.length) pops = pops.filter((q) => q.life > 0);
  if (parts.length > 90) parts.splice(0, parts.length - 90);
}

// ---------- drawing ----------
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
function rr(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function text(s, x, y, size, fill, shadow) {
  g.font = `${Math.round(size)}px Bungee, Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (shadow) { g.fillStyle = shadow; g.fillText(s, x + size * 0.06, y + size * 0.06); }
  g.lineWidth = size / 5; g.strokeStyle = '#14001f'; g.strokeText(s, x, y);
  g.fillStyle = fill; g.fillText(s, x, y);
}
function drawSky(T, S) {
  g.fillStyle = skyGrad; g.fillRect(0, 0, W, GROUND);
  g.fillStyle = '#fff';
  for (const s of stars) {
    g.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(T * s.sp + s.ph));
    let x = (s.x - S * 0.02) % W; if (x < 0) x += W;
    g.fillRect(x, s.y, s.r, s.r);
  }
  g.globalAlpha = 1;
  g.fillStyle = moonGlow; g.fillRect(moon.x - moon.r * 3, moon.y - moon.r * 3, moon.r * 6, moon.r * 6);
  g.fillStyle = moonBody; g.beginPath(); g.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(214,150,0,.28)';
  for (const [cx, cy, r] of [[-8, 4, 5], [7, -7, 3.5], [9, 9, 2.6], [-3, -11, 2.2]]) { g.beginPath(); g.arc(moon.x + cx, moon.y + cy, r, 0, Math.PI * 2); g.fill(); }
  // Ale's clouds, drifting on their own clock
  g.fillStyle = 'rgba(200,130,255,.2)';
  const span = W + 140;
  for (const c of clouds) {
    let x = (c.x - T * 12 * c.s) % span; if (x < 0) x += span; x -= 70;
    g.beginPath(); g.ellipse(x, c.y, 26 * c.s, 12 * c.s, 0, 0, 7); g.ellipse(x + 18 * c.s, c.y - 7 * c.s, 18 * c.s, 12 * c.s, 0, 0, 7); g.fill();
  }
  // Ale's hills at a fifth of the ground speed
  g.fillStyle = '#2b0a48';
  const hs = hills.length * 70, ho = (S * 0.2) % hs;
  for (const h of hills) {
    let x = h.i * 70 - ho; if (x < -70) x += hs;
    g.beginPath(); g.ellipse(x + 35, GROUND, 50, h.h, 0, Math.PI, 0); g.fill();
  }
}
function drawGround(S) {
  g.fillStyle = '#22063a'; g.fillRect(0, GROUND, W, H - GROUND);
  g.fillStyle = '#14001f'; g.fillRect(0, GROUND - 1, W, 2);
  g.fillStyle = '#b6ff00'; g.fillRect(0, GROUND + 1, W, 11);
  g.fillStyle = '#76a800'; g.fillRect(0, GROUND + 12, W, 4);
  g.fillStyle = 'rgba(182,255,0,.16)';
  for (let x = -(S % 24); x < W; x += 24) g.fillRect(x, GROUND + 20, 12, 6);
}
function drawPipe(q, S) {
  const x = q.x - S;
  if (x > W + 10 || x + PW < -10) return;
  const gc = bandMid() + q.off, top = gc - GAP / 2, bot = gc + GAP / 2;
  const e = q.rise >= 1 ? 1 : easeOut(Math.max(0, q.rise));
  seg(x, -10 - (1 - e) * (top + 40), top + 10, true);
  seg(x, bot + (1 - e) * (GROUND - bot + 40), GROUND - bot + 12, false);
}
function seg(x, y, h, isTop) {
  if (h <= 0) return;
  const f = scale * dpr, sh = Math.min(col.height, Math.max(1, Math.round(h * f)));
  g.drawImage(col, 0, isTop ? col.height - sh : 0, col.width, sh, x, y, PW, h);
  g.lineWidth = 3; g.strokeStyle = '#14001f'; g.strokeRect(x, y, PW, h);
  const cy = isTop ? y + h - 18 : y;
  g.fillStyle = '#ffe27a'; rr(x - 5, cy, PW + 10, 18, 5); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 1, cy + 4, 8, 4);
}
function drawCoin(c, S, T) {
  const x = c.x - S;
  if (x > W + 20 || x < -20) return;
  const e = c.rise >= 1 ? 1 : easeOut(Math.max(0, c.rise));
  const y = bandMid() + c.off, sx = Math.max(0.18, Math.abs(Math.cos(T * 4 + c.x * 0.01)));
  g.globalAlpha = e;
  const halo = g.createRadialGradient(x, y, COIN_R * 0.6, x, y, COIN_R + 9);
  halo.addColorStop(0, 'rgba(255,200,40,.55)'); halo.addColorStop(1, 'rgba(255,200,40,0)');
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = halo; g.fillRect(x - COIN_R - 9, y - COIN_R - 9, (COIN_R + 9) * 2, (COIN_R + 9) * 2);
  g.globalCompositeOperation = 'source-over';
  g.save(); g.translate(x, y); g.scale(sx, 1);
  g.fillStyle = '#ffc400'; g.strokeStyle = '#14001f'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, COIN_R, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#b37800'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, COIN_R - 3.2, 0, Math.PI * 2); g.stroke();
  if (sx > 0.45) { g.fillStyle = '#7a4a00'; g.font = '10px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', 0, 0.5); }
  g.restore();
  g.globalAlpha = 1;
}
function drawZzz(x, y, s, T) {
  for (let i = 0; i < 3; i++) {
    const ph = (T * 0.5 + i / 3) % 1, a = Math.sin(ph * Math.PI);
    const size = (7 + ph * 9) * s;
    g.globalAlpha = a;
    // drift up and away from the head, on the side without the shaka hand
    text('z', x - (12 + ph * 34) * s, y - (20 + ph * 26) * s, size, i === 1 ? '#b6ff00' : '#ffffff');
  }
  g.globalAlpha = 1;
}
function render(alpha) {
  const T = prevT + (t - prevT) * alpha;
  const S = prevScroll + (scroll - prevScroll) * alpha;
  const y = p.py + (p.y - p.py) * alpha, rot = p.prot + (p.rot - p.prot) * alpha;
  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  drawSky(T, S);
  for (const q of pipes) drawPipe(q, S);
  for (const c of coins) drawCoin(c, S, T);
  drawGround(S);

  if (state === 'menu') {
    drawBowski(W / 2, y, rot, MENU_S, true, T);
    drawZzz(W / 2, y, MENU_S, T);
  } else {
    const k = wake * wake, x = px + (W / 2 - px) * k, s = 1 + (MENU_S - 1) * k;
    drawBowski(x, y, rot, s, state === 'dead', T);
  }

  g.globalCompositeOperation = 'lighter'; // sparkles brighten the night sky instead of muddying it
  for (const q of parts) {
    g.fillStyle = q.c + (q.life / q.max).toFixed(3) + ')';
    g.beginPath(); g.arc(q.x, q.y, q.r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  for (const q of pops) { g.globalAlpha = Math.min(1, q.life * 5); text('+1', q.x, q.y - 16, 20, '#ffe27a'); }
  g.globalAlpha = 1;

  if (state === 'play' || state === 'ready' || state === 'paused' || (state === 'dead' && !overShown)) {
    text(String(score), W / 2, safeTop / scale + 86, 56 * (1 + scorePop * 0.22), '#ffffff', '#ff2bd6');
  }
  if (flash > 0) { g.fillStyle = `rgba(255,255,255,${(flash * 0.85).toFixed(3)})`; g.fillRect(0, 0, W, H); }
}

// ---------- loop: fixed step, interpolated draw ----------
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0;
  if (dt > 0.1) dt = 0.1; // back from a hidden tab or a long stall
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 12) { update(STEP); acc -= STEP; n++; }
  if (acc >= STEP) acc = 0;
  render(acc / STEP);
  requestAnimationFrame(frame);
}

// ---------- input ----------
let lastAct = -1e9;
function act() {
  const now = performance.now();
  if (now - lastAct < 45) return; // one physical tap is one flap, never two
  lastAct = now;
  audioWake();
  if (state === 'menu') startPlay(true);
  else if (state === 'ready' || state === 'paused') startPlay(false);
  else if (state === 'play') flap();
}
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('a,button,#over .card')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.cancelable) e.preventDefault();
  act();
}, { passive: false });
window.addEventListener('keydown', (e) => {
  const k = e.code;
  const onControl = e.target && e.target.closest && e.target.closest('a,button');
  if (k === 'Space' || k === 'ArrowUp' || (k === 'Enter' && !onControl)) {
    e.preventDefault();
    if (e.repeat) return;
    if (state === 'dead') { if (overLive) goReady(); return; }
    act();
  } else if (k === 'KeyM' && !e.repeat) toggleSound();
  else if (k === 'KeyF' && !e.repeat) toggleFs();
  else if ((k === 'KeyP' || k === 'Escape') && state === 'play') pause();
});
$('again').addEventListener('click', (e) => { e.currentTarget.blur(); goReady(); });
// stop every browser gesture: no scroll, no rubber band, no pinch, no double-tap zoom, no callout
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- sound toggle ----------
const sndBtn = $('snd');
function syncSnd() { sndBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); sndBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off'); }
function toggleSound() { soundOn = !soundOn; store.set(SOUND_KEY, soundOn ? '1' : '0'); syncSnd(); audioWake(); sfx.ui(); }
sndBtn.addEventListener('click', (e) => { e.currentTarget.blur(); toggleSound(); });
syncSnd();

// ---------- full screen, where the browser has it (not iPhone Safari) ----------
const root = document.documentElement, fsBtn = $('fs');
const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen);
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFs() {
  if (!fsOK) return;
  try {
    const r = isFs()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
    if (r && r.catch) r.catch(() => {});
  } catch (_) { /* refused, carry on windowed */ }
}
function syncFs() { body.classList.toggle('fs', isFs()); fsBtn.setAttribute('aria-label', isFs() ? 'Exit full screen' : 'Full screen'); }
if (fsOK) fsBtn.hidden = false;
fsBtn.addEventListener('click', (e) => { e.currentTarget.blur(); toggleFs(); });
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

// ---------- resize, rotate, hide ----------
function onResize() { if (layout(false) && state === 'play') pause(); }
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('pagehide', pause);

// ---------- boot ----------
if (document.fonts && document.fonts.load) document.fonts.load('56px Bungee').catch(() => {});
layout(true);
resetRun();
ui();
requestAnimationFrame((now) => { last = now; requestAnimationFrame(frame); });

// read-only handle for testing, like Ale's window.__game
window.__flap = Object.freeze({
  get state() { return state; }, get score() { return score; }, get best() { return best; },
  get flaps() { return flaps; }, get y() { return p.y; }, get vy() { return p.vy; }, get px() { return px; },
  get world() { return { W, H, GROUND, scale, dpr }; },
  get pipes() { const m = bandMid(); return pipes.map((q) => ({ x: q.x - scroll, gap: m + q.off, passed: q.passed })); },
  get coins() { const m = bandMid(); return coins.map((c) => ({ x: c.x - scroll, y: m + c.off })); },
  GAP, PW,
});
})();
