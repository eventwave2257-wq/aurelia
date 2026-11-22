let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(
  freq: number,
  duration = 0.08,
  type: OscillatorType = 'triangle',
  volume = 0.08,
  endFreq?: number
) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Audio playback optional
  }
}

export const arcadeSfx = {
  shoot: () => playTone(560, 0.07, 'square', 0.06, 220),
  hit: () => playTone(210, 0.09, 'sawtooth', 0.07, 110),
  coin: () => {
    playTone(880, 0.07, 'sine', 0.07, 1320);
  },
  match: (combo = 1) => {
    playTone(440 + Math.min(combo, 5) * 90, 0.11, 'triangle', 0.08, 660 + combo * 80);
  },
  jump: () => playTone(280, 0.12, 'sine', 0.07, 560),
  slide: () => playTone(380, 0.1, 'triangle', 0.06, 160),
  error: () => playTone(160, 0.16, 'sawtooth', 0.07, 110),
  victory: () => {
    playTone(523.25, 0.12, 'triangle', 0.08);
    setTimeout(() => playTone(659.25, 0.14, 'triangle', 0.08), 90);
    setTimeout(() => playTone(783.99, 0.22, 'triangle', 0.09), 180);
  },
};
