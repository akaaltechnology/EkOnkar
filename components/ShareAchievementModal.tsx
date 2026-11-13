/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { X, Download, Copy, Check, Share2, ExternalLink } from "lucide-react";
import { AchievementDef, LanguageCode } from "../types";
import { LANGUAGE_PACKS } from "../puzzles";

interface ShareAchievementModalProps {
  achievement: AchievementDef | null;
  playerName: string;
  playerHandle: string;
  activeLanguage: LanguageCode;
  totalScore: number;
  wordsSolvedCount: number;
  onClose: () => void;
}

const ShareAchievementModal: React.FC<ShareAchievementModalProps> = ({
  achievement,
  playerName,
  playerHandle,
  activeLanguage,
  totalScore,
  wordsSolvedCount,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [nativeShared, setNativeShared] = useState(false);

  const pack = LANGUAGE_PACKS[activeLanguage] || LANGUAGE_PACKS.pa;
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://ekonkar.app";

  const shareText = achievement
    ? `Unlocked "${achievement.title}" in EkOnKar (${pack.nameNative} · ${pack.nameEn}) — ${totalScore.toLocaleString()} pts & ${wordsSolvedCount} words solved!`
    : "";

  useEffect(() => {
    if (!achievement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 1200;
    const h = 630;
    canvas.width = w;
    canvas.height = h;

    // Background slate canvas
    ctx.fillStyle = "#0B0D11";
    ctx.fillRect(0, 0, w, h);

    // Subtle geometric border frame
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // Accent bar at top edge
    ctx.fillStyle = achievement.accentHex || "#F59E0B";
    ctx.fillRect(28, 28, w - 56, 6);

    // Header brand text
    ctx.fillStyle = "#94A3B8";
    ctx.font = "600 22px Plus Jakarta Sans, sans-serif";
    ctx.fillText("EKONKAR · MULTILINGUAL WORD WHEEL", 72, 92);

    // Language badge text
    ctx.fillStyle = "#FBBF24";
    ctx.font = "600 24px Plus Jakarta Sans, sans-serif";
    ctx.fillText(`${pack.nameNative} · ${pack.nameEn}`, 72, 140);

    // Achievement title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 58px Plus Jakarta Sans, sans-serif";
    ctx.fillText(achievement.title, 72, 238);

    // Description
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "400 28px Plus Jakarta Sans, sans-serif";
    ctx.fillText(achievement.description.slice(0, 68), 72, 295);

    // Divider
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 355);
    ctx.lineTo(w - 72, 355);
    ctx.stroke();

    // Metrics row
    ctx.fillStyle = "#94A3B8";
    ctx.font = "500 20px Plus Jakarta Sans, sans-serif";
    ctx.fillText("PLAYER", 72, 412);
    ctx.fillText("TOTAL SCORE", 460, 412);
    ctx.fillText("WORDS SOLVED", 780, 412);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 34px Plus Jakarta Sans, sans-serif";
    ctx.fillText(playerName.slice(0, 18), 72, 462);
    ctx.fillText(totalScore.toLocaleString(), 460, 462);
    ctx.fillText(String(wordsSolvedCount), 780, 462);

    ctx.fillStyle = "#64748B";
    ctx.font = "500 20px Plus Jakarta Sans, sans-serif";
    ctx.fillText(`@${playerHandle}`, 72, 502);

    // Footer date
    ctx.fillStyle = "#64748B";
    ctx.font = "500 20px Plus Jakarta Sans, sans-serif";
    ctx.fillText(
      `Earned ${new Date().toLocaleDateString()} · ${appUrl.replace(/^https?:\/\//, "")}`,
      72,
      568
    );
  }, [achievement, pack.nameEn, pack.nameNative, playerHandle, playerName, totalScore, wordsSolvedCount, appUrl]);

  if (!achievement) return null;

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(appUrl);

  const platforms = [
    {
      name: "X (Twitter)",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${appUrl}`)}`,
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${appUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekonkar-${achievement.id}.png`;
    a.click();
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `EkOnKar Achievement: ${achievement.title}`,
          text: shareText,
          url: appUrl,
        });
        setNativeShared(true);
        window.setTimeout(() => setNativeShared(false), 1800);
      } catch {
        // user dismissed
      }
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
        aria-labelledby="share-achievement-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#12151C] border border-slate-700/80 rounded-2xl max-w-[580px] w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-[#161A23]">
          <div>
            <h2
              id="share-achievement-title"
              className="text-lg font-semibold text-white"
            >
              Share Achievement
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Download your achievement card or post to social platforms
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="w-9 h-9 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0B0D11]">
            <canvas
              ref={canvasRef}
              className="w-full h-auto block"
              aria-label={`Achievement card preview for ${achievement.title}`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {platforms.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#171B24] hover:bg-[#222836] border border-slate-700/80 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap"
              >
                <span>{p.name}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171B24] hover:bg-[#222836] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Text</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Share Text</span>
                  </>
                )}
              </button>

              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171B24] hover:bg-[#222836] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{nativeShared ? "Shared" : "Device Share"}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Card PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareAchievementModal;
