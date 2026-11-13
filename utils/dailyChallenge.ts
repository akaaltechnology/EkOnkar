/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LANGUAGE_PACKS } from "../puzzles";
import { DailyChallengeProgress, LanguageCode, Puzzle } from "../types";

const LANGUAGE_OFFSETS: Record<LanguageCode, number> = {
  pa: 0,
  en: 1,
  hi: 2,
  es: 3,
  fr: 4,
  de: 5,
  it: 1,
  pt: 3,
  ru: 5,
  ja: 2,
  ko: 4,
};

export function getUtcDateKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMsUntilNextUtcDay(now: Date = new Date()): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(0, nextMidnight - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

export function formatElapsedTime(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Deterministically picks one curated puzzle for a given (UTC date, language)
 * so every user selecting that language during the same 24-hour window
 * plays the exact same puzzle, while consecutive days rotate cleanly.
 */
export function getDailyChallengePuzzle(
  language: LanguageCode,
  dateKey: string
): Puzzle {
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.pa;
  const parts = dateKey.split("-").map((n) => Number(n));
  const [year, month, day] =
    parts.length === 3 && !parts.some(Number.isNaN)
      ? parts
      : [2026, 1, 1];
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const offset = LANGUAGE_OFFSETS[language] ?? 0;
  const count = Math.max(1, pack.puzzles.length);
  const idx = (((dayNumber + offset) % count) + count) % count;
  return pack.puzzles[idx];
}

export function calculateDailyCompletionBonuses(
  elapsedSeconds: number,
  hintsUsed: number
): {
  completionBonus: number;
  speedBonus: number;
  hintFreeBonus: number;
  totalBonus: number;
} {
  const completionBonus = 50;
  const speedBonus = Math.max(
    0,
    Math.min(60, Math.round((300 - Math.max(0, elapsedSeconds)) / 5))
  );
  const hintFreeBonus = hintsUsed === 0 ? 40 : 0;
  return {
    completionBonus,
    speedBonus,
    hintFreeBonus,
    totalBonus: completionBonus + speedBonus + hintFreeBonus,
  };
}

export function createInitialDailyProgress(
  dateKey: string,
  language: LanguageCode,
  puzzle: Puzzle
): DailyChallengeProgress {
  return {
    dateKey,
    language,
    puzzleId: puzzle.id,
    foundWords: [],
    foundBonusWords: [],
    revealedCells: [],
    revealedClueWords: [],
    score: 30,
    hintsUsed: 0,
    startedAtMs: Date.now(),
    elapsedSeconds: 0,
    completed: false,
  };
}

export function loadLocalDailyProgress(
  dateKey: string,
  language: LanguageCode,
  puzzle: Puzzle
): DailyChallengeProgress {
  const storageKey = `akhar_daily_${dateKey}_${language}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyChallengeProgress;
      if (
        parsed &&
        parsed.dateKey === dateKey &&
        parsed.language === language &&
        parsed.puzzleId === puzzle.id
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return createInitialDailyProgress(dateKey, language, puzzle);
}

export function saveLocalDailyProgress(progress: DailyChallengeProgress) {
  const storageKey = `akhar_daily_${progress.dateKey}_${progress.language}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}
