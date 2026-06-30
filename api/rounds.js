// api/rounds.js
//
// Endpoint de depuração: lista os valores de "stage" (fase) que a
// football-data.org está devolvendo pra Copa do Mundo 2026, e quantos jogos
// existem em cada uma. Use isso se /api/bracket vier vazio — provavelmente
// o nome da fase não bateu com os regex em ROUND_MATCHERS (api/bracket.js).
//
// Acesse: https://seu-projeto.vercel.app/api/rounds

const COMPETITION_CODE = "WC";
const BASE_URL = "https://api.football-data.org/v4";

module.exports = async (req, res) => {
  // Configurar CORS para desenvolvimento
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
    const r = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/matches`, {
      headers: { 
        "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN,
        "Content-Type": "application/json"
      },
    });
    
    const json = await r.json();
    
    if (!r.ok) {
      res.status(r.status).json({
        error: json.message || "Erro na API football-data.org",
        status: r.status,
        details: json
      });
      return;
    }

    const counts = {};
    const stages = new Set();
    const matchDetails = [];

    for (const m of json.matches || []) {
      const stage = m.stage || 'UNKNOWN';
      counts[stage] = (counts[stage] || 0) + 1;
      stages.add(stage);
      
      // Coletar detalhes para depuração
      if (m.stage) {
        matchDetails.push({
          id: m.id,
          stage: m.stage,
          status: m.status,
          home: m.homeTeam?.name || 'TBD',
          away: m.awayTeam?.name || 'TBD',
          date: m.utcDate
        });
      }
    }

    // Informações adicionais úteis
    const stageList = Array.from(stages).sort();
    
    res.status(200).json({
      success: true,
      competition: COMPETITION_CODE,
      totalMatches: (json.matches || []).length,
      stagesFound: counts,
      stageList: stageList,
      sampleMatches: matchDetails.slice(0, 5), // Mostra 5 exemplos
      allMatches: matchDetails, // Todos os matches (pode ser grande)
      timestamp: new Date().toISOString(),
      nextUpdate: new Date(Date.now() + 90000).toISOString(), // Próxima atualização em 90s
    });
  } catch (err) {
    console.error('Erro em /api/rounds:', err);
    res.status(502).json({ 
      error: String(err.message || err),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
