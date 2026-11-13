/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Volume2,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Layers,
  Check,
} from "lucide-react";
import { LANGUAGE_PACKS } from "../puzzles";
import { VocabularyRecord, WordMeaningDetail } from "../types";
import { speakWord } from "../utils/wordMeanings";

interface WordMeaningModalProps {
  detail: WordMeaningDetail | null;
  savedEntry?: VocabularyRecord | null;
  onClose: () => void;
  onSaveVocab: (detail: WordMeaningDetail, note: string) => Promise<void>;
  onRemoveVocab?: (vocabId: string) => Promise<void>;
}

const WordMeaningModal: React.FC<WordMeaningModalProps> = ({
  detail,
  savedEntry,
  onClose,
  onSaveVocab,
  onRemoveVocab,
}) => {
  const [selectedTileIdx, setSelectedTileIdx] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string>("");

  useEffect(() => {
    setSelectedTileIdx(0);
    setNote(savedEntry?.note || "");
    setSaveSuccess(false);
    setSpeechNotice("");
  }, [detail, savedEntry]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, onClose]);

  if (!detail) return null;

  const pack = LANGUAGE_PACKS[detail.language];
  const activeTile = detail.graphemes[selectedTileIdx] || detail.graphemes[0] || "";
  const codePoints = Array.from<string>(activeTile)
    .map((ch) => `U+${ch.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");

  const handleSpeak = () => {
    const ok = speakWord(detail.word, detail.language);
    if (!ok) {
      setSpeechNotice("Voice playback is unavailable in this browser.");
    } else {
      setSpeechNotice("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveVocab(detail, note.trim());
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-meaning-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#12151C] border border-slate-700/80 rounded-2xl max-w-[540px] w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-[#161A23]">
          <div>
            <p className="text-xs text-slate-400">
              {pack.nameNative} · {pack.nameEn} · {detail.pos}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <h2
                id="word-meaning-title"
                className="text-3xl font-bold text-amber-300 tracking-tight"
              >
                {detail.word}
              </h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222733] hover:bg-amber-400 text-slate-200 hover:text-slate-950 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Pronounce</span>
              </button>
            </div>
            {detail.language !== "en" && (
              <p className="text-sm text-slate-300 mt-1">
                Pronunciation:{" "}
                <span className="font-medium text-white">{detail.translit}</span>
              </p>
            )}
            {speechNotice && (
              <p className="text-xs text-amber-400 mt-1">{speechNotice}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close meaning panel"
            className="w-9 h-9 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Meaning & Usage Description</span>
            </div>
            <p className="text-lg font-semibold text-white">{detail.meaningEn}</p>
            <p className="text-sm text-slate-300 leading-relaxed mt-2">
              {detail.usageDescription}
            </p>
            {detail.themeEn && (
              <p className="text-xs text-slate-400 mt-2">
                Theme context: {detail.themeLocal} · {detail.themeEn}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Interactive Script Breakdown</span>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {detail.graphemes.length} units
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {detail.graphemes.map((tile, idx) => (
                <button
                  key={`${tile}-${idx}`}
                  type="button"
                  onClick={() => setSelectedTileIdx(idx)}
                  className={`min-w-[44px] h-11 px-3 rounded-lg font-semibold text-lg transition-colors border ${
                    selectedTileIdx === idx
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : "bg-[#1A1E29] text-slate-100 border-slate-700/80 hover:border-amber-400/50"
                  }`}
                >
                  {tile}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-[#0E1117] border border-slate-800 rounded-lg px-3 py-2">
              <span>
                Unit {selectedTileIdx + 1}:{" "}
                <strong className="text-white text-sm">{activeTile}</strong>
              </span>
              <span className="font-mono text-slate-500">{codePoints}</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">{detail.scriptNotes}</p>
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <label
              htmlFor="vocab-note-input"
              className="block text-xs font-medium text-slate-300"
            >
              Personal Study Note (Saved to Vocabulary Bank)
            </label>
            <textarea
              id="vocab-note-input"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a mnemonic, example phrase, or grammar note..."
              className="w-full rounded-lg bg-[#0E1117] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              {savedEntry && onRemoveVocab ? (
                <button
                  type="button"
                  onClick={() => onRemoveVocab(savedEntry.id)}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors whitespace-nowrap"
                >
                  Remove Bookmark
                </button>
              ) : (
                <span className="text-xs text-slate-500 tabular-nums">
                  {note.length}/300
                </span>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : savedEntry ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>{saving ? "Updating..." : "Update Bookmark"}</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{saving ? "Saving..." : "Save to Vocabulary"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordMeaningModal;
