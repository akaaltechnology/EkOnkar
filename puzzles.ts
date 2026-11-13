/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguageCode, LanguagePack, Puzzle } from "./types";
import { LANGUAGE_UI } from "./data/uiStrings";
import {
  PUNJABI_PUZZLES,
  ENGLISH_PUZZLES,
  HINDI_PUZZLES,
  SPANISH_PUZZLES,
  FRENCH_PUZZLES,
  GERMAN_PUZZLES,
} from "./data/packsPart1";
import {
  ITALIAN_PUZZLES,
  PORTUGUESE_PUZZLES,
  RUSSIAN_PUZZLES,
  JAPANESE_PUZZLES,
  KOREAN_PUZZLES,
} from "./data/packsPart2";

export const LANGUAGE_PACKS: Record<LanguageCode, LanguagePack> = {
  pa: {
    code: "pa",
    nameNative: "ਪੰਜਾਬੀ",
    nameEn: "Punjabi",
    scriptLabel: "Gurmukhi",
    puzzles: PUNJABI_PUZZLES,
    ui: LANGUAGE_UI.pa,
  },
  en: {
    code: "en",
    nameNative: "English",
    nameEn: "English",
    scriptLabel: "Latin",
    puzzles: ENGLISH_PUZZLES,
    ui: LANGUAGE_UI.en,
  },
  hi: {
    code: "hi",
    nameNative: "हिन्दी",
    nameEn: "Hindi",
    scriptLabel: "Devanagari",
    puzzles: HINDI_PUZZLES,
    ui: LANGUAGE_UI.hi,
  },
  es: {
    code: "es",
    nameNative: "Español",
    nameEn: "Spanish",
    scriptLabel: "Latin",
    puzzles: SPANISH_PUZZLES,
    ui: LANGUAGE_UI.es,
  },
  fr: {
    code: "fr",
    nameNative: "Français",
    nameEn: "French",
    scriptLabel: "Latin",
    puzzles: FRENCH_PUZZLES,
    ui: LANGUAGE_UI.fr,
  },
  de: {
    code: "de",
    nameNative: "Deutsch",
    nameEn: "German",
    scriptLabel: "Latin",
    puzzles: GERMAN_PUZZLES,
    ui: LANGUAGE_UI.de,
  },
  it: {
    code: "it",
    nameNative: "Italiano",
    nameEn: "Italian",
    scriptLabel: "Latin",
    puzzles: ITALIAN_PUZZLES,
    ui: LANGUAGE_UI.it,
  },
  pt: {
    code: "pt",
    nameNative: "Português",
    nameEn: "Portuguese",
    scriptLabel: "Latin",
    puzzles: PORTUGUESE_PUZZLES,
    ui: LANGUAGE_UI.pt,
  },
  ru: {
    code: "ru",
    nameNative: "Русский",
    nameEn: "Russian",
    scriptLabel: "Cyrillic",
    puzzles: RUSSIAN_PUZZLES,
    ui: LANGUAGE_UI.ru,
  },
  ja: {
    code: "ja",
    nameNative: "日本語",
    nameEn: "Japanese",
    scriptLabel: "Kana",
    puzzles: JAPANESE_PUZZLES,
    ui: LANGUAGE_UI.ja,
  },
  ko: {
    code: "ko",
    nameNative: "한국어",
    nameEn: "Korean",
    scriptLabel: "Hangul",
    puzzles: KOREAN_PUZZLES,
    ui: LANGUAGE_UI.ko,
  },
};

export const LANGUAGE_LIST: LanguagePack[] = [
  LANGUAGE_PACKS.pa,
  LANGUAGE_PACKS.en,
  LANGUAGE_PACKS.hi,
  LANGUAGE_PACKS.es,
  LANGUAGE_PACKS.fr,
  LANGUAGE_PACKS.de,
  LANGUAGE_PACKS.it,
  LANGUAGE_PACKS.pt,
  LANGUAGE_PACKS.ru,
  LANGUAGE_PACKS.ja,
  LANGUAGE_PACKS.ko,
];

export const WORD_WHEEL_PUZZLES: Puzzle[] = LANGUAGE_LIST.flatMap(
  (pack) => pack.puzzles
);