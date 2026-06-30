// api/bracket.js
//
// Busca o chaveamento (mata-mata) da Copa do Mundo 2026 na API-Football
// (api-sports.io) e devolve um JSON já normalizado e em "ordem de chave"
// pronto pro front-end desenhar o bracket circular.
//
// Variável de ambiente necessária (Vercel -> Project -> Settings ->
// Environment Variables):
//   API_FOOTBALL_KEY = sua chave da api-sports.io
//
// A resposta fica em cache de borda por 3 min (s-maxage) pra não estourar
// o limite de requisições da API enquanto os jogos rolam.

const LEAGUE_ID = 1; // FIFA World Cup na API-Football
const SEASON = 2026;
const BASE_URL = "https://v3.football.api-sports.io";

// Reconhece o nome da fase mesmo que a API mude levemente o texto
// (ex.: "Round of 32" vs "1/16-finals"). Ordem importa: do mais específico
// pro mais genérico, e "Final" é casado de forma exata pra não capturar
// "Quarter-finals"/"Semi-finals".
const ROUND_MATCHERS = [
  { key: "r32", label: "Oitavas de Final (32)", test: (r) => /32/.test(r) },
  { key: "r16", label: "Oitavas de Final (16)", test: (r) => /16/.test(r) },
  { key: "qf", label: "Quartas de Final", test: (r) => /quarter/i.test(r) },
  { key: "sf", label: "Semifinal", test: (r) => /semi/i.test(r) },
  {
    key: "final",
    label: "Final",
    test: (r) => /^final$/i.test(r.trim()) || /\bfinal\b/i.test(r) && !/semi|quarter/i.test(r),
  },
];

async function apiFootball(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors && Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors || {}).length) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response;
}

function normalizeFixture(f) {
  const home = f.teams.home;
  const away = f.teams.away;
  const pen = f.score?.penalty;

  let winnerCode = null;
  if (home.winner === true) winnerCode = home.id;
  if (away.winner === true) winnerCode = away.id;

  return {
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status.short, // NS, 1H, HT, 2H, FT, AET, PEN...
    venue: f.fixture.venue?.name || null,
    home: { id: home.id, code: home.code, name: home.name, logo: home.logo },
    away: { id: away.id, code: away.code, name: away.name, logo: away.logo },
    score: {
      home: f.goals.home,
      away: f.goals.away,
      penHome: pen ? pen.home : null,
      penAway: pen ? pen.away : null,
    },
    winnerId: winnerCode,
  };
}

module.exports = async (req, res) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: "API_FOOTBALL_KEY não configurada nas env vars do projeto." });
    return;
  }

  try {
    const fixtures = await apiFootball(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`);

    const byRound = {};
    for (const f of fixtures) {
      const roundName = f.league.round || "";
      const match = ROUND_MATCHERS.find((m) => m.test(roundName));
      if (!match) continue; // ignora fase de grupos, etc.
      if (!byRound[match.key]) byRound[match.key] = [];
      byRound[match.key].push(normalizeFixture(f));
    }

    // Ordena cada fase pelo fixtureId — a API lista os jogos na ordem
    // publicada pela FIFA, que corresponde à adjacência da chave (lado a
    // lado no bracket). Se a ordem vier diferente na sua conta da API,
    // ajuste aqui manualmente.
    const order = ["r32", "r16", "qf", "sf", "final"];
    const rounds = order
      .filter((key) => byRound[key])
      .map((key) => ({
        key,
        label: ROUND_MATCHERS.find((m) => m.key === key).label,
        matches: byRound[key].sort((a, b) => a.fixtureId - b.fixtureId),
      }));

    // As 32 "folhas" da chave saem direto das oitavas-de-32. Cada partida
    // contribui dois slots fixos (mandante / visitante) — é essa ordem que
    // fixa a posição angular de cada seleção no desenho circular.
    const r32 = rounds.find((r) => r.key === "r32");
    const leaves = [];
    if (r32) {
      for (const m of r32.matches) leaves.push(m.home, m.away);
    }

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
    res.status(200).json({
      league: "FIFA World Cup 2026",
      updatedAt: new Date().toISOString(),
      leaves,
      rounds,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
