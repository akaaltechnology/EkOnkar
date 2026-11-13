/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Search, Volume2, BookOpen, Bookmark, BookmarkCheck } from "lucide-react";
import { LANGUAGE_LIST, LANGUAGE_PACKS } from "../puzzles";
import { LanguageCode, VocabularyRecord, WordMeaningDetail } from "../types";
import { getAllLexiconWords, speakWord } from "../utils/wordMeanings";

interface DictionaryViewProps {
  activeLanguage: LanguageCode;
  savedVocabulary: VocabularyRecord[];
  onInspectWord: (detail: WordMeaningDetail) => void;
}

const DictionaryView: React.FC<DictionaryViewProps> = ({
  activeLanguage,
  savedVocabulary,
  onInspectWord,
}) => {
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<LanguageCode | "all" | "saved">(
    activeLanguage
  );

  const allWords = useMemo(() => getAllLexiconWords(), []);
  const savedSet = useMemo(() => {
    const s = new Set<string>();
    savedVocabulary.forEach((v) => s.add(`${v.language}:${v.word}`));
    return s;
  }, [savedVocabulary]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allWords.filter((item) => {
      if (langFilter === "saved") {
        if (!savedSet.has(`${item.language}:${item.word}`)) return false;
      } else if (langFilter !== "all" && item.language !== langFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.word.toLowerCase().includes(q) ||
        item.translit.toLowerCase().includes(q) ||
        item.meaningEn.toLowerCase().includes(q) ||
        (item.themeEn || "").toLowerCase().includes(q)
      );
    });
  }, [allWords, langFilter, savedSet, search]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Word Meanings & Lexicon Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect detailed word descriptions, script unit breakdowns, audio pronunciation, and personal study notes across 11 languages.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search word, translit, meaning..."
              className="bg-[#12151C] border border-slate-700/80 focus:border-amber-400 focus:outline-none rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 w-64"
            />
          </div>

          <select
            aria-label="Filter lexicon by language"
            value={langFilter}
            onChange={(e) =>
              setLangFilter(e.target.value as LanguageCode | "all" | "saved")
            }
            className="bg-[#12151C] border border-slate-700/80 focus:border-amber-400 focus:outline-none rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">All 11 Languages ({allWords.length})</option>
            <option value="saved">
              Saved Bookmarks ({savedVocabulary.length})
            </option>
            {LANGUAGE_LIST.map((pack) => (
              <option key={pack.code} value={pack.code}>
                {pack.nameNative} ({pack.nameEn})
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#12151C] border border-slate-800 rounded-2xl p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-base font-medium text-slate-300">
            {langFilter === "saved"
              ? "No bookmarked meanings yet"
              : "No words match your search"}
          </p>
          <p className="text-xs text-slate-500">
            {langFilter === "saved"
              ? "Open any word's meaning card and click 'Save to Vocabulary' to build your personal study bank."
              : "Try clearing the search query or switching to All 11 Languages."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 90).map((item) => {
            const pack = LANGUAGE_PACKS[item.language];
            const isSaved = savedSet.has(`${item.language}:${item.word}`);
            return (
              <div
                key={item.id}
                onClick={() => onInspectWord(item)}
                className="bg-[#12151C] hover:bg-[#171B25] border border-slate-800 hover:border-amber-400/40 rounded-xl p-4 cursor-pointer transition-colors flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-400">
                        {pack.nameNative} · {item.pos}
                      </p>
                      <h2 className="text-xl font-bold text-amber-300 mt-0.5">
                        {item.word}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Pronounce ${item.word}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(item.word, item.language);
                        }}
                        className="w-8 h-8 rounded-lg bg-[#1A1E29] hover:bg-amber-400 text-slate-300 hover:text-slate-950 flex items-center justify-center transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400"
                        title={isSaved ? "Saved in vocabulary" : "Not bookmarked"}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Bookmark className="w-4 h-4 text-slate-600" />
                        )}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-white mt-2">
                    {item.meaningEn}
                  </p>
                  {item.language !== "en" && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Transliteration: {item.translit}
                    </p>
                  )}
                </div>

                <p className="text-xs text-slate-500 pt-2 border-t border-slate-800/70 line-clamp-2">
                  {item.usageDescription}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DictionaryView;
