/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  HelpCircle,
  Volume2,
  VolumeX,
  Languages,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Award,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Bell,
  BookOpen,
  Lightbulb,
  Share2,
  User as UserIcon,
  Calendar,
  Clock,
  Trophy,
} from "lucide-react";
import { generatePuzzle } from "./services/geminiService";
import {
  auth,
  connectGoogleCalendarPopup,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  deleteNoteFromCloud,
  deleteNotificationInCloud,
  deleteTaskFromCloud,
  deleteVocabFromCloud,
  ensureUserDocuments,
  fetchGoogleCalendarEvents,
  getGoogleCalendarToken,
  isUserVerified,
  markNotificationReadInCloud,
  pushNotificationToCloud,
  saveNoteToCloud,
  saveTaskToCloud,
  saveVocabToCloud,
  submitDailyLeaderboardEntry,
  subscribeDailyLeaderboard,
  subscribeUserData,
  syncGameplayToCloud,
  updateSubscriptionInCloud,
} from "./services/firebase";
import FooterLeftContent from "./components/FooterLeftContent";
import {
  AchievementDef,
  AppNotification,
  AppView,
  DailyChallengeProgress,
  DailyLeaderboardEntry,
  GameState,
  GoogleCalendarEvent,
  HintTier,
  LanguageCode,
  LanguageStatRecord,
  PersonalNoteRecord,
  PersonalTaskRecord,
  PlayEventRecord,
  PlayEventType,
  PlayMode,
  Puzzle,
  SubscriptionStatus,
  SubscriptionTier,
  UserPrivateSecurity,
  UserProfile,
  VocabularyRecord,
  WordMeaningDetail,
} from "./types";
import WordWheel from "./components/WordWheel";
import CrosswordGrid from "./components/CrosswordGrid";
import useAudio from "./hooks/useAudio";
import InfoDialog from "./components/builds/infoDialog";
import WordMeaningModal from "./components/WordMeaningModal";
import HintPanel from "./components/HintPanel";
import ShareAchievementModal from "./components/ShareAchievementModal";
import NotificationsDrawer from "./components/NotificationsDrawer";
import DashboardView from "./components/DashboardView";
import DictionaryView from "./components/DictionaryView";
import AccountView from "./components/AccountView";
import PlannerView from "./components/PlannerView";
import SubscriptionPlansView from "./components/SubscriptionPlansView";
import DailyLeaderboardPanel from "./components/DailyLeaderboardPanel";
import { LANGUAGE_LIST, LANGUAGE_PACKS } from "./puzzles";
import { ACHIEVEMENTS, getAchievementProgress } from "./data/achievements";
import { SUBSCRIPTION_PLANS } from "./data/subscriptionPlans";
import { normalizeWord, splitGraphemes } from "./utils/gurmukhi";
import { describeWordMeaning } from "./utils/wordMeanings";
import {
  calculateDailyCompletionBonuses,
  formatCountdown,
  formatElapsedTime,
  getDailyChallengePuzzle,
  getMsUntilNextUtcDay,
  getUtcDateKey,
  loadLocalDailyProgress,
  saveLocalDailyProgress,
} from "./utils/dailyChallenge";

const TOTAL_LEVELS = 6;

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function getSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem("akhar_lang") as LanguageCode | null;
    if (saved && saved in LANGUAGE_PACKS) return saved;
  } catch {
    // ignore
  }
  return "pa";
}

function getSavedScore(lang: LanguageCode): number {
  try {
    const raw = localStorage.getItem(`akhar_score_${lang}`);
    if (raw !== null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // ignore
  }
  return 30;
}

const App: React.FC = () => {
  const initialLang = getSavedLanguage();
  const initialPack = LANGUAGE_PACKS[initialLang];
  const initialPuzzle = initialPack.puzzles[0];

  const [activeView, setActiveView] = useState<AppView>("play");
  const [state, setState] = useState<GameState>(() => ({
    language: initialLang,
    level: 1,
    score: getSavedScore(initialLang),
    foundWords: [],
    foundBonusWords: [],
    revealedCells: [],
    revealedClueWords: [],
    currentPuzzle: initialPuzzle,
    nextPuzzle: null,
    loading: false,
    message: "",
    gameWon: false,
    showLevelModal: false,
  }));

  const [bilingualMode, setBilingualMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("akhar_bilingual");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });
  const [showMeaningClues, setShowMeaningClues] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showHintPanel, setShowHintPanel] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [inspectedMeaning, setInspectedMeaning] =
    useState<WordMeaningDetail | null>(null);
  const [shareTarget, setShareTarget] = useState<AchievementDef | null>(null);
  const [unlockedToast, setUnlockedToast] = useState<AchievementDef | null>(
    null
  );

  const [currentGuess, setCurrentGuess] = useState("");
  const [uiMessage, setUiMessage] = useState<{
    text: string;
    subText?: string;
    type: "info" | "success" | "error" | "bonus";
  }>({ text: "", type: "info" });
  const [shakeGuess, setShakeGuess] = useState(false);

  // Firebase Auth & Cloud / Local Analytics State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [cloudSecurity, setCloudSecurity] =
    useState<UserPrivateSecurity | null>(null);

  const [localLangStats, setLocalLangStats] = useState<
    Partial<Record<LanguageCode, LanguageStatRecord>>
  >(() => safeReadJson("akhar_local_lang_stats", {}));
  const [cloudLangStats, setCloudLangStats] = useState<
    Partial<Record<LanguageCode, LanguageStatRecord>>
  >({});

  const [localSessions, setLocalSessions] = useState<PlayEventRecord[]>(() =>
    safeReadJson("akhar_local_sessions", [])
  );
  const [cloudSessions, setCloudSessions] = useState<PlayEventRecord[]>([]);

  const [localVocab, setLocalVocab] = useState<VocabularyRecord[]>(() =>
    safeReadJson("akhar_local_vocab", [])
  );
  const [cloudVocab, setCloudVocab] = useState<VocabularyRecord[]>([]);

  const [localNotifs, setLocalNotifs] = useState<AppNotification[]>(() =>
    safeReadJson("akhar_local_notifs", [
      {
        id: "welcome_tip",
        uid: "guest",
        title: "Welcome to EkOnKar",
        body: "Tap any solved word to describe its full meaning, or create an account to sync analytics across devices.",
        category: "reminder",
        read: false,
        createdAtMs: Date.now(),
      },
    ])
  );
  const [cloudNotifs, setCloudNotifs] = useState<AppNotification[]>([]);

  const [localTasks, setLocalTasks] = useState<PersonalTaskRecord[]>(() =>
    safeReadJson("akhar_local_tasks", [])
  );
  const [cloudTasks, setCloudTasks] = useState<PersonalTaskRecord[]>([]);

  const [localNotes, setLocalNotes] = useState<PersonalNoteRecord[]>(() =>
    safeReadJson("akhar_local_notes", [])
  );
  const [cloudNotes, setCloudNotes] = useState<PersonalNoteRecord[]>([]);

  const [localSubTier, setLocalSubTier] = useState<SubscriptionTier>(() =>
    safeReadJson<SubscriptionTier>("akhar_local_sub_tier", "free")
  );
  const [localSubStatus, setLocalSubStatus] = useState<SubscriptionStatus>(() =>
    safeReadJson<SubscriptionStatus>("akhar_local_sub_status", "active")
  );

  // Google Calendar in-memory only state (token never persisted in storage)
  const [googleToken, setGoogleToken] = useState<string | null>(() =>
    getGoogleCalendarToken()
  );
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [verificationTick, setVerificationTick] = useState(0);

  // Daily Challenge State (deterministic 24h UTC puzzle per language + leaderboard)
  const [playMode, setPlayMode] = useState<PlayMode>("levels");
  const [dailyDateKey, setDailyDateKey] = useState<string>(() => getUtcDateKey());
  const [dailyCountdown, setDailyCountdown] = useState<string>(() =>
    formatCountdown(getMsUntilNextUtcDay())
  );
  const [dailyProgress, setDailyProgress] = useState<DailyChallengeProgress>(() =>
    loadLocalDailyProgress(
      getUtcDateKey(),
      initialLang,
      getDailyChallengePuzzle(initialLang, getUtcDateKey())
    )
  );
  const [dailyLeaderboardEntries, setDailyLeaderboardEntries] = useState<
    DailyLeaderboardEntry[]
  >([]);
  const [dailyLastBonusBreakdown, setDailyLastBonusBreakdown] = useState<{
    completionBonus: number;
    speedBonus: number;
    hintFreeBonus: number;
    totalBonus: number;
  } | null>(null);

  const [localCounters, setLocalCounters] = useState<{
    wordsSolvedCount: number;
    levelsCleared: number;
    bonusWordsCount: number;
    hintsUsed: number;
    bestStreak: number;
    currentStreak: number;
    clearedLevel6: boolean;
    unlockedAchievementIds: string[];
  }>(() =>
    safeReadJson("akhar_local_counters", {
      wordsSolvedCount: 0,
      levelsCleared: 0,
      bonusWordsCount: 0,
      hintsUsed: 0,
      bestStreak: 0,
      currentStreak: 0,
      clearedLevel6: false,
      unlockedAchievementIds: [],
    })
  );

  const usedPuzzleIds = useRef<string[]>([initialPuzzle.id]);
  const activeFetch = useRef<{
    language: LanguageCode;
    level: number;
    promise: Promise<Puzzle>;
  } | null>(null);
  const msgTimerRef = useRef<number | null>(null);

  const { soundEnabled, toggleSound, playSfx } = useAudio();

  const activePack = LANGUAGE_PACKS[state.language] || LANGUAGE_PACKS.pa;
  const ui = activePack.ui;
  const showEnglishSub = bilingualMode && state.language !== "en";

  const isCloudSynced = isUserVerified(authUser);
  const effectiveLangStats = isCloudSynced ? cloudLangStats : localLangStats;
  const effectiveSessions = isCloudSynced ? cloudSessions : localSessions;
  const effectiveVocab = isCloudSynced ? cloudVocab : localVocab;
  const effectiveNotifs = isCloudSynced ? cloudNotifs : localNotifs;
  const effectiveTasks = isCloudSynced ? cloudTasks : localTasks;
  const effectiveNotes = isCloudSynced ? cloudNotes : localNotes;
  const effectiveSubTier: SubscriptionTier = isCloudSynced
    ? cloudSecurity?.subscriptionTier || localSubTier
    : localSubTier;
  const effectiveSubStatus: SubscriptionStatus = isCloudSynced
    ? cloudSecurity?.subscriptionStatus || localSubStatus
    : localSubStatus;

  const effectiveTotalScore = isCloudSynced
    ? cloudProfile?.totalScore ?? state.score
    : (Object.values(localLangStats) as (LanguageStatRecord | undefined)[]).reduce(
        (acc, s) => acc + (s?.score ?? 0),
        0
      ) || state.score;

  const effectiveWordsSolved = isCloudSynced
    ? cloudProfile?.wordsSolvedCount ?? localCounters.wordsSolvedCount
    : localCounters.wordsSolvedCount;
  const effectiveLevelsCleared = isCloudSynced
    ? cloudProfile?.levelsCleared ?? localCounters.levelsCleared
    : localCounters.levelsCleared;
  const effectiveBonusCount = isCloudSynced
    ? cloudProfile?.bonusWordsCount ?? localCounters.bonusWordsCount
    : localCounters.bonusWordsCount;
  const effectiveHintsUsed = isCloudSynced
    ? cloudProfile?.hintsUsed ?? localCounters.hintsUsed
    : localCounters.hintsUsed;
  const effectiveBestStreak = isCloudSynced
    ? cloudProfile?.bestStreak ?? localCounters.bestStreak
    : localCounters.bestStreak;
  const effectiveClearedLevel6 = isCloudSynced
    ? (Object.values(cloudLangStats) as (LanguageStatRecord | undefined)[]).some(
        (s) => s && s.highestLevel >= 6 && s.puzzlesCompleted > 0
      ) || localCounters.clearedLevel6
    : localCounters.clearedLevel6;

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setGoogleToken(null);
        setGoogleEvents([]);
        setGoogleError("");
      } else {
        const token = getGoogleCalendarToken();
        if (token) setGoogleToken(token);
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to Firestore once signed-in user is verified (email OR phone)
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    const current = auth.currentUser;
    if (current && isUserVerified(current)) {
      (async () => {
        try {
          await ensureUserDocuments(current, state.language, state.score);
          if (cancelled) return;
          unsubFirestore = subscribeUserData(current.uid, {
            onProfile: setCloudProfile,
            onSecurity: setCloudSecurity,
            onLangStats: setCloudLangStats,
            onSessions: setCloudSessions,
            onVocabulary: setCloudVocab,
            onNotifications: setCloudNotifs,
            onTasks: setCloudTasks,
            onNotes: setCloudNotes,
          });
        } catch (err) {
          console.error("Cloud sync initialization error:", err);
        }
      })();
    } else {
      setCloudProfile(null);
      setCloudSecurity(null);
      setCloudLangStats({});
      setCloudSessions([]);
      setCloudVocab([]);
      setCloudNotifs([]);
      setCloudTasks([]);
      setCloudNotes([]);
    }

    return () => {
      cancelled = true;
      if (unsubFirestore) unsubFirestore();
    };
  }, [authUser?.uid, isCloudSynced, verificationTick]);

  // 24-hour UTC Daily Challenge countdown & day rollover ticker
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      const key = getUtcDateKey(now);
      setDailyCountdown(formatCountdown(getMsUntilNextUtcDay(now)));
      setDailyDateKey((prevKey) => (prevKey !== key ? key : prevKey));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Subscribe to today's live Daily Leaderboard
  useEffect(() => {
    const unsub = subscribeDailyLeaderboard(
      dailyDateKey,
      setDailyLeaderboardEntries,
      (err) => console.warn("Daily leaderboard sync notice:", err.message)
    );
    return () => unsub();
  }, [dailyDateKey]);

  // Reload local daily progress whenever date or selected language changes
  useEffect(() => {
    const puz = getDailyChallengePuzzle(state.language, dailyDateKey);
    const loaded = loadLocalDailyProgress(dailyDateKey, state.language, puz);
    setDailyProgress(loaded);
    setDailyLastBonusBreakdown(
      loaded.completed
        ? calculateDailyCompletionBonuses(loaded.elapsedSeconds, loaded.hintsUsed)
        : null
    );
  }, [dailyDateKey, state.language]);

  // Sync completion lock if this verified user already completed today's language puzzle in Firestore
  useEffect(() => {
    if (!authUser) return;
    const cloudRow = dailyLeaderboardEntries.find(
      (e) =>
        e.uid === authUser.uid &&
        e.language === state.language &&
        e.dateKey === dailyDateKey
    );
    if (!cloudRow) return;
    if (cloudRow.completed && !dailyProgress.completed) {
      const puz = getDailyChallengePuzzle(state.language, dailyDateKey);
      const synced: DailyChallengeProgress = {
        ...dailyProgress,
        foundWords: puz.words.map((w) => w.word),
        score: cloudRow.score,
        hintsUsed: cloudRow.hintsUsed,
        elapsedSeconds: cloudRow.elapsedSeconds,
        completed: true,
        completedAtMs: cloudRow.updatedAtMs,
      };
      setDailyProgress(synced);
      saveLocalDailyProgress(synced);
      setDailyLastBonusBreakdown(
        calculateDailyCompletionBonuses(cloudRow.elapsedSeconds, cloudRow.hintsUsed)
      );
    }
  }, [authUser, dailyLeaderboardEntries, state.language, dailyDateKey, dailyProgress]);

  // Elapsed timer while actively playing an unfinished Daily Challenge
  useEffect(() => {
    if (
      activeView !== "play" ||
      playMode !== "daily" ||
      dailyProgress.completed
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setDailyProgress((prev) => {
        if (prev.completed) return prev;
        const next = { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 };
        if (next.elapsedSeconds % 5 === 0) {
          saveLocalDailyProgress(next);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeView, playMode, dailyProgress.completed]);

  useEffect(() => {
    document.documentElement.lang = state.language;
    try {
      localStorage.setItem("akhar_lang", state.language);
      localStorage.setItem(`akhar_score_${state.language}`, String(state.score));
    } catch {
      // ignore
    }
  }, [state.language, state.score]);

  const addNotification = useCallback(
    async (
      title: string,
      body: string,
      category: AppNotification["category"]
    ) => {
      if (isCloudSynced && authUser) {
        if (category === "achievement" && cloudSecurity && !cloudSecurity.notifyAchievements) {
          return;
        }
        if (category === "security" && cloudSecurity && !cloudSecurity.notifySecurity) {
          return;
        }
        await pushNotificationToCloud(authUser.uid, { title, body, category });
      } else {
        setLocalNotifs((prev) => {
          const next: AppNotification[] = [
            {
              id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              uid: "guest",
              title,
              body,
              category,
              read: false,
              createdAtMs: Date.now(),
            },
            ...prev,
          ].slice(0, 40);
          safeWriteJson("akhar_local_notifs", next);
          return next;
        });
      }
    },
    [isCloudSynced, authUser, cloudSecurity]
  );

  const toggleBilingualMode = () => {
    setBilingualMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("akhar_bilingual", String(next));
      } catch {
        // ignore
      }
      return next;
    });
    playSfx("click");
  };

  const showTemporaryMessage = useCallback(
    (
      text: string,
      type: "info" | "success" | "error" | "bonus",
      subText?: string
    ) => {
      if (msgTimerRef.current) {
        window.clearTimeout(msgTimerRef.current);
      }
      setUiMessage({ text, subText, type });
      if (type === "error") {
        setShakeGuess(true);
        window.setTimeout(() => setShakeGuess(false), 300);
      }
      msgTimerRef.current = window.setTimeout(() => {
        setUiMessage({ text: "", type: "info" });
      }, 1800);
    },
    []
  );

  const recordAnalyticsEvent = useCallback(
    async (params: {
      eventType: PlayEventType;
      word: string;
      meaningEn: string;
      points: number;
      newLangScore: number;
      levelClearedNow?: boolean;
      usedHintNow?: boolean;
      bonusNow?: boolean;
      solvedMainWordNow?: boolean;
      savedVocabCountOverride?: number;
    }) => {
      const {
        eventType,
        word,
        meaningEn,
        points,
        newLangScore,
        levelClearedNow,
        usedHintNow,
        bonusNow,
        solvedMainWordNow,
        savedVocabCountOverride,
      } = params;

      const curStreak = usedHintNow
        ? 0
        : solvedMainWordNow
        ? localCounters.currentStreak + 1
        : localCounters.currentStreak;
      const nextBestStreak = Math.max(
        effectiveBestStreak,
        curStreak
      );
      const nextWordsSolved =
        effectiveWordsSolved + (solvedMainWordNow ? 1 : 0);
      const nextLevelsCleared =
        effectiveLevelsCleared + (levelClearedNow ? 1 : 0);
      const nextBonusCount = effectiveBonusCount + (bonusNow ? 1 : 0);
      const nextHintsUsed = effectiveHintsUsed + (usedHintNow ? 1 : 0);
      const nextClearedLevel6 =
        effectiveClearedLevel6 || (Boolean(levelClearedNow) && state.level >= 6);

      const prevStat = effectiveLangStats[state.language];
      const updatedLangStat: LanguageStatRecord = {
        uid: authUser?.uid || "guest",
        language: state.language,
        score: Math.max(0, newLangScore),
        wordsSolved: (prevStat?.wordsSolved ?? 0) + (solvedMainWordNow ? 1 : 0),
        puzzlesCompleted:
          (prevStat?.puzzlesCompleted ?? 0) + (levelClearedNow ? 1 : 0),
        highestLevel: Math.max(prevStat?.highestLevel ?? 1, state.level),
        hintsUsed: (prevStat?.hintsUsed ?? 0) + (usedHintNow ? 1 : 0),
      };

      const nextStatsMap: Partial<Record<LanguageCode, LanguageStatRecord>> = {
        ...effectiveLangStats,
        [state.language]: updatedLangStat,
      };

      const nextTotalScore = Math.max(
        newLangScore,
        (Object.values(nextStatsMap) as (LanguageStatRecord | undefined)[]).reduce(
          (acc, s) => acc + (s?.score ?? 0),
          0
        )
      );

      const previouslyUnlocked = isCloudSynced
        ? cloudProfile?.unlockedAchievementIds ?? localCounters.unlockedAchievementIds
        : localCounters.unlockedAchievementIds;

      const newlyUnlocked: AchievementDef[] = [];
      const nextUnlockedIds = [...previouslyUnlocked];

      ACHIEVEMENTS.forEach((ach) => {
        const res = getAchievementProgress(ach, {
          totalScore: nextTotalScore,
          wordsSolvedCount: nextWordsSolved,
          levelsCleared: nextLevelsCleared,
          bonusWordsCount: nextBonusCount,
          bestStreak: nextBestStreak,
          savedVocabCount: savedVocabCountOverride ?? effectiveVocab.length,
          clearedLevel6: nextClearedLevel6,
          langStats: nextStatsMap,
        });
        if (res.unlocked && !nextUnlockedIds.includes(ach.id)) {
          nextUnlockedIds.push(ach.id);
          newlyUnlocked.push(ach);
        }
      });

      const nextCounters = {
        wordsSolvedCount: nextWordsSolved,
        levelsCleared: nextLevelsCleared,
        bonusWordsCount: nextBonusCount,
        hintsUsed: nextHintsUsed,
        bestStreak: nextBestStreak,
        currentStreak: curStreak,
        clearedLevel6: nextClearedLevel6,
        unlockedAchievementIds: nextUnlockedIds,
      };
      setLocalCounters(nextCounters);
      safeWriteJson("akhar_local_counters", nextCounters);

      if (!isCloudSynced) {
        setLocalLangStats(nextStatsMap);
        safeWriteJson("akhar_local_lang_stats", nextStatsMap);
        if (state.currentPuzzle) {
          const newEvent: PlayEventRecord = {
            id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            uid: "guest",
            language: state.language,
            level: state.level,
            puzzleId: state.currentPuzzle.id,
            word,
            meaningEn,
            points,
            eventType,
            createdAtMs: Date.now(),
          };
          setLocalSessions((prev) => {
            const next = [newEvent, ...prev].slice(0, 100);
            safeWriteJson("akhar_local_sessions", next);
            return next;
          });
        }
      } else if (authUser && state.currentPuzzle) {
        await syncGameplayToCloud({
          uid: authUser.uid,
          profileTotals: {
            totalScore: nextTotalScore,
            wordsSolvedCount: nextWordsSolved,
            levelsCleared: nextLevelsCleared,
            bonusWordsCount: nextBonusCount,
            hintsUsed: nextHintsUsed,
            bestStreak: nextBestStreak,
            unlockedAchievementIds: nextUnlockedIds,
            preferredLanguage: state.language,
          },
          langStat: {
            language: state.language,
            score: updatedLangStat.score,
            wordsSolved: updatedLangStat.wordsSolved,
            puzzlesCompleted: updatedLangStat.puzzlesCompleted,
            highestLevel: updatedLangStat.highestLevel,
            hintsUsed: updatedLangStat.hintsUsed,
          },
          event: {
            language: state.language,
            level: state.level,
            puzzleId: state.currentPuzzle.id,
            word,
            meaningEn,
            points,
            eventType,
          },
        });
      }

      if (newlyUnlocked.length > 0) {
        const first = newlyUnlocked[0];
        setUnlockedToast(first);
        window.setTimeout(() => setUnlockedToast(null), 6000);
        for (const ach of newlyUnlocked) {
          await addNotification(
            `Achievement Unlocked: ${ach.title}`,
            ach.description,
            "achievement"
          );
        }
      }
    },
    [
      authUser,
      cloudProfile,
      effectiveBestStreak,
      effectiveBonusCount,
      effectiveClearedLevel6,
      effectiveHintsUsed,
      effectiveLangStats,
      effectiveLevelsCleared,
      effectiveVocab.length,
      effectiveWordsSolved,
      isCloudSynced,
      localCounters,
      state.currentPuzzle,
      state.language,
      state.level,
      addNotification,
    ]
  );

  const prefetchNextLevel = useCallback(
    async (lang: LanguageCode, currentLevel: number) => {
      const targetLevel = currentLevel + 1;
      if (targetLevel > TOTAL_LEVELS) return;
      if (
        activeFetch.current?.language === lang &&
        activeFetch.current?.level === targetLevel
      ) {
        return;
      }

      setState((prev) => ({ ...prev, isPrefetching: true }));
      const promise = generatePuzzle(
        lang,
        targetLevel,
        usedPuzzleIds.current.slice(-10)
      );
      activeFetch.current = { language: lang, level: targetLevel, promise };

      try {
        const puzzle = await promise;
        setState((prev) => {
          if (prev.language !== lang || puzzle.difficulty <= prev.level) {
            return { ...prev, isPrefetching: false };
          }
          return { ...prev, nextPuzzle: puzzle, isPrefetching: false };
        });
      } catch {
        setState((prev) => ({ ...prev, isPrefetching: false }));
      } finally {
        if (
          activeFetch.current?.language === lang &&
          activeFetch.current?.level === targetLevel
        ) {
          activeFetch.current = null;
        }
      }
    },
    []
  );

  const handleWheelInteraction = useCallback(() => {
    if (state.nextPuzzle || activeFetch.current) return;
    prefetchNextLevel(state.language, state.level);
  }, [state.language, state.level, state.nextPuzzle, prefetchNextLevel]);

  const loadLevel = useCallback(
    async (
      level: number,
      forceFresh = false,
      targetLang: LanguageCode = state.language
    ) => {
      if (
        !forceFresh &&
        targetLang === state.language &&
        state.nextPuzzle &&
        state.nextPuzzle.difficulty === level
      ) {
        const nextP = state.nextPuzzle;
        usedPuzzleIds.current.push(nextP.id);
        setState((prev) => ({
          ...prev,
          currentPuzzle: nextP,
          nextPuzzle: null,
          foundWords: [],
          foundBonusWords: [],
          revealedCells: [],
          revealedClueWords: [],
          loading: false,
          level,
          showLevelModal: false,
          gameWon: false,
        }));
        setCurrentGuess("");
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        showLevelModal: false,
        gameWon: false,
      }));

      try {
        const exclude =
          targetLang === state.language && state.currentPuzzle
            ? [state.currentPuzzle.id, ...usedPuzzleIds.current.slice(-6)]
            : usedPuzzleIds.current.slice(-6);
        const puzzle = await generatePuzzle(targetLang, level, exclude);
        usedPuzzleIds.current.push(puzzle.id);

        setState((prev) => ({
          ...prev,
          language: targetLang,
          score:
            targetLang !== prev.language ? getSavedScore(targetLang) : prev.score,
          currentPuzzle: puzzle,
          nextPuzzle: null,
          foundWords: [],
          foundBonusWords: [],
          revealedCells: [],
          revealedClueWords: [],
          loading: false,
          isPrefetching: false,
          level,
        }));
        setCurrentGuess("");
      } catch (e) {
        console.error(e);
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [state.language, state.nextPuzzle, state.currentPuzzle]
  );

  const syncDailyCloudEntry = useCallback(
    async (progress: DailyChallengeProgress, puzzleObj: Puzzle) => {
      if (!isCloudSynced || !authUser) return;
      await submitDailyLeaderboardEntry({
        uid: authUser.uid,
        displayName:
          cloudProfile?.displayName ||
          authUser.displayName ||
          authUser.email?.split("@")[0] ||
          "Scholar",
        handle:
          cloudProfile?.handle ||
          authUser.email?.split("@")[0] ||
          `player_${authUser.uid.slice(0, 6)}`,
        avatarColor: cloudProfile?.avatarColor || "#F59E0B",
        dateKey: progress.dateKey,
        language: progress.language,
        puzzleId: puzzleObj.id,
        score: progress.score,
        wordsSolved: progress.foundWords.length,
        totalWords: puzzleObj.words.length,
        bonusWords: progress.foundBonusWords.length,
        hintsUsed: progress.hintsUsed,
        elapsedSeconds: progress.elapsedSeconds,
        completed: progress.completed,
      });
    },
    [isCloudSynced, authUser, cloudProfile]
  );

  const handleLanguageChange = (newLang: LanguageCode) => {
    if (newLang === state.language) return;
    playSfx("click");
    activeFetch.current = null;
    setUiMessage({ text: "", type: "info" });
    setCurrentGuess("");
    loadLevel(1, true, newLang);
  };

  const handleOpenDailyForLanguage = (lang: LanguageCode) => {
    playSfx("click");
    setUiMessage({ text: "", type: "info" });
    setCurrentGuess("");
    setPlayMode("daily");
    setActiveView("play");
    if (lang !== state.language) {
      loadLevel(1, true, lang);
    }
  };

  const handleWordSubmit = useCallback(
    (rawWord: string) => {
      const dailyPuzzleObj = getDailyChallengePuzzle(state.language, dailyDateKey);
      const activePuzzleObj =
        playMode === "daily" ? dailyPuzzleObj : state.currentPuzzle;
      if (!activePuzzleObj) return;

      if (playMode === "daily" && dailyProgress.completed) {
        showTemporaryMessage(
          "Daily Already Completed",
          "info",
          `Next puzzle in ${dailyCountdown}`
        );
        setCurrentGuess("");
        return;
      }

      const activeFoundList =
        playMode === "daily" ? dailyProgress.foundWords : state.foundWords;
      const activeBonusList =
        playMode === "daily"
          ? dailyProgress.foundBonusWords
          : state.foundBonusWords;
      const currentBoardScore =
        playMode === "daily" ? dailyProgress.score : state.score;

      const word = normalizeWord(rawWord, state.language);
      const tokenCount = splitGraphemes(word, state.language).length;

      const targetWord = activePuzzleObj.words.find(
        (w) => normalizeWord(w.word, state.language) === word
      );

      if (targetWord) {
        if (activeFoundList.includes(targetWord.word)) {
          showTemporaryMessage(
            ui.alreadyFound,
            "info",
            showEnglishSub ? "Already found" : undefined
          );
          playSfx("error");
        } else {
          const newFoundWords = [...activeFoundList, targetWord.word];
          const pointsEarned = tokenCount * 20;
          const isPuzzleDone =
            newFoundWords.length === activePuzzleObj.words.length;

          if (playMode === "daily") {
            const bonusBreakdown = isPuzzleDone
              ? calculateDailyCompletionBonuses(
                  dailyProgress.elapsedSeconds,
                  dailyProgress.hintsUsed
                )
              : null;
            const totalDailyScore =
              currentBoardScore +
              pointsEarned +
              (bonusBreakdown ? bonusBreakdown.totalBonus : 0);
            const nextProgress: DailyChallengeProgress = {
              ...dailyProgress,
              foundWords: newFoundWords,
              score: totalDailyScore,
              completed: isPuzzleDone,
              completedAtMs: isPuzzleDone ? Date.now() : undefined,
            };
            setDailyProgress(nextProgress);
            saveLocalDailyProgress(nextProgress);
            if (bonusBreakdown) {
              setDailyLastBonusBreakdown(bonusBreakdown);
            }
            void syncDailyCloudEntry(nextProgress, activePuzzleObj);

            showTemporaryMessage(
              isPuzzleDone
                ? `Daily Complete! +${pointsEarned + (bonusBreakdown?.totalBonus || 0)}`
                : `${ui.excellent} +${pointsEarned}`,
              "success",
              bilingualMode
                ? state.language === "en"
                  ? targetWord.meaningEn
                  : `${targetWord.translit} · ${targetWord.meaningEn}`
                : undefined
            );
            playSfx(isPuzzleDone ? "win" : "correct");

            void recordAnalyticsEvent({
              eventType: isPuzzleDone ? "level_complete" : "word_solved",
              word: targetWord.word,
              meaningEn: targetWord.meaningEn,
              points:
                pointsEarned + (bonusBreakdown ? bonusBreakdown.totalBonus : 0),
              newLangScore: state.score + pointsEarned,
              solvedMainWordNow: true,
              levelClearedNow: isPuzzleDone,
            });

            if (isPuzzleDone) {
              void addNotification(
                `Daily Challenge Completed (${activePack.nameEn})`,
                `Scored ${totalDailyScore} pts in ${formatElapsedTime(
                  nextProgress.elapsedSeconds
                )} on UTC ${dailyDateKey}.`,
                "progress"
              );
            }
          } else {
            const nextScore = currentBoardScore + pointsEarned;
            setState((prev) => ({
              ...prev,
              foundWords: newFoundWords,
              score: nextScore,
            }));
            showTemporaryMessage(
              `${ui.excellent} +${pointsEarned}`,
              "success",
              bilingualMode
                ? state.language === "en"
                  ? targetWord.meaningEn
                  : `${targetWord.translit} · ${targetWord.meaningEn}`
                : undefined
            );
            playSfx("correct");

            void recordAnalyticsEvent({
              eventType: isPuzzleDone ? "level_complete" : "word_solved",
              word: targetWord.word,
              meaningEn: targetWord.meaningEn,
              points: pointsEarned,
              newLangScore: nextScore,
              solvedMainWordNow: true,
              levelClearedNow: isPuzzleDone,
            });

            if (isPuzzleDone) {
              void addNotification(
                `Level ${state.level} Completed`,
                `Solved all ${activePuzzleObj.words.length} words in ${activePack.nameEn} (${activePuzzleObj.themeEn}).`,
                "progress"
              );
              window.setTimeout(() => {
                playSfx("win");
                if (state.level >= TOTAL_LEVELS) {
                  setState((prev) => ({ ...prev, gameWon: true }));
                } else {
                  setState((prev) => ({ ...prev, showLevelModal: true }));
                }
              }, 650);
            }
          }
        }
      } else {
        const bonusMatch = activePuzzleObj.bonusWords?.find(
          (bw) => normalizeWord(bw.word, state.language) === word
        );

        if (bonusMatch) {
          if (activeBonusList.includes(bonusMatch.word)) {
            showTemporaryMessage(
              ui.bonusAlreadyFound,
              "info",
              showEnglishSub ? "Bonus already found" : undefined
            );
            playSfx("error");
          } else {
            if (playMode === "daily") {
              const nextProgress: DailyChallengeProgress = {
                ...dailyProgress,
                foundBonusWords: [...activeBonusList, bonusMatch.word],
                score: currentBoardScore + 10,
              };
              setDailyProgress(nextProgress);
              saveLocalDailyProgress(nextProgress);
              void syncDailyCloudEntry(nextProgress, activePuzzleObj);
            } else {
              const nextScore = currentBoardScore + 10;
              setState((prev) => ({
                ...prev,
                foundBonusWords: [...activeBonusList, bonusMatch.word],
                score: nextScore,
              }));
            }
            showTemporaryMessage(
              ui.bonusFound,
              "bonus",
              bilingualMode
                ? state.language === "en"
                  ? bonusMatch.meaningEn
                  : `${bonusMatch.translit} · ${bonusMatch.meaningEn}`
                : undefined
            );
            playSfx("bonus");

            void recordAnalyticsEvent({
              eventType: "bonus_solved",
              word: bonusMatch.word,
              meaningEn: bonusMatch.meaningEn,
              points: 10,
              newLangScore: state.score + 10,
              bonusNow: true,
            });
          }
        } else {
          showTemporaryMessage(
            ui.notInPuzzle,
            "error",
            showEnglishSub ? "Not in puzzle" : undefined
          );
          playSfx("error");
        }
      }
      setCurrentGuess("");
    },
    [
      playMode,
      dailyDateKey,
      dailyCountdown,
      dailyProgress,
      state.currentPuzzle,
      state.language,
      state.foundWords,
      state.foundBonusWords,
      state.level,
      state.score,
      ui,
      bilingualMode,
      showEnglishSub,
      activePack.nameEn,
      playSfx,
      showTemporaryMessage,
      recordAnalyticsEvent,
      addNotification,
      syncDailyCloudEntry,
    ]
  );

  const resetGame = () => {
    playSfx("click");
    const firstPuzzle = activePack.puzzles[0];
    usedPuzzleIds.current = [firstPuzzle.id];
    activeFetch.current = null;
    setState((prev) => ({
      ...prev,
      level: 1,
      score: 30,
      foundWords: [],
      foundBonusWords: [],
      revealedCells: [],
      revealedClueWords: [],
      currentPuzzle: firstPuzzle,
      nextPuzzle: null,
      loading: false,
      message: "",
      gameWon: false,
      showLevelModal: false,
      isPrefetching: false,
    }));
    setCurrentGuess("");
  };

  const handleApplyHint = (tier: HintTier) => {
    const activePuzzleObj =
      playMode === "daily"
        ? getDailyChallengePuzzle(state.language, dailyDateKey)
        : state.currentPuzzle;
    if (!activePuzzleObj) return;
    if (playMode === "daily" && dailyProgress.completed) return;

    const activeFoundList =
      playMode === "daily" ? dailyProgress.foundWords : state.foundWords;
    const activeRevealedCells =
      playMode === "daily" ? dailyProgress.revealedCells : state.revealedCells;
    const activeRevealedClues =
      playMode === "daily"
        ? dailyProgress.revealedClueWords
        : state.revealedClueWords;
    const activeScore =
      playMode === "daily" ? dailyProgress.score : state.score;

    const unfound = activePuzzleObj.words.filter(
      (w) => !activeFoundList.includes(w.word)
    );
    if (unfound.length === 0) return;

    if (tier === "clue" && activeScore >= 10) {
      const candidate =
        unfound.find((w) => !activeRevealedClues.includes(w.word)) ||
        unfound[0];
      const nextScore = activeScore - 10;
      const nextClues = activeRevealedClues.includes(candidate.word)
        ? activeRevealedClues
        : [...activeRevealedClues, candidate.word];

      if (playMode === "daily") {
        const nextProg: DailyChallengeProgress = {
          ...dailyProgress,
          score: nextScore,
          hintsUsed: dailyProgress.hintsUsed + 1,
          revealedClueWords: nextClues,
        };
        setDailyProgress(nextProg);
        saveLocalDailyProgress(nextProg);
        void syncDailyCloudEntry(nextProg, activePuzzleObj);
      } else {
        setState((prev) => ({
          ...prev,
          score: nextScore,
          revealedClueWords: nextClues,
        }));
      }

      showTemporaryMessage(
        `Clue Unlocked (-10)`,
        "info",
        `${candidate.meaningEn}${candidate.pos ? ` (${candidate.pos})` : ""}`
      );
      playSfx("bonus");
      void recordAnalyticsEvent({
        eventType: "hint_used",
        word: candidate.word,
        meaningEn: `Clue: ${candidate.meaningEn}`,
        points: -10,
        newLangScore: playMode === "daily" ? state.score : nextScore,
        usedHintNow: true,
      });
      return;
    }

    if (tier === "letter" && activeScore >= 15) {
      const solvedCoordSet = new Set<string>();
      activePuzzleObj.words.forEach((pw) => {
        if (!activeFoundList.includes(pw.word)) return;
        const tokens = splitGraphemes(pw.word, state.language);
        tokens.forEach((_, i) => {
          const cx = pw.direction === "h" ? pw.x + i : pw.x;
          const cy = pw.direction === "v" ? pw.y + i : pw.y;
          solvedCoordSet.add(`${cx},${cy}`);
        });
      });
      activeRevealedCells.forEach((c) => solvedCoordSet.add(`${c.x},${c.y}`));

      const candidates: { x: number; y: number; token: string; word: string }[] = [];
      unfound.forEach((pw) => {
        const tokens = splitGraphemes(pw.word, state.language);
        tokens.forEach((tok, i) => {
          const cx = pw.direction === "h" ? pw.x + i : pw.x;
          const cy = pw.direction === "v" ? pw.y + i : pw.y;
          if (!solvedCoordSet.has(`${cx},${cy}`)) {
            candidates.push({ x: cx, y: cy, token: tok, word: pw.word });
          }
        });
      });

      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const nextScore = activeScore - 15;
        const nextCells = [
          ...activeRevealedCells,
          { x: pick.x, y: pick.y, token: pick.token },
        ];

        if (playMode === "daily") {
          const nextProg: DailyChallengeProgress = {
            ...dailyProgress,
            score: nextScore,
            hintsUsed: dailyProgress.hintsUsed + 1,
            revealedCells: nextCells,
          };
          setDailyProgress(nextProg);
          saveLocalDailyProgress(nextProg);
          void syncDailyCloudEntry(nextProg, activePuzzleObj);
        } else {
          setState((prev) => ({
            ...prev,
            score: nextScore,
            revealedCells: nextCells,
          }));
        }

        showTemporaryMessage(
          `Letter Revealed: ${pick.token}`,
          "info",
          "-15 pts"
        );
        playSfx("bonus");
        void recordAnalyticsEvent({
          eventType: "hint_used",
          word: pick.token,
          meaningEn: "Single letter grid hint",
          points: -15,
          newLangScore: playMode === "daily" ? state.score : nextScore,
          usedHintNow: true,
        });
      }
      return;
    }

    if (tier === "word" && activeScore >= 30) {
      const chosen = unfound[Math.floor(Math.random() * unfound.length)];
      const newFoundWords = [...activeFoundList, chosen.word];
      const nextScore = activeScore - 30;
      const isPuzzleDone = newFoundWords.length === activePuzzleObj.words.length;

      if (playMode === "daily") {
        const nextHintsUsed = dailyProgress.hintsUsed + 1;
        const bonusBreakdown = isPuzzleDone
          ? calculateDailyCompletionBonuses(
              dailyProgress.elapsedSeconds,
              nextHintsUsed
            )
          : null;
        const finalDailyScore =
          nextScore + (bonusBreakdown ? bonusBreakdown.totalBonus : 0);
        const nextProg: DailyChallengeProgress = {
          ...dailyProgress,
          foundWords: newFoundWords,
          score: finalDailyScore,
          hintsUsed: nextHintsUsed,
          completed: isPuzzleDone,
          completedAtMs: isPuzzleDone ? Date.now() : undefined,
        };
        setDailyProgress(nextProg);
        saveLocalDailyProgress(nextProg);
        if (bonusBreakdown) setDailyLastBonusBreakdown(bonusBreakdown);
        void syncDailyCloudEntry(nextProg, activePuzzleObj);
      } else {
        setState((prev) => ({
          ...prev,
          foundWords: newFoundWords,
          score: nextScore,
        }));
      }

      showTemporaryMessage(
        `${ui.hintApplied} ${chosen.word}`,
        "info",
        bilingualMode
          ? state.language === "en"
            ? chosen.meaningEn
            : `${chosen.translit} · ${chosen.meaningEn}`
          : undefined
      );
      playSfx(isPuzzleDone ? "win" : "bonus");

      void recordAnalyticsEvent({
        eventType: "hint_used",
        word: chosen.word,
        meaningEn: chosen.meaningEn,
        points: -30,
        newLangScore: playMode === "daily" ? state.score : nextScore,
        usedHintNow: true,
        levelClearedNow: isPuzzleDone,
      });

      if (isPuzzleDone && playMode !== "daily") {
        window.setTimeout(() => {
          playSfx("win");
          if (state.level >= TOTAL_LEVELS) {
            setState((prev) => ({ ...prev, gameWon: true }));
          } else {
            setState((prev) => ({ ...prev, showLevelModal: true }));
          }
        }, 700);
      }
    }
  };

  const openMeaningForWord = (word: string, lang: LanguageCode = state.language) => {
    const activePuzzleObj =
      playMode === "daily"
        ? getDailyChallengePuzzle(lang, dailyDateKey)
        : state.currentPuzzle;
    const detail = describeWordMeaning(word, lang, activePuzzleObj);
    if (detail) {
      playSfx("click");
      setInspectedMeaning(detail);
    }
  };

  const handleSaveVocab = async (detail: WordMeaningDetail, note: string) => {
    const vocabId = `${detail.language}_${detail.word}`
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 120);

    if (isCloudSynced && authUser) {
      await saveVocabToCloud(authUser.uid, vocabId, {
        language: detail.language,
        word: detail.word,
        translit: detail.translit,
        meaningEn: detail.meaningEn,
        pos: detail.pos,
        note,
      });
    } else {
      const nextList: VocabularyRecord[] = [
        {
          id: vocabId,
          uid: "guest",
          language: detail.language,
          word: detail.word,
          translit: detail.translit,
          meaningEn: detail.meaningEn,
          pos: detail.pos,
          note,
          createdAtMs: Date.now(),
        },
        ...localVocab.filter((v) => v.id !== vocabId),
      ];
      setLocalVocab(nextList);
      safeWriteJson("akhar_local_vocab", nextList);
    }

    // Check vocab achievement
    const newCount = effectiveVocab.some((v) => v.id === vocabId)
      ? effectiveVocab.length
      : effectiveVocab.length + 1;
    const vocabAch = ACHIEVEMENTS.find((a) => a.id === "vocab_keeper");
    if (vocabAch && newCount >= vocabAch.target) {
      const prevIds = isCloudSynced
        ? cloudProfile?.unlockedAchievementIds ?? []
        : localCounters.unlockedAchievementIds;
      if (!prevIds.includes(vocabAch.id)) {
        await recordAnalyticsEvent({
          eventType: "word_solved",
          word: detail.word,
          meaningEn: `Saved meaning: ${detail.meaningEn}`,
          points: 0,
          newLangScore: state.score,
          savedVocabCountOverride: newCount,
        });
      }
    }
  };

  const handleRemoveVocab = async (vocabId: string) => {
    if (isCloudSynced && authUser) {
      await deleteVocabFromCloud(authUser.uid, vocabId);
    } else {
      const next = localVocab.filter((v) => v.id !== vocabId);
      setLocalVocab(next);
      safeWriteJson("akhar_local_vocab", next);
    }
    setInspectedMeaning(null);
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (isCloudSynced && authUser) {
      await markNotificationReadInCloud(authUser.uid, id);
    } else {
      setLocalNotifs((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        safeWriteJson("akhar_local_notifs", next);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    const unread = effectiveNotifs.filter((n) => !n.read);
    if (isCloudSynced && authUser) {
      await Promise.all(
        unread.map((n) => markNotificationReadInCloud(authUser.uid, n.id))
      );
    } else {
      setLocalNotifs((prev) => {
        const next = prev.map((n) => ({ ...n, read: true }));
        safeWriteJson("akhar_local_notifs", next);
        return next;
      });
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (isCloudSynced && authUser) {
      await deleteNotificationInCloud(authUser.uid, id);
    } else {
      setLocalNotifs((prev) => {
        const next = prev.filter((n) => n.id !== id);
        safeWriteJson("akhar_local_notifs", next);
        return next;
      });
    }
  };

  // --- Personal Tasks, Notes, Subscriptions & Calendar Sync Handlers ---
  const handleSaveTask = async (
    task: Omit<PersonalTaskRecord, "uid" | "createdAtMs" | "updatedAtMs">
  ) => {
    if (isCloudSynced && authUser) {
      await saveTaskToCloud(authUser.uid, task);
    } else {
      const now = Date.now();
      setLocalTasks((prev) => {
        const existing = prev.find((t) => t.id === task.id);
        const record: PersonalTaskRecord = {
          ...task,
          uid: "guest",
          createdAtMs: existing?.createdAtMs ?? now,
          updatedAtMs: now,
        };
        const next = [record, ...prev.filter((t) => t.id !== task.id)].sort(
          (a, b) => Number(a.completed) - Number(b.completed) || b.createdAtMs - a.createdAtMs
        );
        safeWriteJson("akhar_local_tasks", next);
        return next;
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (isCloudSynced && authUser) {
      await deleteTaskFromCloud(authUser.uid, taskId);
    } else {
      setLocalTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId);
        safeWriteJson("akhar_local_tasks", next);
        return next;
      });
    }
  };

  const handleSaveNote = async (
    note: Omit<PersonalNoteRecord, "uid" | "createdAtMs" | "updatedAtMs">
  ) => {
    if (isCloudSynced && authUser) {
      await saveNoteToCloud(authUser.uid, note);
    } else {
      const now = Date.now();
      setLocalNotes((prev) => {
        const existing = prev.find((n) => n.id === note.id);
        const record: PersonalNoteRecord = {
          ...note,
          uid: "guest",
          createdAtMs: existing?.createdAtMs ?? now,
          updatedAtMs: now,
        };
        const next = [record, ...prev.filter((n) => n.id !== note.id)].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAtMs - a.updatedAtMs
        );
        safeWriteJson("akhar_local_notes", next);
        return next;
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (isCloudSynced && authUser) {
      await deleteNoteFromCloud(authUser.uid, noteId);
    } else {
      setLocalNotes((prev) => {
        const next = prev.filter((n) => n.id !== noteId);
        safeWriteJson("akhar_local_notes", next);
        return next;
      });
    }
  };

  const handleSelectPlan = async (
    tier: SubscriptionTier,
    status: SubscriptionStatus
  ) => {
    setLocalSubTier(tier);
    setLocalSubStatus(status);
    safeWriteJson("akhar_local_sub_tier", tier);
    safeWriteJson("akhar_local_sub_status", status);

    if (isCloudSynced && authUser) {
      await updateSubscriptionInCloud(authUser.uid, tier, status);
    }

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === tier);
    const label = plan ? `${plan.name} (${plan.priceLabel})` : tier;
    showTemporaryMessage(
      status === "paused" ? "Plan Paused" : "Plan Updated",
      "success",
      label
    );
    await addNotification(
      status === "paused" ? "Subscription Paused" : `Plan Active: ${label}`,
      status === "paused"
        ? `Your ${label} pass is paused. All free puzzles remain open.`
        : `Updated optional membership preference to ${label}.`,
      "reminder"
    );
  };

  const handleRefreshGoogleCalendar = async (tokenOverride?: string) => {
    const token = tokenOverride ?? googleToken;
    if (!token) return;
    setGoogleEventsLoading(true);
    setGoogleError("");
    try {
      const events = await fetchGoogleCalendarEvents(token);
      setGoogleEvents(events);
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : "Could not load Google Calendar events. Try reconnecting."
      );
    } finally {
      setGoogleEventsLoading(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setGoogleError("");
    try {
      const token = await connectGoogleCalendarPopup();
      setGoogleToken(token);
      await handleRefreshGoogleCalendar(token);
      showTemporaryMessage("Google Calendar Connected", "success");
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : "Google Calendar authorization failed."
      );
    }
  };

  const handlePushTaskToGoogleCalendar = async (task: PersonalTaskRecord) => {
    if (!googleToken) {
      setGoogleError("Connect Google Calendar first.");
      return;
    }
    setGoogleError("");
    try {
      const created = await createGoogleCalendarEvent(googleToken, {
        summary: `[EkOnKar] ${task.title}`,
        description:
          task.description ||
          `${task.kind} · ${task.category} (${task.priority} priority)`,
        startIso: task.dueAtIso,
        durationMinutes: task.durationMinutes,
      });
      await handleSaveTask({
        ...task,
        googleEventId: created.id,
      });
      await handleRefreshGoogleCalendar(googleToken);
      showTemporaryMessage("Scheduled on Google Calendar", "success", task.title);
      await addNotification(
        "Event Scheduled on Google Calendar",
        `Added "${task.title}" to your primary Google Calendar.`,
        "reminder"
      );
    } catch (err) {
      setGoogleError(
        err instanceof Error ? err.message : "Failed to schedule event."
      );
    }
  };

  const handleDeleteGoogleCalendarEvent = async (
    eventId: string,
    summary: string
  ) => {
    if (!googleToken) return;
    setGoogleError("");
    try {
      await deleteGoogleCalendarEvent(googleToken, eventId);
      setGoogleEvents((prev) => prev.filter((e) => e.id !== eventId));
      showTemporaryMessage("Removed Calendar Event", "info", summary);
    } catch (err) {
      setGoogleError(
        err instanceof Error ? err.message : "Failed to delete calendar event."
      );
    }
  };

  const isDailyMode = playMode === "daily";
  const dailyPuzzle = getDailyChallengePuzzle(state.language, dailyDateKey);
  const puzzle = isDailyMode ? dailyPuzzle : state.currentPuzzle;
  const activeFoundWords = isDailyMode
    ? dailyProgress.foundWords
    : state.foundWords;
  const activeFoundBonusWords = isDailyMode
    ? dailyProgress.foundBonusWords
    : state.foundBonusWords;
  const activeRevealedCells = isDailyMode
    ? dailyProgress.revealedCells
    : state.revealedCells;
  const activeRevealedClueWords = isDailyMode
    ? dailyProgress.revealedClueWords
    : state.revealedClueWords;
  const activeBoardScore = isDailyMode ? dailyProgress.score : state.score;
  const unreadNotifCount = effectiveNotifs.filter((n) => !n.read).length;

  const remainingWords = puzzle
    ? puzzle.words.filter((w) => !activeFoundWords.includes(w.word))
    : [];
  const hasUnrevealedClues = remainingWords.some(
    (w) => !activeRevealedClueWords.includes(w.word)
  );
  const hasUnrevealedLetters = (() => {
    if (!puzzle) return false;
    const totalNeededCells = new Set<string>();
    puzzle.words.forEach((pw) => {
      splitGraphemes(pw.word, state.language).forEach((_, i) => {
        const cx = pw.direction === "h" ? pw.x + i : pw.x;
        const cy = pw.direction === "v" ? pw.y + i : pw.y;
        totalNeededCells.add(`${cx},${cy}`);
      });
    });
    const revealedSet = new Set<string>();
    puzzle.words.forEach((pw) => {
      if (!activeFoundWords.includes(pw.word)) return;
      splitGraphemes(pw.word, state.language).forEach((_, i) => {
        const cx = pw.direction === "h" ? pw.x + i : pw.x;
        const cy = pw.direction === "v" ? pw.y + i : pw.y;
        revealedSet.add(`${cx},${cy}`);
      });
    });
    activeRevealedCells.forEach((c) => revealedSet.add(`${c.x},${c.y}`));
    return revealedSet.size < totalNeededCells.size;
  })();

  const matchedSavedVocab = inspectedMeaning
    ? effectiveVocab.find(
        (v) =>
          v.language === inspectedMeaning.language &&
          v.word === inspectedMeaning.word
      ) || null
    : null;

  const levelModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#14171F] border border-slate-700/80 rounded-2xl p-6 sm:p-8 max-w-[460px] w-full shadow-2xl flex flex-col gap-5 text-center">
        <div>
          <p className="text-xs font-medium text-amber-400">
            {ui.levelLabel} {state.level} · {ui.levelCompleteSub}
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mt-1">
            {ui.levelComplete}
          </h2>
          {showEnglishSub && (
            <p className="text-sm text-slate-400 mt-1">
              All {puzzle?.words.length} {activePack.nameEn} words solved
            </p>
          )}
        </div>

        {puzzle && (
          <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3.5 text-left space-y-1.5 max-h-[220px] overflow-y-auto">
            {puzzle.words.map((pw) => (
              <button
                key={pw.word}
                type="button"
                onClick={() => openMeaningForWord(pw.word)}
                className="w-full flex items-center justify-between gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-[#171B24] border-b border-slate-800/70 last:border-b-0 transition-colors text-left"
              >
                <span className="font-semibold text-amber-300 text-base">
                  {pw.word}
                </span>
                <span className="text-slate-300 text-xs sm:text-sm text-right">
                  {state.language === "en"
                    ? pw.meaningEn
                    : `${pw.translit} · ${pw.meaningEn}`}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              playSfx("click");
              loadLevel(state.level + 1);
            }}
            className="w-full py-3 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <span>
              {showEnglishSub ? `${ui.nextLevel} · Next Level` : ui.nextLevel}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                loadLevel(state.level, true);
              }}
              className="py-2.5 px-3 rounded-xl bg-[#1E222D] hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors whitespace-nowrap"
            >
              {ui.anotherPuzzle}
            </button>
            <button
              type="button"
              onClick={() => {
                const ach =
                  ACHIEVEMENTS.find((a) => a.id === "level_clear") ||
                  ACHIEVEMENTS[0];
                setShareTarget(ach);
              }}
              className="py-2.5 px-3 rounded-xl bg-[#1E222D] hover:bg-slate-700 text-amber-300 font-medium text-xs inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Milestone</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const winModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#14171F] border border-amber-500/40 rounded-2xl p-6 sm:p-8 max-w-[460px] w-full shadow-2xl flex flex-col gap-5 text-center">
        <div>
          <p className="text-xs font-medium text-amber-400">{ui.victoryTag}</p>
          <h2 className="text-3xl font-semibold text-white mt-1">
            {ui.victoryTitle}
          </h2>
          <p className="text-sm text-slate-300 mt-2 tabular-nums">
            {ui.totalScore} {state.score}
          </p>
        </div>

        {puzzle && (
          <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3.5 text-left space-y-1.5 max-h-[200px] overflow-y-auto">
            {puzzle.words.map((pw) => (
              <button
                key={pw.word}
                type="button"
                onClick={() => openMeaningForWord(pw.word)}
                className="w-full flex items-center justify-between gap-3 text-sm py-1.5 px-2 rounded-lg hover:bg-[#171B24] border-b border-slate-800/70 last:border-b-0 transition-colors text-left"
              >
                <span className="font-semibold text-amber-300 text-base">
                  {pw.word}
                </span>
                <span className="text-slate-300 text-xs sm:text-sm text-right">
                  {state.language === "en"
                    ? pw.meaningEn
                    : `${pw.translit} · ${pw.meaningEn}`}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              const ach =
                ACHIEVEMENTS.find((a) => a.id === "grand_champion") ||
                ACHIEVEMENTS[0];
              setShareTarget(ach);
            }}
            className="w-full py-2.5 px-5 rounded-xl bg-[#1E222D] hover:bg-slate-700 text-amber-300 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Victory Achievement</span>
          </button>

          <button
            type="button"
            onClick={resetGame}
            className="w-full py-3 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap"
          >
            {showEnglishSub ? `${ui.playAgain} · Play Again` : ui.playAgain}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100 flex flex-col">
      {state.showLevelModal && levelModal}
      {state.gameWon && winModal}

      {/* Top Bar: Clean 3-Zone Contract */}
      <header className="w-full border-b border-slate-800/80 bg-[#0F1218] px-4 sm:px-6 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveView("play")}
            className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left"
          >
            {ui.appName}
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {(
              [
                ["play", "Play"],
                ["dashboard", "Dashboard"],
                ["dictionary", "Meanings"],
                ["planner", "Planner"],
                ["plans", "Plans"],
              ] as const
            ).map(([viewKey, label]) => (
              <button
                key={viewKey}
                type="button"
                onClick={() => {
                  playSfx("click");
                  setActiveView(viewKey);
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeView === viewKey
                    ? "text-white border-amber-400"
                    : "text-slate-400 border-transparent hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Notifications + Primary Account Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setShowNotifications(true);
              }}
              aria-label={`Notifications (${unreadNotifCount} unread)`}
              className="relative w-9 h-9 rounded-lg bg-[#171A21] hover:bg-[#1E232F] border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playSfx("click");
                setActiveView("account");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>
                {authUser
                  ? cloudProfile?.displayName ||
                    authUser.displayName ||
                    "Account"
                  : "Sign In"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Strip */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-b border-slate-800/80 bg-[#0F1218] px-3 py-2 flex items-center justify-between gap-1 overflow-x-auto"
      >
        {(
          [
            ["play", "Play"],
            ["dashboard", "Dashboard"],
            ["dictionary", "Meanings"],
            ["planner", "Planner"],
            ["plans", "Plans"],
          ] as const
        ).map(([viewKey, label]) => (
          <button
            key={viewKey}
            type="button"
            onClick={() => setActiveView(viewKey)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeView === viewKey
                ? "bg-amber-400 text-slate-950 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Main View Switcher */}
      <div className="flex-1 flex flex-col">
        {activeView === "dashboard" ? (
          <DashboardView
            totalScore={effectiveTotalScore}
            wordsSolvedCount={effectiveWordsSolved}
            levelsCleared={effectiveLevelsCleared}
            bonusWordsCount={effectiveBonusCount}
            hintsUsed={effectiveHintsUsed}
            bestStreak={effectiveBestStreak}
            savedVocabCount={effectiveVocab.length}
            clearedLevel6={effectiveClearedLevel6}
            langStats={effectiveLangStats}
            sessions={effectiveSessions}
            isSignedIn={Boolean(authUser)}
            activeLanguage={state.language}
            dailyDateKey={dailyDateKey}
            dailyCountdown={dailyCountdown}
            dailyLeaderboardEntries={dailyLeaderboardEntries}
            localDailyProgress={dailyProgress}
            currentUserId={authUser?.uid || null}
            currentUserDisplayName={
              cloudProfile?.displayName || authUser?.displayName || "You"
            }
            currentUserHandle={cloudProfile?.handle || "player"}
            currentUserAvatarColor={cloudProfile?.avatarColor || "#F59E0B"}
            isCloudVerified={isCloudSynced}
            onSelectLanguageToPlay={(lang) => {
              handleLanguageChange(lang);
              setPlayMode("levels");
              setActiveView("play");
            }}
            onPlayDailyLanguage={handleOpenDailyForLanguage}
            onShareAchievement={(ach) => setShareTarget(ach)}
            onOpenAccount={() => setActiveView("account")}
          />
        ) : activeView === "dictionary" ? (
          <DictionaryView
            activeLanguage={state.language}
            savedVocabulary={effectiveVocab}
            onInspectWord={(detail) => setInspectedMeaning(detail)}
          />
        ) : activeView === "planner" ? (
          <PlannerView
            tasks={effectiveTasks}
            notes={effectiveNotes}
            activeLanguage={state.language}
            googleToken={googleToken}
            googleEvents={googleEvents}
            googleEventsLoading={googleEventsLoading}
            googleError={googleError}
            onSaveTask={handleSaveTask}
            onDeleteTask={handleDeleteTask}
            onSaveNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onConnectGoogleCalendar={handleConnectGoogleCalendar}
            onRefreshGoogleCalendar={() => handleRefreshGoogleCalendar()}
            onPushTaskToGoogleCalendar={handlePushTaskToGoogleCalendar}
            onDeleteGoogleCalendarEvent={handleDeleteGoogleCalendarEvent}
          />
        ) : activeView === "plans" ? (
          <SubscriptionPlansView
            currentTier={effectiveSubTier}
            currentStatus={effectiveSubStatus}
            isSignedIn={Boolean(authUser)}
            onSelectPlan={handleSelectPlan}
            onOpenAccount={() => setActiveView("account")}
          />
        ) : activeView === "account" ? (
          <AccountView
            authUser={authUser}
            profile={cloudProfile}
            security={cloudSecurity}
            activeLanguage={state.language}
            localSubscriptionTier={effectiveSubTier}
            onRefreshVerification={async () => {
              if (!authUser) return;
              await authUser.reload();
              const reloaded = auth.currentUser;
              setAuthUser(reloaded);
              setVerificationTick((t) => t + 1);
              if (isUserVerified(reloaded)) {
                await ensureUserDocuments(
                  reloaded!,
                  state.language,
                  state.score
                );
                showTemporaryMessage(
                  "Account Verified",
                  "success",
                  "Cloud sync activated"
                );
              } else {
                showTemporaryMessage(
                  "Still Pending",
                  "info",
                  "Check your email verification link or verify via SMS"
                );
              }
            }}
            onSecurityEventToast={(msg) =>
              showTemporaryMessage(msg, "success")
            }
            onOpenPlans={() => setActiveView("plans")}
          />
        ) : (
          <>
            {/* Play Workspace Toolbar (Mode + Level + Language + Bilingual + Utility Controls) */}
            <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  role="tablist"
                  aria-label="Game Mode"
                  className="flex items-center gap-1 bg-[#12151C] p-1 rounded-lg border border-slate-800"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!isDailyMode}
                    onClick={() => {
                      playSfx("click");
                      setPlayMode("levels");
                      setCurrentGuess("");
                      setUiMessage({ text: "", type: "info" });
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      !isDailyMode
                        ? "bg-amber-400 text-slate-950 font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Levels
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isDailyMode}
                    onClick={() => {
                      playSfx("click");
                      setPlayMode("daily");
                      setCurrentGuess("");
                      setUiMessage({ text: "", type: "info" });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isDailyMode
                        ? "bg-amber-400 text-slate-950 font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Daily Challenge</span>
                    {dailyProgress.completed && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                  </button>
                </div>

                {!isDailyMode ? (
                  <div
                    aria-label="Level selection"
                    className="flex items-center gap-1 bg-[#12151C] p-1 rounded-lg border border-slate-800"
                  >
                    {Array.from({ length: TOTAL_LEVELS }, (_, idx) => idx + 1).map(
                      (lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            playSfx("click");
                            loadLevel(lvl, true);
                          }}
                          className={`px-2.5 sm:px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                            state.level === lvl
                              ? "bg-amber-400 text-slate-950 font-semibold"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <span className="hidden sm:inline">{ui.levelLabel} </span>
                          {lvl}
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 bg-[#12151C] px-3 py-1.5 rounded-lg border border-slate-800 text-xs tabular-nums">
                    <span className="font-semibold text-amber-300">
                      UTC {dailyDateKey}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>{formatElapsedTime(dailyProgress.elapsedSeconds)}</span>
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-400">
                      Next in{" "}
                      <span className="text-slate-200 font-medium">
                        {dailyCountdown}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="relative inline-flex items-center">
                  <Globe className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 pointer-events-none" />
                  <select
                    aria-label="Select Language"
                    value={state.language}
                    onChange={(e) =>
                      handleLanguageChange(e.target.value as LanguageCode)
                    }
                    className="appearance-none bg-[#12151C] hover:bg-[#191E28] border border-slate-700/80 text-white text-xs font-medium rounded-lg pl-8 pr-7 py-2 cursor-pointer focus:outline-none focus:border-amber-400 transition-colors"
                  >
                    {LANGUAGE_LIST.map((pack) => (
                      <option
                        key={pack.code}
                        value={pack.code}
                        className="bg-[#14171F] text-white"
                      >
                        {pack.nameNative}
                        {pack.code !== "en" ? ` (${pack.nameEn})` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 text-[10px] text-slate-400">
                    ▾
                  </span>
                </label>

                <button
                  type="button"
                  onClick={toggleBilingualMode}
                  title="Toggle Bilingual / Definitions Mode"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                    bilingualMode
                      ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
                      : "bg-[#12151C] border-slate-800 text-slate-300 hover:text-white"
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>
                    {state.language === "en"
                      ? bilingualMode
                        ? "Defs ON"
                        : "Defs"
                      : bilingualMode
                      ? "+ EN"
                      : activePack.code.toUpperCase()}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
                  className="w-9 h-9 rounded-lg bg-[#12151C] border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSfx("click");
                    setShowHowToPlay(true);
                  }}
                  aria-label={ui.howToPlay}
                  className="w-9 h-9 rounded-lg bg-[#12151C] border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>

                {!isDailyMode && (
                  <button
                    type="button"
                    onClick={() => {
                      playSfx("click");
                      loadLevel(state.level, true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#181C26] hover:bg-slate-700 text-white border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{ui.newPuzzle}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Play Area */}
            <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col lg:flex-row items-stretch gap-6">
              {/* Left Column: Crossword Grid + Word List */}
              <section className="flex-1 flex flex-col gap-4 min-w-0">
                {puzzle && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        {isDailyMode && (
                          <span className="text-amber-400 font-semibold">
                            Daily Curated ·
                          </span>
                        )}
                        <span className="text-white font-medium">
                          {puzzle.themeLocal}
                        </span>
                        {showEnglishSub && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{puzzle.themeEn}</span>
                          </>
                        )}
                      </div>
                      <span className="tabular-nums text-slate-300">
                        {activeFoundWords.length} / {puzzle.words.length}{" "}
                        {ui.wordsCount}
                      </span>
                    </div>

                    <div className="flex-1 bg-[#12151C] border border-slate-800/80 rounded-2xl p-4 sm:p-6 flex items-center justify-center min-h-[240px] sm:min-h-[300px]">
                      <CrosswordGrid
                        puzzle={puzzle}
                        language={state.language}
                        foundWords={activeFoundWords}
                        revealedCells={activeRevealedCells}
                        onWordClick={(word) => openMeaningForWord(word)}
                      />
                    </div>

                    <div className="bg-[#12151C] border border-slate-800/80 rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h2 className="text-xs font-semibold text-slate-300">
                          {ui.wordsHeading}
                        </h2>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowHintPanel(true)}
                            disabled={
                              remainingWords.length === 0 ||
                              activeBoardScore < 10 ||
                              (isDailyMode && dailyProgress.completed)
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-40 transition-colors whitespace-nowrap"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Hints</span>
                          </button>

                          {bilingualMode && (
                            <button
                              type="button"
                              onClick={() => setShowMeaningClues((v) => !v)}
                              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
                            >
                              {showMeaningClues ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {showMeaningClues ? ui.hideClues : ui.showClues}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {puzzle.words.map((pw) => {
                          const isFound = activeFoundWords.includes(pw.word);
                          const isClueRevealed = activeRevealedClueWords.includes(
                            pw.word
                          );
                          const tokens = splitGraphemes(pw.word, state.language);
                          return (
                            <div
                              key={`${pw.word}-${pw.x}-${pw.y}`}
                              className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800/60 text-sm"
                            >
                              {isFound ? (
                                <button
                                  type="button"
                                  onClick={() => openMeaningForWord(pw.word)}
                                  className="inline-flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200 text-base text-left transition-colors"
                                  title="Describe word meaning"
                                >
                                  <span>{pw.word}</span>
                                  <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                </button>
                              ) : (
                                <span className="text-slate-500 tracking-wider text-xs tabular-nums">
                                  {tokens.map(() => "▢").join(" ")}{" "}
                                  <span className="text-slate-600 ml-1">
                                    ({tokens.length})
                                  </span>
                                </span>
                              )}

                              <span className="text-xs text-slate-400 text-right truncate">
                                {isFound
                                  ? bilingualMode
                                    ? state.language === "en"
                                      ? pw.meaningEn
                                      : `${pw.translit} · ${pw.meaningEn}`
                                    : ui.foundTag
                                  : isClueRevealed ||
                                    (bilingualMode && showMeaningClues)
                                  ? `${pw.meaningEn}${pw.pos ? ` (${pw.pos})` : ""}`
                                  : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {activeFoundBonusWords.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/60 text-xs text-slate-400 flex flex-wrap items-center gap-2">
                          <span className="text-emerald-400 font-medium">
                            {ui.bonusLabel}
                          </span>
                          {activeFoundBonusWords.map((bw, idx) => (
                            <React.Fragment key={bw}>
                              <button
                                type="button"
                                onClick={() => openMeaningForWord(bw)}
                                className="text-slate-200 hover:text-amber-300 underline decoration-slate-700 underline-offset-2 transition-colors"
                              >
                                {bw}
                              </button>
                              {idx < activeFoundBonusWords.length - 1 && (
                                <span aria-hidden="true">·</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>

              {/* Right Column: Active Guess + Word Wheel OR Daily Challenge Complete Summary */}
              <section className="lg:w-[420px] shrink-0 flex flex-col items-center justify-center bg-[#12151C] border border-slate-800/80 rounded-2xl p-5 sm:p-6 gap-5">
                {isDailyMode && dailyProgress.completed ? (
                  <div className="w-full flex flex-col gap-4 text-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        UTC {dailyDateKey} · Locked In
                      </p>
                      <h2 className="text-xl font-bold text-white mt-1">
                        {activePack.nameEn} Daily Complete
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        One entry per verified account per language each 24-hour UTC
                        window. Come back when the countdown resets.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3">
                        <p className="text-[11px] text-slate-400">
                          Final Daily Score
                        </p>
                        <p className="text-2xl font-bold text-amber-400 tabular-nums mt-0.5">
                          {dailyProgress.score}
                        </p>
                      </div>
                      <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3">
                        <p className="text-[11px] text-slate-400">Elapsed Time</p>
                        <p className="text-2xl font-bold text-white tabular-nums mt-0.5">
                          {formatElapsedTime(dailyProgress.elapsedSeconds)}
                        </p>
                      </div>
                    </div>

                    {dailyLastBonusBreakdown && (
                      <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5 tabular-nums">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Completion Bonus</span>
                          <span className="text-emerald-400 font-semibold">
                            +{dailyLastBonusBreakdown.completionBonus}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Speed Bonus</span>
                          <span className="text-sky-400 font-semibold">
                            +{dailyLastBonusBreakdown.speedBonus}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>
                            Hint-Free Bonus ({dailyProgress.hintsUsed} hints)
                          </span>
                          <span
                            className={
                              dailyLastBonusBreakdown.hintFreeBonus > 0
                                ? "text-amber-300 font-semibold"
                                : "text-slate-500"
                            }
                          >
                            +{dailyLastBonusBreakdown.hintFreeBonus}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-[#0E1117] border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Next Daily Puzzle</span>
                      <span className="font-mono font-semibold text-white tabular-nums">
                        {dailyCountdown}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setShareTarget({
                            id: `daily_${dailyDateKey}_${state.language}`,
                            title: `Daily Challenge · ${activePack.nameEn}`,
                            description: `Completed ${
                              dailyPuzzle.themeEn
                            } on UTC ${dailyDateKey} in ${formatElapsedTime(
                              dailyProgress.elapsedSeconds
                            )} with ${dailyProgress.score} pts.`,
                            metricLabel: "Daily Score",
                            target: dailyProgress.score,
                            category: "mastery",
                            accentHex: "#F59E0B",
                          })
                        }
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Daily Result</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playSfx("click");
                          setPlayMode("levels");
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1A1F2A] hover:bg-[#232938] border border-slate-700/80 text-slate-200 font-medium text-xs transition-colors"
                      >
                        Back to Practice Levels
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`w-full min-h-[60px] flex flex-col items-center justify-center rounded-xl px-4 py-2 border transition-colors ${
                        shakeGuess ? "animate-shake" : ""
                      } ${
                        currentGuess
                          ? "bg-[#1A1E29] border-amber-400/50"
                          : uiMessage.text
                          ? uiMessage.type === "success"
                            ? "bg-emerald-950/40 border-emerald-500/40"
                            : uiMessage.type === "bonus"
                            ? "bg-amber-950/40 border-amber-400/40"
                            : uiMessage.type === "error"
                            ? "bg-rose-950/40 border-rose-500/40"
                            : "bg-[#1A1E29] border-slate-700"
                          : "bg-[#0E1117] border-slate-800/80"
                      }`}
                    >
                      {currentGuess ? (
                        <span className="text-2xl sm:text-3xl font-semibold text-white tracking-wide">
                          {currentGuess}
                        </span>
                      ) : uiMessage.text ? (
                        <div className="flex flex-col items-center text-center">
                          <div className="flex items-center gap-1.5 text-sm sm:text-base font-medium">
                            {uiMessage.type === "success" && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            {uiMessage.type === "bonus" && (
                              <Award className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                            {uiMessage.type === "error" && (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span
                              className={
                                uiMessage.type === "success"
                                  ? "text-emerald-300"
                                  : uiMessage.type === "bonus"
                                  ? "text-amber-300"
                                  : uiMessage.type === "error"
                                  ? "text-rose-300"
                                  : "text-slate-200"
                              }
                            >
                              {uiMessage.text}
                            </span>
                          </div>
                          {uiMessage.subText && (
                            <span className="text-xs text-slate-400 mt-0.5">
                              {uiMessage.subText}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm text-slate-500 text-center">
                          {ui.dragOrTap}
                        </span>
                      )}
                    </div>

                    {puzzle && (
                      <WordWheel
                        letters={puzzle.letters}
                        language={state.language}
                        ui={ui}
                        bilingualMode={bilingualMode}
                        onWordSubmit={handleWordSubmit}
                        onCurrentWordChange={setCurrentGuess}
                        onInteraction={handleWheelInteraction}
                        onSelectSound={(step) => playSfx("select", step)}
                        onClickSound={() => playSfx("click")}
                      />
                    )}
                  </>
                )}
              </section>
            </main>

            {isDailyMode && (
              <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pb-6">
                <DailyLeaderboardPanel
                  dateKey={dailyDateKey}
                  activeLanguage={state.language}
                  entries={dailyLeaderboardEntries}
                  currentUserId={authUser?.uid || null}
                  currentUserDisplayName={
                    cloudProfile?.displayName || authUser?.displayName || "You"
                  }
                  currentUserHandle={cloudProfile?.handle || "player"}
                  currentUserAvatarColor={
                    cloudProfile?.avatarColor || "#F59E0B"
                  }
                  isCloudVerified={isCloudSynced}
                  localDailyProgress={dailyProgress}
                  onOpenAccount={() => setActiveView("account")}
                  onPlayDailyLanguage={handleOpenDailyForLanguage}
                />
              </div>
            )}

            <FooterLeftContent
              levelId={state.level}
              totalLevels={TOTAL_LEVELS}
              score={activeBoardScore}
              language={state.language}
              ui={ui}
              bilingualMode={bilingualMode}
              dailyLabel={isDailyMode ? `Daily · UTC ${dailyDateKey}` : undefined}
              button={() => setShowHintPanel(true)}
              buttonDisabled={
                activeBoardScore < 10 ||
                remainingWords.length === 0 ||
                (isDailyMode && dailyProgress.completed)
              }
              hasSolvedWord={
                activeFoundWords.length > 0 || activeFoundBonusWords.length > 0
              }
              onOpenLatestMeaning={() => {
                const latest =
                  activeFoundWords[activeFoundWords.length - 1] ||
                  activeFoundBonusWords[activeFoundBonusWords.length - 1];
                if (latest) openMeaningForWord(latest);
              }}
            />
          </>
        )}
      </div>

      {/* Achievement Unlocked Interactive Toast */}
      {unlockedToast && (
        <div className="fixed bottom-16 right-4 z-40 max-w-[340px] bg-[#161B26] border border-amber-400/50 rounded-xl p-4 shadow-2xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-300">
                Achievement Unlocked
              </p>
              <p className="text-sm font-semibold text-white">
                {unlockedToast.title}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShareTarget(unlockedToast);
                  setUnlockedToast(null);
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnlockedToast(null)}
            aria-label="Dismiss achievement toast"
            className="text-xs text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modals & Drawers */}
      <InfoDialog
        open={showHowToPlay}
        language={state.language}
        languageName={activePack.nameNative}
        ui={ui}
        bilingualMode={bilingualMode}
        onClose={() => setShowHowToPlay(false)}
      />

      <HintPanel
        open={showHintPanel}
        score={activeBoardScore}
        remainingWordsCount={remainingWords.length}
        hasUnrevealedLetters={hasUnrevealedLetters}
        hasUnrevealedClues={hasUnrevealedClues}
        onClose={() => setShowHintPanel(false)}
        onApplyHint={handleApplyHint}
      />

      <WordMeaningModal
        detail={inspectedMeaning}
        savedEntry={matchedSavedVocab}
        onClose={() => setInspectedMeaning(null)}
        onSaveVocab={handleSaveVocab}
        onRemoveVocab={handleRemoveVocab}
      />

      <ShareAchievementModal
        achievement={shareTarget}
        playerName={
          cloudProfile?.displayName || authUser?.displayName || "EkOnKar Player"
        }
        playerHandle={cloudProfile?.handle || "polyglot"}
        activeLanguage={state.language}
        totalScore={effectiveTotalScore}
        wordsSolvedCount={effectiveWordsSolved}
        onClose={() => setShareTarget(null)}
      />

      <NotificationsDrawer
        open={showNotifications}
        notifications={effectiveNotifs}
        onClose={() => setShowNotifications(false)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onOpenSettings={() => setActiveView("account")}
      />
    </div>
  );
};

export default App;
