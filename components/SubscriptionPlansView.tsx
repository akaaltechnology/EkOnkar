/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Check, PauseCircle, PlayCircle, ArrowRight } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "../data/subscriptionPlans";
import {
  SubscriptionPlanDef,
  SubscriptionStatus,
  SubscriptionTier,
} from "../types";

interface SubscriptionPlansViewProps {
  currentTier: SubscriptionTier;
  currentStatus: SubscriptionStatus;
  isSignedIn: boolean;
  onSelectPlan: (
    tier: SubscriptionTier,
    status: SubscriptionStatus
  ) => Promise<void>;
  onOpenAccount: () => void;
}

const SubscriptionPlansView: React.FC<SubscriptionPlansViewProps> = ({
  currentTier,
  currentStatus,
  isSignedIn,
  onSelectPlan,
  onOpenAccount,
}) => {
  const [previewDays, setPreviewDays] = useState<1 | 7 | 30>(7);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<SubscriptionPlanDef | null>(
    null
  );

  const activePlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === currentTier) ||
    SUBSCRIPTION_PLANS[0];

  const handleConfirmSwitch = async () => {
    if (!confirmPlan) return;
    setPendingTier(confirmPlan.id);
    try {
      await onSelectPlan(confirmPlan.id, "active");
      setConfirmPlan(null);
    } finally {
      setPendingTier(null);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header & Billing Cadence Preview */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Optional Membership Plans
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Every puzzle and language remains playable on the free Explorer plan. Choose an optional daily pass whenever you want live calendar sync, unlimited vocabulary notes, or data exports.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#12151C] border border-slate-800 rounded-lg self-start md:self-auto">
          {([1, 7, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPreviewDays(days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                previewDays === days
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {days === 1 ? "1 Day" : days === 7 ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Active Plan Banner */}
      <div className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">
            Current Active Plan ·{" "}
            <span
              className={
                currentStatus === "active"
                  ? "text-emerald-400 font-medium"
                  : "text-amber-400 font-medium"
              }
            >
              {currentStatus === "active"
                ? "Active"
                : currentStatus === "paused"
                ? "Paused"
                : "Cancelled"}
            </span>
          </p>
          <p className="text-lg font-bold text-white mt-0.5">
            {activePlan.name} ({activePlan.priceLabel})
          </p>
          {!isSignedIn && (
            <p className="text-xs text-slate-400 mt-1">
              Sign in to sync your optional plan preference across devices.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentTier !== "free" && (
            <button
              type="button"
              onClick={() =>
                onSelectPlan(
                  currentTier,
                  currentStatus === "paused" ? "active" : "paused"
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1A1E29] hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
            >
              {currentStatus === "paused" ? (
                <>
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Resume Pass</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause Pass</span>
                </>
              )}
            </button>
          )}

          {!isSignedIn && (
            <button
              type="button"
              onClick={onOpenAccount}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <span>Sign In / Verify</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id;
          const totalEstimate = plan.pricePerDayUsd * previewDays;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 border flex flex-col justify-between gap-6 ${
                plan.id === "daily_1"
                  ? "bg-[#161B26] border-amber-400/50"
                  : "bg-[#12151C] border-slate-800"
              }`}
            >
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-amber-400">
                    {plan.audience}
                  </p>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                    <span className="text-xs text-slate-400 tabular-nums font-mono">
                      Est. ${totalEstimate} / {previewDays}d
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-white font-mono tabular-nums">
                      ${plan.pricePerDayUsd}
                    </span>
                    <span className="text-sm text-slate-400">/ day</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {plan.tagline}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-slate-800/80 text-xs text-slate-300">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isCurrent && currentStatus === "active"}
                onClick={() => setConfirmPlan(plan)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  isCurrent && currentStatus === "active"
                    ? "bg-[#1D2330] text-emerald-300 border border-emerald-500/30 cursor-default"
                    : plan.id === "daily_1"
                    ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                    : "bg-[#1E232F] hover:bg-slate-700 text-white border border-slate-700"
                }`}
              >
                {isCurrent && currentStatus === "active"
                  ? "Current Active Plan"
                  : plan.pricePerDayUsd === 0
                  ? "Switch to Free Explorer"
                  : `Choose ${plan.name} ($${plan.pricePerDayUsd}/day)`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Concrete Comparison Matrix */}
      <section className="bg-[#12151C] border border-slate-800 rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-base font-semibold text-white mb-4">
          Plan Allowances & Limits
        </h2>
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2.5 pr-4 font-medium">Capability</th>
              <th className="py-2.5 pr-4 font-medium">Explorer ($0/day)</th>
              <th className="py-2.5 pr-4 font-medium">Daily Scholar ($1/day)</th>
              <th className="py-2.5 font-medium">Polyglot Studio ($3/day)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-300">
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Language Packs</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.languages}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.languages}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.languages}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Hint Studio</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.hintAccess}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.hintAccess}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.hintAccess}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Vocabulary Bank</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.vocabularyBank}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.vocabularyBank}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.vocabularyBank}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Tasks, Goals & Notes</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.tasksAndNotes}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.tasksAndNotes}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.tasksAndNotes}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Calendar Integration</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.calendarSync}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.calendarSync}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.calendarSync}</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium text-white">Data & Analytics</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[0].limits.analyticsExport}</td>
              <td className="py-3 pr-4">{SUBSCRIPTION_PLANS[1].limits.analyticsExport}</td>
              <td className="py-3">{SUBSCRIPTION_PLANS[2].limits.analyticsExport}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Confirmation Dialog */}
      {confirmPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setConfirmPlan(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12151C] border border-slate-700/80 rounded-2xl max-w-[440px] w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white">
              Confirm Plan Selection: {confirmPlan.name}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {confirmPlan.pricePerDayUsd === 0
                ? "Switch back to the free Explorer plan ($0/day). You keep full access to all 11 languages and local progress."
                : `Activate the optional ${confirmPlan.name} pass at ${confirmPlan.priceLabel} (preview mode — no card charge is processed). You can pause or return to Free anytime.`}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPlan(null)}
                className="px-4 py-2 rounded-lg bg-[#1A1E29] hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pendingTier === confirmPlan.id}
                onClick={handleConfirmSwitch}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {pendingTier === confirmPlan.id ? "Updating..." : "Confirm Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansView;
