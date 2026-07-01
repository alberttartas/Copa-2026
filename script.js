// ============================================================
// BRACKET CIRCULAR – LAYOUT FIXO (GEOMETRIA DETERMINÍSTICA)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM ----------
const svgLayer = document.getElementById('bracket-layer');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

// ---------- GUARD ----------
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
const CX = 600,
  CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLORS = [
  '#e6484f', '#3ddc84', '#f0c23d', '#4ea1f7',
  '#b768e0', '#ff9f53', '#2ec4b6', '#ff6f91',
];
const GREY = '#3c3c40';

// ============================================================
// GEOMETRIA FIXA – POSIÇÃO DETERMINÍSTICA
// ============================================================

function getNodePosition(roundIndex, nodeIndex, totalLeaves) {
  const count = totalLeaves / Math.pow(2, roundIndex);
  const angleStep = (2 * Math.PI) / count;
  const angle = nodeIndex * angleStep - Math.PI / 2;
  return { angle, count };
}

// ============================================================
// LAYOUT PRÉ-CALCULADO (FIXO, NUNCA MUDA)
// ============================================================

function buildFixedLayout(totalLeaves) {
  const slots = [];

  // Número total de rounds (folhas + fases seguintes)
  const totalRounds = Math.ceil(Math.log2(totalLeaves)) + 1;

  for (let r = 0; r < totalRounds; r++) {
    const count = Math.max(1, totalLeaves / Math.pow(2, r));
    const layer = [];

    for (let i = 0; i < count; i++) {
      const { angle } = getNodePosition(r, i, totalLeaves);
      const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];

      layer.push({
        round: r,
        index: i,
        angle,
        radius,
        x: CX + radius * Math.sin(angle),
        y: CY - radius * Math.cos(angle),
        team: null,
        matchId: null,
        isPending: true,
        isWinner: false,
        colorIndex: i % COLORS.length,
      });
    }

    slots.push(layer);
  }

  return slots;
}

// ============================================================
// MAPEAMENTO: DADOS DA API → SLOTS FIXOS
// ============================================================

function mapApiToSlots(leaves, rounds) {
  const totalLeaves = leaves.length;
  const layout = buildFixedLayout(totalLeaves);

  // ---------- ROUND 0: FOLHAS ----------
  const leafSlots = layout[0] || [];
  leaves.forEach((team, i) => {
    if (i < leafSlots.length) {
      leafSlots[i].team = team;
      leafSlots[i].isPending = false;
      leafSlots[i].matchId = null;
      leafSlots[i].isWinner = false;
    }
  });

  // ---------- ROUNDS SEGUINTES ----------
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const matches = round.matches || [];
    const nextLayer = layout[ri + 1] || [];

    for (let i = 0; i < matches.length && i < nextLayer.length; i++) {
      const match = matches[i];
      const slot = nextLayer[i];

      // Determinar vencedor
      let winner = null;
      let decided = false;

      if (match.winnerId != null) {
        decided = true;
        winner = match.home?.id === match.winnerId ? match.home : match.away;
      } else if (match.status === 'FINISHED' && match.score) {
        const h = match.score?.home ?? 0;
        const a = match.score?.away ?? 0;
        if (h > a) { decided = true;
          winner = match.home; } else if (a > h) { decided = true;
          winner = match.away; } else if (match.score?.penalties) {
          const ph = match.score.penalties?.home ?? 0;
          const pa = match.score.penalties?.away ?? 0;
          if (ph > pa) { decided = true;
            winner = match.home; } else if (pa > ph) { decided = true;
            winner = match.away; }
        }
      }

      slot.team = winner || null;
      slot.isPending = !decided;
      slot.matchId = match.fixtureId;
      slot.isWinner = decided;
    }
  }

  return layout;
}

// ============================================================
// RENDER SVG (USANDO LAYOUT FIXO)
// ============================================================

function render() {
  if (!svgLayer) return;
  clearSVG();

  const { rounds, leaves } = state;
  if (!rounds.length || !leaves.length) {
    if (statusText) statusText.textContent = '⏳ Aguardando dados...';
    return;
  }

  // Layout fixo com dados da API
  const layout = mapApiToSlots(leaves, rounds);

  // ---------- FUNDO ----------
  drawBackground();

  // ---------- CONEXÕES FIXAS ----------
  drawFixedConnections(layout);

  // ---------- NÓS ----------
  for (const layer of layout) {
    for (const slot of layer) {
      const team = slot.team;
      const isPending = slot.isPending;
      const isWinner = slot.isWinner;
      const color = isPending ? GREY : COLORS[slot.colorIndex];

      drawNode(
        team || { code: 'TBD', name: 'TBD', id: null },
        slot.radius,
        slot.angle,
        color,
        isPending,
        slot.matchId,
        isWinner
      );
    }
  }

  // ---------- TAÇA ----------
  drawTrophy();

  // ---------- STATUS ----------
  if (statusText) {
    const ts = state.updatedAt
      ? new Date(state.updatedAt).toLocaleString('pt-BR')
      : 'agora';
    statusText.textContent = `✅ Atualizado ${ts}`;
  }
}

// ============================================================
// CONEXÕES FIXAS (PRÉ-DEFINIDAS, GEOMETRIA PURA)
// ============================================================

function drawFixedConnections(layout) {
  for (let r = 0; r < layout.length - 1; r++) {
    const currentLayer = layout[r];
    const nextLayer = layout[r + 1];

    if (!currentLayer || !nextLayer) continue;

    const r1 = LEVEL_R[r] || LEVEL_R[0];
    const rMid = (LEVEL_R[r] + LEVEL_R[r + 1]) / 2;

    for (let i = 0; i < currentLayer.length; i += 2) {
      const parent1 = currentLayer[i];
      const parent2 = currentLayer[i + 1];
      const child = nextLayer[Math.floor(i / 2)];

      if (!parent1 || !parent2 || !child) continue;

      const color = COLORS[child.colorIndex % COLORS.length];

      drawBezierConnection(
        parent1.radius,
        parent1.angle,
        parent2.radius,
        parent2.angle,
        rMid,
        child.angle,
        child.radius,
        color
      );
    }
  }
}

// ============================================================
// CONEXÃO POR BÉZIER (SUAVE)
// ============================================================

function drawBezierConnection(r1, angleA, r2, angleB, rMid, childAngle, rChild, color) {
  if (!isFinite(angleA) || !isFinite(angleB) || !isFinite(childAngle)) return;

  const [x1, y1] = polar(r1, angleA);
  const [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar(rMid, childAngle);
  const [cx2, cy2] = polar(rChild, childAngle);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Curva: pai1 → centro
  const path1 = elNS('path', {
    d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path1);

  // Curva: centro → pai2
  const path2 = elNS('path', {
    d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path2);

  // Linha: centro → filho
  const path3 = elNS('path', {
    d: `M${cx},${cy} L${cx2},${cy2}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path3);
}

// ============================================================
// NÓ (TIME) – GEOMETRIA FIXA, ESTADO VARIÁVEL
// ============================================================

function drawNode(team, r, a, color, pending, matchId, isWinner) {
  if (!isFinite(a)) return;

  const [x, y] = polar(r, a);
  if (!isFinite(x) || !isFinite(y)) return;

  const g = elNS('g', { 'data-match-id': matchId || '' });

  // Círculo (tamanho varia se é vencedor)
  const radius = isWinner ? 18 : 14;
  const strokeWidth = isWinner ? 3 : 1.5;

  g.appendChild(elNS('circle', {
    cx: x,
    cy: y,
    r: radius,
    fill: pending ? '#222' : color,
    stroke: isWinner ? '#d9a531' : '#000',
    'stroke-width': strokeWidth,
  }));

  // Texto
  const t = elNS('text', {
    x,
    y: y + 4,
    'text-anchor': 'middle',
    'font-size': isWinner ? 11 : 9,
    fill: '#fff',
    'font-weight': isWinner ? 'bold' : 'normal',
  });
  t.textContent = team?.code || 'TBD';
  g.appendChild(t);

  // Eventos
  g.onmouseenter = (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      matchId,
    };
    renderUI();
  };

  g.onmouseleave = () => {
    state.hover = null;
    renderUI();
  };

  svgLayer.appendChild(g);
}

// ============================================================
// FUNÇÕES AUXILIARES
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

// ============================================================
// FUNDO E ANÉIS
// ============================================================

function drawBackground() {
  const defs = elNS('defs', { id: 'defs' });
  const grad = elNS('radialGradient', { id: 'bgGlow', cx: '50%', cy: '50%', r: '55%' });
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#3a2c0c' }));
  grad.appendChild(elNS('stop', { offset: '55%', 'stop-color': '#15120a' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#0b0b0c' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));

  LEVEL_R.forEach((r) => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#222226', 'stroke-width': 1 }));
  });
}

// ============================================================
// TAÇA CENTRAL
// ============================================================

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 56, fill: '#0b0b0c', stroke: '#3a2c0c', 'stroke-width': 2 }));
  const t = elNS('text', { x: CX, y: CY + 8, 'text-anchor': 'middle', 'font-size': 40, fill: '#d9a531' });
  t.textContent = '🏆';
  g.appendChild(t);
  svgLayer.appendChild(g);
}

// ============================================================
// UI (TOOLTIP + PANEL)
// ============================================================

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
  const score = match.status === 'FINISHED'
    ? `${match.score?.home ?? 0} – ${match.score?.away ?? 0}`
    : match.isLive ? 'AO VIVO' : 'VS';
  const stage = match.stage || 'Fase eliminatória';
  const date = match.date ? new Date(match.date).toLocaleDateString('pt-BR') : '--/--';
  const time = match.date ? new Date(match.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const winner = match.winnerId != null
    ? (match.home?.id === match.winnerId ? match.home : match.away)
    : null;
  const winnerName = winner?.name || '';

  tooltipEl.innerHTML = `
    <div><strong>${home}</strong> vs <strong>${away}</strong></div>
    <div class="score">${score}</div>
    <div class="detail">🏆 ${stage}</div>
    <div class="detail">📅 ${date} • 🕘 ${time}</div>
    ${match.isLive ? '<div class="detail live">🔴 AO VIVO</div>' : ''}
  `;

  tooltipEl.style.transform = `translate3d(${hover.x + 16}px, ${hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');

  panelEl.innerHTML = `
    <div class="match-title">
      <span>${home}</span>
      <span style="color:#6b7280;margin:0 4px;">vs</span>
      <span>${away}</span>
    </div>
    <div class="match-score">${score}</div>
    <div class="match-detail">
      🏆 ${stage}
      ${winnerName ? ` — 🏅 <strong style="color:#d9a531;">${winnerName}</strong>` : ''}
    </div>
    <div class="match-detail">📅 ${date} • 🕘 ${time}</div>
    ${match.isLive ? '<div class="match-detail live">🔴 AO VIVO</div>' : ''}
  `;

  panelEl.classList.add('visible');
}

// ============================================================
// LOAD (ANTI-RACE)
// ============================================================

let requestId = 0;

async function load() {
  const id = ++requestId;
  state.loading = true;

  if (statusText) statusText.textContent = 'Atualizando...';

  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await res.json();

    if (id !== requestId) return;

    state.rounds = data.rounds || [];
    state.leaves = data.leaves || [];
    state.updatedAt = data.updatedAt || null;

    render();
    renderUI();

    if (statusText) {
      const ts = state.updatedAt
        ? new Date(state.updatedAt).toLocaleString('pt-BR')
        : 'agora';
      statusText.textContent = `✅ Atualizado ${ts}`;
    }
  } catch (e) {
    console.error(e);
    if (statusText) statusText.textContent = '❌ Erro ao carregar';
  } finally {
    state.loading = false;
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (!state.loading) load();
  });
}

load();
setInterval(load, 90000);

console.log('🏆 Bracket circular com geometria fixa iniciado.');
console.log('📊 Layout determinístico: posições nunca mudam.');
