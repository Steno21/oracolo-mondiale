import { useState, useMemo, useRef, useEffect } from "react";

// ════════════════════════════════════════════
// CONFIG SUPABASE
// ════════════════════════════════════════════
const SUPABASE_URL = "https://ofmrugmeiukbyeicoxla.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbXJ1Z21laXVrYnllaWNveGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzY5NTQsImV4cCI6MjA5NjY1Mjk1NH0.l0VaZ7elDIo1TEUSvT-iYSsYJ3OclazhZQigOoHLf4U";
const ADMIN_PASSWORD = "Dibumartinez1!";

// Helper REST per Supabase (niente librerie esterne)
const sb = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!r.ok) throw new Error(`select ${table}: ${r.status}`);
    return r.json();
  },
  async insert(table, row) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `insert ${table}: ${r.status}`);
    }
    return r.json();
  },
  async upsert(table, row) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `upsert ${table}: ${r.status}`);
    }
    return r.json();
  },
};

// Normalizza un nome per il confronto (doppioni)
const normNome = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Filtro nomi: parolacce/bestemmie comuni (lista base, allungabile)
const BANNED = [
  "merda", "cazzo", "stronz", "puttan", "troia", "vaffan", "figa", "minchia",
  "coglion", "bastard", "porco dio", "porcodio", "dio can", "diocan", "dio porco",
  "dioporco", "madonna putt", "porca madonna", "porcamadonna", "negr", "frocio",
  "ricchion", "checca", "culattone", "mongoloide", "handicappat", "ritardat",
];
const nomeVolgare = (s) => {
  const t = s.toLowerCase();
  return BANNED.some((w) => t.includes(w));
};

// ════════════════════════════════════════════
// DATI — gironi ufficiali Mondiali 2026
// ════════════════════════════════════════════
const GROUPS = [
  { id: "A", teams: ["Messico", "Sudafrica", "Corea del Sud", "Rep. Ceca"] },
  { id: "B", teams: ["Canada", "Bosnia-Erzegovina", "Qatar", "Svizzera"] },
  { id: "C", teams: ["Brasile", "Marocco", "Haiti", "Scozia"] },
  { id: "D", teams: ["Stati Uniti", "Paraguay", "Australia", "Turchia"] },
  { id: "E", teams: ["Germania", "Curaçao", "Costa d'Avorio", "Ecuador"] },
  { id: "F", teams: ["Paesi Bassi", "Giappone", "Svezia", "Tunisia"] },
  { id: "G", teams: ["Belgio", "Egitto", "Iran", "Nuova Zelanda"] },
  { id: "H", teams: ["Spagna", "Capo Verde", "Arabia Saudita", "Uruguay"] },
  { id: "I", teams: ["Francia", "Senegal", "Iraq", "Norvegia"] },
  { id: "J", teams: ["Argentina", "Algeria", "Austria", "Giordania"] },
  { id: "K", teams: ["Portogallo", "RD Congo", "Uzbekistan", "Colombia"] },
  { id: "L", teams: ["Inghilterra", "Croazia", "Ghana", "Panama"] },
];

// Ranking FIFA ufficiale (1 aprile 2026) — tutte le 48 posizioni verificate
const FIFA_RANK = {
  Francia: 1, Spagna: 2, Argentina: 3, Inghilterra: 4, Portogallo: 5,
  Brasile: 6, "Paesi Bassi": 7, Marocco: 8, Belgio: 9, Germania: 10,
  Croazia: 11, Colombia: 13, Senegal: 14, Messico: 15, "Stati Uniti": 16,
  Uruguay: 17, Giappone: 18, Svizzera: 19, Iran: 21, Turchia: 22,
  Ecuador: 23, Austria: 24, "Corea del Sud": 25, Australia: 27, Algeria: 28,
  Egitto: 29, Canada: 30, Norvegia: 31, Panama: 33, "Costa d'Avorio": 34,
  Svezia: 38, Paraguay: 40, "Rep. Ceca": 41, Scozia: 43, Tunisia: 44,
  "RD Congo": 46, Uzbekistan: 50, Qatar: 55, Iraq: 57, Sudafrica: 60,
  "Arabia Saudita": 61, Giordania: 63, "Bosnia-Erzegovina": 65,
  "Capo Verde": 69, Ghana: 74, Curaçao: 82, Haiti: 83, "Nuova Zelanda": 85,
};

// Quote bookmaker — NON mostrate, servono solo a ordinare le liste
// Vincente (SNAI 5/6): Francia/Spagna 6, Inghilterra 8, Portogallo 9, Argentina/Brasile 10, Germania 16, Olanda 26
const FAVORITES = ["Francia", "Spagna", "Inghilterra", "Portogallo", "Argentina", "Brasile", "Germania", "Paesi Bassi"];

// Candidati per i premi individuali, ordinati per quota bookmaker (assistman/cartellini: ordinamento editoriale)
const CANDIDATES = {
  topScorer: [
    ["Mbappé", "Francia"], ["Kane", "Inghilterra"], ["Haaland", "Norvegia"],
    ["Messi", "Argentina"], ["Oyarzabal", "Spagna"], ["Ronaldo", "Portogallo"],
    ["Yamal", "Spagna"], ["Vinícius Jr", "Brasile"], ["Raphinha", "Brasile"],
    ["Dembélé", "Francia"], ["Julián Álvarez", "Argentina"], ["Lautaro Martínez", "Argentina"],
    ["Olise", "Francia"], ["Igor Thiago", "Brasile"],
  ],
  topAssist: [
    ["Messi", "Argentina"], ["De Bruyne", "Belgio"], ["Yamal", "Spagna"],
    ["Dembélé", "Francia"], ["Bellingham", "Inghilterra"], ["Vitinha", "Portogallo"],
    ["Bruno Fernandes", "Portogallo"], ["Kimmich", "Germania"], ["Doku", "Belgio"],
    ["Olise", "Francia"], ["Rice", "Inghilterra"], ["Güler", "Turchia"],
    ["Cherki", "Francia"], ["Wirtz", "Germania"], ["Vinícius Jr", "Brasile"],
    ["Saka", "Inghilterra"], ["Olmo", "Spagna"], ["Pedri", "Spagna"],
    ["Kane", "Inghilterra"], ["Mbappé", "Francia"], ["Raphinha", "Brasile"],
    ["Musiala", "Germania"],
  ],
  bestPlayer: [
    ["Yamal", "Spagna"], ["Mbappé", "Francia"], ["Bellingham", "Inghilterra"],
    ["Messi", "Argentina"], ["Kane", "Inghilterra"], ["Pedri", "Spagna"],
    ["Vitinha", "Portogallo"], ["Musiala", "Germania"], ["Olise", "Francia"],
    ["Vinícius Jr", "Brasile"], ["Dembélé", "Francia"], ["Raphinha", "Brasile"],
    ["Rice", "Inghilterra"], ["Cherki", "Francia"], ["Bruno Fernandes", "Portogallo"],
    ["Rodri", "Spagna"], ["Ronaldo", "Portogallo"], ["Haaland", "Norvegia"],
    ["Saka", "Inghilterra"], ["Lautaro Martínez", "Argentina"],
  ],
  bestGK: [
    ["Emi Martínez", "Argentina"], ["Maignan", "Francia"], ["Unai Simón", "Spagna"],
    ["Alisson", "Brasile"], ["Diogo Costa", "Portogallo"], ["Courtois", "Belgio"],
    ["Pickford", "Inghilterra"], ["Ederson", "Brasile"], ["Raya", "Spagna"],
    ["Neuer", "Germania"],
  ],
  youngPlayer: [
    ["Yamal", "Spagna"], ["Doué", "Francia"], ["Zaïre-Emery", "Francia"],
    ["Güler", "Turchia"], ["Endrick", "Brasile"], ["O'Reilly", "Inghilterra"],
    ["Rayan", "Brasile"], ["Yıldız", "Turchia"], ["Mainoo", "Inghilterra"],
    ["Diomandé", "Costa d'Avorio"], ["Cubarsí", "Spagna"], ["Nusa", "Norvegia"],
  ],
  mostCards: [
    ["Casemiro", "Brasile"], ["Ríos", "Colombia"], ["Otamendi", "Argentina"],
    ["Romero", "Argentina"], ["Paredes", "Argentina"], ["Edson Álvarez", "Messico"],
    ["Vinícius Jr", "Brasile"], ["Muñoz", "Colombia"], ["Caicedo", "Ecuador"],
    ["Ugarte", "Uruguay"], ["Enzo Fernández", "Argentina"], ["Theo Hernández", "Francia"],
    ["Tchouaméni", "Francia"], ["Cucurella", "Spagna"], ["Oulaï", "Costa d'Avorio"],
    ["Demiral", "Turchia"], ["James Rodríguez", "Colombia"], ["El Aynaoui", "Marocco"],
    ["Rodri", "Spagna"], ["Xhaka", "Svizzera"], ["Bruno Guimarães", "Brasile"],
    ["Amrabat", "Marocco"], ["Bentancur", "Uruguay"], ["Hannibal", "Tunisia"],
    ["Upamecano", "Francia"], ["Bellingham", "Inghilterra"],
  ],
};

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);
const BY_RANK = [...ALL_TEAMS].sort((a, b) => FIFA_RANK[a] - FIFA_RANK[b]);
const UNDERDOGS = [...BY_RANK].reverse().slice(0, 8);

const DEADLINE = new Date("2026-06-11T21:00:00+02:00");

// ════════════════════════════════════════════
// MOTORE DI PUNTEGGIO
// gironi: 3 pt posizione esatta, 1 pt qualificata (top-2) ma posto sbagliato
// secche: punti pieni se la previsione coincide col risultato
// ════════════════════════════════════════════
const SECCHE_PTS = {
  winner: 15, topScorer: 10, topAssist: 10, bestPlayer: 8, bestGK: 8,
  youngPlayer: 8, mostCards: 10, worstGD: 6, ronaldoGoals: 5, messiGoals: 5,
};

function scoreGironi(pred, real) {
  // pred/real: { A: [t1,t2,t3,t4], ... }
  let pts = 0;
  const detail = {};
  for (const g of GROUPS) {
    const p = pred?.[g.id];
    const r = real?.[g.id];
    if (!p || !r || r.length < 4) { detail[g.id] = null; continue; }
    let gp = 0;
    const realTop2 = r.slice(0, 2);
    p.forEach((team, i) => {
      if (r[i] === team) gp += 3;
      else if (i < 2 && realTop2.includes(team)) gp += 1;
    });
    detail[g.id] = gp;
    pts += gp;
  }
  return { pts, detail };
}

function scoreSecche(pred, real) {
  let pts = 0;
  const detail = {};
  for (const key of Object.keys(SECCHE_PTS)) {
    const p = pred?.[key];
    const r = real?.[key];
    if (p == null || p === "" || r == null || r === "") { detail[key] = null; continue; }
    const ok = String(p).trim().toLowerCase() === String(r).trim().toLowerCase();
    detail[key] = ok ? SECCHE_PTS[key] : 0;
    if (ok) pts += SECCHE_PTS[key];
  }
  return { pts, detail };
}

function scorePrediction(pred, results) {
  const g = scoreGironi(pred.gironi, results?.gironi || {});
  const s = scoreSecche(pred.secche, results?.secche || {});
  return { gironi: g.pts, secche: s.pts, tot: g.pts + s.pts, gDetail: g.detail, sDetail: s.detail };
}


const FAKE_LEADERBOARD = [
  { name: "Stefano", gironi: 41, secche: 25 },
  { name: "Marco", gironi: 47, secche: 11 },
  { name: "Luca", gironi: 38, secche: 16 },
  { name: "Ale", gironi: 35, secche: 14 },
  { name: "Giulio", gironi: 29, secche: 6 },
];

// ════════════════════════════════════════════
// BANDIERE — SVG inline (nessuna risorsa esterna)
// o: orientamento strisce, c: colori, d: [tipo, colore] elemento extra
// ════════════════════════════════════════════
const FLAG = {
  Messico: { o: "v", c: ["#006847", "#fff", "#ce1126"], d: ["circle", "#8a6d3b"] },
  Sudafrica: { o: "h", c: ["#E03C31", "#007749", "#001489"], d: ["tri", "#FFB612"] },
  "Corea del Sud": { o: "h", c: ["#fff"], d: ["circle", "#CD2E3A"] },
  "Rep. Ceca": { o: "h", c: ["#fff", "#D7141A"], d: ["tri", "#11457E"] },
  Canada: { o: "v", c: ["#FF0000", "#fff", "#FF0000"], d: ["star", "#FF0000"] },
  "Bosnia-Erzegovina": { o: "h", c: ["#002395"], d: ["tri", "#FECB00"] },
  Qatar: { o: "v", c: ["#fff", "#8A1538", "#8A1538"] },
  Svizzera: { o: "h", c: ["#DA291C"], d: ["cross", "#fff"] },
  Brasile: { o: "h", c: ["#009739"], d: ["diamond", "#FEDD00"] },
  Marocco: { o: "h", c: ["#C1272D"], d: ["star", "#006233"] },
  Haiti: { o: "h", c: ["#00209F", "#D21034"] },
  Scozia: { o: "h", c: ["#005EB8"], d: ["saltire", "#fff"] },
  "Stati Uniti": { o: "h", c: ["#B22234", "#fff", "#B22234"], d: ["canton", "#3C3B6E"] },
  Paraguay: { o: "h", c: ["#D52B1E", "#fff", "#0038A8"] },
  Australia: { o: "h", c: ["#012169"], d: ["stars", "#fff"] },
  Turchia: { o: "h", c: ["#E30A17"], d: ["crescent", "#fff"] },
  Germania: { o: "h", c: ["#000", "#DD0000", "#FFCE00"] },
  Curaçao: { o: "h", c: ["#002B7F", "#F9E814", "#002B7F"], d: ["stars", "#fff"] },
  "Costa d'Avorio": { o: "v", c: ["#FF8200", "#fff", "#009A44"] },
  Ecuador: { o: "h", c: ["#FFD100", "#0072CE", "#EF3340"] },
  "Paesi Bassi": { o: "h", c: ["#AE1C28", "#fff", "#21468B"] },
  Giappone: { o: "h", c: ["#fff"], d: ["circle", "#BC002D"] },
  Svezia: { o: "h", c: ["#006AA7"], d: ["cross", "#FECC02"] },
  Tunisia: { o: "h", c: ["#E70013"], d: ["circle", "#fff"] },
  Belgio: { o: "v", c: ["#000", "#FDDA24", "#EF3340"] },
  Egitto: { o: "h", c: ["#CE1126", "#fff", "#000"], d: ["sunC", "#C09300"] },
  Iran: { o: "h", c: ["#239F40", "#fff", "#DA0000"] },
  "Nuova Zelanda": { o: "h", c: ["#012169"], d: ["stars", "#CC142B"] },
  Spagna: { o: "h", c: ["#AA151B", "#F1BF00", "#AA151B"] },
  "Capo Verde": { o: "h", c: ["#003893", "#fff", "#CF2027"], d: ["stars", "#F7D116"] },
  "Arabia Saudita": { o: "h", c: ["#006C35"], d: ["bar", "#fff"] },
  Uruguay: { o: "h", c: ["#fff", "#0038A8", "#fff"], d: ["sun", "#FCD116"] },
  Francia: { o: "v", c: ["#0055A4", "#fff", "#EF4135"] },
  Senegal: { o: "v", c: ["#00853F", "#FDEF42", "#E31B23"], d: ["star", "#00853F"] },
  Iraq: { o: "h", c: ["#CE1126", "#fff", "#000"], d: ["sunC", "#007A3D"] },
  Norvegia: { o: "h", c: ["#BA0C2F"], d: ["nordcross", "#00205B"] },
  Argentina: { o: "h", c: ["#74ACDF", "#fff", "#74ACDF"], d: ["sunC", "#F6B40E"] },
  Algeria: { o: "v", c: ["#006233", "#fff"], d: ["crescent", "#D21034"] },
  Austria: { o: "h", c: ["#EF3340", "#fff", "#EF3340"] },
  Giordania: { o: "h", c: ["#000", "#fff", "#007A3D"], d: ["tri", "#CE1126"] },
  Portogallo: { o: "v", c: ["#006600", "#FF0000", "#FF0000"], d: ["circle", "#FFE900"] },
  "RD Congo": { o: "h", c: ["#007FFF"], d: ["diag", "#CE1021"] },
  Uzbekistan: { o: "h", c: ["#0099B5", "#fff", "#1EB53A"] },
  Colombia: { o: "h", c: ["#FCD116", "#003893", "#CE1126"] },
  Inghilterra: { o: "h", c: ["#fff"], d: ["cross", "#CE1124"] },
  Croazia: { o: "h", c: ["#FF0000", "#fff", "#171796"] },
  Ghana: { o: "h", c: ["#CE1126", "#FCD116", "#006B3F"], d: ["star", "#000"] },
  Panama: { o: "h", c: ["#fff"], d: ["quarters", "#005293"] },
};

function Flag({ team, size = 30 }) {
  const f = FLAG[team];
  const W = size, H = Math.round(size * 0.7);
  if (!f) return <span style={{ width: W, height: H, background: "#333", borderRadius: 3, display: "inline-block" }} />;
  const n = f.c.length;
  const stripes = f.c.map((col, i) =>
    f.o === "h" ? (
      <rect key={i} x="0" y={(H / n) * i} width={W} height={H / n + 0.5} fill={col} />
    ) : (
      <rect key={i} x={(W / n) * i} y="0" width={W / n + 0.5} height={H} fill={col} />
    )
  );
  let device = null;
  if (f.d) {
    const [t, col] = f.d;
    const cx = W / 2, cy = H / 2, r = H * 0.26;
    if (t === "circle") device = <circle cx={cx} cy={cy} r={r} fill={col} />;
    if (t === "sunC") device = <circle cx={cx} cy={cy} r={H * 0.16} fill={col} />;
    if (t === "sun") device = <circle cx={W * 0.22} cy={H * 0.25} r={H * 0.15} fill={col} />;
    if (t === "star")
      device = <text x={cx} y={cy + r * 0.85} textAnchor="middle" fontSize={H * 0.62} fill={col}>★</text>;
    if (t === "stars")
      device = (
        <g fill={col}>
          <text x={W * 0.68} y={H * 0.36} textAnchor="middle" fontSize={H * 0.26}>★</text>
          <text x={W * 0.8} y={H * 0.6} textAnchor="middle" fontSize={H * 0.26}>★</text>
          <text x={W * 0.62} y={H * 0.82} textAnchor="middle" fontSize={H * 0.26}>★</text>
        </g>
      );
    if (t === "cross")
      device = (
        <g fill={col}>
          <rect x={W * 0.32} y={0} width={W * 0.14} height={H} />
          <rect x={0} y={H * 0.4} width={W} height={H * 0.2} />
        </g>
      );
    if (t === "nordcross")
      device = (
        <g>
          <rect x={W * 0.28} y={0} width={W * 0.2} height={H} fill="#fff" />
          <rect x={0} y={H * 0.36} width={W} height={H * 0.28} fill="#fff" />
          <rect x={W * 0.33} y={0} width={W * 0.1} height={H} fill={col} />
          <rect x={0} y={H * 0.43} width={W} height={H * 0.14} fill={col} />
        </g>
      );
    if (t === "saltire")
      device = (
        <g stroke={col} strokeWidth={H * 0.16}>
          <line x1="0" y1="0" x2={W} y2={H} />
          <line x1={W} y1="0" x2="0" y2={H} />
        </g>
      );
    if (t === "tri") device = <polygon points={`0,0 ${W * 0.45},${H / 2} 0,${H}`} fill={col} />;
    if (t === "canton") device = <rect x="0" y="0" width={W * 0.45} height={H * 0.55} fill={col} />;
    if (t === "diamond")
      device = (
        <g>
          <polygon points={`${cx},${H * 0.08} ${W * 0.88},${cy} ${cx},${H * 0.92} ${W * 0.12},${cy}`} fill={col} />
          <circle cx={cx} cy={cy} r={H * 0.18} fill="#012169" />
        </g>
      );
    if (t === "crescent")
      device = (
        <g>
          <circle cx={cx - W * 0.04} cy={cy} r={H * 0.26} fill={col} />
          <circle cx={cx + W * 0.03} cy={cy} r={H * 0.21} fill={f.c[f.o === "v" ? 0 : 0]} />
        </g>
      );
    if (t === "bar") device = <rect x={W * 0.15} y={H * 0.42} width={W * 0.7} height={H * 0.1} fill={col} rx={2} />;
    if (t === "quarters")
      device = (
        <g>
          <rect x={W * 0.5} y="0" width={W * 0.5} height={H * 0.5} fill="#D21034" />
          <rect x="0" y={H * 0.5} width={W * 0.5} height={H * 0.5} fill={col} />
          <text x={W * 0.25} y={H * 0.42} textAnchor="middle" fontSize={H * 0.3} fill={col}>★</text>
        </g>
      );
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ borderRadius: 3, boxShadow: "0 1px 4px rgba(0,0,0,.5)", flexShrink: 0 }} aria-label={team}>
      {stripes}
      {device}
    </svg>
  );
}

// ════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════
const T = {
  bg: "#070b16",
  bg2: "#0d1326",
  card: "rgba(255,255,255,0.05)",
  cardBorder: "rgba(255,255,255,0.09)",
  neon: "#00ff87",
  violet: "#8b5cf6",
  pink: "#ec4899",
  text: "#eef2ff",
  dim: "#98a0ba",
  gold: "#fbbf24",
};

const fd = "'Arial Black','Archivo Black',Impact,sans-serif";
const fb = "'Segoe UI',system-ui,-apple-system,sans-serif";

const css = `
  @keyframes slideIn { from { opacity:0; transform:translateX(28px); } to { opacity:1; transform:none; } }
  @keyframes popIn { 0% { transform:scale(.6); opacity:0 } 70% { transform:scale(1.08) } 100% { transform:scale(1); opacity:1 } }
  @keyframes glowPulse { 0%,100% { box-shadow:0 0 18px rgba(0,255,135,.25) } 50% { box-shadow:0 0 34px rgba(0,255,135,.55) } }
  @keyframes floatY { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
  @keyframes pulseGhost { 0%,100% { border-color: rgba(255,255,255,.12) } 50% { border-color: rgba(0,255,135,.6) } }
  @keyframes riseUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
  .screen { animation: slideIn .32s cubic-bezier(.22,1,.36,1); }
  .rankBadge { animation: popIn .28s cubic-bezier(.34,1.56,.64,1); }
  .glow { animation: glowPulse 2.4s ease-in-out infinite; }
  .floaty { animation: floatY 3.5s ease-in-out infinite; }
  .ghostNext { animation: pulseGhost 1.6s ease-in-out infinite; }
  .confirmBar { animation: riseUp .3s cubic-bezier(.22,1,.36,1); }
  @media (prefers-reduced-motion: reduce) {
    .screen,.rankBadge,.glow,.floaty,.ghostNext,.confirmBar { animation:none !important; }
  }
  button { -webkit-tap-highlight-color: transparent; }
  input { outline-color: ${T.neon}; }
`;

// ════════════════════════════════════════════
// STEPS
// ════════════════════════════════════════════
const STEPS = [
  { type: "home" },
  ...GROUPS.map((g) => ({ type: "group", group: g })),
  { type: "team", key: "winner", title: "Nazionale vincente", sub: "Chi alza la coppa?", pts: 15, icon: "🏆", mode: "favorites" },
  { type: "player", key: "topScorer", title: "Capocannoniere", sub: "Chi segna più gol di tutti, incluse fasi finali", pts: 10, icon: "⚽" },
  { type: "player", key: "topAssist", title: "Miglior assistman", sub: "Il re degli assist (classifica FIFA), incluse fasi finali", pts: 10, icon: "🎯" },
  { type: "player", key: "bestPlayer", title: "Golden Ball", sub: "Miglior giocatore — deciso da FIFA", pts: 8, icon: "🌟" },
  { type: "player", key: "bestGK", title: "Golden Glove", sub: "Miglior portiere — deciso da FIFA", pts: 8, icon: "🧤" },
  { type: "player", key: "youngPlayer", title: "Miglior giovane", sub: "FIFA Young Player Award", pts: 8, icon: "🌱" },
  { type: "player", key: "mostCards", title: "Re dei cartellini", sub: "Chi colleziona più cartellini (giallo 1 punto, rosso 2 punti)", pts: 10, icon: "🟨" },
  { type: "team", key: "worstGD", title: "Il disastro", sub: "La peggior differenza reti del torneo", pts: 6, icon: "💀", mode: "underdogs" },
  { type: "number", key: "ronaldoGoals", title: "Gol di Ronaldo", sub: "Numero esatto, tutto o niente", pts: 5, team: "Portogallo" },
  { type: "number", key: "messiGoals", title: "Gol di Messi", sub: "Numero esatto, tutto o niente", pts: 5, team: "Argentina" },
  { type: "summary" },
];

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    expired: diff === 0,
  };
}

// ════════════════════════════════════════════
// UI ATOMS
// ════════════════════════════════════════════
const H1 = ({ children, style }) => (
  <h1
    style={{
      fontFamily: fd, fontStyle: "italic", textTransform: "uppercase",
      letterSpacing: 0.5, fontSize: "clamp(25px,6.5vw,38px)",
      lineHeight: 1.05, margin: 0, color: T.text, ...style,
    }}
  >
    {children}
  </h1>
);

const NeonBtn = ({ children, onClick, disabled, ghost }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      fontFamily: fd, fontStyle: "italic", textTransform: "uppercase",
      letterSpacing: 1.5, fontSize: 15, padding: "15px 30px",
      borderRadius: 12,
      border: ghost ? `1px solid ${T.cardBorder}` : "none",
      background: ghost ? "transparent" : disabled ? "#27314f" : `linear-gradient(100deg, ${T.neon}, #00d9a3)`,
      color: ghost ? T.dim : disabled ? "#5a6481" : "#04140c",
      cursor: disabled ? "default" : "pointer",
      width: "100%",
    }}
  >
    {children}
  </button>
);

const PtsBadge = ({ pts }) => (
  <span
    style={{
      fontFamily: fd, fontStyle: "italic", fontSize: 12,
      color: "#04140c", background: T.gold, borderRadius: 8,
      padding: "4px 10px", letterSpacing: 1, whiteSpace: "nowrap",
    }}
  >
    +{pts} PT
  </span>
);

const RankPill = ({ team }) => (
  <span
    style={{
      fontFamily: fd, fontSize: 9.5, color: T.dim,
      background: "rgba(255,255,255,.06)",
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 6, padding: "2.5px 7px",
      letterSpacing: 0.5, whiteSpace: "nowrap",
    }}
    title="Ranking FIFA (1 aprile 2026)"
  >
    FIFA #{FIFA_RANK[team]}
  </span>
);

function ScreenHeader({ icon, title, sub, pts, team }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          {team ? <div style={{ marginBottom: 8 }}><Flag team={team} size={46} /></div> : <div style={{ fontSize: 38 }}>{icon}</div>}
          <H1>{title}</H1>
        </div>
        <PtsBadge pts={pts} />
      </div>
      {sub && <p style={{ color: T.dim, fontSize: 13.5, fontFamily: fb, margin: "8px 0 16px" }}>{sub}</p>}
    </>
  );
}

// ════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════
function Home({ go, countdown, locked }) {
  const cell = (v, l) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: fd, fontSize: 30, color: T.neon, fontStyle: "italic", textShadow: "0 0 16px rgba(0,255,135,.5)" }}>
        {String(v).padStart(2, "0")}
      </div>
      <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: 2 }}>{l}</div>
    </div>
  );
  return (
    <div
      className="screen"
      style={{
        textAlign: "center",
        minHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div className="floaty" style={{ fontSize: 64, filter: "drop-shadow(0 0 24px rgba(251,191,36,.5))" }}>🏆</div>
      <div style={{ fontFamily: fd, fontStyle: "italic", fontSize: 12, letterSpacing: 5, color: T.violet, textTransform: "uppercase", marginTop: 8 }}>
        World Cup 26 · Prediction Game
      </div>
      <H1 style={{ marginTop: 6 }}>
        <span style={{ color: T.neon }}>ORACOLO</span><br />MONDIALE
      </H1>
      <p style={{ color: T.dim, fontFamily: fb, fontSize: 14, maxWidth: 320, margin: "14px auto 0", lineHeight: 1.6 }}>
        22 pronostici. 48 squadre. Un solo profeta.
      </p>
      <div style={{ display: "flex", gap: 22, justifyContent: "center", margin: "26px 0", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 10px" }}>
        {locked ? (
          <div style={{ fontFamily: fd, fontStyle: "italic", color: T.pink, fontSize: 18, textTransform: "uppercase" }}>Pronostici chiusi</div>
        ) : (
          <>
            {cell(countdown.d, "giorni")}{cell(countdown.h, "ore")}{cell(countdown.m, "min")}{cell(countdown.s, "sec")}
          </>
        )}
      </div>
      <div style={{ display: "grid", gap: 10, maxWidth: 340, margin: "0 auto" }}>
        <div className="glow" style={{ borderRadius: 12 }}>
          <NeonBtn onClick={() => go(1)}>▶ Entra nella storia</NeonBtn>
        </div>
        <NeonBtn ghost onClick={() => go("leaderboard")}>Classifica</NeonBtn>
        <NeonBtn ghost onClick={() => go("rules")}>Regole & punti</NeonBtn>
      </div>
    </div>
  );
}

// GIRONE: trascina le squadre su/giù per ordinarle (ordine iniziale = ranking FIFA)
function GroupScreen({ group, order, setOrder, onConfirm, resetOrder }) {
  const STEP = 82; // altezza card (72) + gap (10)
  const drag = useRef({ idx: null, startY: 0 });
  const orderRef = useRef(order);
  const [dragIdx, setDragIdx] = useState(null);
  const [dy, setDy] = useState(0);
  useEffect(() => { orderRef.current = order; }, [order]);

  const moveItem = (arr, from, to) => {
    const c = [...arr];
    const [x] = c.splice(from, 1);
    c.splice(to, 0, x);
    return c;
  };

  const down = (e, i) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { idx: i, startY: e.clientY };
    setDragIdx(i);
    setDy(0);
  };
  const moveH = (e) => {
    const d = drag.current;
    if (d.idx === null) return;
    let delta = e.clientY - d.startY;
    if (delta > STEP * 0.55 && d.idx < 3) {
      setOrder(group.id, moveItem(orderRef.current, d.idx, d.idx + 1));
      d.idx += 1; d.startY += STEP; delta -= STEP;
    } else if (delta < -STEP * 0.55 && d.idx > 0) {
      setOrder(group.id, moveItem(orderRef.current, d.idx, d.idx - 1));
      d.idx -= 1; d.startY -= STEP; delta += STEP;
    }
    setDragIdx(d.idx);
    setDy(delta);
  };
  const up = () => {
    drag.current.idx = null;
    setDragIdx(null);
    setDy(0);
  };

  const rankColors = ["#fbbf24", "#cbd5e1", "#fb923c", "#475569"];

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
        <H1>Girone <span style={{ color: T.neon }}>{group.id}</span></H1>
        <PtsBadge pts="3/1" />
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {order.map((team, i) => {
          const dragging = dragIdx === i;
          return (
            <div
              key={team}
              onPointerDown={(e) => down(e, i)}
              onPointerMove={moveH}
              onPointerUp={up}
              onPointerCancel={up}
              role="button"
              aria-label={`${team}, posizione ${i + 1}. Trascina per spostare`}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "0 16px", borderRadius: 14,
                height: 72, boxSizing: "border-box",
                border: i < 2 ? `1px solid ${T.neon}` : `1px solid ${T.cardBorder}`,
                background:
                  i < 2
                    ? "linear-gradient(95deg, rgba(0,255,135,.14), rgba(0,255,135,.04))"
                    : T.card,
                cursor: "grab",
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                transform: dragging ? `translateY(${dy}px) scale(1.03)` : "none",
                transition: dragging ? "none" : "transform .18s, background .18s, border .18s",
                zIndex: dragging ? 10 : 1,
                position: "relative",
                boxShadow: dragging ? "0 10px 30px rgba(0,0,0,.55), 0 0 18px rgba(0,255,135,.25)" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: fd, fontStyle: "italic", fontSize: 15,
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: rankColors[i], color: "#0a0e1a",
                  boxShadow: i < 2 ? "0 0 14px rgba(0,255,135,.4)" : "none",
                }}
              >
                {i + 1}°
              </span>
              <Flag team={team} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: fd, fontStyle: "italic", fontSize: 15, color: T.text, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {team}
                </span>
                <RankPill team={team} />
              </span>
              <span style={{ color: "#4a5375", fontSize: 20, letterSpacing: -2, flexShrink: 0, lineHeight: 1 }}>⋮⋮</span>
            </div>
          );
        })}
      </div>

      {/* CONFERMA — subito sotto le card */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => resetOrder(group.id)}
          aria-label="Ripristina ordine ranking"
          style={{
            flex: "0 0 auto", padding: "13px 18px", borderRadius: 12,
            border: `1px solid ${T.cardBorder}`, background: "transparent",
            color: T.dim, fontFamily: fb, fontSize: 14, cursor: "pointer",
          }}
        >
          ↺
        </button>
        <div style={{ flex: 1 }} className="glow">
          <NeonBtn onClick={onConfirm}>Conferma girone {group.id} →</NeonBtn>
        </div>
      </div>
    </div>
  );
}

function TeamScreen({ step, value, setValue, next }) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const priority = step.mode === "underdogs" ? UNDERDOGS : FAVORITES;
  const rest = useMemo(() => {
    const sorted = step.mode === "underdogs" ? [...BY_RANK].reverse() : BY_RANK;
    return sorted.filter((t) => !priority.includes(t));
  }, [step.mode, priority]);
  const filtered = q ? ALL_TEAMS.filter((t) => t.toLowerCase().includes(q.toLowerCase())) : null;

  const select = (t) => {
    setValue(t);
    setTimeout(next, 380);
  };

  const Row = ({ t, dim }) => (
    <button
      onClick={() => select(t)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 14px", borderRadius: 12, width: "100%",
        border: value === t ? `1px solid ${T.neon}` : `1px solid ${T.cardBorder}`,
        background: value === t ? "rgba(0,255,135,.13)" : dim ? "rgba(255,255,255,0.025)" : T.card,
        cursor: "pointer", textAlign: "left",
        boxShadow: value === t ? "0 0 16px rgba(0,255,135,.3)" : "none",
      }}
    >
      <Flag team={t} />
      <span style={{ flex: 1, fontFamily: fb, fontWeight: 600, fontSize: 14.5, color: T.text }}>{t}</span>
      <RankPill team={t} />
    </button>
  );

  return (
    <div className="screen">
      <ScreenHeader icon={step.icon} title={step.title} sub={step.sub} pts={step.pts} />
      <input
        placeholder="Cerca una nazionale…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "13px 16px",
          borderRadius: 12, border: `1px solid ${T.cardBorder}`,
          background: T.card, color: T.text, fontFamily: fb, fontSize: 15, marginBottom: 16,
        }}
      />
      {filtered ? (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((t) => <Row key={t} t={t} />)}
          {filtered.length === 0 && (
            <p style={{ color: T.dim, fontFamily: fb, fontSize: 13 }}>Nessuna nazionale trovata tra le 48 qualificate.</p>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontFamily: fd, fontStyle: "italic", fontSize: 11, letterSpacing: 2.5, color: step.mode === "underdogs" ? T.pink : T.gold, textTransform: "uppercase", marginBottom: 10 }}>
            {step.mode === "underdogs" ? "💀 Le indiziate" : "⭐ Le favorite"}
          </div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {priority.map((t) => <Row key={t} t={t} />)}
          </div>
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              width: "100%", padding: "12px", borderRadius: 12,
              border: `1px dashed ${T.cardBorder}`, background: "transparent",
              color: T.dim, fontFamily: fb, fontSize: 13.5, cursor: "pointer", marginBottom: 12,
            }}
          >
            {showAll ? "▲ Nascondi le altre" : `▼ Tutte le altre nazionali (${rest.length})`}
          </button>
          {showAll && (
            <div style={{ display: "grid", gap: 8 }}>
              {rest.map((t) => <Row key={t} t={t} dim />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// PREMI INDIVIDUALI: lista candidati (ordinati per quota, quota non mostrata)
function PlayerScreen({ step, value, setValue, next }) {
  const candidates = CANDIDATES[step.key] || [];
  const compact = candidates.length > 12;
  const isCustom = value && !candidates.some(([n]) => n === value);
  const select = (name) => {
    setValue(name);
    setTimeout(next, 380);
  };
  return (
    <div className="screen">
      <ScreenHeader icon={step.icon} title={step.title} sub={step.sub} pts={step.pts} />
      <div style={{ fontFamily: fd, fontStyle: "italic", fontSize: 11, letterSpacing: 2.5, color: T.gold, textTransform: "uppercase", marginBottom: 10 }}>
        ⭐ I candidati
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "repeat(2, 1fr)" : "1fr",
          gap: 8, marginBottom: 18,
        }}
      >
        {candidates.map(([name, team]) => (
          <button
            key={name}
            onClick={() => select(name)}
            style={{
              display: "flex", alignItems: "center", gap: compact ? 8 : 12,
              padding: compact ? "10px 10px" : "13px 14px",
              borderRadius: 12, width: "100%", minWidth: 0,
              border: value === name ? `1px solid ${T.neon}` : `1px solid ${T.cardBorder}`,
              background: value === name ? "rgba(0,255,135,.13)" : T.card,
              cursor: "pointer", textAlign: "left",
              boxShadow: value === name ? "0 0 16px rgba(0,255,135,.3)" : "none",
            }}
          >
            <Flag team={team} size={compact ? 22 : 30} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: fd, fontStyle: "italic", fontSize: compact ? 12 : 14.5, color: T.text, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            {!compact && <span style={{ fontFamily: fb, fontSize: 11, color: T.dim }}>{team}</span>}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.dim, fontFamily: fb, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.5 }}>
        Non è in lista? Scrivilo
      </div>
      <input
        placeholder="Nome giocatore…"
        value={isCustom ? value : ""}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "13px 16px",
          borderRadius: 12, border: isCustom ? `1px solid ${T.neon}` : `1px solid ${T.cardBorder}`,
          background: T.card, color: T.text, fontFamily: fb, fontSize: 15,
        }}
      />
      {isCustom && (
        <div style={{ marginTop: 12 }}>
          <NeonBtn onClick={next}>Conferma "{value}" →</NeonBtn>
        </div>
      )}
    </div>
  );
}

function NumberScreen({ step, value, setValue }) {
  const v = value === "" ? 0 : Number(value);
  const set = (n) => setValue(String(Math.max(0, Math.min(25, n))));
  const isCR7 = step.key === "ronaldoGoals";
  const quip = () => {
    if (isCR7) {
      if (v === 5 || v === 6) return "SIUUUUUUU! 🗣️";
      if (v === 7) return "CR7 a quota 7. Poetico.";
      if (v >= 8) return "Non male questo vecchiettino.";
      if (v === 0) return "Zero gol? Coraggioso.";
      return "gol nel torneo";
    }
    if (v === 10) return "Dieci, come la sua maglia.";
    if (v >= 5) return "🐐";
    if (v === 0) return "Zero gol? Coraggioso.";
    return "gol nel torneo";
  };
  const q = quip();
  const special = q !== "gol nel torneo" && q !== "Zero gol? Coraggioso." && q !== "Ottimista spinto. Rispetto.";
  const isGoat = q === "🐐";
  return (
    <div className="screen" style={{ textAlign: "center" }}>
      <div style={{ textAlign: "left" }}>
        <ScreenHeader title={step.title} sub={step.sub} pts={step.pts} team={step.team} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, marginTop: 24 }}>
        <button onClick={() => set(v - 1)} style={stepBtn} aria-label="Diminuisci">−</button>
        <div style={{ fontFamily: fd, fontStyle: "italic", fontSize: 88, color: T.neon, width: 130, textShadow: "0 0 30px rgba(0,255,135,.55)", lineHeight: 1 }}>
          {v}
        </div>
        <button onClick={() => set(v + 1)} style={stepBtn} aria-label="Aumenta">+</button>
      </div>
      <div
        key={q}
        className={special ? "rankBadge" : ""}
        style={{
          color: special ? T.gold : T.dim,
          fontFamily: special ? fd : fb,
          fontStyle: special ? "italic" : "normal",
          fontSize: isGoat ? 44 : special ? 20 : 13,
          marginTop: 16,
          textTransform: special && !isGoat ? "uppercase" : "none",
          letterSpacing: special ? 1 : 0,
          textShadow: special ? "0 0 18px rgba(251,191,36,.4)" : "none",
        }}
      >
        {q}
      </div>
    </div>
  );
}

const stepBtn = {
  width: 64, height: 64, borderRadius: "50%",
  border: `1px solid ${T.cardBorder}`, background: T.card,
  color: T.text, fontSize: 32, cursor: "pointer", fontFamily: fd,
};

function Summary({ orders, secche, confirmedGroups, go, locked, nome, setNome, dbReady, onSent }) {
  const [exportText, setExportText] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const groupsDone = GROUPS.filter((g) => confirmedGroups[g.id]).length;
  const seccheDone = Object.values(secche).filter((v) => v !== "").length;
  const complete = groupsDone === 12 && seccheDone === 10;

  const invia = async () => {
    setErr("");
    const n = nome.trim();
    if (n.length < 2) { setErr("Scrivi il tuo nome (almeno 2 caratteri)."); return; }
    if (nomeVolgare(n)) { setErr("Questo nome non è ammesso. Scegline un altro."); return; }
    setSending(true);
    try {
      // controllo doppioni
      const esistenti = await sb.select("predictions", "select=nome");
      if (esistenti.some((r) => normNome(r.nome) === normNome(n))) {
        setErr("Questo nome ha già giocato. Scegline un altro o contatta l'organizzatore.");
        setSending(false);
        return;
      }
      await sb.insert("predictions", { nome: n, gironi: orders, secche });
      onSent();
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes("deadline") || msg.includes("policy") || msg.includes("42501")) {
        setErr("Pronostici chiusi: la deadline è passata.");
      } else {
        setErr("Errore di invio. Controlla la connessione e riprova.");
      }
      setSending(false);
    }
  };

  const exportJSON = () => {
    const data = JSON.stringify({ nome, gironi: orders, secche, exportedAt: new Date().toISOString() }, null, 2);
    setExportText(data);
    setCopied(false);
    try {
      const blob = new Blob([data], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pronostici-mondiali-2026.json";
      a.click();
    } catch (e) { /* fallback modal */ }
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
    } catch (e) {
      const ta = document.getElementById("export-ta");
      if (ta) {
        ta.focus();
        ta.select();
        try { document.execCommand("copy"); setCopied(true); } catch (_) {}
      }
    }
  };

  const row = (label, value, icon, withFlag) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
      <span style={{ fontSize: 17, width: 24, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1, color: T.dim, fontFamily: fb, fontSize: 13 }}>{label}</span>
      {withFlag && value && <Flag team={value} size={20} />}
      <span style={{ fontFamily: fd, fontStyle: "italic", fontSize: 13, color: value ? T.text : T.pink }}>
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="screen">
      <H1>La tua <span style={{ color: T.neon }}>giocata</span></H1>
      <p style={{ color: T.dim, fontSize: 13.5, fontFamily: fb, margin: "8px 0 16px" }}>
        Gironi: {groupsDone}/12 · Secche: {seccheDone}/10
      </p>

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "4px 16px", marginBottom: 16 }}>
        {row("Vincitore", secche.winner, "🏆", true)}
        {row("Capocannoniere", secche.topScorer, "⚽")}
        {row("Assistman", secche.topAssist, "🎯")}
        {row("Golden Ball", secche.bestPlayer, "🌟")}
        {row("Golden Glove", secche.bestGK, "🧤")}
        {row("Miglior giovane", secche.youngPlayer, "🌱")}
        {row("Re dei cartellini", secche.mostCards, "🟨")}
        {row("Peggior diff. reti", secche.worstGD, "💀", true)}
        {row("Gol Ronaldo", secche.ronaldoGoals, "⚽")}
        {row("Gol Messi", secche.messiGoals, "⚽")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8, marginBottom: 20 }}>
        {GROUPS.map((g, gi) => (
          <button
            key={g.id}
            onClick={() => go(1 + gi)}
            style={{
              background: confirmedGroups[g.id] ? "rgba(0,255,135,.1)" : T.card,
              border: `1px solid ${confirmedGroups[g.id] ? T.neon : T.pink}`,
              borderRadius: 10, padding: "8px 6px", color: T.text,
              fontFamily: fd, fontStyle: "italic", fontSize: 11, cursor: "pointer",
            }}
          >
            GIR. {g.id} {confirmedGroups[g.id] ? "✓" : "!"}
          </button>
        ))}
      </div>

      {!locked && (
        <div style={{ display: "grid", gap: 10 }}>
          {dbReady && (
            <input
              placeholder="Il tuo nome (come apparirai in classifica)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={24}
              style={{
                width: "100%", boxSizing: "border-box", padding: "14px 16px",
                borderRadius: 12, border: `1px solid ${err ? T.pink : T.cardBorder}`,
                background: T.card, color: T.text, fontFamily: fb, fontSize: 15,
                textAlign: "center",
              }}
            />
          )}
          {err && (
            <div style={{ color: T.pink, fontFamily: fb, fontSize: 13, textAlign: "center" }}>{err}</div>
          )}
          {dbReady ? (
            <div className={complete && !sending ? "glow" : ""} style={{ borderRadius: 12 }}>
              <NeonBtn disabled={!complete || sending} onClick={invia}>
                {sending ? "Invio in corso…" : complete ? "Invia la giocata (definitiva)" : "Completa tutti i pronostici"}
              </NeonBtn>
            </div>
          ) : (
            <div className={complete ? "glow" : ""} style={{ borderRadius: 12 }}>
              <NeonBtn disabled={!complete} onClick={exportJSON}>
                {complete ? "⬇ Esporta / copia la giocata" : "Completa tutti i pronostici"}
              </NeonBtn>
            </div>
          )}
          {dbReady && (
            <NeonBtn ghost onClick={exportJSON}>⬇ Esporta / copia (backup)</NeonBtn>
          )}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: T.dim, fontFamily: fb, marginTop: 10, lineHeight: 1.5 }}>
        {dbReady
          ? "L'invio è definitivo: una volta inviata, la giocata non si può più modificare. Si chiude comunque al fischio d'inizio."
          : "Anteprima senza database: usa Esporta per salvare la giocata. Online (Vercel) l'invio sarà diretto in classifica."}
      </p>

      {/* MODAL EXPORT */}
      {exportText && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(4,7,15,.8)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setExportText(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg2, border: `1px solid ${T.cardBorder}`,
              borderRadius: 16, padding: 18, width: "100%", maxWidth: 480,
            }}
          >
            <div style={{ fontFamily: fd, fontStyle: "italic", textTransform: "uppercase", color: T.text, fontSize: 15, letterSpacing: 1, marginBottom: 8 }}>
              La tua giocata 📋
            </div>
            <p style={{ color: T.dim, fontFamily: fb, fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
              Copia tutto e incollalo nel gruppo (o salvalo come file .json). Se il download non è partito, è il blocco dell'anteprima: qui sotto hai tutto.
            </p>
            <textarea
              id="export-ta"
              readOnly
              value={exportText}
              onFocus={(e) => e.target.select()}
              style={{
                width: "100%", boxSizing: "border-box", height: 200,
                background: "rgba(0,0,0,.4)", color: T.neon,
                border: `1px solid ${T.cardBorder}`, borderRadius: 10,
                fontFamily: "monospace", fontSize: 11, padding: 10, resize: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <NeonBtn onClick={copyExport}>{copied ? "✓ Copiato!" : "Copia"}</NeonBtn>
              </div>
              <button
                onClick={() => setExportText(null)}
                style={{
                  flex: "0 0 auto", padding: "13px 20px", borderRadius: 12,
                  border: `1px solid ${T.cardBorder}`, background: "transparent",
                  color: T.dim, fontFamily: fb, fontSize: 14, cursor: "pointer",
                }}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ go, dbReady }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const medals = ["🥇", "🥈", "🥉"];

  useEffect(() => {
    if (!dbReady) {
      const demo = [...FAKE_LEADERBOARD].map((r) => ({ nome: r.name, gironi: r.gironi, secche: r.secche, tot: r.gironi + r.secche }));
      setRows(demo.sort((a, b) => b.tot - a.tot));
      return;
    }
    (async () => {
      try {
        const [preds, resArr] = await Promise.all([
          sb.select("predictions", "select=nome,gironi,secche"),
          sb.select("results", "select=gironi,secche&id=eq.1"),
        ]);
        const results = resArr[0] || { gironi: {}, secche: {} };
        const scored = preds.map((p) => {
          const s = scorePrediction(p, results);
          return { nome: p.nome, gironi: s.gironi, secche: s.secche, tot: s.tot };
        });
        setRows(scored.sort((a, b) => b.tot - a.tot));
      } catch (e) {
        setErr("Impossibile caricare la classifica. Riprova tra poco.");
        setRows([]);
      }
    })();
  }, [dbReady]);

  return (
    <div className="screen">
      <H1>Class<span style={{ color: T.neon }}>ifica</span></H1>
      <p style={{ color: T.dim, fontSize: 12.5, fontFamily: fb, margin: "8px 0 16px" }}>
        {!dbReady
          ? "⚠ Anteprima: dati di esempio. Online sarà la classifica vera."
          : "Punti reali · si aggiorna quando l'organizzatore inserisce i risultati."}
      </p>
      {err && <p style={{ color: T.pink, fontFamily: fb, fontSize: 13 }}>{err}</p>}
      {rows === null && <p style={{ color: T.dim, fontFamily: fb }}>Carico…</p>}
      {rows && rows.length === 0 && !err && (
        <p style={{ color: T.dim, fontFamily: fb, fontSize: 14 }}>Nessuna giocata ancora. Sii il primo!</p>
      )}
      {rows && rows.map((r, i) => (
        <div
          key={r.nome}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: i === 0 ? "linear-gradient(95deg, rgba(251,191,36,.14), rgba(251,191,36,.03))" : T.card,
            border: `1px solid ${i === 0 ? T.gold : T.cardBorder}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 24, width: 32 }}>{medals[i] || `${i + 1}°`}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: fd, fontStyle: "italic", color: T.text, fontSize: 15, textTransform: "uppercase" }}>{r.nome}</div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: fb }}>Gironi {r.gironi} · Secche {r.secche}</div>
          </div>
          <div style={{ fontFamily: fd, fontStyle: "italic", fontSize: 26, color: i === 0 ? T.gold : T.neon }}>{r.tot}</div>
        </div>
      ))}
      <NeonBtn ghost onClick={() => go(0)}>← Home</NeonBtn>
    </div>
  );
}

function Rules({ go }) {
  const items = [
    ["Posizione esatta nel girone", "3"],
    ["Qualificata, posizione sbagliata", "1"],
    ["Vincitore del torneo", "15"],
    ["Capocannoniere", "10"],
    ["Miglior assistman", "10"],
    ["Golden Ball (FIFA)", "8"],
    ["Golden Glove (FIFA)", "8"],
    ["Miglior giovane (FIFA)", "8"],
    ["Re dei cartellini (giallo 1, rosso 2)", "10"],
    ["Peggior differenza reti", "6"],
    ["Gol esatti Ronaldo", "5"],
    ["Gol esatti Messi", "5"],
  ];
  return (
    <div className="screen">
      <H1>Regole <span style={{ color: T.neon }}>& punti</span></H1>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "6px 16px", margin: "16px 0" }}>
        {items.map(([l, p]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
            <span style={{ color: T.text, fontFamily: fb, fontSize: 13.5 }}>{l}</span>
            <span style={{ fontFamily: fd, fontStyle: "italic", color: T.neon, fontSize: 14 }}>+{p}</span>
          </div>
        ))}
      </div>
      <p style={{ color: T.dim, fontSize: 12.5, fontFamily: fb, lineHeight: 1.6 }}>
        Pronostici chiusi al fischio d'inizio di Messico–Sudafrica (11/6, ore 21 italiane). Fonti ufficiali FIFA per classifiche e premi. Gli scontri diretti si sbloccano a fine gironi.
      </p>
      <NeonBtn ghost onClick={() => go(0)}>← Home</NeonBtn>
    </div>
  );
}

// ════════════════════════════════════════════
// SCHERMATA POST-INVIO
// ════════════════════════════════════════════
function Sent({ go, nome }) {
  return (
    <div className="screen" style={{ textAlign: "center", minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="floaty" style={{ fontSize: 64 }}>🎯</div>
      <H1 style={{ marginTop: 12 }}>Giocata <span style={{ color: T.neon }}>inviata!</span></H1>
      <p style={{ color: T.dim, fontFamily: fb, fontSize: 15, margin: "14px auto 0", maxWidth: 320, lineHeight: 1.6 }}>
        {nome}, la tua bolletta è registrata e bloccata. Ora si aspetta il fischio d'inizio. Che gli dei del pallone siano con te.
      </p>
      <div style={{ display: "grid", gap: 10, maxWidth: 320, margin: "26px auto 0" }}>
        <NeonBtn onClick={() => go("leaderboard")}>Vai alla classifica</NeonBtn>
        <NeonBtn ghost onClick={() => go(0)}>Home</NeonBtn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// PAGINA ADMIN — inserimento risultati (protetta da password)
// ════════════════════════════════════════════
function Admin({ go }) {
  const [pwd, setPwd] = useState("");
  const [auth, setAuth] = useState(false);
  const [gironi, setGironi] = useState({});
  const [secche, setSecche] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [giocate, setGiocate] = useState(null);
  const [delMsg, setDelMsg] = useState("");

  const caricaGiocate = async () => {
    try {
      const g = await sb.select("predictions", "select=id,nome,created_at&order=created_at.asc");
      setGiocate(g);
    } catch (e) { setGiocate([]); }
  };

  useEffect(() => {
    if (!auth) return;
    (async () => {
      try {
        const r = await sb.select("results", "select=gironi,secche&id=eq.1");
        if (r[0]) { setGironi(r[0].gironi || {}); setSecche(r[0].secche || {}); }
      } catch (e) { /* tabella vuota o offline */ }
    })();
    caricaGiocate();
  }, [auth]);

  const elimina = async (id, nome) => {
    if (typeof window !== "undefined" && !window.confirm(`Eliminare la giocata di "${nome}"? L'azione è definitiva.`)) return;
    setDelMsg("");
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/predictions?id=eq.${id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Prefer: "return=minimal" },
      });
      if (!r.ok) throw new Error(r.status);
      setDelMsg(`✓ Giocata di "${nome}" eliminata.`);
      caricaGiocate();
    } catch (e) {
      setDelMsg("Errore nell'eliminazione: " + (e.message || e));
    }
  };

  if (!auth) {
    return (
      <div className="screen" style={{ maxWidth: 360, margin: "40px auto 0" }}>
        <H1>Area <span style={{ color: T.neon }}>admin</span></H1>
        <p style={{ color: T.dim, fontFamily: fb, fontSize: 13, margin: "10px 0 16px" }}>Solo per l'organizzatore.</p>
        <input
          type="password"
          placeholder="Password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setAuth(pwd === ADMIN_PASSWORD)}
          style={{
            width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 12,
            border: `1px solid ${T.cardBorder}`, background: T.card, color: T.text, fontFamily: fb, fontSize: 15, marginBottom: 10,
          }}
        />
        {pwd && pwd !== ADMIN_PASSWORD && (
          <p style={{ color: T.pink, fontSize: 12, fontFamily: fb }}>Password errata.</p>
        )}
        <NeonBtn onClick={() => setAuth(pwd === ADMIN_PASSWORD)}>Entra</NeonBtn>
        <div style={{ marginTop: 10 }}>
          <NeonBtn ghost onClick={() => go(0)}>← Home</NeonBtn>
        </div>
      </div>
    );
  }

  const rankColors = ["#fbbf24", "#cbd5e1", "#fb923c", "#475569"];
  const cycleTeam = (gid, slot, team) => {
    // assegna 'team' allo slot indicato nei risultati del girone
    setGironi((p) => {
      const cur = [...(p[gid] || [])];
      // rimuovi team se già presente altrove
      const filtered = cur.filter((t) => t !== team);
      filtered[slot] = team;
      return { ...p, [gid]: filtered };
    });
  };

  const salva = async () => {
    setLoading(true); setMsg("");
    try {
      await sb.upsert("results", { id: 1, gironi, secche, updated_at: new Date().toISOString() });
      setMsg("✓ Risultati salvati. La classifica è aggiornata.");
    } catch (e) {
      setMsg("Errore nel salvataggio: " + (e.message || e));
    }
    setLoading(false);
  };

  return (
    <div className="screen">
      <H1>Risultati <span style={{ color: T.neon }}>reali</span></H1>
      <p style={{ color: T.dim, fontFamily: fb, fontSize: 13, margin: "8px 0 18px", lineHeight: 1.5 }}>
        Inserisci man mano. Puoi salvare più volte (prima i gironi, poi i premi). La classifica usa solo i campi compilati.
      </p>

      <div style={{ fontFamily: fd, fontStyle: "italic", color: T.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
        Ordine finale dei gironi
      </div>
      {GROUPS.map((g) => {
        const res = gironi[g.id] || [];
        return (
          <div key={g.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontFamily: fd, fontStyle: "italic", color: T.text, fontSize: 13, marginBottom: 8 }}>Girone {g.id}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {[0, 1, 2, 3].map((slot) => (
                <div key={slot} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: rankColors[slot], color: "#0a0e1a", fontFamily: fd, fontStyle: "italic", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {slot + 1}°
                  </span>
                  <select
                    value={res[slot] || ""}
                    onChange={(e) => cycleTeam(g.id, slot, e.target.value)}
                    style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.bg2, color: T.text, fontFamily: fb, fontSize: 13 }}
                  >
                    <option value="">—</option>
                    {g.teams.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontFamily: fd, fontStyle: "italic", color: T.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", margin: "18px 0 10px" }}>
        Premi e categorie
      </div>
      {[
        ["winner", "Vincitore"], ["topScorer", "Capocannoniere"], ["topAssist", "Miglior assistman"],
        ["bestPlayer", "Golden Ball"], ["bestGK", "Golden Glove"], ["youngPlayer", "Miglior giovane"],
        ["mostCards", "Re dei cartellini"], ["worstGD", "Peggior diff. reti"],
        ["ronaldoGoals", "Gol Ronaldo"], ["messiGoals", "Gol Messi"],
      ].map(([k, label]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ flex: "0 0 130px", color: T.dim, fontFamily: fb, fontSize: 12.5 }}>{label}</span>
          <input
            value={secche[k] || ""}
            onChange={(e) => setSecche((p) => ({ ...p, [k]: e.target.value }))}
            placeholder="risultato"
            style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.bg2, color: T.text, fontFamily: fb, fontSize: 13 }}
          />
        </div>
      ))}

      {msg && <p style={{ color: msg.startsWith("✓") ? T.neon : T.pink, fontFamily: fb, fontSize: 13, marginTop: 12 }}>{msg}</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <NeonBtn onClick={salva} disabled={loading}>{loading ? "Salvataggio…" : "Salva risultati"}</NeonBtn>
      </div>

      {/* GESTIONE GIOCATE */}
      <div style={{ fontFamily: fd, fontStyle: "italic", color: T.pink, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", margin: "26px 0 10px" }}>
        Giocate ricevute {giocate ? `(${giocate.length})` : ""}
      </div>
      {delMsg && <p style={{ color: delMsg.startsWith("✓") ? T.neon : T.pink, fontFamily: fb, fontSize: 13, marginBottom: 8 }}>{delMsg}</p>}
      {giocate === null && <p style={{ color: T.dim, fontFamily: fb, fontSize: 13 }}>Carico…</p>}
      {giocate && giocate.length === 0 && <p style={{ color: T.dim, fontFamily: fb, fontSize: 13 }}>Nessuna giocata ancora.</p>}
      {giocate && giocate.map((g) => (
        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <span style={{ flex: 1, fontFamily: fd, fontStyle: "italic", color: T.text, fontSize: 14 }}>{g.nome}</span>
          <span style={{ fontFamily: fb, fontSize: 10.5, color: T.dim }}>
            {new Date(g.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={() => elimina(g.id, g.nome)}
            style={{ background: "rgba(236,72,153,.12)", border: `1px solid ${T.pink}`, color: T.pink, borderRadius: 8, padding: "7px 12px", fontFamily: fb, fontSize: 12, cursor: "pointer" }}
          >
            Elimina
          </button>
        </div>
      ))}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <NeonBtn ghost onClick={() => go(0)}>← Home</NeonBtn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// APP SHELL
// ════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState(0);
  const [nome, setNome] = useState("");
  const [dbReady, setDbReady] = useState(false);
  const [orders, setOrders] = useState(
    Object.fromEntries(GROUPS.map((g) => [g.id, [...g.teams].sort((a, b) => FIFA_RANK[a] - FIFA_RANK[b])]))
  );
  const [confirmedGroups, setConfirmedGroups] = useState({});
  const [secche, setSecche] = useState({
    winner: "", topScorer: "", topAssist: "", bestPlayer: "",
    bestGK: "", youngPlayer: "", mostCards: "", worstGD: "",
    ronaldoGoals: "", messiGoals: "",
  });
  const countdown = useCountdown(DEADLINE);
  const locked = countdown.expired;

  // Verifica se Supabase è raggiungibile (online sì, anteprima no)
  useEffect(() => {
    (async () => {
      try {
        await sb.select("config", "select=id&limit=1");
        setDbReady(true);
      } catch (e) {
        setDbReady(false);
      }
    })();
    // accesso admin via #admin nell'URL
    if (typeof window !== "undefined" && window.location.hash === "#admin") {
      setScreen("admin");
    }
  }, []);

  const isStep = typeof screen === "number";
  const stepIdx = isStep ? screen : 0;
  const step = STEPS[stepIdx];
  const totalQuestions = STEPS.length - 2;
  const progress = isStep && stepIdx > 0 ? Math.min(stepIdx, totalQuestions) : 0;

  const next = () => setScreen((s) => (typeof s === "number" ? Math.min(STEPS.length - 1, s + 1) : s));
  const back = () => setScreen((s) => (typeof s === "number" ? Math.max(0, s - 1) : 0));
  const setRanking = (gid, arr) => setOrders((p) => ({ ...p, [gid]: arr }));
  const resetOrder = (gid) => {
    const g = GROUPS.find((x) => x.id === gid);
    setOrders((p) => ({ ...p, [gid]: [...g.teams].sort((a, b) => FIFA_RANK[a] - FIFA_RANK[b]) }));
  };
  const confirmGroup = (gid) => {
    setConfirmedGroups((p) => ({ ...p, [gid]: true }));
    next();
  };
  const setSecca = (k) => (v) => setSecche((p) => ({ ...p, [k]: v }));

  const prevLabel = (() => {
    if (!isStep || stepIdx === 0) return "";
    const prev = STEPS[stepIdx - 1];
    if (prev.type === "home") return "Home";
    if (prev.type === "group") return `Girone ${prev.group.id}`;
    return prev.title;
  })();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 600px at 80% -10%, rgba(139,92,246,.18), transparent), radial-gradient(900px 500px at -10% 110%, rgba(0,255,135,.10), transparent), linear-gradient(160deg, ${T.bg} 0%, ${T.bg2} 100%)`,
        color: T.text,
        fontFamily: fb,
      }}
    >
      <style>{css}</style>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 48px" }}>
        {isStep && stepIdx > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button
                onClick={back}
                aria-label={`Torna a ${prevLabel}`}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 999, color: T.text, padding: "9px 14px",
                  fontSize: 13, cursor: "pointer", fontFamily: fb, whiteSpace: "nowrap",
                }}
              >
                ← {prevLabel}
              </button>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(progress / totalQuestions) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${T.neon}, ${T.violet})`, borderRadius: 3, transition: "width .3s" }} />
              </div>
              <span style={{ fontFamily: fd, fontStyle: "italic", fontSize: 12, color: T.dim }}>
                {Math.min(stepIdx, totalQuestions)}/{totalQuestions}
              </span>
            </div>
            {step.type !== "summary" && (
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={next}
                  style={{
                    background: "transparent", border: `1px solid ${T.cardBorder}`,
                    borderRadius: 999, color: T.dim, padding: "7px 14px",
                    fontFamily: fb, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Salta, ci torno dopo →
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "leaderboard" && <Leaderboard go={setScreen} dbReady={dbReady} />}
        {screen === "rules" && <Rules go={setScreen} />}
        {screen === "admin" && <Admin go={setScreen} />}
        {screen === "sent" && <Sent go={setScreen} nome={nome} />}
        {isStep && step.type === "home" && <Home go={setScreen} countdown={countdown} locked={locked} />}
        {isStep && step.type === "group" && (
          <GroupScreen
            group={step.group}
            order={orders[step.group.id]}
            setOrder={setRanking}
            resetOrder={resetOrder}
            onConfirm={() => confirmGroup(step.group.id)}
          />
        )}
        {isStep && step.type === "team" && (
          <TeamScreen step={step} value={secche[step.key]} setValue={setSecca(step.key)} next={next} />
        )}
        {isStep && step.type === "player" && (
          <PlayerScreen step={step} value={secche[step.key]} setValue={setSecca(step.key)} next={next} />
        )}
        {isStep && step.type === "number" && (
          <>
            <NumberScreen step={step} value={secche[step.key]} setValue={setSecca(step.key)} />
            <div style={{ marginTop: 30 }}>
              <NeonBtn onClick={next}>Conferma →</NeonBtn>
            </div>
          </>
        )}
        {isStep && step.type === "summary" && (
          <Summary
            orders={orders}
            secche={secche}
            confirmedGroups={confirmedGroups}
            go={setScreen}
            locked={locked}
            nome={nome}
            setNome={setNome}
            dbReady={dbReady}
            onSent={() => setScreen("sent")}
          />
        )}
      </div>
    </div>
  );
}
