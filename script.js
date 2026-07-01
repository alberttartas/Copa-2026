// ============================================================
// BRACKET CIRCULAR – UI ESTÁVEL (class-based visibility)
// ✅ tooltip e panel controlados por .visible
// ✅ dados reais do match preenchem UI
// ✅ fundo e taça incluídos no render
// ✅ sem conflito entre class e style
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
  hover: null, // { x, y, matchId }
  updatedAt: null,
};

// ---------- CONSTANTES ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];
const COLORS = [
  '#e6484f', '#3ddc84', '#f0c23d', '#4ea1f7',
  '#b768e0', '#ff9f53', '#2ec4b6', '#ff6f91',
];
const GREY = '#3c3c40';

// ---------- HELPERS ----------
function elNS(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

function polar(r, a) {
  return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
}

function clearSVG() {
  while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);
}

// ---------- FUNDO E TAÇA ----------
function drawBackground() {
  const defs = elNS('defs', { id: 'defs' });
  const grad = elNS('radialGradient', { id: 'bgGlow', cx: '50%', cy: '50%', r: '55%' });
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#3a2c0c' }));
  grad.appendChild(elNS('stop', { offset: '55%', 'stop-color': '#15120a' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#0b0b0c' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));
  LEVEL_R.forEach(r => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#222226', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 56, fill: '#0b0b0c', stroke: '#3a2c0c', 'stroke-width': 2 }));
  const t = elNS('text', { x: CX, y: CY + 8, 'text-anchor': 'middle', 'font-size': 40, fill: '#d9a531' });
  t.textContent = '🏆';
  g.appendChild(t);
  svgLayer.appendChild(g);
}

// ---------- NÓ ----------
function drawNode(team, r, a, color, pending, matchId) {
  if (!isFinite(a)) return;
  const [x, y] = polar(r, a);
  if (!isFinite(x) || !isFinite(y)) return;

  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: x, cy: y, r: 14, fill: pending ? '#222' : color, stroke: '#000' }));
  const text = elNS('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 10, fill: '#fff' });
  text.textContent = team?.code || 'TBD';
  g.appendChild(text);

  g.addEventListener('mouseenter', (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      matchId: matchId || null,
    };
    renderUI();
  });
  g.addEventListener('mouseleave', () => {
    state.hover = null;
    renderUI();
  });

  svgLayer.appendChild(g);
}

// ---------- CONEXÃO ----------
function drawConnection(r, a, b, color) {
  if (!isFinite(a) || !isFinite(b)) return;
  const [x1, y1] = polar(r, a);
  const [x2, y2] = polar(r, b);
  if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
  const path = elNS('path', {
    d: `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`,
    stroke: color,
    fill: 'none',
  });
  svgLayer.appendChild(path);
}

// ---------- PROPAGAÇÃO DE VENCEDORES ----------
function propagateWinners(rounds) {
  const matchMap = new Map();
  for (const r of rounds) {
    for (const m of r.matches) {
      matchMap.set(m.fixtureId, m);
    }
  }
  for (const r of rounds) {
    for (const m of r.matches) {
      if (!m.nextMatchId) continue;
      const next = matchMap.get(m.nextMatchId);
      if (!next) continue;

      let winner = null;
      if (m.winnerId != null) {
        winner = (m.home?.id === m.winnerId) ? m.home : m.away;
      } else if (m.status === 'FINISHED' && m.score) {
        const h = m.score?.home ?? 0;
        const a = m.score?.away ?? 0;
        if (h > a) winner = m.home;
        else if (a > h) winner = m.away;
        else if (m.score?.penalties) {
          const ph = m.score.penalties?.home ?? 0;
          const pa = m.score.penalties?.away ?? 0;
          if (ph > pa) winner = m.home;
          else if (pa > ph) winner = m.away;
        }
      }
      if (!winner) continue;
      if (m.nextSlot === 'home') next.home = winner;
      else if (m.nextSlot === 'away') next.away = winner;
    }
  }
}

// ---------- RENDER SVG ----------
function render() {
  clearSVG();
  drawBackground();

  const rounds = state.rounds;
  const leaves = state.leaves;
  if (!rounds.length || !leaves.length) {
    statusText.textContent = 'Aguardando dados…';
    return;
  }

  propagateWinners(rounds);

  // FASE 0
  let prev = leaves.map((team, i) => {
    const a = (i / leaves.length) * 2 * Math.PI - Math.PI / 2;
    const color = COLORS[i % COLORS.length];
    drawNode(team, LEVEL_R[0], a, color, false, null);
    return { team, angle: a, colorIndex: i % COLORS.length };
  });

  // FASES SEGUINTES
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const r1 = LEVEL_R[ri];
    const r2 = LEVEL_R[ri + 1] || LEVEL_R[ri];
    const current = [];

    for (const m of round.matches || []) {
      const homeParent = prev.find(n => n.team?.id === m.home?.id);
      const awayParent = prev.find(n => n.team?.id === m.away?.id);
      if (!homeParent || !awayParent) continue;

      const childAngle = (homeParent.angle + awayParent.angle) / 2;
      const color = COLORS[homeParent.colorIndex ?? 0];

      drawConnection(r1, homeParent.angle, awayParent.angle, color);

      let winnerTeam = null;
      let decided = false;
      if (m.winnerId != null) {
        decided = true;
        winnerTeam = (m.home?.id === m.winnerId) ? m.home : m.away;
      } else if (m.status === 'FINISHED' && m.score) {
        const h = m.score?.home ?? 0;
        const a = m.score?.away ?? 0;
        if (h > a) { decided = true;
          winnerTeam = m.home; } else if (a > h) { decided = true;
          winnerTeam = m.away; } else if (m.score?.penalties) {
          const ph = m.score.penalties?.home ?? 0;
          const pa = m.score.penalties?.away ?? 0;
          if (ph > pa) { decided = true;
            winnerTeam = m.home; } else if (pa > ph) { decided = true;
            winnerTeam = m.away; }
        }
      }

      const teamObj = winnerTeam || { name: 'TBD', code: 'TBD', id: null };
      drawNode(teamObj, r2, childAngle, decided ? color : GREY, !decided, m.fixtureId);

      current.push({
        team: teamObj,
        angle: childAngle,
        colorIndex: homeParent.colorIndex,
      });
    }

    prev = current;
    if (prev.length === 0) break;
  }

  drawTrophy();

  const ts = state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR') : '--';
  statusText.textContent = `Atualizado em ${ts}`;
}

// ---------- RENDER UI (tooltip + panel) ----------
function renderUI() {
  if (!tooltipEl || !panelEl) return;

  const hover = state.hover;

  // Se não houver hover, esconde ambos usando classes
  if (!hover) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  // Buscar o match pelo fixtureId
  const match = state.rounds
    .flatMap(r => r.matches || [])
    .find(m => m.fixtureId === hover.matchId);

  if (!match) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  // ---------- TOOLTIP ----------
  const home = match.home?.name || 'TBD';
  const away = match.away?.name || 'TBD';
  const score = match.status === 'FINISHED'
    ? `${match.score?.home ?? 0} – ${match.score?.away ?? 0}`
    : (match.isLive ? 'AO VIVO' : 'vs');
  const stage = match.stage || 'Fase eliminatória';
  const date = match.date ? new Date(match.date).toLocaleDateString('pt-BR') : '--/--';
  const time = match.date ? new Date(match.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--';

  tooltipEl.innerHTML = `
    <div><strong>${home}</strong> vs <strong>${away}</strong></div>
    <div class="score">${score}</div>
    <div class="detail">🏆 ${stage}</div>
    <div class="detail">📅 ${date} • 🕘 ${time}</div>
    ${match.isLive ? '<div class="detail live">🔴 AO VIVO</div>' : ''}
  `;
  tooltipEl.style.transform = `translate3d(${hover.x + 16}px, ${hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');

  // ---------- PANEL ----------
  const winner = match.winnerId != null
    ? (match.home?.id === match.winnerId ? match.home : match.away)
    : null;
  const winnerName = winner?.name || '';

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

// ---------- LOAD ----------
async function load() {
  try {
    statusText.textContent = 'Atualizando…';
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na API');

    state.rounds = data.rounds || [];
    state.leaves = data.leaves || [];
    state.updatedAt = data.updatedAt;

    render();
    renderUI(); // limpa hover
  } catch (err) {
    statusText.textContent = `❌ ${err.message}`;
    console.error(err);
  }
}

// ---------- START ----------
refreshBtn.addEventListener('click', load);
load();
setInterval(load, 90000);
