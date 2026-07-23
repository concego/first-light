/**
 * minigameExtract.js — Minigame de extração de recurso
 * Usa RhythmTilt: jogador precisa bater no ritmo (forward/back)
 * para extrair madeira, comida, ervas ou material de arma.
 *
 * Input:
 *   - Mobile: tilt via SensorKit (forward / back)
 *   - Desktop: teclas ArrowLeft / ArrowRight (ou A / D)
 *
 * Callbacks:
 *   onComplete(cellType) — extração bem-sucedida
 *   onFail(cellType)     — falhou (muitos erros)
 *   onCancel()           — jogador cancelou (Escape)
 */

import { RhythmTilt } from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/RhythmTilt.js';
import { SensorKit }  from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/SensorKit.js';
import { Audio } from './audio.js';

const RESOURCE_CONFIG = {
  wood:   { label: '🪵 Madeira',  action: 'Serrar',   bpm: 60, streakNeeded: 6, maxMisses: 3 },
  food:   { label: '🍖 Comida',   action: 'Colher',   bpm: 70, streakNeeded: 5, maxMisses: 3 },
  herb:   { label: '🌿 Ervas',    action: 'Colher',   bpm: 55, streakNeeded: 5, maxMisses: 3 },
  weapon: { label: '⚔️ Material', action: 'Lascar',   bpm: 75, streakNeeded: 7, maxMisses: 3 },
};

export function startExtractMinigame({ cellType, panel, ariaLive, onComplete, onFail, onCancel }) {
  const cfg = RESOURCE_CONFIG[cellType];
  if (!cfg) { onCancel(); return; }

  // ── UI ──────────────────────────────────────────────────────────────────
  panel.hidden = false;
  panel.innerHTML = `
    <div id="mg-extract" style="display:flex;flex-direction:column;align-items:center;gap:1.2rem;color:#f0e0b0;max-width:360px;width:100%">
      <h2 style="color:#f5c842;font-size:1.4rem">${cfg.label}</h2>
      <p id="mg-instruction" style="text-align:center;font-size:.95rem">
        Siga o ritmo: pressione <strong>← →</strong> (teclado) ou incline o aparelho no ritmo indicado.
      </p>

      <!-- Indicador de direção -->
      <div id="mg-direction" aria-live="assertive" aria-atomic="true"
           style="font-size:3rem;min-height:60px;transition:opacity .1s">—</div>

      <!-- Barra de progresso -->
      <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
           id="mg-progress-bar-wrap"
           style="width:100%;height:18px;background:#3a2e1e;border-radius:9px;overflow:hidden;border:1px solid #5a4a2e">
        <div id="mg-progress-bar"
             style="height:100%;width:0%;background:#4caf50;border-radius:9px;transition:width .2s"></div>
      </div>

      <!-- Streak / misses -->
      <div style="display:flex;gap:2rem;font-size:.9rem">
        <span>Acertos seguidos: <strong id="mg-streak">0</strong> / ${cfg.streakNeeded}</span>
        <span>Erros: <strong id="mg-misses">0</strong> / ${cfg.maxMisses}</span>
      </div>

      <!-- Feedback instantâneo -->
      <div id="mg-feedback" aria-live="polite" style="font-size:1.1rem;min-height:1.5rem"></div>

      <button id="mg-cancel"
              style="margin-top:.5rem;background:transparent;color:#f0e0b0;border:1px solid #5a4a2e;border-radius:6px;padding:.35rem .9rem;cursor:pointer;font-size:.85rem">
        Cancelar (Esc)
      </button>
    </div>
  `;

  const elDir      = panel.querySelector('#mg-direction');
  const elBar      = panel.querySelector('#mg-progress-bar');
  const elBarWrap  = panel.querySelector('#mg-progress-bar-wrap');
  const elStreak   = panel.querySelector('#mg-streak');
  const elMisses   = panel.querySelector('#mg-misses');
  const elFeedback = panel.querySelector('#mg-feedback');
  const btnCancel  = panel.querySelector('#mg-cancel');

  // ── RhythmTilt ──────────────────────────────────────────────────────────
  const rhythm = RhythmTilt.create({
    bpm:          cfg.bpm,
    toleranceMs:  280,
    streakNeeded: cfg.streakNeeded,
    maxMisses:    cfg.maxMisses,
    resetOnMiss:  true,
  });

  rhythm.on('tick', ({ direction, progress }) => {
    elDir.textContent = direction === 'forward' ? '→' : '←';
    elDir.style.color = '#f5c842';
    Audio.beat();
    announce(`${direction === 'forward' ? 'Direita' : 'Esquerda'}`);
  });

  rhythm.on('beat', ({ streak }) => {
    elStreak.textContent = streak;
    const pct = Math.round((streak / cfg.streakNeeded) * 100);
    elBar.style.width = pct + '%';
    elBarWrap.setAttribute('aria-valuenow', pct);
    elDir.style.color = '#4caf50';
    elFeedback.textContent = '✓';
    Audio.hit();
  });

  rhythm.on('miss', ({ misses }) => {
    elMisses.textContent = misses;
    elStreak.textContent = '0';
    elBar.style.width = '0%';
    elBarWrap.setAttribute('aria-valuenow', 0);
    elDir.style.color = '#e53935';
    elFeedback.textContent = '✗';
    Audio.miss();
    announce('Erro!');
  });

  rhythm.on('complete', () => {
    Audio.collected();
    announce(`${cfg.label} coletado!`);
    cleanup();
    onComplete(cellType);
  });

  rhythm.on('fail', () => {
    Audio.miss();
    announce('Extração falhou.');
    cleanup();
    onFail(cellType);
  });

  // ── Input teclado ────────────────────────────────────────────────────────
  function onKey(e) {
    if (e.key === 'Escape') { cleanup(); onCancel(); return; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rhythm.input('forward');
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') rhythm.input('back');
  }
  document.addEventListener('keydown', onKey);

  // ── Input mobile (SensorKit tilt) ────────────────────────────────────────
  let sensor = null;
  try {
    sensor = SensorKit.create();
    sensor.on('tilt', ({ direction }) => {
      if (direction === 'forward' || direction === 'back') rhythm.input(direction);
    });
    sensor.start();
  } catch (_) { /* desktop sem sensor — teclado basta */ }

  // ── Botão cancelar ───────────────────────────────────────────────────────
  btnCancel.addEventListener('click', () => { cleanup(); onCancel(); });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function announce(msg) {
    ariaLive.textContent = '';
    requestAnimationFrame(() => { ariaLive.textContent = msg; });
  }

  function cleanup() {
    rhythm.stop();
    if (sensor) try { sensor.stop(); } catch (_) {}
    document.removeEventListener('keydown', onKey);
    panel.hidden = true;
    panel.innerHTML = '';
  }

  // ── Start ────────────────────────────────────────────────────────────────
  rhythm.start();
  announce(`Minigame de extração: ${cfg.label}. Siga o ritmo.`);
}
