/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { ConfirmationResult, RecaptchaVerifier, User } from "firebase/auth";
import {
  ShieldCheck,
  KeyRound,
  LogOut,
  MailCheck,
  AlertTriangle,
  User as UserIcon,
  Check,
  RefreshCw,
  BellRing,
  Lock,
  Smartphone,
  CreditCard,
} from "lucide-react";
import { LANGUAGE_LIST } from "../puzzles";
import { SUBSCRIPTION_PLANS } from "../data/subscriptionPlans";
import {
  LanguageCode,
  SubscriptionTier,
  UserPrivateSecurity,
  UserProfile,
} from "../types";
import {
  changeUserPassword,
  isUserVerified,
  registerWithEmail,
  resendVerificationEmail,
  sendResetPassword,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  startPhoneOtpFlow,
  updateSecurityPrefs,
  updateUserProfileFields,
  verifyPhoneOtpCode,
} from "../services/firebase";

interface AccountViewProps {
  authUser: User | null;
  profile: UserProfile | null;
  security: UserPrivateSecurity | null;
  activeLanguage: LanguageCode;
  localSubscriptionTier: SubscriptionTier;
  onRefreshVerification: () => Promise<void>;
  onSecurityEventToast: (msg: string) => void;
  onOpenPlans: () => void;
}

const AVATAR_SWATCHES = [
  "#F59E0B",
  "#10B981",
  "#38BDF8",
  "#818CF8",
  "#F43F5E",
  "#FB923C",
];

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  switch (code) {
    case "auth/operation-not-allowed":
      return "This sign-in method (Email/Password or Phone SMS) is not enabled yet in Firebase Console -> Authentication -> Sign-in method. Enable it there, or use Continue with Google.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Switch to Sign In instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid credentials. Please check your email/password and try again.";
    case "auth/weak-password":
      return "Password must be at least 6 characters long.";
    case "auth/invalid-phone-number":
      return "Enter a valid phone number in international format, e.g. +15551234567.";
    case "auth/invalid-verification-code":
      return "The 6-digit SMS verification code is incorrect. Please check and retry.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Please reload and try sending the SMS code again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in window was closed before completing login.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment before trying again.";
    default:
      return err instanceof Error ? err.message : "Authentication request failed.";
  }
}

const AccountView: React.FC<AccountViewProps> = ({
  authUser,
  profile,
  security,
  activeLanguage,
  localSubscriptionTier,
  onRefreshVerification,
  onSecurityEventToast,
  onOpenPlans,
}) => {
  const [authMode, setAuthMode] = useState<
    "signin" | "signup" | "phone" | "reset"
  >("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  // Phone OTP verification state (works both signed-out and signed-in!)
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phoneConfirmation, setPhoneConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneNotice, setPhoneNotice] = useState("");
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [preferredLang, setPreferredLang] =
    useState<LanguageCode>(activeLanguage);
  const [avatarColor, setAvatarColor] = useState("#F59E0B");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password update form state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdStatus, setPwdStatus] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [updatingPwd, setUpdatingPwd] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setHandle(profile.handle);
      setPreferredLang(profile.preferredLanguage);
      setAvatarColor(profile.avatarColor || "#F59E0B");
      setBio(profile.bio || "");
    }
  }, [profile]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    setAuthNotice("");
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      onSecurityEventToast("Signed in with Google");
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthLoading(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(email.trim(), password);
        onSecurityEventToast("Signed in to account");
      } else if (authMode === "signup") {
        await registerWithEmail(email.trim(), password, signupName);
        setAuthNotice(
          "Account created. A verification link has been sent to your email — verify to activate cloud sync."
        );
      } else if (authMode === "reset") {
        await sendResetPassword(email.trim());
        setAuthNotice(
          "Password reset instructions sent if an account matches that email."
        );
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendSmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    setPhoneNotice("");
    const cleaned = phoneInput.trim();
    if (!cleaned.startsWith("+") || cleaned.length < 8) {
      setPhoneError(
        "Use international E.164 format starting with '+', e.g. +15551234567."
      );
      return;
    }
    setPhoneLoading(true);
    try {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore
        }
      }
      const { confirmation, verifier } = await startPhoneOtpFlow(
        "phone-recaptcha-container",
        cleaned,
        authUser
      );
      recaptchaVerifierRef.current = verifier;
      setPhoneConfirmation(confirmation);
      setPhoneNotice(
        `Verification text sent to ${cleaned}. Enter the 6-digit code below.`
      );
    } catch (err) {
      setPhoneError(mapFirebaseAuthError(err));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifySmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirmation || !otpInput.trim()) return;
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await verifyPhoneOtpCode(phoneConfirmation, otpInput);
      setPhoneConfirmation(null);
      setOtpInput("");
      setPhoneNotice("Phone number verified via SMS!");
      await onRefreshVerification();
      onSecurityEventToast("Phone number verified");
    } catch (err) {
      setPhoneError(mapFirebaseAuthError(err));
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !isUserVerified(authUser)) return;
    setSavingProfile(true);
    try {
      await updateUserProfileFields(authUser.uid, {
        displayName,
        handle,
        preferredLanguage: preferredLang,
        avatarColor,
        bio,
      });
      setProfileSaved(true);
      onSecurityEventToast("Profile updated");
      window.setTimeout(() => setProfileSaved(false), 1800);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleSecPref = async (
    key:
      | "notifyAchievements"
      | "notifyReminders"
      | "notifySecurity"
      | "sessionLockEnabled"
  ) => {
    if (!authUser || !security || !isUserVerified(authUser)) return;
    const next = {
      notifyAchievements: security.notifyAchievements,
      notifyReminders: security.notifyReminders,
      notifySecurity: security.notifySecurity,
      sessionLockEnabled: security.sessionLockEnabled,
      [key]: !security[key],
    };
    await updateSecurityPrefs(authUser.uid, next);
    onSecurityEventToast("Security preferences saved");
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setPwdError("");
    setPwdStatus("");
    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }
    setUpdatingPwd(true);
    try {
      await changeUserPassword(authUser, currentPwd, newPwd);
      setCurrentPwd("");
      setNewPwd("");
      setPwdStatus("Password updated successfully.");
      onSecurityEventToast("Account password changed");
    } catch (err) {
      setPwdError(mapFirebaseAuthError(err));
    } finally {
      setUpdatingPwd(false);
    }
  };

  const activeTier = security?.subscriptionTier || localSubscriptionTier;
  const activePlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === activeTier) || SUBSCRIPTION_PLANS[0];

  if (!authUser) {
    return (
      <div className="w-full max-w-[980px] mx-auto px-4 sm:px-6 py-8">
        <div id="phone-recaptcha-container" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 bg-[#12151C] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Player Account, Verification & Security
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Sign in or create an account with Google, Email & Password, or SMS Phone Verification to sync progress, personal tasks, notes, and calendar schedules.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-300 border-t border-slate-800 pt-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Email verification & SMS text OTP verification supported.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Owner-isolated Firestore security rules protect your private tasks, notes, and security profile.
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#12151C] border border-slate-800 rounded-2xl p-6 space-y-5">
            {/* Official Google Sign-In Styled Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-800" />
              <span>or verify via email / phone text</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg">
              {(
                [
                  ["signin", "Sign In"],
                  ["signup", "Create Account"],
                  ["phone", "Phone Text"],
                  ["reset", "Reset Password"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setAuthMode(mode);
                    setAuthError("");
                    setAuthNotice("");
                    setPhoneError("");
                    setPhoneNotice("");
                  }}
                  className={`flex-1 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    authMode === mode
                      ? "bg-amber-400 text-slate-950 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {authMode === "phone" ? (
              <div className="space-y-3.5">
                {phoneError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{phoneError}</span>
                  </div>
                )}
                {phoneNotice && (
                  <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{phoneNotice}</span>
                  </div>
                )}

                {!phoneConfirmation ? (
                  <form onSubmit={handleSendSmsOtp} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Mobile Phone Number (E.164 format)
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="+15551234567"
                        className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={phoneLoading}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      {phoneLoading
                        ? "Sending SMS..."
                        : "Send SMS Verification Text"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifySmsOtp} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={8}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="123456"
                        className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white font-mono tracking-widest"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPhoneConfirmation(null)}
                        className="px-4 py-2.5 rounded-xl bg-[#1A1E29] text-xs text-slate-300"
                      >
                        Change Number
                      </button>
                      <button
                        type="submit"
                        disabled={phoneLoading}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        {phoneLoading ? "Verifying..." : "Verify Text Code"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <>
                {authError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {authNotice && (
                  <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                    <MailCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{authNotice}</span>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                  {authMode === "signup" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={60}
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="e.g. Gurpreet Singh"
                        className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white"
                    />
                  </div>

                  {authMode !== "reset" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {authLoading
                      ? "Please wait..."
                      : authMode === "signin"
                      ? "Sign In"
                      : authMode === "signup"
                      ? "Create Profile Account"
                      : "Send Reset Link"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasPasswordProvider = authUser.providerData.some(
    (p) => p.providerId === "password"
  );
  const verified = isUserVerified(authUser);

  return (
    <div className="w-full max-w-[1040px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div id="phone-recaptcha-container" />

      {/* Top Account Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12151C] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          {authUser.photoURL ? (
            <img
              src={authUser.photoURL}
              alt={profile?.displayName || authUser.displayName || "Profile"}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-slate-950 shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {(profile?.displayName || authUser.displayName || "P")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div>
            <h1 className="text-xl font-bold text-white">
              {profile?.displayName || authUser.displayName || "Scholar"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              @{profile?.handle || "player"} ·{" "}
              {authUser.email || authUser.phoneNumber} ·{" "}
              <span className={verified ? "text-emerald-400" : "text-amber-400"}>
                {verified ? "Verified Account" : "Verification Pending"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenPlans}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A1E29] hover:bg-slate-700 border border-slate-700 text-xs font-medium text-amber-300 transition-colors whitespace-nowrap"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>
              {activePlan.name} ({activePlan.priceLabel})
            </span>
          </button>

          <button
            type="button"
            onClick={() => signOutUser()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1E29] hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-xs font-medium text-slate-200 hover:text-rose-200 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Email & Phone Verification Center */}
      <div className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Verification */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MailCheck className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Email Verification
              </h2>
            </div>
            <span
              className={`text-xs font-medium ${
                authUser.emailVerified ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {authUser.emailVerified
                ? "Verified"
                : authUser.email
                ? "Pending"
                : "No Email Linked"}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {authUser.email
              ? `Address: ${authUser.email}`
              : "You signed in with a phone number."}
          </p>

          {authUser.email && !authUser.emailVerified && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await resendVerificationEmail(authUser);
                  onSecurityEventToast("Verification email sent");
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap"
              >
                Send Verification Email
              </button>
              <button
                type="button"
                onClick={onRefreshVerification}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>
          )}
        </div>

        {/* Phone SMS Verification */}
        <div className="space-y-3 md:border-l md:border-slate-800 md:pl-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">
                Phone SMS Verification
              </h2>
            </div>
            <span
              className={`text-xs font-medium ${
                authUser.phoneNumber ? "text-emerald-400" : "text-slate-400"
              }`}
            >
              {authUser.phoneNumber
                ? `Verified (${authUser.phoneNumber})`
                : "Not Linked"}
            </span>
          </div>

          {phoneError && (
            <p className="text-xs text-rose-400 leading-relaxed">{phoneError}</p>
          )}
          {phoneNotice && (
            <p className="text-xs text-emerald-400 leading-relaxed">
              {phoneNotice}
            </p>
          )}

          {!authUser.phoneNumber && !phoneConfirmation && (
            <form
              onSubmit={handleSendSmsOtp}
              className="flex items-center gap-2"
            >
              <input
                type="tel"
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+15551234567"
                className="flex-1 rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-1.5 text-xs text-white font-mono"
              />
              <button
                type="submit"
                disabled={phoneLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
              >
                {phoneLoading ? "Sending..." : "Send Text"}
              </button>
            </form>
          )}

          {phoneConfirmation && (
            <form
              onSubmit={handleVerifySmsOtp}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                required
                maxLength={8}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="6-digit OTP"
                className="flex-1 rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-1.5 text-xs text-white font-mono tracking-widest"
              />
              <button
                type="submit"
                disabled={phoneLoading}
                className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
              >
                {phoneLoading ? "Checking..." : "Verify Code"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <UserIcon className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-white">
              Profile Details
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Handle
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                pattern="^[a-zA-Z0-9_.\-]+$"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Preferred Language
              </label>
              <select
                value={preferredLang}
                onChange={(e) =>
                  setPreferredLang(e.target.value as LanguageCode)
                }
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white"
              >
                {LANGUAGE_LIST.map((pack) => (
                  <option key={pack.code} value={pack.code}>
                    {pack.nameNative} ({pack.nameEn})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-300 mb-2">
              Profile Accent Color
            </span>
            <div className="flex items-center gap-2.5">
              {AVATAR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Select color ${swatch}`}
                  onClick={() => setAvatarColor(swatch)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    avatarColor === swatch
                      ? "ring-2 ring-white scale-110"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Learning Bio
            </label>
            <textarea
              rows={2}
              maxLength={240}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm text-white resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile || !verified}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            {profileSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved Profile</span>
              </>
            ) : (
              <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
            )}
          </button>
        </form>

        {/* Security & Notification Options */}
        <div className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Security & Notification Controls
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-slate-800/70">
              <div>
                <p className="font-medium text-white">Login Provider</p>
                <p className="text-slate-400">
                  {authUser.providerData
                    .map((p) =>
                      p.providerId === "google.com"
                        ? "Google OAuth"
                        : p.providerId === "phone"
                        ? "Phone SMS"
                        : "Email & Password"
                    )
                    .join(", ")}
                </p>
              </div>
              <span className="text-emerald-400 font-medium">Active</span>
            </div>

            {security && (
              <>
                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">
                        Achievement Notifications
                      </p>
                      <p className="text-slate-400">
                        Alert when you unlock a new badge
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={security.notifyAchievements}
                    onChange={() => handleToggleSecPref("notifyAchievements")}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">
                        Security Login Alerts
                      </p>
                      <p className="text-slate-400">
                        Log sign-in and password events in notifications
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={security.notifySecurity}
                    onChange={() => handleToggleSecPref("notifySecurity")}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">
                        Privacy Session Shield
                      </p>
                      <p className="text-slate-400">
                        Keep private security settings strict owner-only
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={security.sessionLockEnabled}
                    onChange={() => handleToggleSecPref("sessionLockEnabled")}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>
              </>
            )}
          </div>

          {hasPasswordProvider && (
            <form
              onSubmit={handlePasswordChange}
              className="pt-3 border-t border-slate-800 space-y-3"
            >
              <p className="text-xs font-semibold text-white">
                Update Account Password
              </p>
              {pwdError && <p className="text-xs text-rose-400">{pwdError}</p>}
              {pwdStatus && (
                <p className="text-xs text-emerald-400">{pwdStatus}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  className="rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password (6+ chars)"
                  className="rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={updatingPwd}
                className="px-3.5 py-2 rounded-lg bg-[#1E232F] hover:bg-slate-700 text-xs font-medium text-white transition-colors"
              >
                {updatingPwd ? "Updating..." : "Change Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountView;
