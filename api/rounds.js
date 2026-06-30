// api/rounds.js
//
// Endpoint de depuração: lista os nomes EXATOS de fase que a API-Football
// está devolvendo pra essa liga/temporada. Use isso se o /api/bracket
// vier vazio — provavelmente o nome da fase não bateu com os regex em
// ROUND_MATCHERS (api/bracket.js).
//
// Acesse: https://seu-projeto.vercel.app/api/rounds

const LEAGUE_ID = 1;
const SEASON = 2026;
const BASE_URL = "https://v3.football.api-sports.io";

module.exports = async (req, res) => {
  if (!process.env.API_FOOTBALL_KEY) {
    res.status(500).json({ error: "API_FOOTBALL_KEY não configurada nas env vars do projeto." });
    return;
  }

  try {
    const r = await fetch(`${BASE_URL}/fixtures/rounds?league=${LEAGUE_ID}&season=${SEASON}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    const json = await r.json();
    res.status(200).json(json);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
};
