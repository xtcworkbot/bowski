// Link pages for Bino Bowski (bowski.vercel.app/links) and Bino Bee (bino-b.vercel.app). One file, copied into the Bee site on deploy.
(function () {
  // In-app browsers (Instagram, TikTok) can refuse the clipboard API, so fall back to the old copy.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return oldCopy(text); });
    }
    return oldCopy(text);
  }

  function oldCopy(text) {
    return new Promise(function (ok, fail) {
      var t = document.createElement("textarea");
      t.value = text;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy") ? ok() : fail(); } catch (e) { fail(e); }
      document.body.removeChild(t);
    });
  }

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var label = btn.querySelector(".ca-btn");
    var idle = label ? label.textContent : "";
    btn.addEventListener("click", function () {
      copyText(btn.getAttribute("data-copy")).then(function () {
        btn.classList.add("done");
        if (label) label.textContent = btn.getAttribute("data-done") || "copied";
        setTimeout(function () {
          btn.classList.remove("done");
          if (label) label.textContent = idle;
        }, 1600);
      });
    });
  });

  var guy = document.querySelector(".guy");
  if (guy) {
    guy.addEventListener("click", function () {
      guy.classList.remove("poke");
      void guy.offsetWidth;
      guy.classList.add("poke");
    });
    guy.addEventListener("animationend", function (e) {
      if (e.animationName === "poke") guy.classList.remove("poke");
    });
  }

  // The SwapMeme ad slides in once the page has settled. Closed once, it stays closed for the visit.
  var ad = document.querySelector(".sm");
  if (ad) {
    var closed = false;
    try { closed = sessionStorage.getItem("sm-off") === "1"; } catch (e) {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ad.querySelectorAll("video").forEach(function (v) { v.removeAttribute("autoplay"); v.pause(); });
    }
    if (closed) {
      document.body.classList.add("sm-off");
    } else {
      setTimeout(function () { document.body.classList.add("sm-on"); }, matchMedia("(min-width: 1240px)").matches ? 600 : 1600);
    }
    ad.querySelector(".sm-x").addEventListener("click", function () {
      document.body.classList.remove("sm-on");
      document.body.classList.add("sm-off");
      try { sessionStorage.setItem("sm-off", "1"); } catch (e) {}
    });
  }

  // "halloween in 7d 10h 13m" until it starts in Sydney, "happy halloween" on the day, gone after.
  var count = document.querySelector("[data-until]");
  if (count) {
    var start = Date.parse(count.getAttribute("data-until"));
    var end = start + 24 * 3600 * 1000;
    var out = count.querySelector(".count-val");
    var tick = function () {
      var now = Date.now();
      if (now >= end) { count.hidden = true; return; }
      count.hidden = false;
      if (now >= start) { count.classList.add("on"); out.textContent = "happy halloween"; return; }
      var m = Math.floor((start - now) / 60000);
      var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
      out.textContent = d + "d " + h + "h " + (m % 60) + "m";
    };
    tick();
    setInterval(tick, 30000);
  }
})();
