// api/bracket.js

const COMPETITION_CODE = "WC"; // FIFA World Cup na football-data.org
const BASE_URL = "https://api.football-data.org/v4";


const ROUND_MATCHERS = [
  { key: "r32", label: "Fase de 32 (oitavas-de-32)", test: (r) => /32/.test(r) },
  { key: "r16", label: "Oitavas de Final", test: (r) => /16/.test(r) },
  { key: "qf", label: "Quartas de Final", test: (r) => /quarter/i.test(r) },
  { key: "sf", label: "Semifinal", test: (r) => /semi/i.test(r) },
  { key: "final", label: "Final", test: (r) => /^final$/i.test(r.trim()) },
];

async function footballData(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`football-data.org HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

function normalizeFixture(m) {
  const home = m.homeTeam;
  const away = m.awayTeam;
  const winner = m.score?.winner; // "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null

  let winnerId = null;
  if (winner === "HOME_TEAM") winnerId = home.id;
  if (winner === "AWAY_TEAM") winnerId = away.id;

  return {
    fixtureId: m.id,
    date: m.utcDate,
    status: m.status, // SCHEDULED, TIMED, IN_PLAY, FINISHED...
    stage: m.stage,
    home: { id: home.id, code: home.tla, name: home.name, logo: home.crest },
    away: { id: away.id, code: away.tla, name: away.name, logo: away.crest },
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
      penHome: m.score?.penalties?.home ?? null,
      penAway: m.score?.penalties?.away ?? null,
    },
    winnerId,
  };
}

module.exports = async (req, res) => {
  if (!process.env.FOOTBALL_DATA_TOKEN) {
    res.status(500).json({ error: "FOOTBALL_DATA_TOKEN não configurada nas env vars do projeto." });
    return;
  }

  try {
    const data = await footballData(`/competitions/${COMPETITION_CODE}/matches`);
    const matches = data.matches || [];

    const byRound = {};
    for (const m of matches) {
      const stageName = m.stage || "";
      const match = ROUND_MATCHERS.find((r) => r.test(stageName));
      if (!match) continue; // ignora fase de grupos, etc.
      if (!byRound[match.key]) byRound[match.key] = [];
      byRound[match.key].push(normalizeFixture(m));
    }

    // Ordena cada fase por data/id — a API normalmente lista os jogos na
    // ordem cronológica oficial, que costuma seguir a adjacência da chave.
    // Se a ordem vier diferente, ajuste manualmente aqui.
    const order = ["r32", "r16", "qf", "sf", "final"];
    const rounds = order
      .filter((key) => byRound[key])
      .map((key) => ({
        key,
        label: ROUND_MATCHERS.find((r) => r.key === key).label,
        matches: byRound[key].sort((a, b) => a.fixtureId - b.fixtureId),
      }));

    
    
    const leafRoundKey = rounds.find((r) => r.key === "r32") ? "r32" : "r16";
    const leafRound = rounds.find((r) => r.key === leafRoundKey);
    const leaves = [];
    if (leafRound) {
      for (const m of leafRound.matches) leaves.push(m.home, m.away);
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
