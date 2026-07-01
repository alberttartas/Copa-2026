// ============================================================
// BRACKET CIRCULAR – UI BLINDADA (VERSÃO ESTÁVEL)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- DOM ----------
const svgLayer   = document.getElementById('bracket-layer');
const tooltipEl  = document.getElementById('tooltip');
const panelEl    = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

// ---------- GUARD ----------
if (!svgLayer || !tooltipEl || !panelEl || !statusText) {
  throw new Error('DOM obrigatório não encontrado');
}

// ---------- STATE ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  updatedAt: null,
  loading: false
};

// ---------- SAFE CLICK ----------
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (!state.loading) load();
  });
}

// ---------- CONSTANTS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLORS = [
  '#e6484f','#3ddc84','#f0c23d','#4ea1f7',
  '#b768e0','#ff9f53','#2ec4b6','#ff6f91'
];
const GREY = '#3c3c40';

// ---------- HELPERS ----------
function elNS(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function polar(r, a) {
  return [
    CX + r * Math.sin(a),
    CY - r * Math.cos(a)
  ];
}

function clearSVG() {
  while (svgLayer.firstChild) svgLayer.removeChild(svgLayer.firstChild);
}

// ---------- SAFE FETCH ----------
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

  statusText.textContent = 'Atualizando...';

  try {
    const res = await fetch('/api/bracket', { cache: 'no-store' });
    const data = await safeJSON(res);

    if (id !== requestId) return; // abort race

    state.rounds = data.rounds || [];
    state.leaves = data.leaves || [];
    state.updatedAt = data.updatedAt || null;

    render();
    renderUI();

    statusText.textContent = 'OK';
  } catch (e) {
    statusText.textContent = 'Erro API';
    console.error(e);
  } finally {
    state.loading = false;
  }
}

// ---------- RENDER ----------
function render() {
  clearSVG();

  const { rounds, leaves } = state;
  if (!rounds.length || !leaves.length) return;

  let prev = leaves.map((t, i) => {
    const a = (i / leaves.length) * Math.PI * 2;
    const c = COLORS[i % COLORS.length];

    drawNode(t, LEVEL_R[0], a, c, false, null);

    return { team: t, angle: a, colorIndex: i % COLORS.length };
  });

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];

    const r1 = LEVEL_R[ri];
    const r2 = LEVEL_R[ri + 1] || LEVEL_R[ri];

    const current = [];

    for (const m of round.matches || []) {
      const h = prev.find(n => n.team?.id === m.home?.id);
      const a = prev.find(n => n.team?.id === m.away?.id);

      if (!h || !a) continue;

      const angle = (h.angle + a.angle) / 2;
      const color = COLORS[h.colorIndex ?? 0];

      drawConnection(r1, h.angle, a.angle, color);

      const winner =
        m.winnerId
          ? (m.home?.id === m.winnerId ? m.home : m.away)
          : { code: 'TBD', id: null };

      drawNode(
        winner,
        r2,
        angle,
        m.winnerId ? color : GREY,
        !m.winnerId,
        m.fixtureId
      );

      current.push({
        team: winner,
        angle,
        colorIndex: h.colorIndex
      });
    }

    prev = current;
  }
}

// ---------- NODE ----------
function drawNode(team, r, a, color, pending, matchId) {
  if (!isFinite(a)) return;

  const [x, y] = polar(r, a);

  const g = elNS('g');

  g.appendChild(elNS('circle', {
    cx: x,
    cy: y,
    r: 14,
    fill: pending ? '#222' : color,
    stroke: '#000'
  }));

  const t = elNS('text', {
    x,
    y: y + 4,
    'text-anchor': 'middle',
    'font-size': 10,
    fill: '#fff'
  });

  t.textContent = team?.code || 'TBD';
  g.appendChild(t);

  g.onmouseenter = (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      matchId
    };
    renderUI();
  };

  g.onmouseleave = () => {
    state.hover = null;
    renderUI();
  };

  svgLayer.appendChild(g);
}

// ---------- CONNECTION ----------
function drawConnection(r, a, b, color) {
  if (!isFinite(a) || !isFinite(b)) return;

  const [x1, y1] = polar(r, a);
  const [x2, y2] = polar(r, b);

  svgLayer.appendChild(elNS('path', {
    d: `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`,
    stroke: color,
    fill: 'none'
  }));
}

// ---------- UI ----------
function renderUI() {
  const hover = state.hover;

  if (!hover) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  const match = state.rounds
    .flatMap(r => r.matches || [])
    .find(m => m.fixtureId === hover.matchId);

  if (!match) {
    tooltipEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    return;
  }

  tooltipEl.style.transform =
    `translate3d(${hover.x + 12}px,${hover.y + 12}px,0)`;

  tooltipEl.classList.add('visible');
  panelEl.classList.add('visible');
}

// ---------- LOOP CONTROL ----------
load();
setInterval(load, 90000);
