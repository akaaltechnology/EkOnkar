/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubscriptionPlanDef } from "../types";

export const SUBSCRIPTION_PLANS: SubscriptionPlanDef[] = [
  {
    id: "free",
    name: "Explorer",
    audience: "For casual daily players",
    pricePerDayUsd: 0,
    priceLabel: "$0 / day",
    tagline: "Core multilingual puzzle play and personal study starter tools, free forever.",
    highlights: [
      "All 11 world languages & 72 curated crossword levels",
      "Standard 3-tier Hint Studio using earned puzzle points",
      "Up to 15 saved vocabulary meaning bookmarks",
      "Personal tasks, goals, notes & .ics calendar file export",
    ],
    limits: {
      languages: "All 11 packs (72 puzzles)",
      hintAccess: "Earned points (-10 / -15 / -30)",
      vocabularyBank: "Up to 15 saved notes",
      tasksAndNotes: "Up to 25 active items",
      calendarSync: "Universal .ICS export & web links",
      analyticsExport: "In-app 7-day & 14-day view",
    },
  },
  {
    id: "daily_1",
    name: "Daily Scholar",
    audience: "For consistent daily learners",
    pricePerDayUsd: 1,
    priceLabel: "$1 / day",
    tagline: "Unlocks cloud vocabulary freedom, Google Calendar scheduling, and extended study streaks.",
    highlights: [
      "Unlimited personal vocabulary bookmarks & study notes",
      "Direct Google Calendar event creation & agenda sync",
      "Unlimited personal tasks, goal milestones & pinned notes",
      "Full 30-day & lifetime activity analytics + PNG share cards",
    ],
    limits: {
      languages: "All 11 packs + priority updates",
      hintAccess: "Reduced-cost clue previews",
      vocabularyBank: "Unlimited saved meanings",
      tasksAndNotes: "Unlimited tasks, goals & notes",
      calendarSync: "Live Google Calendar API + .ICS",
      analyticsExport: "Full history & social PNG cards",
    },
  },
  {
    id: "studio_3",
    name: "Polyglot Studio",
    audience: "For power planners & multi-calendar sync",
    pricePerDayUsd: 3,
    priceLabel: "$3 / day",
    tagline: "Complete cross-calendar orchestration across Google, Microsoft Outlook, and Apple Calendars plus CSV data exports.",
    highlights: [
      "Everything in Daily Scholar included automatically",
      "Multi-provider schedule links for Google, Outlook, Office 365 & Apple",
      "Recurring study cadence templates & batch .ICS calendar bundle",
      "Export solved vocabulary & analytics logs as CSV or Markdown",
    ],
    limits: {
      languages: "All 11 packs + early pack previews",
      hintAccess: "Priority unlimited study hints",
      vocabularyBank: "Unlimited + CSV/Markdown export",
      tasksAndNotes: "Unlimited + recurring templates",
      calendarSync: "Google + Outlook + Apple batch .ICS",
      analyticsExport: "Full CSV ledger & PNG cards",
    },
  },
];
