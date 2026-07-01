// ============================================================
// BRACKET CIRCULAR – COPA DO MUNDO 2026 (VERSÃO COM INTERAÇÃO)
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

// ---------- REFERÊNCIAS DO DOM ----------
const svgLayer = document.getElementById('bracket-layer');
const tooltipEl = document.getElementById('tooltip');
const panelEl = document.getElementById('panel');
const statusText = document.getElementById('statusText');
const refreshBtn = document.getElementById('refreshBtn');

// ---------- ESTADO GLOBAL ----------
const state = {
  rounds: [],
  leaves: [],
  hover: null,
  selectedMatchId: null, // Armazena a partida fixada pelo clique
  updatedAt: null,
  loading: false,
};

// ---------- CONSTANTES GEOMÉTRICAS ----------
const CX = 600, CY = 500;
const LEVEL_R = [420, 360, 300, 240, 180, 120];

const COLOR_INACTIVE_LINE = '#26262b';
const COLOR_INACTIVE_NODE = '#111113';

// Cores ativas para destaque dos caminhos de vitória no pôster
const TEAM_COLORS = {
  BRA: '#cc9a18', FRA: '#1e4391', CAN: '#b51219', MAR: '#0d6130',
  NOR: '#a61423', MEX: '#0b4728', ENG: '#d1d1d1', ARG: '#5b96cb',
  GER: '#d1d1d1', POR: '#991116', ESP: '#bd1117', USA: '#042247'
};

// Banco de dados Mock para Artilheiros (Substitua/integre com os dados reais da sua API se preferir)
const SCORERS_DB = {
  BRA: { name: 'Vinícius Jr.', goals: 5 },
  FRA: { name: 'Kylian Mbappé', goals: 6 },
  ARG: { name: 'Lionel Messi', goals: 4 },
  POR: { name: 'Cristiano Ronaldo', goals: 3 },
  ENG: { name: 'Harry Kane', goals: 4 },
  NOR: { name: 'Erling Haaland', goals: 5 },
  ESP: { name: 'Lamine Yamal', goals: 3 },
  GER: { name: 'Jamal Musiala', goals: 4 }
};

// ============================================================
// ORDEM FIXA DOS 32 SLOTS — bracket oficial real da Copa 2026
// ============================================================
const POSITION_ORDER = [
  // ---- ESQUERDA (pos 0 = baixo ... pos 15 = topo) ----
  'BEL', 'SEN', 'USA', 'BIH',   // pos 0-3  (Bélgica/Senegal, EUA/Bósnia)
  'ESP', 'AUT', 'POR', 'CRO',   // pos 4-7  (Espanha/Áustria, Portugal/Croácia)
  'RSA', 'CAN', 'NED', 'MAR',   // pos 8-11 (África do Sul/Canadá, Holanda/Marrocos)
  'GER', 'PAR', 'FRA', 'SWE',   // pos 12-15 (Alemanha/Paraguai, França/Suécia)

  // ---- DIREITA (pos 0 = topo ... pos 15 = baixo) ----
  'BRA', 'JPN', 'CIV', 'NOR',   // pos 0-3  (Brasil/Japão, Costa do Marfim/Noruega)
  'MEX', 'ECU', 'ENG', 'COD',   // pos 4-7  (México/Equador, Inglaterra/Congo)
  'AUS', 'EGY', 'ARG', 'CPV',   // pos 8-11 (Austrália/Egito, Argentina/Cabo Verde)
  'SUI', 'ALG', 'COL', 'GHA',   // pos 12-15 (Suíça/Argélia, Colômbia/Gana)
];

const INDEX_GEOMETRY_MAP = {
  0:  { side: 'left',  pos: 0  }, 1:  { side: 'left',  pos: 1  },
  2:  { side: 'left',  pos: 2  }, 3:  { side: 'left',  pos: 3  },
  4:  { side: 'left',  pos: 4  }, 5:  { side: 'left',  pos: 5  },
  6:  { side: 'left',  pos: 6  }, 7:  { side: 'left',  pos: 7  },
  8:  { side: 'left',  pos: 8  }, 9:  { side: 'left',  pos: 9  },
  10: { side: 'left',  pos: 10 }, 11: { side: 'left',  pos: 11 },
  12: { side: 'left',  pos: 12 }, 13: { side: 'left',  pos: 13 },
  14: { side: 'left',  pos: 14 }, 15: { side: 'left',  pos: 15 },

  16: { side: 'right', pos: 0  }, 17: { side: 'right', pos: 1  },
  18: { side: 'right', pos: 2  }, 19: { side: 'right', pos: 3  },
  20: { side: 'right', pos: 4  }, 21: { side: 'right', pos: 5  },
  22: { side: 'right', pos: 6  }, 23: { side: 'right', pos: 7  },
  24: { side: 'right', pos: 8  }, 25: { side: 'right', pos: 9  },
  26: { side: 'right', pos: 10 }, 27: { side: 'right', pos: 11 },
  28: { side: 'right', pos: 12 }, 29: { side: 'right', pos: 13 },
  30: { side: 'right', pos: 14 }, 31: { side: 'right', pos: 15 }
};

function buildFixedLayout() {
  const totalLeaves = 32;
  const totalRounds = Math.log2(totalLeaves) + 1;
  const layout = Array.from({ length: totalRounds }, () => []);
  const half = totalLeaves / 2;

  const arcStart = 0.05 * Math.PI;
  const arcEnd = 0.95 * Math.PI;

  for (let i = 0; i < totalLeaves; i++) {
    const geo = INDEX_GEOMETRY_MAP[i];
    let angle;

    if (geo.side === 'left') {
      const percent = geo.pos / (half - 1);
      angle = Math.PI + (arcStart + (arcEnd - arcStart) * percent);
    } else {
      const percent = geo.pos / (half - 1);
      angle = arcStart + (arcEnd - arcStart) * percent;
    }

    layout[0].push({
      id: `r0_n${i}`, round: 0, index: i, angle, radius: LEVEL_R[0],
      team: null, matchId: null, isEliminated: false, isWinner: false,
      x: CX + LEVEL_R[0] * Math.sin(angle), y: CY - LEVEL_R[0] * Math.cos(angle)
    });
  }

  for (let r = 1; r < totalRounds; r++) {
    const prevLayer = layout[r - 1];
    const count = prevLayer.length / 2;
    const radius = LEVEL_R[r] || LEVEL_R[LEVEL_R.length - 1];

    for (let i = 0; i < count; i++) {
      const parent1 = prevLayer[i * 2];
      const parent2 = prevLayer[i * 2 + 1];
      const angle = (parent1.angle + parent2.angle) / 2;

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
    const homeCode = match.home?.code?.toUpperCase();
    const awayCode = match.away?.code?.toUpperCase();
    if (homeCode) teamByCode[homeCode] = { team: match.home, match };
    if (awayCode) teamByCode[awayCode] = { team: match.away, match };
  }

  const leftoverEntries = [];
  for (const code in teamByCode) {
    if (!POSITION_ORDER.includes(code)) leftoverEntries.push(teamByCode[code]);
  }
  let leftoverIdx = 0;

  for (let i = 0; i < layout[0].length; i++) {
    const slot = layout[0][i];
    const wantedCode = POSITION_ORDER[i];
    let entry = teamByCode[wantedCode];

    if (!entry && leftoverIdx < leftoverEntries.length) {
      entry = leftoverEntries[leftoverIdx++];
    }

    if (entry) {
      slot.team = entry.team;
      slot.matchId = entry.match.fixtureId;
      const match = entry.match;
      
      if (match.status === 'FINISHED' && match.winnerId && match.winnerId !== entry.team.id) {
        slot.isEliminated = true;
      }
      if (match.status === 'FINISHED' && match.winnerId && match.winnerId === entry.team.id) {
        slot.isWinner = true;
      }
    }
  }

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
          winner = (match.home?.id === match.winnerId) ? match.home : match.away;
        } else if (match.status === 'FINISHED') {
          const hScore = match.score?.home ?? 0;
          const aScore = match.score?.away ?? 0;
          if (hScore > aScore) winner = match.home;
          if (aScore > hScore) winner = match.away;
        }

        if (winner) {
          slotFilho.team = winner;
          slotFilho.isWinner = true;
          if (pai1.team && pai1.team.id === winner.id) { pai1.isWinner = true; pai2.isEliminated = true; }
          if (pai2.team && pai2.team.id === winner.id) { pai2.isWinner = true; pai1.isEliminated = true; }
        } else {
          if (match.home && (pai1.team?.id === match.home.id || pai2.team?.id === match.home.id)) {
             slotFilho.team = match.home;
          } else if (match.away && (pai1.team?.id === match.away.id || pai2.team?.id === match.away.id)) {
             slotFilho.team = match.away;
          }
          if (pai1.team && !pai1.isEliminated) pai1.isWinner = true;
          if (pai2.team && !pai2.isEliminated) pai2.isWinner = true;
        }

        if (match.status === 'FINISHED' && winner && slotFilho.team?.id !== winner.id) {
          slotFilho.isEliminated = true;
          slotFilho.isWinner = false;
        }
      } else {
        if (pai1.isWinner && !pai1.isEliminated) {
          slotFilho.team = pai1.team;
        } else if (pai2.isWinner && !pai2.isEliminated) {
          slotFilho.team = pai2.team;
        }
      }
    }
  }

  return layout;
}

// ============================================================
// RENDERIZAÇÃO GRÁFICA
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

      const color1 = (parent1.isWinner && parent1.team && !parent1.isEliminated) ? (TEAM_COLORS[parent1.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const width1 = (parent1.isWinner && parent1.team && !parent1.isEliminated) ? 2.5 : 1.2;

      const color2 = (parent2.isWinner && parent2.team && !parent2.isEliminated) ? (TEAM_COLORS[parent2.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const width2 = (parent2.isWinner && parent2.team && !parent2.isEliminated) ? 2.5 : 1.2;

      const jointColor = (child.team && !child.isEliminated) ? (TEAM_COLORS[child.team?.code?.toUpperCase()] || '#cda036') : COLOR_INACTIVE_LINE;
      const jointWidth = (child.team && !child.isEliminated) ? 2.5 : 1.2;

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

function drawNode(slot) {
  const { team, radius, angle, round, matchId, isWinner, isEliminated } = slot;
  if (!isFinite(angle)) return;

  const [x, y] = polar(radius, angle);
  const g = elNS('g', { 'data-match-id': matchId || '', style: 'cursor: pointer;' });

  const hasActiveTeam = team && team.code && team.code !== 'TBD';
  const nodeRadius = hasActiveTeam && !isEliminated ? 17 : 14;

  const nodeFill = isEliminated ? COLOR_INACTIVE_NODE : '#060608';
  const nodeStroke = isEliminated ? '#1f1f23' : (hasActiveTeam && !isEliminated ? '#cc9a18' : '#35353c');
  const nodeStrokeWidth = hasActiveTeam && !isEliminated ? 2.2 : 1;

  g.appendChild(elNS('circle', { cx: x, cy: y, r: nodeRadius, fill: nodeFill, stroke: nodeStroke, 'stroke-width': nodeStrokeWidth }));

  if (hasActiveTeam) {
    const countryCodeUpper = team.code.toUpperCase();
    const countryCodeLower = team.code.toLowerCase();
    
    const isoMap = {
      bra: 'br', fra: 'fr', ger: 'de', esp: 'es', arg: 'ar', can: 'ca', mex: 'mx', usa: 'us',
      eng: 'gb-eng', nor: 'no', por: 'pt', ita: 'it', jpn: 'jp', mar: 'ma', sui: 'ch', egy: 'eg',
      gha: 'gh', col: 'co', bel: 'be', sen: 'sn', cro: 'hr', aut: 'at', bih: 'ba', pan: 'pa',
      rsa: 'za', par: 'py', tha: 'th', ecu: 'ec', civ: 'ci', cpv: 'cv', aus: 'au', irq: 'iq',
      alg: 'dz', ned: 'nl', swe: 'se', cod: 'cd', jor: 'jo', qat: 'qa', ksa: 'sa', uae: 'ae',
      uru: 'uy', uzb: 'uz', kor: 'kr', cur: 'cw', hai: 'ht', nzl: 'nz', tun: 'tn', irn: 'ir', tur: 'tr'
    };
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
      style: isEliminated ? 'filter: grayscale(1) opacity(0.18);' : ''
    });
    g.appendChild(imgFlag);

    if (round === 0) {
      const shieldDistance = radius + 26; 
      const [sx, sy] = polar(shieldDistance, angle);
      const shieldSize = 22; 

      const imgFederation = elNS('image', {
        x: sx - shieldSize / 2, y: sy - shieldSize / 2,
        width: shieldSize, height: shieldSize, href: localShieldUrl, 
        style: isEliminated ? 'filter: grayscale(1) opacity(0.12);' : ''
      });

      imgFederation.onerror = () => imgFederation.remove();
      svgLayer.appendChild(imgFederation);
      
      const [lx, ly] = polar(radius + 14, angle);
      svgLayer.appendChild(elNS('line', {
        x1: lx, y1: ly, x2: sx, y2: sy,
        stroke: isEliminated ? '#1c1c20' : '#2d2d34', 'stroke-width': 1, 'stroke-dasharray': '2,2'
      }));
    }
  } else {
    const t = elNS('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 7, fill: '#28282d', 'font-weight': 'bold', 'font-family': 'sans-serif' });
    t.textContent = 'TBD';
    g.appendChild(t);
  }

  // Evento de passar o mouse (Tooltip flutuante básico)
  g.onmouseenter = (e) => {
    const rect = svgLayer.getBoundingClientRect();
    state.hover = { x: e.clientX - rect.left, y: e.clientY - rect.top, matchId };
    renderTooltipOnly();
  };
  g.onmouseleave = () => { state.hover = null; renderTooltipOnly(); };

  // MUDANÇA INTERATIVA: Clique fixa a partida selecionada e renderiza o grande painel lateral/central
  g.onclick = () => {
    if (matchId) {
      state.selectedMatchId = matchId;
      renderInteractivePanel();
    }
  };

  svgLayer.appendChild(g);
}

// ---------- MÉTODOS AUXILIARES ----------
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
  grad.appendChild(elNS('stop', { offset: '0%', 'stop-color': '#110f0c' }));
  grad.appendChild(elNS('stop', { offset: '70%', 'stop-color': '#050506' }));
  grad.appendChild(elNS('stop', { offset: '100%', 'stop-color': '#010102' }));
  defs.appendChild(grad);
  svgLayer.appendChild(defs);
  svgLayer.appendChild(elNS('rect', { x: 0, y: 0, width: 1200, height: 1000, fill: 'url(#bgGlow)' }));

  LEVEL_R.forEach((r) => {
    svgLayer.appendChild(elNS('circle', { cx: CX, cy: CY, r, fill: 'none', stroke: '#0a0a0c', 'stroke-width': 1 }));
  });
}

function drawTrophy() {
  const g = elNS('g');
  g.appendChild(elNS('circle', { cx: CX, cy: CY, r: 52, fill: '#010102', stroke: '#18140b', 'stroke-width': 1.5 }));
  
  const trophySize = 74; 
  g.appendChild(elNS('image', {
    x: CX - trophySize / 2,
    y: CY - trophySize / 2,
    width: trophySize,
    height: trophySize,
    href: 'taca.gif',
    preserveAspectRatio: 'xMidYMid meet'
  }));

  svgLayer.appendChild(g);
}

// ---------- INTERFACES DE PREVIEW E DETALHES ----------
function renderTooltipOnly() {
  if (!tooltipEl) return;
  const hover = state.hover;

  if (!hover) {
    tooltipEl.classList.remove('visible');
    return;
  }

  let match = null;
  for (const round of state.rounds) {
    const found = round.matches?.find((m) => m.fixtureId === hover.matchId);
    if (found) { match = found; break; }
  }

  if (!match) {
    tooltipEl.classList.remove('visible');
    return;
  }

  const home = match.home?.name || 'TBD';
  const away = match.away?.name || 'TBD';
  const score = match.status === 'FINISHED' ? `${match.score?.home ?? 0} – ${match.score?.away ?? 0}` : 'A Jogar';

  tooltipEl.innerHTML = `<div><strong>${home}</strong> vs <strong>${away}</strong></div><div class="score" style="font-size:11px;color:#cc9a18;margin-top:2px;">${score}</div>`;
  tooltipEl.style.transform = `translate3d(${hover.x + 16}px, ${hover.y + 16}px, 0)`;
  tooltipEl.classList.add('visible');
}

// LÓGICA DE CLIQUE: Renderiza as informações avançadas solicitadas no painel lateral fixo
function renderInteractivePanel() {
  if (!panelEl || !state.selectedMatchId) return;

  let match = null;
  let currentRoundIdx = 0;
  for (let i = 0; i < state.rounds.length; i++) {
    const found = state.rounds[i].matches?.find((m) => m.fixtureId === state.selectedMatchId);
    if (found) { match = found; currentRoundIdx = i; break; }
  }

  if (!match) return;

  const homeName = match.home?.name || 'A definir';
  const awayName = match.away?.name || 'A definir';
  const homeCode = match.home?.code?.toUpperCase();
  const awayCode = match.away?.code?.toUpperCase();
  const stage = match.stage || 'Copa do Mundo';

  // Formatação de data e hora do jogo
  let matchTimeHtml = '';
  if (match.date) {
    const dateObj = new Date(match.date);
    const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    matchTimeHtml = `<div class="match-time-badge" style="color: #a4a4a8; font-size: 12px; margin-top: 4px;">📅 ${dateStr} às ${timeStr}</div>`;
  }

  let contentHtml = `
    <div style="position: relative; padding: 12px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cc9a18; font-weight: bold; margin-bottom: 8px;">🏆 ${stage}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <!-- Mandante -->
        <div style="text-align: center; flex: 1;">
          ${homeCode ? `<img src="assets/img/federations/${homeCode}.svg" width="36" height="36" onerror="this.style.display='none'" style="margin-bottom:4px;" />` : ''}
          <div style="font-weight: bold; font-size: 14px; color: #fff;">${homeName}</div>
        </div>
        
        <!-- Placar Central / VS -->
        <div style="padding: 0 10px; text-align: center;">
          ${match.status === 'FINISHED' 
            ? `<div style="font-size: 22px; font-weight: 900; color: #cc9a18; letter-spacing: 2px;">${match.score?.home ?? 0}-${match.score?.away ?? 0}</div>`
            : `<div style="font-size: 14px; font-weight: bold; background: #1a1a1e; padding: 4px 10px; border-radius: 4px; color: #71717a;">VS</div>`
          }
        </div>

        <!-- Visitante -->
        <div style="text-align: center; flex: 1;">
          ${awayCode ? `<img src="assets/img/federations/${awayCode}.svg" width="36" height="36" onerror="this.style.display='none'" style="margin-bottom:4px;" />` : ''}
          <div style="font-weight: bold; font-size: 14px; color: #fff;">${awayName}</div>
        </div>
      </div>
      <div style="text-align: center; margin-bottom: 15px;">${matchTimeHtml}</div>
  `;

  // SE O JOGO JÁ ACONTECEU: Mostrar dados da partida e principais artilheiros das seleções envolvidas
  if (match.status === 'FINISHED') {
    contentHtml += `<div style="border-top: 1px solid #1f1f23; padding-top: 10px;">
      <div style="font-size: 12px; font-weight: bold; color: #e4e4e7; margin-bottom: 8px; text-align: center;">🎯 Artilheiros das Seleções</div>
      <div style="display: flex; gap: 8px; justify-content: space-around;">`;

    [homeCode, awayCode].forEach(code => {
      if (code && SCORERS_DB[code]) {
        const scorer = SCORERS_DB[code];
        contentHtml += `
          <div style="text-align: center; background: #0c0c0e; border: 1px solid #1a1a1e; padding: 6px; border-radius: 6px; width: 45%;">
            <img src="assets/img/art/${code}.png" width="48" height="48" style="border-radius: 50%; object-fit: cover; border: 1px solid #cc9a18; background:#141416;" onerror="this.src='https://flagcdn.com/${code.toLowerCase().substring(0,2)}.svg'; this.style.borderRadius='4px';" />
            <div style="font-size: 11px; font-weight: bold; color: #fff; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${scorer.name}</div>
            <div style="font-size: 10px; color: #cc9a18;">⚽ ${scorer.goals} Gols</div>
          </div>`;
      }
    });

    contentHtml += `</div></div>`;
  } 
  // SE O JOGO NÃO ACONTECEU AINDA: Mostrar informações das seleções e contagem regressiva/chamada para a partida
  else {
    contentHtml += `
      <div style="border-top: 1px solid #1f1f23; padding-top: 12px; text-align: center; background: #0a0a0c; border-radius: 6px; padding: 10px;">
        <div style="font-size: 11px; color: #a1a1aa; line-height: 1.4;">
          Confronto decisivo aguardando o apito inicial. O vencedor avança direto para a próxima fase do chaveamento no anel interno!
        </div>
      </div>
    `;
  }

  contentHtml += `</div>`;
  panelEl.innerHTML = contentHtml;
  panelEl.classList.add('visible');
}

// ---------- CONTROLE DE DADOS DA API ----------
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
    
    // Mantém o painel interativo renderizado se houver uma seleção ativa durante o live update
    if (state.selectedMatchId) {
      renderInteractivePanel();
    }
  } catch (e) {
    if (statusText) statusText.textContent = '❌ Erro na requisição';
  } finally {
    state.loading = false;
  }
}

if (refreshBtn) refreshBtn.addEventListener('click', load);
load();
setInterval(load, 90000);
