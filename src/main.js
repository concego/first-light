/**
 * main.js — Orquestrador principal do First Light
 * Liga todos os módulos: mundo, mapa, HUD, estado, ações, minigames.
 */

import { generateWorld, getCell, revealAround, CellType, Checklist } from './world.js';
import { initMapRenderer, renderMap, attachCellClickHandler } from './mapRenderer.js';
import { Audio } from './audio.js';
import { startExtractMinigame } from './minigameExtract.js';
import { startCombatMinigame }  from './minigameCombat.js';

// ── ECJ Game Library ──────────────────────────────────────────────────────────
import { AccessibilityLayer }
  from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/AccessibilityLayer.js';

// ── Constantes ────────────────────────────────────────────────────────────────
const TOTAL_ACTIONS  = 16;
const URGENT_ACTIONS = 4;

// ── Estado global ─────────────────────────────────────────────────────────────
let world, player, checklist, actionsLeft;
let minigameActive = false;

// ── Elementos DOM ─────────────────────────────────────────────────────────────
const svg           = document.getElementById('map-svg');
const ariaLive      = document.getElementById('aria-live');
const hudTime       = document.getElementById('hud-time');
const hudActions    = document.getElementById('hud-actions');
const hudChecklist  = document.getElementById('hud-checklist');
const actionPanel   = document.getElementById('action-panel');
const actionInfo    = document.getElementById('action-cell-info');
const actionBtns    = document.getElementById('action-buttons');
const minigamePanel = document.getElementById('minigame-panel');
const nightPanel    = document.getElementById('night-panel');
const nightText     = document.getElementById('night-narrative');
const btnRestart    = document.getElementById('btn-restart');

// ── Acessibilidade ────────────────────────────────────────────────────────────
const a11y = AccessibilityLayer.create({ liveRegion: ariaLive });
function speak(msg) { a11y.speak(msg); }

// ── Inicialização ─────────────────────────────────────────────────────────────
function init() {
  world       = generateWorld();
  actionsLeft = TOTAL_ACTIONS;
  player      = { col: world.startCol, row: world.startRow };
  checklist   = Checklist.map(item => ({ ...item, count: 0, done: false }));
  minigameActive = false;

  renderHUD();
  initMapRenderer(svg, world);
  renderMap(svg, world.cells, player.col, player.row);
  attachCellClickHandler(svg, onCellClick);

  actionPanel.hidden  = true;
  nightPanel.hidden   = true;
  minigamePanel.hidden = true;

  speak('First Light. Você acordou numa floresta desconhecida. A noite está chegando. Explore o mapa e se prepare antes do anoitecer.');
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function renderHUD() {
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
        ? item.label
        : `${item.label} (${item.count}/${item.required})`;
    if (item.done) li.classList.add('done');
    li.setAttribute('aria-label',
      item.done
        ? `${item.label} concluído`
        : `${item.label}: ${item.count} de ${item.required}`
    );
    hudChecklist.appendChild(li);
  }
}

// ── Clique em célula ──────────────────────────────────────────────────────────
function onCellClick({ col, row }) {
  if (minigameActive) return;

  const cell = getCell(world.cells, col, row);
  if (!cell || !cell.revealed) return;

  player.col = col;
  player.row = row;

  revealAround(world.cells, col, row, world.cols, world.rows);
  cell.visited = true;

  Audio.step();
  renderMap(svg, world.cells, player.col, player.row);
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

  switch (cell.type) {
    case CellType.WOOD:
      actionInfo.textContent = '🪵 Há madeira aqui. Coletar custa 30 minutos.';
      addBtn('Coletar madeira',  () => startExtract(cell, 'wood'));
      break;

    case CellType.FOOD:
      actionInfo.textContent = '🍖 Há comida aqui. Coletar custa 30 minutos.';
      addBtn('Coletar comida',   () => startExtract(cell, 'food'));
      break;

    case CellType.HERB:
      actionInfo.textContent = '🌿 Há ervas aqui. Coletar custa 30 minutos.';
      addBtn('Coletar ervas',    () => startExtract(cell, 'herb'));
      break;

    case CellType.WEAPON:
      actionInfo.textContent = '⚔️ Há material para uma arma aqui. Coletar custa 30 minutos.';
      addBtn('Coletar material', () => startExtract(cell, 'weapon'));
      break;

    case CellType.GOBLIN:
      actionInfo.textContent = '👺 Um goblin está aqui! Combater custa 30 minutos.';
      addBtn('Combater goblin',  () => startCombat(cell, 'goblin'));
      addBtn('Fugir',            () => actionPanel.hidden = true);
      break;

    case CellType.WOLF:
      actionInfo.textContent = '🐺 Um lobo está aqui! Combater custa 30 minutos.';
      addBtn('Combater lobo',    () => startCombat(cell, 'wolf'));
      addBtn('Fugir',            () => actionPanel.hidden = true);
      break;

    case CellType.EMPTY:
    default: {
      const canBuild = checklistDone('wood') && !checklistDone('shelter');
      actionInfo.textContent = canBuild
        ? '🏕️ Área vazia. Você pode construir o abrigo aqui (custa 30 minutos).'
        : 'Área vazia.';
      if (canBuild) addBtn('Construir abrigo', () => doBuildShelter(cell));
      break;
    }
  }

  speak(actionInfo.textContent);
  actionPanel.hidden = false;
}

function addBtn(label, handler) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', handler);
  actionBtns.appendChild(btn);
}

// ── Minigame: Extração ────────────────────────────────────────────────────────
function startExtract(cell, itemId) {
  actionPanel.hidden = true;
  minigameActive = true;

  startExtractMinigame({
    cellType: itemId,
    panel:    minigamePanel,
    ariaLive,

    onComplete(type) {
      minigameActive = false;
      cell.depleted = true;
      const item = checklist.find(i => i.id === type);
      if (item && !item.done) {
        item.count = Math.min(item.count + 1, item.required);
        if (item.count >= item.required) item.done = true;
      }
      renderMap(svg, world.cells, player.col, player.row);
      consumeAction(`${item?.label ?? 'Recurso'} coletado!`);
    },

    onFail() {
      minigameActive = false;
      consumeAction('Extração falhou. Tempo perdido.');
    },

    onCancel() {
      minigameActive = false;
      speak('Extração cancelada.');
    },
  });
}

// ── Minigame: Combate ─────────────────────────────────────────────────────────
function startCombat(cell, enemyType) {
  actionPanel.hidden = true;
  minigameActive = true;

  startCombatMinigame({
    enemyType,
    panel:    minigamePanel,
    ariaLive,

    onVictory(type) {
      minigameActive = false;
      cell.depleted = true;
      renderMap(svg, world.cells, player.col, player.row);
      consumeAction(`Você derrotou o ${type === 'goblin' ? 'goblin' : 'lobo'}!`);
    },

    onDefeat(type) {
      minigameActive = false;
      cell.depleted = true;
      renderMap(svg, world.cells, player.col, player.row);
      // Derrota no combate custa uma ação extra de recuperação
      consumeAction(`Você foi derrotado pelo ${type === 'goblin' ? 'goblin' : 'lobo'} e perdeu tempo se recuperando.`);
      consumeAction('Recuperação...');
    },

    onFlee() {
      minigameActive = false;
      speak('Você fugiu do combate.');
    },
  });
}

// ── Ação: Construir abrigo ────────────────────────────────────────────────────
function doBuildShelter(cell) {
  actionPanel.hidden = true;
  const item = checklist.find(i => i.id === 'shelter');
  if (item) item.done = true;
  cell.depleted = true;
  renderMap(svg, world.cells, player.col, player.row);
  Audio.collected();
  consumeAction('Abrigo construído! Você tem onde se esconder esta noite.');
}

// ── Consumir ação ─────────────────────────────────────────────────────────────
function consumeAction(msg) {
  actionsLeft = Math.max(0, actionsLeft - 1);
  renderHUD();
  speak(`${msg} ${actionsLeft} ação${actionsLeft !== 1 ? 'ões' : ''} restante${actionsLeft !== 1 ? 's' : ''}.`);
  if (actionsLeft <= URGENT_ACTIONS && actionsLeft > 0) Audio.urgent();
  if (actionsLeft <= 0) triggerNight();
}

function checklistDone(id) {
  return checklist.find(i => i.id === id)?.done ?? false;
}

// ── Noite ─────────────────────────────────────────────────────────────────────
function triggerNight() {
  Audio.nightfall();
  actionPanel.hidden   = true;
  minigamePanel.hidden = true;

  const done     = checklist.filter(i => i.done).length;
  const survived = done >= 4;

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
