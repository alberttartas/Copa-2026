// ============================================================
// BRACKET CIRCULAR – COPA DO MUNDO 2026 (VERSÃO HEADER DINÂMICO)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- REFERÊNCIAS DO DOM ----------
const svgLayer = document.getElementById('bracket-layer');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

// Se você não tiver um container para o topo no HTML, crie um <div id="top-live-banner"></div> acima do seu SVG/Chaveamento
const topBannerEl = document.getElementById('top-live-banner'); 

// ---------- ESTADO GLOBAL ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  selectedMatchId: null,
  updatedAt: null,
  loading: false,
  highlightedMatchId: null // Armazena o ID da partida Ao Vivo ou Próxima para destacar no Bracket
};

// ---------- CONSTANTES GEOMÉTRICAS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLOR_INACTIVE_LINE = '#26262b';
const COLOR_INACTIVE_NODE = '#111113';

const TEAM_COLORS = {
  BRA: '#cc9a18', FRA: '#1e4391', CAN: '#b51219', MAR: '#0d6130',
  NOR: '#a61423', MEX: '#0b4728', ENG: '#d1d1d1', ARG: '#5b96cb',
  GER: '#d1d1d1', POR: '#991116', ESP: '#bd1117', USA: '#042247'
};

const POSITION_ORDER = [
  'BEL', 'SEN', 'USA', 'BIH', 'ESP', 'AUT', 'POR', 'CRO',
  'RSA', 'CAN', 'NED', 'MAR', 'GER', 'PAR', 'FRA', 'SWE',
  'BRA', 'JPN', 'CIV', 'NOR', 'MEX', 'ECU', 'ENG', 'COD',
  'AUS', 'EGY', 'ARG', 'CPV', 'SUI', 'ALG', 'COL', 'GHA',
];

const INDEX_GEOMETRY_MAP = {};
for(let i=0; i<16; i++) INDEX_GEOMETRY_MAP[i] = { side: 'left', pos: i };
for(let i=16; i<32; i++) INDEX_GEOMETRY_MAP[i] = { side: 'right', pos: i - 16 };

function buildFixedLayout() {
  const totalLeaves = 32;
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = Array.from({ length: totalRounds }, () => []);
  const half = totalLeaves / 2;
  const arcStart = 0.05 * Math.PI, arcEnd = 0.95 * Math.PI;

  for (let i = 0; i < totalLeaves; i++) {
    const geo = INDEX_GEOMETRY_MAP[i];
    let angle = geo.side === 'left' 
      ? Math.PI + (arcStart + (arcEnd - arcStart) * (geo.pos / (half - 1)))
      : arcStart + (arcEnd - arcStart) * (geo.pos / (half - 1));

    layout[0].push({
      id: `r0_n${i}`, round: 0, index: i, angle, radius: LEVEL_R[0],
      team: null, matchId: null, isEliminated: false, isWinner: false,
      x: CX + LEVEL_R[0] * Math.sin(angle), y: CY - LEVEL_R[0] * Math.cos(angle)
    });
  }

  for (let r = 1; r < totalRounds; r++) {
    const prevLayer = layout[r - 1];
    const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];
    for (let i = 0; i < prevLayer.length / 2; i++) {
      const angle = (prevLayer[i * 2].angle + prevLayer[i * 2 + 1].angle) / 2;
      layout[r].push({
        id: `r${r}_n${i}`, round: r, index: i, angle, radius,
        team: null, matchId: null, isEliminated: false, isWinner: false,
        x: CX + radius * Math.sin(angle), y: CY - radius * Math.cos(angle)
      });
    }
  }
  return layout;
}

function mapApiToSlots() {
  const layout = buildFixedLayout();
  const round0Matches = state.rounds[0]?.matches || [];
  const teamByCode = {};

  for (const match of round0Matches) {
    if (match.home?.code) teamByCode[match.home.code.toUpperCase()] = { team: match.home, match };
    if (match.away?.code) teamByCode[match.away.code.toUpperCase()] = { team: match.away, match };
  }

  let leftoverEntries = Object.keys(teamByCode).filter(c => !POSITION_ORDER.includes(c)).map(c => teamByCode[c]);
  let leftoverIdx = 0;

  for (let i = 0; i < layout[0].length; i++) {
    const slot = layout[0][i];
    let entry = teamByCode[POSITION_ORDER[i]] || leftoverEntries[leftoverIdx++];
    if (entry) {
      slot.team = entry.team;
      slot.matchId = entry.match.fixtureId;
      if (entry.match.status === 'FINISHED') {
        slot.isEliminated = entry.match.winnerId !== entry.team.id;
        slot.isWinner = entry.match.winnerId === entry.team.id;
      }
    }
  }

  for (let r = 1; r < layout.length; r++) {
    const currentLayer = layout[r], prevLayer = layout[r - 1];
    const currentRoundMatches = state.rounds[r]?.matches || [];

    for (let i = 0; i < currentLayer.length; i++) {
      const slotFilho = currentLayer[i], pai1 = prevLayer[i * 2], pai2 = prevLayer[i * 2 + 1];
      const match = currentRoundMatches.find(m => 
        (pai1.team?.id && (m.home?.id === pai1.team.id || m.away?.id === pai1.team.id)) ||
        (pai2.team?.id && (m.home?.id === pai2.team.id || m.away?.id === pai2.team.id))
      );

      if (match) {
        slotFilho.matchId = match.fixtureId;
        let winner = match.winnerId ? (match.home?.id === match.winnerId ? match.home : match.away) : null;

        if (winner) {
          slotFilho.team = winner; slotFilho.isWinner = true;
          if (pai1.team?.id === winner.id) { pai1.isWinner = true; pai2.isEliminated = true; }
          if (pai2.team?.id === winner.id) { pai2.isWinner = true; pai1.isEliminated = true; }
        } else {
          slotFilho.team = match.home || match.away;
        }
        if (match.status === 'FINISHED' && winner && slotFilho.team?.id !== winner.id) {
          slotFilho.isEliminated = true;
        }
      } else {
        if (pai1.isWinner && !pai1.isEliminated) slotFilho.team = pai1.team;
        else if (pai2.isWinner && !pai2.isEliminated) slotFilho.team = pai2.team;
      }
    }
  }
  return layout;
}

// ============================================================
// PROCESSA O HEADER SUPERIOR DA PÁGINA (AO VIVO OU PRÓXIMO JOGO)
// ============================================================
function renderTopHeaderBanner() {
  if (!topBannerEl || state.rounds.length === 0) return;

  let liveMatches = [];
  let upcomingMatches = [];

  for (const round of state.rounds) {
    for (const m of round.matches || []) {
      if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status)) {
        liveMatches.push(m);
      } else if (['SCHEDULED', 'TIMED'].includes(m.status)) {
        upcomingMatches.push(m);
      }
    }
  }

  // Ordena os próximos jogos por data (o mais perto de acontecer vem primeiro)
  upcomingMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

  let targetMatch = null;
  let isLive = false;

  if (liveMatches.length > 0) {
    targetMatch = liveMatches[0]; // Prioridade 1: Jogo rolando agora
    isLive = true;
  } else if (upcomingMatches.length > 0) {
    targetMatch = upcomingMatches[0]; // Prioridade 2: Próximo jogo cronológico
  }

  // Salva o ID no estado global para o Bracket aplicar o brilho estético
  state.highlightedMatchId = targetMatch ? targetMatch.fixtureId : null;

  if (!targetMatch) {
    topBannerEl.innerHTML = `<div style="text-align:center; color:#71717a; font-size:12px; padding:10px;">🏆 Todas as partidas agendadas foram encerradas!</div>`;
    return;
  }

  const home = targetMatch.home?.name || 'TBD';
  const away = targetMatch.away?.name || 'TBD';
  const homeCode = targetMatch.home?.code?.toUpperCase();
  const awayCode = targetMatch.away?.code?.toUpperCase();

  if (isLive) {
    topBannerEl.innerHTML = `
      <div style="background: linear-gradient(90deg, #7f1d1d, #111); border-bottom: 2px solid #ef4444; padding: 10px 20px; display: flex; justify-content: center; align-items: center; gap: 20px; font-family: sans-serif;">
        <span style="background: #ef4444; color: #fff; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; animation: pulse 1.5s infinite;">🔴 AO VIVO</span>
        <div style="display: flex; align-items: center; gap: 8px; color: #fff; font-weight: bold;">
          ${homeCode ? `<img src="assets/img/federations/${homeCode}.svg" width="24" height="24" />` : ''} <span>${home}</span>
          <span style="background: #222; padding: 4px 12px; border-radius: 4px; font-size: 16px; color: #cc9a18; margin: 0 10px;">${targetMatch.score?.home ?? 0} × ${targetMatch.score?.away ?? 0}</span>
          <span>${away}</span> ${awayCode ? `<img src="assets/img/federations/${awayCode}.svg" width="24" height="24" />` : ''}
        </div>
      </div>`;
  } else {
    const d = new Date(targetMatch.date);
    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    topBannerEl.innerHTML = `
      <div style="background: #0b0b0d; border-bottom: 1px solid #cc9a18; padding: 10px 20px; display: flex; justify-content: center; align-items: center; gap: 15px; font-family: sans-serif;">
        <span style="color: #cc9a18; font-size: 11px; font-weight: bold; border: 1px solid #cc9a18; padding: 2px 6px; border-radius: 4px;">📅 PRÓXIMO JOGO</span>
        <div style="color: #e4e4e7; font-size: 13px; font-weight: 500;">
          <strong>${home}</strong> vs <strong>${away}</strong> <span style="color: #a1a1aa; margin-left: 10px;">(${dateStr} às ${timeStr})</span>
        </div>
      </div>`;
  }
}

// ============================================================
// RENDERIZAÇÃO DO BRACKET
// ============================================================
function render() {
  if (!svgLayer) return;
  clearSVG();

  const layout = mapApiToSlots();
  drawBackground();
  drawFixedConnections(layout);

  for (const layer of layout) {
    for (const slot of layer) {
      drawNode(slot);
    }
  }
  drawTrophy();
  
  // Atualiza o Banner Superior da Página
  renderTopHeaderBanner();
}

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isWinner, isEliminated } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const hasActiveTeam = team && team.code && team.code !== 'TBD';
  const nodeRadius = hasActiveTeam && !isEliminated ? 17 : 14;

  // LÓGICA DE DESTAQUE: Verifica se o nó pertence à partida ativa em evidência no topo
  const isMatchHighlighted = matchId && matchId === state.highlightedMatchId;

  const nodeFill = isEliminated ? COLOR_INACTIVE_NODE : '#060608';
  let nodeStroke = isEliminated ? '#1f1f23' : (hasActiveTeam && !isEliminated ? '#cc9a18' : '#35353c');
  let nodeStrokeWidth = hasActiveTeam && !isEliminated ? 2.2 : 1;

  // Se for o jogo em destaque, força uma borda mais grossa/viva (e classe CSS pulsante se desejar)
  if (isMatchHighlighted) {
    nodeStroke = '#ef4444'; // Borda vermelha chamativa para o jogo do topo
    nodeStrokeWidth = 3.5;
    g.setAttribute('class', 'highlighted-node-pulse'); 
  }

  g.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius, fill: nodeFill, stroke: nodeStroke, 'stroke-width': nodeStrokeWidth }));

  if (hasActiveTeam) {
    const countryCodeUpper = team.code.toUpperCase();
    const countryCodeLower = team.code.toLowerCase();
    
    const isoMap = { bra: 'br', fra: 'fr', ger: 'de', esp: 'es', arg: 'ar', can: 'ca', mex: 'mx', usa: 'us', eng: 'gb-eng', nor: 'no', por: 'pt' };
    const flag2Letter = isoMap[countryCodeLower] || countryCodeLower.substring(0, 2);
    
    const clipId = `clip-r${round}-n${slot.index}-${countryCodeLower}`;
    const clipPath = elNS('clipPath', { id: clipId });
    clipPath.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius - 0.5 }));
    svgLayer.appendChild(clipPath);

    g.appendChild(elNS('image', {
      x: x - nodeRadius, y: y - nodeRadius, width: nodeRadius * 2, height: nodeRadius * 2,
      href: `https://flagcdn.com/${flag2Letter}.svg`,
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clipId})`,
      style: isEliminated ? 'filter: grayscale(1) opacity(0.18);' : ''
    }));
  }

  g.onclick = () => { if (matchId) { state.selectedMatchId = matchId; renderInteractivePanel(); } };
  svgLayer.appendChild(g);
}

// O restante dos métodos auxiliares (drawFixedConnections, polar, elNS, drawTrophy, load, etc.) permanecem inalterados...
function polar(r, a) { return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; }
function elNS(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
function clearSVG() { while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild); }
function drawBackground() {
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: '#050506' }));
}
function drawTrophy() {}
function drawFixedConnections(l){}

async function load() {
  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await res.json();
    state.rounds = data.rounds || [];
    render();
  } catch (e) { console.error(e); }
}
load();
