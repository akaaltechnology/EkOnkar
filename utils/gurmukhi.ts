/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LanguageCode } from "../types";

/**
 * Splits any word into visual grapheme clusters (Akhar in Gurmukhi/Devanagari,
 * Hangul syllables, Kana, Cyrillic, or Latin letters with combining marks).
 */
export function splitGraphemes(text: string, lang: LanguageCode = "pa"): string[] {
  if (!text) return [];
  const normalized = text.normalize("NFC").trim();

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new (Intl as unknown as {
      Segmenter: new (
        locale: string,
        options: { granularity: "grapheme" }
      ) => { segment: (input: string) => Iterable<{ segment: string }> };
    }).Segmenter(lang, { granularity: "grapheme" });
    return Array.from(segmenter.segment(normalized), (s) => s.segment);
  }

  // Fallback regex for Gurmukhi & Devanagari combining marks
  const clusters: string[] = [];
  const combiningRegex =
    /[\u0A01-\u0A03\u0A3C\u0A3E-\u0A4D\u0A51\u0A70-\u0A71\u0A75\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963\u0300-\u036f]/;
  for (const ch of Array.from(normalized)) {
    if (combiningRegex.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1] += ch;
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}

export function splitGurmukhiAkhar(text: string): string[] {
  return splitGraphemes(text, "pa");
}

export function normalizeWord(text: string, lang: LanguageCode): string {
  const nfc = text.normalize("NFC").trim();
  if (lang === "en" || lang === "es" || lang === "fr" || lang === "de" || lang === "it" || lang === "pt" || lang === "ru") {
    return nfc.toUpperCase();
  }
  return nfc;
}

/**
 * Normalizes a single Latin character for friction-free keyboard matching
 * (e.g. typing E matches É/È/Ê, typing N matches Ñ, etc.).
 */
export function matchTileKey(tile: string, key: string, lang: LanguageCode): boolean {
  if (tile === key) return true;
  if (lang === "pa" || lang === "hi" || lang === "ja" || lang === "ko") {
    return tile === key;
  }
  const stripDiacritics = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  return stripDiacritics(tile) === stripDiacritics(key);
}
