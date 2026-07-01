// api/bracket.js
//
// Endpoint principal que gera a chave do mata-mata da Copa do Mundo 2026
// Integrado com busca automática de artilheiros oficiais da competição

const COMPETITION_CODE = "WC";
const BASE_URL = "https://api.football-data.org/v4";

const ROUND_MATCHERS = [
  { key: "r32", label: "Fase de 32 (Oitavas-de-32)", test: (r) => /32|ROUND_OF_32|Round of 32|Last 32/i.test(r), priority: 1 },
  { key: "r16", label: "Oitavas de Final", test: (r) => /16|ROUND_OF_16|Round of 16|Last 16|Knockout|Eighth|EIGHTH/i.test(r), priority: 2 },
  { key: "qf", label: "Quartas de Final", test: (r) => /quarter|QUARTER_FINALS|Quarter-Final|Quarterfinal|QUARTER/i.test(r), priority: 3 },
  { key: "sf", label: "Semifinal", test: (r) => /semi|SEMI_FINALS|Semi-Final|Semifinal|SEMI/i.test(r), priority: 4 },
  { key: "final", label: "Final", test: (r) => /^final$|FINAL|Championship|CHAMPIONSHIP|Final Round/i.test(r.trim()), priority: 5 },
  { key: "third", label: "Disputa do 3º Lugar", test: (r) => /third|3rd|3º|Third place|THIRD_PLACE/i.test(r), priority: 6 }
];

const STAGE_MAPPING = {
  'GROUP_STAGE': 'group', 'PRELIMINARY': 'preliminary', 'QUALIFYING': 'qualifying', 'PLAYOFFS': 'playoffs',
  'ROUND_OF_32': 'r32', 'ROUND_OF_16': 'r16', 'QUARTER_FINALS': 'qf', 'QUARTERFINAL': 'qf',
  'SEMI_FINALS': 'sf', 'SEMIFINAL': 'sf', 'FINAL': 'final', 'THIRD_PLACE': 'third',
  'THIRD_PLACE_MATCH': 'third', '3RD_PLACE': 'third'
};

const STATUS_INFO = {
  'SCHEDULED': { label: 'EM BREVE', class: 'upcoming', icon: '🟡' },
  'TIMED': { label: 'EM BREVE', class: 'upcoming', icon: '🟡' },
  'IN_PLAY': { label: 'AO VIVO', class: 'live', icon: '🔴' },
  'LIVE': { label: 'AO VIVO', class: 'live', icon: '🔴' },
  'PAUSED': { label: 'INTERVALO', class: 'live', icon: '🟠' },
  'FINISHED': { label: 'ENCERRADO', class: 'finished', icon: '✅' },
  'POSTPONED': { label: 'ADIADO', class: 'upcoming', icon: '⏰' },
  'CANCELLED': { label: 'CANCELADO', class: 'finished', icon: '❌' },
  'SUSPENDED': { label: 'SUSPENSO', class: 'upcoming', icon: '⏸️' }
};

async function footballData(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`[API] Fetching: ${url}`);
  
  const res = await fetch(url, {
    headers: { 
      "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN,
      "Content-Type": "application/json"
    },
  });
  
  const json = await res.json();
  
  if (!res.ok) {
    console.error(`[API Error] HTTP ${res.status}:`, json);
    throw new Error(`football-data.org HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  
  return json;
}

// Injeta as propriedades de artilheiro vindas da busca paralela
function normalizeFixture(m, topScorersMap = {}) {
  const home = m.homeTeam || { id: null, tla: null, name: 'TBD', crest: null };
  const away = m.awayTeam || { id: null, tla: null, name: 'TBD', crest: null };
  const winner = m.score?.winner;

  let winnerId = null;
  if (winner === "HOME_TEAM") winnerId = home.id;
  if (winner === "AWAY_TEAM") winnerId = away.id;

  const matchDate = new Date(m.utcDate);
  const dateStr = matchDate.toLocaleDateString('pt-BR');
  const timeStr = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const statusInfo = STATUS_INFO[m.status] || { label: m.status || 'DESCONHECIDO', class: 'upcoming', icon: '⚪' };

  const homeCode = home.tla?.toUpperCase();
  const awayCode = away.tla?.toUpperCase();

  return {
    fixtureId: m.id,
    date: m.utcDate,
    dateStr,
    timeStr,
    status: m.status,
    statusLabel: statusInfo.label,
    statusClass: statusInfo.class,
    statusIcon: statusInfo.icon,
    stage: m.stage,
    home: { 
      id: home.id, 
      code: home.tla, 
      name: home.name || 'TBD', 
      logo: home.crest || null,
      topScorer: topScorersMap[homeCode] || null // Injetado dinamicamente
    },
    away: { 
      id: away.id, 
      code: away.tla, 
      name: away.name || 'TBD', 
      logo: away.crest || null,
      topScorer: topScorersMap[awayCode] || null // Injetado dinamicamente
    },
    score: {
      home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      penHome: m.score?.penalties?.home ?? null,
      penAway: m.score?.penalties?.away ?? null,
    },
    winnerId: winnerId,
    displayScore: m.score?.fullTime?.home !== undefined && m.score?.fullTime?.away !== undefined
      ? `${m.score.fullTime.home} × ${m.score.fullTime.away}`
      : m.status === 'FINISHED' ? '—' : 'vs',
    isFinished: m.status === 'FINISHED',
    isLive: ['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status),
    isUpcoming: ['SCHEDULED', 'TIMED'].includes(m.status),
    nextMatchId: null,
    nextSlot: null,
  };
}

function linkRounds(rounds) {
  for (let i = 0; i < rounds.length - 1; i++) {
    const current = rounds[i];
    const next = rounds[i + 1];

    current.matches.forEach((match, idx) => {
      const nextMatchIndex = Math.floor(idx / 2);
      if (nextMatchIndex < next.matches.length) {
        const nextMatch = next.matches[nextMatchIndex];
        match.nextMatchId = nextMatch.fixtureId || nextMatch.id || `${next.key}-${nextMatchIndex}`;
        match.nextSlot = (idx % 2 === 0) ? 'home' : 'away';
      } else {
        match.nextMatchId = null;
        match.nextSlot = null;
      }
    });
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!process.env.FOOTBALL_DATA_TOKEN) {
    res.status(500).json({ error: "FOOTBALL_DATA_TOKEN não configurada nas env vars." });
    return;
  }

  try {
    // Busca em paralelo: Partidas e Artilharia da competição
    const [matchesData, scorersData] = await Promise.all([
      footballData(`/competitions/${COMPETITION_CODE}/matches`),
      footballData(`/competitions/${COMPETITION_CODE}/scorers?limit=50`).catch(() => ({ scorers: [] }))
    ]);

    const matches = matchesData.matches || [];
    const scorersList = scorersData.scorers || [];

    // Mapeia o principal artilheiro de cada seleção (Key: TLA do país)
    const topScorersMap = {};
    scorersList.forEach(item => {
      const teamCode = item.team?.tla?.toUpperCase();
      if (teamCode && !topScorersMap[teamCode]) {
        topScorersMap[teamCode] = {
          name: item.player.name,
          goals: item.goals
        };
      }
    });

    const stagesAvailable = {};
    for (const m of matches) {
      const stage = m.stage || 'UNKNOWN';
      stagesAvailable[stage] = (stagesAvailable[stage] || 0) + 1;
    }

    const byRound = {};
    const unmatchedStages = [];

    for (const m of matches) {
      const stageName = m.stage || "";
      let matchedKey = null;
      let matchedLabel = null;

      if (STAGE_MAPPING[stageName]) {
        matchedKey = STAGE_MAPPING[stageName];
        const matchDef = ROUND_MATCHERS.find(r => r.key === matchedKey);
        if (matchDef) matchedLabel = matchDef.label;
      }

      if (!matchedKey) {
        const matchDef = ROUND_MATCHERS.find((r) => r.test(stageName));
        if (matchDef) {
          matchedKey = matchDef.key;
          matchedLabel = matchDef.label;
        }
      }

      if (!matchedKey) {
        if (stageName.toLowerCase().includes('group')) continue;
        unmatchedStages.push(stageName);
        continue;
      }

      if (!byRound[matchedKey]) {
        byRound[matchedKey] = { key: matchedKey, label: matchedLabel || stageName, matches: [] };
      }
      // Passa o mapa de artilheiros para a normalização
      byRound[matchedKey].matches.push(normalizeFixture(m, topScorersMap));
    }

    const order = ["r32", "r16", "qf", "sf", "final", "third"];
    const rounds = order
      .filter((key) => byRound[key])
      .map((key) => {
        const round = byRound[key];
        round.matches.sort((a, b) => new Date(a.date) - new Date(b.date));
        return round;
      });

    linkRounds(rounds);

    const leafRoundKey = rounds.find((r) => r.key === "r32") ? "r32" : rounds.find((r) => r.key === "r16") ? "r16" : null;
    const leafRound = leafRoundKey ? rounds.find((r) => r.key === leafRoundKey) : null;
    const leaves = [];

    if (leafRound) {
      for (const m of leafRound.matches) {
        if (m.home?.name && m.home.name !== 'TBD') leaves.push(m.home);
        if (m.away?.name && m.away.name !== 'TBD') leaves.push(m.away);
      }
    }

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
    res.status(200).json({
      success: true,
      league: "FIFA World Cup 2026",
      updatedAt: new Date().toISOString(),
      totalMatches: matches.length,
      leaves: leaves,
      rounds: rounds,
      stagesDebug: stagesAvailable,
      unmatchedStages: [...new Set(unmatchedStages)]
    });

  } catch (err) {
    console.error('[API] Error:', err);
    res.status(502).json({ error: String(err.message || err) });
  }
};
