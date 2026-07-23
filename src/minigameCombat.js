/**
 * minigameCombat.js — Minigame de combate
 * Usa TimedStrike + CreatureProfile.
 *
 * O inimigo aparece em janelas aleatórias — o jogador precisa atacar
 * enquanto a janela está aberta. Ataques fora da janela causam penalidade.
 *
 * O combate tem HP: inimigo começa com hpMax hits.
 * Cada hit reduz o HP. Cada miss/spook reduz o HP do jogador.
 *
 * Input:
 *   - Desktop: Espaço ou Enter
 *   - Mobile: tilt forward via SensorKit
 *
 * Callbacks:
 *   onVictory(enemyType) — inimigo derrotado
 *   onDefeat(enemyType)  — jogador perdeu (HP zerou)
 *   onFlee()             — jogador fugiu (Escape)
 */

import { TimedStrike }    from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/TimedStrike.js';
import { CreatureProfile } from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/CreatureProfile.js';
import { SensorKit }      from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/SensorKit.js';
import { Audio } from './audio.js';

const ENEMY_CONFIG = {
  goblin: {
    label: '👺 Goblin',
    hpMax: 3,
    playerHpMax: 4,
    profile: {
      id: 'goblin', name: 'Goblin', weight: 1,
      surfaceWindowMs: 1800,   // janela aberta por 1.8s
      cooldownMs: 2500,        // 2.5s entre aparições
      spookCooldownMs: 4000,
    },
  },
  wolf: {
    label: '🐺 Lobo',
    hpMax: 4,
    playerHpMax: 3,            // lobo é mais perigoso
    profile: {
      id: 'wolf', name: 'Lobo', weight: 1,
      surfaceWindowMs: 1200,   // janela mais curta — mais difícil
      cooldownMs: 2000,
      spookCooldownMs: 5000,
    },
  },
};

export function startCombatMinigame({ enemyType, panel, ariaLive, onVictory, onDefeat, onFlee }) {
  const cfg = ENEMY_CONFIG[enemyType];
  if (!cfg) { onFlee(); return; }

  let enemyHp   = cfg.hpMax;
  let playerHp  = cfg.playerHpMax;
  let combatOver = false;

  // ── UI ──────────────────────────────────────────────────────────────────
  panel.hidden = false;
  panel.innerHTML = `
    <div id="mg-combat" style="display:flex;flex-direction:column;align-items:center;gap:1.1rem;color:#f0e0b0;max-width:360px;width:100%">
      <h2 style="color:#e53935;font-size:1.4rem">${cfg.label}</h2>

      <!-- HP inimigo -->
      <div style="width:100%">
        <div style="font-size:.85rem;margin-bottom:.3rem">${cfg.label} — Vida</div>
        <div style="display:flex;gap:6px" id="enemy-hp-dots"></div>
      </div>

      <!-- HP jogador -->
      <div style="width:100%">
        <div style="font-size:.85rem;margin-bottom:.3rem">Sua vida</div>
        <div style="display:flex;gap:6px" id="player-hp-dots"></div>
      </div>

      <!-- Arena: mostra se o alvo está visível -->
      <div id="combat-arena"
           aria-live="assertive" aria-atomic="true"
           style="width:120px;height:120px;border-radius:50%;border:3px solid #5a4a2e;
                  display:flex;align-items:center;justify-content:center;
                  font-size:3.5rem;background:#1a1209;transition:border-color .15s">
        <span id="combat-enemy-icon" style="opacity:.3">?</span>
      </div>

      <p id="combat-status" style="font-size:.95rem;text-align:center;min-height:1.4rem"></p>

      <p style="font-size:.8rem;color:#a09070;text-align:center">
        <strong>Espaço / Enter</strong> para atacar quando o inimigo aparecer.<br>
        Tilt para frente no mobile.
      </p>

      <button id="combat-flee"
              style="background:transparent;color:#f0e0b0;border:1px solid #5a4a2e;border-radius:6px;padding:.35rem .9rem;cursor:pointer;font-size:.85rem">
        Fugir (Esc)
      </button>
    </div>
  `;

  const elEnemyDots  = panel.querySelector('#enemy-hp-dots');
  const elPlayerDots = panel.querySelector('#player-hp-dots');
  const elArena      = panel.querySelector('#combat-arena');
  const elEnemyIcon  = panel.querySelector('#combat-enemy-icon');
  const elStatus     = panel.querySelector('#combat-status');
  const btnFlee      = panel.querySelector('#combat-flee');

  const enemyEmoji = cfg.label.split(' ')[0];

  function renderHp() {
    elEnemyDots.innerHTML = '';
    for (let i = 0; i < cfg.hpMax; i++) {
      const dot = document.createElement('span');
      dot.textContent = i < enemyHp ? '❤️' : '🖤';
      elEnemyDots.appendChild(dot);
    }
    elPlayerDots.innerHTML = '';
    for (let i = 0; i < cfg.playerHpMax; i++) {
      const dot = document.createElement('span');
      dot.textContent = i < playerHp ? '💚' : '🖤';
      elPlayerDots.appendChild(dot);
    }
  }
  renderHp();

  // ── CreatureProfile + TimedStrike ────────────────────────────────────────
  const pool = CreatureProfile.createPool([cfg.profile]);
  const strike = TimedStrike.create({
    pool,
    autoAdvance: true,
    defaultCooldown: cfg.profile.cooldownMs,
    defaultSpookCooldown: cfg.profile.spookCooldownMs,
  });

  strike.on('surfacing', () => {
    elEnemyIcon.style.opacity = '1';
    elEnemyIcon.textContent   = enemyEmoji;
    elArena.style.borderColor = '#e53935';
    elStatus.textContent      = 'ATAQUE!';
    Audio.strikeWindow();
    announce('Inimigo visível — ATAQUE!');
  });

  strike.on('submerged', ({ reason }) => {
    elEnemyIcon.style.opacity = '.3';
    elEnemyIcon.textContent   = '?';
    elArena.style.borderColor = '#5a4a2e';
    if (reason === 'hit') return; // hit já tratado abaixo
    elStatus.textContent = 'Fugiu...';
  });

  strike.on('hit', () => {
    if (combatOver) return;
    enemyHp--;
    renderHp();
    Audio.strikeHit();
    elStatus.textContent = `Acertou! Vida do inimigo: ${enemyHp}/${cfg.hpMax}`;
    announce(`Acertou! Vida do inimigo: ${enemyHp}`);

    if (enemyHp <= 0) {
      combatOver = true;
      Audio.enemyDown();
      announce(`${cfg.label} derrotado!`);
      cleanup();
      onVictory(enemyType);
    }
  });

  strike.on('miss', () => {
    if (combatOver) return;
    playerHp--;
    renderHp();
    Audio.damage();
    elStatus.textContent = `Escapou! Sua vida: ${playerHp}/${cfg.playerHpMax}`;
    announce(`Inimigo escapou. Você levou dano. Vida: ${playerHp}`);

    if (playerHp <= 0) {
      combatOver = true;
      announce('Você foi derrotado!');
      cleanup();
      onDefeat(enemyType);
    }
  });

  strike.on('spooked', () => {
    if (combatOver) return;
    playerHp--;
    renderHp();
    Audio.damage();
    elStatus.textContent = `Ataque no vazio! Você se expôs. Vida: ${playerHp}/${cfg.playerHpMax}`;
    announce(`Ataque em falso. Você levou dano. Vida: ${playerHp}`);

    if (playerHp <= 0) {
      combatOver = true;
      announce('Você foi derrotado!');
      cleanup();
      onDefeat(enemyType);
    }
  });

  strike.on('cooldown', ({ ms }) => {
    if (combatOver) return;
    elStatus.textContent = `Aguardando... (${(ms / 1000).toFixed(1)}s)`;
  });

  // ── Input teclado ────────────────────────────────────────────────────────
  function onKey(e) {
    if (combatOver) return;
    if (e.key === 'Escape') { cleanup(); onFlee(); return; }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      strike.attack();
    }
  }
  document.addEventListener('keydown', onKey);

  // ── Input mobile ─────────────────────────────────────────────────────────
  let sensor = null;
  try {
    sensor = SensorKit.create();
    sensor.on('tilt', ({ direction }) => {
      if (!combatOver && direction === 'forward') strike.attack();
    });
    sensor.start();
  } catch (_) {}

  btnFlee.addEventListener('click', () => { cleanup(); onFlee(); });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function announce(msg) {
    ariaLive.textContent = '';
    requestAnimationFrame(() => { ariaLive.textContent = msg; });
  }

  function cleanup() {
    strike.stop();
    if (sensor) try { sensor.stop(); } catch (_) {}
    document.removeEventListener('keydown', onKey);
    panel.hidden = true;
    panel.innerHTML = '';
  }

  // ── Start ────────────────────────────────────────────────────────────────
  strike.start();
  announce(`Combate iniciado contra ${cfg.label}. Aguarde o momento certo para atacar.`);
}
