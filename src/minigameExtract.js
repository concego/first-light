/**
 * minigameExtract.js — Minigame de extração de recurso
 * Usa RhythmTilt: jogador precisa bater no ritmo (← →) para extrair recursos.
 *
 * Input:
 *   - Desktop: ArrowLeft / ArrowRight  (ou A / D)
 *   - Mobile:  botões na tela (mais confiável que tilt sem permissão)
 *
 * Callbacks:
 *   onComplete(cellType) — extração bem-sucedida
 *   onFail(cellType)     — falhou (muitos erros)
 *   onCancel()           — jogador cancelou
 */

import { RhythmTilt } from 'https://cdn.jsdelivr.net/gh/concego/ecj-game-library@main/lib/RhythmTilt.js';
import { Audio } from './audio.js';

const RESOURCE_CONFIG = {
  wood:   { label: '🪵 Madeira',  bpm: 60, streakNeeded: 6, maxMisses: 3 },
  food:   { label: '🍖 Comida',   bpm: 70, streakNeeded: 5, maxMisses: 3 },
  herb:   { label: '🌿 Ervas',    bpm: 55, streakNeeded: 5, maxMisses: 3 },
  weapon: { label: '⚔️ Material', bpm: 75, streakNeeded: 7, maxMisses: 3 },
};

export function startExtractMinigame({ cellType, panel, ariaLive, onComplete, onFail, onCancel }) {
  const cfg = RESOURCE_CONFIG[cellType];
  if (!cfg) { onCancel(); return; }

  Audio.resourceStart();

  // ── UI ──────────────────────────────────────────────────────────────────
  panel.hidden = false;
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1.1rem;
                color:#f0e0b0;max-width:360px;width:100%;padding:1rem">

      <h2 style="color:#f5c842;font-size:1.4rem">${cfg.label}</h2>

      <p style="text-align:center;font-size:.9rem;color:#a09070">
        Siga o ritmo — pressione ← → no teclado<br>ou use os botões abaixo
      </p>

      <!-- Indicador de pulso -->
      <div id="mg-pulse"
           aria-live="assertive" aria-atomic="true"
           style="font-size:3rem;min-height:60px;line-height:1;transition:color .08s">
        —
      </div>

      <!-- Barra de progresso -->
      <div style="width:100%;height:20px;background:#3a2e1e;border-radius:10px;
                  overflow:hidden;border:1px solid #5a4a2e"
           role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
           id="mg-progress-wrap">
        <div id="mg-bar"
             style="height:100%;width:0%;background:#4caf50;border-radius:10px;transition:width .15s"></div>
      </div>

      <!-- Contadores -->
      <div style="display:flex;gap:2rem;font-size:.9rem">
        <span>Seguidos: <strong id="mg-streak">0</strong>/${cfg.streakNeeded}</span>
        <span>Erros: <strong id="mg-misses">0</strong>/${cfg.maxMisses}</span>
      </div>

      <!-- Feedback -->
      <div id="mg-feedback" aria-live="polite"
           style="font-size:1.2rem;min-height:1.6rem;font-weight:bold"></div>

      <!-- Botões de input mobile -->
      <div style="display:flex;gap:1.5rem;margin-top:.3rem">
        <button id="mg-btn-left"
                aria-label="Esquerda"
                style="width:72px;height:72px;font-size:1.8rem;border-radius:50%;
                       background:#3a2e1e;color:#f0e0b0;border:2px solid #5a4a2e;cursor:pointer">
          ←
        </button>
        <button id="mg-btn-right"
                aria-label="Direita"
                style="width:72px;height:72px;font-size:1.8rem;border-radius:50%;
                       background:#3a2e1e;color:#f0e0b0;border:2px solid #5a4a2e;cursor:pointer">
          →
        </button>
      </div>

      <button id="mg-cancel"
              style="margin-top:.4rem;background:transparent;color:#a09070;
                     border:1px solid #5a4a2e;border-radius:6px;padding:.35rem .9rem;
                     cursor:pointer;font-size:.85rem">
        Cancelar
      </button>
    </div>
  `;

  const elPulse    = panel.querySelector('#mg-pulse');
  const elBar      = panel.querySelector('#mg-bar');
  const elWrap     = panel.querySelector('#mg-progress-wrap');
  const elStreak   = panel.querySelector('#mg-streak');
  const elMisses   = panel.querySelector('#mg-misses');
  const elFeedback = panel.querySelector('#mg-feedback');
  const btnLeft    = panel.querySelector('#mg-btn-left');
  const btnRight   = panel.querySelector('#mg-btn-right');
  const btnCancel  = panel.querySelector('#mg-cancel');

  // ── RhythmTilt ──────────────────────────────────────────────────────────
  const rhythm = RhythmTilt.create({
    bpm:          cfg.bpm,
    toleranceMs:  300,
    streakNeeded: cfg.streakNeeded,
    maxMisses:    cfg.maxMisses,
    resetOnMiss:  true,
  });

  rhythm.on('tick', ({ direction }) => {
    elPulse.textContent = direction === 'forward' ? '→' : '←';
    elPulse.style.color = '#f5c842';
    Audio.beat();
    announce(direction === 'forward' ? 'Direita' : 'Esquerda');
  });

  rhythm.on('beat', ({ streak }) => {
    elStreak.textContent = streak;
    const pct = Math.round((streak / cfg.streakNeeded) * 100);
    elBar.style.width = pct + '%';
    elWrap.setAttribute('aria-valuenow', pct);
    elPulse.style.color  = '#4caf50';
    elFeedback.textContent = '✓';
    elFeedback.style.color = '#4caf50';
    Audio.hit();
  });

  rhythm.on('miss', ({ misses }) => {
    elMisses.textContent = misses;
    elStreak.textContent = '0';
    elBar.style.width = '0%';
    elWrap.setAttribute('aria-valuenow', 0);
    elPulse.style.color  = '#e53935';
    elFeedback.textContent = '✗';
    elFeedback.style.color = '#e53935';
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
    Audio.extractFail();
    announce('Extração falhou.');
    cleanup();
    onFail(cellType);
  });

  // ── Input ────────────────────────────────────────────────────────────────
  function handleDir(dir) { rhythm.input(dir); }

  function onKey(e) {
    if (e.key === 'Escape')                              { cleanup(); onCancel(); return; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleDir('forward');
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') handleDir('back');
  }
  document.addEventListener('keydown', onKey);

  btnLeft.addEventListener('click',  () => handleDir('back'));
  btnRight.addEventListener('click', () => handleDir('forward'));
  btnCancel.addEventListener('click', () => { cleanup(); onCancel(); });

  // ── Helpers ──────────────────────────────────────────────────────────────
  function announce(msg) {
    ariaLive.textContent = '';
    requestAnimationFrame(() => { ariaLive.textContent = msg; });
  }

  function cleanup() {
    rhythm.stop();
    document.removeEventListener('keydown', onKey);
    panel.hidden = true;
    panel.innerHTML = '';
  }

  rhythm.start();
  announce(`Extração: ${cfg.label}. Siga o ritmo.`);
}
