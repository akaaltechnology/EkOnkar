/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Direction = "h" | "v";

export type LanguageCode =
  | "pa"
  | "en"
  | "hi"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "ru"
  | "ja"
  | "ko";

export type AppView =
  | "play"
  | "dashboard"
  | "dictionary"
  | "planner"
  | "plans"
  | "account";

export type HintTier = "clue" | "letter" | "word";

export type SubscriptionTier = "free" | "daily_1" | "studio_3";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface RevealedCell {
  x: number;
  y: number;
  token: string;
}

export interface PuzzleWord {
  word: string;
  x: number;
  y: number;
  direction: Direction;
  translit: string;
  meaningEn: string;
  pos?: string;
}

export interface BonusWord {
  word: string;
  translit: string;
  meaningEn: string;
}

export interface Puzzle {
  id: string;
  letters: string[];
  words: PuzzleWord[];
  bonusWords?: BonusWord[];
  difficulty: number;
  themeLocal: string;
  themeEn: string;
}

export interface LanguageUI {
  appName: string;
  levelLabel: string;
  scoreLabel: string;
  hintButton: string;
  newPuzzle: string;
  howToPlay: string;
  howToPlayTitle: string;
  startPlaying: string;
  dragOrTap: string;
  submit: string;
  clear: string;
  backspace: string;
  shuffleLabel: string;
  wordsHeading: string;
  wordsCount: string;
  showClues: string;
  hideClues: string;
  foundTag: string;
  bonusLabel: string;
  alreadyFound: string;
  excellent: string;
  bonusFound: string;
  bonusAlreadyFound: string;
  notInPuzzle: string;
  hintApplied: string;
  levelComplete: string;
  levelCompleteSub: string;
  nextLevel: string;
  anotherPuzzle: string;
  victoryTitle: string;
  victoryTag: string;
  totalScore: string;
  playAgain: string;
  rule1Title: string;
  rule1Desc: string;
  rule2Title: string;
  rule2Desc: string;
  rule3Title: string;
  rule3Desc: string;
  rule4Title: string;
  rule4Desc: string;
}

export interface LanguagePack {
  code: LanguageCode;
  nameNative: string;
  nameEn: string;
  scriptLabel: string;
  puzzles: Puzzle[];
  ui: LanguageUI;
}

export interface GameState {
  language: LanguageCode;
  level: number;
  score: number;
  foundWords: string[];
  foundBonusWords: string[];
  revealedCells: RevealedCell[];
  revealedClueWords: string[];
  currentPuzzle: Puzzle | null;
  nextPuzzle: Puzzle | null;
  loading: boolean;
  isPrefetching?: boolean;
  message: string;
  gameWon?: boolean;
  showLevelModal: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  handle: string;
  preferredLanguage: LanguageCode;
  avatarColor?: string;
  photoUrl?: string;
  bio?: string;
  totalScore: number;
  wordsSolvedCount: number;
  levelsCleared: number;
  bonusWordsCount: number;
  hintsUsed: number;
  bestStreak: number;
  unlockedAchievementIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateSecurity {
  uid: string;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  phoneVerified: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  notifyAchievements: boolean;
  notifyReminders: boolean;
  notifySecurity: boolean;
  sessionLockEnabled: boolean;
  lastLoginAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LanguageStatRecord {
  uid: string;
  language: LanguageCode;
  score: number;
  wordsSolved: number;
  puzzlesCompleted: number;
  highestLevel: number;
  hintsUsed: number;
  updatedAt?: unknown;
}

export type PlayEventType =
  | "word_solved"
  | "bonus_solved"
  | "level_complete"
  | "hint_used";

export interface PlayEventRecord {
  id: string;
  uid: string;
  language: LanguageCode;
  level: number;
  puzzleId: string;
  word: string;
  meaningEn: string;
  points: number;
  eventType: PlayEventType;
  createdAtMs: number;
}

export interface VocabularyRecord {
  id: string;
  uid: string;
  language: LanguageCode;
  word: string;
  translit: string;
  meaningEn: string;
  pos?: string;
  note?: string;
  createdAtMs: number;
}

export type NotificationCategory =
  | "achievement"
  | "security"
  | "progress"
  | "reminder";

export interface AppNotification {
  id: string;
  uid: string;
  title: string;
  body: string;
  category: NotificationCategory;
  read: boolean;
  createdAtMs: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  metricLabel: string;
  target: number;
  category: "mastery" | "polyglot" | "precision" | "collection";
  accentHex: string;
}

export interface WordMeaningDetail {
  word: string;
  language: LanguageCode;
  translit: string;
  meaningEn: string;
  pos: string;
  graphemes: string[];
  themeLocal?: string;
  themeEn?: string;
  puzzleId?: string;
  isBonus?: boolean;
  usageDescription: string;
  scriptNotes: string;
}

export type TaskKind = "task" | "goal";
export type TaskPriority = "low" | "medium" | "high";
export type TaskCategory = "study" | "personal" | "work" | "health";

export interface PersonalTaskRecord {
  id: string;
  uid: string;
  title: string;
  description: string;
  kind: TaskKind;
  priority: TaskPriority;
  category: TaskCategory;
  completed: boolean;
  dueAtIso: string;
  durationMinutes: number;
  language: LanguageCode | "all";
  googleEventId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PersonalNoteRecord {
  id: string;
  uid: string;
  title: string;
  content: string;
  tag: string;
  pinned: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  htmlLink?: string;
}

export interface SubscriptionPlanDef {
  id: SubscriptionTier;
  name: string;
  audience: string;
  pricePerDayUsd: number;
  priceLabel: string;
  tagline: string;
  highlights: string[];
  limits: {
    languages: string;
    hintAccess: string;
    vocabularyBank: string;
    tasksAndNotes: string;
    calendarSync: string;
    analyticsExport: string;
  };
}
