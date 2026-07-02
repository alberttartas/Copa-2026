// ============================================================
// BRACKET CIRCULAR INTERATIVO COM ZOOM INTELIGENTE
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- REFERÊNCIAS DO DOM ----------
const svgElement = document.getElementById('bracket-layer');
const zoomContainer = document.getElementById('zoom-container');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');
const topBannerEl = document.getElementById('top-live-banner'); 

// ---------- ESTADO GLOBAL ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  selectedMatchId: null,
  updatedAt: null,
  loading: false,
  highlightedMatchId: null,
  highlightedIsLive: false
};

// ---------- MAPAS DE TRADUÇÃO E SELEÇÕES ----------
const TRANSLATED_TEAMS = {
  'BEL': 'Bélgica', 'SEN': 'Senegal', 'USA': 'Estados Unidos', 'BIH': 'Bósnia',
  'ESP': 'Espanha', 'AUT': 'Áustria', 'POR': 'Portugal', 'CRO': 'Croácia',
  'RSA': 'África do Sul', 'CAN': 'Canadá', 'NED': 'Holanda', 'MAR': 'Marrocos',
  'GER': 'Alemanha', 'PAR': 'Paraguai', 'FRA': 'França', 'SWE': 'Suécia',
  'BRA': 'Brasil', 'JPN': 'Japão', 'CIV': 'Costa do Marfim', 'NOR': 'Noruega',
  'MEX': 'México', 'ECU': 'Equador', 'ENG': 'Inglaterra', 'COD': 'RD Congo',
  'AUS': 'Austrália', 'EGY': 'Egito', 'ARG': 'Argentina', 'CPV': 'Cabo Verde',
  'SUI': 'Suíça', 'ALG': 'Argélia', 'COL': 'Colômbia', 'GHA': 'Gana', 'TBD': 'A definir'
};

const ISO_MAP = {
  bra: 'br', arg: 'ar', col: 'co', ecu: 'ec', par: 'py',
  mex: 'mx', usa: 'us', can: 'ca', eng: 'gb-eng', esp: 'es', 
  por: 'pt', fra: 'fr', ger: 'de', ned: 'nl', aut: 'at', 
  swe: 'se', cro: 'hr', bih: 'ba', sui: 'ch', nor: 'no', 
  bel: 'be', sen: 'sn', mar: 'ma', rsa: 'za', egy: 'eg', 
  gha: 'gh', alg: 'dz', cpv: 'cv', cod: 'cd', jpn: 'jp', aus: 'au'
};

function getTeamName(code, fallbackName) {
  if (!code || code === 'TBD') return 'A definir';
  return TRANSLATED_TEAMS[code.toUpperCase()] || fallbackName || 'A definir';
}

function getFlag2Letter(code) {
  if (!code) return '';
  const lower = code.toLowerCase();
  return ISO_MAP[lower] || lower.substring(0, 2);
}

// ---------- INSTANCIAÇÃO DO D3 ZOOM ----------
let zoomBehavior = null;
let svgSelection = null;
let containerSelection = null;

function initZoomSystem() {
  if (typeof d3 === 'undefined') return;

  svgSelection = d3.select('#bracket-layer');
  containerSelection = d3.select('#zoom-container');

  zoomBehavior = d3.zoom()
    .scaleExtent([0.4, 5])
    .on('zoom', (event) => {
      containerSelection.attr('transform', event.transform);
    });

  svgSelection.call(zoomBehavior);
}

function centerBracketInitially() {
  if (!zoomBehavior || !svgSelection) return;
  
  setTimeout(() => {
    const width = svgElement.clientWidth || window.innerWidth;
    const height = svgElement.clientHeight || window.innerHeight;
    
    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - 600 * 0.72, height / 2 - 500 * 0.72)
      .scale(0.72);

    svgSelection.call(zoomBehavior.transform, initialTransform);
  }, 50);
}

function zoomToNode(x, y) {
  if (!zoomBehavior || !svgSelection) return;
  const width = svgElement.clientWidth || window.innerWidth;
  const height = svgElement.clientHeight || window.innerHeight;
  
  const nextScale = window.innerWidth < 768 ? 2.0 : 1.5;
  const transform = d3.zoomIdentity
    .translate(width / 2 - x * nextScale, height / 2 - y * nextScale)
    .scale(nextScale);

  svgSelection.transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .call(zoomBehavior.transform, transform);
}

// ---------- CONSTANTES GEOMÉTRICAS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];
const NODE_RADIUS_BY_ROUND = [13, 15.5, 19, 23.5, 29, 36];

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

// ---------- CONSTRUTORES DO LAYOUT ----------
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
          if (match.home && (pai1.team?.id === match.home.id || pai2.team?.id === match.home.id)) {
            slotFilho.team = match.home;
          } else if (match.away && (pai1.team?.id === match.away.id || pai2.team?.id === match.away.id)) {
            slotFilho.team = match.away;
          }
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

function findLiveOrNextMatch() {
  let liveMatches = [];
  let upcomingMatches = [];
  for (const round of state.rounds) {
    for (const m of round.matches || []) {
      if (['IN_PLAY', 'LIVE', 'PAUSED'].includes(m.status)) liveMatches.push(m);
      else if (['SCHEDULED', 'TIMED'].includes(m.status)) upcomingMatches.push(m);
    }
  }
  upcomingMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (liveMatches.length > 0) return { match: liveMatches[0], isLive: true };
  if (upcomingMatches.length > 0) return { match: upcomingMatches[0], isLive: false };
  return { match: null, isLive: false };
}

// ---------- RENDERS DO BANNER E DO PAINEL ----------
function renderTopHeaderBanner(targetMatch, isLive) {
  if (!topBannerEl) return;
  if (!targetMatch) {
    topBannerEl.innerHTML = `<div style="text-align:center; color:#71717a; font-size:12px; padding:12px;">🏆 Torneio Finalizado!</div>`;
    return;
  }
  const homeCode = targetMatch.home?.code?.toUpperCase();
  const awayCode = targetMatch.away?.code?.toUpperCase();
  if (isLive) {
    topBannerEl.innerHTML = `
      <div class="banner-inner banner-live">
        <span class="banner-tag banner-tag-live">🔴 AO VIVO</span>
        <div class="banner-match">
          ${homeCode ? `<img src="assets/img/federations/${homeCode}.svg" class="banner-flag" />` : ''} 
          <span class="banner-team">${getTeamName(homeCode)}</span>
          <span class="banner-score">${targetMatch.score?.home ?? 0} × ${targetMatch.score?.away ?? 0}</span>
          <span class="banner-team">${getTeamName(awayCode)}</span> 
          ${awayCode ? `<img src="assets/img/federations/${awayCode}.svg" class="banner-flag" />` : ''}
        </div>
      </div>`;
  } else {
    const d = new Date(targetMatch.date);
    topBannerEl.innerHTML = `
      <div class="banner-inner banner-next">
        <span class="banner-tag banner-tag-next">📅 PRÓXIMO JOGO</span>
        <div class="banner-match-text">
          <strong>${getTeamName(homeCode)}</strong> vs <strong>${getTeamName(awayCode)}</strong> <span class="banner-date">(${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})})</span>
        </div>
      </div>`;
  }
}

function closePanel() {
  state.selectedMatchId = null;
  if (panelEl) panelEl.classList.remove('visible');
  document.body.classList.remove('panel-open');
}

function renderInteractivePanel() {
  if (!panelEl || !state.selectedMatchId) return;
  let match = null;
  for (const r of state.rounds) {
    const found = r.matches?.find((m) => m.fixtureId === state.selectedMatchId);
    if (found) { match = found; break; }
  }
  if (!match) return;

  const homeCode = match.home?.code?.toUpperCase();
  const awayCode = match.away?.code?.toUpperCase();
  const homeScorer = match.home?.topScorer;
  const awayScorer = match.away?.topScorer;
  const isLive = ['IN_PLAY', 'LIVE', 'PAUSED'].includes(match.status);

  let statusHeader = '';
  if (isLive) statusHeader = `<div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; border-radius:8px; padding:8px; font-size:11px; color:#ef4444; font-weight:bold; text-align:center; margin-bottom:12px;">🔴 AO VIVO</div>`;
  else if (match.status === 'FINISHED') statusHeader = `<div style="background:#09090b; border:1px solid #1c1c1f; border-radius:8px; padding:6px; font-size:10px; color:#71717a; font-weight:bold; text-align:center; margin-bottom:12px;">✅ FIM DE JOGO</div>`;

  panelEl.innerHTML = `
    <div style="position: relative; padding: 4px; font-family: sans-serif;">
      <button id="panelCloseBtn" style="position:absolute; top:-4px; right:0; width:28px; height:28px; border-radius:50%; border:1px solid #26262b; background:#09090b; color:#a1a1aa; cursor:pointer;">✕</button>
      <div style="font-size: 10px; text-transform: uppercase; color:#a1a1aa; font-weight:bold; margin-bottom:14px; text-align:center;">🏆 ${match.stage || 'Copa do Mundo'}</div>
      ${statusHeader}
      <div class="panel-teams-row">
        <div class="panel-team-column">
          <div class="panel-visual-pair">
            <img src="assets/img/federations/${homeCode}.svg" class="badge" onerror="this.style.opacity='0.2'" />
            <img src="assets/img/art/${homeCode}.png" class="scorer-photo" onerror="this.src='https://flagcdn.com/${getFlag2Letter(homeCode)}.svg'; this.style.borderRadius='4px';" />
          </div>
          <div class="panel-team-name">${getTeamName(homeCode)}</div>
          <div class="panel-scorer-name">${homeScorer ? homeScorer.name : '-'}</div>
          <div class="panel-scorer-info">⚽ ${homeScorer ? homeScorer.goals : 0} Gols</div>
        </div>
        <div class="panel-score-center">
          ${match.status === 'FINISHED' || isLive ? `<div class="panel-big-score" style="color:${isLive?'#ef4444':'#cc9a18'}">${match.score?.home ?? 0}–${match.score?.away ?? 0}</div>` : `<div class="panel-vs-badge">VS</div>`}
        </div>
        <div class="panel-team-column">
          <div class="panel-visual-pair">
            <img src="assets/img/art/${awayCode}.png" class="scorer-photo" onerror="this.src='https://flagcdn.com/${getFlag2Letter(awayCode)}.svg'; this.style.borderRadius='4px';" />
            <img src="assets/img/federations/${awayCode}.svg" class="badge" onerror="this.style.opacity='0.2'" />
          </div>
          <div class="panel-team-name">${getTeamName(awayCode)}</div>
          <div class="panel-scorer-name">${awayScorer ? awayScorer.name : '-'}</div>
          <div class="panel-scorer-info">⚽ ${awayScorer ? awayScorer.goals : 0} Gols</div>
        </div>
      </div>
    </div>`;

  panelEl.classList.add('visible');
  document.body.classList.add('panel-open');
  document.getElementById('panelCloseBtn').onclick = closePanel;
}

// ---------- RENDER COMPLETO DO CHAVEAMENTO ----------
function render() {
  if (!zoomContainer) return;
  zoomContainer.innerHTML = '';

  const { match: targetMatch, isLive } = findLiveOrNextMatch();
  state.highlightedMatchId = targetMatch ? targetMatch.fixtureId : null;
  state.highlightedIsLive = isLive;

  const layout = mapApiToSlots();
  drawBackground();
  drawFixedConnections(layout);

  for (const layer of layout) {
    for (const slot of layer) {
      drawNode(slot);
    }
  }
  drawTrophy();
  renderTopHeaderBanner(targetMatch, isLive);
}

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isEliminated } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const hasActiveTeam = team && team.code && team.code !== 'TBD';
  const baseRadius = NODE_RADIUS_BY_ROUND[round] ?? 16;
  const nodeRadius = hasActiveTeam && !isEliminated ? baseRadius : Math.max(9, baseRadius - 4);
  const isMatchHighlighted = matchId && matchId === state.highlightedMatchId;

  g.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius, fill: isEliminated ? COLOR_INACTIVE_NODE : '#060608', stroke: isEliminated ? '#1f1f23' : (hasActiveTeam ? '#cc9a18' : '#35353c'), 'stroke-width': hasActiveTeam ? 2.2 : 1 }));

  if (isMatchHighlighted) {
    g.setAttribute('class', 'highlighted-node-pulse');
    g.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius + 7, fill: 'none', stroke: state.highlightedIsLive ? '#ef4444' : '#cc9a18', 'stroke-width': 1.4, 'stroke-dasharray': '3,3', class: 'highlighted-halo' }));
  }

  if (hasActiveTeam) {
    const countryCodeUpper = team.code.toUpperCase();
    const flag2Letter = getFlag2Letter(countryCodeUpper);
    const uniqueTime = Date.now();
    const clipId = `clip-r${round}-n${slot.index}-${flag2Letter}-${uniqueTime}`;

    const clipPath = elNS('clipPath', { id: clipId });
    clipPath.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius - 0.5 }));
    zoomContainer.appendChild(clipPath);

    g.appendChild(elNS('image', { x: x - nodeRadius, y: y - nodeRadius, width: nodeRadius * 2, height: nodeRadius * 2, href: `https://flagcdn.com/${flag2Letter}.svg`, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clipId})`, style: isEliminated ? 'filter: grayscale(1) opacity(0.18);' : '' }));

    if (round === 0) {
      const [sx, sy] = polar(radius + 26, angle);
      const imgFed = elNS('image', { x: sx - 11, y: sy - 11, width: 22, height: 22, href: `assets/img/federations/${countryCodeUpper}.svg`, style: isEliminated ? 'filter: grayscale(1) opacity(0.12);' : '' });
      imgFed.onerror = () => imgFed.remove();
      zoomContainer.appendChild(imgFed);
      svgLayerDrawLine(polar(radius + 14, angle), [sx, sy], isEliminated);
    }
  } else {
    const t = elNS('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': Math.max(6, Math.round(nodeRadius * 0.4)), fill: '#28282d', 'font-weight': 'bold' });
    t.textContent = 'TBD'; g.appendChild(t);
  }

  g.onmouseenter = (e) => {
    if (state.selectedMatchId || !matchId) return;
    const rect = svgElement.getBoundingClientRect();
    state.hover = { x: e.clientX - rect.left, y: e.clientY - rect.top, matchId };
    renderTooltipOnly();
  };
  g.onmouseleave = () => { state.hover = null; renderTooltipOnly(); };

  g.onclick = () => {
    zoomToNode(x, y);
    if (matchId) {
      state.hover = null; renderTooltipOnly();
      state.selectedMatchId = matchId;
      renderInteractivePanel();
    }
  };

  zoomContainer.appendChild(g);
}

// ---------- COMPONENTES DE CONEXÕES ----------
function drawFixedConnections(layout) {
  for (let r = 0; r < layout.length - 1; r++) {
    const currentLayer = layout[r], nextLayer = layout[r + 1];
    const rMid = (LEVEL_R[r] + LEVEL_R[r + 1]) / 2;
    for (let i = 0; i < currentLayer.length; i += 2) {
      const p1 = currentLayer[i], p2 = currentLayer[i + 1], ch = nextLayer[Math.floor(i / 2)];
      if (!p1 || !p2 || !ch) continue;

      const col1 = (p1.isWinner && p1.team && !p1.isEliminated) ? (TEAM_COLORS[p1.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const col2 = (p2.isWinner && p2.team && !p2.isEliminated) ? (TEAM_COLORS[p2.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const colJ = (ch.team && !ch.isEliminated) ? (TEAM_COLORS[ch.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;

      drawSeparatedBezierConnection(p1.radius, p1.angle, col1, 1.5, p2.radius, p2.angle, col2, 1.5, rMid, ch.angle, ch.radius, colJ, 1.5);
    }
  }
}

function drawSeparatedBezierConnection(r1, angleA, col1, w1, r2, angleB, col2, w2, rMid, childAngle, rChild, colJ, wJ) {
  const [x1, y1] = polar(r1, angleA), [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar(rMid, childAngle), [cx2, cy2] = polar(rChild, childAngle);
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  zoomContainer.appendChild(elNS('path', { d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`, stroke: col1, fill: 'none', 'stroke-width': w1 }));
  zoomContainer.appendChild(elNS('path', { d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`, stroke: col2, fill: 'none', 'stroke-width': w2 }));
  zoomContainer.appendChild(elNS('path', { d: `M${cx},${cy} L${cx2},${cy2}`, stroke: colJ, fill: 'none', 'stroke-width': wJ }));
}

function renderTooltipOnly() {
  if (!tooltipEl) return;
  if (!state.hover) { tooltipEl.classList.remove('visible'); return; }
  let match = null;
  for (const r of state.rounds) {
    const found = r.matches?.find((m) => m.fixtureId === state.hover.matchId);
    if (found) { match = found; break; }
  }
  if (!match) return;
  tooltipEl.innerHTML = `<div><strong>${getTeamName(match.home?.code)}</strong> vs <strong>${getTeamName(match.away?.code)}</strong></div><div style="font-size:11px;color:#cc9a18;margin-top:2px;">${match.status==='FINISHED'?`${match.score?.home}-${match.score?.away}`:'A Jogar'}</div>`;
  tooltipEl.style.transform = `translate3d(${state.hover.x + 16}px, ${state.hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');
}

function polar(r, a) { return [CX + r * Math.sin(a), CY - r * Math.cos(a)]; }
function elNS(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function svgLayerDrawLine(p1, p2, isEliminated) {
  if(!zoomContainer) return;
  zoomContainer.appendChild(elNS('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: isEliminated ? '#1c1c20' : '#2d2d34', 'stroke-width': 1, 'stroke-dasharray': '2,2' }));
}

function drawBackground() {
  zoomContainer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'transparent' }));
  LEVEL_R.forEach((r) => {
    zoomContainer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#0d0d11', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 52, fill: '#010102', stroke: '#18140b', 'stroke-width': 1.5 }));
  g.appendChild(elNS('image', { x: CX - 37, y: CY - 37, width: 74, height: 74, href: 'taca.gif', preserveAspectRatio: 'xMidYMid meet' }));
  zoomContainer.appendChild(g);
}

// ---------- API LINKAGEM ----------
async function load() {
  state.loading = true;
  if (statusText) statusText.textContent = 'Atualizando...';
  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await res.json();
    state.rounds = data.rounds || [];
    state.leaves = data.leaves || [];
    
    initZoomSystem();
    render();
    centerBracketInitially(); 
    
    if (state.selectedMatchId) renderInteractivePanel();
    if (statusText) statusText.textContent = '✓ Sincronizado';
  } catch (e) {
    if (statusText) statusText.textContent = '❌ Erro de Conexão';
  } finally {
    state.loading = false;
  }
}

if (refreshBtn) refreshBtn.addEventListener('click', load);
document.addEventListener('click', (e) => {
  if (!panelEl || !panelEl.classList.contains('visible') || panelEl.contains(e.target) || e.target.closest('[data-match-id]')) return;
  closePanel();
});

// Executa diretamente para blindar carregamento imediato
load();
setInterval(load, 60000);
