/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Lightbulb, BookOpen } from "lucide-react";
import { LanguageCode, LanguageUI } from "../types";

interface FooterLeftContentProps {
  levelId: number;
  totalLevels: number;
  score: number;
  language: LanguageCode;
  ui: LanguageUI;
  bilingualMode: boolean;
  dailyLabel?: string;
  buttonDisabled?: boolean;
  button: () => void;
  onOpenLatestMeaning?: () => void;
  hasSolvedWord?: boolean;
}

const FooterLeftContent: React.FC<FooterLeftContentProps> = ({
  levelId,
  totalLevels,
  score,
  language,
  ui,
  bilingualMode,
  dailyLabel,
  button,
  buttonDisabled,
  onOpenLatestMeaning,
  hasSolvedWord,
}) => {
  const showEnglishSub = bilingualMode && language !== "en";

  return (
    <div className="w-full border-t border-slate-800/80 bg-[#0F1218]/90 px-4 sm:px-6 py-3">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-slate-300 tabular-nums">
          <span className="font-medium text-white">
            {dailyLabel ? dailyLabel : `${ui.levelLabel} ${levelId}/${totalLevels}`}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono">
            {ui.scoreLabel} {score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenLatestMeaning && (
            <button
              type="button"
              onClick={onOpenLatestMeaning}
              disabled={!hasSolvedWord}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#171A21] hover:bg-[#1E232F] text-slate-200 border border-slate-700/80 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Describe Word</span>
              <span className="sm:hidden">Meaning</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              button();
            }}
            disabled={buttonDisabled}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#1B1F2A] hover:bg-amber-400 text-slate-100 hover:text-slate-950 border border-slate-700/80 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
          >
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>
              {showEnglishSub ? `${ui.hintButton.replace(" (-30)", "")} · Hints` : "Hints"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FooterLeftContent;
