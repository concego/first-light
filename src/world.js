/**
 * world.js — Geração procedural do mapa
 * Conteúdo de cada célula sorteado aleatoriamente a cada run.
 * O jogador e as células vazias iniciais são fixos.
 */

// Tipos de célula
export const CellType = {
  EMPTY:    'empty',
  WOOD:     'wood',     // recurso: madeira
  FOOD:     'food',     // recurso: comida
  HERB:     'herb',     // recurso: ervas
  WEAPON:   'weapon',   // recurso: material pra arma
  GOBLIN:   'goblin',   // inimigo
  WOLF:     'wolf',     // inimigo
};

// Itens da checklist de sobrevivência
export const Checklist = [
  { id: 'wood',   label: '🪵 Madeira',  required: 2 },  // precisa de 2 unidades
  { id: 'food',   label: '🍖 Comida',   required: 1 },
  { id: 'herb',   label: '🌿 Ervas',    required: 1 },
  { id: 'weapon', label: '⚔️ Arma',     required: 1 },
  { id: 'shelter',label: '🏕️ Abrigo',   required: 1 },  // construído, não coletado
];

const COLS = 10;
const ROWS = 10;

// Distribuição de conteúdo no mapa (fora das 9 células iniciais reveladas)
const DISTRIBUTION = [
  { type: CellType.WOOD,   count: 8 },
  { type: CellType.FOOD,   count: 6 },
  { type: CellType.HERB,   count: 5 },
  { type: CellType.WEAPON, count: 4 },
  { type: CellType.GOBLIN, count: 5 },
  { type: CellType.WOLF,   count: 4 },
  // resto: EMPTY
];

export function generateWorld() {
  // Inicializa grade vazia
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push({
        col: c,
        row: r,
        type: CellType.EMPTY,
        revealed: false,
        visited: false,
        depleted: false,   // recurso já coletado / inimigo derrotado
      });
    }
  }

  // Posição inicial do jogador: centro
  const startCol = Math.floor(COLS / 2);
  const startRow = Math.floor(ROWS / 2);

  // Células que não podem receber conteúdo (área de início)
  const protected_ = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = startRow + dr;
      const c = startCol + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        protected_.add(`${c},${r}`);
      }
    }
  }

  // Pool de células disponíveis para conteúdo
  const available = cells
    .filter(cell => !protected_.has(`${cell.col},${cell.row}`))
    .map(cell => `${cell.col},${cell.row}`);

  // Embaralha
  shuffle(available);

  // Distribui conteúdo
  let idx = 0;
  for (const { type, count } of DISTRIBUTION) {
    for (let i = 0; i < count && idx < available.length; i++, idx++) {
      const [c, r] = available[idx].split(',').map(Number);
      getCell(cells, c, r).type = type;
    }
  }

  // Revela área inicial
  for (const key of protected_) {
    const [c, r] = key.split(',').map(Number);
    const cell = getCell(cells, c, r);
    cell.revealed = true;
  }
  getCell(cells, startCol, startRow).visited = true;

  return { cells, cols: COLS, rows: ROWS, startCol, startRow };
}

export function getCell(cells, col, row) {
  return cells.find(c => c.col === col && c.row === row) ?? null;
}

export function revealAround(cells, col, row, cols, rows) {
  const newly = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        const cell = getCell(cells, c, r);
        if (!cell.revealed) {
          cell.revealed = true;
          newly.push(cell);
        }
      }
    }
  }
  return newly;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
