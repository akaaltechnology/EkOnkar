/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from "react";

type SoundEffect = "select" | "correct" | "bonus" | "error" | "win" | "click";

export default function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("akhar_sound");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const getContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        ctxRef.current = new AudioCtx();
      }
    }
    if (ctxRef.current && ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const playNote = useCallback(
    (
      ctx: AudioContext,
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = "sine",
      gainPeak = 0.12
    ) => {
      const now = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    []
  );

  const playSfx = useCallback(
    (effect: SoundEffect, stepIndex = 0) => {
      if (!soundEnabled) return;
      const ctx = getContext();
      if (!ctx) return;

      switch (effect) {
        case "select": {
          // Ascending pentatonic scale as letters connect
          const scale = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0];
          const freq = scale[stepIndex % scale.length];
          playNote(ctx, freq, 0, 0.11, "sine", 0.09);
          break;
        }
        case "correct": {
          playNote(ctx, 523.25, 0, 0.16, "triangle", 0.12);
          playNote(ctx, 659.25, 0.07, 0.2, "triangle", 0.12);
          playNote(ctx, 783.99, 0.14, 0.28, "sine", 0.13);
          break;
        }
        case "bonus": {
          playNote(ctx, 587.33, 0, 0.14, "sine", 0.1);
          playNote(ctx, 880.0, 0.08, 0.22, "sine", 0.11);
          break;
        }
        case "error": {
          playNote(ctx, 220.0, 0, 0.12, "triangle", 0.08);
          playNote(ctx, 185.0, 0.08, 0.16, "triangle", 0.07);
          break;
        }
        case "win": {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((f, idx) => {
            playNote(ctx, f, idx * 0.09, 0.32, "triangle", 0.12);
          });
          break;
        }
        case "click": {
          playNote(ctx, 480, 0, 0.07, "sine", 0.07);
          break;
        }
      }
    },
    [soundEnabled, getContext, playNote]
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("akhar_sound", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return {
    soundEnabled,
    toggleSound,
    playSfx,
  };
}
