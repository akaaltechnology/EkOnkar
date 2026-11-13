/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AchievementDef, LanguageCode, LanguageStatRecord } from "../types";

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_word",
    title: "First Spark",
    description: "Solve your very first crossword word on the wheel.",
    metricLabel: "Words solved",
    target: 1,
    category: "mastery",
    accentHex: "#F59E0B",
  },
  {
    id: "level_clear",
    title: "Grid Architect",
    description: "Complete an entire crossword puzzle level.",
    metricLabel: "Levels cleared",
    target: 1,
    category: "mastery",
    accentHex: "#10B981",
  },
  {
    id: "punjabi_scholar",
    title: "Punjabi Heritage",
    description: "Solve 10 words in Punjabi (Gurmukhi) puzzles.",
    metricLabel: "Punjabi words",
    target: 10,
    category: "polyglot",
    accentHex: "#F59E0B",
  },
  {
    id: "polyglot_3",
    title: "Polyglot Explorer",
    description: "Solve words across at least 3 different world languages.",
    metricLabel: "Languages played",
    target: 3,
    category: "polyglot",
    accentHex: "#38BDF8",
  },
  {
    id: "polyglot_6",
    title: "World Linguist",
    description: "Solve words across 6 or more global scripts and languages.",
    metricLabel: "Languages played",
    target: 6,
    category: "polyglot",
    accentHex: "#818CF8",
  },
  {
    id: "bonus_hunter",
    title: "Hidden Lexicon",
    description: "Discover 5 bonus words outside the main crossword grid.",
    metricLabel: "Bonus words",
    target: 5,
    category: "collection",
    accentHex: "#34D399",
  },
  {
    id: "purist_streak",
    title: "Sharp Mind",
    description: "Build a streak of 8 consecutive solved words without a hint.",
    metricLabel: "Best streak",
    target: 8,
    category: "precision",
    accentHex: "#FB7185",
  },
  {
    id: "score_1000",
    title: "Thousand Club",
    description: "Accumulate 1,000 or more total points across languages.",
    metricLabel: "Total score",
    target: 1000,
    category: "mastery",
    accentHex: "#FBBF24",
  },
  {
    id: "vocab_keeper",
    title: "Lexicon Curator",
    description: "Save 3 word meanings with notes to your vocabulary bank.",
    metricLabel: "Saved meanings",
    target: 3,
    category: "collection",
    accentHex: "#60A5FA",
  },
  {
    id: "grand_champion",
    title: "Level 6 Master",
    description: "Clear a Level 6 grand puzzle in any language.",
    metricLabel: "Level 6 cleared",
    target: 1,
    category: "mastery",
    accentHex: "#F97316",
  },
];

export interface AchievementProgressInput {
  totalScore: number;
  wordsSolvedCount: number;
  levelsCleared: number;
  bonusWordsCount: number;
  bestStreak: number;
  savedVocabCount: number;
  clearedLevel6: boolean;
  langStats: Partial<Record<LanguageCode, LanguageStatRecord>>;
}

export function getAchievementProgress(
  def: AchievementDef,
  input: AchievementProgressInput
): { current: number; unlocked: boolean; pct: number } {
  const activeLanguages = Object.values(input.langStats).filter(
    (s) => s && s.wordsSolved > 0
  ).length;
  const punjabiWords = input.langStats.pa?.wordsSolved ?? 0;

  let current = 0;
  switch (def.id) {
    case "first_word":
      current = input.wordsSolvedCount;
      break;
    case "level_clear":
      current = input.levelsCleared;
      break;
    case "punjabi_scholar":
      current = punjabiWords;
      break;
    case "polyglot_3":
    case "polyglot_6":
      current = activeLanguages;
      break;
    case "bonus_hunter":
      current = input.bonusWordsCount;
      break;
    case "purist_streak":
      current = input.bestStreak;
      break;
    case "score_1000":
      current = input.totalScore;
      break;
    case "vocab_keeper":
      current = input.savedVocabCount;
      break;
    case "grand_champion":
      current = input.clearedLevel6 ? 1 : 0;
      break;
    default:
      current = 0;
  }

  const pct = Math.min(100, Math.round((current / def.target) * 100));
  return {
    current: Math.min(current, def.target),
    unlocked: current >= def.target,
    pct,
  };
}
