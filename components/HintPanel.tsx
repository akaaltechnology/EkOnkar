/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, Eye, Grid3X3, Sparkles } from "lucide-react";
import { HintTier } from "../types";

interface HintPanelProps {
  open: boolean;
  score: number;
  remainingWordsCount: number;
  hasUnrevealedLetters: boolean;
  hasUnrevealedClues: boolean;
  onClose: () => void;
  onApplyHint: (tier: HintTier) => void;
}

const HintPanel: React.FC<HintPanelProps> = ({
  open,
  score,
  remainingWordsCount,
  hasUnrevealedLetters,
  hasUnrevealedClues,
  onClose,
  onApplyHint,
}) => {
  if (!open) return null;

  const tiers: {
    id: HintTier;
    title: string;
    desc: string;
    cost: number;
    disabled: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      id: "clue",
      title: "Meaning Clue",
      desc: "Reveal the English meaning & part of speech for an unsolved word.",
      cost: 10,
      disabled: score < 10 || !hasUnrevealedClues,
      icon: <Eye className="w-4 h-4 text-sky-400 shrink-0" />,
    },
    {
      id: "letter",
      title: "Reveal One Letter",
      desc: "Uncover a single character cell directly on the crossword grid.",
      cost: 15,
      disabled: score < 15 || !hasUnrevealedLetters,
      icon: <Grid3X3 className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
    {
      id: "word",
      title: "Solve Full Word",
      desc: "Unlock an entire remaining word and place it on the grid.",
      cost: 30,
      disabled: score < 30 || remainingWordsCount === 0,
      icon: <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hint-studio-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#12151C] border border-slate-700/80 rounded-2xl max-w-[440px] w-full shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-[#161A23]">
          <div>
            <h2 id="hint-studio-title" className="text-lg font-semibold text-white">
              Hint Options
            </h2>
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">
              Available balance: {score} points · {remainingWordsCount} words left
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hints"
            className="w-9 h-9 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {tiers.map((tier) => (
            <button
              key={tier.id}
              type="button"
              disabled={tier.disabled}
              onClick={() => {
                onApplyHint(tier.id);
                onClose();
              }}
              className="w-full text-left p-4 rounded-xl bg-[#161A23] hover:bg-[#1D222E] border border-slate-800 hover:border-amber-400/50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-start justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{tier.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{tier.title}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {tier.desc}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-300 tabular-nums whitespace-nowrap shrink-0 mt-0.5">
                -{tier.cost} pts
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HintPanel;
