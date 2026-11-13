/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Shuffle, Check, Delete, RotateCcw } from "lucide-react";
import { LanguageCode, LanguageUI } from "../types";
import { matchTileKey } from "../utils/gurmukhi";

interface WordWheelProps {
  letters: string[];
  language: LanguageCode;
  ui: LanguageUI;
  bilingualMode: boolean;
  onWordSubmit: (word: string) => void;
  onCurrentWordChange: (word: string) => void;
  onInteraction?: () => void;
  onSelectSound?: (stepIndex: number) => void;
  onClickSound?: () => void;
}

const WordWheel: React.FC<WordWheelProps> = ({
  letters,
  language,
  ui,
  bilingualMode,
  onWordSubmit,
  onCurrentWordChange,
  onInteraction,
  onSelectSound,
  onClickSound,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIndices, setDragIndices] = useState<number[]>([]);
  const [tapIndices, setTapIndices] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const didDragMultipleRef = useRef(false);
  const startIdxRef = useRef<number>(-1);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  const radius = letters.length >= 7 ? 36 : 34;

  const [shuffledIndices, setShuffledIndices] = useState<number[]>(() =>
    Array.from({ length: letters.length }, (_, i) => i)
  );

  useEffect(() => {
    setShuffledIndices(Array.from({ length: letters.length }, (_, i) => i));
    setDragIndices([]);
    setTapIndices([]);
    onCurrentWordChange("");
  }, [letters, onCurrentWordChange]);

  const handleShuffle = useCallback(() => {
    setShuffledIndices((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    onClickSound?.();
  }, [onClickSound]);

  const getLetterPosNormalized = useCallback(
    (indexInShuffled: number) => {
      const angle =
        (indexInShuffled / letters.length) * 2 * Math.PI - Math.PI / 2;
      return {
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle),
      };
    },
    [letters.length, radius]
  );

  const findIndexAtPos = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return -1;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      const threshold = letters.length >= 7 ? 12.5 : 14;

      for (let i = 0; i < shuffledIndices.length; i++) {
        const pos = getLetterPosNormalized(i);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist < threshold) return shuffledIndices[i];
      }
      return -1;
    },
    [shuffledIndices, getLetterPosNormalized, letters.length]
  );

  const submitTapWord = useCallback(() => {
    if (tapIndices.length < 2) {
      setTapIndices([]);
      onCurrentWordChange("");
      return;
    }
    const word = tapIndices.map((i) => letters[i]).join("");
    onWordSubmit(word);
    setTapIndices([]);
    onCurrentWordChange("");
  }, [tapIndices, letters, onWordSubmit, onCurrentWordChange]);

  const clearTapWord = useCallback(() => {
    setTapIndices([]);
    onCurrentWordChange("");
    onClickSound?.();
  }, [onCurrentWordChange, onClickSound]);

  const backspaceTapWord = useCallback(() => {
    setTapIndices((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      onCurrentWordChange(next.map((i) => letters[i]).join(""));
      onClickSound?.();
      return next;
    });
  }, [letters, onCurrentWordChange, onClickSound]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientY
        : (e as React.MouseEvent).clientY;
    const index = findIndexAtPos(clientX, clientY);
    if (index !== -1) {
      onInteraction?.();
      setIsDragging(true);
      didDragMultipleRef.current = false;
      startIdxRef.current = index;
      setDragIndices([index]);
      onSelectSound?.(tapIndices.length);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePos({
          x: ((clientX - rect.left) / rect.width) * 100,
          y: ((clientY - rect.top) / rect.height) * 100,
        });
      }
      if (tapIndices.length === 0) {
        onCurrentWordChange(letters[index]);
      }
    }
  };

  const handleMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = containerRef.current.getBoundingClientRect();

      const xPct = ((clientX - rect.left) / rect.width) * 100;
      const yPct = ((clientY - rect.top) / rect.height) * 100;
      setMousePos({ x: xPct, y: yPct });

      const index = findIndexAtPos(clientX, clientY);
      if (index !== -1 && !dragIndices.includes(index)) {
        didDragMultipleRef.current = true;
        const next = [...dragIndices, index];
        onSelectSound?.(next.length - 1);
        onCurrentWordChange(next.map((i) => letters[i]).join(""));
        setDragIndices(next);
      }
    },
    [
      isDragging,
      dragIndices,
      findIndexAtPos,
      letters,
      onCurrentWordChange,
      onSelectSound,
    ]
  );

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (didDragMultipleRef.current && dragIndices.length > 1) {
      const word = dragIndices.map((i) => letters[i]).join("");
      onWordSubmit(word);
      setDragIndices([]);
      setTapIndices([]);
      onCurrentWordChange("");
      return;
    }

    const tappedIdx = startIdxRef.current;
    setDragIndices([]);
    if (tappedIdx !== -1) {
      setTapIndices((prev) => {
        let next: number[];
        if (prev.length > 0 && prev[prev.length - 1] === tappedIdx) {
          next = prev.slice(0, -1);
        } else if (!prev.includes(tappedIdx)) {
          next = [...prev, tappedIdx];
        } else {
          next = prev;
        }
        onCurrentWordChange(next.map((i) => letters[i]).join(""));
        return next;
      });
    }
  }, [isDragging, dragIndices, letters, onWordSubmit, onCurrentWordChange]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleMove, handleEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "Enter") {
        if (tapIndices.length >= 2) {
          e.preventDefault();
          submitTapWord();
        }
      } else if (e.key === "Backspace") {
        if (tapIndices.length > 0) {
          e.preventDefault();
          backspaceTapWord();
        }
      } else if (e.key === "Escape") {
        if (tapIndices.length > 0) {
          e.preventDefault();
          clearTapWord();
        }
      } else if (e.key === " ") {
        e.preventDefault();
        handleShuffle();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const matchIdx = letters.findIndex(
          (tile, idx) =>
            !tapIndices.includes(idx) && matchTileKey(tile, e.key, language)
        );
        if (matchIdx !== -1) {
          onInteraction?.();
          onSelectSound?.(tapIndices.length);
          setTapIndices((prev) => {
            const next = [...prev, matchIdx];
            onCurrentWordChange(next.map((i) => letters[i]).join(""));
            return next;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    tapIndices,
    letters,
    language,
    submitTapWord,
    backspaceTapWord,
    clearTapWord,
    handleShuffle,
    onInteraction,
    onSelectSound,
    onCurrentWordChange,
  ]);

  const activeIndices =
    isDragging && didDragMultipleRef.current ? dragIndices : tapIndices;
  const showEnglishSub = bilingualMode && language !== "en";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-[230px] sm:max-w-[270px] lg:max-w-[330px] mx-auto select-none touch-none">
        <div
          ref={containerRef}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          className="relative w-full aspect-square rounded-full bg-[#161922] border border-slate-700/70 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex items-center justify-center overflow-visible"
        >
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0"
          >
            {isDragging &&
              dragIndices.length > 0 &&
              dragIndices.map((idx, i) => {
                const startIdxInShuffled = shuffledIndices.indexOf(idx);
                const startPos = getLetterPosNormalized(startIdxInShuffled);

                if (i === dragIndices.length - 1) {
                  return (
                    <line
                      key="last"
                      x1={startPos.x}
                      y1={startPos.y}
                      x2={mousePos.x}
                      y2={mousePos.y}
                      stroke="#F59E0B"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  );
                }

                const nextIdxInShuffled = shuffledIndices.indexOf(
                  dragIndices[i + 1]
                );
                const nextPos = getLetterPosNormalized(nextIdxInShuffled);
                return (
                  <line
                    key={i}
                    x1={startPos.x}
                    y1={startPos.y}
                    x2={nextPos.x}
                    y2={nextPos.y}
                    stroke="#F59E0B"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                );
              })}

            {!isDragging &&
              tapIndices.length > 1 &&
              tapIndices.slice(0, -1).map((idx, i) => {
                const startPos = getLetterPosNormalized(
                  shuffledIndices.indexOf(idx)
                );
                const nextPos = getLetterPosNormalized(
                  shuffledIndices.indexOf(tapIndices[i + 1])
                );
                return (
                  <line
                    key={`tap-${i}`}
                    x1={startPos.x}
                    y1={startPos.y}
                    x2={nextPos.x}
                    y2={nextPos.y}
                    stroke="#F59E0B"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                );
              })}
          </svg>

          {shuffledIndices.map((letterIdx, i) => {
            const angle = (i / letters.length) * 2 * Math.PI - Math.PI / 2;
            const isSelected = activeIndices.includes(letterIdx);

            return (
              <div
                key={`${letterIdx}-${letters[letterIdx]}`}
                className={`absolute flex items-center justify-center rounded-full transition-all duration-150 z-10 cursor-pointer
                  w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 text-[20px] sm:text-[24px] lg:text-[28px] font-semibold leading-none
                  ${
                    isSelected
                      ? "bg-amber-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.45)] scale-105"
                      : "bg-[#222733] text-slate-100 border border-slate-700/80 hover:bg-slate-700 hover:border-amber-400/50"
                  }
                `}
                style={{
                  left: `calc(50% + ${Math.cos(angle) * radius}%)`,
                  top: `calc(50% + ${Math.sin(angle) * radius}%)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {letters[letterIdx]}
              </div>
            );
          })}

          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleShuffle();
            }}
            aria-label={ui.shuffleLabel}
            title={`${ui.shuffleLabel} (Space)`}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#242936] hover:bg-amber-400 text-slate-200 hover:text-slate-950 border border-slate-700 flex items-center justify-center transition-colors duration-150 active:scale-95 z-20"
          >
            <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 min-h-[40px]">
        <button
          type="button"
          onClick={clearTapWord}
          disabled={tapIndices.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#171A21] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{showEnglishSub ? `${ui.clear}` : ui.clear}</span>
        </button>

        <button
          type="button"
          onClick={backspaceTapWord}
          disabled={tapIndices.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#171A21] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
        >
          <Delete className="w-3.5 h-3.5" />
          <span>{ui.backspace}</span>
        </button>

        <button
          type="button"
          onClick={submitTapWord}
          disabled={tapIndices.length < 2}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 disabled:opacity-35 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
        >
          <Check className="w-3.5 h-3.5" />
          <span>
            {showEnglishSub && ui.submit !== "Submit"
              ? `${ui.submit} · Submit`
              : ui.submit}
          </span>
        </button>
      </div>
    </div>
  );
};

export default WordWheel;
