/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguageCode, Puzzle } from "../types";
import { LANGUAGE_PACKS } from "../puzzles";

/**
 * Picks a curated puzzle matching the active language and level,
 * avoiding recently played puzzle IDs whenever alternatives exist.
 */
export async function generatePuzzle(
  language: LanguageCode,
  level: number,
  excludePuzzleIds: string[] = []
): Promise<Puzzle> {
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.pa;
  const levelPool = pack.puzzles.filter((p) => p.difficulty === level);
  const pool = levelPool.length > 0 ? levelPool : pack.puzzles;

  const freshPool = pool.filter((p) => !excludePuzzleIds.includes(p.id));
  const candidates = freshPool.length > 0 ? freshPool : pool;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}