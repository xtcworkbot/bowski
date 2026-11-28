// ===== THE CONTRACT ADDRESS =====
const CA = "84Ciai5YhpxxYiLE55SJqGHY3jftEtVxvcBXMwyapump";
// ================================

const $ = (id) => document.getElementById(id);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HAVE = new Set((document.body.dataset.have || "").split(/\s+/).filter(Boolean));
const BEE_DAY = Date.UTC(2026, 9, 30, 13, 0, 0); // 31/10 00:00 AEDT, halloween in sydney
const store = {
  get(k, d = 0) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const isAwake = () => document.documentElement.classList.contains("awake");

// ---------- generated art: fall back to our own posted art if a file is missing ----------
$$("img[data-fb]").forEach((img) => {
  const fb = () => { if (img.dataset.fb && !img.src.endsWith(img.dataset.fb)) img.src = img.dataset.fb; };
  img.addEventListener("error", fb, { once: true });
  if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fb();
});

// ---------- toast + bursts ----------
function toast(msg, ms = 1600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("on"), ms);
}
const EMO = ["🌕", "🚀", "🍐", "😴", "💤", "🤫", "🪙", "✨"];
function burst(x, y, n = 10, set = EMO) {
  if (REDUCE) n = Math.min(n, 3);
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "pop";
    s.textContent = set[(Math.random() * set.length) | 0];
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 160;
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(a) * d + "px");
    s.style.setProperty("--dy", Math.sin(a) * d - 60 + "px");
    s.style.setProperty("--rot", Math.random() * 720 - 360 + "deg");
    s.style.fontSize = 20 + Math.random() * 26 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}
function flash() {
  const f = $("flash");
  f.classList.add("on");
  setTimeout(() => f.classList.remove("on"), 120);
}
function glitch() {
  const t = $("title");
  t.classList.remove("glitch"); void t.offsetWidth; t.classList.add("glitch");
}

// ---------- copy the CA ----------
async function copyCA(e) {
  let ok = false;
  try { await navigator.clipboard.writeText(CA); ok = true; } catch (err) {}
  if (!ok) {
    const ta = document.createElement("textarea");
    ta.value = CA; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand("copy"); } catch (err) {}
    ta.remove();
  }
  toast(ok ? "CA COPIED 🤫" : "HOLD TO COPY");
  if (ok) burst(e && e.clientX ? e.clientX : innerWidth / 2, e && e.clientY ? e.clientY : innerHeight / 2, 14);
}
$$(".js-copy").forEach((el) => el.addEventListener("click", copyCA));

// ---------- live numbers ----------
// polled every 20s from /api/stats (edge cache 15s). a number that could not be refreshed keeps its last good value,
// dimmed. never blanked, never guessed. a new buy flashes green.
const POLL_MS = 20000, RETRY_MS = 6000, STALE_MS = 150000;
const SRC = {
  dexscreener: ["marketCap", "priceUsd", "volume24h", "buys5m", "sells5m", "buys1h", "sells1h", "buys24h", "sells24h"],
  telegram: ["tgMembers", "tgOnline"],
};
const SRC_AT = { dexscreener: "dexAt", telegram: "tgAt" };
const fmtUsd = (v) => {
  if (v === null || v === undefined) return "—";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + "K";
  return "$" + Math.round(v);
};
const fmtInt = (v) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-US"));
const fmt = (el, v) => (el.dataset.fmt === "usd" ? fmtUsd(v) : fmtInt(v));
const good = {}, goodAt = {}, fresh = {}; // last good value, when it was read upstream (server clock), refreshed by the newest answer
let skew = 0, failing = false, tried = false, lastPoll = 0, polling = false, pollT = 0;
const nowS = () => Date.now() + skew; // the server's clock, so "12s ago" holds even when the phone's clock is off
const isStale = (k) => good[k] === undefined || failing || !fresh[k] || nowS() - goodAt[k] > STALE_MS;
const shown = new WeakMap(), tok = new WeakMap();

function countTo(el, to) {
  const from = shown.has(el) ? shown.get(el) : 0;
  const my = (tok.get(el) || 0) + 1;
  tok.set(el, my);
  if (to === null || to === undefined) { el.textContent = "—"; return; }
  if (REDUCE || from === to || el.closest(".marquee")) { shown.set(el, to); el.textContent = fmt(el, to); return; }
  const t0 = performance.now(), dur = from === 0 ? 1400 : 900;
  const step = (now) => {
    if (tok.get(el) !== my) return; // a newer number took over
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const v = k < 1 ? from + (to - from) * e : to;
    shown.set(el, v);
    el.textContent = fmt(el, v);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function kick(el, cls, ms, clear = [cls]) {
  if (!el) return;
  el.classList.remove(...clear);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el["_t_" + cls]);
  el["_t_" + cls] = setTimeout(() => el.classList.remove(cls), ms);
}

const seenOnce = new WeakSet();
const countIO = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
  for (const en of ents) if (en.isIntersecting) {
    seenOnce.add(en.target);
    countIO.unobserve(en.target);
    if (good[en.target.dataset.k] !== undefined) countTo(en.target, good[en.target.dataset.k]);
  }
}, { threshold: 0.3 }) : null;
$$("[data-k]").forEach((el) => countIO && countIO.observe(el));

function paintStale() {
  for (const el of $$("[data-k]")) {
    const k = el.dataset.k;
    const st = good[k] !== undefined && isStale(k);
    el.classList.toggle("stale", st);
    if (st) el.title = "last good number. the source is napping, retrying"; else el.removeAttribute("title");
  }
}
function paintNumbers(prev) {
  for (const el of $$("[data-k]")) {
    const k = el.dataset.k;
    if (good[k] === undefined) { if (tried) el.textContent = "—"; continue; }
    if (countIO && !seenOnce.has(el) && !el.closest(".marquee")) continue; // counts up when it scrolls in
    countTo(el, good[k]);
    if (prev[k] !== undefined && prev[k] !== good[k] && !el.closest(".marquee")) {
      kick(el, "bump", 600);
      if (k === "marketCap") kick(el, good[k] > prev[k] ? "up" : "down", 2400, ["up", "down"]);
    }
  }
  paintStale();
}
// a new buy: any of the rolling buy counts went up between two fresh reads (a floor, never an overcount)
function newBuys(prev) {
  const ks = ["buys5m", "buys1h", "buys24h"];
  if (!ks.every((k) => prev[k] !== undefined && good[k] !== undefined && fresh[k])) return 0;
  return Math.max(0, ...ks.map((k) => good[k] - prev[k]));
}
function buyFlash(n) {
  for (const el of $$('[data-k="buys1h"]')) {
    if (el.closest(".marquee")) continue;
    kick(el.closest(".ctr") || el.closest(".buys"), "buy-flash", 1500);
  }
  const mc = document.querySelector(".mc-big");
  kick(mc, "buy-flash", 1500);
  const ping = $("buyPing");
  ping.textContent = n > 1 ? `+${n} NEW BUYS 🟢` : "+1 NEW BUY 🟢";
  kick(ping, "on", 2700);
  const r = mc.getBoundingClientRect();
  if (isAwake() && !document.hidden && r.bottom > 60 && r.top < innerHeight) burst(r.right - 50, r.top + 6, 4, ["🟢", "🍐", "🚀", "🌕"]);
}

async function loadStats() {
  if (polling) return null;
  polling = true;
  lastPoll = Date.now();
  const ctl = "AbortController" in window ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), 9000);
  let ok = false;
  try {
    const r = await fetch("/api/stats", { headers: { accept: "application/json" }, cache: "no-store", signal: ctl ? ctl.signal : undefined });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d || !d.ok) throw new Error("no data");
    const hd = Date.parse(r.headers.get("date") || "");
    if (hd) skew = hd + (Number(r.headers.get("age")) || 0) * 1000 - Date.now();
    const prev = { ...good }, src = d.sources || {};
    for (const [name, keys] of Object.entries(SRC)) {
      const live = !!src[name];
      const at = Date.parse(d[SRC_AT[name]] || d.updated) || 0;
      for (const k of keys) {
        const v = d[k];
        if (!live) fresh[k] = false;
        if (typeof v !== "number" || !isFinite(v) || v < 0) { fresh[k] = false; continue; }
        // an older cached answer, or a failed source with nothing newer than what we hold: keep our number
        if (good[k] !== undefined && (at < goodAt[k] || (!live && at <= goodAt[k]))) continue;
        good[k] = v;
        goodAt[k] = at;
        if (live) fresh[k] = true;
      }
    }
    failing = false;
    ok = true;
    paintNumbers(prev);
    const n = newBuys(prev);
    if (n > 0) buyFlash(n);
    if (!isStale("marketCap")) $$(".mc-big .dot, .top-mc .dot, .ctr .dot").forEach((dt) => kick(dt, "beat", 950));
  } catch (e) {
    failing = true;
  } finally {
    clearTimeout(t);
    polling = false;
    tried = true;
    if (!ok) paintNumbers(good);
    tickAgo();
  }
  return ok;
}
const agoTxt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 3 ? "just now" : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} hr ago`;
};
function tickAgo() {
  paintStale();
  if (!tried) return;
  const dexOld = isStale("marketCap"), tgOld = isStale("tgMembers");
  for (const el of $$("[data-ago]")) {
    const short = el.dataset.ago === "short";
    if (good.marketCap === undefined && good.tgMembers === undefined) {
      el.textContent = short ? "napping 😴" : "live numbers are napping. back in a sec 😴";
      continue;
    }
    if (short) {
      el.textContent = good.marketCap === undefined ? "napping 😴" : (dexOld ? "paused · " : "updated ") + agoTxt(nowS() - goodAt.marketCap);
      continue;
    }
    const newest = Math.max(dexOld ? 0 : goodAt.marketCap || 0, tgOld ? 0 : goodAt.tgMembers || 0);
    if (!newest) { // both sources down: say so, show how old the numbers on screen are
      el.textContent = `napping 😴 last good numbers ${agoTxt(nowS() - Math.max(goodAt.marketCap || 0, goodAt.tgMembers || 0))}. retrying`;
      continue;
    }
    const parts = ["updated " + agoTxt(nowS() - newest)];
    if (dexOld && good.marketCap !== undefined) parts.push(`dexscreener napping 😴 last good ${agoTxt(nowS() - goodAt.marketCap)}`);
    if (tgOld && good.tgMembers !== undefined) parts.push(`telegram napping 😴 last good ${agoTxt(nowS() - goodAt.tgMembers)}`);
    el.textContent = parts.join(" · ");
  }
}
function schedule(ms) { clearTimeout(pollT); pollT = setTimeout(poll, ms); }
async function poll() {
  if (document.hidden) { schedule(POLL_MS); return; }
  const ok = await loadStats();
  if (ok !== null) schedule(ok ? POLL_MS : RETRY_MS);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastPoll > POLL_MS - 3000) schedule(0); });
poll();
setInterval(tickAgo, 1000);

// ---------- marquees ----------
const mq1 = ["$BOWSKI", '<b data-k="tgMembers">…</b> gang in the telegram', "🌕", 'MC <b data-k="marketCap" data-fmt="usd">…</b>', '<b data-k="buys1h">…</b> buys last hour', "only from @binobowski_", "anything else is fake 🤫", "🚀", "just hanin aroun"];
const mq2 = ["WAKE HIM UP", "he won't", "😴", "$BOWSKI", "pear? yes", "🍐", "we raid every post ⚔️", "camo shorts forever", "🌕🚀"];
function fillMarquee(el, words) {
  const html = words.map((w) => `<span>${w}</span>`).join("");
  el.innerHTML = html + html + html + html;
}
fillMarquee($("mq1"), mq1);
fillMarquee($("mq2"), mq2);

// ---------- the wall: double each row so it loops forever ----------
$$("#wallRows .track").forEach((t) => {
  const clone = t.innerHTML;
  t.insertAdjacentHTML("beforeend", clone);
  $$("figure", t).slice(t.children.length / 2).forEach((f) => f.setAttribute("aria-hidden", "true"));
});

// ---------- videos play only while on screen. sound is off unless you turn it on ----------
let soundOn = store.get("bowski_sound", "0") === "1";
const vis = new Map();
function pickLoud() {
  let best = null, r = 0.55;
  for (const [v, ratio] of vis) if (ratio > r && !v.paused) { best = v; r = ratio; }
  for (const v of $$("video.autoplay")) {
    const want = !(soundOn && v === best);
    if (v.muted !== want) {
      v.muted = want;
      if (!want) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    }
  }
}
const vidIO = new IntersectionObserver((ents) => {
  for (const en of ents) {
    const v = en.target;
    if (en.isIntersecting) {
      vis.set(v, en.intersectionRatio);
      if (v.preload === "none") v.preload = "auto";
      if (!REDUCE && v.paused) v.play().then(pickLoud).catch(() => {});
    } else {
      vis.delete(v);
      if (!v.paused) v.pause();
    }
  }
  pickLoud();
}, { threshold: [0, 0.25, 0.6, 0.9] });
$$("video.autoplay").forEach((v) => vidIO.observe(v));

const sndBtn = $("sndBtn");
function setSound(on) {
  soundOn = on;
  store.set("bowski_sound", on ? 1 : 0);
  sndBtn.textContent = on ? "🔊" : "🔇";
  sndBtn.setAttribute("aria-pressed", on ? "true" : "false");
  sndBtn.setAttribute("aria-label", on ? "sound on. tap to mute" : "sound off. tap for sound");
  pickLoud();
}
sndBtn.addEventListener("click", () => { setSound(!soundOn); toast(soundOn ? "SOUND ON 🔊 scroll to a reel" : "SHHH 🔇"); });
setSound(soundOn);

// ---------- scroll reveals ----------
const revIO = new IntersectionObserver((ents) => {
  for (const en of ents) if (en.isIntersecting) { en.target.classList.add("in"); revIO.unobserve(en.target); }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
$$(".reveal").forEach((el) => revIO.observe(el));

// ---------- his story, pinned to the scroll ----------
const story = $("story");
const scenes = $$(".scene", story), caps = $$(".cap", story), dots = $$(".story-dots i", story);
scenes.forEach((s, i) => {
  const img = $$("img", s)[0];
  const vid = img && img.dataset.vid;
  if (vid && HAVE.has(vid.split("/").pop())) {
    const v = document.createElement("video");
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: "none", poster: img.getAttribute("src") });
    v.className = "autoplay";
    v.setAttribute("aria-label", img.alt);
    v.src = vid;
    img.replaceWith(v);
    vidIO.observe(v);
  }
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
if (REDUCE) caps.forEach((c, i) => scenes[i] && scenes[i].appendChild(c)); // no pinning: each caption sits under its picture
let storyOn = false;
function storyFrame() {
  if (REDUCE) return;
  const r = story.getBoundingClientRect();
  const span = r.height - innerHeight;
  if (r.bottom < -50 || r.top > innerHeight + 50) return;
  const N = scenes.length;
  const p = clamp(-r.top / span, 0, 1) * (N - 1) * 1.08; // a little hold on the last scene
  scenes.forEach((s, i) => {
    const e = i === 0 ? 1 : clamp(p - (i - 1), 0, 1); // how far this card has dealt in
    const d = clamp(p - i, 0, 1); // how far it has been covered
    const ease = 1 - Math.pow(1 - e, 3);
    const y = (1 - ease) * innerHeight * 1.05, rot = (1 - ease) * (i % 2 ? 9 : -9) - d * (i % 2 ? -3 : 3);
    s.style.transform = `translate3d(0,${y}px,0) rotate(${rot}deg) scale(${1 - d * 0.07})`;
    s.style.visibility = e <= 0 ? "hidden" : "visible";
    s.style.filter = d > 0.01 ? `brightness(${1 - d * 0.45})` : "";
    s.style.zIndex = String(i + 1);
    const m = s.querySelector("img,video");
    if (m) m.style.setProperty("--z", String(1.12 - ease * 0.08 + d * 0.04));
  });
  const cur = Math.round(clamp(p, 0, N - 1));
  caps.forEach((c, i) => {
    const o = clamp(1 - Math.abs(p - i) * 2.4, 0, 1);
    c.style.opacity = String(o);
    c.style.transform = `translateY(${(1 - o) * (p > i ? -24 : 24)}px)`;
  });
  dots.forEach((d, i) => d.classList.toggle("on", i <= cur));
}
if (!REDUCE) {
  // the first card sits ready, the rest wait under the fold
  storyFrame();
  addEventListener("scroll", () => { if (!storyOn) { storyOn = true; requestAnimationFrame(() => { storyOn = false; storyFrame(); }); } }, { passive: true });
  addEventListener("resize", storyFrame);
  // load the scene art a screen before it is needed
  new IntersectionObserver((ents, io) => {
    if (ents.some((e) => e.isIntersecting)) { $$("img", story).forEach((im) => (im.loading = "eager")); io.disconnect(); }
  }, { rootMargin: "100% 0px" }).observe(story);
}

// ---------- nap level: poke him, he drifts back off ----------
let taps = Number(store.get("bowski_taps")) || 0, woken = Number(store.get("bowski_woken")) || 0, nap = 100, awakeUntil = 0;
$("taps").textContent = taps;
$("woken").textContent = woken;
const MOODS = [[100, "fast asleep 😴"], [80, "one eye open 👁️"], [55, "mildly bothered 😑"], [30, "ALMOST AWAKE ⚡"], [10, "WAIT WAIT WAIT 😳"]];
function setMood() {
  if (Date.now() < awakeUntil) return;
  let m = MOODS[0][1];
  for (const [v, t] of MOODS) if (nap <= v) m = t;
  $("mood").textContent = m;
  $("napPct").textContent = Math.round(nap) + "%";
  $("napBar").style.width = nap + "%";
}
function poke(x, y) {
  taps++;
  $("taps").textContent = taps;
  store.set("bowski_taps", taps);
  if (Date.now() < awakeUntil) { burst(x, y, 4); return; }
  nap = Math.max(0, nap - 8);
  burst(x, y, 5, ["👉", "😑", "💤", "🍐"]);
  boost(1.2);
  if (nap <= 0) {
    woken++;
    $("woken").textContent = woken;
    store.set("bowski_woken", woken);
    awakeUntil = Date.now() + 2600;
    $("mood").textContent = "HE'S AWAKE 🌕🚀";
    $("napPct").textContent = "0%";
    glitch(); flash();
    document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 320);
    for (let i = 0; i < 4; i++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * 0.8 + 40, 14), i * 140);
    boost(10);
    setTimeout(() => { nap = 100; $("mood").textContent = "...he went back to sleep 😴"; $("napPct").textContent = "100%"; $("napBar").style.width = "100%"; }, 2600);
    setTimeout(setMood, 4200);
    return;
  }
  setMood();
}
$("wakeBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); poke(e.clientX, e.clientY); });
$("wakeBtn").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const r = e.target.getBoundingClientRect(); poke(r.x + r.width / 2, r.y); } });
setInterval(() => {
  if (Date.now() < awakeUntil || nap >= 100) return;
  nap = Math.min(100, nap + 1.6);
  setMood();
}, 100);
setMood();

// ---------- easter egg: tap bowski 10 times and he goes back to sleep ----------
let boops = 0, boopT = 0;
const BOOP = { 3: "he felt that", 6: "stop it 😑", 8: "bro", 9: "one more and he's out" };
function boop(x, y) {
  if (!isAwake()) return;
  if (Date.now() - boopT > 6000) boops = 0;
  boopT = Date.now();
  boops++;
  burst(x, y, 6, ["😑", "💤", "🍐", "👆"]);
  bounce();
  if (BOOP[boops]) toast(BOOP[boops], 1200);
  if (boops >= 10) {
    boops = 0;
    toast("ok thats it. goodnight 😴", 1400);
    setTimeout(() => window.bowski && window.bowski.sleep("u poked him 10 times. he's done 😴"), 700);
  }
}
$("idPic").addEventListener("click", (e) => boop(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2));
$("idPic").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boop(innerWidth / 2, innerHeight / 2); } });

// ---------- halloween countdown for his boy ----------
function beeTick() {
  const left = Math.max(0, BEE_DAY - Date.now());
  const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4), s = Math.floor((left % 6e4) / 1e3);
  $("bd").textContent = String(d).padStart(2, "0");
  $("bh").textContent = String(h).padStart(2, "0");
  $("bm").textContent = String(m).padStart(2, "0");
  $("bs").textContent = String(s).padStart(2, "0");
}
beeTick();
setInterval(beeTick, 1000);

// ---------- fresh content from /latest.json: the pipeline rewrites it and redeploys whenever bowski posts ----------
// missing, empty or broken: the page keeps the content it shipped with. every field is checked before it is used,
// and text only ever goes in as text.
const LATEST_MS = 300000;
const okX = (u) => typeof u === "string" && /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,30}\/status\/\d{5,25}(\/|\?|$)/.test(u);
const okIG = (u) => typeof u === "string" && /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+\/?(\?.*)?$/.test(u);
const okVid = (u) => typeof u === "string" && /^\/?vid\/latest\/[\w-][\w.-]*\.mp4$/i.test(u);
const okPic = (u) => typeof u === "string" && /^\/?vid\/latest\/[\w-][\w.-]*\.(jpe?g|webp|png)$/i.test(u);
const statusId = (u) => (String(u || "").match(/\/status\/(\d{5,25})/) || [])[1] || "";
const snowTime = (id) => { try { return id ? Number(BigInt(id) >> 22n) + 1288834974657 : 0; } catch (e) { return 0; } };
const lines = (t) => (typeof t === "string" ? t.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean) : []);
const cut = (t, n) => { const a = Array.from(t); return a.length > n ? a.slice(0, n - 1).join("").trimEnd() + "…" : t; };
const fmtK = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "K" : String(Math.round(n))).replace(/\.0(?=[KM])/, "");
function timeAgo(ms) {
  const m = Math.floor(Math.max(0, nowS() - ms) / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hr" : "hrs"} ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}
function paintTimes() { for (const el of $$("[data-when]")) el.textContent = "posted " + timeAgo(Number(el.dataset.when)); }
function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
function makeVid(src, poster) {
  const v = document.createElement("video");
  v.className = "autoplay";
  for (const a of ["muted", "loop", "playsinline"]) v.setAttribute(a, "");
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
  if (poster) v.poster = poster;
  v.src = src;
  return v;
}
function unwatch(v, drop) {
  vidIO.unobserve(v);
  vis.delete(v);
  try { v.pause(); if (drop) { v.removeAttribute("src"); v.load(); } } catch (e) {}
}

// the clips the page shipped with, so a short list still fills the strip and nothing is shown twice
const freshRow = $("freshRow");
const shipped = freshRow ? $$(".xclip", freshRow).map((el) => {
  const id = statusId(el.href), when = snowTime(id);
  const p = el.querySelector("p");
  if (when && p) { const w = node("span", "when"); w.dataset.when = when; p.append(w); }
  return { el, id, when };
}) : [];
paintTimes();

function latestClip(v, when, isNew) {
  const wrap = node("div", "xclip fresh");
  const a = node("a", "xa");
  a.href = v.x; a.target = "_blank"; a.rel = "noopener noreferrer";
  const ls = lines(v.caption);
  a.setAttribute("aria-label", "bowski on X: " + (ls[0] || "new post"));
  const box = node("div", "v");
  const poster = okPic(v.poster) ? v.poster.replace(/^\//, "") : "";
  const vid = makeVid(v.mp4.replace(/^\//, ""), poster);
  box.append(vid);
  // a landscape clip gets the wide card, like the shipped party clip
  const wide = (w, h) => { if (w > h) wrap.classList.add("wide"); };
  if (poster) { const im = new Image(); im.onload = () => wide(im.naturalWidth, im.naturalHeight); im.src = poster; }
  vid.addEventListener("loadedmetadata", () => wide(vid.videoWidth, vid.videoHeight), { once: true });
  if (isNew) box.append(node("span", "new", "NEW"));
  const p = node("p");
  p.append(node("b", "", cut(ls[0] || "new bowski 🍐", 60)));
  if (ls[1]) p.append(node("span", "c", cut(ls[1], 90)));
  const w = node("span", "when");
  if (when) w.dataset.when = when;
  p.append(w);
  a.append(box, p);
  wrap.append(a);
  if (okIG(v.ig)) {
    const ig = node("a", "xig", "on insta too ↗");
    ig.href = v.ig; ig.target = "_blank"; ig.rel = "noopener noreferrer";
    wrap.append(ig);
  }
  return wrap;
}
let freshSig = "";
function buildFresh(vids) {
  if (!freshRow) return;
  const sig = JSON.stringify(vids.map((v) => [v.x, v.ig, v.mp4, v.poster, v.caption, v.when]));
  if (sig === freshSig) return; // same list as last time: leave the playing clips alone
  freshSig = sig;
  const seen = new Set(), items = [];
  for (const v of vids) {
    const id = statusId(v.x);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ v, when: Date.parse(v.when) || snowTime(id) });
  }
  for (const sc of shipped) if (sc.id && !seen.has(sc.id)) { seen.add(sc.id); items.push({ sc, when: sc.when }); }
  items.sort((a, b) => (b.when || 0) - (a.when || 0));
  const top = items.slice(0, 6);
  for (const v of $$("video", freshRow)) unwatch(v, !!v.closest(".xclip.fresh"));
  for (const sc of shipped) { const b = sc.el.querySelector(".new"); if (b) b.remove(); }
  freshRow.replaceChildren(...top.map((it, i) => {
    if (it.v) return latestClip(it.v, it.when, i === 0);
    if (i === 0) it.sc.el.querySelector(".v").append(node("span", "new", "NEW"));
    return it.sc.el;
  }));
  freshRow.scrollLeft = 0;
  $$("video.autoplay", freshRow).forEach((v) => vidIO.observe(v));
}
function applyRaid(raid, vids) {
  if (!raid || !okX(raid.url)) return;
  for (const id of ["raidBtn", "raidPhone", "raidNewest"]) $(id).href = raid.url;
  const ls = lines(raid.text);
  $("raidText").textContent = ls.length ? cut(ls.slice(0, 2).join(" · "), 130) : "fresh bowski on X 🍐";
  const when = Date.parse(raid.when) || snowTime(statusId(raid.url));
  const rw = $("raidWhen");
  if (when) rw.dataset.when = when; else { delete rw.dataset.when; rw.textContent = "just posted"; }
  $("raidNewest").hidden = false;
  $("raidPhone").setAttribute("aria-label", "bowski's newest post on X");
  // the phone plays the newest post's own clip when we have it
  const match = vids.find((v) => statusId(v.x) === statusId(raid.url));
  const old = $("raidPhone").querySelector("video");
  if (match && old && old.getAttribute("src") !== match.mp4.replace(/^\//, "")) {
    const nv = makeVid(match.mp4.replace(/^\//, ""), okPic(match.poster) ? match.poster.replace(/^\//, "") : "");
    unwatch(old, true);
    old.replaceWith(nv);
    vidIO.observe(nv);
  }
}
function applySocials(so) {
  if (!so || typeof so !== "object") return;
  for (const el of $$("[data-soc]")) {
    const [who, net] = el.dataset.soc.split(".");
    if (net !== "ig") continue; // instagram only. the X counts are not shown
    const n = so[who] && so[who].ig_followers;
    if (typeof n !== "number" || !isFinite(n) || n < 1000) continue;
    const b = el.querySelector("b");
    if (b) b.textContent = fmtK(n);
  }
}
let latestAt = 0;
async function loadLatest() {
  latestAt = Date.now();
  let d;
  try {
    const r = await fetch("/latest.json", { cache: "no-store" });
    if (!r.ok) return;
    const t = (await r.text()).trim();
    if (!t) return;
    d = JSON.parse(t);
  } catch (e) { return; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return;
  const vids = (Array.isArray(d.videos) ? d.videos : []).filter((v) => v && okX(v.x) && okVid(v.mp4)).slice(0, 6);
  try { applyRaid(d.raid, vids); } catch (e) {}
  try { applySocials(d.socials); } catch (e) {}
  try { if (vids.length) buildFresh(vids); } catch (e) {}
  paintTimes();
}
loadLatest();
setInterval(() => { if (!document.hidden) loadLatest(); }, LATEST_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - latestAt > LATEST_MS) loadLatest(); });
setInterval(paintTimes, 30000);

// ---------- the dock: CA and telegram, always one thumb away ----------
const dock = $("dock");
const heroEl = $("top");
function dockFrame() {
  const sr = story.getBoundingClientRect();
  document.body.classList.toggle("in-story", !REDUCE && sr.top < innerHeight * 0.5 && sr.bottom > innerHeight * 0.5);
  const past = scrollY > heroEl.offsetHeight * 0.7;
  const nearEnd = innerHeight + scrollY > document.documentElement.scrollHeight - 40;
  dock.classList.toggle("on", past && !nearEnd);
}
addEventListener("scroll", dockFrame, { passive: true });
dockFrame();

// ---------- the opening hands over to the site ----------
addEventListener("bowski:waking", () => {
  flash();
  boost(14);
  for (let i = 0; i < 5; i++) setTimeout(() => burst(Math.random() * innerWidth, Math.random() * innerHeight * 0.7 + 60, 12), 200 + i * 120);
});
addEventListener("bowski:awake", () => { glitch(); boost(8); startHeroVideo(); });
addEventListener("bowski:asleep", () => { $("heroVid").pause(); });

// ---------- 3D: warp, the coin, and bowski floating in it ----------
let boost = () => {};
let bounce = () => {};
let hit = () => null;
let startHeroVideo = () => {};
(async () => {
  let THREE;
  try { THREE = await import("./three.module.min.js"); } catch (e) { return; }
  const canvas = $("bg");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch (e) { return; }
  let mobile = innerWidth < 900;
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2));
  renderer.setClearColor(0x14001f, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x14001f, 300, 1000);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
  camera.position.z = 8;

  // warp streaks
  const N = innerWidth < 760 ? 900 : 1800;
  const pos = new Float32Array(N * 6), col = new Float32Array(N * 6), z = new Float32Array(N), xy = new Float32Array(N * 2);
  const pal = [0xff2bd6, 0xb6ff00, 0xffc400, 0x00e5ff, 0xffffff, 0xffc400].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 90;
    xy[i * 2] = Math.cos(a) * r; xy[i * 2 + 1] = Math.sin(a) * r;
    z[i] = -1000 * Math.random();
    const c = pal[(Math.random() * pal.length) | 0];
    for (let k = 0; k < 2; k++) { col[i * 6 + k * 3] = c.r; col[i * 6 + k * 3 + 1] = c.g; col[i * 6 + k * 3 + 2] = c.b; }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  scene.add(streaks);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const p1 = new THREE.PointLight(0xff2bd6, 60, 40); p1.position.set(-5, 3, 6); scene.add(p1);
  const p2 = new THREE.PointLight(0xb6ff00, 50, 40); p2.position.set(5, -3, 6); scene.add(p2);
  const d1 = new THREE.DirectionalLight(0xffffff, 1.6); d1.position.set(0, 4, 10); scene.add(d1);

  // bowski floating in the warp: his clip on a plane with feathered edges, so it melts into the streaks
  const feather = (() => {
    const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"), im = g.createImageData(S, S);
    const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / (S - 1), v = y / (S - 1);
      const a = sm(0, 0.2, u) * sm(0, 0.2, 1 - u) * sm(0, 0.14, v) * sm(0, 0.2, 1 - v);
      const o = (y * S + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = a * 255; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const heroImg = HAVE.has("hero.jpg") ? "gen/hero.jpg" : "img/wall/31-pool-float.webp";
  const heroAspect = HAVE.has("hero.jpg") ? 9 / 16 : 3 / 4;
  const heroMat = new THREE.MeshBasicMaterial({ alphaMap: feather, transparent: true, depthWrite: false, opacity: 0 });
  new THREE.TextureLoader().load(heroImg, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    heroMat.map = t; heroMat.needsUpdate = true;
  });
  const PH = 1;
  const heroPlane = new THREE.Mesh(new THREE.PlaneGeometry(PH * heroAspect, PH), heroMat);
  scene.add(heroPlane);
  let heroFade = 0;

  startHeroVideo = () => {
    if (!HAVE.has("hero.mp4")) return;
    const v = $("heroVid");
    if (!v.src) { v.src = "gen/hero.mp4"; v.preload = "auto"; }
    v.play().then(() => {
      const vt = new THREE.VideoTexture(v);
      vt.colorSpace = THREE.SRGBColorSpace;
      heroMat.map = vt; heroMat.needsUpdate = true;
    }).catch(() => {});
  };
  if (isAwake()) startHeroVideo();

  // the coin
  const group = new THREE.Group();
  scene.add(group);
  const tex = new THREE.TextureLoader().load("coin.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // the cylinder maps the image a quarter turn off, so bowski lay on his side (JP, 17 Oct). Upright on both faces.
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc400, metalness: 0.75, roughness: 0.28, emissive: 0x4a2a00, emissiveIntensity: 0.6 });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.15, roughness: 0.5 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.32, 72), [gold, face, face]);
  coin.rotation.x = Math.PI / 2;
  const coinWrap = new THREE.Group();
  coinWrap.add(coin);
  group.add(coinWrap);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.12, 16, 90), gold);
  coinWrap.add(rim);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xb6ff00, transparent: true, opacity: 0.7 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.035, 8, 120), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.03, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.7 }));
  group.add(ring1, ring2);
  const minis = [];
  const miniGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 32);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(miniGeo, [gold, face, face]);
    m.userData = { a: (i / 10) * Math.PI * 2, r: 3.3 + (i % 3) * 0.5, s: 0.4 + Math.random() * 0.5, y: (Math.random() - 0.5) * 2.4 };
    group.add(m);
    minis.push(m);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffb700, emissiveIntensity: 0.55, roughness: 0.9 }));
  scene.add(moon);

  let speed = 2.2, extra = 0, scrollV = 0, lastY = scrollY, spin = 0.012, spinBoost = 0, mx = 0, my = 0, bob = 0;
  boost = (k) => { extra = Math.min(40, extra + k * 2.2); spinBoost = Math.min(0.9, spinBoost + k * 0.03); };
  bounce = () => { bob = 1; };

  // where things sit: L = layout for the hero, P = where the coin drifts once you scroll on
  let L;
  function layout() {
    const w = innerWidth, h = innerHeight;
    mobile = w < 900;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!mobile) {
      const a = w / h;
      L = { plane: [a > 1.9 ? 4.6 : 3.95, 0.3, -2.5], ph: 10, coin: [a > 1.9 ? 6.6 : 5.75, -2.4, 0.6], cs: 0.46, page: [a > 1.9 ? 8.2 : 6.9, 1.4, -1], ps: 0.7 };
      moon.position.set(-9, 5.5, -14);
    } else {
      const narrow = w < 420;
      L = { plane: [0, 3.05, -2.5], ph: narrow ? 6.8 : 7.4, coin: [narrow ? 1.35 : 1.6, 1.15, 0.6], cs: narrow ? 0.34 : 0.4, page: [0, 2.3, -1], ps: narrow ? 0.55 : 0.62 };
      moon.position.set(-4.2, 7.4, -16);
    }
  }
  layout();
  addEventListener("resize", layout);
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  addEventListener("scroll", () => { scrollV += Math.abs(scrollY - lastY); lastY = scrollY; }, { passive: true });

  // taps: on bowski himself = boop (10 and he sleeps). on the coin = a poke
  const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  hit = (x, y) => {
    v2.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(v2, camera);
    if (coinWrap.visible && ray.intersectObject(coinWrap, true).length) return "coin";
    if (heroPlane.visible) {
      const h2 = ray.intersectObject(heroPlane, false)[0];
      if (h2 && h2.uv && h2.uv.x > 0.18 && h2.uv.x < 0.86 && h2.uv.y > 0.14 && h2.uv.y < 0.8) return "bowski";
    }
    return null;
  };

  // the live cam tag follows the plane's top edge
  const camTag = $("camTag");
  const tmp = new THREE.Vector3();
  const pxPerUnit = (d) => innerHeight / (2 * d * Math.tan((camera.fov * Math.PI) / 360));

  const lerp = (a, b, k) => a + (b - a) * k;
  let t0 = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    const t = now / 1000;
    scrollV *= 0.9; extra *= 0.94; spinBoost *= 0.95; bob *= 0.9;
    const v = speed + extra + Math.min(25, scrollV * 0.15);
    const len = 4 + v * 2.2;
    for (let i = 0; i < N; i++) {
      z[i] += v * dt * 60;
      if (z[i] > 10) z[i] = -1000;
      const x = xy[i * 2], y = xy[i * 2 + 1], o = i * 6;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z[i];
      pos[o + 3] = x; pos[o + 4] = y; pos[o + 5] = z[i] - len;
    }
    sg.attributes.position.needsUpdate = true;
    camera.fov = 70 + Math.min(25, (v - 2.2) * 0.9);
    camera.updateProjectionMatrix();
    camera.position.x += (mx * 1.2 - camera.position.x) * 0.05;
    camera.position.y += (-my * 0.8 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    // scroll: the plane rides up with the hero, the coin glides to its page spot
    const k = Math.min(1, scrollY / Math.max(1, innerHeight * 0.9));
    const ke = k * k * (3 - 2 * k);
    const dPlane = camera.position.z - L.plane[2];
    const up = scrollY / pxPerUnit(dPlane);
    heroFade = Math.min(1, heroFade + dt * (isAwake() ? 1.4 : 0));
    heroMat.opacity = heroFade * (1 - ke * 0.4);
    heroPlane.visible = k < 1 && heroFade > 0;
    const s = L.ph * (1 + bob * 0.06);
    heroPlane.scale.set(s, s * (1 - bob * 0.04), 1);
    heroPlane.position.set(L.plane[0], L.plane[1] + up + Math.sin(t * 1.1) * 0.12, L.plane[2]);
    heroPlane.rotation.z = Math.sin(t * 0.7) * 0.025 + bob * Math.sin(t * 40) * 0.05;

    group.position.set(lerp(L.coin[0], L.page[0], ke), lerp(L.coin[1], L.page[1], ke), lerp(L.coin[2], L.page[2], ke));
    group.scale.setScalar(lerp(L.cs, L.ps, ke));

    coinWrap.rotation.y += spin + spinBoost;
    coinWrap.position.y = Math.sin(t * 1.6) * 0.18;
    coinWrap.rotation.z = Math.sin(t * 0.9) * 0.12;
    ring1.rotation.set(t * 0.7, t * 0.4, 0);
    ring2.rotation.set(-t * 0.5, t * 0.6, t * 0.2);
    for (const m of minis) {
      const u = m.userData; u.a += dt * u.s * (1 + spinBoost * 6);
      m.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(u.a * 2) * 0.3, Math.sin(u.a) * u.r);
      m.rotation.x = Math.PI / 2; m.rotation.z += dt * 3;
    }
    moon.rotation.y += dt * 0.1;

    // cam tag over bowski's head
    if (heroPlane.visible && heroFade > 0.5) {
      tmp.set(heroPlane.position.x, heroPlane.position.y + s * 0.5 * 0.86, heroPlane.position.z).project(camera);
      const hr = heroEl.getBoundingClientRect();
      const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
      camTag.style.left = sx - hr.left + "px";
      camTag.style.top = Math.max(sy - hr.top, 80) + "px";
      camTag.classList.add("on");
    } else camTag.classList.remove("on");

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// any tap on the open page: bowski, the coin, or just a little burst
addEventListener("pointerdown", (e) => {
  if (!isAwake()) return;
  if (e.target.closest("a,button,.card,.wall,.idcard,header,.dock,.reel,.xrow,.story,.phone,.tg-mega,.ctr,.bee,.play-card")) return;
  const h = hit(e.clientX, e.clientY);
  if (h === "bowski") boop(e.clientX, e.clientY);
  else if (h === "coin") poke(e.clientX, e.clientY);
  else burst(e.clientX, e.clientY, 3);
});
