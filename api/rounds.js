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
  if (!process.env.FOOTBALL_DATA_TOKEN) {
    res.status(500).json({ error: "FOOTBALL_DATA_TOKEN não configurada nas env vars do projeto." });
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/competitions/${COMPETITION_CODE}/matches`, {
      headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
    });
    const json = await r.json();
    if (!r.ok) {
      res.status(r.status).json(json);
      return;
    }

    const counts = {};
    for (const m of json.matches || []) {
      counts[m.stage] = (counts[m.stage] || 0) + 1;
    }

    res.status(200).json({
      totalMatches: (json.matches || []).length,
      stagesFound: counts,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
