/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  X,
  Bell,
  Award,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCheck,
  Trash2,
  Settings,
} from "lucide-react";
import { AppNotification, NotificationCategory } from "../types";

interface NotificationsDrawerProps {
  open: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onOpenSettings: () => void;
}

function formatTimeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function categoryIcon(cat: NotificationCategory) {
  switch (cat) {
    case "achievement":
      return <Award className="w-4 h-4 text-amber-400 shrink-0" />;
    case "security":
      return <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />;
    case "progress":
      return <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />;
    case "reminder":
    default:
      return <Clock className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onOpenSettings,
}) => {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        aria-label="Notifications"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] h-full bg-[#12151C] border-l border-slate-800 flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-[#161A23]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-white">Notifications</h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {unreadCount} unread
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="w-9 h-9 rounded-lg bg-[#1E222D] hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#0E1117] rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === "all"
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === "unread"
                  ? "bg-amber-400 text-slate-950 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
          {visible.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                {filter === "unread"
                  ? "All caught up"
                  : "No notifications yet"}
              </p>
              <p className="text-xs text-slate-500">
                Solve puzzles, unlock achievements, or sign in to receive activity alerts here.
              </p>
            </div>
          ) : (
            visible.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) onMarkRead(item.id);
                }}
                className={`p-4 transition-colors cursor-pointer ${
                  item.read
                    ? "bg-[#12151C] hover:bg-[#151922]"
                    : "bg-[#181D28] hover:bg-[#1C222F]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">{categoryIcon(item.category)}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium truncate ${
                            item.read ? "text-slate-300" : "text-white"
                          }`}
                        >
                          {item.title}
                        </p>
                        {!item.read && (
                          <span className="text-[11px] font-medium text-amber-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {item.body}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                        {formatTimeAgo(item.createdAtMs)} · {item.category}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(item.id);
                    }}
                    className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800/60 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-[#161A23] flex items-center justify-between">
          <span className="text-xs text-slate-400">Alert preferences</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage in Account</span>
          </button>
        </div>
      </aside>
    </div>
  );
};

export default NotificationsDrawer;
