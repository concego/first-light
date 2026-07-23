/**
 * main.js — Orquestrador principal do First Light
 * Liga todos os módulos: mundo, mapa (tabela), HUD, estado, ações, minigames.
 */

import { generateWorld, getCell, revealAround, CellType, Checklist } from './world.js';
import { initMapRenderer, renderMap, attachCellClickHandler, focusPlayer } from './mapRenderer.js';
import { Audio } from './audio.js';
import { startExtractMinigame } from './minigameExtract.js';
import { startCombatMinigame }  from './minigameCombat.js';

// ── Constantes ────────────────────────────────────────────────────────────────
const TOTAL_ACTIONS  = 16;
const URGENT_ACTIONS = 4;

const CELL_LABEL = {
  [CellType.EMPTY]:   'área vazia',
  [CellType.WOOD]:    'madeira disponível',
  [CellType.FOOD]:    'comida disponível',
  [CellType.HERB]:    'ervas disponíveis',
  [CellType.WEAPON]:  'material de arma',
  [CellType.GOBLIN]:  'goblin à vista',
  [CellType.WOLF]:    'lobo à vista',
};

// ── Estado global ─────────────────────────────────────────────────────────────
let world, player, checklist, actionsLeft;
let minigameActive = false;

// ── Elementos DOM ─────────────────────────────────────────────────────────────
const mapContainer   = document.getElementById('map-container');
const ariaLive       = document.getElementById('aria-live');
const hudTime        = document.getElementById('hud-time');
const hudActions     = document.getElementById('hud-actions');
const hudChecklist   = document.getElementById('hud-checklist');
const actionDialog   = document.getElementById('action-dialog');
const actionTitle    = document.getElementById('action-dialog-title');
const actionDesc     = document.getElementById('action-dialog-desc');
const actionBtns     = document.getElementById('action-buttons');
const btnCloseAction = document.getElementById('btn-close-action');
const minigamePanel  = document.getElementById('minigame-panel');
const nightPanel     = document.getElementById('night-panel');
const nightText      = document.getElementById('night-narrative');
const btnRestart     = document.getElementById('btn-restart');

// ── Acessibilidade ────────────────────────────────────────────────────────────
function speak(msg) {
  ariaLive.textContent = '';
  requestAnimationFrame(() => { ariaLive.textContent = msg; });
}

// ── Inicialização ─────────────────────────────────────────────────────────────
function init() {
  world          = generateWorld();
  actionsLeft    = TOTAL_ACTIONS;
  player         = { col: world.startCol, row: world.startRow };
  checklist      = Checklist.map(item => ({ ...item, count: 0, done: false }));
  minigameActive = false;

  renderHUD();

  // Remove tabela anterior se existir (reinício)
  const old = document.getElementById('map-table');
  if (old) old.remove();

  initMapRenderer(mapContainer, world);
  renderMap(mapContainer, world.cells, player.col, player.row);
  attachCellClickHandler(mapContainer, onCellClick);

  actionDialog.close();
  nightPanel.hidden    = true;
  minigamePanel.hidden = true;

  focusPlayer(player.col, player.row);
  speak('First Light. Você acordou numa floresta desconhecida. Explore o mapa e se prepare antes da noite. Use as setas para navegar e Enter para interagir.');
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function renderHUD() {
  const elapsed  = TOTAL_ACTIONS - actionsLeft;
  const hour     = Math.floor(elapsed * 30 / 60) + 6;
  const minute   = (elapsed * 30) % 60;
  const timeStr  = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  const sunIcon  = actionsLeft > 8 ? '🌅' : actionsLeft > 4 ? '🌤️' : '🌆';

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
        ? `${item.label}: concluído`
        : `${item.label}: ${item.count} de ${item.required}`
    );
    hudChecklist.appendChild(li);
  }
}

// ── Clique / navegação em célula ──────────────────────────────────────────────
function onCellClick({ col, row }) {
  if (minigameActive) return;

  const cell = getCell(world.cells, col, row);
  if (!cell || !cell.revealed) {
    speak('Área ainda não revelada.');
    return;
  }

  // Mover jogador
  const moved = player.col !== col || player.row !== row;
  player.col = col;
  player.row = row;

  // Revelar ao redor e marcar visitada
  const newCells = revealAround(world.cells, col, row, world.cols, world.rows);
  cell.visited = true;

  Audio.step();
  if (newCells.length > 0) Audio.reveal();

  // Anunciar inimigos recém-revelados nas adjacentes
  const enemies = newCells.filter(c => c.type === CellType.GOBLIN || c.type === CellType.WOLF);
  if (enemies.length > 0) {
    Audio.enemyNearby();
  }

  renderMap(mapContainer, world.cells, player.col, player.row);

  // Anunciar posição e conteúdo
  const pos     = `Linha ${row + 1}, coluna ${col + 1}`;
  const content = cell.depleted
    ? 'área já explorada'
    : (CELL_LABEL[cell.type] || 'área vazia');

  const enemyAlert = enemies.length > 0
    ? ` Atenção: ${enemies.map(e => CELL_LABEL[e.type]).join(' e ')} nas proximidades.`
    : '';

  speak(`${pos}. ${content}.${enemyAlert}`);

  showActionPanel(cell);
}

// ── Painel de ação — dialog modal ─────────────────────────────────────────────
function showActionPanel(cell) {
  actionBtns.innerHTML = '';

  if (cell.depleted) {
    actionTitle.textContent = 'Área explorada';
    actionDesc.textContent  = 'Esta área já foi explorada. Não há mais nada aqui.';
    Audio.depleted();
    actionDialog.showModal();
    return;
  }

  Audio.actionOpen();

  switch (cell.type) {
    case CellType.WOOD:
      actionTitle.textContent = '🪵 Madeira';
      actionDesc.textContent  = 'Há madeira aqui. Coletar custa 30 minutos.';
      addBtn('Coletar madeira',  () => { actionDialog.close(); startExtract(cell, 'wood'); });
      break;

    case CellType.FOOD:
      actionTitle.textContent = '🍖 Comida';
      actionDesc.textContent  = 'Há comida aqui. Coletar custa 30 minutos.';
      addBtn('Coletar comida',   () => { actionDialog.close(); startExtract(cell, 'food'); });
      break;

    case CellType.HERB:
      actionTitle.textContent = '🌿 Ervas';
      actionDesc.textContent  = 'Há ervas medicinais aqui. Coletar custa 30 minutos.';
      addBtn('Coletar ervas',    () => { actionDialog.close(); startExtract(cell, 'herb'); });
      break;

    case CellType.WEAPON:
      actionTitle.textContent = '⚔️ Material de arma';
      actionDesc.textContent  = 'Há material para fabricar uma arma. Coletar custa 30 minutos.';
      addBtn('Coletar material', () => { actionDialog.close(); startExtract(cell, 'weapon'); });
      break;

    case CellType.GOBLIN:
      actionTitle.textContent = '👺 Goblin!';
      actionDesc.textContent  = 'Um goblin está aqui. Combater custa 30 minutos. Você também pode fugir.';
      addBtn('Combater goblin',  () => { actionDialog.close(); startCombat(cell, 'goblin'); });
      addBtn('Fugir',            () => { actionDialog.close(); speak('Você se afastou do goblin.'); });
      break;

    case CellType.WOLF:
      actionTitle.textContent = '🐺 Lobo!';
      actionDesc.textContent  = 'Um lobo está aqui. Combater custa 30 minutos. Você também pode fugir.';
      addBtn('Combater lobo',    () => { actionDialog.close(); startCombat(cell, 'wolf'); });
      addBtn('Fugir',            () => { actionDialog.close(); speak('Você se afastou do lobo.'); });
      break;

    case CellType.EMPTY:
    default: {
      const canBuild = checklistDone('wood') && !checklistDone('shelter');
      actionTitle.textContent = '🏕️ Área vazia';
      actionDesc.textContent  = canBuild
        ? 'Você tem madeira suficiente. Pode construir o abrigo aqui (30 minutos).'
        : 'Nada para fazer aqui ainda.';
      if (canBuild) addBtn('Construir abrigo', () => { actionDialog.close(); doBuildShelter(cell); });
      break;
    }
  }

  actionDialog.showModal();
}

function addBtn(label, handler) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', handler);
  actionBtns.appendChild(btn);
}

// ── Minigame: Extração ────────────────────────────────────────────────────────
function startExtract(cell, itemId) {
  
  minigameActive     = true;

  startExtractMinigame({
    cellType: itemId,
    panel:    minigamePanel,
    ariaLive,

    onComplete(type) {
      minigameActive = false;
      cell.depleted  = true;
      const item = checklist.find(i => i.id === type);
      if (item && !item.done) {
        item.count = Math.min(item.count + 1, item.required);
        if (item.count >= item.required) item.done = true;
      }
      renderMap(mapContainer, world.cells, player.col, player.row);
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
  
  minigameActive     = true;

  startCombatMinigame({
    enemyType,
    panel:    minigamePanel,
    ariaLive,

    onVictory(type) {
      minigameActive = false;
      cell.depleted  = true;
      renderMap(mapContainer, world.cells, player.col, player.row);
      consumeAction(`Você derrotou o ${type === 'goblin' ? 'goblin' : 'lobo'}!`);
    },

    onDefeat(type) {
      minigameActive = false;
      cell.depleted  = true;
      renderMap(mapContainer, world.cells, player.col, player.row);
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
  
  const item = checklist.find(i => i.id === 'shelter');
  if (item) item.done = true;
  cell.depleted = true;
  renderMap(mapContainer, world.cells, player.col, player.row);
  Audio.shelter();
  consumeAction('Abrigo construído! Você tem onde se abrigar esta noite.');
}

// ── Consumir ação ─────────────────────────────────────────────────────────────
function consumeAction(msg) {
  actionsLeft = Math.max(0, actionsLeft - 1);
  renderHUD();

  const restante = `${actionsLeft} ação${actionsLeft !== 1 ? 'ões' : ''} restante${actionsLeft !== 1 ? 's' : ''}`;
  speak(`${msg} ${restante}.`);

  if (actionsLeft <= URGENT_ACTIONS && actionsLeft > 0) Audio.urgent();
  if (actionsLeft <= 0) triggerNight();
}

function checklistDone(id) {
  return checklist.find(i => i.id === id)?.done ?? false;
}

// ── Noite ─────────────────────────────────────────────────────────────────────
function triggerNight() {
  Audio.nightfall();
  actionDialog.close();
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

btnCloseAction.addEventListener('click', () => actionDialog.close());

// Fechar com Escape já é nativo do <dialog>, mas garantimos o foco de volta
actionDialog.addEventListener('close', () => focusPlayer(player.col, player.row));

// ── Reinício ──────────────────────────────────────────────────────────────────
btnRestart.addEventListener('click', () => {
  nightPanel.hidden = true;
  init();
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
