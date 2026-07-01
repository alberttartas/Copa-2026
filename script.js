// ============================================================
// BRACKET CIRCULAR – COPA DO MUNDO 2026 (POSICIONAMENTO RIGIDAMENTE CORRETO)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM REFS ----------
const svgLayer = document.getElementById('bracket-layer');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

// ---------- STATE ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  updatedAt: null,
  loading: false,
};

// ---------- CONSTANTES GEOMÉTRICAS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLOR_INACTIVE_LINE = '#2a2a2e';
const COLOR_INACTIVE_NODE = '#141416';

// ============================================================
// MAPA REAL DE ADVERSÁRIOS E POSIÇÕES SEGUINDO A IMAGEM 1782936066953.jpeg
// Reorganizado par por par para que as conexões fiquem idênticas ao design
// ============================================================
const FIXED_POSITION_MAP = [
  // --- HEMISFÉRIO ESQUERDO (Índices 0 a 15) ---
  // Topo Esquerdo descendo até a Base Esquerda
  { code: 'FRA', side: 'left' },  { code: 'RSA', side: 'left' },
  { code: 'GER', side: 'left' },  { code: 'PAR', side: 'left' },
  { code: 'CAN', side: 'left' },  { code: 'MAR', side: 'left' },
  { code: 'POR', side: 'left' },  { code: 'CRO', side: 'left' },
  { code: 'ESP', side: 'left' },  { code: 'AUT', side: 'left' },
  { code: 'USA', side: 'left' },  { code: 'BIH', side: 'left' },
  { code: 'BEL', side: 'left' },  { code: 'SEN', side: 'left' },
  { code: 'GHA', side: 'left' },  { code: 'EGY', side: 'left' },

  // --- HEMISFÉRIO DIREITO (Índices 16 a 31) ---
  // Topo Direito descendo até a Base Direita
  { code: 'BRA', side: 'right' }, { code: 'JPN', side: 'right' },
  { code: 'NOR', side: 'right' }, { code: 'THA', side: 'right' },
  { code: 'MEX', side: 'right' }, { code: 'ECU', side: 'right' },
  { code: 'ENG', side: 'right' }, { code: 'CIV', side: 'right' },
  { code: 'ARG', side: 'right' }, { code: 'ITA', side: 'right' },
  { code: 'CPV', side: 'right' }, { code: 'AUS', side: 'right' },
  { code: 'IRQ', side: 'right' }, { code: 'COL', side: 'right' },
  { code: 'ALG', side: 'right' }, { code: 'SUI', side: 'right' }
];

// Cores de realce para as seleções que estiverem ativas e avançando
const TEAM_COLORS = {
  BRA: '#e5c158', FRA: '#2b52a1', CAN: '#c8232b', MAR: '#177d43',
  NOR: '#ba2031', MEX: '#155c37', ENG: '#ffffff', ARG: '#74acdf',
  GER: '#ffffff', POR: '#b81920', ESP: '#dd1a22', USA: '#0a3161'
};

// ============================================================
// GERADOR GEOMÉTRICO DO BRACKET
// ============================================================

function buildFixedLayout() {
  const totalLeaves = 32;
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = Array.from({ length: totalRounds }, () => []);

  const half = totalLeaves / 2;

  for (let i = 0; i < totalLeaves; i++) {
    let angle;
    const meta = FIXED_POSITION_MAP[i];

    if (meta.side === 'left') {
      // Ângulos precisos do hemisfério esquerdo (sentido anti-horário)
      const percent = i / (half - 1);
      angle = Math.PI + (Math.PI / 1.1) * (percent - 0.5);
    } else {
      // Ângulos precisos do hemisfério direito (sentido horário)
      const idx = i - half;
      const percent = idx / (half - 1);
      angle = (Math.PI / 1.1) * (0.5 - percent);
    }

    layout[0].push({
      id: `r0_n${i}`,
      round: 0,
      index: i,
      angle,
      radius: LEVEL_R[0],
      team: { code: meta.code, name: meta.code },
      matchId: null,
      isEliminated: false,
      isWinner: false,
      x: CX + LEVEL_R[0] * Math.sin(angle),
      y: CY - LEVEL_R[0] * Math.cos(angle),
    });
  }

  // Geração Bottom-Up estrutural limpa
  for (let r = 1; r < totalRounds; r++) {
    const prevLayer = layout[r - 1];
    const count = prevLayer.length / 2;
    const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];

    for (let i = 0; i < count; i++) {
      const parent1 = prevLayer[i * 2];
      const parent2 = prevLayer[i * 2 + 1];
      const angle = (parent1.angle + parent2.angle) / 2;

      layout[r].push({
        id: `r${r}_n${i}`,
        round: r,
        index: i,
        angle,
        radius,
        team: null,
        matchId: null,
        isEliminated: false,
        isWinner: false,
        x: CX + radius * Math.sin(angle),
        y: CY - radius * Math.cos(angle),
      });
    }
  }

  return layout;
}

// ============================================================
// VINCULAÇÃO E FILTRAGEM DINÂMICA DA API
// ============================================================

function mapApiToSlots() {
  const layout = buildFixedLayout();
  const round0Matches = state.rounds[0]?.matches || [];

  // 1. Resolve Round 0 casando o time pré-definido com as partidas ativas
  for (let i = 0; i < layout[0].length; i++) {
    const slot = layout[0][i];
    
    const match = round0Matches.find(m => 
      m.home?.code?.toUpperCase() === slot.team.code || 
      m.away?.code?.toUpperCase() === slot.team.code
    );

    if (match) {
      const isHome = match.home?.code?.toUpperCase() === slot.team.code;
      const actualTeam = isHome ? match.home : match.away;

      slot.team = actualTeam;
      slot.matchId = match.fixtureId;

      if (match.winnerId && match.winnerId !== actualTeam.id) {
        slot.isEliminated = true;
      }
    }
  }

  // 2. Calcula as subidas e aplica efeito cinza nos nós perdedores/eliminados
  for (let r = 1; r < layout.length; r++) {
    const currentLayer = layout[r];
    const prevLayer = layout[r - 1];
    const currentRoundMatches = state.rounds[r]?.matches || [];

    for (let i = 0; i < currentLayer.length; i++) {
      const slotFilho = currentLayer[i];
      const pai1 = prevLayer[i * 2];
      const pai2 = prevLayer[i * 2 + 1];

      const match = currentRoundMatches.find(m => 
        (pai1.team?.id && (m.home?.id === pai1.team.id || m.away?.id === pai1.team.id)) ||
        (pai2.team?.id && (m.home?.id === pai2.team.id || m.away?.id === pai2.team.id))
      );

      if (match) {
        slotFilho.matchId = match.fixtureId;
        let winner = null;

        if (match.winnerId != null) {
          winner = match.home?.id === match.winnerId ? match.home : match.away;
        }

        if (winner) {
          slotFilho.team = winner;
          
          if (pai1.team && pai1.team.id === winner.id) { pai1.isWinner = true; pai2.isEliminated = true; }
          if (pai2.team && pai2.team.id === winner.id) { pai2.isWinner = true; pai1.isEliminated = true; }
        }
        
        if (match.status === 'FINISHED' && (!winner || slotFilho.team?.id !== winner.id)) {
          slotFilho.isEliminated = true;
        }
      }
    }
  }

  return layout;
}

// ============================================================
// RENDERING DO SVG (LINHAS DISCRETAS / REALCES)
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
}

function drawFixedConnections(layout) {
  for (let r = 0; r < layout.length - 1; r++) {
    const currentLayer = layout[r];
    const nextLayer = layout[r + 1];
    if (!currentLayer || !nextLayer) continue;

    const rMid = (LEVEL_R[r] + LEVEL_R[r + 1]) / 2;

    for (let i = 0; i < currentLayer.length; i += 2) {
      const parent1 = currentLayer[i];
      const parent2 = currentLayer[i + 1];
      const child = nextLayer[Math.floor(i / 2)];

      if (!parent1 || !parent2 || !child) continue;

      const color1 = (parent1.isWinner && !parent1.isEliminated) ? (TEAM_COLORS[parent1.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const width1 = (parent1.isWinner && !parent1.isEliminated) ? 2.2 : 1.2;

      const color2 = (parent2.isWinner && !parent2.isEliminated) ? (TEAM_COLORS[parent2.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const width2 = (parent2.isWinner && !parent2.isEliminated) ? 2.2 : 1.2;

      const jointColor = (child.team && !child.isEliminated) ? (TEAM_COLORS[child.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const jointWidth = (child.team && !child.isEliminated) ? 2.2 : 1.2;

      drawSeparatedBezierConnection(
        parent1.radius, parent1.angle, color1, width1,
        parent2.radius, parent2.angle, color2, width2,
        rMid, child.angle, child.radius, jointColor, jointWidth
      );
    }
  }
}

function drawSeparatedBezierConnection(r1, angleA, col1, w1, r2, angleB, col2, w2, rMid, childAngle, rChild, colJ, wJ) {
  const [x1, y1] = polar(r1, angleA);
  const [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar(rMid, childAngle);
  const [cx2, cy2] = polar(rChild, childAngle);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  svgLayer.appendChild(elNS('path', { d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`, stroke: col1, fill: 'none', 'stroke-width': w1 }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`, stroke: col2, fill: 'none', 'stroke-width': w2 }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} L${cx2},${cy2}`, stroke: colJ, fill: 'none', 'stroke-width': wJ }));
}

// ============================================================
// DESENHO DOS NÓS + TRATAMENTO DOS ELIMINADOS EM PRETO E BRANCO
// ============================================================

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isWinner, isEliminated } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const nodeRadius = isWinner && !isEliminated ? 17 : 14;

  const nodeFill = isEliminated ? COLOR_INACTIVE_NODE : '#070709';
  const nodeStroke = isEliminated ? '#222226' : (isWinner ? '#d9a531' : '#3d3d44');
  const nodeStrokeWidth = isWinner && !isEliminated ? 2.5 : 1;

  g.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius, fill: nodeFill, stroke: nodeStroke, 'stroke-width': nodeStrokeWidth }));

  if (team && team.code !== 'TBD') {
    const countryCodeUpper = team.code.toUpperCase();
    const countryCodeLower = team.code.toLowerCase();
    
    const isoMap = { bra: 'br', fra: 'fr', ger: 'de', esp: 'es', arg: 'ar', can: 'ca', mex: 'mx', usa: 'us', eng: 'gb-eng', nor: 'no', por: 'pt', ita: 'it', jpn: 'jp', mar: 'ma' };
    const flag2Letter = isoMap[countryCodeLower] || countryCodeLower.substring(0, 2);
    
    const apiFlagUrl = `https://flagcdn.com/${flag2Letter}.svg`;
    const localShieldUrl = `assets/img/federations/${countryCodeUpper}.svg`;

    const clipId = `clip-r${round}-n${slot.index}-${countryCodeLower}`;
    const clipPath = elNS('clipPath', { id: clipId });
    clipPath.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius - 0.5 }));
    svgLayer.appendChild(clipPath);

    const imgFlag = elNS('image', {
      x: x - nodeRadius, y: y - nodeRadius,
      width: nodeRadius * 2, height: nodeRadius * 2,
      href: apiFlagUrl,
      preserveAspectRatio: 'xMidYMid slice',
      'clip-path': `url(#${clipId})`,
      style: isEliminated ? 'filter: grayscale(1) opacity(0.2);' : ''
    });
    g.appendChild(imgFlag);

    // ESCUDOS EXTERNOS DA FEDERAÇÃO (Apenas Round 0)
    if (round === 0) {
      const shieldDistance = radius + 28; 
      const [sx, sy] = polar(shieldDistance, angle);
      const shieldSize = 24; 

      const imgFederation = elNS('image', {
        x: sx - shieldSize / 2,
        y: sy - shieldSize / 2,
        width: shieldSize,
        height: shieldSize,
        href: localShieldUrl, 
        style: isEliminated ? 'filter: grayscale(1) opacity(0.15);' : ''
      });

      imgFederation.onerror = () => imgFederation.remove();
      svgLayer.appendChild(imgFederation);
      
      const [lx, ly] = polar(radius + 14, angle);
      svgLayer.appendChild(elNS('line', {
        x1: lx, y1: ly, x2: sx, y2: sy,
        stroke: isEliminated ? '#222226' : '#33333a', 'stroke-width': 1, 'stroke-dasharray': '2,2'
      }));
    }
  } else {
    const t = elNS('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 8, fill: '#333338', 'font-weight': 'bold', 'font-family': 'sans-serif' });
    t.textContent = 'TBD';
    g.appendChild(t);
  }

  g.onmouseenter = (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = { x: e.clientX - rect.left, y: e.clientY - rect.top, matchId };
    renderUI();
  };
  g.onmouseleave = () => { state.hover = null; renderUI(); };

  svgLayer.appendChild(g);
}

// ============================================================
// FUNÇÕES AUXILIARES DE SUPORTE
// ============================================================

function polar(r, a) {
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function elNS(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function clearSVG() {
  while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);
}

function drawBackground() {
  const defs = elNS('defs', { id: 'defs' });
  const grad = elNS('radialGradient', { id: 'bgGlow', cx: '50%', cy: '50%', r: '55%' });
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#14120e' }));
  grad.appendChild(elNS('stop', { offset: '70%', 'stop-color': '#060608' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#020203' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));

  LEVEL_R.forEach((r) => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#0e0e11', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 52, fill: '#020203', stroke: '#1c170d', 'stroke-width': 1.5 }));
  const t = elNS('text', { x: CX, y: CY + 12, 'text-anchor': 'middle', 'font-size': 42, fill: '#d9a531' });
  t.textContent = '🏆';
  g.appendChild(t);
  svgLayer.appendChild(g);
}

function renderUI() {
  if (!tooltipEl || !panelEl) return;
  const hover = state.hover;

  if (!hover) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  let match = null;
  for (const round of state.rounds) {
    const found = round.matches?.find((m) => m.fixtureId === hover.matchId);
    if (found) { match = found; break; }
  }

  if (!match) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  const home = match.home?.name || 'TBD';
  const away = match.away?.name || 'TBD';
  const score = match.status === 'FINISHED' ? `${match.score?.home ?? 0} – ${match.score?.away ?? 0}` : 'VS';
  const stage = match.stage || 'Fase Eliminatória';

  tooltipEl.innerHTML = `<div><strong>${home}</strong> vs <strong>${away}</strong></div><div class="score">${score}</div>`;
  tooltipEl.style.transform = `translate3d(${hover.x + 16}px, ${hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');

  panelEl.innerHTML = `<div class="match-title">${home} vs ${away}</div><div class="match-score">${score}</div><div class="match-detail">🏆 ${stage}</div>`;
  panelEl.classList.add('visible');
}

async function load() {
  state.loading = true;
  if (statusText) statusText.textContent = 'Atualizando...';
  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await res.json();
    state.rounds = data.rounds || [];
    state.leaves = data.leaves || [];
    state.updatedAt = data.updatedAt || null;
    render();
  } catch (e) {
    if (statusText) statusText.textContent = '❌ Erro ao carregar';
  } finally {
    state.loading = false;
  }
}

if (refreshBtn) refreshBtn.addEventListener('click', load);
load();
setInterval(load, 90000);
