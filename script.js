// ============================================================
// BRACKET CIRCULAR – HIERARQUIA REAL (VERSÃO PROFISSIONAL)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM (SAFE) ----------
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
  hover: null, // { x, y, matchId }
  updatedAt: null,
  loading: false,
};

// ---------- SAFE CLICK ----------
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (!state.loading) load();
  });
}

// ---------- CONSTANTS ----------
const CX = 600,
  CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLORS = [
  '#e6484f', '#3ddc84', '#f0c23d', '#4ea1f7',
  '#b768e0', '#ff9f53', '#2ec4b6', '#ff6f91',
];
const GREY = '#3c3c40';

// ---------- HELPERS ----------
function elNS(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function polar(r, a) {
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function clearSVG() {
  while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);
}

// ---------- SAFE JSON ----------
async function safeJSON(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('API retornou JSON inválido');
  }
}

// ---------- LOAD (ANTI-RACE) ----------
let requestId = 0;

async function load() {
  const id = ++requestId;
  state.loading = true;

  if (statusText) statusText.textContent = 'Atualizando...';

  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await safeJSON(res);

    if (id !== requestId) return; // abort race

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
// RENDER PRINCIPAL (COM HIERARQUIA REAL)
// ============================================================
function render() {
  if (!svgLayer) return;
  clearSVG();

  const { rounds, leaves } = state;
  if (!rounds.length || !leaves.length) {
    if (statusText) statusText.textContent = '⏳ Aguardando dados...';
    return;
  }

  // ---------- TAÇA CENTRAL ----------
  drawTrophy();

  // ---------- FUNDO E ANÉIS ----------
  drawBackground();

  // ---------- FASE 0: LEAVES (PRIMEIRA FASE) ----------
  const totalLeaves = leaves.length;
  const halfLeaves = totalLeaves / 2;

  let prevNodes = leaves.map((team, i) => {
    // Distribuição por confrontos: cada match ocupa um setor
    const matchIndex = Math.floor(i / 2);
    const isHome = i % 2 === 0;

    // Ângulo base do confronto
    const baseAngle = (matchIndex / halfLeaves) * 2 * Math.PI - Math.PI / 2;

    // Offset para home/away dentro do confronto
    const offset = isHome ? -0.08 : 0.08;
    const angle = baseAngle + offset;

    const colorIdx = matchIndex % COLORS.length;
    const color = COLORS[colorIdx];

    drawNode(team, LEVEL_R[0], angle, color, false, null);

    return {
      team,
      angle,
      colorIndex: colorIdx,
      matchIndex,
      isHome,
    };
  });

  // ---------- FASES SEGUINTES ----------
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const matches = round.matches || [];

    const r1 = LEVEL_R[ri];
    const r2 = LEVEL_R[ri + 1] || LEVEL_R[ri];

    const currentNodes = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];

      // Encontrar os pais (home e away) na fase anterior
      const homeParent = prevNodes.find((n) => n.team?.id === match.home?.id);
      const awayParent = prevNodes.find((n) => n.team?.id === match.away?.id);

      if (!homeParent || !awayParent) continue;

      // Ângulo do filho = média dos ângulos dos pais (com ajuste de wrap)
      let childAngle = (homeParent.angle + awayParent.angle) / 2;
      let diff = awayParent.angle - homeParent.angle;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      childAngle = homeParent.angle + diff / 2;

      // Determinar vencedor
      let winnerTeam = null;
      let decided = false;
      if (match.winnerId != null) {
        decided = true;
        winnerTeam = match.home?.id === match.winnerId ? match.home : match.away;
      } else if (match.status === 'FINISHED' && match.score) {
        const hScore = match.score?.home ?? 0;
        const aScore = match.score?.away ?? 0;
        if (hScore > aScore) { decided = true;
          winnerTeam = match.home; } else if (aScore > hScore) { decided = true;
          winnerTeam = match.away; } else if (match.score?.penalties) {
          const ph = match.score.penalties?.home ?? 0;
          const pa = match.score.penalties?.away ?? 0;
          if (ph > pa) { decided = true;
            winnerTeam = match.home; } else if (pa > ph) { decided = true;
            winnerTeam = match.away; }
        }
      }

      // Cor do ramo (herdada do pai que venceu)
      const winnerIsHome = decided && winnerTeam && winnerTeam.id === match.home?.id;
      const colorIdx = decided
        ? (winnerIsHome ? homeParent.colorIndex : awayParent.colorIndex)
        : homeParent.colorIndex;
      const color = decided ? COLORS[colorIdx] : GREY;

      // ---------- CONEXÃO (BÉZIER) ----------
      drawBezierConnection(r1, homeParent.angle, awayParent.angle, r2, childAngle, color);

      // ---------- NÓ DO VENCEDOR ----------
      const teamObj = winnerTeam || { name: 'TBD', code: 'TBD', id: null };
      drawNode(
        teamObj,
        r2,
        childAngle,
        decided ? color : GREY,
        !decided,
        match.fixtureId
      );

      currentNodes.push({
        team: teamObj,
        angle: childAngle,
        colorIndex: colorIdx,
        matchIndex: i,
        isHome: false,
      });
    }

    prevNodes = currentNodes;

    // Se não houver mais nós, interrompe
    if (prevNodes.length === 0) break;
  }
}

// ============================================================
// DESENHO DE FUNDO E ANÉIS
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
// CONEXÃO POR BÉZIER (SUAVE E PROFISSIONAL)
// ============================================================
function drawBezierConnection(r1, angleA, angleB, r2, childAngle, color) {
  if (!isFinite(angleA) || !isFinite(angleB) || !isFinite(childAngle)) return;

  const [x1, y1] = polar(r1, angleA);
  const [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar((r1 + r2) / 2, childAngle);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Curva Bézier suave
  const path = elNS('path', {
    d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path);

  // Segunda curva (do centro até o filho)
  const path2 = elNS('path', {
    d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path2);
}

// ============================================================
// NÓ (TIME)
// ============================================================
function drawNode(team, r, a, color, pending, matchId) {
  if (!isFinite(a)) return;

  const [x, y] = polar(r, a);
  if (!isFinite(x) || !isFinite(y)) return;

  const g = elNS('g', { 'data-match-id': matchId || '' });

  // Círculo do nó
  g.appendChild(elNS('circle', {
    cx: x,
    cy: y,
    r: 16,
    fill: pending ? '#222' : color,
    stroke: '#000',
    'stroke-width': 1.5,
  }));

  // Texto (código do time)
  const t = elNS('text', {
    x,
    y: y + 4,
    'text-anchor': 'middle',
    'font-size': 9,
    fill: '#fff',
    'font-weight': 'bold',
  });
  t.textContent = team?.code || 'TBD';
  g.appendChild(t);

  // Eventos (hover)
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

  // Encontrar o match pelo fixtureId
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
    : match.isLive ? 'AO VIVO' : 'vs';
  const stage = match.stage || 'Fase eliminatória';
  const date = match.date ? new Date(match.date).toLocaleDateString('pt-BR') : '--/--';
  const time = match.date ? new Date(match.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const winner = match.winnerId != null
    ? (match.home?.id === match.winnerId ? match.home : match.away)
    : null;
  const winnerName = winner?.name || '';

  // ===== TOOLTIP (flutuante) =====
  tooltipEl.innerHTML = `
    <div><strong>${home}</strong> vs <strong>${away}</strong></div>
    <div class="score">${score}</div>
    <div class="detail">🏆 ${stage}</div>
    <div class="detail">📅 ${date} • 🕘 ${time}</div>
    ${match.isLive ? '<div class="detail live">🔴 AO VIVO</div>' : ''}
  `;

  tooltipEl.style.transform = `translate3d(${hover.x + 16}px, ${hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');

  // ===== PANEL (fixo) =====
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
// INICIALIZAÇÃO
// ============================================================
load();
setInterval(load, 90000);

console.log('🏆 Bracket circular profissional iniciado.');
