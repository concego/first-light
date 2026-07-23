/**
 * mapRenderer.js — Renderização SVG do mapa
 * Sem lógica de jogo aqui — só visual e eventos de clique.
 */

import { CellType } from './world.js';

const CELL = 48;   // px por célula
const GAP  = 2;    // espaço entre células

// Ícones SVG simples por tipo
const ICONS = {
  [CellType.EMPTY]:   '',
  [CellType.WOOD]:    '🪵',
  [CellType.FOOD]:    '🍖',
  [CellType.HERB]:    '🌿',
  [CellType.WEAPON]:  '⚔️',
  [CellType.GOBLIN]:  '👺',
  [CellType.WOLF]:    '🐺',
};

const LABELS = {
  [CellType.EMPTY]:   'Área vazia',
  [CellType.WOOD]:    'Árvore com madeira',
  [CellType.FOOD]:    'Fonte de comida',
  [CellType.HERB]:    'Ervas medicinais',
  [CellType.WEAPON]:  'Material para arma',
  [CellType.GOBLIN]:  'Goblin!',
  [CellType.WOLF]:    'Lobo!',
};

export function initMapRenderer(svg, { cols, rows }) {
  const W = cols * (CELL + GAP) - GAP;
  const H = rows * (CELL + GAP) - GAP;
  svg.setAttribute('width',   W);
  svg.setAttribute('height',  H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}

export function renderMap(svg, cells, playerCol, playerRow) {
  svg.innerHTML = '';

  for (const cell of cells) {
    const x = cell.col * (CELL + GAP);
    const y = cell.row * (CELL + GAP);
    const isPlayer = cell.col === playerCol && cell.row === playerRow;

    // Grupo da célula
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('role', 'gridcell');
    g.setAttribute('tabindex', cell.revealed ? '0' : '-1');
    g.dataset.col = cell.col;
    g.dataset.row = cell.row;

    // Fundo
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width',  CELL);
    rect.setAttribute('height', CELL);
    rect.setAttribute('rx', 4);
    rect.setAttribute('ry', 4);

    if (!cell.revealed) {
      rect.setAttribute('fill', '#0d0d0d');
      g.setAttribute('aria-label', 'Área desconhecida');
    } else if (isPlayer) {
      rect.setAttribute('fill', '#3a2a00');
      rect.setAttribute('stroke', '#f5c842');
      rect.setAttribute('stroke-width', 2);
    } else if (cell.depleted) {
      rect.setAttribute('fill', '#2a2a2a');
      g.setAttribute('aria-label', 'Área explorada');
    } else {
      rect.setAttribute('fill', '#2a1f10');
      rect.setAttribute('stroke', '#5a4a2e');
      rect.setAttribute('stroke-width', 1);

      const label = cell.visited
        ? (LABELS[cell.type] ?? 'Área vazia')
        : 'Área revelada';
      g.setAttribute('aria-label', `Linha ${cell.row + 1}, Coluna ${cell.col + 1}: ${label}`);
    }

    g.appendChild(rect);

    // Ícone emoji (só em células reveladas e não vazias)
    if (cell.revealed && !cell.depleted) {
      const icon = isPlayer ? '🧍' : (ICONS[cell.type] ?? '');
      if (icon) {
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x + CELL / 2);
        txt.setAttribute('y', y + CELL / 2 + 8);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '22');
        txt.setAttribute('aria-hidden', 'true');
        txt.textContent = icon;
        g.appendChild(txt);
      }
    }

    // Coordenada pequena (debug / acessibilidade)
    if (cell.revealed) {
      const coord = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      coord.setAttribute('x', x + 4);
      coord.setAttribute('y', y + 12);
      coord.setAttribute('font-size', '9');
      coord.setAttribute('fill', '#888');
      coord.setAttribute('aria-hidden', 'true');
      coord.textContent = `${cell.col},${cell.row}`;
      g.appendChild(coord);
    }

    svg.appendChild(g);
  }
}

export function attachCellClickHandler(svg, callback) {
  svg.addEventListener('click', e => {
    const g = e.target.closest('[data-col]');
    if (!g) return;
    callback({ col: Number(g.dataset.col), row: Number(g.dataset.row) });
  });

  // Teclado: Enter/Espaço ativa a célula focada
  svg.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = document.activeElement.closest('[data-col]') ?? document.activeElement;
    if (!g?.dataset?.col) return;
    e.preventDefault();
    callback({ col: Number(g.dataset.col), row: Number(g.dataset.row) });
  });
}
