// boot.js runs before first paint. It owns the opening: bowski asleep on the vault cam, tap to wake him.
// Everything on the page is in the HTML underneath, so crawlers and no-JS visitors get the full site.
(function () {
  var html = document.documentElement;
  html.classList.add("js");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("bowski_awake") === "1"; } catch (e) {}
  // skip the opening for a return visit in the same tab, or a deep link like /#ca
  if (seen || (location.hash && location.hash.length > 1)) html.classList.add("awake");

  var state = "asleep"; // asleep | waking | awake
  if (html.classList.contains("awake")) state = "awake";

  function fire(name) { try { window.dispatchEvent(new Event(name)); } catch (e) {} }

  function done() {
    var intro = document.getElementById("intro");
    html.classList.add("awake");
    if (intro) intro.classList.remove("waking", "gone");
    state = "awake";
    try { sessionStorage.setItem("bowski_awake", "1"); } catch (e) {}
    fire("bowski:awake");
  }

  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function finish(intro) {
    intro.classList.add("waking");
    fire("bowski:waking");
    later(function () { intro.classList.add("gone"); }, 950);
    later(done, 1480);
  }
  function wake(skip) {
    var intro = document.getElementById("intro");
    if (state === "waking" && intro) { // a second tap while he wakes skips the rest
      timers.forEach(clearTimeout); timers = [];
      if (!intro.classList.contains("waking")) fire("bowski:waking");
      done(); return;
    }
    if (state !== "asleep") return;
    if (!intro || skip || reduce) { state = "waking"; fire("bowski:waking"); done(); return; }
    state = "waking";
    var v = document.getElementById("wakeVid");
    if (v && v.getAttribute("src") && v.readyState >= 2) {
      // the clip: he is out cold, then his eyes snap open at about 3.3s
      try { v.currentTime = 2.9; } catch (e) {}
      var p = v.play();
      intro.classList.add("playing");
      var subj = document.getElementById("camSubj");
      if (subj) subj.textContent = "subject: ???";
      if (p && p.catch) p.catch(function () { intro.classList.remove("playing"); finish(intro); });
      later(function () { finish(intro); }, 1500);
    } else finish(intro);
  }

  function sleep(msg) {
    var intro = document.getElementById("intro");
    if (!intro || state !== "awake") return;
    var shh = intro.querySelector(".intro-shh");
    if (shh && msg) shh.textContent = msg;
    intro.classList.remove("waking", "gone", "playing");
    var v = document.getElementById("wakeVid");
    if (v) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
    var subj = document.getElementById("camSubj");
    if (subj) subj.textContent = "subject: asleep";
    var have = " " + (document.body.getAttribute("data-have") || "") + " ";
    if (v && !v.getAttribute("src") && have.indexOf(" wake.mp4 ") > -1) { v.src = "gen/wake.mp4"; v.preload = "auto"; try { v.load(); } catch (e) {} }
    html.classList.remove("awake");
    state = "asleep";
    try { sessionStorage.removeItem("bowski_awake"); } catch (e) {}
    fire("bowski:asleep");
  }

  window.bowski = { wake: wake, sleep: sleep, state: function () { return state; } };

  function ready() {
    var intro = document.getElementById("intro");
    if (!intro) return;
    var have = " " + (document.body.getAttribute("data-have") || "") + " ";
    var v = document.getElementById("wakeVid");
    if (v && have.indexOf(" wake.mp4 ") > -1 && state === "asleep") { v.src = "gen/wake.mp4"; v.preload = "auto"; try { v.load(); } catch (e) {} }
    var skip = document.getElementById("introSkip");
    skip.addEventListener("click", function (e) { e.stopPropagation(); wake(true); });
    intro.addEventListener("click", function () { wake(false); });
    document.addEventListener("keydown", function (e) {
      if (state !== "asleep") return;
      if (e.key === "Escape") wake(true);
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); wake(false); }
    });
    // the cam clock ticks so the feed reads live
    var clk = document.getElementById("camClock"), t0 = 3 * 3600 + 12 * 60 + 7, s = 0;
    setInterval(function () {
      if (state !== "asleep" || !clk) return;
      var t = t0 + (s++), h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60, x = t % 60;
      clk.textContent = [h, m, x].map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
    }, 1000);
    if (state !== "asleep") fire("bowski:awake");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
