/**
 * minigameCombat.js — Minigame de combate
 * Usa TimedStrike: janelas de ataque aleatórias.
 *
 * Input:
 *   - Desktop: Espaço / Enter
 *   - Mobile:  botão na tela
 *
 * Callbacks:
 *   onVictory(enemyType)
 *   onDefeat(enemyType)
 *   onFlee()
 */

import { TimedStrike } from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/TimedStrike.js';
import { CreatureProfile } from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/CreatureProfile.js';
import { Audio } from './audio.js';

const ENEMY_CONFIG = {
  goblin: {
    label:       '👺 Goblin',
    hpMax:       3,
    playerHp:    3,
    windowMs:    900,
    cooldownMs:  1400,
    spookMs:     1200,
    minDelayMs:  800,
    maxDelayMs:  2200,
  },
  wolf: {
    label:       '🐺 Lobo',
    hpMax:       4,
    playerHp:    3,
    windowMs:    700,
    cooldownMs:  1200,
    spookMs:     1400,
    minDelayMs:  600,
    maxDelayMs:  1800,
  },
};

export function startCombatMinigame({ enemyType, panel, ariaLive, onVictory, onDefeat, onFlee }) {
  const cfg = ENEMY_CONFIG[enemyType];
  if (!cfg) { onFlee(); return; }

  Audio.enemyNearby();

  let enemyHp  = cfg.hpMax;
  let playerHp = cfg.playerHp;
  let over     = false;

  // ── UI ──────────────────────────────────────────────────────────────────
  panel.hidden = false;
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1rem;
                color:#f0e0b0;max-width:340px;width:100%;padding:1rem">

      <h2 style="color:#e53935;font-size:1.4rem">${cfg.label}</h2>

      <!-- HP inimigo -->
      <div style="width:100%;text-align:center">
        <div style="font-size:.8rem;color:#a09070;margin-bottom:.25rem">
          HP do inimigo
        </div>
        <div id="cm-enemy-hp" style="font-size:1.4rem;letter-spacing:4px"></div>
      </div>

      <!-- HP jogador -->
      <div style="width:100%;text-align:center">
        <div style="font-size:.8rem;color:#a09070;margin-bottom:.25rem">
          Seu HP
        </div>
        <div id="cm-player-hp" style="font-size:1.4rem;letter-spacing:4px"></div>
      </div>

      <!-- Indicador de janela -->
      <div id="cm-window"
           aria-live="assertive" aria-atomic="true"
           style="font-size:2.2rem;min-height:56px;line-height:1.2;
                  transition:color .1s,transform .1s">
        …
      </div>

      <!-- Feedback -->
      <div id="cm-feedback" aria-live="polite"
           style="font-size:1rem;min-height:1.4rem;font-weight:bold;text-align:center"></div>

      <!-- Botão de ataque -->
      <button id="cm-btn-attack"
              aria-label="Atacar"
              style="width:110px;height:110px;font-size:2.2rem;border-radius:50%;
                     background:#3a0a0a;color:#f0e0b0;border:3px solid #e53935;
                     cursor:pointer;transition:background .12s">
        ⚔️
      </button>

      <button id="cm-btn-flee"
              style="background:transparent;color:#a09070;border:1px solid #5a4a2e;
                     border-radius:6px;padding:.35rem .9rem;cursor:pointer;font-size:.85rem">
        Fugir
      </button>
    </div>
  `;

  const elEnemyHp  = panel.querySelector('#cm-enemy-hp');
  const elPlayerHp = panel.querySelector('#cm-player-hp');
  const elWindow   = panel.querySelector('#cm-window');
  const elFeedback = panel.querySelector('#cm-feedback');
  const btnAttack  = panel.querySelector('#cm-btn-attack');
  const btnFlee    = panel.querySelector('#cm-btn-flee');

  function renderHp() {
    elEnemyHp.textContent  = '❤️'.repeat(enemyHp)  + '🖤'.repeat(cfg.hpMax   - enemyHp);
    elPlayerHp.textContent = '❤️'.repeat(playerHp) + '🖤'.repeat(cfg.playerHp - playerHp);
    elEnemyHp.setAttribute('aria-label',  `${enemyHp} de ${cfg.hpMax}`);
    elPlayerHp.setAttribute('aria-label', `${playerHp} de ${cfg.playerHp}`);
  }
  renderHp();

  // ── TimedStrike ──────────────────────────────────────────────────────────
  const strike = TimedStrike.create({
    rounds:            99,      // ilimitado — termina por HP
    windowMs:          cfg.windowMs,
    defaultCooldown:   cfg.cooldownMs,
    defaultSpookCooldown: cfg.spookMs,
    minDelay:          cfg.minDelayMs,
    maxDelay:          cfg.maxDelayMs,
    autoAdvance:       true,
  });

  strike.on('surfacing', ({ creature }) => {
    if (over) return;
    elWindow.textContent   = '⚡ AGORA!';
    elWindow.style.color   = '#f5c842';
    elWindow.style.transform = 'scale(1.15)';
    elFeedback.textContent = '';
    Audio.strikeWindow();
    announce('Ataque agora!');
  });

  strike.on('submerged', ({ creature, reason }) => {
    if (over) return;
    elWindow.textContent   = '…';
    elWindow.style.color   = '#a09070';
    elWindow.style.transform = 'scale(1)';

    if (reason === 'hit') {
      enemyHp--;
      renderHp();
      elFeedback.textContent = '✓ Acerto!';
      elFeedback.style.color = '#4caf50';
      Audio.strikeHit();
      announce(`Acerto! HP inimigo: ${enemyHp}`);

      if (enemyHp <= 0) {
        over = true;
        Audio.enemyDown();
        announce(`${cfg.label} derrotado!`);
        cleanup();
        onVictory(enemyType);
      }
    } else if (reason === 'timeout') {
      // janela fechou sem ataque — inimigo ataca
      playerHp--;
      renderHp();
      elFeedback.textContent = '✗ Você levou dano!';
      elFeedback.style.color = '#e53935';
      Audio.damage();
      announce(`Levou dano. Seu HP: ${playerHp}`);

      if (playerHp <= 0) {
        over = true;
        announce('Você foi derrotado!');
        cleanup();
        onDefeat(enemyType);
      }
    }
  });

  strike.on('spooked', () => {
    if (over) return;
    elFeedback.textContent = '⚠️ Ataque em falso!';
    elFeedback.style.color = '#ff9800';
    Audio.spook();
    announce('Ataque em falso! Aguarde a janela.');
  });

  strike.on('cooldown', () => {
    if (over) return;
    elWindow.textContent   = '…';
    elWindow.style.color   = '#a09070';
    elWindow.style.transform = 'scale(1)';
  });

  // ── Input ────────────────────────────────────────────────────────────────
  function doAttack() {
    if (!over) strike.attack();
  }

  function onKey(e) {
    if (over) return;
    if (e.key === 'Escape') { cleanup(); onFlee(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doAttack(); }
  }
  document.addEventListener('keydown', onKey);

  btnAttack.addEventListener('click', doAttack);
  btnFlee.addEventListener('click',   () => { cleanup(); onFlee(); });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function announce(msg) {
    ariaLive.textContent = '';
    requestAnimationFrame(() => { ariaLive.textContent = msg; });
  }

  function cleanup() {
    strike.stop();
    document.removeEventListener('keydown', onKey);
    panel.hidden = true;
    panel.innerHTML = '';
  }

  strike.start();
  announce(`Combate: ${cfg.label}. HP: ${enemyHp}. Aguarde a janela e ataque.`);
}
