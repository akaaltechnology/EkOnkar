/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import {
  CheckSquare,
  Square,
  Target,
  StickyNote,
  Calendar,
  Plus,
  Trash2,
  Pin,
  Download,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { LANGUAGE_LIST } from "../puzzles";
import {
  GoogleCalendarEvent,
  LanguageCode,
  PersonalNoteRecord,
  PersonalTaskRecord,
  TaskCategory,
  TaskKind,
  TaskPriority,
} from "../types";
import { downloadIcsFile, getCalendarDeepLinks } from "../utils/calendarExport";

interface PlannerViewProps {
  tasks: PersonalTaskRecord[];
  notes: PersonalNoteRecord[];
  activeLanguage: LanguageCode;
  googleToken: string | null;
  googleEvents: GoogleCalendarEvent[];
  googleEventsLoading: boolean;
  googleError: string;
  onSaveTask: (
    task: Omit<PersonalTaskRecord, "uid" | "createdAtMs" | "updatedAtMs">
  ) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSaveNote: (
    note: Omit<PersonalNoteRecord, "uid" | "createdAtMs" | "updatedAtMs">
  ) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onConnectGoogleCalendar: () => Promise<void>;
  onRefreshGoogleCalendar: () => Promise<void>;
  onPushTaskToGoogleCalendar: (task: PersonalTaskRecord) => Promise<void>;
  onDeleteGoogleCalendarEvent: (eventId: string, summary: string) => Promise<void>;
}

type PendingGoogleAction =
  | { type: "create"; task: PersonalTaskRecord }
  | { type: "delete"; eventId: string; summary: string };

function defaultDueLocalValue(): string {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const PlannerView: React.FC<PlannerViewProps> = ({
  tasks,
  notes,
  activeLanguage,
  googleToken,
  googleEvents,
  googleEventsLoading,
  googleError,
  onSaveTask,
  onDeleteTask,
  onSaveNote,
  onDeleteNote,
  onConnectGoogleCalendar,
  onRefreshGoogleCalendar,
  onPushTaskToGoogleCalendar,
  onDeleteGoogleCalendarEvent,
}) => {
  const [sectionTab, setSectionTab] = useState<"tasks" | "notes" | "calendar">(
    "tasks"
  );

  // Task/Goal Form State
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskKind, setTaskKind] = useState<TaskKind>("task");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskCategory, setTaskCategory] = useState<TaskCategory>("study");
  const [taskLang, setTaskLang] = useState<LanguageCode | "all">(activeLanguage);
  const [taskDue, setTaskDue] = useState(defaultDueLocalValue);
  const [taskDuration, setTaskDuration] = useState(30);
  const [savingTask, setSavingTask] = useState(false);

  // Note Form State
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTag, setNoteTag] = useState("Study Note");
  const [noteSearch, setNoteSearch] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Mandatory confirmation dialog for Google Calendar write/delete operations
  const [pendingGoogleAction, setPendingGoogleAction] =
    useState<PendingGoogleAction | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const openCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
  );
  const goalsDone = useMemo(
    () => tasks.filter((t) => t.kind === "goal" && t.completed).length,
    [tasks]
  );
  const goalsTotal = useMemo(
    () => tasks.filter((t) => t.kind === "goal").length,
    [tasks]
  );

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tag.toLowerCase().includes(q)
    );
  }, [notes, noteSearch]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      const iso = taskDue ? new Date(taskDue).toISOString() : "";
      await onSaveTask({
        id: `tsk_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        kind: taskKind,
        priority: taskPriority,
        category: taskCategory,
        completed: false,
        dueAtIso: iso,
        durationMinutes: taskDuration,
        language: taskLang,
        googleEventId: "",
      });
      setTaskTitle("");
      setTaskDesc("");
    } finally {
      setSavingTask(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await onSaveNote({
        id: `nte_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        tag: noteTag.trim() || "Personal",
        pinned: false,
      });
      setNoteTitle("");
      setNoteContent("");
    } finally {
      setSavingNote(false);
    }
  };

  const executeConfirmedGoogleAction = async () => {
    if (!pendingGoogleAction) return;
    setGoogleBusy(true);
    try {
      if (pendingGoogleAction.type === "create") {
        await onPushTaskToGoogleCalendar(pendingGoogleAction.task);
      } else {
        await onDeleteGoogleCalendarEvent(
          pendingGoogleAction.eventId,
          pendingGoogleAction.summary
        );
      }
      setPendingGoogleAction(null);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Section Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Tasks, Goals, Notes & Calendar Schedule
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organize study goals and personal notes, then schedule directly on Google Calendar, Microsoft Outlook, or Apple/ICS calendars.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#12151C] border border-slate-800 rounded-lg self-start md:self-auto">
          {(
            [
              ["tasks", `Tasks & Goals (${openCount})`],
              ["notes", `Notes (${notes.length})`],
              ["calendar", "Calendar Sync"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSectionTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                sectionTab === key
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Open Tasks & Goals</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono tabular-nums">
            {openCount}
          </p>
        </div>
        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Goals Completed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono tabular-nums">
            {goalsDone} / {goalsTotal}
          </p>
        </div>
        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Personal Notes</p>
          <p className="text-2xl font-bold text-amber-300 mt-1 font-mono tabular-nums">
            {notes.length}
          </p>
        </div>
        <div className="bg-[#12151C] border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400">Google Calendar</p>
          <p
            className={`text-sm font-semibold mt-2 ${
              googleToken ? "text-emerald-400" : "text-slate-300"
            }`}
          >
            {googleToken
              ? `Connected (${googleEvents.length} upcoming)`
              : "Not connected"}
          </p>
        </div>
      </div>

      {/* Section 1: Tasks & Goals */}
      {sectionTab === "tasks" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Add Task / Goal Form */}
          <form
            onSubmit={handleCreateTask}
            className="lg:col-span-4 bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-3.5"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Target className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                New Task or Goal
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0D11] border border-slate-800 rounded-lg">
              {(["task", "goal"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTaskKind(k)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    taskKind === k
                      ? "bg-amber-400 text-slate-950 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Title</label>
              <input
                type="text"
                required
                maxLength={120}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Complete Punjabi Level 3"
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Details / Goal Target
              </label>
              <textarea
                rows={2}
                maxLength={400}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Optional notes or target milestone..."
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={taskCategory}
                  onChange={(e) =>
                    setTaskCategory(e.target.value as TaskCategory)
                  }
                  className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 px-2.5 py-2 text-xs text-white"
                >
                  <option value="study">Study</option>
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(e.target.value as TaskPriority)
                  }
                  className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 px-2.5 py-2 text-xs text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Language
                </label>
                <select
                  value={taskLang}
                  onChange={(e) =>
                    setTaskLang(e.target.value as LanguageCode | "all")
                  }
                  className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 px-2.5 py-2 text-xs text-white"
                >
                  <option value="all">General</option>
                  {LANGUAGE_LIST.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.nameNative}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(Number(e.target.value) || 30)}
                  className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 px-2.5 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingTask}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingTask ? "Adding..." : `Add ${taskKind}`}</span>
            </button>
          </form>

          {/* Task & Goal List */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                Your Tasks & Goals
              </h2>
              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadIcsFile(tasks, "ekonkar-schedule.ics")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12151C] hover:bg-[#191F2C] border border-slate-800 text-xs text-slate-200 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export All to Apple / Outlook (.ICS)</span>
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="bg-[#12151C] border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-2">
                <CheckSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">
                  No tasks or goals created yet
                </p>
                <p className="text-xs text-slate-500">
                  Add a personal goal or language practice task on the left, then schedule it to Google, Microsoft Outlook, or Apple Calendar.
                </p>
              </div>
            ) : (
              tasks.map((task) => {
                const links = getCalendarDeepLinks(task);
                return (
                  <div
                    key={task.id}
                    className={`bg-[#12151C] border rounded-xl p-4 space-y-3 transition-colors ${
                      task.completed ? "border-slate-800/60 opacity-75" : "border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          aria-label={
                            task.completed ? "Mark incomplete" : "Mark complete"
                          }
                          onClick={() =>
                            onSaveTask({
                              ...task,
                              completed: !task.completed,
                            })
                          }
                          className="mt-0.5 text-amber-400 hover:text-amber-300 shrink-0"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="capitalize text-amber-300 font-medium">
                              {task.kind}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{task.category}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                task.priority === "high"
                                  ? "text-rose-400"
                                  : task.priority === "medium"
                                  ? "text-sky-400"
                                  : "text-slate-400"
                              }
                            >
                              {task.priority} priority
                            </span>
                            {task.dueAtIso && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {new Date(task.dueAtIso).toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  ({task.durationMinutes}m)
                                </span>
                              </>
                            )}
                          </div>
                          <p
                            className={`text-sm font-semibold mt-1 ${
                              task.completed
                                ? "line-through text-slate-400"
                                : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-1">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Delete task"
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Multi-provider scheduling bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
                      {googleToken ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingGoogleAction({ type: "create", task })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 font-medium transition-colors whitespace-nowrap"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>
                            {task.googleEventId
                              ? "Synced to Google Calendar"
                              : "Sync to Google Calendar"}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={links.googleWeb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#171B24] hover:bg-[#202634] border border-slate-700/80 text-slate-200 transition-colors whitespace-nowrap"
                        >
                          <span>Google Calendar</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                        </a>
                      )}

                      <a
                        href={links.outlookLive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#171B24] hover:bg-[#202634] border border-slate-700/80 text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <span>Microsoft Outlook</span>
                        <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                      </a>

                      <a
                        href={links.office365}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#171B24] hover:bg-[#202634] border border-slate-700/80 text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <span>Office 365</span>
                        <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          downloadIcsFile(
                            [task],
                            `${task.title
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .slice(0, 32)}.ics`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#171B24] hover:bg-[#202634] border border-slate-700/80 text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <Download className="w-2.5 h-2.5 text-slate-400" />
                        <span>Apple / .ICS</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Section 2: Personal Notes */}
      {sectionTab === "notes" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleCreateNote}
            className="lg:col-span-4 bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-3.5"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <StickyNote className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">
                Create Personal Note
              </h2>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Note Title
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Gurmukhi Vowel Rules"
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Tag</label>
              <input
                type="text"
                maxLength={40}
                value={noteTag}
                onChange={(e) => setNoteTag(e.target.value)}
                placeholder="Study Note, Grammar, Personal..."
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Content
              </label>
              <textarea
                rows={5}
                maxLength={2000}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write reminders, word connections, or personal thoughts..."
                className="w-full rounded-lg bg-[#0B0D11] border border-slate-700/80 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs text-white resize-y"
              />
            </div>

            <button
              type="submit"
              disabled={savingNote}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingNote ? "Saving..." : "Save Note"}</span>
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">
                Saved Personal Notes
              </h2>
              <input
                type="search"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes..."
                className="bg-[#12151C] border border-slate-800 focus:border-amber-400 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white w-52"
              />
            </div>

            {filteredNotes.length === 0 ? (
              <div className="bg-[#12151C] border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-2">
                <StickyNote className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">
                  {notes.length === 0
                    ? "No personal notes yet"
                    : "No notes match your search"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`bg-[#12151C] border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                      note.pinned ? "border-amber-400/50" : "border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-amber-400 font-medium">
                            {note.tag || "Personal"}
                          </p>
                          <h3 className="text-sm font-semibold text-white mt-0.5">
                            {note.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={note.pinned ? "Unpin note" : "Pin note"}
                            onClick={() =>
                              onSaveNote({ ...note, pinned: !note.pinned })
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              note.pinned
                                ? "text-amber-400 bg-amber-400/10"
                                : "text-slate-500 hover:text-white"
                            }`}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete note"
                            onClick={() => onDeleteNote(note.id)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">
                        {note.content || "—"}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/70 tabular-nums">
                      Updated {new Date(note.updatedAtMs).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: Calendar Sync (Google, Microsoft, Apple / Other) */}
      {sectionTab === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Providers Card */}
          <div className="lg:col-span-5 bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Connect & Sync Calendars
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Connect Google Calendar for live event reading and scheduling, or export/send directly to Microsoft Outlook, Office 365, Apple Calendar, and Yahoo.
              </p>
            </div>

            {/* Official Google Sign-In Styled Button for Calendar */}
            <div className="p-4 rounded-xl bg-[#0E1117] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">
                  Google Calendar (Live Sync)
                </p>
                <span
                  className={`text-[11px] font-medium ${
                    googleToken ? "text-emerald-400" : "text-slate-400"
                  }`}
                >
                  {googleToken ? "Connected" : "Authorization Needed"}
                </span>
              </div>

              <button
                type="button"
                onClick={onConnectGoogleCalendar}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-medium text-xs flex items-center justify-center gap-2.5 transition-colors shadow-xs"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
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
                <span>
                  {googleToken
                    ? "Reconnect / Refresh Google Calendar"
                    : "Sign in with Google to Sync Calendar"}
                </span>
              </button>

              {googleError && (
                <p className="text-xs text-rose-400">{googleError}</p>
              )}
            </div>

            {/* Microsoft & Other Calendar Integration */}
            <div className="p-4 rounded-xl bg-[#0E1117] border border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-white">
                Microsoft Outlook, Apple & Other Calendars
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Download a universal `.ics` schedule bundle compatible with Apple Calendar, Microsoft Outlook Desktop, Proton, and Thunderbird—or push individual tasks directly to Outlook.com / Office 365 from your Tasks tab.
              </p>
              <button
                type="button"
                disabled={tasks.length === 0}
                onClick={() => downloadIcsFile(tasks, "ekonkar-study-calendar.ics")}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1A1F2B] hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Download Full Schedule (.ICS for Outlook / Apple)
                </span>
              </button>
            </div>
          </div>

          {/* Upcoming Google Calendar Agenda */}
          <div className="lg:col-span-7 bg-[#12151C] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-white">
                  Upcoming Google Calendar Agenda
                </h2>
              </div>

              {googleToken && (
                <button
                  type="button"
                  onClick={onRefreshGoogleCalendar}
                  disabled={googleEventsLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181C26] hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      googleEventsLoading ? "animate-spin" : ""
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {!googleToken ? (
              <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-300">
                  Google Calendar is not connected yet
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "Sign in with Google to Sync Calendar" on the left to load your upcoming schedule and push study tasks directly.
                </p>
              </div>
            ) : googleEvents.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400">
                  No upcoming events found on your primary Google Calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {googleEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-[#0E1117] border border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {ev.summary}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        {ev.startIso
                          ? new Date(ev.startIso).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "All day"}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open event in Google Calendar"
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        aria-label="Delete calendar event"
                        onClick={() =>
                          setPendingGoogleAction({
                            type: "delete",
                            eventId: ev.id,
                            summary: ev.summary,
                          })
                        }
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Modal for Google Calendar Create/Delete */}
      {pendingGoogleAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setPendingGoogleAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#12151C] border border-slate-700/80 rounded-2xl max-w-[440px] w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-white">
                  {pendingGoogleAction.type === "create"
                    ? "Confirm Google Calendar Event"
                    : "Delete Google Calendar Event"}
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {pendingGoogleAction.type === "create"
                    ? `Add "${pendingGoogleAction.task.title}" (${pendingGoogleAction.task.durationMinutes} min) to your primary Google Calendar?`
                    : `Permanently delete "${pendingGoogleAction.summary}" from your primary Google Calendar? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingGoogleAction(null)}
                className="px-4 py-2 rounded-lg bg-[#1A1E29] hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={googleBusy}
                onClick={executeConfirmedGoogleAction}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                  pendingGoogleAction.type === "delete"
                    ? "bg-rose-500 hover:bg-rose-400 text-white"
                    : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                }`}
              >
                {googleBusy
                  ? "Working..."
                  : pendingGoogleAction.type === "delete"
                  ? "Confirm Delete"
                  : "Add to Calendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerView;
