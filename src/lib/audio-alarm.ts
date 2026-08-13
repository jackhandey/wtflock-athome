/** In-browser Web Audio API sound alert synthesizer for hotlist detections. */

let audioCtx: AudioContext | null = null;

export function playAlertSirenSound() {
  try {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Dual-tone alarm chime (880 Hz -> 587 Hz pulse sequence)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(587.33, now + 0.15); // D5
    osc1.frequency.setValueAtTime(880, now + 0.3);
    osc1.frequency.setValueAtTime(587.33, now + 0.45);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}
