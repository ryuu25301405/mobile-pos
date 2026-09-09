// lib/feedback.ts

export const triggerScanFeedback = () => {
  // 1. Haptic Feedback (Vibration)
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    try {
      // Vibrate for 80 milliseconds
      navigator.vibrate(80);
    } catch {
      // Ignore vibration errors if restricted by device policy
    }
  }

  // 2. Audio Feedback (Web Audio API Synthesizer Beep)
  if (typeof window !== "undefined") {
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;

      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      // High-pitched pleasant retail scan tone (1800 Hz)
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1800, audioCtx.currentTime);

      // Fast volume fade-out
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch {
      // Catch autoplay restriction edge cases
    }
  }
};