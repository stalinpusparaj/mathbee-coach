/** Tiny generated sound effects (Web Audio). Started only after a user gesture. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = 'sine') {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export const sfx = {
  tap: () => tone(660, 0, 0.08, 0.04, 'triangle'),
  good: () => { tone(523, 0, 0.15); tone(659, 0.1, 0.15); tone(784, 0.2, 0.25); },
  tryAgain: () => { tone(392, 0, 0.18, 0.05, 'triangle'); tone(349, 0.15, 0.2, 0.05, 'triangle'); },
  bloom: () => { [523, 587, 659, 784, 880].forEach((f, i) => tone(f, i * 0.07, 0.2, 0.05)); },
};
