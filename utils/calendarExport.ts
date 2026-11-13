/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PersonalTaskRecord } from "../types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsUtc(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(val: string): string {
  return val
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcsContent(tasks: PersonalTaskRecord[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EkOnKar//Multilingual Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  tasks.forEach((task) => {
    const start = task.dueAtIso ? new Date(task.dueAtIso) : new Date(Date.now() + 3600000);
    const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const end = new Date(validStart.getTime() + (task.durationMinutes || 30) * 60000);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@ekonkar.app`);
    lines.push(`DTSTAMP:${toIcsUtc(new Date())}`);
    lines.push(`DTSTART:${toIcsUtc(validStart)}`);
    lines.push(`DTEND:${toIcsUtc(end)}`);
    lines.push(`SUMMARY:${escapeIcsText(`[${task.kind.toUpperCase()}] ${task.title}`)}`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        task.description || `Category: ${task.category} · Priority: ${task.priority}`
      )}`
    );
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcsFile(tasks: PersonalTaskRecord[], filename: string) {
  const content = buildIcsContent(tasks);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getCalendarDeepLinks(task: PersonalTaskRecord) {
  const start = task.dueAtIso ? new Date(task.dueAtIso) : new Date(Date.now() + 3600000);
  const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
  const end = new Date(validStart.getTime() + (task.durationMinutes || 30) * 60000);

  const startCompact = toIcsUtc(validStart);
  const endCompact = toIcsUtc(end);
  const startIso = validStart.toISOString();
  const endIso = end.toISOString();

  const subject = encodeURIComponent(task.title);
  const body = encodeURIComponent(
    task.description || `EkOnKar ${task.kind} (${task.category})`
  );

  return {
    googleWeb: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${subject}&dates=${startCompact}/${endCompact}&details=${body}`,
    outlookLive: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&startdt=${encodeURIComponent(
      startIso
    )}&enddt=${encodeURIComponent(endIso)}&body=${body}`,
    office365: `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}&startdt=${encodeURIComponent(
      startIso
    )}&enddt=${encodeURIComponent(endIso)}&body=${body}`,
    yahoo: `https://calendar.yahoo.com/?v=60&title=${subject}&st=${startCompact}&et=${endCompact}&desc=${body}`,
  };
}
