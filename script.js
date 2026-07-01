// ============================================================
// BRACKET CIRCULAR – GEOMETRIA E MAPEAMENTO COPA DO MUNDO 2026
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

// Linha padrão do layout sóbria (sem cores fortes de arco-íris)
const BASE_LINE_COLOR = '#2e2e33'; 

// ============================================================
// STRUCTURAL & GEOMETRIC LAYOUT (ESPELHADO ESQUERDA / DIREITA)
// ============================================================

function buildFixedLayout(totalLeaves) {
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = [];

  for (let r = 0; r < totalRounds; r++) {
    layout.push([]);
  }

  const half = totalLeaves / 2;

  // Distribuição exata seguindo o design de referência
  for (let i = 0; i < totalLeaves; i++) {
    let angle;
    if (i < half) {
      // Bloco Esquerdo (Avança de ~100° até ~260°)
      const percent = i / (half - 1);
      angle = Math.PI + (Math.PI / 1.3) * (percent - 0.5);
    } else {
      // Bloco Direito (Avança de ~80° até ~-80°)
      const idx = i - half;
      const percent = idx / (half - 1);
      angle = (Math.PI / 1.3) * (0.5 - percent);
    }

    const radius = LEVEL_R[0];

    layout[0].push({
      id: `r0_n${i}`,
      round: 0,
      index: i,
      angle,
      radius,
      team: null,
      matchId: null,
      isPending: true,
      isWinner: false,
      x: CX + radius * Math.sin(angle),
      y: CY - radius * Math.cos(angle),
    });
  }

  // Geração Bottom-Up dos nós filhos por média angular limpa
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
        isPending: true,
        isWinner: false,
        x: CX + radius * Math.sin(angle),
        y: CY - radius * Math.cos(angle),
      });
    }
  }

  return layout;
}

// ============================================================
// MAPEAMENTO SEGURO VIA RELACIONAMENTO DE CHAVES DE PARCEIROS
// ============================================================

function mapApiToSlots(leaves, rounds) {
  const totalLeaves = leaves.length || 32;
  const layout = buildFixedLayout(totalLeaves);

  // 1. Vincula as folhas do Round 0 com a lista inicial da API
  const leafSlots = layout[0] || [];
  for (let i = 0; i < leaves.length && i < leafSlots.length; i++) {
    leafSlots[i].team = leaves[i];
    leafSlots[i].isPending = false;
  }

  // 2. Vincula os nós internos buscando dinamicamente os confrontos corretos da API
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const matches = round.matches || [];
    const currentLayer = layout[ri];
    const nextLayer = layout[ri + 1] || [];

    for (let i = 0; i < nextLayer.length; i++) {
      const slotFilho = nextLayer[i];
      const pai1 = currentLayer[i * 2];
      const pai2 = currentLayer[i * 2 + 1];

      // Busca o confronto exato onde um dos times participantes veio dos nós pais anteriores
      const match = matches.find(m => 
        (pai1.team?.id && (m.home?.id === pai1.team.id || m.away?.id === pai1.team.id)) ||
        (pai2.team?.id && (m.home?.id === pai2.team.id || m.away?.id === pai2.team.id))
      ) || matches[i]; 

      if (match) {
        let winner = null;
        let decided = false;

        if (match.winnerId != null) {
          decided = true;
          winner = match.home?.id === match.winnerId ? match.home : match.away;
        } else if (match.status === 'FINISHED' && match.score) {
          const h = match.score.home ?? 0;
          const a = match.score.away ?? 0;
          if (h > a) { decided = true; winner = match.home; } 
          else if (a > h) { decided = true; winner = match.away; }
        }

        slotFilho.team = winner || null;
        slotFilho.isPending = !decided;
        slotFilho.matchId = match.fixtureId;
        slotFilho.isWinner = decided;
      }
    }
  }

  return layout;
}

// ============================================================
// SVG RENDERING MANAGEMENT
// ============================================================

function render() {
  if (!svgLayer) return;
  clearSVG();

  const { rounds, leaves } = state;
  const totalLeaves = leaves.length || 32;

  const layout = (leaves.length && rounds.length)
    ? mapApiToSlots(leaves, rounds)
    : buildFixedLayout(totalLeaves);

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
// CONEXÕES MONOCROMÁTICAS PREMIUM (SEM LINHAS COLORIDAS)
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

      // Realce dourado discreto APENAS se o nó avançou com vitória, senão mantém cor escura fixa
      const strokeColor = (!child.isPending && child.team) ? '#cda036' : BASE_LINE_COLOR;
      const strokeWidth = (!child.isPending && child.team) ? 1.8 : 1.2;

      drawBezierConnection(
        parent1.radius, parent1.angle,
        parent2.radius, parent2.angle,
        rMid, child.angle, child.radius,
        strokeColor, strokeWidth
      );
    }
  }
}

function drawBezierConnection(r1, angleA, r2, angleB, rMid, childAngle, rChild, color, width) {
  const [x1, y1] = polar(r1, angleA);
  const [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar(rMid, childAngle);
  const [cx2, cy2] = polar(rChild, childAngle);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  svgLayer.appendChild(elNS('path', { d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`, stroke: color, fill: 'none', 'stroke-width': width }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`, stroke: color, fill: 'none', 'stroke-width': width }));
  svgLayer.appendChild(elNS('path', { d: `M${cx},${cy} L${cx2},${cy2}`, stroke: color, fill: 'none', 'stroke-width': width }));
}

// ============================================================
// DESENHO DOS NÓS + CORREÇÃO DOS ESCUDOS EXTERNOS (UPPERCASE)
// ============================================================

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isWinner, isPending } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const nodeRadius = isWinner ? 18 : 14;

  // Círculo base do nó (Bandeira interna)
  g.appendChild(elNS('circle', {
    cx: x, cy: y, r: nodeRadius,
    fill: isPending ? '#111113' : '#050505',
    stroke: isWinner ? '#d9a531' : '#333338',
    'stroke-width': isWinner ? 2.5 : 1,
  }));

  if (team && team.code !== 'TBD') {
    // Mantém o código em MAIÚSCULO para bater com os arquivos físicos (ex: "FRA", "GER")
    const countryCodeUpper = team.code.toUpperCase();
    const countryCodeLower = team.code.toLowerCase();
    
    // Mapeamento sutil de ISO-3 para ISO-2 para garantir funcionamento estável na API do FlagCDN
    const isoMap = { bra: 'br', fra: 'fr', ger: 'de', esp: 'es', arg: 'ar', can: 'ca', mex: 'mx', usa: 'us', eng: 'gb-eng', nor: 'no', por: 'pt', ita: 'it', jpn: 'jp', mar: 'ma' };
    const flag2Letter = isoMap[countryCodeLower] || countryCodeLower.substring(0, 2);
    
    const apiFlagUrl = team.flag || `https://flagcdn.com/${flag2Letter}.svg`;
    // Aponta estritamente para o padrão da pasta: MAIÚSCULO + .svg
    const localShieldUrl = `assets/img/federations/${countryCodeUpper}.svg`;

    // Recorte circular perfeito para a bandeira interna
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

    // 🔥 CAMADA EXTERNA (ROUND 0): Renderiza os escudos apontando para fora
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

      // Se falhar por ausência física do arquivo, descarta silenciosamente para não quebrar a interface
      imgFederation.onerror = () => imgFederation.remove();
      svgLayer.appendChild(imgFederation);
      
      // Linha guia pontilhada até o escudo
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

  // Interações de Hover
  g.onmouseenter = (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = { x: e.clientX - rect.left, y: e.clientY - rect.top, matchId };
    renderUI();
  };
  g.onmouseleave = () => { state.hover = null; renderUI(); };

  svgLayer.appendChild(g);
}

// ============================================================
// HELPERS, BACKGROUND & UI SYNC
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
