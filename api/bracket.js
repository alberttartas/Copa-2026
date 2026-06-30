// api/bracket.js
//
// Endpoint principal que gera a chave do mata-mata da Copa do Mundo 2026
// com suporte a múltiplos formatos de nomenclatura de fases

const COMPETITION_CODE = "WC";
const BASE_URL = "https://api.football-data.org/v4";

// Mapeamento completo de fases (mais abrangente)
const ROUND_MATCHERS = [
  { 
    key: "r32", 
    label: "Fase de 32 (Oitavas-de-32)", 
    test: (r) => /32|ROUND_OF_32|Round of 32|Last 32/i.test(r),
    priority: 1
  },
  { 
    key: "r16", 
    label: "Oitavas de Final", 
    test: (r) => /16|ROUND_OF_16|Round of 16|Last 16|Knockout|Eighth|EIGHTH/i.test(r),
    priority: 2
  },
  { 
    key: "qf", 
    label: "Quartas de Final", 
    test: (r) => /quarter|QUARTER_FINALS|Quarter-Final|Quarterfinal|QUARTER/i.test(r),
    priority: 3
  },
  { 
    key: "sf", 
    label: "Semifinal", 
    test: (r) => /semi|SEMI_FINALS|Semi-Final|Semifinal|SEMI/i.test(r),
    priority: 4
  },
  { 
    key: "final", 
    label: "Final", 
    test: (r) => /^final$|FINAL|Championship|CHAMPIONSHIP|Final Round/i.test(r.trim()),
    priority: 5
  },
  { 
    key: "third", 
    label: "Disputa do 3º Lugar", 
    test: (r) => /third|3rd|3º|Third place|THIRD_PLACE/i.test(r),
    priority: 6
  }
];

// Mapeamento direto para nomes comuns da API
const STAGE_MAPPING = {
  'GROUP_STAGE': 'group',
  'PRELIMINARY': 'preliminary',
  'QUALIFYING': 'qualifying',
  'PLAYOFFS': 'playoffs',
  'ROUND_OF_32': 'r32',
  'ROUND_OF_16': 'r16',
  'QUARTER_FINALS': 'qf',
  'QUARTERFINAL': 'qf',
  'SEMI_FINALS': 'sf',
  'SEMIFINAL': 'sf',
  'FINAL': 'final',
  'THIRD_PLACE': 'third',
  'THIRD_PLACE_MATCH': 'third',
  '3RD_PLACE': 'third'
};

// Status dos jogos com cores e labels
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
  
  console.log(`[API] Success: ${json.count || json.matches?.length || 0} items`);
  return json;
}

function normalizeFixture(m) {
  const home = m.homeTeam || { id: null, tla: null, name: 'TBD', crest: null };
  const away = m.awayTeam || { id: null, tla: null, name: 'TBD', crest: null };
  const winner = m.score?.winner;

  let winnerId = null;
  if (winner === "HOME_TEAM") winnerId = home.id;
  if (winner === "AWAY_TEAM") winnerId = away.id;

  // Formatar data
  const matchDate = new Date(m.utcDate);
  const dateStr = matchDate.toLocaleDateString('pt-BR');
  const timeStr = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Status info
  const statusInfo = STATUS_INFO[m.status] || { label: m.status || 'DESCONHECIDO', class: 'upcoming', icon: '⚪' };

  return {
    fixtureId: m.id,
    date: m.utcDate,
    dateStr: dateStr,
    timeStr: timeStr,
    status: m.status,
    statusLabel: statusInfo.label,
    statusClass: statusInfo.class,
    statusIcon: statusInfo.icon,
    stage: m.stage,
    home: { 
      id: home.id, 
      code: home.tla, 
      name: home.name || 'TBD', 
      logo: home.crest || null 
    },
    away: { 
      id: away.id, 
      code: away.tla, 
      name: away.name || 'TBD', 
      logo: away.crest || null 
    },
    score: {
      home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      penHome: m.score?.penalties?.home ?? null,
      penAway: m.score?.penalties?.away ?? null,
    },
    winnerId: winnerId,
    // Para exibição no tooltip
    displayScore: m.score?.fullTime?.home !== undefined && m.score?.fullTime?.away !== undefined
      ? `${m.score.fullTime.home} × ${m.score.fullTime.away}`
      : m.status === 'FINISHED' ? '—' : 'vs',
    isFinished: m.status === 'FINISHED',
    isLive: ['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status),
    isUpcoming: ['SCHEDULED', 'TIMED'].includes(m.status)
  };
}

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!process.env.FOOTBALL_DATA_TOKEN) {
    res.status(500).json({ 
      error: "FOOTBALL_DATA_TOKEN não configurada nas env vars do projeto.",
      tip: "Adicione FOOTBALL_DATA_TOKEN no Vercel (Project Settings > Environment Variables)"
    });
    return;
  }

  try {
    // Buscar todos os jogos
    const data = await footballData(`/competitions/${COMPETITION_CODE}/matches`);
    const matches = data.matches || [];

    console.log(`[API] Total matches: ${matches.length}`);

    if (matches.length === 0) {
      res.status(200).json({
        league: "FIFA World Cup 2026",
        updatedAt: new Date().toISOString(),
        leaves: [],
        rounds: [],
        message: "Nenhuma partida encontrada para a Copa do Mundo 2026. O torneio pode não ter iniciado ou os dados não estão disponíveis ainda.",
        stagesDebug: {}
      });
      return;
    }

    // Debug: coletar todas as fases disponíveis
    const stagesAvailable = {};
    const stagesSet = new Set();
    for (const m of matches) {
      const stage = m.stage || 'UNKNOWN';
      stagesAvailable[stage] = (stagesAvailable[stage] || 0) + 1;
      stagesSet.add(stage);
    }
    console.log('[API] Stages available:', stagesAvailable);

    // Agrupar por fase
    const byRound = {};
    const unmatchedStages = [];

    for (const m of matches) {
      const stageName = m.stage || "";
      let matchedKey = null;
      let matchedLabel = null;

      // 1. Tentar mapeamento direto
      if (STAGE_MAPPING[stageName]) {
        matchedKey = STAGE_MAPPING[stageName];
        const match = ROUND_MATCHERS.find(r => r.key === matchedKey);
        if (match) matchedLabel = match.label;
      }

      // 2. Tentar regex
      if (!matchedKey) {
        const match = ROUND_MATCHERS.find((r) => r.test(stageName));
        if (match) {
          matchedKey = match.key;
          matchedLabel = match.label;
        }
      }

      // 3. Se não encontrou, tentar match parcial (fallback)
      if (!matchedKey) {
        // Verificar se contém palavras-chave
        const lower = stageName.toLowerCase();
        if (lower.includes('group') || lower.includes('fase de grupos')) {
          continue; // Ignorar fase de grupos
        }
        unmatchedStages.push(stageName);
        continue;
      }

      if (!byRound[matchedKey]) {
        byRound[matchedKey] = {
          key: matchedKey,
          label: matchedLabel || stageName,
          matches: []
        };
      }
      byRound[matchedKey].matches.push(normalizeFixture(m));
    }

    // Log de fases não mapeadas
    if (unmatchedStages.length > 0) {
      console.warn('[API] Unmatched stages:', [...new Set(unmatchedStages)]);
    }

    // Ordenar as fases
    const order = ["r32", "r16", "qf", "sf", "final", "third"];
    const rounds = order
      .filter((key) => byRound[key])
      .map((key) => {
        const round = byRound[key];
        // Ordenar jogos por data
        round.matches.sort((a, b) => new Date(a.date) - new Date(b.date));
        return round;
      });

    // Determinar a fase inicial (leaf round)
    const leafRoundKey = rounds.find((r) => r.key === "r32") ? "r32" : 
                         rounds.find((r) => r.key === "r16") ? "r16" : null;
    
    const leafRound = leafRoundKey ? rounds.find((r) => r.key === leafRoundKey) : null;
    const leaves = [];
    
    if (leafRound) {
      for (const m of leafRound.matches) {
        // Adicionar ambos os times como "folhas" para a chave
        if (m.home && m.home.name && m.home.name !== 'TBD') {
          leaves.push(m.home);
        }
        if (m.away && m.away.name && m.away.name !== 'TBD') {
          leaves.push(m.away);
        }
      }
    }

    // Se não encontrou folhas, tentar usar todos os times únicos da primeira fase
    if (leaves.length === 0 && rounds.length > 0) {
      const firstRound = rounds[0];
      const teamSet = new Set();
      for (const m of firstRound.matches) {
        if (m.home && m.home.name && m.home.name !== 'TBD') {
          const key = m.home.id || m.home.name;
          if (!teamSet.has(key)) {
            teamSet.add(key);
            leaves.push(m.home);
          }
        }
        if (m.away && m.away.name && m.away.name !== 'TBD') {
          const key = m.away.id || m.away.name;
          if (!teamSet.has(key)) {
            teamSet.add(key);
            leaves.push(m.away);
          }
        }
      }
    }

    // Responder
    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=300");
    res.status(200).json({
      success: true,
      league: "FIFA World Cup 2026",
      updatedAt: new Date().toISOString(),
      totalMatches: matches.length,
      leaves: leaves,
      rounds: rounds,
      stagesDebug: stagesAvailable,
      unmatchedStages: [...new Set(unmatchedStages)],
      // Informações para depuração
      debug: {
        totalMatches: matches.length,
        stagesFound: Object.keys(stagesAvailable).length,
        roundsFound: rounds.length,
        leavesCount: leaves.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(502).json({ 
      error: String(err.message || err),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
