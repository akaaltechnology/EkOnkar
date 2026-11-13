/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Trophy, Clock, CheckCircle2, Globe, ArrowRight } from "lucide-react";
import { LANGUAGE_LIST, LANGUAGE_PACKS } from "../puzzles";
import {
  DailyChallengeProgress,
  DailyLeaderboardEntry,
  LanguageCode,
} from "../types";
import { formatElapsedTime } from "../utils/dailyChallenge";

interface DailyLeaderboardPanelProps {
  dateKey: string;
  activeLanguage: LanguageCode;
  entries: DailyLeaderboardEntry[];
  currentUserId: string | null;
  currentUserDisplayName: string;
  currentUserHandle: string;
  currentUserAvatarColor: string;
  isCloudVerified: boolean;
  localDailyProgress: DailyChallengeProgress | null;
  onOpenAccount?: () => void;
  onPlayDailyLanguage?: (lang: LanguageCode) => void;
}

const DailyLeaderboardPanel: React.FC<DailyLeaderboardPanelProps> = ({
  dateKey,
  activeLanguage,
  entries,
  currentUserId,
  currentUserDisplayName,
  currentUserHandle,
  currentUserAvatarColor,
  isCloudVerified,
  localDailyProgress,
  onOpenAccount,
  onPlayDailyLanguage,
}) => {
  const [filterLang, setFilterLang] = useState<LanguageCode | "active">(
    "active"
  );

  const displayLanguage: LanguageCode =
    filterLang === "active" ? activeLanguage : filterLang;

  const { rankedRows, myRank, myEntry } = useMemo(() => {
    const langEntries = entries.filter((e) => e.language === displayLanguage);

    // If guest or not yet synced to cloud, blend local progress preview if active language matches
    let combined = [...langEntries];
    if (
      localDailyProgress &&
      localDailyProgress.dateKey === dateKey &&
      localDailyProgress.language === displayLanguage &&
      (localDailyProgress.foundWords.length > 0 ||
        localDailyProgress.completed)
    ) {
      const hasCloudRow =
        Boolean(currentUserId) &&
        combined.some((e) => e.uid === currentUserId);
      if (!hasCloudRow) {
        const puzzleTotalWords =
          LANGUAGE_PACKS[displayLanguage].puzzles.find(
            (p) => p.id === localDailyProgress.puzzleId
          )?.words.length ?? Math.max(1, localDailyProgress.foundWords.length);

        combined.push({
          id: `local_${dateKey}_${displayLanguage}`,
          uid: currentUserId || "local_player",
          displayName: currentUserId
            ? currentUserDisplayName
            : "You (Local Preview)",
          handle: currentUserId ? currentUserHandle : "guest",
          avatarColor: currentUserAvatarColor || "#F59E0B",
          dateKey,
          language: displayLanguage,
          puzzleId: localDailyProgress.puzzleId,
          score: localDailyProgress.score,
          wordsSolved: localDailyProgress.foundWords.length,
          totalWords: puzzleTotalWords,
          bonusWords: localDailyProgress.foundBonusWords.length,
          hintsUsed: localDailyProgress.hintsUsed,
          elapsedSeconds: localDailyProgress.elapsedSeconds,
          completed: localDailyProgress.completed,
          createdAtMs: localDailyProgress.startedAtMs,
          updatedAtMs:
            localDailyProgress.completedAtMs || localDailyProgress.startedAtMs,
        });
      }
    }

    combined.sort(
      (a, b) =>
        Number(b.completed) - Number(a.completed) ||
        b.score - a.score ||
        a.elapsedSeconds - b.elapsedSeconds ||
        a.updatedAtMs - b.updatedAtMs
    );

    const selfUid = currentUserId || "local_player";
    const selfIndex = combined.findIndex((e) => e.uid === selfUid);
    return {
      rankedRows: combined,
      myRank: selfIndex >= 0 ? selfIndex + 1 : null,
      myEntry: selfIndex >= 0 ? combined[selfIndex] : null,
    };
  }, [
    entries,
    displayLanguage,
    localDailyProgress,
    dateKey,
    currentUserId,
    currentUserDisplayName,
    currentUserHandle,
    currentUserAvatarColor,
  ]);

  const pack = LANGUAGE_PACKS[displayLanguage] || LANGUAGE_PACKS.pa;

  return (
    <section className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-white">
              Daily Challenge Leaderboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {pack.nameNative} ({pack.nameEn}) · UTC {dateKey} ·{" "}
              {rankedRows.length} {rankedRows.length === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative inline-flex items-center">
            <Globe className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 pointer-events-none" />
            <select
              aria-label="Filter Daily Leaderboard Language"
              value={filterLang}
              onChange={(e) =>
                setFilterLang(e.target.value as LanguageCode | "active")
              }
              className="appearance-none bg-[#0E1117] border border-slate-800 focus:border-amber-400 focus:outline-none rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 cursor-pointer"
            >
              <option value="active">
                Active: {LANGUAGE_PACKS[activeLanguage].nameNative}
              </option>
              {LANGUAGE_LIST.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nameNative} ({p.nameEn})
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 text-[10px] text-slate-400">
              ▾
            </span>
          </label>

          {onPlayDailyLanguage && displayLanguage !== activeLanguage && (
            <button
              type="button"
              onClick={() => onPlayDailyLanguage(displayLanguage)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A1E29] hover:bg-slate-700 border border-slate-700 text-xs text-amber-300 font-medium transition-colors whitespace-nowrap"
            >
              <span>Play {pack.nameEn}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Personal Daily Standing Banner */}
      {myEntry && (
        <div className="bg-[#0E1117] border border-amber-400/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono tabular-nums text-amber-300">
              #{myRank}
            </span>
            <div>
              <p className="text-xs font-semibold text-white">
                Your Daily Entry · {myEntry.completed ? "Completed" : "In Progress"}
              </p>
              <p className="text-[11px] text-slate-400 tabular-nums">
                {myEntry.wordsSolved}/{myEntry.totalWords} words ·{" "}
                {myEntry.bonusWords} bonus · {myEntry.hintsUsed} hints ·{" "}
                {formatElapsedTime(myEntry.elapsedSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-base font-bold font-mono tabular-nums text-emerald-400">
              {myEntry.score} pts
            </span>
            {!isCloudVerified && onOpenAccount && (
              <button
                type="button"
                onClick={onOpenAccount}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Verify Account to Publish
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {rankedRows.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
          <Trophy className="w-7 h-7 text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-300">
            No daily leaderboard entries yet for {pack.nameEn} today
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Solve today's curated puzzle to claim the #1 rank for {dateKey} UTC.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="py-2.5 pr-3 font-medium">Rank</th>
                <th className="py-2.5 pr-4 font-medium">Player</th>
                <th className="py-2.5 pr-4 font-medium">Progress</th>
                <th className="py-2.5 pr-4 font-medium text-right">Time</th>
                <th className="py-2.5 pr-4 font-medium text-right">Hints</th>
                <th className="py-2.5 font-medium text-right">Daily Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rankedRows.slice(0, 25).map((row, idx) => {
                const isSelf =
                  row.uid === currentUserId || row.uid === "local_player";
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelf ? "bg-amber-400/10" : "hover:bg-[#171B24]"
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-amber-300 whitespace-nowrap">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-950 shrink-0"
                          style={{ backgroundColor: row.avatarColor || "#F59E0B" }}
                        >
                          {row.displayName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate">
                            {row.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            @{row.handle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-300 whitespace-nowrap tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {row.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span>
                          {row.wordsSolved}/{row.totalWords}
                          {row.bonusWords > 0 ? ` (+${row.bonusWords})` : ""}
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {formatElapsedTime(row.elapsedSeconds)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {row.hintsUsed}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap">
                      {row.score.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DailyLeaderboardPanel;
