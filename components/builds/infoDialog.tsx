/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { X, BookOpen, Hand, Keyboard, Lightbulb } from "lucide-react";
import { LanguageCode, LanguageUI } from "../../types";

interface InfoDialogProps {
  open: boolean;
  language: LanguageCode;
  languageName: string;
  ui: LanguageUI;
  bilingualMode: boolean;
  onClose: () => void;
}

const InfoDialog: React.FC<InfoDialogProps> = ({
  open,
  language,
  languageName,
  ui,
  bilingualMode,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleBackdropClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        onClose();
      }
    };
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("click", handleBackdropClick);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("click", handleBackdropClick);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [onClose]);

  if (!open) return null;

  const showEnSub = bilingualMode && language !== "en";

  return (
    <dialog
      ref={dialogRef}
      className="m-auto p-0 border border-slate-700/80 rounded-2xl bg-[#14171F] text-slate-100 backdrop:bg-black/70 backdrop:backdrop-blur-sm max-w-[480px] w-[calc(100%-32px)] shadow-2xl"
    >
      <div className="p-6 sm:p-8 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {showEnSub ? `${ui.howToPlayTitle} · How to Play` : ui.howToPlayTitle}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {ui.appName} · {languageName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <div className="flex items-start gap-3">
            <Hand className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">{ui.rule1Title}</p>
              <p className="text-slate-400">{ui.rule1Desc}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">{ui.rule2Title}</p>
              <p className="text-slate-400">{ui.rule2Desc}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">{ui.rule3Title}</p>
              <p className="text-slate-400">{ui.rule3Desc}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Keyboard className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">{ui.rule4Title}</p>
              <p className="text-slate-400">{ui.rule4Desc}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors"
        >
          {showEnSub ? `${ui.startPlaying} · Start Playing` : ui.startPlaying}
        </button>
      </div>
    </dialog>
  );
};

export default InfoDialog;