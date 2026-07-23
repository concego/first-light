/**
 * mapRenderer.js — Renderização via tabela HTML acessível
 * Tabela navegável por leitor de tela (setas no TalkBack/NVDA).
 * Cada célula é um <td> com role, aria-label e tabindex.
 */

import { CellType } from './world.js';

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
  [CellType.WOOD]:    'Madeira',
  [CellType.FOOD]:    'Comida',
  [CellType.HERB]:    'Ervas',
  [CellType.WEAPON]:  'Material de arma',
  [CellType.GOBLIN]:  'Goblin',
  [CellType.WOLF]:    'Lobo',
};

let _table = null;
let _clickCb = null;

export function initMapRenderer(container, { cols, rows }) {
  // Limpa container — aceita tanto <svg> quanto <div>/<main>
  const parent = container.parentElement ?? document.getElementById('map-container');

  // Remove SVG se ainda existir
  const oldSvg = document.getElementById('map-svg');
  if (oldSvg) oldSvg.remove();

  _table = document.createElement('table');
  _table.id = 'map-table';
  _table.setAttribute('role', 'grid');
  _table.setAttribute('aria-label', `Mapa ${cols} por ${rows}. Use as setas para navegar, Enter ou Espaço para interagir.`);
  _table.style.cssText = 'border-collapse:separate;border-spacing:3px;';

  // Cria linhas e células vazias
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.dataset.col = c;
      td.dataset.row = r;
      td.setAttribute('role', 'gridcell');
      td.setAttribute('tabindex', '-1');
      td.style.cssText = `
        width:44px;height:44px;text-align:center;vertical-align:middle;
        border-radius:5px;cursor:pointer;font-size:1.3rem;
        border:2px solid transparent;user-select:none;
      `;
      tr.appendChild(td);
    }
    _table.appendChild(tr);
  }

  parent.appendChild(_table);

  // Navegação por teclado (setas movem foco dentro da tabela)
  _table.addEventListener('keydown', _onKeydown);
  _table.addEventListener('click',   _onClick);
}

export function renderMap(container, cells, playerCol, playerRow) {
  if (!_table) return;

  for (const cell of cells) {
    const td = _table.querySelector(`td[data-col="${cell.col}"][data-row="${cell.row}"]`);
    if (!td) continue;

    const isPlayer   = cell.col === playerCol && cell.row === playerRow;
    const isRevealed = cell.revealed;
    const isDepleted = cell.depleted;

    // ── Visual ──────────────────────────────────────────────────────────
    if (!isRevealed) {
      td.style.background   = '#0d0d0d';
      td.style.borderColor  = 'transparent';
      td.style.color        = 'transparent';
      td.textContent        = '·';
      td.setAttribute('tabindex', '-1');
    } else if (isPlayer) {
      td.style.background   = '#3a2a00';
      td.style.borderColor  = '#f5c842';
      td.style.color        = '#f5c842';
      td.textContent        = '🧍';
      td.setAttribute('tabindex', '0');
    } else if (isDepleted) {
      td.style.background   = '#222';
      td.style.borderColor  = '#444';
      td.style.color        = '#555';
      td.textContent        = '·';
      td.setAttribute('tabindex', '0');
    } else {
      td.style.background   = '#2a1f10';
      td.style.borderColor  = '#5a4a2e';
      td.style.color        = '#f0e0b0';
      td.textContent        = ICONS[cell.type] || '·';
      td.setAttribute('tabindex', '0');
    }

    // ── aria-label ──────────────────────────────────────────────────────
    const pos = `Linha ${cell.row + 1}, Coluna ${cell.col + 1}`;
    if (!isRevealed) {
      td.setAttribute('aria-label', `${pos}: desconhecido`);
    } else if (isPlayer) {
      const content = isDepleted ? 'explorada' : (LABELS[cell.type] || 'vazia');
      td.setAttribute('aria-label', `${pos}: você está aqui. ${content}`);
    } else if (isDepleted) {
      td.setAttribute('aria-label', `${pos}: área explorada`);
    } else {
      const content = LABELS[cell.type] || 'vazia';
      td.setAttribute('aria-label', `${pos}: ${content}`);
    }
  }
}

export function attachCellClickHandler(container, callback) {
  _clickCb = callback;
}

// ── Navegação por teclado ──────────────────────────────────────────────────
function _onKeydown(e) {
  const td = e.target.closest('td[data-col]');
  if (!td) return;

  const col = Number(td.dataset.col);
  const row = Number(td.dataset.row);

  let nextCol = col, nextRow = row;

  switch (e.key) {
    case 'ArrowRight': nextCol = col + 1; break;
    case 'ArrowLeft':  nextCol = col - 1; break;
    case 'ArrowDown':  nextRow = row + 1; break;
    case 'ArrowUp':    nextRow = row - 1; break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (_clickCb) _clickCb({ col, row });
      return;
    default: return;
  }

  e.preventDefault();
  const next = _table.querySelector(`td[data-col="${nextCol}"][data-row="${nextRow}"]`);
  if (next && next.getAttribute('tabindex') !== '-1') next.focus();
}

function _onClick(e) {
  const td = e.target.closest('td[data-col]');
  if (!td || !_clickCb) return;
  _clickCb({ col: Number(td.dataset.col), row: Number(td.dataset.row) });
}

// Foca a célula do jogador (chamado após init)
export function focusPlayer(playerCol, playerRow) {
  if (!_table) return;
  const td = _table.querySelector(`td[data-col="${playerCol}"][data-row="${playerRow}"]`);
  if (td) td.focus();
}
