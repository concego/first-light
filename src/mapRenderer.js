/**
 * mapRenderer.js — Tabela HTML acessível para TalkBack e NVDA
 *
 * Regras:
 * - <table> puro, sem role="grid" — TalkBack navega tabelas nativas com swipe
 * - TODOS os <td> têm tabindex="0" e aria-label descritivo
 * - Células não reveladas: "desconhecido" (o jogador sabe que existem, só não o conteúdo)
 * - Célula do jogador: "Você está aqui" + conteúdo
 * - Cabeçalhos de linha/coluna via <th scope> para orientação
 */

import { CellType } from './world.js';

const LABELS = {
  [CellType.EMPTY]:   'área vazia',
  [CellType.WOOD]:    'madeira',
  [CellType.FOOD]:    'comida',
  [CellType.HERB]:    'ervas',
  [CellType.WEAPON]:  'material de arma',
  [CellType.GOBLIN]:  'goblin',
  [CellType.WOLF]:    'lobo',
};

const ICONS = {
  [CellType.EMPTY]:   '',
  [CellType.WOOD]:    '🪵',
  [CellType.FOOD]:    '🍖',
  [CellType.HERB]:    '🌿',
  [CellType.WEAPON]:  '⚔️',
  [CellType.GOBLIN]:  '👺',
  [CellType.WOLF]:    '🐺',
};

let _table   = null;
let _clickCb = null;
let _cols    = 0;
let _rows    = 0;

export function initMapRenderer(container, { cols, rows }) {
  _cols = cols;
  _rows = rows;

  // Remove tabela anterior (reinício)
  const old = document.getElementById('map-table');
  if (old) old.remove();

  _table = document.createElement('table');
  _table.id = 'map-table';
  // Sem role="grid" — deixa o TalkBack tratar como tabela nativa
  _table.setAttribute('aria-label', `Mapa do jogo, ${rows} linhas por ${cols} colunas`);

  // Linha de cabeçalho com números de coluna
  const thead = document.createElement('thead');
  const headTr = document.createElement('tr');
  // célula vazia no canto
  const corner = document.createElement('th');
  corner.setAttribute('scope', 'col');
  corner.setAttribute('aria-hidden', 'true');
  corner.textContent = '';
  headTr.appendChild(corner);
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.setAttribute('aria-label', `Coluna ${c + 1}`);
    th.textContent = c + 1;
    th.setAttribute('aria-hidden', 'true'); // número visual, leitor usa aria-label da célula
    headTr.appendChild(th);
  }
  thead.appendChild(headTr);
  _table.appendChild(thead);

  // Corpo da tabela
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');

    // Cabeçalho de linha
    const th = document.createElement('th');
    th.setAttribute('scope', 'row');
    th.setAttribute('aria-hidden', 'true');
    th.textContent = r + 1;
    tr.appendChild(th);

    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.dataset.col = c;
      td.dataset.row = r;
      td.setAttribute('tabindex', '0');
      td.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: desconhecido`);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  _table.appendChild(tbody);

  container.appendChild(_table);

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

    // ── aria-label — SEMPRE descritivo ────────────────────────────────────
    const pos = `Linha ${cell.row + 1}, Coluna ${cell.col + 1}`;

    if (isPlayer) {
      const content = isDepleted ? 'área explorada' : (LABELS[cell.type] || 'área vazia');
      td.setAttribute('aria-label', `${pos}: você está aqui, ${content}`);
    } else if (!isRevealed) {
      td.setAttribute('aria-label', `${pos}: desconhecido`);
    } else if (isDepleted) {
      td.setAttribute('aria-label', `${pos}: área explorada`);
    } else {
      const content = LABELS[cell.type] || 'área vazia';
      td.setAttribute('aria-label', `${pos}: ${content}`);
    }

    // ── Visual ────────────────────────────────────────────────────────────
    if (isPlayer) {
      td.textContent           = '🧍';
      td.style.background      = '#3a2a00';
      td.style.borderColor     = '#f5c842';
      td.style.color           = '#f5c842';
      td.style.outline         = '2px solid #f5c842';
    } else if (!isRevealed) {
      td.textContent           = '';
      td.style.background      = '#0d0d0d';
      td.style.borderColor     = '#1a1a1a';
      td.style.color           = 'transparent';
      td.style.outline         = 'none';
    } else if (isDepleted) {
      td.textContent           = '·';
      td.style.background      = '#1e1e1e';
      td.style.borderColor     = '#333';
      td.style.color           = '#444';
      td.style.outline         = 'none';
    } else {
      td.textContent           = ICONS[cell.type] || '';
      td.style.background      = '#2a1f10';
      td.style.borderColor     = '#5a4a2e';
      td.style.color           = '#f0e0b0';
      td.style.outline         = 'none';
    }
  }
}

export function attachCellClickHandler(container, callback) {
  _clickCb = callback;
}

export function focusPlayer(playerCol, playerRow) {
  if (!_table) return;
  const td = _table.querySelector(`td[data-col="${playerCol}"][data-row="${playerRow}"]`);
  if (td) td.focus();
}

// ── Navegação por teclado (desktop / NVDA) ─────────────────────────────────
function _onKeydown(e) {
  const td = e.target.closest('td[data-col]');
  if (!td) return;

  const col = Number(td.dataset.col);
  const row = Number(td.dataset.row);

  let nextCol = col, nextRow = row, moved = false;

  switch (e.key) {
    case 'ArrowRight': nextCol = col + 1; moved = true; break;
    case 'ArrowLeft':  nextCol = col - 1; moved = true; break;
    case 'ArrowDown':  nextRow = row + 1; moved = true; break;
    case 'ArrowUp':    nextRow = row - 1; moved = true; break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (_clickCb) _clickCb({ col, row });
      return;
    default: return;
  }

  if (moved) {
    e.preventDefault();
    if (nextCol < 0 || nextCol >= _cols || nextRow < 0 || nextRow >= _rows) return;
    const next = _table.querySelector(`td[data-col="${nextCol}"][data-row="${nextRow}"]`);
    if (next) next.focus();
  }
}

function _onClick(e) {
  const td = e.target.closest('td[data-col]');
  if (!td || !_clickCb) return;
  _clickCb({ col: Number(td.dataset.col), row: Number(td.dataset.row) });
}
