// ============================================================
// BRACKET CIRCULAR – GEOMETRIA ESPELHADA & IMAGENS DINÂMICAS
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
const CX = 600,
  CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];
const COLORS = [
  '#e6484f', '#3ddc84', '#f0c23d', '#4ea1f7',
  '#b768e0', '#ff9f53', '#2ec4b6', '#ff6f91',
];
const GREY = '#3c3c40';

// ============================================================
// LAYOUT ESPELHADA (IDÊNTICO À REFERÊNCIA)
// ============================================================

function buildFixedLayout(totalLeaves) {
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = [];

  for (let r = 0; r < totalRounds; r++) {
    layout.push([]);
  }

  // ---------- ROUND 0 (FOLHAS) – DIVISÃO EM DOIS HEMISFÉRIOS ----------
  const half = totalLeaves / 2;

  for (let i = 0; i < totalLeaves; i++) {
    let angle;
    
    if (i < half) {
      // 🟩 HEMISFÉRIO ESQUERDO (Avança da esquerda para o centro)
      const percent = i / (half - 1);
      angle = Math.PI + (Math.PI / 1.25) * (percent - 0.5);
    } else {
      // 🟨 HEMISFÉRIO DIREITO (Avança da direita para o centro)
      const idx = i - half;
      const percent = idx / (half - 1);
      angle = (Math.PI / 1.25) * (0.5 - percent);
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
      colorIndex: i % COLORS.length,
      isPending: true,
      isWinner: false,
      x: CX + radius * Math.sin(angle),
      y: CY - radius * Math.cos(angle),
    });
  }

  // ---------- ROUNDS SEGUINTES – CAMINHO RADIAL PERFEITO ----------
  for (let r = 1; r < totalRounds; r++) {
    const prevLayer = layout[r - 1];
    const count = prevLayer.length / 2;
    const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];

    for (let i = 0; i < count; i++) {
      const parent1 = prevLayer[i * 2];
      const parent2 = prevLayer[i * 2 + 1];

      // Média geométrica simples e segura por hemisfério
      const angle = (parent1.angle + parent2.angle) / 2;

      layout[r].push({
        id: `r${r}_n${i}`,
        round: r,
        index: i,
        angle,
        radius,
        team: null,
        matchId: null,
        colorIndex: parent1.colorIndex, // Mantém a cor da ramificação original
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
// MAPEAMENTO API → SLOTS (POR ASSOCIAÇÃO 1:1 ESTRITA)
// ============================================================

function mapApiToSlots(leaves, rounds) {
  const totalLeaves = leaves.length || 32;
  const layout = buildFixedLayout(totalLeaves);

  // 1. Popula o Round 0 (Folhas)
  const leafSlots = layout[0] || [];
  for (let i = 0; i < leaves.length && i < leafSlots.length; i++) {
    const slot = leafSlots[i];
    slot.team = leaves[i];
    slot.isPending = false;
    slot.isWinner = false;
  }

  // 2. Popula os Rounds Seguintes por Índice Linear Direto da Árvore Binária
  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    const matches = round.matches || [];
    const nextLayer = layout[ri + 1] || [];

    for (let i = 0; i < nextLayer.length; i++) {
      const slot = nextLayer[i];
      const match = matches[i];

      if (match) {
        let winner = null;
        let decided = false;

        if (match.winnerId != null) {
          decided = true;
          winner = match.home?.id === match.winnerId ? match.home : match.away;
        } else if (match.status === 'FINISHED' && match.score) {
          const h = match.score?.home ?? 0;
          const a = match.score?.away ?? 0;
          if (h > a) { decided = true; winner = match.home; } 
          else if (a > h) { decided = true; winner = match.away; }
          else if (match.score?.penalties) {
            const ph = match.score.penalties?.home ?? 0;
            const pa = match.score.penalties?.away ?? 0;
            if (ph > pa) { decided = true; winner = match.home; } 
            else if (pa > ph) { decided = true; winner = match.away; }
          }
        }

        slot.team = winner || null;
        slot.isPending = !decided;
        slot.matchId = match.fixtureId;
        slot.isWinner = decided;
      }
    }
  }

  return layout;
}

// ============================================================
// RENDER SVG
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

  // Renderizar os nós com imagens
  for (const layer of layout) {
    for (const slot of layer) {
      const team = slot.team;
      const isPending = slot.isPending || !team;
      const isWinner = slot.isWinner;
      const color = isPending ? GREY : COLORS[slot.colorIndex % COLORS.length];

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

  drawTrophy();

  if (statusText) {
    const ts = state.updatedAt
      ? new Date(state.updatedAt).toLocaleString('pt-BR')
      : 'agora';
    statusText.textContent = `✅ Atualizado ${ts}`;
  }
}

// ============================================================
// CONEXÕES FIXAS
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
// CURVAS BÉZIER RADIAIS
// ============================================================

function drawBezierConnection(r1, angleA, r2, angleB, rMid, childAngle, rChild, color) {
  if (!isFinite(angleA) || !isFinite(angleB) || !isFinite(childAngle)) return;

  const [x1, y1] = polar(r1, angleA);
  const [x2, y2] = polar(r1, angleB);
  const [cx, cy] = polar(rMid, childAngle);
  const [cx2, cy2] = polar(rChild, childAngle);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const path1 = elNS('path', {
    d: `M${x1},${y1} Q${midX},${midY} ${cx},${cy}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path1);

  const path2 = elNS('path', {
    d: `M${cx},${cy} Q${midX},${midY} ${x2},${y2}`,
    stroke: color || '#4b5563',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  svgLayer.appendChild(path2);

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
// NÓ COMPACTO (ESCUDO LOCAL COM FALLBACK PARA BANDEIRA API)
// ============================================================

function drawNode(team, r, a, color, pending, matchId, isWinner) {
  if (!isFinite(a)) return;

  const [x, y] = polar(r, a);
  if (!isFinite(x) || !isFinite(y)) return;

  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  // Tamanhos ideais semelhantes ao mockup de referência
  const radius = isWinner ? 19 : 15;
  const strokeWidth = isWinner ? 3 : 1.5;

  // Círculo de borda e fundo
  g.appendChild(elNS('circle', {
    cx: x,
    cy: y,
    r: radius,
    fill: pending ? '#222' : color,
    stroke: isWinner ? '#d9a531' : '#111',
    'stroke-width': strokeWidth,
  }));

  if (!pending && team && team.code !== 'TBD') {
    const countryCode = team.code.toLowerCase();
    
    // Caminhos de imagem definidos
    const localShieldUrl = `assets/img/federations/${countryCode}.svg`;
    const apiFlagUrl = team.flag || `https://flagcdn.com/${countryCode === 'ger' ? 'de' : countryCode.substring(0,2)}.svg`;

    // Criação da Máscara de Recorte Circular (ClipPath)
    const clipId = `clip-${countryCode}-${r}-${Math.floor(Math.abs(a)*100)}`;
    const clipPath = elNS('clipPath', { id: clipId });
    clipPath.appendChild(elNS('circle', { cx: x, cy: y, r: radius - 0.5 }));
    svgLayer.appendChild(clipPath);

    // Elemento da Imagem
    const img = elNS('image', {
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
      href: localShieldUrl, // Tenta primeiro o Escudo da Federação Local
      preserveAspectRatio: 'xMidYMid slice',
      'clip-path': `url(#${clipId})`
    });

    // Fallback estratégico: se o arquivo .svg local não existir, renderiza a flag da API
    img.onerror = () => {
      img.setAttribute('href', apiFlagUrl);
    };

    g.appendChild(img);
  } else {
    // Texto TBD discreto interno para nós vazios
    const t = elNS('text', {
      x,
      y: y + 3,
      'text-anchor': 'middle',
      'font-size': 8,
      fill: '#555',
      'font-weight': 'bold',
      'font-family': 'sans-serif'
    });
    t.textContent = 'TBD';
    g.appendChild(t);
  }

  // ---------- MOUSE INTERACTION ----------
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
// HELPER FUNCTIONS
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
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#2a2210' }));
  grad.appendChild(elNS('stop', { offset: '60%', 'stop-color': '#11100d' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#070708' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));

  LEVEL_R.forEach((r) => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#1f1f23', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 52, fill: '#070708', stroke: '#2a2210', 'stroke-width': 2 }));
  const t = elNS('text', { x: CX, y: CY + 12, 'text-anchor': 'middle', 'font-size': 42, fill: '#d9a531' });
  t.textContent = '🏆';
  g.appendChild(t);
  svgLayer.appendChild(g);
}

// ============================================================
// UI TOOLTIP & PANEL HANDLERS
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
// DATA DESPATCHER (ANTI-RACE)
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

if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (!state.loading) load();
  });
}

load();
setInterval(load, 90000);

console.log('🏆 Chaveamento de Copa do Mundo estruturado com sucesso.');
