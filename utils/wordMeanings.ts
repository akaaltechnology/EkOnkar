/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LANGUAGE_PACKS } from "../puzzles";
import { LanguageCode, Puzzle, WordMeaningDetail } from "../types";
import { normalizeWord, splitGraphemes } from "./gurmukhi";

const SPEECH_LOCALE_MAP: Record<LanguageCode, string> = {
  pa: "pa-IN",
  en: "en-US",
  hi: "hi-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ru: "ru-RU",
  ja: "ja-JP",
  ko: "ko-KR",
};

const POS_EXPANDED: Record<string, string> = {
  Noun: "Noun (person, place, object, or concept)",
  Verb: "Verb (action, movement, or state of being)",
  Adj: "Adjective (descriptive quality or attribute)",
  Adv: "Adverb (modifies time, manner, or degree)",
  Pron: "Pronoun (replaces a noun reference)",
  Prep: "Preposition (spatial or relational connector)",
};

export interface LexiconItem extends WordMeaningDetail {
  id: string;
}

export function buildUsageDescription(
  word: string,
  lang: LanguageCode,
  translit: string,
  meaningEn: string,
  pos: string,
  themeEn?: string
): string {
  const pack = LANGUAGE_PACKS[lang];
  const posDesc = POS_EXPANDED[pos] || pos || "Core vocabulary entry";
  const themePhrase = themeEn
    ? `Commonly encountered in the "${themeEn}" lexical theme.`
    : "Core everyday vocabulary in this language pack.";

  if (lang === "en") {
    return `"${word}" functions as a ${posDesc.toLowerCase()}. It expresses the concept of "${meaningEn}". ${themePhrase}`;
  }

  return `In ${pack.nameEn} (${pack.nameNative}), "${word}" (pronounced approx. "${translit}") serves as a ${posDesc.toLowerCase()} meaning "${meaningEn}". ${themePhrase}`;
}

export function buildScriptNotes(
  word: string,
  lang: LanguageCode,
  graphemes: string[]
): string {
  const pack = LANGUAGE_PACKS[lang];
  return `Written in ${pack.scriptLabel} using ${graphemes.length} ${
    lang === "pa" || lang === "hi"
      ? "Akhar (syllabic units)"
      : lang === "ja"
      ? "Kana morae"
      : lang === "ko"
      ? "Hangul syllable blocks"
      : "letters"
  }: ${graphemes.join(" · ")}.`;
}

export function describeWordMeaning(
  rawWord: string,
  lang: LanguageCode,
  activePuzzle?: Puzzle | null
): WordMeaningDetail | null {
  const norm = normalizeWord(rawWord, lang);
  const pack = LANGUAGE_PACKS[lang] || LANGUAGE_PACKS.pa;

  const searchPuzzles = activePuzzle
    ? [activePuzzle, ...pack.puzzles.filter((p) => p.id !== activePuzzle.id)]
    : pack.puzzles;

  for (const puzzle of searchPuzzles) {
    const mainMatch = puzzle.words.find(
      (pw) => normalizeWord(pw.word, lang) === norm
    );
    if (mainMatch) {
      const graphemes = splitGraphemes(mainMatch.word, lang);
      const pos = mainMatch.pos || "Word";
      return {
        word: mainMatch.word,
        language: lang,
        translit: mainMatch.translit,
        meaningEn: mainMatch.meaningEn,
        pos,
        graphemes,
        themeLocal: puzzle.themeLocal,
        themeEn: puzzle.themeEn,
        puzzleId: puzzle.id,
        isBonus: false,
        usageDescription: buildUsageDescription(
          mainMatch.word,
          lang,
          mainMatch.translit,
          mainMatch.meaningEn,
          pos,
          puzzle.themeEn
        ),
        scriptNotes: buildScriptNotes(mainMatch.word, lang, graphemes),
      };
    }

    const bonusMatch = puzzle.bonusWords?.find(
      (bw) => normalizeWord(bw.word, lang) === norm
    );
    if (bonusMatch) {
      const graphemes = splitGraphemes(bonusMatch.word, lang);
      return {
        word: bonusMatch.word,
        language: lang,
        translit: bonusMatch.translit,
        meaningEn: bonusMatch.meaningEn,
        pos: "Bonus Word",
        graphemes,
        themeLocal: puzzle.themeLocal,
        themeEn: puzzle.themeEn,
        puzzleId: puzzle.id,
        isBonus: true,
        usageDescription: buildUsageDescription(
          bonusMatch.word,
          lang,
          bonusMatch.translit,
          bonusMatch.meaningEn,
          "Bonus Word",
          puzzle.themeEn
        ),
        scriptNotes: buildScriptNotes(bonusMatch.word, lang, graphemes),
      };
    }
  }

  return null;
}

export function getAllLexiconWords(): LexiconItem[] {
  const items: LexiconItem[] = [];
  const seen = new Set<string>();

  (Object.keys(LANGUAGE_PACKS) as LanguageCode[]).forEach((lang) => {
    const pack = LANGUAGE_PACKS[lang];
    pack.puzzles.forEach((puzzle) => {
      puzzle.words.forEach((pw) => {
        const key = `${lang}:${normalizeWord(pw.word, lang)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const graphemes = splitGraphemes(pw.word, lang);
        const pos = pw.pos || "Word";
        items.push({
          id: key,
          word: pw.word,
          language: lang,
          translit: pw.translit,
          meaningEn: pw.meaningEn,
          pos,
          graphemes,
          themeLocal: puzzle.themeLocal,
          themeEn: puzzle.themeEn,
          puzzleId: puzzle.id,
          isBonus: false,
          usageDescription: buildUsageDescription(
            pw.word,
            lang,
            pw.translit,
            pw.meaningEn,
            pos,
            puzzle.themeEn
          ),
          scriptNotes: buildScriptNotes(pw.word, lang, graphemes),
        });
      });

      puzzle.bonusWords?.forEach((bw) => {
        const key = `${lang}:${normalizeWord(bw.word, lang)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const graphemes = splitGraphemes(bw.word, lang);
        items.push({
          id: key,
          word: bw.word,
          language: lang,
          translit: bw.translit,
          meaningEn: bw.meaningEn,
          pos: "Bonus Word",
          graphemes,
          themeLocal: puzzle.themeLocal,
          themeEn: puzzle.themeEn,
          puzzleId: puzzle.id,
          isBonus: true,
          usageDescription: buildUsageDescription(
            bw.word,
            lang,
            bw.translit,
            bw.meaningEn,
            "Bonus Word",
            puzzle.themeEn
          ),
          scriptNotes: buildScriptNotes(bw.word, lang, graphemes),
        });
      });
    });
  });

  return items;
}

export function speakWord(word: string, lang: LanguageCode): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = SPEECH_LOCALE_MAP[lang] || "en-US";
    utterance.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = utterance.lang.split("-")[0];
    const matchedVoice =
      voices.find((v) => v.lang.toLowerCase() === utterance.lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
