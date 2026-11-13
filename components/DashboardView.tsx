/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  Award,
  Globe,
  Share2,
  Search,
  CheckCircle2,
  Lock,
  Play,
  Calendar,
} from "lucide-react";
import {
  ACHIEVEMENTS,
  AchievementProgressInput,
  getAchievementProgress,
} from "../data/achievements";
import { LANGUAGE_LIST, LANGUAGE_PACKS } from "../puzzles";
import {
  AchievementDef,
  DailyChallengeProgress,
  DailyLeaderboardEntry,
  LanguageCode,
  LanguageStatRecord,
  PlayEventRecord,
} from "../types";
import { formatElapsedTime } from "../utils/dailyChallenge";
import DailyLeaderboardPanel from "./DailyLeaderboardPanel";

interface DashboardViewProps {
  totalScore: number;
  wordsSolvedCount: number;
  levelsCleared: number;
  bonusWordsCount: number;
  hintsUsed: number;
  bestStreak: number;
  savedVocabCount: number;
  clearedLevel6: boolean;
  langStats: Partial<Record<LanguageCode, LanguageStatRecord>>;
  sessions: PlayEventRecord[];
  isSignedIn: boolean;
  activeLanguage: LanguageCode;
  dailyDateKey: string;
  dailyCountdown: string;
  dailyLeaderboardEntries: DailyLeaderboardEntry[];
  localDailyProgress: DailyChallengeProgress | null;
  currentUserId: string | null;
  currentUserDisplayName: string;
  currentUserHandle: string;
  currentUserAvatarColor: string;
  isCloudVerified: boolean;
  onSelectLanguageToPlay: (lang: LanguageCode) => void;
  onPlayDailyLanguage: (lang: LanguageCode) => void;
  onShareAchievement: (achievement: AchievementDef) => void;
  onOpenAccount: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  totalScore,
  wordsSolvedCount,
  levelsCleared,
  bonusWordsCount,
  hintsUsed,
  bestStreak,
  savedVocabCount,
  clearedLevel6,
  langStats,
  sessions,
  isSignedIn,
  activeLanguage,
  dailyDateKey,
  dailyCountdown,
  dailyLeaderboardEntries,
  localDailyProgress,
  currentUserId,
  currentUserDisplayName,
  currentUserHandle,
  currentUserAvatarColor,
  isCloudVerified,
  onSelectLanguageToPlay,
  onPlayDailyLanguage,
  onShareAchievement,
  onOpenAccount,
}) => {
  const [rangeFilter, setRangeFilter] = useState<"7d" | "30d" | "all">("7d");
  const [langFilter, setLangFilter] = useState<LanguageCode | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  const achievementInput: AchievementProgressInput = {
    totalScore,
    wordsSolvedCount,
    levelsCleared,
    bonusWordsCount,
    bestStreak,
    savedVocabCount,
    clearedLevel6,
    langStats,
  };

  const activeLanguagesCount = useMemo(
    () =>
      (Object.values(langStats) as (LanguageStatRecord | undefined)[]).filter(
        (s) => s && (s.wordsSolved > 0 || s.score > 30)
      ).length,
    [langStats]
  );

  const hintFreeRate = useMemo(() => {
    const totalAttempts = wordsSolvedCount + hintsUsed;
    if (totalAttempts === 0) return 100;
    return Math.max(0, Math.round((wordsSolvedCount / totalAttempts) * 100));
  }, [wordsSolvedCount, hintsUsed]);

  // Build 7-day or 14-day chart buckets from sessions
  const chartData = useMemo(() => {
    const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 14 : 10;
    const now = new Date();
    const buckets: { label: string; points: number; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      buckets.push({ label: key, points: 0, count: 0 });
    }

    const cutoffMs =
      rangeFilter === "all"
        ? 0
        : Date.now() - (rangeFilter === "7d" ? 7 : 30) * 86400000;

    sessions.forEach((ev) => {
      if (ev.createdAtMs < cutoffMs) return;
      const d = new Date(ev.createdAtMs);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const match = buckets.find((b) => b.label === key);
      if (match) {
        match.points += Math.max(0, ev.points);
        match.count += 1;
      }
    });

    const maxPoints = Math.max(100, ...buckets.map((b) => b.points));
    return { buckets, maxPoints };
  }, [sessions, rangeFilter]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((ev) => {
      if (langFilter !== "all" && ev.language !== langFilter) return false;
      if (!q) return true;
      return (
        ev.word.toLowerCase().includes(q) ||
        ev.meaningEn.toLowerCase().includes(q) ||
        ev.eventType.toLowerCase().includes(q)
      );
    });
  }, [sessions, langFilter, searchQuery]);

  const unlockedCount = useMemo(
    () =>
      ACHIEVEMENTS.filter(
        (a) => getAchievementProgress(a, achievementInput).unlocked
      ).length,
    [achievementInput]
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Analytics & Progress Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track solved vocabulary, accuracy, language mastery, and shareable milestones.
          </p>
        </div>

        {!isSignedIn && (
          <button
            type="button"
            onClick={onOpenAccount}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <span>Sign In to Sync Cloud Data</span>
          </button>
        )}
      </div>

      {/* Daily Challenge Spotlight */}
      <div className="bg-[#12151C] border border-amber-400/35 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium tabular-nums">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Daily Challenge · {LANGUAGE_PACKS[activeLanguage].nameNative} · UTC{" "}
              {dailyDateKey}
            </span>
          </div>
          <p className="text-base font-semibold text-white">
            {localDailyProgress?.completed
              ? `Completed today (${localDailyProgress.score} pts · ${formatElapsedTime(
                  localDailyProgress.elapsedSeconds
                )})`
              : "Same curated puzzle once every 24 hours — compete on today's leaderboard"}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            Next 24-hour refresh in {dailyCountdown}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onPlayDailyLanguage(activeLanguage)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {localDailyProgress?.completed
              ? "View Daily Result & Board"
              : "Play Daily Challenge"}
          </span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-400">Total Score</p>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-1.5 tabular-nums font-mono">
            {totalScore.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {levelsCleared} levels · {bonusWordsCount} bonus words
          </p>
        </div>

        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-400">Words Solved</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-300 mt-1.5 tabular-nums font-mono">
            {wordsSolvedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            Best streak: {bestStreak} · Saved: {savedVocabCount}
          </p>
        </div>

        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-400">Hint-Free Rate</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-1.5 tabular-nums font-mono">
            {hintFreeRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {hintsUsed} hints applied
          </p>
        </div>

        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-400">Languages Active</p>
          <p className="text-2xl sm:text-3xl font-bold text-sky-400 mt-1.5 tabular-nums font-mono">
            {activeLanguagesCount} / {LANGUAGE_LIST.length}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            {unlockedCount} / {ACHIEVEMENTS.length} achievements
          </p>
        </div>
      </div>

      {/* Interactive Activity Chart + Language Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart Card */}
        <section className="lg:col-span-7 bg-[#12151C] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Points & Activity Trend
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg">
              {(["7d", "30d", "all"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRangeFilter(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    rangeFilter === r
                      ? "bg-amber-400 text-slate-950 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "14 Days" : "All"}
                </button>
              ))}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-xl p-6">
              <p className="text-sm font-medium text-slate-300">
                No session analytics recorded yet
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Solve words or complete a puzzle level to visualize your points and learning cadence here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-6 flex items-center justify-between text-xs text-slate-400 tabular-nums">
                {hoveredBarIdx !== null && chartData.buckets[hoveredBarIdx] ? (
                  <span className="text-amber-300 font-medium">
                    {chartData.buckets[hoveredBarIdx].label}:{" "}
                    {chartData.buckets[hoveredBarIdx].points} pts ·{" "}
                    {chartData.buckets[hoveredBarIdx].count} events
                  </span>
                ) : (
                  <span>Hover any bar to inspect daily activity</span>
                )}
                <span className="font-mono text-slate-500">
                  Peak: {chartData.maxPoints} pts
                </span>
              </div>

              <div className="w-full h-[180px]">
                <svg
                  viewBox={`0 0 ${chartData.buckets.length * 48} 160`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  {[0.25, 0.5, 0.75, 1].map((frac) => (
                    <line
                      key={frac}
                      x1="0"
                      x2={chartData.buckets.length * 48}
                      y1={132 - frac * 110}
                      y2={132 - frac * 110}
                      stroke="#1E293B"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ))}
                  {chartData.buckets.map((b, idx) => {
                    const barHeight = Math.max(
                      4,
                      Math.round((b.points / chartData.maxPoints) * 110)
                    );
                    const x = idx * 48 + 10;
                    const y = 132 - barHeight;
                    const isHovered = hoveredBarIdx === idx;
                    return (
                      <g
                        key={b.label}
                        onMouseEnter={() => setHoveredBarIdx(idx)}
                        onMouseLeave={() => setHoveredBarIdx(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={x}
                          y={y}
                          width="28"
                          height={barHeight}
                          rx="5"
                          fill={
                            b.points === 0
                              ? "#1E293B"
                              : isHovered
                              ? "#FBBF24"
                              : "#F59E0B"
                          }
                        />
                        <text
                          x={x + 14}
                          y="150"
                          textAnchor="middle"
                          fill="#64748B"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {b.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </section>

        {/* Language Mastery Matrix */}
        <section className="lg:col-span-5 bg-[#12151C] border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Language Mastery
              </h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              11 Languages
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[240px] pr-1">
            {LANGUAGE_LIST.map((pack) => {
              const stat = langStats[pack.code];
              const words = stat?.wordsSolved ?? 0;
              const score = stat?.score ?? 0;
              const totalWordsInPack = pack.puzzles.reduce(
                (acc, p) => acc + p.words.length,
                0
              );
              const pct = Math.min(
                100,
                Math.round((words / Math.max(1, totalWordsInPack)) * 100)
              );

              return (
                <button
                  key={pack.code}
                  type="button"
                  onClick={() => onSelectLanguageToPlay(pack.code)}
                  className="w-full text-left p-2.5 rounded-lg bg-[#0E1117] hover:bg-[#171C27] border border-slate-800/80 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-white truncate">
                        {pack.nameNative}
                      </span>
                      {pack.code !== "en" && (
                        <span className="text-slate-500 truncate">
                          {pack.nameEn}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums font-mono">
                      <span className="text-amber-300">{score} pts</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        {words}/{totalWordsInPack}
                      </span>
                      <Play className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Achievements Grid with Social Media Share */}
      <section className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-white">
              Achievements & Social Sharing
            </h2>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {unlockedCount} of {ACHIEVEMENTS.length} unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {ACHIEVEMENTS.map((ach) => {
            const prog = getAchievementProgress(ach, achievementInput);
            return (
              <div
                key={ach.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  prog.unlocked
                    ? "bg-[#161B26] border-amber-400/40"
                    : "bg-[#0E1117] border-slate-800/90"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {ach.title}
                    </h3>
                    {prog.unlocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unlocked</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 shrink-0">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                    <span>{ach.metricLabel}</span>
                    <span className="font-mono">
                      {prog.current} / {ach.target} ({prog.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        prog.unlocked ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>

                  {prog.unlocked && (
                    <button
                      type="button"
                      onClick={() => onShareAchievement(ach)}
                      className="mt-1 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share on Social Media</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dedicated Daily Challenge Leaderboard */}
      <DailyLeaderboardPanel
        dateKey={dailyDateKey}
        activeLanguage={activeLanguage}
        entries={dailyLeaderboardEntries}
        currentUserId={currentUserId}
        currentUserDisplayName={currentUserDisplayName}
        currentUserHandle={currentUserHandle}
        currentUserAvatarColor={currentUserAvatarColor}
        isCloudVerified={isCloudVerified}
        localDailyProgress={localDailyProgress}
        onOpenAccount={onOpenAccount}
        onPlayDailyLanguage={onPlayDailyLanguage}
      />

      {/* Activity Ledger Table */}
      <section className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">
            Recent Word & Puzzle History
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter word or meaning..."
                className="bg-[#0E1117] border border-slate-800 focus:border-amber-400 focus:outline-none rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 w-48"
              />
            </div>

            <select
              aria-label="Filter history by language"
              value={langFilter}
              onChange={(e) =>
                setLangFilter(e.target.value as LanguageCode | "all")
              }
              className="bg-[#0E1117] border border-slate-800 focus:border-amber-400 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-slate-200"
            >
              <option value="all">All Languages</option>
              {LANGUAGE_LIST.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.nameNative} ({p.nameEn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm text-slate-400">
              {sessions.length === 0
                ? "Play any puzzle to log solved words, hints, and level completions."
                : "No records match the current search or language filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="py-2.5 pr-4 font-medium">Word</th>
                  <th className="py-2.5 pr-4 font-medium">Meaning</th>
                  <th className="py-2.5 pr-4 font-medium">Language</th>
                  <th className="py-2.5 pr-4 font-medium">Event</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Points</th>
                  <th className="py-2.5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredSessions.slice(0, 25).map((ev) => {
                  const pack = LANGUAGE_PACKS[ev.language];
                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-[#171B24] transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-semibold text-amber-300">
                        {ev.word || "Level Clear"}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-300 max-w-[220px] truncate">
                        {ev.meaningEn}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                        {pack.nameNative} · L{ev.level}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                        {ev.eventType.replace("_", " ")}
                      </td>
                      <td
                        className={`py-2.5 pr-4 text-right font-mono tabular-nums whitespace-nowrap ${
                          ev.points >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ev.points >= 0 ? `+${ev.points}` : ev.points}
                      </td>
                      <td className="py-2.5 text-right text-slate-500 font-mono tabular-nums whitespace-nowrap">
                        {new Date(ev.createdAtMs).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardView;
