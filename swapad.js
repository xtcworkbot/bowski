// SwapMeme ad on the Bowski site (JP, 17 Oct 2026): the original video and the Bowski swap play in sync,
// a neon line wipes from one to the other like the SwapMeme launch film, then the next pair. Drag the line.
(() => {
  const stage = document.getElementById("smStage");
  const card = document.getElementById("smCard");
  if (!stage || !card) return;
  const va = card.querySelector("video.sa");
  const vb = card.querySelector("video.sb");
  const pa = card.querySelector("img.pa");
  const pb = card.querySelector("img.pb");
  const cap = document.getElementById("smCap");
  const dots = [...document.querySelectorAll("#smDots button")];
  const tagA = card.querySelector(".t-a");
  const tagB = card.querySelector(".t-b");
  const P = [
    { k: "tesla", at: 2.4, cap: "tesla ramp jump → bowski on the roof" },
    { k: "deliver", at: 2.2, cap: "flying delivery → bowski at the wheel" },
    { k: "bee", at: 0.9, cap: "late for the showing → bee driving" },
  ];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let i = 0, p = 0, manual = false, visible = false, raf = 0, dragging = false;

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // power2.inOut
  const setP = (v) => {
    p = Math.max(0, Math.min(100, v));
    card.style.setProperty("--p", p + "%");
    tagA.style.opacity = p > 82 ? 0 : 1;
    tagB.style.opacity = p < 18 ? 0 : 1;
  };

  function load(n) {
    i = (n + P.length) % P.length;
    const k = P[i].k;
    manual = false;
    setP(reduce ? 55 : 0);
    pa.src = `vid/swap/${k}-a.jpg`;
    pb.src = `vid/swap/${k}-b.jpg`;
    va.poster = pa.src; vb.poster = pb.src;
    va.src = `vid/swap/${k}-a.mp4`;
    vb.src = `vid/swap/${k}-b.mp4`;
    cap.textContent = P[i].cap;
    dots.forEach((d, j) => d.classList.toggle("on", j === i));
    if (visible && !reduce) play();
  }

  function play() {
    const go = () => { va.play().catch(() => {}); vb.play().catch(() => {}); };
    va.currentTime = 0; vb.currentTime = 0;
    go();
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!visible || va.paused) return;
    // keep the two clips frame-locked
    if (Math.abs(va.currentTime - vb.currentTime) > 0.1) vb.currentTime = va.currentTime;
    if (manual || dragging) return;
    const t = va.currentTime, d = va.duration || 6, at = P[i].at, w = 0.8;
    if (t < at) setP(0);
    else if (t < at + w) setP(100 * ease((t - at) / w));
    else if (t < d - 1.3) setP(100);
    else if (t < d - 0.7) setP(100 - 45 * ease((t - (d - 1.3)) / 0.6)); // peek back
    else setP(55);
  }

  va.addEventListener("ended", () => load(i + 1));
  dots.forEach((d, j) => d.addEventListener("click", () => load(j)));

  // drag the line
  const fromEvent = (e) => {
    const r = card.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  card.addEventListener("pointerdown", (e) => {
    dragging = true; manual = true;
    card.setPointerCapture(e.pointerId);
    setP(fromEvent(e));
  });
  card.addEventListener("pointermove", (e) => { if (dragging) setP(fromEvent(e)); });
  const up = () => { dragging = false; };
  card.addEventListener("pointerup", up);
  card.addEventListener("pointercancel", up);

  // only load and play while on screen
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible) {
      if (!va.src) load(0);
      else if (!reduce) { va.play().catch(() => {}); vb.play().catch(() => {}); }
      if (!raf) raf = requestAnimationFrame(tick);
    } else { va.pause(); vb.pause(); }
  }, { rootMargin: "200px 0px" }).observe(stage);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { va.pause(); vb.pause(); }
    else if (visible && !reduce) { va.play().catch(() => {}); vb.play().catch(() => {}); }
  });
})();
