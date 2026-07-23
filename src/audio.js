/**
 * audio.js — Web Audio API
 * Sons gerados proceduralmente. Sem arquivos externos.
 */

let _ctx = null;

function _getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

function _resume() {
  const ctx = _getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}

function _tone({ freq = 440, type = 'sine', duration = 0.15, gain = 0.3, delay = 0 } = {}) {
  _resume();
  const ctx = _getCtx();
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  vol.gain.setValueAtTime(gain, ctx.currentTime + delay);
  vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.05);
}

export const Audio = {

  // Movimento / seleção de célula
  step() {
    _tone({ freq: 320, type: 'sine', duration: 0.07, gain: 0.12 });
  },

  // Célula revelada (nova área descoberta)
  reveal() {
    _tone({ freq: 480, type: 'sine',     duration: 0.12, gain: 0.18 });
    _tone({ freq: 600, type: 'sine',     duration: 0.10, gain: 0.12, delay: 0.08 });
  },

  // Célula já explorada (feedback negativo suave)
  depleted() {
    _tone({ freq: 200, type: 'triangle', duration: 0.12, gain: 0.15 });
  },

  // Inimigo detectado ao revelar célula
  enemyNearby() {
    _tone({ freq: 160, type: 'sawtooth', duration: 0.2, gain: 0.25 });
    _tone({ freq: 140, type: 'sawtooth', duration: 0.2, gain: 0.2, delay: 0.15 });
  },

  // Painel de ação aberto (recurso disponível)
  actionOpen() {
    _tone({ freq: 540, type: 'triangle', duration: 0.1, gain: 0.18 });
  },

  // Iniciar minigame de extração
  resourceStart() {
    _tone({ freq: 520, type: 'triangle', duration: 0.2, gain: 0.25 });
    _tone({ freq: 640, type: 'triangle', duration: 0.2, gain: 0.2, delay: 0.15 });
  },

  // Beat do ritmo — pulso interno (tick)
  beat() {
    _tone({ freq: 700, type: 'square', duration: 0.04, gain: 0.15 });
  },

  // Acerto no ritmo
  hit() {
    _tone({ freq: 880, type: 'sine', duration: 0.10, gain: 0.28 });
    _tone({ freq: 1100, type: 'sine', duration: 0.08, gain: 0.18, delay: 0.06 });
  },

  // Erro no ritmo
  miss() {
    _tone({ freq: 180, type: 'sawtooth', duration: 0.22, gain: 0.3 });
  },

  // Recurso coletado
  collected() {
    [440, 554, 659].forEach((f, i) =>
      _tone({ freq: f, type: 'sine', duration: 0.18, gain: 0.22, delay: i * 0.09 })
    );
  },

  // Extração falhou
  extractFail() {
    [300, 240, 180].forEach((f, i) =>
      _tone({ freq: f, type: 'sawtooth', duration: 0.18, gain: 0.25, delay: i * 0.1 })
    );
  },

  // Janela de ataque aberta
  strikeWindow() {
    _tone({ freq: 220, type: 'sawtooth', duration: 0.10, gain: 0.35 });
    _tone({ freq: 280, type: 'sawtooth', duration: 0.10, gain: 0.28, delay: 0.08 });
  },

  // Acerto no combate
  strikeHit() {
    _tone({ freq: 420, type: 'square',   duration: 0.14, gain: 0.38 });
    _tone({ freq: 260, type: 'sawtooth', duration: 0.18, gain: 0.28, delay: 0.10 });
  },

  // Dano recebido pelo jogador
  damage() {
    _tone({ freq: 110, type: 'sawtooth', duration: 0.28, gain: 0.45 });
  },

  // Ataque em falso (spooked)
  spook() {
    _tone({ freq: 150, type: 'sawtooth', duration: 0.22, gain: 0.35 });
    _tone({ freq: 120, type: 'sawtooth', duration: 0.18, gain: 0.28, delay: 0.12 });
  },

  // Inimigo derrotado
  enemyDown() {
    [320, 220, 160].forEach((f, i) =>
      _tone({ freq: f, type: 'sawtooth', duration: 0.16, gain: 0.28, delay: i * 0.08 })
    );
  },

  // Abrigo construído
  shelter() {
    [330, 415, 494, 659].forEach((f, i) =>
      _tone({ freq: f, type: 'sine', duration: 0.2, gain: 0.2, delay: i * 0.1 })
    );
  },

  // Urgência — poucas ações restantes
  urgent() {
    _tone({ freq: 920, type: 'square', duration: 0.07, gain: 0.2 });
    _tone({ freq: 920, type: 'square', duration: 0.07, gain: 0.2, delay: 0.16 });
  },

  // Anoitecer
  nightfall() {
    [220, 196, 175, 165].forEach((f, i) =>
      _tone({ freq: f, type: 'sine', duration: 0.7, gain: 0.22, delay: i * 0.45 })
    );
  },
};
