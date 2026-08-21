let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  } catch {
    // Audio unavailable
  }
}

export async function playSuccessTone() {
  if (typeof window === "undefined") return;
  try {
    unlockAudio();
    if (!audioCtx) return;
    await audioCtx.resume();

    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99];

    for (let i = 0; i < notes.length; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(notes[i], now + i * 0.15);
      gain.gain.setValueAtTime(0.0001, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.15 + 0.22);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.25);
    }
  } catch {
    // Audio blocked or unsupported
  }
}
