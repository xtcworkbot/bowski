// GET /api/stats -> live $BOWSKI numbers for the site. Public sources only, no keys.
// DexScreener for market cap, volume and 1h buys and sells. The public t.me page for the member count.
// Cached at the edge for 60s so a busy page costs two upstream reads a minute, not one per visitor.
const CA = "84Ciai5YhpxxYiLE55SJqGHY3jftEtVxvcBXMwyapump";
const DEX = `https://api.dexscreener.com/latest/dex/tokens/${CA}`;
const TG = "https://t.me/binobowski";

async function get(url, as, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; bowski-site/2)", accept: as === "json" ? "application/json" : "text/html" } });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return as === "json" ? await r.json() : await r.text();
  } finally {
    clearTimeout(t);
  }
}

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

async function dex() {
  const d = await get(DEX, "json");
  const pairs = (d && d.pairs) || [];
  if (!pairs.length) return null;
  // the pair with the most 24h volume is the one people trade on
  const p = pairs.slice().sort((a, b) => (num(b.volume && b.volume.h24) || 0) - (num(a.volume && a.volume.h24) || 0))[0];
  const sum = (k, side) => pairs.reduce((s, x) => s + (num(x.txns && x.txns[k] && x.txns[k][side]) || 0), 0);
  return {
    marketCap: num(p.marketCap) ?? num(p.fdv),
    priceUsd: num(p.priceUsd),
    volume24h: pairs.reduce((s, x) => s + (num(x.volume && x.volume.h24) || 0), 0),
    buys1h: sum("h1", "buys"),
    sells1h: sum("h1", "sells"),
    buys24h: sum("h24", "buys"),
    sells24h: sum("h24", "sells"),
    dex: p.dexId || null,
    pairs: pairs.length,
  };
}

// last good reads on this warm instance, so one failed upstream read does not blank a counter
const last = { dex: null, tg: null };

async function tg() {
  let html;
  try { html = await get(TG, "text"); } catch (e) { html = await get(TG, "text", 4000); }
  const m = html.match(/tgme_page_extra">\s*([\d][\d\s,.]*)\s*(members|subscribers)(?:,\s*([\d][\d\s,.]*)\s*online)?/i);
  if (!m) return null;
  const clean = (s) => (s ? Number(String(s).replace(/[^\d]/g, "")) : null);
  return { tgMembers: clean(m[1]), tgOnline: clean(m[3]) };
}

module.exports = async function handler(req, res) {
  const [d, t] = await Promise.allSettled([dex(), tg()]);
  const out = {
    ok: true,
    ca: CA,
    updated: new Date().toISOString(),
    marketCap: null, priceUsd: null, volume24h: null,
    buys1h: null, sells1h: null, buys24h: null, sells24h: null,
    tgMembers: null, tgOnline: null,
    sources: { dexscreener: d.status === "fulfilled" && !!d.value, telegram: t.status === "fulfilled" && !!t.value },
  };
  if (d.status === "fulfilled" && d.value) last.dex = { ...d.value, at: out.updated };
  if (t.status === "fulfilled" && t.value) last.tg = { ...t.value, at: out.updated };
  if (last.dex) Object.assign(out, last.dex, { dexAt: last.dex.at });
  if (last.tg) Object.assign(out, last.tg, { tgAt: last.tg.at });
  delete out.at;
  out.ok = !!(last.dex || last.tg);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.statusCode = 200;
  res.end(JSON.stringify(out));
};
