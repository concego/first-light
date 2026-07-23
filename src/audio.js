/**
 * audio.js — Web Audio API
 * Sons gerados proceduralmente. Sem arquivos externos.
 * Substitua por arquivos reais se sobrar tempo no final.
 */

const _ctx = new (window.AudioContext || window.webkitAudioContext)();

function _resume() {
  if (_ctx.state === 'suspended') _ctx.resume();
}

function _tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.3, delay = 0 } = {}) {
  _resume();
  const osc = _ctx.createOscillator();
  const vol = _ctx.createGain();
  osc.connect(vol);
  vol.connect(_ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, _ctx.currentTime + delay);
  vol.gain.setValueAtTime(gain, _ctx.currentTime + delay);
  vol.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + delay + duration);
  osc.start(_ctx.currentTime + delay);
  osc.stop(_ctx.currentTime + delay + duration + 0.01);
}

export const Audio = {
  // Movimento / revelação de célula
  step() {
    _tone({ freq: 300, type: 'sine', duration: 0.08, gain: 0.15 });
  },

  // Começar extração de recurso
  resourceStart() {
    _tone({ freq: 520, type: 'triangle', duration: 0.2, gain: 0.25 });
  },

  // Beat do minigame de ritmo (RhythmTilt)
  beat() {
    _tone({ freq: 660, type: 'square', duration: 0.06, gain: 0.2 });
  },

  // Acerto no ritmo
  hit() {
    _tone({ freq: 880, type: 'sine', duration: 0.1, gain: 0.3 });
    _tone({ freq: 1100, type: 'sine', duration: 0.1, gain: 0.2, delay: 0.05 });
  },

  // Erro no ritmo
  miss() {
    _tone({ freq: 180, type: 'sawtooth', duration: 0.2, gain: 0.3 });
  },

  // Recurso coletado com sucesso
  collected() {
    [440, 550, 660].forEach((f, i) =>
      _tone({ freq: f, type: 'sine', duration: 0.15, gain: 0.25, delay: i * 0.08 })
    );
  },

  // Combate — janela de ataque aberta
  strikeWindow() {
    _tone({ freq: 200, type: 'sawtooth', duration: 0.12, gain: 0.35 });
  },

  // Acerto no combate
  strikeHit() {
    _tone({ freq: 400, type: 'square', duration: 0.15, gain: 0.4 });
    _tone({ freq: 250, type: 'sawtooth', duration: 0.2, gain: 0.3, delay: 0.1 });
  },

  // Dano recebido
  damage() {
    _tone({ freq: 120, type: 'sawtooth', duration: 0.25, gain: 0.45 });
  },

  // Inimigo derrotado
  enemyDown() {
    [300, 200, 150].forEach((f, i) =>
      _tone({ freq: f, type: 'sawtooth', duration: 0.15, gain: 0.3, delay: i * 0.07 })
    );
  },

  // Urgência — poucas ações restantes
  urgent() {
    _tone({ freq: 900, type: 'square', duration: 0.08, gain: 0.2 });
    _tone({ freq: 900, type: 'square', duration: 0.08, gain: 0.2, delay: 0.15 });
  },

  // Anoitecer
  nightfall() {
    [220, 196, 165].forEach((f, i) =>
      _tone({ freq: f, type: 'sine', duration: 0.6, gain: 0.25, delay: i * 0.4 })
    );
  },
};
