// ============================================================
// BRACKET CIRCULAR – ACERTADO VIA ESTRUTURA DE CONFRONTOS REAIS
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM ----------
const svgLayer = document.getElementById('bracket-layer');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

if (!svgLayer || !tooltipEl || !panelEl || !statusText) {
  console.warn('DOM incompleto, aguardando...');
}

// ---------- STATE ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  updatedAt: null,
  loading: false,
};

// ---------- CONSTANTS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];
const BASE_LINE_COLOR = '#2e2e33'; 

// ============================================================
// MAPEA E MONTA A ÁRVORE DINAMICAMENTE (EVITA ERRO DE POSIÇÃO)
// ============================================================

function mapApiToDynamicLayout() {
  const totalLeaves = 32; // Copa do Mundo 2026 (Fase Final com 32 ou adaptável)
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = [];

  for (let r = 0; r < totalRounds; r++) {
    layout.push([]);
  }

  // 1. Coleta os confrontos do primeiro round da API para ordenar as folhas corretamente
  const round0Matches = state.rounds[0]?.matches || [];
  const orderedTeams = [];
  const matchIdMap = [];

  // Preenche a lista garantindo que Home e Away do mesmo confronto fiquem juntos (vizinhos de array)
  for (let i = 0; i < totalLeaves / 2; i++) {
    const match = round0Matches[i];
    if (match) {
      orderedTeams.push(match.home || { code: 'TBD', name: 'TBD' });
      orderedTeams.push(match.away || { code: 'TBD', name: 'TBD' });
      matchIdMap.push(match.fixtureId);
      matchIdMap.push(match.fixtureId);
    } else {
      orderedTeams.push({ code: 'TBD', name: 'TBD' });
      orderedTeams.push({ code: 'TBD', name: 'TBD' });
      matchIdMap.push(null);
      matchIdMap.push(null);
    }
  }

  const half = totalLeaves / 2;

  // 2. Distribui geometricamente no círculo (Esquerda vs Direita)
  for (let i = 0; i < totalLeaves; i++) {
    let angle;
    if (i < half) {
      // Hemisfério Esquerdo
      const percent = i / (half - 1);
      angle = Math.PI + (Math.PI / 1.35) * (percent - 0.5);
    } else {
      // Hemisfério Direito
      const idx = i - half;
      const percent = idx / (half - 1);
      angle = (Math.PI / 1.35) * (0.5 - percent);
    }

    layout[0].push({
      id: `r0_n${i}`,
      round: 0,
      index: i,
      angle,
      radius: LEVEL_R[0],
      team: orderedTeams[i],
      matchId: matchIdMap[i],
      isPending: orderedTeams[i].code === 'TBD',
      isWinner: false,
      x: CX + LEVEL_R[0] * Math.sin(angle),
      y: CY - LEVEL_R[0] * Math.cos(angle),
    });
  }

  // 3. Monta as camadas internas calculando os vencedores pelo ID e histórico
  for (let r = 1; r < totalRounds; r++) {
    const prevLayer = layout[r - 1];
    const count = prevLayer.length / 2;
    const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];
    const currentRoundMatches = state.rounds[r]?.matches || [];

    for (let i = 0; i < count; i++) {
      const pai1 = prevLayer[i * 2];
      const pai2 = prevLayer[i * 2 + 1];
      const angle = (pai1.angle + pai2.angle) / 2;

      // Busca a partida que contém um dos times que veio da camada anterior
      const match = currentRoundMatches.find(m => 
        (pai1.team?.id && (m.home?.id === pai1.team.id || m.away?.id === pai1.team.id)) ||
        (pai2.team?.id && (m.home?.id === pai2.team.id || m.away?.id === pai2.team.id))
      ) || currentRoundMatches[i];

      let winner = null;
      let decided = false;

      if (match) {
        if (match.winnerId != null) {
          decided = true;
          winner = match.home?.id === match.winnerId ? match.home : match.away;
        } else if (match.status === 'FINISHED' && match.score) {
          const h = match.score.home ?? 0;
          const a = match.score.away ?? 0;
          if (h > a) { decided = true; winner = match.home; } 
          else if (a > h) { decided = true; winner = match.away; }
        }
      }

      // Define se o pai foi o vencedor para destacar a linha dourada
      if (decided && winner) {
        if (pai1.team && pai1.team.id === winner.id) pai1.isWinner = true;
        if (pai2.team && pai2.team.id === winner.id) pai2.isWinner = true;
      }

      layout[r].push({
        id: `r${r}_n${i}`,
        round: r,
        index: i,
        angle,
        radius,
        team: winner,
        matchId: match ? match.fixtureId : null,
        isPending: !decided,
        isWinner: false, 
        x: CX + radius * Math.sin(angle),
        y: CY - radius * Math.cos(angle),
      });
    }
  }

  return layout;
}

// ============================================================
// SVG RENDERING
// ============================================================

function render() {
  if (!svgLayer) return;
  clearSVG();

  // Gera o layout dinâmico baseado na árvore de confrontos reais
  const layout = mapApiToDynamicLayout();

  drawBackground();
  drawFixedConnections(layout);

  for (const layer of layout) {
    for (const slot of layer) {
      drawNode(slot);
    }
  }

  drawTrophy();

  if (statusText) {
    const ts = state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR') : 'agora';
    statusText.textContent = `✅ Atualizado ${ts}`;
  }
}

// ============================================================
// CONEXÕES MONOCROMÁTICAS PREMIUM
// ============================================================

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

      // Se o pai venceu e avançou para o filho, destaca a linha dele em dourado
      const color1 = parent1.isWinner ? '#cda036' : BASE_LINE_COLOR;
      const width1 = parent1.isWinner ? 2.0 : 1.2;

      const color2 = parent2.isWinner ? '#cda036' : BASE_LINE_COLOR;
      const width2 = parent2.isWinner ? 2.0 : 1.2;

      // Cor do tronco central comum até o próximo círculo
      const jointColor = (!child.isPending && child.team) ? '#cda036' : BASE_LINE_COLOR;
      const jointWidth = (!child.isPending && child.team) ? 2.0 : 1.2;

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

  // Linhas independentes para que o caminho do perdedor continue cinza e o do vencedor fique dourado
  svgLayer.appendChild(elNS('path', { d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`, stroke: col1, fill: 'none', 'stroke-width': w1 }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`, stroke: col2, fill: 'none', 'stroke-width': w2 }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} L${cx2},${cy2}`, stroke: colJ, fill: 'none', 'stroke-width': wJ }));
}

// ============================================================
// DESENHO DOS NÓS + CORREÇÃO DOS ESCUDOS EXTERNOS (UPPERCASE)
// ============================================================

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isWinner, isPending } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const nodeRadius = isWinner ? 17 : 14;

  g.appendChild(elNS('circle', {
    cx: x, cy: y, r: nodeRadius,
    fill: isPending ? '#111113' : '#050505',
    stroke: isWinner ? '#d9a531' : '#333338',
    'stroke-width': isWinner ? 2.5 : 1,
  }));

  if (team && team.code !== 'TBD') {
    const countryCodeUpper = team.code.toUpperCase();
    const countryCodeLower = team.code.toLowerCase();
    
    const isoMap = { bra: 'br', fra: 'fr', ger: 'de', esp: 'es', arg: 'ar', can: 'ca', mex: 'mx', usa: 'us', eng: 'gb-eng', nor: 'no', por: 'pt', ita: 'it', jpn: 'jp', mar: 'ma' };
    const flag2Letter = isoMap[countryCodeLower] || countryCodeLower.substring(0, 2);
    
    const apiFlagUrl = team.flag || `https://flagcdn.com/${flag2Letter}.svg`;
    const localShieldUrl = `assets/img/federations/${countryCodeUpper}.svg`;

    // Recorte circular perfeito da bandeira
    const clipId = `clip-r${round}-n${slot.index}-${countryCodeLower}`;
    const clipPath = elNS('clipPath', { id: clipId });
    clipPath.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius - 0.5 }));
    svgLayer.appendChild(clipPath);

    const imgFlag = elNS('image', {
      x: x - nodeRadius, y: y - nodeRadius,
      width: nodeRadius * 2, height: nodeRadius * 2,
      href: apiFlagUrl,
      preserveAspectRatio: 'xMidYMid slice',
      'clip-path': `url(#${clipId})`
    });
    g.appendChild(imgFlag);

    // ESCUDOS EXTERNOS (Apenas Round 0)
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
      });

      imgFederation.onerror = () => imgFederation.remove();
      svgLayer.appendChild(imgFederation);
      
      const [lx, ly] = polar(radius + 14, angle);
      svgLayer.appendChild(elNS('line', {
        x1: lx, y1: ly, x2: sx, y2: sy,
        stroke: '#2a2a2e', 'stroke-width': 1, 'stroke-dasharray': '2,2'
      }));
    }

  } else {
    const t = elNS('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 8, fill: '#3a3a40', 'font-weight': 'bold', 'font-family': 'sans-serif' });
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
// AUXILIARES STANDARD
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
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#1d170b' }));
  grad.appendChild(elNS('stop', { offset: '65%', 'stop-color': '#09090b' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#040405' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));

  LEVEL_R.forEach((r) => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#111114', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 52, fill: '#040405', stroke: '#221a0b', 'stroke-width': 1.5 }));
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
