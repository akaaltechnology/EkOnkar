/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { LanguageCode, Puzzle, RevealedCell } from "../types";
import { splitGraphemes } from "../utils/gurmukhi";

interface CrosswordGridProps {
  puzzle: Puzzle;
  language: LanguageCode;
  foundWords: string[];
  revealedCells?: RevealedCell[];
  onWordClick?: (word: string) => void;
}

const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  puzzle,
  language,
  foundWords,
  revealedCells = [],
  onWordClick,
}) => {
  const { grid, masks, width, height, minX, minY } = useMemo(() => {
    if (!puzzle.words || puzzle.words.length === 0) {
      return { grid: [], masks: [], width: 0, height: 0, minX: 0, minY: 0 };
    }

    let cMinX = Infinity;
    let cMaxX = -Infinity;
    let cMinY = Infinity;
    let cMaxY = -Infinity;

    const tokenized = puzzle.words.map((pw) => ({
      ...pw,
      tokens: splitGraphemes(pw.word, language),
    }));

    tokenized.forEach((pw) => {
      for (let i = 0; i < pw.tokens.length; i++) {
        const curX = pw.direction === "h" ? pw.x + i : pw.x;
        const curY = pw.direction === "v" ? pw.y + i : pw.y;
        cMinX = Math.min(cMinX, curX);
        cMaxX = Math.max(cMaxX, curX);
        cMinY = Math.min(cMinY, curY);
        cMaxY = Math.max(cMaxY, curY);
      }
    });

    const w = cMaxX - cMinX + 1;
    const h = cMaxY - cMinY + 1;

    const g: (string | null)[][] = Array.from({ length: h }, () =>
      Array(w).fill(null)
    );
    const m: boolean[][] = Array.from({ length: h }, () =>
      Array(w).fill(false)
    );

    tokenized.forEach((pw) => {
      for (let i = 0; i < pw.tokens.length; i++) {
        const curX = (pw.direction === "h" ? pw.x + i : pw.x) - cMinX;
        const curY = (pw.direction === "v" ? pw.y + i : pw.y) - cMinY;
        if (curX >= 0 && curX < w && curY >= 0 && curY < h) {
          g[curY][curX] = pw.tokens[i];
          m[curY][curX] = true;
        }
      }
    });

    return { grid: g, masks: m, width: w, height: h, minX: cMinX, minY: cMinY };
  }, [puzzle, language]);

  if (width === 0 || height === 0) return null;

  const getSolvedWordAt = (relX: number, relY: number): string | null => {
    const absoluteX = relX + minX;
    const absoluteY = relY + minY;
    const match = puzzle.words.find((pw) => {
      if (!foundWords.includes(pw.word)) return false;
      const tokens = splitGraphemes(pw.word, language);
      for (let i = 0; i < tokens.length; i++) {
        const curX = pw.direction === "h" ? pw.x + i : pw.x;
        const curY = pw.direction === "v" ? pw.y + i : pw.y;
        if (curX === absoluteX && curY === absoluteY) return true;
      }
      return false;
    });
    return match ? match.word : null;
  };

  const isCellHinted = (relX: number, relY: number): boolean => {
    const absoluteX = relX + minX;
    const absoluteY = relY + minY;
    return revealedCells.some(
      (c) => c.x === absoluteX && c.y === absoluteY
    );
  };

  const maxDim = Math.max(width, height);
  const cellClass =
    maxDim >= 8
      ? "w-8 h-8 sm:w-10 sm:h-10 lg:w-11 lg:h-11 text-[16px] sm:text-[20px] lg:text-[22px]"
      : maxDim >= 6
      ? "w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 text-[19px] sm:text-[22px] lg:text-[24px]"
      : "w-11 h-11 sm:w-13 sm:h-13 lg:w-14 lg:h-14 text-[22px] sm:text-[26px] lg:text-[30px]";

  return (
    <div
      key={puzzle.id}
      className="flex justify-center items-center max-w-full max-h-full min-w-0 min-h-0"
    >
      <div
        className="grid gap-1.5 sm:gap-2 p-2 justify-center items-center"
        style={{
          gridTemplateColumns: `repeat(${width}, auto)`,
          gridTemplateRows: `repeat(${height}, auto)`,
          width: "fit-content",
        }}
      >
        {grid.map((row, y) =>
          row.map((char, x) => {
            const solvedWord = getSolvedWordAt(x, y);
            const revealed = Boolean(solvedWord);
            const hinted = !revealed && isCellHinted(x, y);
            const isMasked = masks[y][x];

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                disabled={!revealed || !onWordClick}
                title={
                  solvedWord
                    ? `Describe meaning of "${solvedWord}"`
                    : undefined
                }
                onClick={() => {
                  if (solvedWord && onWordClick) onWordClick(solvedWord);
                }}
                className={`${cellClass} rounded-lg flex items-center justify-center transition-all duration-200
                  ${
                    !isMasked
                      ? "invisible pointer-events-none"
                      : revealed
                      ? "bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 shadow-[0_4px_16px_rgba(245,158,11,0.28)] border border-amber-300/60 cursor-pointer hover:brightness-105"
                      : hinted
                      ? "bg-[#1A2434] border border-sky-400/70 text-sky-300 cursor-default"
                      : "bg-[#171A21] border border-slate-700/70 text-transparent cursor-default"
                  }
                `}
                style={{
                  transitionDelay: revealed ? `${((x + y) % 4) * 35}ms` : "0ms",
                }}
              >
                {isMasked && (
                  <span
                    className={`font-semibold leading-none select-none transition-opacity duration-200 ${
                      revealed || hinted ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {char}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CrosswordGrid;
