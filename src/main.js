/**
 * main.js — Orquestrador principal do First Light
 * Liga todos os módulos: mundo, mapa, HUD, estado, ações.
 */

import { generateWorld, getCell, revealAround, CellType, Checklist } from './world.js';
import { initMapRenderer, renderMap, attachCellClickHandler } from './mapRenderer.js';
import { Audio } from './audio.js';

// ── ECJ Game Library ──────────────────────────────────────────────────────────
// Importa direto do repositório via jsDelivr
import { TimerCountdown, StateMachine, AccessibilityLayer }
  from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/index.js';

// ── Constantes ────────────────────────────────────────────────────────────────
const TOTAL_ACTIONS  = 16;
const URGENT_ACTIONS = 4;   // alerta quando restar ≤ 4

// ── Estado global ─────────────────────────────────────────────────────────────
let world, player, hud, checklist, actionsLeft;

// ── Elementos DOM ─────────────────────────────────────────────────────────────
const svg          = document.getElementById('map-svg');
const ariaLive     = document.getElementById('aria-live');
const hudTime      = document.getElementById('hud-time');
const hudActions   = document.getElementById('hud-actions');
const hudChecklist = document.getElementById('hud-checklist');
const actionPanel  = document.getElementById('action-panel');
const actionInfo   = document.getElementById('action-cell-info');
const actionBtns   = document.getElementById('action-buttons');
const nightPanel   = document.getElementById('night-panel');
const nightText    = document.getElementById('night-narrative');
const btnRestart   = document.getElementById('btn-restart');

// ── Acessibilidade ────────────────────────────────────────────────────────────
const a11y = AccessibilityLayer.create({ liveRegion: ariaLive });

function speak(msg) {
  a11y.speak(msg);
}

// ── Inicialização ─────────────────────────────────────────────────────────────
function init() {
  world      = generateWorld();
  actionsLeft = TOTAL_ACTIONS;

  player = { col: world.startCol, row: world.startRow };

  checklist = Checklist.map(item => ({ ...item, count: 0, done: false }));

  renderHUD();
  initMapRenderer(svg, world);
  renderMap(svg, world.cells, player.col, player.row);
  attachCellClickHandler(svg, onCellClick);

  actionPanel.hidden = true;
  nightPanel.hidden  = true;

  speak('First Light. Você acordou numa floresta desconhecida. A noite está chegando. Use o mapa para explorar e se preparar.');
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function renderHUD() {
  // Converte ações restantes em horas fictícias (cada ação = 30 min, início às 06:00)
  const minutesLeft = actionsLeft * 30;
  const hour   = Math.floor((TOTAL_ACTIONS - actionsLeft) * 30 / 60) + 6;
  const minute = ((TOTAL_ACTIONS - actionsLeft) * 30) % 60;
  const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

  const sunIcon = actionsLeft > 8 ? '🌅' : actionsLeft > 4 ? '🌤️' : '🌆';
  hudTime.textContent    = `${sunIcon} ${timeStr}`;
  hudActions.textContent = `⏳ ${actionsLeft} ação${actionsLeft !== 1 ? 'ões' : ''} restante${actionsLeft !== 1 ? 's' : ''}`;

  hudChecklist.innerHTML = '';
  for (const item of checklist) {
    const li = document.createElement('li');
    li.textContent = item.done
      ? `${item.label} ✓`
      : item.id === 'shelter'
        ? `${item.label}`
        : `${item.label} (${item.count}/${item.required})`;
    if (item.done) li.classList.add('done');
    li.setAttribute('aria-label',
      item.done ? `${item.label} concluído` : `${item.label}: ${item.count} de ${item.required}`
    );
    hudChecklist.appendChild(li);
  }
}

// ── Clique em célula ──────────────────────────────────────────────────────────
function onCellClick({ col, row }) {
  const cell = getCell(world.cells, col, row);
  if (!cell || !cell.revealed) return;

  // Movimento: qualquer célula revelada (grátis)
  const wasAt = { ...player };
  player.col = col;
  player.row = row;

  // Revela vizinhos
  revealAround(world.cells, col, row, world.cols, world.rows);
  cell.visited = true;

  Audio.step();
  renderMap(svg, world.cells, player.col, player.row);

  // Mostra painel de ação
  showActionPanel(cell);
}

// ── Painel de ação ────────────────────────────────────────────────────────────
function showActionPanel(cell) {
  actionBtns.innerHTML = '';

  if (cell.depleted) {
    actionInfo.textContent = 'Esta área já foi explorada.';
    speak('Área já explorada.');
    actionPanel.hidden = false;
    return;
  }

  const isPlayer = cell.col === player.col && cell.row === player.row;

  switch (cell.type) {
    case CellType.WOOD:
      actionInfo.textContent = '🪵 Há madeira aqui. Coletar custa 30 minutos.';
      addActionBtn('Coletar madeira', () => doCollect(cell, 'wood', 'Madeira coletada!'));
      break;

    case CellType.FOOD:
      actionInfo.textContent = '🍖 Há comida aqui. Coletar custa 30 minutos.';
      addActionBtn('Coletar comida', () => doCollect(cell, 'food', 'Comida coletada!'));
      break;

    case CellType.HERB:
      actionInfo.textContent = '🌿 Há ervas aqui. Coletar custa 30 minutos.';
      addActionBtn('Coletar ervas', () => doCollect(cell, 'herb', 'Ervas coletadas!'));
      break;

    case CellType.WEAPON:
      actionInfo.textContent = '⚔️ Há material para uma arma aqui. Coletar custa 30 minutos.';
      addActionBtn('Coletar material', () => doCollect(cell, 'weapon', 'Material coletado!'));
      break;

    case CellType.GOBLIN:
      actionInfo.textContent = '👺 Um goblin está aqui! Combater custa 30 minutos.';
      addActionBtn('Combater goblin', () => doCombat(cell, 'goblin'));
      addActionBtn('Fugir', () => closePanelOnly());
      break;

    case CellType.WOLF:
      actionInfo.textContent = '🐺 Um lobo está aqui! Combater custa 30 minutos.';
      addActionBtn('Combater lobo', () => doCombat(cell, 'wolf'));
      addActionBtn('Fugir', () => closePanelOnly());
      break;

    case CellType.EMPTY:
    default:
      // Verificar se pode construir abrigo aqui
      const hasMaterials = checklistDone('wood') && !checklistDone('shelter');
      actionInfo.textContent = hasMaterials
        ? '🏕️ Área vazia. Você pode construir o abrigo aqui (custa 30 minutos).'
        : 'Área vazia.';
      if (hasMaterials) {
        addActionBtn('Preparar terreno / Construir abrigo', () => doBuildShelter(cell));
      }
      break;
  }

  actionPanel.hidden = false;
}

function addActionBtn(label, handler) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', handler);
  actionBtns.appendChild(btn);
}

function closePanelOnly() {
  actionPanel.hidden = true;
}

// ── Ações ─────────────────────────────────────────────────────────────────────

function consumeAction(msg) {
  actionsLeft--;
  renderHUD();
  speak(msg + ` ${actionsLeft} ações restantes.`);
  if (actionsLeft <= URGENT_ACTIONS) Audio.urgent();
  if (actionsLeft <= 0) triggerNight();
}

function doCollect(cell, itemId, successMsg) {
  actionPanel.hidden = true;
  Audio.collected();
  cell.depleted = true;

  const item = checklist.find(i => i.id === itemId);
  if (item && !item.done) {
    item.count = Math.min(item.count + 1, item.required);
    if (item.count >= item.required) item.done = true;
  }

  renderMap(svg, world.cells, player.col, player.row);
  consumeAction(successMsg);
}

function doCombat(cell, enemyType) {
  actionPanel.hidden = true;
  // Combate simplificado: 60% chance de vencer
  const won = Math.random() < 0.6;
  cell.depleted = true;
  renderMap(svg, world.cells, player.col, player.row);

  if (won) {
    Audio.enemyDown();
    consumeAction(`Você derrotou o ${enemyType === 'goblin' ? 'goblin' : 'lobo'}!`);
  } else {
    Audio.damage();
    consumeAction(`O ${enemyType === 'goblin' ? 'goblin' : 'lobo'} fugiu, mas você se machucou.`);
  }
}

function doBuildShelter(cell) {
  actionPanel.hidden = true;
  const item = checklist.find(i => i.id === 'shelter');
  if (item && !item.done) {
    item.done = true;
  }
  cell.type     = CellType.EMPTY;
  cell.depleted = true;
  renderMap(svg, world.cells, player.col, player.row);
  Audio.collected();
  consumeAction('Abrigo construído! Agora você tem onde se esconder esta noite.');
}

function checklistDone(id) {
  return checklist.find(i => i.id === id)?.done ?? false;
}

// ── Noite ─────────────────────────────────────────────────────────────────────
function triggerNight() {
  Audio.nightfall();
  actionPanel.hidden = true;

  const done     = checklist.filter(i => i.done).length;
  const total    = checklist.length;
  const survived = done >= 4; // precisa de pelo menos 4 dos 5 itens

  const narratives = {
    true: [
      'A noite chegou. Com o abrigo erguido e mantimentos à mão, você acendeu o fogo e esperou o amanhecer. Sobreviveu.',
      'As sombras avançaram, mas você estava pronto. O crepitar da fogueira afastou os predadores. Você passou a noite.',
    ],
    false: [
      'A escuridão chegou antes de você terminar os preparativos. Sem abrigo ou comida suficiente, a noite foi cruel.',
      'Você ouviu uivos próximos. Sem recursos, não havia como se defender. A floresta venceu desta vez.',
    ],
  };

  const pool = narratives[survived];
  nightText.textContent = pool[Math.floor(Math.random() * pool.length)];
  nightPanel.hidden = false;

  speak(`A noite chegou. ${nightText.textContent}`);
}

// ── Reinício ──────────────────────────────────────────────────────────────────
btnRestart.addEventListener('click', () => {
  nightPanel.hidden = true;
  init();
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
