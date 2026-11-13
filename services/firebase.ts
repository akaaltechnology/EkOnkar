/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  ConfirmationResult,
  signInWithPopup,
  reauthenticateWithPopup,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import {
  AppNotification,
  GoogleCalendarEvent,
  LanguageCode,
  LanguageStatRecord,
  NotificationCategory,
  PersonalNoteRecord,
  PersonalTaskRecord,
  PlayEventRecord,
  PlayEventType,
  SubscriptionStatus,
  SubscriptionTier,
  UserPrivateSecurity,
  UserProfile,
  VocabularyRecord,
} from "../types";

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as { firestoreDatabaseId?: string })
  .firestoreDatabaseId;
export const db = databaseId
  ? getFirestore(app, databaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));
googleProvider.setCustomParameters({ prompt: "select_account" });

// In-memory only Google Calendar OAuth access token (never stored in localStorage/sessionStorage)
let cachedGoogleAccessToken: string | null = null;

export function getGoogleCalendarToken(): string | null {
  return cachedGoogleAccessToken;
}

export function clearGoogleCalendarToken() {
  cachedGoogleAccessToken = null;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

const AVATAR_COLORS = [
  "#F59E0B",
  "#10B981",
  "#38BDF8",
  "#818CF8",
  "#F43F5E",
  "#FB923C",
];

function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24);
  return cleaned.length >= 2
    ? cleaned
    : `player_${Date.now().toString(36).slice(-4)}`;
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function toMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === "number") return val;
  return Date.now();
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedGoogleAccessToken = credential.accessToken;
  }
  return result;
}

export async function connectGoogleCalendarPopup(): Promise<string> {
  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, googleProvider)
    : await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error("Google Calendar permission token was not returned.");
  }
  cachedGoogleAccessToken = credential.accessToken;
  return credential.accessToken;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(cred.user, {
      displayName: displayName.trim().slice(0, 60),
    });
  }
  await sendEmailVerification(cred.user);
  return cred;
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function resendVerificationEmail(user: User) {
  await sendEmailVerification(user);
}

export async function sendResetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function changeUserPassword(
  user: User,
  currentPassword: string,
  newPassword: string
) {
  if (!user.email) {
    throw new Error("No email associated with this account.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function startPhoneOtpFlow(
  recaptchaContainerId: string,
  phoneNumberE164: string,
  currentUser: User | null
): Promise<{ confirmation: ConfirmationResult; verifier: RecaptchaVerifier }> {
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
    size: "invisible",
  });
  try {
    const confirmation = currentUser
      ? await linkWithPhoneNumber(currentUser, phoneNumberE164, verifier)
      : await signInWithPhoneNumber(auth, phoneNumberE164, verifier);
    return { confirmation, verifier };
  } catch (err) {
    try {
      verifier.clear();
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function verifyPhoneOtpCode(
  confirmation: ConfirmationResult,
  otpCode: string
) {
  return confirmation.confirm(otpCode.trim());
}

export async function signOutUser() {
  cachedGoogleAccessToken = null;
  await signOut(auth);
}

export function isUserVerified(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || user.phoneNumber);
}

export async function ensureUserDocuments(
  user: User,
  preferredLanguage: LanguageCode,
  initialTotalScore: number
): Promise<void> {
  if (!isUserVerified(user)) return;

  const userRef = doc(db, "users", user.uid);
  const secRef = doc(db, "users", user.uid, "private", "security");

  try {
    const snap = await getDoc(userRef);
    const email = (user.email || "").slice(0, 160);
    const phoneNumber = (user.phoneNumber || "").slice(0, 32);
    const phoneVerified = Boolean(user.phoneNumber);

    if (!snap.exists()) {
      const batch = writeBatch(db);
      const fallbackBase =
        email.split("@")[0] ||
        phoneNumber.replace(/\D/g, "").slice(-6) ||
        user.uid.slice(0, 8);
      const displayName = (user.displayName || fallbackBase || "Scholar").slice(
        0,
        60
      );
      const handle = sanitizeHandle(fallbackBase);
      const color =
        AVATAR_COLORS[user.uid.charCodeAt(0) % AVATAR_COLORS.length] || "#F59E0B";

      batch.set(userRef, {
        uid: user.uid,
        displayName,
        handle,
        preferredLanguage,
        avatarColor: color,
        photoUrl: (user.photoURL || "").slice(0, 500),
        bio: "Exploring world scripts and meanings.",
        totalScore: Math.max(0, Math.min(10000000, Math.floor(initialTotalScore))),
        wordsSolvedCount: 0,
        levelsCleared: 0,
        bonusWordsCount: 0,
        hintsUsed: 0,
        bestStreak: 0,
        unlockedAchievementIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(secRef, {
        uid: user.uid,
        email,
        emailVerified: Boolean(user.emailVerified),
        phoneNumber,
        phoneVerified,
        subscriptionTier: "free",
        subscriptionStatus: "active",
        notifyAchievements: true,
        notifyReminders: true,
        notifySecurity: true,
        sessionLockEnabled: false,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const welcomeNotifId = makeDocId("sec");
      const notifRef = doc(
        db,
        "users",
        user.uid,
        "notifications",
        welcomeNotifId
      );
      batch.set(notifRef, {
        uid: user.uid,
        title: "Account Connected",
        body: "Cloud profile sync, calendar scheduling, and security monitoring are active.",
        category: "security",
        read: false,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } else {
      const secSnap = await getDoc(secRef);
      if (secSnap.exists()) {
        await updateDoc(secRef, {
          email,
          emailVerified: Boolean(user.emailVerified),
          phoneNumber,
          phoneVerified,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(secRef, {
          uid: user.uid,
          email,
          emailVerified: Boolean(user.emailVerified),
          phoneNumber,
          phoneVerified,
          subscriptionTier: "free",
          subscriptionStatus: "active",
          notifyAchievements: true,
          notifyReminders: true,
          notifySecurity: true,
          sessionLockEnabled: false,
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: {
    displayName: string;
    handle: string;
    preferredLanguage: LanguageCode;
    avatarColor: string;
    bio: string;
  }
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      displayName: updates.displayName.trim().slice(0, 60) || "Player",
      handle: sanitizeHandle(updates.handle),
      preferredLanguage: updates.preferredLanguage,
      avatarColor: updates.avatarColor.slice(0, 24),
      bio: updates.bio.trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSecurityPrefs(
  uid: string,
  updates: {
    notifyAchievements: boolean;
    notifyReminders: boolean;
    notifySecurity: boolean;
    sessionLockEnabled: boolean;
  }
) {
  const path = `users/${uid}/private/security`;
  try {
    await updateDoc(doc(db, "users", uid, "private", "security"), {
      notifyAchievements: updates.notifyAchievements,
      notifyReminders: updates.notifyReminders,
      notifySecurity: updates.notifySecurity,
      sessionLockEnabled: updates.sessionLockEnabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSubscriptionInCloud(
  uid: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus
) {
  const path = `users/${uid}/private/security`;
  try {
    await updateDoc(doc(db, "users", uid, "private", "security"), {
      subscriptionTier: tier,
      subscriptionStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncGameplayToCloud(params: {
  uid: string;
  profileTotals: {
    totalScore: number;
    wordsSolvedCount: number;
    levelsCleared: number;
    bonusWordsCount: number;
    hintsUsed: number;
    bestStreak: number;
    unlockedAchievementIds: string[];
    preferredLanguage: LanguageCode;
  };
  langStat: {
    language: LanguageCode;
    score: number;
    wordsSolved: number;
    puzzlesCompleted: number;
    highestLevel: number;
    hintsUsed: number;
  };
  event?: {
    language: LanguageCode;
    level: number;
    puzzleId: string;
    word: string;
    meaningEn: string;
    points: number;
    eventType: PlayEventType;
  };
}) {
  const { uid, profileTotals, langStat, event } = params;
  const userRef = doc(db, "users", uid);
  const statRef = doc(db, "users", uid, "languageStats", langStat.language);

  try {
    const batch = writeBatch(db);
    batch.update(userRef, {
      totalScore: Math.max(0, Math.min(10000000, Math.floor(profileTotals.totalScore))),
      wordsSolvedCount: Math.max(0, Math.min(1000000, Math.floor(profileTotals.wordsSolvedCount))),
      levelsCleared: Math.max(0, Math.min(100000, Math.floor(profileTotals.levelsCleared))),
      bonusWordsCount: Math.max(0, Math.min(1000000, Math.floor(profileTotals.bonusWordsCount))),
      hintsUsed: Math.max(0, Math.min(1000000, Math.floor(profileTotals.hintsUsed))),
      bestStreak: Math.max(0, Math.min(10000, Math.floor(profileTotals.bestStreak))),
      unlockedAchievementIds: profileTotals.unlockedAchievementIds.slice(0, 30),
      preferredLanguage: profileTotals.preferredLanguage,
      updatedAt: serverTimestamp(),
    });

    batch.set(statRef, {
      uid,
      language: langStat.language,
      score: Math.max(0, Math.min(10000000, Math.floor(langStat.score))),
      wordsSolved: Math.max(0, Math.min(1000000, Math.floor(langStat.wordsSolved))),
      puzzlesCompleted: Math.max(0, Math.min(100000, Math.floor(langStat.puzzlesCompleted))),
      highestLevel: Math.max(1, Math.min(6, Math.floor(langStat.highestLevel))),
      hintsUsed: Math.max(0, Math.min(1000000, Math.floor(langStat.hintsUsed))),
      updatedAt: serverTimestamp(),
    });

    if (event) {
      const eventId = makeDocId("ev");
      const eventRef = doc(db, "users", uid, "sessions", eventId);
      batch.set(eventRef, {
        uid,
        language: event.language,
        level: Math.max(1, Math.min(6, Math.floor(event.level))),
        puzzleId: event.puzzleId.slice(0, 80),
        word: event.word.slice(0, 64),
        meaningEn: event.meaningEn.slice(0, 160),
        points: Math.max(-100, Math.min(1000, Math.floor(event.points))),
        eventType: event.eventType,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/sessions`);
  }
}

export async function saveVocabToCloud(
  uid: string,
  vocabId: string,
  entry: {
    language: LanguageCode;
    word: string;
    translit: string;
    meaningEn: string;
    pos: string;
    note: string;
  }
) {
  const safeId = vocabId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  const path = `users/${uid}/vocabulary/${safeId}`;
  const ref = doc(db, "users", uid, "vocabulary", safeId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        note: entry.note.slice(0, 300),
        meaningEn: entry.meaningEn.slice(0, 200),
        translit: entry.translit.slice(0, 80),
        pos: entry.pos.slice(0, 32),
      });
    } else {
      await setDoc(ref, {
        uid,
        language: entry.language,
        word: entry.word.slice(0, 64),
        translit: entry.translit.slice(0, 80),
        meaningEn: entry.meaningEn.slice(0, 200),
        pos: entry.pos.slice(0, 32),
        note: entry.note.slice(0, 300),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteVocabFromCloud(uid: string, vocabId: string) {
  const path = `users/${uid}/vocabulary/${vocabId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "vocabulary", vocabId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTaskToCloud(
  uid: string,
  task: Omit<PersonalTaskRecord, "uid" | "createdAtMs" | "updatedAtMs">
) {
  const safeId = task.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  const path = `users/${uid}/tasks/${safeId}`;
  const ref = doc(db, "users", uid, "tasks", safeId);
  try {
    const snap = await getDoc(ref);
    const payload = {
      title: task.title.trim().slice(0, 120),
      description: task.description.trim().slice(0, 400),
      kind: task.kind,
      priority: task.priority,
      category: task.category,
      completed: Boolean(task.completed),
      dueAtIso: task.dueAtIso.slice(0, 40),
      durationMinutes: Math.max(5, Math.min(480, Math.floor(task.durationMinutes))),
      language: task.language,
      googleEventId: task.googleEventId.slice(0, 128),
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTaskFromCloud(uid: string, taskId: string) {
  const path = `users/${uid}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "tasks", taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNoteToCloud(
  uid: string,
  note: Omit<PersonalNoteRecord, "uid" | "createdAtMs" | "updatedAtMs">
) {
  const safeId = note.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  const path = `users/${uid}/notes/${safeId}`;
  const ref = doc(db, "users", uid, "notes", safeId);
  try {
    const snap = await getDoc(ref);
    const payload = {
      title: note.title.trim().slice(0, 100),
      content: note.content.slice(0, 2000),
      tag: note.tag.trim().slice(0, 40),
      pinned: Boolean(note.pinned),
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteNoteFromCloud(uid: string, noteId: string) {
  const path = `users/${uid}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "notes", noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function pushNotificationToCloud(
  uid: string,
  notif: {
    title: string;
    body: string;
    category: NotificationCategory;
  }
) {
  const notifId = makeDocId("ntf");
  const path = `users/${uid}/notifications/${notifId}`;
  try {
    await setDoc(doc(db, "users", uid, "notifications", notifId), {
      uid,
      title: notif.title.slice(0, 100),
      body: notif.body.slice(0, 280),
      category: notif.category,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationReadInCloud(uid: string, notifId: string) {
  const path = `users/${uid}/notifications/${notifId}`;
  try {
    await updateDoc(doc(db, "users", uid, "notifications", notifId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotificationInCloud(uid: string, notifId: string) {
  const path = `users/${uid}/notifications/${notifId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "notifications", notifId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Google Calendar API Helpers (Client-side with Bearer access token) ---

export async function fetchGoogleCalendarEvents(
  accessToken: string
): Promise<GoogleCalendarEvent[]> {
  const timeMin = new Date(Date.now() - 86400000).toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=20&timeMin=${encodeURIComponent(
      timeMin
    )}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errBody}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };
  return (data.items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || "(Untitled Event)",
    description: ev.description,
    startIso: ev.start?.dateTime || ev.start?.date || "",
    endIso: ev.end?.dateTime || ev.end?.date || "",
    htmlLink: ev.htmlLink,
  }));
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: {
    summary: string;
    description: string;
    startIso: string;
    durationMinutes: number;
  }
): Promise<GoogleCalendarEvent> {
  const start = input.startIso ? new Date(input.startIso) : new Date(Date.now() + 3600000);
  const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const end = new Date(validStart.getTime() + (input.durationMinutes || 30) * 60000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: validStart.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to schedule event (${res.status}): ${errBody}`);
  }
  const ev = (await res.json()) as {
    id: string;
    summary?: string;
    description?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };
  return {
    id: ev.id,
    summary: ev.summary || input.summary,
    description: ev.description,
    startIso: ev.start?.dateTime || validStart.toISOString(),
    endIso: ev.end?.dateTime || end.toISOString(),
    htmlLink: ev.htmlLink,
  };
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      eventId
    )}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    const errBody = await res.text();
    throw new Error(`Failed to delete event (${res.status}): ${errBody}`);
  }
}

export function subscribeUserData(
  uid: string,
  callbacks: {
    onProfile: (profile: UserProfile | null) => void;
    onSecurity: (sec: UserPrivateSecurity | null) => void;
    onLangStats: (stats: Partial<Record<LanguageCode, LanguageStatRecord>>) => void;
    onSessions: (events: PlayEventRecord[]) => void;
    onVocabulary: (entries: VocabularyRecord[]) => void;
    onNotifications: (items: AppNotification[]) => void;
    onTasks: (tasks: PersonalTaskRecord[]) => void;
    onNotes: (notes: PersonalNoteRecord[]) => void;
  }
): () => void {
  const unsubProfile = onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      callbacks.onProfile(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
  );

  const unsubSecurity = onSnapshot(
    doc(db, "users", uid, "private", "security"),
    (snap) => {
      callbacks.onSecurity(
        snap.exists() ? (snap.data() as UserPrivateSecurity) : null
      );
    },
    (err) =>
      handleFirestoreError(err, OperationType.GET, `users/${uid}/private/security`)
  );

  const statsQuery = query(
    collection(db, "users", uid, "languageStats"),
    where("uid", "==", uid)
  );
  const unsubStats = onSnapshot(
    statsQuery,
    (snap) => {
      const map: Partial<Record<LanguageCode, LanguageStatRecord>> = {};
      snap.forEach((d) => {
        const data = d.data() as LanguageStatRecord;
        map[data.language] = data;
      });
      callbacks.onLangStats(map);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/languageStats`)
  );

  const sessionsQuery = query(
    collection(db, "users", uid, "sessions"),
    where("uid", "==", uid),
    limit(100)
  );
  const unsubSessions = onSnapshot(
    sessionsQuery,
    (snap) => {
      const list: PlayEventRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            language: data.language,
            level: data.level,
            puzzleId: data.puzzleId,
            word: data.word,
            meaningEn: data.meaningEn,
            points: data.points,
            eventType: data.eventType,
            createdAtMs: toMs(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onSessions(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/sessions`)
  );

  const vocabQuery = query(
    collection(db, "users", uid, "vocabulary"),
    where("uid", "==", uid),
    limit(100)
  );
  const unsubVocab = onSnapshot(
    vocabQuery,
    (snap) => {
      const list: VocabularyRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            language: data.language,
            word: data.word,
            translit: data.translit,
            meaningEn: data.meaningEn,
            pos: data.pos,
            note: data.note,
            createdAtMs: toMs(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onVocabulary(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/vocabulary`)
  );

  const notifQuery = query(
    collection(db, "users", uid, "notifications"),
    where("uid", "==", uid),
    limit(50)
  );
  const unsubNotifs = onSnapshot(
    notifQuery,
    (snap) => {
      const list: AppNotification[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            title: data.title,
            body: data.body,
            category: data.category,
            read: Boolean(data.read),
            createdAtMs: toMs(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      callbacks.onNotifications(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/notifications`)
  );

  const tasksQuery = query(
    collection(db, "users", uid, "tasks"),
    where("uid", "==", uid),
    limit(100)
  );
  const unsubTasks = onSnapshot(
    tasksQuery,
    (snap) => {
      const list: PersonalTaskRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            title: data.title,
            description: data.description || "",
            kind: data.kind,
            priority: data.priority,
            category: data.category,
            completed: Boolean(data.completed),
            dueAtIso: data.dueAtIso || "",
            durationMinutes: data.durationMinutes || 30,
            language: data.language || "all",
            googleEventId: data.googleEventId || "",
            createdAtMs: toMs(data.createdAt),
            updatedAtMs: toMs(data.updatedAt),
          };
        })
        .sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAtMs - a.createdAtMs);
      callbacks.onTasks(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/tasks`)
  );

  const notesQuery = query(
    collection(db, "users", uid, "notes"),
    where("uid", "==", uid),
    limit(100)
  );
  const unsubNotes = onSnapshot(
    notesQuery,
    (snap) => {
      const list: PersonalNoteRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: data.uid,
            title: data.title,
            content: data.content || "",
            tag: data.tag || "",
            pinned: Boolean(data.pinned),
            createdAtMs: toMs(data.createdAt),
            updatedAtMs: toMs(data.updatedAt),
          };
        })
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAtMs - a.updatedAtMs);
      callbacks.onNotes(list);
    },
    (err) =>
      handleFirestoreError(err, OperationType.LIST, `users/${uid}/notes`)
  );

  return () => {
    unsubProfile();
    unsubSecurity();
    unsubStats();
    unsubSessions();
    unsubVocab();
    unsubNotifs();
    unsubTasks();
    unsubNotes();
  };
}
