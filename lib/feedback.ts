// lib/feedback.ts

export const triggerScanFeedback = (type: "success" | "error" = "success") => {
  // 1. Haptic Feedback (Vibration)
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      if (type === "success") {
        navigator.vibrate(80);
      } else {
        // Double pulse pattern for missing item errors
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // Ignore vibration restrictions if blocked by browser policies
    }
  }

  // 2. Audio Feedback (Web Audio API Synthesizer)
  if (typeof window !== "undefined") {
    try {
      const AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;

      const audioCtx = new AudioContext();

      if (type === "success") {
        // High-pitched pleasant retail scan tone (1800 Hz)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(1800, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        // Low-pitched double warning tone (350 Hz -> 250 Hz)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc.frequency.setValueAtTime(250, audioCtx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // Ignore audio policy restrictions
    }
  }
};